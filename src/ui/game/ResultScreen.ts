import Phaser from 'phaser';
import { getColors, hexToString, getFonts } from '../../config/themes';
import { i18n } from '../../localization/i18n';
import { MatchResult } from '../../controllers/match/MatchController';
import { AudioManager } from '../../managers/AudioManager';
import { playerData } from '../../data/PlayerData';
import { MultiplayerManager } from '../../managers/MultiplayerManager';

export interface ResultScreenCallbacks {
  onRematch: () => void;
  onMainMenu: () => void;
}

export class ResultScreen {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Rectangle;
  private callbacks: ResultScreenCallbacks;
  private holoRing?: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, result: MatchResult, isAIMode: boolean, callbacks: ResultScreenCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    
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
    
    this.create(result, isAIMode);
    this.animateIn();
  }

  private create(result: MatchResult, isAIMode: boolean): void {
    const colors = getColors();
    const fonts = getFonts();
    const resultColor = result.isWin ? 0x22c55e : 0xef4444;
    
    const panelWidth = 340;
    const panelHeight = 480;
    
    // Panel background with glow
    const glow = this.scene.add.graphics();
    glow.lineStyle(12, resultColor, 0.15);
    glow.strokeRoundedRect(-panelWidth / 2 - 6, -panelHeight / 2 - 6, panelWidth + 12, panelHeight + 12, 24);
    this.container.add(glow);
    
    const panel = this.scene.add.graphics();
    panel.fillStyle(0x14101e, 0.98);
    panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    
    // Top accent
    panel.fillStyle(resultColor, 0.7);
    panel.fillRoundedRect(-50, -panelHeight / 2 + 1, 100, 3, 2);
    
    panel.lineStyle(2, resultColor, 0.6);
    panel.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    this.container.add(panel);
    
    // Holographic ring for icon
    const iconY = -panelHeight / 2 + 80;
    this.holoRing = this.createHoloRing(0, iconY, 55, resultColor);
    this.container.add(this.holoRing);
    
    // Animate ring
    this.scene.tweens.add({
      targets: this.holoRing,
      angle: 360,
      duration: 10000,
      repeat: -1,
      ease: 'Linear',
    });
    
    // Result icon
    const icon = result.isWin ? '🏆' : '💔';
    this.container.add(this.scene.add.text(0, iconY, icon, {
      fontSize: '48px',
    }).setOrigin(0.5));
    
    // Title
    const titleText = result.isWin 
      ? i18n.t('youWon') 
      : (isAIMode ? i18n.t('aiWins') : i18n.t('player2Wins'));
    
    this.container.add(this.scene.add.text(0, iconY + 70, titleText.toUpperCase(), {
      fontSize: '24px',
      fontFamily: fonts.tech,
      color: hexToString(resultColor),
      letterSpacing: 2,
    }).setOrigin(0.5));
    
    // Score
    const scoreY = iconY + 115;
    this.container.add(this.scene.add.text(0, scoreY, `${result.playerGoals} : ${result.opponentGoals}`, {
      fontSize: '52px',
      fontFamily: fonts.tech,
      color: '#ffffff',
    }).setOrigin(0.5));

    // Row с игроками (ник + аватар)
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
    
    // Rewards section
    const rewardsY = result.isPerfectGame ? scoreY + 90 : scoreY + 60;
    this.createRewardsSection(rewardsY, result, panelWidth);
    
    // Achievements
    if (result.newAchievements.length > 0) {
      const achY = rewardsY + 95;
      const achBg = this.scene.add.graphics();
      achBg.fillStyle(0x22c55e, 0.15);
      achBg.fillRoundedRect(-panelWidth / 2 + 25, achY - 18, panelWidth - 50, 36, 10);
      achBg.lineStyle(1, 0x22c55e, 0.5);
      achBg.strokeRoundedRect(-panelWidth / 2 + 25, achY - 18, panelWidth - 50, 36, 10);
      this.container.add(achBg);
      
      this.container.add(this.scene.add.text(0, achY, `🏆 ${result.newAchievements.length} new achievement(s)!`, {
        fontSize: '12px',
        fontFamily: fonts.tech,
        color: '#22c55e',
      }).setOrigin(0.5));
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
      opponentName = opp?.name || 'Opponent';
      opponentAvatarId = opp?.avatarId;
    } else if (isAIMode) {
      opponentName = 'AI';
    } else {
      opponentName = i18n.t('player2') || 'Player 2';
    }

    const row = this.scene.add.container(0, y);
    this.container.add(row);

    // Left: local player
    const left = this.scene.add.container(-90, 0);
    row.add(left);

    this.addAvatarIcon(left, -18, 0, playerAvatarId, colors.uiAccent);
    left.add(this.scene.add.text(0, 0, playerNick, {
      fontSize: '12px',
      fontFamily: fonts.tech,
      color: '#ffffff',
    }).setOrigin(0, 0.5));

    // Right: opponent / AI / Player2
    const right = this.scene.add.container(90, 0);
    row.add(right);

    this.addAvatarIcon(right, 18, 0, opponentAvatarId, colors.uiAccentPink);
    right.add(this.scene.add.text(0, 0, opponentName, {
      fontSize: '12px',
      fontFamily: fonts.tech,
      color: hexToString(colors.uiAccentPink),
    }).setOrigin(1, 0.5));
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

  private createHoloRing(x: number, y: number, radius: number, color: number): Phaser.GameObjects.Graphics {
    const ring = this.scene.add.graphics();
    ring.setPosition(x, y);
    
    // Dashed circle
    const segments = 24;
    ring.lineStyle(2, color, 0.5);
    
    for (let i = 0; i < segments; i++) {
      if (i % 2 === 0) {
        const startAngle = (i / segments) * Math.PI * 2;
        const endAngle = ((i + 0.7) / segments) * Math.PI * 2;
        ring.beginPath();
        ring.arc(0, 0, radius, startAngle, endAngle, false);
        ring.strokePath();
      }
    }
    
    // Inner circle
    ring.lineStyle(1, color, 0.25);
    ring.strokeCircle(0, 0, radius - 12);
    
    return ring;
  }

  private createRewardsSection(y: number, result: MatchResult, panelWidth: number): void {
    const colors = getColors();
    const fonts = getFonts();
    
    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0xffffff, 0.03);
    bg.fillRoundedRect(-panelWidth / 2 + 25, y - 15, panelWidth - 50, 70, 12);
    bg.lineStyle(1, colors.glassBorder, 0.1);
    bg.strokeRoundedRect(-panelWidth / 2 + 25, y - 15, panelWidth - 50, 70, 12);
    this.container.add(bg);
    
    // XP
    const xpX = -60;
    this.container.add(this.scene.add.text(xpX, y + 5, '⚡', { fontSize: '20px' }).setOrigin(0.5));
    this.container.add(this.scene.add.text(xpX, y + 30, `+${result.xpEarned} XP`, {
      fontSize: '14px',
      fontFamily: fonts.tech,
      color: '#a855f7',
    }).setOrigin(0.5));
    
    // Coins
    const coinsX = 60;
    this.container.add(this.scene.add.text(coinsX, y + 5, '💰', { fontSize: '20px' }).setOrigin(0.5));
    this.container.add(this.scene.add.text(coinsX, y + 30, `+${result.coinsEarned}`, {
      fontSize: '14px',
      fontFamily: fonts.tech,
      color: hexToString(colors.uiGold),
    }).setOrigin(0.5));
  }

  private createButton(
    x: number, y: number, w: number, h: number, 
    icon: string, text: string, color: number, 
    onClick: () => void
  ): void {
    const fonts = getFonts();
    const btn = this.scene.add.container(x, y);
    
    const bg = this.scene.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(color, hover ? 0.25 : 0.15);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      bg.lineStyle(2, color, hover ? 1 : 0.6);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    };
    draw(false);
    btn.add(bg);
    
    btn.add(this.scene.add.text(-w / 2 + 25, 0, icon, { fontSize: '16px' }).setOrigin(0.5));
    
    btn.add(this.scene.add.text(8, 0, text, {
      fontSize: '12px',
      fontFamily: fonts.tech,
      color: hexToString(color),
    }).setOrigin(0.5));
    
    const hitArea = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    btn.add(hitArea);
    
    hitArea.on('pointerover', () => { draw(true); btn.setScale(1.03); });
    hitArea.on('pointerout', () => { draw(false); btn.setScale(1); });
    hitArea.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click');
      onClick();
    });
    
    this.container.add(btn);
  }

  private animateIn(): void {
    this.container.setScale(0.85).setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      scale: 1,
      alpha: 1,
      duration: 400,
      ease: 'Back.easeOut',
    });
  }

  hide(onComplete?: () => void): void {
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
    this.overlay.destroy();
    this.container.destroy();
  }
}