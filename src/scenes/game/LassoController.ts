// src/scenes/game/LassoController.ts
// Механика Лассо для юнитов класса Trickster

import Phaser from 'phaser';
import { Ball } from '../../entities/Ball';
import { LASSO_CONFIG } from '../../constants/gameConstants';
import { eventBus, GameEvents } from '../../core/EventBus';
import type { GameUnit } from './types';

export type LassoPhase = 'IDLE' | 'CAPTURING' | 'SWINGING' | 'RELEASED';

export interface LassoState {
  phase: LassoPhase;
  cooldownRemaining: number;
  canActivate: boolean;
  captureDistance: number;
  swingAngle: number;
}

export class LassoController {
  private scene: Phaser.Scene;

  private attachedCap: GameUnit | null = null;

  private getBall: () => Ball;

  private phase: LassoPhase = 'IDLE';

  private lastActivationTime = 0;

  private swingAngle = 0;

  private swingAngularVelocity = 0;

  private captureDistance = 0;

  private captureTimer = 0;

  private holdTimer = 0;

  private captureStartX = 0;
  private captureStartY = 0;
  private captureTargetX = 0;
  private captureTargetY = 0;

  private ropeGraphics: Phaser.GameObjects.Graphics;

  private ballOriginalMass = 0;

  private ballControlled = false;

  private orbitX = 0;
  private orbitY = 0;

  private onReleaseCallback?: (capId: string | null) => void;

  constructor(scene: Phaser.Scene, getBall: () => Ball, onRelease?: (capId: string | null) => void) {
    this.scene = scene;
    this.getBall = getBall;
    this.onReleaseCallback = onRelease;

    this.ropeGraphics = scene.add.graphics();
    this.ropeGraphics.setDepth(55);
    this.ropeGraphics.setVisible(false);
  }

  public canActivate(cap: GameUnit): boolean {
    if (cap.getCapClass() !== 'trickster') return false;
    if (this.phase !== 'IDLE') return false;
    if (this.getCooldownRemaining() > 0) return false;

    const ball = this.getBall();
    if (!ball?.body || ball.isDestroyed) return false;

    const dist = Phaser.Math.Distance.Between(cap.x, cap.y, ball.x, ball.y);
    const minDist = cap.getRadius() * LASSO_CONFIG.MIN_DISTANCE_RADII;
    if (dist < minDist) return false;
    if (dist > LASSO_CONFIG.MAX_CAPTURE_DISTANCE) return false;

    return true;
  }

  public activate(cap: GameUnit): boolean {
    if (!this.canActivate(cap)) return false;

    const ball = this.getBall();

    this.attachedCap = cap;
    this.captureDistance = Phaser.Math.Distance.Between(cap.x, cap.y, ball.x, ball.y);

    this.swingAngle = Math.atan2(ball.y - cap.y, ball.x - cap.x);
    this.swingAngularVelocity = LASSO_CONFIG.SWING_SPEED;

    this.phase = 'CAPTURING';
    this.captureTimer = 0;
    this.holdTimer = 0;

    this.captureStartX = ball.x;
    this.captureStartY = ball.y;
    this.captureTargetX = cap.x + Math.cos(this.swingAngle) * LASSO_CONFIG.ORBIT_RADIUS;
    this.captureTargetY = cap.y + Math.sin(this.swingAngle) * LASSO_CONFIG.ORBIT_RADIUS;

    this.takeBallControl(ball);
    this.ropeGraphics.setVisible(true);

    this.lastActivationTime = Date.now();

    eventBus.dispatch(GameEvents.HAPTIC_FEEDBACK, { type: 'medium' });
    eventBus.dispatch(GameEvents.LASSO_ACTIVATED, { unitId: cap.id });

    return true;
  }

  public release(): void {
    if (this.phase !== 'SWINGING') return;

    const ball = this.getBall();
    const capId = this.attachedCap?.id ?? null;

    if (!ball || ball.isDestroyed || !capId) {
      this.cancel();
      return;
    }

    const minDist = (this.attachedCap?.getRadius() ?? 26) * LASSO_CONFIG.MIN_DISTANCE_RADII;
    const maxDist = LASSO_CONFIG.MAX_CAPTURE_DISTANCE;
    const t = Phaser.Math.Clamp((this.captureDistance - minDist) / Math.max(1e-6, maxDist - minDist), 0, 1);
    const throwForce = Phaser.Math.Linear(LASSO_CONFIG.MIN_THROW_FORCE, LASSO_CONFIG.MAX_THROW_FORCE, t);

    const tangSign = Math.abs(this.swingAngularVelocity) < 1e-6 ? 1 : Math.sign(this.swingAngularVelocity);
    const throwAngle = this.swingAngle + (Math.PI / 2) * tangSign;

    const forceX = Math.cos(throwAngle) * throwForce;
    const forceY = Math.sin(throwAngle) * throwForce;

    this.releaseBallControl(ball);
    this.scene.matter.body.applyForce(ball.body, ball.body.position, { x: forceX, y: forceY });

    eventBus.dispatch(GameEvents.HAPTIC_FEEDBACK, { type: 'light' });
    eventBus.dispatch(GameEvents.LASSO_RELEASED, { unitId: capId });

    this.phase = 'RELEASED';
    this.cleanupAfterThrow();

    this.onReleaseCallback?.(capId);
  }

  public cancel(): void {
    if (this.phase === 'IDLE') return;

    const ball = this.getBall();
    if (ball && this.ballControlled) {
      this.releaseBallControl(ball);
    }

    eventBus.dispatch(GameEvents.LASSO_CANCELLED, {});
    this.cleanupFull();
  }

  public update(delta: number): void {
    if (this.phase === 'IDLE' || this.phase === 'RELEASED') return;

    if (this.phase === 'CAPTURING') {
      this.updateCapturing(delta);
    } else if (this.phase === 'SWINGING') {
      this.updateSwinging(delta);
    }

    this.drawRope();
  }

  public getState(): LassoState {
    const cap = this.attachedCap;
    const canActivate = cap ? this.canActivate(cap) : false;

    return {
      phase: this.phase,
      cooldownRemaining: this.getCooldownRemaining(),
      canActivate,
      captureDistance: this.captureDistance,
      swingAngle: this.swingAngle,
    };
  }

  public getCooldownRemaining(): number {
    if (this.lastActivationTime === 0) return 0;
    const elapsed = Date.now() - this.lastActivationTime;
    const remaining = LASSO_CONFIG.COOLDOWN_MS - elapsed;
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  public resetCooldown(): void {
    this.lastActivationTime = 0;
  }

  public setAttachedCap(cap: GameUnit | null): void {
    if (this.phase !== 'IDLE') return;
    this.attachedCap = cap;
  }

  public isActive(): boolean {
    return this.phase === 'CAPTURING' || this.phase === 'SWINGING';
  }

  private takeBallControl(ball: Ball): void {
    if (!ball.body) return;

    this.scene.matter.body.setVelocity(ball.body, { x: 0, y: 0 });
    this.scene.matter.body.setAngularVelocity(ball.body, 0);

    const matterBody = ball.body as { mass?: number };
    this.ballOriginalMass = matterBody.mass ?? 1.2;
    this.scene.matter.body.setMass(ball.body, 99999);

    this.ballControlled = true;
  }

  private releaseBallControl(ball: Ball): void {
    if (!ball.body || !this.ballControlled) return;

    this.scene.matter.body.setMass(ball.body, this.ballOriginalMass);
    this.ballControlled = false;
  }

  private updateCapturing(delta: number): void {
    const ball = this.getBall();
    const cap = this.attachedCap;
    if (!ball?.body || ball.isDestroyed || !cap) {
      this.cancel();
      return;
    }

    this.captureTimer += delta;
    const u = Phaser.Math.Clamp(this.captureTimer / LASSO_CONFIG.CAPTURE_DURATION_MS, 0, 1);
    const ease = Phaser.Math.Easing.Cubic.Out(u);
    const nx = Phaser.Math.Linear(this.captureStartX, this.captureTargetX, ease);
    const ny = Phaser.Math.Linear(this.captureStartY, this.captureTargetY, ease);

    this.scene.matter.body.setPosition(ball.body, { x: nx, y: ny });
    ball.sprite.setPosition(nx, ny);

    if (u >= 1) {
      this.phase = 'SWINGING';
      this.orbitX = this.captureTargetX;
      this.orbitY = this.captureTargetY;
    }
  }

  private updateSwinging(delta: number): void {
    const cap = this.attachedCap;
    const ball = this.getBall();
    if (!cap || !ball?.body || ball.isDestroyed) {
      this.cancel();
      return;
    }

    const dt = delta / 16.67;

    this.swingAngularVelocity = Phaser.Math.Clamp(
      this.swingAngularVelocity + LASSO_CONFIG.SWING_SPEED * dt,
      -LASSO_CONFIG.MAX_SWING_ANGULAR,
      LASSO_CONFIG.MAX_SWING_ANGULAR,
    );

    this.swingAngle += this.swingAngularVelocity * dt;

    this.orbitX = cap.x + Math.cos(this.swingAngle) * LASSO_CONFIG.ORBIT_RADIUS;
    this.orbitY = cap.y + Math.sin(this.swingAngle) * LASSO_CONFIG.ORBIT_RADIUS;

    this.scene.matter.body.setPosition(ball.body, { x: this.orbitX, y: this.orbitY });
    ball.sprite.setPosition(this.orbitX, this.orbitY);

    this.holdTimer += delta;
    if (this.holdTimer >= LASSO_CONFIG.MAX_HOLD_MS) {
      this.release();
    }
  }

  private drawRope(): void {
    if (!this.attachedCap) return;

    const ball = this.getBall();
    if (!ball) return;

    this.ropeGraphics.clear();

    const capX = this.attachedCap.x;
    const capY = this.attachedCap.y;

    let ballX: number;
    let ballY: number;

    if (this.phase === 'SWINGING') {
      ballX = this.orbitX;
      ballY = this.orbitY;
    } else {
      ballX = ball.x;
      ballY = ball.y;
    }

    const midX = (capX + ballX) / 2;
    const midY = (capY + ballY) / 2 + 12;

    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(capX, capY),
      new Phaser.Math.Vector2(midX, midY),
      new Phaser.Math.Vector2(ballX, ballY),
    );
    const pts = curve.getPoints(24);

    this.ropeGraphics.lineStyle(LASSO_CONFIG.ROPE_THICKNESS, LASSO_CONFIG.ROPE_COLOR, LASSO_CONFIG.ROPE_ALPHA);
    this.ropeGraphics.beginPath();
    if (pts.length > 0) {
      this.ropeGraphics.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        this.ropeGraphics.lineTo(pts[i].x, pts[i].y);
      }
    }
    this.ropeGraphics.strokePath();

    this.ropeGraphics.fillStyle(LASSO_CONFIG.ROPE_COLOR, 1);
    this.ropeGraphics.fillCircle(ballX, ballY, 5);
  }

  /** После успешного броска — только визуал и фазы; attachedCap и кулдаун сохраняем */
  private cleanupAfterThrow(): void {
    this.ropeGraphics.clear();
    this.ropeGraphics.setVisible(false);

    this.swingAngularVelocity = 0;
    this.captureTimer = 0;
    this.holdTimer = 0;
    this.ballControlled = false;
    this.orbitX = 0;
    this.orbitY = 0;
    this.captureDistance = 0;

    this.phase = 'IDLE';
  }

  /** Полный сброс при отмене */
  private cleanupFull(): void {
    this.ropeGraphics.clear();
    this.ropeGraphics.setVisible(false);

    this.swingAngle = 0;
    this.swingAngularVelocity = 0;
    this.captureDistance = 0;
    this.captureTimer = 0;
    this.holdTimer = 0;
    this.ballControlled = false;
    this.orbitX = 0;
    this.orbitY = 0;

    this.phase = 'IDLE';
    this.attachedCap = null;
  }

  public destroy(): void {
    this.cancel();
    this.ropeGraphics.destroy();
  }
}
