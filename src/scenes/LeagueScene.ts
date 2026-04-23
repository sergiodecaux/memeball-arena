// src/scenes/LeagueScene.ts
// Clean Esports League Scene - Без лишних эффектов

import Phaser from 'phaser';
import { getColors, getFonts, TYPOGRAPHY, hexToString, applyTextShadow } from '../config/themes';
import { playerData } from '../data/PlayerData';
import { AudioManager } from '../managers/AudioManager';
import { tgApp } from '../utils/TelegramWebApp';
import { hapticImpact } from '../utils/Haptics';
import { LeagueTier, LeagueProgress, LEAGUE_AI_DIFFICULTY, LEAGUE_TEAM_SIZE, LEAGUE_ENTRY_FEE, LEAGUE_STAR_BUYBACK, createDefaultLeagueProgress, getLeagueTierOrder } from '../types/league';
import { LeagueManager, ORBIT_STABILIZATION_COSTS } from '../managers/LeagueManager';
import { LEAGUE_HUB_BG, LEAGUE_BADGE_KEYS, TOURNAMENT_CUP_KEYS, LEAGUE_ORBIT_KEYS } from '../config/assetKeys';
import { addFullScreenBackground } from '../utils/ImageUtils';
import { getLeagueTierInfo, LEAGUE_TIER_REWARDS } from '../types/leagueRewards';
import { SwipeNavigationManager } from '../ui/SwipeNavigationManager';
import { SWIPE_NAVIGATION, FACTION_IDS } from '../constants/gameConstants';
import { safeSceneStart } from '../utils/SceneHelpers';

const ALL_TIERS: LeagueTier[] = [
  LeagueTier.METEORITE,
  LeagueTier.COMET,
  LeagueTier.PLANET,
  LeagueTier.STAR,
  LeagueTier.NEBULA,
  LeagueTier.CORE,
];

/**
 * Clean Galaxy League Scene - Простой и читаемый дизайн
 */
export class LeagueScene extends Phaser.Scene {
  private topInset = 0;
  private bottomInset = 0;
  private headerHeight = 120;
  
  private currentViewIndex: number = 0;
  private playerProgress: LeagueProgress;
  
  private carouselContainer?: Phaser.GameObjects.Container;
  private leagueCards: Phaser.GameObjects.Container[] = [];
  
  private orbitDecayModal?: Phaser.GameObjects.Container;
  private swipeManager?: SwipeNavigationManager;
  
  constructor() {
    super({ key: 'LeagueScene' });
    this.playerProgress = playerData.get().leagueProgress || createDefaultLeagueProgress();
  }
  
  create(data?: { 
    showOrbitDecay?: boolean; 
    fromMatch?: boolean; 
    oldStars?: number;
    oldTier?: LeagueTier;
    oldDivision?: number;
    matchResult?: 'win' | 'loss' | 'draw';
  }): void {
    this.topInset = Math.max(tgApp.getTopInset(), 60);
    this.bottomInset = Math.max(tgApp.getBottomInset(), 40);
    this.headerHeight = 120 + this.topInset;
    
    AudioManager.getInstance().init(this);
    
    // ✅ Обновляем прогресс из playerData
    this.playerProgress = playerData.get().leagueProgress || createDefaultLeagueProgress();
    
    this.currentViewIndex = ALL_TIERS.indexOf(this.playerProgress.currentTier);
    if (this.currentViewIndex === -1) this.currentViewIndex = 0;
    
    this.createBackground();
    this.createHeader();
    this.createCarousel();
    this.createButtons();
    this.setupSwipeNavigation();
    
    // ✅ Анимация изменения звезд после матча
    if (data?.fromMatch && data.oldStars !== undefined) {
      const currentCard = this.leagueCards[this.currentViewIndex];
      
      // Проверяем было ли повышение лиги/дивизиона
      const wasPromotion = data.oldTier && (
        getLeagueTierOrder(this.playerProgress.currentTier) > getLeagueTierOrder(data.oldTier) ||
        (this.playerProgress.currentTier === data.oldTier && 
         data.oldDivision && this.playerProgress.division < data.oldDivision)
      );
      
      if (wasPromotion) {
        // 🎉 ПОВЫШЕНИЕ ЛИГИ - показываем модал о новой лиге
        this.time.delayedCall(500, () => {
          this.showLeaguePromotionModal(data.oldTier!, data.oldDivision!, () => {
            // После закрытия модала анимируем звёзды
            if (currentCard && (currentCard as any).stars) {
              const info = getLeagueTierInfo(this.playerProgress.currentTier);
              this.animateStarChangeOnCard(currentCard, 0, this.playerProgress.stars, info.color);
            }
          });
        });
      } else if (data.matchResult === 'loss' && data.oldStars > this.playerProgress.stars) {
        // 💔 ПОРАЖЕНИЕ с потерей звезды - предлагаем выкуп
        this.time.delayedCall(800, () => {
          this.showStarBuybackModal(data.oldStars!, () => {
            if (currentCard && (currentCard as any).stars) {
              const info = getLeagueTierInfo(this.playerProgress.currentTier);
              this.animateStarChangeOnCard(currentCard, data.oldStars!, this.playerProgress.stars, info.color);
            }
          });
        });
      } else {
        // Обычная анимация (победа без повышения, ничья)
        if (currentCard && (currentCard as any).stars) {
          this.time.delayedCall(500, () => {
            const info = getLeagueTierInfo(this.playerProgress.currentTier);
            this.animateStarChangeOnCard(currentCard, data.oldStars!, this.playerProgress.stars, info.color);
          });
        }
      }
    }
    
    if (data?.showOrbitDecay) {
      this.time.delayedCall(300, () => this.showOrbitDecayModal());
    }
  }
  
  /**
   * Создаёт фон
   */
  private createBackground(): void {
    const { width, height } = this.cameras.main;
    const info = getLeagueTierInfo(this.playerProgress.currentTier);
    
    // 1. Deep Space Base
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x020617, 0x020617, 0x0f172a, 0x0f172a, 1);
    bg.fillRect(0, 0, width, height);

    // 2. Stars Field (Procedural)
    const stars = this.add.graphics();
    stars.fillStyle(0xffffff, 1);
    for(let i=0; i<100; i++) {
        const x = Phaser.Math.Between(0, width);
        const y = Phaser.Math.Between(0, height);
        const size = Phaser.Math.FloatBetween(1, 3);
        const alpha = Phaser.Math.FloatBetween(0.3, 0.8);
        stars.fillStyle(0xffffff, alpha);
        stars.fillCircle(x, y, size);
    }
    
    // 3. THE PLANET (Dynamic based on Tier Color)
    const planetColor = info.color;
    const planetGroup = this.add.container(width/2, height/2);
    
    // Atmosphere Glow
    const atmosphere = this.add.graphics();
    atmosphere.fillStyle(planetColor, 0.2);
    atmosphere.fillCircle(0, 0, width * 0.65);
    planetGroup.add(atmosphere);
    
    // Planet Body
    const planet = this.add.graphics();
    planet.fillStyle(planetColor, 1);
    planet.fillCircle(0, 0, width * 0.5);
    
    // Shadow (Crescent effect)
    planet.fillStyle(0x000000, 0.6);
    planet.beginPath();
    planet.arc(0, 0, width * 0.51, -Math.PI/4, Math.PI * 0.75, false);
    planet.fillPath();
    
    planetGroup.add(planet);
    
    // Animated Rotation Effect (Simulated by moving texture/noise if we had it, but here we pulse)
    this.tweens.add({
        targets: atmosphere,
        scale: { from: 1, to: 1.1 },
        alpha: { from: 0.2, to: 0.1 },
        duration: 3000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });
    
    // Add Planet to Scene (behind everything)
    planetGroup.setDepth(0);
    this.add.existing(planetGroup);
  }
  
  /**
   * Создаёт заголовок
   */
  private createHeader(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const s = tgApp.getUIScale();
    
    // Фон заголовка
    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x0a0a1e, 0.95);
    headerBg.fillRect(0, 0, width, this.headerHeight);
    headerBg.setDepth(100);
    
    // ✅ Увеличиваем высоту шапки под кнопки Telegram
    const safeHeaderHeight = this.topInset + 100 * s;
    
    // Линия снизу
    const line = this.add.graphics();
    line.lineStyle(2 * s, colors.uiAccent, 0.5);
    line.lineBetween(0, safeHeaderHeight, width, safeHeaderHeight);
    line.setDepth(101);
    
    // Кнопка назад (ниже кнопок Telegram)
    const backBtn = this.add.text(20 * s, this.topInset + 50 * s, '✕', {
      fontSize: `${40 * s}px`,
      fontFamily: getFonts().primary,
      color: hexToString(colors.uiText),
    }).setOrigin(0, 0.5).setDepth(102).setInteractive({ useHandCursor: true });
    
    backBtn.on('pointerdown', () => this.handleBack());
    
    // Заголовок (название лиги остаётся на английском)
    const title = this.add.text(width / 2, this.topInset + 50 * s, 'GALAXY LEAGUE', {
      fontSize: `${TYPOGRAPHY.sizes.xxl * s}px`,
      fontFamily: getFonts().primary,
      color: hexToString(colors.uiText),
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(102);
    
    // Subtitle (на русском)
    const subtitle = this.add.text(width / 2, this.topInset + 85 * s, 'Рейтинговые 1х1 • Киберспорт', {
      fontSize: `${TYPOGRAPHY.sizes.sm * s}px`,
      fontFamily: getFonts().primary,
      color: hexToString(colors.uiTextSecondary),
    }).setOrigin(0.5, 0.5).setDepth(102);
  }
  
  /**
   * Создаёт карусель
   */
  private createCarousel(): void {
    const { width, height } = this.cameras.main;
    const s = tgApp.getUIScale();
    
    const carouselY = this.headerHeight + 30 * s;
    const carouselHeight = height - this.headerHeight - 200 * s - this.bottomInset;
    
    // Очищаем старые данные
    this.leagueCards = [];
    
    this.carouselContainer = this.add.container(0, carouselY);
    this.carouselContainer.setDepth(10);
    
    ALL_TIERS.forEach((tier, index) => {
      const card = this.createCard(tier, index, carouselHeight);
      this.leagueCards.push(card);
      this.carouselContainer!.add(card);
    });
    
    // Убрали dots - больше нет точек!
    this.createArrows(carouselHeight / 2);
    this.updateCardPositions(false);
  }
  
  /**
   * Создаёт карточку лиги (простая и читаемая)
   */
  private createCard(tier: LeagueTier, index: number, height: number): Phaser.GameObjects.Container {
    const { width } = this.cameras.main;
    const colors = getColors();
    const s = tgApp.getUIScale();
    const info = getLeagueTierInfo(tier);
    
    const card = this.add.container(width / 2, height / 2);
    const cardWidth = width * 0.85; // Slightly narrower for elegance
    const cardHeight = height * 0.75; // More compact
    
    // === GLASSMORPHISM BACKGROUND ===
    const bg = this.add.graphics();
    
    // Dark semi-transparent fill
    bg.fillStyle(0x0f172a, 0.75); 
    bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 24 * s);
    
    // Gradient Border (Tier Color -> Transparent)
    bg.lineStyle(2, info.color, 0.8);
    bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 24 * s);
    
    // Inner Shine (Top)
    bg.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0.1, 0.1, 0, 0);
    bg.fillRect(-cardWidth / 2, -cardHeight / 2, cardWidth, 60 * s);
    
    card.add(bg);
    
    // === BADGE WITH GLOW ===
    const badgeKey = LEAGUE_BADGE_KEYS[tier.toUpperCase() as keyof typeof LEAGUE_BADGE_KEYS];
    if (this.textures.exists(badgeKey)) {
        // Glow behind badge
        if (this.textures.exists('flare_white')) {
            const glow = this.add.image(0, -cardHeight / 3 + 20 * s, 'flare_white');
            glow.setTint(info.color);
            glow.setAlpha(0.4);
            glow.setDisplaySize(200 * s, 200 * s);
            card.add(glow);
        }

        const badge = this.add.image(0, -cardHeight / 3 + 20 * s, badgeKey);
        badge.setDisplaySize(120 * s, 120 * s);
        
        // Float Animation
        this.tweens.add({
            targets: badge,
            y: badge.y - 10,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        card.add(badge);
    }
    
    // === LEAGUE NAME ===
    const nameText = this.add.text(0, -cardHeight / 3 + 100 * s, info.name.toUpperCase(), {
      fontSize: `${32 * s}px`,
      fontFamily: getFonts().tech, // Use Tech font for sci-fi feel
      color: hexToString(info.color),
      fontStyle: 'bold',
      shadow: { blur: 10, color: hexToString(info.color), fill: true, offsetX: 0, offsetY: 0 }
    }).setOrigin(0.5);
    card.add(nameText);
    
    // === CONTENT SEPARATOR ===
    const divider = this.add.graphics();
    divider.lineStyle(2, info.color, 0.3);
    divider.lineBetween(-cardWidth * 0.3, -cardHeight / 3 + 130 * s, cardWidth * 0.3, -cardHeight / 3 + 130 * s);
    card.add(divider);
    
    // === CONTENT ===
    if (tier === this.playerProgress.currentTier) {
      this.addPlayerProgress(card, cardHeight, s, info.color);
    } else {
      this.addLeagueRewards(card, tier, cardHeight, s, info.color);
    }
    
    return card;
  }
  
  /**
   * Добавляет прогресс игрока
   */
  private addPlayerProgress(card: Phaser.GameObjects.Container, cardHeight: number, s: number, color: number): void {
    const colors = getColors();
    const division = ['I', 'II', 'III'][this.playerProgress.division - 1];
    const fonts = getFonts();
    
    const contentStartY = -cardHeight / 3 + 160 * s;
    
    // === DIVISION BADGE ===
    const divContainer = this.add.container(0, contentStartY);
    
    // Hexagon background for division
    const divBg = this.add.graphics();
    divBg.fillStyle(color, 0.2);
    // Draw simple hexagon
    const hexSize = 30 * s;
    divBg.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = Phaser.Math.DegToRad(60 * i - 30);
        divBg.lineTo(Math.cos(angle) * 80 * s, Math.sin(angle) * 25 * s);
    }
    divBg.closePath();
    divBg.fillPath();
    divBg.lineStyle(1, color, 0.5);
    divBg.strokePath();
    divContainer.add(divBg);

    const rankText = this.add.text(0, 0, `DIVISION ${division}`, {
      fontSize: `${18 * s}px`,
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    divContainer.add(rankText);
    card.add(divContainer);
    
    // === STARS (ACTIVE & GLOWING) ===
    const starsY = contentStartY + 60 * s;
    const starSize = 40 * s;
    const starSpacing = 50 * s;
    const totalWidth = (this.playerProgress.maxStars - 1) * starSpacing;
    const startX = -totalWidth / 2;
    
    const stars: Phaser.GameObjects.Text[] = [];
    
    for (let i = 0; i < this.playerProgress.maxStars; i++) {
      const starX = startX + i * starSpacing;
      const isFilled = i < this.playerProgress.stars;
      
      // Star Background (Empty slot)
      const starBg = this.add.text(starX, starsY, '☆', {
        fontSize: `${starSize}px`, color: '#334155'
      }).setOrigin(0.5);
      card.add(starBg);

      // Filled Star (Overlay)
      const star = this.add.text(starX, starsY, '★', {
        fontSize: `${starSize}px`,
        color: hexToString(color),
      }).setOrigin(0.5).setName(`star_${i}`);
      
      star.setAlpha(isFilled ? 1 : 0);
      
      // Glow effect for filled stars
      if (isFilled) {
          star.setShadow(0, 0, hexToString(color), 10, true, true);
          // Subtle pulse
          this.tweens.add({
              targets: star,
              scale: { from: 1, to: 1.15 },
              duration: 1000 + (i * 200), // Staggered pulse
              yoyo: true,
              repeat: -1
          });
      }
      
      card.add(star);
      stars.push(star);
    }
    
    (card as any).stars = stars;
    (card as any).starColor = color;
    
    // === PROGRESS BAR (Visual Line) ===
    const progressY = starsY + 50 * s;
    const barWidth = 240 * s;
    const barHeight = 6 * s;
    
    // Track
    const track = this.add.rectangle(0, progressY, barWidth, barHeight, 0x1e293b).setOrigin(0.5);
    card.add(track);
    
    // Fill
    const fillPct = this.playerProgress.stars / this.playerProgress.maxStars;
    if (fillPct > 0) {
        const fill = this.add.rectangle(-barWidth/2, progressY, barWidth * fillPct, barHeight, color).setOrigin(0, 0.5);
        card.add(fill);
        // Glow tip
        const tip = this.add.circle(-barWidth/2 + barWidth * fillPct, progressY, 6 * s, color);
        card.add(tip);
    }

    // === RULES (Compact Grid) ===
    const rulesY = progressY + 40 * s;
    // ... Keeping logic simple for rules, maybe icons instead of text list later ...
    const ruleText = this.add.text(0, rulesY, 'WIN +1 ★  |  LOSS -1 ★', {
        fontSize: `${12 * s}px`, fontFamily: fonts.tech, color: '#94a3b8'
    }).setOrigin(0.5);
    card.add(ruleText);
  }
  
  /**
   * Добавляет награды
   */
  private addLeagueRewards(card: Phaser.GameObjects.Container, tier: LeagueTier, cardHeight: number, s: number, color: number): void {
    const colors = getColors();
    
    // ✅ УЛУЧШЕННЫЙ SPACING: Начало контента ниже разделителя
    const contentStartY = -cardHeight / 3 + 180 * s;
    
    // Заголовок на читаемом фоне
    const titleBg = this.add.graphics();
    titleBg.fillStyle(0x000000, 0.5);
    titleBg.fillRoundedRect(-100 * s, contentStartY - 18 * s, 200 * s, 35 * s, 8 * s);
    card.add(titleBg);
    
    const rewardsTitle = this.add.text(0, contentStartY, 'REWARDS', {
      fontSize: `${TYPOGRAPHY.sizes.lg * s}px`,
      fontFamily: getFonts().primary,
      color: hexToString(colors.uiText),
      fontStyle: 'bold',
    }).setOrigin(0.5);
    applyTextShadow(rewardsTitle, 'medium');
    card.add(rewardsTitle);
    
    // ✅ Награды (с улучшенным spacing)
    const rewardsStartY = contentStartY + 40 * s; // 40px ниже заголовка
    const divisionRewards = [
      { div: 'III', reward: LEAGUE_TIER_REWARDS[tier].rewards.division3, y: 0 },
      { div: 'II', reward: LEAGUE_TIER_REWARDS[tier].rewards.division2, y: 50 },
      { div: 'I', reward: LEAGUE_TIER_REWARDS[tier].rewards.division1, y: 100 },
    ];
    
    divisionRewards.forEach(({ div, reward, y }) => {
      const rowY = rewardsStartY + y; // ✅ Используем относительную позицию
      
      // Читаемый фон
      const rowBg = this.add.graphics();
      rowBg.fillStyle(0x000000, 0.4);
      rowBg.fillRoundedRect(-cardHeight * 0.38, rowY - 12 * s, cardHeight * 0.76, 28 * s, 6 * s);
      card.add(rowBg);
      
      // Дивизион
      const divText = this.add.text(-cardHeight * 0.32, rowY, `DIV ${div}`, {
        fontSize: `${TYPOGRAPHY.sizes.sm * s}px`,
        fontFamily: getFonts().primary,
        color: hexToString(colors.uiText),
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      card.add(divText);
      
      // Награды
      const rewardsStr = [];
      if (reward.rewards.coins) rewardsStr.push(`💰 ${(reward.rewards.coins / 1000).toFixed(0)}K`);
      if (reward.rewards.crystals) rewardsStr.push(`💎 ${reward.rewards.crystals}`);
      if (reward.rewards.cardPack) {
        const packIcons = { common: '📦', rare: '🎁', epic: '✨' };
        rewardsStr.push(`${packIcons[reward.rewards.cardPack]}`);
      }
      
      const rewardText = this.add.text(cardHeight * 0.05, rowY, rewardsStr.join('  '), {
        fontSize: `${TYPOGRAPHY.sizes.sm * s}px`,
        fontFamily: getFonts().primary,
        color: hexToString(colors.uiTextSecondary),
      }).setOrigin(0, 0.5);
      card.add(rewardText);
    });
  }
  
  // Dots удалены - больше нет точек-индикаторов!
  
  /**
   * Создаёт стрелки
   */
  private createArrows(centerY: number): void {
    const { width } = this.cameras.main;
    const s = tgApp.getUIScale();
    
    const arrowSize = 24 * s;
    const arrowX = width * 0.05;
    
    // Левая
    this.createArrowButton(-1, arrowX, centerY, arrowSize);
    
    // Правая
    this.createArrowButton(1, width - arrowX, centerY, arrowSize);
  }
  
  private createArrowButton(direction: number, x: number, y: number, size: number): void {
    const colors = getColors();
    const container = this.add.container(x, this.headerHeight + y).setDepth(20);
    
    // Простой фон
    const btnBg = this.add.circle(0, 0, size * 1.3, 0x1a1a2e, 0.8);
    container.add(btnBg);
    
    // Рамка
    const border = this.add.circle(0, 0, size * 1.3);
    border.setStrokeStyle(2, colors.uiAccent, 0.6);
    container.add(border);
    
    // Стрелка
    const arrow = this.add.text(0, 0, direction > 0 ? '▶' : '◀', {
      fontSize: `${size * 0.7}px`,
      color: hexToString(colors.uiText),
    }).setOrigin(0.5);
    container.add(arrow);
    
    // Интерактивность
    const zone = this.add.circle(0, 0, size * 1.3, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    container.add(zone);
    
    zone.on('pointerdown', () => {
      if (direction > 0) this.nextLeague();
      else this.previousLeague();
    });
  }
  
  /**
   * Создаёт кнопки
   */
  private createButtons(): void {
    const { width, height } = this.cameras.main;
    const s = tgApp.getUIScale();
    
    const btnY = height - this.bottomInset - 110 * s;
    const btnWidth = width * 0.9;
    const btnHeight = 52 * s;
    
    const tier = ALL_TIERS[this.currentViewIndex];
    const info = getLeagueTierInfo(tier);
    
    // Кнопка Play (на русском)
    this.createButton(
      width / 2,
      btnY,
      btnWidth,
      btnHeight,
      '⚔️ ИГРАТЬ РЕЙТИНГОВЫЙ МАТЧ',
      info.color,
      () => this.launchLeagueMatch()
    );
    
    // Кнопка Tournaments (на русском)
    this.createButton(
      width / 2,
      btnY + 60 * s,
      btnWidth,
      btnHeight,
      '🏆 ТУРНИРЫ ВЫХОДНОГО ДНЯ',
      0xffd700,
      () => this.showTournaments()
    );
  }
  
  /**
   * Создаёт премиальную кнопку с эффектами
   */
  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    color: number,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const s = tgApp.getUIScale();
    const btn = this.add.container(x, y).setDepth(50);
    
    // ✨ Внешнее свечение
    const outerGlow = this.add.graphics();
    outerGlow.fillStyle(color, 0.2);
    outerGlow.fillRoundedRect(-width / 2 - 4 * s, -height / 2 - 4 * s, width + 8 * s, height + 8 * s, 14 * s);
    outerGlow.setBlendMode(Phaser.BlendModes.ADD);
    btn.add(outerGlow);
    
    // Пульсация свечения
    this.tweens.add({
      targets: outerGlow,
      alpha: { from: 0.15, to: 0.3 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    
    // 🎨 Градиентный фон
    const darkerColor = Phaser.Display.Color.IntegerToColor(color).darken(20).color;
    const bg = this.add.graphics();
    bg.fillGradientStyle(color, color, darkerColor, darkerColor, 1);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 12 * s);
    btn.add(bg);
    
    // ✨ Внутренний блик (верхняя половина светлее)
    const highlight = this.add.graphics();
    highlight.fillStyle(0xffffff, 0.15);
    highlight.fillRoundedRect(-width / 2, -height / 2, width, height * 0.5, 12 * s);
    btn.add(highlight);
    
    // 🔲 Двойная рамка для премиума
    const border1 = this.add.graphics();
    border1.lineStyle(3 * s, 0xffffff, 0.4);
    border1.strokeRoundedRect(-width / 2, -height / 2, width, height, 12 * s);
    btn.add(border1);
    
    const border2 = this.add.graphics();
    border2.lineStyle(1.5 * s, color, 0.6);
    border2.strokeRoundedRect(-width / 2 - 2 * s, -height / 2 - 2 * s, width + 4 * s, height + 4 * s, 13 * s);
    btn.add(border2);
    
    // ✨ Декоративные блестки по углам
    const sparkSize = 3 * s;
    const sparkPositions = [
      { x: -width / 2 + 15 * s, y: -height / 2 + 15 * s },
      { x: width / 2 - 15 * s, y: -height / 2 + 15 * s },
      { x: -width / 2 + 15 * s, y: height / 2 - 15 * s },
      { x: width / 2 - 15 * s, y: height / 2 - 15 * s },
    ];
    
    sparkPositions.forEach((pos, index) => {
      const spark = this.add.graphics();
      spark.fillStyle(0xffffff, 0.8);
      spark.fillCircle(pos.x, pos.y, sparkSize);
      spark.setBlendMode(Phaser.BlendModes.ADD);
      btn.add(spark);
      
      // Мерцание блесток
      this.tweens.add({
        targets: spark,
        alpha: { from: 0.3, to: 1 },
        scale: { from: 0.7, to: 1.2 },
        duration: 800 + index * 100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    });
    
    // 📝 Текст с тенью
    const label = this.add.text(0, 0, text, {
      fontSize: `${TYPOGRAPHY.sizes.lg * s}px`,
      fontFamily: getFonts().primary,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4 * s,
    }).setOrigin(0.5);
    applyTextShadow(label, 'strong');
    btn.add(label);
    
    // 👆 Интерактивность
    const zone = this.add.rectangle(0, 0, width, height, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    btn.add(zone);
    
    // Сохраняем ссылки для анимаций
    (btn as any).__bg = bg;
    (btn as any).__label = label;
    (btn as any).__glow = outerGlow;
    
    // 🎬 Анимация наведения
    zone.on('pointerover', () => {
      this.tweens.add({
        targets: btn,
        scale: 1.03,
        duration: 150,
        ease: 'Back.easeOut'
      });
      
      // Усиление свечения
      this.tweens.add({
        targets: outerGlow,
        alpha: 0.4,
        duration: 150
      });
    });
    
    zone.on('pointerout', () => {
      this.tweens.add({
        targets: btn,
        scale: 1,
        duration: 150,
        ease: 'Quad.easeOut'
      });
      
      // Возврат свечения
      this.tweens.add({
        targets: outerGlow,
        alpha: 0.2,
        duration: 150
      });
    });
    
    // 🎬 Анимация нажатия
    zone.on('pointerdown', () => {
      hapticImpact('medium');
      AudioManager.getInstance().playSFX('sfx_ui_click');
      
      // Анимация нажатия
      this.tweens.add({
        targets: btn,
        scale: 0.97,
        duration: 80,
        yoyo: true,
        ease: 'Quad.easeInOut',
        onComplete: () => {
          onClick();
        }
      });
      
      // Вспышка при нажатии
      const flash = this.add.graphics();
      flash.fillStyle(0xffffff, 0.4);
      flash.fillRoundedRect(-width / 2, -height / 2, width, height, 12 * s);
      flash.setBlendMode(Phaser.BlendModes.ADD);
      btn.add(flash);
      
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 200,
        onComplete: () => flash.destroy()
      });
    });
    
    return btn;
  }
  
  /**
   * Настраивает свайп навигацию
   */
  private setupSwipeNavigation(): void {
    this.swipeManager = new SwipeNavigationManager(this, {
      onBack: () => this.handleBack(),
    });
    
    this.swipeManager.enable();
  }
  
  /**
   * Обработчик возврата (как в других сценах)
   */
  private handleBack(): void {
    AudioManager.getInstance().playSFX('sfx_ui_click');
    hapticImpact('light');
    
    if (this.swipeManager) {
      this.swipeManager.destroy();
      this.swipeManager = undefined;
    }
    
    this.scene.start('MainMenuScene');
  }
  
  /**
   * Обновляет позиции карточек
   */
  private updateCardPositions(animate: boolean): void {
    const { width } = this.cameras.main;
    
    this.leagueCards.forEach((card, index) => {
      const offset = (index - this.currentViewIndex) * width;
      const targetX = width / 2 + offset;
      const distance = Math.abs(index - this.currentViewIndex);
      const alpha = distance === 0 ? 1 : 0;
      const scale = distance === 0 ? 1 : 0.9;
      
      if (animate) {
        this.tweens.add({
          targets: card,
          x: targetX,
          alpha,
          scale,
          duration: 250,
          ease: 'Power2',
        });
      } else {
        card.setPosition(targetX, card.y);
        card.setAlpha(alpha);
        card.setScale(scale);
      }
    });
  }
  
  private nextLeague(): void {
    if (this.currentViewIndex < ALL_TIERS.length - 1) {
      this.currentViewIndex++;
      this.updateCardPositions(true);
      hapticImpact('light');
      AudioManager.getInstance().playSFX('sfx_ui_click');
    }
  }
  
  private previousLeague(): void {
    if (this.currentViewIndex > 0) {
      this.currentViewIndex--;
      this.updateCardPositions(true);
      hapticImpact('light');
      AudioManager.getInstance().playSFX('sfx_ui_click');
    }
  }
  
  private launchLeagueMatch(): void {
    const difficulty = LEAGUE_AI_DIFFICULTY[this.playerProgress.currentTier];
    const teamSize = LEAGUE_TEAM_SIZE[this.playerProgress.currentTier]; // 🎮 Размер команды
    const entryFee = LEAGUE_ENTRY_FEE[this.playerProgress.currentTier][this.playerProgress.division]; // 💰 Взнос
    
    // 🔒 Проверяем требования к участию
    const requirementCheck = this.checkLeagueRequirements(teamSize);
    if (!requirementCheck.canPlay) {
      this.showRequirementModal(requirementCheck.reason);
      return;
    }
    
    // 💰 Проверяем наличие средств для взноса
    const data = playerData.get();
    if (data.coins < entryFee) {
      this.showInsufficientFundsModal(entryFee, data.coins);
      return;
    }
    
    // 💰 Показываем модальное окно подтверждения взноса
    this.showEntryFeeConfirmModal(entryFee, async () => {
      // Списываем взнос
      playerData.addCoins(-entryFee);
      
      // ✅ ИСПРАВЛЕНО: Генерируем противника с аватаром для консистентности
      const opponent = this.generateOpponentData();
      
      // ✅ Запускаем экран подготовки к матчу (выбор фракции)
      await safeSceneStart(this, 'MatchPreparationScene', {
        matchContext: 'league',
        isAI: true, // ✅ КРИТИЧНО: Указываем что это матч против ИИ
        aiDifficulty: difficulty,
        opponentName: opponent.name,
        opponentAvatarId: opponent.avatarId, // ✅ Передаем аватар
        teamSize: teamSize, // 🎮 Передаем размер команды
        entryFee: entryFee, // 💰 Передаем взнос для расчета награды
      });
    });
  }
  
  private async showTournaments(): Promise<void> {
    await safeSceneStart(this, 'TournamentScene');
  }
  
  /**
   * 🔒 Проверяет требования к участию в лиге
   */
  private checkLeagueRequirements(requiredTeamSize: number): { canPlay: boolean; reason?: string } {
    const data = playerData.get();
    
    // Подсчитываем сколько фракций прокачаны до нужного размера
    const qualifiedFactions = FACTION_IDS.filter(factionId => {
      const units = data.ownedUnits[factionId];
      if (!units || units.length === 0) return false;
      
      // Проверяем сколько юнитов доступно для этой фракции
      const allowedSize = playerData.getAllowedTeamSize(factionId);
      return allowedSize >= requiredTeamSize;
    });
    
    const minFactionsRequired = 2; // Минимум 2 прокачанные фракции
    
    if (qualifiedFactions.length < minFactionsRequired) {
      let reason = '';
      if (requiredTeamSize === 3) {
        reason = `Для участия в этой лиге нужно открыть минимум ${minFactionsRequired} фракции.\n\nУ вас открыто: ${qualifiedFactions.length}`;
      } else if (requiredTeamSize === 4) {
        reason = `Для участия в этой лиге нужно прокачать минимум ${minFactionsRequired} фракции до 4 юнитов.\n\nУ вас прокачано: ${qualifiedFactions.length}`;
      } else if (requiredTeamSize === 5) {
        reason = `Для участия в этой лиге нужно прокачать минимум ${minFactionsRequired} фракции до 5 юнитов.\n\nУ вас прокачано: ${qualifiedFactions.length}`;
      }
      
      return { canPlay: false, reason };
    }
    
    return { canPlay: true };
  }
  
  /**
   * 💰 Показывает ПРЕМИУМ модальное окно подтверждения взноса
   */
  private showEntryFeeConfirmModal(entryFee: number, onConfirm: () => void): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const s = tgApp.getUIScale();
    
    // ✅ Премиальный overlay с blur эффектом
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.85);
    overlay.fillRect(0, 0, width, height);
    overlay.setDepth(200);
    overlay.setInteractive();
    
    // Modal container
    const modal = this.add.container(width / 2, height / 2).setDepth(201);
    
    // ✅ Премиальный фон с градиентом и свечением
    const modalWidth = 400 * s;
    const modalHeight = 440 * s; // Увеличена высота для новой панели наград
    
    // Glow effect (свечение)
    const glow = this.add.graphics();
    glow.fillStyle(0xffd700, 0.15);
    glow.fillRoundedRect(-modalWidth / 2 - 10 * s, -modalHeight / 2 - 10 * s, modalWidth + 20 * s, modalHeight + 20 * s, 25 * s);
    modal.add(glow);
    
    // Анимированное свечение
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.15, to: 0.25 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    
    // Main background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x0a0a12, 0x0a0a12, 1);
    bg.fillRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 20 * s);
    
    // ✅ Двойная золотая обводка для премиума
    bg.lineStyle(4 * s, 0xffd700, 1);
    bg.strokeRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 20 * s);
    bg.lineStyle(2 * s, 0xffed4e, 0.6);
    bg.strokeRoundedRect(-modalWidth / 2 - 3 * s, -modalHeight / 2 - 3 * s, modalWidth + 6 * s, modalHeight + 6 * s, 20 * s);
    modal.add(bg);
    
    // ✅ Декоративные блёстки/частицы вокруг модалки
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const distance = modalWidth / 2 + 40 * s;
      const sparkX = Math.cos(angle) * distance;
      const sparkY = Math.sin(angle) * distance;
      
      const spark = this.add.graphics();
      spark.fillStyle(0xffd700, 0.8);
      spark.fillCircle(sparkX, sparkY, 3 * s);
      spark.setBlendMode(Phaser.BlendModes.ADD);
      modal.add(spark);
      
      // Пульсация блёсток
      this.tweens.add({
        targets: spark,
        alpha: { from: 0.3, to: 0.9 },
        scale: { from: 0.8, to: 1.3 },
        duration: 1000 + i * 100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    
    // ✅ Декоративные элементы (углы)
    const corner = this.add.graphics();
    corner.lineStyle(3 * s, 0xffd700, 1);
    // Top-left corner
    corner.lineBetween(-modalWidth / 2 + 20 * s, -modalHeight / 2, -modalWidth / 2, -modalHeight / 2);
    corner.lineBetween(-modalWidth / 2, -modalHeight / 2, -modalWidth / 2, -modalHeight / 2 + 20 * s);
    // Top-right corner
    corner.lineBetween(modalWidth / 2 - 20 * s, -modalHeight / 2, modalWidth / 2, -modalHeight / 2);
    corner.lineBetween(modalWidth / 2, -modalHeight / 2, modalWidth / 2, -modalHeight / 2 + 20 * s);
    // Bottom-left corner
    corner.lineBetween(-modalWidth / 2 + 20 * s, modalHeight / 2, -modalWidth / 2, modalHeight / 2);
    corner.lineBetween(-modalWidth / 2, modalHeight / 2, -modalWidth / 2, modalHeight / 2 - 20 * s);
    // Bottom-right corner
    corner.lineBetween(modalWidth / 2 - 20 * s, modalHeight / 2, modalWidth / 2, modalHeight / 2);
    corner.lineBetween(modalWidth / 2, modalHeight / 2, modalWidth / 2, modalHeight / 2 - 20 * s);
    modal.add(corner);
    
    // ✅ Анимированная иконка монет (PNG вместо эмодзи)
    const iconBg = this.add.graphics();
    iconBg.fillStyle(0xffd700, 0.2);
    iconBg.fillCircle(0, -modalHeight / 2 + 60 * s, 50 * s);
    modal.add(iconBg);
    
    // Дополнительное свечение для эффектности
    const iconGlow = this.add.graphics();
    iconGlow.fillStyle(0xffd700, 0.1);
    iconGlow.fillCircle(0, -modalHeight / 2 + 60 * s, 70 * s);
    iconGlow.setBlendMode(Phaser.BlendModes.ADD);
    modal.add(iconGlow);
    
    let icon: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
    if (this.textures.exists('ui_rewards_coins')) {
      icon = this.add.image(0, -modalHeight / 2 + 60 * s, 'ui_rewards_coins');
      icon.setDisplaySize(80 * s, 80 * s);
      icon.setOrigin(0.5);
      modal.add(icon);
    } else {
      icon = this.add.text(0, -modalHeight / 2 + 60 * s, '💰', {
        fontSize: `${60 * s}px`,
      }).setOrigin(0.5);
      modal.add(icon);
    }
    
    // Пульсация иконки + вращение для эффектности
    this.tweens.add({
      targets: [icon, iconBg, iconGlow],
      scale: { from: 1, to: 1.15 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    
    this.tweens.add({
      targets: icon,
      angle: { from: -5, to: 5 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    
    // ✅ Премиальный заголовок
    const title = this.add.text(0, -modalHeight / 2 + 130 * s, 'RANKED MATCH', {
      fontSize: `${TYPOGRAPHY.sizes.xl * s}px`,
      fontFamily: fonts.tech,
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    applyTextShadow(title, 'glowGold');
    modal.add(title);
    
    // 🔥 УБРАЛИ подзаголовок - он мешает числу
    // Вместо него число будет сразу под заголовком
    
    // ✅ Сумма взноса (крупно, с анимацией) - подняли выше
    const feeContainer = this.add.container(0, -modalHeight / 2 + 200 * s); // Было -50, теперь привязано к верху
    modal.add(feeContainer);
    
    const feeText = this.add.text(0, 0, `${entryFee.toLocaleString()}`, {
      fontSize: `${TYPOGRAPHY.sizes.xxl * 1.6 * s}px`, // Уменьшили с 1.8 до 1.6
      fontFamily: fonts.tech,
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    applyTextShadow(feeText, 'glowGold');
    feeContainer.add(feeText);
    
    // PNG иконка монет рядом с суммой
    if (this.textures.exists('ui_rewards_coins')) {
      const coinIcon = this.add.image(feeText.width / 2 + 25 * s, 0, 'ui_rewards_coins'); // Ближе: 30→25
      coinIcon.setDisplaySize(32 * s, 32 * s); // Меньше: 35→32
      coinIcon.setOrigin(0, 0.5);
      feeContainer.add(coinIcon);
      
      // Анимация иконки
      this.tweens.add({
        targets: coinIcon,
        y: -5 * s,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      const coinIcon = this.add.text(feeText.width / 2 + 20 * s, 0, '🪙', {
        fontSize: `${35 * s}px`,
      }).setOrigin(0, 0.5);
      feeContainer.add(coinIcon);
    }
    
    // ✅ Разделитель (ниже)
    const divider = this.add.graphics();
    divider.lineStyle(2 * s, 0xffd700, 0.3);
    divider.lineBetween(-modalWidth / 3, -modalHeight / 2 + 240 * s, modalWidth / 3, -modalHeight / 2 + 240 * s);
    modal.add(divider);
    
    // ✅ Инфо-панель с наградами (эффектнее)
    const infoBg = this.add.graphics();
    // Градиент для более премиального вида + тёмная подложка
    infoBg.fillGradientStyle(0x11111b, 0x0b0b12, 0x11111b, 0x0b0b12, 0.95);
    infoBg.fillRoundedRect(-modalWidth / 2 + 30 * s, 30 * s, modalWidth - 60 * s, 110 * s, 12 * s);
    infoBg.lineStyle(2 * s, 0xffd700, 0.35);
    infoBg.strokeRoundedRect(-modalWidth / 2 + 30 * s, 30 * s, modalWidth - 60 * s, 110 * s, 12 * s);
    modal.add(infoBg);
    
    // Линия разделителя посередине
    const midDivider = this.add.graphics();
    midDivider.lineStyle(1 * s, 0x555566, 0.5);
    midDivider.lineBetween(-modalWidth / 2 + 50 * s, 85 * s, modalWidth / 2 - 50 * s, 85 * s);
    modal.add(midDivider);
    
    // ПОБЕДА (с иконками PNG)
    const winY = 60 * s;
    const winContainer = this.add.container(0, winY);
    modal.add(winContainer);
    
    // Иконка трофея слева
    const trophyIcon = this.add.text(-modalWidth / 2 + 50 * s, 0, '🏆', {
      fontSize: `${20 * s}px`,
    }).setOrigin(0, 0.5);
    winContainer.add(trophyIcon);
    
    const winText = this.add.text(-modalWidth / 2 + 85 * s, 0, 'ПОБЕДА:', {
      fontSize: `${TYPOGRAPHY.sizes.md * 0.9 * s}px`,
      fontFamily: fonts.tech,
      color: '#4ade80',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    applyTextShadow(winText, 'medium');
    winContainer.add(winText);
    
    const winAmount = this.add.text(modalWidth / 2 - 55 * s, 0, `+${(entryFee * 2).toLocaleString()}`, {
      fontSize: `${TYPOGRAPHY.sizes.md * 1.2 * s}px`,
      fontFamily: fonts.tech,
      color: '#4ade80',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(1, 0.5);
    applyTextShadow(winAmount, 'medium');
    winContainer.add(winAmount);
    
    // PNG иконка монет
    if (this.textures.exists('ui_rewards_coins')) {
      const winCoinIcon = this.add.image(modalWidth / 2 - 45 * s, 0, 'ui_rewards_coins');
      winCoinIcon.setDisplaySize(18 * s, 18 * s);
      winCoinIcon.setOrigin(0, 0.5);
      winContainer.add(winCoinIcon);
    } else {
      const winCoinIcon = this.add.text(modalWidth / 2 - 45 * s, 0, '🪙', {
        fontSize: `${16 * s}px`,
      }).setOrigin(0, 0.5);
      winContainer.add(winCoinIcon);
    }
    
    // ПОРАЖЕНИЕ
    const loseY = 100 * s; // Увеличили отступ с 95 до 100
    const loseContainer = this.add.container(0, loseY);
    modal.add(loseContainer);
    
    // Иконка сердца слева
    const heartIcon = this.add.text(-modalWidth / 2 + 50 * s, 0, '💔', {
      fontSize: `${20 * s}px`,
    }).setOrigin(0, 0.5);
    loseContainer.add(heartIcon);
    
    const loseText = this.add.text(-modalWidth / 2 + 85 * s, 0, 'ПОРАЖЕНИЕ:', {
      fontSize: `${TYPOGRAPHY.sizes.sm * s}px`,
      fontFamily: fonts.tech,
      color: '#ff6b6b',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    loseContainer.add(loseText);
    
    const loseAmount = this.add.text(modalWidth / 2 - 55 * s, 0, `-${entryFee.toLocaleString()}`, {
      fontSize: `${TYPOGRAPHY.sizes.md * 1.1 * s}px`,
      fontFamily: fonts.tech,
      color: '#ff6b6b',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 0.5);
    loseContainer.add(loseAmount);
    
    // PNG иконка монет
    if (this.textures.exists('ui_rewards_coins')) {
      const loseCoinIcon = this.add.image(modalWidth / 2 - 45 * s, 0, 'ui_rewards_coins');
      loseCoinIcon.setDisplaySize(18 * s, 18 * s);
      loseCoinIcon.setOrigin(0, 0.5);
      loseContainer.add(loseCoinIcon);
    } else {
      const loseCoinIcon = this.add.text(modalWidth / 4 - 15 * s, 0, '🪙', {
        fontSize: `${16 * s}px`,
      }).setOrigin(0, 0.5);
      loseContainer.add(loseCoinIcon);
    }
    
    const riskText = this.add.text(modalWidth / 4 + 15 * s, 0, '+ потеря ★', {
      fontSize: `${TYPOGRAPHY.sizes.xs * s}px`,
      fontFamily: fonts.tech,
      color: '#ff8888',
    }).setOrigin(0, 0.5);
    loseContainer.add(riskText);
    
    // ✅ Премиальные кнопки
    const btnWidth = 160 * s;
    const btnHeight = 55 * s;
    const btnSpacing = 20 * s;
    const btnY = modalHeight / 2 - 60 * s;
    
    // ✅ Confirm button (зеленый с glow)
    const confirmGlow = this.add.graphics();
    confirmGlow.fillStyle(0x4ade80, 0.3);
    confirmGlow.fillRoundedRect(-btnWidth - btnSpacing / 2 - 5 * s, btnY - btnHeight / 2 - 5 * s, btnWidth + 10 * s, btnHeight + 10 * s, 12 * s);
    modal.add(confirmGlow);
    
    const confirmBg = this.add.graphics();
    confirmBg.fillGradientStyle(0x4ade80, 0x4ade80, 0x22c55e, 0x22c55e, 1);
    confirmBg.fillRoundedRect(-btnWidth - btnSpacing / 2, btnY - btnHeight / 2, btnWidth, btnHeight, 10 * s);
    confirmBg.lineStyle(2 * s, 0x86efac, 1);
    confirmBg.strokeRoundedRect(-btnWidth - btnSpacing / 2, btnY - btnHeight / 2, btnWidth, btnHeight, 10 * s);
    modal.add(confirmBg);
    
    const confirmIcon = this.add.text(-btnSpacing / 2 - btnWidth / 2 - 25 * s, btnY, '✓', {
      fontSize: `${TYPOGRAPHY.sizes.lg * s}px`,
      fontFamily: fonts.tech,
      color: '#000000',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(confirmIcon);
    
    const confirmText = this.add.text(-btnSpacing / 2 - btnWidth / 2 + 10 * s, btnY, 'ВНЕСТИ', {
      fontSize: `${TYPOGRAPHY.sizes.md * s}px`,
      fontFamily: fonts.tech,
      color: '#000000',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(confirmText);
    
    const confirmZone = this.add.rectangle(-btnSpacing / 2 - btnWidth / 2, btnY, btnWidth, btnHeight, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    modal.add(confirmZone);
    
    confirmZone.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_ui_click');
      hapticImpact('medium');
      
      // Анимация нажатия
      this.tweens.add({
        targets: [confirmBg, confirmText, confirmIcon],
        scale: 0.95,
        duration: 100,
        yoyo: true,
        onComplete: () => {
          overlay.destroy();
          modal.destroy();
          onConfirm();
        }
      });
    });
    
    // ✅ Cancel button (красный)
    const cancelBg = this.add.graphics();
    cancelBg.fillGradientStyle(0x3a3a4a, 0x3a3a4a, 0x2a2a3a, 0x2a2a3a, 1);
    cancelBg.fillRoundedRect(btnSpacing / 2, btnY - btnHeight / 2, btnWidth, btnHeight, 10 * s);
    cancelBg.lineStyle(2 * s, 0x555566, 1);
    cancelBg.strokeRoundedRect(btnSpacing / 2, btnY - btnHeight / 2, btnWidth, btnHeight, 10 * s);
    modal.add(cancelBg);
    
    const cancelIcon = this.add.text(btnSpacing / 2 + btnWidth / 2 - 30 * s, btnY, '✕', {
      fontSize: `${TYPOGRAPHY.sizes.lg * s}px`,
      fontFamily: fonts.tech,
      color: '#ff6b6b',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(cancelIcon);
    
    const cancelText = this.add.text(btnSpacing / 2 + btnWidth / 2 + 10 * s, btnY, 'ОТМЕНА', {
      fontSize: `${TYPOGRAPHY.sizes.md * s}px`,
      fontFamily: fonts.tech,
      color: hexToString(colors.uiText),
      fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(cancelText);
    
    const cancelZone = this.add.rectangle(btnSpacing / 2 + btnWidth / 2, btnY, btnWidth, btnHeight, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    modal.add(cancelZone);
    
    cancelZone.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_ui_click');
      hapticImpact('light');
      
      // Анимация нажатия
      this.tweens.add({
        targets: [cancelBg, cancelText, cancelIcon],
        scale: 0.95,
        duration: 100,
        yoyo: true,
        onComplete: () => {
          overlay.destroy();
          modal.destroy();
        }
      });
    });
  }
  
  /**
   * 🚫 Показывает модальное окно о недостатке средств
   */
  private showInsufficientFundsModal(required: number, current: number): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const s = tgApp.getUIScale();
    
    // Overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, width, height);
    overlay.setDepth(200);
    overlay.setInteractive();
    
    // Modal container
    const modal = this.add.container(width / 2, height / 2).setDepth(201);
    
    // Background
    const modalWidth = 340 * s;
    const modalHeight = 280 * s;
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 1);
    bg.fillRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 20 * s);
    bg.lineStyle(3 * s, 0xff6b6b, 1);
    bg.strokeRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 20 * s);
    modal.add(bg);
    
    // Icon
    const icon = this.add.text(0, -modalHeight / 2 + 50 * s, '❌', {
      fontSize: `${50 * s}px`,
    }).setOrigin(0.5);
    modal.add(icon);
    
    // Title
    const title = this.add.text(0, -modalHeight / 2 + 110 * s, 'НЕДОСТАТОЧНО СРЕДСТВ', {
      fontSize: `${TYPOGRAPHY.sizes.lg * s}px`,
      fontFamily: fonts.primary,
      color: '#ff6b6b',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    applyTextShadow(title, 'medium');
    modal.add(title);
    
    // Info text
    const info = this.add.text(0, -20 * s, `Требуется: ${required.toLocaleString()} 🪙\nУ вас: ${current.toLocaleString()} 🪙\n\nВыиграйте матчи или завершите\nкампанию чтобы заработать!`, {
      fontSize: `${TYPOGRAPHY.sizes.sm * s}px`,
      fontFamily: fonts.primary,
      color: hexToString(colors.uiText),
      align: 'center',
      wordWrap: { width: modalWidth - 40 * s },
    }).setOrigin(0.5);
    modal.add(info);
    
    // OK Button
    const btnWidth = 180 * s;
    const btnHeight = 50 * s;
    const btnY = modalHeight / 2 - 60 * s;
    
    const btnBg = this.add.graphics();
    btnBg.fillStyle(colors.uiAccent, 1);
    btnBg.fillRoundedRect(-btnWidth / 2, btnY - btnHeight / 2, btnWidth, btnHeight, 10 * s);
    modal.add(btnBg);
    
    const btnText = this.add.text(0, btnY, 'ПОНЯТНО', {
      fontSize: `${TYPOGRAPHY.sizes.md * s}px`,
      fontFamily: fonts.primary,
      color: '#000000',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(btnText);
    
    const btnZone = this.add.rectangle(0, btnY, btnWidth, btnHeight, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    modal.add(btnZone);
    
    btnZone.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_ui_click');
      hapticImpact('light');
      overlay.destroy();
      modal.destroy();
    });
  }
  
  /**
   * 🚫 Показывает модальное окно с требованиями
   */
  private showRequirementModal(reason: string): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const s = tgApp.getUIScale();
    
    // Overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, width, height);
    overlay.setDepth(200);
    overlay.setInteractive();
    
    // Modal container
    const modal = this.add.container(width / 2, height / 2).setDepth(201);
    
    // Background
    const modalWidth = 340 * s;
    const modalHeight = 280 * s;
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 1);
    bg.fillRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 20 * s);
    bg.lineStyle(3 * s, colors.uiAccent, 1);
    bg.strokeRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 20 * s);
    modal.add(bg);
    
    // Icon
    const icon = this.add.text(0, -modalHeight / 2 + 50 * s, '🔒', {
      fontSize: `${50 * s}px`,
    }).setOrigin(0.5);
    modal.add(icon);
    
    // Title
    const title = this.add.text(0, -modalHeight / 2 + 110 * s, 'НЕДОСТАТОЧНО ФРАКЦИЙ', {
      fontSize: `${TYPOGRAPHY.sizes.lg * s}px`,
      fontFamily: fonts.primary,
      color: hexToString(colors.uiAccent),
      fontStyle: 'bold',
    }).setOrigin(0.5);
    applyTextShadow(title, 'medium');
    modal.add(title);
    
    // Reason text
    const reasonText = this.add.text(0, -20 * s, reason, {
      fontSize: `${TYPOGRAPHY.sizes.sm * s}px`,
      fontFamily: fonts.primary,
      color: hexToString(colors.uiText),
      align: 'center',
      wordWrap: { width: modalWidth - 40 * s },
    }).setOrigin(0.5);
    modal.add(reasonText);
    
    // OK Button
    const btnWidth = 180 * s;
    const btnHeight = 50 * s;
    const btnY = modalHeight / 2 - 60 * s;
    
    const btnBg = this.add.graphics();
    btnBg.fillStyle(colors.uiAccent, 1);
    btnBg.fillRoundedRect(-btnWidth / 2, btnY - btnHeight / 2, btnWidth, btnHeight, 10 * s);
    modal.add(btnBg);
    
    const btnText = this.add.text(0, btnY, 'ПОНЯТНО', {
      fontSize: `${TYPOGRAPHY.sizes.md * s}px`,
      fontFamily: fonts.primary,
      color: '#000000',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(btnText);
    
    // Button interaction
    const btnZone = this.add.rectangle(0, btnY, btnWidth, btnHeight, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    modal.add(btnZone);
    
    btnZone.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_ui_click');
      hapticImpact('light');
      
      overlay.destroy();
      modal.destroy();
    });
  }
  
  /**
   * Генерирует имя и аватар для бота-противника
   */
  private generateOpponentData(): { name: string; avatarId: string } {
    const prefixes = ['Neon', 'Cyber', 'Quantum', 'Stellar', 'Cosmic', 'Nova', 'Orbit', 'Galaxy'];
    const suffixes = ['Strike', 'Force', 'Master', 'Legend', 'Hero', 'King', 'Pro', 'Ace'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const number = Math.floor(Math.random() * 900) + 100;
    const name = `${prefix}${suffix}#${number}`;
    
    // Генерируем аватар на основе имени для консистентности
    const botAvatars = [
      'avatar_recruit',
      'avatar_explorer',
      'avatar_magma_warrior',
      'avatar_cyborg_elite',
      'avatar_void_mystic',
      'avatar_insect_hive',
    ];
    // Хеш имени для постоянного аватара
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const avatarId = botAvatars[hash % botAvatars.length];
    
    return { name, avatarId };
  }
  
  // ✅ Оставляем старый метод для обратной совместимости
  private generateOpponentName(): string {
    return this.generateOpponentData().name;
  }
  
  /**
   * ⭐ Анимирует изменение звезд на конкретной карточке с красивыми эффектами
   */
  private animateStarChangeOnCard(card: Phaser.GameObjects.Container, oldStars: number, newStars: number, color: number): void {
    const colors = getColors();
    const s = tgApp.getUIScale();
    const stars = (card as any).stars as Phaser.GameObjects.Text[];
    
    if (!stars || stars.length === 0) return;

    const duration = 400; // ms

    if (newStars > oldStars) { // 🎉 Gaining stars - КРАСИВЫЙ ЭФФЕКТ ПОЯВЛЕНИЯ
      for (let i = oldStars; i < newStars; i++) {
        if (stars[i]) {
          const star = stars[i];
          const delay = (i - oldStars) * 150; // Задержка между звездами
          
          // Создаем эффект вспышки
          const flash = this.add.graphics();
          flash.fillStyle(color, 0.8);
          flash.fillCircle(star.x, star.y, 60 * s);
          flash.setBlendMode(Phaser.BlendModes.ADD);
          card.add(flash);
          
          // Анимация вспышки
          this.tweens.add({
            targets: flash,
            alpha: 0,
            scale: 2,
            duration: 500,
            delay: delay,
            ease: 'Cubic.easeOut',
            onComplete: () => flash.destroy()
          });
          
          // Создаем сияющие частицы вокруг звезды
          for (let p = 0; p < 12; p++) {
            const angle = (p / 12) * Math.PI * 2;
            const distance = 40 * s;
            const px = star.x + Math.cos(angle) * distance;
            const py = star.y + Math.sin(angle) * distance;
            
            const particle = this.add.graphics();
            particle.fillStyle(color, 1);
            particle.fillCircle(px, py, 3 * s);
            particle.setBlendMode(Phaser.BlendModes.ADD);
            card.add(particle);
            
            // Разлет частиц
            this.tweens.add({
              targets: particle,
              x: px + Math.cos(angle) * 60 * s,
              y: py + Math.sin(angle) * 60 * s,
              alpha: 0,
              duration: 600,
              delay: delay + 100,
              ease: 'Quad.easeOut',
              onComplete: () => particle.destroy()
            });
          }
          
          // Анимация самой звезды
          star.setColor(hexToString(color));
          star.setScale(0);
          star.setAlpha(0);
          
          this.tweens.add({
            targets: star,
            scale: 1.3,
            alpha: 1,
            duration: duration,
            delay: delay,
            ease: 'Back.easeOut',
            onStart: () => {
              star.setText('★');
              AudioManager.getInstance().playSFX('sfx_ui_confirm');
              hapticImpact('light');
            },
            onComplete: () => {
              // Возврат к нормальному размеру
              this.tweens.add({
                targets: star,
                scale: 1,
                duration: 200,
                ease: 'Quad.easeOut'
              });
            }
          });
          
          // Пульсация тени звезды
          applyTextShadow(star, 'strong');
        }
      }
    } else if (newStars < oldStars) { // 💔 Losing stars - ЭФФЕКТ СГОРАНИЯ
      for (let i = oldStars - 1; i >= newStars; i--) {
        if (stars[i]) {
          const star = stars[i];
          const delay = (oldStars - 1 - i) * 120; // Задержка между звездами
          
          // Создаем эффект огня/сгорания
          const fireColors = [0xff0000, 0xff4500, 0xff6b00, 0xffa500];
          
          // Создаем огненные частицы
          for (let f = 0; f < 20; f++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 30 * s;
            const fx = star.x + Math.cos(angle) * distance;
            const fy = star.y + Math.sin(angle) * distance;
            
            const flame = this.add.graphics();
            const flameColor = fireColors[Math.floor(Math.random() * fireColors.length)];
            flame.fillStyle(flameColor, 0.9);
            flame.fillCircle(fx, fy, (2 + Math.random() * 4) * s);
            flame.setBlendMode(Phaser.BlendModes.ADD);
            card.add(flame);
            
            // Анимация огня вверх и исчезновение
            this.tweens.add({
              targets: flame,
              y: fy - (40 + Math.random() * 40) * s,
              x: fx + (Math.random() - 0.5) * 30 * s,
              alpha: 0,
              scale: 0.3,
              duration: 400 + Math.random() * 300,
              delay: delay + Math.random() * 100,
              ease: 'Quad.easeOut',
              onComplete: () => flame.destroy()
            });
          }
          
          // Темный дым
          for (let d = 0; d < 8; d++) {
            const angle = (d / 8) * Math.PI * 2;
            const distance = 20 * s;
            const dx = star.x + Math.cos(angle) * distance;
            const dy = star.y + Math.sin(angle) * distance;
            
            const smoke = this.add.graphics();
            smoke.fillStyle(0x000000, 0.4);
            smoke.fillCircle(dx, dy, 5 * s);
            smoke.setBlendMode(Phaser.BlendModes.MULTIPLY);
            card.add(smoke);
            
            // Дым поднимается вверх
            this.tweens.add({
              targets: smoke,
              y: dy - 50 * s,
              alpha: 0,
              scale: 2,
              duration: 700,
              delay: delay + 200 + d * 30,
              ease: 'Sine.easeOut',
              onComplete: () => smoke.destroy()
            });
          }
          
          // Анимация звезды - "сгорает"
          this.tweens.add({
            targets: star,
            scale: 1.5,
            alpha: 0.3,
            duration: 200,
            delay: delay,
            ease: 'Quad.easeIn',
            onStart: () => {
              // Меняем цвет на красный перед исчезновением
              star.setColor('#ff0000');
              AudioManager.getInstance().playSFX('sfx_ui_error');
              hapticImpact('medium');
            },
            onComplete: () => {
              // Завершаем сгорание
              this.tweens.add({
                targets: star,
                scale: 0.3,
                alpha: 0,
                duration: 200,
                ease: 'Quad.easeOut',
                onComplete: () => {
                  // Превращаем в пустую звезду
                  star.setText('☆');
                  star.setColor(hexToString(colors.uiTextSecondary));
                  star.setScale(0);
                  star.setAlpha(0);
                  
                  // Появление пустой звезды
                  this.tweens.add({
                    targets: star,
                    scale: 1,
                    alpha: 1,
                    duration: 300,
                    ease: 'Back.easeOut'
                  });
                }
              });
            }
          });
        }
      }
    }
  }
  
  private showOrbitDecayModal(): void {
    if (this.orbitDecayModal) return;
    
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const s = tgApp.getUIScale();
    
    this.orbitDecayModal = this.add.container(0, 0).setDepth(200);
    
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.85);
    overlay.fillRect(0, 0, width, height);
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
    this.orbitDecayModal.add(overlay);
    
    const panelWidth = width * 0.9;
    const panelHeight = height * 0.65;
    const panelX = width / 2;
    const panelY = height / 2;
    
    // Простой фон
    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x1a1a2e, 0.98);
    panelBg.fillRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 20 * s);
    this.orbitDecayModal.add(panelBg);
    
    // Рамка
    const border = this.add.graphics();
    border.lineStyle(3 * s, 0xff0000, 1);
    border.strokeRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 20 * s);
    this.orbitDecayModal.add(border);
    
    // Иконка
    const icon = this.add.text(panelX, panelY - panelHeight / 3, '⚠️', {
      fontSize: `${80 * s}px`,
    }).setOrigin(0.5);
    this.orbitDecayModal.add(icon);
    
    // Заголовок
    const title = this.add.text(panelX, panelY - panelHeight / 4 + 40 * s, 'CRITICAL ORBIT DECAY', {
      fontSize: `${TYPOGRAPHY.sizes.xl * s}px`,
      fontFamily: getFonts().primary,
      color: '#ff0000',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.orbitDecayModal.add(title);
    
    // Текст
    const warningText = this.add.text(
      panelX,
      panelY - 10 * s,
      'You have 0 stars!\n\nYou can:\n• Fall to previous division\n• Stabilize orbit with crystals',
      {
        fontSize: `${TYPOGRAPHY.sizes.md * s}px`,
        fontFamily: getFonts().primary,
        color: hexToString(colors.uiText),
        align: 'center',
        lineSpacing: 6 * s,
        wordWrap: { width: panelWidth * 0.8 },
      }
    ).setOrigin(0.5);
    this.orbitDecayModal.add(warningText);
    
    // Стоимость
    const cost = ORBIT_STABILIZATION_COSTS[this.playerProgress.currentTier];
    const costText = this.add.text(
      panelX,
      panelY + 65 * s,
      `Stabilization: ${cost} 💎`,
      {
        fontSize: `${TYPOGRAPHY.sizes.lg * s}px`,
        fontFamily: getFonts().primary,
        color: hexToString(colors.uiAccent),
        fontStyle: 'bold',
      }
    ).setOrigin(0.5);
    this.orbitDecayModal.add(costText);
    
    // Кнопки
    const btnY = panelY + panelHeight / 2 - 55 * s;
    const btnWidth = panelWidth * 0.42;
    const btnHeight = 48 * s;
    
    const fallBtn = this.createModalButton(
      panelX - btnWidth / 2 - 12 * s,
      btnY,
      btnWidth,
      btnHeight,
      'FALL',
      0x666666,
      () => this.handleOrbitDecayFall()
    );
    this.orbitDecayModal.add(fallBtn);
    
    const stabilizeBtn = this.createModalButton(
      panelX + btnWidth / 2 + 12 * s,
      btnY,
      btnWidth,
      btnHeight,
      'STABILIZE',
      colors.uiAccent,
      () => this.handleOrbitStabilization()
    );
    this.orbitDecayModal.add(stabilizeBtn);
    
    // Анимация
    this.orbitDecayModal.setAlpha(0);
    this.tweens.add({
      targets: this.orbitDecayModal,
      alpha: 1,
      duration: 200,
      ease: 'Power2',
    });
    
    hapticImpact('heavy');
    AudioManager.getInstance().playSFX('sfx_ui_error');
  }
  
  private createModalButton(
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    color: number,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const s = tgApp.getUIScale();
    const btn = this.add.container(x, y);
    
    const bg = this.add.graphics();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 10 * s);
    btn.add(bg);
    
    const border = this.add.graphics();
    border.lineStyle(2 * s, 0xffffff, 0.3);
    border.strokeRoundedRect(-width / 2, -height / 2, width, height, 10 * s);
    btn.add(border);
    
    const label = this.add.text(0, 0, text, {
      fontSize: `${TYPOGRAPHY.sizes.md * s}px`,
      fontFamily: getFonts().primary,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    btn.add(label);
    
    const zone = this.add.rectangle(0, 0, width, height, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    btn.add(zone);
    
    zone.on('pointerdown', () => {
      hapticImpact('medium');
      AudioManager.getInstance().playSFX('sfx_ui_click');
      onClick();
    });
    
    return btn;
  }
  
  private handleOrbitDecayFall(): void {
    const newProgress = LeagueManager.applyDemotion(this.playerProgress);
    this.playerProgress = newProgress;
    
    const currentData = playerData.get();
    currentData.leagueProgress = newProgress;
    playerData.save();
    
    this.closeOrbitDecayModal();
    this.scene.restart();
  }
  
  private handleOrbitStabilization(): void {
    const currentData = playerData.get();
    const currency = { coins: currentData.coins, crystals: currentData.crystals };
    
    try {
      const result = LeagueManager.applyOrbitStabilization(this.playerProgress, currency);
      currentData.leagueProgress = result.progress;
      currentData.coins = result.currency.coins;
      currentData.crystals = result.currency.crystals;
      playerData.save();
      
      this.closeOrbitDecayModal();
      this.scene.restart();
    } catch (error: any) {
      console.error('[LeagueScene] Stabilization failed:', error.message);
      AudioManager.getInstance().playSFX('sfx_ui_error');
    }
  }
  
  private closeOrbitDecayModal(): void {
    if (!this.orbitDecayModal) return;
    
    this.tweens.add({
      targets: this.orbitDecayModal,
      alpha: 0,
      duration: 150,
      ease: 'Power2',
      onComplete: () => {
        this.orbitDecayModal?.destroy();
        this.orbitDecayModal = undefined;
      },
    });
  }
  
  /**
   * 🎉 Показывает модальное окно о повышении лиги
   * Информирует игрока об изменениях в новой лиге
   */
  private showLeaguePromotionModal(
    oldTier: LeagueTier, 
    oldDivision: number,
    onComplete: () => void
  ): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const s = tgApp.getUIScale();
    
    const newTier = this.playerProgress.currentTier;
    const newDivision = this.playerProgress.division;
    const newInfo = getLeagueTierInfo(newTier);
    const oldInfo = getLeagueTierInfo(oldTier);
    
    // Затемнение фона
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.85);
    overlay.fillRect(0, 0, width, height);
    overlay.setDepth(1000);
    overlay.setInteractive();
    
    // Основная панель
    const panelWidth = width * 0.9;
    const panelHeight = height * 0.7;
    const panelX = width / 2;
    const panelY = height / 2;
    
    const panel = this.add.graphics().setDepth(1001);
    const darkerColor = Phaser.Display.Color.IntegerToColor(newInfo.color).darken(30).color;
    panel.fillGradientStyle(newInfo.color, newInfo.color, darkerColor, darkerColor, 0.95);
    panel.fillRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 20 * s);
    panel.lineStyle(3 * s, newInfo.color, 1);
    panel.strokeRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 20 * s);
    
    // Заголовок с эмодзи
    const title = this.add.text(panelX, panelY - panelHeight / 2 + 40 * s, '🎉 ПОВЫШЕНИЕ! 🎉', {
      fontSize: `${28 * s}px`,
      fontFamily: fonts.tech,
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 4 * s,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1002);
    applyTextShadow(title, 'strong');
    
    // Анимация заголовка
    title.setScale(0.5);
    this.tweens.add({
      targets: title,
      scale: 1,
      duration: 500,
      ease: 'Back.easeOut'
    });
    
    // Название новой лиги
    const leagueName = this.add.text(panelX, panelY - panelHeight / 2 + 90 * s, 
      `${newInfo.nameRu.toUpperCase()} DIVISION ${['I', 'II', 'III'][newDivision - 1]}`, {
      fontSize: `${24 * s}px`,
      fontFamily: fonts.tech,
      color: hexToString(newInfo.color),
      stroke: '#000000',
      strokeThickness: 3 * s,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1002);
    applyTextShadow(leagueName, 'medium');
    
    // Блок изменений
    let changesY = panelY - panelHeight / 2 + 150 * s;
    
    const changesTitle = this.add.text(panelX, changesY, '📋 ЧТО НОВОГО:', {
      fontSize: `${18 * s}px`,
      fontFamily: fonts.tech,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2 * s,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1002);
    applyTextShadow(changesTitle, 'medium');
    changesY += 40 * s;
    
    // Список изменений
    const changes: string[] = [];
    
    // Проверяем изменение размера команды
    const oldTeamSize = LEAGUE_TEAM_SIZE[oldTier];
    const newTeamSize = LEAGUE_TEAM_SIZE[newTier];
    if (newTeamSize !== oldTeamSize) {
      changes.push(`🎮 Размер команды: ${oldTeamSize} → ${newTeamSize} фишек`);
    }
    
    // Проверяем изменение взноса
    const oldFee = LEAGUE_ENTRY_FEE[oldTier][oldDivision as 1 | 2 | 3];
    const newFee = LEAGUE_ENTRY_FEE[newTier][newDivision as 1 | 2 | 3];
    if (newFee !== oldFee) {
      changes.push(`💰 Взнос за матч: ${oldFee.toLocaleString()} → ${newFee.toLocaleString()} монет`);
    }
    
    // Проверяем изменение сложности AI
    const oldDiff = LEAGUE_AI_DIFFICULTY[oldTier];
    const newDiff = LEAGUE_AI_DIFFICULTY[newTier];
    if (newDiff !== oldDiff) {
      const diffNames: Record<string, string> = {
        'easy': 'Лёгкая',
        'medium': 'Средняя', 
        'hard': 'Сложная',
        'expert': 'Эксперт'
      };
      changes.push(`🤖 Сложность: ${diffNames[oldDiff]} → ${diffNames[newDiff]}`);
    }
    
    // Награды за дивизион
    const divisionReward = LEAGUE_TIER_REWARDS[newTier]?.rewards?.[`division${newDivision}` as 'division1' | 'division2' | 'division3'];
    if (divisionReward) {
      if (divisionReward.rewards.coins) changes.push(`💵 Награда за сезон: ${divisionReward.rewards.coins.toLocaleString()} монет`);
      if (divisionReward.rewards.crystals) changes.push(`💎 Награда за сезон: ${divisionReward.rewards.crystals} кристаллов`);
    }
    
    // Если лига выше - добавляем информацию о стабилизации
    if (getLeagueTierOrder(newTier) > getLeagueTierOrder(oldTier)) {
      const stabCost = ORBIT_STABILIZATION_COSTS[newTier];
      if (stabCost.crystals) {
        changes.push(`🛡️ Стабилизация орбиты: ${stabCost.crystals} кристаллов`);
      } else if (stabCost.coins > 0) {
        changes.push(`🛡️ Стабилизация орбиты: ${stabCost.coins.toLocaleString()} монет`);
      }
    }
    
    // Отображаем изменения
    changes.forEach((change, index) => {
      this.add.text(panelX - panelWidth / 2 + 30 * s, changesY + index * 35 * s, change, {
        fontSize: `${16 * s}px`,
        fontFamily: fonts.primary,
        color: '#e0e0e0',
        stroke: '#000000',
        strokeThickness: 2 * s,
      }).setOrigin(0, 0.5).setDepth(1002);
    });
    
    changesY += changes.length * 35 * s + 30 * s;
    
    // Мотивационное сообщение
    const motivationTexts = [
      '🚀 Вперёд к новым победам!',
      '⭐ Покоряй новые высоты!',
      '🏆 Ты на правильном пути!',
      '💪 Продолжай в том же духе!'
    ];
    const motivation = motivationTexts[Math.floor(Math.random() * motivationTexts.length)];
    
    const motivationText = this.add.text(panelX, changesY + 20 * s, motivation, {
      fontSize: `${20 * s}px`,
      fontFamily: fonts.tech,
      color: '#00ff00',
      stroke: '#000000',
      strokeThickness: 3 * s,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1002);
    applyTextShadow(motivationText, 'medium');
    
    // Кнопка "Отлично!"
    const buttonY = panelY + panelHeight / 2 - 60 * s;
    const buttonWidth = 200 * s;
    const buttonHeight = 50 * s;
    
    const buttonBg = this.add.graphics().setDepth(1002);
    buttonBg.fillStyle(0x00aa00, 1);
    buttonBg.fillRoundedRect(panelX - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 15 * s);
    buttonBg.lineStyle(2 * s, 0x00ff00, 1);
    buttonBg.strokeRoundedRect(panelX - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 15 * s);
    
    const buttonText = this.add.text(panelX, buttonY, '✨ ОТЛИЧНО! ✨', {
      fontSize: `${18 * s}px`,
      fontFamily: fonts.tech,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2 * s,
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1002);
    applyTextShadow(buttonText, 'medium');
    
    const buttonZone = this.add.zone(panelX, buttonY, buttonWidth, buttonHeight)
      .setInteractive({ useHandCursor: true })
      .setDepth(1003);
    
    buttonZone.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_ui_click');
      hapticImpact('medium');
      
      // Закрываем модал
      this.tweens.add({
        targets: [overlay, panel, title, leagueName, changesTitle, motivationText, buttonBg, buttonText],
        alpha: 0,
        duration: 300,
        onComplete: () => {
          overlay.destroy();
          panel.destroy();
          title.destroy();
          leagueName.destroy();
          changesTitle.destroy();
          motivationText.destroy();
          buttonBg.destroy();
          buttonText.destroy();
          buttonZone.destroy();
          onComplete();
        }
      });
    });
    
    // Эффект свечения на кнопке
    this.tweens.add({
      targets: buttonBg,
      alpha: { from: 0.8, to: 1 },
      duration: 500,
      yoyo: true,
      repeat: -1
    });
  }

  /**
   * 🛡️ Модальное окно выкупа звезды при поражении
   */
  private showStarBuybackModal(oldStars: number, onComplete: () => void): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const s = tgApp.getUIScale();
    
    const buybackCost = LEAGUE_STAR_BUYBACK[this.playerProgress.currentTier];
    const data = playerData.get();
    
    // Проверяем наличие средств
    const canAfford = buybackCost.type === 'coins' 
      ? data.coins >= buybackCost.amount
      : data.crystals >= buybackCost.amount;
    
    // Overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.9);
    overlay.fillRect(0, 0, width, height);
    overlay.setDepth(250);
    overlay.setInteractive();
    
    // Modal container
    const modal = this.add.container(width / 2, height / 2).setDepth(251);
    
    // Background
    const modalWidth = 380 * s;
    const modalHeight = 420 * s;
    
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x2a0a0a, 0x2a0a0a, 0x1a0505, 0x1a0505, 1);
    bg.fillRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 20 * s);
    bg.lineStyle(3 * s, 0xff6b6b, 1);
    bg.strokeRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 20 * s);
    modal.add(bg);
    
    // Icon
    const icon = this.add.text(0, -modalHeight / 2 + 60 * s, '💔', {
      fontSize: `${60 * s}px`,
    }).setOrigin(0.5);
    modal.add(icon);
    
    // Title
    const title = this.add.text(0, -modalHeight / 2 + 130 * s, 'ПОТЕРЯ ЗВЕЗДЫ', {
      fontSize: `${TYPOGRAPHY.sizes.xl * s}px`,
      fontFamily: fonts.tech,
      color: '#ff6b6b',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    applyTextShadow(title, 'medium');
    modal.add(title);
    
    // Subtitle
    const subtitle = this.add.text(0, -modalHeight / 2 + 165 * s, 'Вы потеряли звезду в рейтинге', {
      fontSize: `${TYPOGRAPHY.sizes.sm * s}px`,
      fontFamily: fonts.tech,
      color: hexToString(colors.uiTextSecondary),
    }).setOrigin(0.5);
    modal.add(subtitle);
    
    // Star visualization
    const starY = -60 * s;
    const oldStarText = this.add.text(-60 * s, starY, `${'★'.repeat(oldStars)}`, {
      fontSize: `${30 * s}px`,
      color: '#ffd700',
    }).setOrigin(0.5);
    modal.add(oldStarText);
    
    const arrow = this.add.text(0, starY, '→', {
      fontSize: `${30 * s}px`,
      color: '#ff6b6b',
    }).setOrigin(0.5);
    modal.add(arrow);
    
    const newStarText = this.add.text(60 * s, starY, `${'★'.repeat(this.playerProgress.stars)}${'☆'.repeat(this.playerProgress.maxStars - this.playerProgress.stars)}`, {
      fontSize: `${30 * s}px`,
      color: hexToString(colors.uiTextSecondary),
    }).setOrigin(0.5);
    modal.add(newStarText);
    
    // Buyback info
    const infoBg = this.add.graphics();
    infoBg.fillStyle(0x000000, 0.5);
    infoBg.fillRoundedRect(-modalWidth / 2 + 30 * s, 0 * s, modalWidth - 60 * s, 100 * s, 10 * s);
    modal.add(infoBg);
    
    const buybackIcon = buybackCost.type === 'coins' ? '🪙' : '💎';
    const buybackText = this.add.text(0, 25 * s, `🛡️ ВЫКУПИТЬ ЗВЕЗДУ`, {
      fontSize: `${TYPOGRAPHY.sizes.md * s}px`,
      fontFamily: fonts.tech,
      color: '#4ade80',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(buybackText);
    
    const costText = this.add.text(0, 55 * s, `${buybackCost.amount.toLocaleString()} ${buybackIcon}`, {
      fontSize: `${TYPOGRAPHY.sizes.lg * s}px`,
      fontFamily: fonts.tech,
      color: canAfford ? '#ffd700' : '#ff6b6b',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    applyTextShadow(costText, 'medium');
    modal.add(costText);
    
    if (!canAfford) {
      const notEnoughText = this.add.text(0, 80 * s, 'Недостаточно средств', {
        fontSize: `${TYPOGRAPHY.sizes.xs * s}px`,
        fontFamily: fonts.tech,
        color: '#ff6b6b',
      }).setOrigin(0.5);
      modal.add(notEnoughText);
    }
    
    // Buttons
    const btnWidth = 160 * s;
    const btnHeight = 55 * s;
    const btnSpacing = 20 * s;
    const btnY = modalHeight / 2 - 70 * s;
    
    if (canAfford) {
      // Buyback button
      const buybackBg = this.add.graphics();
      buybackBg.fillGradientStyle(0x4ade80, 0x4ade80, 0x22c55e, 0x22c55e, 1);
      buybackBg.fillRoundedRect(-btnWidth - btnSpacing / 2, btnY - btnHeight / 2, btnWidth, btnHeight, 10 * s);
      buybackBg.lineStyle(2 * s, 0x86efac, 1);
      buybackBg.strokeRoundedRect(-btnWidth - btnSpacing / 2, btnY - btnHeight / 2, btnWidth, btnHeight, 10 * s);
      modal.add(buybackBg);
      
      const buybackBtnText = this.add.text(-btnSpacing / 2 - btnWidth / 2, btnY, 'ВЫКУПИТЬ', {
        fontSize: `${TYPOGRAPHY.sizes.md * s}px`,
        fontFamily: fonts.tech,
        color: '#000000',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      modal.add(buybackBtnText);
      
      const buybackZone = this.add.rectangle(-btnSpacing / 2 - btnWidth / 2, btnY, btnWidth, btnHeight, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      modal.add(buybackZone);
      
      buybackZone.on('pointerdown', () => {
        AudioManager.getInstance().playSFX('sfx_ui_click');
        hapticImpact('medium');
        
        // Списываем средства и восстанавливаем звезду
        if (buybackCost.type === 'coins') {
          playerData.addCoins(-buybackCost.amount);
        } else {
          playerData.addCrystals(-buybackCost.amount);
        }
        
        this.playerProgress.stars = oldStars; // Восстанавливаем звезду
        playerData.save();
        
        overlay.destroy();
        modal.destroy();
        onComplete();
      });
    }
    
    // Accept button (принять потерю)
    const acceptBg = this.add.graphics();
    acceptBg.fillGradientStyle(0x3a3a4a, 0x3a3a4a, 0x2a2a3a, 0x2a2a3a, 1);
    acceptBg.fillRoundedRect(canAfford ? btnSpacing / 2 : -btnWidth / 2, btnY - btnHeight / 2, btnWidth, btnHeight, 10 * s);
    acceptBg.lineStyle(2 * s, 0x555566, 1);
    acceptBg.strokeRoundedRect(canAfford ? btnSpacing / 2 : -btnWidth / 2, btnY - btnHeight / 2, btnWidth, btnHeight, 10 * s);
    modal.add(acceptBg);
    
    const acceptText = this.add.text(canAfford ? btnSpacing / 2 + btnWidth / 2 : 0, btnY, canAfford ? 'ОТКАЗАТЬСЯ' : 'ПРИНЯТЬ', {
      fontSize: `${TYPOGRAPHY.sizes.md * s}px`,
      fontFamily: fonts.tech,
      color: hexToString(colors.uiText),
      fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(acceptText);
    
    const acceptZone = this.add.rectangle(canAfford ? btnSpacing / 2 + btnWidth / 2 : 0, btnY, btnWidth, btnHeight, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    modal.add(acceptZone);
    
    acceptZone.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_ui_click');
      hapticImpact('light');
      
      overlay.destroy();
      modal.destroy();
      onComplete();
    });
  }

  shutdown(): void {
    // ✅ FIX: Полная очистка при выходе из сцены
    
    // Отключаем swipe навигацию
    if (this.swipeManager) {
      this.swipeManager.disable();
      this.swipeManager.destroy();
      this.swipeManager = undefined;
    }
    
    // Останавливаем все tweens и таймеры
    this.tweens.killAll();
    this.time.removeAllEvents();
    
    // Очищаем input listeners
    this.input.removeAllListeners();
    
    console.log('[LeagueScene] shutdown complete');
  }
}
