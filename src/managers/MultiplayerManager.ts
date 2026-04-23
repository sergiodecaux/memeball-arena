// src/managers/MultiplayerManager.ts

import { io, Socket } from 'socket.io-client';
import { playerData, CapUpgrades, DEFAULT_FORMATIONS } from '../data/PlayerData';
import { logInfo, logWarn, logError } from '../utils/ProductionLogger';
import { globalCleanup } from '../utils/GlobalCleanup';

// PvP Server configuration
const PROD_BASE_URL = 'https://game.galaxyleague.ru';
const PROD_PATH = '/pvp/socket.io/';

const DEV_BASE_URL = 'http://217.26.31.130:3000';
const DEV_PATH = '/socket.io/';

// Выбираем конфигурацию в зависимости от режима
const SERVER_URL = import.meta.env.MODE === 'development' ? DEV_BASE_URL : PROD_BASE_URL;
const SOCKET_PATH = import.meta.env.MODE === 'development' ? DEV_PATH : PROD_PATH;

// ==================== TYPES ====================

export interface PvPPlayer {
  id: string;
  name: string;
  level: number;
  capSkin: string;
  ballSkin: string;
  fieldSkin: string;
  formation: any;
  playerIndex: number;
  factionId?: string;
  teamUnitIds?: string[];
  teamSize?: number;

  // Аватар
  avatarId?: string;
  
  // Команда фишек
  teamCapIds?: string[];
  
  // Прокачка каждой фишки
  capUpgrades?: Record<string, CapUpgrades>;
}

export interface GameStartData {
  roomId: string;
  players: PvPPlayer[];
  hostId: string;
  fieldOwnerId: string;
  fieldSkin: string;
  ballSkin: string;
  currentTurn: string;
  scores: Record<string, number>;
  serverTime?: number;
  config: {
    MATCH_DURATION: number;
    TURN_TIME: number;
    TICK_RATE?: number;
  };
}

export interface ShootData {
  shooterId: string;
  playerIndex: number;
  capId: string | number;
  force: { x: number; y: number };
  position: { x: number; y: number };
  hitOffset?: number;
  tick?: number;
  serverTime?: number;
}

export interface PositionsData {
  ball: { x: number; y: number; vx: number; vy: number };
  caps: { x: number; y: number; vx: number; vy: number }[];
  timestamp: number;
  tick?: number;
  serverTime?: number;
  isMoving?: boolean;
}

export interface MatchTimerData {
  remainingTime: number;
  totalTime: number;
  tick?: number;
  serverTime?: number;
}

export interface MatchFinishedData {
  winner: string | null;
  isDraw: boolean;
  scores: Record<string, number>;
  reason: string;
  rewards: Record<string, { coins: number; xp: number }>;
}

export interface FinalPositions {
  ball: { x: number; y: number };
  caps: { x: number; y: number }[];
}

type EventCallback = (...args: any[]) => void;

// ==================== MULTIPLAYER MANAGER ====================

export class MultiplayerManager {
  private static instance: MultiplayerManager;
  
  private socket: Socket | null = null;
  private roomId: string | null = null;
  private myId: string | null = null;
  private hostId: string | null = null;
  private gameData: GameStartData | null = null;
  private isConnected = false;
  
  private callbacks: Map<string, EventCallback[]> = new Map();

  private constructor() {}

  static getInstance(): MultiplayerManager {
    if (!MultiplayerManager.instance) {
      MultiplayerManager.instance = new MultiplayerManager();
    }
    return MultiplayerManager.instance;
  }

  // ==================== CONNECTION ====================

  async connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.socket?.connected) {
        logInfo('PVP', 'Already connected', { socketId: this.socket.id });
        resolve(true);
        return;
      }

      console.log('[MP] Connecting to:', SERVER_URL);
      logInfo('PVP', 'Connecting to server', { serverUrl: SERVER_URL });

      this.socket = io(SERVER_URL, {
        path: SOCKET_PATH,
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      const timeout = globalCleanup.setTimeout(() => {
        if (!this.isConnected) {
          console.error('[MP] Connection timeout');
          logError('PVP', 'Connection timeout', { serverUrl: SERVER_URL, timeout: 10000 });
          resolve(false);
        }
      }, 10000);

      this.socket.on('connect', () => {
        globalCleanup.clearTimeout(timeout);
        const wasConnected = this.isConnected;
        console.log('[MP] Connected! ID:', this.socket?.id);
        logInfo('PVP', 'Connected successfully', { socketId: this.socket?.id });
        this.myId = this.socket?.id || null;
        this.isConnected = true;
        this.setupListeners();
        
        // 2.3: Эмитим событие переподключения если было отключение
        if (!wasConnected && this.roomId) {
          this.emit('reconnected');
        }
        
        resolve(true);
      });

      this.socket.on('connect_error', (error) => {
        globalCleanup.clearTimeout(timeout);
        console.error('[MP] Connection error:', error.message);
        this.isConnected = false;
        resolve(false);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[MP] Disconnected:', reason);
        this.isConnected = false;
        this.emit('disconnected', reason);
      });
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.clearRoom();
    this.isConnected = false;
  }

  getConnectionStatus(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  // ==================== MATCHMAKING ====================

  /**
   * ✅ ИСПРАВЛЕННЫЙ МЕТОД: Корректно собирает команду и формацию
   */
  findGame(): void {
    if (!this.socket) {
      logError('PVP', 'Cannot find game - socket not connected');
      // Попытка авто-подключения
      this.connect().then(success => {
        if (success) this.findGame();
      });
      return;
    }

    logInfo('PVP', 'Starting matchmaking', { socketId: this.myId });

    // 1. Получаем основные данные игрока
    const data = playerData.get();
    const name = playerData.getNickname ? playerData.getNickname() : (data.username || 'Player');
    const avatarId = playerData.getAvatarId ? playerData.getAvatarId() : undefined;
    
    // 2. Фракция и команда
    const factionId = playerData.getFaction();
    
    // ✅ ИСПРАВЛЕНО: Получаем реальные ID юнитов из выбранной фракции
    let teamCapIds: string[] = [];
    if (factionId) {
      // Берем юнитов из PlayerData для текущей фракции
      // getTeamUnits уже возвращает массив строк (ID юнитов)
      teamCapIds = playerData.getTeamUnits(factionId);
    }

    // Если список пуст (что-то пошло не так), используем безопасный дефолт,
    // но только как крайнюю меру
    if (!teamCapIds || teamCapIds.length === 0) {
      console.warn('[MP] ⚠️ No units found for faction, using fallback Meme Team');
      teamCapIds = ['meme_doge', 'meme_gigachad', 'meme_doge'];
    }

    // 3. Формация (КРИТИЧНО для расстановки)
    let formation = playerData.getSelectedFormation();
    
    // 🔥 ЗАЩИТА: Убеждаемся, что формация существует и соответствует размеру команды
    if (!formation || formation.teamSize !== teamCapIds.length) {
      console.warn('[MP] ⚠️ Formation mismatch or missing!', {
        hasFormation: !!formation,
        formationSize: formation?.teamSize,
        teamSize: teamCapIds.length
      });
      
      // Ищем дефолтную формацию для размера команды
      const defaultFormation = DEFAULT_FORMATIONS.find(f => f.teamSize === teamCapIds.length);
      if (defaultFormation) {
        formation = defaultFormation;
        console.log('[MP] ✅ Using default formation for team size:', teamCapIds.length);
      } else {
        // Если все еще нет формации, используем последнюю попытку - создаем простую формацию
        console.warn('[MP] ⚠️ Creating fallback formation');
        formation = {
          id: 'fallback_formation',
          name: 'Fallback',
          teamSize: teamCapIds.length,
          slots: teamCapIds.map((_, i) => ({
            id: `slot_${i}`,
            x: 0.3 + (i * 0.2),
            y: 0.7 + (i * 0.1)
          })),
          isCustom: false
        };
      }
    }

    // 4. Собираем прокачку для каждой фишки
    const capUpgrades: Record<string, CapUpgrades> = {};
    const uniqueCapIds = [...new Set(teamCapIds)];
    for (const capId of uniqueCapIds) {
      capUpgrades[capId] = playerData.getCapStats(capId);
    }

    // 5. Формируем финальный пакет
    const payload = {
      playerId: data.id || this.socket.id, // Идентификатор для сервера
      name,
      level: data.level || 1,
      
      // Визуал
      capSkin: teamCapIds[0], // Для превью (берем первую фишку)
      ballSkin: data.equippedBallSkin || 'ball_default',
      fieldSkin: data.equippedFieldSkin || 'field_default',
      avatarId,
      
      // ✅ ГЛАВНЫЕ ДАННЫЕ ДЛЯ СИНХРОНИЗАЦИИ
      formation: formation,   // Координаты расстановки (ВСЕГДА валидная)
      teamCapIds: teamCapIds, // Массив ID фишек
      capUpgrades: capUpgrades, // Данные прокачки
      factionId: factionId,   // Фракция
      
      teamSize: teamCapIds.length
    };

    console.log('[MP] 🔍 Finding game with payload:', payload);
    
    this.socket.emit('find_game', payload);
  }

  cancelSearch(): void {
    this.socket?.emit('cancel_search');
  }

  // ==================== FORMATION ====================

  changeFormation(formation: string | null): void {
    if (!this.socket || !this.roomId) {
      console.warn('[MP] Cannot change formation - not in room');
      return;
    }

    console.log('[MP] Changing formation:', formation);
    this.socket.emit('change_formation', {
      roomId: this.roomId,
      formation
    });
  }

  // ==================== ABILITIES ====================

  sendCardActivated(cardId: string, targetPosition?: { x: number; y: number }, unitIds?: string[]): void {
    if (!this.socket || !this.roomId) {
      console.warn('[MP] Cannot send card activation - not in room');
      return;
    }

    console.log('[MP] Sending card activation:', cardId);
    this.socket.emit('card_activated', {
      roomId: this.roomId,
      cardId,
      targetPosition,
      unitIds
    });
  }

  // ==================== SUBSTITUTIONS ====================

  sendSubstitution(oldCapId: string, newCapId: string): void {
    if (!this.socket || !this.roomId) {
      console.warn('[MP] Cannot send substitution - not in room');
      return;
    }

    console.log('[MP] Sending substitution:', oldCapId, '->', newCapId);
    this.socket.emit('request_substitution', {
      roomId: this.roomId,
      oldCapId,
      newCapId
    });
  }

  // ==================== GAME ACTIONS ====================

  sendShoot(
    capId: string | number, 
    force: { x: number; y: number }, 
    position: { x: number; y: number },
    hitOffset?: number
  ): void {
    if (!this.socket || !this.roomId) return;

    const shootData: any = {
      roomId: this.roomId,
      capId,
      force,
      position
    };

    if (hitOffset !== undefined && Math.abs(hitOffset) > 0.1) {
      shootData.hitOffset = hitOffset;
    }

    console.log('[MP] Sending shoot - capId:', capId, 'force:', force);

    this.socket.emit('shoot', shootData);
  }

  sendObjectsStopped(): void {
    if (!this.socket || !this.roomId || !this.isHost()) return;
    this.socket.emit('objects_stopped', { roomId: this.roomId });
  }

  sendGoal(scorerId: string, finalPositions?: FinalPositions): void {
    if (!this.socket || !this.roomId || !this.isHost()) return;
    
    console.log('[MP] Sending goal, scorer:', scorerId);
    
    this.socket.emit('goal', { 
      roomId: this.roomId, 
      scorerId,
      finalPositions
    });
  }

  sendReadyAfterGoal(scorerId: string): void {
    if (!this.socket || !this.roomId || !this.isHost()) return;
    this.socket.emit('ready_after_goal', { roomId: this.roomId, scorerId });
  }

  sendSurrender(): void {
    if (!this.socket || !this.roomId) return;
    this.socket.emit('surrender', { roomId: this.roomId });
  }

  sendSyncPositions(
    ball: { x: number; y: number; vx: number; vy: number },
    caps: { x: number; y: number; vx: number; vy: number }[],
    isMoving: boolean = false
  ): void {
    if (!this.socket || !this.roomId || !this.isHost()) return;
    this.socket.emit('sync_positions', { 
      roomId: this.roomId, 
      ball, 
      caps,
      isMoving
    });
  }

  // ==================== TIME SYNC ====================

  sendPingSync(clientTime: number): void {
    this.socket?.emit('ping_sync', clientTime);
  }

  requestReconciliation(fromTick: number): void {
    if (!this.socket || !this.roomId) return;
    this.socket.emit('request_reconciliation', {
      roomId: this.roomId,
      fromTick
    });
  }

  // ==================== GETTERS ====================

  getMyId(): string | null { 
    return this.myId; 
  }
  
  getRoomId(): string | null { 
    return this.roomId; 
  }
  
  getGameData(): GameStartData | null { 
    return this.gameData; 
  }
  
  getHostId(): string | null { 
    return this.hostId; 
  }
  
  isHost(): boolean {
    return this.myId !== null && this.myId === this.hostId;
  }

  getMyPlayerIndex(): number {
    if (!this.gameData || !this.myId) return 0;
    const me = this.gameData.players.find(p => p.id === this.myId);
    return me?.playerIndex ?? 0;
  }

  getMyCapStartIndex(): number {
    return this.getMyPlayerIndex() * 3;
  }

  getMe(): PvPPlayer | null {
    if (!this.gameData || !this.myId) return null;
    return this.gameData.players.find(p => p.id === this.myId) || null;
  }

  getOpponent(): PvPPlayer | null {
    if (!this.gameData || !this.myId) return null;
    return this.gameData.players.find(p => p.id !== this.myId) || null;
  }

  getOpponentCapUpgrades(capId: string): CapUpgrades | null {
    const opponent = this.getOpponent();
    if (!opponent?.capUpgrades) return null;
    return opponent.capUpgrades[capId] || null;
  }

  amIFieldOwner(): boolean {
    return this.gameData?.fieldOwnerId === this.myId;
  }

  // ==================== EVENTS ====================

  on(event: string, callback: EventCallback): void {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event)!.push(callback);
  }

  off(event: string, callback?: EventCallback): void {
    if (!callback) {
      this.callbacks.delete(event);
    } else {
      const arr = this.callbacks.get(event);
      if (arr) {
        const idx = arr.indexOf(callback);
        if (idx > -1) arr.splice(idx, 1);
      }
    }
  }

  private emit(event: string, ...args: any[]): void {
    this.callbacks.get(event)?.forEach(cb => {
      try { 
        cb(...args); 
      } catch (e) { 
        console.error('[MP] Callback error:', e); 
      }
    });
  }

  private setupListeners(): void {
    if (!this.socket) return;

    this.socket.on('waiting', (data) => {
      console.log('[MP] Waiting in queue...');
      this.emit('waiting', data);
    });

    this.socket.on('search_cancelled', () => {
      this.emit('search_cancelled');
    });

    this.socket.on('game_start', (data: GameStartData) => {
      console.log('[MP] Game starting!');
      this.roomId = data.roomId;
      this.hostId = data.hostId;
      this.gameData = data;
      this.emit('game_start', data);
    });

    this.socket.on('shoot_executed', (data: ShootData) => {
      console.log('[MP] Shoot executed');
      this.emit('shoot_executed', data);
    });

    this.socket.on('turn_change', (data) => {
      console.log('[MP] Turn change');
      this.emit('turn_change', data);
    });

    this.socket.on('positions_update', (data: PositionsData) => {
      this.emit('positions_update', data);
    });

    this.socket.on('snapshot', (data) => {
      this.emit('snapshot', data);
    });

    this.socket.on('match_timer', (data: MatchTimerData) => {
      this.emit('match_timer', data);
    });

    this.socket.on('goal_scored', (data) => {
      console.log('[MP] Goal!');
      this.emit('goal_scored', data);
    });

    this.socket.on('continue_game', (data) => {
      console.log('[MP] Continue game');
      this.emit('continue_game', data);
    });

    this.socket.on('match_finished', (data: MatchFinishedData) => {
      console.log('[MP] Match finished!');
      this.emit('match_finished', data);
    });

    this.socket.on('opponent_surrendered', (data) => {
      console.log('[MP] Opponent surrendered!');
      this.emit('opponent_surrendered', data);
    });

    this.socket.on('opponent_disconnected', (data) => {
      console.log('[MP] Opponent disconnected!');
      this.emit('opponent_disconnected', data);
    });

    this.socket.on('pong_sync', (data) => {
      this.emit('pong_sync', data);
    });

    this.socket.on('reconciliation_data', (data) => {
      this.emit('reconciliation_data', data);
    });

    this.socket.on('opponent_formation_changed', (data) => {
      console.log('[MP] Opponent changed formation:', data.formation);
      this.emit('opponent_formation_changed', data);
    });

    this.socket.on('ability_executed', (data) => {
      console.log('[MP] Ability executed');
      this.emit('ability_executed', data);
    });

    this.socket.on('substitution_executed', (data) => {
      console.log('[MP] Substitution executed');
      this.emit('substitution_executed', data);
    });

    this.socket.on('action_rejected', (data: { reason: string; action: string }) => {
      console.warn('[MP] Action rejected by server:', data);
      this.emit('action_rejected', data);
    });
  }

  clearRoom(): void {
    this.roomId = null;
    this.hostId = null;
    this.gameData = null;
  }
}