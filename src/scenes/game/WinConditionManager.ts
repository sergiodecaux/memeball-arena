// ✅ ИЗМЕНЕНО: Ничья в кампании теперь считается поражением, добавлен флаг isCampaign

// src/scenes/game/WinConditionManager.ts
// Менеджер условий победы для кампании

import Phaser from 'phaser';
import { WinCondition, WinConditionType } from '../../types/CampaignTypes';
import { PlayerNumber } from '../../types';

export interface WinConditionResult {
  /** Победитель (1 или 2), или null если ничья */
  winner: PlayerNumber | null;
  /** Причина завершения */
  reason: 'score_reached' | 'time_up' | 'sudden_death' | 'one_shot_failed' | 'one_shot_success' | 'condition_met' | 'draw_loss';
  /** Дополнительное сообщение */
  message?: string;
  /** Для кампании: ничья считается поражением */
  isCampaignLoss?: boolean;
}

export interface WinConditionCheckParams {
  player1Score: number;
  player2Score: number;
  remainingTime: number;
  totalTime: number;
  totalShots?: number;
}

export class WinConditionManager {
  private scene: Phaser.Scene;
  private winCondition: WinCondition;
  private shotsCount: number = 0;
  private isConditionMet: boolean = false;
  
  // 🆕 Флаг режима кампании
  private isCampaignMode: boolean = false;

  constructor(scene: Phaser.Scene, winCondition: WinCondition, isCampaign: boolean = false) {
    this.scene = scene;
    this.winCondition = winCondition;
    this.isCampaignMode = isCampaign;
    
    console.log(`[WinConditionManager] Created with type: ${winCondition.type}, isCampaign: ${isCampaign}`);
  }

  /**
   * Установить режим кампании
   */
  setCampaignMode(isCampaign: boolean): void {
    this.isCampaignMode = isCampaign;
  }

  /**
   * Проверить условие победы
   */
  check(params: WinConditionCheckParams): WinConditionResult | null {
    let result: WinConditionResult | null = null;
    
    switch (this.winCondition.type) {
      case 'score_limit':
        result = this.checkScoreLimit(params);
        break;
      
      case 'time_survival':
        result = this.checkTimeSurvival(params);
        break;
      
      case 'sudden_death':
        result = this.checkSuddenDeath(params);
        break;
      
      case 'puzzle':
        result = this.checkPuzzle(params);
        break;
      
      case 'no_goals_against':
        result = this.checkNoGoalsAgainst(params);
        break;
      
      case 'score_difference':
        result = this.checkScoreDifference(params);
        break;
      
      default:
        console.warn(`[WinConditionManager] Unknown condition type: ${this.winCondition.type}`);
        result = this.checkScoreLimit(params);
    }
    
    // 🆕 В кампании ничья = поражение
    if (result && result.winner === null && this.isCampaignMode) {
      result = this.convertDrawToLoss(result);
    }
    
    return result;
  }

  /**
   * 🆕 Конвертировать ничью в поражение для кампании
   */
  private convertDrawToLoss(result: WinConditionResult): WinConditionResult {
    console.log('[WinConditionManager] Campaign mode: converting draw to loss');
    
    return {
      winner: 2, // Враг побеждает
      reason: 'draw_loss',
      message: 'Ничья — уровень не пройден!',
      isCampaignLoss: true,
    };
  }

  /**
   * Классическое условие: первый до N голов
   */
  private checkScoreLimit(params: WinConditionCheckParams): WinConditionResult | null {
    const scoreLimit = this.winCondition.scoreLimit || 3;
    
    if (params.player1Score >= scoreLimit) {
      return {
        winner: 1,
        reason: 'score_reached',
        message: `Победа! ${params.player1Score} ${this.pluralGoals(params.player1Score)}!`,
      };
    }
    
    if (params.player2Score >= scoreLimit) {
      return {
        winner: 2,
        reason: 'score_reached',
        message: `Поражение. Противник забил ${params.player2Score} ${this.pluralGoals(params.player2Score)}.`,
      };
    }
    
    // 🆕 Проверка времени (если есть лимит)
    if (params.remainingTime <= 0 && params.totalTime > 0) {
      return this.resolveByScore(params);
    }
    
    return null;
  }

  /**
   * Выживание: продержаться X секунд
   * 🆕 ИСПРАВЛЕНО: В кампании ничья = поражение
   */
  private checkTimeSurvival(params: WinConditionCheckParams): WinConditionResult | null {
    // Проверяем, истекло ли время
    if (params.remainingTime <= 0) {
      if (params.player1Score > params.player2Score) {
        return {
          winner: 1,
          reason: 'time_up',
          message: 'Выжил и победил!',
        };
      } else if (params.player2Score > params.player1Score) {
        return {
          winner: 2,
          reason: 'time_up',
          message: 'Противник победил по очкам.',
        };
      } else {
        // Ничья — будет конвертирована в поражение для кампании в check()
        return {
          winner: null,
          reason: 'time_up',
          message: 'Ничья!',
        };
      }
    }
    
    return null;
  }

  /**
   * Золотой гол: первый забивший — побеждает
   */
  private checkSuddenDeath(params: WinConditionCheckParams): WinConditionResult | null {
    if (params.player1Score > 0) {
      return {
        winner: 1,
        reason: 'sudden_death',
        message: 'Золотой гол! Победа!',
      };
    }
    
    if (params.player2Score > 0) {
      return {
        winner: 2,
        reason: 'sudden_death',
        message: 'Противник забил золотой гол.',
      };
    }
    
    // 🆕 Проверка таймаута для sudden death
    if (params.remainingTime <= 0 && params.totalTime > 0) {
      // Никто не забил — ничья, в кампании = поражение
      return {
        winner: null,
        reason: 'time_up',
        message: 'Время вышло без гола!',
      };
    }
    
    return null;
  }

  /**
   * Паззл: забить мяч за N попыток
   */
  private checkPuzzle(params: WinConditionCheckParams): WinConditionResult | null {
    const maxAttempts = this.winCondition.maxAttempts || 1;
    
    // Победа игрока
    if (params.player1Score > 0) {
      return {
        winner: 1,
        reason: 'one_shot_success',
        message: `Паззл решён за ${this.shotsCount} ${this.pluralShots(this.shotsCount)}!`,
      };
    }
    
    // Проверка лимита попыток
    if (this.shotsCount >= maxAttempts) {
      return {
        winner: 2,
        reason: 'one_shot_failed',
        message: 'Попытки закончились!',
      };
    }
    
    return null;
  }

  /**
   * Не пропустить ни одного гола
   */
  private checkNoGoalsAgainst(params: WinConditionCheckParams): WinConditionResult | null {
    const scoreLimit = this.winCondition.scoreLimit || 3;
    
    // Поражение если пропустили гол
    if (params.player2Score > 0) {
      return {
        winner: 2,
        reason: 'condition_met',
        message: 'Пропущен гол! Миссия провалена.',
      };
    }
    
    // Победа если набрали нужное количество голов без пропущенных
    if (params.player1Score >= scoreLimit && params.player2Score === 0) {
      return {
        winner: 1,
        reason: 'condition_met',
        message: 'Идеальная защита! Победа!',
      };
    }
    
    // 🆕 Проверка времени
    if (params.remainingTime <= 0 && params.totalTime > 0) {
      if (params.player2Score === 0) {
        // Не пропустили, но и не набрали нужно — частичная победа
        return {
          winner: 1,
          reason: 'time_up',
          message: 'Время вышло, но ворота на замке!',
        };
      }
    }
    
    return null;
  }

  /**
   * Победа с разницей в N голов
   */
  private checkScoreDifference(params: WinConditionCheckParams): WinConditionResult | null {
    const requiredDifference = this.winCondition.scoreDifference || 3;
    
    const difference = params.player1Score - params.player2Score;
    
    if (difference >= requiredDifference) {
      return {
        winner: 1,
        reason: 'condition_met',
        message: `Победа с разницей в ${difference} ${this.pluralGoals(difference)}!`,
      };
    }
    
    // 🆕 Если противник вырвался вперёд с такой же разницей
    if (-difference >= requiredDifference) {
      return {
        winner: 2,
        reason: 'condition_met',
        message: 'Противник доминирует!',
      };
    }
    
    // Проверка поражения (если время истекло и условие не выполнено)
    if (params.remainingTime <= 0 && params.totalTime > 0) {
      return this.resolveByScore(params);
    }
    
    return null;
  }

  /**
   * 🆕 Разрешить результат по счёту при истечении времени
   */
  private resolveByScore(params: WinConditionCheckParams): WinConditionResult {
    const difference = params.player1Score - params.player2Score;
    
    if (difference > 0) {
      return {
        winner: 1,
        reason: 'time_up',
        message: 'Время вышло. Победа по очкам!',
      };
    } else if (difference < 0) {
      return {
        winner: 2,
        reason: 'time_up',
        message: 'Время вышло. Поражение.',
      };
    } else {
      // Ничья — будет конвертирована в check()
      return {
        winner: null,
        reason: 'time_up',
        message: 'Ничья!',
      };
    }
  }

  /**
   * Уведомить менеджер о совершённом ударе (для puzzle режима)
   */
  incrementShotCount(): void {
    this.shotsCount++;
    console.log(`[WinConditionManager] Shots: ${this.shotsCount}/${this.winCondition.maxAttempts || 1}`);
  }

  /**
   * Получить текущее количество ударов
   */
  getShotCount(): number {
    return this.shotsCount;
  }

  /**
   * Сбросить счётчики (для рестарта уровня)
   */
  reset(): void {
    this.shotsCount = 0;
    this.isConditionMet = false;
  }

  /**
   * Получить описание условия для UI
   */
  getConditionDescription(): string {
    switch (this.winCondition.type) {
      case 'score_limit':
        return `Первый до ${this.winCondition.scoreLimit || 3} ${this.pluralGoals(this.winCondition.scoreLimit || 3)}`;
      
      case 'time_survival':
        return `Продержись ${this.winCondition.timeLimit || 60} секунд`;
      
      case 'sudden_death':
        return 'Золотой гол — первый забивший побеждает!';
      
      case 'puzzle':
        return `Забей за ${this.winCondition.maxAttempts || 1} ${this.pluralShots(this.winCondition.maxAttempts || 1)}`;
      
      case 'no_goals_against':
        return `Забей ${this.winCondition.scoreLimit || 3} ${this.pluralGoals(this.winCondition.scoreLimit || 3)} не пропустив`;
      
      case 'score_difference':
        return `Победи с разницей в ${this.winCondition.scoreDifference || 3}+ ${this.pluralGoals(this.winCondition.scoreDifference || 3)}`;
      
      default:
        return 'Неизвестное условие';
    }
  }

  /**
   * Получить текущий прогресс (для UI)
   */
  getProgressText(params: WinConditionCheckParams): string {
    switch (this.winCondition.type) {
      case 'puzzle':
        return `Попытки: ${this.shotsCount}/${this.winCondition.maxAttempts || 1}`;
      
      case 'time_survival':
        const mins = Math.floor(params.remainingTime / 60);
        const secs = Math.floor(params.remainingTime % 60);
        return `⏱ ${mins}:${secs.toString().padStart(2, '0')}`;
      
      case 'score_difference':
        const diff = params.player1Score - params.player2Score;
        const required = this.winCondition.scoreDifference || 3;
        return `Разница: ${diff >= 0 ? '+' : ''}${diff}/${required}`;
      
      case 'no_goals_against':
        const target = this.winCondition.scoreLimit || 3;
        return `Голы: ${params.player1Score}/${target} | Пропущено: ${params.player2Score}`;
      
      default:
        return '';
    }
  }

  /**
   * Проверить, требуется ли специальная логика при голе
   */
  shouldResetOnGoal(): boolean {
    // Для puzzle режима: сбрасываем позиции после промаха
    return this.winCondition.type === 'puzzle';
  }

  /**
   * Получить максимальное время матча (если есть)
   */
  getMatchDuration(): number | undefined {
    if (this.winCondition.type === 'time_survival') {
      return this.winCondition.timeLimit;
    }
    return undefined;
  }

  /**
   * Проверить, нужно ли показывать таймер
   */
  shouldShowTimer(): boolean {
    return this.winCondition.type === 'time_survival' || 
           this.winCondition.type === 'score_difference' ||
           this.winCondition.type === 'sudden_death';
  }

  /**
   * 🆕 Проверить, нужно ли показывать прогресс
   */
  shouldShowProgress(): boolean {
    return this.winCondition.type === 'puzzle' || 
           this.winCondition.type === 'score_difference' ||
           this.winCondition.type === 'no_goals_against';
  }

  /**
   * Получить тип условия
   */
  getType(): WinConditionType {
    return this.winCondition.type;
  }

  /**
   * 🆕 Получить конфиг условия
   */
  getCondition(): WinCondition {
    return this.winCondition;
  }

  /**
   * 🆕 Проверить, режим кампании
   */
  isCampaign(): boolean {
    return this.isCampaignMode;
  }

  // ========== ХЕЛПЕРЫ ДЛЯ ПЛЮРАЛИЗАЦИИ ==========

  private pluralGoals(n: number): string {
    const abs = Math.abs(n);
    if (abs === 1) return 'гол';
    if (abs >= 2 && abs <= 4) return 'гола';
    return 'голов';
  }

  private pluralShots(n: number): string {
    const abs = Math.abs(n);
    if (abs === 1) return 'удар';
    if (abs >= 2 && abs <= 4) return 'удара';
    return 'ударов';
  }
}