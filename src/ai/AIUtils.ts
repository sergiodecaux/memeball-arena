// src/ai/AIUtils.ts

import { Cap } from '../entities/Cap';
import { Unit } from '../entities/Unit';
import { Ball } from '../entities/Ball';
import { FieldBounds } from '../types';
import { GOAL } from '../constants/gameConstants';

type GameUnit = Cap | Unit;

export class AIUtils {
  static getBallPosition(ball: Ball): { x: number; y: number } {
    return {
      x: ball.body.position.x,
      y: ball.body.position.y,
    };
  }

  static getCapPosition(cap: GameUnit): { x: number; y: number } {
    return {
      x: cap.body.position.x,
      y: cap.body.position.y,
    };
  }

  static distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  static angleTo(from: { x: number; y: number }, to: { x: number; y: number }): number {
    return Math.atan2(to.y - from.y, to.x - from.x);
  }

  static getEnemyGoalCenter(fieldBounds: FieldBounds, isPlayer2: boolean): { x: number; y: number } {
    return {
      x: fieldBounds.centerX,
      y: isPlayer2 ? fieldBounds.bottom + GOAL.DEPTH / 2 : fieldBounds.top - GOAL.DEPTH / 2,
    };
  }

  static getOwnGoalCenter(fieldBounds: FieldBounds, isPlayer2: boolean): { x: number; y: number } {
    return {
      x: fieldBounds.centerX,
      y: isPlayer2 ? fieldBounds.top - GOAL.DEPTH / 2 : fieldBounds.bottom + GOAL.DEPTH / 2,
    };
  }

  static evaluateDangerLevel(ball: Ball, fieldBounds: FieldBounds, isPlayer2: boolean): number {
    const ballPos = this.getBallPosition(ball);
    const ownGoal = this.getOwnGoalCenter(fieldBounds, isPlayer2);
    const distToOwnGoal = this.distance(ballPos, ownGoal);
    const maxDist = fieldBounds.height;
    return 1 - Math.min(distToOwnGoal / maxDist, 1);
  }

  static evaluateAttackOpportunity(ball: Ball, fieldBounds: FieldBounds, isPlayer2: boolean): number {
    const ballPos = this.getBallPosition(ball);
    const enemyGoal = this.getEnemyGoalCenter(fieldBounds, isPlayer2);
    const distToEnemyGoal = this.distance(ballPos, enemyGoal);
    const maxDist = fieldBounds.height;
    return 1 - Math.min(distToEnemyGoal / maxDist, 1);
  }

  static calculateHitPoint(
    ballPos: { x: number; y: number },
    targetPos: { x: number; y: number },
    ballRadius: number,
    capRadius: number
  ): { x: number; y: number } {
    const angle = this.angleTo(targetPos, ballPos);
    const offset = ballRadius + capRadius + 2;
    return {
      x: ballPos.x + Math.cos(angle) * offset,
      y: ballPos.y + Math.sin(angle) * offset,
    };
  }

  static addAngleError(angle: number, maxError: number): number {
    return angle + (Math.random() - 0.5) * 2 * maxError;
  }

  static addForceError(force: number, maxErrorPercent: number): number {
    const error = 1 + (Math.random() - 0.5) * 2 * maxErrorPercent;
    return force * error;
  }
}