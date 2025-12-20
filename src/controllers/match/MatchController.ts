// src/controllers/match/MatchController.ts

import { PlayerNumber, Formation } from '../../types';
import { playerData } from '../../data/PlayerData';

export interface MatchResult {
  winner: PlayerNumber;
  playerGoals: number;
  opponentGoals: number;
  xpEarned: number;
  coinsEarned: number;
  isWin: boolean;
  isPerfectGame: boolean;
  newAchievements: string[];
  // PvP поля
  rewards?: { coins: number; xp: number };
  isPvP?: boolean;
  message?: string;
}

export interface MatchState {
  scores: Record<PlayerNumber, number>;
  currentFormation: Formation;
  pendingFormation: Formation | null;
  matchStartTime: number;
  isFinished: boolean;
}

/**
 * Контроллер матча - управляет результатами, формациями и сохранением
 */
export class MatchController {
  private state: MatchState;
  
  constructor() {
    this.state = {
      scores: { 1: 0, 2: 0 },
      currentFormation: playerData.getSelectedFormation(),
      pendingFormation: null,
      matchStartTime: Date.now(),
      isFinished: false,
    };
  }

  // ==================== ФОРМАЦИИ ====================

  getCurrentFormation(): Formation {
    return this.state.currentFormation;
  }

  getPendingFormation(): Formation | null {
    return this.state.pendingFormation;
  }

  setPendingFormation(formation: Formation): void {
    this.state.pendingFormation = formation;
    playerData.selectFormation(formation.id);
    console.log(`📋 Pending formation set: ${formation.name}`);
  }

  updateCurrentFormation(formation: Formation): void {
    this.state.currentFormation = formation;
    console.log(`🔄 Current formation updated: ${formation.name}`);
  }

  applyPendingFormation(): boolean {
    if (this.state.pendingFormation) {
      this.state.currentFormation = this.state.pendingFormation;
      this.state.pendingFormation = null;
      console.log(`✅ Formation applied: ${this.state.currentFormation.name}`);
      return true;
    }
    return false;
  }

  hasPendingFormation(): boolean {
    return this.state.pendingFormation !== null;
  }

  reloadCurrentFormation(): void {
    this.state.currentFormation = playerData.getSelectedFormation();
    console.log(`🔃 Formation reloaded: ${this.state.currentFormation.name}`);
  }

  // ==================== СЧЁТ ====================

  addGoal(player: PlayerNumber): void {
    this.state.scores[player]++;
  }

  getScores(): Record<PlayerNumber, number> {
    return { ...this.state.scores };
  }

  resetScores(): void {
    this.state.scores = { 1: 0, 2: 0 };
  }

  // ==================== РЕЗУЛЬТАТЫ МАТЧА ====================

  finishMatch(winner: PlayerNumber): MatchResult {
    this.state.isFinished = true;
    
    const playerGoals = this.state.scores[1];
    const opponentGoals = this.state.scores[2];
    const isWin = winner === 1;
    const isPerfectGame = isWin && opponentGoals === 0;
    
    // Рассчитываем награды
    let xpEarned = 10;
    let coinsEarned = 0;
    
    if (isWin) {
      xpEarned += 50;
      coinsEarned += 100;
      
      if (isPerfectGame) {
        xpEarned += 25;
        coinsEarned += 50;
      }
    } else {
      xpEarned += 15;
      coinsEarned += 20;
    }
    
    // Бонус за голы
    xpEarned += playerGoals * 10;
    coinsEarned += playerGoals * 10;
    
    // Сохраняем статистику
    const result: 'win' | 'loss' | 'draw' = isWin ? 'win' : 'loss';
    playerData.updateStats(result, playerGoals, opponentGoals);
    
    // Добавляем время игры
    const playTimeSeconds = Math.floor((Date.now() - this.state.matchStartTime) / 1000);
    playerData.addPlayTime(playTimeSeconds);
    
    // Проверяем достижения
    const newAchievements = this.checkAchievements(isWin, playerGoals, opponentGoals);
    
    console.log(`📊 Match finished: ${result}, ${playerGoals}:${opponentGoals}, +${xpEarned}XP, +${coinsEarned} coins`);
    
    return {
      winner,
      playerGoals,
      opponentGoals,
      xpEarned,
      coinsEarned,
      isWin,
      isPerfectGame,
      newAchievements,
    };
  }

  handleSurrender(): MatchResult {
    return this.finishMatch(2);
  }

  private checkAchievements(isWin: boolean, playerGoals: number, opponentGoals: number): string[] {
    const newAchievements: string[] = [];
    const stats = playerData.get().stats;
    const level = playerData.get().level;
    
    const tryUnlock = (id: string): void => {
      if (playerData.unlockAchievement(id)) {
        newAchievements.push(id);
      }
    };
    
    if (isWin && stats.wins === 1) {
      tryUnlock('first_victory');
    }
    
    if (stats.currentWinStreak >= 3) {
      tryUnlock('hot_streak');
    }
    if (stats.currentWinStreak >= 5) {
      tryUnlock('unstoppable');
    }
    
    if (stats.goalsScored >= 10) {
      tryUnlock('sharpshooter');
    }
    if (stats.goalsScored >= 50) {
      tryUnlock('goal_machine');
    }
    
    if (isWin && opponentGoals === 0) {
      tryUnlock('clean_sheet');
    }
    
    if (stats.gamesPlayed >= 10) {
      tryUnlock('regular_player');
    }
    if (stats.gamesPlayed >= 50) {
      tryUnlock('dedicated');
    }
    
    if (level >= 10) {
      tryUnlock('rising_star');
    }
    if (level >= 25) {
      tryUnlock('veteran');
    }
    
    return newAchievements;
  }

  // ==================== СОСТОЯНИЕ ====================

  isMatchFinished(): boolean {
    return this.state.isFinished;
  }

  reset(): void {
    this.state = {
      scores: { 1: 0, 2: 0 },
      currentFormation: playerData.getSelectedFormation(),
      pendingFormation: null,
      matchStartTime: Date.now(),
      isFinished: false,
    };
  }

  getMatchStartTime(): number {
    return this.state.matchStartTime;
  }
}