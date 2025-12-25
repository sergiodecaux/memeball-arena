import Phaser from 'phaser';
import { getColors, hexToString, getFonts } from '../../config/themes';
import { GameState } from '../../controllers/GameStateManager';
import { PlayerNumber } from '../../types';
import { i18n } from '../../localization/i18n';
import { playerData } from '../../data/PlayerData';
import { MultiplayerManager } from '../../managers/MultiplayerManager';
import { getFieldSkin, FieldSkinData } from '../../data/SkinsCatalog';
import { FactionId, FactionArena, FACTIONS } from '../../constants/gameConstants';

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

  private fieldSkin?: FieldSkinData;
  private fieldStyle: 'neon' | 'industrial' | 'carbon' | 'generic' = 'generic';

  constructor(scene: Phaser.Scene, config: GameHUDConfig) {
    this.scene = scene;
    this.config = config;

    const skinId = config.fieldSkinId || 'field_default';
    this.fieldSkin = getFieldSkin(skinId) || getFieldSkin('field_default') || undefined;
    this.fieldStyle = (this.fieldSkin?.style as any) || 'generic';

    this.create();
  }

  private create(): void {
    const { width } = this.scene.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    
    if (this.config.isPvP) {
      this.createPvPHeader();
    }
    
    // ✅ ИСПРАВЛЕНИЕ: Создаём таймер матча для ВСЕХ режимов
    this.createMatchTimer();
    
    // Центр табло в верхней части экрана
    const scoreY = this.config.isPvP ? 80 : 60;
    this.createScoreDisplay(width / 2, scoreY);

    const turnY = scoreY + 32;
    
    this.turnText = this.scene.add.text(width / 2, turnY, '', {
      fontSize: '20px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5, 0).setDepth(100);
    
    this.stateText = this.scene.add.text(width / 2, turnY + 28, '', {
      fontSize: '14px',
      fontFamily: fonts.primary,
      color: hexToString(colors.uiTextSecondary),
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5, 0).setDepth(100);
    
    if (!this.config.isPvP) {
      const modeLabel = this.config.isAIMode
        ? `🤖 vs AI (${this.config.aiDifficulty || 'medium'})`
        : '👥 Local PvP';
      this.modeText = this.scene.add.text(20, 20, modeLabel, {
        fontSize: '12px',
        fontFamily: fonts.tech,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      }).setDepth(100);
    }
    
    this.createPauseButton(scoreY);
    
    if (this.config.isPvP) {
      this.createTurnTimer();
    }
  }

  /** Табло счёта - с поддержкой фракционных арен */
  private createScoreDisplay(x: number, y: number): void {
    const fonts = getFonts();
    const container = this.scene.add.container(x, y).setDepth(99);

    if (this.config.arena) {
      this.createFactionScoreDisplay(container, fonts);
      return;
    }

    const style = this.fieldStyle;

    let leftLabelText = 'YOU';
    let rightLabelText: string;

    if (this.config.isPvP) {
      rightLabelText = this.config.opponentName || 'OPP';
    } else {
      rightLabelText = this.config.isAIMode ? 'BOT' : 'P2';
    }

    if (style === 'neon') {
      this.createNeonScoreDisplay(container, fonts, leftLabelText, rightLabelText);
    } else if (style === 'industrial') {
      this.createIndustrialScoreDisplay(container, fonts);
    } else if (style === 'carbon') {
      this.createCarbonScoreDisplay(container, fonts);
    } else {
      this.createGenericScoreDisplay(container, fonts);
    }
  }

  private createFactionScoreDisplay(container: Phaser.GameObjects.Container, fonts: any): void {
    const arena = this.config.arena!;
    const playerFaction = this.config.playerFaction;
    const opponentFaction = this.config.opponentFaction;

    const playerColor = playerFaction ? FACTIONS[playerFaction].color : 0x4ade80;
    const opponentColor = opponentFaction ? FACTIONS[opponentFaction].color : 0xff6b6b;
    const arenaAccent = arena.lineColor;

    const factionIcons: Record<FactionId, string> = {
      magma: '🔥',
      cyborg: '🤖',
      void: '🌀',
      insect: '🐛',
    };

    if (this.scene.textures.exists('ui_scoreboard')) {
      const scoreboard = this.scene.add.image(0, 0, 'ui_scoreboard');
      scoreboard.setTint(arenaAccent);
      scoreboard.setScale(0.5);
      container.add(scoreboard);
    } else {
      const bg = this.scene.add.graphics();
      bg.fillStyle(0x000000, 0.85);
      bg.fillRoundedRect(-150, -30, 300, 60, 20);
      bg.lineStyle(3, arenaAccent, 0.9);
      bg.strokeRoundedRect(-150, -30, 300, 60, 20);
      
      bg.lineStyle(2, arenaAccent, 1);
      bg.lineBetween(-145, -15, -145, -25);
      bg.lineBetween(-145, -25, -130, -25);
      bg.lineBetween(145, -15, 145, -25);
      bg.lineBetween(145, -25, 130, -25);
      bg.lineBetween(-145, 15, -145, 25);
      bg.lineBetween(-145, 25, -130, 25);
      bg.lineBetween(145, 15, 145, 25);
      bg.lineBetween(145, 25, 130, 25);
      
      container.add(bg);
    }

    const leftGlow = this.scene.add.circle(-100, 0, 18, playerColor, 0.3);
    container.add(leftGlow);
    
    const leftCircle = this.scene.add.circle(-100, 0, 14, playerColor, 0.9);
    container.add(leftCircle);
    
    if (playerFaction) {
      const factionIcon = this.scene.add.text(-100, 0, factionIcons[playerFaction], {
        fontSize: '16px',
      }).setOrigin(0.5);
      container.add(factionIcon);
    }

    const leftLabel = this.scene.add.text(-70, 0, 'YOU', {
      fontSize: '11px',
      fontFamily: fonts.tech,
      color: Phaser.Display.Color.IntegerToColor(playerColor).rgba,
    }).setOrigin(0, 0.5);
    container.add(leftLabel);

    const rightGlow = this.scene.add.circle(100, 0, 18, opponentColor, 0.3);
    container.add(rightGlow);
    
    const rightCircle = this.scene.add.circle(100, 0, 14, opponentColor, 0.9);
    container.add(rightCircle);
    
    if (opponentFaction) {
      const factionIcon = this.scene.add.text(100, 0, factionIcons[opponentFaction], {
        fontSize: '16px',
      }).setOrigin(0.5);
      container.add(factionIcon);
    }

    const rightLabel = this.scene.add.text(70, 0, this.config.isAIMode ? 'BOT' : 'OPP', {
      fontSize: '11px',
      fontFamily: fonts.tech,
      color: Phaser.Display.Color.IntegerToColor(opponentColor).rgba,
    }).setOrigin(1, 0.5);
    container.add(rightLabel);

    const divider = this.scene.add.graphics();
    divider.lineStyle(1, arenaAccent, 0.5);
    divider.lineBetween(0, -18, 0, 18);
    container.add(divider);

    this.scoreText = this.scene.add.text(0, 0, '0 : 0', {
      fontSize: '32px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5);
    container.add(this.scoreText);

    const arenaName = this.scene.add.text(0, 38, arena.name.toUpperCase(), {
      fontSize: '9px',
      fontFamily: fonts.tech,
      color: Phaser.Display.Color.IntegerToColor(arenaAccent).rgba,
    }).setOrigin(0.5).setAlpha(0.7);
    container.add(arenaName);
  }

  private createNeonScoreDisplay(container: Phaser.GameObjects.Container, fonts: any, leftLabelText: string, rightLabelText: string): void {
    const accent = 0x00f3ff;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.85);
    bg.fillRoundedRect(-160, -24, 320, 48, 18);
    bg.lineStyle(2, accent, 1);
    bg.strokeRoundedRect(-160, -24, 320, 48, 18);
    container.add(bg);

    const underline = this.scene.add.graphics();
    underline.lineStyle(2, accent, 1);
    underline.lineBetween(-190, 30, 190, 30);
    container.add(underline);

    const leftText = this.scene.add.text(-140, 0, leftLabelText, {
      fontSize: '14px',
      fontFamily: fonts.tech,
      color: '#00f3ff',
    }).setOrigin(0, 0.5);
    const rightText = this.scene.add.text(140, 0, rightLabelText, {
      fontSize: '14px',
      fontFamily: fonts.tech,
      color: '#00f3ff',
    }).setOrigin(1, 0.5);
    container.add(leftText);
    container.add(rightText);

    this.scoreText = this.scene.add.text(0, 0, '0 : 0', {
      fontSize: '32px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      stroke: '#00f3ff',
      strokeThickness: 4,
    }).setOrigin(0.5);
    container.add(this.scoreText);
  }

  private createIndustrialScoreDisplay(container: Phaser.GameObjects.Container, fonts: any): void {
    const accent = 0xffcc00;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x111111, 0.95);
    bg.fillRoundedRect(-140, -24, 280, 48, 10);
    bg.lineStyle(3, accent, 1);
    bg.strokeRoundedRect(-140, -24, 280, 48, 10);
    container.add(bg);

    const leftIcon = this.scene.add.text(-105, 0, '⚡', {
      fontSize: '20px',
    }).setOrigin(0.5);
    const rightIcon = this.scene.add.text(105, 0, '☢️', {
      fontSize: '20px',
    }).setOrigin(0.5);
    container.add(leftIcon);
    container.add(rightIcon);

    this.scoreText = this.scene.add.text(0, 0, '0 - 0', {
      fontSize: '30px',
      fontFamily: fonts.tech,
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
    container.add(this.scoreText);
  }

  private createCarbonScoreDisplay(container: Phaser.GameObjects.Container, fonts: any): void {
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRoundedRect(-150, -22, 300, 44, 22);
    bg.lineStyle(1, 0xffffff, 0.25);
    bg.strokeRoundedRect(-150, -22, 300, 44, 22);
    container.add(bg);

    const leftCircle = this.scene.add.circle(-112, 0, 10, 0x00c6ff, 1);
    const leftText = this.scene.add.text(-95, 0, 'PLAYER', {
      fontSize: '12px',
      fontFamily: fonts.tech,
      color: '#00c6ff',
    }).setOrigin(0, 0.5);
    container.add(leftCircle);
    container.add(leftText);

    const rightCircle = this.scene.add.circle(112, 0, 10, 0xff416c, 1);
    const rightText = this.scene.add.text(95, 0, 'ENEMY', {
      fontSize: '12px',
      fontFamily: fonts.tech,
      color: '#ff416c',
    }).setOrigin(1, 0.5);
    container.add(rightCircle);
    container.add(rightText);

    this.scoreText = this.scene.add.text(0, 0, '0 - 0', {
      fontSize: '28px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
    container.add(this.scoreText);
  }

  private createGenericScoreDisplay(container: Phaser.GameObjects.Container, fonts: any): void {
    const colors = getColors();
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.5);
    bg.fillRoundedRect(-60, -22, 120, 44, 22);
    bg.lineStyle(1, colors.glassBorder, 0.2);
    bg.strokeRoundedRect(-60, -22, 120, 44, 22);
    container.add(bg);

    this.scoreText = this.scene.add.text(0, 0, '0 : 0', {
      fontSize: '28px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
    container.add(this.scoreText);
  }

  private createPvPHeader(): void {
    const { width } = this.scene.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    
    const meName = playerData.getNickname ? playerData.getNickname() : playerData.get().username;
    const meAvatarId = playerData.getAvatarId ? playerData.getAvatarId() : undefined;

    const mp = MultiplayerManager.getInstance();
    const opp = mp.getOpponent();
    const opponentName = this.config.opponentName || opp?.name || 'Opponent';
    const opponentAvatarId = opp?.avatarId;

    this.pvpHeader = this.scene.add.container(width / 2, 0).setDepth(100);
    
    const headerBg = this.scene.add.graphics();
    headerBg.fillStyle(0x000000, 0.8);
    headerBg.fillRect(-width / 2, 0, width, 65);
    headerBg.lineStyle(2, colors.uiAccentPink, 0.4);
    headerBg.lineBetween(-width / 2, 65, width / 2, 65);
    this.pvpHeader.add(headerBg);
    
    const pvpBadge = this.scene.add.container(0, 32);
    const badgeBg = this.scene.add.graphics();
    badgeBg.fillStyle(colors.uiAccentPink, 0.25);
    badgeBg.fillRoundedRect(-42, -13, 84, 26, 13);
    badgeBg.lineStyle(1.5, colors.uiAccentPink, 0.7);
    badgeBg.strokeRoundedRect(-42, -13, 84, 26, 13);
    pvpBadge.add(badgeBg);
    pvpBadge.add(this.scene.add.text(0, 0, '⚔️ PVP', {
      fontSize: '13px',
      fontFamily: fonts.tech,
      color: hexToString(colors.uiAccentPink),
    }).setOrigin(0.5));
    this.pvpHeader.add(pvpBadge);
    
    const leftCard = this.scene.add.container(-width / 2 + 90, 32);
    this.pvpHeader.add(leftCard);

    this.addAvatarIcon(leftCard, -20, 0, meAvatarId, colors.uiAccent);
    leftCard.add(this.scene.add.text(4, 0, meName, {
      fontSize: '12px',
      fontFamily: fonts.tech,
      color: '#4ade80',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0, 0.5));

    this.connectionIndicator = this.scene.add.graphics();
    this.connectionIndicator.fillStyle(0x4ade80, 1);
    this.connectionIndicator.fillCircle(0, 0, 5);
    this.connectionIndicator.setPosition(-width / 2 + 35, 32);
    this.pvpHeader.add(this.connectionIndicator);
    
    const rightCard = this.scene.add.container(width / 2 - 90, 32);
    this.pvpHeader.add(rightCard);

    this.addAvatarIcon(rightCard, 20, 0, opponentAvatarId, colors.uiAccentPink);
    rightCard.add(this.scene.add.text(-4, 0, opponentName, {
      fontSize: '12px',
      fontFamily: fonts.tech,
      color: hexToString(colors.uiAccentPink),
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(1, 0.5));
    
    this.pvpHeader.setY(-65);
    this.scene.tweens.add({
      targets: this.pvpHeader,
      y: 0,
      duration: 500,
      ease: 'Back.easeOut',
    });
  }

  private addAvatarIcon(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    avatarId: string | undefined,
    color: number
  ): void {
    const radius = 14;

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

  /** ✅ ИСПРАВЛЕНО: Создаём таймер для всех режимов */
  private createMatchTimer(): void {
    const { width } = this.scene.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    
    // Позиция таймера зависит от режима
    const timerY = this.config.isPvP ? 18 : 22;
    
    this.matchTimerContainer = this.scene.add.container(width / 2, timerY).setDepth(101);
    
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRoundedRect(-50, -12, 100, 24, 12);
    bg.lineStyle(1, colors.uiAccent, 0.4);
    bg.strokeRoundedRect(-50, -12, 100, 24, 12);
    this.matchTimerContainer.add(bg);
    
    this.matchTimerContainer.add(this.scene.add.text(-35, 0, '⏱️', { fontSize: '12px' }).setOrigin(0.5));
    
    // Начальное время из конфига или 5:00 по умолчанию
    const initialTime = this.config.matchDuration || 300;
    const minutes = Math.floor(initialTime / 60);
    const seconds = initialTime % 60;
    
    this.matchTimerText = this.scene.add.text(5, 0, `${minutes}:${seconds.toString().padStart(2, '0')}`, {
      fontSize: '14px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.matchTimerContainer.add(this.matchTimerText);
  }

  /** ✅ Обновление таймера матча */
  updateMatchTimer(remainingTime: number, totalTime: number): void {
    if (!this.matchTimerText) return;
    
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    this.matchTimerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    
    // Цветовая индикация
    if (remainingTime <= 30) {
      this.matchTimerText.setColor('#ff4444');
      // Пульсация в последние 10 секунд
      if (remainingTime <= 10 && remainingTime > 0) {
        this.scene.tweens.add({
          targets: this.matchTimerText,
          scale: { from: 1, to: 1.25 },
          duration: 250,
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
    const fonts = getFonts();
    
    const timerY = 120;

    this.turnTimer = this.scene.add.text(width - 70, timerY, '60', {
      fontSize: '22px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(100);
    
    this.scene.add.text(width - 100, timerY, '⏱️', { fontSize: '18px' }).setOrigin(0.5).setDepth(100);
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

  private createPauseButton(anchorY: number): void {
    const { width } = this.scene.cameras.main;
    const colors = getColors();
    
    this.pauseButton = this.scene.add.container(width - 35, anchorY).setDepth(100);
    
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.5);
    bg.fillCircle(0, 0, 22);
    bg.lineStyle(2, colors.uiAccent, 0.5);
    bg.strokeCircle(0, 0, 22);
    this.pauseButton.add(bg);
    
    const icon = this.scene.add.graphics();
    icon.fillStyle(colors.uiAccent, 1);
    icon.fillRect(-7, -8, 4, 16);
    icon.fillRect(3, -8, 4, 16);
    this.pauseButton.add(icon);
    
    this.pauseButton.setInteractive(new Phaser.Geom.Circle(0, 0, 22), Phaser.Geom.Circle.Contains);
    this.pauseButton.on('pointerover', () => this.pauseButton.setScale(1.1));
    this.pauseButton.on('pointerout', () => this.pauseButton.setScale(1));
    this.pauseButton.on('pointerdown', () => this.onPauseCallback?.());
  }

  updateTurn(player: PlayerNumber, state: GameState, isAIMode: boolean): void {
    const colors = getColors();
    
    let teamColor: number;
    if (this.config.arena && this.config.playerFaction && this.config.opponentFaction) {
      teamColor = player === 1 
        ? FACTIONS[this.config.playerFaction].color 
        : FACTIONS[this.config.opponentFaction].color;
    } else {
      teamColor = player === 1 ? colors.uiAccent : colors.uiAccentPink;
    }
    
    let playerName: string;
    if (this.config.isPvP) {
      playerName = player === 1
        ? '🎯 Your turn'
        : `⏳ ${this.config.opponentName || 'Opponent'}'s turn`;
    } else {
      playerName = player === 1
        ? i18n.t('yourTurn')
        : (isAIMode ? i18n.t('enemyTurn') + ' 🤖' : i18n.t('player2') + "'s Turn");
    }
    this.turnText.setText(playerName).setColor(hexToString(teamColor));
    
    let stateMessage = '';
    switch (state) {
      case 'waiting':
        if (this.config.isPvP) {
          stateMessage = player === 1 ? '👆 ' + i18n.t('dragToShoot') : '⏳ Waiting...';
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
    const fonts = getFonts();
    const badgeY = this.config.isPvP ? 135 : 85;
    
    this.pendingFormationBadge = this.scene.add.container(width / 2, badgeY).setDepth(100);
    
    const bg = this.scene.add.graphics();
    bg.fillStyle(colors.uiAccent, 0.12);
    bg.fillRoundedRect(-105, -13, 210, 26, 13);
    bg.lineStyle(1, colors.uiAccent, 0.4);
    bg.strokeRoundedRect(-105, -13, 210, 26, 13);
    this.pendingFormationBadge.add(bg);
    
    this.pendingFormationBadge.add(this.scene.add.text(0, 0, `⏳ ${i18n.t('newFormation')}: ${formationName}`, {
      fontSize: '10px',
      fontFamily: fonts.tech,
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
    const fonts = getFonts();
    const { width } = this.scene.cameras.main;
    const notifY = this.config.isPvP ? 155 : 105;
    
    const notification = this.scene.add.container(width / 2, notifY).setDepth(300);
    
    const bg = this.scene.add.graphics();
    bg.fillStyle(colors.uiAccent, 0.15);
    bg.fillRoundedRect(-125, -22, 250, 44, 12);
    bg.lineStyle(2, colors.uiAccent, 0.7);
    bg.strokeRoundedRect(-125, -22, 250, 44, 12);
    notification.add(bg);
    
    notification.add(this.scene.add.text(0, 0, '✓ ' + i18n.t('formationChanged'), {
      fontSize: '14px',
      fontFamily: fonts.tech,
      color: hexToString(colors.uiAccent),
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
    const fonts = getFonts();
    const colorMap: Record<string, number> = { info: 0x3b82f6, warning: 0xf59e0b, success: 0x22c55e };
    const color = colorMap[type];
    
    const notification = this.scene.add.container(width / 2, 155).setDepth(300);
    
    const bg = this.scene.add.graphics();
    bg.fillStyle(color, 0.15);
    bg.fillRoundedRect(-145, -22, 290, 44, 12);
    bg.lineStyle(2, color, 0.7);
    bg.strokeRoundedRect(-145, -22, 290, 44, 12);
    notification.add(bg);
    
    notification.add(this.scene.add.text(0, 0, message, {
      fontSize: '13px',
      fontFamily: fonts.tech,
      color: '#ffffff',
    }).setOrigin(0.5));
    
    notification.setAlpha(0).setScale(0.85);
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
          scale: 0.85,
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