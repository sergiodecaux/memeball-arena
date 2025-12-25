// src/scenes/game/PvPSyncManager.ts

import Phaser from 'phaser';
import { Ball } from '../../entities/Ball';
import { GameUnit, Snapshot } from './types';
import { FieldBounds, PlayerNumber } from '../../types';
import {
  MultiplayerManager,
  ShootData,
  PositionsData,
  MatchTimerData,
  MatchFinishedData,
  FinalPositions,
  PvPPlayer,
} from '../../managers/MultiplayerManager';
import { PvPDebugLogger } from './PvPDebugLogger';
import { hasPlayHitEffect } from './types';

export interface PvPSyncConfig {
  isHost: boolean;
  myPlayerIndex: number;
}

export interface PvPSyncCallbacks {
  onShootExecuted: (data: ShootData, isMyShoot: boolean) => void;
  onTurnChange: (data: { currentTurn: string; scores: Record<string, number> }) => void;
  onGoalScored: (data: {
    scorerId: string;
    scores: Record<string, number>;
    winner: string | null;
    finalPositions?: FinalPositions;
  }) => void;
  onContinueGame: (data: { currentTurn: string }) => void;
  onMatchFinished: (data: MatchFinishedData) => void;
  onOpponentLeft: (reason: string, data: any) => void;
  onTimerUpdate: (remaining: number, total: number) => void;
}

export class PvPSyncManager {
  private scene: Phaser.Scene;
  private mp: MultiplayerManager;
  private config: PvPSyncConfig;
  private callbacks: PvPSyncCallbacks;
  private debug: PvPDebugLogger;

  private snapshotBuffer: Snapshot[] = [];
  private lastServerSnapshot?: Snapshot;
  private serverTimeOffset = 0;
  private timeSyncSamples: number[] = [];
  private syncInterval?: Phaser.Time.TimerEvent;

  private readonly MAX_SNAPSHOTS = 30;
  private readonly MAX_TIME_SYNC_SAMPLES = 5;

  constructor(
    scene: Phaser.Scene,
    config: PvPSyncConfig,
    callbacks: PvPSyncCallbacks,
    debug: PvPDebugLogger
  ) {
    this.scene = scene;
    this.mp = MultiplayerManager.getInstance();
    this.config = config;
    this.callbacks = callbacks;
    this.debug = debug;
  }

  setupListeners(): void {
    this.mp.on('shoot_executed', (data: ShootData) => {
      const isMyShoot = (data as any).shooterId === this.mp.getMyId();
      this.callbacks.onShootExecuted(data, isMyShoot);
    });

    this.mp.on(
      'turn_change',
      (data: { currentTurn: string; scores: Record<string, number> }) => {
        this.callbacks.onTurnChange(data);
      }
    );

    if (!this.config.isHost) {
      this.mp.on('positions_update', (data: PositionsData) =>
        this.handlePositionsUpdate(data)
      );
      this.mp.on('snapshot', (data: Snapshot) => this.handleSnapshot(data));
    }

    this.mp.on('match_timer', (data: MatchTimerData) => {
      this.callbacks.onTimerUpdate(data.remainingTime, data.totalTime);
    });

    this.mp.on(
      'goal_scored',
      (data: {
        scorerId: string;
        scores: Record<string, number>;
        winner: string | null;
        finalPositions?: FinalPositions;
      }) => {
        this.callbacks.onGoalScored(data);
      }
    );

    this.mp.on('continue_game', (data: { currentTurn: string }) => {
      this.callbacks.onContinueGame(data);
    });

    this.mp.on('match_finished', (data: MatchFinishedData) => {
      this.callbacks.onMatchFinished(data);
    });

    this.mp.on('opponent_surrendered', (data: any) => {
      this.callbacks.onOpponentLeft('surrendered', data);
    });

    this.mp.on('opponent_disconnected', (data: any) => {
      this.callbacks.onOpponentLeft('disconnected', data);
    });

    this.mp.on('pong_sync', (data: { clientTime: number; serverTime: number }) => {
      this.handlePongSync(data);
    });
  }

  startTimeSync(): void {
    this.scene.time.addEvent({
      delay: 5000,
      callback: () => this.sendTimeSync(),
      loop: true,
    });

    this.sendTimeSync();
    this.scene.time.delayedCall(200, () => this.sendTimeSync());
    this.scene.time.delayedCall(400, () => this.sendTimeSync());
  }

  private sendTimeSync(): void {
    if (this.mp?.getConnectionStatus()) {
      this.mp.sendPingSync(Date.now());
    }
  }

  private handlePongSync(data: { clientTime: number; serverTime: number }): void {
    const now = Date.now();
    const clientTimeSent = Number(data.clientTime);
    const serverTime = Number(data.serverTime);

    if (isNaN(clientTimeSent) || isNaN(serverTime)) return;

    const rtt = now - clientTimeSent;
    if (rtt > 1000) return;

    const offset = serverTime - now + Math.floor(rtt / 2);

    this.timeSyncSamples.push(offset);
    if (this.timeSyncSamples.length > this.MAX_TIME_SYNC_SAMPLES) {
      this.timeSyncSamples.shift();
    }

    const sorted = [...this.timeSyncSamples].sort((a, b) => a - b);
    this.serverTimeOffset = sorted[Math.floor(sorted.length / 2)];

    this.debug.log('TIME', `RTT: ${rtt}ms, Offset: ${this.serverTimeOffset}ms`);
  }

  startSyncInterval(
    getBall: () => Ball,
    getCaps: () => GameUnit[]
  ): void {
    if (!this.config.isHost) return;

    this.syncInterval = this.scene.time.addEvent({
      delay: 33,
      callback: () => this.sendPositionsToGuest(getBall, getCaps),
      loop: true,
    });
  }

  private sendPositionsToGuest(
    getBall: () => Ball,
    getCaps: () => GameUnit[]
  ): void {
    if (!this.mp.getConnectionStatus()) return;

    const ball = getBall();
    const caps = getCaps();
    const isMoving =
      ball.getSpeed() > 0.5 || caps.some((c) => c.getSpeed() > 0.5);

    this.mp.sendSyncPositions(
      {
        x: ball.body.position.x,
        y: ball.body.position.y,
        vx: ball.body.velocity.x,
        vy: ball.body.velocity.y,
      },
      caps.map((cap) => ({
        x: cap.body.position.x,
        y: cap.body.position.y,
        vx: cap.body.velocity.x,
        vy: cap.body.velocity.y,
      })),
      isMoving
    );
  }

  private handlePositionsUpdate(data: PositionsData): void {
    if (this.config.isHost) return;

    const snapshot: Snapshot = {
      tick: (data as any).tick || 0,
      serverTime: Number((data as any).serverTime) || Date.now(),
      ball: data.ball,
      caps: data.caps,
      isMoving: (data as any).isMoving,
    };

    this.lastServerSnapshot = snapshot;
    this.addSnapshot(snapshot);
  }

  private handleSnapshot(data: Snapshot): void {
    if (this.config.isHost) return;

    const snapshot = {
      ...data,
      serverTime: Number(data.serverTime) || Date.now(),
    };

    this.lastServerSnapshot = snapshot;
    this.addSnapshot(snapshot);
  }

  private addSnapshot(snapshot: Snapshot): void {
    this.snapshotBuffer.push(snapshot);
    while (this.snapshotBuffer.length > this.MAX_SNAPSHOTS) {
      this.snapshotBuffer.shift();
    }
  }

  interpolateAndApply(
    ball: Ball,
    caps: GameUnit[],
    fieldBounds: FieldBounds
  ): void {
    const latest =
      this.snapshotBuffer.length > 0
        ? this.snapshotBuffer[this.snapshotBuffer.length - 1]
        : this.lastServerSnapshot;

    if (!latest) return;

    const smoothMove = (current: number, target: number): number => {
      const diff = target - current;
      const distance = Math.abs(diff);

      if (distance < 1) return target;

      let factor: number;
      if (distance > 100) factor = 0.5;
      else if (distance > 50) factor = 0.4;
      else if (distance > 20) factor = 0.3;
      else factor = 0.2;

      return current + diff * factor;
    };

    const clampToBounds = (
      x: number,
      y: number,
      radius: number
    ): { x: number; y: number } => {
      return {
        x: Phaser.Math.Clamp(
          x,
          fieldBounds.left + radius,
          fieldBounds.right - radius
        ),
        y: Phaser.Math.Clamp(
          y,
          fieldBounds.top + radius,
          fieldBounds.bottom - radius
        ),
      };
    };

    // Apply ball position
    const ballRadius = ball.getRadius();
    const clampedBall = clampToBounds(latest.ball.x, latest.ball.y, ballRadius);

    const ballPos = ball.body.position;
    this.scene.matter.body.setPosition(ball.body, {
      x: smoothMove(ballPos.x, clampedBall.x),
      y: smoothMove(ballPos.y, clampedBall.y),
    });

    const ballVel = ball.body.velocity;
    this.scene.matter.body.setVelocity(ball.body, {
      x: ballVel.x + (latest.ball.vx - ballVel.x) * 0.3,
      y: ballVel.y + (latest.ball.vy - ballVel.y) * 0.3,
    });

    // Apply caps positions
    latest.caps.forEach((capState, i) => {
      const cap = caps[i];
      if (!cap) return;

      const capRadius = cap.getRadius();
      const clampedCap = clampToBounds(capState.x, capState.y, capRadius);

      const capPos = cap.body.position;
      this.scene.matter.body.setPosition(cap.body, {
        x: smoothMove(capPos.x, clampedCap.x),
        y: smoothMove(capPos.y, clampedCap.y),
      });

      const capVel = cap.body.velocity;
      this.scene.matter.body.setVelocity(cap.body, {
        x: capVel.x + (capState.vx - capVel.x) * 0.3,
        y: capVel.y + (capState.vy - capVel.y) * 0.3,
      });
    });

    // Cleanup old snapshots
    if (this.snapshotBuffer.length > 5) {
      this.snapshotBuffer = this.snapshotBuffer.slice(-3);
    }
  }

  applyFinalPositions(
    ball: Ball,
    caps: GameUnit[],
    positions: FinalPositions
  ): void {
    this.scene.matter.body.setPosition(ball.body, positions.ball);
    this.scene.matter.body.setVelocity(ball.body, { x: 0, y: 0 });
    ball.update();

    positions.caps.forEach((pos, i) => {
      if (caps[i]) {
        this.scene.matter.body.setPosition(caps[i].body, pos);
        this.scene.matter.body.setVelocity(caps[i].body, { x: 0, y: 0 });
        caps[i].update();
      }
    });

    this.clearState();
    this.debug.log('SYNC', 'Final positions applied');
  }

  clearState(): void {
    this.snapshotBuffer = [];
    this.lastServerSnapshot = undefined;
  }

  getLastServerSnapshot(): Snapshot | undefined {
    return this.lastServerSnapshot;
  }

  getSnapshotBuffer(): Snapshot[] {
    return this.snapshotBuffer;
  }

  getServerTimeOffset(): number {
    return this.serverTimeOffset;
  }

  cleanup(): void {
    this.mp.off('shoot_executed');
    this.mp.off('turn_change');
    this.mp.off('positions_update');
    this.mp.off('snapshot');
    this.mp.off('match_timer');
    this.mp.off('goal_scored');
    this.mp.off('continue_game');
    this.mp.off('match_finished');
    this.mp.off('opponent_surrendered');
    this.mp.off('opponent_disconnected');
    this.mp.off('pong_sync');

    if (this.syncInterval) {
      this.syncInterval.destroy();
      this.syncInterval = undefined;
    }

    this.clearState();
    this.timeSyncSamples = [];
  }
}