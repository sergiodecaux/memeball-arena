// src/ai/team/TeamBalancer.ts
import type { CapClass, FactionId } from '../../constants/gameConstants';
import type { AIDifficulty } from '../../types';
import type { UnitRarity } from '../../data/UnitsRepository';
import { getUnitById, getUnitsByFaction } from '../../data/UnitsRepository';

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export interface TeamComposition {
  faction: FactionId;
  units: string[];
  avgPower: number;
  hasLegendary: boolean;
  hasEpic: boolean;
  composition: Record<CapClass, number>;
}

const CAP_CLASSES: CapClass[] = [
  'sniper',
  'balanced',
  'trickster',
  'tank',
  'playmaker',
  'maestro',
  'enforcer',
];

function rarityPower(r: UnitRarity): number {
  switch (r) {
    case 'common':
      return 1;
    case 'rare':
      return 2;
    case 'epic':
      return 3;
    case 'legendary':
      return 4;
    default:
      return 1;
  }
}

function emptyComposition(): Record<CapClass, number> {
  const o = {} as Record<CapClass, number>;
  for (const c of CAP_CLASSES) o[c] = 0;
  return o;
}

export class TeamBalancer {
  /**
   * Анализ сохранённой команды игрока по списку unitId (до спавна юнитов на поле).
   */
  public static analyzePlayerTeamByIds(unitIds: string[], playerFaction: FactionId): TeamComposition {
    const composition = emptyComposition();
    let totalPower = 0;
    let hasLegendary = false;
    let hasEpic = false;
    const units: string[] = [];

    for (const rawId of unitIds) {
      const unitId = rawId?.trim();
      if (!unitId) continue;
      units.push(unitId);

      const data = getUnitById(unitId);
      if (!data) continue;

      totalPower += rarityPower(data.rarity);
      if (data.rarity === 'legendary') hasLegendary = true;
      if (data.rarity === 'epic') hasEpic = true;

      const role = data.role as CapClass;
      if (role in composition) composition[role]++;
    }

    const n = Math.max(1, units.length);

    return {
      faction: playerFaction,
      units,
      avgPower: totalPower / n,
      hasLegendary,
      hasEpic,
      composition,
    };
  }

  /**
   * Подбирает стартовый состав AI под силу и классы игрока (офлайн / маскировка PvP).
   */
  public static createBalancedAITeam(
    playerComposition: TeamComposition,
    teamSize: number,
    aiFaction: FactionId,
    difficulty: AIDifficulty,
  ): string[] {
    const mult: Record<AIDifficulty, number> = {
      easy: 0.72,
      medium: 0.92,
      hard: 1.08,
      impossible: 1.22,
    };
    let targetBand = playerComposition.avgPower * (mult[difficulty] ?? 1);
    targetBand = clamp(targetBand, 1, 4);

    const pool = getUnitsByFaction(aiFaction).filter(
      (u) => !u.id.startsWith('boss_') && !u.isCaptain,
    );

    const used = new Set<string>();
    const result: string[] = [];

    const pickClosestRarityForRole = (role: CapClass): string | null => {
      const candidates = pool.filter((u) => u.role === role && !used.has(u.id));
      if (candidates.length === 0) return null;
      candidates.sort(
        (a, b) =>
          Math.abs(rarityPower(a.rarity) - targetBand) -
          Math.abs(rarityPower(b.rarity) - targetBand),
      );
      const pick = candidates[0];
      used.add(pick.id);
      return pick.id;
    };

    for (const cls of CAP_CLASSES) {
      const need = playerComposition.composition[cls] ?? 0;
      for (let i = 0; i < need; i++) {
        const id = pickClosestRarityForRole(cls);
        if (id) result.push(id);
      }
    }

    while (result.length < teamSize) {
      let id = pickClosestRarityForRole('balanced');
      if (!id) {
        const any = pool.find((u) => !used.has(u.id));
        if (!any) break;
        id = any.id;
        used.add(id);
      }
      result.push(id);
    }

    return result.slice(0, teamSize);
  }

  public static suggestCounterFaction(playerFaction: FactionId): FactionId {
    const counters: Record<FactionId, FactionId> = {
      magma: 'cyborg',
      cyborg: 'void',
      void: 'insect',
      insect: 'magma',
    };
    return counters[playerFaction] ?? 'cyborg';
  }
}
