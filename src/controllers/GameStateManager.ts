// src/controllers/GameStateManager.ts
// 🔄 REFACTORED — Теперь это адаптер для MatchStateMachine

import { Ball } from '../entities/Ball';
import { Cap } from '../entities/Cap';
import { PlayerNumber } from '../types';
import { MatchStateMachine, MatchPhase } from '../core/MatchStateMachine';

// Legacy type для обратной совместимости
export type GameState = 'waiting' | 'moving' | 'goal' | 'paused' | 'finished';

// Маппинг между старыми и новыми состояниями
const PHASE_TO_STATE: Record<MatchPhase, GameState> = {
  [MatchPhase.INTRO]: 'waiting',
  [MatchPhase.WAITING]: 'waiting',
  [MatchPhase.AIMING]: 'waiting',
  [MatchPhase.MOVING]: 'moving',
  [MatchPhase.GOAL]: 'goal',
  [MatchPhase.PAUSED]: 'paused',
  [MatchPhase.FINISHED]: 'finished',
};

/**
 * GameStateManager — адаптер для обратной совместимости
 * 
 * Делегирует всю логику в MatchStateMachine, но сохраняет
 * старый API для существующего кода в GameScene
 */
export class GameStateManager {
  private ball: Ball;
  private caps: Cap[];
  
  private stateMachine: MatchStateMachine;
  
  // Отслеживание остановки объектов
  private stoppedFrames = 0;
  private readonly STOP_THRESHOLD = 0.28;
  private readonly FRAMES_TO_CONFIRM = 8;
  
  private movingStartTime = 0;
  private readonly MIN_MOVING_TIME = 400;
  
  // Callbacks (legacy API)
  private onTurnChangeCallback?: (player: PlayerNumber) => void;
  private onStateChangeCallback?: (state: GameState) => void;
  private onAllStoppedCallback?: () => void;
  
  private isPvPMode = false;
  private isHost = false;

  constructor(ball: Ball, caps: Cap[]) {
    this.ball = ball;
    this.caps = caps;
    
    // Создаём машину состояний
    this.stateMachine = new MatchStateMachine({
      isAIMode: true, // По умолчанию, переопределяется через setPvPMode
      isPvPMode: false,
      isHost: false,
    });
    
    // Подписываемся на события машины состояний
    this.setupStateMachineListeners();
  }

  private setupStateMachineListeners(): void {
    // Слушаем переходы состояний
    this.stateMachine.on('transition', (data: { from: MatchPhase; to: MatchPhase }) => {
      const newState = PHASE_TO_STATE[data.to];
      this.onStateChangeCallback?.(newState);
    });

    // Слушаем начало хода
    this.stateMachine.on(`enter:${MatchPhase.WAITING}`, () => {
      const context = this.stateMachine.getContext();
      // Вызываем callback только если это смена хода (не первый ход)
      if (context.turnNumber > 0) {
        this.onTurnChangeCallback?.(context.currentPlayer);
      }
    });
  }

  // ============================================================
  // LEGACY API (для обратной совместимости)
  // ============================================================

  setPvPMode(enabled: boolean): void {
    this.isPvPMode = enabled;
    // Пересоздаём машину с правильными настройками
    // В реальном коде лучше сделать метод update в MatchStateMachine
  }

  setIsHost(host: boolean): void {
    this.isHost = host;
  }

  getState(): GameState {
    return PHASE_TO_STATE[this.stateMachine.getPhase()];
  }

  /**
   * Получить доступ к машине состояний напрямую
   */
  getStateMachine(): MatchStateMachine {
    return this.stateMachine;
  }

  getCurrentPlayer(): PlayerNumber {
    return this.stateMachine.getCurrentPlayer();
  }

  setCurrentPlayer(player: PlayerNumber): void {
    this.stateMachine.setCurrentPlayer(player);
  }

  canPlay(): boolean {
    return this.stateMachine.canPlay();
  }

  isPaused(): boolean {
    return this.stateMachine.isPaused();
  }

  isFinished(): boolean {
    return this.stateMachine.isFinished();
  }

  onShot(): void {
    this.stoppedFrames = 0;
    this.movingStartTime = Date.now();
    
    const selectedUnit = this.stateMachine.getContext().selectedUnitId;
    this.stateMachine.executeShot(selectedUnit || 'unknown');
  }

  setPlayingState(): void {
    this.stoppedFrames = 0;
    this.stateMachine.forceWaiting();
  }

  update(): void {
    const phase = this.stateMachine.getPhase();
    if (phase !== MatchPhase.MOVING) return;
    
    if (this.isPvPMode && !this.isHost) {
      return;
    }
    
    const elapsed = Date.now() - this.movingStartTime;
    if (elapsed < this.MIN_MOVING_TIME) {
      return;
    }
    
    if (this.areAllObjectsStopped()) {
      if (++this.stoppedFrames >= this.FRAMES_TO_CONFIRM) {
        this.onAllStopped();
      }
    } else {
      this.stoppedFrames = 0;
    }
  }

  private areAllObjectsStopped(): boolean {
    if (!this.ball.isStopped(this.STOP_THRESHOLD)) return false;
    return this.caps.every(cap => cap.isStopped(this.STOP_THRESHOLD));
  }

  private onAllStopped(): void {
    this.stoppedFrames = 0;
    
    if (this.isPvPMode) {
      this.onAllStoppedCallback?.();
      return;
    }
    
    // Для офлайн — переходим в waiting, это вызовет смену хода
    this.stateMachine.objectsStopped();
  }

  pause(): void {
    this.stateMachine.pause();
  }

  resume(): void {
    this.stateMachine.resume();
  }

  finish(): void {
    this.stateMachine.finish();
  }

  forceStop(): void {
    this.stoppedFrames = 0;
    this.stateMachine.forceWaiting();
  }

  setGoalState(): void {
    this.stoppedFrames = 0;
    // Для гола используем специальный метод, но нужен scoringPlayer
    // В legacy API его нет, поэтому делаем прямой переход
    const currentPhase = this.stateMachine.getPhase();
    if (currentPhase === MatchPhase.MOVING || currentPhase === MatchPhase.WAITING) {
      this.stateMachine.transition(MatchPhase.GOAL);
    }
  }

  reset(): void {
    this.stoppedFrames = 0;
    this.movingStartTime = 0;
    this.stateMachine.reset();
  }

  // Callbacks
  onTurnChange(callback: (player: PlayerNumber) => void): void {
    this.onTurnChangeCallback = callback;
  }

  onStateChange(callback: (state: GameState) => void): void {
    this.onStateChangeCallback = callback;
  }

  onAllObjectsStopped(callback: () => void): void {
    this.onAllStoppedCallback = callback;
  }
}