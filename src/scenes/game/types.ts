// src/scenes/game/types.ts

import { PlayerNumber, AIDifficulty, FieldBounds } from '../../types';
import { FactionId, CapClassStats, CapClass, FactionArena, FactionConfig, UnitStatus } from '../../constants/gameConstants';
import { GameStartData, PvPPlayer } from '../../managers/MultiplayerManager';
import { Formation } from '../../data/PlayerData';

export type MatchContext = 'casual' | 'league' | 'tournament' | 'campaign' | 'ranked';

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
  
  // ✅ League & Tournament context
  matchContext?: MatchContext;
  tournamentId?: string;
  seriesId?: string;
  round?: string;
  majorAbilityBonus?: boolean;  // +1 ход к способностям для Planet vs Star
  aimAssistDisabled?: boolean; // Отключение aim assist для Apex
  opponentName?: string; // ✅ Имя противника (для ботов в лиге/турнире)
  opponentAvatarId?: string; // ✅ Аватар противника (для консистентности)
  
  // 🎮 Team size (количество фишек в команде)
  teamSize?: number; // 3, 4, или 5 - зависит от лиги/турнира
  
  // 💰 Entry fee (вступительный взнос для лиг)
  entryFee?: number; // Победитель получает x2
  
  // ✅ AI флаг
  isAI?: boolean; // true если против бота (для лиги/турнира)
  aiDifficulty?: number; // Сложность AI (для лиги)
  
  // ✅ NEW PVP Mode
  mode?: 'pvp' | 'campaign' | 'casual';
  roomId?: string;
  yourTeam?: number;
  opponentId?: string;
  
  // ✅ Tutorial Mode
  isTutorialMode?: boolean;
  tutorialStep?: string;
  
  // ✅ NEW: Флаг пропуска интро (если пришли из MatchVSScene)
  skipIntro?: boolean;
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
  isDestroyed: boolean;
  readonly x: number;
  readonly y: number;
  stats: CapClassStats;
  readonly factionId: FactionId;
  readonly faction: FactionConfig;

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
  canCurve?(): boolean;
  getCurveStrength?(): number;
  
  playHitEffect?(): void;
  playSquashEffect?(intensity: number): void;
  playCollisionEffect?(otherFactionColor: number, impactForce: number): void;
  playImpactRing?(intensity: number): void;
  playFlashEffect?(): void;

  // === Ability System ===
  activateAbility?(): boolean;
  canPerformSwap?(): boolean;
  teleportTo?(x: number, y: number): void;
  hasToxinCharge?(): boolean;
  consumeToxinCharge?(): boolean;
  hasActiveShield?(): boolean;
  applyStun?(duration: number): void;
  isStunned?(): boolean;
  onTurnEnd?(): void;
  setAbilityCooldown?(turns: number): void;
  getAbilityCooldown?(): number;
  getStatus?(): UnitStatus;
  setInLava?(inLava: boolean): void;
}

export type GameUnit = IGameUnit;

export function hasPlayHitEffect(unit: any): unit is { playHitEffect: () => void } {
  return typeof unit.playHitEffect === 'function';
}

export function hasJuiceEffects(unit: any): unit is IGameUnit & {
  playHitEffect: () => void;
  playSquashEffect: (intensity: number) => void;
  playCollisionEffect: (otherFactionColor: number, impactForce: number) => void;
} {
  return (
    typeof unit.playHitEffect === 'function' &&
    typeof unit.playSquashEffect === 'function' &&
    typeof unit.playCollisionEffect === 'function'
  );
}

export interface GameSceneState {
  isPvPMode: boolean;
  isAIEnabled: boolean;
  aiDifficulty: AIDifficulty;
  useFactions: boolean;
  
  playerFaction: FactionId;
  opponentFaction: FactionId;
  currentArena?: FactionArena;
  
  pvpData?: GameStartData;
  isHost: boolean;
  myPlayerIndex: number;
  currentTurnId: string;
  myPlayer?: PvPPlayer;
  opponentPlayer?: PvPPlayer;
  
  isProcessingTurn: boolean;
  isGoalCelebrating: boolean;
  lastShootTime: number;
  lastCollisionTime: number;
  ballSpeedBeforeCollision: number;
  selectedCapId?: string;
  lastShootingCapId?: string;
  
  matchDuration: number;
  matchRemainingTime: number;
  
  snapshotBuffer: Snapshot[];
  serverTimeOffset: number;
  timeSyncSamples: number[];
  guestLocalPhysicsUntil: number;
  syncGracePeriodUntil: number;
  lastServerSnapshot?: Snapshot;
  
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