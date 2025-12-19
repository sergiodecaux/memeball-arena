// src/scenes/SettingsScene.ts

import Phaser from 'phaser';
import { getColors, hexToString } from '../config/themes';
import { playerData } from '../data/PlayerData';
import { applyScreenScale, DESIGN_WIDTH, DESIGN_HEIGHT } from '../config/gameConfig';
import { AudioManager } from '../managers/AudioManager';
import { i18n, Language } from '../localization/i18n';

export class SettingsScene extends Phaser.Scene {
  private screenScaleValue: number = 1.0;
  private scaleText!: Phaser.GameObjects.Text;
  private previewRect!: Phaser.GameObjects.Rectangle;
  private contentContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'SettingsScene' });
  }

  create(): void {
    const data = playerData.get();
    this.screenScaleValue = data.settings.screenScale || 1.0;

    this.createBackground();
    this.createHeader();
    this.createScrollableContent();
  }

  private createBackground(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();

    const bg = this.add.graphics();
    bg.fillStyle(0x05050a, 1);
    bg.fillRect(0, 0, width, height);

    for (let i = 0; i < 150; i++) {
      const alpha = 0.1 * (1 - i / 150);
      bg.fillStyle(colors.uiAccent, alpha);
      bg.fillRect(0, i, width, 1);
    }

    const grid = this.add.graphics();
    grid.lineStyle(1, colors.uiAccent, 0.03);
    for (let x = 0; x < width; x += 30) {
      grid.moveTo(x, 0);
      grid.lineTo(x, height);
    }
    for (let y = 0; y < height; y += 30) {
      grid.moveTo(0, y);
      grid.lineTo(width, y);
    }
    grid.strokePath();
  }

  private createHeader(): void {
    const { width } = this.cameras.main;
    const colors = getColors();

    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x000000, 0.8);
    headerBg.fillRect(0, 0, width, 60);
    headerBg.lineStyle(2, colors.uiAccent, 0.3);
    headerBg.lineBetween(0, 60, width, 60);
    headerBg.setDepth(100);

    // Кнопка назад
    const backBtn = this.add.container(50, 30).setDepth(101);
    const backBg = this.add.graphics();
    backBg.fillStyle(0x000000, 0.5);
    backBg.fillRoundedRect(-35, -15, 70, 30, 8);
    backBg.lineStyle(1.5, colors.uiAccent, 0.5);
    backBg.strokeRoundedRect(-35, -15, 70, 30, 8);
    backBtn.add(backBg);
    backBtn.add(this.add.text(0, 0, `← ${i18n.t('back')}`, {
      fontSize: '14px',
      color: hexToString(colors.uiAccent),
      fontStyle: 'bold',
    }).setOrigin(0.5));

    backBtn.setInteractive(new Phaser.Geom.Rectangle(-35, -15, 70, 30), Phaser.Geom.Rectangle.Contains);
    backBtn.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click');
      this.saveSettings();
      this.scene.start('MainMenuScene');
    });

    // Заголовок
    this.add.text(width / 2, 30, `⚙️ ${i18n.t('settings').toUpperCase()}`, {
      fontSize: '22px',
      fontFamily: 'Arial Black',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(101);
  }

  private createScrollableContent(): void {
    const { width, height } = this.cameras.main;
    const data = playerData.get();

    // Контейнер для скролла
    this.contentContainer = this.add.container(0, 0);

    let y = 85;
    const rowHeight = 65;

    // ===== LANGUAGE =====
    y = this.createLanguageSelector(y);

    y += 15;

    // ===== SOUND =====
    y = this.createToggle(y, `🔊 ${i18n.t('sound')}`, data.settings.soundEnabled, (val) => {
      data.settings.soundEnabled = val;
      AudioManager.getInstance().setSoundEnabled(val);
      playerData.save();
    });

    // ===== MUSIC =====
    y = this.createToggle(y, `🎵 ${i18n.t('music')}`, data.settings.musicEnabled, (val) => {
      data.settings.musicEnabled = val;
      AudioManager.getInstance().setMusicEnabled(val);
      playerData.save();
    });

    // ===== VIBRATION =====
    y = this.createToggle(y, `📳 ${i18n.t('vibration')}`, data.settings.vibrationEnabled, (val) => {
      data.settings.vibrationEnabled = val;
      if (val) {
        try {
          window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
        } catch (e) {}
      }
      playerData.save();
    });

    // ===== SCREEN SCALE =====
    y += 15;
    this.createScreenScaleSlider(y);
  }

  // ==================== LANGUAGE SELECTOR ====================

  private createLanguageSelector(y: number): number {
    const { width } = this.cameras.main;
    const colors = getColors();
    const currentLang = i18n.getLanguage();

    // Заголовок секции
    this.add.text(30, y + 5, `🌍 ${i18n.t('language')}`, {
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0, 0.5);

    // Контейнер для кнопок языков
    const btnContainer = this.add.container(width - 30, y + 5);

    const languages = i18n.getAvailableLanguages();
    const btnWidth = 55;
    const btnHeight = 36;
    const gap = 8;
    const totalWidth = languages.length * btnWidth + (languages.length - 1) * gap;

    languages.forEach((lang, i) => {
      const btnX = -totalWidth + i * (btnWidth + gap) + btnWidth / 2;
      const isSelected = lang === currentLang;

      const btn = this.add.container(btnX, 0);

      const bg = this.add.graphics();
      const drawBg = (hover: boolean) => {
        bg.clear();
        
        if (isSelected) {
          bg.fillStyle(colors.uiAccent, 0.3);
          bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 8);
          bg.lineStyle(2, colors.uiAccent, 1);
        } else {
          bg.fillStyle(0x1a1a2e, hover ? 0.8 : 0.6);
          bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 8);
          bg.lineStyle(1.5, hover ? 0x4a4a5a : 0x3a3a4a, 1);
        }
        bg.strokeRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 8);
      };
      drawBg(false);
      btn.add(bg);

      // Флаг
      btn.add(this.add.text(0, 0, i18n.getLanguageFlag(lang), {
        fontSize: '20px',
      }).setOrigin(0.5));

      // Интерактивность
      const hitArea = this.add.rectangle(0, 0, btnWidth, btnHeight, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      btn.add(hitArea);

      hitArea.on('pointerover', () => { if (!isSelected) drawBg(true); });
      hitArea.on('pointerout', () => { if (!isSelected) drawBg(false); });
      hitArea.on('pointerdown', () => {
        if (!isSelected) {
          AudioManager.getInstance().playSFX('sfx_click');
          this.changeLanguage(lang);
        }
      });

      btnContainer.add(btn);
    });

    return y + 60;
  }

  private changeLanguage(lang: Language): void {
    i18n.setLanguage(lang);
    
    // Синхронизируем с PlayerData
    const data = playerData.get();
    data.settings.language = lang;
    playerData.save();

    // Перезапускаем сцену для применения изменений
    this.scene.restart();
  }

  // ==================== TOGGLES ====================

  private createToggle(y: number, label: string, initialValue: boolean, onChange: (val: boolean) => void): number {
    const { width } = this.cameras.main;
    const colors = getColors();

    // Лейбл
    this.add.text(30, y + 25, label, {
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0, 0.5);

    // Переключатель
    const toggleWidth = 60;
    const toggleHeight = 30;
    const toggleX = width - 50;

    let isOn = initialValue;

    const toggleBg = this.add.graphics();
    const toggleCircle = this.add.circle(0, 0, 11, 0xffffff);

    const drawToggle = () => {
      toggleBg.clear();
      toggleBg.fillStyle(isOn ? colors.uiAccent : 0x374151, 1);
      toggleBg.fillRoundedRect(toggleX - toggleWidth / 2, y + 25 - toggleHeight / 2, toggleWidth, toggleHeight, 15);

      toggleCircle.setPosition(
        isOn ? toggleX + toggleWidth / 2 - 15 : toggleX - toggleWidth / 2 + 15,
        y + 25
      );
    };

    drawToggle();

    const hitArea = this.add.rectangle(toggleX, y + 25, toggleWidth + 20, toggleHeight + 20, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });

    hitArea.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click');
      isOn = !isOn;
      drawToggle();
      onChange(isOn);
    });

    return y + 65;
  }

  // ==================== SCREEN SCALE SLIDER ====================

  private createScreenScaleSlider(y: number): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();

    // Заголовок секции
    this.add.text(width / 2, y, '📐 Screen Scale', {
      fontSize: '20px',
      fontFamily: 'Arial Black',
      color: '#ffffff',
    }).setOrigin(0.5);

    y += 35;

    // Описание
    this.add.text(width / 2, y, 'Adjust to remove black bars', {
      fontSize: '12px',
      color: '#888888',
    }).setOrigin(0.5);

    y += 30;

    // Слайдер
    const sliderWidth = width - 100;
    const sliderX = 50;
    const sliderY = y;

    // Фон слайдера
    const sliderBg = this.add.graphics();
    sliderBg.fillStyle(0x1a1a2e, 1);
    sliderBg.fillRoundedRect(sliderX, sliderY, sliderWidth, 10, 5);
    sliderBg.lineStyle(1, colors.uiAccent, 0.3);
    sliderBg.strokeRoundedRect(sliderX, sliderY, sliderWidth, 10, 5);

    // Заполнение слайдера
    const sliderFill = this.add.graphics();

    // Ручка слайдера
    const handle = this.add.circle(0, sliderY + 5, 15, colors.uiAccent);
    handle.setStrokeStyle(3, 0xffffff);

    // Текст значения
    this.scaleText = this.add.text(width / 2, sliderY + 40, '', {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Кнопки -/+
    const minusBtn = this.createScaleButton(sliderX - 30, sliderY + 5, '-', () => {
      this.screenScaleValue = Math.max(0.8, this.screenScaleValue - 0.05);
      updateSlider();
      this.applyScale();
    });

    const plusBtn = this.createScaleButton(sliderX + sliderWidth + 30, sliderY + 5, '+', () => {
      this.screenScaleValue = Math.min(1.3, this.screenScaleValue + 0.05);
      updateSlider();
      this.applyScale();
    });

    // Обновление слайдера
    const updateSlider = () => {
      const minScale = 0.8;
      const maxScale = 1.3;
      const percent = (this.screenScaleValue - minScale) / (maxScale - minScale);
      const handleX = sliderX + percent * sliderWidth;

      handle.setPosition(handleX, sliderY + 5);

      sliderFill.clear();
      sliderFill.fillStyle(colors.uiAccent, 1);
      sliderFill.fillRoundedRect(sliderX, sliderY, handleX - sliderX, 10, 5);

      this.scaleText.setText(`${Math.round(this.screenScaleValue * 100)}%`);
    };

    // Интерактивность слайдера
    const sliderHitArea = this.add.rectangle(sliderX + sliderWidth / 2, sliderY + 5, sliderWidth, 40, 0x000000, 0);
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

    // Инициализация
    updateSlider();

    // Превью
    y += 80;
    this.createPreview(y);

    // Кнопка сброса
    y += 150;
    this.createResetButton(y, updateSlider);
  }

  private createScaleButton(x: number, y: number, text: string, onClick: () => void): Phaser.GameObjects.Container {
    const colors = getColors();
    const btn = this.add.container(x, y);

    const bg = this.add.circle(0, 0, 20, 0x1a1a2e);
    bg.setStrokeStyle(2, colors.uiAccent);
    btn.add(bg);

    btn.add(this.add.text(0, 0, text, {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    btn.setInteractive(new Phaser.Geom.Circle(0, 0, 20), Phaser.Geom.Circle.Contains);
    btn.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click');
      onClick();
    });
    btn.on('pointerover', () => bg.setFillStyle(colors.uiAccent, 0.3));
    btn.on('pointerout', () => bg.setFillStyle(0x1a1a2e));

    return btn;
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

    this.add.text(width / 2, y, 'Preview:', {
      fontSize: '14px',
      color: '#888888',
    }).setOrigin(0.5);

    y += 20;

    const previewWidth = 80;
    const previewHeight = 140;

    const frame = this.add.graphics();
    frame.lineStyle(2, 0x666666);
    frame.strokeRoundedRect(width / 2 - previewWidth / 2, y, previewWidth, previewHeight, 8);

    this.previewRect = this.add.rectangle(
      width / 2,
      y + previewHeight / 2,
      previewWidth * 0.9,
      previewHeight * 0.9,
      colors.uiAccent,
      0.3
    );
    this.previewRect.setStrokeStyle(2, colors.uiAccent);

    this.updatePreview();
  }

  private updatePreview(): void {
    if (!this.previewRect) return;

    const baseWidth = 72;
    const baseHeight = 126;

    const newWidth = baseWidth * this.screenScaleValue;
    const newHeight = baseHeight * this.screenScaleValue;

    this.previewRect.setSize(
      Math.min(newWidth, 78),
      Math.min(newHeight, 138)
    );
  }

  private createResetButton(y: number, updateSlider: () => void): void {
    const { width } = this.cameras.main;

    const btn = this.add.container(width / 2, y);

    const bg = this.add.graphics();
    bg.fillStyle(0x374151, 1);
    bg.fillRoundedRect(-70, -20, 140, 40, 10);
    bg.lineStyle(2, 0x6b7280);
    bg.strokeRoundedRect(-70, -20, 140, 40, 10);
    btn.add(bg);

    btn.add(this.add.text(0, 0, '↺ Reset to 100%', {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5));

    btn.setInteractive(new Phaser.Geom.Rectangle(-70, -20, 140, 40), Phaser.Geom.Rectangle.Contains);

    btn.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click');
      this.screenScaleValue = 1.0;
      updateSlider();
      this.applyScale();
      this.updatePreview();
    });

    btn.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x4b5563, 1);
      bg.fillRoundedRect(-70, -20, 140, 40, 10);
      bg.lineStyle(2, 0x9ca3af);
      bg.strokeRoundedRect(-70, -20, 140, 40, 10);
    });

    btn.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x374151, 1);
      bg.fillRoundedRect(-70, -20, 140, 40, 10);
      bg.lineStyle(2, 0x6b7280);
      bg.strokeRoundedRect(-70, -20, 140, 40, 10);
    });
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
}