// src/ai/candidates/CandidateGenerator.ts
// Генератор кандидатов на удар

import Phaser from 'phaser';
import { 
  ShotCandidate, 
  CandidateType, 
  ForceVector,
  GameSnapshot,
  UnitSnapshot,
  CandidateGenerationContext
} from './CandidateTypes';
import { CapClass, FIELD, GOAL, CAP_CLASSES } from '../../constants/gameConstants';

/**
 * Генератор кандидатов на удар для AI
 */
export class CandidateGenerator {
  private context: CandidateGenerationContext;
  private candidateIdCounter = 0;

  constructor(context: CandidateGenerationContext) {
    this.context = context;
  }

  /**
   * Генерирует все возможные кандидаты на удар
   */
  generate(): ShotCandidate[] {
    const candidates: ShotCandidate[] = [];
    const { snapshot, aiPlayer } = this.context;

    const aiUnits = aiPlayer === 2 
      ? snapshot.units.opponent 
      : snapshot.units.player;

    const availableUnits = aiUnits.filter(u => 
      Math.sqrt(u.vx ** 2 + u.vy ** 2) < 0.5
    );

    if (availableUnits.length === 0) {
      return [];
    }

    for (const unit of availableUnits) {
      candidates.push(...this.generateDirectGoalShots(unit));

      if (this.context.includeRicochet) {
        candidates.push(...this.generateRicochetShots(unit));
      }

      if (this.context.isDefending || unit.capClass === 'tank') {
        candidates.push(...this.generateBlockingShots(unit));
      }

      candidates.push(...this.generatePushShots(unit));

      if (this.context.includePass && availableUnits.length > 1) {
        candidates.push(...this.generatePassShots(unit, availableUnits));
      }

      candidates.push(...this.generateBallControlShots(unit));
    }

    candidates.sort((a, b) => b.heuristicScore - a.heuristicScore);
    return candidates.slice(0, this.context.maxCandidates);
  }

  private generateDirectGoalShots(unit: UnitSnapshot): ShotCandidate[] {
    const candidates: ShotCandidate[] = [];
    const { snapshot, aiPlayer } = this.context;
    const ball = snapshot.ball;
    const field = snapshot.field;

    const goalY = aiPlayer === 2 ? 0 : field.height;
    const goalCenterX = field.width / 2;

    const goalTargets = [
      { x: goalCenterX, y: goalY },
      { x: goalCenterX - GOAL.WIDTH * 0.35, y: goalY },
      { x: goalCenterX + GOAL.WIDTH * 0.35, y: goalY },
    ];

    for (const target of goalTargets) {
      const toBall = {
        x: ball.x - unit.x,
        y: ball.y - unit.y,
      };
      const distToBall = Math.sqrt(toBall.x ** 2 + toBall.y ** 2);

      if (distToBall === 0) continue;

      const toGoal = {
        x: target.x - ball.x,
        y: target.y - ball.y,
      };
      const distToGoal = Math.sqrt(toGoal.x ** 2 + toGoal.y ** 2);

      const direction = {
        x: toBall.x / distToBall,
        y: toBall.y / distToBall,
      };

      const classStats = CAP_CLASSES[unit.capClass];
      const optimalForce = Math.min(
        distToBall * classStats.forceMultiplier * 1.5,
        classStats.maxForce
      );

      let heuristicScore = 50;
      
      const alignment = this.calculateAlignment(unit, ball, target);
      heuristicScore += alignment * 30;
      heuristicScore += Math.max(0, 30 - distToBall * 0.1);

      if (unit.capClass === 'sniper' && distToGoal > 400) {
        heuristicScore += 15;
      }

      candidates.push({
        id: this.nextId(),
        type: 'direct_goal',
        unitId: unit.id,
        force: this.createForce(direction.x * optimalForce, direction.y * optimalForce),
        targetPosition: target,
        expectedBallPosition: target,
        heuristicScore,
      });
    }

    return candidates;
  }

  private generateRicochetShots(unit: UnitSnapshot): ShotCandidate[] {
    const candidates: ShotCandidate[] = [];
    const { snapshot, aiPlayer } = this.context;
    const ball = snapshot.ball;
    const field = snapshot.field;

    const goalY = aiPlayer === 2 ? 0 : field.height;
    const goalCenterX = field.width / 2;

    const ricochetPoints = [
      { x: 20, y: (ball.y + goalY) / 2 },
      { x: field.width - 20, y: (ball.y + goalY) / 2 },
    ];

    for (const ricochet of ricochetPoints) {
      const toRicochet = {
        x: ricochet.x - unit.x,
        y: ricochet.y - unit.y,
      };
      const dist = Math.sqrt(toRicochet.x ** 2 + toRicochet.y ** 2);

      if (dist === 0) continue;

      const direction = {
        x: toRicochet.x / dist,
        y: toRicochet.y / dist,
      };

      const classStats = CAP_CLASSES[unit.capClass];
      const force = Math.min(dist * classStats.forceMultiplier * 1.3, classStats.maxForce);

      let heuristicScore = 25;

      if (unit.capClass === 'trickster') {
        heuristicScore += 25;
      }

      const directDist = Math.sqrt(
        (goalCenterX - ball.x) ** 2 + (goalY - ball.y) ** 2
      );
      if (directDist < dist * 1.5) {
        heuristicScore -= 15;
      }

      candidates.push({
        id: this.nextId(),
        type: 'ricochet_wall',
        unitId: unit.id,
        force: this.createForce(direction.x * force, direction.y * force),
        ricochetPoints: [ricochet],
        heuristicScore,
      });
    }

    return candidates;
  }

  private generateBlockingShots(unit: UnitSnapshot): ShotCandidate[] {
    const candidates: ShotCandidate[] = [];
    const { snapshot, aiPlayer } = this.context;
    const ball = snapshot.ball;
    const field = snapshot.field;

    const ownGoalY = aiPlayer === 2 ? field.height : 0;
    const goalCenterX = field.width / 2;

    const blockY = (ball.y + ownGoalY) / 2;
    const blockX = Phaser.Math.Clamp(ball.x, goalCenterX - GOAL.WIDTH, goalCenterX + GOAL.WIDTH);

    const toBlock = {
      x: blockX - unit.x,
      y: blockY - unit.y,
    };
    const dist = Math.sqrt(toBlock.x ** 2 + toBlock.y ** 2);

    if (dist < 20) {
      return [];
    }

    const direction = {
      x: toBlock.x / dist,
      y: toBlock.y / dist,
    };

    const classStats = CAP_CLASSES[unit.capClass];
    const force = Math.min(dist * classStats.forceMultiplier, classStats.maxForce * 0.7);

    let heuristicScore = 30;

    if (unit.capClass === 'tank') {
      heuristicScore += 35;
    }

    const ballToGoal = Math.abs(ball.y - ownGoalY);
    if (ballToGoal < 200) {
      heuristicScore += 25;
    }

    candidates.push({
      id: this.nextId(),
      type: 'block_position',
      unitId: unit.id,
      force: this.createForce(direction.x * force, direction.y * force),
      targetPosition: { x: blockX, y: blockY },
      heuristicScore,
    });

    return candidates;
  }

  private generatePushShots(unit: UnitSnapshot): ShotCandidate[] {
    const candidates: ShotCandidate[] = [];
    const { snapshot, aiPlayer } = this.context;

    const enemyUnits = aiPlayer === 2
      ? snapshot.units.player
      : snapshot.units.opponent;

    for (const enemy of enemyUnits) {
      const toEnemy = {
        x: enemy.x - unit.x,
        y: enemy.y - unit.y,
      };
      const dist = Math.sqrt(toEnemy.x ** 2 + toEnemy.y ** 2);

      if (dist > 300 || dist === 0) continue;

      const direction = {
        x: toEnemy.x / dist,
        y: toEnemy.y / dist,
      };

      const classStats = CAP_CLASSES[unit.capClass];
      const force = classStats.maxForce * 0.9;

      let heuristicScore = 15;

      if (unit.capClass === 'tank') {
        heuristicScore += 20;
      }

      const ball = snapshot.ball;
      const enemyToBall = Math.sqrt(
        (enemy.x - ball.x) ** 2 + (enemy.y - ball.y) ** 2
      );
      if (enemyToBall < 100) {
        heuristicScore += 25;
      }

      candidates.push({
        id: this.nextId(),
        type: 'push_enemy',
        unitId: unit.id,
        force: this.createForce(direction.x * force, direction.y * force),
        targetPosition: { x: enemy.x, y: enemy.y },
        heuristicScore,
      });
    }

    return candidates;
  }

  private generatePassShots(unit: UnitSnapshot, teammates: UnitSnapshot[]): ShotCandidate[] {
    const candidates: ShotCandidate[] = [];

    for (const teammate of teammates) {
      if (teammate.id === unit.id) continue;

      const toTeammate = {
        x: teammate.x - unit.x,
        y: teammate.y - unit.y,
      };
      const dist = Math.sqrt(toTeammate.x ** 2 + toTeammate.y ** 2);

      if (dist === 0) continue;

      const direction = {
        x: toTeammate.x / dist,
        y: toTeammate.y / dist,
      };

      const classStats = CAP_CLASSES[unit.capClass];
      const force = Math.min(dist * classStats.forceMultiplier * 0.8, classStats.maxForce * 0.6);

      let heuristicScore = 10;

      if (teammate.capClass === 'sniper') {
        heuristicScore += 15;
      }

      candidates.push({
        id: this.nextId(),
        type: 'pass',
        unitId: unit.id,
        force: this.createForce(direction.x * force, direction.y * force),
        targetPosition: { x: teammate.x, y: teammate.y },
        heuristicScore,
      });
    }

    return candidates;
  }

  private generateBallControlShots(unit: UnitSnapshot): ShotCandidate[] {
    const candidates: ShotCandidate[] = [];
    const { snapshot } = this.context;
    const ball = snapshot.ball;

    const toBall = {
      x: ball.x - unit.x,
      y: ball.y - unit.y,
    };
    const dist = Math.sqrt(toBall.x ** 2 + toBall.y ** 2);

    if (dist === 0) return candidates;

    const direction = {
      x: toBall.x / dist,
      y: toBall.y / dist,
    };

    const classStats = CAP_CLASSES[unit.capClass];
    const force = classStats.maxForce * 0.4;

    let heuristicScore = 5;

    if (unit.capClass === 'trickster') {
      heuristicScore += 10;
    }

    candidates.push({
      id: this.nextId(),
      type: 'ball_control',
      unitId: unit.id,
      force: this.createForce(direction.x * force, direction.y * force),
      targetPosition: { x: ball.x, y: ball.y },
      heuristicScore,
    });

    return candidates;
  }

  private nextId(): string {
    return `candidate_${++this.candidateIdCounter}`;
  }

  private createForce(x: number, y: number): ForceVector {
    const magnitude = Math.sqrt(x ** 2 + y ** 2);
    const angle = Math.atan2(y, x);
    return { x, y, magnitude, angle };
  }

  private calculateAlignment(
    unit: UnitSnapshot,
    ball: { x: number; y: number },
    target: { x: number; y: number }
  ): number {
    const v1 = { x: ball.x - unit.x, y: ball.y - unit.y };
    const len1 = Math.sqrt(v1.x ** 2 + v1.y ** 2);
    
    const v2 = { x: target.x - ball.x, y: target.y - ball.y };
    const len2 = Math.sqrt(v2.x ** 2 + v2.y ** 2);

    if (len1 === 0 || len2 === 0) return 0;

    v1.x /= len1; v1.y /= len1;
    v2.x /= len2; v2.y /= len2;

    const dot = v1.x * v2.x + v1.y * v2.y;
    return Math.max(0, dot);
  }
}