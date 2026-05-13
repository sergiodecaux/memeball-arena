// src/ai/team/TeamArchetypes.ts — мета-составы AI и контр-пики под классы игрока

import type { CapClass } from '../../constants/gameConstants';
import type { AIDifficulty } from '../../types';
import type { UnitData } from '../../data/UnitsRepository';
import { getUnitById } from '../../data/UnitsRepository';

/** Порог доступности архетипа (expert = только impossible в игре). */
export type ArchetypeSkillFloor = 'easy' | 'medium' | 'hard' | 'expert';

/** Теги стиля игрока для контр-пика (см. ArchetypeSelector.detectPlayerStyle). */
export type PlayerStyleTag =
  | 'trickster_heavy'
  | 'playmaker_heavy'
  | 'maestro_heavy'
  | 'tank_heavy'
  | 'sniper_heavy'
  | 'mixed';

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
  goodAgainst: PlayerStyleTag[];
  weakAgainst: string[];
  minDifficulty: ArchetypeSkillFloor;
}

export const TEAM_ARCHETYPES: Record<string, TeamArchetype> = {
  trickster_rush: {
    id: 'trickster_rush',
    name: '🌀 Trickster Ambush',
    description: 'Tricksters at opponent goal, tank + maestro support',
    composition: [
      { capClass: 'trickster', count: 3, priority: 'high' },
      { capClass: 'tank', count: 1, priority: 'medium' },
      { capClass: 'maestro', count: 1, priority: 'medium' },
    ],
    playStyle: {
      aggression: 0.95,
      passFrequency: 0.4,
      longShotBonus: 0.7,
      closeRangeBonus: 1.8,
    },
    goodAgainst: ['tank_heavy', 'maestro_heavy', 'mixed'],
    weakAgainst: [],
    minDifficulty: 'easy',
  },

  dribble_storm: {
    id: 'dribble_storm',
    name: '⚡ Dribble Storm',
    description: 'Playmakers push the field, tank + enforcer anchor',
    composition: [
      { capClass: 'playmaker', count: 3, priority: 'high' },
      { capClass: 'tank', count: 1, priority: 'high' },
      { capClass: 'enforcer', count: 1, priority: 'medium' },
    ],
    playStyle: {
      aggression: 0.9,
      passFrequency: 0.3,
      longShotBonus: 0.8,
      closeRangeBonus: 1.6,
    },
    goodAgainst: ['tank_heavy', 'sniper_heavy'],
    weakAgainst: [],
    minDifficulty: 'easy',
  },

  maestro_orchestra: {
    id: 'maestro_orchestra',
    name: '🎼 Maestro Orchestra',
    description: 'Pass-heavy maestros with trickster finisher and tank',
    composition: [
      { capClass: 'maestro', count: 3, priority: 'high' },
      { capClass: 'trickster', count: 1, priority: 'high' },
      { capClass: 'tank', count: 1, priority: 'high' },
    ],
    playStyle: {
      aggression: 0.75,
      passFrequency: 0.95,
      longShotBonus: 1.2,
      closeRangeBonus: 1.3,
    },
    goodAgainst: ['mixed', 'trickster_heavy'],
    weakAgainst: [],
    minDifficulty: 'medium',
  },

  hybrid_assault: {
    id: 'hybrid_assault',
    name: '🔥 Hybrid Assault',
    description: 'Tricksters + playmakers + tank',
    composition: [
      { capClass: 'trickster', count: 2, priority: 'high' },
      { capClass: 'playmaker', count: 2, priority: 'high' },
      { capClass: 'tank', count: 1, priority: 'high' },
    ],
    playStyle: {
      aggression: 0.88,
      passFrequency: 0.5,
      longShotBonus: 0.9,
      closeRangeBonus: 1.5,
    },
    goodAgainst: ['tank_heavy', 'maestro_heavy', 'sniper_heavy'],
    weakAgainst: [],
    minDifficulty: 'easy',
  },

  fortress_counter: {
    id: 'fortress_counter',
    name: '🏰 Fortress Counter',
    description: 'Tanks + enforcer, playmaker + trickster counter',
    composition: [
      { capClass: 'tank', count: 2, priority: 'high' },
      { capClass: 'enforcer', count: 1, priority: 'high' },
      { capClass: 'playmaker', count: 1, priority: 'high' },
      { capClass: 'trickster', count: 1, priority: 'medium' },
    ],
    playStyle: {
      aggression: 0.4,
      passFrequency: 0.4,
      longShotBonus: 1.0,
      closeRangeBonus: 1.1,
    },
    goodAgainst: ['playmaker_heavy', 'trickster_heavy'],
    weakAgainst: [],
    minDifficulty: 'easy',
  },

  enforcer_wall: {
    id: 'enforcer_wall',
    name: '💪 Enforcer Wall',
    description: 'Enforcers lock down, playmaker + maestro outlet',
    composition: [
      { capClass: 'enforcer', count: 3, priority: 'high' },
      { capClass: 'playmaker', count: 1, priority: 'high' },
      { capClass: 'maestro', count: 1, priority: 'medium' },
    ],
    playStyle: {
      aggression: 0.5,
      passFrequency: 0.45,
      longShotBonus: 0.9,
      closeRangeBonus: 1.2,
    },
    goodAgainst: ['trickster_heavy', 'playmaker_heavy'],
    weakAgainst: [],
    minDifficulty: 'medium',
  },

  balanced_tactical: {
    id: 'balanced_tactical',
    name: '⚖️ Tactical Balance',
    description: 'One of each combat role, no sniper/balanced spam',
    composition: [
      { capClass: 'tank', count: 1, priority: 'high' },
      { capClass: 'enforcer', count: 1, priority: 'medium' },
      { capClass: 'playmaker', count: 1, priority: 'high' },
      { capClass: 'trickster', count: 1, priority: 'high' },
      { capClass: 'maestro', count: 1, priority: 'medium' },
    ],
    playStyle: {
      aggression: 0.65,
      passFrequency: 0.55,
      longShotBonus: 1.0,
      closeRangeBonus: 1.2,
    },
    goodAgainst: ['mixed'],
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

/** Классы для добора слотов (без balanced / sniper). */
const FILLER_CLASSES: CapClass[] = ['tank', 'enforcer', 'playmaker', 'maestro', 'trickster'];

export function flattenArchetypeComposition(archetype: TeamArchetype, teamSize: number): CapClass[] {
  const rows = [...archetype.composition].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  );
  const slots: CapClass[] = [];
  for (const row of rows) {
    for (let k = 0; k < row.count && slots.length < teamSize; k++) {
      slots.push(row.capClass);
    }
  }
  let fi = 0;
  while (slots.length < teamSize) {
    slots.push(FILLER_CLASSES[fi % FILLER_CLASSES.length]);
    fi++;
  }
  return slots.slice(0, teamSize);
}

export class ArchetypeSelector {
  public static selectCounterArchetype(
    playerComposition: Record<CapClass, number>,
    teamSize: number,
    difficulty: AIDifficulty,
  ): TeamArchetype {
    const playerStyle = this.detectPlayerStyle(playerComposition);
    console.log(`[ArchetypeSelector] Player style: ${playerStyle} (teamSize=${teamSize})`);

    const gameRank = gameDifficultyRank(difficulty);
    const available = Object.values(TEAM_ARCHETYPES).filter(
      (a) => ARCHETYPE_MIN_RANK[a.minDifficulty] <= gameRank,
    );

    const counters = available.filter((a) => a.goodAgainst.includes(playerStyle));
    let selected: TeamArchetype;
    if (counters.length > 0) {
      selected = counters[Math.floor(Math.random() * counters.length)];
      console.log(`[ArchetypeSelector] Counter pick: ${selected.name}`);
    } else {
      selected = available[Math.floor(Math.random() * available.length)] ?? TEAM_ARCHETYPES.balanced_tactical;
      console.log(`[ArchetypeSelector] Fallback random: ${selected.name}`);
    }
    return selected;
  }

  private static detectPlayerStyle(composition: Record<CapClass, number>): PlayerStyleTag {
    const tank = composition.tank ?? 0;
    const enf = composition.enforcer ?? 0;
    const trick = composition.trickster ?? 0;
    const pm = composition.playmaker ?? 0;
    const ma = composition.maestro ?? 0;
    const sn = composition.sniper ?? 0;

    if (trick >= 2 && pm >= 1) return 'mixed';
    if (trick >= 2) return 'trickster_heavy';
    if (pm >= 2) return 'playmaker_heavy';
    if (ma >= 2) return 'maestro_heavy';
    if (tank + enf >= 3) return 'tank_heavy';
    if (sn >= 2) return 'sniper_heavy';
    return 'mixed';
  }

  public static selectCaptain(unitIds: string[], archetype: TeamArchetype): string | null {
    if (unitIds.length === 0) return null;

    const units = unitIds.map((id) => getUnitById(id)).filter(Boolean) as UnitData[];

    let preferredClasses: CapClass[] = [];
    switch (archetype.id) {
      case 'trickster_rush':
        preferredClasses = ['trickster', 'maestro', 'tank'];
        break;
      case 'dribble_storm':
        preferredClasses = ['playmaker', 'tank', 'enforcer'];
        break;
      case 'maestro_orchestra':
        preferredClasses = ['maestro', 'trickster', 'tank'];
        break;
      case 'hybrid_assault':
        preferredClasses = ['trickster', 'playmaker', 'tank'];
        break;
      case 'fortress_counter':
        preferredClasses = ['tank', 'enforcer', 'playmaker'];
        break;
      case 'enforcer_wall':
        preferredClasses = ['enforcer', 'playmaker', 'maestro'];
        break;
      case 'balanced_tactical':
        preferredClasses = ['tank', 'playmaker', 'trickster', 'maestro'];
        break;
      default:
        preferredClasses = ['playmaker', 'maestro', 'trickster'];
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
