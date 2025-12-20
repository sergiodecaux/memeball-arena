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
  
  // PvP элементы
  private pvpHeader: Phaser.GameObjects.Container | null = null;
  private connectionIndicator: Phaser.GameObjects.Graphics | null = null;
  private turnTimer: Phaser.GameObjects.Text | null = null;
  private timerEvent: Phaser.Time.TimerEvent | null = null;
  private remainingTime: number = 60;
  
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
    
    // PvP режим - специальный хедер
    if (this.config.isPvP) {
      this.createPvPHeader();
    }
    
    // Turn text
    const turnY = this.config.isPvP ? 70 : 20;
    this.turnText = this.scene.add.text(width / 2, turnY, '', { 
      fontSize: '22px', 
      color: '#ffffff', 
      fontFamily: 'Arial', 
      stroke: '#000000', 
      strokeThickness: 4 
    });
    this.turnText.setOrigin(0.5, 0).setDepth(100);
    
    // State text
    this.stateText = this.scene.add.text(width / 2, turnY + 30, '', { 
      fontSize: '16px', 
      color: hexToString(colors.uiTextSecondary), 
      fontFamily: 'Arial', 
      stroke: '#000000', 
      strokeThickness: 2 
    });
    this.stateText.setOrigin(0.5, 0).setDepth(100);
    
    // Mode text (только для AI режима)
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
      });
      this.modeText.setDepth(100);
    }
    
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
    
    // Таймер хода для PvP
    if (this.config.isPvP) {
      this.createTurnTimer();
    }
  }

  /**
   * Создаёт PvP хедер с именами игроков
   */
  private createPvPHeader(): void {
    const { width } = this.scene.cameras.main;
    const colors = getColors();
    
    this.pvpHeader = this.scene.add.container(width / 2, 0);
    this.pvpHeader.setDepth(100);
    
    // Фон хедера
    const headerBg = this.scene.add.graphics();
    headerBg.fillStyle(0x000000, 0.7);
    headerBg.fillRect(-width / 2, 0, width, 60);
    
    // Градиентная линия снизу
    headerBg.lineStyle(2, colors.uiAccent, 0.5);
    headerBg.lineBetween(-width / 2, 60, width / 2, 60);
    this.pvpHeader.add(headerBg);
    
    // PvP бейдж
    const pvpBadge = this.scene.add.container(0, 30);
    
    const badgeBg = this.scene.add.graphics();
    badgeBg.fillStyle(0xff4757, 0.3);
    badgeBg.fillRoundedRect(-40, -12, 80, 24, 12);
    badgeBg.lineStyle(1, 0xff4757, 0.8);
    badgeBg.strokeRoundedRect(-40, -12, 80, 24, 12);
    pvpBadge.add(badgeBg);
    
    const badgeText = this.scene.add.text(0, 0, '⚔️ PVP', {
      fontSize: '14px',
      fontFamily: 'Arial Black',
      color: '#ff4757',
    }).setOrigin(0.5);
    pvpBadge.add(badgeText);
    
    this.pvpHeader.add(pvpBadge);
    
    // Имя игрока (слева)
    const playerName = this.scene.add.text(-width / 2 + 20, 30, '👤 YOU', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#4ade80',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0, 0.5);
    this.pvpHeader.add(playerName);
    
    // Индикатор соединения
    this.connectionIndicator = this.scene.add.graphics();
    this.updateConnectionIndicator(true);
    this.connectionIndicator.setPosition(-width / 2 + 80, 30);
    this.pvpHeader.add(this.connectionIndicator);
    
    // Имя противника (справа)
    const opponentName = this.scene.add.text(width / 2 - 20, 30, 
      `⚔️ ${this.config.opponentName || 'Opponent'}`, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ff6b6b',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(1, 0.5);
    this.pvpHeader.add(opponentName);
    
    // Анимация появления
    this.pvpHeader.setY(-60);
    this.scene.tweens.add({
      targets: this.pvpHeader,
      y: 0,
      duration: 500,
      ease: 'Back.easeOut',
    });
  }

  /**
   * Обновляет индикатор соединения
   */
  private updateConnectionIndicator(connected: boolean): void {
    if (!this.connectionIndicator) return;
    
    this.connectionIndicator.clear();
    
    const color = connected ? 0x4ade80 : 0xff4444;
    this.connectionIndicator.fillStyle(color, 1);
    this.connectionIndicator.fillCircle(0, 0, 5);
    
    // Пульсация если подключён
    if (connected) {
      this.scene.tweens.add({
        targets: this.connectionIndicator,
        alpha: { from: 1, to: 0.5 },
        duration: 1000,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  /**
   * Создаёт таймер хода
   */
  private createTurnTimer(): void {
    const { width } = this.scene.cameras.main;
    
    this.turnTimer = this.scene.add.text(width - 70, 75, '60', {
      fontSize: '24px',
      fontFamily: 'Arial Black',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(100);
    
    // Иконка таймера
    const timerIcon = this.scene.add.text(width - 100, 75, '⏱️', {
      fontSize: '20px',
    }).setOrigin(0.5).setDepth(100);
  }

  /**
   * Запускает таймер хода
   */
  startTurnTimer(seconds: number = 60): void {
    this.remainingTime = seconds;
    this.updateTimerDisplay();
    
    // Останавливаем предыдущий таймер
    if (this.timerEvent) {
      this.timerEvent.destroy();
    }
    
    this.timerEvent = this.scene.time.addEvent({
      delay: 1000,
      callback: () => {
        this.remainingTime--;
        this.updateTimerDisplay();
        
        if (this.remainingTime <= 0) {
          this.timerEvent?.destroy();
          // Можно добавить callback для автоматического пропуска хода
        }
      },
      loop: true,
    });
  }

  /**
   * Останавливает таймер хода
   */
  stopTurnTimer(): void {
    if (this.timerEvent) {
      this.timerEvent.destroy();
      this.timerEvent = null;
    }
  }

  /**
   * Обновляет отображение таймера
   */
  private updateTimerDisplay(): void {
    if (!this.turnTimer) return;
    
    this.turnTimer.setText(this.remainingTime.toString());
    
    // Меняем цвет при малом времени
    if (this.remainingTime <= 10) {
      this.turnTimer.setColor('#ff4444');
      
      // Пульсация
      if (this.remainingTime <= 5) {
        this.scene.tweens.add({
          targets: this.turnTimer,
          scale: { from: 1, to: 1.2 },
          duration: 200,
          yoyo: true,
        });
      }
    } else if (this.remainingTime <= 20) {
      this.turnTimer.setColor('#ffaa00');
    } else {
      this.turnTimer.setColor('#ffffff');
    }
  }

  private createPauseButton(): void {
    const { width } = this.scene.cameras.main;
    const colors = getColors();
    
    const buttonY = this.config.isPvP ? 90 : 35;
    
    this.pauseButton = this.scene.add.container(width - 35, buttonY);
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
    if (this.config.isPvP) {
      // PvP режим
      if (player === 1) {
        playerName = '🎯 ' + i18n.t('yourTurn');
      } else {
        playerName = `⏳ ${this.config.opponentName || 'Opponent'}'s Turn`;
      }
    } else {
      // AI режим
      if (player === 1) {
        playerName = i18n.t('yourTurn');
      } else {
        playerName = isAIMode ? i18n.t('enemyTurn') + ' 🤖' : i18n.t('player2') + "'s Turn";
      }
    }
    this.turnText.setText(playerName).setColor(hexToString(teamColor));
    
    // State text
    let stateMessage = '';
    switch (state) {
      case 'waiting':
        if (this.config.isPvP) {
          stateMessage = player === 1 
            ? '👆 ' + i18n.t('dragToShoot')
            : '⏳ Waiting for opponent...';
        } else {
          stateMessage = player === 1 
            ? '👆 ' + i18n.t('dragToShoot')
            : (isAIMode ? '🤔 ' + i18n.t('aiThinking') : '👆 ' + i18n.t('dragToShoot'));
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
    
    // Управление таймером в PvP
    if (this.config.isPvP) {
      if (state === 'waiting' && player === 1) {
        this.startTurnTimer(60);
      } else {
        this.stopTurnTimer();
      }
    }
  }

  /**
   * Обновляет счёт
   */
  updateScore(player1Score: number, player2Score: number): void {
    this.scoreText.setText(`${player1Score} : ${player2Score}`);
    
    // Анимация при изменении счёта
    this.scene.tweens.add({
      targets: this.scoreText,
      scale: { from: 1.3, to: 1 },
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  /**
   * Показывает бейдж ожидающей формации
   */
  showPendingFormationBadge(formationName: string): void {
    this.hidePendingFormationBadge();
    
    const { width } = this.scene.cameras.main;
    const colors = getColors();
    
    const badgeY = this.config.isPvP ? 130 : 80;
    
    this.pendingFormationBadge = this.scene.add.container(width / 2, badgeY);
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
    
    const notifY = this.config.isPvP ? 150 : 100;
    
    const notification = this.scene.add.container(width / 2, notifY);
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

  /**
   * Показывает PvP уведомление
   */
  showPvPNotification(message: string, type: 'info' | 'warning' | 'success' = 'info'): void {
    const { width } = this.scene.cameras.main;
    
    const colors: Record<string, number> = {
      info: 0x3b82f6,
      warning: 0xf59e0b,
      success: 0x22c55e,
    };
    
    const notification = this.scene.add.container(width / 2, 150);
    notification.setDepth(300);
    
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

  /**
   * Обновляет статус соединения
   */
  setConnectionStatus(connected: boolean): void {
    this.updateConnectionIndicator(connected);
  }

  destroy(): void {
    this.turnText.destroy();
    this.stateText.destroy();
    this.modeText?.destroy();
    this.scoreText.destroy();
    this.pauseButton.destroy();
    this.pvpHeader?.destroy();
    this.turnTimer?.destroy();
    this.stopTurnTimer();
    this.hidePendingFormationBadge();
  }
}