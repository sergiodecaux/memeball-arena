// src/ui/RookieFactionRewardOverlay.ts
// ✅ UI-класс для выбора фракции в качестве награды за Путь Новичка
// Показывает карточки фракций с анимацией, hover-эффектами и информацией о стартовых юнитах

import Phaser from 'phaser';
import { FACTIONS, FactionId, FactionConfig } from '../constants/gameConstants';
import { STARTER_UNITS_BY_FACTION } from '../data/PlayerData';
import { getUnitById } from '../data/UnitsRepository';
import { AudioManager } from '../managers/AudioManager';
import { hapticImpact } from '../utils/Haptics';
import { createRoleIcon } from './ClassIcons';

/**
 * Иконки фракций (эмодзи)
 */
const FACTION_ICONS: Record<FactionId, string> = {
  magma: '🔥',
  cyborg: '🤖',
  void: '🌌',
  insect: '🐛',
};

/**
 * Русские названия фракций
 */
const FACTION_NAMES_RU: Record<FactionId, string> = {
  magma: 'Магма Бруты',
  cyborg: 'Терранские Киборги',
  void: 'Воиды',
  insect: 'Ксенос Рой',
};

/**
 * Интерфейс одной карточки фракции
 */
interface FactionCardElements {
  container: Phaser.GameObjects.Container;
  bgGraphics: Phaser.GameObjects.Graphics;
  glowGraphics: Phaser.GameObjects.Graphics;
  factionConfig: FactionConfig;
  isHovered: boolean;
}

/**
 * RookieFactionRewardOverlay
 * 
 * Модальное окно для выбора одной из доступных фракций в качестве награды.
 * 
 * @example
 * const overlay = new RookieFactionRewardOverlay(
 *   this,
 *   ['magma', 'cyborg', 'void'],
 *   (chosenFaction) => {
 *     console.log('Selected faction:', chosenFaction);
 *     rookiePathManager.claimFinalReward(chosenFaction);
 *   }
 * );
 * overlay.show();
 */
export class RookieFactionRewardOverlay {
  private scene: Phaser.Scene;
  private overlay!: Phaser.GameObjects.Rectangle;
  private mainContainer!: Phaser.GameObjects.Container;
  private cards: FactionCardElements[] = [];
  private activeTweens: Phaser.Tweens.Tween[] = [];
  private factionIds: FactionId[];
  private onSelectCallback: (factionId: FactionId) => void;

  constructor(
    scene: Phaser.Scene,
    factionIds: FactionId[],
    onSelect: (factionId: FactionId) => void
  ) {
    this.scene = scene;
    this.factionIds = factionIds;
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

    // Создаем карточки фракций
    this.createFactionCards();

    // Запускаем анимацию появления
    this.animateEntrance();
  }

  /**
   * Создать заголовок окна
   */
  private createTitle(): void {
    const titleText = this.scene.add.text(0, -280, '🎁 ВЫБЕРИТЕ ФРАКЦИЮ', {
      fontSize: '32px',
      fontFamily: 'Orbitron, Arial',
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0);

    const subtitleText = this.scene.add.text(0, -235, 'Награда за завершение Пути Новичка', {
      fontSize: '16px',
      fontFamily: 'Rajdhani, sans-serif',
      color: '#9ca3af',
    }).setOrigin(0.5).setAlpha(0);

    const rewardText = this.scene.add.text(0, -200, 'Вы получите все 4 стартовых юнита этой фракции', {
      fontSize: '14px',
      fontFamily: 'Rajdhani, sans-serif',
      color: '#22c55e',
      fontStyle: 'italic',
    }).setOrigin(0.5).setAlpha(0);

    this.mainContainer.add([titleText, subtitleText, rewardText]);

    // Анимация заголовка
    this.scene.tweens.add({
      targets: [titleText, subtitleText, rewardText],
      alpha: 1,
      duration: 400,
      ease: 'Power2',
      delay: 100,
    });
  }

  /**
   * Создать карточки для фракций
   */
  private createFactionCards(): void {
    const cardCount = this.factionIds.length;
    const cardWidth = 280;
    const cardGap = 30;
    
    // Вычисляем начальную позицию для центрирования
    const totalWidth = cardCount * cardWidth + (cardCount - 1) * cardGap;
    const startX = -totalWidth / 2 + cardWidth / 2;

    this.factionIds.forEach((factionId, index) => {
      const factionConfig = FACTIONS[factionId];
      if (!factionConfig) {
        console.warn(`[RookieFactionRewardOverlay] Faction not found: ${factionId}`);
        return;
      }

      const cardX = startX + index * (cardWidth + cardGap);
      const card = this.createFactionCard(factionConfig, cardX, 0, cardWidth);
      this.cards.push(card);
      this.mainContainer.add(card.container);
    });
  }

  /**
   * Создать одну карточку фракции
   */
  private createFactionCard(
    factionConfig: FactionConfig,
    x: number,
    y: number,
    width: number
  ): FactionCardElements {
    const container = this.scene.add.container(x, y);
    const factionColor = factionConfig.color;
    const height = 520;

    // Graphics для фона и обводки
    const bgGraphics = this.scene.add.graphics();
    const glowGraphics = this.scene.add.graphics();

    container.add(glowGraphics);
    container.add(bgGraphics);

    // Рисуем фон карточки
    this.drawCardBackground(bgGraphics, width, height, factionColor, false);
    this.drawCardGlow(glowGraphics, width, height, factionColor, false);

    // Иконка фракции (большая)
    const iconY = -height / 2 + 50;
    const iconText = this.scene.add.text(0, iconY, FACTION_ICONS[factionConfig.id], {
      fontSize: '80px',
    }).setOrigin(0.5);
    container.add(iconText);

    // Название фракции
    const nameText = this.scene.add.text(0, iconY + 60, FACTION_NAMES_RU[factionConfig.id], {
      fontSize: '22px',
      fontFamily: 'Orbitron, Arial',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: width - 40 },
    }).setOrigin(0.5);
    container.add(nameText);

    // Описание фракции
    const descY = iconY + 100;
    const descText = this.scene.add.text(0, descY, this.translateDescription(factionConfig.description), {
      fontSize: '13px',
      fontFamily: 'Rajdhani, sans-serif',
      color: '#d1d5db',
      align: 'center',
      wordWrap: { width: width - 40 },
    }).setOrigin(0.5);
    container.add(descText);

    // Стартовые юниты
    const unitsY = descY + 80;
    this.createStarterUnits(container, factionConfig.id, width, unitsY, factionColor);

    // Статы фракции
    const statsY = unitsY + 100;
    this.createFactionStats(container, factionConfig, width, statsY, factionColor);

    // Кнопка "ВЫБРАТЬ"
    const buttonY = height / 2 - 40;
    this.createSelectButton(container, factionConfig, width, buttonY, factionColor);

    // Интерактивность карточки (hover)
    this.makeCardInteractive(container, bgGraphics, glowGraphics, width, height, factionColor);

    return {
      container,
      bgGraphics,
      glowGraphics,
      factionConfig,
      isHovered: false,
    };
  }

  /**
   * Перевести описание фракции на русский
   */
  private translateDescription(description: string): string {
    const translations: Record<string, string> = {
      'Heavy Defense. Hard to move, devastating impact.': 'Тяжёлая защита. Сложно сдвинуть, сокрушительный удар.',
      'Balanced Tech. Precision engineering for any situation.': 'Сбалансированная техника. Точная инженерия для любой ситуации.',
      'Phase Control. Light and elusive with powerful curve shots.': 'Контроль фаз. Лёгкие и неуловимые с мощными кривыми ударами.',
      'Speed Assault. Lightning fast strikes, fragile but deadly.': 'Скоростной штурм. Молниеносные удары, хрупкие, но смертоносные.',
    };
    return translations[description] || description;
  }

  /**
   * Создать отображение стартовых юнитов
   */
  private createStarterUnits(
    container: Phaser.GameObjects.Container,
    factionId: FactionId,
    cardWidth: number,
    y: number,
    factionColor: number
  ): void {
    const starterUnits = STARTER_UNITS_BY_FACTION[factionId];
    if (!starterUnits) return;

    const titleText = this.scene.add.text(0, y, 'Стартовые юниты:', {
      fontSize: '14px',
      fontFamily: 'Orbitron, Arial',
      color: '#9ca3af',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(titleText);

    const unitIds = [
      starterUnits.balanced,
      starterUnits.tank,
      starterUnits.sniper,
      starterUnits.trickster,
    ];

    const unitGap = 50;
    const startX = -(unitIds.length - 1) * unitGap / 2;

    unitIds.forEach((unitId, index) => {
      const unitData = getUnitById(unitId);
      if (!unitData) return;

      const unitX = startX + index * unitGap;
      const unitY = y + 30;

      // Круглый фон для иконки юнита
      const unitBg = this.scene.add.graphics();
      unitBg.fillStyle(factionColor, 0.2);
      unitBg.fillCircle(unitX, unitY, 20);
      unitBg.lineStyle(2, factionColor, 0.6);
      unitBg.strokeCircle(unitX, unitY, 20);
      container.add(unitBg);

      // Иконка роли (PNG с fallback на эмодзи)
      const roleIconContainer = createRoleIcon(this.scene, unitX, unitY, unitData.role, 20);
      container.add(roleIconContainer);

      // Название роли под иконкой
      const roleNames: Record<string, string> = {
        balanced: 'Универсал',
        tank: 'Танк',
        sniper: 'Снайпер',
        trickster: 'Трикстер',
      };
      const roleText = this.scene.add.text(unitX, unitY + 25, roleNames[unitData.role] || unitData.role, {
        fontSize: '10px',
        fontFamily: 'Rajdhani, sans-serif',
        color: '#9ca3af',
      }).setOrigin(0.5);
      container.add(roleText);
    });
  }

  /**
   * Создать отображение статов фракции
   */
  private createFactionStats(
    container: Phaser.GameObjects.Container,
    factionConfig: FactionConfig,
    cardWidth: number,
    y: number,
    factionColor: number
  ): void {
    const stats = [
      { label: 'Масса', value: factionConfig.stats.mass, icon: '⚖️', max: 1.5 },
      { label: 'Отскок', value: factionConfig.stats.bounce, icon: '🔵', max: 1.0 },
      { label: 'Скорость', value: factionConfig.stats.speed, icon: '⚡', max: 1.5 },
    ];

    const barWidth = cardWidth - 60;
    const barHeight = 6;
    const barGap = 20;

    stats.forEach((stat, index) => {
      const barY = y + index * barGap;
      const progress = stat.value / stat.max;

      // Иконка и название
      const labelText = this.scene.add.text(-cardWidth / 2 + 20, barY - 3, `${stat.icon} ${stat.label}`, {
        fontSize: '11px',
        fontFamily: 'Rajdhani, sans-serif',
        color: '#9ca3af',
      }).setOrigin(0, 0.5);
      container.add(labelText);

      // Значение справа
      const valueText = this.scene.add.text(cardWidth / 2 - 20, barY - 3, stat.value.toFixed(2), {
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
    });
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
   * Создать кнопку "ВЫБРАТЬ"
   */
  private createSelectButton(
    container: Phaser.GameObjects.Container,
    factionConfig: FactionConfig,
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
      this.handleSelection(factionConfig.id);
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
   * Обработка выбора фракции
   */
  private handleSelection(factionId: FactionId): void {
    AudioManager.getInstance().playSFX('sfx_cash');
    hapticImpact('medium');

    // Вызываем callback
    this.onSelectCallback(factionId);

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
