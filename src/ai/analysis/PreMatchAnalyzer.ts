// src/ai/analysis/PreMatchAnalyzer.ts
import type { AIUnit } from '../scoring/AbilityScorer';
import type { CapClass, FactionId } from '../../constants/gameConstants';
import type { OpponentAnalysis, CounterStrategy, AISkillLevel } from '../types/AITypes';
import type { Formation } from '../../data/PlayerData';
import { getAIFormationsForTeamSize } from '../AIFormations';
import type { PassiveAbility } from '../../types/passives';

export class PreMatchAnalyzer {
  public static analyzeOpponent(playerUnits: AIUnit[], playerFaction: FactionId): OpponentAnalysis {
    const teamSize = playerUnits.length;
    const composition = this.analyzeComposition(playerUnits);
    const avgAccuracy = this.calculateAverageAccuracy(playerUnits);
    const threats = this.identifyThreats(playerUnits);
    const weaknesses = this.identifyWeaknesses(playerUnits, composition);
    const likelyStrategy = this.predictStrategy(composition, threats);
    const detectedSynergies = this.detectSynergies(playerUnits);

    return {
      faction: playerFaction,
      teamSize,
      avgAccuracy,
      composition,
      threats,
      weaknesses,
      likelyStrategy,
      detectedSynergies,
    };
  }

  public static createCounterStrategy(
    analysis: OpponentAnalysis,
    aiUnits: AIUnit[],
    aiSkillLevel: AISkillLevel,
  ): CounterStrategy {
    const teamSize = aiUnits.length;
    const formations = getAIFormationsForTeamSize(teamSize);
    const recommendedFormation = this.selectCounterFormation(analysis, formations, aiSkillLevel);
    const priorityTargets = this.selectPriorityTargets(analysis);
    const avoidTargets = this.selectAvoidTargets(analysis);
    const { defensiveUnits, offensiveUnits } = this.assignUnitRoles(aiUnits, analysis);
    const abilityPriority = this.prioritizeAbilities(analysis);
    const playStyle = this.determinePlayStyle(analysis, aiSkillLevel);
    const reasoning = this.generateReasoning(analysis, recommendedFormation);

    return {
      recommendedFormation,
      priorityTargets,
      avoidTargets,
      defensiveUnits,
      offensiveUnits,
      abilityPriority,
      playStyle,
      reasoning,
    };
  }

  private static analyzeComposition(units: AIUnit[]) {
    const composition = {
      sniper: 0,
      balanced: 0,
      trickster: 0,
      tank: 0,
      playmaker: 0,
      maestro: 0,
      enforcer: 0,
    };

    for (const unit of units) {
      const capClass = unit.getCapClass() as CapClass;
      if (capClass in composition) {
        composition[capClass]++;
      }
    }

    return composition;
  }

  private static calculateAverageAccuracy(units: AIUnit[]): number {
    if (units.length === 0) return 0.85;

    let totalAccuracy = 0;
    for (const unit of units) {
      const accuracy = (unit as unknown as { accuracy?: number }).accuracy ?? 0.85;
      totalAccuracy += accuracy;
    }

    return totalAccuracy / units.length;
  }

  private static identifyThreats(units: AIUnit[]): OpponentAnalysis['threats'] {
    const threats: OpponentAnalysis['threats'] = [];

    for (const unit of units) {
      const capClass = unit.getCapClass() as CapClass;
      const accuracy = (unit as unknown as { accuracy?: number }).accuracy ?? 0.85;

      let priority = 0;
      let reason = '';

      if (capClass === 'sniper' && accuracy > 0.92) {
        priority = 90;
        reason = 'High accuracy sniper - dangerous from distance';
      } else if (capClass === 'tank') {
        priority = 70;
        reason = 'Tank - blocks paths and disrupts positioning';
      } else if (capClass === 'trickster') {
        priority = 60;
        reason = 'Trickster - unpredictable curved shots';
      } else if (capClass === 'playmaker') {
        priority = 65;
        reason = 'Playmaker - controls ball and creates opportunities';
      }

      if (priority > 50) {
        threats.push({
          unitId: unit.id,
          capClass,
          reason,
          priority,
        });
      }
    }

    threats.sort((a, b) => b.priority - a.priority);
    return threats;
  }

  private static identifyWeaknesses(
    units: AIUnit[],
    composition: OpponentAnalysis['composition'],
  ): OpponentAnalysis['weaknesses'] {
    const weaknesses: OpponentAnalysis['weaknesses'] = [];

    if (composition.tank === 0 && composition.enforcer === 0) {
      weaknesses.push({
        type: 'no_defense',
        severity: 80,
        description: 'No defensive units - vulnerable to aggressive attacks',
      });
    }

    if (composition.sniper >= 2 && units.length === 3) {
      weaknesses.push({
        type: 'bunker_vulnerable',
        severity: 70,
        description: 'Sniper-heavy team - vulnerable to close pressure',
      });
    }

    if (composition.sniper === 0) {
      weaknesses.push({
        type: 'no_snipers',
        severity: 60,
        description: 'No snipers - weak long-range threat',
      });
    }

    const avgAccuracy = this.calculateAverageAccuracy(units);
    if (avgAccuracy < 0.88) {
      weaknesses.push({
        type: 'low_accuracy',
        severity: 50,
        description: 'Below average accuracy - prone to missed shots',
      });
    }

    return weaknesses;
  }

  private static predictStrategy(
    composition: OpponentAnalysis['composition'],
    _threats: OpponentAnalysis['threats'],
  ): OpponentAnalysis['likelyStrategy'] {
    if (composition.sniper >= 2) return 'sniper_spam';
    if (composition.tank >= 2 || composition.enforcer >= 2) return 'tank_wall';
    if (composition.trickster >= 2) return 'trickster_chaos';
    if (composition.playmaker >= 2) return 'dribbler_rush';
    return 'balanced';
  }

  private static detectSynergies(units: AIUnit[]): OpponentAnalysis['detectedSynergies'] {
    const synergies: OpponentAnalysis['detectedSynergies'] = [];

    for (const unit of units) {
      const passive = (unit as unknown as { passive?: PassiveAbility }).passive;
      if (passive?.type === 'aura') {
        synergies.push({
          type: 'aura_buff',
          units: [unit.id],
          strength: 70,
        });
      }
    }

    return synergies;
  }

  private static selectCounterFormation(
    analysis: OpponentAnalysis,
    formations: Record<string, Formation>,
    _skillLevel: AISkillLevel,
  ): Formation {
    if (analysis.likelyStrategy === 'sniper_spam') {
      return formations.aggressive ?? formations.balanced;
    }
    if (analysis.likelyStrategy === 'tank_wall') {
      return formations.counter ?? formations.balanced;
    }
    if (analysis.likelyStrategy === 'dribbler_rush' || analysis.likelyStrategy === 'trickster_chaos') {
      return formations.defensive ?? formations.balanced;
    }
    return formations.balanced;
  }

  private static selectPriorityTargets(analysis: OpponentAnalysis): string[] {
    return analysis.threats.slice(0, 3).map((t) => t.unitId);
  }

  private static selectAvoidTargets(analysis: OpponentAnalysis): string[] {
    return analysis.threats
      .filter((t) => t.capClass === 'tank' || t.capClass === 'enforcer')
      .map((t) => t.unitId);
  }

  private static assignUnitRoles(aiUnits: AIUnit[], analysis: OpponentAnalysis) {
    const defensiveUnits: string[] = [];
    const offensiveUnits: string[] = [];

    for (const unit of aiUnits) {
      const capClass = unit.getCapClass() as CapClass;

      if (capClass === 'tank' || capClass === 'enforcer') {
        defensiveUnits.push(unit.id);
      } else if (capClass === 'sniper' || capClass === 'playmaker') {
        offensiveUnits.push(unit.id);
      } else if (analysis.likelyStrategy === 'dribbler_rush') {
        defensiveUnits.push(unit.id);
      } else {
        offensiveUnits.push(unit.id);
      }
    }

    return { defensiveUnits, offensiveUnits };
  }

  private static prioritizeAbilities(analysis: OpponentAnalysis): string[] {
    const priorities: string[] = [];

    if (analysis.likelyStrategy === 'tank_wall') {
      priorities.push('magma_meteor', 'insect_parasite', 'void_wormhole');
    }
    if (analysis.likelyStrategy === 'sniper_spam') {
      priorities.push('cyborg_shield', 'cyborg_barrier', 'magma_lava');
    }
    if (analysis.likelyStrategy === 'dribbler_rush' || analysis.likelyStrategy === 'trickster_chaos') {
      priorities.push('insect_toxin', 'cyborg_tether', 'void_ghost');
    }

    return priorities;
  }

  private static determinePlayStyle(analysis: OpponentAnalysis, skillLevel: AISkillLevel) {
    let aggression = 0.5;
    let passFrequency = 0.3;
    let riskTolerance = 0.4;
    let cardUsage = 0.5;

    switch (analysis.likelyStrategy) {
      case 'sniper_spam':
        aggression = 0.7;
        passFrequency = 0.4;
        riskTolerance = 0.6;
        break;
      case 'tank_wall':
        aggression = 0.4;
        passFrequency = 0.5;
        riskTolerance = 0.3;
        cardUsage = 0.7;
        break;
      case 'dribbler_rush':
        aggression = 0.3;
        passFrequency = 0.2;
        riskTolerance = 0.2;
        cardUsage = 0.6;
        break;
      case 'trickster_chaos':
        aggression = 0.5;
        passFrequency = 0.3;
        riskTolerance = 0.5;
        cardUsage = 0.6;
        break;
      default:
        break;
    }

    switch (skillLevel) {
      case 'beginner':
        aggression *= 0.6;
        passFrequency *= 0.3;
        riskTolerance *= 0.5;
        cardUsage *= 0.3;
        break;
      case 'easy':
        aggression *= 0.8;
        passFrequency *= 0.6;
        riskTolerance *= 0.7;
        cardUsage *= 0.5;
        break;
      case 'expert':
        aggression *= 1.2;
        passFrequency *= 1.3;
        riskTolerance *= 1.2;
        cardUsage *= 1.3;
        break;
      default:
        break;
    }

    return {
      aggression: Math.min(1, aggression),
      passFrequency: Math.min(1, passFrequency),
      riskTolerance: Math.min(1, riskTolerance),
      cardUsage: Math.min(1, cardUsage),
    };
  }

  private static generateReasoning(analysis: OpponentAnalysis, formation: Formation): string[] {
    const reasoning: string[] = [];
    reasoning.push(`Opponent faction: ${analysis.faction}`);
    reasoning.push(`Team size: ${analysis.teamSize}`);
    reasoning.push(`Predicted strategy: ${analysis.likelyStrategy}`);
    reasoning.push(`Selected formation: ${formation.name}`);
    if (analysis.threats.length > 0) {
      reasoning.push(`Primary threat: ${analysis.threats[0].reason}`);
    }
    if (analysis.weaknesses.length > 0) {
      reasoning.push(`Exploitable weakness: ${analysis.weaknesses[0].description}`);
    }
    return reasoning;
  }
}
