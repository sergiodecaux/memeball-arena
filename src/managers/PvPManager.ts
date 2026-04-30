// src/managers/PvPManager.ts
// Менеджер PVP подключения и взаимодействия с сервером

import { io, Socket } from 'socket.io-client';
import { EventBus, GameEvents } from '../core/EventBus';
import { PvPConfig, DEFAULT_PVP_CONFIG } from '../types/pvp';
import { globalCleanup } from '../utils/GlobalCleanup';

export interface PvPMatchInfo {
  roomId: string;
  opponentId: string;
  opponentName?: string;
  yourTeam: number;
}

export interface PvPMatchmakingProfile {
  playerName?: string;
  mmr?: number;
  factionId?: string;
  teamUnitIds?: string[];
  teamSize?: number;
}

/**
 * Менеджер для PVP подключения и обмена сообщениями с сервером
 */
export class PvPManager {
  private static instance: PvPManager | null = null;
  
  private socket: Socket | null = null;
  private config: PvPConfig;
  private isConnected: boolean = false;
  private currentRoomId: string | null = null;
  private myTeam: number = 0;
  
  private constructor(config?: Partial<PvPConfig>) {
    this.config = { ...DEFAULT_PVP_CONFIG, ...config };
  }
  
  /**
   * Получить или создать экземпляр PvPManager
   */
  public static getInstance(config?: Partial<PvPConfig>): PvPManager {
    if (!PvPManager.instance) {
      PvPManager.instance = new PvPManager(config);
    }
    return PvPManager.instance;
  }
  
  /**
   * Сбросить экземпляр (для тестирования)
   */
  public static resetInstance(): void {
    if (PvPManager.instance) {
      PvPManager.instance.disconnect();
      PvPManager.instance = null;
    }
  }
  
  /**
   * Подключиться к PVP серверу
   */
  public async connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isConnected && this.socket?.connected) {
        if (import.meta.env.DEV) {
          console.log('[PvPManager] Already connected');
        }
        resolve(true);
        return;
      }
      
      if (import.meta.env.DEV) {
        console.log('[PvPManager] Connecting to:', this.config.serverUrl);
      }
      
      this.socket = io(this.config.serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: this.config.autoReconnect,
        reconnectionDelay: this.config.reconnectionDelay,
        reconnectionAttempts: this.config.reconnectionAttempts,
      });
      
      const timeout = globalCleanup.setTimeout(() => {
        if (!this.isConnected) {
          if (import.meta.env.DEV) {
            console.error('[PvPManager] Connection timeout');
          }
          EventBus.emit(GameEvents.PVP_ERROR, {
            type: 'connection_timeout',
            message: 'Failed to connect to server',
          });
          resolve(false);
        }
      }, 10000);

      this.socket.on('connect', () => {
        globalCleanup.clearTimeout(timeout);
        if (import.meta.env.DEV) {
          console.log('[PvPManager] ✅ Connected! ID:', this.socket?.id);
        }
        this.isConnected = true;
        this.setupListeners();
        EventBus.emit(GameEvents.PVP_CONNECTED, {});
        resolve(true);
      });
      
      this.socket.on('connect_error', (error) => {
        globalCleanup.clearTimeout(timeout);
        if (import.meta.env.DEV) {
          console.error('[PvPManager] Connection error:', error.message);
        }
        this.isConnected = false;
        EventBus.emit(GameEvents.PVP_ERROR, {
          type: 'connection_error',
          message: error.message,
        });
        resolve(false);
      });
      
      this.socket.on('disconnect', (reason) => {
        if (import.meta.env.DEV) {
          console.log('[PvPManager] Disconnected:', reason);
        }
        this.isConnected = false;
        EventBus.emit(GameEvents.PVP_DISCONNECTED, { reason });
      });
    });
  }
  
  /**
   * Отключиться от сервера
   */
  public disconnect(): void {
    if (!this.socket) return;
    
    try {
      // Удаляем ВСЕ listeners перед отключением
      this.socket.removeAllListeners();
      
      // Отключаемся
      this.socket.disconnect();
      
      if (import.meta.env.DEV) {
        console.log('[PvPManager] Disconnected and cleaned up all listeners');
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[PvPManager] Error during disconnect:', error);
      }
    } finally {
      this.socket = null;
      this.isConnected = false;
      this.currentRoomId = null;
      this.myTeam = 0;
    }
  }
  
  /**
   * Безопасное переподключение
   */
  public async reconnect(): Promise<boolean> {
    // Сначала полностью очищаем предыдущее соединение
    this.disconnect();
    
    // Небольшая задержка перед переподключением
    await new Promise<void>(resolve => globalCleanup.setTimeout(() => resolve(), 500));
    
    // Пробуем подключиться заново
    return this.connect();
  }
  
  /**
   * Настроить обработчики событий Socket.IO
   */
  private setupListeners(): void {
    if (!this.socket) return;
    
    // Matchmaking. Support both the current client event and the legacy server event.
    const handleMatchFound = (data: any) => {
      if (import.meta.env.DEV) {
        console.log('[PvPManager] 🎮 Match found!', data);
      }
      this.currentRoomId = data.roomId;
      this.myTeam = data.yourTeam;
      
      EventBus.emit(GameEvents.PVP_MATCH_FOUND, {
        roomId: data.roomId,
        opponentId: data.opponentId,
        opponentName: data.opponentName,
        yourTeam: data.yourTeam,
        isBotOpponent: data.isBotOpponent === true,
        opponentFactionId: data.opponentFactionId,
      });
    };

    this.socket.on('match_found', handleMatchFound);
    this.socket.on('matchmaking:found', handleMatchFound);
    
    this.socket.on('match_start', (data: any) => {
      if (import.meta.env.DEV) {
        console.log('[PvPManager] Match starting...', data);
      }
      EventBus.emit(GameEvents.PVP_MATCH_START, {
        initialState: data.initialState,
        yourTeam: data.yourTeam,
        timeLimit: data.timeLimit,
        currentTeam: data.currentTeam,
      });
    });
    
    this.socket.on('match_end', (data: any) => {
      if (import.meta.env.DEV) {
        console.log('[PvPManager] Match ended:', data);
      }
      EventBus.emit(GameEvents.PVP_MATCH_END, {
        winner: data.winner,
        scores: data.scores,
        reason: data.reason,
      });
    });
    
    // Game state
    this.socket.on('state_update', (data: any) => {
      EventBus.emit(GameEvents.PVP_STATE_UPDATE, {
        state: data.state,
        frame: data.frame,
        timestamp: data.timestamp,
      });
    });
    
    this.socket.on('turn_change', (data: any) => {
      EventBus.emit(GameEvents.PVP_TURN_CHANGE, {
        currentTeam: data.currentTeam,
        turnNumber: data.turnNumber,
      });
    });
    
    this.socket.on('goal_scored', (data: any) => {
      EventBus.emit(GameEvents.PVP_GOAL, {
        scoringTeam: data.scoringTeam,
        scores: data.scores,
      });
    });
    
    this.socket.on('game_paused', () => {
      EventBus.emit(GameEvents.PVP_GAME_PAUSED, {});
    });
    
    // Opponent
    this.socket.on('opponent_disconnected', (data: any) => {
      EventBus.emit(GameEvents.PVP_OPPONENT_DISCONNECTED, {
        reconnectTimeout: data.reconnectTimeout,
      });
    });
    
    this.socket.on('opponent_reconnected', () => {
      EventBus.emit(GameEvents.PVP_OPPONENT_RECONNECTED, {});
    });
    
    // Errors
    this.socket.on('error', (data: any) => {
      if (import.meta.env.DEV) {
        console.error('[PvPManager] Server error:', data);
      }
      EventBus.emit(GameEvents.PVP_ERROR, {
        type: data.type || 'server_error',
        message: data.message || 'Unknown error',
      });
    });
  }
  
  /**
   * Поиск матча
   */
  public findGame(mode: string = 'ranked', profile: PvPMatchmakingProfile = {}): void {
    if (!this.socket || !this.isConnected) {
      if (import.meta.env.DEV) {
        console.error('[PvPManager] Not connected to server');
      }
      return;
    }
    
    if (import.meta.env.DEV) {
      console.log('[PvPManager] Searching for game...');
    }
    this.socket.emit('matchmaking:join', {
      mode,
      playerId: this.socket.id,
      playerData: profile,
      playerName: profile.playerName,
      mmr: profile.mmr,
      factionId: profile.factionId,
      teamUnitIds: profile.teamUnitIds,
      teamSize: profile.teamSize,
      timestamp: Date.now(),
    });
  }
  
  /**
   * Отменить поиск матча
   */
  public cancelSearch(): void {
    if (!this.socket || !this.isConnected) return;
    
    if (import.meta.env.DEV) {
      console.log('[PvPManager] Cancelling search...');
    }
    this.socket.emit('matchmaking:cancel');
  }
  
  /**
   * Отправить готовность к матчу
   */
  public sendReady(): void {
    if (!this.socket || !this.currentRoomId) return;
    
    if (import.meta.env.DEV) {
      console.log('[PvPManager] Sending ready...');
    }
    this.socket.emit('match:ready', {
      roomId: this.currentRoomId,
    });
  }
  
  /**
   * Отправить удар
   */
  public sendShot(unitId: string, velocity: { x: number; y: number }): void {
    if (!this.socket || !this.currentRoomId) return;
    
    this.socket.emit('game:shoot', {
      roomId: this.currentRoomId,
      unitId,
      velocity,
      timestamp: Date.now(),
    });
  }
  
  /**
   * Использовать карту
   */
  public sendUseCard(cardId: string, targetData?: any): void {
    if (!this.socket || !this.currentRoomId) return;
    
    this.socket.emit('game:use_card', {
      roomId: this.currentRoomId,
      cardId,
      targetData,
      timestamp: Date.now(),
    });
  }
  
  /**
   * Поставить игру на паузу
   */
  public sendPause(): void {
    if (!this.socket || !this.currentRoomId) return;
    
    this.socket.emit('game:pause', {
      roomId: this.currentRoomId,
    });
  }
  
  /**
   * Сдаться
   */
  public sendSurrender(): void {
    if (!this.socket || !this.currentRoomId) return;
    
    this.socket.emit('game:surrender', {
      roomId: this.currentRoomId,
    });
  }
  
  /**
   * Подписаться на событие
   */
  public on(event: string, callback: (...args: any[]) => void): void {
    this.socket?.on(event, callback);
  }
  
  /**
   * Отписаться от события
   */
  public off(event: string, callback?: (...args: any[]) => void): void {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.off(event);
    }
  }
  
  /**
   * Получить статус подключения
   */
  public getIsConnected(): boolean {
    return this.isConnected && !!this.socket?.connected;
  }
  
  /**
   * Получить текущую комнату
   */
  public getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }
  
  /**
   * Получить мою команду
   */
  public getMyTeam(): number {
    return this.myTeam;
  }
}
