import Phaser from 'phaser';
import { getColors, getFonts, hexToString, TYPOGRAPHY } from '../config/themes';
import { hapticImpact, hapticSelection } from '../utils/Haptics';
import { AudioManager } from '../managers/AudioManager';
import { UNITS_REPOSITORY, UnitData, getDisplayName } from '../data/UnitsRepository';
import { FACTIONS } from '../constants/gameConstants';
import { TEAM_LAYOUT, fitText, fitImage, getSafeArea } from './layout/TeamSceneLayout';

/**
 * UnitSelectionOverlay - красивое меню выбора юнита в стиле Mobile Legends
 * 
 * Особенности:
 * - Красивые карточки с изображениями юнитов
 * - Подробная информация о стате (SPD, PWR, DEF)
 * - Описание способностей
 * - Анимации и эффекты
 * - Поддержка свайпа между юнитами
 */
export class UnitSelectionOverlay extends Phaser.GameObjects.Container {
  private bg!: Phaser.GameObjects.Graphics;
  private cardContainer!: Phaser.GameObjects.Container;
  private unitChoices: string[];
  private selectedIndex = 0;
  private onSelect?: (unitId: string) => void;
  private onClose?: () => void;
  private canClaim: boolean; // ✅ Можно ли забрать награду

  constructor(
    scene: Phaser.Scene,
    unitChoices: string[],
    canClaim: boolean,
    onSelect?: (unitId: string) => void,
    onClose?: () => void
  ) {
    super(scene, 0, 0);
    
    this.unitChoices = unitChoices;
    this.canClaim = canClaim;
    this.onSelect = onSelect;
    this.onClose = onClose;
    this.setDepth(25000); // Очень высокий z-index

    this.createBackground();
    this.createCardView();
    this.setupSwipe();
    this.showUnit(0);

    scene.add.existing(this);
  }

  private createBackground(): void {
    const { width, height } = this.scene.cameras.main;

    // Затемненный фон
    this.bg = this.scene.add.graphics();
    this.bg.fillStyle(
      TEAM_LAYOUT.COLORS.background.overlayDark,
      TEAM_LAYOUT.COLORS.alpha.medium
    );
    this.bg.fillRect(0, 0, width, height);
    this.add(this.bg);

    // ✅ ДОБАВЛЕНО: Возможность закрыть по клику на фон
    const bgHitArea = this.scene.add.rectangle(width / 2, height / 2, width, height, 0, 0)
      .setInteractive({ useHandCursor: false });
    this.add(bgHitArea);
    
    bgHitArea.on('pointerdown', () => {
      // Закрываем оверлей без выбора юнита
      AudioManager.getInstance().playUIClick();
      hapticImpact('light');
      if (this.onClose) {
        this.onClose();
      }
      this.close();
    });

    // Декоративные элементы
    this.createDecorativeElements();
  }

  private createDecorativeElements(): void {
    const { width, height } = this.scene.cameras.main;
    const colors = getColors();

    // Золотые лучи (как в ML)
    const rays = this.scene.add.graphics();
    rays.lineStyle(2, colors.uiGold, 0.1);
    
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const startX = width / 2;
      const startY = height / 2;
      const endX = startX + Math.cos(angle) * 400;
      const endY = startY + Math.sin(angle) * 400;
      rays.lineBetween(startX, startY, endX, endY);
    }
    
    this.add(rays);

    // Анимация вращения лучей
    this.scene.tweens.add({
      targets: rays,
      rotation: Math.PI * 2,
      duration: 20000,
      repeat: -1,
      ease: 'Linear',
    });

    // Плавающие частицы
    for (let i = 0; i < 15; i++) {
      const particle = this.scene.add.circle(
        Math.random() * width,
        Math.random() * height,
        2 + Math.random() * 3,
        colors.uiGold,
        0.3 + Math.random() * 0.3
      );
      this.add(particle);

      this.scene.tweens.add({
        targets: particle,
        y: particle.y - 50 - Math.random() * 100,
        alpha: 0,
        duration: 3000 + Math.random() * 2000,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private createCardView(): void {
    const { width, height } = this.scene.cameras.main;

    this.cardContainer = this.scene.add.container(width / 2, height / 2);
    this.add(this.cardContainer);
  }
  
  private createCloseButton(): void {
    const { width, height } = this.scene.cameras.main;
    const layout = TEAM_LAYOUT.OVERLAY.closeButton;
    
    // ✅ Позиционируем относительно карточки (не экрана)
    const btnX = width / 2 + layout.offsetX;
    const btnY = -height / 2 + layout.offsetY;
    
    const closeBtn = this.scene.add.container(btnX, btnY);
    
    // Фон кнопки
    const btnBg = this.scene.add.graphics();
    btnBg.fillStyle(0x1a1a2e, TEAM_LAYOUT.COLORS.alpha.high);
    btnBg.fillCircle(0, 0, layout.size / 2);
    btnBg.lineStyle(layout.borderWidth, 0xff4444, 0.8);
    btnBg.strokeCircle(0, 0, layout.size / 2);
    closeBtn.add(btnBg);
    
    // Иконка X
    const xIcon = this.scene.add.text(0, 0, '✕', {
      fontSize: `${layout.fontSize}px`,
      color: '#ff4444',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    closeBtn.add(xIcon);
    
    // Интерактивность
    closeBtn.setInteractive(
      new Phaser.Geom.Circle(0, 0, layout.size / 2),
      Phaser.Geom.Circle.Contains
    );
    closeBtn.on('pointerdown', () => {
      AudioManager.getInstance().playUIClick();
      hapticImpact('light');
      if (this.onClose) {
        this.onClose();
      }
      this.close();
    });
    
    closeBtn.on('pointerover', () => {
      this.scene.tweens.add({
        targets: closeBtn,
        scale: 1.1,
        duration: 150,
      });
    });
    
    closeBtn.on('pointerout', () => {
      this.scene.tweens.add({
        targets: closeBtn,
        scale: 1,
        duration: 150,
      });
    });
    
    this.cardContainer.add(closeBtn);
  }

  private showUnit(index: number): void {
    this.selectedIndex = Phaser.Math.Clamp(index, 0, this.unitChoices.length - 1);
    
    // ✅ Анимация исчезновения старой карточки
    if (this.cardContainer.list.length > 0) {
      this.scene.tweens.add({
        targets: this.cardContainer,
        alpha: 0,
        scale: 0.9,
        duration: 150,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.cardContainer.removeAll(true);
          this.cardContainer.setAlpha(1);
          this.cardContainer.setScale(1);
          this.showUnitContent(index);
        }
      });
    } else {
      this.showUnitContent(index);
    }
  }

  private showUnitContent(index: number): void {
    const unitId = this.unitChoices[this.selectedIndex];
    const unit = UNITS_REPOSITORY.find(u => u.id === unitId);

    if (!unit) {
      console.error(`[UnitSelectionOverlay] Unit not found: ${unitId}`);
      return;
    }

    this.createUnitCard(unit);
    this.createNavigationButtons();
    this.createSelectButton(unit);
    this.createCloseButton();

    // ✅ Анимация появления новой карточки
    this.cardContainer.setAlpha(0);
    this.cardContainer.setScale(0.9);
    this.scene.tweens.add({
      targets: this.cardContainer,
      alpha: 1,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });

    // Звук смены юнита (только если это не первый показ)
    if (index > 0 || this.selectedIndex > 0) {
      AudioManager.getInstance().playUIClick();
      hapticSelection();
    }
  }

  private createUnitCard(unit: UnitData): void {
    const { width, height } = this.scene.cameras.main;
    const fonts = getFonts();
    const colors = getColors();
    const faction = FACTIONS[unit.factionId];
    const safeArea = getSafeArea(this.scene);
    const layout = TEAM_LAYOUT.OVERLAY;

    // ✅ Используем константы из TEAM_LAYOUT для размеров карточки
    const cardWidth = Math.min(width - layout.card.widthMargin, layout.card.maxWidth);
    const cardHeight = Math.min(
      safeArea.visibleHeight - layout.card.heightMargin,
      layout.card.maxHeight
    );

    // ========== КАРТОЧКА ==========
    const cardBg = this.scene.add.graphics();
    
    // Основной фон
    cardBg.fillStyle(TEAM_LAYOUT.COLORS.background.overlay, TEAM_LAYOUT.COLORS.alpha.high);
    cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, layout.card.borderRadius);

    // Градиент сверху (цвет фракции)
    for (let i = 0; i < 80; i++) {
      cardBg.fillStyle(faction.color, 0.12 * (1 - i / 80));
      cardBg.fillRect(-cardWidth / 2, -cardHeight / 2 + i, cardWidth, 1);
    }

    // Glass эффект сверху
    cardBg.fillStyle(0xffffff, 0.04);
    cardBg.fillRoundedRect(
      -cardWidth / 2 + layout.card.innerPadding,
      -cardHeight / 2 + layout.card.innerPadding,
      cardWidth - layout.card.innerPadding * 2,
      70,
      { tl: 16, tr: 16, bl: 0, br: 0 } as any
    );

    // Обводка
    cardBg.lineStyle(layout.card.borderWidth, faction.color, 0.8);
    cardBg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, layout.card.borderRadius);

    // Внутренняя обводка
    cardBg.lineStyle(1, faction.color, 0.3);
    cardBg.strokeRoundedRect(
      -cardWidth / 2 + layout.card.innerPadding,
      -cardHeight / 2 + layout.card.innerPadding,
      cardWidth - layout.card.innerPadding * 2,
      cardHeight - layout.card.innerPadding * 2,
      layout.card.borderRadius - 2
    );

    this.cardContainer.add(cardBg);

    // ========== НАЗВАНИЕ ЮНИТА ==========
    const unitName = this.scene.add.text(
      0,
      -cardHeight / 2 + layout.title.offsetY,
      getDisplayName(unit).toUpperCase(),
      {
        fontSize: `${layout.title.fontSize}px`,
        fontFamily: fonts.tech,
        color: hexToString(TEAM_LAYOUT.COLORS.text.primary),
        fontStyle: 'bold',
        letterSpacing: layout.title.letterSpacing,
        wordWrap: { width: cardWidth - layout.title.wordWrapWidth },
        align: 'center',
      }
    ).setOrigin(0.5);
    
    // ✅ Используем fitText для автоматической подгонки длинных имен
    fitText(unitName, cardWidth - layout.title.wordWrapWidth);
    
    this.applyGlowText(unitName);
    this.cardContainer.add(unitName);

    // ========== ФРАКЦИЯ ==========
    const factionBadge = this.scene.add.container(0, -cardHeight / 2 + layout.factionBadge.offsetY);
    
    const badgeBg = this.scene.add.graphics();
    badgeBg.fillStyle(faction.color, 0.2);
    badgeBg.fillRoundedRect(
      -layout.factionBadge.width / 2,
      -layout.factionBadge.height / 2,
      layout.factionBadge.width,
      layout.factionBadge.height,
      layout.factionBadge.borderRadius
    );
    badgeBg.lineStyle(layout.factionBadge.borderWidth, faction.color, 0.6);
    badgeBg.strokeRoundedRect(
      -layout.factionBadge.width / 2,
      -layout.factionBadge.height / 2,
      layout.factionBadge.width,
      layout.factionBadge.height,
      layout.factionBadge.borderRadius
    );
    factionBadge.add(badgeBg);

    const factionText = this.scene.add.text(0, 0, faction.name.toUpperCase(), {
      fontSize: `${layout.factionBadge.fontSize}px`,
      fontFamily: fonts.tech,
      color: hexToString(faction.color),
      fontStyle: 'bold',
    }).setOrigin(0.5);
    factionBadge.add(factionText);

    this.cardContainer.add(factionBadge);

    // ========== ИЗОБРАЖЕНИЕ ЮНИТА ==========
    const unitImageY = -cardHeight / 2 + layout.unitImage.offsetY;
    const circleSize = layout.unitImage.circleSize;
    const unitImageSize = circleSize * layout.unitImage.imageSizeRatio; // +30% для pop-out элементов

    const imageBg = this.scene.add.graphics();
    imageBg.fillStyle(0x1a1a2e, TEAM_LAYOUT.COLORS.alpha.medium);
    imageBg.fillCircle(0, unitImageY, circleSize / 2 + 8);
    imageBg.lineStyle(layout.unitImage.circleStrokeWidth, faction.color, 0.8);
    imageBg.strokeCircle(0, unitImageY, circleSize / 2 + 8);
    
    // Внешнее свечение
    imageBg.lineStyle(layout.unitImage.outerGlowWidth, faction.color, 0.2);
    imageBg.strokeCircle(0, unitImageY, circleSize / 2 + layout.unitImage.outerGlowRadius);
    
    this.cardContainer.add(imageBg);

    // PNG юнита
    const unitKey = `${unit.id}_512`;
    if (this.scene.textures.exists(unitKey)) {
      const unitImg = this.scene.add.image(0, unitImageY, unitKey);
      
      // ✅ Используем fitImage для правильного масштабирования с учетом pop-out
      fitImage(unitImg, unitImageSize);
      
      this.cardContainer.add(unitImg);

      // Пульсация
      const baseScale = unitImg.scaleX;
      this.scene.tweens.add({
        targets: unitImg,
        scale: {
          from: baseScale * layout.unitImage.pulseScale.min,
          to: baseScale * layout.unitImage.pulseScale.max
        },
        duration: layout.unitImage.pulseDuration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      const placeholder = this.scene.add.text(0, unitImageY, '?', {
        fontSize: `${unitImageSize / 2}px`,
        color: hexToString(TEAM_LAYOUT.COLORS.text.primary),
      }).setOrigin(0.5);
      this.cardContainer.add(placeholder);
    }

    // ========== СТАТЫ (SPD, PWR, DEF) ==========
    const statsY = -cardHeight / 2 + layout.stats.offsetY;
    this.createStatsBar(unit, statsY, cardWidth);

    // ========== КЛАСС ЮНИТА ==========
    const classY = -cardHeight / 2 + layout.class.offsetY;
    const classText = this.scene.add.text(0, classY, `Класс: ${this.translateClass(unit.role)}`, {
      fontSize: `${layout.class.fontSize}px`,
      fontFamily: fonts.tech,
      color: hexToString(TEAM_LAYOUT.COLORS.text.secondary),
    }).setOrigin(0.5);
    this.cardContainer.add(classText);

    // ========== ОПИСАНИЕ ==========
    const descY = -cardHeight / 2 + layout.description.offsetY;
    const description = this.getUnitDescription(unit);
    const descText = this.scene.add.text(0, descY, description, {
      fontSize: `${layout.description.fontSize}px`,
      fontFamily: fonts.primary,
      color: hexToString(TEAM_LAYOUT.COLORS.text.secondary),
      align: 'center',
      wordWrap: { width: cardWidth - layout.description.wordWrapWidth },
    }).setOrigin(0.5, 0);
    this.cardContainer.add(descText);

    // ========== ИНДИКАТОР (1/3, 2/3, 3/3) ==========
    const indicatorY = cardHeight / 2 + layout.indicator.offsetY;
    
    // ✅ Добавляем красивый фон для индикатора
    const indicatorBg = this.scene.add.graphics();
    indicatorBg.fillStyle(0x1a1a2e, TEAM_LAYOUT.COLORS.alpha.medium);
    indicatorBg.fillRoundedRect(
      -layout.indicator.width / 2,
      indicatorY - layout.indicator.height / 2,
      layout.indicator.width,
      layout.indicator.height,
      layout.indicator.borderRadius
    );
    indicatorBg.lineStyle(layout.indicator.borderWidth, colors.uiGold, 0.5);
    indicatorBg.strokeRoundedRect(
      -layout.indicator.width / 2,
      indicatorY - layout.indicator.height / 2,
      layout.indicator.width,
      layout.indicator.height,
      layout.indicator.borderRadius
    );
    this.cardContainer.add(indicatorBg);
    
    const indicatorText = this.scene.add.text(0, indicatorY, `${this.selectedIndex + 1}/${this.unitChoices.length}`, {
      fontSize: `${layout.indicator.fontSize}px`,
      fontFamily: fonts.tech,
      color: hexToString(colors.uiGold),
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.cardContainer.add(indicatorText);
  }

  private createStatsBar(unit: UnitData, y: number, cardWidth: number): void {
    const fonts = getFonts();
    const layout = TEAM_LAYOUT.OVERLAY.stats;

    const stats = [
      { label: 'СКОРОСТЬ', value: unit.stats.speed, max: 10, color: 0x3b82f6 },
      { label: 'СИЛА', value: unit.stats.power, max: 10, color: 0xef4444 },
      { label: 'ЗАЩИТА', value: unit.stats.defense, max: 10, color: 0x10b981 },
    ];

    // ✅ Используем константы из TEAM_LAYOUT для ширины баров
    const barWidth = cardWidth - layout.barWidth;
    const barHeight = layout.barHeight;
    const spacing = layout.barSpacing;

    stats.forEach((stat, index) => {
      const statY = y + index * spacing;

      // Лейбл
      const label = this.scene.add.text(
        -barWidth / 2 + layout.labelOffsetX,
        statY,
        stat.label,
        {
          fontSize: `${layout.labelFontSize}px`,
          fontFamily: fonts.tech,
          color: hexToString(TEAM_LAYOUT.COLORS.text.tertiary),
          align: 'right',
        }
      ).setOrigin(1, 0.5);
      this.cardContainer.add(label);

      // Фон бара
      const barBg = this.scene.add.graphics();
      barBg.fillStyle(0x1a1a2e, TEAM_LAYOUT.COLORS.alpha.medium);
      barBg.fillRoundedRect(
        -barWidth / 2,
        statY - barHeight / 2,
        barWidth,
        barHeight,
        layout.barBorderRadius
      );
      this.cardContainer.add(barBg);

      // Заполненная часть
      const fillWidth = (stat.value / stat.max) * barWidth;
      const barFill = this.scene.add.graphics();
      barFill.fillStyle(stat.color, 0.9);
      barFill.fillRoundedRect(
        -barWidth / 2,
        statY - barHeight / 2,
        fillWidth,
        barHeight,
        layout.barBorderRadius
      );
      
      // Градиент
      for (let i = 0; i < barHeight; i++) {
        barFill.fillStyle(stat.color, 0.9 - (i / barHeight) * 0.3);
        barFill.fillRect(-barWidth / 2, statY - barHeight / 2 + i, fillWidth, 1);
      }
      
      this.cardContainer.add(barFill);

      // Значение
      const value = this.scene.add.text(
        barWidth / 2 + layout.valueOffsetX,
        statY,
        `${stat.value}`,
        {
          fontSize: `${layout.valueFontSize}px`,
          fontFamily: fonts.tech,
          color: hexToString(TEAM_LAYOUT.COLORS.text.primary),
          fontStyle: 'bold',
        }
      ).setOrigin(0, 0.5);
      this.cardContainer.add(value);

      // Анимация заполнения при создании
      barFill.setScale(0, 1);
      this.scene.tweens.add({
        targets: barFill,
        scaleX: 1,
        duration: 500,
        delay: index * layout.animationDelay,
        ease: 'Cubic.easeOut',
      });
    });
  }

  private createNavigationButtons(): void {
    const colors = getColors();
    const layout = TEAM_LAYOUT.OVERLAY.navigation;

    if (this.unitChoices.length <= 1) return;

    // ✅ Позиция кнопок относительно карточки (используем константы)
    const buttonX = layout.buttonX;

    // ========== ЛЕВАЯ СТРЕЛКА ==========
    if (this.selectedIndex > 0) {
      const leftButton = this.scene.add.container(-buttonX, 0);

      const leftBg = this.scene.add.graphics();
      leftBg.fillStyle(0x1a1a2e, TEAM_LAYOUT.COLORS.alpha.high);
      leftBg.fillCircle(0, 0, layout.buttonRadius);
      leftBg.lineStyle(layout.buttonStrokeWidth, colors.uiAccent, 0.9);
      leftBg.strokeCircle(0, 0, layout.buttonRadius);
      
      // ✅ Добавляем свечение
      leftBg.lineStyle(layout.buttonGlowWidth, colors.uiAccent, 0.2);
      leftBg.strokeCircle(0, 0, layout.buttonGlowRadius);
      
      leftButton.add(leftBg);

      const leftArrow = this.scene.add.text(0, 0, '◀', {
        fontSize: `${layout.arrowFontSize}px`,
        color: hexToString(colors.uiAccent),
        fontStyle: 'bold',
      }).setOrigin(0.5);
      leftButton.add(leftArrow);

      leftButton.setInteractive(
        new Phaser.Geom.Circle(0, 0, layout.buttonRadius),
        Phaser.Geom.Circle.Contains
      );
      leftButton.on('pointerdown', () => {
        AudioManager.getInstance().playUIClick();
        hapticSelection();
        this.showUnit(this.selectedIndex - 1);
      });

      // ✅ Добавляем hover эффект
      leftButton.on('pointerover', () => {
        this.scene.tweens.add({
          targets: leftButton,
          scale: layout.hoverScale,
          duration: 150,
          ease: 'Back.easeOut',
        });
      });

      leftButton.on('pointerout', () => {
        this.scene.tweens.add({
          targets: leftButton,
          scale: 1,
          duration: 150,
        });
      });

      this.cardContainer.add(leftButton);
    }

    // ========== ПРАВАЯ СТРЕЛКА ==========
    if (this.selectedIndex < this.unitChoices.length - 1) {
      const rightButton = this.scene.add.container(buttonX, 0);

      const rightBg = this.scene.add.graphics();
      rightBg.fillStyle(0x1a1a2e, TEAM_LAYOUT.COLORS.alpha.high);
      rightBg.fillCircle(0, 0, layout.buttonRadius);
      rightBg.lineStyle(layout.buttonStrokeWidth, colors.uiAccent, 0.9);
      rightBg.strokeCircle(0, 0, layout.buttonRadius);
      
      // ✅ Добавляем свечение
      rightBg.lineStyle(layout.buttonGlowWidth, colors.uiAccent, 0.2);
      rightBg.strokeCircle(0, 0, layout.buttonGlowRadius);
      
      rightButton.add(rightBg);

      const rightArrow = this.scene.add.text(0, 0, '▶', {
        fontSize: `${layout.arrowFontSize}px`,
        color: hexToString(colors.uiAccent),
        fontStyle: 'bold',
      }).setOrigin(0.5);
      rightButton.add(rightArrow);

      rightButton.setInteractive(
        new Phaser.Geom.Circle(0, 0, layout.buttonRadius),
        Phaser.Geom.Circle.Contains
      );
      rightButton.on('pointerdown', () => {
        AudioManager.getInstance().playUIClick();
        hapticSelection();
        this.showUnit(this.selectedIndex + 1);
      });

      // ✅ Добавляем hover эффект
      rightButton.on('pointerover', () => {
        this.scene.tweens.add({
          targets: rightButton,
          scale: layout.hoverScale,
          duration: 150,
          ease: 'Back.easeOut',
        });
      });

      rightButton.on('pointerout', () => {
        this.scene.tweens.add({
          targets: rightButton,
          scale: 1,
          duration: 150,
        });
      });

      this.cardContainer.add(rightButton);
    }
  }

  private createSelectButton(unit: UnitData): void {
    const fonts = getFonts();
    const colors = getColors();
    const faction = FACTIONS[unit.factionId];
    const layout = TEAM_LAYOUT.OVERLAY.selectButton;
    const cardLayout = TEAM_LAYOUT.OVERLAY.card;

    // ✅ Получаем высоту карточки из cardContainer (она уже создана в createUnitCard)
    // Вычисляем высоту карточки на основе видимой зоны
    const { height } = this.scene.cameras.main;
    const safeArea = getSafeArea(this.scene);
    const cardHeight = Math.min(
      safeArea.visibleHeight - cardLayout.heightMargin,
      cardLayout.maxHeight
    );

    // ✅ Позиционируем кнопку относительно нижней части карточки
    // Кнопка должна быть ниже описания и индикатора
    const btnY = cardHeight / 2 + layout.offsetY;
    const btnWidth = layout.width;
    const btnHeight = layout.height;

    const btnContainer = this.scene.add.container(0, btnY);

    // ✅ Цвет кнопки зависит от того, можно ли забрать награду
    const btnColor = this.canClaim ? faction.color : TEAM_LAYOUT.COLORS.state.disabled;
    const btnAlpha = this.canClaim ? TEAM_LAYOUT.COLORS.alpha.medium : TEAM_LAYOUT.COLORS.alpha.low;

    // Фон кнопки с градиентом
    const btnBg = this.scene.add.graphics();
    btnBg.fillStyle(btnColor, btnAlpha);
    btnBg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, layout.borderRadius);

    // Градиент
    for (let i = 0; i < btnHeight / 2; i++) {
      btnBg.fillStyle(
        0xffffff,
        0.15 * (1 - i / (btnHeight / 2)) * (this.canClaim ? 1 : 0.5)
      );
      btnBg.fillRect(-btnWidth / 2, -btnHeight / 2 + i, btnWidth, 1);
    }

    // Обводка
    btnBg.lineStyle(
      layout.borderWidth,
      TEAM_LAYOUT.COLORS.border.accent,
      this.canClaim ? 0.3 : 0.15
    );
    btnBg.strokeRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, layout.borderRadius);

    // Свечение (только если можно забрать)
    if (this.canClaim) {
      btnBg.lineStyle(layout.glowWidth, btnColor, 0.2);
      btnBg.strokeRoundedRect(
        -btnWidth / 2 - layout.glowOffset,
        -btnHeight / 2 - layout.glowOffset,
        btnWidth + layout.glowOffset * 2,
        btnHeight + layout.glowOffset * 2,
        layout.borderRadius + 3
      );
    }

    btnContainer.add(btnBg);

    // ✅ Текст кнопки зависит от состояния
    const btnTextContent = this.canClaim ? 'ВЫБРАТЬ' : 'НЕДОСТУПНО';
    const btnText = this.scene.add.text(0, 0, btnTextContent, {
      fontSize: `${layout.fontSize}px`,
      fontFamily: fonts.tech,
      color: this.canClaim
        ? hexToString(TEAM_LAYOUT.COLORS.text.primary)
        : hexToString(TEAM_LAYOUT.COLORS.text.tertiary),
      fontStyle: 'bold',
      letterSpacing: layout.letterSpacing,
    }).setOrigin(0.5);
    if (this.canClaim) {
      this.applyGlowText(btnText);
    }
    btnContainer.add(btnText);

    // Интерактивность (только если можно забрать)
    const hitArea = this.scene.add.rectangle(0, 0, btnWidth, btnHeight, 0, 0)
      .setInteractive({ useHandCursor: this.canClaim });
    btnContainer.add(hitArea);

    if (this.canClaim) {
      hitArea.on('pointerdown', () => {
        AudioManager.getInstance().playSFX('sfx_cash');
        hapticImpact('medium');
        if (this.onSelect) {
          this.onSelect(unit.id);
        }
        this.close();
      });

      hitArea.on('pointerover', () => {
        this.scene.tweens.add({
          targets: btnContainer,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 150,
        });
      });

      hitArea.on('pointerout', () => {
        this.scene.tweens.add({
          targets: btnContainer,
          scaleX: 1,
          scaleY: 1,
          duration: 150,
        });
      });

      // Пульсация кнопки
      this.scene.tweens.add({
        targets: btnContainer,
        scale: { from: layout.pulseScale.min, to: layout.pulseScale.max },
        duration: layout.pulseDuration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      // ✅ Добавляем иконку замка для неактивной кнопки
      const lockIcon = this.scene.add.text(-btnWidth / 2 + 25, 0, '🔒', {
        fontSize: '18px',
      }).setOrigin(0.5);
      btnContainer.add(lockIcon);
    }

    this.cardContainer.add(btnContainer);
  }

  private setupSwipe(): void {
    if (this.unitChoices.length <= 1) return;

    let startX = 0;

    this.cardContainer.setInteractive(
      new Phaser.Geom.Rectangle(-200, -300, 400, 600),
      Phaser.Geom.Rectangle.Contains
    );

    this.cardContainer.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      startX = pointer.x;
    });

    this.cardContainer.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const deltaX = pointer.x - startX;
      
      if (Math.abs(deltaX) > 50) {
        if (deltaX < 0 && this.selectedIndex < this.unitChoices.length - 1) {
          // Свайп влево -> следующий
          this.showUnit(this.selectedIndex + 1);
        } else if (deltaX > 0 && this.selectedIndex > 0) {
          // Свайп вправо -> предыдущий
          this.showUnit(this.selectedIndex - 1);
        }
      }
    });
  }

  private applyGlowText(text: Phaser.GameObjects.Text): void {
    text.setShadow(0, 0, '#ffffff', 8, false, true);
    text.setStroke('#000000', 4);
  }

  private translateClass(unitClass: string): string {
    const map: Record<string, string> = {
      'balanced': 'Универсал',
      'tank': 'Танк',
      'sniper': 'Снайпер',
      'trickster': 'Ловкач',
    };
    return map[unitClass] || unitClass;
  }

  private getUnitDescription(unit: UnitData): string {
    // Можно добавить кастомные описания для каждого юнита
    const classDesc: Record<string, string> = {
      'balanced': 'Сбалансированный боец для любых позиций.',
      'tank': 'Мощный защитник с высокой защитой.',
      'sniper': 'Точный стрелок с высокой силой удара.',
      'trickster': 'Быстрый и ловкий игрок.',
    };
    return unit.title || classDesc[unit.role] || 'Уникальный юнит с особыми характеристиками.';
  }

  private close(): void {
    // Анимация закрытия
    this.scene.tweens.add({
      targets: this.cardContainer,
      scale: 0,
      alpha: 0,
      duration: 300,
      ease: 'Back.easeIn',
    });

    this.scene.tweens.add({
      targets: this.bg,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        if (this.onClose) {
          this.onClose();
        }
        this.destroy();
      },
    });
  }
}
