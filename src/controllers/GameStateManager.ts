// src/controllers/GameStateManager.ts

import { Ball } from '../entities/Ball';
import { Cap } from '../entities/Cap';
import { PlayerNumber } from '../types';

export type GameState = 'waiting' | 'moving' | 'goal' | 'paused' | 'finished';

export class GameStateManager {
  private state: GameState = 'waiting';
  private previousState: GameState = 'waiting';
  private currentPlayer: PlayerNumber = 1;
  
  private ball: Ball;
  private caps: Cap[];
  
  private stoppedFrames = 0;
  private readonly STOP_THRESHOLD = 0.15;
  private readonly FRAMES_TO_CONFIRM = 10;
  
  private onTurnChangeCallback?: (player: PlayerNumber) => void;
  private onStateChangeCallback?: (state: GameState) => void;
  private onAllStoppedCallback?: () => void;

  constructor(ball: Ball, caps: Cap[]) {
    this.ball = ball;
    this.caps = caps;
  }

  getState(): GameState {
    return this.state;
  }

  getCurrentPlayer(): PlayerNumber {
    return this.currentPlayer;
  }

  setCurrentPlayer(player: PlayerNumber): void {
    this.currentPlayer = player;
  }

  canPlay(): boolean {
    return this.state === 'waiting';
  }

  isPaused(): boolean {
    return this.state === 'paused';
  }

  isFinished(): boolean {
    return this.state === 'finished';
  }

  onShot(): void {
    this.stoppedFrames = 0;
    this.setState('moving');
  }

  update(): void {
    if (this.state !== 'moving') return;
    
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
    this.onAllStoppedCallback?.();
    this.nextTurn();
  }

  private nextTurn(): void {
    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    this.onTurnChangeCallback?.(this.currentPlayer);
    this.setState('waiting');
  }

  private setState(newState: GameState): void {
    if (this.state === newState) return;
    
    this.previousState = this.state;
    this.state = newState;
    this.onStateChangeCallback?.(newState);
  }

  pause(): void {
    if (this.state !== 'paused' && this.state !== 'finished') {
      this.setState('paused');
    }
  }

  resume(): void {
    if (this.state === 'paused') {
      this.setState(this.previousState);
    }
  }

  finish(): void {
    this.setState('finished');
  }

  /** Принудительно останавливает и переводит в waiting */
  forceStop(): void {
    this.stoppedFrames = 0;
    this.setState('waiting');
  }

  /** Устанавливает состояние гола */
  setGoalState(): void {
    this.stoppedFrames = 0;
    this.setState('goal');
  }

  // Event subscriptions
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