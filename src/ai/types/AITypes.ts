// src/ai/types/AITypes.ts
import type { CapClass, FactionId } from '../../constants/gameConstants';
import type { Formation } from '../../data/PlayerData';
import type { AIUnit } from '../scoring/AbilityScorer';

/**
 * Расширенные уровни навыка AI (beginner — опционально для UI/туториала).
 * В матче обычно маппится из {@link AIDifficulty}.
 */
export type AISkillLevel = 'beginner' | 'easy' | 'medium' | 'hard' | 'expert';

export interface OpponentAnalysis {
  faction: FactionId;
  teamSize: number;
  avgAccuracy: number;
  composition: {
    sniper: number;
    balanced: number;
    trickster: number;
    tank: number;
    playmaker: number;
    maestro: number;
    enforcer: number;
  };
  threats: {
    unitId: string;
    capClass: CapClass;
    reason: string;
    priority: number;
  }[];
  weaknesses: {
    type: 'no_defense' | 'no_snipers' | 'low_accuracy' | 'slow_units' | 'bunker_vulnerable';
    severity: number;
    description: string;
  }[];
  likelyStrategy: 'sniper_spam' | 'dribbler_rush' | 'tank_wall' | 'balanced' | 'trickster_chaos';
  detectedSynergies: {
    type: string;
    units: string[];
    strength: number;
  }[];
}

export interface CounterStrategy {
  recommendedFormation: Formation;
  priorityTargets: string[];
  avoidTargets: string[];
  defensiveUnits: string[];
  offensiveUnits: string[];
  abilityPriority: string[];
  playStyle: {
    aggression: number;
    passFrequency: number;
    riskTolerance: number;
    cardUsage: number;
  };
  reasoning: string[];
}

export interface PlayerPattern {
  recentMoves: {
    unitId: string;
    targetX: number;
    targetY: number;
    wasPass: boolean;
    usedAbility: boolean;
    timestamp: number;
  }[];
  detected: {
    favoredSide: 'left' | 'right' | 'center' | 'balanced';
    shotPreference: 'direct' | 'curved' | 'ricochet' | 'pass' | 'mixed';
    abilityUsage: 'aggressive' | 'conservative' | 'tactical';
    positioning: 'offensive' | 'defensive' | 'balanced';
    adaptability: number;
  };
  predictions: {
    nextMoveType: 'goal_shot' | 'pass' | 'defense' | 'positioning';
    likelyTargetArea: { x: number; y: number; radius: number };
    confidence: number;
  };
  stats: {
    avgShotDistance: number;
    passRate: number;
    accuracyRate: number;
    cardUsageRate: number;
  };
}

export interface ComebackState {
  deficit: number;
  desperationLevel: 'none' | 'slight' | 'moderate' | 'high' | 'critical';
  tactics: {
    riskTolerance: number;
    abilityUsageRate: number;
    formationAggression: number;
    targetPriority: 'safe' | 'balanced' | 'risky' | 'desperate';
    allowLongShots: boolean;
    allowRiskyPasses: boolean;
    allowSacrificePlay: boolean;
    useAllAbilities: boolean;
  };
  plan: {
    primary: 'score_quickly' | 'control_ball' | 'disrupt_opponent' | 'all_in_attack';
    fallback: 'defensive' | 'balanced' | 'keep_trying';
  };
}

export interface UnitSynergy {
  units: string[];
  type: 'aura_buff' | 'pass_chain' | 'defensive_wall' | 'combo_ability';
  strength: number;
  condition: {
    maxDistance?: number;
    requiresBall?: boolean;
    requiresPosition?: { x: number; y: number };
  };
  bonuses: {
    accuracy?: number;
    force?: number;
    defense?: number;
  };
}

export interface PassChainPlan {
  initiator: AIUnit;
  receiver: AIUnit;
  finisher?: AIUnit;
  passes: {
    from: string;
    to: string;
    targetX: number;
    targetY: number;
    force: number;
    expectedBallPosition: { x: number; y: number };
  }[];
  finalShot: {
    unitId: string;
    targetX: number;
    targetY: number;
    goalProbability: number;
  };
  totalScore: number;
  riskLevel: number;
  expectedOutcome: 'goal' | 'good_position' | 'neutral' | 'risky';
}

export interface MatchAdaptation {
  triggers: {
    scoreChange: boolean;
    timeThreshold: boolean;
    patternDetected: boolean;
    strategyFailed: boolean;
  };
  actions: {
    changeFormation: boolean;
    switchPlayStyle: boolean;
    adjustCardUsage: boolean;
    focusNewTargets: boolean;
  };
  history: {
    turn: number;
    trigger: string;
    action: string;
    result: 'positive' | 'neutral' | 'negative';
  }[];
}
