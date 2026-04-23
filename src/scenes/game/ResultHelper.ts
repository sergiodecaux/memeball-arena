// src/scenes/game/ResultHelper.ts
import { PlayerNumber } from '../../types';
import { playerData } from '../../data/PlayerData';
import { LevelConfig, CampaignLevelResult } from '../../types/CampaignTypes';
import type { MatchResult, MatchEndReason } from '../../types/MatchResult';

export class GameResultFactory {
  
  static createTimeUpResult(
    winner: PlayerNumber | null,
    scores: Record<PlayerNumber, number>
  ): MatchResult {
    const isWin = winner === 1;
    const isDraw = winner === null;

    let coinsEarned = 0;
    let xpEarned = 0;

    if (isDraw) {
      coinsEarned = 50;
      xpEarned = 25;
    } else if (isWin) {
      coinsEarned = 100;
      xpEarned = 50;
      const goalDiff = scores[1] - scores[2];
      coinsEarned += goalDiff * 20;
      xpEarned += goalDiff * 10;
    } else {
      coinsEarned = 20;
      xpEarned = 10;
    }

    playerData.addCoins(coinsEarned);
    playerData.addXP(xpEarned);

    return {
      winner: winner,
      isWin: isWin,
      isDraw: isDraw,
      playerGoals: scores[1],
      opponentGoals: scores[2],
      xpEarned: xpEarned,
      coinsEarned: coinsEarned,
      isPerfectGame: isWin && scores[2] === 0,
      newAchievements: [],
      reason: 'time',
      message: isDraw
        ? "Time's up! It's a draw!"
        : isWin
        ? "Time's up! You win!"
        : "Time's up! You lose!",
    };
  }

  static createStandardResult(
    winner: PlayerNumber | null,
    scores: Record<PlayerNumber, number>
  ): MatchResult {
    const isWin = winner === 1;
    const isDraw = winner === null;

    let coinsEarned = 0;
    let xpEarned = 0;

    if (isDraw) {
      coinsEarned = 50;
      xpEarned = 25;
    } else if (isWin) {
      coinsEarned = 100;
      xpEarned = 50;
      coinsEarned += scores[1] * 10;
      xpEarned += scores[1] * 5;
    } else {
      coinsEarned = 20;
      xpEarned = 10;
    }

    playerData.addCoins(coinsEarned);
    playerData.addXP(xpEarned);

    return {
      winner: winner,
      isWin: isWin,
      isDraw: isDraw,
      playerGoals: scores[1],
      opponentGoals: scores[2],
      xpEarned: xpEarned,
      coinsEarned: coinsEarned,
      isPerfectGame: isWin && scores[2] === 0,
      newAchievements: [],
      reason: 'score',
      message: isDraw
        ? "It's a draw!"
        : isWin
        ? 'Victory!'
        : 'Defeat!',
    };
  }

  static createPvPResult(
    isMyWin: boolean | null,
    myScore: number,
    oppScore: number,
    reason: string,
    rewards?: { coins: number; xp: number }
  ): MatchResult {
    const myRewards = rewards || {
      coins: isMyWin ? 150 : 30,
      xp: isMyWin ? 50 : 15,
    };

    return {
      winner: isMyWin === null ? null : isMyWin ? 1 : 2,
      isWin: isMyWin === true,
      isDraw: isMyWin === null,
      playerGoals: myScore,
      opponentGoals: oppScore,
      xpEarned: myRewards.xp,
      coinsEarned: myRewards.coins,
      isPerfectGame: isMyWin === true && oppScore === 0,
      newAchievements: [],
      rewards: myRewards,
      isPvP: true,
      reason: reason as MatchEndReason, // Приведение типа
      message: GameResultFactory.getEndMessage(isMyWin, reason),
    };
  }

  static createCampaignResult(
    campaignResult: CampaignLevelResult,
    levelConfig: LevelConfig
  ): MatchResult {
    const isWin = campaignResult.won;
    
    return {
      winner: isWin ? 1 : 2,
      isWin: isWin,
      isDraw: false,
      playerGoals: campaignResult.playerScore,
      opponentGoals: campaignResult.enemyScore,
      xpEarned: campaignResult.rewards.xp,
      coinsEarned: campaignResult.rewards.coins,
      isPerfectGame: isWin && campaignResult.enemyScore === 0,
      newAchievements: [],
      reason: isWin ? 'campaign_win' : 'campaign_lose',
      message: isWin 
        ? (campaignResult.isFirstClear ? '🎉 Level Complete!' : '✅ Victory!')
        : '❌ Try Again!',
      
      // Поля кампании
      isCampaign: true,
      starsEarned: campaignResult.starsEarned,
      isFirstClear: campaignResult.isFirstClear,
      unlockedNextLevel: campaignResult.unlockedNextLevel,
      unlockedNextChapter: campaignResult.unlockedNextChapter,
      levelName: levelConfig.name,
      unlockedUnitId: campaignResult.rewards.unlockedUnitId,
      unlockedSkinId: campaignResult.rewards.unlockedSkinId,
    };
  }

  static getEndMessage(isMyWin: boolean | null, reason: string): string {
    if (reason === 'surrendered') return 'Opponent surrendered!';
    if (reason === 'disconnected') return 'Opponent disconnected!';
    if (reason === 'time') {
      return isMyWin === null
        ? "Time's up! Draw!"
        : isMyWin
        ? "Time's up! You win!"
        : "Time's up! You lose!";
    }
    return isMyWin === null
      ? "It's a draw!"
      : isMyWin
      ? 'Victory!'
      : 'Defeat!';
  }

  static fromMatchControllerResult(result: any): MatchResult {
    return {
      winner: result.winner ?? null,
      isWin: result.isWin ?? false,
      isDraw: result.isDraw ?? (result.winner === null),
      playerGoals: result.playerGoals ?? 0,
      opponentGoals: result.opponentGoals ?? 0,
      xpEarned: result.xpEarned ?? 0,
      coinsEarned: result.coinsEarned ?? 0,
      isPerfectGame: result.isPerfectGame ?? false,
      newAchievements: result.newAchievements ?? [],
      reason: result.reason,
      message: result.message,
    };
  }
}