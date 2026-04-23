// src/scenes/game/systems/GamePvP.ts
// Система PvP для GameScene

import Phaser from 'phaser';
import { MultiplayerManager } from '../../../managers/MultiplayerManager';
import { PlayerNumber } from '../../../types';
import { MatchResult } from '../../../types/MatchResult';
import { MatchDirector } from '../../../controllers/match/MatchDirector';

export interface GamePvPConfig {
  scene: Phaser.Scene;
  isHost: boolean;
  isPvPMode: boolean;
  matchDuration: number;
  onMatchEnd: (data: { result: MatchResult }) => void;
  getMatchDirector: () => MatchDirector;
}

export interface PvPSyncCallbacks {
  onShootExecuted?: (data: any, isMyShoot: boolean) => void;
  onTurnChange?: (data: any) => void;
  onGoalScored?: (data: any) => void;
  onContinueGame?: (data: any) => void;
  onMatchFinished?: (data: any) => void;
  onOpponentLeft?: (reason: string, data: any) => void;
  onTimerUpdate?: (remaining: number, total: number) => void;
}

/**
 * Система PvP для игровой сцены
 * Отвечает за синхронизацию, обработку событий PvP
 */
export class GamePvP {
  private scene: Phaser.Scene;
  private config: GamePvPConfig;
  private mp!: MultiplayerManager;
  private pvpSync?: any; // PvPSyncManager
  
  constructor(config: GamePvPConfig) {
    this.scene = config.scene;
    this.config = config;
  }
  
  /**
   * Настройка PvP
   */
  setup(): void {
    if (!this.config.isPvPMode) {
      console.log('[GamePvP] Not in PvP mode, skipping setup');
      return;
    }
    
    this.mp = MultiplayerManager.getInstance();
    console.log('[GamePvP] Setup complete', {
      isHost: this.config.isHost,
      myPlayerIndex: this.mp.getMyPlayerIndex(),
    });
  }
  
  /**
   * Создание PvP синхронизации
   */
  async createPvPSync(callbacks: PvPSyncCallbacks): Promise<void> {
    if (!this.config.isPvPMode) {
      return;
    }
    
    try {
      const { PvPSyncManager } = await import('../PvPSyncManager');
      const { PvPDebugLogger } = await import('../PvPDebugLogger');
      
      const debug = new PvPDebugLogger();
      debug.init(this.config.isHost, this.mp.getMyPlayerIndex(), this.mp.getMyId());
      
      // OLD PVP system - temporarily disabled
      // TODO: Refactor to use new PvPSyncManager
      console.log('[GamePvP] OLD PVP system temporarily disabled');
      // All old PVP sync logic commented out
    } catch (error) {
      console.error('[GamePvP] Failed to create PvP sync:', error);
    }
  }
  
  /**
   * Обработка завершения PvP матча
   */
  private async handlePvPMatchEnd(data: any): Promise<void> {
    const myId = this.mp.getMyId();
    const isWin = data.winner === myId;
    const isDraw = data.winner === null;
    
    try {
      const { GameResultFactory } = await import('../MatchResultHelper');
      
      const opponent = this.mp.getOpponent();
      const myScore = data.scores[myId || ''] || 0;
      const oppScore = data.scores[opponent?.id || ''] || 0;
      
      const result = GameResultFactory.createPvPResult(
        'ranked', // or get from playerData
        isDraw ? null : isWin,
        myScore,
        oppScore,
        opponent?.name || 'Opponent',
        1500, // opponent rating - should come from server
        this.config.matchDuration,
        'time_up'
      );
      
      this.config.onMatchEnd({ result });
    } catch (error) {
      console.error('[GamePvP] Failed to handle match end:', error);
    }
  }
  
  /**
   * Обработка выхода оппонента
   */
  private async handleOpponentLeft(reason: string): Promise<void> {
    try {
      const { GameResultFactory } = await import('../MatchResultHelper');
      
      const opponent = this.mp.getOpponent();
      const myId = this.mp.getMyId();
      const matchDirector = this.config.getMatchDirector();
      const scores = matchDirector.getScore();
      
      const result = GameResultFactory.createPvPResult(
        'ranked',
        true, // Win by forfeit
        scores.player1,
        scores.player2,
        opponent?.name || 'Opponent',
        1500,
        this.config.matchDuration,
        reason === 'surrendered' ? 'surrender' : 'disconnect'
      );
      
      this.config.onMatchEnd({ result });
    } catch (error) {
      console.error('[GamePvP] Failed to handle opponent left:', error);
    }
  }
  
  /**
   * Получение индекса владельца для текущего игрока
   */
  getMyOwner(): PlayerNumber {
    if (!this.config.isPvPMode) {
      return 1;
    }
    return this.mp.getMyPlayerIndex() as PlayerNumber;
  }
  
  /**
   * Проверка, является ли игрок хостом
   */
  isHost(): boolean {
    return this.config.isHost;
  }
  
  /**
   * Получение ID текущего игрока
   */
  getMyId(): string | null {
    return this.mp.getMyId();
  }
  
  /**
   * Получение индекса игрока
   */
  getMyPlayerIndex(): PlayerNumber {
    return this.mp.getMyPlayerIndex() as PlayerNumber;
  }
  
  /**
   * Получение оппонента
   */
  getOpponent(): any {
    return this.mp.getOpponent();
  }
  
  /**
   * Отправка события удара
   */
  sendShoot(data: any): void {
    if (this.pvpSync) {
      this.pvpSync.sendShoot(data);
    }
  }
  
  /**
   * Отправка события гола
   */
  sendGoal(data: any): void {
    if (this.pvpSync) {
      this.pvpSync.sendGoal(data);
    }
  }
  
  /**
   * Отправка события смены хода
   */
  sendTurnChange(data: any): void {
    if (this.pvpSync) {
      this.pvpSync.sendTurnChange(data);
    }
  }
  
  /**
   * Отправка события завершения матча
   */
  sendMatchEnd(data: any): void {
    if (this.pvpSync) {
      this.pvpSync.sendMatchEnd(data);
    }
  }
  
  /**
   * Получение PvP sync менеджера
   */
  getPvPSync(): any {
    return this.pvpSync;
  }
  
  /**
   * Получение multiplayer менеджера
   */
  getMultiplayerManager(): MultiplayerManager {
    return this.mp;
  }
  
  /**
   * Проверка, активен ли PvP режим
   */
  isPvPActive(): boolean {
    return this.config.isPvPMode;
  }
  
  /**
   * Очистка
   */
  cleanup(): void {
    if (this.pvpSync) {
      if (this.pvpSync.cleanup) {
        this.pvpSync.cleanup();
      }
      this.pvpSync = undefined;
    }
  }
}
