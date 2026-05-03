// Контекст матча для адаптации поведения ИИ (не путать со строковым MatchContext сцен — см. GameSceneData)

export type AIMatchMode = 'pvp' | 'league' | 'tournament' | 'campaign' | 'friendly';

export interface AIMatchContext {
  mode: AIMatchMode;
  leagueTier?: 'meteorite' | 'comet' | 'planet' | 'star' | 'nebula' | 'core';
  leagueDivision?: 1 | 2 | 3;
  tournamentTier?: 'rookie' | 'minor' | 'major' | 'apex';
  tournamentRound?: '16' | '8' | '4' | '2' | '1';
  isPlayerWinStreak?: boolean;
  matchesPlayedToday?: number;
}

/**
 * Модификатор сложности ИИ для режима (1.0 — база из DIFFICULTY_SETTINGS).
 */
export function getContextDifficultyModifier(ctx: AIMatchContext): number {
  let mod = 1.0;
  switch (ctx.mode) {
    case 'pvp':
      mod = 0.95;
      break;

    case 'league': {
      const tierBonus: Record<string, number> = {
        meteorite: 0.8,
        comet: 0.9,
        planet: 1.0,
        star: 1.1,
        nebula: 1.2,
        core: 1.35,
      };
      const divBonus = ctx.leagueDivision ? (4 - ctx.leagueDivision) * 0.03 : 0;
      mod = (tierBonus[ctx.leagueTier ?? 'meteorite'] ?? 1.0) + divBonus;
      break;
    }

    case 'tournament': {
      const tierBonus: Record<string, number> = {
        rookie: 0.85,
        minor: 1.0,
        major: 1.15,
        apex: 1.3,
      };
      const roundBonus: Record<string, number> = {
        '16': 0.0,
        '8': 0.05,
        '4': 0.1,
        '2': 0.18,
        '1': 0.0,
      };
      mod =
        (tierBonus[ctx.tournamentTier ?? 'rookie'] ?? 1.0) +
        (roundBonus[ctx.tournamentRound ?? '16'] ?? 0);
      break;
    }

    case 'campaign':
      mod = 1.0;
      break;

    case 'friendly':
    default:
      mod = 1.0;
  }

  if (ctx.isPlayerWinStreak && (ctx.mode === 'league' || ctx.mode === 'tournament')) {
    mod += 0.05;
  }

  return mod;
}

export function getContextAggressionBias(ctx: AIMatchContext): number {
  switch (ctx.mode) {
    case 'pvp':
      return 0.0;
    case 'league':
      if (ctx.leagueTier === 'nebula' || ctx.leagueTier === 'core') return 0.15;
      return 0.05;
    case 'tournament':
      if (ctx.tournamentRound === '2' || ctx.tournamentRound === '4') return 0.2;
      return 0.08;
    default:
      return 0.0;
  }
}

/** Множитель времени реакции (<1 = быстрее). */
export function getContextReactionModifier(ctx: AIMatchContext): number {
  switch (ctx.mode) {
    case 'pvp':
      return 1.2 + Math.random() * 0.4;
    case 'tournament':
      if (ctx.tournamentRound === '2') return 0.85;
      return 1.0;
    case 'league':
      if (ctx.leagueTier === 'core') return 0.8;
      if (ctx.leagueTier === 'nebula') return 0.9;
      return 1.0;
    default:
      return 1.0;
  }
}
