// src/scenes/game/types.ts

import { PlayerNumber, AIDifficulty, FieldBounds } from '../../types';
import { FactionId, CapClassStats, CapClass, FactionArena } from '../../constants/gameConstants';
import { GameStartData, PvPPlayer } from '../../managers/MultiplayerManager';
import { Formation } from '../../data/PlayerData';

export interface GameSceneData {
  vsAI?: boolean;
  difficulty?: AIDifficulty;
  isPvP?: boolean;
  pvpData?: GameStartData;
  useFactions?: boolean;
  playerFaction?: FactionId;
  opponentFaction?: FactionId;
  useArena?: boolean;
  matchDuration?: number;
}

export interface Snapshot {
  tick: number;
  serverTime: number;
  ball: { x: number; y: number; vx: number; vy: number };
  caps: { x: number; y: number; vx: number; vy: number }[];
  isMoving?: boolean;
}

export interface StartPositions {
  ball: { x: number; y: number };
  caps: { x: number; y: number }[];
}

export interface IGameUnit {
  body: MatterJS.BodyType;
  sprite: Phaser.GameObjects.Container;
  readonly owner: PlayerNumber;
  readonly id: string;
  readonly x: number;
  readonly y: number;
  stats: CapClassStats;

  update(): void;
  syncSpriteWithBody(): void;
  reset(x: number, y: number): void;
  highlight(enabled: boolean): void;
  destroy(): void;
  getSpeed(): number;
  isStopped(threshold?: number): boolean;
  getRadius(): number;
  getCapClass(): CapClass;
  getAimLineLength(): number;
  applyForce(forceX: number, forceY: number): void;
  calculateShotForce(dragDistance: number, direction: Phaser.Math.Vector2): Phaser.Math.Vector2;
  setSelected(selected: boolean): void;
  setActiveTeamTurn(active: boolean): void;
  setLastHitOffset(offset: number): void;
  getLastHitOffset(): number;
  hasRecentShot(withinMs?: number): boolean;
  calculateCurveForce(ballVelocity: { x: number; y: number }): { x: number; y: number } | null;
}

export type GameUnit = IGameUnit;

export function hasPlayHitEffect(unit: any): unit is { playHitEffect: () => void } {
  return typeof unit.playHitEffect === 'function';
}

export interface GameSceneState {
  // Mode flags
  isPvPMode: boolean;
  isAIEnabled: boolean;
  aiDifficulty: AIDifficulty;
  useFactions: boolean;
  
  // Faction data
  playerFaction: FactionId;
  opponentFaction: FactionId;
  currentArena?: FactionArena;
  
  // PvP data
  pvpData?: GameStartData;
  isHost: boolean;
  myPlayerIndex: number;
  currentTurnId: string;
  myPlayer?: PvPPlayer;
  opponentPlayer?: PvPPlayer;
  
  // Game state
  isProcessingTurn: boolean;
  isGoalCelebrating: boolean;
  lastShootTime: number;
  lastCollisionTime: number;
  ballSpeedBeforeCollision: number;
  selectedCapId?: string;
  lastShootingCapId?: string;
  
  // Timer
  matchDuration: number;
  matchRemainingTime: number;
  
  // Sync (PvP)
  snapshotBuffer: Snapshot[];
  serverTimeOffset: number;
  timeSyncSamples: number[];
  guestLocalPhysicsUntil: number;
  syncGracePeriodUntil: number;
  lastServerSnapshot?: Snapshot;
  
  // Field
  fieldScale: number;
  fieldSkinId: string;
}

export function createInitialState(): GameSceneState {
  return {
    isPvPMode: false,
    isAIEnabled: true,
    aiDifficulty: 'medium',
    useFactions: false,
    playerFaction: 'cyborg',
    opponentFaction: 'cyborg',
    currentArena: undefined,
    pvpData: undefined,
    isHost: false,
    myPlayerIndex: 0,
    currentTurnId: '',
    myPlayer: undefined,
    opponentPlayer: undefined,
    isProcessingTurn: false,
    isGoalCelebrating: false,
    lastShootTime: 0,
    lastCollisionTime: 0,
    ballSpeedBeforeCollision: 0,
    selectedCapId: undefined,
    lastShootingCapId: undefined,
    matchDuration: 300,
    matchRemainingTime: 300,
    snapshotBuffer: [],
    serverTimeOffset: 0,
    timeSyncSamples: [],
    guestLocalPhysicsUntil: 0,
    syncGracePeriodUntil: 0,
    lastServerSnapshot: undefined,
    fieldScale: 1,
    fieldSkinId: 'field_default',
  };
}