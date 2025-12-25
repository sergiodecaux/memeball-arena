// src/ai/scoring/ScoringWeights.ts
// Веса для функции оценки ударов

import { ScoringWeights } from '../candidates/CandidateTypes';
import { CapClass, FactionId } from '../../constants/gameConstants';
import { AIDifficulty } from '../../types';

/**
 * Базовые веса для оценки
 */
export const BASE_WEIGHTS: ScoringWeights = {
  goalScored: 100,
  ownGoal: -100,
  ballNearOpponentGoal: 50,
  ballNearOwnGoal: -30,
  enemyPushed: 20,
  defensePosition: 20,
  openedOwnGoal: -30,
  ballControl: 10,
  ricochetBonus: 5,
};

/**
 * Модификаторы весов для разных классов юнитов
 */
export const CLASS_WEIGHT_MODIFIERS: Record<CapClass, Partial<ScoringWeights>> = {
  balanced: {},
  tank: {
    defensePosition: 40,
    goalScored: 70,
    ballNearOpponentGoal: 30,
    enemyPushed: 35,
  },
  sniper: {
    goalScored: 120,
    ballNearOpponentGoal: 70,
    defensePosition: 10,
    ballControl: 5,
  },
  trickster: {
    ricochetBonus: 25,
    ballControl: 20,
    goalScored: 90,
  },
};

/**
 * Модификаторы весов для фракций
 */
export const FACTION_WEIGHT_MODIFIERS: Record<FactionId, Partial<ScoringWeights>> = {
  cyborg: {},
  magma: {
    enemyPushed: 35,
    defensePosition: 30,
    ballControl: 5,
  },
  void: {
    ballControl: 25,
    ricochetBonus: 15,
    enemyPushed: 10,
  },
  insect: {
    goalScored: 110,
    ballNearOpponentGoal: 60,
    defensePosition: 10,
  },
};

/**
 * Ситуационные модификаторы
 */
export interface SituationContext {
  isDefending: boolean;
  isAttacking: boolean;
  scoreDifference: number;
  timeRemaining: number;
  isLastChance: boolean;
}

export const DEFENSE_SITUATION_WEIGHTS: Partial<ScoringWeights> = {
  defensePosition: 50,
  ballNearOwnGoal: -50,
  openedOwnGoal: -50,
  goalScored: 60,
  ballControl: 20,
};

export const ATTACK_SITUATION_WEIGHTS: Partial<ScoringWeights> = {
  goalScored: 120,
  ballNearOpponentGoal: 70,
  defensePosition: 5,
  ballControl: 5,
};

export const RISKY_PLAY_WEIGHTS: Partial<ScoringWeights> = {
  goalScored: 140,
  ballNearOpponentGoal: 80,
  defensePosition: 0,
  openedOwnGoal: -10,
  ballControl: 0,
};

export const SAFE_PLAY_WEIGHTS: Partial<ScoringWeights> = {
  defensePosition: 40,
  ballControl: 30,
  goalScored: 70,
  openedOwnGoal: -50,
  ballNearOwnGoal: -40,
};

/**
 * Главная функция для получения финальных весов
 */
export function getWeights(
  capClass: CapClass,
  factionId: FactionId,
  situation: SituationContext,
  difficulty: AIDifficulty
): ScoringWeights {
  let weights = { ...BASE_WEIGHTS };

  weights = applyModifiers(weights, CLASS_WEIGHT_MODIFIERS[capClass]);
  weights = applyModifiers(weights, FACTION_WEIGHT_MODIFIERS[factionId]);

  if (situation.isDefending) {
    weights = applyModifiers(weights, DEFENSE_SITUATION_WEIGHTS);
  } else if (situation.isAttacking) {
    weights = applyModifiers(weights, ATTACK_SITUATION_WEIGHTS);
  }

  if (difficulty === 'hard') {
    if (situation.scoreDifference < -1) {
      weights = applyModifiers(weights, RISKY_PLAY_WEIGHTS);
    } else if (situation.scoreDifference > 1) {
      weights = applyModifiers(weights, SAFE_PLAY_WEIGHTS);
    }
  }

  if (difficulty === 'easy') {
    weights.defensePosition *= 0.3;
    weights.openedOwnGoal *= 0.5;
  }

  return weights;
}

function applyModifiers(
  weights: ScoringWeights,
  modifiers: Partial<ScoringWeights>
): ScoringWeights {
  const result = { ...weights };
  
  for (const [key, value] of Object.entries(modifiers)) {
    if (value !== undefined) {
      result[key as keyof ScoringWeights] = value;
    }
  }
  
  return result;
}

export function normalizeWeights(weights: ScoringWeights): ScoringWeights {
  const maxAbsWeight = Math.max(...Object.values(weights).map(Math.abs));
  if (maxAbsWeight === 0) return weights;
  
  const normalized: ScoringWeights = {} as ScoringWeights;
  for (const [key, value] of Object.entries(weights)) {
    normalized[key as keyof ScoringWeights] = (value / maxAbsWeight) * 100;
  }
  
  return normalized;
}