// src/ai/team/TeamBuilder.ts — рандомизация ростера AI по архетипу и фракции

import type { CapClass, FactionId } from '../../constants/gameConstants';
import type { AIDifficulty } from '../../types';
import type { UnitData, UnitRarity } from '../../data/UnitsRepository';
import { getUnitsByFaction, getUnitById } from '../../data/UnitsRepository';
import type { TeamArchetype } from './TeamArchetypes';
import { TEAM_ARCHETYPES } from './TeamArchetypes';

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

function rarityRank(r: UnitRarity): number {
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

function shuffle<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sortByPower(units: UnitData[]): UnitData[] {
  return [...units].sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity));
}

export interface TeamBuildOptions {
  faction?: FactionId;
  archetype?: TeamArchetype;
  teamSize: number;
  difficulty: AIDifficulty;
  avoidUnits?: string[];
}

export class TeamBuilder {
  /** Последние id юнитов в AI-ростерах (разнообразие между матчами). */
  private static unitHistory: string[] = [];
  private static readonly MAX_UNIT_HISTORY = 15;

  public static pickRandomFaction(excluding?: FactionId): FactionId {
    const all: FactionId[] = ['magma', 'cyborg', 'void', 'insect'];
    const pool = excluding ? all.filter((f) => f !== excluding) : all;
    return pool[Math.floor(Math.random() * pool.length)] ?? 'magma';
  }

  /** Алиас для вызовов из сцен/инструментов. */
  public static selectRandomFaction(excluding?: FactionId): FactionId {
    return this.pickRandomFaction(excluding);
  }

  /**
   * Чаще выбирает архетипы с трикстерами / дриблерами (доступные по сложности).
   */
  public static selectSmartArchetype(difficulty: AIDifficulty): TeamArchetype {
    const gameRank: Record<AIDifficulty, number> = { easy: 0, medium: 1, hard: 2, impossible: 3 };
    const rank = gameRank[difficulty] ?? 1;
    const floorRank: Record<TeamArchetype['minDifficulty'], number> = {
      easy: 0,
      medium: 1,
      hard: 2,
      expert: 3,
    };
    const available = Object.values(TEAM_ARCHETYPES).filter((a) => floorRank[a.minDifficulty] <= rank);
    const priorityIds = [
      'trickster_rush',
      'dribble_storm',
      'maestro_orchestra',
      'hybrid_assault',
      'fortress_counter',
      'enforcer_wall',
    ];

    if (Math.random() < 0.72) {
      const priority = available.filter((a) => priorityIds.includes(a.id));
      if (priority.length > 0) {
        const selected = priority[Math.floor(Math.random() * priority.length)];
        console.log(`[TeamBuilder] ⭐ Priority archetype: ${selected.name} (${selected.id})`);
        return selected;
      }
    }
    const selected = available[Math.floor(Math.random() * Math.max(1, available.length))];
    console.log(`[TeamBuilder] 🎭 Random archetype: ${selected.name} (${selected.id})`);
    return selected;
  }

  /**
   * Ростер по архетипу: случайный выбор внутри «корзин» редкости, чтобы матчи не повторяли один и тот же набор id.
   */
  public static buildRosterFromArchetype(
    archetype: TeamArchetype,
    faction: FactionId,
    teamSize: number,
    difficulty: AIDifficulty,
    avoidUnitIds?: string[],
  ): string[] {
    const avoid = new Set([...(avoidUnitIds ?? []), ...this.unitHistory]);
    let pool = getUnitsByFaction(faction).filter(
      (u) => !u.id.startsWith('boss_') && !u.isCaptain && !avoid.has(u.id),
    );
    if (pool.length === 0) {
      pool = getUnitsByFaction(faction).filter((u) => !u.id.startsWith('boss_') && !u.isCaptain);
    }
    const rows = [...archetype.composition].sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
    );

    const pickStrong =
      archetype.playStyle.aggression >= 0.75 || difficulty === 'hard' || difficulty === 'impossible';
    const easyMode = difficulty === 'easy';

    const used = new Set<string>();
    const unitIds: string[] = [];

    const pickFromPool = (candidates: UnitData[], priority: 'high' | 'medium' | 'low'): UnitData | null => {
      if (candidates.length === 0) return null;
      const sorted = sortByPower(candidates);
      let slice: UnitData[];
      if (priority === 'high') {
        const top = Math.max(1, Math.ceil(sorted.length * 0.35));
        slice = sorted.slice(0, top);
      } else if (priority === 'medium') {
        const start = Math.floor(sorted.length * 0.15);
        const end = Math.max(start + 1, Math.floor(sorted.length * 0.65));
        slice = sorted.slice(start, end);
      } else {
        const start = Math.floor(sorted.length * 0.45);
        slice = sorted.slice(start);
      }
      if (slice.length === 0) slice = sorted;
      const poolPick = easyMode ? sorted.slice(-Math.max(1, Math.ceil(sorted.length * 0.55))) : slice;
      const shuffled = shuffle(poolPick.length ? poolPick : slice);
      return shuffled[0] ?? null;
    };

    for (const req of rows) {
      for (let n = 0; n < req.count && unitIds.length < teamSize; n++) {
        let candidates = pool.filter((u) => u.role === req.capClass && !used.has(u.id));
        if (candidates.length === 0) {
          candidates = pool.filter((u) => !used.has(u.id));
        }
        if (candidates.length === 0) break;

        const pick = pickFromPool(candidates, pickStrong ? 'high' : req.priority);
        if (!pick) break;
        used.add(pick.id);
        unitIds.push(pick.id);
        console.log(`[TeamBuilder] + ${pick.id} (${pick.role}, ${pick.rarity})`);
      }
    }

    const fillerRoles: CapClass[] = ['tank', 'enforcer', 'playmaker', 'maestro', 'trickster'];
    while (unitIds.length < teamSize) {
      let candidates: UnitData[] = [];
      for (const cls of fillerRoles) {
        candidates = pool.filter((u) => u.role === cls && !used.has(u.id));
        if (candidates.length > 0) break;
      }
      if (candidates.length === 0) candidates = pool.filter((u) => !used.has(u.id));
      if (candidates.length === 0) break;
      const pick = shuffle(sortByPower(candidates))[0];
      used.add(pick.id);
      unitIds.push(pick.id);
      console.log(`[TeamBuilder] + ${pick.id} (filler)`);
    }

    console.log(`[TeamBuilder] ✅ Roster ${faction} / ${archetype.id}:`, unitIds);
    return unitIds.slice(0, teamSize);
  }

  /** Запоминает состав последних матчей (для исключения повторов). */
  public static recordMatchRoster(unitIds: string[]): void {
    this.unitHistory.push(...unitIds);
    if (this.unitHistory.length > this.MAX_UNIT_HISTORY) {
      this.unitHistory = this.unitHistory.slice(-this.MAX_UNIT_HISTORY);
    }
    console.log(`[TeamBuilder] 📝 Roster history size=${this.unitHistory.length}`);
  }

  public static clearUnitHistory(): void {
    this.unitHistory = [];
  }

  /**
   * Случайная фракция + архетип по сложности (для экранов без заранее заданного оппонента).
   */
  public static buildRandomTeam(options: TeamBuildOptions): {
    faction: FactionId;
    unitIds: string[];
    archetype: TeamArchetype;
    captainId: string | null;
  } {
    const faction = options.faction ?? this.selectRandomFaction();
    console.log(`[TeamBuilder] 🎲 Selected faction: ${faction}`);

    const archetype = options.archetype ?? this.selectSmartArchetype(options.difficulty);
    console.log(`[TeamBuilder] 🎭 Selected archetype: ${archetype.name}`);

    const unitIds = this.buildRosterFromArchetype(
      archetype,
      faction,
      options.teamSize,
      options.difficulty,
      options.avoidUnits,
    );

    this.recordMatchRoster(unitIds);

    const captainId = this.selectCaptainFromUnitIds(unitIds, archetype);
    console.log(`[TeamBuilder] 👑 Captain: ${captainId}`);
    return { faction, unitIds, archetype, captainId };
  }

  public static selectCaptainFromUnitIds(unitIds: string[], archetype: TeamArchetype): string | null {
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

    for (const capClass of preferredClasses) {
      const c = units.find((u) => u.role === capClass);
      if (c) return c.id;
    }
    const legendary = units.find((u) => u.rarity === 'legendary');
    if (legendary) return legendary.id;
    const epic = units.find((u) => u.rarity === 'epic');
    if (epic) return epic.id;
    return unitIds[0];
  }
}
