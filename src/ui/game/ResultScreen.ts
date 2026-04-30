// src/ui/game/ResultScreen.ts
// ✅ COMPLETE REWRITE: Result Screen UI Overhaul with Victory/Defeat/Draw themes

import Phaser from 'phaser';
import { getColors, hexToString, getFonts } from '../../config/themes';
import { i18n } from '../../localization/i18n';
import { AudioManager } from '../../managers/AudioManager';
import { playerData } from '../../data/PlayerData';
import { MultiplayerManager } from '../../managers/MultiplayerManager';
import { MatchResult, Achievement } from '../../types/MatchResult';
import { Button } from '../Button';
import { FACTIONS, FactionId } from '../../constants/gameConstants';
import { getUIFactionByGameFaction } from '../../constants/factionUiConfig';

// Реэкспортируем для обратной совместимости
export type { MatchResult } from '../../types/MatchResult';

export interface ResultScreenCallbacks {
  onRematch: () => void;
  onMainMenu: () => void;
  onNextLevel?: () => void;
}

// ✅ НОВОЕ: Данные противника для консистентности
export interface OpponentData {
  opponentName?: string;
  opponentAvatarId?: string;
}

type ResultTheme = 'victory' | 'defeat' | 'draw';

interface ThemeColors {
  primary: number;
  secondary: number;
  accent: number;
  background: number;
  text: string;
}

export class ResultScreen {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Rectangle;
  private callbacks: ResultScreenCallbacks;
  private theme: ResultTheme;
  private godRaysContainer?: Phaser.GameObjects.Container;
  private confettiEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private rewardTexts: { coins?: Phaser.GameObjects.Text; xp?: Phaser.GameObjects.Text } = {};
  private opponentData: OpponentData; // ✅ НОВОЕ: Данные противника
  private backgroundImage?: Phaser.GameObjects.Image;
  private isDestroying = false;

  constructor(scene: Phaser.Scene, result: MatchResult, isAIMode: boolean, opponentData: OpponentData, callbacks: ResultScreenCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.opponentData = opponentData; // ✅ Сохраняем данные противника
    
    // Determine theme
    if (result.isWin) {
      this.theme = 'victory';
    } else if (result.isDraw) {
      this.theme = 'draw';
    } else {
      this.theme = 'defeat';
    }
    
    const { width, height } = scene.cameras.main;
    
    // Overlay
    this.overlay = scene.add.rectangle(0, 0, width, height, 0x000000, 0);
    this.overlay.setOrigin(0, 0).setDepth(400);
    
    scene.tweens.add({
      targets: this.overlay,
      fillAlpha: 0.9,
      duration: 300,
    });
    
    // Container
    this.container = scene.add.container(width / 2, height / 2);
    this.container.setDepth(401);
    
    // ✅ REMOVED: Audio is handled by GameScene to avoid duplicate/overlapping sounds
    // this.playThemeAudio();
    
    // Create background effects (before panel)
    this.createBackgroundEffects();
    
    // ✅ FIX: Special screen for tutorial completion
    if (result.isCampaign && result.levelName === '1-1' && result.isWin) {
      this.createTutorialResult(result);
    } else if (result.isCampaign) {
      this.createCampaignResult(result);
    } else {
      this.createStandardResult(result, isAIMode);
    }
    
    // Animate entrance
    this.animateEntrance();
  }

  // ========== THEME SYSTEM ==========

  private getThemeColors(): ThemeColors {
    switch (this.theme) {
      case 'victory':
        return {
          primary: 0xffd700,    // Gold
          secondary: 0x22c55e,   // Green
          accent: 0xffd700,
          background: 0x14101e,
          text: '#ffd700',
        };
      case 'draw':
        return {
          primary: 0x00f2ff,     // Cyber Cyan
          secondary: 0xffffff,   // White
          accent: 0x00f2ff,
          background: 0x14101e,
          text: '#00f2ff',
        };
      case 'defeat':
        return {
          primary: 0xff4444,    // Red
          secondary: 0x1a0505,   // Dark Grey
          accent: 0xff4444,
          background: 0x14101e,
          text: '#ff4444',
        };
    }
  }

  private playThemeAudio(): void {
    const audio = AudioManager.getInstance();
    switch (this.theme) {
      case 'victory':
        audio.playSFX('sfx_win');
        break;
      case 'defeat':
        audio.playSFX('sfx_lose');
        break;
      case 'draw':
        // Fallback to win sound if draw sound doesn't exist
        try {
          audio.playSFX('sfx_draw');
        } catch {
          audio.playSFX('sfx_win');
        }
        break;
    }
  }

  // ========== BACKGROUND EFFECTS ==========

  private createBackgroundEffects(): void {
    // ✅ NEW: Add themed background image
    this.createBackgroundImage();
    
    if (this.theme === 'victory') {
      this.createGodRays();
      this.createConfetti();
    } else if (this.theme === 'draw') {
      this.createNeonGlow();
    }
    // Defeat has no background effects (just the image)
  }

  private createBackgroundImage(): void {
    const { width, height } = this.scene.cameras.main;
    
    // Determine which background to use based on theme
    let bgKey = '';
    switch (this.theme) {
      case 'victory':
        bgKey = 'result_victory_bg';
        break;
      case 'defeat':
        bgKey = 'result_defeat_bg';
        break;
      case 'draw':
        bgKey = 'result_draw_bg';
        break;
    }
    
    // ✅ ИСПРАВЛЕНО: Проверяем существование текстуры с более подробным логированием
    if (!this.scene.textures.exists(bgKey)) {
      console.warn(`[ResultScreen] ❌ Background texture "${bgKey}" not found!`);
      console.warn(`[ResultScreen] Available textures:`, this.scene.textures.getTextureKeys().filter(k => k.includes('result')));
      console.warn(`[ResultScreen] Using fallback (no background image)`);
      return;
    }
    
    if (import.meta.env.DEV) {
      console.log(`[ResultScreen] ✅ Loading background: ${bgKey}`);
    }
    
    // Create background image
    const bg = this.scene.add.image(width / 2, height / 2, bgKey);
    this.backgroundImage = bg;
    bg.setDepth(400.4); // Between overlay (400) and effects (400.5)
    
    // Scale to cover screen while maintaining aspect ratio
    const scaleX = width / bg.width;
    const scaleY = height / bg.height;
    const scale = Math.max(scaleX, scaleY);
    bg.setScale(scale);
    
    if (import.meta.env.DEV) {
      console.log(`[ResultScreen] ✅ Background scaled: ${scale.toFixed(2)}x (${bg.width}x${bg.height} -> ${width}x${height})`);
    }
    
    // Fade in animation
    bg.setAlpha(0);
    this.scene.tweens.add({
      targets: bg,
      alpha: 0.85, // Slightly transparent so UI is readable
      duration: 400,
      ease: 'Power2',
    });
  }

  private createGodRays(): void {
    const { width, height } = this.scene.cameras.main;
    this.godRaysContainer = this.scene.add.container(0, 0);
    this.godRaysContainer.setDepth(400.5);
    
    const rays = this.scene.add.graphics();
    this.godRaysContainer.add(rays);
    
    const centerX = width / 2;
    const centerY = height / 2;
    const rayCount = 8;
    const rayLength = Math.max(width, height) * 0.8;
    
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      const startAngle = angle - 0.15;
      const endAngle = angle + 0.15;
      
      // Draw trapezoid ray
      rays.fillStyle(0xffd700, 0.12);
      rays.beginPath();
      rays.moveTo(centerX, centerY);
      
      const innerRadius = 50;
      const outerRadius = rayLength;
      
      const x1 = centerX + Math.cos(startAngle) * innerRadius;
      const y1 = centerY + Math.sin(startAngle) * innerRadius;
      const x2 = centerX + Math.cos(endAngle) * innerRadius;
      const y2 = centerY + Math.sin(endAngle) * innerRadius;
      const x3 = centerX + Math.cos(endAngle) * outerRadius;
      const y3 = centerY + Math.sin(endAngle) * outerRadius;
      const x4 = centerX + Math.cos(startAngle) * outerRadius;
      const y4 = centerY + Math.sin(startAngle) * outerRadius;
      
      rays.moveTo(x1, y1);
      rays.lineTo(x2, y2);
      rays.lineTo(x3, y3);
      rays.lineTo(x4, y4);
      rays.closePath();
      rays.fillPath();
    }
    
    // Rotate continuously
    this.scene.tweens.add({
      targets: this.godRaysContainer,
      angle: 360,
      duration: 15000,
      repeat: -1,
      ease: 'Linear',
    });
  }

  private createConfetti(): void {
    // Generate confetti texture if it doesn't exist
    if (!this.scene.textures.exists('ui_confetti')) {
      const graphics = this.scene.add.graphics();
      graphics.fillStyle(0xffffff, 1);
      graphics.fillRect(0, 0, 8, 8);
      graphics.generateTexture('ui_confetti', 8, 8);
      graphics.destroy();
    }
    
    const { width, height } = this.scene.cameras.main;
    const particles = this.scene.add.particles(width / 2, height / 2, 'ui_confetti', {
      speed: { min: 100, max: 300 },
      scale: { start: 0.8, end: 0 },
      lifespan: 3000,
      frequency: 50,
      tint: [0xffd700, 0x22c55e, 0xff6b35, 0xffaa00],
      gravityY: 200,
      emitting: true,
      emitZone: {
        type: 'edge',
        source: new Phaser.Geom.Rectangle(-100, 0, 200, 0),
        quantity: 40
      }
    });
    
    particles.setDepth(400.6);
    this.confettiEmitter = particles;
    
    // Stop after 5 seconds
    this.scene.time.delayedCall(5000, () => {
      if (particles) {
        particles.stop();
      }
    });
  }

  private createNeonGlow(): void {
    // Steady neon glow effect for draw theme
    const { width, height } = this.scene.cameras.main;
    const glow = this.scene.add.graphics();
    glow.fillStyle(0x00f2ff, 0.08);
    glow.fillRect(0, 0, width, height);
    glow.setDepth(400.5);
    
    // Pulse animation
    this.scene.tweens.add({
      targets: glow,
      alpha: { from: 0.08, to: 0.15 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // ========== STANDARD RESULT ==========

  private createStandardResult(result: MatchResult, isAIMode: boolean): void {
    if (import.meta.env.DEV) {
      console.debug('[ResultScreen] Creating standard result', {
        achievementsCount: result.newAchievements?.length || 0,
        hasMastery: !!result.masteryXP,
        isPerfect: result.isPerfectGame
      });
    }
    
    const colors = getColors();
    const fonts = getFonts();
    const themeColors = this.getThemeColors();
    
    const panelWidth = 340;
    
    // ✅ ИСПРАВЛЕНО: Динамический расчет высоты панели
    let contentHeight = 200; // Base: icon + title + score + players
    
    if (result.isPerfectGame) contentHeight += 30; // Perfect badge
    contentHeight += 70; // Rewards section
    if (result.masteryXP) contentHeight += 85; // Mastery section
    
    // Achievements: показываем максимум 2 достижения чтобы всё влезло
    if (result.newAchievements.length > 0) {
      const displayCount = Math.min(2, result.newAchievements.length);
      contentHeight += 30 + (displayCount * 60) + 10; // Header + achievements + spacing
    }
    
    contentHeight += 70; // Buttons section
    
    // Ограничиваем максимальную высоту экраном
    const { height: screenHeight } = this.scene.cameras.main;
    const maxPanelHeight = screenHeight - 100; // 50px padding сверху/снизу
    const panelHeight = Math.min(contentHeight, maxPanelHeight);
    
    // Panel background with theme glow
    const glow = this.scene.add.graphics();
    glow.lineStyle(12, themeColors.primary, 0.15);
    glow.strokeRoundedRect(-panelWidth / 2 - 6, -panelHeight / 2 - 6, panelWidth + 12, panelHeight + 12, 24);
    this.container.add(glow);
    
    const panel = this.scene.add.graphics();
    panel.fillStyle(themeColors.background, 0.98);
    panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    
    // Top accent header
    panel.fillStyle(themeColors.primary, 0.7);
    panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2 + 1, panelWidth, 4, 2);
    
    panel.lineStyle(2, themeColors.primary, 0.6);
    panel.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    this.container.add(panel);
    
    // Header with icon
    const iconY = -panelHeight / 2 + 80;
    const icon = this.getThemeIcon();
    this.container.add(this.scene.add.text(0, iconY, icon, {
      fontSize: '48px',
    }).setOrigin(0.5));
    
    // Title
    const titleText = this.getTitleText(result, isAIMode);
    this.container.add(this.scene.add.text(0, iconY + 70, titleText.toUpperCase(), {
      fontSize: '24px',
      fontFamily: fonts.tech,
      color: themeColors.text,
      letterSpacing: 2,
    }).setOrigin(0.5));
    
    // Score
    const scoreY = iconY + 115;
    this.container.add(this.scene.add.text(0, scoreY, `${result.playerGoals} : ${result.opponentGoals}`, {
      fontSize: '52px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5));
    
    // Players row
    const mp = MultiplayerManager.getInstance();
    const isNetworkPvP = !!mp.getGameData();
    this.createPlayersRow(scoreY + 35, isNetworkPvP, isAIMode);
    
    // Perfect game badge
    if (result.isPerfectGame) {
      const badgeY = scoreY + 45;
      const badgeBg = this.scene.add.graphics();
      badgeBg.fillStyle(colors.uiGold, 0.2);
      badgeBg.fillRoundedRect(-70, badgeY - 14, 140, 28, 14);
      badgeBg.lineStyle(1.5, colors.uiGold, 0.8);
      badgeBg.strokeRoundedRect(-70, badgeY - 14, 140, 28, 14);
      this.container.add(badgeBg);
      
      this.container.add(this.scene.add.text(0, badgeY, '⭐ ' + i18n.t('cleanSheet'), {
        fontSize: '12px',
        fontFamily: fonts.tech,
        color: hexToString(colors.uiGold),
      }).setOrigin(0.5));
    }
    
    // Rewards section with rolling numbers
    const rewardsY = result.isPerfectGame ? scoreY + 90 : scoreY + 60;
    this.createRewardsSection(rewardsY, result, panelWidth);
    
    // Faction Mastery section
    if (result.masteryXP) {
      const masteryY = rewardsY + 95;
      this.createMasterySection(masteryY, result, panelWidth);
    }
    
    // ✅ УЛУЧШЕНО: Achievements с красивым дизайном
    if (result.newAchievements.length > 0) {
      const achY = result.masteryXP ? rewardsY + 180 : rewardsY + 95;
      if (import.meta.env.DEV) {
        console.debug('[ResultScreen] Creating achievements section', {
          achY, rewardsY, achievementsCount: result.newAchievements.length, panelHeight
        });
      }
      this.createAchievementsSection(achY, result.newAchievements, panelWidth);
    }
    
    // Buttons
    const btnY = panelHeight / 2 - 55;
    const btnWidth = 130;
    
    // Rematch
    this.createButton(-75, btnY, btnWidth, 48, '🔄', i18n.t('rematch'), colors.uiAccent, () => {
      this.hide(() => this.callbacks.onRematch());
    });
    
    // To Menu
    this.createButton(75, btnY, btnWidth, 48, '🏠', i18n.t('toMenu'), colors.uiAccentPink, () => {
      this.hide(() => this.callbacks.onMainMenu());
    });
  }

  // ========== TUTORIAL RESULT ==========

  private createTutorialResult(result: MatchResult): void {
    const colors = getColors();
    const fonts = getFonts();
    const themeColors = this.getThemeColors();
    
    const panelWidth = 340;
    const panelHeight = 480;
    
    // Panel background with special glow
    const glow = this.scene.add.graphics();
    glow.lineStyle(12, 0xffd700, 0.25);
    glow.strokeRoundedRect(-panelWidth / 2 - 6, -panelHeight / 2 - 6, panelWidth + 12, panelHeight + 12, 24);
    this.container.add(glow);
    
    const panel = this.scene.add.graphics();
    panel.fillStyle(0x1a0a1a, 0.98);
    panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    panel.fillStyle(0xffd700, 0.8);
    panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2 + 1, panelWidth, 4, 2);
    panel.lineStyle(2, 0xffd700, 0.7);
    panel.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    this.container.add(panel);
    
    let currentY = -panelHeight / 2 + 50;
    
    // Title: "ОБУЧЕНИЕ ЗАВЕРШЕНО!"
    this.container.add(this.scene.add.text(0, currentY, '🎓 ОБУЧЕНИЕ ЗАВЕРШЕНО!', {
      fontSize: '24px',
      fontFamily: fonts.tech,
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5));
    currentY += 50;
    
    // Rewards section
    const rewardsBg = this.scene.add.graphics();
    rewardsBg.fillStyle(0xffffff, 0.05);
    rewardsBg.fillRoundedRect(-panelWidth / 2 + 25, currentY - 15, panelWidth - 50, 140, 12);
    rewardsBg.lineStyle(1, 0xffd700, 0.3);
    rewardsBg.strokeRoundedRect(-panelWidth / 2 + 25, currentY - 15, panelWidth - 50, 140, 12);
    this.container.add(rewardsBg);
    
    // Reward 1: Faction unlocked (Magma)
    const factionY = currentY + 10;
    let factionIcon: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
    if (this.scene.textures.exists('icon_faction_magma')) {
      factionIcon = this.scene.add.image(-60, factionY, 'icon_faction_magma');
      factionIcon.setDisplaySize(40, 40);
    } else {
      // Fallback: colored circle
      const gfx = this.scene.add.graphics();
      gfx.fillStyle(0xff4500, 1);
      gfx.fillCircle(-60, factionY, 20);
      factionIcon = gfx;
    }
    this.container.add(factionIcon);
    
    this.container.add(this.scene.add.text(-20, factionY, 'Фракция разблокирована', {
      fontSize: '14px',
      fontFamily: fonts.tech,
      color: '#ffffff',
    }).setOrigin(0, 0.5));
    
    // Reward 2: Coins
    const coinsY = currentY + 60;
    this.container.add(this.scene.add.text(-60, coinsY, '💰', { fontSize: '32px' }).setOrigin(0.5));
    const coinsText = this.scene.add.text(-20, coinsY, '0 монет', {
      fontSize: '14px',
      fontFamily: fonts.tech,
      color: hexToString(colors.uiGold),
    }).setOrigin(0, 0.5);
    this.container.add(coinsText);
    // Animate from 0 to 500 with "монет" suffix
    const counterTarget = { value: 0 };
    this.scene.tweens.add({
      targets: counterTarget,
      value: 500,
      duration: 1500,
      delay: 500,
      ease: 'Power1',
      onUpdate: () => {
        const currentValue = Math.floor(counterTarget.value);
        coinsText.setText(`${currentValue} монет`);
      },
    });
    
    currentY += 160;
    
    // Button: "В ГЛАВНОЕ МЕНЮ"
    const btnY = panelHeight / 2 - 55;
    this.createButton(0, btnY, 200, 50, '🏠', 'В ГЛАВНОЕ МЕНЮ', 0xffd700, () => {
      this.hide(() => this.callbacks.onMainMenu());
    });
  }

  // ========== CAMPAIGN RESULT ==========

  private createCampaignResult(result: MatchResult): void {
    const colors = getColors();
    const fonts = getFonts();
    const themeColors = this.getThemeColors();
    const isWin = result.isWin;
    
    const panelWidth = 340;
    const panelHeight = 520;
    
    // Panel background
    const glow = this.scene.add.graphics();
    glow.lineStyle(12, themeColors.primary, 0.15);
    glow.strokeRoundedRect(-panelWidth / 2 - 6, -panelHeight / 2 - 6, panelWidth + 12, panelHeight + 12, 24);
    this.container.add(glow);
    
    const panel = this.scene.add.graphics();
    panel.fillStyle(themeColors.background, 0.98);
    panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    panel.fillStyle(themeColors.primary, 0.7);
    panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2 + 1, panelWidth, 4, 2);
    panel.lineStyle(2, themeColors.primary, 0.6);
    panel.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    this.container.add(panel);
    
    let currentY = -panelHeight / 2 + 50;
    
    // Icon
    const icon = this.getThemeIcon();
    this.container.add(this.scene.add.text(0, currentY, icon, {
      fontSize: '48px',
    }).setOrigin(0.5));
    currentY += 55;
    
    // Level name
    if (result.levelName) {
      this.container.add(this.scene.add.text(0, currentY, result.levelName.toUpperCase(), {
        fontSize: '14px',
        fontFamily: fonts.tech,
        color: '#888888',
      }).setOrigin(0.5));
      currentY += 25;
    }
    
    // Status
    const statusText = isWin 
      ? (result.isFirstClear ? '🎉 LEVEL COMPLETE!' : '✅ VICTORY!')
      : (this.theme === 'draw' ? '⚖️ STALEMATE' : '❌ TRY AGAIN');
    
    this.container.add(this.scene.add.text(0, currentY, statusText, {
      fontSize: '22px',
      fontFamily: fonts.tech,
      color: themeColors.text,
    }).setOrigin(0.5));
    currentY += 40;
    
    // Score
    this.container.add(this.scene.add.text(0, currentY, `${result.playerGoals} : ${result.opponentGoals}`, {
      fontSize: '42px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5));
    currentY += 50;
    
    // Stars (only for wins)
    if (isWin && result.starsEarned !== undefined) {
      const starsY = currentY;
      const starsContainer = this.scene.add.container(0, starsY);
      this.container.add(starsContainer);
      
      const starsBg = this.scene.add.graphics();
      starsBg.fillStyle(0xffd700, 0.1);
      starsBg.fillRoundedRect(-80, -25, 160, 50, 12);
      starsContainer.add(starsBg);
      
      for (let i = 0; i < 3; i++) {
        const starX = -40 + i * 40;
        const isFilled = i < (result.starsEarned || 0);
        
        const star = this.scene.add.text(starX, 0, isFilled ? '⭐' : '☆', {
          fontSize: '28px',
          color: isFilled ? '#ffd700' : '#444444',
        }).setOrigin(0.5);
        starsContainer.add(star);
        
        // Staggered pop animation
        if (isFilled) {
          star.setScale(0);
          this.scene.tweens.add({
            targets: star,
            scale: 1,
            duration: 400,
            delay: 300 + i * 200,
            ease: 'Back.easeOut',
          });
        }
      }
      
      currentY += 60;
    }
    
    // Rewards (only for wins)
    if (isWin) {
      const rewardsBg = this.scene.add.graphics();
      rewardsBg.fillStyle(0xffffff, 0.03);
      rewardsBg.fillRoundedRect(-panelWidth / 2 + 25, currentY - 15, panelWidth - 50, 70, 12);
      this.container.add(rewardsBg);
      
      if (result.isFirstClear) {
        this.container.add(this.scene.add.text(0, currentY - 5, '🎁 FIRST CLEAR BONUS!', {
          fontSize: '10px',
          fontFamily: fonts.tech,
          color: '#22c55e',
        }).setOrigin(0.5));
        currentY += 15;
      }
      
      // XP with rolling animation
      const xpX = -60;
      this.container.add(this.scene.add.text(xpX, currentY + 5, '⚡', { fontSize: '20px' }).setOrigin(0.5));
      const xpText = this.scene.add.text(xpX, currentY + 28, '+0 XP', {
        fontSize: '14px',
        fontFamily: fonts.tech,
        color: '#a855f7',
      }).setOrigin(0.5);
      this.container.add(xpText);
      this.animateRollingNumber(xpText, result.xpEarned, 'XP', 0);
      
      // Coins with rolling animation
      const coinsX = 60;
      this.container.add(this.scene.add.text(coinsX, currentY + 5, '💰', { fontSize: '20px' }).setOrigin(0.5));
      const coinsText = this.scene.add.text(coinsX, currentY + 28, '+0', {
        fontSize: '14px',
        fontFamily: fonts.tech,
        color: hexToString(colors.uiGold),
      }).setOrigin(0.5);
      this.container.add(coinsText);
      this.animateRollingNumber(coinsText, result.coinsEarned, '', 500);
      
      currentY += 65;
      
      // Unlocked unit
      if (result.unlockedUnitId) {
        const unlockBg = this.scene.add.graphics();
        unlockBg.fillStyle(0x9d00ff, 0.15);
        unlockBg.fillRoundedRect(-panelWidth / 2 + 25, currentY, panelWidth - 50, 36, 10);
        this.container.add(unlockBg);
        
        this.container.add(this.scene.add.text(0, currentY + 18, `🎁 New Unit Unlocked!`, {
          fontSize: '12px',
          fontFamily: fonts.tech,
          color: '#cc44ff',
        }).setOrigin(0.5));
        currentY += 45;
      }
      
      // ✅ ДОБАВЛЕНО: Достижения в кампании
      if (result.newAchievements && result.newAchievements.length > 0) {
        this.createAchievementsSection(currentY + 30, result.newAchievements, panelWidth);
        currentY += result.newAchievements.slice(0, 3).length * 50 + 60;
      }
    }
    
    // Unlocked next chapter
    if (result.unlockedNextChapter) {
      const unlockY = currentY + 5;
      const unlockBg = this.scene.add.graphics();
      unlockBg.fillStyle(0xffd700, 0.15);
      unlockBg.fillRoundedRect(-panelWidth / 2 + 25, unlockY - 15, panelWidth - 50, 30, 10);
      this.container.add(unlockBg);
      
      this.container.add(this.scene.add.text(0, unlockY, '🔓 New Chapter Unlocked!', {
        fontSize: '12px',
        fontFamily: fonts.tech,
        color: '#ffd700',
      }).setOrigin(0.5));
      
      this.scene.tweens.add({
        targets: unlockBg,
        alpha: { from: 1, to: 0.5 },
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
    }
    
    // Buttons
    const btnY = panelHeight / 2 - 55;
    const btnWidth = isWin && result.unlockedNextLevel && this.callbacks.onNextLevel ? 95 : 130;
    
    if (isWin) {
      // Retry
      this.createButton(-110, btnY, btnWidth, 48, '🔄', i18n.t('retry') || 'Retry', 0x666666, () => {
        this.hide(() => this.callbacks.onRematch());
      });
      
      // Campaign Menu
      this.createButton(0, btnY, btnWidth, 48, '📋', i18n.t('levels') || 'Levels', colors.uiAccentPink, () => {
        this.hide(() => this.callbacks.onMainMenu());
      });
      
      // Next Level
      if (result.unlockedNextLevel && this.callbacks.onNextLevel) {
        this.createButton(110, btnY, btnWidth, 48, '▶️', i18n.t('next') || 'Next', colors.uiAccent, () => {
          this.hide(() => this.callbacks.onNextLevel!());
        });
      }
    } else {
      // Retry
      this.createButton(-75, btnY, 130, 48, '🔄', i18n.t('retry') || 'Retry', colors.uiAccent, () => {
        this.hide(() => this.callbacks.onRematch());
      });
      
      // Back to Levels
      this.createButton(75, btnY, 130, 48, '📋', i18n.t('levels') || 'Levels', colors.uiAccentPink, () => {
        this.hide(() => this.callbacks.onMainMenu());
      });
    }
  }

  // ========== HELPER METHODS ==========

  private getThemeIcon(): string {
    switch (this.theme) {
      case 'victory':
        return '🏆';
      case 'draw':
        return '🤝';
      case 'defeat':
        return '💔';
    }
  }

  private getTitleText(result: MatchResult, isAIMode: boolean): string {
    switch (this.theme) {
      case 'victory':
        return i18n.t('youWon');
      case 'draw':
        return i18n.t('draw') || 'DRAW';
      case 'defeat':
        return isAIMode ? i18n.t('aiWins') : i18n.t('player2Wins');
    }
  }

  private createPlayersRow(y: number, isNetworkPvP: boolean, isAIMode: boolean): void {
    const colors = getColors();
    const fonts = getFonts();

    const playerNick = playerData.getNickname ? playerData.getNickname() : playerData.get().username;
    const playerAvatarId = playerData.getAvatarId ? playerData.getAvatarId() : undefined;

    let opponentName = '';
    let opponentAvatarId: string | undefined;

    if (isNetworkPvP) {
      const mp = MultiplayerManager.getInstance();
      const opp = mp.getOpponent();
      opponentName = this.opponentData.opponentName || opp?.name || 'Opponent';
      opponentAvatarId = this.opponentData.opponentAvatarId || opp?.avatarId;
    } else if (isAIMode) {
      // ✅ ИСПРАВЛЕНО: Используем ПЕРЕДАННЫЕ данные противника для консистентности
      opponentName = this.opponentData.opponentName || 'AI';
      opponentAvatarId = this.opponentData.opponentAvatarId;
      
      // Проверяем существование аватара
      if (opponentAvatarId && !this.scene.textures.exists(opponentAvatarId)) {
        console.warn(`[ResultScreen] Opponent avatar texture missing: ${opponentAvatarId}`);
        opponentAvatarId = undefined;
      }
    } else {
      opponentName = i18n.t('player2') || 'Player 2';
    }

    const row = this.scene.add.container(0, y);
    this.container.add(row);

    // ✅ УЛУЧШЕНО: Фон для лучшей читаемости
    const rowBg = this.scene.add.graphics();
    rowBg.fillStyle(0x000000, 0.4);
    rowBg.fillRoundedRect(-160, -18, 320, 36, 8);
    row.add(rowBg);

    // Left: local player
    const left = this.scene.add.container(-90, 0);
    row.add(left);

    this.addAvatarIcon(left, -22, 0, playerAvatarId, colors.uiAccent);
    
    // ✅ УЛУЧШЕНО: Текст с тенью для читаемости
    const playerNameText = this.scene.add.text(0, 0, playerNick, {
      fontSize: '13px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0, 0.5);
    left.add(playerNameText);

    // Right: opponent
    const right = this.scene.add.container(90, 0);
    row.add(right);

    this.addAvatarIcon(right, 22, 0, opponentAvatarId, colors.uiAccentPink);
    
    // ✅ УЛУЧШЕНО: Текст с тенью для читаемости
    const opponentNameText = this.scene.add.text(0, 0, opponentName, {
      fontSize: '13px',
      fontFamily: fonts.tech,
      color: hexToString(colors.uiAccentPink),
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 0.5);
    right.add(opponentNameText);
  }

  private addAvatarIcon(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    avatarId: string | undefined,
    color: number
  ): void {
    const radius = 16;

    if (avatarId && this.scene.textures.exists(avatarId)) {
      const glow = this.scene.add.circle(x, y, radius + 4, color, 0.25);
      const border = this.scene.add.circle(x, y, radius + 2, color, 0.8);
      parent.add(glow);
      parent.add(border);

      const image = this.scene.add.image(x, y, avatarId);
      image.setDisplaySize(radius * 2, radius * 2);
      parent.add(image);
    } else {
      const circle = this.scene.add.circle(x, y, radius, color, 0.9);
      parent.add(circle);
    }
  }

  private createRewardsSection(y: number, result: MatchResult, panelWidth: number): void {
    const colors = getColors();
    const fonts = getFonts();
    
    const bg = this.scene.add.graphics();
    bg.fillStyle(0xffffff, 0.03);
    bg.fillRoundedRect(-panelWidth / 2 + 25, y - 15, panelWidth - 50, 70, 12);
    bg.lineStyle(1, colors.glassBorder, 0.1);
    bg.strokeRoundedRect(-panelWidth / 2 + 25, y - 15, panelWidth - 50, 70, 12);
    this.container.add(bg);
    
    // XP with rolling animation
    const xpX = -60;
    this.container.add(this.scene.add.text(xpX, y + 5, '⚡', { fontSize: '20px' }).setOrigin(0.5));
    const xpText = this.scene.add.text(xpX, y + 30, '+0 XP', {
      fontSize: '14px',
      fontFamily: fonts.tech,
      color: '#a855f7',
    }).setOrigin(0.5);
    this.container.add(xpText);
    this.rewardTexts.xp = xpText;
    this.animateRollingNumber(xpText, result.xpEarned, 'XP', 0);
    
    // Coins with rolling animation
    const coinsX = 60;
    this.container.add(this.scene.add.text(coinsX, y + 5, '💰', { fontSize: '20px' }).setOrigin(0.5));
    const coinsText = this.scene.add.text(coinsX, y + 30, '+0', {
      fontSize: '14px',
      fontFamily: fonts.tech,
      color: hexToString(colors.uiGold),
    }).setOrigin(0.5);
    this.container.add(coinsText);
    this.rewardTexts.coins = coinsText;
    this.animateRollingNumber(coinsText, result.coinsEarned, '', 500);
  }

  private createMasterySection(y: number, result: MatchResult, panelWidth: number): void {
    if (!result.masteryXP) return;
    
    const colors = getColors();
    const fonts = getFonts();
    const themeColors = this.getThemeColors();
    
    // Get faction info
    const factionIdStr = result.masteryXP.factionId;
    let faction: typeof FACTIONS[keyof typeof FACTIONS] | null = null;
    let factionName = 'Faction';
    
    if (factionIdStr) {
      // Try to find faction by ID
      const possibleIds: FactionId[] = ['magma', 'cyborg', 'void', 'insect'];
      const matchedId = possibleIds.find(id => id === factionIdStr);
      if (matchedId && FACTIONS[matchedId]) {
        faction = FACTIONS[matchedId];
        factionName = faction.name;
      }
    }
    
    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.3);
    bg.fillRoundedRect(-panelWidth / 2 + 25, y - 20, panelWidth - 50, 60, 12);
    bg.lineStyle(1.5, themeColors.primary, 0.5);
    bg.strokeRoundedRect(-panelWidth / 2 + 25, y - 20, panelWidth - 50, 60, 12);
    this.container.add(bg);
    
    // Faction name
    this.container.add(this.scene.add.text(0, y - 5, `${factionName} Mastery`, {
      fontSize: '12px',
      fontFamily: fonts.tech,
      color: themeColors.text,
    }).setOrigin(0.5));
    
    // Progress bar background
    const barWidth = panelWidth - 80;
    const barHeight = 20;
    const barX = -barWidth / 2;
    const barY = y + 10;
    
    const barBg = this.scene.add.graphics();
    barBg.fillStyle(0x000000, 0.5);
    barBg.fillRoundedRect(barX, barY - barHeight / 2, barWidth, barHeight, 10);
    this.container.add(barBg);
    
    // Progress bar fill
    const fillWidth = barWidth * 0.55; // Visual mock: 40-70% fill
    const barFill = this.scene.add.graphics();
    this.container.add(barFill);
    
    // Animate fill
    barFill.fillStyle(themeColors.primary, 0.8);
    const fillTarget = { width: 0 };
    this.scene.tweens.add({
      targets: fillTarget,
      width: fillWidth,
      duration: 1000,
      delay: 1000,
      ease: 'Power2',
      onUpdate: () => {
        barFill.clear();
        barFill.fillStyle(themeColors.primary, 0.8);
        barFill.fillRoundedRect(barX, barY - barHeight / 2, fillTarget.width, barHeight, 10);
      },
    });
    
    // XP text
    this.container.add(this.scene.add.text(0, barY + 15, `+${result.masteryXP.totalXP} XP`, {
      fontSize: '11px',
      fontFamily: fonts.tech,
      color: themeColors.text,
    }).setOrigin(0.5));
    
    // Level Up badge
    if (result.masteryLevelUp) {
      const badgeY = y - 25;
      const badgeBg = this.scene.add.graphics();
      badgeBg.fillStyle(0xffd700, 0.3);
      badgeBg.fillRoundedRect(-60, badgeY - 12, 120, 24, 12);
      badgeBg.lineStyle(2, 0xffd700, 1);
      badgeBg.strokeRoundedRect(-60, badgeY - 12, 120, 24, 12);
      this.container.add(badgeBg);
      
      this.container.add(this.scene.add.text(0, badgeY, '⭐ LEVEL UP!', {
        fontSize: '11px',
        fontFamily: fonts.tech,
        color: '#ffd700',
        fontStyle: 'bold',
      }).setOrigin(0.5));
      
      // Pulse animation
      this.scene.tweens.add({
        targets: badgeBg,
        alpha: { from: 1, to: 0.6 },
        duration: 600,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private animateRollingNumber(
    textObj: Phaser.GameObjects.Text,
    targetValue: number,
    suffix: string,
    delay: number
  ): void {
    const duration = 1500;
    const startValue = 0;
    
    const counterTarget = { value: startValue };
    this.scene.tweens.add({
      targets: counterTarget,
      value: targetValue,
      duration: duration,
      delay: delay,
      ease: 'Power1',
      onUpdate: () => {
        const currentValue = Math.floor(counterTarget.value);
        const displayText = suffix ? `+${currentValue} ${suffix}` : `+${currentValue}`;
        textObj.setText(displayText);
      },
    });
  }

  /**
   * ✅ НОВОЕ: Создать красивую секцию достижений
   */
  private createAchievementsSection(
    y: number,
    achievements: Achievement[],
    panelWidth: number
  ): void {
    const fonts = getFonts();
    
    if (import.meta.env.DEV) {
      console.debug('[ResultScreen] Creating achievements section', { y, achievementsCount: achievements.length, panelWidth });
    }
    
    // Определяем цвет по редкости
    const getRarityColor = (rarity?: string): number => {
      switch (rarity) {
        case 'legendary': return 0xffd700; // Золотой
        case 'epic': return 0xa855f7;      // Фиолетовый
        case 'rare': return 0x3b82f6;      // Синий
        default: return 0x22c55e;           // Зеленый
      }
    };
    
    const getRarityGlow = (rarity?: string): number => {
      switch (rarity) {
        case 'legendary': return 0.4;
        case 'epic': return 0.3;
        case 'rare': return 0.25;
        default: return 0.2;
      }
    };
    
    // ✅ ИСПРАВЛЕНО: Показываем максимум 3 достижения компактно
    const maxDisplay = 3;
    const displayAchievements = achievements.slice(0, maxDisplay);
    const remainingCount = Math.max(0, achievements.length - maxDisplay);
    const heightPerAchievement = 48; // Было 60, уменьшили до 48
    const totalHeight = displayAchievements.length * heightPerAchievement + 25; // Было +30
    
    if (import.meta.env.DEV) {
      console.debug('[ResultScreen] Achievements section dimensions', {
        displayCount: displayAchievements.length,
        heightPerAch: heightPerAchievement,
        totalHeight,
        remainingCount,
        finalY: y + totalHeight
      });
    }
    
    // Заголовок секции
    const headerY = y - totalHeight / 2 - 15;
    this.container.add(this.scene.add.text(0, headerY, '🎉 НОВЫЕ ДОСТИЖЕНИЯ!', {
      fontSize: '14px',
      fontFamily: fonts.tech,
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5));
    
    // Контейнер для достижений
    const achContainer = this.scene.add.container(0, y - totalHeight / 2 + 25);
    this.container.add(achContainer);
    
    displayAchievements.forEach((ach, index) => {
      const achY = index * heightPerAchievement;
      const rarityColor = getRarityColor(ach.rarity);
      const glowAlpha = getRarityGlow(ach.rarity);
      
      // ✅ ИСПРАВЛЕНО: Компактный фон для достижения с свечением
      const achBg = this.scene.add.graphics();
      const achHeight = 38; // Было 45, уменьшили
      const achPadding = 15; // Было 20
      
      // Внешнее свечение
      achBg.lineStyle(2, rarityColor, glowAlpha); // Было 3
      achBg.strokeRoundedRect(-panelWidth / 2 + achPadding, achY - achHeight/2, panelWidth - achPadding*2, achHeight, 8);
      
      // Основной фон
      achBg.fillStyle(0x000000, 0.6);
      achBg.fillRoundedRect(-panelWidth / 2 + achPadding, achY - achHeight/2, panelWidth - achPadding*2, achHeight, 8);
      
      // Внутренняя рамка
      achBg.lineStyle(1.5, rarityColor, 0.8);
      achBg.strokeRoundedRect(-panelWidth / 2 + achPadding, achY - achHeight/2, panelWidth - achPadding*2, achHeight, 8);
      
      achContainer.add(achBg);
      
      // ✅ ИСПРАВЛЕНО: Уменьшенная иконка (PNG или эмодзи для fallback)
      let iconObject: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
      const iconX = -panelWidth / 2 + 32; // Сместили ближе к краю
      
      if (ach.iconKey && this.scene.textures.exists(ach.iconKey)) {
        // Используем PNG иконку (уменьшенный размер)
        iconObject = this.scene.add.image(iconX, achY, ach.iconKey);
        iconObject.setDisplaySize(18, 18); // Еще меньше
      } else {
        // Fallback на эмодзи
        iconObject = this.scene.add.text(iconX, achY, ach.icon, {
          fontSize: '16px', // Еще меньше
        });
      }
      iconObject.setOrigin(0.5);
      achContainer.add(iconObject);
      
      // ✅ УЛУЧШЕНО: Название достижения с тенью для читаемости
      const textStartX = iconX + 20; // Текст начинается после иконки
      const achName = this.scene.add.text(textStartX, achY - 6, ach.name, {
        fontSize: '11px',
        fontFamily: fonts.tech,
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0, 0.5);
      achContainer.add(achName);
      
      // ✅ УЛУЧШЕНО: Описание с тенью для читаемости
      const achDesc = this.scene.add.text(textStartX, achY + 6, ach.description, {
        fontSize: '9px',
        fontFamily: fonts.tech,
        color: '#cccccc',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0, 0.5);
      achContainer.add(achDesc);
      
      // ✅ Бейдж счетчика (если повторное) или редкости
      const badgeX = panelWidth / 2 - 40;
      
      if (ach.count && ach.count > 1) {
        // Показываем счетчик для повторных достижений
        const countBadge = this.scene.add.text(badgeX, achY - 10, `x${ach.count}`, {
          fontSize: '12px',
          fontFamily: fonts.tech,
          color: '#000000',
          backgroundColor: '#ffd700',
          padding: { x: 6, y: 2 },
          fontStyle: 'bold',
        }).setOrigin(0.5);
        achContainer.add(countBadge);
        
        // Текст "ПОВТОРНО" под счетчиком
        const repeatText = this.scene.add.text(badgeX, achY + 10, 'ПОВТОР', {
          fontSize: '8px',
          fontFamily: fonts.tech,
          color: '#888888',
        }).setOrigin(0.5);
        achContainer.add(repeatText);
        
      } else if (ach.rarity && ach.rarity !== 'common') {
        // Показываем редкость для первого разблокирования
        const rarityTextMap: Record<string, string> = {
          'rare': 'РЕДКОЕ',
          'epic': 'ЭПИК',
          'legendary': 'ЛЕГЕНДА'
        };
        const rarityText = rarityTextMap[ach.rarity] || ach.rarity.toUpperCase();
        const badge = this.scene.add.text(badgeX, achY, rarityText, {
          fontSize: '9px',
          fontFamily: fonts.tech,
          color: '#000000',
          backgroundColor: '#' + rarityColor.toString(16).padStart(6, '0'),
          padding: { x: 6, y: 2 },
        }).setOrigin(0.5);
        achContainer.add(badge);
      }
      
      // Анимация появления с задержкой
      const delay = 1500 + index * 200; // После анимации наград
      
      // Начальное состояние
      achBg.setAlpha(0);
      iconObject.setAlpha(0).setScale(0);
      achName.setAlpha(0).setX(achName.x - 20);
      achDesc.setAlpha(0).setX(achDesc.x - 20);
      
      // Анимация фона
      this.scene.tweens.add({
        targets: achBg,
        alpha: 1,
        duration: 300,
        delay: delay,
        ease: 'Power2',
      });
      
      // Анимация иконки (pop)
      this.scene.tweens.add({
        targets: iconObject,
        alpha: 1,
        scale: 1,
        duration: 400,
        delay: delay + 100,
        ease: 'Back.easeOut',
      });
      
      // Анимация текста (slide in)
      this.scene.tweens.add({
        targets: [achName, achDesc],
        alpha: 1,
        x: `+=${20}`,
        duration: 400,
        delay: delay + 200,
        ease: 'Power2',
      });
      
      // Pulse эффект для легендарных достижений
      if (ach.rarity === 'legendary') {
        this.scene.tweens.add({
          targets: iconObject,
          scale: 1.15,
          duration: 800,
          delay: delay + 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    });
    
    // ✅ ИСПРАВЛЕНО: Если достижений больше maxDisplay (2), показываем индикатор
    if (remainingCount > 0) {
      const moreText = this.scene.add.text(
        0,
        y + totalHeight / 2 + 10,
        `+${remainingCount} ${remainingCount === 1 ? 'ещё' : 'ещё'}...`,
        {
          fontSize: '11px',
          fontFamily: fonts.tech,
          color: '#888888',
        }
      ).setOrigin(0.5);
      this.container.add(moreText);
      
      moreText.setAlpha(0);
      this.scene.tweens.add({
        targets: moreText,
        alpha: 1,
        duration: 300,
        delay: 2000,
      });
    }
  }

  private createButton(
    x: number, y: number, w: number, h: number, 
    icon: string, text: string, color: number, 
    onClick: () => void
  ): void {
    const btn = new Button(this.scene, {
      x: x,
      y: y,
      width: w,
      height: h,
      text: text,
      fontSize: 12,
      style: 'accent',
      icon: icon,
      onClick: onClick,
    });
    
    // Remove from scene root and add to container
    // Access private container via type assertion
    const btnContainer = (btn as any).container as Phaser.GameObjects.Container;
    this.scene.children.remove(btnContainer);
    this.container.add(btnContainer);
  }

  // ========== ANIMATIONS ==========

  private animateEntrance(): void {
    switch (this.theme) {
      case 'victory':
        // Pop entrance
        this.container.setScale(0.8).setAlpha(0);
        this.scene.tweens.add({
          targets: this.container,
          scale: 1,
          alpha: 1,
          duration: 500,
          ease: 'Back.easeOut',
        });
        break;
      case 'draw':
        // Elastic entrance
        this.container.setScale(0.9).setAlpha(0);
        this.scene.tweens.add({
          targets: this.container,
          scale: 1,
          alpha: 1,
          duration: 600,
          ease: 'Elastic.easeOut',
        });
        break;
      case 'defeat':
        // ✅ IMPROVED: Heavy Drop animation (smooth Back.easeOut instead of glitchy Stepped)
        const initialY = this.container.y;
        this.container.setScale(1.1).setAlpha(0);
        this.container.setY(initialY - 50); // Start slightly above
        this.scene.tweens.add({
          targets: this.container,
          scale: 1,
          alpha: 1,
          y: initialY,
          duration: 500,
          ease: 'Back.easeOut',
          onComplete: () => {
            // Single impactful camera shake on completion
            this.scene.cameras.main.shake(200, 0.005);
          },
        });
        break;
    }
  }

  hide(onComplete?: () => void): void {
    if (this.isDestroying) return;
    this.isDestroying = true;

    this.scene.tweens.add({
      targets: [this.container, this.overlay],
      alpha: 0,
      scale: 0.9,
      duration: 200,
      onComplete: () => {
        this.destroy();
        if (onComplete) onComplete();
      }
    });
  }

  destroy(): void {
    if (!this.scene?.sys?.isActive()) return;

    this.scene.tweens.killTweensOf([
      this.container,
      this.overlay,
      this.godRaysContainer,
      this.backgroundImage,
    ].filter(Boolean) as Phaser.GameObjects.GameObject[]);

    if (this.confettiEmitter) {
      this.confettiEmitter.destroy();
      this.confettiEmitter = undefined;
    }
    if (this.godRaysContainer) {
      this.godRaysContainer.destroy();
      this.godRaysContainer = undefined;
    }
    if (this.backgroundImage?.active) {
      this.backgroundImage.destroy();
      this.backgroundImage = undefined;
    }
    if (this.overlay.active) {
      this.overlay.destroy();
    }
    if (this.container.active) {
      this.container.destroy();
    }
  }
}
