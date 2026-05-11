// src/ai/synergy/SynergyAnalyzer.ts
import Phaser from 'phaser';
import type { AIUnit } from '../scoring/AbilityScorer';
import type { UnitSynergy } from '../types/AITypes';
import type { PassiveAbility } from '../../types/passives';

export class SynergyAnalyzer {
  public static findTeamSynergies(units: AIUnit[]): UnitSynergy[] {
    const synergies: UnitSynergy[] = [];
    synergies.push(...this.findAuraSynergies(units));
    synergies.push(...this.findPassChainSynergies(units));
    synergies.push(...this.findDefensiveWallSynergies(units));
    synergies.push(...this.findComboAbilitySynergies(units));
    synergies.push(...this.findSpecialCombos(units));

    const seen = new Set<string>();
    return synergies.filter((s) => {
      const key = `${s.type}:${[...s.units].sort().join(',')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  public static evaluatePairSynergy(unit1: AIUnit, unit2: AIUnit): number {
    let score = 0;

    const x1 = unit1.body.position.x;
    const y1 = unit1.body.position.y;
    const x2 = unit2.body.position.x;
    const y2 = unit2.body.position.y;
    const dist = Phaser.Math.Distance.Between(x1, y1, x2, y2);

    if (dist < 100) score += 30;
    else if (dist < 200) score += 15;

    const passive1 = (unit1 as unknown as { passive?: PassiveAbility }).passive;
    const passive2 = (unit2 as unknown as { passive?: PassiveAbility }).passive;

    const r1 = passive1?.params?.radius ?? 80;
    const r2 = passive2?.params?.radius ?? 80;

    if (passive1?.type === 'aura' && dist < r1) score += 40;
    if (passive2?.type === 'aura' && dist < r2) score += 40;

    const class1 = unit1.getCapClass();
    const class2 = unit2.getCapClass();

    if (
      (class1 === 'sniper' && (class2 === 'playmaker' || class2 === 'maestro')) ||
      ((class1 === 'playmaker' || class1 === 'maestro') && class2 === 'sniper')
    ) {
      score += 35;
    }

    if (
      (class1 === 'playmaker' && class2 === 'maestro') ||
      (class1 === 'maestro' && class2 === 'playmaker')
    ) {
      score += 30;
    }

    if (
      (class1 === 'trickster' && class2 === 'maestro') ||
      (class1 === 'maestro' && class2 === 'trickster')
    ) {
      score += 28;
    }

    if (
      (class1 === 'trickster' && class2 === 'playmaker') ||
      (class1 === 'playmaker' && class2 === 'trickster')
    ) {
      score += 25;
    }

    if (
      (class1 === 'sniper' && class2 === 'trickster') ||
      (class1 === 'trickster' && class2 === 'sniper')
    ) {
      score += 22;
    }

    if (
      (class1 === 'tank' && class2 === 'enforcer') ||
      (class1 === 'enforcer' && class2 === 'tank')
    ) {
      score += 40;
    }

    if (
      (class1 === 'tank' && class2 === 'sniper') ||
      (class1 === 'sniper' && class2 === 'tank')
    ) {
      score += 20;
    }

    if (
      (class1 === 'enforcer' && class2 === 'sniper') ||
      (class1 === 'sniper' && class2 === 'enforcer')
    ) {
      score += 24;
    }

    if (
      (class1 === 'balanced' && (class2 === 'sniper' || class2 === 'playmaker' || class2 === 'maestro')) ||
      ((class1 === 'sniper' || class1 === 'playmaker' || class1 === 'maestro') && class2 === 'balanced')
    ) {
      score += 15;
    }

    if (
      (class1 === 'balanced' && (class2 === 'tank' || class2 === 'enforcer')) ||
      ((class1 === 'tank' || class1 === 'enforcer') && class2 === 'balanced')
    ) {
      score += 18;
    }

    if (
      (class1 === 'maestro' && class2 === 'tank') ||
      (class1 === 'tank' && class2 === 'maestro')
    ) {
      score += 26;
    }

    if (
      (class1 === 'playmaker' && class2 === 'enforcer') ||
      (class1 === 'enforcer' && class2 === 'playmaker')
    ) {
      score += 23;
    }

    return Math.min(100, score);
  }

  public static getBestSynergyPairs(
    units: AIUnit[],
    topN: number = 3,
  ): Array<{ unit1: AIUnit; unit2: AIUnit; score: number }> {
    const pairs: Array<{ unit1: AIUnit; unit2: AIUnit; score: number }> = [];

    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        pairs.push({
          unit1: units[i],
          unit2: units[j],
          score: this.evaluatePairSynergy(units[i], units[j]),
        });
      }
    }

    pairs.sort((a, b) => b.score - a.score);
    return pairs.slice(0, topN);
  }

  public static findSpecialCombos(units: AIUnit[]): UnitSynergy[] {
    const synergies: UnitSynergy[] = [];

    const maestros = units.filter((u) => u.getCapClass() === 'maestro');
    const playmakers = units.filter((u) => u.getCapClass() === 'playmaker');
    const snipers = units.filter((u) => u.getCapClass() === 'sniper');

    if (maestros.length >= 1 && (playmakers.length >= 1 || snipers.length >= 1)) {
      synergies.push({
        units: [...maestros.map((u) => u.id), ...playmakers.map((u) => u.id), ...snipers.map((u) => u.id)].slice(
          0,
          3,
        ),
        type: 'pass_chain',
        strength: 85,
        condition: { requiresBall: true },
        bonuses: { accuracy: 0.12 },
      });
    }

    const defenders = units.filter((u) => u.getCapClass() === 'tank' || u.getCapClass() === 'enforcer');

    if (defenders.length >= 2) {
      for (let i = 0; i < defenders.length; i++) {
        for (let j = i + 1; j < defenders.length; j++) {
          const dist = Phaser.Math.Distance.Between(
            defenders[i].body.position.x,
            defenders[i].body.position.y,
            defenders[j].body.position.x,
            defenders[j].body.position.y,
          );
          if (dist < 150) {
            synergies.push({
              units: [defenders[i].id, defenders[j].id],
              type: 'defensive_wall',
              strength: 90,
              condition: { maxDistance: 150 },
              bonuses: { defense: 0.25 },
            });
          }
        }
      }
    }

    const tricksters = units.filter((u) => u.getCapClass() === 'trickster');
    if (tricksters.length >= 2) {
      synergies.push({
        units: tricksters.map((u) => u.id),
        type: 'combo_ability',
        strength: 75,
        condition: {},
        bonuses: { accuracy: -0.05 },
      });
    }

    const pmOnly = units.filter((u) => u.getCapClass() === 'playmaker');
    if (pmOnly.length >= 2) {
      synergies.push({
        units: pmOnly.map((u) => u.id),
        type: 'combo_ability',
        strength: 80,
        condition: {},
        bonuses: { force: 0.08 },
      });
    }

    return synergies;
  }

  private static findAuraSynergies(units: AIUnit[]): UnitSynergy[] {
    const synergies: UnitSynergy[] = [];

    for (const unit of units) {
      const passive = (unit as unknown as { passive?: PassiveAbility }).passive;
      if (passive?.type === 'aura') {
        const radius = passive.params?.radius ?? 80;
        const ux = unit.body.position.x;
        const uy = unit.body.position.y;

        const affectedUnits = units.filter((u) => {
          if (u.id === unit.id) return false;
          const dist = Phaser.Math.Distance.Between(ux, uy, u.body.position.x, u.body.position.y);
          return dist < radius;
        });

        if (affectedUnits.length > 0) {
          synergies.push({
            units: [unit.id, ...affectedUnits.map((u) => u.id)],
            type: 'aura_buff',
            strength: Math.min(100, 60 + affectedUnits.length * 15),
            condition: { maxDistance: radius },
            bonuses: { accuracy: passive.params?.value ?? 0.1 },
          });
        }
      }
    }

    return synergies;
  }

  private static findPassChainSynergies(units: AIUnit[]): UnitSynergy[] {
    const synergies: UnitSynergy[] = [];
    if (units.length < 2) return synergies;

    const passers = units.filter((u) => {
      const capClass = u.getCapClass();
      return capClass === 'playmaker' || capClass === 'balanced' || capClass === 'maestro';
    });

    if (passers.length >= 2) {
      synergies.push({
        units: passers.map((u) => u.id),
        type: 'pass_chain',
        strength: 70,
        condition: { requiresBall: true },
        bonuses: { accuracy: 0.05 },
      });
    }

    return synergies;
  }

  private static findDefensiveWallSynergies(units: AIUnit[]): UnitSynergy[] {
    const synergies: UnitSynergy[] = [];
    const defenders = units.filter((u) => {
      const capClass = u.getCapClass();
      return capClass === 'tank' || capClass === 'enforcer';
    });

    if (defenders.length >= 2) {
      for (let i = 0; i < defenders.length; i++) {
        for (let j = i + 1; j < defenders.length; j++) {
          const dist = Phaser.Math.Distance.Between(
            defenders[i].body.position.x,
            defenders[i].body.position.y,
            defenders[j].body.position.x,
            defenders[j].body.position.y,
          );
          if (dist < 120) {
            synergies.push({
              units: [defenders[i].id, defenders[j].id],
              type: 'defensive_wall',
              strength: 80,
              condition: { maxDistance: 120 },
              bonuses: { defense: 0.2 },
            });
          }
        }
      }
    }

    return synergies;
  }

  private static findComboAbilitySynergies(_units: AIUnit[]): UnitSynergy[] {
    return [];
  }
}
