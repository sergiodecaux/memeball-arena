// src/ai/team/TeamArchetypes.ts — мета-составы AI и контр-пики под классы игрока

import type { CapClass, FactionId } from '../../constants/gameConstants';
import type { AIDifficulty } from '../../types';
import type { UnitData } from '../../data/UnitsRepository';
import { getUnitById, getUnitsByFaction } from '../../data/UnitsRepository';

/** Порог доступности архетипа (expert = только impossible в игре). */
export type ArchetypeSkillFloor = 'easy' | 'medium' | 'hard' | 'expert';

export interface TeamArchetype {
  id: string;
  name: string;
  description: string;
  composition: {
    capClass: CapClass;
    count: number;
    priority: 'high' | 'medium' | 'low';
  }[];
  playStyle: {
    aggression: number;
    passFrequency: number;
    longShotBonus: number;
    closeRangeBonus: number;
  };
  goodAgainst: string[];
  weakAgainst: string[];
  minDifficulty: ArchetypeSkillFloor;
}

export const TEAM_ARCHETYPES: Record<string, TeamArchetype> = {
  trickster_rush: {
    id: 'trickster_rush',
    name: '🌀 Trickster Rush',
    description: '3+ Tricksters for unpredictable chaos attacks',
    composition: [
      { capClass: 'trickster', count: 3, priority: 'high' },
      { capClass: 'playmaker', count: 1, priority: 'medium' },
      { capClass: 'balanced', count: 1, priority: 'low' },
    ],
    playStyle: {
      aggression: 0.9,
      passFrequency: 0.3,
      longShotBonus: 0.8,
      closeRangeBonus: 1.5,
    },
    goodAgainst: ['defensive_wall', 'balanced_flex'],
    weakAgainst: ['sniper_spam'],
    minDifficulty: 'medium',
  },

  sniper_spam: {
    id: 'sniper_spam',
    name: '🎯 Sniper Spam',
    description: '3+ Snipers for long-range domination',
    composition: [
      { capClass: 'sniper', count: 3, priority: 'high' },
      { capClass: 'maestro', count: 1, priority: 'high' },
      { capClass: 'balanced', count: 1, priority: 'medium' },
    ],
    playStyle: {
      aggression: 0.7,
      passFrequency: 0.5,
      longShotBonus: 1.8,
      closeRangeBonus: 0.6,
    },
    goodAgainst: ['trickster_rush', 'dribble_control'],
    weakAgainst: ['pressure_swarm'],
    minDifficulty: 'medium',
  },

  dribble_control: {
    id: 'dribble_control',
    name: '⚡ Dribble Control',
    description: 'Playmakers + Maestros for control and quick passes',
    composition: [
      { capClass: 'playmaker', count: 2, priority: 'high' },
      { capClass: 'maestro', count: 2, priority: 'high' },
      { capClass: 'sniper', count: 1, priority: 'medium' },
    ],
    playStyle: {
      aggression: 0.75,
      passFrequency: 0.8,
      longShotBonus: 1.0,
      closeRangeBonus: 1.2,
    },
    goodAgainst: ['defensive_wall', 'tank_fortress'],
    weakAgainst: ['sniper_spam'],
    minDifficulty: 'hard',
  },

  tank_fortress: {
    id: 'tank_fortress',
    name: '🛡️ Tank Fortress',
    description: 'Tanks/Enforcers for dense defense',
    composition: [
      { capClass: 'tank', count: 2, priority: 'high' },
      { capClass: 'enforcer', count: 1, priority: 'high' },
      { capClass: 'sniper', count: 1, priority: 'medium' },
      { capClass: 'balanced', count: 1, priority: 'low' },
    ],
    playStyle: {
      aggression: 0.3,
      passFrequency: 0.4,
      longShotBonus: 0.7,
      closeRangeBonus: 0.8,
    },
    goodAgainst: ['trickster_rush', 'pressure_swarm'],
    weakAgainst: ['sniper_spam', 'dribble_control'],
    minDifficulty: 'medium',
  },

  defensive_wall: {
    id: 'defensive_wall',
    name: '🏰 Defensive Wall',
    description: 'Balanced defense with counter-attack',
    composition: [
      { capClass: 'tank', count: 2, priority: 'medium' },
      { capClass: 'balanced', count: 2, priority: 'medium' },
      { capClass: 'sniper', count: 1, priority: 'high' },
    ],
    playStyle: {
      aggression: 0.4,
      passFrequency: 0.3,
      longShotBonus: 1.2,
      closeRangeBonus: 0.8,
    },
    goodAgainst: ['pressure_swarm'],
    weakAgainst: ['dribble_control', 'sniper_spam'],
    minDifficulty: 'easy',
  },

  pressure_swarm: {
    id: 'pressure_swarm',
    name: '🐝 Pressure Swarm',
    description: 'High-speed pressure with Playmakers and Tricksters',
    composition: [
      { capClass: 'playmaker', count: 2, priority: 'high' },
      { capClass: 'trickster', count: 2, priority: 'medium' },
      { capClass: 'enforcer', count: 1, priority: 'medium' },
    ],
    playStyle: {
      aggression: 0.95,
      passFrequency: 0.6,
      longShotBonus: 0.9,
      closeRangeBonus: 1.4,
    },
    goodAgainst: ['defensive_wall', 'balanced_flex'],
    weakAgainst: ['sniper_spam'],
    minDifficulty: 'hard',
  },

  maestro_control: {
    id: 'maestro_control',
    name: '🎼 Maestro Control',
    description: 'Pass-heavy with three Maestros, sniper finisher and tank cover',
    composition: [
      { capClass: 'maestro', count: 3, priority: 'high' },
      { capClass: 'sniper', count: 1, priority: 'high' },
      { capClass: 'tank', count: 1, priority: 'medium' },
    ],
    playStyle: {
      aggression: 0.65,
      passFrequency: 0.95,
      longShotBonus: 1.5,
      closeRangeBonus: 1.0,
    },
    goodAgainst: ['tank_fortress', 'defensive_wall'],
    weakAgainst: ['pressure_swarm'],
    minDifficulty: 'hard',
  },

  balanced_flex: {
    id: 'balanced_flex',
    name: '⚖️ Balanced Flex',
    description: 'Universal composition',
    composition: [
      { capClass: 'sniper', count: 1, priority: 'medium' },
      { capClass: 'playmaker', count: 1, priority: 'medium' },
      { capClass: 'tank', count: 1, priority: 'medium' },
      { capClass: 'balanced', count: 2, priority: 'medium' },
    ],
    playStyle: {
      aggression: 0.6,
      passFrequency: 0.5,
      longShotBonus: 1.0,
      closeRangeBonus: 1.0,
    },
    goodAgainst: [],
    weakAgainst: [],
    minDifficulty: 'easy',
  },
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

const ARCHETYPE_MIN_RANK: Record<ArchetypeSkillFloor, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
  expert: 3,
};

function gameDifficultyRank(d: AIDifficulty): number {
  switch (d) {
    case 'easy':
      return 0;
    case 'medium':
      return 1;
    case 'hard':
      return 2;
    case 'impossible':
      return 3;
    default:
      return 1;
  }
}

function rarityRank(r: UnitData['rarity']): number {
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

function flattenComposition(archetype: TeamArchetype, teamSize: number): CapClass[] {
  const rows = [...archetype.composition].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  );
  const slots: CapClass[] = [];
  for (const row of rows) {
    for (let k = 0; k < row.count && slots.length < teamSize; k++) {
      slots.push(row.capClass);
    }
  }
  while (slots.length < teamSize) {
    slots.push('balanced');
  }
  return slots.slice(0, teamSize);
}

export class ArchetypeSelector {
  public static selectCounterArchetype(
    playerComposition: Record<CapClass, number>,
    teamSize: number,
    difficulty: AIDifficulty,
  ): TeamArchetype {
    const playerArchetype = this.detectPlayerArchetype(playerComposition);
    console.log(`[ArchetypeSelector] Player meta tag: ${playerArchetype} (teamSize=${teamSize})`);

    const gameRank = gameDifficultyRank(difficulty);
    const available = Object.values(TEAM_ARCHETYPES).filter(
      (a) => ARCHETYPE_MIN_RANK[a.minDifficulty] <= gameRank,
    );

    const counters = available.filter((a) => a.goodAgainst.includes(playerArchetype));
    let selected: TeamArchetype;
    if (counters.length > 0) {
      selected = counters[Math.floor(Math.random() * counters.length)];
      console.log(`[ArchetypeSelector] Counter pick: ${selected.name}`);
    } else {
      selected = available[Math.floor(Math.random() * available.length)] ?? TEAM_ARCHETYPES.balanced_flex;
      console.log(`[ArchetypeSelector] Fallback random: ${selected.name}`);
    }
    return selected;
  }

  private static detectPlayerArchetype(composition: Record<CapClass, number>): string {
    if (composition.trickster >= 3) return 'trickster_rush';
    if (composition.sniper >= 3) return 'sniper_spam';
    if (composition.playmaker >= 2 && composition.maestro >= 1) return 'dribble_control';
    if (composition.tank + composition.enforcer >= 3) return 'tank_fortress';
    if (composition.maestro >= 2) return 'maestro_control';
    if (composition.playmaker >= 2 && composition.trickster >= 1) return 'pressure_swarm';
    return 'balanced_flex';
  }

  public static buildTeamFromArchetype(
    archetype: TeamArchetype,
    teamSize: number,
    faction: FactionId,
  ): string[] {
    const slots = flattenComposition(archetype, teamSize);
    const pool = getUnitsByFaction(faction).filter(
      (u) => !u.id.startsWith('boss_') && !u.isCaptain,
    );

    const sortByRarity = (units: UnitData[]) =>
      [...units].sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity));

    const used = new Set<string>();
    const unitIds: string[] = [];
    const pickStrong = archetype.playStyle.aggression >= 0.75;

    for (const role of slots) {
      let candidates = pool.filter((u) => u.role === role && !used.has(u.id));
      if (candidates.length === 0) {
        candidates = pool.filter((u) => !used.has(u.id));
      }
      if (candidates.length === 0) break;

      const sorted = sortByRarity(candidates);
      const tierIndex = pickStrong
        ? 0
        : Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * 0.22)));
      const pick = sorted[tierIndex] ?? sorted[0];
      used.add(pick.id);
      unitIds.push(pick.id);
    }

    while (unitIds.length < teamSize) {
      const rest = pool.filter((u) => !used.has(u.id));
      if (rest.length === 0) break;
      const pick = sortByRarity(rest)[0];
      used.add(pick.id);
      unitIds.push(pick.id);
    }

    console.log(`[ArchetypeSelector] Built roster for ${archetype.id}:`, unitIds);
    return unitIds.slice(0, teamSize);
  }

  public static selectCaptain(unitIds: string[], archetype: TeamArchetype): string | null {
    if (unitIds.length === 0) return null;

    const units = unitIds.map((id) => getUnitById(id)).filter(Boolean) as UnitData[];

    let preferredClasses: CapClass[] = [];
    switch (archetype.id) {
      case 'sniper_spam':
        preferredClasses = ['sniper', 'maestro'];
        break;
      case 'trickster_rush':
        preferredClasses = ['trickster', 'playmaker'];
        break;
      case 'dribble_control':
      case 'maestro_control':
        preferredClasses = ['maestro', 'playmaker'];
        break;
      case 'tank_fortress':
      case 'defensive_wall':
        preferredClasses = ['tank', 'enforcer'];
        break;
      case 'pressure_swarm':
        preferredClasses = ['playmaker', 'trickster'];
        break;
      default:
        preferredClasses = ['sniper', 'playmaker', 'maestro'];
    }

    for (const cls of preferredClasses) {
      const candidate = units.find((u) => u.role === cls);
      if (candidate) {
        console.log(`[ArchetypeSelector] Captain pick (meta): ${candidate.id} (${candidate.role})`);
        return candidate.id;
      }
    }

    const legendary = units.find((u) => u.rarity === 'legendary');
    if (legendary) return legendary.id;
    const epic = units.find((u) => u.rarity === 'epic');
    if (epic) return epic.id;
    return unitIds[0];
  }
}
