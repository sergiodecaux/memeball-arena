// src/scenes/SettingsScene.ts

import Phaser from 'phaser';
import { getColors, hexToString } from '../config/themes';
import { playerData } from '../data/PlayerData';
import { i18n, Language } from '../localization/i18n';
import { Icons } from '../ui/Icons';
import { PremiumButton } from '../ui/PremiumButton';
import { AudioManager } from '../managers/AudioManager'; // [AUDIO]

export class SettingsScene extends Phaser.Scene {
  private confirmModal: Phaser.GameObjects.Container | null = null;

  constructor() {
    super({ key: 'SettingsScene' });
  }

  create(): void {
    // [AUDIO] Инициализация менеджера
    AudioManager.getInstance().init(this);

    this.confirmModal = null;
    
    this.createBackground();
    this.createHeader();
    this.createSettings();
  }

  private createBackground(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a12, 1);
    bg.fillRect(0, 0, width, height);

    for (let i = 0; i < 200; i++) {
      const alpha = 0.1 * Math.pow(1 - i / 200, 2);
      bg.fillStyle(colors.uiPrimary, alpha);
      bg.fillRect(0, i, width, 1);
    }

    const grid = this.add.graphics();
    grid.lineStyle(1, colors.uiPrimary, 0.02);
    for (let x = 0; x <= width; x += 50) {
      grid.moveTo(x, 0);
      grid.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += 50) {
      grid.moveTo(0, y);
      grid.lineTo(width, y);
    }
    grid.strokePath();
  }

  private createHeader(): void {
    const { width } = this.cameras.main;
    const colors = getColors();

    // Фон хедера
    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x000000, 0.5);
    headerBg.fillRect(0, 0, width, 70);
    headerBg.lineStyle(1, colors.uiPrimary, 0.3);
    headerBg.lineBetween(0, 70, width, 70);

    // Кнопка назад
    const backBtn = this.add.container(45, 35);
    
    const backBg = this.add.graphics();
    backBg.fillStyle(colors.uiPrimary, 0.1);
    backBg.fillCircle(0, 0, 22);
    backBg.lineStyle(2, colors.uiAccent, 0.5);
    backBg.strokeCircle(0, 0, 22);
    backBtn.add(backBg);
    
    const backIcon = Icons.drawBack(this, 0, 0, 10, colors.uiAccent);
    backBtn.add(backIcon);
    
    backBtn.setInteractive(new Phaser.Geom.Circle(0, 0, 22), Phaser.Geom.Circle.Contains);
    backBtn.on('pointerover', () => backBtn.setScale(1.1));
    backBtn.on('pointerout', () => backBtn.setScale(1));
    backBtn.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click'); // [AUDIO]
      this.scene.start('MainMenuScene');
    });

    // Заголовок
    const settingsIcon = Icons.drawSettings(this, width / 2 - 70, 35, 16, colors.uiAccent);
    
    this.add.text(width / 2, 35, i18n.t('settings').toUpperCase(), {
      fontSize: '24px',
      fontFamily: 'Arial Black, Arial',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);
  }

  private createSettings(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const data = playerData.get();
    
    let currentY = 100;
    const itemHeight = 65;
    const itemWidth = width - 40;

    // === ЯЗЫК ===
    this.createSectionTitle(currentY, i18n.t('language'));
    currentY += 40;
    
    this.createLanguageSelector(currentY, itemWidth);
    currentY += 90;

    // === ЗВУК ===
    this.createSectionTitle(currentY, 'Audio');
    currentY += 40;
    
    // Toggle Sound
    this.createToggle(currentY, itemWidth, i18n.t('sound'), data.settings.soundEnabled, (val) => {
      data.settings.soundEnabled = val;
      playerData.save();
      AudioManager.getInstance().toggleSound(val); // [AUDIO] Применяем настройку
    });
    currentY += itemHeight + 10;

    // Toggle Music
    this.createToggle(currentY, itemWidth, i18n.t('music'), data.settings.musicEnabled, (val) => {
      data.settings.musicEnabled = val;
      playerData.save();
      AudioManager.getInstance().toggleMusic(val); // [AUDIO] Применяем настройку
    });
    currentY += itemHeight + 10;

    // Toggle Vibration
    this.createToggle(currentY, itemWidth, i18n.t('vibration'), data.settings.vibrationEnabled, (val) => {
      data.settings.vibrationEnabled = val;
      playerData.save();
      // Тут можно добавить тестовую вибрацию, если включили
      if (val) window.Telegram?.WebApp.HapticFeedback.notificationOccurred('success');
    });
    currentY += itemHeight + 30;

    // === ДАННЫЕ ===
    this.createSectionTitle(currentY, 'Data');
    currentY += 45;

    new PremiumButton(this, {
      x: width / 2,
      y: currentY + 25,
      width: itemWidth,
      height: 55,
      text: i18n.t('resetProgress'),
      fontSize: 16,
      style: 'secondary',
      onClick: () => {
        AudioManager.getInstance().playSFX('sfx_click'); // [AUDIO]
        this.showResetConfirmation();
      },
    });
  }

  private createSectionTitle(y: number, title: string): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    
    this.add.text(30, y, title.toUpperCase(), {
      fontSize: '13px',
      fontFamily: 'Arial',
      color: hexToString(colors.uiAccent),
      fontStyle: 'bold',
    });
    
    const line = this.add.graphics();
    line.lineStyle(1, colors.uiAccent, 0.2);
    line.lineBetween(30, y + 20, width - 30, y + 20);
  }

  private createLanguageSelector(y: number, itemWidth: number): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const currentLang = i18n.getLanguage();

    const container = this.add.container(width / 2, y);

    // Фон
    const bg = this.add.graphics();
    bg.fillStyle(0x12121f, 0.9);
    bg.fillRoundedRect(-itemWidth / 2, 0, itemWidth, 70, 14);
    bg.lineStyle(1, colors.uiPrimary, 0.3);
    bg.strokeRoundedRect(-itemWidth / 2, 0, itemWidth, 70, 14);
    container.add(bg);

    const languages: Language[] = ['en', 'ru'];
    const btnWidth = (itemWidth - 30) / 2;

    languages.forEach((lang, i) => {
      const x = -itemWidth / 2 + 15 + i * (btnWidth + 10) + btnWidth / 2;
      const isActive = lang === currentLang;

      const btnBg = this.add.graphics();
      
      const drawBtn = (hover: boolean) => {
        btnBg.clear();
        if (isActive) {
          btnBg.fillStyle(colors.uiAccent, 0.3);
          btnBg.fillRoundedRect(x - btnWidth / 2, 10, btnWidth, 50, 10);
          btnBg.lineStyle(2, colors.uiAccent, 1);
          btnBg.strokeRoundedRect(x - btnWidth / 2, 10, btnWidth, 50, 10);
        } else {
          btnBg.fillStyle(0x1a1a2e, hover ? 0.9 : 0.6);
          btnBg.fillRoundedRect(x - btnWidth / 2, 10, btnWidth, 50, 10);
          btnBg.lineStyle(1, colors.uiTextSecondary, hover ? 0.5 : 0.2);
          btnBg.strokeRoundedRect(x - btnWidth / 2, 10, btnWidth, 50, 10);
        }
      };
      
      drawBtn(false);
      container.add(btnBg);

      // Флаг
      container.add(this.add.text(x - 25, 35, i18n.getLanguageFlag(lang), {
        fontSize: '22px',
      }).setOrigin(0.5, 0.5));

      // Название языка
      container.add(this.add.text(x + 10, 35, i18n.getLanguageName(lang), {
        fontSize: '14px',
        color: isActive ? hexToString(colors.uiAccent) : '#aaaaaa',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5));

      if (!isActive) {
        const hitArea = this.add.rectangle(x, 35, btnWidth, 50, 0x000000, 0);
        hitArea.setInteractive({ useHandCursor: true });
        container.add(hitArea);

        hitArea.on('pointerover', () => drawBtn(true));
        hitArea.on('pointerout', () => drawBtn(false));
        hitArea.on('pointerdown', () => {
          AudioManager.getInstance().playSFX('sfx_click'); // [AUDIO]
          i18n.setLanguage(lang);
          this.scene.restart();
        });
      }
    });
  }

  private createToggle(
    y: number, 
    itemWidth: number, 
    label: string, 
    value: boolean, 
    onChange: (val: boolean) => void
  ): void {
    const { width } = this.cameras.main;
    const colors = getColors();

    const container = this.add.container(width / 2, y);

    // Фон
    const bg = this.add.graphics();
    bg.fillStyle(0x12121f, 0.9);
    bg.fillRoundedRect(-itemWidth / 2, 0, itemWidth, 55, 12);
    bg.lineStyle(1, colors.uiPrimary, 0.2);
    bg.strokeRoundedRect(-itemWidth / 2, 0, itemWidth, 55, 12);
    container.add(bg);

    // Лейбл
    container.add(this.add.text(-itemWidth / 2 + 20, 27, label, {
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0, 0.5));

    // Тоггл
    const toggleX = itemWidth / 2 - 45;
    const toggleWidth = 52;
    const toggleHeight = 28;

    const toggle = this.add.graphics();
    
    const drawToggle = (on: boolean) => {
      toggle.clear();
      toggle.fillStyle(on ? colors.uiAccent : 0x3a3a4a, 1);
      toggle.fillRoundedRect(toggleX - toggleWidth / 2, 27 - toggleHeight / 2, toggleWidth, toggleHeight, 14);
      
      // Круглый индикатор
      const circleX = on ? toggleX + toggleWidth / 2 - 16 : toggleX - toggleWidth / 2 + 16;
      toggle.fillStyle(0xffffff, 1);
      toggle.fillCircle(circleX, 27, 10);
    };
    
    drawToggle(value);
    container.add(toggle);

    // Интерактивность
    const hitArea = this.add.rectangle(toggleX, 27, toggleWidth + 20, toggleHeight + 10, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    container.add(hitArea);

    let currentValue = value;

    hitArea.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click'); // [AUDIO]
      currentValue = !currentValue;
      drawToggle(currentValue);
      onChange(currentValue);
    });
  }

  private showResetConfirmation(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();

    // Overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8);
    overlay.setOrigin(0, 0).setDepth(300);

    this.confirmModal = this.add.container(width / 2, height / 2);
    this.confirmModal.setDepth(301);

    const modalWidth = 280;
    const modalHeight = 180;

    // Фон модала
    const bg = this.add.graphics();
    bg.fillStyle(0x12121f, 1);
    bg.fillRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 16);
    bg.lineStyle(2, 0xef4444, 0.6);
    bg.strokeRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 16);
    this.confirmModal.add(bg);

    // Иконка предупреждения
    const warningIcon = this.add.graphics();
    warningIcon.fillStyle(0xef4444, 1);
    warningIcon.beginPath();
    warningIcon.moveTo(0, -modalHeight / 2 + 40);
    warningIcon.lineTo(-15, -modalHeight / 2 + 65);
    warningIcon.lineTo(15, -modalHeight / 2 + 65);
    warningIcon.closePath();
    warningIcon.fillPath();
    warningIcon.fillStyle(0x12121f, 1);
    warningIcon.fillRect(-2, -modalHeight / 2 + 48, 4, 10);
    warningIcon.fillCircle(0, -modalHeight / 2 + 60, 2);
    this.confirmModal.add(warningIcon);

    // Текст
    this.confirmModal.add(this.add.text(0, -10, i18n.t('confirmReset'), {
      fontSize: '13px',
      color: '#cccccc',
      align: 'center',
      wordWrap: { width: modalWidth - 40 },
    }).setOrigin(0.5, 0.5));

    // Кнопки
    const btnY = modalHeight / 2 - 40;
    const btnWidth = 100;

    // NO
    const noBtn = this.createModalButton(-60, btnY, btnWidth, i18n.t('no'), 0x4a4a5a, () => {
      AudioManager.getInstance().playSFX('sfx_click'); // [AUDIO]
      overlay.destroy();
      this.confirmModal?.destroy();
      this.confirmModal = null;
    });
    this.confirmModal.add(noBtn);

    // YES
    const yesBtn = this.createModalButton(60, btnY, btnWidth, i18n.t('yes'), 0xef4444, () => {
      AudioManager.getInstance().playSFX('sfx_click'); // [AUDIO]
      playerData.reset();
      this.scene.start('MainMenuScene');
    });
    this.confirmModal.add(yesBtn);

    // Анимация
    this.confirmModal.setScale(0.9).setAlpha(0);
    this.tweens.add({
      targets: this.confirmModal,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });
  }

  private createModalButton(
    x: number, 
    y: number, 
    w: number, 
    text: string, 
    color: number, 
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(color, hover ? 0.4 : 0.2);
      bg.fillRoundedRect(-w / 2, -18, w, 36, 8);
      bg.lineStyle(2, color, hover ? 1 : 0.6);
      bg.strokeRoundedRect(-w / 2, -18, w, 36, 8);
    };
    
    draw(false);
    container.add(bg);

    container.add(this.add.text(0, 0, text, {
      fontSize: '14px',
      color: hexToString(color),
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5));

    const hitArea = this.add.rectangle(0, 0, w, 36, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerover', () => draw(true));
    hitArea.on('pointerout', () => draw(false));
    hitArea.on('pointerdown', onClick);

    return container;
  }
}