// src/ai/roles/RoleBasedScoring.ts — модификаторы очков и вспомогательные ходы по ролям

import Phaser from 'phaser';
import type { AIUnit } from '../scoring/AbilityScorer';
import { RoleManager, type FieldBoundsLike, type UnitRole } from './UnitRoles';

export type RoleMoveType = 'goal' | 'pass' | 'defend' | 'disrupt' | 'position';

export interface RoleScoreContext {
  ballPosition: { x: number; y: number };
  opponentGoalY: number;
  ownGoalY: number;
  fieldHeight: number;
  opponentUnits: AIUnit[];
  /** Разрешить вратарю атаковать (камбэк / серия пропущенных). */
  allowGoalkeeperAttack?: boolean;
}

export class RoleBasedScoring {
  public static modifyScoreByRole(
    baseScore: number,
    moveType: RoleMoveType,
    unit: AIUnit,
    role: UnitRole,
    context: RoleScoreContext,
  ): number {
    const behavior = RoleManager.getRoleBehavior(role);
    let modifier = 1.0;

    switch (moveType) {
      case 'goal': {
        modifier = behavior.priorities.attackGoal;
        if (role === 'finisher') {
          const distToGoal = Math.abs(context.ballPosition.y - context.opponentGoalY);
          if (distToGoal > 280) modifier *= 1.45;
        }
        if (role === 'opportunist') {
          const openGoalBonus = this.evaluateOpenGoal(
            context.ballPosition,
            context.opponentGoalY,
            context.opponentUnits,
          );
          modifier *= 1 + openGoalBonus * 0.75;
        }
        if (role === 'goalkeeper') {
          const desperate = context.allowGoalkeeperAttack === true;
          modifier *= desperate ? Math.max(0.42, behavior.priorities.attackGoal * 4.2) : 0.12;
        }
        break;
      }
      case 'defend': {
        modifier = behavior.priorities.defendGoal;
        if (role === 'goalkeeper') modifier *= 2.1;
        else if (role === 'defender') modifier *= 1.55;
        if (role === 'opportunist') modifier *= 0.35;
        if (role === 'finisher') modifier *= 0.55;
        break;
      }
      case 'pass': {
        modifier = 0.42 + 0.58 * behavior.priorities.createChances;
        if (role === 'playmaker') modifier *= 1.65;
        if (role === 'finisher') modifier *= 0.62;
        if (role === 'goalkeeper') modifier *= 0.55;
        break;
      }
      case 'disrupt': {
        modifier = behavior.priorities.disruptOpponent;
        if (role === 'disruptor') modifier *= 2.05;
        break;
      }
      default:
        modifier = 1.0;
    }

    return baseScore * modifier;
  }

  public static evaluateOpenGoal(
    ballPosition: { x: number; y: number },
    goalY: number,
    opponentUnits: AIUnit[],
  ): number {
    let openness = 1.0;
    for (const unit of opponentUnits) {
      const p = unit.body.position;
      const distToGoal = Math.abs(p.y - goalY);
      if (distToGoal < 95) openness -= 0.38;
      else if (distToGoal < 195) openness -= 0.2;
      if (this.isOnShotLine(p, ballPosition, { x: ballPosition.x, y: goalY })) {
        openness -= 0.28;
      }
    }
    return Math.max(0, Math.min(1, openness));
  }

  private static isOnShotLine(
    point: { x: number; y: number },
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): boolean {
    const lineLen = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    if (lineLen < 8) return false;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const t = ((point.x - from.x) * dx + (point.y - from.y) * dy) / (lineLen * lineLen);
    if (t < 0 || t > 1) return false;
    const projX = from.x + t * dx;
    const projY = from.y + t * dy;
    const perpDist = Phaser.Math.Distance.Between(point.x, point.y, projX, projY);
    return perpDist < 42;
  }

  public static findMostDangerousOpponent(
    opponents: AIUnit[],
    ball: { x: number; y: number },
    ownGoalY: number,
  ): AIUnit | null {
    let best: AIUnit | null = null;
    let maxDanger = 0;

    for (const opp of opponents) {
      const pos = opp.body.position;
      const distToBall = Phaser.Math.Distance.Between(pos.x, pos.y, ball.x, ball.y);
      const distToGoal = Math.abs(pos.y - ownGoalY);

      let danger = 0;
      danger += (Math.max(0, 220 - distToBall) / 220) * 52;
      danger += (Math.max(0, 420 - distToGoal) / 420) * 34;

      const capClass = opp.getCapClass();
      if (capClass === 'sniper') danger += 22;
      if (capClass === 'trickster') danger += 16;
      if (capClass === 'playmaker' || capClass === 'maestro') danger += 14;

      if (danger > maxDanger) {
        maxDanger = danger;
        best = opp;
      }
    }
    return best;
  }

  public static generateRoleSpecificMoves(
    unit: AIUnit,
    role: UnitRole,
    context: {
      ball: { x: number; y: number };
      opponentUnits: AIUnit[];
      opponentGoalY: number;
      ownGoalY: number;
      fieldBounds: FieldBoundsLike;
    },
  ): Array<{
    type: RoleMoveType;
    target: { x: number; y: number };
    description: string;
    priority: number;
  }> {
    const moves: Array<{
      type: RoleMoveType;
      target: { x: number; y: number };
      description: string;
      priority: number;
    }> = [];

    switch (role) {
      case 'goalkeeper':
        moves.push({
          type: 'defend',
          target: { x: context.fieldBounds.centerX, y: context.ownGoalY },
          description: 'GOALKEEPER: protect goal',
          priority: 28,
        });
        break;

      case 'disruptor': {
        const threat = this.findMostDangerousOpponent(
          context.opponentUnits,
          context.ball,
          context.ownGoalY,
        );
        if (threat) {
          const tp = threat.body.position;
          moves.push({
            type: 'disrupt',
            target: { x: tp.x, y: tp.y },
            description: `DISRUPTOR: threat ${threat.getCapClass()}`,
            priority: 36,
          });
        }
        break;
      }

      case 'opportunist': {
        const openness = this.evaluateOpenGoal(context.ball, context.opponentGoalY, context.opponentUnits);
        if (openness > 0.55) {
          moves.push({
            type: 'goal',
            target: { x: context.fieldBounds.centerX, y: context.opponentGoalY },
            description: `OPPORTUNIST: open goal (${(openness * 100).toFixed(0)}%)`,
            priority: 22 + openness * 28,
          });
        }
        break;
      }

      case 'finisher': {
        const distToGoal = Math.abs(context.ball.y - context.opponentGoalY);
        if (distToGoal > 240) {
          moves.push({
            type: 'goal',
            target: { x: context.fieldBounds.centerX, y: context.opponentGoalY },
            description: `FINISHER: long-range (${distToGoal.toFixed(0)}px)`,
            priority: 18 + Math.min(24, (distToGoal - 240) / 25),
          });
        }
        break;
      }

      default:
        break;
    }

    return moves;
  }
}
