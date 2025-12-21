// src/managers/MultiplayerManager.ts

import { io, Socket } from 'socket.io-client';
import { playerData } from '../data/PlayerData';

const SERVER_URL = 'https://memeball.duckdns.org';

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
  odotterId: string;
  playerIndex: number;
  capId: number;
  force: { x: number; y: number };
  position: { x: number; y: number };
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
        resolve(true);
        return;
      }

      console.log('[MP] Connecting to:', SERVER_URL);

      this.socket = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      const timeout = setTimeout(() => {
        if (!this.isConnected) {
          console.error('[MP] Connection timeout');
          resolve(false);
        }
      }, 10000);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        console.log('[MP] Connected! ID:', this.socket?.id);
        this.myId = this.socket?.id || null;
        this.isConnected = true;
        this.setupListeners();
        resolve(true);
      });

      this.socket.on('connect_error', (error) => {
        clearTimeout(timeout);
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

  findGame(): void {
    if (!this.socket) return;

    const data = playerData.get();
    const formation = playerData.getSelectedFormation();
    
    const payload = {
      name: data.username || 'Player',
      level: data.level || 1,
      capSkin: data.equippedCapSkin || 'cap_default_cyan',
      ballSkin: data.equippedBallSkin || 'ball_default',
      fieldSkin: data.equippedFieldSkin || 'field_default',
      formation: formation
    };

    console.log('[MP] Finding game with:', payload);
    this.socket.emit('find_game', payload);
  }

  cancelSearch(): void {
    this.socket?.emit('cancel_search');
  }

  // ==================== GAME ACTIONS ====================

  sendShoot(capId: number, force: { x: number; y: number }, position: { x: number; y: number }): void {
    if (!this.socket || !this.roomId) return;

    console.log('[MP] Sending shoot - capId:', capId, 'force:', force);

    this.socket.emit('shoot', {
      roomId: this.roomId,
      capId,
      force,
      position
    });
  }

  sendObjectsStopped(): void {
    if (!this.socket || !this.roomId || !this.isHost()) return;
    this.socket.emit('objects_stopped', { roomId: this.roomId });
  }

  sendGoal(scorerId: string, finalPositions?: FinalPositions): void {
    if (!this.socket || !this.roomId || !this.isHost()) return;
    
    console.log('[MP] Sending goal with positions:', finalPositions ? 'yes' : 'no');
    
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

  // ==================== RECONCILIATION ====================

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
      console.log('[MP] Players:', data.players.map(p => `${p.name} (idx ${p.playerIndex})`));
      
      this.roomId = data.roomId;
      this.hostId = data.hostId;
      this.gameData = data;
      
      const myIdx = this.getMyPlayerIndex();
      console.log('[MP] I am player index:', myIdx, myIdx === 0 ? '(HOST)' : '(GUEST)');
      console.log('[MP] My caps:', myIdx * 3, myIdx * 3 + 1, myIdx * 3 + 2);
      
      this.emit('game_start', data);
    });

    this.socket.on('shoot_executed', (data: ShootData) => {
      console.log('[MP] Shoot executed - player:', data.playerIndex, 'cap:', data.capId);
      this.emit('shoot_executed', data);
    });

    this.socket.on('turn_change', (data) => {
      console.log('[MP] Turn change to:', data.currentTurn === this.myId ? 'ME' : 'OPPONENT');
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
  }

  clearRoom(): void {
    this.roomId = null;
    this.hostId = null;
    this.gameData = null;
  }
}