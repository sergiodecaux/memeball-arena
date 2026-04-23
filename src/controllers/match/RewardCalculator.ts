// src/controllers/match/RewardCalculator.ts
// 💰 Расчёт наград за матч
// ✅ ИЗМЕНЕНО: Добавлен расчёт Faction Mastery XP (v9)

import { PlayerNumber } from '../../types';
import { LevelConfig } from '../../types/CampaignTypes';
import { Achievement, MasteryXPData } from '../../types/MatchResult';
import { playerData } from '../../data/PlayerData';
import { FactionId } from '../../constants/gameConstants';
import { FactionMasteryManager, MatchPerformance } from '../../managers/FactionMasteryManager';

export interface MatchStats {
  winner: PlayerNumber | null;
  playerGoals: number;
  opponentGoals: number;
  matchDurationSeconds: number;
  shotsCount: number;
  isSurrender: boolean;
  // ✅ ДОБАВЛЕНО: Фракция игрока для расчёта Mastery
  playerFaction?: FactionId;
  // ✅ ДОБАВЛЕНО: Тип матча для расчёта XP множителя
  matchType?: 'quick' | 'campaign' | 'pvp';
}

export interface RewardResult {
  xpEarned: number;
  coinsEarned: number;
  crystalsEarned: number;
  isPerfectGame: boolean;
  newAchievements: Achievement[];
  bonuses: Array<{ name: string; amount: number; type: 'xp' | 'coins' }>;
  // ✅ ИСПРАВЛЕНО: Используем MasteryXPData из MatchResult.ts
  masteryXP?: MasteryXPData;
}

export interface CampaignRewardResult extends RewardResult {
  starsEarned: number;
  isFirstClear: boolean;
  unlockedUnitId?: string;
  unlockedSkinId?: string;
}

// ✅ ДОБАВЛЕНО: Результат применения наград
export interface ApplyRewardsResult {
  rewards: RewardResult;
  masteryLevelUp?: {
    oldLevel: number;
    newLevel: number;
    newSlotUnlocked: boolean;
    rewards: any[];
  };
}

export class RewardCalculator {
  // Базовые награды
  private static readonly BASE_WIN_XP = 80;
  private static readonly BASE_WIN_COINS = 150;
  private static readonly BASE_DRAW_XP = 40;
  private static readonly BASE_DRAW_COINS = 75;
  private static readonly BASE_LOSS_XP = 20;
  private static readonly BASE_LOSS_COINS = 30;
  
  // Бонусы
  private static readonly PERFECT_GAME_XP = 40;
  private static readonly PERFECT_GAME_COINS = 100;
  private static readonly GOAL_XP = 12;
  private static readonly GOAL_COINS = 15;
  
  // =====================================================
  // 🏆 TOURNAMENT REWARDS: Повышенные награды для турниров
  // =====================================================
  private static readonly TOURNAMENT_WIN_MULTIPLIER = 2.5;  // x2.5 за победу
  private static readonly TOURNAMENT_DRAW_MULTIPLIER = 2.0; // x2.0 за ничью
  private static readonly TOURNAMENT_LOSS_MULTIPLIER = 1.5; // x1.5 за поражение

  /**
   * Рассчитать награды за стандартный матч
   */
  static calculateStandardRewards(stats: MatchStats): RewardResult {
    const isWin = stats.winner === 1;
    const isDraw = stats.winner === null && !stats.isSurrender;
    const isPerfectGame = isWin && stats.opponentGoals === 0;
    
    let xpEarned = 0;
    let coinsEarned = 0;
    const bonuses: RewardResult['bonuses'] = [];
    
    // Базовые награды
    if (isWin) {
      xpEarned += this.BASE_WIN_XP;
      coinsEarned += this.BASE_WIN_COINS;
      bonuses.push({ name: 'Victory', amount: this.BASE_WIN_COINS, type: 'coins' });
    } else if (isDraw) {
      xpEarned += this.BASE_DRAW_XP;
      coinsEarned += this.BASE_DRAW_COINS;
      bonuses.push({ name: 'Draw', amount: this.BASE_DRAW_COINS, type: 'coins' });
    } else {
      xpEarned += this.BASE_LOSS_XP;
      coinsEarned += this.BASE_LOSS_COINS;
      bonuses.push({ name: 'Participation', amount: this.BASE_LOSS_COINS, type: 'coins' });
    }
    
    // Бонус за идеальную игру
    if (isPerfectGame) {
      xpEarned += this.PERFECT_GAME_XP;
      coinsEarned += this.PERFECT_GAME_COINS;
      bonuses.push({ name: 'Clean Sheet', amount: this.PERFECT_GAME_COINS, type: 'coins' });
    }
    
    // Бонус за голы
    const goalBonus = stats.playerGoals * this.GOAL_COINS;
    if (stats.playerGoals > 0) {
      xpEarned += stats.playerGoals * this.GOAL_XP;
      coinsEarned += goalBonus;
      bonuses.push({ name: `${stats.playerGoals} Goals`, amount: goalBonus, type: 'coins' });
    }
    
    // Проверяем достижения
    const newAchievements = this.checkAchievements(stats);
    
    // ✅ ДОБАВЛЕНО: Рассчитываем Mastery XP
    const masteryXP = this.calculateMasteryXP(stats);
    
    return {
      xpEarned,
      coinsEarned,
      crystalsEarned: 0,
      isPerfectGame,
      newAchievements,
      bonuses,
      masteryXP,
    };
  }

  /**
   * Рассчитать минимальные награды за тренировочный матч с AI (custom режим)
   * - 100 золота за победу, 0 за поражение
   * - Без достижений
   * - Без XP
   * - Без Mastery XP
   */
  static calculateCustomRewards(stats: MatchStats): RewardResult {
    const isWin = stats.winner === 1;
    
    const coinsEarned = isWin ? 100 : 0;
    const bonuses: RewardResult['bonuses'] = [];
    
    if (isWin) {
      bonuses.push({ name: 'Training Victory', amount: 100, type: 'coins' });
    }
    
    return {
      xpEarned: 0,
      coinsEarned,
      crystalsEarned: 0,
      isPerfectGame: false,
      newAchievements: [], // Не начисляем достижения
      bonuses,
      masteryXP: undefined, // Не начисляем Mastery XP
    };
  }

  /**
   * ✅ ИСПРАВЛЕНО: Рассчитать Mastery XP с правильным breakdown (соответствует MasteryXPData)
   */
  private static calculateMasteryXP(stats: MatchStats): MasteryXPData | undefined {
    // Если фракция не указана — не считаем mastery
    if (!stats.playerFaction) {
      return undefined;
    }
    
    const isWin = stats.winner === 1;
    const isCleanSheet = stats.opponentGoals === 0;
    
    // ✅ ИСПРАВЛЕНО: Создаём MatchPerformance с ВСЕМИ обязательными полями
    const performanceData: MatchPerformance = {
      isWin: isWin,
      goalsScored: stats.playerGoals,
      goalsConceded: stats.opponentGoals,
      isCleanSheet: isCleanSheet,
      matchType: stats.matchType || 'quick', // ✅ Добавлено обязательное поле
    };
    
    // calculateMatchXP возвращает XPBreakdown
    const xpBreakdown = FactionMasteryManager.calculateMatchXP(performanceData);
    
    // ✅ ИСПРАВЛЕНО: Маппинг в формат MasteryXPData из MatchResult.ts
    return {
      totalXP: xpBreakdown.total,
      breakdown: {
        baseXP: xpBreakdown.base,
        winBonus: xpBreakdown.winBonus,
        goalBonus: xpBreakdown.goalBonus,
        cleanSheetBonus: xpBreakdown.cleanSheetBonus,
      },
      factionId: stats.playerFaction,
    };
  }

  /**
   * =====================================================
   * 🏆 Рассчитать награды за турнирный матч (повышенные)
   * =====================================================
   */
  static calculateTournamentRewards(stats: MatchStats): RewardResult {
    const isWin = stats.winner === 1;
    const isDraw = stats.winner === null && !stats.isSurrender;
    const isPerfectGame = isWin && stats.opponentGoals === 0;
    
    let xpEarned = 0;
    let coinsEarned = 0;
    const bonuses: RewardResult['bonuses'] = [];
    
    // Базовые награды с множителем
    if (isWin) {
      xpEarned += Math.floor(this.BASE_WIN_XP * this.TOURNAMENT_WIN_MULTIPLIER);
      coinsEarned += Math.floor(this.BASE_WIN_COINS * this.TOURNAMENT_WIN_MULTIPLIER);
      bonuses.push({ 
        name: 'Tournament Victory', 
        amount: Math.floor(this.BASE_WIN_COINS * this.TOURNAMENT_WIN_MULTIPLIER), 
        type: 'coins' 
      });
    } else if (isDraw) {
      xpEarned += Math.floor(this.BASE_DRAW_XP * this.TOURNAMENT_DRAW_MULTIPLIER);
      coinsEarned += Math.floor(this.BASE_DRAW_COINS * this.TOURNAMENT_DRAW_MULTIPLIER);
      bonuses.push({ 
        name: 'Tournament Draw', 
        amount: Math.floor(this.BASE_DRAW_COINS * this.TOURNAMENT_DRAW_MULTIPLIER), 
        type: 'coins' 
      });
    } else {
      xpEarned += Math.floor(this.BASE_LOSS_XP * this.TOURNAMENT_LOSS_MULTIPLIER);
      coinsEarned += Math.floor(this.BASE_LOSS_COINS * this.TOURNAMENT_LOSS_MULTIPLIER);
      bonuses.push({ 
        name: 'Tournament Participation', 
        amount: Math.floor(this.BASE_LOSS_COINS * this.TOURNAMENT_LOSS_MULTIPLIER), 
        type: 'coins' 
      });
    }
    
    // Бонус за идеальную игру (также увеличен)
    if (isPerfectGame) {
      const perfectBonus = Math.floor(this.PERFECT_GAME_COINS * this.TOURNAMENT_WIN_MULTIPLIER);
      xpEarned += Math.floor(this.PERFECT_GAME_XP * this.TOURNAMENT_WIN_MULTIPLIER);
      coinsEarned += perfectBonus;
      bonuses.push({ name: 'Clean Sheet', amount: perfectBonus, type: 'coins' });
    }
    
    // Бонус за голы (также увеличен)
    const goalBonus = Math.floor(stats.playerGoals * this.GOAL_COINS * this.TOURNAMENT_WIN_MULTIPLIER);
    if (stats.playerGoals > 0) {
      xpEarned += Math.floor(stats.playerGoals * this.GOAL_XP * this.TOURNAMENT_WIN_MULTIPLIER);
      coinsEarned += goalBonus;
      bonuses.push({ name: 'Goals', amount: goalBonus, type: 'coins' });
    }
    
    // Проверяем достижения
    const newAchievements = this.checkAchievements(stats);
    
    // Mastery XP
    const masteryXP = this.calculateMasteryXP(stats);
    
    return {
      xpEarned,
      coinsEarned,
      crystalsEarned: 0,
      isPerfectGame,
      newAchievements,
      bonuses,
      masteryXP,
    };
  }

  /**
   * 💰 Рассчитать награды за матч лиги (с учетом взноса)
   * Победитель получает x2 взноса + базовые награды
   */
  static calculateLeagueRewards(stats: MatchStats, entryFee: number): RewardResult {
    const isWin = stats.winner === 1;
    const isDraw = stats.winner === null && !stats.isSurrender;
    const isPerfectGame = isWin && stats.opponentGoals === 0;
    
    let xpEarned = 0;
    let coinsEarned = 0;
    const bonuses: RewardResult['bonuses'] = [];
    
    // 💰 Выигрыш от взноса (только при победе!)
    if (isWin) {
      const winnings = entryFee * 2; // Свой взнос + взнос противника
      coinsEarned += winnings;
      bonuses.push({ 
        name: `Ranked Victory (${entryFee.toLocaleString()} x2)`, 
        amount: winnings, 
        type: 'coins' 
      });
      
      // Базовый XP за победу
      xpEarned += this.BASE_WIN_XP;
    } else if (isDraw) {
      // При ничьей возвращаем взнос обратно (без множителя)
      coinsEarned += entryFee;
      bonuses.push({ 
        name: 'Entry Fee Refund (Draw)', 
        amount: entryFee, 
        type: 'coins' 
      });
      xpEarned += this.BASE_DRAW_XP;
    } else {
      // При поражении взнос потерян (уже списан до матча)
      // Минимальное утешительное XP
      xpEarned += this.BASE_LOSS_XP;
    }
    
    // Бонус за идеальную игру
    if (isPerfectGame) {
      xpEarned += this.PERFECT_GAME_XP;
      coinsEarned += this.PERFECT_GAME_COINS;
      bonuses.push({ name: 'Clean Sheet', amount: this.PERFECT_GAME_COINS, type: 'coins' });
    }
    
    // Бонус за голы
    if (stats.playerGoals > 0) {
      const goalBonus = stats.playerGoals * this.GOAL_COINS;
      xpEarned += stats.playerGoals * this.GOAL_XP;
      coinsEarned += goalBonus;
      bonuses.push({ name: 'Goals', amount: goalBonus, type: 'coins' });
    }
    
    // Проверяем достижения
    const newAchievements = this.checkAchievements(stats);
    
    // Mastery XP
    const masteryXP = this.calculateMasteryXP(stats);
    
    return {
      xpEarned,
      coinsEarned,
      crystalsEarned: 0,
      isPerfectGame,
      newAchievements,
      bonuses,
      masteryXP,
    };
  }

  /**
   * Рассчитать награды за уровень кампании
   */
  static calculateCampaignRewards(
    stats: MatchStats,
    levelConfig: LevelConfig,
    isFirstClear: boolean
  ): CampaignRewardResult {
    // ✅ Устанавливаем тип матча для кампании
    const campaignStats: MatchStats = {
      ...stats,
      matchType: 'campaign',
    };
    
    const isWin = campaignStats.winner === 1;
    const starsEarned = isWin ? this.calculateStars(campaignStats, levelConfig) : 0;
    
    const reward = levelConfig.reward;
    
    let coinsEarned = isFirstClear ? reward.firstClearCoins : reward.replayCoins;
    let xpEarned = isFirstClear ? reward.firstClearXP : reward.replayXP;
    
    const bonuses: RewardResult['bonuses'] = [];
    
    if (isFirstClear) {
      bonuses.push({ name: 'First Clear', amount: reward.firstClearCoins, type: 'coins' });
    } else {
      bonuses.push({ name: 'Replay', amount: reward.replayCoins, type: 'coins' });
    }
    
    // Бонус за 3 звезды
    if (starsEarned === 3 && reward.perfectBonus) {
      coinsEarned += reward.perfectBonus;
      bonuses.push({ name: 'Perfect!', amount: reward.perfectBonus, type: 'coins' });
    }
    
    // Бонус за голы
    const goalBonus = campaignStats.playerGoals * this.GOAL_COINS;
    if (campaignStats.playerGoals > 0) {
      xpEarned += campaignStats.playerGoals * this.GOAL_XP;
      coinsEarned += goalBonus;
      bonuses.push({ name: `${campaignStats.playerGoals} Goals`, amount: goalBonus, type: 'coins' });
    }
    
    const newAchievements = this.checkAchievements(campaignStats);
    
    // ✅ Рассчитываем Mastery XP для кампании (с правильным matchType)
    const masteryXP = this.calculateMasteryXP(campaignStats);
    
    return {
      xpEarned,
      coinsEarned,
      crystalsEarned: 0,
      isPerfectGame: isWin && campaignStats.opponentGoals === 0,
      newAchievements,
      bonuses,
      masteryXP,
      starsEarned,
      isFirstClear,
      unlockedUnitId: isFirstClear ? reward.unlockUnitId : undefined,
      unlockedSkinId: isFirstClear ? reward.unlockSkinId : undefined,
    };
  }

  /**
   * Рассчитать звёзды
   */
  private static calculateStars(stats: MatchStats, levelConfig: LevelConfig): number {
    if (stats.winner !== 1) return 0;
    
    const criteria = levelConfig.starCriteria;
    let stars = 1;
    
    // 2 звезды
    if (criteria.twoStarsValue !== undefined) {
      if (stats.opponentGoals <= criteria.twoStarsValue) {
        stars = 2;
      }
    }
    
    // 3 звезды
    if (criteria.threeStarsValue !== undefined && stars >= 2) {
      if (stats.opponentGoals <= criteria.threeStarsValue) {
        stars = 3;
      }
    }
    
    return stars;
  }

  /**
   * ✅ ИСПРАВЛЕНО: Проверить достижения (учитывает текущий матч) + PNG иконки + Русский язык
   */
  private static checkAchievements(stats: MatchStats): Achievement[] {
    const achievements: Achievement[] = [];
    const playerStats = playerData.get().stats;
    
    const tryUnlock = (
      id: string,
      iconKey: string,
      name: string,
      description: string,
      icon: string,
      rarity: Achievement['rarity'] = 'common'
    ): void => {
      const isFirstTime = playerData.unlockAchievement(id);
      const count = playerData.getAchievementCount(id);
      
      // ✅ ВСЕГДА добавляем в массив (даже для повторных)
      achievements.push({
        id,
        iconKey, // ✅ PNG иконка
        name,
        description,
        icon, // ✅ Эмодзи для fallback
        unlockedAt: Date.now(),
        rarity,
        count, // ✅ Количество разблокировок
        isFirstTime, // ✅ Флаг первого разблокирования
      });
      
      if (isFirstTime) {
        console.log(`🏆 Достижение разблокировано: ${name} (${id}) x${count}`);
      } else {
        console.log(`🔄 Достижение повторено: ${name} (${id}) x${count}`);
      }
    };
    
    const isWin = stats.winner === 1;
    const isDraw = stats.winner === null;
    
    // ✅ Первая победа (проверяем что это первая победа ПОСЛЕ обновления статистики)
    if (isWin && playerStats.wins === 1) {
      tryUnlock(
        'first_victory',
        'achievement_first_victory',
        'Первая победа!',
        'Одержи свою первую победу',
        '🏆',
        'common'
      );
    }
    
    // ✅ Голы в текущем матче
    if (stats.playerGoals >= 3) {
      tryUnlock(
        'hat_trick',
        'achievement_hat_trick',
        'Хет-трик!',
        'Забей 3 гола в одном матче',
        '⚽',
        'common'
      );
    }
    
    if (stats.playerGoals >= 5) {
      tryUnlock(
        'goal_spree',
        'achievement_goal_spree',
        'Голевой пир!',
        'Забей 5 голов в одном матче',
        '🔥',
        'rare'
      );
    }
    
    if (stats.playerGoals >= 7) {
      tryUnlock(
        'goal_machine',
        'achievement_goal_machine',
        'Машина голов!',
        'Забей 7 голов в одном матче',
        '💥',
        'epic'
      );
    }
    
    if (stats.playerGoals >= 10) {
      tryUnlock(
        'unstoppable_scorer',
        'achievement_goal_scorer',
        'Неудержимый бомбардир!',
        'Забей 10 голов в одном матче',
        '🌟',
        'legendary'
      );
    }
    
    // ✅ Сухой матч
    if (isWin && stats.opponentGoals === 0) {
      tryUnlock(
        'clean_sheet',
        'achievement_clean_sheet',
        'Чистый лист!',
        'Победи, не пропустив ни одного гола',
        '🧤',
        'common'
      );
    }
    
    // ✅ Серия побед (проверяем текущую серию)
    if (playerStats.currentWinStreak >= 3 && isWin) {
      tryUnlock(
        'win_streak_3',
        'achievement_win_streak',
        'Серия побед!',
        'Выиграй 3 матча подряд',
        '🔥',
        'rare'
      );
    }
    
    if (playerStats.currentWinStreak >= 5 && isWin) {
      tryUnlock(
        'win_streak_5',
        'achievement_win_streak_epic',
        'Непобедимый!',
        'Выиграй 5 матчей подряд',
        '⚡',
        'epic'
      );
    }
    
    if (playerStats.currentWinStreak >= 10 && isWin) {
      tryUnlock(
        'win_streak_10',
        'achievement_win_streak_legendary',
        'Легендарная серия!',
        'Выиграй 10 матчей подряд',
        '👑',
        'legendary'
      );
    }
    
    // ✅ Всего голов забито
    if (playerStats.goalsScored >= 10) {
      tryUnlock(
        'scorer_10',
        'achievement_first_goal',
        'Бомбардир',
        'Забей 10 голов (всего)',
        '⚽',
        'common'
      );
    }
    
    if (playerStats.goalsScored >= 50) {
      tryUnlock(
        'scorer_50',
        'achievement_goal_scorer',
        'Мастер атаки',
        'Забей 50 голов (всего)',
        '🏅',
        'rare'
      );
    }
    
    if (playerStats.goalsScored >= 100) {
      tryUnlock(
        'scorer_100',
        'achievement_goal_machine',
        'Король голов',
        'Забей 100 голов (всего)',
        '👑',
        'epic'
      );
    }
    
    // ✅ Всего побед
    if (playerStats.wins >= 5) {
      tryUnlock(
        'wins_5',
        'achievement_loyal_player',
        'Опытный игрок',
        'Одержи 5 побед',
        '🎮',
        'common'
      );
    }
    
    if (playerStats.wins >= 10) {
      tryUnlock(
        'wins_10',
        'achievement_veteran',
        'Ветеран',
        'Одержи 10 побед',
        '🏆',
        'rare'
      );
    }
    
    if (playerStats.wins >= 25) {
      tryUnlock(
        'wins_25',
        'achievement_rising_star',
        'Чемпион',
        'Одержи 25 побед',
        '🌟',
        'epic'
      );
    }
    
    if (playerStats.wins >= 50) {
      tryUnlock(
        'wins_50',
        'achievement_master',
        'Легенда',
        'Одержи 50 побед',
        '💎',
        'legendary'
      );
    }
    
    // ✅ Идеальные матчи (на ноль)
    if (playerStats.perfectGames >= 5) {
      tryUnlock(
        'perfect_5',
        'achievement_perfect_defender',
        'Железная защита',
        'Выиграй 5 матчей "на ноль"',
        '🏰',
        'rare'
      );
    }
    
    if (playerStats.perfectGames >= 10) {
      tryUnlock(
        'perfect_10',
        'achievement_tank_wall',
        'Стена',
        'Выиграй 10 матчей "на ноль"',
        '🛡️',
        'epic'
      );
    }
    
    // ✅ ДОБАВЛЕНО: Достижения за Mastery
    if (stats.playerFaction) {
      const mastery = playerData.get().factionMastery?.[stats.playerFaction];
      if (mastery) {
        // Достигли уровня 3 (открыли 4-й слот)
        if (mastery.level >= 3) {
          tryUnlock(
            `mastery_${stats.playerFaction}_4slot`,
            'Squad Expansion',
            `Unlock 4th unit slot for ${stats.playerFaction}`,
            '📦',
            'rare'
          );
        }
        
        // Достигли уровня 6 (открыли 5-й слот)
        if (mastery.level >= 6) {
          tryUnlock(
            `mastery_${stats.playerFaction}_5slot`,
            'Full Squad',
            `Unlock 5th unit slot for ${stats.playerFaction}`,
            '🏅',
            'epic'
          );
        }
        
        // Достигли максимального уровня (10)
        if (mastery.level >= 10) {
          tryUnlock(
            `mastery_${stats.playerFaction}_max`,
            `${stats.playerFaction} Master`,
            `Reach max mastery level for ${stats.playerFaction}`,
            '👑',
            'legendary'
          );
        }
      }
    }
    
    return achievements;
  }

  /**
   * Рассчитать награды за PvP матч
   */
  static calculatePvPRewards(
    isWin: boolean,
    isDraw: boolean,
    playerGoals: number,
    opponentGoals: number,
    playerFaction?: FactionId
  ): RewardResult {
    // PvP имеет увеличенные награды
    const multiplier = 1.5;
    
    const stats: MatchStats = {
      winner: isWin ? 1 : isDraw ? null : 2,
      playerGoals,
      opponentGoals,
      matchDurationSeconds: 0,
      shotsCount: 0,
      isSurrender: false,
      playerFaction,
      matchType: 'pvp', // ✅ Устанавливаем тип матча
    };
    
    const base = this.calculateStandardRewards(stats);
    
    // ✅ ИСПРАВЛЕНО: Увеличиваем весь breakdown для PvP с правильными именами полей
    let masteryXP = base.masteryXP;
    if (masteryXP) {
      masteryXP = {
        totalXP: Math.floor(masteryXP.totalXP * multiplier),
        breakdown: {
          baseXP: Math.floor(masteryXP.breakdown.baseXP * multiplier),
          winBonus: Math.floor(masteryXP.breakdown.winBonus * multiplier),
          goalBonus: Math.floor(masteryXP.breakdown.goalBonus * multiplier),
          cleanSheetBonus: Math.floor(masteryXP.breakdown.cleanSheetBonus * multiplier),
        },
        factionId: masteryXP.factionId,
      };
    }
    
    return {
      ...base,
      xpEarned: Math.floor(base.xpEarned * multiplier),
      coinsEarned: Math.floor(base.coinsEarned * multiplier),
      masteryXP,
      bonuses: base.bonuses.map(b => ({
        ...b,
        amount: Math.floor(b.amount * multiplier),
      })),
    };
  }

  /**
   * ✅ НОВОЕ: Применить награды к PlayerData (включая Mastery XP)
   */
  static applyRewards(
    rewards: RewardResult,
    factionId?: FactionId
  ): ApplyRewardsResult {
    // Добавляем монеты и XP
    playerData.addCoins(rewards.coinsEarned);
    playerData.addXP(rewards.xpEarned);
    
    if (rewards.crystalsEarned > 0) {
      playerData.addCrystals(rewards.crystalsEarned);
    }
    
    let masteryLevelUp: ApplyRewardsResult['masteryLevelUp'] | undefined;
    
    // ✅ Применяем Mastery XP
    if (rewards.masteryXP && factionId) {
      const levelUpResult = playerData.addFactionXP(factionId, rewards.masteryXP.totalXP);
      
      if (levelUpResult) {
        masteryLevelUp = levelUpResult;
        console.log(`[RewardCalculator] 🎉 Mastery level up! ${factionId}: ${levelUpResult.oldLevel} → ${levelUpResult.newLevel}`);
        
        if (levelUpResult.newSlotUnlocked) {
          console.log(`[RewardCalculator] 🔓 New unit slot unlocked!`);
        }
      }
    }
    
    return {
      rewards,
      masteryLevelUp,
    };
  }

  /**
   * ✅ НОВОЕ: Применить награды кампании
   */
  static applyCampaignRewards(
    rewards: CampaignRewardResult,
    levelId: string,
    factionId?: FactionId
  ): ApplyRewardsResult {
    const baseResult = this.applyRewards(rewards, factionId);
    
    // ✅ ИСПРАВЛЕНО: unlockUnit → unlockUnitById
    if (rewards.unlockedUnitId) {
      playerData.unlockUnitById(rewards.unlockedUnitId);
      console.log(`[RewardCalculator] 🎁 Unlocked unit: ${rewards.unlockedUnitId}`);
    }
    
    // Разблокируем скин если есть
    if (rewards.unlockedSkinId) {
      playerData.unlockSkin(rewards.unlockedSkinId);
      console.log(`[RewardCalculator] 🎁 Unlocked skin: ${rewards.unlockedSkinId}`);
    }
    
    return baseResult;
  }
}