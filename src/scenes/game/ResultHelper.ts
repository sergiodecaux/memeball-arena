// src/scenes/game/ResultHelper.ts

import { PlayerNumber } from '../../types';
import { playerData } from '../../data/PlayerData';

export interface MatchResult {
  winner: PlayerNumber | null;
  isWin: boolean;
  isDraw: boolean;
  playerGoals: number;
  opponentGoals: number;
  xpEarned: number;
  coinsEarned: number;
  isPerfectGame: boolean;
  newAchievements: any[];
  reason?: string;
  message?: string;
  rewards?: { coins: number; xp: number };
  isPvP?: boolean;
}

export class ResultHelper {
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
      reason,
      message: ResultHelper.getEndMessage(isMyWin, reason),
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
}