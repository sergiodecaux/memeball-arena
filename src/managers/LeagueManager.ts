// src/managers/LeagueManager.ts
// Менеджер системы Galaxy League

import { LeagueProgress, LeagueTier, getNextLeagueTier, getPreviousLeagueTier, getLeagueTierOrder } from '../types/league';
import { MatchResult } from '../types/MatchResult';

// ========== КОНСТАНТЫ СТОИМОСТИ СТАБИЛИЗАЦИИ ==========

export const ORBIT_STABILIZATION_COSTS: Record<LeagueTier, { coins: number; crystals?: number }> = {
  [LeagueTier.METEORITE]: { coins: 0 }, // Meteorite не требует стабилизации
  [LeagueTier.COMET]: { coins: 2000 },
  [LeagueTier.PLANET]: { coins: 5000 },
  [LeagueTier.STAR]: { coins: 12000 },
  [LeagueTier.NEBULA]: { coins: 30000 },
  [LeagueTier.CORE]: { coins: 0, crystals: 50 }, // Только за кристаллы
};

export interface PlayerCurrency {
  coins: number;
  crystals: number;
}

// ========== КЛАСС МЕНЕДЖЕРА ==========

export class LeagueManager {
  /**
   * Применяет результат матча к прогрессу лиги
   * 
   * @param progress - текущий прогресс лиги
   * @param result - результат матча
   * @param isWinStreak - есть ли победная серия (3+ подряд)
   * @returns новый прогресс лиги
   */
  static applyMatchResult(
    progress: LeagueProgress,
    result: MatchResult,
    isWinStreak: boolean
  ): LeagueProgress {
    const newProgress = { ...progress };
    
    if (result.isWin) {
      // Победа: +1 звезда, или +2 если есть победная серия
      const starsToAdd = isWinStreak ? 2 : 1;
      newProgress.stars += starsToAdd;
      
      // Проверяем переход на следующий дивизион/лигу
      while (newProgress.stars >= newProgress.maxStars) {
        // Переполнение звёзд - переходим на следующий уровень
        const overflow = newProgress.stars - newProgress.maxStars;
        
        if (newProgress.division > 1) {
          // Переход на следующий дивизион в той же лиге
          newProgress.division = (newProgress.division - 1) as 1 | 2 | 3;
          newProgress.stars = overflow;
        } else {
          // Повышение лиги (division === 1, переходим в следующую лигу)
          const nextTier = getNextLeagueTier(newProgress.currentTier);
          if (nextTier) {
            newProgress.currentTier = nextTier;
            newProgress.division = 3; // Начинаем с дивизиона III новой лиги
            newProgress.stars = overflow;
            
            // Обновляем лучшую лигу сезона
            if (getLeagueTierOrder(nextTier) > getLeagueTierOrder(newProgress.seasonBestTier)) {
              newProgress.seasonBestTier = nextTier;
            }
          } else {
            // Уже в максимальной лиге (CORE Division I), просто ограничиваем звёзды
            newProgress.stars = newProgress.maxStars;
            break; // Выходим из цикла
          }
        }
      }
      
    } else if (!result.isDraw && !result.isWin) {
      // Поражение: -1 звезда (кроме Meteorite)
      if (newProgress.currentTier !== LeagueTier.METEORITE) {
        newProgress.stars = Math.max(0, newProgress.stars - 1);
      }
      // Понижение обрабатывается отдельно через shouldTriggerOrbitDecay
      
    } else {
      // Ничья: 0 звёзд, но награды выдаются через RewardCalculator
      // Ничего не меняем в прогрессе
    }
    
    return newProgress;
  }
  
  /**
   * Проверяет, нужно ли показывать модал Orbit Decay
   * 
   * Условия:
   * - текущая лига ≠ Meteorite
   * - stars === 0 в конце матча (после применения результата)
   * - результат — поражение
   */
  static shouldTriggerOrbitDecay(progress: LeagueProgress, result: MatchResult): boolean {
    if (progress.currentTier === LeagueTier.METEORITE) {
      return false; // Meteorite не понижается
    }
    
    if (result.isWin || result.isDraw) {
      return false; // Только при поражении
    }
    
    // Проверяем, что звёзд стало 0 (progress уже обновлён в applyMatchResult)
    return progress.stars === 0;
  }
  
  /**
   * Применяет стабилизацию орбиты
   * Списывает валюту и оставляет игрока в текущей лиге/дивизионе с stars = 0
   * 
   * @param progress - текущий прогресс
   * @param currency - текущая валюта игрока
   * @returns новый прогресс и валюта
   */
  static applyOrbitStabilization(
    progress: LeagueProgress,
    currency: PlayerCurrency
  ): { progress: LeagueProgress; currency: PlayerCurrency } {
    const cost = ORBIT_STABILIZATION_COSTS[progress.currentTier];
    const newCurrency = { ...currency };
    
    if (cost.crystals) {
      // Core лига - только кристаллы
      if (newCurrency.crystals < cost.crystals) {
        throw new Error('Not enough crystals for orbit stabilization');
      }
      newCurrency.crystals -= cost.crystals;
    } else if (cost.coins > 0) {
      // Остальные лиги - монеты
      if (newCurrency.coins < cost.coins) {
        throw new Error('Not enough coins for orbit stabilization');
      }
      newCurrency.coins -= cost.coins;
    }
    
    const newProgress = { ...progress };
    newProgress.stars = 0; // Остаёмся в текущей лиге/дивизионе
    newProgress.stabilizationCount++; // Увеличиваем счётчик стабилизаций
    
    return {
      progress: newProgress,
      currency: newCurrency,
    };
  }
  
  /**
   * Применяет понижение лиги/дивизиона
   * Используется, когда игрок выбрал "УПАСТЬ" в Orbit Decay модале
   * 
   * @param progress - текущий прогресс
   * @returns новый прогресс после понижения
   */
  static applyDemotion(progress: LeagueProgress): LeagueProgress {
    const newProgress = { ...progress };
    
    // Понижаем дивизион или лигу
    if (newProgress.division < 3) {
      // Понижаем дивизион в текущей лиге (например, Division II → Division III)
      newProgress.division = (newProgress.division + 1) as 1 | 2 | 3;
      newProgress.stars = 0; // Начинаем с 0 звёзд в новом дивизионе
    } else {
      // Уже в Division III, понижаем лигу (например, Planet III → Comet I)
      const previousTier = getPreviousLeagueTier(newProgress.currentTier);
      if (previousTier) {
        newProgress.currentTier = previousTier;
        newProgress.division = 1; // Начинаем с дивизиона I предыдущей лиги
        newProgress.stars = 0;
      } else {
        // Уже в минимальной лиге (Meteorite), не понижаем - просто сбрасываем звёзды
        newProgress.stars = 0;
      }
    }
    
    return newProgress;
  }
  
  /**
   * Получить стоимость стабилизации для лиги
   */
  static getStabilizationCost(tier: LeagueTier): { coins: number; crystals?: number } {
    return ORBIT_STABILIZATION_COSTS[tier];
  }
}

