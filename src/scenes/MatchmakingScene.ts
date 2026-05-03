// src/scenes/MatchmakingScene.ts
// PvP matchmaking → MatchPreparation → MatchVS → GameScene (skipIntro при матче)

import Phaser from 'phaser';
import { playerData } from '../data/PlayerData';
import { AudioManager } from '../managers/AudioManager';
import { PvPManager } from '../managers/PvPManager';
import { DEFAULT_PVP_CONFIG } from '../types/pvp';
import { hapticImpact } from '../utils/Haptics';
import { tgApp } from '../utils/TelegramWebApp';
import { safeSceneStart } from '../utils/SceneHelpers';
import { FACTION_IDS, type FactionId } from '../constants/gameConstants';
import { eventBus, GameEvents, type EventPayload } from '../core/EventBus';
import { getMatchDurationForTeamSize } from '../match/accountLevelMatchRules';
import { generateHumanLikeOpponentNickname } from '../utils/humanLikeNickname';

type MatchmakingMode = 'casual' | 'ranked';

export class MatchmakingScene extends Phaser.Scene {
  private mode: MatchmakingMode = 'ranked';
  private isSearching = false;
  private searchStartTime = 0;
  private pvpConnected = false;

  private background?: Phaser.GameObjects.Graphics;
  private vignette?: Phaser.GameObjects.Graphics;
  private container?: Phaser.GameObjects.Container;
  private statusText?: Phaser.GameObjects.Text;
  private timerText?: Phaser.GameObjects.Text;
  private cancelButton?: Phaser.GameObjects.Container;
  private searchAnimation?: Phaser.GameObjects.Container;

  private timerEvent?: Phaser.Time.TimerEvent;
  private fallbackTimer?: Phaser.Time.TimerEvent;
  private matchFoundHandler!: (payload: EventPayload<GameEvents.PVP_MATCH_FOUND>) => void;
  private s = 1;

  constructor() {
    super({ key: 'MatchmakingScene' });
  }

  init(data?: { mode?: MatchmakingMode }): void {
    this.mode = data?.mode || 'ranked';
  }

  create(): void {
    this.s = tgApp.getUIScale();
    const { width, height } = this.cameras.main;

    const audio = AudioManager.getInstance();
    audio.init(this);
    audio.playMusic('bgm_menu');

    this.createBackground();

    this.container = this.add.container(width / 2, height / 2).setDepth(10);

    const title = this.add.text(
      0,
      -height * 0.3,
      'PVP ONLINE',
      {
        fontFamily: 'Orbitron',
        fontSize: `${28 * this.s}px`,
        color: this.mode === 'ranked' ? '#9d00ff' : '#39ff14',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 8,
      }
    );
    title.setOrigin(0.5);
    title.setShadow(4 * this.s, 4 * this.s, '#000000', 10, true, true);
    this.container.add(title);

    this.statusText = this.add.text(0, -height * 0.1, 'Подключение...', {
      fontFamily: 'Rajdhani',
      fontSize: `${20 * this.s}px`,
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: width * 0.85 },
      stroke: '#000000',
      strokeThickness: 6,
    });
    this.statusText.setOrigin(0.5);
    this.container.add(this.statusText);

    this.timerText = this.add.text(0, -height * 0.05, '', {
      fontFamily: 'Rajdhani',
      fontSize: `${18 * this.s}px`,
      color: '#00f2ff',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 5,
    });
    this.timerText.setOrigin(0.5);
    this.container.add(this.timerText);

    this.createSearchAnimation();
    this.createCancelButton();

    this.matchFoundHandler = (payload) => {
      this.handleMatchFoundFromBus(payload);
    };
    eventBus.subscribe(GameEvents.PVP_MATCH_FOUND, this.matchFoundHandler, this);

    this.startMatchmaking();

    this.time.delayedCall(350, () => {
      void this.beginOnlineSearch();
    });
  }

  private createBackground(): void {
    const { width, height } = this.cameras.main;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a14, 0x0a0a14, 0x1a1a2e, 0x1a1a2e, 1, 1, 1, 1);
    bg.fillRect(0, 0, width, height);

    this.vignette = this.add.graphics().setDepth(5);
    this.vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.6, 0.6);
    this.vignette.fillRect(0, height * 0.7, width, height * 0.3);
  }

  private createSearchAnimation(): void {
    const { height } = this.cameras.main;
    this.searchAnimation = this.add.container(0, height * 0.1);

    const circle = this.add.graphics();
    circle.lineStyle(4 * this.s, 0x9d00ff, 1);
    circle.arc(0, 0, 50 * this.s, 0, Math.PI * 1.5, false);
    circle.strokePath();

    this.searchAnimation.add(circle);
    this.container?.add(this.searchAnimation);

    this.tweens.add({
      targets: circle,
      angle: 360,
      duration: 1500,
      repeat: -1,
      ease: 'Linear',
    });

    this.tweens.add({
      targets: this.searchAnimation,
      scaleX: 1.1,
      scaleY: 1.1,
      alpha: 0.6,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createCancelButton(): void {
    const { height } = this.cameras.main;
    const buttonY = height * 0.35;

    this.cancelButton = this.add.container(0, buttonY);

    const buttonWidth = 200 * this.s;
    const buttonHeight = 50 * this.s;

    const bg = this.add.graphics();
    bg.fillStyle(0xff4500, 1);
    bg.lineStyle(2, 0xffffff, 0.5);
    bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
    bg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
    this.cancelButton.add(bg);

    const label = this.add.text(0, 0, 'ОТМЕНА', {
      fontFamily: 'Orbitron',
      fontSize: `${16 * this.s}px`,
      color: '#ffffff',
      fontStyle: 'bold',
    });
    label.setOrigin(0.5);
    this.cancelButton.add(label);

    const hitArea = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0xffffff, 0.001);
    hitArea.setInteractive({ useHandCursor: true });

    hitArea.on('pointerdown', () => {
      AudioManager.getInstance().playUIClick();
      hapticImpact('medium');
      this.cancelSearch();
    });

    hitArea.on('pointerover', () => {
      this.tweens.add({
        targets: this.cancelButton,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 150,
      });
    });

    hitArea.on('pointerout', () => {
      this.tweens.add({
        targets: this.cancelButton,
        scaleX: 1,
        scaleY: 1,
        duration: 150,
      });
    });

    this.cancelButton.add(hitArea);
    this.container?.add(this.cancelButton);
  }

  private async beginOnlineSearch(): Promise<void> {
    const pMgr = PvPManager.getInstance({
      serverUrl: DEFAULT_PVP_CONFIG.serverUrl,
      autoReconnect: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    const ok = await pMgr.connect();

    if (!this.isSearching) {
      if (ok) {
        try {
          pMgr.cancelSearch();
        } catch {
          /* noop */
        }
        pMgr.disconnect();
        this.pvpConnected = false;
      }
      return;
    }

    if (!ok) {
      this.updateStatus('Матч найден!', '#39ff14');
      hapticImpact('heavy');
      this.time.delayedCall(550, () => this.gotoOfflineFallback('Сервер недоступен'));
      return;
    }

    this.pvpConnected = true;
    this.updateStatus('Поиск соперника...', '#00f2ff');

    const data = playerData.get();
    const mmrBucket = data.pvpStats?.[this.mode]?.rating ?? 1000;

    const bracket = this.progressionBracket();

    pMgr.findGame(this.mode, {
      playerName: playerData.getNickname() || data.nickname || 'Player',
      mmr: mmrBucket,
      factionId: playerData.getFaction() || undefined,
      teamSize: bracket.teamSize,
      teamUnitIds: playerData.getTeamUnits(playerData.getFaction() || 'magma').filter(Boolean) as string[],
    });

    this.fallbackTimer?.destroy();
    this.fallbackTimer = this.time.delayedCall(16000, () => {
      if (!this.isSearching) return;
      this.updateStatus('Матч найден!', '#39ff14');
      hapticImpact('heavy');
      this.cancelQueueOnly();
      this.time.delayedCall(450, () => this.gotoOfflineFallback('Таймаут поиска'));
    });
  }

  private cancelQueueOnly(): void {
    const pMgr = PvPManager.getInstance();
    try {
      pMgr.cancelSearch();
    } catch {
      /* noop */
    }
  }

  private handleMatchFoundFromBus(payload: EventPayload<GameEvents.PVP_MATCH_FOUND>): void {
    if (!this.isSearching || !payload?.roomId) return;

    this.isSearching = false;
    if (this.fallbackTimer) {
      this.fallbackTimer.destroy();
      this.fallbackTimer = undefined;
    }

    eventBus.unsubscribe(GameEvents.PVP_MATCH_FOUND, this.matchFoundHandler, this);

    const bot = payload.isBotOpponent === true;
    if (bot) {
      this.cancelQueueOnly();
      PvPManager.getInstance().disconnect();
      this.pvpConnected = false;
    }

    this.updateStatus('Матч найден!', '#39ff14');
    hapticImpact('heavy');

    const pdata = playerData.get();
    pdata.currentMatchMode = this.mode;
    playerData.save();

    void this.gotoMatchPrepFromServer(bot, payload);
  }

  private generateBotNickname(): string {
    return generateHumanLikeOpponentNickname();
  }

  private avatarIdForNickname(name: string): string {
    const botAvatars = [
      'avatar_recruit',
      'avatar_explorer',
      'avatar_magma_warrior',
      'avatar_cyborg_elite',
      'avatar_void_mystic',
      'avatar_insect_hive',
      'avatar_champion',
      'avatar_legend',
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return botAvatars[Math.abs(hash) % botAvatars.length];
  }

  private opponentFactionPreferServer(
    factionId?: string,
    playerFaction?: FactionId
  ): FactionId | undefined {
    if (factionId && FACTION_IDS.includes(factionId as FactionId)) {
      return factionId as FactionId;
    }
    const pf = playerFaction || playerData.getFaction() || 'magma';
    const rest = FACTION_IDS.filter((f) => f !== pf);
    return rest[Math.floor(Math.random() * rest.length)];
  }

  /** Размер команды и таймер по слотам мастерства выбранной фракции (онлайн PvP / подготовка). */
  private progressionBracket(): { teamSize: 3 | 4 | 5; matchDurationSeconds: number } {
    const faction = (playerData.getFaction() || 'magma') as FactionId;
    const teamSize = Math.min(
      5,
      Math.max(3, playerData.getAllowedTeamSize(faction))
    ) as 3 | 4 | 5;
    return {
      teamSize,
      matchDurationSeconds: getMatchDurationForTeamSize(teamSize),
    };
  }

  private async gotoMatchPrepFromServer(
    botMatch: boolean,
    found: EventPayload<GameEvents.PVP_MATCH_FOUND>
  ): Promise<void> {
    this.cleanupSearchTimers();

    const playerFaction = (playerData.getFaction() || 'magma') as FactionId;
    const oppFaction = this.opponentFactionPreferServer(found.opponentFactionId, playerFaction);

    const opponentName = (found.opponentName || this.generateBotNickname()).trim() || this.generateBotNickname();
    const opponentAvatarId = this.avatarIdForNickname(opponentName);
    const bracket = this.progressionBracket();

    await safeSceneStart(this, 'MatchPreparationScene', {
      matchContext: this.mode === 'ranked' ? 'ranked' : 'casual',
      isAI: botMatch,
      aiDifficulty:
        this.mode === 'ranked' ? Phaser.Math.Between(2, 3) : Phaser.Math.Between(1, 2),
      opponentName,
      opponentAvatarId,
      opponentFaction: oppFaction,
      teamSize: bracket.teamSize,
      matchDuration: bracket.matchDurationSeconds,
      ...(botMatch
        ? {}
        : {
            pvpRoomId: found.roomId,
            pvpOpponentId: found.opponentId,
            pvpYourTeam: found.yourTeam ?? 1,
          }),
    });
    this.scene.stop('MatchmakingScene');
  }

  private gotoOfflineFallback(reason: string): void {
    console.warn('[MatchmakingScene]', reason);

    this.isSearching = false;

    this.cancelQueueOnly();
    PvPManager.getInstance().disconnect();
    this.pvpConnected = false;

    this.cleanupSearchTimers();
    eventBus.unsubscribe(GameEvents.PVP_MATCH_FOUND, this.matchFoundHandler, this);

    const pdata = playerData.get();
    pdata.currentMatchMode = this.mode;
    playerData.save();

    const playerFaction = (playerData.getFaction() || 'magma') as FactionId;
    const opponentFaction = this.opponentFactionPreferServer(undefined, playerFaction)!;
    const opponentName = this.generateBotNickname();
    const opponentAvatarId = this.avatarIdForNickname(opponentName);
    const bracket = this.progressionBracket();

    void safeSceneStart(this, 'MatchPreparationScene', {
      matchContext: this.mode === 'ranked' ? 'ranked' : 'casual',
      isAI: true,
      aiDifficulty:
        this.mode === 'ranked' ? Phaser.Math.Between(2, 3) : Phaser.Math.Between(1, 2),
      opponentName,
      opponentAvatarId,
      opponentFaction,
      teamSize: bracket.teamSize,
      matchDuration: bracket.matchDurationSeconds,
    });
    this.scene.stop('MatchmakingScene');
  }

  private startMatchmaking(): void {
    this.isSearching = true;
    this.searchStartTime = Date.now();

    this.timerEvent?.destroy();
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: () => {
        const elapsed = Math.floor((Date.now() - this.searchStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        this.timerText?.setText(
          `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      },
      loop: true,
    });
  }

  private cancelSearch(): void {
    this.isSearching = false;
    this.cancelQueueOnly();
    if (this.pvpConnected) {
      PvPManager.getInstance().disconnect();
      this.pvpConnected = false;
    }
    void this.handleBack();
  }

  private updateStatus(text: string, color: string): void {
    this.statusText?.setText(text);
    this.statusText?.setColor(color);

    this.tweens.add({
      targets: this.statusText,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 200,
      yoyo: true,
      ease: 'Back.easeOut',
    });
  }

  private async handleBack(): Promise<void> {
    AudioManager.getInstance().stopAllSounds();
    this.cleanupTimersAndSubs(true);
    await safeSceneStart(this, 'MatchModeSelectScene');
    this.scene.stop('MatchmakingScene');
  }

  private cleanupSearchTimers(): void {
    if (this.timerEvent) {
      this.timerEvent.destroy();
      this.timerEvent = undefined;
    }
    if (this.fallbackTimer) {
      this.fallbackTimer.destroy();
      this.fallbackTimer = undefined;
    }
  }

  private cleanupTimersAndSubs(fullDispose: boolean): void {
    this.cleanupSearchTimers();

    eventBus.unsubscribe(GameEvents.PVP_MATCH_FOUND, this.matchFoundHandler, this);

    if (fullDispose) {
      try {
        PvPManager.getInstance().cancelSearch();
      } catch {
        /* noop */
      }
      PvPManager.getInstance().disconnect();
      this.pvpConnected = false;
    }

    if (this.tweens) {
      this.tweens.killAll();
    }
  }

  shutdown(): void {
    this.cleanupTimersAndSubs(true);
  }
}
