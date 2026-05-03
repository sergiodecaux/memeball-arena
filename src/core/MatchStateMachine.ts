// src/core/MatchStateMachine.ts
// 🎮 Централизованная машина состояний матча

import Phaser from 'phaser';
import { PlayerNumber } from '../types';
import { eventBus, GameEvents } from './EventBus';

// ========== СОСТОЯНИЯ ==========

export enum MatchPhase {
  /** Начальная заставка / интро */
  INTRO = 'intro',
  
  /** Ожидание действия игрока */
  WAITING = 'waiting',
  
  /** Игрок прицеливается (drag) */
  AIMING = 'aiming',
  
  /** Объекты в движении */
  MOVING = 'moving',
  
  /** Гол забит, празднование */
  GOAL = 'goal',
  
  /** Игра на паузе */
  PAUSED = 'paused',
  
  /** Матч завершён */
  FINISHED = 'finished',
}

// ========== СОБЫТИЯ МАШИНЫ СОСТОЯНИЙ ==========

export interface MatchStateContext {
  /** Чей сейчас ход */
  currentPlayer: PlayerNumber;
  
  /** Номер хода */
  turnNumber: number;
  
  /** ID выбранного юнита */
  selectedUnitId?: string;
  
  /** ID последнего стрелявшего юнита */
  lastShootingUnitId?: string;
  
  /** Время начала текущей фазы */
  phaseStartTime: number;
  
  /** Предыдущая фаза (для возврата из паузы) */
  previousPhase: MatchPhase;
  
  /** Счёт */
  score: {
    player1: number;
    player2: number;
  };
  
  /** Кто забил последний гол */
  lastGoalBy?: PlayerNumber;
  
  /** Флаг: AI режим */
  isAIMode: boolean;
  
  /** Флаг: PvP режим */
  isPvPMode: boolean;
  
  /** Флаг: это хост (для PvP) */
  isHost: boolean;
}

export interface StateTransition {
  from: MatchPhase;
  to: MatchPhase;
  context: MatchStateContext;
  timestamp: number;
}

export type StateEnterHandler = (context: MatchStateContext, from: MatchPhase) => void;
export type StateExitHandler = (context: MatchStateContext, to: MatchPhase) => void;
export type TransitionValidator = (context: MatchStateContext) => boolean;

// ========== КОНФИГУРАЦИЯ ПЕРЕХОДОВ ==========

interface TransitionConfig {
  /** Разрешённые переходы из данного состояния */
  allowedTransitions: MatchPhase[];
  
  /** Валидатор перехода (опционально) */
  validator?: TransitionValidator;
}

const STATE_TRANSITIONS: Record<MatchPhase, TransitionConfig> = {
  [MatchPhase.INTRO]: {
    allowedTransitions: [MatchPhase.WAITING, MatchPhase.FINISHED],
  },
  
  [MatchPhase.WAITING]: {
    allowedTransitions: [
      MatchPhase.AIMING, 
      MatchPhase.MOVING, 
      MatchPhase.PAUSED, 
      MatchPhase.FINISHED,
    ],
  },
  
  [MatchPhase.AIMING]: {
    allowedTransitions: [
      MatchPhase.WAITING,  // Отмена прицеливания
      MatchPhase.MOVING,   // Выстрел
      MatchPhase.PAUSED,
      MatchPhase.FINISHED, // Конец матча по таймеру (ничья / победа) — не блокировать результат
    ],
  },
  
  [MatchPhase.MOVING]: {
    allowedTransitions: [
      MatchPhase.WAITING,  // Все остановились
      MatchPhase.GOAL,     // Гол
      MatchPhase.PAUSED,
      MatchPhase.FINISHED,
    ],
  },
  
  [MatchPhase.GOAL]: {
    allowedTransitions: [
      MatchPhase.WAITING,  // Продолжение игры
      MatchPhase.FINISHED, // Матч окончен
    ],
  },
  
  [MatchPhase.PAUSED]: {
    allowedTransitions: [
      MatchPhase.WAITING,
      MatchPhase.AIMING,
      MatchPhase.MOVING,
      MatchPhase.FINISHED,
    ],
  },
  
  [MatchPhase.FINISHED]: {
    allowedTransitions: [], // Финальное состояние
  },
};

// ========== МАШИНА СОСТОЯНИЙ ==========

export class MatchStateMachine extends Phaser.Events.EventEmitter {
  private currentPhase: MatchPhase = MatchPhase.INTRO;
  private context: MatchStateContext;
  
  // Обработчики входа/выхода из состояний
  private enterHandlers: Map<MatchPhase, StateEnterHandler[]> = new Map();
  private exitHandlers: Map<MatchPhase, StateExitHandler[]> = new Map();
  
  // История переходов (для отладки)
  private transitionHistory: StateTransition[] = [];
  private readonly MAX_HISTORY_LENGTH = 50;
  
  // Флаг блокировки переходов (для предотвращения гонок)
  private isTransitioning: boolean = false;

  constructor(config: {
    isAIMode: boolean;
    isPvPMode: boolean;
    isHost: boolean;
    startingPlayer?: PlayerNumber;
  }) {
    super();
    
    this.context = {
      currentPlayer: config.startingPlayer || 1,
      turnNumber: 0,
      selectedUnitId: undefined,
      lastShootingUnitId: undefined,
      phaseStartTime: Date.now(),
      previousPhase: MatchPhase.INTRO,
      score: { player1: 0, player2: 0 },
      lastGoalBy: undefined,
      isAIMode: config.isAIMode,
      isPvPMode: config.isPvPMode,
      isHost: config.isHost,
    };
    
    this.setupDefaultHandlers();
  }

  // ============================================================
  // ПУБЛИЧНЫЙ API
  // ============================================================

  /**
   * Получить текущую фазу
   */
  getPhase(): MatchPhase {
    return this.currentPhase;
  }

  /**
   * Получить контекст (только для чтения)
   */
  getContext(): Readonly<MatchStateContext> {
    return { ...this.context };
  }

  /**
   * Получить текущего игрока
   */
  getCurrentPlayer(): PlayerNumber {
    return this.context.currentPlayer;
  }

  /**
   * Получить номер хода
   */
  getTurnNumber(): number {
    return this.context.turnNumber;
  }

  /**
   * Получить счёт
   */
  getScore(): { player1: number; player2: number } {
    return { ...this.context.score };
  }

  /**
   * Проверка: можно ли играть (ход игрока)
   */
  canPlay(): boolean {
    return this.currentPhase === MatchPhase.WAITING || 
           this.currentPhase === MatchPhase.AIMING;
  }

  /**
   * Проверка: игра на паузе
   */
  isPaused(): boolean {
    return this.currentPhase === MatchPhase.PAUSED;
  }

  /**
   * Проверка: матч завершён
   */
  isFinished(): boolean {
    return this.currentPhase === MatchPhase.FINISHED;
  }

  /**
   * Проверка: объекты в движении
   */
  isMoving(): boolean {
    return this.currentPhase === MatchPhase.MOVING;
  }

  // ============================================================
  // ПЕРЕХОДЫ СОСТОЯНИЙ
  // ============================================================

  /**
   * Попытка перейти в новое состояние
   */
  transition(to: MatchPhase): boolean {
    if (this.isTransitioning) {
      console.warn(`[StateMachine] Blocked transition to ${to} — already transitioning`);
      return false;
    }

    if (!this.canTransitionTo(to)) {
      console.warn(`[StateMachine] Invalid transition: ${this.currentPhase} → ${to}`);
      return false;
    }

    this.isTransitioning = true;

    const from = this.currentPhase;
    const timestamp = Date.now();

    // 1. Выполняем exit handlers
    this.executeExitHandlers(from, to);

    // 2. Обновляем состояние
    this.context.previousPhase = from;
    this.context.phaseStartTime = timestamp;
    this.currentPhase = to;

    // 3. Записываем в историю
    this.recordTransition(from, to, timestamp);

    // 4. Выполняем enter handlers
    this.executeEnterHandlers(to, from);

    // 5. Эмитим события
    this.emit('transition', { from, to, context: this.getContext() });
    this.emit(`enter:${to}`, this.getContext());
    this.emit(`exit:${from}`, this.getContext());

    // 6. Отправляем в EventBus
    this.dispatchToEventBus(from, to);

    console.log(`[StateMachine] ${from} → ${to}`);

    this.isTransitioning = false;
    return true;
  }

  /**
   * Проверка: можно ли перейти в указанное состояние
   */
  canTransitionTo(to: MatchPhase): boolean {
    const config = STATE_TRANSITIONS[this.currentPhase];
    
    if (!config.allowedTransitions.includes(to)) {
      return false;
    }

    if (config.validator && !config.validator(this.context)) {
      return false;
    }

    return true;
  }

  // ============================================================
  // ИГРОВЫЕ ДЕЙСТВИЯ (высокоуровневый API)
  // ============================================================

  /**
   * Начать матч (после интро)
   */
  startMatch(): boolean {
    if (this.currentPhase !== MatchPhase.INTRO) {
      console.warn('[StateMachine] Cannot start match — not in INTRO phase');
      return false;
    }

    this.context.turnNumber = 1;
    return this.transition(MatchPhase.WAITING);
  }

  /**
   * Игрок начал прицеливаться
   */
  startAiming(unitId: string): boolean {
    if (this.currentPhase !== MatchPhase.WAITING) {
      return false;
    }

    this.context.selectedUnitId = unitId;
    return this.transition(MatchPhase.AIMING);
  }

  /**
   * Игрок отменил прицеливание
   */
  cancelAiming(): boolean {
    if (this.currentPhase !== MatchPhase.AIMING) {
      return false;
    }

    this.context.selectedUnitId = undefined;
    return this.transition(MatchPhase.WAITING);
  }

  /**
   * Выстрел произведён
   */
  executeShot(unitId: string): boolean {
    if (this.currentPhase !== MatchPhase.WAITING && 
        this.currentPhase !== MatchPhase.AIMING) {
      return false;
    }

    this.context.lastShootingUnitId = unitId;
    this.context.selectedUnitId = undefined;
    return this.transition(MatchPhase.MOVING);
  }

  /**
   * Все объекты остановились, игрок НЕ меняется (бонусный ход).
   */
  objectsStoppedSamePlayer(): boolean {
    if (this.currentPhase !== MatchPhase.MOVING) {
      return false;
    }

    this.context.turnNumber++;
    this.context.lastShootingUnitId = undefined;

    return this.transition(MatchPhase.WAITING);
  }

  /**
   * Все объекты остановились
   */
  objectsStopped(): boolean {
    if (this.currentPhase !== MatchPhase.MOVING) {
      return false;
    }

    // Переключаем игрока
    this.context.currentPlayer = this.context.currentPlayer === 1 ? 2 : 1;
    this.context.turnNumber++;
    this.context.lastShootingUnitId = undefined;

    return this.transition(MatchPhase.WAITING);
  }

  /**
   * Гол забит
   */
  goalScored(scoringPlayer: PlayerNumber): boolean {
    if (this.currentPhase !== MatchPhase.MOVING && 
        this.currentPhase !== MatchPhase.WAITING) {
      return false;
    }

    // Обновляем счёт
    if (scoringPlayer === 1) {
      this.context.score.player1++;
    } else {
      this.context.score.player2++;
    }
    
    this.context.lastGoalBy = scoringPlayer;

    return this.transition(MatchPhase.GOAL);
  }

  /**
   * Продолжить после гола
   */
  continueAfterGoal(nextPlayer: PlayerNumber): boolean {
    if (this.currentPhase !== MatchPhase.GOAL) {
      return false;
    }

    this.context.currentPlayer = nextPlayer;
    this.context.lastShootingUnitId = undefined;
    this.context.selectedUnitId = undefined;

    return this.transition(MatchPhase.WAITING);
  }

  /**
   * Поставить на паузу
   */
  pause(): boolean {
    if (this.currentPhase === MatchPhase.PAUSED || 
        this.currentPhase === MatchPhase.FINISHED) {
      return false;
    }

    return this.transition(MatchPhase.PAUSED);
  }

  /**
   * Снять с паузы
   */
  resume(): boolean {
    if (this.currentPhase !== MatchPhase.PAUSED) {
      return false;
    }

    // Возвращаемся в предыдущее состояние
    return this.transition(this.context.previousPhase);
  }

  /**
   * Завершить матч
   */
  finish(): boolean {
    if (this.currentPhase === MatchPhase.FINISHED) {
      return false;
    }

    return this.transition(MatchPhase.FINISHED);
  }

  /**
   * Принудительно установить состояние ожидания
   */
  forceWaiting(): boolean {
    this.context.selectedUnitId = undefined;
    
    // Обходим валидацию для принудительного сброса
    this.currentPhase = MatchPhase.WAITING;
    this.context.phaseStartTime = Date.now();
    
    console.log('[StateMachine] Force reset to WAITING');
    return true;
  }

  /**
   * Установить текущего игрока (для PvP синхронизации)
   */
  setCurrentPlayer(player: PlayerNumber): void {
    this.context.currentPlayer = player;
  }

  /**
   * Установить номер хода (для PvP синхронизации)
   */
  setTurnNumber(turnNumber: number): void {
    this.context.turnNumber = turnNumber;
  }

  /**
   * Установить счёт (для PvP синхронизации)
   */
  setScore(player1: number, player2: number): void {
    this.context.score.player1 = player1;
    this.context.score.player2 = player2;
  }

  /**
   * Выбрать юнита
   */
  selectUnit(unitId: string | undefined): void {
    this.context.selectedUnitId = unitId;
  }

  // ============================================================
  // ОБРАБОТЧИКИ СОСТОЯНИЙ
  // ============================================================

  /**
   * Добавить обработчик входа в состояние
   */
  onEnter(phase: MatchPhase, handler: StateEnterHandler): this {
    const handlers = this.enterHandlers.get(phase) || [];
    handlers.push(handler);
    this.enterHandlers.set(phase, handlers);
    return this;
  }

  /**
   * Добавить обработчик выхода из состояния
   */
  onExit(phase: MatchPhase, handler: StateExitHandler): this {
    const handlers = this.exitHandlers.get(phase) || [];
    handlers.push(handler);
    this.exitHandlers.set(phase, handlers);
    return this;
  }

  /**
   * Удалить все обработчики
   */
  clearHandlers(): void {
    this.enterHandlers.clear();
    this.exitHandlers.clear();
  }

  private executeEnterHandlers(phase: MatchPhase, from: MatchPhase): void {
    const handlers = this.enterHandlers.get(phase) || [];
    handlers.forEach(handler => {
      try {
        handler(this.context, from);
      } catch (e) {
        console.error(`[StateMachine] Error in enter handler for ${phase}:`, e);
      }
    });
  }

  private executeExitHandlers(phase: MatchPhase, to: MatchPhase): void {
    const handlers = this.exitHandlers.get(phase) || [];
    handlers.forEach(handler => {
      try {
        handler(this.context, to);
      } catch (e) {
        console.error(`[StateMachine] Error in exit handler for ${phase}:`, e);
      }
    });
  }

  // ============================================================
  // ДЕФОЛТНЫЕ ОБРАБОТЧИКИ
  // ============================================================

  private setupDefaultHandlers(): void {
    // При входе в WAITING — эмитим событие начала хода
    this.onEnter(MatchPhase.WAITING, (ctx, from) => {
      if (from === MatchPhase.MOVING || from === MatchPhase.GOAL || from === MatchPhase.INTRO) {
        eventBus.dispatch(GameEvents.TURN_STARTED, {
          player: ctx.currentPlayer,
          turnNumber: ctx.turnNumber,
        });
      }
    });

    // При выходе из MOVING — эмитим событие конца хода
    this.onExit(MatchPhase.MOVING, (ctx, to) => {
      if (to === MatchPhase.WAITING) {
        eventBus.dispatch(GameEvents.TURN_ENDED, {
          player: ctx.currentPlayer === 1 ? 2 : 1, // Предыдущий игрок
          turnNumber: ctx.turnNumber - 1,
        });
      }
    });

    // При входе в GOAL — эмитим событие гола
    this.onEnter(MatchPhase.GOAL, (ctx) => {
      if (ctx.lastGoalBy) {
        eventBus.dispatch(GameEvents.GOAL_SCORED, {
          scoringPlayer: ctx.lastGoalBy,
          scores: { ...ctx.score },
        });
      }
    });

    // FINISHED: событие match:finished шлёт только MatchDirector (один раз, с mode и reason).
  }

  // ============================================================
  // ИНТЕГРАЦИЯ С EVENTBUS
  // ============================================================

  private dispatchToEventBus(from: MatchPhase, to: MatchPhase): void {
    // Специфичные события уже отправляются в setupDefaultHandlers
    // Здесь можно добавить дополнительную логику при необходимости
  }

  // ============================================================
  // ИСТОРИЯ И ОТЛАДКА
  // ============================================================

  private recordTransition(from: MatchPhase, to: MatchPhase, timestamp: number): void {
    this.transitionHistory.push({
      from,
      to,
      context: { ...this.context },
      timestamp,
    });

    // Ограничиваем размер истории
    if (this.transitionHistory.length > this.MAX_HISTORY_LENGTH) {
      this.transitionHistory.shift();
    }
  }

  /**
   * Получить историю переходов
   */
  getTransitionHistory(): StateTransition[] {
    return [...this.transitionHistory];
  }

  /**
   * Получить последний переход
   */
  getLastTransition(): StateTransition | undefined {
    return this.transitionHistory[this.transitionHistory.length - 1];
  }

  /**
   * Сбросить машину состояний
   */
  reset(): void {
    this.currentPhase = MatchPhase.INTRO;
    this.context = {
      currentPlayer: 1,
      turnNumber: 0,
      selectedUnitId: undefined,
      lastShootingUnitId: undefined,
      phaseStartTime: Date.now(),
      previousPhase: MatchPhase.INTRO,
      score: { player1: 0, player2: 0 },
      lastGoalBy: undefined,
      isAIMode: this.context.isAIMode,
      isPvPMode: this.context.isPvPMode,
      isHost: this.context.isHost,
    };
    this.transitionHistory = [];
    this.isTransitioning = false;

    console.log('[StateMachine] Reset complete');
  }

  /**
   * Очистка ресурсов
   */
  destroy(): void {
    this.clearHandlers();
    this.removeAllListeners();
    this.transitionHistory = [];
  }
}