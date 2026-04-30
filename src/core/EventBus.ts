// ✅ ИЗМЕНЕНО: Добавлены новые события для карточной системы

import Phaser from 'phaser';
import { FactionId } from '../constants/gameConstants';
import { PlayerNumber } from '../types';

/**
 * Типы игровых событий
 */
export enum GameEvents {
  // === MATCH LIFECYCLE ===
  MATCH_STARTED = 'match:started',
  MATCH_PAUSED = 'match:paused',
  MATCH_RESUMED = 'match:resumed',
  MATCH_FINISHED = 'match:finished',
  
  // === TURN MANAGEMENT ===
  TURN_STARTED = 'turn:started',
  TURN_ENDED = 'turn:ended',
  TURN_TIMER_TICK = 'turn:timer_tick',
  
  // === SHOOTING ===
  SHOT_STARTED = 'shot:started',
  SHOT_EXECUTED = 'shot:executed',
  OBJECTS_STOPPED = 'objects:stopped',
  
  // === GOALS ===
  GOAL_SCORED = 'goal:scored',
  GOAL_CELEBRATION_STARTED = 'goal:celebration_started',
  GOAL_CELEBRATION_ENDED = 'goal:celebration_ended',

  // === LEAGUE / PROGRESSION (CUSTOM) ===
  LEAGUE_MATCH_WON = 'LEAGUE_MATCH_WON',
  CARD_USED = 'CARD_USED',
  
  // === COLLISIONS ===
  COLLISION_BALL_UNIT = 'collision:ball_unit',
  COLLISION_BALL_WALL = 'collision:ball_wall',
  COLLISION_UNIT_UNIT = 'collision:unit_unit',
  COLLISION_BALL_SHIELD = 'collision:ball_shield',
  COLLISION_UNIT_LAVA = 'collision:unit_lava',
  COLLISION_BALL_BARRIER = 'collision:ball_barrier',
  COLLISION_BALL_CRATER = 'collision:ball_crater',
  COLLISION_ENTITY_WORMHOLE = 'collision:entity_wormhole',
  
  // === ABILITIES (Legacy) ===
  ABILITY_CHARGE_GAINED = 'ability:charge_gained',
  ABILITY_CHARGE_SPENT = 'ability:charge_spent',
  ABILITY_CARD_USED = 'ability:card_used',
  ABILITY_ACTIVATION_STARTED = 'ability:activation_started',
  ABILITY_ACTIVATION_CANCELLED = 'ability:activation_cancelled',
  ABILITY_ACTIVATED = 'ability:activated',
  ABILITY_TARGET_SELECTED = 'ability:target_selected',
  ABILITY_EFFECT_EXPIRED = 'ability:effect_expired',
  
  // === PASSIVE SYSTEM ===
  PASSIVE_ACTIVATED = 'passive:activated',
  PASSIVE_PUSH = 'passive:push',
  STAT_CHANGED = 'passive:stat_changed',
  BALL_PASS_THROUGH = 'ball:pass_through',
  BALL_EFFECT_SET = 'ball:effect_set',
  BALL_EFFECT_CLEAR = 'ball:effect_clear',
  BALL_TELEPORT_SCHEDULED = 'ball:teleport_scheduled',
  BALL_SLOW = 'ball:slow',
  BALL_ATTRACT = 'ball:attract',
  UNIT_TELEPORT = 'unit:teleport',
  EXTRA_KNOCKBACK = 'unit:extra_knockback',
  CREATE_LAVA_POOL = 'ability:create_lava_pool',
  
  // === CARD SYSTEM (NEW) ===
  CARD_ACTIVATION_STARTED = 'card:activation_started',
  CARD_ACTIVATION_CANCELLED = 'card:activation_cancelled',
  CARD_ACTIVATED = 'card:activated',
  CARD_TARGET_SELECTED = 'card:target_selected',
  CARD_EFFECT_CREATED = 'card:effect_created',
  CARD_EFFECT_EXPIRED = 'card:effect_expired',
  
  // === ABILITY SPECIFIC ===
  LAVA_POOL_CREATED = 'ability:lava_created',
  LAVA_POOL_EXPIRED = 'ability:lava_expired',
  SHIELD_ACTIVATED = 'ability:shield_activated',
  SHIELD_HIT = 'ability:shield_hit',
  SWAP_EXECUTED = 'ability:swap_executed',
  TOXIN_CHARGED = 'ability:toxin_charged',
  STUN_APPLIED = 'ability:stun_applied',
  
  // === NEW CARD EFFECTS ===
  METEOR_STRIKE = 'card:meteor_strike',
  CRATER_CREATED = 'card:crater_created',
  BARRIER_CREATED = 'card:barrier_created',
  BARRIER_HIT = 'card:barrier_hit',
  WORMHOLE_CREATED = 'card:wormhole_created',
  WORMHOLE_TELEPORT = 'card:wormhole_teleport',
  GHOST_PHASE_STARTED = 'card:ghost_phase_started',
  GHOST_PHASE_ENDED = 'card:ghost_phase_ended',
  TETHER_CREATED = 'card:tether_created',
  TETHER_BROKEN = 'card:tether_broken',
  MOLTEN_BALL_ACTIVATED = 'card:molten_ball_activated',
  MOLTEN_BALL_HIT = 'card:molten_ball_hit',
  MIMIC_BALL_CREATED = 'card:mimic_ball_created',
  MIMIC_BALL_DESTROYED = 'card:mimic_ball_destroyed',
  PARASITE_ATTACHED = 'card:parasite_attached',
  PARASITE_RELEASED = 'card:parasite_released',
  
  // === VFX REQUESTS ===
  VFX_HIT_EFFECT = 'vfx:hit_effect',
  VFX_GOAL_EFFECT = 'vfx:goal_effect',
  VFX_TELEPORT_EFFECT = 'vfx:teleport_effect',
  VFX_SHIELD_HIT_EFFECT = 'vfx:shield_hit',
  VFX_LAVA_SPAWN_EFFECT = 'vfx:lava_spawn',
  VFX_TOXIN_EFFECT = 'vfx:toxin',
  VFX_STATUS_EFFECT = 'vfx:status',
  VFX_WALL_HIT = 'vfx:wall_hit',
  VFX_METEOR_STRIKE = 'vfx:meteor_strike',
  VFX_BARRIER_GLOW = 'vfx:barrier_glow',
  VFX_WORMHOLE_PULSE = 'vfx:wormhole_pulse',
  VFX_GHOST_TRAIL = 'vfx:ghost_trail',
  VFX_TETHER_SPARK = 'vfx:tether_spark',
  
  // === UI ===
  UI_SCORE_UPDATED = 'ui:score_updated',
  UI_TIMER_UPDATED = 'ui:timer_updated',
  UI_NOTIFICATION = 'ui:notification',
  UI_CARD_PANEL_UPDATED = 'ui:card_panel_updated',
  
  // === REWARDS ===
  REWARD_UNIT_SELECTED = 'reward:unit_selected',
  REWARD_CLAIMED = 'reward:claimed',
  
  // === HAPTIC ===
  HAPTIC_FEEDBACK = 'haptic:feedback',
  
  // === PVP NETWORK ===
  PVP_CONNECTED = 'pvp:connected',
  PVP_DISCONNECTED = 'pvp:disconnected',
  PVP_ERROR = 'pvp:error',
  
  // === PVP MATCHMAKING ===
  PVP_MATCH_FOUND = 'pvp:match_found',
  
  // === PVP MATCH ===
  PVP_MATCH_START = 'pvp:match_start',
  PVP_MATCH_END = 'pvp:match_end',
  
  // === PVP GAME ===
  PVP_STATE_UPDATE = 'pvp:state_update',
  PVP_TURN_CHANGE = 'pvp:turn_change',
  PVP_GOAL = 'pvp:goal',
  PVP_GAME_PAUSED = 'pvp:game_paused',
  
  // === PVP OPPONENT ===
  PVP_OPPONENT_DISCONNECTED = 'pvp:opponent_disconnected',
  PVP_OPPONENT_RECONNECTED = 'pvp:opponent_reconnected',
  
  // === TUTORIAL ===
  TUTORIAL_STEP_STARTED = 'tutorial:step_started',
  TUTORIAL_OBJECTIVE_COMPLETE = 'tutorial:objective_complete',
  TUTORIAL_STEP_COMPLETED = 'tutorial:step_completed',
  TUTORIAL_COMPLETED = 'tutorial:completed',
  TUTORIAL_DIALOGUE_STARTED = 'tutorial:dialogue_started',
  TUTORIAL_DIALOGUE_ENDED = 'tutorial:dialogue_ended',
  TUTORIAL_SKIPPED = 'tutorial:skipped',
}

/**
 * Payload типы для событий
 */
export interface MatchStartedPayload {
  mode: string;
  duration: number;
  playerFaction?: FactionId;
  opponentFaction?: FactionId;
}

export interface MatchFinishedPayload {
  winner: PlayerNumber | null;
  scores: { player1: number; player2: number };
  reason: string;
}

export interface TurnStartedPayload {
  player: PlayerNumber;
  turnNumber: number;
}

export interface TurnEndedPayload {
  player: PlayerNumber;
  turnNumber: number;
}

export interface ShotExecutedPayload {
  unitId: string;
  velocity: { x: number; y: number };
  position: { x: number; y: number };
  hitOffset?: number;
}

export interface ObjectsStoppedPayload {
  turnNumber: number;
}

export interface GoalScoredPayload {
  scoringPlayer: PlayerNumber;
  scores: { player1: number; player2: number };
}

export interface LeagueMatchWonPayload {
  oldStars: number;
  newStars: number;
  tier: string;
}

export interface CardUsedPayload {
  cardId: string;
  playerId?: PlayerNumber;
}

export interface CollisionBallUnitPayload {
  unitId: string;
  factionId: FactionId;
  impactForce: number;
  position: { x: number; y: number };
  // Опциональные поля для обратной совместимости
  unitOwner?: PlayerNumber;
  unitClass?: string;
}

export interface CollisionBallWallPayload {
  impactForce: number;
  position: { x: number; y: number };
}

export interface CollisionUnitUnitPayload {
  unitAId: string;
  unitBId: string;
  factionAId: FactionId;
  factionBId: FactionId;
  impactForce: number;
  position: { x: number; y: number };
}

export interface CollisionBallShieldPayload {
  shieldOwnerId: string;
  position: { x: number; y: number };
  angle: number;
}

export interface CollisionUnitLavaPayload {
  unitId: string;
  lavaPoolId: string;
  position: { x: number; y: number };
}

export interface CollisionBallBarrierPayload {
  barrierId: string;
  position: { x: number; y: number };
  angle: number;
}

export interface CollisionEntityWormholePayload {
  entityType: 'ball' | 'unit';
  entityId: string;
  wormholeId: string;
  entryPortal: 'A' | 'B';
  position: { x: number; y: number };
}

export interface AbilityChargeGainedPayload {
  playerId: PlayerNumber;
  amount: number;
  reason: string;
  newTotal: number;
  maxCharges: number;
}

export interface AbilityChargeSpentPayload {
  playerId: PlayerNumber;
  remaining: number;
}

export interface AbilityCardUsedPayload {
  playerId: PlayerNumber;
  remainingCards: number;
}

export interface AbilityActivationStartedPayload {
  playerId: PlayerNumber;
  abilityType: string;
  targetType: string;
}

export interface AbilityActivatedPayload {
  playerId: PlayerNumber;
  abilityType: string;
}

export interface AbilityTargetSelectedPayload {
  playerId: PlayerNumber;
  unitId: string;
  step: number;
  needMore: boolean;
}

export interface AbilityEffectExpiredPayload {
  effectType: string;
  id: string;
  reason?: string;
}

// === NEW CARD SYSTEM PAYLOADS ===

export interface CardActivationStartedPayload {
  playerId: PlayerNumber;
  cardId: string;
  cardName: string;
  targetType: string;
}

export interface CardActivatedPayload {
  playerId: PlayerNumber;
  cardId: string;
  cardName: string;
  targetData: {
    position?: { x: number; y: number };
    unitIds?: string[];
  };
}

export interface CardEffectCreatedPayload {
  effectId: string;
  effectType: string;
  playerId: PlayerNumber;
  position?: { x: number; y: number };
  duration?: number;
}

export interface CardEffectExpiredPayload {
  effectId: string;
  effectType: string;
  reason: 'timeout' | 'destroyed' | 'cancelled';
}

export interface MeteorStrikePayload {
  playerId: PlayerNumber;
  position: { x: number; y: number };
  craterRadius: number;
  damageRadius: number;
}

export interface CraterCreatedPayload {
  craterId: string;
  position: { x: number; y: number };
  radius: number;
}

export interface BarrierCreatedPayload {
  barrierId: string;
  playerId: PlayerNumber;
  start: { x: number; y: number };
  end: { x: number; y: number };
  duration: number;
}

export interface WormholeCreatedPayload {
  wormholeId: string;
  playerId: PlayerNumber;
  portalA: { x: number; y: number };
  portalB: { x: number; y: number };
  duration: number;
}

export interface WormholeTeleportPayload {
  wormholeId: string;
  entityType: 'ball' | 'unit';
  entityId: string;
  fromPortal: 'A' | 'B';
  toPortal: 'A' | 'B';
}

export interface GhostPhasePayload {
  unitId: string;
  playerId: PlayerNumber;
  duration: number;
}

export interface TetherCreatedPayload {
  tetherId: string;
  unitId: string;
  playerId: PlayerNumber;
  duration: number;
}

export interface MoltenBallPayload {
  playerId: PlayerNumber;
  duration: number;
}

export interface MoltenBallHitPayload {
  targetUnitId: string;
  stunDuration: number;
}

export interface MimicBallPayload {
  mimicId: string;
  playerId: PlayerNumber;
  position: { x: number; y: number };
}

export interface ParasitePayload {
  attackerId: string;
  targetId: string;
  duration: number;
  originalOwner: PlayerNumber;
}

export interface LavaPoolCreatedPayload {
  id: string;
  playerId: PlayerNumber;
  position: { x: number; y: number };
  radius: number;
}

export interface ShieldActivatedPayload {
  playerId: PlayerNumber;
  unitId: string;
  radius: number;
  duration: number;
}

export interface SwapExecutedPayload {
  playerId: PlayerNumber;
  unit1Id: string;
  unit2Id: string;
  pos1: { x: number; y: number };
  pos2: { x: number; y: number };
}

export interface ToxinChargedPayload {
  playerId: PlayerNumber;
  unitId: string;
  duration: number;
}

export interface StunAppliedPayload {
  attackerId: string;
  targetId: string;
  duration: number;
}

export interface VFXHitEffectPayload {
  x: number;
  y: number;
  factionId: FactionId;
  intensity: number;
}

export interface VFXTeleportEffectPayload {
  x: number;
  y: number;
  color: number;
}

export interface VFXShieldHitPayload {
  x: number;
  y: number;
  angle: number;
}

export interface VFXLavaSpawnPayload {
  x: number;
  y: number;
  radius: number;
}

export interface VFXToxinPayload {
  x: number;
  y: number;
}

export interface VFXStatusPayload {
  x: number;
  y: number;
  type: 'stun' | 'shield' | 'toxin' | 'lava' | 'ghost' | 'tether' | 'parasite';
}

export interface VFXWallHitPayload {
  x: number;
  y: number;
  intensity: number;
}

export interface VFXMeteorStrikePayload {
  x: number;
  y: number;
  craterRadius: number;
}

export interface UIScoreUpdatedPayload {
  player1: number;
  player2: number;
}

export interface UITimerUpdatedPayload {
  remaining: number;
  total: number;
}

export interface UINotificationPayload {
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  duration?: number;
}

export interface UICardPanelUpdatedPayload {
  playerId: PlayerNumber;
  availableCards: number;
  usedCards: number;
}

export interface HapticFeedbackPayload {
  type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';
}

/**
 * ✅ НОВОЕ: Payload для событий наград
 */
export interface RewardUnitSelectedPayload {
  unitId: string;
}

export interface RewardClaimedPayload {
  type: 'level' | 'faction' | 'quest';
  level?: number;
  factionId?: FactionId;
  taskId?: string;
}

/**
 * Карта событий к их payload типам
 */
export interface EventPayloadMap {
  [GameEvents.MATCH_STARTED]: MatchStartedPayload;
  [GameEvents.MATCH_PAUSED]: Record<string, never>;
  [GameEvents.MATCH_RESUMED]: Record<string, never>;
  [GameEvents.MATCH_FINISHED]: MatchFinishedPayload;
  
  [GameEvents.TURN_STARTED]: TurnStartedPayload;
  [GameEvents.TURN_ENDED]: TurnEndedPayload;
  [GameEvents.TURN_TIMER_TICK]: { remaining: number };
  
  [GameEvents.SHOT_STARTED]: { unitId: string };
  [GameEvents.SHOT_EXECUTED]: ShotExecutedPayload;
  [GameEvents.OBJECTS_STOPPED]: ObjectsStoppedPayload;
  
  [GameEvents.GOAL_SCORED]: GoalScoredPayload;
  [GameEvents.GOAL_CELEBRATION_STARTED]: { scoringPlayer: PlayerNumber };
  [GameEvents.GOAL_CELEBRATION_ENDED]: Record<string, never>;

  [GameEvents.LEAGUE_MATCH_WON]: LeagueMatchWonPayload;
  [GameEvents.CARD_USED]: CardUsedPayload;
  
  [GameEvents.COLLISION_BALL_UNIT]: CollisionBallUnitPayload;
  [GameEvents.COLLISION_BALL_WALL]: CollisionBallWallPayload;
  [GameEvents.COLLISION_UNIT_UNIT]: CollisionUnitUnitPayload;
  [GameEvents.COLLISION_BALL_SHIELD]: CollisionBallShieldPayload;
  [GameEvents.COLLISION_UNIT_LAVA]: CollisionUnitLavaPayload;
  [GameEvents.COLLISION_BALL_BARRIER]: CollisionBallBarrierPayload;
  [GameEvents.COLLISION_BALL_CRATER]: { craterId: string; position: { x: number; y: number } };
  [GameEvents.COLLISION_ENTITY_WORMHOLE]: CollisionEntityWormholePayload;
  
  [GameEvents.ABILITY_CHARGE_GAINED]: AbilityChargeGainedPayload;
  [GameEvents.ABILITY_CHARGE_SPENT]: AbilityChargeSpentPayload;
  [GameEvents.ABILITY_CARD_USED]: AbilityCardUsedPayload;
  [GameEvents.ABILITY_ACTIVATION_STARTED]: AbilityActivationStartedPayload;
  [GameEvents.ABILITY_ACTIVATION_CANCELLED]: { playerId: PlayerNumber };
  [GameEvents.ABILITY_ACTIVATED]: AbilityActivatedPayload;
  [GameEvents.ABILITY_TARGET_SELECTED]: AbilityTargetSelectedPayload;
  [GameEvents.ABILITY_EFFECT_EXPIRED]: AbilityEffectExpiredPayload;
  
  // Passive System
  [GameEvents.PASSIVE_ACTIVATED]: { unitId: string; text: string; color: number; x: number; y: number };
  [GameEvents.PASSIVE_PUSH]: { targetUnitId: string; pushX: number; pushY: number };
  [GameEvents.STAT_CHANGED]: { unitId: string; stat: string; value: number };
  [GameEvents.BALL_PASS_THROUGH]: { count: number };
  [GameEvents.BALL_EFFECT_SET]: { type: string; value: number; sourceUnitId: string };
  [GameEvents.BALL_EFFECT_CLEAR]: { type: string };
  [GameEvents.BALL_TELEPORT_SCHEDULED]: { angle: number; distance: number };
  [GameEvents.BALL_SLOW]: { value: number };
  [GameEvents.BALL_ATTRACT]: { angle: number; force: number };
  [GameEvents.UNIT_TELEPORT]: { unitId: string; x: number; y: number };
  [GameEvents.EXTRA_KNOCKBACK]: { targetUnitId: string; multiplier: number };
  [GameEvents.CREATE_LAVA_POOL]: { x: number; y: number; fromPassive?: boolean };
  
  // Card System
  [GameEvents.CARD_ACTIVATION_STARTED]: CardActivationStartedPayload;
  [GameEvents.CARD_ACTIVATION_CANCELLED]: { playerId: PlayerNumber; cardId: string };
  [GameEvents.CARD_ACTIVATED]: CardActivatedPayload;
  [GameEvents.CARD_TARGET_SELECTED]: { playerId: PlayerNumber; cardId: string; targetData: any };
  [GameEvents.CARD_EFFECT_CREATED]: CardEffectCreatedPayload;
  [GameEvents.CARD_EFFECT_EXPIRED]: CardEffectExpiredPayload;
  
  // Card Effects
  [GameEvents.METEOR_STRIKE]: MeteorStrikePayload;
  [GameEvents.CRATER_CREATED]: CraterCreatedPayload;
  [GameEvents.BARRIER_CREATED]: BarrierCreatedPayload;
  [GameEvents.BARRIER_HIT]: { barrierId: string; impactForce: number };
  [GameEvents.WORMHOLE_CREATED]: WormholeCreatedPayload;
  [GameEvents.WORMHOLE_TELEPORT]: WormholeTeleportPayload;
  [GameEvents.GHOST_PHASE_STARTED]: GhostPhasePayload;
  [GameEvents.GHOST_PHASE_ENDED]: { unitId: string };
  [GameEvents.TETHER_CREATED]: TetherCreatedPayload;
  [GameEvents.TETHER_BROKEN]: { tetherId: string; reason: string };
  [GameEvents.MOLTEN_BALL_ACTIVATED]: MoltenBallPayload;
  [GameEvents.MOLTEN_BALL_HIT]: MoltenBallHitPayload;
  [GameEvents.MIMIC_BALL_CREATED]: MimicBallPayload;
  [GameEvents.MIMIC_BALL_DESTROYED]: { mimicId: string; reason: 'hit' | 'timeout' };
  [GameEvents.PARASITE_ATTACHED]: ParasitePayload;
  [GameEvents.PARASITE_RELEASED]: { targetId: string };
  
  [GameEvents.LAVA_POOL_CREATED]: LavaPoolCreatedPayload;
  [GameEvents.LAVA_POOL_EXPIRED]: { id: string };
  [GameEvents.SHIELD_ACTIVATED]: ShieldActivatedPayload;
  [GameEvents.SHIELD_HIT]: CollisionBallShieldPayload;
  [GameEvents.SWAP_EXECUTED]: SwapExecutedPayload;
  [GameEvents.TOXIN_CHARGED]: ToxinChargedPayload;
  [GameEvents.STUN_APPLIED]: StunAppliedPayload;
  
  [GameEvents.VFX_HIT_EFFECT]: VFXHitEffectPayload;
  [GameEvents.VFX_GOAL_EFFECT]: { x: number; y: number; isPlayerGoal: boolean };
  [GameEvents.VFX_TELEPORT_EFFECT]: VFXTeleportEffectPayload;
  [GameEvents.VFX_SHIELD_HIT_EFFECT]: VFXShieldHitPayload;
  [GameEvents.VFX_LAVA_SPAWN_EFFECT]: VFXLavaSpawnPayload;
  [GameEvents.VFX_TOXIN_EFFECT]: VFXToxinPayload;
  [GameEvents.VFX_STATUS_EFFECT]: VFXStatusPayload;
  [GameEvents.VFX_WALL_HIT]: VFXWallHitPayload;
  [GameEvents.VFX_METEOR_STRIKE]: VFXMeteorStrikePayload;
  [GameEvents.VFX_BARRIER_GLOW]: { barrierId: string; intensity: number };
  [GameEvents.VFX_WORMHOLE_PULSE]: { wormholeId: string; portal: 'A' | 'B' };
  [GameEvents.VFX_GHOST_TRAIL]: { unitId: string; x: number; y: number };
  [GameEvents.VFX_TETHER_SPARK]: { unitId: string; ballX: number; ballY: number };
  
  [GameEvents.UI_SCORE_UPDATED]: UIScoreUpdatedPayload;
  [GameEvents.UI_TIMER_UPDATED]: UITimerUpdatedPayload;
  [GameEvents.UI_NOTIFICATION]: UINotificationPayload;
  [GameEvents.UI_CARD_PANEL_UPDATED]: UICardPanelUpdatedPayload;
  
  [GameEvents.REWARD_UNIT_SELECTED]: RewardUnitSelectedPayload;
  [GameEvents.REWARD_CLAIMED]: RewardClaimedPayload;
  
  [GameEvents.HAPTIC_FEEDBACK]: HapticFeedbackPayload;
  
  // PVP Network
  [GameEvents.PVP_CONNECTED]: Record<string, never>;
  [GameEvents.PVP_DISCONNECTED]: { reason: string };
  [GameEvents.PVP_ERROR]: { type: string; message: string };
  
  // PVP Matchmaking
  [GameEvents.PVP_MATCH_FOUND]: {
    roomId: string;
    opponentId: string;
    opponentName?: string;
    yourTeam: number;
  };
  
  // PVP Match
  [GameEvents.PVP_MATCH_START]: {
    initialState: any; // ServerGameState
    yourTeam: number;
    timeLimit: number;
    currentTeam: number;
  };
  
  [GameEvents.PVP_MATCH_END]: {
    winner: number;
    scores: { 1: number; 2: number };
    reason: string;
  };
  
  // PVP Game
  [GameEvents.PVP_STATE_UPDATE]: {
    state: any; // ServerGameState
    frame: number;
    timestamp: number;
  };
  
  [GameEvents.PVP_TURN_CHANGE]: {
    currentTeam: number;
    turnNumber: number;
  };
  
  [GameEvents.PVP_GOAL]: {
    scoringTeam: number;
    scores: { 1: number; 2: number };
  };
  
  [GameEvents.PVP_GAME_PAUSED]: Record<string, never>;
  
  // PVP Opponent
  [GameEvents.PVP_OPPONENT_DISCONNECTED]: {
    reconnectTimeout: number;
  };
  
  [GameEvents.PVP_OPPONENT_RECONNECTED]: Record<string, never>;
}

/**
 * Хелпер тип для получения payload по событию
 */
export type EventPayload<T extends GameEvents> = T extends keyof EventPayloadMap 
  ? EventPayloadMap[T] 
  : Record<string, unknown>;

/**
 * Глобальная шина событий
 * Singleton для всей игры
 */
class GameEventBus extends Phaser.Events.EventEmitter {
  private static instance: GameEventBus;
  private debugMode: boolean = false;
  private static subscriptionStats: Map<string, number> = new Map();
  private static readonly MAX_LISTENERS_PER_EVENT = 50;

  private constructor() {
    super();
  }

  static getInstance(): GameEventBus {
    if (!GameEventBus.instance) {
      GameEventBus.instance = new GameEventBus();
    }
    return GameEventBus.instance;
  }

  /**
   * Включить/выключить debug логирование
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Типизированный dispatch (отправка события)
   */
  dispatch<T extends GameEvents>(event: T, payload: EventPayload<T>): void {
    if (this.debugMode) {
      console.log(`[EventBus] 📤 ${event}`, payload);
    }
    this.emit(event, payload);
  }

  /**
   * Типизированная подписка на событие
   */
  subscribe<T extends GameEvents>(
    event: T,
    callback: (payload: EventPayload<T>) => void,
    context?: unknown
  ): this {
    if (this.debugMode) {
      console.log(`[EventBus] 🔔 Subscribe: ${event}`);
    }
    
    // Статистика (только в dev)
    if (import.meta.env.DEV) {
      const current = GameEventBus.subscriptionStats.get(event) || 0;
      GameEventBus.subscriptionStats.set(event, current + 1);
      
      // Предупреждение при превышении лимита
      if (current + 1 > GameEventBus.MAX_LISTENERS_PER_EVENT) {
        console.warn(`[EventBus] Too many listeners for "${event}": ${current + 1}`);
      }
    }
    
    return this.on(event, callback, context);
  }

  /**
   * Подписка на событие (только один раз)
   */
  subscribeOnce<T extends GameEvents>(
    event: T,
    callback: (payload: EventPayload<T>) => void,
    context?: unknown
  ): this {
    return this.once(event, callback, context);
  }

  /**
   * Отписка от события
   */
  unsubscribe<T extends GameEvents>(
    event: T,
    callback?: (payload: EventPayload<T>) => void,
    context?: unknown
  ): this {
    if (this.debugMode) {
      console.log(`[EventBus] 🔕 Unsubscribe: ${event}`);
    }
    
    // Статистика (только в dev)
    if (import.meta.env.DEV) {
      const current = GameEventBus.subscriptionStats.get(event) || 0;
      if (current > 0) {
        GameEventBus.subscriptionStats.set(event, current - 1);
      }
    }
    
    return this.off(event, callback, context);
  }

  /**
   * Очистка всех подписок (вызывать при смене сцены)
   */
  clear(): void {
    if (this.debugMode) {
      console.log('[EventBus] 🧹 Clearing all listeners');
    }
    this.removeAllListeners();
  }

  /**
   * Очищает только игровые события, сохраняя подписки глобальных менеджеров
   */
  clearGameEvents(): void {
    if (this.debugMode) {
      console.log('[EventBus] Clear game events only');
    }
    
    // Список событий которые НЕ нужно очищать (глобальные менеджеры)
    const preserveEvents: GameEvents[] = [
      GameEvents.GOAL_SCORED,
      GameEvents.MATCH_FINISHED,
      GameEvents.LEAGUE_MATCH_WON,
      GameEvents.CARD_USED,
    ];
    
    // Получаем все события
    const allEvents = Object.values(GameEvents);
    
    // Очищаем только те, которые не в списке сохранения
    allEvents.forEach(event => {
      if (!preserveEvents.includes(event as GameEvents)) {
        this.removeAllListeners(event);
      }
    });
  }

  /**
   * Получить количество слушателей для события
   */
  getListenerCount(event: GameEvents): number {
    return this.listenerCount(event);
  }

  /**
   * Debug: получить статистику подписок
   */
  static getSubscriptionStats(): Record<string, number> {
    return Object.fromEntries(this.subscriptionStats);
  }

  /**
   * Debug: проверить на потенциальные утечки
   */
  static checkForLeaks(): string[] {
    const warnings: string[] = [];
    this.subscriptionStats.forEach((count, event) => {
      if (count > this.MAX_LISTENERS_PER_EVENT) {
        warnings.push(`⚠️ Event "${event}" has ${count} listeners (max: ${this.MAX_LISTENERS_PER_EVENT})`);
      }
    });
    return warnings;
  }

  /**
   * Debug: сбросить статистику
   */
  static resetStats(): void {
    this.subscriptionStats.clear();
  }
}

// Экспорт singleton
export const eventBus = GameEventBus.getInstance();

// Альтернативный экспорт для удобства
export const EventBus = {
  emit: <T extends GameEvents>(event: T, payload?: EventPayload<T>) => {
    eventBus.dispatch(event, payload as EventPayload<T>);
  },
  
  on: <T extends GameEvents>(
    event: T, 
    callback: (payload: EventPayload<T>) => void,
    context?: unknown
  ) => {
    return eventBus.subscribe(event, callback, context);
  },
  
  once: <T extends GameEvents>(
    event: T,
    callback: (payload: EventPayload<T>) => void,
    context?: unknown
  ) => {
    return eventBus.subscribeOnce(event, callback, context);
  },
  
  off: <T extends GameEvents>(
    event: T,
    callback?: (payload: EventPayload<T>) => void,
    context?: unknown
  ) => {
    return eventBus.unsubscribe(event, callback, context);
  },
  
  clear: () => {
    eventBus.clear();
  },
  
  setDebugMode: (enabled: boolean) => {
    eventBus.setDebugMode(enabled);
  },
  
  getSubscriptionStats: () => {
    return GameEventBus.getSubscriptionStats();
  },
  
  checkForLeaks: () => {
    return GameEventBus.checkForLeaks();
  },
  
  resetStats: () => {
    GameEventBus.resetStats();
  },
};