// src/controllers/match/MatchDirector.ts
// 🎮 Центральный оркестратор логики матча
// ✅ ИЗМЕНЕНО: Исправлена гонка состояний между голом и сменой хода (v10)
// ✅ ИЗМЕНЕНО: Интеграция с RewardCalculator для Faction Mastery XP (v9)

import Phaser from 'phaser';
import { PlayerNumber, FieldBounds } from '../../types';
import { FactionId } from '../../constants/gameConstants';
import { MatchStateMachine, MatchPhase } from '../../core/MatchStateMachine';
import { eventBus, GameEvents } from '../../core/EventBus';
import { Ball } from '../../entities/Ball';
import { Unit } from '../../entities/Unit';
import { playerData } from '../../data/PlayerData';
import { 
  LevelConfig, 
  WinCondition, 
  CampaignLevelResult 
} from '../../types/CampaignTypes';
import { MatchResult, Achievement, MatchEndReason, MasteryXPData } from '../../types/MatchResult';
// ✅ ДОБАВЛЕНО: Импорт RewardCalculator
import { 
  RewardCalculator, 
  MatchStats, 
  RewardResult, 
  CampaignRewardResult,
  ApplyRewardsResult 
} from './RewardCalculator';

// ========== КОНФИГУРАЦИЯ ==========

export interface MatchDirectorConfig {
  scene: Phaser.Scene;
  
  // Режим игры
  mode: 'standard' | 'campaign' | 'pvp' | 'tournament' | 'league' | 'custom';
  
  // Сущности
  ball: Ball;
  caps: Unit[];
  fieldBounds: FieldBounds;
  
  // Настройки матча
  matchDuration: number;
  isAIMode: boolean;
  
  // Фракции (опционально)
  playerFaction?: FactionId;
  opponentFaction?: FactionId;
  
  // Кампания (опционально)
  campaignConfig?: {
    levelConfig: LevelConfig;
    winCondition: WinCondition;
  };
  
  // PvP (опционально)
  pvpConfig?: {
    isHost: boolean;
    roomId: string;
  };
  
  // 💰 League (опционально)
  entryFee?: number; // Вступительный взнос для лиги
}

// ========== ВНУТРЕННЕЕ СОСТОЯНИЕ ==========

interface MatchInternalState {
  score: { player1: number; player2: number };
  shotsCount: number;
  matchStartTime: number;
  matchEndTime?: number;
  isMatchActive: boolean;
  lastGoalBy?: PlayerNumber;
  goalsHistory: Array<{ player: PlayerNumber; time: number; turnNumber: number }>;
}

// ========== СОБЫТИЯ ДИРЕКТОРА ==========

export interface MatchDirectorEvents {
  'goal': { player: PlayerNumber; newScore: { player1: number; player2: number } };
  'matchEnd': { result: MatchResult };
  'turnChange': { player: PlayerNumber; turnNumber: number };
  'timerWarning': { secondsLeft: number };
  'timerEnd': void;
}

// ========== КЛАСС ==========

export class MatchDirector extends Phaser.Events.EventEmitter {
  private scene: Phaser.Scene;
  private config: MatchDirectorConfig;
  private stateMachine: MatchStateMachine;
  
  private internalState: MatchInternalState;
  
  // Таймер матча
  private matchTimer?: Phaser.Time.TimerEvent;
  private remainingTime: number;
  private isPaused: boolean = false;
  
  // Детекция остановки
  private stoppedFrames: number = 0;
  private readonly STOP_THRESHOLD = 0.28;
  private readonly FRAMES_TO_CONFIRM = 8;
  private readonly MIN_MOVING_TIME = 400;
  private movingStartTime: number = 0;

  constructor(config: MatchDirectorConfig) {
    super();
    
    this.scene = config.scene;
    this.config = config;
    this.remainingTime = config.matchDuration;
    
    // Создаём машину состояний
    this.stateMachine = new MatchStateMachine({
      isAIMode: config.isAIMode,
      isPvPMode: config.mode === 'pvp',
      isHost: config.pvpConfig?.isHost || false,
      startingPlayer: 1,
    });
    
    // Инициализируем внутреннее состояние
    this.internalState = {
      score: { player1: 0, player2: 0 },
      shotsCount: 0,
      matchStartTime: 0,
      isMatchActive: false,
      goalsHistory: [],
    };
    
    this.setupStateMachineHandlers();
    this.subscribeToEvents();
  }

  // ============================================================
  // ПУБЛИЧНЫЙ API
  // ============================================================

  /**
   * Начать матч
   */
  startMatch(): void {
    console.log('[MatchDirector] Starting match...');
    
    // ✅ ИСПРАВЛЕНО: Проверяем, не запущен ли матч уже
    if (this.internalState.isMatchActive) {
      console.warn('[MatchDirector] ⚠️ Match is already active, ignoring startMatch() call');
      return;
    }
    
    // ✅ ИСПРАВЛЕНО: Проверяем текущую фазу перед запуском
    const currentPhase = this.stateMachine.getPhase();
    console.log(`[MatchDirector] Current phase: ${currentPhase}`);
    
    if (currentPhase !== MatchPhase.INTRO) {
      console.error(`[MatchDirector] ❌ Cannot start match — not in INTRO phase. Current phase: ${currentPhase}`);
      // ✅ Пытаемся принудительно сбросить в INTRO, если это возможно
      if (currentPhase === MatchPhase.FINISHED) {
        console.warn('[MatchDirector] Match is FINISHED, cannot start');
        return;
      }
      // Для других фаз пытаемся продолжить
      console.warn('[MatchDirector] Attempting to force transition to WAITING...');
    }
    
    this.internalState.matchStartTime = Date.now();
    this.internalState.isMatchActive = true;
    
    // Запускаем таймер
    this.startTimer();
    
    // ✅ ИСПРАВЛЕНО: Проверяем результат перехода машины состояний
    const transitionResult = this.stateMachine.startMatch();
    if (!transitionResult) {
      console.error('[MatchDirector] ❌ Failed to transition state machine to WAITING phase');
      // ✅ Пытаемся принудительно перейти в WAITING
      const forceTransition = this.stateMachine.transition(MatchPhase.WAITING);
      if (!forceTransition) {
        console.error('[MatchDirector] ❌ CRITICAL: Cannot start match — state machine transition failed');
        // Откатываем изменения
        this.internalState.isMatchActive = false;
        this.stopTimer();
        return;
      }
      console.warn('[MatchDirector] ⚠️ Forced transition to WAITING phase');
    }
    
    // Уведомляем о старте
    eventBus.dispatch(GameEvents.MATCH_STARTED, {
      mode: this.config.mode,
      duration: this.config.matchDuration,
      playerFaction: this.config.playerFaction,
      opponentFaction: this.config.opponentFaction,
    });
    
    console.log('[MatchDirector] ✅ Match started successfully. Phase:', this.stateMachine.getPhase());
  }

  /**
   * ✅ ИСПРАВЛЕНО: Обновление с приоритетом гола над сменой хода
   * Гол проверяется ПЕРВЫМ, и если он произошёл — смена хода НЕ происходит
   */
  update(): void {
    const phase = this.stateMachine.getPhase();
    if (phase === MatchPhase.MOVING) {
      // ✅ ШАГ 1: Сначала проверяем гол — гол имеет ПРИОРИТЕТ
      this.checkGoal();
      // ✅ ШАГ 2: Если в результате checkGoal фаза сменилась на GOAL или FINISHED — выходим
      const newPhase = this.stateMachine.getPhase();
      if (newPhase === MatchPhase.GOAL || newPhase === MatchPhase.FINISHED) {
        return;
      }
      // ✅ ШАГ 3: Только если гола НЕТ — проверяем остановку объектов и смену хода
      this.checkObjectsStopped();
    }
  }

  /**
   * Выстрел произведён
   */
  onShot(unitId: string): void {
    this.internalState.shotsCount++;
    this.stoppedFrames = 0;
    this.movingStartTime = Date.now();
    
    this.stateMachine.executeShot(unitId);
    
    eventBus.dispatch(GameEvents.SHOT_EXECUTED, {
      unitId,
      velocity: { x: 0, y: 0 }, // Будет заполнено из ShootingController
      position: { x: 0, y: 0 },
    });
  }

  /**
   * Гол забит
   */
  onGoalScored(scoringPlayer: PlayerNumber): void {
    // ✅ УЛУЧШЕНО: Защита от повторной обработки гола
    const phase = this.stateMachine.getPhase();
    if (phase === MatchPhase.GOAL || phase === MatchPhase.FINISHED) {
      console.log('[MatchDirector] Goal ignored - already in GOAL or FINISHED phase');
      return;
    }
    
    // Обновляем счёт
    if (scoringPlayer === 1) {
      this.internalState.score.player1++;
    } else {
      this.internalState.score.player2++;
    }
    
    this.internalState.lastGoalBy = scoringPlayer;
    this.internalState.goalsHistory.push({
      player: scoringPlayer,
      time: Date.now() - this.internalState.matchStartTime,
      turnNumber: this.stateMachine.getTurnNumber(),
    });
    
    console.log(`[MatchDirector] Goal! Player ${scoringPlayer}. Score: ${this.internalState.score.player1}-${this.internalState.score.player2}`);
    
    // Ставим таймер на паузу
    this.pauseTimer();
    
    // Переводим в состояние гола
    this.stateMachine.goalScored(scoringPlayer);
    
    // Эмитим событие
    this.emit('goal', {
      player: scoringPlayer,
      newScore: { ...this.internalState.score },
    });
    
    // Проверяем условие победы
    this.checkWinCondition();
  }

  /**
   * Продолжить после гола
   */
  continueAfterGoal(): void {
    // Определяем, кто начинает (тот, кто пропустил)
    const nextPlayer: PlayerNumber = this.internalState.lastGoalBy === 1 ? 2 : 1;
    
    this.resumeTimer();
    this.stateMachine.continueAfterGoal(nextPlayer);
    
    this.emit('turnChange', {
      player: nextPlayer,
      turnNumber: this.stateMachine.getTurnNumber(),
    });
  }

  /**
   * Пауза
   */
  pause(): void {
    if (this.isPaused) return;
    
    this.isPaused = true;
    this.pauseTimer();
    this.stateMachine.pause();
    
    eventBus.dispatch(GameEvents.MATCH_PAUSED, {});
  }

  /**
   * Возобновление
   */
  resume(): void {
    if (!this.isPaused) return;
    
    this.isPaused = false;
    this.resumeTimer();
    this.stateMachine.resume();
    
    eventBus.dispatch(GameEvents.MATCH_RESUMED, {});
  }

  /**
   * Сдаться
   */
  surrender(): MatchResult {
    console.log('[MatchDirector] Player surrendered');
    return this.finishMatch(2, 'surrender');
  }

  /**
   * Получить счёт
   */
  getScore(): { player1: number; player2: number } {
    return { ...this.internalState.score };
  }

  /**
   * Установить счёт (для PvP синхронизации)
   */
  setScore(player1: number, player2: number): void {
    this.internalState.score.player1 = player1;
    this.internalState.score.player2 = player2;
    this.stateMachine.setScore(player1, player2);
  }

  /**
   * Получить оставшееся время
   */
  getRemainingTime(): number {
    return this.remainingTime;
  }

  /**
   * Получить текущего игрока
   */
  getCurrentPlayer(): PlayerNumber {
    return this.stateMachine.getCurrentPlayer();
  }

  /**
   * Получить номер хода
   */
  getTurnNumber(): number {
    return this.stateMachine.getTurnNumber();
  }

  /**
   * Получить машину состояний
   */
  getStateMachine(): MatchStateMachine {
    return this.stateMachine;
  }

  /**
   * Получить текущую фазу
   */
  getPhase(): MatchPhase {
    return this.stateMachine.getPhase();
  }

  /**
   * Можно ли играть
   */
  canPlay(): boolean {
    return this.stateMachine.canPlay() && this.internalState.isMatchActive;
  }

  /**
   * Количество ударов
   */
  getShotsCount(): number {
    return this.internalState.shotsCount;
  }

  // ============================================================
  // ТАЙМЕР МАТЧА
  // ============================================================

  private startTimer(): void {
    this.remainingTime = this.config.matchDuration;
    
    this.matchTimer = this.scene.time.addEvent({
      delay: 1000,
      callback: this.onTimerTick,
      callbackScope: this,
      loop: true,
    });
  }

  private onTimerTick(): void {
    if (this.isPaused) return;
    
    this.remainingTime--;
    
    // Обновляем UI
    eventBus.dispatch(GameEvents.UI_TIMER_UPDATED, {
      remaining: this.remainingTime,
      total: this.config.matchDuration,
    });
    
    // Предупреждения
    if (this.remainingTime === 30) {
      this.emit('timerWarning', { secondsLeft: 30 });
      eventBus.dispatch(GameEvents.HAPTIC_FEEDBACK, { type: 'warning' });
    }
    
    if (this.remainingTime === 10) {
      this.emit('timerWarning', { secondsLeft: 10 });
    }
    
    // Время вышло
    if (this.remainingTime <= 0) {
      this.onTimeUp();
    }
  }

  private pauseTimer(): void {
    // Таймер продолжает тикать, но мы не уменьшаем время в onTimerTick
    this.isPaused = true;
  }

  private resumeTimer(): void {
    this.isPaused = false;
  }

  private stopTimer(): void {
    this.matchTimer?.destroy();
    this.matchTimer = undefined;
  }

  private onTimeUp(): void {
    console.log('[MatchDirector] Time is up!');
    
    this.stopTimer();
    this.emit('timerEnd');
    
    // Определяем победителя по счёту
    const { player1, player2 } = this.internalState.score;
    let winner: PlayerNumber | null = null;
    
    if (player1 > player2) {
      winner = 1;
    } else if (player2 > player1) {
      winner = 2;
    }
    // winner = null означает ничью
    
    this.finishMatch(winner, 'time_up');
  }

  // ============================================================
  // ПРОВЕРКА ОСТАНОВКИ
  // ============================================================

  private checkObjectsStopped(): void {
    const elapsed = Date.now() - this.movingStartTime;
    if (elapsed < this.MIN_MOVING_TIME) {
      return;
    }
    
    if (this.areAllObjectsStopped()) {
      this.stoppedFrames++;
      
      if (this.stoppedFrames >= this.FRAMES_TO_CONFIRM) {
        this.onAllStopped();
      }
    } else {
      this.stoppedFrames = 0;
    }
  }

  private areAllObjectsStopped(): boolean {
    const { ball, caps } = this.config;
    
    if (!ball.isStopped(this.STOP_THRESHOLD)) {
      return false;
    }
    
    return caps.every(cap => cap.isStopped(this.STOP_THRESHOLD));
  }

  private onAllStopped(): void {
    this.stoppedFrames = 0;
    
    console.log('[MatchDirector] All objects stopped');
    
    // Переходим в waiting и меняем игрока
    this.stateMachine.objectsStopped();
    
    eventBus.dispatch(GameEvents.OBJECTS_STOPPED, {
      turnNumber: this.stateMachine.getTurnNumber(),
    });
    
    this.emit('turnChange', {
      player: this.stateMachine.getCurrentPlayer(),
      turnNumber: this.stateMachine.getTurnNumber(),
    });
  }

  // ============================================================
  // ПРОВЕРКА ГОЛА
  // ============================================================

  /**
   * ✅ УЛУЧШЕНО: Добавлена защита от повторной обработки
   */
  private checkGoal(): void {
    // ✅ Ранний выход если матч уже в состоянии гола или завершён
    const phase = this.stateMachine.getPhase();
    if (phase === MatchPhase.GOAL || phase === MatchPhase.FINISHED) {
      return;
    }

    const ball = this.config.ball;
    const bounds = this.config.fieldBounds;
    
    const { x, y } = ball.body.position;
    const goalHalfWidth = 69; // GOAL.WIDTH * scale / 2
    
    // Верхние ворота (гол игрока 1)
    if (x >= bounds.centerX - goalHalfWidth && 
        x <= bounds.centerX + goalHalfWidth &&
        y < bounds.top) {
      this.onGoalScored(1);
      return;
    }
    
    // Нижние ворота (гол игрока 2)
    if (x >= bounds.centerX - goalHalfWidth && 
        x <= bounds.centerX + goalHalfWidth &&
        y > bounds.bottom) {
      this.onGoalScored(2);
      return;
    }
  }

  // ============================================================
  // УСЛОВИЯ ПОБЕДЫ
  // ============================================================

  private checkWinCondition(): void {
    const { mode, campaignConfig } = this.config;
    
    if (mode === 'campaign' && campaignConfig) {
      this.checkCampaignWinCondition(campaignConfig.winCondition);
    } else {
      // Стандартный режим — просто продолжаем
      // Победа определяется только по времени
    }
  }

  private checkCampaignWinCondition(condition: WinCondition): void {
    const { score, shotsCount } = this.internalState;
    
    let winner: PlayerNumber | null = null;
    let reason: MatchEndReason = 'win_condition_met';
    
    switch (condition.type) {
      case 'score_limit':
        const limit = condition.scoreLimit || 3;
        if (score.player1 >= limit) {
          winner = 1;
        } else if (score.player2 >= limit) {
          winner = 2;
        }
        break;
        
      case 'sudden_death':
        // Первый гол — победа
        if (score.player1 > 0) winner = 1;
        else if (score.player2 > 0) winner = 2;
        break;
        
      case 'puzzle':
        const maxAttempts = condition.maxAttempts || 1;
        if (score.player1 > 0) {
          winner = 1;
        } else if (shotsCount >= maxAttempts) {
          winner = 2;
          reason = 'score_limit'; // Попытки закончились
        }
        break;
        
      case 'no_goals_against':
        if (score.player2 > 0) {
          winner = 2; // Пропустил — проиграл
        } else if (score.player1 >= (condition.scoreLimit || 3)) {
          winner = 1;
        }
        break;
        
      case 'score_difference':
        const diff = score.player1 - score.player2;
        const required = condition.scoreDifference || 3;
        if (diff >= required) {
          winner = 1;
        } else if (-diff >= required) {
          winner = 2;
        }
        break;
    }
    
    if (winner !== null) {
      // Даём время на празднование гола, потом завершаем
      this.scene.time.delayedCall(2500, () => {
        this.finishMatch(winner, reason);
      });
    }
  }

  // ============================================================
  // ЗАВЕРШЕНИЕ МАТЧА
  // ============================================================

  private finishMatch(winner: PlayerNumber | null, reason: MatchEndReason): MatchResult {
    console.log(`[MatchDirector] Match finished. Winner: ${winner}, Reason: ${reason}`);
    
    this.internalState.isMatchActive = false;
    this.internalState.matchEndTime = Date.now();
    this.stopTimer();
    
    // Останавливаем машину состояний
    this.stateMachine.finish();
    
    // ✅ ИЗМЕНЕНО: Используем RewardCalculator для расчёта и применения наград
    const result = this.calculateAndApplyRewards(winner, reason);
    
    // Эмитим события
    this.emit('matchEnd', { result });
    
    eventBus.dispatch(GameEvents.MATCH_FINISHED, {
      winner,
      scores: { ...this.internalState.score },
      reason,
    });
    
    return result;
  }

  /**
   * ✅ ИСПРАВЛЕНО: Рассчитать и применить награды через RewardCalculator
   */
  private calculateAndApplyRewards(winner: PlayerNumber | null, reason: MatchEndReason): MatchResult {
    const { score } = this.internalState;
    const { mode, campaignConfig, playerFaction } = this.config;
    
    const isWin = winner === 1;
    const isDraw = winner === null && reason !== 'surrender';
    
    // ✅ Формируем MatchStats с playerFaction
    const matchStats: MatchStats = {
      winner,
      playerGoals: score.player1,
      opponentGoals: score.player2,
      matchDurationSeconds: Math.floor((Date.now() - this.internalState.matchStartTime) / 1000),
      shotsCount: this.internalState.shotsCount,
      isSurrender: reason === 'surrender',
      playerFaction, // ✅ КРИТИЧНО: Передаём фракцию для Mastery XP
    };
    
    let rewards: RewardResult | CampaignRewardResult;
    let applyResult: ApplyRewardsResult | undefined;
    let campaignResult: CampaignLevelResult | undefined; // ✅ Для сохранения результата кампании
    
    if (mode === 'campaign' && campaignConfig) {
      // ✅ Кампания: используем calculateCampaignRewards
      const levelId = campaignConfig.levelConfig.id;
      const currentStars = playerData.getLevelProgress(levelId)?.stars || 0;
      const isFirstClear = currentStars === 0;
      
      // ✅ КРИТИЧНО: Сначала применяем статистику, потом проверяем достижения
      this.applyStats(isWin, isDraw, score.player1, score.player2);
      
      rewards = RewardCalculator.calculateCampaignRewards(
        matchStats,
        campaignConfig.levelConfig,
        isFirstClear
      );
      
      // ✅ ИСПРАВЛЕНО: Убрана лишняя проверка mode !== 'pvp'
      // В ветке campaign мы всегда применяем награды
      applyResult = RewardCalculator.applyCampaignRewards(
        rewards as CampaignRewardResult,
        levelId,
        playerFaction
      );
      
      // ✅ Логируем Mastery level up
      if (applyResult.masteryLevelUp) {
        console.log(`[MatchDirector] 🎉 Mastery Level Up: ${playerFaction} ${applyResult.masteryLevelUp.oldLevel} → ${applyResult.masteryLevelUp.newLevel}`);
        if (applyResult.masteryLevelUp.newSlotUnlocked) {
          console.log(`[MatchDirector] 🔓 New unit slot unlocked!`);
        }
      }
      
      // ===== КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Обновление прогресса кампании =====
      campaignResult = playerData.completeCampaignLevel(
        levelId,
        score.player1,
        score.player2,
        isWin
      );
      
      console.log('🎯 [MatchDirector] Campaign level progress updated:', {
        levelId,
        won: isWin,
        stars: campaignResult.starsEarned,
        unlockedNext: campaignResult.unlockedNextLevel,
        unlockedChapter: campaignResult.unlockedNextChapter,
      });
      // ===== КОНЕЦ ИСПРАВЛЕНИЯ =====
      
    } else if (mode === 'pvp') {
      this.applyStats(isWin, isDraw, score.player1, score.player2);
      rewards = RewardCalculator.calculatePvPRewards(matchStats);
      applyResult = RewardCalculator.applyRewards(rewards, playerFaction);
    } else if (mode === 'tournament') {
      // 🏆 TOURNAMENT: Повышенные награды
      // ✅ КРИТИЧНО: Сначала применяем статистику, потом проверяем достижения
      this.applyStats(isWin, isDraw, score.player1, score.player2);
      
      rewards = RewardCalculator.calculateTournamentRewards(matchStats);
      
      applyResult = RewardCalculator.applyRewards(rewards, playerFaction);
      
      // ✅ Логируем Mastery level up
      if (applyResult?.masteryLevelUp) {
        console.log(`[MatchDirector] 🏆 Tournament Mastery Level Up: ${playerFaction} ${applyResult.masteryLevelUp.oldLevel} → ${applyResult.masteryLevelUp.newLevel}`);
        if (applyResult.masteryLevelUp.newSlotUnlocked) {
          console.log(`[MatchDirector] 🔓 New unit slot unlocked!`);
        }
      }
      
    } else if (mode === 'league') {
      // 💰 LEAGUE: Награды с учетом взноса
      // ✅ КРИТИЧНО: Сначала применяем статистику, потом проверяем достижения
      this.applyStats(isWin, isDraw, score.player1, score.player2);
      
      const entryFee = (this.config as any).entryFee || 0;
      rewards = RewardCalculator.calculateLeagueRewards(matchStats, entryFee);
      
      applyResult = RewardCalculator.applyRewards(rewards, playerFaction);
      
      // ✅ Логируем Mastery level up
      if (applyResult?.masteryLevelUp) {
        console.log(`[MatchDirector] 💰 League Mastery Level Up: ${playerFaction} ${applyResult.masteryLevelUp.oldLevel} → ${applyResult.masteryLevelUp.newLevel}`);
        if (applyResult.masteryLevelUp.newSlotUnlocked) {
          console.log(`[MatchDirector] 🔓 New unit slot unlocked!`);
        }
      }
      
    } else if (mode === 'custom') {
      // 🤖 CUSTOM: Тренировка с AI - минимальные награды, без достижений и статистики
      console.log('[MatchDirector] Custom (training) match - applying minimal rewards, no achievements or stats');
      
      rewards = RewardCalculator.calculateCustomRewards(matchStats);
      
      // Применяем только награды (монеты), без статистики и достижений
      applyResult = RewardCalculator.applyRewards(rewards, playerFaction);
      
      // Не логируем Mastery level up, так как его нет в custom режиме
      
    } else {
      // ✅ Стандартный матч (quick, etc)
      // ✅ КРИТИЧНО: Сначала применяем статистику, потом проверяем достижения
      this.applyStats(isWin, isDraw, score.player1, score.player2);
      
      rewards = RewardCalculator.calculateStandardRewards(matchStats);
      
      applyResult = RewardCalculator.applyRewards(rewards, playerFaction);
      
      // ✅ Логируем Mastery level up
      if (applyResult?.masteryLevelUp) {
        console.log(`[MatchDirector] 🎉 Mastery Level Up: ${playerFaction} ${applyResult.masteryLevelUp.oldLevel} → ${applyResult.masteryLevelUp.newLevel}`);
        if (applyResult.masteryLevelUp.newSlotUnlocked) {
          console.log(`[MatchDirector] 🔓 New unit slot unlocked!`);
        }
      }
    }
    
    // ✅ Явно типизируем masteryXP
    const masteryXPData: MasteryXPData | undefined = rewards.masteryXP;
    
    // ✅ Формируем MatchResult для UI
    const result: MatchResult = {
      winner,
      isWin,
      isDraw,
      playerGoals: score.player1,
      opponentGoals: score.player2,
      xpEarned: rewards.xpEarned,
      coinsEarned: rewards.coinsEarned,
      isPerfectGame: rewards.isPerfectGame,
      newAchievements: rewards.newAchievements,
      reason,
      matchDuration: matchStats.matchDurationSeconds,
      // ✅ ИСПРАВЛЕНО: Mastery XP информация для UI
      masteryXP: masteryXPData,
      // ✅ ДОБАВЛЕНО: Информация о level up
      masteryLevelUp: applyResult?.masteryLevelUp ? {
        oldLevel: applyResult.masteryLevelUp.oldLevel,
        newLevel: applyResult.masteryLevelUp.newLevel,
        newSlotUnlocked: applyResult.masteryLevelUp.newSlotUnlocked,
        unlockedSlotIndex: applyResult.masteryLevelUp.newSlotUnlocked 
          ? (applyResult.masteryLevelUp.newLevel >= 6 ? 4 : 3) 
          : null,
        rewards: applyResult.masteryLevelUp.rewards || [],
      } : undefined,
    };
    
    // Добавляем поля кампании
    if (mode === 'campaign' && campaignConfig) {
      const campaignRewards = rewards as CampaignRewardResult;
      result.isCampaign = true;
      result.levelName = campaignConfig.levelConfig.name;
      
      // В кампании ничья = поражение
      if (isDraw) {
        result.isWin = false;
        result.winner = 2;
      }
      
      // ✅ ИСПРАВЛЕНО: Используем данные из completeCampaignLevel() (уже вызван выше)
      if (campaignResult) {
        result.starsEarned = campaignResult.starsEarned;
        result.isFirstClear = campaignResult.isFirstClear;
        result.unlockedNextLevel = campaignResult.unlockedNextLevel;
        result.unlockedNextChapter = campaignResult.unlockedNextChapter;
        
        if (campaignResult.rewards.unlockedUnitId) {
          result.unlockedUnitId = campaignResult.rewards.unlockedUnitId;
        }
        if (campaignResult.rewards.unlockedSkinId) {
          result.unlockedSkinId = campaignResult.rewards.unlockedSkinId;
        }
      } else {
        // Fallback на старые данные если completeCampaignLevel не был вызван
        result.starsEarned = campaignRewards.starsEarned;
        result.unlockedUnitId = campaignRewards.unlockedUnitId;
        result.unlockedSkinId = campaignRewards.unlockedSkinId;
        if (isWin) {
          result.unlockedNextLevel = true;
        }
      }
    }
    
    return result;
  }

  /**
   * ✅ ИЗМЕНЕНО: Упрощённая версия - только статистика, награды применяются через RewardCalculator
   */
  private applyStats(isWin: boolean, isDraw: boolean, playerGoals: number, opponentGoals: number): void {
    const statResult: 'win' | 'loss' | 'draw' = 
      isWin ? 'win' : isDraw ? 'draw' : 'loss';
    
    playerData.updateStats(statResult, playerGoals, opponentGoals);
    
    const playTimeSeconds = Math.floor(
      (this.internalState.matchEndTime! - this.internalState.matchStartTime) / 1000
    );
    playerData.addPlayTime(playTimeSeconds);
  }

  // ============================================================
  // ОБРАБОТЧИКИ СОБЫТИЙ
  // ============================================================

  private setupStateMachineHandlers(): void {
    // При смене хода
    this.stateMachine.onEnter(MatchPhase.WAITING, (ctx, from) => {
      if (from === MatchPhase.MOVING) {
        eventBus.dispatch(GameEvents.TURN_STARTED, {
          player: ctx.currentPlayer,
          turnNumber: ctx.turnNumber,
        });
      }
    });
  }

  private subscribeToEvents(): void {
    // Подписываемся на внешние события если нужно
  }

  // ============================================================
  // CLEANUP
  // ============================================================

  reset(): void {
    this.stopTimer();
    
    this.internalState = {
      score: { player1: 0, player2: 0 },
      shotsCount: 0,
      matchStartTime: 0,
      isMatchActive: false,
      goalsHistory: [],
    };
    
    this.remainingTime = this.config.matchDuration;
    this.stoppedFrames = 0;
    this.movingStartTime = 0;
    this.isPaused = false;
    
    this.stateMachine.reset();
  }

  destroy(): void {
    this.stopTimer();
    this.stateMachine.destroy();
    this.removeAllListeners();
  }
}