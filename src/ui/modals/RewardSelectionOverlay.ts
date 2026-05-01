// src/ui/modals/RewardSelectionOverlay.ts
// ✅ UI-класс для выбора юнита из наград
// Показывает 3 карточки юнитов с анимацией, hover-эффектами и цветами фракций

import Phaser from 'phaser';
import { UnitData, getUnitById } from '../../data/UnitsRepository';
import { mergeUnitDisplay } from '../../data/unitDisplayOverrides';
import { FACTIONS, FactionId } from '../../constants/gameConstants';
import { eventBus, GameEvents } from '../../core/EventBus';
import { AudioManager } from '../../managers/AudioManager';
import { hapticImpact } from '../../utils/Haptics';
import { getRealUnitTextureKey } from '../../utils/TextureHelpers';

/**
 * Цвета фракций для обводки карточек и баров статов
 */
const FACTION_COLORS: Record<FactionId, number> = {
  magma: 0xdc2626,    // Red
  cyborg: 0x3b82f6,   // Blue
  void: 0xa855f7,     // Purple
  insect: 0x22c55e,   // Green
};

/**
 * Русские названия ролей
 */
const ROLE_NAMES: Record<string, string> = {
  balanced: 'Универсал',
  tank: 'Танк',
  sniper: 'Снайпер',
  trickster: 'Трикстер',
};

/**
 * Интерфейс одной карточки юнита
 */
interface UnitCardElements {
  container: Phaser.GameObjects.Container;
  bgGraphics: Phaser.GameObjects.Graphics;
  glowGraphics: Phaser.GameObjects.Graphics;
  unitData: UnitData;
  isHovered: boolean;
}

/**
 * RewardSelectionOverlay
 * 
 * Модальное окно для выбора одного из трёх юнитов в качестве награды.
 * 
 * @example
 * // В GameScene или RewardCalculator:
 * const overlay = new RewardSelectionOverlay(this, ['magma_ember_fang', 'cyborg_arc_striker', 'void_phantom'], (selectedId) => {
 *   console.log('Selected unit:', selectedId);
 *   playerData.grantUnitReward(selectedId);
 * });
 * overlay.show();
 */
export class RewardSelectionOverlay {
  private scene: Phaser.Scene;
  private overlay!: Phaser.GameObjects.Rectangle;
  private mainContainer!: Phaser.GameObjects.Container;
  private cards: UnitCardElements[] = [];
  private activeTweens: Phaser.Tweens.Tween[] = [];
  private unitIds: string[];
  private onSelectCallback: (unitId: string) => void;

  constructor(scene: Phaser.Scene, unitIds: string[], onSelect: (unitId: string) => void) {
    this.scene = scene;
    this.unitIds = unitIds;
    this.onSelectCallback = onSelect;
  }

  /**
   * Показать окно с анимацией
   */
  public show(): void {
    const { width, height } = this.scene.cameras.main;

    // Полноэкранный затемненный фон
    this.overlay = this.scene.add
      .rectangle(0, 0, width, height, 0x000000, 0)
      .setOrigin(0)
      .setDepth(2000)
      .setInteractive();

    // Анимация затемнения
    this.scene.tweens.add({
      targets: this.overlay,
      fillAlpha: 0.85,
      duration: 300,
      ease: 'Power2',
    });

    // Главный контейнер для всех элементов
    this.mainContainer = this.scene.add.container(width / 2, height / 2).setDepth(2001);

    // Создаем заголовок
    this.createTitle();

    // Создаем 3 карточки юнитов
    this.createUnitCards();

    // Запускаем анимацию появления
    this.animateEntrance();
  }

  /**
   * Создать заголовок окна
   */
  private createTitle(): void {
    const titleText = this.scene.add.text(0, -280, 'ВЫБЕРИТЕ ЮНИТА', {
      fontSize: '32px',
      fontFamily: 'Orbitron, Arial',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0);

    const subtitleText = this.scene.add.text(0, -235, 'Один юнит будет добавлен в вашу коллекцию', {
      fontSize: '14px',
      fontFamily: 'Rajdhani, sans-serif',
      color: '#9ca3af',
    }).setOrigin(0.5).setAlpha(0);

    this.mainContainer.add([titleText, subtitleText]);

    // Анимация заголовка
    this.scene.tweens.add({
      targets: [titleText, subtitleText],
      alpha: 1,
      duration: 400,
      ease: 'Power2',
      delay: 100,
    });
  }

  /**
   * Создать карточки для трёх юнитов
   */
  private createUnitCards(): void {
    const cardWidth = 260;
    const cardGap = 30;
    const startX = -cardWidth - cardGap;

    this.unitIds.forEach((unitId, index) => {
      const unitData = getUnitById(unitId);
      if (!unitData) {
        console.warn(`[RewardSelectionOverlay] Unit not found: ${unitId}`);
        return;
      }

      const cardX = startX + index * (cardWidth + cardGap);
      const card = this.createUnitCard(unitData, cardX, 0, cardWidth);
      this.cards.push(card);
      this.mainContainer.add(card.container);
    });
  }

  /**
   * Создать одну карточку юнита
   */
  private createUnitCard(unitData: UnitData, x: number, y: number, width: number): UnitCardElements {
    const displayUnit = mergeUnitDisplay(unitData);
    const container = this.scene.add.container(x, y);
    const factionColor = FACTION_COLORS[unitData.factionId];
    const height = 480;

    // Graphics для фона и обводки
    const bgGraphics = this.scene.add.graphics();
    const glowGraphics = this.scene.add.graphics();

    container.add(glowGraphics);
    container.add(bgGraphics);

    // Рисуем фон карточки
    this.drawCardBackground(bgGraphics, width, height, factionColor, false);
    this.drawCardGlow(glowGraphics, width, height, factionColor, false);

    // Заголовок: Имя юнита
    const nameText = this.scene.add.text(0, -height / 2 + 30, unitData.name.toUpperCase(), {
      fontSize: '20px',
      fontFamily: 'Orbitron, Arial',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: width - 40 },
    }).setOrigin(0.5);
    container.add(nameText);

    // Подзаголовок: Роль
    const roleText = this.scene.add.text(0, -height / 2 + 58, ROLE_NAMES[unitData.role] || unitData.role, {
      fontSize: '14px',
      fontFamily: 'Orbitron, Arial',
      color: this.getRoleColor(unitData.role),
    }).setOrigin(0.5);
    container.add(roleText);

    // Аватар юнита (круглая картинка)
    const avatarY = -height / 2 + 150;
    this.createUnitAvatar(container, unitData, 0, avatarY, factionColor);

    // Статы (4 бара)
    const statsY = avatarY + 100;
    this.createStatBars(container, unitData, width, statsY, factionColor);

    // Описание
    const descY = statsY + 100;
    const descText = this.scene.add.text(0, descY, displayUnit.description, {
      fontSize: '12px',
      fontFamily: 'Rajdhani, sans-serif',
      color: '#d1d5db',
      align: 'center',
      wordWrap: { width: width - 40 },
    }).setOrigin(0.5);
    container.add(descText);

    // Кнопка "ВЫБРАТЬ"
    const buttonY = height / 2 - 40;
    this.createSelectButton(container, unitData, width, buttonY, factionColor);

    // Интерактивность карточки (hover)
    this.makeCardInteractive(container, bgGraphics, glowGraphics, width, height, factionColor);

    return {
      container,
      bgGraphics,
      glowGraphics,
      unitData,
      isHovered: false,
    };
  }

  /**
   * Нарисовать фон карточки
   */
  private drawCardBackground(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    color: number,
    hovered: boolean
  ): void {
    graphics.clear();

    const x = -width / 2;
    const y = -height / 2;
    const radius = 16;

    // Фон
    graphics.fillStyle(0x1e293b, 0.95);
    graphics.fillRoundedRect(x, y, width, height, radius);

    // Обводка
    const borderAlpha = hovered ? 0.9 : 0.5;
    const borderWidth = hovered ? 3 : 2;
    graphics.lineStyle(borderWidth, color, borderAlpha);
    graphics.strokeRoundedRect(x, y, width, height, radius);
  }

  /**
   * Нарисовать свечение вокруг карточки
   */
  private drawCardGlow(
    graphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    color: number,
    hovered: boolean
  ): void {
    graphics.clear();

    if (!hovered) return;

    const x = -width / 2;
    const y = -height / 2;
    const radius = 16;
    const glowSize = 8;

    // Внешнее свечение
    for (let i = glowSize; i > 0; i--) {
      const alpha = (1 - i / glowSize) * 0.3;
      graphics.lineStyle(i * 2, color, alpha);
      graphics.strokeRoundedRect(x - i, y - i, width + i * 2, height + i * 2, radius + i);
    }
  }

  /**
   * Создать аватар юнита (круглая картинка)
   */
  private createUnitAvatar(
    container: Phaser.GameObjects.Container,
    unitData: UnitData,
    x: number,
    y: number,
    factionColor: number
  ): void {
    const avatarRadius = 60;

    // Внешнее кольцо (цвет фракции)
    const ring = this.scene.add.graphics();
    ring.lineStyle(4, factionColor, 0.8);
    ring.strokeCircle(x, y, avatarRadius + 4);
    ring.lineStyle(2, factionColor, 0.3);
    ring.strokeCircle(x, y, avatarRadius + 10);
    container.add(ring);

    // Фон под аватаром
    const avatarBg = this.scene.add.graphics();
    avatarBg.fillStyle(0x000000, 0.6);
    avatarBg.fillCircle(x, y, avatarRadius);
    container.add(avatarBg);

    // Попытка загрузить текстуру юнита
    const textureKey = getRealUnitTextureKey(this.scene, unitData);
    if (textureKey) {
      const avatar = this.scene.add.image(x, y, textureKey);
      avatar.setDisplaySize(avatarRadius * 2, avatarRadius * 2);
      avatar.setOrigin(0.5);

      // Маска круга
      const mask = this.scene.add.graphics();
      mask.fillStyle(0xffffff);
      mask.fillCircle(x, y, avatarRadius);
      avatar.setMask(new Phaser.Display.Masks.GeometryMask(this.scene, mask));
      mask.setVisible(false);

      container.add(avatar);
    } else {
      // Fallback: цветной круг с первой буквой имени
      const fallbackCircle = this.scene.add.graphics();
      fallbackCircle.fillStyle(factionColor, 0.3);
      fallbackCircle.fillCircle(x, y, avatarRadius);
      container.add(fallbackCircle);

      const initialText = this.scene.add.text(x, y, unitData.name[0].toUpperCase(), {
        fontSize: '48px',
        fontFamily: 'Orbitron, Arial',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      container.add(initialText);
    }

    // Анимация вращения кольца
    const tween = this.scene.tweens.add({
      targets: ring,
      angle: 360,
      duration: 8000,
      repeat: -1,
      ease: 'Linear',
    });
    this.activeTweens.push(tween);
  }

  /**
   * Создать 4 бара статов (Power, Defense, Speed, Technique)
   */
  private createStatBars(
    container: Phaser.GameObjects.Container,
    unitData: UnitData,
    cardWidth: number,
    y: number,
    factionColor: number
  ): void {
    const stats = [
      { label: 'PWR', value: unitData.stats.power, icon: '💥' },
      { label: 'DEF', value: unitData.stats.defense, icon: '🛡️' },
      { label: 'SPD', value: unitData.stats.speed, icon: '⚡' },
      { label: 'TEC', value: unitData.stats.technique, icon: '✨' },
    ];

    const barWidth = cardWidth - 60;
    const barHeight = 6;
    const barGap = 18;

    stats.forEach((stat, index) => {
      const barY = y + index * barGap;
      const progress = stat.value / 10; // Максимум 10

      // Иконка и название
      const labelText = this.scene.add.text(-cardWidth / 2 + 20, barY - 3, `${stat.icon} ${stat.label}`, {
        fontSize: '11px',
        fontFamily: 'Rajdhani, sans-serif',
        color: '#9ca3af',
      }).setOrigin(0, 0.5);
      container.add(labelText);

      // Значение справа
      const valueText = this.scene.add.text(cardWidth / 2 - 20, barY - 3, stat.value.toString(), {
        fontSize: '12px',
        fontFamily: 'Orbitron, Arial',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(1, 0.5);
      container.add(valueText);

      // Фон бара
      const barBg = this.scene.add.graphics();
      barBg.fillStyle(0xffffff, 0.1);
      barBg.fillRoundedRect(-barWidth / 2, barY + 4, barWidth, barHeight, 3);
      container.add(barBg);

      // Заполненная часть бара
      const barFill = this.scene.add.graphics();
      barFill.fillStyle(factionColor, 0.8);
      barFill.fillRoundedRect(-barWidth / 2, barY + 4, barWidth * progress, barHeight, 3);
      container.add(barFill);

      // Легкое свечение
      barFill.lineStyle(1, factionColor, 0.5);
      barFill.strokeRoundedRect(-barWidth / 2, barY + 4, barWidth * progress, barHeight, 3);
    });
  }

  /**
   * Создать кнопку "ВЫБРАТЬ"
   */
  private createSelectButton(
    container: Phaser.GameObjects.Container,
    unitData: UnitData,
    cardWidth: number,
    y: number,
    factionColor: number
  ): void {
    const buttonWidth = cardWidth - 40;
    const buttonHeight = 46;

    const buttonBg = this.scene.add.graphics();
    const drawButton = (hovered: boolean) => {
      buttonBg.clear();

      // Фон
      const bgAlpha = hovered ? 0.3 : 0.2;
      buttonBg.fillStyle(factionColor, bgAlpha);
      buttonBg.fillRoundedRect(-buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, 12);

      // Обводка
      const borderAlpha = hovered ? 0.9 : 0.6;
      buttonBg.lineStyle(2, factionColor, borderAlpha);
      buttonBg.strokeRoundedRect(-buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, 12);
    };

    drawButton(false);
    container.add(buttonBg);

    // Текст кнопки
    const buttonText = this.scene.add.text(0, y, 'ВЫБРАТЬ', {
      fontSize: '16px',
      fontFamily: 'Orbitron, Arial',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(buttonText);

    // Интерактивная область
    const hitArea = this.scene.add.rectangle(0, y, buttonWidth, buttonHeight, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => {
      drawButton(true);
      buttonText.setScale(1.05);
      hapticImpact('light');
    });

    hitArea.on('pointerout', () => {
      drawButton(false);
      buttonText.setScale(1);
    });

    hitArea.on('pointerdown', () => {
      this.handleSelection(unitData.id);
    });

    container.add(hitArea);
  }

  /**
   * Сделать карточку интерактивной (hover эффект)
   */
  private makeCardInteractive(
    container: Phaser.GameObjects.Container,
    bgGraphics: Phaser.GameObjects.Graphics,
    glowGraphics: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    factionColor: number
  ): void {
    const hitArea = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    hitArea.on('pointerover', () => {
      this.drawCardBackground(bgGraphics, width, height, factionColor, true);
      this.drawCardGlow(glowGraphics, width, height, factionColor, true);

      // Легкое увеличение
      this.scene.tweens.add({
        targets: container,
        scale: 1.05,
        duration: 200,
        ease: 'Power2',
      });

      hapticImpact('light');
    });

    hitArea.on('pointerout', () => {
      this.drawCardBackground(bgGraphics, width, height, factionColor, false);
      this.drawCardGlow(glowGraphics, width, height, factionColor, false);

      // Возврат к нормальному размеру
      this.scene.tweens.add({
        targets: container,
        scale: 1,
        duration: 200,
        ease: 'Power2',
      });
    });

    container.add(hitArea);
    hitArea.setDepth(-1); // Под всеми элементами карточки
  }

  /**
   * Получить цвет роли
   */
  private getRoleColor(role: string): string {
    const colors: Record<string, string> = {
      balanced: '#3b82f6',   // Blue
      tank: '#ef4444',       // Red
      sniper: '#22c55e',     // Green
      trickster: '#a855f7',  // Purple
    };
    return colors[role] || '#ffffff';
  }

  /**
   * Анимация появления карточек
   */
  private animateEntrance(): void {
    this.cards.forEach((card, index) => {
      // Начальное состояние: снизу и прозрачно
      card.container.setAlpha(0);
      card.container.setY(card.container.y + 80);
      card.container.setScale(0.8);

      // Анимация появления с задержкой для каждой карты
      this.scene.tweens.add({
        targets: card.container,
        alpha: 1,
        y: 0,
        scale: 1,
        duration: 500,
        ease: 'Back.easeOut',
        delay: 200 + index * 150, // Задержка между картами
      });
    });
  }

  /**
   * Обработка выбора юнита
   */
  private handleSelection(unitId: string): void {
    AudioManager.getInstance().playSFX('sfx_cash');
    hapticImpact('medium');

    // Эмитируем событие через EventBus
    eventBus.emit(GameEvents.REWARD_UNIT_SELECTED, { unitId });

    // Вызываем callback
    this.onSelectCallback(unitId);

    // Закрываем окно
    this.close();
  }

  /**
   * Закрыть окно с анимацией
   */
  public close(): void {
    // Останавливаем все анимации
    this.activeTweens.forEach(tween => tween.destroy());
    this.activeTweens = [];

    // Анимация закрытия фона
    this.scene.tweens.add({
      targets: this.overlay,
      fillAlpha: 0,
      duration: 250,
    });

    // Анимация закрытия карточек
    this.scene.tweens.add({
      targets: this.mainContainer,
      alpha: 0,
      scale: 0.85,
      duration: 250,
      ease: 'Power2',
      onComplete: () => {
        this.overlay.destroy();
        this.mainContainer.destroy();
      },
    });
  }

  /**
   * Принудительное уничтожение
   */
  public destroy(): void {
    this.close();
  }
}
