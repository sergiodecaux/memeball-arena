// src/scenes/MainMenuScene.ts
// Адаптивное главное меню для Telegram Mini App

import Phaser from 'phaser';
import { getColors, hexToString, getFonts, getGlassStyle } from '../config/themes';
import { playerData, getRankByLevel } from '../data/PlayerData';
import { i18n, Language } from '../localization/i18n';
import { AIDifficulty } from '../types';
import { AudioManager } from '../managers/AudioManager';
import { FACTIONS, FactionId, FactionConfig } from '../constants/gameConstants';
import { tgApp } from '../utils/TelegramWebApp';

export class MainMenuScene extends Phaser.Scene {
  private modalContainer?: Phaser.GameObjects.Container;
  private overlay?: Phaser.GameObjects.Rectangle;
  private isTransitioning = false;
  private floatingElements: Phaser.GameObjects.GameObject[] = [];
  
  // Адаптивный масштаб
  private s: number = 1;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    // Вычисляем масштаб UI
    this.s = tgApp.getUIScale();
    
    const { width, height } = this.cameras.main;
    const viewport = tgApp.getViewport();
    
    console.log(`[MainMenu] Screen: ${width}x${height}, Scale: ${this.s.toFixed(2)}, Platform: ${viewport.platform}`);
    
    const audio = AudioManager.getInstance();
    audio.init(this);
    audio.stopAmbience();
    audio.playMusic('bgm_menu');

    this.resetState();
    this.createBackground();
    this.createHeader();
    this.createLogo();
    this.createHubGrid();
    this.createFooter();
    this.startAnimations();

    if (i18n.isFirstLaunch()) {
      this.time.delayedCall(300, () => this.showLanguageSelection(true));
    }
  }

  private resetState(): void {
    this.modalContainer = undefined;
    this.overlay = undefined;
    this.isTransitioning = false;
    this.floatingElements = [];
  }

  private createBackground(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();

    const bg = this.add.graphics();
    bg.fillStyle(colors.background, 1);
    bg.fillRect(0, 0, width, height);

    this.drawRadialGradient(bg, width / 2, 0, height * 0.85, colors.backgroundGradientTop, 0.6);
    this.drawRadialGradient(bg, width / 2, height, height * 0.4, colors.uiAccentPink, 0.1);
    this.drawGrid(40 * this.s, 0x1a1a2e, 0.3);
    this.createParticles();
  }

  private drawRadialGradient(g: Phaser.GameObjects.Graphics, cx: number, cy: number, maxR: number, color: number, maxAlpha: number): void {
    const steps = 40;
    for (let i = steps; i > 0; i--) {
      const ratio = i / steps;
      g.fillStyle(color, maxAlpha * Math.pow(1 - ratio, 2));
      g.fillCircle(cx, cy, maxR * ratio);
    }
  }

  private drawGrid(size: number, color: number, alpha: number): void {
    const { width, height } = this.cameras.main;
    const grid = this.add.graphics();
    grid.lineStyle(1, color, alpha);
    for (let x = 0; x <= width; x += size) grid.lineBetween(x, 0, x, height);
    for (let y = 0; y <= height; y += size) grid.lineBetween(0, y, width, y);
  }

  private createParticles(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const particleColors = [colors.uiAccent, colors.uiAccentPink, colors.uiPrimary];
    const count = Math.floor(15 * this.s);

    for (let i = 0; i < count; i++) {
      const particle = this.add.circle(
        Phaser.Math.Between(20, width - 20),
        Phaser.Math.Between(100, height - 100),
        Phaser.Math.FloatBetween(1, 2.5),
        Phaser.Math.RND.pick(particleColors),
        Phaser.Math.FloatBetween(0.2, 0.5)
      );
      this.floatingElements.push(particle);
    }
  }

  private startAnimations(): void {
    this.floatingElements.forEach((particle, i) => {
      this.tweens.add({
        targets: particle,
        y: (particle as Phaser.GameObjects.Arc).y - Phaser.Math.Between(20, 40),
        alpha: { from: (particle as Phaser.GameObjects.Arc).alpha, to: 0.1 },
        duration: Phaser.Math.Between(4000, 8000),
        yoyo: true,
        repeat: -1,
        delay: i * 100,
        ease: 'Sine.easeInOut',
      });
    });
  }

  private createHeader(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const s = this.s;

    const headerY = 20 * s;

    // Валюта (справа)
    const currencyContainer = this.add.container(width - 15 * s, headerY).setDepth(50);

    const currencyBg = this.add.graphics();
    currencyBg.fillStyle(0x000000, 0.5);
    currencyBg.fillRoundedRect(-110 * s, -15 * s, 110 * s, 42 * s, 10 * s);
    currencyBg.lineStyle(1, colors.glassBorder, 0.15);
    currencyBg.strokeRoundedRect(-110 * s, -15 * s, 110 * s, 42 * s, 10 * s);
    currencyContainer.add(currencyBg);

    currencyContainer.add(this.add.text(-95 * s, -4 * s, '💰', { fontSize: `${12 * s}px` }).setOrigin(0, 0.5));
    currencyContainer.add(this.add.text(-78 * s, -4 * s, this.formatNumber(playerData.get().coins), { 
      fontSize: `${11 * s}px`, 
      fontFamily: getFonts().tech, 
      color: hexToString(colors.uiGold) 
    }).setOrigin(0, 0.5));
    
    currencyContainer.add(this.add.text(-95 * s, 14 * s, '💎', { fontSize: `${12 * s}px` }).setOrigin(0, 0.5));
    currencyContainer.add(this.add.text(-78 * s, 14 * s, this.formatNumber(playerData.get().crystals), { 
      fontSize: `${11 * s}px`, 
      fontFamily: getFonts().tech, 
      color: hexToString(colors.uiAccentPink) 
    }).setOrigin(0, 0.5));

    const plusBtn = this.createPlusButton(-12 * s, 5 * s, colors.uiAccent);
    currencyContainer.add(plusBtn);

    // Настройки (слева)
    this.createSettingsButton(20 * s, headerY);
    
    // Профиль игрока (по центру-левее)
    this.createPlayerBadge(headerY);
  }

  private createPlayerBadge(headerY: number): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const data = playerData.get();
    const nickname = playerData.getNickname();
    const avatarId = playerData.getAvatarId();
    const rank = getRankByLevel(data.level);
    const faction = data.selectedFaction ? FACTIONS[data.selectedFaction] : null;
    const ownedFactions = playerData.getOwnedFactions();
    const s = this.s;

    // Ширина бейджа зависит от наличия фракции
    const badgeW = faction ? 165 * s : 120 * s;
    const badgeH = 32 * s;
    const badgeX = 50 * s + badgeW / 2;

    const container = this.add.container(badgeX, headerY).setDepth(50);

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRoundedRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 16 * s);
    
    if (faction) {
      bg.lineStyle(2, faction.color, 0.6);
    } else {
      bg.lineStyle(1, colors.glassBorder, 0.25);
    }
    bg.strokeRoundedRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 16 * s);
    container.add(bg);

    // Аватар или иконка фракции
    const iconX = -badgeW / 2 + 18 * s;
    if (faction && this.textures.exists(faction.assetKey)) {
      const factionIcon = this.add.image(iconX, 0, faction.assetKey);
      factionIcon.setDisplaySize(24 * s, 24 * s);
      container.add(factionIcon);

      const glow = this.add.graphics();
      glow.fillStyle(faction.color, 0.3);
      glow.fillCircle(iconX, 0, 14 * s);
      container.addAt(glow, 1);
    } else if (this.textures.exists(avatarId)) {
      const avatar = this.add.image(iconX, 0, avatarId).setDisplaySize(24 * s, 24 * s);
      container.add(avatar);
    }

    // Никнейм
    const textX = iconX + 18 * s;
    const displayName = nickname.length > 8 ? nickname.substring(0, 8) + '..' : nickname;
    container.add(this.add.text(textX, -5 * s, displayName, { 
      fontSize: `${11 * s}px`, 
      fontFamily: fonts.tech, 
      color: faction ? hexToString(faction.color) : '#ffffff' 
    }).setOrigin(0, 0.5));

    // Уровень
    container.add(this.add.text(textX, 8 * s, `${rank.icon} Lv.${data.level}`, { 
      fontSize: `${9 * s}px`, 
      fontFamily: fonts.tech, 
      color: hexToString(rank.color) 
    }).setOrigin(0, 0.5));

    // ✅ НОВОЕ: Название фракции + стрелка (если > 1 фракции)
    if (faction) {
      const factionName = faction.name.split(' ')[0].substring(0, 5);
      const canSwitch = ownedFactions.length > 1;
      
      const factionLabelX = badgeW / 2 - (canSwitch ? 18 * s : 8 * s);
      
      const factionLabel = this.add.text(factionLabelX, 0, factionName, {
        fontSize: `${7 * s}px`,
        fontFamily: fonts.tech,
        color: hexToString(faction.color),
      }).setOrigin(1, 0.5).setAlpha(0.7);
      container.add(factionLabel);
      
      if (canSwitch) {
        const arrow = this.add.text(badgeW / 2 - 6 * s, 0, '▼', {
          fontSize: `${8 * s}px`,
          color: hexToString(faction.color),
        }).setOrigin(0.5).setAlpha(0.6);
        container.add(arrow);
      }
    }

    // Интерактивность
    const hitArea = this.add.rectangle(0, 0, badgeW, badgeH, 0x000000, 0).setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerover', () => this.tweens.add({ targets: container, scale: 1.03, duration: 100 }));
    hitArea.on('pointerout', () => this.tweens.add({ targets: container, scale: 1, duration: 100 }));
    hitArea.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click');
      tgApp.hapticSelection();
      
      // ✅ Если > 1 фракции → модалка переключения, иначе → профиль
      if (ownedFactions.length > 1) {
        this.showFactionSwitchModal();
      } else {
        this.scene.start('ProfileScene');
      }
    });
  }

  private createSettingsButton(x: number, y: number): void {
    const colors = getColors();
    const s = this.s;
    const btn = this.add.container(x, y).setDepth(50);

    const size = 18 * s;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.5);
    bg.fillCircle(0, 0, size);
    bg.lineStyle(1, colors.glassBorder, 0.15);
    bg.strokeCircle(0, 0, size);
    btn.add(bg);

    btn.add(this.add.text(0, 0, '⚙️', { fontSize: `${14 * s}px` }).setOrigin(0.5));

    btn.setInteractive(new Phaser.Geom.Circle(0, 0, size), Phaser.Geom.Circle.Contains)
      .on('pointerover', () => btn.setScale(1.1))
      .on('pointerout', () => btn.setScale(1))
      .on('pointerdown', () => {
        AudioManager.getInstance().playSFX('sfx_click');
        tgApp.hapticSelection();
        this.scene.start('SettingsScene');
      });
  }

  private createPlusButton(x: number, y: number, color: number): Phaser.GameObjects.Container {
    const s = this.s;
    const btn = this.add.container(x, y);

    const size = 11 * s;
    const bg = this.add.graphics();
    bg.fillStyle(color, 0.15);
    bg.fillCircle(0, 0, size);
    bg.lineStyle(1.5, color, 0.5);
    bg.strokeCircle(0, 0, size);
    btn.add(bg);

    btn.add(this.add.text(0, -1, '+', { 
      fontSize: `${14 * s}px`, 
      fontFamily: getFonts().tech, 
      color: hexToString(color) 
    }).setOrigin(0.5));

    btn.setInteractive(new Phaser.Geom.Circle(0, 0, size), Phaser.Geom.Circle.Contains)
      .on('pointerover', () => btn.setScale(1.15))
      .on('pointerout', () => btn.setScale(1))
      .on('pointerdown', () => {
        AudioManager.getInstance().playSFX('sfx_cash');
        tgApp.hapticImpact('light');
        playerData.addCoins(100);
        this.scene.restart();
      });

    return btn;
  }

  private createLogo(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const s = this.s;
    
    // Позиция логотипа - адаптивная
    const logoY = height * 0.14;

    const logoContainer = this.add.container(width / 2, logoY);

    const faction = playerData.getFaction();
    const factionColor = faction ? FACTIONS[faction].color : colors.uiAccent;

    const glow = this.add.graphics();
    glow.fillStyle(factionColor, 0.08);
    glow.fillEllipse(0, 0, 220 * s, 70 * s);
    logoContainer.add(glow);

    this.tweens.add({ 
      targets: glow, 
      alpha: { from: 0.7, to: 1 }, 
      scaleX: { from: 0.95, to: 1.05 }, 
      scaleY: { from: 0.95, to: 1.05 }, 
      duration: 3000, 
      yoyo: true, 
      repeat: -1, 
      ease: 'Sine.easeInOut' 
    });

    // Тень
    logoContainer.add(this.add.text(2, 2, 'GALAXY', { 
      fontSize: `${32 * s}px`, 
      fontFamily: fonts.tech, 
      color: '#000000' 
    }).setOrigin(0.5).setAlpha(0.4));
    
    // Основной текст
    logoContainer.add(this.add.text(0, 0, 'GALAXY', { 
      fontSize: `${32 * s}px`, 
      fontFamily: fonts.tech, 
      color: '#ffffff' 
    }).setOrigin(0.5));

    const subtitleY = 28 * s;
    const lineColor = faction ? FACTIONS[faction].color : colors.uiAccentPink;

    const leftLine = this.add.graphics();
    leftLine.lineStyle(1.5, lineColor, 0.5);
    leftLine.lineBetween(-80 * s, subtitleY, -45 * s, subtitleY);
    leftLine.fillStyle(lineColor, 0.7);
    leftLine.fillCircle(-80 * s, subtitleY, 2);
    logoContainer.add(leftLine);

    const rightLine = this.add.graphics();
    rightLine.lineStyle(1.5, lineColor, 0.5);
    rightLine.lineBetween(45 * s, subtitleY, 80 * s, subtitleY);
    rightLine.fillStyle(lineColor, 0.7);
    rightLine.fillCircle(80 * s, subtitleY, 2);
    logoContainer.add(rightLine);

    logoContainer.add(this.add.text(0, subtitleY, 'L E A G U E', { 
      fontSize: `${11 * s}px`, 
      fontFamily: fonts.tech, 
      color: hexToString(lineColor), 
      letterSpacing: 4 
    }).setOrigin(0.5));

    this.tweens.add({ 
      targets: logoContainer, 
      y: logoY - 5 * s, 
      duration: 2500, 
      yoyo: true, 
      repeat: -1, 
      ease: 'Sine.easeInOut' 
    });
  }

  private createHubGrid(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const s = this.s;
    
    // Адаптивные позиции
    const padding = 15 * s;
    const gap = 10 * s;
    const gridWidth = width - padding * 2;
    
    // Battle кнопка - начинается после логотипа
    const battleY = height * 0.26;
    const battleH = 70 * s;
    
    // Маленькие кнопки
    const smallBtnSize = (gridWidth - gap) / 2;
    const smallBtnH = Math.min(smallBtnSize, 75 * s);
    
    const row2Y = battleY + battleH / 2 + gap + smallBtnH / 2;
    const row3Y = row2Y + smallBtnH + gap;

    const faction = playerData.getFaction();
    const battleColor = faction ? FACTIONS[faction].color : colors.uiAccentPink;

    this.createBattleButton(width / 2, battleY, gridWidth, battleH, battleColor);

    this.createHubButton(padding + smallBtnSize / 2, row2Y, smallBtnSize, smallBtnH, '🛒', 'SHOP', colors.uiAccent, () => this.scene.start('ShopScene'));
    this.createHubButton(width - padding - smallBtnSize / 2, row2Y, smallBtnSize, smallBtnH, '👤', 'PROFILE', colors.uiPrimary, () => this.scene.start('ProfileScene'));

    // ✅ НОВОЕ: Одна большая кнопка TEAM вместо двух
    this.createHubButton(
      width / 2, 
      row3Y, 
      gridWidth, 
      smallBtnH + 10 * s, 
      '⚔️', 
      'TEAM & FORMATION', 
      0xff6bff, 
      () => {
        AudioManager.getInstance().playSFX('sfx_swish');
        this.scene.start('TeamScene');
      }
    );
  }

  private createBattleButton(x: number, y: number, w: number, h: number, accentColor: number = 0xff006e): void {
    const fonts = getFonts();
    const s = this.s;
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    
    // Тень
    bg.fillStyle(0x000000, 0.3);
    bg.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w, h, 12 * s);

    // Градиент
    const gradientSteps = 15;
    const startColor = Phaser.Display.Color.ValueToColor(accentColor);
    const endColor = Phaser.Display.Color.ValueToColor(0xaa00ff);
    
    for (let i = 0; i < gradientSteps; i++) {
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(startColor, endColor, gradientSteps, i);
      const hexColor = Phaser.Display.Color.GetColor(color.r, color.g, color.b);
      bg.fillStyle(hexColor, 1);
      bg.fillRect(-w / 2 + i * (w / gradientSteps), -h / 2, w / gradientSteps + 1, h);
    }
    container.add(bg);

    // Рамка
    const border = this.add.graphics();
    border.lineStyle(2, 0xffffff, 0.3);
    border.strokeRoundedRect(-w / 2, -h / 2, w, h, 12 * s);
    container.add(border);

    // Блик
    const shine = this.add.graphics();
    shine.fillStyle(0xffffff, 0.1);
    shine.fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w * 0.5, h * 0.35, { tl: 10, tr: 0, bl: 0, br: 0 });
    container.add(shine);

    // Анимация блика
    const shineSweep = this.add.graphics();
    shineSweep.fillStyle(0xffffff, 0.25);
    shineSweep.fillRect(-15, -h / 2, 30, h);
    shineSweep.setPosition(-w / 2 - 40, 0);
    container.add(shineSweep);

    this.tweens.add({ 
      targets: shineSweep, 
      x: w / 2 + 40, 
      duration: 2000, 
      delay: 1000, 
      repeat: -1, 
      repeatDelay: 3000, 
      ease: 'Cubic.easeInOut' 
    });

    container.add(this.add.text(0, -8 * s, '⚔️', { fontSize: `${28 * s}px` }).setOrigin(0.5));
    container.add(this.add.text(0, 16 * s, 'BATTLE!', { 
      fontSize: `${18 * s}px`, 
      fontFamily: fonts.tech, 
      color: '#ffffff', 
      letterSpacing: 2 
    }).setOrigin(0.5));

    // Свечение
    const glow = this.add.graphics();
    glow.fillStyle(accentColor, 0.15);
    glow.fillEllipse(0, 0, w + 15, h + 15);
    container.addAt(glow, 0);

    this.tweens.add({ 
      targets: glow, 
      alpha: { from: 0.2, to: 0.4 }, 
      scaleX: { from: 1, to: 1.03 }, 
      scaleY: { from: 1, to: 1.06 }, 
      duration: 1500, 
      yoyo: true, 
      repeat: -1, 
      ease: 'Sine.easeInOut' 
    });

    const hitArea = this.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerover', () => this.tweens.add({ targets: container, scale: 1.02, duration: 100 }));
    hitArea.on('pointerout', () => this.tweens.add({ targets: container, scale: 1, duration: 100 }));
    hitArea.on('pointerdown', () => { 
      AudioManager.getInstance().playSFX('sfx_click'); 
      tgApp.hapticImpact('medium');
      container.setScale(0.98); 
    });
    hitArea.on('pointerup', () => { 
      container.setScale(1.02); 
      this.showModeSelection(); 
    });
  }

  private createHubButton(x: number, y: number, w: number, h: number, icon: string, label: string, accentColor: number, onClick: () => void): void {
    const colors = getColors();
    const fonts = getFonts();
    const glass = getGlassStyle();
    const s = this.s;
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(colors.glassBackground, glass.bgAlpha);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12 * s);
    bg.lineStyle(1, colors.glassBorder, glass.borderAlpha);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12 * s);
    container.add(bg);

    container.add(this.add.text(0, -10 * s, icon, { fontSize: `${26 * s}px` }).setOrigin(0.5));
    container.add(this.add.text(0, 18 * s, label, { 
      fontSize: `${10 * s}px`, 
      fontFamily: fonts.tech, 
      color: hexToString(accentColor), 
      letterSpacing: 1 
    }).setOrigin(0.5));

    const hitArea = this.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
    container.add(hitArea);

    let isHovered = false;
    const updateVisual = () => {
      bg.clear();
      if (isHovered) {
        bg.fillStyle(accentColor, 0.1);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12 * s);
        bg.lineStyle(1.5, accentColor, 0.5);
      } else {
        bg.fillStyle(colors.glassBackground, glass.bgAlpha);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12 * s);
        bg.lineStyle(1, colors.glassBorder, glass.borderAlpha);
      }
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12 * s);
    };

    hitArea.on('pointerover', () => { isHovered = true; updateVisual(); this.tweens.add({ targets: container, scale: 1.03, duration: 100 }); });
    hitArea.on('pointerout', () => { isHovered = false; updateVisual(); this.tweens.add({ targets: container, scale: 1, duration: 100 }); });
    hitArea.on('pointerdown', () => container.setScale(0.96));
    hitArea.on('pointerup', () => { 
      AudioManager.getInstance().playSFX('sfx_click'); 
      tgApp.hapticSelection();
      container.setScale(1.03); 
      onClick(); 
    });
  }

  // ==================== MODALS ====================

  private showModeSelection(): void {
    if (this.modalContainer || this.isTransitioning) return;
    this.isTransitioning = true;
    AudioManager.getInstance().playSFX('sfx_swish');

    this.createOverlay();
    
    const s = this.s;
    const modalW = Math.min(280 * s, this.cameras.main.width - 30);
    const modalH = 220 * s;
    
    this.modalContainer = this.createModalContainer(modalW, modalH);

    const colors = getColors();
    const fonts = getFonts();

    this.modalContainer.add(this.add.text(0, -modalH/2 + 25 * s, 'SELECT MODE', { 
      fontSize: `${16 * s}px`, 
      fontFamily: fonts.tech, 
      color: '#ffffff' 
    }).setOrigin(0.5));

    const faction = playerData.getFaction();
    const factionColor = faction ? FACTIONS[faction].color : colors.uiAccent;

    const btnW = modalW - 30 * s;
    const btnH = 55 * s;

    this.createModeButton(0, -25 * s, btnW, btnH, '🤖', 'VS AI', 'Play against bot', factionColor, () => this.closeModal(() => this.showDifficultySelection()));
    this.createModeButton(0, 40 * s, btnW, btnH, '⚔️', 'PVP ONLINE', 'Fight real players', colors.uiAccentPink, () => this.closeModal(() => this.scene.start('MatchmakingScene')));

    this.animateModalIn();
  }

  private createModeButton(x: number, y: number, w: number, h: number, icon: string, title: string, subtitle: string, color: number, onClick: () => void): void {
    const fonts = getFonts();
    const s = this.s;
    const btn = this.add.container(x, y);
    this.modalContainer!.add(btn);

    const bg = this.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(color, hover ? 0.25 : 0.15);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10 * s);
      bg.lineStyle(2, color, hover ? 0.9 : 0.5);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10 * s);
    };
    draw(false);
    btn.add(bg);

    btn.add(this.add.text(-w / 2 + 28 * s, 0, icon, { fontSize: `${22 * s}px` }).setOrigin(0.5));
    btn.add(this.add.text(-w / 2 + 55 * s, -7 * s, title, { 
      fontSize: `${13 * s}px`, 
      fontFamily: fonts.tech, 
      color: hexToString(color) 
    }).setOrigin(0, 0.5));
    btn.add(this.add.text(-w / 2 + 55 * s, 9 * s, subtitle, { 
      fontSize: `${9 * s}px`, 
      color: '#888888' 
    }).setOrigin(0, 0.5));
    btn.add(this.add.text(w / 2 - 20 * s, 0, '›', { 
      fontSize: `${20 * s}px`, 
      color: hexToString(color) 
    }).setOrigin(0.5));

    const hitArea = this.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
    btn.add(hitArea);

    hitArea.on('pointerover', () => { draw(true); btn.setScale(1.02); });
    hitArea.on('pointerout', () => { draw(false); btn.setScale(1); });
    hitArea.on('pointerdown', (p: Phaser.Input.Pointer) => { 
      p.event.stopPropagation(); 
      AudioManager.getInstance().playSFX('sfx_click'); 
      tgApp.hapticSelection();
      onClick(); 
    });
  }

  private showDifficultySelection(): void {
    if (this.modalContainer || this.isTransitioning) return;
    this.isTransitioning = true;
    AudioManager.getInstance().playSFX('sfx_swish');

    this.createOverlay();
    
    const s = this.s;
    const modalW = Math.min(280 * s, this.cameras.main.width - 30);
    const modalH = 280 * s;
    
    this.modalContainer = this.createModalContainer(modalW, modalH);

    const fonts = getFonts();

    this.modalContainer.add(this.add.text(0, -modalH/2 + 25 * s, i18n.t('selectDifficulty'), { 
      fontSize: `${16 * s}px`, 
      fontFamily: fonts.tech, 
      color: '#ffffff' 
    }).setOrigin(0.5));

    const difficulties: { id: AIDifficulty; name: string; desc: string; color: number; icon: string }[] = [
      { id: 'easy', name: i18n.t('easy'), desc: i18n.t('easyDesc'), color: 0x4ade80, icon: '⭐' },
      { id: 'medium', name: i18n.t('medium'), desc: i18n.t('mediumDesc'), color: 0xfbbf24, icon: '🔥' },
      { id: 'hard', name: i18n.t('hard'), desc: i18n.t('hardDesc'), color: 0xef4444, icon: '💀' },
    ];

    const btnW = modalW - 30 * s;
    const btnH = 52 * s;
    const gap = 8 * s;

    difficulties.forEach((diff, i) => {
      this.createDifficultyButton(0, -50 * s + i * (btnH + gap), btnW, btnH, diff);
    });

    this.animateModalIn();
  }

  private createDifficultyButton(x: number, y: number, w: number, h: number, diff: { id: AIDifficulty; name: string; desc: string; color: number; icon: string }): void {
    const fonts = getFonts();
    const s = this.s;
    const btn = this.add.container(x, y);
    this.modalContainer!.add(btn);

    const bg = this.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(diff.color, hover ? 0.2 : 0.1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10 * s);
      bg.lineStyle(1.5, diff.color, hover ? 0.9 : 0.5);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10 * s);
    };
    draw(false);
    btn.add(bg);

    btn.add(this.add.text(-w / 2 + 28 * s, 0, diff.icon, { fontSize: `${20 * s}px` }).setOrigin(0.5));
    btn.add(this.add.text(-w / 2 + 52 * s, -6 * s, diff.name, { 
      fontSize: `${13 * s}px`, 
      fontFamily: fonts.tech, 
      color: hexToString(diff.color) 
    }).setOrigin(0, 0.5));
    btn.add(this.add.text(-w / 2 + 52 * s, 9 * s, diff.desc, { 
      fontSize: `${8 * s}px`, 
      color: '#777788' 
    }).setOrigin(0, 0.5));
    btn.add(this.add.text(w / 2 - 18 * s, 0, '›', { 
      fontSize: `${18 * s}px`, 
      color: hexToString(diff.color) 
    }).setOrigin(0.5));

    const hitArea = this.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
    btn.add(hitArea);

    hitArea.on('pointerover', () => { draw(true); btn.setScale(1.015); });
    hitArea.on('pointerout', () => { draw(false); btn.setScale(1); });
    hitArea.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      if (!this.isTransitioning) {
        AudioManager.getInstance().playSFX('sfx_click');
        tgApp.hapticImpact('light');
        this.closeModal(() => this.scene.start('GameScene', { vsAI: true, difficulty: diff.id }));
      }
    });
  }

  private showLanguageSelection(isFirstLaunch: boolean = false): void {
    if (this.modalContainer || this.isTransitioning) return;
    this.isTransitioning = true;
    AudioManager.getInstance().playSFX('sfx_swish');

    const colors = getColors();
    const fonts = getFonts();
    const s = this.s;

    this.createOverlay();

    if (isFirstLaunch && this.overlay) this.overlay.removeAllListeners();

    const modalW = Math.min(260 * s, this.cameras.main.width - 30);
    const modalH = 220 * s;
    
    this.modalContainer = this.createModalContainer(modalW, modalH);

    this.modalContainer.add(this.add.text(0, -modalH/2 + 25 * s, '🌍', { fontSize: `${28 * s}px` }).setOrigin(0.5));
    this.modalContainer.add(this.add.text(0, -modalH/2 + 55 * s, i18n.t('selectLanguage'), { 
      fontSize: `${16 * s}px`, 
      fontFamily: fonts.tech, 
      color: '#ffffff' 
    }).setOrigin(0.5));

    const languages = i18n.getAvailableLanguages();
    const currentLang = i18n.getLanguage();

    const btnW = modalW - 30 * s;
    const btnH = 48 * s;
    const gap = 8 * s;

    languages.forEach((lang, i) => {
      this.createLanguageButton(0, -10 * s + i * (btnH + gap), btnW, btnH, lang, lang === currentLang, isFirstLaunch);
    });

    this.animateModalIn();
  }

  private createLanguageButton(x: number, y: number, w: number, h: number, lang: Language, isSelected: boolean, isFirstLaunch: boolean): void {
    const colors = getColors();
    const fonts = getFonts();
    const s = this.s;
    const container = this.add.container(x, y);
    this.modalContainer!.add(container);

    const flag = i18n.getLanguageFlag(lang);
    const name = i18n.getLanguageName(lang);

    const bg = this.add.graphics();
    const drawBg = (hover: boolean) => {
      bg.clear();
      const baseColor = isSelected ? colors.uiAccent : 0x2a2a3a;
      const borderColor = isSelected ? colors.uiAccent : hover ? 0x4a4a5a : 0x3a3a4a;
      bg.fillStyle(baseColor, isSelected ? 0.25 : 0.15);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10 * s);
      bg.lineStyle(2, borderColor, hover || isSelected ? 0.9 : 0.5);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10 * s);
    };
    drawBg(false);
    container.add(bg);

    container.add(this.add.text(-w / 2 + 28 * s, 0, flag, { fontSize: `${22 * s}px` }).setOrigin(0.5));
    container.add(this.add.text(-w / 2 + 55 * s, 0, name, { 
      fontSize: `${14 * s}px`, 
      fontFamily: fonts.tech, 
      color: isSelected ? hexToString(colors.uiAccent) : '#ffffff' 
    }).setOrigin(0, 0.5));

    if (isSelected) {
      container.add(this.add.text(w / 2 - 22 * s, 0, '✓', { 
        fontSize: `${16 * s}px`, 
        color: hexToString(colors.uiAccent) 
      }).setOrigin(0.5));
    }

    const hitArea = this.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerover', () => { drawBg(true); container.setScale(1.02); });
    hitArea.on('pointerout', () => { drawBg(false); container.setScale(1); });
    hitArea.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      if (!this.isTransitioning) {
        AudioManager.getInstance().playSFX('sfx_click');
        tgApp.hapticSelection();
        this.selectLanguage(lang, isFirstLaunch);
      }
    });
  }

  private selectLanguage(lang: Language, isFirstLaunch: boolean): void {
    i18n.setLanguage(lang);
    const data = playerData.get();
    data.settings.language = lang;
    playerData.save();

    if (isFirstLaunch) i18n.setFirstLaunchComplete();

    this.closeModal(() => this.scene.restart());
  }

  // ==================== FACTION SWITCH MODAL ====================

  private showFactionSwitchModal(): void {
    if (this.modalContainer || this.isTransitioning) return;
    this.isTransitioning = true;
    AudioManager.getInstance().playSFX('sfx_swish');

    this.createOverlay();
    
    const s = this.s;
    const ownedFactions = playerData.getOwnedFactions();
    const activeFaction = playerData.getFaction()!;
    
    const modalW = Math.min(280 * s, this.cameras.main.width - 30);
    const modalH = Math.min(90 + ownedFactions.length * 68, 400) * s;
    
    this.modalContainer = this.createModalContainer(modalW, modalH);

    const colors = getColors();
    const fonts = getFonts();

    this.modalContainer.add(this.add.text(0, -modalH/2 + 25 * s, '🛸 SWITCH FACTION', { 
      fontSize: `${16 * s}px`, 
      fontFamily: fonts.tech, 
      color: '#ffffff' 
    }).setOrigin(0.5));

    const btnW = modalW - 30 * s;
    const btnH = 58 * s;
    const gap = 10 * s;
    const startY = -modalH/2 + 60 * s;

    ownedFactions.forEach((factionId, i) => {
      const faction = FACTIONS[factionId];
      const isActive = factionId === activeFaction;
      const y = startY + i * (btnH + gap);
      
      this.createFactionSwitchButton(0, y, btnW, btnH, faction, isActive);
    });

    this.animateModalIn();
  }

  private createFactionSwitchButton(
    x: number, 
    y: number, 
    w: number, 
    h: number, 
    faction: FactionConfig,
    isActive: boolean
  ): void {
    const colors = getColors();
    const fonts = getFonts();
    const s = this.s;
    const btn = this.add.container(x, y);
    this.modalContainer!.add(btn);

    const bg = this.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      if (isActive) {
        bg.fillStyle(0x22c55e, 0.2);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10 * s);
        bg.lineStyle(2, 0x22c55e, 0.8);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10 * s);
      } else {
        bg.fillStyle(faction.color, hover ? 0.2 : 0.1);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10 * s);
        bg.lineStyle(2, faction.color, hover ? 0.8 : 0.5);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10 * s);
      }
    };
    draw(false);
    btn.add(bg);

    // Иконка
    const iconX = -w / 2 + 35 * s;
    if (this.textures.exists(faction.assetKey)) {
      const icon = this.add.image(iconX, 0, faction.assetKey);
      icon.setDisplaySize(40 * s, 40 * s);
      btn.add(icon);
    } else {
      btn.add(this.add.circle(iconX, 0, 20 * s, faction.color, 0.5));
    }

    // Название
    btn.add(this.add.text(-w / 2 + 65 * s, -8 * s, faction.name, { 
      fontSize: `${13 * s}px`, 
      fontFamily: fonts.tech, 
      color: isActive ? '#22c55e' : hexToString(faction.color) 
    }).setOrigin(0, 0.5));

    // Описание
    const desc = faction.name.split(' ').slice(1).join(' ') || faction.description.split('.')[0];
    btn.add(this.add.text(-w / 2 + 65 * s, 10 * s, desc, { 
      fontSize: `${8 * s}px`, 
      color: '#888888' 
    }).setOrigin(0, 0.5));

    // Индикатор
    if (isActive) {
      btn.add(this.add.text(w / 2 - 20 * s, 0, '✓', { 
        fontSize: `${18 * s}px`, 
        color: '#22c55e' 
      }).setOrigin(0.5));
    } else {
      btn.add(this.add.text(w / 2 - 20 * s, 0, '›', { 
        fontSize: `${20 * s}px`, 
        color: hexToString(faction.color) 
      }).setOrigin(0.5));
    }

    if (!isActive) {
      const hitArea = this.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
      btn.add(hitArea);

      hitArea.on('pointerover', () => { draw(true); btn.setScale(1.02); });
      hitArea.on('pointerout', () => { draw(false); btn.setScale(1); });
      hitArea.on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        if (!this.isTransitioning) {
          AudioManager.getInstance().playSFX('sfx_click');
          tgApp.hapticImpact('light');
          
          if (playerData.switchFaction(faction.id)) {
            this.closeModal(() => this.scene.restart());
          }
        }
      });
    }
  }

  // ==================== MODAL HELPERS ====================

  private createOverlay(): void {
    const { width, height } = this.cameras.main;
    this.overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0).setOrigin(0).setDepth(199).setInteractive();
    this.overlay.on('pointerdown', () => this.closeModal());
    this.tweens.add({ targets: this.overlay, alpha: 0.85, duration: 200 });
  }

  private createModalContainer(w: number, h: number): Phaser.GameObjects.Container {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const s = this.s;
    
    const faction = playerData.getFaction();
    const accentColor = faction ? FACTIONS[faction].color : colors.uiAccentPink;
    
    const container = this.add.container(width / 2, height / 2).setDepth(200);

    // Тень
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.4);
    shadow.fillRoundedRect(-w / 2 + 4, -h / 2 + 5, w, h, 16 * s);
    container.add(shadow);

    // Фон
    const bg = this.add.graphics();
    bg.fillStyle(0x14101e, 0.95);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 16 * s);
    bg.fillStyle(accentColor, 0.7);
    bg.fillRoundedRect(-40 * s, -h / 2 + 1, 80 * s, 3, 2);
    bg.lineStyle(2, accentColor, 0.4);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 16 * s);
    container.add(bg);

    // Свечение
    const glow = this.add.graphics();
    glow.lineStyle(5, accentColor, 0.1);
    glow.strokeRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, 18 * s);
    container.add(glow);

    return container;
  }

  private animateModalIn(): void {
    this.modalContainer?.setScale(0.85).setAlpha(0);
    this.tweens.add({
      targets: this.modalContainer,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => { this.isTransitioning = false; }
    });
  }

  private closeModal(callback?: () => void): void {
    if (this.isTransitioning && !callback) return;
    this.isTransitioning = true;

    const cleanup = () => {
      this.modalContainer?.destroy();
      this.modalContainer = undefined;
      this.overlay?.destroy();
      this.overlay = undefined;
      this.isTransitioning = false;
      callback?.();
    };

    if (this.modalContainer) {
      AudioManager.getInstance().playSFX('sfx_click');
      this.tweens.add({ targets: this.modalContainer, scale: 0.9, alpha: 0, duration: 150 });
    }

    if (this.overlay) {
      this.tweens.add({ targets: this.overlay, alpha: 0, duration: 150, onComplete: cleanup });
    } else {
      cleanup();
    }
  }

  // ==================== FOOTER ====================

  private createFooter(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const s = this.s;

    this.add.text(12 * s, height - 14 * s, 'v0.9.0-galaxy', { 
      fontSize: `${8 * s}px`, 
      color: '#333344' 
    });

    const line = this.add.graphics();
    line.lineStyle(1, colors.uiPrimary, 0.1);
    line.lineBetween(20 * s, height - 30 * s, width - 20 * s, height - 30 * s);
    line.fillStyle(colors.uiPrimary, 0.3);
    line.fillCircle(20 * s, height - 30 * s, 2);
    line.fillCircle(width - 20 * s, height - 30 * s, 2);
  }

  // ==================== UTILS ====================

  private formatNumber(num: number): string {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toString();
  }
}