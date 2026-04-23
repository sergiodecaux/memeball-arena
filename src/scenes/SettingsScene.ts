// ✅ ИЗМЕНЕНО: Удалена кнопка "Назад", добавлен SwipeNavigationManager, улучшена типографика

import Phaser from 'phaser';
import { getColors, hexToString, getFonts, getGlassStyle, TYPOGRAPHY, applyTextShadow } from '../config/themes';
import { playerData } from '../data/PlayerData';
import { applyScreenScale, DESIGN_WIDTH, DESIGN_HEIGHT } from '../config/gameConfig';
import { AudioManager } from '../managers/AudioManager';
import { i18n, Language } from '../localization/i18n';
import { tgApp } from '../utils/TelegramWebApp';
import { hapticSelection, hapticImpact } from '../utils/Haptics';
import { SWIPE_NAVIGATION } from '../constants/gameConstants';

export class SettingsScene extends Phaser.Scene {
  private screenScaleValue: number = 1.0;
  private scaleText!: Phaser.GameObjects.Text;
  private previewRect!: Phaser.GameObjects.Rectangle;
  private contentContainer!: Phaser.GameObjects.Container;
  
  private topInset = 0;
  private bottomInset = 0;
  private headerHeight = 90;
  private contentTop = 0;
  private visibleAreaBottom = 0;

  // Swipe Navigation
  private swipeStartX: number = 0;
  private swipeStartY: number = 0;
  private swipeStartTime: number = 0;
  private isSwipeActive: boolean = false;
  private swipeIndicator?: Phaser.GameObjects.Graphics;
  private swipeOverlay?: Phaser.GameObjects.Graphics;
  private swipeArrow?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'SettingsScene' });
  }

  create(): void {
    this.topInset = tgApp.getTopInset();
    this.bottomInset = tgApp.getBottomInset();
    this.headerHeight = 90 + this.topInset;

    const { height } = this.cameras.main;
    // ✅ ИЗМЕНЕНО: Убран отступ под кнопку "Назад"
    this.visibleAreaBottom = height - 20 - this.bottomInset;

    console.log('[SettingsScene] Insets - Top:', this.topInset, 'Bottom:', this.bottomInset);

    const data = playerData.get();
    this.screenScaleValue = data.settings.screenScale || 1.0;
    this.isSwipeActive = false;

    this.createBackground();
    this.createHeader();
    this.createScrollableContent();
    // ✅ УДАЛЕНО: this.createBottomBackButton();
    this.createSwipeIndicator();
    this.setupSwipeNavigation();
  }

  // ========== SWIPE NAVIGATION ==========

  private createSwipeIndicator(): void {
    const { height } = this.cameras.main;
    const colors = getColors();

    // Индикатор у левого края
    this.swipeIndicator = this.add.graphics();
    this.swipeIndicator.setDepth(50);

    // Вертикальная полоска
    this.swipeIndicator.fillStyle(
      SWIPE_NAVIGATION.INDICATOR_COLOR,
      SWIPE_NAVIGATION.INDICATOR_ALPHA_IDLE
    );
    this.swipeIndicator.fillRoundedRect(
      0,
      this.headerHeight + 20,
      SWIPE_NAVIGATION.INDICATOR_WIDTH,
      height - this.headerHeight - 60 - this.bottomInset,
      2
    );

    // Пульсация
    this.tweens.add({
      targets: this.swipeIndicator,
      alpha: { from: 0.3, to: 0.6 },
      duration: SWIPE_NAVIGATION.PULSE_SPEED,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Overlay для эффекта свайпа (изначально скрыт)
    this.swipeOverlay = this.add.graphics();
    this.swipeOverlay.setDepth(200);
    this.swipeOverlay.setVisible(false);

    // Контейнер для стрелки "назад"
    this.swipeArrow = this.add.container(40, height / 2);
    this.swipeArrow.setDepth(201);
    this.swipeArrow.setVisible(false);
    this.swipeArrow.setAlpha(0);

    const arrowBg = this.add.graphics();
    arrowBg.fillStyle(0x000000, 0.7);
    arrowBg.fillCircle(0, 0, 28);
    arrowBg.lineStyle(2, colors.uiAccent, 0.8);
    arrowBg.strokeCircle(0, 0, 28);
    this.swipeArrow.add(arrowBg);

    const arrowText = this.add.text(0, 0, '◀', {
      fontSize: `${SWIPE_NAVIGATION.ARROW_SIZE}px`,
      color: hexToString(colors.uiAccent),
    }).setOrigin(0.5);
    this.swipeArrow.add(arrowText);
  }

  private setupSwipeNavigation(): void {
    const { width, height } = this.cameras.main;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Проверяем, что касание в зоне левого края
      if (pointer.x <= SWIPE_NAVIGATION.EDGE_ZONE_WIDTH) {
        this.swipeStartX = pointer.x;
        this.swipeStartY = pointer.y;
        this.swipeStartTime = Date.now();
        this.isSwipeActive = true;

        // Подсветка индикатора
        if (this.swipeIndicator) {
          this.swipeIndicator.clear();
          this.swipeIndicator.fillStyle(
            SWIPE_NAVIGATION.INDICATOR_COLOR,
            SWIPE_NAVIGATION.INDICATOR_ALPHA_ACTIVE
          );
          this.swipeIndicator.fillRoundedRect(
            0,
            this.headerHeight + 20,
            SWIPE_NAVIGATION.INDICATOR_WIDTH + 2,
            height - this.headerHeight - 60 - this.bottomInset,
            2
          );
        }

        hapticSelection();
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isSwipeActive) return;

      const deltaX = pointer.x - this.swipeStartX;
      const deltaY = Math.abs(pointer.y - this.swipeStartY);

      // Проверяем вертикальный дрифт
      if (deltaY > SWIPE_NAVIGATION.MAX_VERTICAL_DRIFT) {
        this.cancelSwipe();
        return;
      }

      if (deltaX > 10) {
        // Показываем прогресс свайпа
        const progress = Math.min(deltaX / (width * SWIPE_NAVIGATION.THRESHOLD_PERCENT), 1);
        this.showSwipeProgress(progress, deltaX);
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.isSwipeActive) return;

      const deltaX = pointer.x - this.swipeStartX;
      const deltaTime = Date.now() - this.swipeStartTime;
      const velocity = deltaX / (deltaTime / 1000);

      const thresholdDistance = width * SWIPE_NAVIGATION.THRESHOLD_PERCENT;

      // Проверяем условия срабатывания
      if (deltaX >= thresholdDistance || velocity >= SWIPE_NAVIGATION.VELOCITY_THRESHOLD) {
        this.completeSwipe();
      } else {
        this.cancelSwipe();
      }
    });
  }

  private showSwipeProgress(progress: number, deltaX: number): void {
    const { width, height } = this.cameras.main;

    // Overlay с градиентом
    if (this.swipeOverlay) {
      this.swipeOverlay.setVisible(true);
      this.swipeOverlay.clear();

      const alpha = progress * SWIPE_NAVIGATION.DIMMING_MAX;
      
      // Градиентное затемнение слева
      for (let i = 0; i < 20; i++) {
        const segmentAlpha = alpha * (1 - i / 20);
        this.swipeOverlay.fillStyle(0x000000, segmentAlpha);
        this.swipeOverlay.fillRect(
          (deltaX / 20) * i,
          0,
          deltaX / 20 + 1,
          height
        );
      }
    }

    // Стрелка
    if (this.swipeArrow) {
      this.swipeArrow.setVisible(true);
      this.swipeArrow.setAlpha(progress);
      this.swipeArrow.x = 40 + deltaX * 0.3;
    }
  }

  private completeSwipe(): void {
    hapticImpact('medium');
    AudioManager.getInstance().playUISwoosh();

    const { width } = this.cameras.main;

    // Сохраняем настройки перед выходом
    this.saveSettings();

    // Анимация завершения
    this.tweens.add({
      targets: this.swipeOverlay,
      alpha: 1,
      duration: SWIPE_NAVIGATION.ANIMATION_DURATION,
      ease: 'Quad.easeOut',
    });

    if (this.swipeArrow) {
      this.tweens.add({
        targets: this.swipeArrow,
        x: width / 2,
        alpha: 0,
        duration: SWIPE_NAVIGATION.ANIMATION_DURATION,
        ease: 'Quad.easeOut',
      });
    }

    // Переход в главное меню
    this.time.delayedCall(SWIPE_NAVIGATION.ANIMATION_DURATION, () => {
      this.scene.start('MainMenuScene');
    });
  }

  private cancelSwipe(): void {
    this.isSwipeActive = false;
    const { height } = this.cameras.main;

    // Возврат индикатора
    if (this.swipeIndicator) {
      this.swipeIndicator.clear();
      this.swipeIndicator.fillStyle(
        SWIPE_NAVIGATION.INDICATOR_COLOR,
        SWIPE_NAVIGATION.INDICATOR_ALPHA_IDLE
      );
      this.swipeIndicator.fillRoundedRect(
        0,
        this.headerHeight + 20,
        SWIPE_NAVIGATION.INDICATOR_WIDTH,
        height - this.headerHeight - 60 - this.bottomInset,
        2
      );
    }

    // Скрытие overlay с анимацией
    if (this.swipeOverlay) {
      this.tweens.add({
        targets: this.swipeOverlay,
        alpha: 0,
        duration: 150,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.swipeOverlay?.setVisible(false);
        },
      });
    }

    // Скрытие стрелки
    if (this.swipeArrow) {
      this.tweens.add({
        targets: this.swipeArrow,
        x: 40,
        alpha: 0,
        duration: 150,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.swipeArrow?.setVisible(false);
        },
      });
    }
  }

  // ========== BACKGROUND ==========

  private createBackground(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();

    const bg = this.add.graphics();
    bg.fillStyle(colors.background, 1);
    bg.fillRect(0, 0, width, height);
    
    this.drawRadialGradient(bg, width / 2, 0, height * 0.5, colors.backgroundGradientTop, 0.4);

    bg.lineStyle(1, colors.uiPrimary, 0.03);
    for (let x = 0; x < width; x += 40) bg.lineBetween(x, 0, x, height);
    for (let y = 0; y < height; y += 40) bg.lineBetween(0, y, width, y);
  }

  private drawRadialGradient(g: Phaser.GameObjects.Graphics, cx: number, cy: number, maxR: number, color: number, maxAlpha: number): void {
    const steps = 40;
    for (let i = steps; i > 0; i--) {
      const ratio = i / steps;
      const r = maxR * ratio;
      const alpha = maxAlpha * Math.pow(1 - ratio, 2);
      g.fillStyle(color, alpha);
      g.fillCircle(cx, cy, r);
    }
  }

  private createHeader(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();

    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x000000, 0.8);
    headerBg.fillRect(0, 0, width, this.headerHeight);
    headerBg.lineStyle(2, colors.uiAccent, 0.3);
    headerBg.lineBetween(0, this.headerHeight, width, this.headerHeight);
    headerBg.setDepth(100);

    // ✅ УЛУЧШЕНО: Типографика для заголовка
    const title = this.add.text(width / 2, 40 + this.topInset, `⚙️ ${i18n.t('settings').toUpperCase()}`, {
      fontSize: `${TYPOGRAPHY.sizes.xl}px`,
      fontFamily: fonts.tech,
      color: '#ffffff',
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(101);
    applyTextShadow(title, 'medium');
  }

  // ✅ УДАЛЕНО: createBottomBackButton() - полностью удалён

  private createScrollableContent(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const data = playerData.get();

    this.contentTop = this.headerHeight;
    // ✅ ИЗМЕНЕНО: Убран bottomBarHeight
    const visibleHeight = height - this.headerHeight - 20 - this.bottomInset;

    const maskShape = this.make.graphics({});
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, this.headerHeight, width, visibleHeight);
    const mask = maskShape.createGeometryMask();

    this.contentContainer = this.add.container(0, this.headerHeight);
    this.contentContainer.setMask(mask);

    let y = 15;

    y = this.createSectionHeader(y, '🌍', i18n.t('language'));
    y = this.createLanguageSelector(y);
    y += 20;

    y = this.createSectionHeader(y, '🔊', 'AUDIO');
    
    y = this.createToggle(y, '🔊', i18n.t('sound'), data.settings.soundEnabled, (val) => {
      data.settings.soundEnabled = val;
      AudioManager.getInstance().setSoundEnabled(val);
      playerData.save();
    });

    y = this.createToggle(y, '🎵', i18n.t('music'), data.settings.musicEnabled, (val) => {
      data.settings.musicEnabled = val;
      AudioManager.getInstance().setMusicEnabled(val);
      playerData.save();
    });

    y = this.createToggle(y, '📳', i18n.t('vibration'), data.settings.vibrationEnabled, (val) => {
      data.settings.vibrationEnabled = val;
      if (val) {
        try {
          // Используем Vibration API для Game режима
          if (navigator.vibrate) {
            navigator.vibrate([10, 50, 10]);
          }
        } catch (e) {}
      }
      playerData.save();
    });

    y += 20;

    y = this.createSectionHeader(y, '📐', 'DISPLAY');
    this.createScreenScaleSlider(y);
    y += 20;

    y = this.createSectionHeader(y, '🔄', 'DATA');
    y = this.createResetProgressButton(y);
  }

  private createSectionHeader(y: number, icon: string, title: string): number {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();

    // ✅ УЛУЧШЕНО: Типографика
    this.contentContainer.add(this.add.text(25, y, `${icon} ${title}`, {
      fontSize: `${TYPOGRAPHY.sizes.md}px`,
      fontFamily: fonts.tech,
      color: hexToString(colors.uiAccent),
      letterSpacing: 1,
    }));

    const line = this.add.graphics();
    line.lineStyle(1, colors.uiAccent, 0.2);
    line.lineBetween(25, y + 22, width - 25, y + 22);
    this.contentContainer.add(line);

    return y + 35;
  }

  private createLanguageSelector(y: number): number {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const currentLang = i18n.getLanguage();
    const languages = i18n.getAvailableLanguages();

    const containerWidth = width - 50;
    const btnWidth = (containerWidth - 15) / 2;
    const btnHeight = 50;

    languages.forEach((lang, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const btnX = 25 + col * (btnWidth + 15);
      const btnY = y + row * (btnHeight + 10);

      const isSelected = lang === currentLang;
      const flag = i18n.getLanguageFlag(lang);
      const name = i18n.getLanguageName(lang);

      const btn = this.add.container(btnX, btnY);

      const bg = this.add.graphics();
      const drawBg = (hover: boolean) => {
        bg.clear();
        if (isSelected) {
          bg.fillStyle(colors.uiAccent, 0.2);
          bg.fillRoundedRect(0, 0, btnWidth, btnHeight, 12);
          bg.lineStyle(2, colors.uiAccent, 0.8);
        } else {
          bg.fillStyle(0x1a1a2e, hover ? 0.8 : 0.5);
          bg.fillRoundedRect(0, 0, btnWidth, btnHeight, 12);
          bg.lineStyle(1.5, hover ? colors.uiPrimary : colors.glassBorder, hover ? 0.6 : 0.2);
        }
        bg.strokeRoundedRect(0, 0, btnWidth, btnHeight, 12);
      };
      drawBg(false);
      btn.add(bg);

      // ✅ УЛУЧШЕНО: Типографика
      btn.add(this.add.text(20, btnHeight / 2, flag, { fontSize: `${TYPOGRAPHY.sizes.xxl}px` }).setOrigin(0, 0.5));
      btn.add(this.add.text(55, btnHeight / 2, name, {
        fontSize: `${TYPOGRAPHY.sizes.md}px`,
        fontFamily: fonts.tech,
        color: isSelected ? hexToString(colors.uiAccent) : '#ffffff',
      }).setOrigin(0, 0.5));

      if (isSelected) {
        btn.add(this.add.text(btnWidth - 20, btnHeight / 2, '✓', {
          fontSize: `${TYPOGRAPHY.sizes.lg}px`,
          color: hexToString(colors.uiAccent),
        }).setOrigin(0.5));
      }

      if (!isSelected) {
        const hitArea = this.add.rectangle(btnWidth / 2, btnHeight / 2, btnWidth, btnHeight, 0x000000, 0)
          .setInteractive({ useHandCursor: true });
        btn.add(hitArea);

        hitArea.on('pointerover', () => drawBg(true));
        hitArea.on('pointerout', () => drawBg(false));
        hitArea.on('pointerdown', () => {
          AudioManager.getInstance().playSFX('sfx_click');
          hapticSelection();
          this.changeLanguage(lang);
        });
      }
      
      this.contentContainer.add(btn);
    });

    const rows = Math.ceil(languages.length / 2);
    return y + rows * (btnHeight + 10);
  }

  private changeLanguage(lang: Language): void {
    i18n.setLanguage(lang);
    const data = playerData.get();
    data.settings.language = lang;
    playerData.save();
    this.scene.restart();
  }

  private createToggle(y: number, icon: string, label: string, initialValue: boolean, onChange: (val: boolean) => void): number {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();

    const rowHeight = 55;
    const rowY = y;

    // ✅ УЛУЧШЕНО: Многослойные тени для карточки
    const rowBg = this.add.graphics();
    rowBg.fillStyle(0x000000, 0.15);
    rowBg.fillRoundedRect(27, rowY + 2, width - 50, rowHeight, 12);
    rowBg.fillStyle(0x1a1a2e, 0.4);
    rowBg.fillRoundedRect(25, rowY, width - 50, rowHeight, 12);
    rowBg.lineStyle(1, colors.glassBorder, 0.1);
    rowBg.strokeRoundedRect(25, rowY, width - 50, rowHeight, 12);
    this.contentContainer.add(rowBg);

    // ✅ УЛУЧШЕНО: Типографика
    this.contentContainer.add(this.add.text(45, rowY + rowHeight / 2, `${icon} ${label}`, {
      fontSize: `${TYPOGRAPHY.sizes.md}px`,
      fontFamily: fonts.tech,
      color: '#ffffff',
    }).setOrigin(0, 0.5));

    const toggleWidth = 56;
    const toggleHeight = 28;
    const toggleX = width - 55;
    const toggleY = rowY + rowHeight / 2;

    let isOn = initialValue;

    const toggleBg = this.add.graphics();
    const toggleCircle = this.add.circle(0, 0, 10, 0xffffff);

    const drawToggle = () => {
      toggleBg.clear();
      toggleBg.fillStyle(isOn ? colors.uiAccent : 0x374151, 1);
      toggleBg.fillRoundedRect(toggleX - toggleWidth / 2, toggleY - toggleHeight / 2, toggleWidth, toggleHeight, 14);
      
      if (isOn) {
        toggleBg.lineStyle(2, colors.uiAccent, 0.5);
        toggleBg.strokeRoundedRect(toggleX - toggleWidth / 2, toggleY - toggleHeight / 2, toggleWidth, toggleHeight, 14);
      }

      toggleCircle.setPosition(
        isOn ? toggleX + toggleWidth / 2 - 14 : toggleX - toggleWidth / 2 + 14,
        toggleY
      );
    };

    drawToggle();
    
    this.contentContainer.add(toggleBg);
    this.contentContainer.add(toggleCircle);

    const hitArea = this.add.rectangle(toggleX, toggleY, toggleWidth + 20, toggleHeight + 20, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });

    hitArea.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click');
      hapticSelection();
      isOn = !isOn;
      
      this.tweens.add({
        targets: toggleCircle,
        x: isOn ? toggleX + toggleWidth / 2 - 14 : toggleX - toggleWidth / 2 + 14,
        duration: 150,
        ease: 'Power2',
      });
      
      drawToggle();
      onChange(isOn);
    });
    
    this.contentContainer.add(hitArea);

    return y + rowHeight + 8;
  }

  private createScreenScaleSlider(y: number): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();

    // ✅ УЛУЧШЕНО: Типографика
    this.contentContainer.add(this.add.text(width / 2, y + 5, 'Adjust to remove black bars', {
      fontSize: `${TYPOGRAPHY.sizes.xs}px`,
      color: hexToString(colors.uiTextSecondary),
    }).setOrigin(0.5));

    y += 35;

    // ✅ УЛУЧШЕНО: Многослойные тени
    const sliderBg = this.add.graphics();
    sliderBg.fillStyle(0x000000, 0.15);
    sliderBg.fillRoundedRect(27, y - 13, width - 50, 70, 12);
    sliderBg.fillStyle(0x1a1a2e, 0.5);
    sliderBg.fillRoundedRect(25, y - 15, width - 50, 70, 12);
    sliderBg.lineStyle(1, colors.glassBorder, 0.1);
    sliderBg.strokeRoundedRect(25, y - 15, width - 50, 70, 12);
    this.contentContainer.add(sliderBg);

    const sliderWidth = width - 130;
    const sliderX = 65;
    const sliderY = y + 15;

    const sliderTrack = this.add.graphics();
    sliderTrack.fillStyle(0x2a2a3e, 1);
    sliderTrack.fillRoundedRect(sliderX, sliderY - 4, sliderWidth, 8, 4);
    this.contentContainer.add(sliderTrack);

    const sliderFill = this.add.graphics();
    this.contentContainer.add(sliderFill);

    const handle = this.add.circle(0, sliderY, 14, colors.uiAccent);
    handle.setStrokeStyle(3, 0xffffff);
    this.contentContainer.add(handle);

    this.scaleText = this.add.text(width / 2, sliderY + 30, '', {
      fontSize: `${TYPOGRAPHY.sizes.md}px`,
      fontFamily: fonts.tech,
      color: '#ffffff',
    }).setOrigin(0.5);
    this.contentContainer.add(this.scaleText);

    this.createScaleButton(sliderX - 25, sliderY, '-', () => {
      this.screenScaleValue = Math.max(0.8, this.screenScaleValue - 0.05);
      updateSlider();
      this.applyScale();
    });

    this.createScaleButton(sliderX + sliderWidth + 25, sliderY, '+', () => {
      this.screenScaleValue = Math.min(1.3, this.screenScaleValue + 0.05);
      updateSlider();
      this.applyScale();
    });

    const updateSlider = () => {
      const minScale = 0.8;
      const maxScale = 1.3;
      const percent = (this.screenScaleValue - minScale) / (maxScale - minScale);
      const handleX = sliderX + percent * sliderWidth;

      handle.setPosition(handleX, sliderY);

      sliderFill.clear();
      sliderFill.fillStyle(colors.uiAccent, 1);
      sliderFill.fillRoundedRect(sliderX, sliderY - 4, Math.max(handleX - sliderX, 4), 8, 4);

      this.scaleText.setText(`${Math.round(this.screenScaleValue * 100)}%`);
    };

    const sliderHitArea = this.add.rectangle(sliderX + sliderWidth / 2, sliderY, sliderWidth, 40, 0x000000, 0);
    sliderHitArea.setInteractive({ useHandCursor: true, draggable: true });

    sliderHitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.updateScaleFromPointer(pointer.x, sliderX, sliderWidth);
      updateSlider();
      this.applyScale();
    });

    sliderHitArea.on('drag', (pointer: Phaser.Input.Pointer, dragX: number) => {
      this.updateScaleFromPointer(dragX, sliderX, sliderWidth);
      updateSlider();
      this.applyScale();
    });
    
    this.contentContainer.add(sliderHitArea);

    updateSlider();

    y += 85;
    this.createPreview(y);

    y += 140;
    this.createResetButton(y, updateSlider);
  }

  private createScaleButton(x: number, y: number, text: string, onClick: () => void): void {
    const colors = getColors();
    const fonts = getFonts();
    
    const btn = this.add.container(x, y);

    const bg = this.add.graphics();
    const drawBg = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(hover ? colors.uiAccent : 0x2a2a3e, hover ? 0.3 : 1);
      bg.fillCircle(0, 0, 18);
      bg.lineStyle(2, colors.uiAccent, hover ? 0.8 : 0.4);
      bg.strokeCircle(0, 0, 18);
    };
    drawBg(false);
    btn.add(bg);

    // ✅ УЛУЧШЕНО: Типографика
    btn.add(this.add.text(0, -1, text, {
      fontSize: `${TYPOGRAPHY.sizes.xl}px`,
      fontFamily: fonts.tech,
      color: '#ffffff',
    }).setOrigin(0.5));

    btn.setInteractive(new Phaser.Geom.Circle(0, 0, 18), Phaser.Geom.Circle.Contains);
    btn.on('pointerover', () => drawBg(true));
    btn.on('pointerout', () => drawBg(false));
    btn.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click');
      hapticSelection();
      onClick();
    });
    
    this.contentContainer.add(btn);
  }

  private updateScaleFromPointer(x: number, sliderX: number, sliderWidth: number): void {
    const minScale = 0.8;
    const maxScale = 1.3;

    let percent = (x - sliderX) / sliderWidth;
    percent = Phaser.Math.Clamp(percent, 0, 1);

    this.screenScaleValue = minScale + percent * (maxScale - minScale);
    this.screenScaleValue = Math.round(this.screenScaleValue * 20) / 20;
  }

  private createPreview(y: number): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();

    // ✅ УЛУЧШЕНО: Типографика
    this.contentContainer.add(this.add.text(width / 2, y, 'Preview:', {
      fontSize: `${TYPOGRAPHY.sizes.sm}px`,
      fontFamily: fonts.tech,
      color: hexToString(colors.uiTextSecondary),
    }).setOrigin(0.5));

    y += 20;

    const previewWidth = 70;
    const previewHeight = 120;

    const frame = this.add.graphics();
    frame.lineStyle(2, 0x4a4a5a);
    frame.strokeRoundedRect(width / 2 - previewWidth / 2, y, previewWidth, previewHeight, 8);
    this.contentContainer.add(frame);

    this.previewRect = this.add.rectangle(
      width / 2,
      y + previewHeight / 2,
      previewWidth * 0.85,
      previewHeight * 0.85,
      colors.uiAccent,
      0.25
    );
    this.previewRect.setStrokeStyle(2, colors.uiAccent);
    this.contentContainer.add(this.previewRect);

    this.updatePreview();
  }

  private updatePreview(): void {
    if (!this.previewRect) return;

    const baseWidth = 60;
    const baseHeight = 102;

    const newWidth = baseWidth * this.screenScaleValue;
    const newHeight = baseHeight * this.screenScaleValue;

    this.previewRect.setSize(
      Math.min(newWidth, 68),
      Math.min(newHeight, 118)
    );
  }

  private createResetButton(y: number, updateSlider: () => void): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();

    const btn = this.add.container(width / 2, y);

    const bg = this.add.graphics();
    const drawBg = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(hover ? 0x4b5563 : 0x374151, 1);
      bg.fillRoundedRect(-75, -22, 150, 44, 12);
      bg.lineStyle(1.5, hover ? 0x9ca3af : 0x6b7280, 0.8);
      bg.strokeRoundedRect(-75, -22, 150, 44, 12);
    };
    drawBg(false);
    btn.add(bg);

    // ✅ УЛУЧШЕНО: Типографика
    btn.add(this.add.text(0, 0, '↺ Reset to 100%', {
      fontSize: `${TYPOGRAPHY.sizes.sm}px`,
      fontFamily: fonts.tech,
      color: '#ffffff',
    }).setOrigin(0.5));

    btn.setInteractive(new Phaser.Geom.Rectangle(-75, -22, 150, 44), Phaser.Geom.Rectangle.Contains);

    btn.on('pointerover', () => drawBg(true));
    btn.on('pointerout', () => drawBg(false));
    btn.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click');
      hapticSelection();
      this.screenScaleValue = 1.0;
      updateSlider();
      this.applyScale();
      this.updatePreview();
    });
    
    this.contentContainer.add(btn);
  }

  private applyScale(): void {
    applyScreenScale(this.game, this.screenScaleValue);
    this.updatePreview();
  }

  private saveSettings(): void {
    const data = playerData.get();
    data.settings.screenScale = this.screenScaleValue;
    playerData.save();
  }

  private createResetProgressButton(y: number): number {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();

    const btn = this.add.container(width / 2, y + 30);

    const bg = this.add.graphics();
    const drawBg = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(hover ? 0xdc2626 : 0x7f1d1d, 1);
      bg.fillRoundedRect(-width / 2 + 25, -25, width - 50, 50, 12);
      bg.lineStyle(2, hover ? 0xff4444 : 0x991b1b, 0.8);
      bg.strokeRoundedRect(-width / 2 + 25, -25, width - 50, 50, 12);
    };
    drawBg(false);
    btn.add(bg);

    // ✅ УЛУЧШЕНО: Типографика
    btn.add(this.add.text(0, 0, '🔄 СБРОС ПРОГРЕССА', {
      fontSize: `${TYPOGRAPHY.sizes.md}px`,
      fontFamily: fonts.tech,
      color: '#ffffff',
      letterSpacing: 1,
    }).setOrigin(0.5));

    btn.setInteractive(new Phaser.Geom.Rectangle(-width / 2 + 25, -25, width - 50, 50), Phaser.Geom.Rectangle.Contains);

    btn.on('pointerover', () => drawBg(true));
    btn.on('pointerout', () => drawBg(false));
    btn.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click');
      hapticImpact('heavy');
      
      // Подтверждение
      if (confirm('Вы уверены? Это удалит весь прогресс и перезагрузит игру.')) {
        localStorage.clear();
        window.location.reload();
      }
    });
    
    this.contentContainer.add(btn);

    return y + 80;
  }
}