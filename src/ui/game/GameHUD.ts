// src/ui/game/GameHUD.ts

import Phaser from 'phaser';
import { getColors, hexToString } from '../../config/themes';
import { GameState } from '../../controllers/GameStateManager';
import { PlayerNumber } from '../../types';
import { i18n } from '../../localization/i18n';

export interface GameHUDConfig {
  isAIMode: boolean;
  aiDifficulty?: string;
  isPvP?: boolean;
  opponentName?: string;
  matchDuration?: number;
}

export class GameHUD {
  private scene: Phaser.Scene;
  private config: GameHUDConfig;
  
  private turnText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;
  private modeText?: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private pauseButton!: Phaser.GameObjects.Container;
  private pendingFormationBadge: Phaser.GameObjects.Container | null = null;
  
  private pvpHeader: Phaser.GameObjects.Container | null = null;
  private connectionIndicator: Phaser.GameObjects.Graphics | null = null;
  
  private turnTimer: Phaser.GameObjects.Text | null = null;
  private turnTimerEvent: Phaser.Time.TimerEvent | null = null;
  private turnRemainingTime = 60;
  
  private matchTimerContainer: Phaser.GameObjects.Container | null = null;
  private matchTimerText: Phaser.GameObjects.Text | null = null;
  
  private onPauseCallback: (() => void) | null = null;

  constructor(scene: Phaser.Scene, config: GameHUDConfig) {
    this.scene = scene;
    this.config = config;
    this.create();
  }

  private create(): void {
    const { width, height } = this.scene.cameras.main;
    const colors = getColors();
    
    if (this.config.isPvP) {
      this.createPvPHeader();
      this.createMatchTimer();
    }
    
    const turnY = this.config.isPvP ? 70 : 20;
    
    this.turnText = this.scene.add.text(width / 2, turnY, '', {
      fontSize: '22px',
      color: '#ffffff',
      fontFamily: 'Arial',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5, 0).setDepth(100);
    
    this.stateText = this.scene.add.text(width / 2, turnY + 30, '', {
      fontSize: '16px',
      color: hexToString(colors.uiTextSecondary),
      fontFamily: 'Arial',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5, 0).setDepth(100);
    
    if (!this.config.isPvP) {
      const modeLabel = this.config.isAIMode
        ? `🤖 vs AI (${this.config.aiDifficulty || 'medium'})`
        : '👥 Local PvP';
      this.modeText = this.scene.add.text(20, 20, modeLabel, {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'Arial',
        stroke: '#000000',
        strokeThickness: 3,
      }).setDepth(100);
    }
    
    this.scoreText = this.scene.add.text(width / 2, height - 30, '0 : 0', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial Black',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5, 0.5).setDepth(100);
    
    this.createPauseButton();
    
    if (this.config.isPvP) {
      this.createTurnTimer();
    }
  }

  private createPvPHeader(): void {
    const { width } = this.scene.cameras.main;
    const colors = getColors();
    
    this.pvpHeader = this.scene.add.container(width / 2, 0).setDepth(100);
    
    const headerBg = this.scene.add.graphics();
    headerBg.fillStyle(0x000000, 0.7);
    headerBg.fillRect(-width / 2, 0, width, 60);
    headerBg.lineStyle(2, colors.uiAccent, 0.5);
    headerBg.lineBetween(-width / 2, 60, width / 2, 60);
    this.pvpHeader.add(headerBg);
    
    const pvpBadge = this.scene.add.container(0, 30);
    const badgeBg = this.scene.add.graphics();
    badgeBg.fillStyle(0xff4757, 0.3);
    badgeBg.fillRoundedRect(-40, -12, 80, 24, 12);
    badgeBg.lineStyle(1, 0xff4757, 0.8);
    badgeBg.strokeRoundedRect(-40, -12, 80, 24, 12);
    pvpBadge.add(badgeBg);
    pvpBadge.add(this.scene.add.text(0, 0, '⚔️ PVP', {
      fontSize: '14px',
      fontFamily: 'Arial Black',
      color: '#ff4757',
    }).setOrigin(0.5));
    this.pvpHeader.add(pvpBadge);
    
    this.pvpHeader.add(this.scene.add.text(-width / 2 + 20, 30, '👤 YOU', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#4ade80',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0, 0.5));
    
    this.connectionIndicator = this.scene.add.graphics();
    this.connectionIndicator.fillStyle(0x4ade80, 1);
    this.connectionIndicator.fillCircle(0, 0, 5);
    this.connectionIndicator.setPosition(-width / 2 + 80, 30);
    this.pvpHeader.add(this.connectionIndicator);
    
    this.pvpHeader.add(this.scene.add.text(width / 2 - 20, 30,
      `⚔️ ${this.config.opponentName || 'Opponent'}`, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ff6b6b',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(1, 0.5));
    
    this.pvpHeader.setY(-60);
    this.scene.tweens.add({
      targets: this.pvpHeader,
      y: 0,
      duration: 500,
      ease: 'Back.easeOut',
    });
  }

  private createMatchTimer(): void {
    const { width } = this.scene.cameras.main;
    
    this.matchTimerContainer = this.scene.add.container(width / 2, 15).setDepth(101);
    
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRoundedRect(-50, -12, 100, 24, 12);
    bg.lineStyle(1, 0x00ffff, 0.5);
    bg.strokeRoundedRect(-50, -12, 100, 24, 12);
    this.matchTimerContainer.add(bg);
    
    this.matchTimerContainer.add(this.scene.add.text(-35, 0, '⏱️', { fontSize: '14px' }).setOrigin(0.5));
    
    this.matchTimerText = this.scene.add.text(5, 0, '5:00', {
      fontSize: '16px',
      fontFamily: 'Arial Black',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.matchTimerContainer.add(this.matchTimerText);
  }

  updateMatchTimer(remainingTime: number, totalTime: number): void {
    if (!this.matchTimerText) return;
    
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    this.matchTimerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    
    if (remainingTime <= 30) {
      this.matchTimerText.setColor('#ff4444');
      if (remainingTime <= 10 && remainingTime > 0) {
        this.scene.tweens.add({
          targets: this.matchTimerText,
          scale: { from: 1, to: 1.3 },
          duration: 300,
          yoyo: true,
        });
      }
    } else if (remainingTime <= 60) {
      this.matchTimerText.setColor('#ffaa00');
    } else {
      this.matchTimerText.setColor('#ffffff');
    }
  }

  private createTurnTimer(): void {
    const { width } = this.scene.cameras.main;
    
    this.turnTimer = this.scene.add.text(width - 70, 75, '60', {
      fontSize: '24px',
      fontFamily: 'Arial Black',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(100);
    
    this.scene.add.text(width - 100, 75, '⏱️', { fontSize: '20px' }).setOrigin(0.5).setDepth(100);
  }

  startTurnTimer(seconds = 60): void {
    this.turnRemainingTime = seconds;
    this.updateTurnTimerDisplay();
    
    this.turnTimerEvent?.destroy();
    
    this.turnTimerEvent = this.scene.time.addEvent({
      delay: 1000,
      callback: () => {
        this.turnRemainingTime--;
        this.updateTurnTimerDisplay();
        if (this.turnRemainingTime <= 0) this.turnTimerEvent?.destroy();
      },
      loop: true,
    });
  }

  stopTurnTimer(): void {
    this.turnTimerEvent?.destroy();
    this.turnTimerEvent = null;
  }

  private updateTurnTimerDisplay(): void {
    if (!this.turnTimer) return;
    
    this.turnTimer.setText(this.turnRemainingTime.toString());
    
    if (this.turnRemainingTime <= 10) {
      this.turnTimer.setColor('#ff4444');
      if (this.turnRemainingTime <= 5) {
        this.scene.tweens.add({
          targets: this.turnTimer,
          scale: { from: 1, to: 1.2 },
          duration: 200,
          yoyo: true,
        });
      }
    } else if (this.turnRemainingTime <= 20) {
      this.turnTimer.setColor('#ffaa00');
    } else {
      this.turnTimer.setColor('#ffffff');
    }
  }

  private createPauseButton(): void {
    const { width } = this.scene.cameras.main;
    const colors = getColors();
    const buttonY = this.config.isPvP ? 90 : 35;
    
    this.pauseButton = this.scene.add.container(width - 35, buttonY).setDepth(100);
    
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.5);
    bg.fillCircle(0, 0, 25);
    bg.lineStyle(2, colors.uiAccent, 0.6);
    bg.strokeCircle(0, 0, 25);
    this.pauseButton.add(bg);
    
    const icon = this.scene.add.graphics();
    icon.fillStyle(colors.uiAccent, 1);
    icon.fillRect(-8, -10, 5, 20);
    icon.fillRect(3, -10, 5, 20);
    this.pauseButton.add(icon);
    
    this.pauseButton.setInteractive(new Phaser.Geom.Circle(0, 0, 25), Phaser.Geom.Circle.Contains);
    this.pauseButton.on('pointerover', () => this.pauseButton.setScale(1.1));
    this.pauseButton.on('pointerout', () => this.pauseButton.setScale(1));
    this.pauseButton.on('pointerdown', () => this.onPauseCallback?.());
  }

  updateTurn(player: PlayerNumber, state: GameState, isAIMode: boolean): void {
    const colors = getColors();
    const teamColor = player === 1 ? colors.team1Primary : colors.team2Primary;
    
    let playerName: string;
    if (this.config.isPvP) {
      playerName = player === 1 ? '🎯 ' + i18n.t('yourTurn') : `⏳ ${this.config.opponentName}'s Turn`;
    } else {
      playerName = player === 1 ? i18n.t('yourTurn') : (isAIMode ? i18n.t('enemyTurn') + ' 🤖' : i18n.t('player2') + "'s Turn");
    }
    this.turnText.setText(playerName).setColor(hexToString(teamColor));
    
    let stateMessage = '';
    switch (state) {
      case 'waiting':
        if (this.config.isPvP) {
          stateMessage = player === 1 ? '👆 ' + i18n.t('dragToShoot') : '⏳ Waiting...';
        } else {
          stateMessage = player === 1 ? '👆 ' + i18n.t('dragToShoot') : (isAIMode ? '🤔 ' + i18n.t('aiThinking') : '👆 ' + i18n.t('dragToShoot'));
        }
        break;
      case 'moving':
        stateMessage = '⏳ ' + i18n.t('waitingForStop');
        break;
      case 'goal':
        stateMessage = '⚽ ' + i18n.t('goal');
        break;
      case 'paused':
        stateMessage = '⏸️ ' + i18n.t('pause');
        break;
    }
    this.stateText.setText(stateMessage);
    
    if (this.config.isPvP) {
      if (state === 'waiting' && player === 1) {
        this.startTurnTimer(60);
      } else {
        this.stopTurnTimer();
      }
    }
  }

  updateScore(player1Score: number, player2Score: number): void {
    this.scoreText.setText(`${player1Score} : ${player2Score}`);
    this.scene.tweens.add({
      targets: this.scoreText,
      scale: { from: 1.3, to: 1 },
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  showPendingFormationBadge(formationName: string): void {
    this.hidePendingFormationBadge();
    
    const { width } = this.scene.cameras.main;
    const colors = getColors();
    const badgeY = this.config.isPvP ? 130 : 80;
    
    this.pendingFormationBadge = this.scene.add.container(width / 2, badgeY).setDepth(100);
    
    const bg = this.scene.add.graphics();
    bg.fillStyle(colors.uiAccent, 0.15);
    bg.fillRoundedRect(-100, -12, 200, 24, 12);
    bg.lineStyle(1, colors.uiAccent, 0.5);
    bg.strokeRoundedRect(-100, -12, 200, 24, 12);
    this.pendingFormationBadge.add(bg);
    
    this.pendingFormationBadge.add(this.scene.add.text(0, 0, `⏳ ${i18n.t('newFormation')}: ${formationName}`, {
      fontSize: '11px',
      color: hexToString(colors.uiAccent),
    }).setOrigin(0.5));
    
    this.scene.tweens.add({
      targets: this.pendingFormationBadge,
      alpha: { from: 1, to: 0.6 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });
  }

  hidePendingFormationBadge(): void {
    this.pendingFormationBadge?.destroy();
    this.pendingFormationBadge = null;
  }

  showFormationAppliedNotification(): void {
    const colors = getColors();
    const { width } = this.scene.cameras.main;
    const notifY = this.config.isPvP ? 150 : 100;
    
    const notification = this.scene.add.container(width / 2, notifY).setDepth(300);
    
    const bg = this.scene.add.graphics();
    bg.fillStyle(colors.uiAccent, 0.2);
    bg.fillRoundedRect(-120, -20, 240, 40, 10);
    bg.lineStyle(2, colors.uiAccent, 0.8);
    bg.strokeRoundedRect(-120, -20, 240, 40, 10);
    notification.add(bg);
    
    notification.add(this.scene.add.text(0, 0, '✓ ' + i18n.t('formationChanged'), {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: hexToString(colors.uiAccent),
      fontStyle: 'bold',
    }).setOrigin(0.5));
    
    notification.setAlpha(0).setY(notifY - 20);
    this.scene.tweens.add({
      targets: notification,
      alpha: 1,
      y: notifY,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: notification,
          alpha: 0,
          y: notifY - 20,
          duration: 300,
          delay: 1500,
          onComplete: () => notification.destroy(),
        });
      }
    });
  }

  showPvPNotification(message: string, type: 'info' | 'warning' | 'success' = 'info'): void {
    const { width } = this.scene.cameras.main;
    const colors: Record<string, number> = { info: 0x3b82f6, warning: 0xf59e0b, success: 0x22c55e };
    
    const notification = this.scene.add.container(width / 2, 150).setDepth(300);
    
    const bg = this.scene.add.graphics();
    bg.fillStyle(colors[type], 0.2);
    bg.fillRoundedRect(-140, -20, 280, 40, 10);
    bg.lineStyle(2, colors[type], 0.8);
    bg.strokeRoundedRect(-140, -20, 280, 40, 10);
    notification.add(bg);
    
    notification.add(this.scene.add.text(0, 0, message, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5));
    
    notification.setAlpha(0).setScale(0.8);
    this.scene.tweens.add({
      targets: notification,
      alpha: 1,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: notification,
          alpha: 0,
          scale: 0.8,
          duration: 300,
          delay: 2000,
          onComplete: () => notification.destroy(),
        });
      }
    });
  }

  onPause(callback: () => void): void {
    this.onPauseCallback = callback;
  }

  setPauseEnabled(enabled: boolean): void {
    this.pauseButton.setAlpha(enabled ? 1 : 0.5);
    if (enabled) this.pauseButton.setInteractive();
    else this.pauseButton.disableInteractive();
  }

  setConnectionStatus(connected: boolean): void {
    if (!this.connectionIndicator) return;
    this.connectionIndicator.clear();
    this.connectionIndicator.fillStyle(connected ? 0x4ade80 : 0xff4444, 1);
    this.connectionIndicator.fillCircle(0, 0, 5);
  }

  destroy(): void {
    this.turnText.destroy();
    this.stateText.destroy();
    this.modeText?.destroy();
    this.scoreText.destroy();
    this.pauseButton.destroy();
    this.pvpHeader?.destroy();
    this.turnTimer?.destroy();
    this.matchTimerContainer?.destroy();
    this.stopTurnTimer();
    this.hidePendingFormationBadge();
  }
}