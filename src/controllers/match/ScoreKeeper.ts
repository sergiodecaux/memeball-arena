// src/controllers/match/ScoreKeeper.ts
// 📊 Чистый модуль управления счётом (без UI)

import { PlayerNumber } from '../../types';
import { eventBus, GameEvents } from '../../core/EventBus';

export interface ScoreState {
  player1: number;
  player2: number;
}

export interface GoalRecord {
  player: PlayerNumber;
  timestamp: number;
  turnNumber: number;
}

export class ScoreKeeper {
  private score: ScoreState = { player1: 0, player2: 0 };
  private goalsHistory: GoalRecord[] = [];

  constructor(initialScore?: ScoreState) {
    if (initialScore) {
      this.score = { ...initialScore };
    }
  }

  /**
   * Добавить гол
   */
  addGoal(player: PlayerNumber, turnNumber: number): ScoreState {
    if (player === 1) {
      this.score.player1++;
    } else {
      this.score.player2++;
    }

    this.goalsHistory.push({
      player,
      timestamp: Date.now(),
      turnNumber,
    });

    // Уведомляем UI
    eventBus.dispatch(GameEvents.UI_SCORE_UPDATED, {
      player1: this.score.player1,
      player2: this.score.player2,
    });

    return this.getScore();
  }

  /**
   * Установить счёт (для синхронизации)
   */
  setScore(player1: number, player2: number): void {
    this.score.player1 = player1;
    this.score.player2 = player2;

    eventBus.dispatch(GameEvents.UI_SCORE_UPDATED, {
      player1,
      player2,
    });
  }

  /**
   * Получить текущий счёт
   */
  getScore(): ScoreState {
    return { ...this.score };
  }

  /**
   * Получить счёт игрока
   */
  getPlayerScore(player: PlayerNumber): number {
    return player === 1 ? this.score.player1 : this.score.player2;
  }

  /**
   * Получить лидера
   */
  getLeader(): PlayerNumber | null {
    if (this.score.player1 > this.score.player2) return 1;
    if (this.score.player2 > this.score.player1) return 2;
    return null;
  }

  /**
   * Проверить ничью
   */
  isDraw(): boolean {
    return this.score.player1 === this.score.player2;
  }

  /**
   * Получить разницу в счёте
   */
  getDifference(): number {
    return this.score.player1 - this.score.player2;
  }

  /**
   * Получить абсолютную разницу
   */
  getAbsoluteDifference(): number {
    return Math.abs(this.getDifference());
  }

  /**
   * Проверить, достигнут ли лимит голов
   */
  hasReachedLimit(limit: number): PlayerNumber | null {
    if (this.score.player1 >= limit) return 1;
    if (this.score.player2 >= limit) return 2;
    return null;
  }

  /**
   * Получить историю голов
   */
  getGoalsHistory(): GoalRecord[] {
    return [...this.goalsHistory];
  }

  /**
   * Получить количество голов игрока
   */
  getGoalsCount(player: PlayerNumber): number {
    return this.goalsHistory.filter(g => g.player === player).length;
  }

  /**
   * Сброс
   */
  reset(): void {
    this.score = { player1: 0, player2: 0 };
    this.goalsHistory = [];
  }
}