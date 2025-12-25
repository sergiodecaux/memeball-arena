// src/scenes/SettingsScene.ts

import Phaser from 'phaser';
import { getColors, hexToString, getFonts, getGlassStyle } from '../config/themes';
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
    
    // Base gradient
    bg.fillStyle(colors.background, 1);
    bg.fillRect(0, 0, width, height);
    
    // Purple radial glow at top
    this.drawRadialGradient(bg, width / 2, 0, height * 0.5, colors.backgroundGradientTop, 0.4);

    // Grid
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

    // Header background
    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x000000, 0.8);
    headerBg.fillRect(0, 0, width, 70);
    headerBg.lineStyle(2, colors.uiAccent, 0.3);
    headerBg.lineBetween(0, 70, width, 70);
    headerBg.setDepth(100);

    // Back button
    const backBtn = this.add.container(50, 35).setDepth(101);
    const backBg = this.add.graphics();
    backBg.fillStyle(0x000000, 0.5);
    backBg.fillRoundedRect(-35, -16, 70, 32, 16);
    backBg.lineStyle(1, colors.glassBorder, 0.3);
    backBg.strokeRoundedRect(-35, -16, 70, 32, 16);
    backBtn.add(backBg);
    backBtn.add(this.add.text(0, 0, `← ${i18n.t('back')}`, {
      fontSize: '12px',
      fontFamily: fonts.tech,
      color: '#ffffff',
    }).setOrigin(0.5));

    backBtn.setInteractive(new Phaser.Geom.Rectangle(-35, -16, 70, 32), Phaser.Geom.Rectangle.Contains);
    backBtn.on('pointerover', () => backBtn.setScale(1.05));
    backBtn.on('pointerout', () => backBtn.setScale(1));
    backBtn.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click');
      this.saveSettings();
      this.scene.start('MainMenuScene');
    });

    // Title with icon
    this.add.text(width / 2, 35, `⚙️ ${i18n.t('settings').toUpperCase()}`, {
      fontSize: '20px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(101);
  }

  private createScrollableContent(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const data = playerData.get();

    this.contentContainer = this.add.container(0, 0);

    let y = 95;

    // ===== LANGUAGE SECTION =====
    y = this.createSectionHeader(y, '🌍', i18n.t('language'));
    y = this.createLanguageSelector(y);
    y += 20;

    // ===== AUDIO SECTION =====
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
          window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
        } catch (e) {}
      }
      playerData.save();
    });

    y += 20;

    // ===== DISPLAY SECTION =====
    y = this.createSectionHeader(y, '📐', 'DISPLAY');
    this.createScreenScaleSlider(y);
  }

  private createSectionHeader(y: number, icon: string, title: string): number {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();

    // Section title
    this.add.text(25, y, `${icon} ${title}`, {
      fontSize: '14px',
      fontFamily: fonts.tech,
      color: hexToString(colors.uiAccent),
      letterSpacing: 1,
    });

    // Line
    const line = this.add.graphics();
    line.lineStyle(1, colors.uiAccent, 0.2);
    line.lineBetween(25, y + 22, width - 25, y + 22);

    return y + 35;
  }

  // ==================== LANGUAGE SELECTOR ====================

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

      btn.add(this.add.text(20, btnHeight / 2, flag, { fontSize: '24px' }).setOrigin(0, 0.5));
      btn.add(this.add.text(55, btnHeight / 2, name, {
        fontSize: '14px',
        fontFamily: fonts.tech,
        color: isSelected ? hexToString(colors.uiAccent) : '#ffffff',
      }).setOrigin(0, 0.5));

      if (isSelected) {
        btn.add(this.add.text(btnWidth - 20, btnHeight / 2, '✓', {
          fontSize: '16px',
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
          this.changeLanguage(lang);
        });
      }
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

  // ==================== TOGGLES ====================

  private createToggle(y: number, icon: string, label: string, initialValue: boolean, onChange: (val: boolean) => void): number {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();

    const rowHeight = 55;
    const rowY = y;

    // Row background
    const rowBg = this.add.graphics();
    rowBg.fillStyle(0x1a1a2e, 0.4);
    rowBg.fillRoundedRect(25, rowY, width - 50, rowHeight, 12);
    rowBg.lineStyle(1, colors.glassBorder, 0.1);
    rowBg.strokeRoundedRect(25, rowY, width - 50, rowHeight, 12);

    // Label
    this.add.text(45, rowY + rowHeight / 2, `${icon} ${label}`, {
      fontSize: '15px',
      fontFamily: fonts.tech,
      color: '#ffffff',
    }).setOrigin(0, 0.5);

    // Toggle switch
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
        // Glow effect when on
        toggleBg.lineStyle(2, colors.uiAccent, 0.5);
        toggleBg.strokeRoundedRect(toggleX - toggleWidth / 2, toggleY - toggleHeight / 2, toggleWidth, toggleHeight, 14);
      }

      toggleCircle.setPosition(
        isOn ? toggleX + toggleWidth / 2 - 14 : toggleX - toggleWidth / 2 + 14,
        toggleY
      );
    };

    drawToggle();

    const hitArea = this.add.rectangle(toggleX, toggleY, toggleWidth + 20, toggleHeight + 20, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });

    hitArea.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click');
      isOn = !isOn;
      
      // Animate toggle
      this.tweens.add({
        targets: toggleCircle,
        x: isOn ? toggleX + toggleWidth / 2 - 14 : toggleX - toggleWidth / 2 + 14,
        duration: 150,
        ease: 'Power2',
      });
      
      drawToggle();
      onChange(isOn);
    });

    return y + rowHeight + 8;
  }

  // ==================== SCREEN SCALE SLIDER ====================

  private createScreenScaleSlider(y: number): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();

    // Description
    this.add.text(width / 2, y + 5, 'Adjust to remove black bars', {
      fontSize: '11px',
      color: hexToString(colors.uiTextSecondary),
    }).setOrigin(0.5);

    y += 35;

    // Slider container background
    const sliderBg = this.add.graphics();
    sliderBg.fillStyle(0x1a1a2e, 0.5);
    sliderBg.fillRoundedRect(25, y - 15, width - 50, 70, 12);
    sliderBg.lineStyle(1, colors.glassBorder, 0.1);
    sliderBg.strokeRoundedRect(25, y - 15, width - 50, 70, 12);

    // Slider
    const sliderWidth = width - 130;
    const sliderX = 65;
    const sliderY = y + 15;

    // Slider track
    const sliderTrack = this.add.graphics();
    sliderTrack.fillStyle(0x2a2a3e, 1);
    sliderTrack.fillRoundedRect(sliderX, sliderY - 4, sliderWidth, 8, 4);

    // Slider fill
    const sliderFill = this.add.graphics();

    // Handle
    const handle = this.add.circle(0, sliderY, 14, colors.uiAccent);
    handle.setStrokeStyle(3, 0xffffff);

    // Value text
    this.scaleText = this.add.text(width / 2, sliderY + 30, '', {
      fontSize: '14px',
      fontFamily: fonts.tech,
      color: '#ffffff',
    }).setOrigin(0.5);

    // Minus button
    this.createScaleButton(sliderX - 25, sliderY, '-', () => {
      this.screenScaleValue = Math.max(0.8, this.screenScaleValue - 0.05);
      updateSlider();
      this.applyScale();
    });

    // Plus button
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

    // Slider interaction
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

    updateSlider();

    // Preview
    y += 85;
    this.createPreview(y);

    // Reset button
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

    btn.add(this.add.text(0, -1, text, {
      fontSize: '22px',
      fontFamily: fonts.tech,
      color: '#ffffff',
    }).setOrigin(0.5));

    btn.setInteractive(new Phaser.Geom.Circle(0, 0, 18), Phaser.Geom.Circle.Contains);
    btn.on('pointerover', () => drawBg(true));
    btn.on('pointerout', () => drawBg(false));
    btn.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click');
      onClick();
    });
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

    this.add.text(width / 2, y, 'Preview:', {
      fontSize: '12px',
      fontFamily: fonts.tech,
      color: hexToString(colors.uiTextSecondary),
    }).setOrigin(0.5);

    y += 20;

    const previewWidth = 70;
    const previewHeight = 120;

    // Frame (phone outline)
    const frame = this.add.graphics();
    frame.lineStyle(2, 0x4a4a5a);
    frame.strokeRoundedRect(width / 2 - previewWidth / 2, y, previewWidth, previewHeight, 8);

    // Content area
    this.previewRect = this.add.rectangle(
      width / 2,
      y + previewHeight / 2,
      previewWidth * 0.85,
      previewHeight * 0.85,
      colors.uiAccent,
      0.25
    );
    this.previewRect.setStrokeStyle(2, colors.uiAccent);

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

    btn.add(this.add.text(0, 0, '↺ Reset to 100%', {
      fontSize: '13px',
      fontFamily: fonts.tech,
      color: '#ffffff',
    }).setOrigin(0.5));

    btn.setInteractive(new Phaser.Geom.Rectangle(-75, -22, 150, 44), Phaser.Geom.Rectangle.Contains);

    btn.on('pointerover', () => drawBg(true));
    btn.on('pointerout', () => drawBg(false));
    btn.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click');
      this.screenScaleValue = 1.0;
      updateSlider();
      this.applyScale();
      this.updatePreview();
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