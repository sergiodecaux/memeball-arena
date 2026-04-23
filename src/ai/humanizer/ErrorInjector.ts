// src/ai/humanizer/ErrorInjector.ts
// Система "очеловечивания" AI

import { 
  ShotCandidate, 
  ForceVector, 
  GameSnapshot 
} from '../candidates/CandidateTypes';
import { AIDifficulty } from '../../types';

interface ErrorConfig {
  ballPositionError: number;
  forceError: number;
  angleError: number;
  suboptimalChoiceChance: number;
  randomMoveChance: number;
  ricochetError: number;
  panicDefenseChance: number;
}

const ERROR_CONFIGS: Record<AIDifficulty, ErrorConfig> = {
  easy: {
    ballPositionError: 25,
    forceError: 0.25,
    angleError: 0.3,
    suboptimalChoiceChance: 0.4,
    randomMoveChance: 0.1,
    ricochetError: 0.5,
    panicDefenseChance: 0.5,
  },
  medium: {
    ballPositionError: 12,
    forceError: 0.12,
    angleError: 0.15,
    suboptimalChoiceChance: 0.15,
    randomMoveChance: 0.02,
    ricochetError: 0.25,
    panicDefenseChance: 0.2,
  },
  hard: {
    ballPositionError: 3,
    forceError: 0.03,
    angleError: 0.03,
    suboptimalChoiceChance: 0.03,
    randomMoveChance: 0,
    ricochetError: 0.05,
    panicDefenseChance: 0.05,
  },
  impossible: {
    ballPositionError: 1,
    forceError: 0.01,
    angleError: 0.01,
    suboptimalChoiceChance: 0,
    randomMoveChance: 0,
    ricochetError: 0.01,
    panicDefenseChance: 0,
  },
};

export class ErrorInjector {
  private config: ErrorConfig;
  private difficulty: AIDifficulty;

  constructor(difficulty: AIDifficulty) {
    this.difficulty = difficulty;
    this.config = { ...ERROR_CONFIGS[difficulty] };
  }

  distortSnapshot(snapshot: GameSnapshot): GameSnapshot {
    const distorted = JSON.parse(JSON.stringify(snapshot)) as GameSnapshot;
    
    distorted.ball.x += this.randomError(this.config.ballPositionError);
    distorted.ball.y += this.randomError(this.config.ballPositionError);
    
    for (const unit of distorted.units.player) {
      unit.x += this.randomError(this.config.ballPositionError * 0.5);
      unit.y += this.randomError(this.config.ballPositionError * 0.5);
    }

    return distorted;
  }

  distortForce(force: ForceVector): ForceVector {
    const forceError = 1 + this.randomError(this.config.forceError);
    const angleError = this.randomError(this.config.angleError);

    const newAngle = force.angle + angleError;
    const newMagnitude = force.magnitude * forceError;

    return {
      x: Math.cos(newAngle) * newMagnitude,
      y: Math.sin(newAngle) * newMagnitude,
      magnitude: newMagnitude,
      angle: newAngle,
    };
  }

  maybeChooseSuboptimal(
    candidates: ShotCandidate[],
    bestIndex: number
  ): number {
    if (candidates.length <= 1) return bestIndex;

    if (Math.random() < this.config.suboptimalChoiceChance) {
      const topCount = Math.min(3, candidates.length);
      return Math.floor(Math.random() * topCount);
    }

    if (Math.random() < this.config.randomMoveChance) {
      return Math.floor(Math.random() * candidates.length);
    }

    return bestIndex;
  }

  shouldPanicInDefense(): boolean {
    return Math.random() < this.config.panicDefenseChance;
  }

  distortRicochetPoint(point: { x: number; y: number }): { x: number; y: number } {
    const error = this.config.ricochetError * 50;
    return {
      x: point.x + this.randomError(error),
      y: point.y + this.randomError(error),
    };
  }

  getThinkingDelay(): number {
    const base = this.difficulty === 'easy' ? 1500 
               : this.difficulty === 'medium' ? 800 
               : 400;
    
    return base + Math.random() * base * 0.5;
  }

  private randomError(max: number): number {
    return (Math.random() - 0.5) * 2 * max;
  }

  getConfig(): ErrorConfig {
    return { ...this.config };
  }

  setDifficulty(difficulty: AIDifficulty): void {
    this.difficulty = difficulty;
    this.config = { ...ERROR_CONFIGS[difficulty] };
  }

  createAdaptiveConfig(
    scoreDifference: number,
    isAIWinning: boolean
  ): void {
    if (isAIWinning && scoreDifference >= 2) {
      this.config = {
        ...this.config,
        forceError: this.config.forceError * 1.5,
        angleError: this.config.angleError * 1.5,
        suboptimalChoiceChance: Math.min(0.5, this.config.suboptimalChoiceChance * 2),
      };
    }
    
    if (!isAIWinning && scoreDifference <= -2) {
      this.config = {
        ...this.config,
        panicDefenseChance: this.config.panicDefenseChance * 0.5,
        forceError: this.config.forceError * 0.8,
      };
    }
  }
}

export class AdaptiveDifficultyDirector {
  private baseDifficulty: AIDifficulty;
  private currentInjector: ErrorInjector;
  private matchHistory: Array<{ scorer: 'player' | 'ai'; timestamp: number }> = [];

  constructor(baseDifficulty: AIDifficulty) {
    this.baseDifficulty = baseDifficulty;
    this.currentInjector = new ErrorInjector(baseDifficulty);
  }

  recordGoal(scorer: 'player' | 'ai'): void {
    this.matchHistory.push({ scorer, timestamp: Date.now() });
    this.recalculateDifficulty();
  }

  private recalculateDifficulty(): void {
    const playerGoals = this.matchHistory.filter(g => g.scorer === 'player').length;
    const aiGoals = this.matchHistory.filter(g => g.scorer === 'ai').length;
    const diff = aiGoals - playerGoals;

    this.currentInjector.createAdaptiveConfig(diff, diff > 0);
  }

  getErrorInjector(): ErrorInjector {
    return this.currentInjector;
  }

  reset(): void {
    this.matchHistory = [];
    this.currentInjector = new ErrorInjector(this.baseDifficulty);
  }
}