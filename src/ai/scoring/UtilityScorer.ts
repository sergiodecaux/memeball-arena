// src/ai/scoring/UtilityScorer.ts
// Функция оценки результатов симуляции

import { 
  SimulationResult, 
  ScoringWeights, 
  GameSnapshot,
  ShotCandidate 
} from '../candidates/CandidateTypes';
import { 
  getWeights, 
  SituationContext,
} from './ScoringWeights';
import { CapClass, FactionId, FIELD, GOAL } from '../../constants/gameConstants';
import { AIDifficulty } from '../../types';

/**
 * Система оценки ударов
 */
export class UtilityScorer {
  private weights: ScoringWeights;
  private aiPlayer: 1 | 2;
  private fieldWidth: number;
  private fieldHeight: number;

  constructor(
    capClass: CapClass,
    factionId: FactionId,
    situation: SituationContext,
    difficulty: AIDifficulty,
    aiPlayer: 1 | 2 = 2,
    fieldWidth: number = FIELD.WIDTH,
    fieldHeight: number = FIELD.HEIGHT
  ) {
    this.weights = getWeights(capClass, factionId, situation, difficulty);
    this.aiPlayer = aiPlayer;
    this.fieldWidth = fieldWidth;
    this.fieldHeight = fieldHeight;
  }

  /**
   * Оценивает результат симуляции
   */
  score(result: SimulationResult, originalSnapshot: GameSnapshot): number {
    let totalScore = 0;

    totalScore += this.scoreGoal(result);
    totalScore += this.scoreBallPosition(result);
    totalScore += this.scoreDefensePosition(result, originalSnapshot);
    totalScore += this.scoreEnemyDisplacement(result, originalSnapshot);
    totalScore += this.scoreRicochet(result);
    totalScore += this.scoreGoalExposure(result, originalSnapshot);

    return Math.max(-100, Math.min(100, totalScore));
  }

  /**
   * Быстрая эвристическая оценка кандидата (без симуляции)
   */
  heuristicScore(candidate: ShotCandidate, snapshot: GameSnapshot): number {
    let score = 0;

    const ball = snapshot.ball;
    const force = candidate.force;
    
    const opponentGoalY = this.aiPlayer === 2 ? 0 : this.fieldHeight;
    
    const toOpponentGoal = {
      x: this.fieldWidth / 2 - ball.x,
      y: opponentGoalY - ball.y,
    };
    const distToOpponentGoal = Math.sqrt(toOpponentGoal.x ** 2 + toOpponentGoal.y ** 2);
    
    if (distToOpponentGoal > 0) {
      toOpponentGoal.x /= distToOpponentGoal;
      toOpponentGoal.y /= distToOpponentGoal;
    }

    const forceDir = {
      x: force.x / (force.magnitude || 1),
      y: force.y / (force.magnitude || 1),
    };

    const dotProduct = forceDir.x * toOpponentGoal.x + forceDir.y * toOpponentGoal.y;
    score += dotProduct * 30;

    const optimalForce = 0.15;
    const forceDiff = Math.abs(force.magnitude - optimalForce);
    score -= forceDiff * 50;

    switch (candidate.type) {
      case 'direct_goal':
        score += 20;
        break;
      case 'ricochet_wall':
        score += 10;
        break;
      case 'block_position':
        score += this.weights.defensePosition * 0.3;
        break;
      case 'push_enemy':
        score += this.weights.enemyPushed * 0.3;
        break;
      case 'pass':
        score += 5;
        break;
    }

    return score;
  }

  private scoreGoal(result: SimulationResult): number {
    if (!result.goalScored) return 0;

    if (this.aiPlayer === 2) {
      return result.goalScored === 'player' 
        ? this.weights.goalScored 
        : this.weights.ownGoal;
    } else {
      return result.goalScored === 'opponent'
        ? this.weights.goalScored
        : this.weights.ownGoal;
    }
  }

  private scoreBallPosition(result: SimulationResult): number {
    let score = 0;

    const opponentGoalDist = this.aiPlayer === 2 
      ? result.ballDistanceToOpponentGoal
      : result.ballDistanceToOwnGoal;
    
    const ownGoalDist = this.aiPlayer === 2
      ? result.ballDistanceToOwnGoal
      : result.ballDistanceToOpponentGoal;

    const maxDist = Math.sqrt(this.fieldWidth ** 2 + this.fieldHeight ** 2);
    const opponentProximity = 1 - (opponentGoalDist / maxDist);
    score += opponentProximity * this.weights.ballNearOpponentGoal;

    const ownProximity = 1 - (ownGoalDist / maxDist);
    score += ownProximity * this.weights.ballNearOwnGoal;

    return score;
  }

  private scoreDefensePosition(
    result: SimulationResult, 
    _originalSnapshot: GameSnapshot
  ): number {
    const defenseCount = result.ownUnitsInDefenseZone;
    
    if (defenseCount === 0) {
      return this.weights.openedOwnGoal * 0.5;
    } else if (defenseCount <= 2) {
      return this.weights.defensePosition * (defenseCount / 2);
    } else {
      return this.weights.defensePosition * 0.5;
    }
  }

  private scoreEnemyDisplacement(
    result: SimulationResult,
    originalSnapshot: GameSnapshot
  ): number {
    const enemyUnits = this.aiPlayer === 2 
      ? originalSnapshot.units.player 
      : originalSnapshot.units.opponent;

    let totalDisplacement = 0;

    for (const unit of enemyUnits) {
      const newPos = result.unitPositions.get(unit.id);
      if (newPos) {
        const dx = newPos.x - unit.x;
        const dy = newPos.y - unit.y;
        totalDisplacement += Math.sqrt(dx ** 2 + dy ** 2);
      }
    }

    const normalizedDisplacement = Math.min(totalDisplacement / 100, 1);
    return normalizedDisplacement * this.weights.enemyPushed;
  }

  private scoreRicochet(result: SimulationResult): number {
    return Math.min(result.wallBounces, 3) * this.weights.ricochetBonus;
  }

  private scoreGoalExposure(
    result: SimulationResult,
    originalSnapshot: GameSnapshot
  ): number {
    const ownUnits = this.aiPlayer === 2
      ? originalSnapshot.units.opponent
      : originalSnapshot.units.player;

    const goalCenterX = this.fieldWidth / 2;
    const goalHalfWidth = GOAL.WIDTH / 2;

    let hasBlocker = false;
    
    for (const unit of ownUnits) {
      const newPos = result.unitPositions.get(unit.id);
      if (!newPos) continue;

      const inGoalZone = 
        newPos.x > goalCenterX - goalHalfWidth - 50 &&
        newPos.x < goalCenterX + goalHalfWidth + 50;
      
      const nearGoal = this.aiPlayer === 2
        ? newPos.y > this.fieldHeight - 150
        : newPos.y < 150;

      if (inGoalZone && nearGoal) {
        hasBlocker = true;
        break;
      }
    }

    return hasBlocker ? 0 : this.weights.openedOwnGoal * 0.3;
  }

  getWeights(): ScoringWeights {
    return { ...this.weights };
  }
}

/**
 * Создаёт контекст ситуации из снимка
 */
export function createSituationContext(
  snapshot: GameSnapshot,
  aiPlayer: 1 | 2,
  timeRemaining: number = 300
): SituationContext {
  const ball = snapshot.ball;
  const field = snapshot.field;
  
  const ownGoalY = aiPlayer === 2 ? field.height : 0;
  const opponentGoalY = aiPlayer === 2 ? 0 : field.height;

  const distToOwnGoal = Math.abs(ball.y - ownGoalY);
  const distToOpponentGoal = Math.abs(ball.y - opponentGoalY);

  const defenseThreshold = field.height * 0.35;
  const attackThreshold = field.height * 0.35;

  const isDefending = distToOwnGoal < defenseThreshold;
  const isAttacking = distToOpponentGoal < attackThreshold;

  const scoreDifference = aiPlayer === 2
    ? snapshot.score.opponent - snapshot.score.player
    : snapshot.score.player - snapshot.score.opponent;

  return {
    isDefending,
    isAttacking,
    scoreDifference,
    timeRemaining,
    isLastChance: timeRemaining < 30 && scoreDifference < 0,
  };
}