// src/ui/game/GameHUD.ts

import Phaser from 'phaser';
import { getColors, hexToString } from '../../config/themes';
import { GameState } from '../../controllers/GameStateManager';
import { PlayerNumber } from '../../types';
import { i18n } from '../../localization/i18n';

export interface GameHUDConfig {
  isAIMode: boolean;
  aiDifficulty?: string;
}

/**
 * HUD игры - отображает ход, состояние, счёт и кнопку паузы
 */
export class GameHUD {
  private scene: Phaser.Scene;
  private config: GameHUDConfig;
  
  // UI элементы
  private turnText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;
  private modeText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private pauseButton!: Phaser.GameObjects.Container;
  private pendingFormationBadge: Phaser.GameObjects.Container | null = null;
  
  // Callbacks
  private onPauseCallback: (() => void) | null = null;

  constructor(scene: Phaser.Scene, config: GameHUDConfig) {
    this.scene = scene;
    this.config = config;
    
    this.create();
  }

  private create(): void {
    const { width, height } = this.scene.cameras.main;
    const colors = getColors();
    
    // Turn text
    this.turnText = this.scene.add.text(width / 2, 20, '', { 
      fontSize: '22px', 
      color: '#ffffff', 
      fontFamily: 'Arial', 
      stroke: '#000000', 
      strokeThickness: 4 
    });
    this.turnText.setOrigin(0.5, 0).setDepth(100);
    
    // State text
    this.stateText = this.scene.add.text(width / 2, 50, '', { 
      fontSize: '16px', 
      color: hexToString(colors.uiTextSecondary), 
      fontFamily: 'Arial', 
      stroke: '#000000', 
      strokeThickness: 2 
    });
    this.stateText.setOrigin(0.5, 0).setDepth(100);
    
    // Mode text
    const modeLabel = this.config.isAIMode 
      ? `🤖 vs AI (${this.config.aiDifficulty || 'medium'})` 
      : '👥 PvP';
    this.modeText = this.scene.add.text(20, 20, modeLabel, {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'Arial',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.modeText.setDepth(100);
    
    // Score text
    this.scoreText = this.scene.add.text(width / 2, height - 30, '0 : 0', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial Black',
      stroke: '#000000',
      strokeThickness: 6,
    });
    this.scoreText.setOrigin(0.5, 0.5).setDepth(100);
    
    // Pause button
    this.createPauseButton();
  }

  private createPauseButton(): void {
    const { width } = this.scene.cameras.main;
    const colors = getColors();
    
    this.pauseButton = this.scene.add.container(width - 35, 35);
    this.pauseButton.setDepth(100);
    
    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.5);
    bg.fillCircle(0, 0, 25);
    bg.lineStyle(2, colors.uiAccent, 0.6);
    bg.strokeCircle(0, 0, 25);
    this.pauseButton.add(bg);
    
    // Pause icon
    const icon = this.scene.add.graphics();
    icon.fillStyle(colors.uiAccent, 1);
    icon.fillRect(-8, -10, 5, 20);
    icon.fillRect(3, -10, 5, 20);
    this.pauseButton.add(icon);
    
    // Interactivity
    this.pauseButton.setInteractive(new Phaser.Geom.Circle(0, 0, 25), Phaser.Geom.Circle.Contains);
    
    this.pauseButton.on('pointerover', () => {
      this.pauseButton.setScale(1.1);
    });
    
    this.pauseButton.on('pointerout', () => {
      this.pauseButton.setScale(1);
    });
    
    this.pauseButton.on('pointerdown', () => {
      if (this.onPauseCallback) {
        this.onPauseCallback();
      }
    });
  }

  /**
   * Обновляет отображение хода и состояния
   */
  updateTurn(player: PlayerNumber, state: GameState, isAIMode: boolean): void {
    const colors = getColors();
    const teamColor = player === 1 ? colors.team1Primary : colors.team2Primary;
    
    // Turn text
    let playerName: string;
    if (player === 1) {
      playerName = i18n.t('yourTurn');
    } else {
      playerName = isAIMode ? i18n.t('enemyTurn') + ' 🤖' : i18n.t('player2') + "'s Turn";
    }
    this.turnText.setText(playerName).setColor(hexToString(teamColor));
    
    // State text
    let stateMessage = '';
    switch (state) {
      case 'waiting':
        stateMessage = player === 1 
          ? '👆 ' + i18n.t('dragToShoot')
          : (isAIMode ? '🤔 ' + i18n.t('aiThinking') : '👆 ' + i18n.t('dragToShoot'));
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
  }

  /**
   * Обновляет счёт
   */
  updateScore(player1Score: number, player2Score: number): void {
    this.scoreText.setText(`${player1Score} : ${player2Score}`);
  }

  /**
   * Показывает бейдж ожидающей формации
   */
  showPendingFormationBadge(formationName: string): void {
    this.hidePendingFormationBadge();
    
    const { width } = this.scene.cameras.main;
    const colors = getColors();
    
    this.pendingFormationBadge = this.scene.add.container(width / 2, 80);
    this.pendingFormationBadge.setDepth(100);
    
    const bg = this.scene.add.graphics();
    bg.fillStyle(colors.uiAccent, 0.15);
    bg.fillRoundedRect(-100, -12, 200, 24, 12);
    bg.lineStyle(1, colors.uiAccent, 0.5);
    bg.strokeRoundedRect(-100, -12, 200, 24, 12);
    this.pendingFormationBadge.add(bg);
    
    const text = this.scene.add.text(0, 0, `⏳ ${i18n.t('newFormation')}: ${formationName}`, {
      fontSize: '11px',
      color: hexToString(colors.uiAccent),
    }).setOrigin(0.5);
    this.pendingFormationBadge.add(text);
    
    // Пульсация
    this.scene.tweens.add({
      targets: this.pendingFormationBadge,
      alpha: { from: 1, to: 0.6 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });
  }

  /**
   * Скрывает бейдж ожидающей формации
   */
  hidePendingFormationBadge(): void {
    if (this.pendingFormationBadge) {
      this.pendingFormationBadge.destroy();
      this.pendingFormationBadge = null;
    }
  }

  /**
   * Показывает уведомление о применении формации
   */
  showFormationAppliedNotification(): void {
    const colors = getColors();
    const { width } = this.scene.cameras.main;
    
    const notification = this.scene.add.container(width / 2, 100);
    notification.setDepth(300);
    
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
    
    notification.setAlpha(0).setY(80);
    this.scene.tweens.add({
      targets: notification,
      alpha: 1,
      y: 100,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: notification,
          alpha: 0,
          y: 80,
          duration: 300,
          delay: 1500,
          onComplete: () => notification.destroy(),
        });
      }
    });
  }

  /**
   * Устанавливает callback для нажатия на паузу
   */
  onPause(callback: () => void): void {
    this.onPauseCallback = callback;
  }

  /**
   * Включает/выключает кнопку паузы
   */
  setPauseEnabled(enabled: boolean): void {
    if (enabled) {
      this.pauseButton.setAlpha(1);
      this.pauseButton.setInteractive();
    } else {
      this.pauseButton.setAlpha(0.5);
      this.pauseButton.disableInteractive();
    }
  }

  destroy(): void {
    this.turnText.destroy();
    this.stateText.destroy();
    this.modeText.destroy();
    this.scoreText.destroy();
    this.pauseButton.destroy();
    this.hidePendingFormationBadge();
  }
}