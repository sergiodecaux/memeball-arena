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

  /**
   * Получает текущую активную формацию
   */
  getCurrentFormation(): Formation {
    return this.state.currentFormation;
  }

  /**
   * Получает ожидающую формацию (будет применена после гола)
   */
  getPendingFormation(): Formation | null {
    return this.state.pendingFormation;
  }

  /**
   * Устанавливает формацию для применения после следующего гола
   */
  setPendingFormation(formation: Formation): void {
    this.state.pendingFormation = formation;
    playerData.selectFormation(formation.id);
    console.log(`📋 Pending formation set: ${formation.name}`);
  }

  /**
   * Обновляет текущую формацию (когда изменились только классы фишек, но не сама формация)
   */
  updateCurrentFormation(formation: Formation): void {
    this.state.currentFormation = formation;
    console.log(`🔄 Current formation updated: ${formation.name}`);
  }

  /**
   * Применяет ожидающую формацию (вызывается при респавне после гола)
   * Возвращает true если формация была применена
   */
  applyPendingFormation(): boolean {
    if (this.state.pendingFormation) {
      this.state.currentFormation = this.state.pendingFormation;
      this.state.pendingFormation = null;
      console.log(`✅ Formation applied: ${this.state.currentFormation.name}`);
      return true;
    }
    return false;
  }

  /**
   * Проверяет, есть ли ожидающая формация
   */
  hasPendingFormation(): boolean {
    return this.state.pendingFormation !== null;
  }

  /**
   * Перезагружает текущую формацию из PlayerData
   * (полезно после изменения классов в меню формаций)
   */
  reloadCurrentFormation(): void {
    this.state.currentFormation = playerData.getSelectedFormation();
    console.log(`🔃 Formation reloaded: ${this.state.currentFormation.name}`);
  }

  // ==================== СЧЁТ ====================

  /**
   * Добавляет гол
   */
  addGoal(player: PlayerNumber): void {
    this.state.scores[player]++;
  }

  /**
   * Получает текущий счёт
   */
  getScores(): Record<PlayerNumber, number> {
    return { ...this.state.scores };
  }

  /**
   * Сбрасывает счёт
   */
  resetScores(): void {
    this.state.scores = { 1: 0, 2: 0 };
  }

  // ==================== РЕЗУЛЬТАТЫ МАТЧА ====================

  /**
   * Завершает матч и сохраняет результаты
   */
  finishMatch(winner: PlayerNumber): MatchResult {
    this.state.isFinished = true;
    
    const playerGoals = this.state.scores[1];
    const opponentGoals = this.state.scores[2];
    const isWin = winner === 1;
    const isPerfectGame = isWin && opponentGoals === 0;
    
    // Рассчитываем награды
    let xpEarned = 10; // Базовый XP за игру
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

  /**
   * Обрабатывает сдачу игрока
   */
  handleSurrender(): MatchResult {
    return this.finishMatch(2);
  }

  /**
   * Проверяет и разблокирует достижения
   */
  private checkAchievements(isWin: boolean, playerGoals: number, opponentGoals: number): string[] {
    const newAchievements: string[] = [];
    const stats = playerData.get().stats;
    const level = playerData.get().level;
    
    const tryUnlock = (id: string): void => {
      if (playerData.unlockAchievement(id)) {
        newAchievements.push(id);
      }
    };
    
    // Первая победа
    if (isWin && stats.wins === 1) {
      tryUnlock('first_victory');
    }
    
    // Серия побед
    if (stats.currentWinStreak >= 3) {
      tryUnlock('hot_streak');
    }
    if (stats.currentWinStreak >= 5) {
      tryUnlock('unstoppable');
    }
    
    // Голы
    if (stats.goalsScored >= 10) {
      tryUnlock('sharpshooter');
    }
    if (stats.goalsScored >= 50) {
      tryUnlock('goal_machine');
    }
    
    // Сухарь
    if (isWin && opponentGoals === 0) {
      tryUnlock('clean_sheet');
    }
    
    // Количество игр
    if (stats.gamesPlayed >= 10) {
      tryUnlock('regular_player');
    }
    if (stats.gamesPlayed >= 50) {
      tryUnlock('dedicated');
    }
    
    // Уровень
    if (level >= 10) {
      tryUnlock('rising_star');
    }
    if (level >= 25) {
      tryUnlock('veteran');
    }
    
    return newAchievements;
  }

  // ==================== СОСТОЯНИЕ ====================

  /**
   * Проверяет, завершён ли матч
   */
  isMatchFinished(): boolean {
    return this.state.isFinished;
  }

  /**
   * Сбрасывает состояние для нового матча
   */
  reset(): void {
    this.state = {
      scores: { 1: 0, 2: 0 },
      currentFormation: playerData.getSelectedFormation(),
      pendingFormation: null,
      matchStartTime: Date.now(),
      isFinished: false,
    };
  }

  /**
   * Получает время начала матча
   */
  getMatchStartTime(): number {
    return this.state.matchStartTime;
  }
}