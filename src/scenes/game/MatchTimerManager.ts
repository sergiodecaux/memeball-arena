// src/scenes/game/MatchTimerManager.ts

import Phaser from 'phaser';

export interface MatchTimerCallbacks {
  onTick: (remaining: number, total: number) => void;
  onTimeUp: () => void;
  onWarning30: () => void;
  onWarning10: () => void;
}

export class MatchTimerManager {
  private scene: Phaser.Scene;
  private duration: number;
  private remaining: number;
  private timerEvent?: Phaser.Time.TimerEvent;
  private isPaused = false;
  private isStarted = false;
  private callbacks: MatchTimerCallbacks;

  constructor(scene: Phaser.Scene, duration: number, callbacks: MatchTimerCallbacks) {
    this.scene = scene;
    this.duration = duration;
    this.remaining = duration;
    this.callbacks = callbacks;
  }

  start(): void {
    if (this.isStarted) return;
    
    this.isStarted = true;
    this.remaining = this.duration;
    this.isPaused = false;

    this.timerEvent = this.scene.time.addEvent({
      delay: 1000,
      callback: () => this.tick(),
      loop: true,
    });

    console.log(`[MatchTimer] Started: ${this.duration} seconds`);
  }

  private tick(): void {
    if (this.isPaused) return;

    this.remaining--;
    this.callbacks.onTick(this.remaining, this.duration);

    if (this.remaining <= 0) {
      this.remaining = 0;
      this.stop();
      this.callbacks.onTimeUp();
      return;
    }

    if (this.remaining === 30) {
      this.callbacks.onWarning30();
    }

    if (this.remaining <= 10 && this.remaining > 0) {
      this.callbacks.onWarning10();
    }
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  stop(): void {
    this.isStarted = false;
    if (this.timerEvent) {
      this.timerEvent.destroy();
      this.timerEvent = undefined;
    }
  }

  reset(): void {
    this.stop();
    this.remaining = this.duration;
    this.isPaused = false;
  }

  getRemaining(): number {
    return this.remaining;
  }

  getDuration(): number {
    return this.duration;
  }

  setRemaining(time: number): void {
    this.remaining = Math.max(0, time);
  }

  setDuration(duration: number): void {
    this.duration = duration;
  }

  isRunning(): boolean {
    return this.isStarted && !this.isPaused;
  }

  destroy(): void {
    this.stop();
  }
}