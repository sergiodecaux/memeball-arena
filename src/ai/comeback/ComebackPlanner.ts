// src/ai/comeback/ComebackPlanner.ts
import type { ComebackState, AISkillLevel } from '../types/AITypes';
import type { Formation } from '../../data/PlayerData';
import { getAIFormationsForTeamSize } from '../AIFormations';

export class ComebackPlanner {
  public static createComebackPlan(
    aiScore: number,
    playerScore: number,
    turnsRemaining: number,
    _teamSize: number,
    skillLevel: AISkillLevel,
  ): ComebackState {
    const deficit = aiScore - playerScore;
    const desperationLevel = this.calculateDesperationLevel(deficit, turnsRemaining, skillLevel);
    const tactics = this.determineTactics(desperationLevel, skillLevel);
    const plan = this.createActionPlan(desperationLevel);

    return {
      deficit,
      desperationLevel,
      tactics,
      plan,
    };
  }

  public static getComebackFormation(comeback: ComebackState, teamSize: number): Formation {
    const formations = getAIFormationsForTeamSize(teamSize);
    switch (comeback.desperationLevel) {
      case 'critical':
      case 'high':
        return formations.aggressive ?? formations.balanced;
      case 'moderate':
        return formations.counter ?? formations.balanced;
      default:
        return formations.balanced;
    }
  }

  public static shouldUseCardForComeback(comeback: ComebackState): boolean {
    if (comeback.tactics.useAllAbilities) return true;
    switch (comeback.desperationLevel) {
      case 'critical':
        return Math.random() < 0.95;
      case 'high':
        return Math.random() < 0.75;
      case 'moderate':
        return Math.random() < 0.55;
      default:
        return false;
    }
  }

  private static calculateDesperationLevel(
    deficit: number,
    turnsRemaining: number,
    _skillLevel: AISkillLevel,
  ): ComebackState['desperationLevel'] {
    if (deficit >= 0) return 'none';

    const absDeficit = Math.abs(deficit);

    if (absDeficit >= 3 || (absDeficit >= 2 && turnsRemaining <= 3)) return 'critical';
    if (absDeficit >= 2 || (absDeficit >= 1 && turnsRemaining <= 2)) return 'high';
    if (absDeficit >= 1) return 'moderate';
    return 'slight';
  }

  private static determineTactics(
    desperationLevel: ComebackState['desperationLevel'],
    skillLevel: AISkillLevel,
  ): ComebackState['tactics'] {
    const base = {
      riskTolerance: 0.5,
      abilityUsageRate: 0.5,
      formationAggression: 0.5,
      targetPriority: 'balanced' as const,
      allowLongShots: false,
      allowRiskyPasses: false,
      allowSacrificePlay: false,
      useAllAbilities: false,
    };

    switch (desperationLevel) {
      case 'critical':
        return {
          riskTolerance: 0.95,
          abilityUsageRate: 1.0,
          formationAggression: 1.0,
          targetPriority: 'desperate',
          allowLongShots: true,
          allowRiskyPasses: true,
          allowSacrificePlay: true,
          useAllAbilities: true,
        };
      case 'high':
        return {
          riskTolerance: 0.8,
          abilityUsageRate: 0.85,
          formationAggression: 0.85,
          targetPriority: 'risky',
          allowLongShots: true,
          allowRiskyPasses: true,
          allowSacrificePlay: skillLevel === 'expert' || skillLevel === 'hard',
          useAllAbilities: false,
        };
      case 'moderate':
        return {
          riskTolerance: 0.65,
          abilityUsageRate: 0.7,
          formationAggression: 0.7,
          targetPriority: 'risky',
          allowLongShots: skillLevel !== 'beginner' && skillLevel !== 'easy',
          allowRiskyPasses: skillLevel === 'expert' || skillLevel === 'hard',
          allowSacrificePlay: false,
          useAllAbilities: false,
        };
      case 'slight':
        return {
          riskTolerance: 0.6,
          abilityUsageRate: 0.6,
          formationAggression: 0.6,
          targetPriority: 'balanced',
          allowLongShots: false,
          allowRiskyPasses: false,
          allowSacrificePlay: false,
          useAllAbilities: false,
        };
      default:
        return base;
    }
  }

  private static createActionPlan(desperationLevel: ComebackState['desperationLevel']): ComebackState['plan'] {
    switch (desperationLevel) {
      case 'critical':
        return { primary: 'all_in_attack', fallback: 'keep_trying' };
      case 'high':
        return { primary: 'score_quickly', fallback: 'keep_trying' };
      case 'moderate':
        return { primary: 'score_quickly', fallback: 'balanced' };
      case 'slight':
        return { primary: 'control_ball', fallback: 'balanced' };
      default:
        return { primary: 'control_ball', fallback: 'defensive' };
    }
  }
}
