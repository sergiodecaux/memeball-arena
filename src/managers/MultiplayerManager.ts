// src/managers/MultiplayerManager.ts

import { io, Socket } from 'socket.io-client';
import { PlayerNumber } from '../types';
import { playerData } from '../data/PlayerData';

// Server config
const SERVER_URL = 'https://memeball.duckdns.org';

// Types
export interface PvPPlayer {
  id: string;
  name: string;
  level: number;
  team: 'bottom' | 'top';
}

export interface GameStartData {
  roomId: string;
  players: PvPPlayer[];
  currentTurn: string;
  scores: Record<string, number>;
  config: {
    GOALS_TO_WIN: number;
    TURN_TIME: number;
  };
  hostId: string;
}

export interface ShootData {
  capId: number;
  force: { x: number; y: number };
  position: { x: number; y: number };
  angle: number;
}

export interface GoalData {
  scorerId: string;
  scores: Record<string, number>;
  winner: string | null;
}

export interface MatchResult {
  winner: string;
  scores: Record<string, number>;
  rewards: {
    winner: { coins: number; xp: number };
    loser: { coins: number; xp: number };
  };
}

type EventCallback = (...args: any[]) => void;

export class MultiplayerManager {
  private static instance: MultiplayerManager;
  private socket: Socket | null = null;
  private roomId: string | null = null;
  private myId: string | null = null;
  private opponent: PvPPlayer | null = null;
  private isConnected = false;
  private hostId: string | null = null;
  
  // Event callbacks
  private callbacks: Map<string, EventCallback[]> = new Map();

  private constructor() {}

  static getInstance(): MultiplayerManager {
    if (!MultiplayerManager.instance) {
      MultiplayerManager.instance = new MultiplayerManager();
    }
    return MultiplayerManager.instance;
  }

  // ==================== CONNECTION ====================

  connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.socket?.connected) {
        resolve(true);
        return;
      }

      console.log('[MP] Connecting to server:', SERVER_URL);

      this.socket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      this.socket.on('connect', () => {
        console.log('[MP] Connected! ID:', this.socket?.id);
        this.myId = this.socket?.id || null;
        this.isConnected = true;
        this.setupListeners();
        resolve(true);
      });

      this.socket.on('connect_error', (error) => {
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
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.roomId = null;
    this.myId = null;
    this.opponent = null;
    this.hostId = null;
    this.isConnected = false;
  }

  getConnectionStatus(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  // ==================== MATCHMAKING ====================

  findGame(): void {
    if (!this.socket) return;

    const data = playerData.get();
    
    this.socket.emit('find_game', {
      name: data.username || 'Player',
      skin: data.equippedCapSkin,
      level: data.level
    });

    console.log('[MP] Searching for game...');
  }

  cancelSearch(): void {
    if (!this.socket) return;
    this.socket.emit('cancel_search');
    console.log('[MP] Search cancelled');
  }

  // ==================== GAME ACTIONS ====================

  sendShoot(capId: number, force: { x: number; y: number }, position: { x: number; y: number }, angle: number): void {
    if (!this.socket || !this.roomId) return;

    console.log('[MP] Sending shoot:', capId, force);

    this.socket.emit('shoot', {
      roomId: this.roomId,
      capId,
      force,
      position,
      angle
    });
  }

  sendObjectsStopped(): void {
    if (!this.socket || !this.roomId) return;
    console.log('[MP] Objects stopped, requesting turn change');
    this.socket.emit('objects_stopped', { roomId: this.roomId });
  }

  sendTurnEnd(): void {
    if (!this.socket || !this.roomId) return;
    console.log('[MP] Turn end');
    this.socket.emit('turn_end', { roomId: this.roomId });
  }

  sendGoal(scorerId: string): void {
    if (!this.socket || !this.roomId) return;
    console.log('[MP] Goal by:', scorerId);
    this.socket.emit('goal', {
      roomId: this.roomId,
      scorerId
    });
  }

  sendReadyAfterGoal(scorerId: string): void {
    if (!this.socket || !this.roomId) return;
    this.socket.emit('ready_after_goal', {
      roomId: this.roomId,
      scorerId
    });
  }

  sendSurrender(): void {
    if (!this.socket || !this.roomId) return;
    this.socket.emit('surrender', { roomId: this.roomId });
  }

  sendSyncPositions(ball: { x: number; y: number; vx?: number; vy?: number }, caps: { x: number; y: number; vx?: number; vy?: number }[]): void {
    if (!this.socket || !this.roomId) return;
    // Только хост отправляет позиции
    if (this.myId !== this.hostId) return;
    
    this.socket.emit('sync_positions', {
      roomId: this.roomId,
      ball,
      caps
    });
  }

  // ==================== GETTERS ====================

  getMyId(): string | null {
    return this.myId;
  }

  getRoomId(): string | null {
    return this.roomId;
  }

  getOpponent(): PvPPlayer | null {
    return this.opponent;
  }

  getHostId(): string | null {
    return this.hostId;
  }

  isHost(): boolean {
    return this.myId === this.hostId;
  }

  isMyTurn(currentTurnId: string): boolean {
    return currentTurnId === this.myId;
  }

  getMyPlayerNumber(players: PvPPlayer[]): PlayerNumber {
    const myIndex = players.findIndex(p => p.id === this.myId);
    return myIndex === 0 ? 1 : 2;
  }

  // ==================== EVENT SYSTEM ====================

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
    const arr = this.callbacks.get(event);
    if (arr) {
      arr.forEach(cb => cb(...args));
    }
  }

  // ==================== SOCKET LISTENERS ====================

  private setupListeners(): void {
    if (!this.socket) return;

    // Waiting in queue
    this.socket.on('waiting', (data) => {
      console.log('[MP] Waiting...', data);
      this.emit('waiting', data);
    });

    // Search cancelled
    this.socket.on('search_cancelled', () => {
      console.log('[MP] Search cancelled');
      this.emit('search_cancelled');
    });

    // Game found!
    this.socket.on('game_start', (data: GameStartData) => {
      console.log('[MP] Game starting!', data);
      this.roomId = data.roomId;
      this.hostId = data.hostId;
      
      // Find opponent
      this.opponent = data.players.find(p => p.id !== this.myId) || null;
      
      this.emit('game_start', data);
    });

    // Opponent shot
    this.socket.on('opponent_shoot', (data: ShootData) => {
      console.log('[MP] Opponent shoot:', data);
      this.emit('opponent_shoot', data);
    });

    // Turn changed
    this.socket.on('turn_change', (data) => {
      console.log('[MP] Turn change:', data);
      this.emit('turn_change', data);
    });

    // Positions sync
    this.socket.on('positions_update', (data) => {
      this.emit('positions_update', data);
    });

    // Goal scored
    this.socket.on('goal_scored', (data: GoalData) => {
      console.log('[MP] Goal!', data);
      this.emit('goal_scored', data);
    });

    // Continue after goal
    this.socket.on('continue_game', (data) => {
      console.log('[MP] Continue game:', data);
      this.emit('continue_game', data);
    });

    // Match finished
    this.socket.on('match_finished', (data: MatchResult) => {
      console.log('[MP] Match finished!', data);
      this.emit('match_finished', data);
    });

    // Opponent surrendered
    this.socket.on('opponent_surrendered', (data) => {
      console.log('[MP] Opponent surrendered!', data);
      this.emit('opponent_surrendered', data);
    });

    // Opponent disconnected
    this.socket.on('opponent_disconnected', (data) => {
      console.log('[MP] Opponent disconnected!', data);
      this.emit('opponent_disconnected', data);
    });

    // Pong
    this.socket.on('pong_server', (data) => {
      this.emit('pong', data);
    });
  }

  // ==================== CLEANUP ====================

  clearRoom(): void {
    this.roomId = null;
    this.opponent = null;
    this.hostId = null;
  }
}