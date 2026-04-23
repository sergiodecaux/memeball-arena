// src/types/MatchResult.ts
// ✅ ИЗМЕНЕНО: Добавлено поле masteryXP для Faction Mastery системы (v9)

import { PlayerNumber } from './index';

// 🆕 Типизация достижений
export interface Achievement {
  id: string;
  iconKey?: string; // ✅ PNG иконка (опционально)
  name: string;
  description: string;
  icon: string; // Эмодзи для fallback
  unlockedAt: number;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  count?: number; // ✅ Количество разблокировок (для повторяемых)
  isFirstTime?: boolean; // ✅ Флаг первого разблокирования
}

// 🆕 Типизация наград
export interface MatchRewards {
  coins: number;
  xp: number;
  crystals?: number;
}

// 🆕 Причины окончания матча
export type MatchEndReason = 
  // Технические / Системные
  | 'time_up'
  | 'score_limit'
  | 'surrender'
  | 'disconnect'
  | 'win_condition_met'
  | 'opponent_left'
  // Результаты матча (ResultHelper / MatchResultHelper)
  | 'draw'
  | 'victory'
  | 'defeat'
  | 'time'
  | 'score'
  // Кампания
  | 'campaign_end'
  | 'campaign_win'
  | 'campaign_lose';

// ✅ НОВОЕ: Интерфейс для данных Mastery XP
export interface MasteryXPData {
  /** Общее количество заработанного XP */
  totalXP: number;
  /** Детализация начисления */
  breakdown: {
    baseXP: number;
    winBonus: number;
    goalBonus: number;
    cleanSheetBonus: number;
  };
  /** Фракция, для которой начислен XP */
  factionId?: string;
}

// ✅ НОВОЕ: Интерфейс для результата повышения уровня
export interface MasteryLevelUpData {
  oldLevel: number;
  newLevel: number;
  newSlotUnlocked: boolean;
  unlockedSlotIndex: number | null;
  rewards: Array<{
    type: 'coins' | 'crystals' | 'card' | 'unit';
    amount?: number;
    itemId?: string;
  }>;
}

export interface MatchResult {
  // === Основной результат ===
  winner: PlayerNumber | null;
  isWin: boolean;
  isDraw: boolean;
  
  // === Счёт ===
  playerGoals: number;
  opponentGoals: number;
  
  // === Награды ===
  xpEarned: number;
  coinsEarned: number;
  rewards?: MatchRewards;
  
  // === Достижения ===
  isPerfectGame: boolean;
  newAchievements: Achievement[];
  
  // === Мета-информация ===
  reason?: MatchEndReason;
  message?: string;
  isPvP?: boolean;
  matchDuration?: number;  // 🆕 Длительность матча в секундах
  
  // === PvP поля ===
  pvpRatingChange?: number;  // Изменение MMR
  pvpNewRating?: number;     // Новый рейтинг
  pvpOpponentName?: string;  // Имя оппонента
  
  // === Поля кампании ===
  isCampaign?: boolean;
  starsEarned?: number;
  isFirstClear?: boolean;
  unlockedNextLevel?: boolean;
  unlockedNextChapter?: boolean;
  levelName?: string;
  unlockedUnitId?: string;
  unlockedSkinId?: string;
  
  // ✅ НОВОЕ: Faction Mastery данные (v9)
  /** XP мастерства фракции, заработанный в матче */
  masteryXP?: MasteryXPData;
  /** Данные о повышении уровня мастерства (если произошло) */
  masteryLevelUp?: MasteryLevelUpData;
}