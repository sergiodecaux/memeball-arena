// src/scenes/game/MatchResultHelper.ts
import { MatchResult, MatchEndReason } from '../../types/MatchResult';
import { PlayerNumber } from '../../types';
import { LevelConfig, CampaignLevelResult } from '../../types/CampaignTypes';
import { PvPManager } from '../../managers/PvPManager';
import { PvPMode, PvPMatchResult, createDefaultPvPStats } from '../../types/pvp';
import { playerData } from '../../data/PlayerData';

export class GameResultFactory {
  
  /**
   * Результат матча по времени (Standard / vs AI)
   */
  static createTimeUpResult(
    winner: PlayerNumber | null, // null = Ничья
    scores: Record<number, number>
  ): MatchResult {
    const isDraw = winner === null;
    const isWin = winner === 1; // 1 - это игрок

    // Расчет наград согласно экономике игры
    let coins = 0;
    let xp = 0;

    if (isWin) {
      // Победа: 100 + 10 за гол
      coins = 100 + (scores[1] * 10);
      xp = 50 + (scores[1] * 10);
    } else if (isDraw) {
      // Ничья: 50 + 10 за гол
      coins = 50 + (scores[1] * 10); 
      xp = 25 + (scores[1] * 10);
    } else {
      // Поражение: 20 + 10 за гол
      coins = 20 + (scores[1] * 10);
      xp = 15 + (scores[1] * 10);
    }

    // Бонус за "сухую" победу (Perfect Game)
    const isPerfectGame = isWin && scores[2] === 0;
    if (isPerfectGame) {
      coins += 50;
    }

    return {
      winner,
      isWin,
      isDraw,
      playerGoals: scores[1],
      opponentGoals: scores[2],
      coinsEarned: coins,
      xpEarned: xp,
      isPerfectGame,
      newAchievements: [],
      reason: isDraw ? 'draw' : (isWin ? 'victory' : 'defeat'),
      message: isDraw ? 'Draw!' : (isWin ? 'Victory!' : 'Defeat!'),
    };
  }

  /**
   * Алиас для совместимости
   */
  static createStandardResult(
    winner: PlayerNumber | null, 
    scores: Record<number, number>
  ): MatchResult {
    return this.createTimeUpResult(winner, scores);
  }

  /**
   * Результат PvP матча с полной интеграцией
   */
  static createPvPResult(
    mode: PvPMode,
    isWin: boolean | null, // null = ничья
    myScore: number,
    oppScore: number,
    opponentName: string,
    opponentRating: number,
    matchDuration: number,
    reason: string = 'score'
  ): MatchResult {
    const isDraw = isWin === null;
    const data = playerData.get();
    
    // Получаем текущий MMR игрока
    const pvpStats = data.pvpStats || createDefaultPvPStats();
    const currentMMR = mode === 'casual' ? pvpStats.casual.rating : pvpStats.ranked.rating;
    
    // TODO: Implement PVP result logic for new system
    // Old system methods commented out until new system is ready
    /*
    const pvpResult = PvPManager.createPvPResult(
      mode,
      myScore,
      oppScore,
      opponentName,
      opponentRating,
      currentMMR,
      matchDuration
    );
    
    const newPvPStats = PvPManager.updatePvPStats(pvpStats, pvpResult);
    data.pvpStats = newPvPStats;
    
    const leagueTier = data.leagueProgress?.currentTier || 'meteorite';
    const rewards = PvPManager.calculatePvPRewards(mode, pvpResult, leagueTier as any);
    
    playerData.addCoins(rewards.coins);
    playerData.addXP(rewards.xp);
    
    if (mode === 'ranked' && data.leagueProgress) {
      const result = PvPManager.applyPvPResultToLeague(
        data.leagueProgress,
        pvpResult,
        { coins: data.coins, crystals: data.crystals }
      );
    */
    
    // Temporary stubs until new system is implemented
    const rewards = { coins: isWin ? 100 : 50, xp: isWin ? 50 : 25, leagueStars: 1 };
    const pvpResult = {
      ratingChange: isWin ? 20 : -10,
      isWin,
      isDraw,
      goalsScored: myScore,
      goalsConceded: oppScore,
    };
    const newPvPStats = pvpStats;
    
    playerData.addCoins(rewards.coins);
    playerData.addXP(rewards.xp);
    
    // Сохраняем данные
    playerData.save();
    
    // Возвращаем MatchResult для UI
    return {
      winner: isDraw ? null : (isWin ? 1 : 2),
      isWin: isWin === true,
      isDraw: isDraw,
      playerGoals: myScore,
      opponentGoals: oppScore,
      coinsEarned: rewards.coins,
      xpEarned: rewards.xp,
      isPerfectGame: isWin === true && oppScore === 0,
      newAchievements: [],
      reason: reason as MatchEndReason,
      message: isDraw ? 'Draw!' : (isWin ? 'Victory!' : 'Defeat!'),
      isPvP: true,
      pvpRatingChange: pvpResult.ratingChange,
      pvpNewRating: mode === 'casual' ? newPvPStats.casual.rating : newPvPStats.ranked.rating,
      pvpOpponentName: opponentName,
    };
  }

  /**
   * Результат Кампании
   */
  static createCampaignResult(
    campaignResult: CampaignLevelResult,
    levelConfig: LevelConfig
  ): MatchResult {
    // В кампании обычно нет ничьих в плане прохождения (либо прошел на звезду, либо нет)
    const isWin = campaignResult.starsEarned > 0;
    
    return {
      winner: isWin ? 1 : 2,
      isWin: isWin,
      isDraw: false, // В кампании ничьи нет
      playerGoals: campaignResult.playerScore,
      opponentGoals: campaignResult.enemyScore,
      coinsEarned: campaignResult.rewards.coins,
      xpEarned: campaignResult.rewards.xp,
      isPerfectGame: isWin && campaignResult.enemyScore === 0,
      newAchievements: [],
      isCampaign: true,
      starsEarned: campaignResult.starsEarned,
      isFirstClear: campaignResult.isFirstClear,
      unlockedNextLevel: campaignResult.unlockedNextLevel,
      unlockedNextChapter: campaignResult.unlockedNextChapter,
      levelName: levelConfig.name,
      unlockedUnitId: campaignResult.rewards.unlockedUnitId,
      unlockedSkinId: campaignResult.rewards.unlockedSkinId,
      reason: 'campaign_end',
      message: isWin ? 'Level Cleared!' : 'Level Failed',
    };
  }

  /**
   * Создать результат для сдачи матча (surrender)
   */
  static createSurrenderResult(
    scores: Record<number, number>,
    surrenderedByPlayer: boolean = true
  ): MatchResult {
    const isWin = !surrenderedByPlayer;
    
    return {
      winner: surrenderedByPlayer ? 2 : 1,
      isWin,
      isDraw: false,
      playerGoals: scores[1],
      opponentGoals: scores[2],
      coinsEarned: isWin ? 50 : 10,
      xpEarned: isWin ? 25 : 5,
      isPerfectGame: false,
      newAchievements: [],
      reason: 'surrender',
      message: surrenderedByPlayer ? 'You surrendered!' : 'Opponent surrendered!',
    };
  }
}