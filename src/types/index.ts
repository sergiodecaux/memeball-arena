// src/types/index.ts
// ✅ ОБНОВЛЕНО: Добавлены re-exports новых типов

import { CapClass, FactionId } from '../constants/gameConstants';

// ==================== RE-EXPORTS ====================

// Из match.ts
export type { 
  TurnPhase, 
  GameMode, 
  MatchConfig, 
  TurnState, 
  ScoreState, 
  TimerState, 
  MatchState 
} from './match';
export { createInitialMatchState } from './match';

// Из MatchResult.ts
export type { MatchResult, Achievement, MatchRewards, MatchEndReason } from './MatchResult';

// Из abilities.ts (основные)
export type { 
  AbilityType, 
  AbilityTrigger, 
  AbilityTargetType,
  AbilityDefinition,
  AbilityEvent,
  AbilityEventType,
  ChargeGainReason,
} from './abilities';

// ==================== SKIN RARITY ====================

export type SkinRarity = 'basic' | 'common' | 'rare' | 'epic' | 'legendary';

// ==================== POSITION & DIMENSIONS ====================

export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface FieldBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

// ==================== PLAYERS ====================

export type PlayerNumber = 1 | 2;

export interface GameEntityData {
  type: 'ball' | 'unit';  // ✅ Убрано дублирование 'cap'
  owner?: PlayerNumber;
  id?: string;
  factionId?: FactionId;
}

// ==================== FACTIONS ====================

export type { FactionId } from '../constants/gameConstants';

// ==================== FORMATIONS ====================

export interface FormationSlot {
  id: string;
  x: number;  // 0-1 относительные координаты
  y: number;  // 0-1 относительные координаты
}

export interface Formation {
  id: string;
  name: string;
  slots: FormationSlot[];
  isCustom: boolean;
}

// ==================== CAP UPGRADES ====================

export interface CapUpgrades {
  power: number;
  mass: number;
  aim: number;
  technique: number;
}

export interface OwnedCap {
  id: string;
  unlockedAt: number;
  upgrades: CapUpgrades;
}

export interface TeamSetup {
  [slotId: string]: string | null;
}

// ==================== VISUALS & VFX ====================

export interface ParticleConfig {
  texture: string;
  color: number[];
  blendMode: 'ADD' | 'NORMAL' | 'SCREEN';
  speed: number;
  scale: { start: number; end: number };
  lifespan: number;
  frequency: number;
  quantity?: number;
  followVelocity: boolean;
  gravityY?: number;
}

export interface SkinVisualConfig {
  type: 'simple' | 'sprite' | 'image';
  textureKey?: string;
  imageKey?: string;
  scale?: number;
  borderColor?: number;
  borderWidth?: number;
  particleEffect?: ParticleConfig;
}

// ==================== AI ====================

export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'impossible';

/** League/UI может передавать `expert` или число (1–10 или 0–1). Внутри матча всегда используйте normalizeGameAIDifficulty(). */
export type AIDifficultyInput =
  | AIDifficulty
  | 'expert'
  | number
  | string
  | undefined
  | null;

export function normalizeGameAIDifficulty(
  input: AIDifficultyInput,
  fallback: AIDifficulty = 'medium'
): AIDifficulty {
  if (input === undefined || input === null) return fallback;

  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return fallback;

    const n = Math.round(input);
    if (n >= 1 && n <= 10) {
      if (n <= 2) return 'easy';
      if (n <= 5) return 'medium';
      if (n <= 8) return 'hard';
      return 'impossible';
    }

    if (input <= 0.32) return 'easy';
    if (input <= 0.55) return 'medium';
    if (input <= 0.82) return 'hard';
    return 'impossible';
  }

  const s = String(input).trim().toLowerCase();
  if (s === 'expert') return 'impossible';
  if (s === 'easy' || s === 'medium' || s === 'hard' || s === 'impossible') {
    return s;
  }

  return fallback;
}

export type AIStrategy = 'attack' | 'defend' | 'intercept' | 'block';

export interface AIMoveEvaluation {
  score: number;
  strategy: AIStrategy;
  targetX: number;
  targetY: number;
  force: number;
  angle: number;
}

export interface AIDifficultySettings {
  accuracy: number;
  reactionDelay: number;
  mistakeChance: number;
  forceVariation: number;
  strategicDepth: number;
}

// ==================== CURRENCY ====================

export interface SkinPrice {
  coins?: number;
  crystals?: number;
}

// ==================== LEGACY GAME CONFIG ====================
// ⚠️ DEPRECATED: Используй MatchConfig из './match'

export interface GameConfig {
  vsAI: boolean;
  difficulty?: AIDifficulty;
  isPvP?: boolean;
  isHost?: boolean;
  roomId?: string;
  useFactions?: boolean;
  playerFaction?: FactionId;
  opponentFaction?: FactionId;
}