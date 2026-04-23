// src/ui/game/GameHUD.ts
import Phaser from 'phaser';
import { getFonts, getColors, hexToString } from '../../config/themes';
import { PlayerNumber } from '../../types';
import { TurnPhase } from '../../types/match';
import { FactionId, FactionArena } from '../../constants/gameConstants';
import { tgApp } from '../../utils/TelegramWebApp'; // Импорт для Safe Area

import { ScoreBoard, ScoreBoardStyle } from './hud/ScoreBoard';
import { MatchTimer } from './hud/MatchTimer';
import { TurnIndicator } from './hud/TurnIndicator';
import { PauseButton } from './hud/PauseButton';

export interface GameHUDConfig {
  isAIMode: boolean;
  aiDifficulty?: string;
  isPvP?: boolean;
  opponentName?: string;
  matchDuration?: number;
  fieldSkinId?: string;
  arena?: FactionArena;
  playerFaction?: FactionId;
  opponentFaction?: FactionId;
}

export class GameHUD {
  private scene: Phaser.Scene;
  private config: GameHUDConfig;
  private scoreBoard!: ScoreBoard;
  private matchTimer!: MatchTimer;
  private turnIndicator!: TurnIndicator;
  private pauseButton!: PauseButton;
  private modeText?: Phaser.GameObjects.Text;
  private pendingFormationBadge: Phaser.GameObjects.Container | null = null;
  private onPauseCallback: (() => void) | null = null;

  constructor(scene: Phaser.Scene, config: GameHUDConfig) {
    this.scene = scene;
    this.config = config;
    this.create();
  }

  private create(): void {
    const { width, height } = this.scene.cameras.main;
    
    // 🔥 FIX: Добавляем отступ сверху (Safe Area)
    // getTopInset вернет 44+ для iPhone, что спасет от перекрытия
    const topInset = tgApp.getTopInset();
    
    // Базовые координаты с учетом отступа
    // Таймер ставим самым верхним элементом, но с отступом от края
    const timerY = topInset + 12; 

    // Скорборд под таймером (+34px вниз)
    const scoreY = timerY + 34;
    
    // Индикатор хода под скорбордом (компактнее)
    const turnY = scoreY + 26;

    // 1. Match Timer (По центру сверху)
    this.matchTimer = new MatchTimer(this.scene, width / 2, timerY, {
      initialTime: this.config.matchDuration || 300,
      showIcon: true,
    });

    // 2. Pause Button (Справа внизу, с учетом безопасной зоны снизу)
    // Кнопка паузы размещается в нижней части экрана, справа от панели способностей
    const bottomInset = tgApp.getBottomInset();
    const pauseButtonMarginRight = 40;
    const pauseButtonMarginBottom = 140; // Чуть выше, чтобы не нависала на панель карт
    const pauseX = width - pauseButtonMarginRight;
    const pauseY = height - bottomInset - pauseButtonMarginBottom;
    
    this.pauseButton = new PauseButton(this.scene, pauseX, pauseY, {
      onPress: () => this.onPauseCallback?.(),
    });

    // 3. Score Board
    const scoreBoardStyle = this.determineScoreBoardStyle();
    this.scoreBoard = new ScoreBoard(this.scene, width / 2, scoreY, {
      style: scoreBoardStyle,
      isPvP: this.config.isPvP,
      opponentName: this.config.opponentName,
      isAIMode: this.config.isAIMode,
      playerFaction: this.config.playerFaction,
      opponentFaction: this.config.opponentFaction,
      arena: this.config.arena,
    });

    // 4. Turn Indicator
    this.turnIndicator = new TurnIndicator(this.scene, width / 2, turnY, {
      isPvP: this.config.isPvP,
      isAIMode: this.config.isAIMode,
      opponentName: this.config.opponentName,
      playerFaction: this.config.playerFaction,
      opponentFaction: this.config.opponentFaction,
    });

    // 5. Mode text (только для offline, отображаем слева вверху)
    if (!this.config.isPvP) {
      this.createModeText(topInset);
    }
  }

  private determineScoreBoardStyle(): ScoreBoardStyle {
    if (this.config.arena && this.config.playerFaction && this.config.opponentFaction) {
      return 'faction';
    }
    return 'generic';
  }

  private createModeText(topInset: number): void {
    const fonts = getFonts();
    const modeLabel = this.config.isAIMode
      ? (this.config.opponentName || `Player ${Math.floor(Math.random() * 999)}`)
      : '👥 Local PvP';

    // Текст режима тоже сдвигаем вниз
    this.modeText = this.scene.add
      .text(20, topInset + 20, modeLabel, {
        fontSize: '12px',
        fontFamily: fonts.tech,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setDepth(100)
      .setOrigin(0, 0.5);
  }

  // ========== PUBLIC API ==========

  updateTurn(player: PlayerNumber, state: string, isAIMode: boolean): void {
    const phase = state as TurnPhase;
    this.turnIndicator.update(player, phase);
  }

  updateScore(player1Score: number, player2Score: number): void {
    this.scoreBoard.updateScore(player1Score, player2Score);
  }

  updateMatchTimer(remainingTime: number, totalTime: number): void {
    this.matchTimer.update(remainingTime, totalTime);
  }

  onPause(callback: () => void): void {
    this.onPauseCallback = callback;
    this.pauseButton.setOnPress(callback);
  }

  setPauseEnabled(enabled: boolean): void {
    this.pauseButton.setEnabled(enabled);
  }

  // === Formation Badge ===

  showPendingFormationBadge(formationName: string): void {
    this.hidePendingFormationBadge();
    const { width } = this.scene.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    
    // Бэйдж тоже привязываем к скорборду
    const scoreY = this.scoreBoard.getContainer().y;
    const badgeY = scoreY + 75;

    this.pendingFormationBadge = this.scene.add
      .container(width / 2, badgeY)
      .setDepth(100);

    const bg = this.scene.add.graphics();
    bg.fillStyle(colors.uiAccent, 0.12);
    bg.fillRoundedRect(-105, -13, 210, 26, 13);
    bg.lineStyle(1, colors.uiAccent, 0.4);
    bg.strokeRoundedRect(-105, -13, 210, 26, 13);
    this.pendingFormationBadge.add(bg);

    this.pendingFormationBadge.add(
      this.scene.add
        .text(0, 0, `⏳ New formation: ${formationName}`, {
          fontSize: '10px',
          fontFamily: fonts.tech,
          color: hexToString(colors.uiAccent),
        })
        .setOrigin(0.5)
    );

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
    const { width } = this.scene.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    
    const scoreY = this.scoreBoard.getContainer().y;
    const notifY = scoreY + 95;

    const notification = this.scene.add
      .container(width / 2, notifY)
      .setDepth(300);

    const bg = this.scene.add.graphics();
    bg.fillStyle(colors.uiAccent, 0.15);
    bg.fillRoundedRect(-125, -22, 250, 44, 12);
    bg.lineStyle(2, colors.uiAccent, 0.7);
    bg.strokeRoundedRect(-125, -22, 250, 44, 12);
    notification.add(bg);

    notification.add(
      this.scene.add
        .text(0, 0, '✓ Formation changed', {
          fontSize: '14px',
          fontFamily: fonts.tech,
          color: hexToString(colors.uiAccent),
        })
        .setOrigin(0.5)
    );

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
      },
    });
  }

  /**
   * Обновляет позиции элементов HUD при изменении размеров экрана
   */
  updateLayout(): void {
    const { width, height } = this.scene.cameras.main;
    const topInset = tgApp.getTopInset();
    const bottomInset = tgApp.getBottomInset();
    
    // Обновляем позицию кнопки паузы
    const pauseButtonMarginRight = 40;
    const pauseButtonMarginBottom = 120;
    const pauseX = width - pauseButtonMarginRight;
    const pauseY = height - bottomInset - pauseButtonMarginBottom;
    this.pauseButton.setPosition(pauseX, pauseY);
  }

  destroy(): void {
    this.scoreBoard.destroy();
    this.matchTimer.destroy();
    this.turnIndicator.destroy();
    this.pauseButton.destroy();
    this.modeText?.destroy();
    this.hidePendingFormationBadge();
  }
}