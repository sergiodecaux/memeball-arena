// src/types/league.ts
// Типы для системы Galaxy League

export enum LeagueTier {
  METEORITE = 'meteorite',
  COMET = 'comet',
  PLANET = 'planet',
  STAR = 'star',
  NEBULA = 'nebula',
  CORE = 'core',
}

export interface LeagueProgress {
  currentTier: LeagueTier;
  division: 1 | 2 | 3;         // 3 - нижний дивизион
  stars: number;               // 0..maxStars
  maxStars: number;            // обычно 5
  seasonBestTier: LeagueTier;  // лучшая лига за сезон
  stabilizationCount: number;  // сколько раз платил за Orbit Stabilization
}

export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

/**
 * Маппинг сложности AI для каждой лиги
 */
export const LEAGUE_AI_DIFFICULTY: Record<LeagueTier, AIDifficulty> = {
  [LeagueTier.METEORITE]: 'easy',
  [LeagueTier.COMET]: 'medium',
  [LeagueTier.PLANET]: 'medium',
  [LeagueTier.STAR]: 'hard',
  [LeagueTier.NEBULA]: 'expert',
  [LeagueTier.CORE]: 'expert',
};

/**
 * 🎮 Размер команды (количество фишек) для каждой лиги
 * Чем выше лига, тем больше фишек в команде
 */
export const LEAGUE_TEAM_SIZE: Record<LeagueTier, number> = {
  [LeagueTier.METEORITE]: 3, // Начальная лига - 3 фишки
  [LeagueTier.COMET]: 3,      // Низкая лига - 3 фишки
  [LeagueTier.PLANET]: 4,     // Средняя лига - 4 фишки
  [LeagueTier.STAR]: 5,       // Топ лига - 5 фишек
  [LeagueTier.NEBULA]: 5,     // Топ лига - 5 фишек
  [LeagueTier.CORE]: 5,       // Высшая лига - 5 фишек
};

/**
 * 💰 Взнос (entry fee) для участия в матче лиги
 * Победитель получает свой взнос обратно + взнос противника (x2)
 */
export const LEAGUE_ENTRY_FEE: Record<LeagueTier, Record<1 | 2 | 3, number>> = {
  [LeagueTier.METEORITE]: {
    3: 100,    // Division III - 100 золота
    2: 150,    // Division II - 150 золота
    1: 200,    // Division I - 200 золота
  },
  [LeagueTier.COMET]: {
    3: 250,    // Division III - 250 золота
    2: 350,    // Division II - 350 золота
    1: 500,    // Division I - 500 золота
  },
  [LeagueTier.PLANET]: {
    3: 750,    // Division III - 750 золота
    2: 1000,   // Division II - 1000 золота
    1: 1500,   // Division I - 1500 золота
  },
  [LeagueTier.STAR]: {
    3: 2500,   // Division III - 2500 золота
    2: 4000,   // Division II - 4000 золота
    1: 6000,   // Division I - 6000 золота
  },
  [LeagueTier.NEBULA]: {
    3: 10000,  // Division III - 10000 золота
    2: 15000,  // Division II - 15000 золота
    1: 25000,  // Division I - 25000 золота
  },
  [LeagueTier.CORE]: {
    3: 50000,  // Division III - 50000 золота
    2: 75000,  // Division II - 75000 золота
    1: 100000, // Division I - 100000 золота
  },
};

/**
 * 🛡️ Стоимость выкупа звезды (Star Buyback) при поражении
 * В низших лигах - золото, в топовых - кристаллы
 */
export const LEAGUE_STAR_BUYBACK: Record<LeagueTier, { type: 'coins' | 'crystals'; amount: number }> = {
  [LeagueTier.METEORITE]: { type: 'coins', amount: 300 },     // 3x entry fee
  [LeagueTier.COMET]: { type: 'coins', amount: 1000 },        // ~3x entry fee
  [LeagueTier.PLANET]: { type: 'coins', amount: 3000 },       // 3x entry fee
  [LeagueTier.STAR]: { type: 'crystals', amount: 10 },        // Топ лига - кристаллы
  [LeagueTier.NEBULA]: { type: 'crystals', amount: 25 },      // Топ лига - кристаллы
  [LeagueTier.CORE]: { type: 'crystals', amount: 50 },        // Высшая лига - кристаллы
};

/**
 * Создаёт дефолтный LeagueProgress
 */
export function createDefaultLeagueProgress(): LeagueProgress {
  return {
    currentTier: LeagueTier.METEORITE,
    division: 3,
    stars: 0,
    maxStars: 5,
    seasonBestTier: LeagueTier.METEORITE,
    stabilizationCount: 0,
  };
}

/**
 * Получить порядковый номер лиги (для сравнения)
 */
export function getLeagueTierOrder(tier: LeagueTier): number {
  const order: Record<LeagueTier, number> = {
    [LeagueTier.METEORITE]: 1,
    [LeagueTier.COMET]: 2,
    [LeagueTier.PLANET]: 3,
    [LeagueTier.STAR]: 4,
    [LeagueTier.NEBULA]: 5,
    [LeagueTier.CORE]: 6,
  };
  return order[tier];
}

/**
 * Получить следующую лигу (для повышения)
 */
export function getNextLeagueTier(tier: LeagueTier): LeagueTier | null {
  const order = getLeagueTierOrder(tier);
  if (order >= 6) return null; // CORE - максимальная лига
  
  const tiers: LeagueTier[] = [
    LeagueTier.METEORITE,
    LeagueTier.COMET,
    LeagueTier.PLANET,
    LeagueTier.STAR,
    LeagueTier.NEBULA,
    LeagueTier.CORE,
  ];
  return tiers[order];
}

/**
 * Получить предыдущую лигу (для понижения)
 */
export function getPreviousLeagueTier(tier: LeagueTier): LeagueTier | null {
  const order = getLeagueTierOrder(tier);
  if (order <= 1) return null; // METEORITE - минимальная лига
  
  const tiers: LeagueTier[] = [
    LeagueTier.METEORITE,
    LeagueTier.COMET,
    LeagueTier.PLANET,
    LeagueTier.STAR,
    LeagueTier.NEBULA,
    LeagueTier.CORE,
  ];
  return tiers[order - 2];
}

