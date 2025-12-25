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
  private readonly STOP_THRESHOLD = 0.28;      // было 0.15 → объекты останавливаются естественнее
  private readonly FRAMES_TO_CONFIRM = 8;      // было 15 → быстрее подтверждение
  
  private movingStartTime = 0;
  private readonly MIN_MOVING_TIME = 400;      // было 800 → вдвое быстрее темп!
  
  private onTurnChangeCallback?: (player: PlayerNumber) => void;
  private onStateChangeCallback?: (state: GameState) => void;
  private onAllStoppedCallback?: () => void;
  
  private isPvPMode = false;
  private isHost = false;

  constructor(ball: Ball, caps: Cap[]) {
    this.ball = ball;
    this.caps = caps;
  }

  setPvPMode(enabled: boolean): void {
    this.isPvPMode = enabled;
  }

  setIsHost(host: boolean): void {
    this.isHost = host;
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
    this.movingStartTime = Date.now();
    this.setState('moving');
  }

  setPlayingState(): void {
    this.stoppedFrames = 0;
    this.setState('waiting');
  }

  update(): void {
    if (this.state !== 'moving') return;
    
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

  forceStop(): void {
    this.stoppedFrames = 0;
    this.setState('waiting');
  }

  setGoalState(): void {
    this.stoppedFrames = 0;
    this.setState('goal');
  }

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