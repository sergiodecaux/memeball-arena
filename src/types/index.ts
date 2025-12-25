// src/types/index.ts

import { CapClass, FactionId } from '../constants/gameConstants';

// ==================== SKIN RARITY ====================

export type SkinRarity = 'basic' | 'common' | 'rare' | 'epic' | 'legendary';

// ==================== POSITION & DIMENSIONS ====================

export interface Position {
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

export type PlayerNumber = 1 | 2;

export interface GameEntityData {
  type: 'ball' | 'cap' | 'unit';
  owner?: PlayerNumber;
  id?: string;
  factionId?: FactionId;
}

// ==================== FACTIONS ====================

export type { FactionId } from '../constants/gameConstants';

// ==================== FORMATIONS ====================

export interface FormationSlot {
  id: string;
  x: number;
  y: number;
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

export type AIDifficulty = 'easy' | 'medium' | 'hard';
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

// ==================== GAME CONFIG ====================

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