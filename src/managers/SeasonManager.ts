// src/managers/SeasonManager.ts
// Менеджер системы сезонов (14 дней)

import { SeasonState, isSeasonEnded, createNewSeasonState, SEASON_DURATION_MS } from '../types/season';
import { LeagueProgress, LeagueTier, getLeagueTierOrder, getPreviousLeagueTier } from '../types/league';
import { PlayerData } from '../data/PlayerData';

// ========== КЛАСС МЕНЕДЖЕРА ==========

export class SeasonManager {
  /**
   * Проверяет и обрабатывает окончание сезона
   * Выполняет soft reset: понижает всех игроков на 1 лигу
   * 
   * @param playerData - данные игрока
   * @returns обновлённые данные игрока (если сезон закончился)
   */
  static processSeasonEnd(playerData: PlayerData): {
    updated: boolean;
    playerData: PlayerData;
    seasonReward?: {
      bestTier: LeagueTier;
      // Можно добавить другие награды (сундук, монеты и т.д.)
    };
  } {
    const seasonState = playerData.seasonState;
    const leagueProgress = playerData.leagueProgress;

    if (!seasonState || !leagueProgress) {
      // Если нет данных сезона или лиги, создаём новые
      const newSeasonState = createNewSeasonState();
      return {
        updated: true,
        playerData: {
          ...playerData,
          seasonState: newSeasonState,
          leagueProgress: leagueProgress || {
            currentTier: LeagueTier.METEORITE,
            division: 3,
            stars: 0,
            maxStars: 5,
            seasonBestTier: LeagueTier.METEORITE,
            stabilizationCount: 0,
          },
        },
      };
    }

    if (!isSeasonEnded(seasonState)) {
      // Сезон ещё не закончился
      return { updated: false, playerData };
    }

    // Сезон закончился - выполняем soft reset
    const bestTier = leagueProgress.seasonBestTier;
    const newLeagueProgress = this.applySoftReset(leagueProgress);
    const newSeasonState = createNewSeasonState();

    // Создаём награду за сезон (пока просто логируем, можно добавить сундук)
    const seasonReward = {
      bestTier,
    };

    const updatedPlayerData: PlayerData = {
      ...playerData,
      seasonState: newSeasonState,
      leagueProgress: newLeagueProgress,
    };

    return {
      updated: true,
      playerData: updatedPlayerData,
      seasonReward,
    };
  }

  /**
   * Применяет soft reset: понижает игрока на 1 лигу (минимум Meteorite)
   * 
   * @param progress - текущий прогресс лиги
   * @returns новый прогресс после reset
   */
  private static applySoftReset(progress: LeagueProgress): LeagueProgress {
    const newProgress = { ...progress };

    // Понижаем лигу на 1 (минимум Meteorite)
    const previousTier = getPreviousLeagueTier(newProgress.currentTier);
    if (previousTier) {
      newProgress.currentTier = previousTier;
    } else {
      // Уже в минимальной лиге (Meteorite), не понижаем
      newProgress.currentTier = LeagueTier.METEORITE;
    }

    // Сбрасываем дивизион на III и звёзды на 0
    newProgress.division = 3;
    newProgress.stars = 0;

    // Обновляем лучшую лигу сезона на новую текущую лигу
    newProgress.seasonBestTier = newProgress.currentTier;

    // Счётчик стабилизаций можно оставить или сбросить (по GDD оставляем)
    // newProgress.stabilizationCount = 0;

    return newProgress;
  }

  /**
   * Получить оставшееся время до конца сезона (в миллисекундах)
   */
  static getTimeUntilSeasonEnd(seasonState: SeasonState): number {
    const now = Date.now();
    const timeLeft = seasonState.endTimestamp - now;
    return Math.max(0, timeLeft);
  }

  /**
   * Получить прогресс сезона (0..1)
   */
  static getSeasonProgress(seasonState: SeasonState): number {
    const now = Date.now();
    const elapsed = now - (seasonState.endTimestamp - SEASON_DURATION_MS);
    return Math.min(1, Math.max(0, elapsed / SEASON_DURATION_MS));
  }
}

