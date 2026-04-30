// src/scenes/MatchmakingScene.ts
// Сцена поиска PvP матчей с визуальной анимацией

import Phaser from 'phaser';
import { playerData } from '../data/PlayerData';
import { AudioManager } from '../managers/AudioManager';
import { PvPManager } from '../managers/PvPManager';
import { EventBus, GameEvents } from '../core/EventBus';
import { DEFAULT_PVP_CONFIG } from '../types/pvp';
import { hapticImpact, hapticSelection } from '../utils/Haptics';
import { tgApp } from '../utils/TelegramWebApp';
import { safeSceneStart } from '../utils/SceneHelpers';
import { FACTION_IDS, type FactionId } from '../constants/gameConstants';

type MatchmakingMode = 'casual' | 'ranked';

export class MatchmakingScene extends Phaser.Scene {
  private pvpManager?: PvPManager;
  private mode: MatchmakingMode = 'ranked';
  private isSearching = false;
  private searchStartTime = 0;
  
  // UI элементы
  private background?: Phaser.GameObjects.Image;
  private vignette?: Phaser.GameObjects.Graphics;
  private container?: Phaser.GameObjects.Container;
  private statusText?: Phaser.GameObjects.Text;
  private timerText?: Phaser.GameObjects.Text;
  private cancelButton?: Phaser.GameObjects.Container;
  private searchAnimation?: Phaser.GameObjects.Container;
  
  private timerEvent?: Phaser.Time.TimerEvent;
  private botMatchTimer?: Phaser.Time.TimerEvent;
  private s = 1; // UI scale
  private readonly botNames = [
    'NeonStrike#214',
    'CyberBlade#508',
    'VoidWalker#733',
    'QuantumFlux#091',
    'NovaPrime#326',
    'AstroTitan#647',
    'PlasmaEdge#882',
    'ShadowPrime#159',
  ];
  
  constructor() {
    super({ key: 'MatchmakingScene' });
  }
  
  init(data?: { mode?: MatchmakingMode }): void {
    this.mode = data?.mode || 'ranked';
  }
  
  create(): void {
    this.s = tgApp.getUIScale();
    const { width, height } = this.cameras.main;
    
    // Audio
    const audio = AudioManager.getInstance();
    audio.init(this);
    audio.playMusic('bgm_menu');
    
    // Background
    this.createBackground();
    
    // Container
    this.container = this.add.container(width / 2, height / 2).setDepth(10);
    
    // Title
    const title = this.add.text(0, -height * 0.3, 
      this.mode === 'ranked' ? 'РЕЙТИНГОВЫЙ МАТЧ' : 'AI',
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
    
    // Status text
    this.statusText = this.add.text(0, -height * 0.1, 'Подключение к серверу...', {
      fontFamily: 'Rajdhani',
      fontSize: `${20 * this.s}px`,
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: width * 0.8 },
      stroke: '#000000',
      strokeThickness: 6,
    });
    this.statusText.setOrigin(0.5);
    this.container.add(this.statusText);
    
    // Timer text
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
    
    // Search animation
    this.createSearchAnimation();
    
    // Cancel button
    this.createCancelButton();
    
    // ✅ NEW PVP: Инициализация новой системы
    this.initializePvP();
    
    // Start connection
    this.time.delayedCall(500, () => {
      this.startMatchmaking();
    });
  }
  
  private createBackground(): void {
    const { width, height } = this.cameras.main;
    
    // Gradient background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a14, 0x0a0a14, 0x1a1a2e, 0x1a1a2e, 1, 1, 1, 1);
    bg.fillRect(0, 0, width, height);
    
    // Vignette
    this.vignette = this.add.graphics().setDepth(5);
    this.vignette.fillGradientStyle(
      0x000000, 0x000000, 0x000000, 0x000000,
      0, 0, 0.6, 0.6
    );
    this.vignette.fillRect(0, height * 0.7, width, height * 0.3);
  }
  
  private createSearchAnimation(): void {
    const { width, height } = this.cameras.main;
    this.searchAnimation = this.add.container(0, height * 0.1);
    
    // Rotating circle
    const circle = this.add.graphics();
    circle.lineStyle(4 * this.s, 0x9d00ff, 1);
    circle.arc(0, 0, 50 * this.s, 0, Math.PI * 1.5, false);
    circle.strokePath();
    
    this.searchAnimation.add(circle);
    this.container?.add(this.searchAnimation);
    
    // Rotate animation
    this.tweens.add({
      targets: circle,
      angle: 360,
      duration: 1500,
      repeat: -1,
      ease: 'Linear',
    });
    
    // Pulse animation
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
    const { width, height } = this.cameras.main;
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
    
    // Interactive
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
  
  // ✅ NEW PVP: Инициализация новой системы
  private initializePvP(): void {
    // Получаем или создаём PvPManager
    this.pvpManager = PvPManager.getInstance({
      serverUrl: DEFAULT_PVP_CONFIG.serverUrl,
      autoReconnect: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
    
    // Подписываемся на события
    EventBus.on(GameEvents.PVP_CONNECTED, this.onConnected, this);
    EventBus.on(GameEvents.PVP_DISCONNECTED, this.onDisconnected, this);
    EventBus.on(GameEvents.PVP_MATCH_FOUND, this.onMatchFound, this);
    EventBus.on(GameEvents.PVP_ERROR, this.onError, this);
  }
  
  // ✅ NEW PVP: Обработчики событий
  private onConnected(): void {
    console.log('[MatchmakingScene] ✅ Подключено к PVP серверу');
    this.updateStatus('Поиск оппонента...', '#00f2ff');
  }
  
  private onDisconnected(payload: { reason: string }): void {
    console.log('[MatchmakingScene] Отключено:', payload.reason);
    this.updateStatus('Потеряно соединение с сервером', '#ff4500');
    this.time.delayedCall(2000, () => {
      this.handleBack();
    });
  }
  
  private onMatchFound(payload: { roomId: string; opponentId: string; opponentName?: string; yourTeam: number }): void {
    console.log('[MatchmakingScene] 🎮 Матч найден!', payload);
    
    this.isSearching = false;
    this.botMatchTimer?.destroy();
    this.botMatchTimer = undefined;
    this.updateStatus('Оппонент найден!', '#39ff14');
    hapticImpact('heavy');
    
    // Показываем VS
    this.time.delayedCall(500, () => {
      this.updateStatus(`VS ${payload.opponentName || 'OPPONENT'}`, '#fbbf24');
    });
    
    // Запуск матча через 2 секунды
    this.time.delayedCall(2000, () => {
      this.startMatch(payload);
    });
  }
  
  private onError(payload: { type: string; message: string }): void {
    console.error('[MatchmakingScene] Ошибка:', payload);
    this.updateStatus(`Ошибка: ${payload.message}`, '#ff4500');
    this.time.delayedCall(2000, () => {
      this.handleBack();
    });
  }
  
  // ✅ NEW PVP: Начало поиска матча
  private async startMatchmaking(): Promise<void> {
    if (!this.pvpManager) {
      this.updateStatus('PVP Manager не инициализирован', '#ff4500');
      this.time.delayedCall(2000, () => this.handleBack());
      return;
    }
    
    try {
      this.updateStatus('Подключение к серверу...', '#ffffff');
      
      // Подключаемся к серверу
      await this.pvpManager.connect();
      
      // Сервер отправит событие PVP_CONNECTED, которое обновит статус
      this.isSearching = true;
      this.searchStartTime = Date.now();
      
      // Start timer
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
      
      const player = playerData.get();
      const factionId = playerData.getFaction() || 'magma';
      
      // Начинаем поиск матча
      this.pvpManager.findGame(this.mode, {
        playerName: playerData.getNickname?.() || player.username || 'Player',
        mmr: player.pvpStats?.[this.mode]?.rating,
        factionId,
        teamUnitIds: playerData.getTeamUnits(factionId),
        teamSize: playerData.getAllowedTeamSize(factionId),
      });

      if (this.mode === 'casual') {
        this.botMatchTimer?.destroy();
        this.botMatchTimer = this.time.delayedCall(6500, () => {
          this.startCasualBotMatch();
        });
      }
      
    } catch (error) {
      console.error('[MatchmakingScene] Ошибка подключения:', error);
      this.updateStatus('Не удалось подключиться к серверу', '#ff4500');
      this.time.delayedCall(2000, () => {
        this.handleBack();
      });
    }
  }
  
  // ✅ NEW PVP: Отмена поиска
  private cancelSearch(): void {
    if (this.isSearching && this.pvpManager) {
      this.pvpManager.cancelSearch();
      this.isSearching = false;
    }
    this.handleBack();
  }
  
  private updateStatus(text: string, color: string): void {
    this.statusText?.setText(text);
    this.statusText?.setColor(color);
    
    // Pulse effect
    this.tweens.add({
      targets: this.statusText,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 200,
      yoyo: true,
      ease: 'Back.easeOut',
    });
  }
  
  // ✅ NEW PVP: Запуск матча
  private startMatch(matchData: { roomId: string; opponentId: string; opponentName?: string; yourTeam: number }): void {
    console.log('[MatchmakingScene] Запуск матча:', matchData);
    
    // Store match mode in player data
    const pdata = playerData.get();
    pdata.currentMatchMode = this.mode;
    playerData.save();
    
    // Cleanup
    this.cleanup();
    
    // ✅ NEW PVP: Запуск GameScene с новой системой
    this.scene.stop('MatchmakingScene');
    safeSceneStart(this, 'GameScene', {
      mode: 'pvp',  // ⬅️ Новый флаг
      roomId: matchData.roomId,
      yourTeam: matchData.yourTeam,
      opponentId: matchData.opponentId,
      opponentName: matchData.opponentName,
      matchContext: 'casual',
      useFactions: true,
    });
  }

  private startCasualBotMatch(): void {
    if (!this.isSearching) return;

    const playerFaction = playerData.getFaction() || 'magma';
    const opponentFaction = this.getRandomOpponentFaction(playerFaction);
    const opponentName = this.botNames[Math.floor(Math.random() * this.botNames.length)];

    this.isSearching = false;
    this.pvpManager?.cancelSearch();
    this.updateStatus(`VS ${opponentName}`, '#fbbf24');
    hapticImpact('heavy');

    this.time.delayedCall(800, async () => {
      this.cleanup();
      this.scene.stop('MatchmakingScene');
      await safeSceneStart(this, 'GameScene', {
        isAI: true,
        vsAI: true,
        difficulty: 'medium',
        matchContext: 'casual',
        useFactions: true,
        playerFaction,
        opponentFaction,
        opponentName,
      });
    });
  }

  private getRandomOpponentFaction(playerFaction: FactionId): FactionId {
    const available = FACTION_IDS.filter((faction) => faction !== playerFaction);
    return Phaser.Math.RND.pick(available) || 'magma';
  }
  
  private async handleBack(): Promise<void> {
    AudioManager.getInstance().stopAllSounds();
    this.cleanup();
    this.scene.stop('MatchmakingScene');
    await safeSceneStart(this, 'MatchModeSelectScene');
  }
  
  // ✅ NEW PVP: Cleanup
  private cleanup(): void {
    // Отписываемся от событий
    EventBus.off(GameEvents.PVP_CONNECTED, this.onConnected, this);
    EventBus.off(GameEvents.PVP_DISCONNECTED, this.onDisconnected, this);
    EventBus.off(GameEvents.PVP_MATCH_FOUND, this.onMatchFound, this);
    EventBus.off(GameEvents.PVP_ERROR, this.onError, this);
    
    // Отменяем поиск если активен
    if (this.isSearching && this.pvpManager) {
      this.pvpManager.cancelSearch();
      this.isSearching = false;
    }
    
    if (this.timerEvent) {
      this.timerEvent.destroy();
      this.timerEvent = undefined;
    }

    if (this.botMatchTimer) {
      this.botMatchTimer.destroy();
      this.botMatchTimer = undefined;
    }
    
    if (this.tweens) {
      this.tweens.killAll();
    }
  }
  
  shutdown(): void {
    this.cleanup();
  }
}
