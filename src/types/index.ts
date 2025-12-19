// src/types/index.ts

import { CapClass } from '../constants/gameConstants';

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
  type: 'ball' | 'cap';
  owner?: PlayerNumber;
  id?: string;
}

// ==================== FORMATIONS ====================

export interface FormationSlot {
  id: string;
  x: number;
  y: number;
  capClass: CapClass;
}

export interface Formation {
  id: string;
  name: string;
  slots: FormationSlot[];
  isCustom: boolean;
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
  type: 'simple' | 'sprite';
  textureKey?: string;
  scale?: number;
  particleEffect?: ParticleConfig;
}

// ==================== AI ====================

export type AIDifficulty = 'easy' | 'medium' | 'hard';
export type AIStrategy = 'attack' | 'defend' | 'intercept' | 'block';

export interface AIMoveEvaluation {
  cap: import('../entities/Cap').Cap;
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