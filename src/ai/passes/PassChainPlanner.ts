// src/ai/passes/PassChainPlanner.ts
import Phaser from 'phaser';
import type { AIUnit } from '../scoring/AbilityScorer';
import type { PassChainPlan } from '../types/AITypes';
import type { Ball } from '../../entities/Ball';

export type PassComboType = 'tiki-taka' | 'dribble-snipe' | 'tank-outlet' | 'chaos';

export class PassChainPlanner {
  constructor(
    private readonly fieldBounds: {
      left: number;
      right: number;
      top: number;
      bottom: number;
      width: number;
      height: number;
      centerX: number;
      centerY: number;
    },
  ) {}

  public planBestPassChain(
    units: AIUnit[],
    ball: Ball,
    opponentGoalY: number,
    minScore: number = 50,
  ): PassChainPlan | null {
    if (units.length < 2) return null;

    const ballPos = ball.getPosition();
    const availableUnits = units.filter((u) => !u.isStunned?.() && u.isStopped(0.5));
    if (availableUnits.length < 2) return null;

    const chains: PassChainPlan[] = [];

    for (const initiator of availableUnits) {
      for (const receiver of availableUnits) {
        if (initiator.id === receiver.id) continue;
        const chain = this.create2PassChain(initiator, receiver, ballPos, opponentGoalY);
        if (chain && chain.totalScore >= minScore) chains.push(chain);
      }
    }

    if (availableUnits.length >= 3) {
      for (const initiator of availableUnits) {
        for (const receiver of availableUnits) {
          if (initiator.id === receiver.id) continue;
          for (const finisher of availableUnits) {
            if (finisher.id === initiator.id || finisher.id === receiver.id) continue;
            const chain = this.create3PassChain(
              initiator,
              receiver,
              finisher,
              ballPos,
              opponentGoalY,
            );
            if (chain && chain.totalScore >= minScore) chains.push(chain);
          }
        }
      }
    }

    if (chains.length === 0) return null;
    chains.sort((a, b) => b.totalScore - a.totalScore);
    return chains[0];
  }

  public planSpecialCombo(
    units: AIUnit[],
    ball: Ball,
    opponentGoalY: number,
    comboType: PassComboType,
  ): PassChainPlan | null {
    switch (comboType) {
      case 'tiki-taka':
        return this.planTikiTakaCombo(units, ball, opponentGoalY);
      case 'dribble-snipe':
        return this.planDribbleSniperCombo(units, ball, opponentGoalY);
      case 'tank-outlet':
        return this.planTankOutletCombo(units, ball, opponentGoalY);
      case 'chaos':
        return this.planChaosCombo(units, ball, opponentGoalY);
      default:
        return null;
    }
  }

  public evaluatePassPosition(
    unit: AIUnit,
    ballPos: { x: number; y: number },
    opponentGoalY: number,
  ): number {
    const unitPos = unit.body.position;
    let score = 0;

    const distToGoal = Math.abs(unitPos.y - opponentGoalY);
    const maxDist = this.fieldBounds.height;
    score += (1 - distToGoal / maxDist) * 40;

    const distToBall = Phaser.Math.Distance.Between(unitPos.x, unitPos.y, ballPos.x, ballPos.y);
    if (distToBall < 150) score += 20;
    else if (distToBall < 250) score += 10;

    const angleToGoal = Math.abs(unitPos.x - this.fieldBounds.centerX);
    score += Math.max(0, 20 - angleToGoal / 10);

    if (unit.getCapClass() === 'sniper') score += 15;
    if (unit.getCapClass() === 'playmaker') score += 10;

    return Math.min(100, score);
  }

  private planTikiTakaCombo(units: AIUnit[], ball: Ball, opponentGoalY: number): PassChainPlan | null {
    const maestro = units.find((u) => u.getCapClass() === 'maestro');
    const playmaker = units.find((u) => u.getCapClass() === 'playmaker');
    const sniper = units.find((u) => u.getCapClass() === 'sniper');
    if (!maestro || !playmaker || !sniper) return null;
    return this.create3PassChain(maestro, playmaker, sniper, ball.getPosition(), opponentGoalY);
  }

  private planDribbleSniperCombo(units: AIUnit[], ball: Ball, opponentGoalY: number): PassChainPlan | null {
    const dribbler = units.find(
      (u) => u.getCapClass() === 'playmaker' || u.getCapClass() === 'trickster',
    );
    const sniper = units.find((u) => u.getCapClass() === 'sniper');
    if (!dribbler || !sniper) return null;
    return this.create2PassChain(dribbler, sniper, ball.getPosition(), opponentGoalY);
  }

  private planTankOutletCombo(units: AIUnit[], ball: Ball, opponentGoalY: number): PassChainPlan | null {
    const tank = units.find((u) => u.getCapClass() === 'tank' || u.getCapClass() === 'enforcer');
    const passer = units.find((u) => u.getCapClass() === 'maestro' || u.getCapClass() === 'playmaker');
    if (!tank || !passer) return null;

    const chain = this.create2PassChain(tank, passer, ball.getPosition(), opponentGoalY);
    if (chain) {
      chain.totalScore += 25;
      chain.expectedOutcome = 'good_position';
    }
    return chain;
  }

  private planChaosCombo(units: AIUnit[], ball: Ball, opponentGoalY: number): PassChainPlan | null {
    const tricksters = units.filter((u) => u.getCapClass() === 'trickster');
    if (tricksters.length < 2) return null;

    const chain = this.create2PassChain(tricksters[0], tricksters[1], ball.getPosition(), opponentGoalY);
    if (chain) {
      chain.totalScore += 15;
      chain.riskLevel = Math.min(1, chain.riskLevel * 1.2);
    }
    return chain;
  }

  private create2PassChain(
    initiator: AIUnit,
    receiver: AIUnit,
    ballPos: { x: number; y: number },
    opponentGoalY: number,
  ): PassChainPlan | null {
    const pass1 = this.calculatePassParameters(initiator, receiver, ballPos);
    if (!pass1) return null;

    const goalPos = { x: this.fieldBounds.centerX, y: opponentGoalY };
    const finalShot = this.calculateShotParameters(receiver, goalPos, pass1.expectedBallPosition);
    if (!finalShot) return null;

    const receiverScore = this.evaluatePassPosition(receiver, pass1.expectedBallPosition, opponentGoalY);
    const totalScore = receiverScore * 0.6 + finalShot.goalProbability * 40;
    const riskLevel = this.calculateRiskLevel([pass1]);

    return {
      initiator,
      receiver,
      passes: [pass1],
      finalShot,
      totalScore,
      riskLevel,
      expectedOutcome: this.classifyOutcome(totalScore, riskLevel),
    };
  }

  private create3PassChain(
    initiator: AIUnit,
    receiver: AIUnit,
    finisher: AIUnit,
    ballPos: { x: number; y: number },
    opponentGoalY: number,
  ): PassChainPlan | null {
    const pass1 = this.calculatePassParameters(initiator, receiver, ballPos);
    if (!pass1) return null;

    const pass2 = this.calculatePassParameters(receiver, finisher, pass1.expectedBallPosition);
    if (!pass2) return null;

    const goalPos = { x: this.fieldBounds.centerX, y: opponentGoalY };
    const finalShot = this.calculateShotParameters(finisher, goalPos, pass2.expectedBallPosition);
    if (!finalShot) return null;

    const finisherScore = this.evaluatePassPosition(finisher, pass2.expectedBallPosition, opponentGoalY);
    const totalScore = finisherScore * 0.5 + finalShot.goalProbability * 50;
    const riskLevel = this.calculateRiskLevel([pass1, pass2]);

    return {
      initiator,
      receiver,
      finisher,
      passes: [pass1, pass2],
      finalShot,
      totalScore,
      riskLevel,
      expectedOutcome: this.classifyOutcome(totalScore, riskLevel),
    };
  }

  private calculatePassParameters(
    from: AIUnit,
    to: AIUnit,
    ballPos: { x: number; y: number },
  ): PassChainPlan['passes'][0] | null {
    const fromPos = from.body.position;
    const toPos = to.body.position;

    const distToBall = Phaser.Math.Distance.Between(fromPos.x, fromPos.y, ballPos.x, ballPos.y);
    if (distToBall > 300) return null;

    const distPassLeg = Phaser.Math.Distance.Between(fromPos.x, fromPos.y, toPos.x, toPos.y);
    if (distPassLeg < 50 || distPassLeg > 350) return null;

    const force = Math.min(0.06, distPassLeg * 0.0002);
    const expectedBallPosition = { x: toPos.x, y: toPos.y };

    return {
      from: from.id,
      to: to.id,
      targetX: toPos.x,
      targetY: toPos.y,
      force,
      expectedBallPosition,
    };
  }

  private calculateShotParameters(
    from: AIUnit,
    goalPos: { x: number; y: number },
    ballPos: { x: number; y: number },
  ): PassChainPlan['finalShot'] | null {
    const ballPx = ballPos.x;
    const ballPy = ballPos.y;
    const distToGoal = Phaser.Math.Distance.Between(ballPx, ballPy, goalPos.x, goalPos.y);

    let goalProbability = Math.max(0, 100 - distToGoal / 5);
    if (from.getCapClass() === 'sniper') goalProbability *= 1.2;
    else if (from.getCapClass() === 'tank') goalProbability *= 0.7;
    goalProbability = Math.min(100, goalProbability);

    return {
      unitId: from.id,
      targetX: goalPos.x,
      targetY: goalPos.y,
      goalProbability,
    };
  }

  private calculateRiskLevel(passes: PassChainPlan['passes']): number {
    const baseRisk = passes.length * 0.25;
    let segmentRisk = 0;
    for (const p of passes) {
      const len = Phaser.Math.Distance.Between(
        this.fieldBounds.centerX,
        this.fieldBounds.centerY,
        p.targetX,
        p.targetY,
      );
      segmentRisk += Math.min(0.15, len / 2000);
    }
    return Math.min(1, baseRisk + segmentRisk);
  }

  private classifyOutcome(score: number, risk: number): PassChainPlan['expectedOutcome'] {
    if (score >= 70 && risk < 0.4) return 'goal';
    if (score >= 50 && risk < 0.6) return 'good_position';
    if (risk > 0.7) return 'risky';
    return 'neutral';
  }
}
