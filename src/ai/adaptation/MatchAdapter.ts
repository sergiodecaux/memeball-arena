// src/ai/adaptation/MatchAdapter.ts
import type { MatchAdaptation, AISkillLevel, PlayerPattern } from '../types/AITypes';
import type { Formation } from '../../data/PlayerData';
import { getAIFormationsForTeamSize } from '../AIFormations';

export class MatchAdapter {
  private adaptationHistory: MatchAdaptation['history'] = [];
  private currentTurn: number = 0;

  public updateTurn(turn: number): void {
    this.currentTurn = turn;
  }

  public shouldAdapt(
    aiScore: number,
    playerScore: number,
    playerPattern: PlayerPattern,
    turnsRemaining: number,
    skillLevel: AISkillLevel,
  ): MatchAdaptation {
    const triggers = this.checkTriggers(aiScore, playerScore, playerPattern, turnsRemaining);
    const actions = this.determineActions(triggers, skillLevel);

    return {
      triggers,
      actions,
      history: [...this.adaptationHistory],
    };
  }

  public recordAdaptation(trigger: string, action: string, result: 'positive' | 'neutral' | 'negative'): void {
    this.adaptationHistory.push({
      turn: this.currentTurn,
      trigger,
      action,
      result,
    });
    if (this.adaptationHistory.length > 10) {
      this.adaptationHistory.shift();
    }
  }

  public getAdaptiveFormation(
    currentFormation: Formation,
    adaptation: MatchAdaptation,
    teamSize: number,
    aiScore: number,
    playerScore: number,
  ): Formation {
    if (!adaptation.actions.changeFormation) return currentFormation;

    const formations = getAIFormationsForTeamSize(teamSize);
    const deficit = aiScore - playerScore;

    if (deficit <= -2) return formations.aggressive ?? formations.balanced;
    if (deficit >= 2) return formations.defensive ?? formations.balanced;
    if (adaptation.triggers.patternDetected) return formations.counter ?? formations.balanced;

    return formations.balanced;
  }

  public reset(): void {
    this.adaptationHistory = [];
    this.currentTurn = 0;
  }

  private checkTriggers(
    aiScore: number,
    playerScore: number,
    playerPattern: PlayerPattern,
    turnsRemaining: number,
  ): MatchAdaptation['triggers'] {
    const scoreDiff = aiScore - playerScore;
    const scoreChange = Math.abs(scoreDiff) >= 2;
    const timeThreshold = turnsRemaining <= 5;
    const patternDetected = playerPattern.predictions.confidence > 0.7;
    const strategyFailed = scoreDiff <= -1 && this.currentTurn > 5;

    return {
      scoreChange,
      timeThreshold,
      patternDetected,
      strategyFailed,
    };
  }

  private determineActions(
    triggers: MatchAdaptation['triggers'],
    skillLevel: AISkillLevel,
  ): MatchAdaptation['actions'] {
    if (skillLevel === 'beginner') {
      return {
        changeFormation: false,
        switchPlayStyle: false,
        adjustCardUsage: false,
        focusNewTargets: false,
      };
    }

    if (skillLevel === 'easy') {
      return {
        changeFormation: triggers.scoreChange && Math.random() < 0.3,
        switchPlayStyle: false,
        adjustCardUsage: triggers.timeThreshold && Math.random() < 0.4,
        focusNewTargets: false,
      };
    }

    if (skillLevel === 'medium') {
      return {
        changeFormation: triggers.scoreChange || (triggers.strategyFailed && Math.random() < 0.5),
        switchPlayStyle: triggers.timeThreshold,
        adjustCardUsage: triggers.scoreChange || triggers.timeThreshold,
        focusNewTargets: triggers.patternDetected && Math.random() < 0.6,
      };
    }

    return {
      changeFormation: triggers.scoreChange || triggers.strategyFailed || triggers.patternDetected,
      switchPlayStyle: triggers.timeThreshold || triggers.strategyFailed,
      adjustCardUsage: true,
      focusNewTargets: triggers.patternDetected || triggers.strategyFailed,
    };
  }
}
