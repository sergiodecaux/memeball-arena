// src/types/season.ts
// Типы для системы сезонов

export interface SeasonState {
  seasonId: string;          // UUID или таймстамп старта
  endTimestamp: number;      // ms
  lastProcessedAt: number;   // ms
}

/**
 * Длительность сезона в миллисекундах (14 дней)
 */
export const SEASON_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Создаёт новый SeasonState
 */
export function createNewSeasonState(): SeasonState {
  const now = Date.now();
  return {
    seasonId: `season_${now}`,
    endTimestamp: now + SEASON_DURATION_MS,
    lastProcessedAt: now,
  };
}

/**
 * Проверяет, закончился ли сезон
 */
export function isSeasonEnded(seasonState: SeasonState): boolean {
  return Date.now() > seasonState.endTimestamp;
}

