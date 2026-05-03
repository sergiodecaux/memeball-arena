// src/ui/league/LeagueCarousel.ts
// Карусель для просмотра всех лиг

import Phaser from 'phaser';
import { LeagueTier } from '../../types/league';
import { getLeagueTierInfo } from '../../types/leagueRewards';
import { getColors, getFonts, TYPOGRAPHY, hexToString } from '../../config/themes';
import { tgApp } from '../../utils/TelegramWebApp';
import { AudioManager } from '../../managers/AudioManager';
import { LEAGUE_BADGE_KEYS } from '../../config/assetKeys';
import { ensureLeagueBadgeTexture } from '../../utils/leagueBadgeProcedural';

const ALL_TIERS: LeagueTier[] = [
  LeagueTier.METEORITE,
  LeagueTier.COMET,
  LeagueTier.PLANET,
  LeagueTier.STAR,
  LeagueTier.NEBULA,
  LeagueTier.CORE,
];

export interface LeagueCarouselConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  currentTier: LeagueTier;
  onTierChanged: (tier: LeagueTier) => void;
}

/**
 * Карусель лиг с возможностью свайпа
 */
export class LeagueCarousel {
  private scene: Phaser.Scene;
  private config: LeagueCarouselConfig;
  private container: Phaser.GameObjects.Container;
  
  private currentIndex: number = 0;
  private cards: Phaser.GameObjects.Container[] = [];
  private dots: Phaser.GameObjects.Graphics[] = [];
  
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragCurrentX: number = 0;
  
  constructor(scene: Phaser.Scene, config: LeagueCarouselConfig) {
    this.scene = scene;
    this.config = config;
    this.container = this.scene.add.container(config.x, config.y);
    
    // Найти индекс текущей лиги
    this.currentIndex = ALL_TIERS.indexOf(config.currentTier);
    if (this.currentIndex === -1) this.currentIndex = 0;
    
    this.createCarousel();
    this.setupInteractions();
  }
  
  /**
   * Создаёт карусель
   */
  private createCarousel(): void {
    const colors = getColors();
    const fonts = getFonts();
    const s = tgApp.getUIScale();
    
    // Создаём карточки для всех лиг
    ALL_TIERS.forEach((tier, index) => {
      const card = this.createLeagueCard(tier, index);
      this.cards.push(card);
      this.container.add(card);
    });
    
    // Создаём точки-индикаторы
    const dotsY = this.config.height / 2 + 40 * s;
    const dotSpacing = 20 * s;
    const totalDotsWidth = (ALL_TIERS.length - 1) * dotSpacing;
    const dotsStartX = -totalDotsWidth / 2;
    
    ALL_TIERS.forEach((_, index) => {
      const dot = this.scene.add.graphics();
      const dotX = dotsStartX + index * dotSpacing;
      
      if (index === this.currentIndex) {
        dot.fillStyle(colors.uiAccent, 1);
        dot.fillCircle(dotX, dotsY, 5 * s);
      } else {
        dot.fillStyle(colors.uiTextSecondary, 0.3);
        dot.fillCircle(dotX, dotsY, 4 * s);
      }
      
      this.dots.push(dot);
      this.container.add(dot);
    });
    
    // Создаём стрелки
    this.createArrows();
    
    // Позиционируем карточки
    this.updateCardPositions(0);
  }
  
  /**
   * Создаёт карточку лиги
   */
  private createLeagueCard(tier: LeagueTier, index: number): Phaser.GameObjects.Container {
    const colors = getColors();
    const fonts = getFonts();
    const s = tgApp.getUIScale();
    const info = getLeagueTierInfo(tier);
    
    const card = this.scene.add.container(0, 0);
    const cardWidth = this.config.width * 0.8;
    const cardHeight = this.config.height * 0.7;
    
    // Фон карточки
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0a12, 0.85);
    bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 15 * s);
    bg.lineStyle(2 * s, info.color, 0.8);
    bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 15 * s);
    card.add(bg);
    
    // Бейдж лиги
    const badgeKey = LEAGUE_BADGE_KEYS[tier.toUpperCase() as keyof typeof LEAGUE_BADGE_KEYS];
    ensureLeagueBadgeTexture(this.scene, badgeKey, info.color, tier);

    if (this.scene.textures.exists(badgeKey)) {
      const badge = this.scene.add.image(0, -cardHeight / 4, badgeKey);
      badge.setDisplaySize(100 * s, 100 * s);
      card.add(badge);
      
      // Анимация вращения бейджа
      this.scene.tweens.add({
        targets: badge,
        angle: 360,
        duration: 20000,
        repeat: -1,
        ease: 'Linear',
      });
    }
    
    // Название лиги
    const nameText = this.scene.add.text(0, cardHeight / 4 - 40 * s, info.nameRu.toUpperCase(), {
      fontSize: `${TYPOGRAPHY.sizes.xl * s}px`,
      fontFamily: fonts.primary,
      color: hexToString(colors.uiText),
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    card.add(nameText);
    
    // Описание
    const descText = this.scene.add.text(0, cardHeight / 4, info.description, {
      fontSize: `${TYPOGRAPHY.sizes.sm * s}px`,
      fontFamily: fonts.primary,
      color: hexToString(colors.uiTextSecondary),
      align: 'center',
    }).setOrigin(0.5);
    card.add(descText);
    
    // Цветовой акцент
    const accentLine = this.scene.add.graphics();
    accentLine.fillStyle(info.color, 0.6);
    accentLine.fillRect(-cardWidth / 4, cardHeight / 2 - 30 * s, cardWidth / 2, 3 * s);
    card.add(accentLine);
    
    return card;
  }
  
  /**
   * Создаёт стрелки для переключения
   */
  private createArrows(): void {
    const colors = getColors();
    const s = tgApp.getUIScale();
    const arrowX = this.config.width / 2 - 30 * s;
    const arrowSize = 15 * s;
    
    // Левая стрелка
    const leftArrow = this.scene.add.graphics();
    leftArrow.fillStyle(colors.uiAccent, 0.8);
    leftArrow.fillTriangle(
      -arrowX + arrowSize, -arrowSize,
      -arrowX + arrowSize, arrowSize,
      -arrowX, 0
    );
    this.container.add(leftArrow);
    
    // Правая стрелка
    const rightArrow = this.scene.add.graphics();
    rightArrow.fillStyle(colors.uiAccent, 0.8);
    rightArrow.fillTriangle(
      arrowX - arrowSize, -arrowSize,
      arrowX - arrowSize, arrowSize,
      arrowX, 0
    );
    this.container.add(rightArrow);
    
    // Интерактивность стрелок
    const leftZone = this.scene.add.rectangle(-arrowX, 0, 50 * s, 50 * s, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    leftZone.on('pointerdown', () => this.previousLeague());
    this.container.add(leftZone);
    
    const rightZone = this.scene.add.rectangle(arrowX, 0, 50 * s, 50 * s, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    rightZone.on('pointerdown', () => this.nextLeague());
    this.container.add(rightZone);
  }
  
  /**
   * Настраивает свайп
   */
  private setupInteractions(): void {
    const zone = this.scene.add.rectangle(
      this.config.x,
      this.config.y,
      this.config.width,
      this.config.height,
      0x000000,
      0
    ).setInteractive();
    
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStartX = pointer.x;
      this.dragCurrentX = pointer.x;
    });
    
    zone.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        this.dragCurrentX = pointer.x;
        const delta = this.dragCurrentX - this.dragStartX;
        this.updateCardPositions(delta);
      }
    });
    
    zone.on('pointerup', () => {
      if (this.isDragging) {
        const delta = this.dragCurrentX - this.dragStartX;
        if (Math.abs(delta) > 50) {
          if (delta < 0) {
            this.nextLeague();
          } else {
            this.previousLeague();
          }
        } else {
          this.updateCardPositions(0, true);
        }
        this.isDragging = false;
      }
    });
  }
  
  /**
   * Обновляет позиции карточек
   */
  private updateCardPositions(dragDelta: number, animate: boolean = false): void {
    const cardSpacing = this.config.width * 0.9;
    
    this.cards.forEach((card, index) => {
      const offset = (index - this.currentIndex) * cardSpacing;
      const targetX = offset + dragDelta;
      
      if (animate) {
        this.scene.tweens.add({
          targets: card,
          x: offset,
          duration: 300,
          ease: 'Power2',
        });
      } else {
        card.x = targetX;
      }
      
      // Прозрачность и масштаб
      const distance = Math.abs(index - this.currentIndex);
      const alpha = distance === 0 ? 1 : 0.3;
      const scale = distance === 0 ? 1 : 0.8;
      
      if (animate) {
        this.scene.tweens.add({
          targets: card,
          alpha,
          scale,
          duration: 300,
          ease: 'Power2',
        });
      } else {
        card.setAlpha(alpha);
        card.setScale(scale);
      }
    });
  }
  
  /**
   * Обновляет точки
   */
  private updateDots(): void {
    const colors = getColors();
    const s = tgApp.getUIScale();
    const dotsY = this.config.height / 2 + 40 * s;
    const dotSpacing = 20 * s;
    const totalDotsWidth = (ALL_TIERS.length - 1) * dotSpacing;
    const dotsStartX = -totalDotsWidth / 2;
    
    this.dots.forEach((dot, index) => {
      dot.clear();
      const dotX = dotsStartX + index * dotSpacing;
      
      if (index === this.currentIndex) {
        dot.fillStyle(colors.uiAccent, 1);
        dot.fillCircle(dotX, dotsY, 5 * s);
      } else {
        dot.fillStyle(colors.uiTextSecondary, 0.3);
        dot.fillCircle(dotX, dotsY, 4 * s);
      }
    });
  }
  
  /**
   * Следующая лига
   */
  private nextLeague(): void {
    if (this.currentIndex < ALL_TIERS.length - 1) {
      this.currentIndex++;
      this.updateCardPositions(0, true);
      this.updateDots();
      this.config.onTierChanged(ALL_TIERS[this.currentIndex]);
      AudioManager.getInstance().playSFX('sfx_ui_click');
    }
  }
  
  /**
   * Предыдущая лига
   */
  private previousLeague(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.updateCardPositions(0, true);
      this.updateDots();
      this.config.onTierChanged(ALL_TIERS[this.currentIndex]);
      AudioManager.getInstance().playSFX('sfx_ui_click');
    }
  }
  
  /**
   * Получить контейнер
   */
  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
  
  /**
   * Уничтожить карусель
   */
  destroy(): void {
    this.container.destroy(true);
  }
}

