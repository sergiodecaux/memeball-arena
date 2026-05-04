// src/scenes/game/LassoController.ts
// Механика Лассо для Trickster-юнитов
// Управление: нажал кнопку → тянешь точку по полю → отпустил = бросок

import Phaser from 'phaser';
import { Ball } from '../../entities/Ball';
import { LASSO_CONFIG } from '../../constants/gameConstants';
import type { GameUnit } from './types';

export type LassoPhase = 'IDLE' | 'CAPTURING' | 'AIMING' | 'RELEASED';

export interface LassoState {
  phase: LassoPhase;
  cooldownRemaining: number;
  canActivate: boolean;
}

export class LassoController {
  private scene: Phaser.Scene;
  private getBall: () => Ball;
  private onReleaseCallback?: (capId: string | null) => void;

  private attachedCap: GameUnit | null = null;
  private phase: LassoPhase = 'IDLE';
  private lastActivationTime: number = 0;

  private controlX: number = 0;
  private controlY: number = 0;

  private swingAngle: number = 0;

  private captureDistance: number = 0;

  private holdTimer: number = 0;

  private orbitX: number = 0;
  private orbitY: number = 0;

  private ballOriginalMass: number = 1.2;
  private ballControlled: boolean = false;

  private captureTween: Phaser.Tweens.Tween | null = null;

  private ropeGraphics: Phaser.GameObjects.Graphics;
  private controlDot: Phaser.GameObjects.Container;
  private controlZoneRing: Phaser.GameObjects.Graphics;

  private activePointerId: number = -1;

  constructor(
    scene: Phaser.Scene,
    getBall: () => Ball,
    onRelease?: (capId: string | null) => void,
  ) {
    this.scene = scene;
    this.getBall = getBall;
    this.onReleaseCallback = onRelease;

    this.ropeGraphics = scene.add.graphics();
    this.ropeGraphics.setDepth(55);
    this.ropeGraphics.setVisible(false);

    this.controlZoneRing = scene.add.graphics();
    this.controlZoneRing.setDepth(56);
    this.controlZoneRing.setVisible(false);

    this.controlDot = this.createControlDot();
    this.controlDot.setDepth(57);
    this.controlDot.setVisible(false);
  }

  public canActivate(cap: GameUnit): boolean {
    if (cap.getCapClass() !== 'trickster') return false;
    if (this.phase !== 'IDLE') return false;
    if (this.getCooldownRemaining() > 0) return false;

    const ball = this.getBall();
    if (!ball || ball.isDestroyed) return false;

    const dist = Phaser.Math.Distance.Between(cap.x, cap.y, ball.x, ball.y);
    const minDist = cap.getRadius() * LASSO_CONFIG.MIN_DISTANCE_RADII;
    if (dist < minDist || dist > LASSO_CONFIG.MAX_CAPTURE_DISTANCE) return false;
    return true;
  }

  public activate(cap: GameUnit, opts?: { programmaticOnly?: boolean }): boolean {
    if (!this.canActivate(cap)) return false;

    const ball = this.getBall();
    this.attachedCap = cap;
    this.captureDistance = Phaser.Math.Distance.Between(cap.x, cap.y, ball.x, ball.y);

    this.swingAngle = Math.atan2(ball.y - cap.y, ball.x - cap.x);

    this.controlX = cap.x + Math.cos(this.swingAngle) * LASSO_CONFIG.ORBIT_RADIUS;
    this.controlY = cap.y + Math.sin(this.swingAngle) * LASSO_CONFIG.ORBIT_RADIUS;

    this.holdTimer = 0;
    this.phase = 'CAPTURING';
    this.lastActivationTime = Date.now();

    this.takeBallControl(ball);
    this.startCaptureAnimation(ball);

    this.showControlZone(cap.x, cap.y);

    this.ropeGraphics.setVisible(true);

    if (!opts?.programmaticOnly) {
      this.attachFieldInput();
    }

    console.log(
      `[LassoController] Activated. Dist: ${this.captureDistance.toFixed(0)}px, ` +
        `Angle: ${((this.swingAngle * 180) / Math.PI).toFixed(1)}°`,
    );
    return true;
  }

  /**
   * Полное действие лассо для ИИ: захват → короткий прицел → бросок.
   * Без pointer-событий (programmaticOnly), чтобы игрок не прерывал фазу касанием.
   */
  public runAISequence(
    cap: GameUnit,
    aimWorldX: number,
    aimWorldY: number,
    onComplete: (result: { ok: boolean; released: boolean }) => void,
  ): boolean {
    if (!this.activate(cap, { programmaticOnly: true })) {
      onComplete({ ok: false, released: false });
      return false;
    }

    const capGuard = cap;
    const afterCapture = LASSO_CONFIG.CAPTURE_DURATION_MS + Phaser.Math.Between(40, 130);

    this.scene.time.delayedCall(afterCapture, () => {
      if (!this.attachedCap || this.attachedCap !== capGuard || this.phase !== 'AIMING') {
        if (this.phase !== 'IDLE') this.cancel();
        onComplete({ ok: false, released: false });
        return;
      }

      this.applyControlTowardWorld(aimWorldX, aimWorldY);

      const aimHold = Phaser.Math.Between(60, 190);
      this.scene.time.delayedCall(aimHold, () => {
        if (this.phase !== 'AIMING' || !this.attachedCap) {
          if (this.phase !== 'IDLE') this.cancel();
          onComplete({ ok: false, released: false });
          return;
        }
        this.release();
        onComplete({ ok: true, released: true });
      });
    });

    return true;
  }

  public release(): void {
    if (this.phase !== 'AIMING' && this.phase !== 'CAPTURING') return;

    const cap = this.attachedCap;
    if (!cap) {
      this.reset();
      return;
    }

    const dx = this.controlX - cap.x;
    const dy = this.controlY - cap.y;
    this.performThrow(dx, dy);
  }

  public cancel(): void {
    if (this.phase === 'IDLE') return;
    const ball = this.getBall();
    if (ball && this.ballControlled) this.releaseBallControl(ball);
    this.detachFieldInput();
    this.cleanup();
    console.log('[LassoController] Cancelled');
  }

  public update(delta: number): void {
    if (this.phase === 'IDLE' || this.phase === 'RELEASED') return;

    if (this.phase === 'AIMING') {
      this.updateAiming(delta);
    }

    if (this.attachedCap && this.controlZoneRing.visible) {
      this.redrawControlZone(this.attachedCap.x, this.attachedCap.y);
    }

    if (this.controlDot.visible) {
      this.controlDot.setPosition(this.controlX, this.controlY);
    }

    this.drawRope();
  }

  public getState(): LassoState {
    return {
      phase: this.phase,
      cooldownRemaining: this.getCooldownRemaining(),
      canActivate: this.attachedCap ? this.canActivate(this.attachedCap) : false,
    };
  }

  public getCooldownRemaining(): number {
    if (this.lastActivationTime === 0) return 0;
    const remaining = LASSO_CONFIG.COOLDOWN_MS - (Date.now() - this.lastActivationTime);
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
    return this.phase === 'CAPTURING' || this.phase === 'AIMING';
  }

  private attachFieldInput(): void {
    this.scene.input.on('pointermove', this.onFieldPointerMove, this);
    this.scene.input.on('pointerup', this.onFieldPointerUp, this);
    this.scene.input.on('pointerdown', this.onFieldPointerDown, this);
  }

  private detachFieldInput(): void {
    this.scene.input.off('pointermove', this.onFieldPointerMove, this);
    this.scene.input.off('pointerup', this.onFieldPointerUp, this);
    this.scene.input.off('pointerdown', this.onFieldPointerDown, this);
  }

  private onFieldPointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (this.phase !== 'AIMING') return;
    if (this.activePointerId === -1) {
      this.activePointerId = pointer.id;
    }
  };

  private onFieldPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (this.phase !== 'AIMING') return;
    if (!this.attachedCap) return;

    if (this.activePointerId !== -1 && pointer.id !== this.activePointerId) return;

    this.applyControlTowardWorld(pointer.worldX, pointer.worldY);
  };

  /** Прицеливание к точке мира с ограничением CONTROL_ZONE (общее для игрока и ИИ). */
  private applyControlTowardWorld(worldX: number, worldY: number): void {
    if (!this.attachedCap) return;

    const capX = this.attachedCap.x;
    const capY = this.attachedCap.y;
    const dx = worldX - capX;
    const dy = worldY - capY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = LASSO_CONFIG.CONTROL_ZONE_RADIUS;

    if (dist > maxDist) {
      const scale = maxDist / dist;
      this.controlX = capX + dx * scale;
      this.controlY = capY + dy * scale;
    } else {
      this.controlX = worldX;
      this.controlY = worldY;
    }

    this.swingAngle = Math.atan2(this.controlY - capY, this.controlX - capX);

    const ball = this.getBall();
    if (ball?.body && !ball.isDestroyed) {
      this.orbitX = capX + Math.cos(this.swingAngle) * LASSO_CONFIG.ORBIT_RADIUS;
      this.orbitY = capY + Math.sin(this.swingAngle) * LASSO_CONFIG.ORBIT_RADIUS;
      this.scene.matter.body.setPosition(ball.body, { x: this.orbitX, y: this.orbitY });
      ball.sprite.setPosition(this.orbitX, this.orbitY);
    }
  }

  private onFieldPointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (this.phase !== 'AIMING') return;

    if (this.activePointerId !== -1 && pointer.id !== this.activePointerId) return;

    this.activePointerId = -1;

    if (!this.attachedCap) {
      this.reset();
      return;
    }

    const dx = this.controlX - this.attachedCap.x;
    const dy = this.controlY - this.attachedCap.y;
    this.performThrow(dx, dy);
  };

  private updateAiming(delta: number): void {
    this.holdTimer += delta;
    if (this.holdTimer >= LASSO_CONFIG.MAX_HOLD_MS) {
      console.log('[LassoController] Auto-release by timeout');
      this.release();
    }
  }

  private performThrow(dirX: number, dirY: number): void {
    const ball = this.getBall();
    if (!ball || ball.isDestroyed) {
      this.reset();
      return;
    }

    const len = Math.sqrt(dirX * dirX + dirY * dirY);
    const nx = len > 0.5 ? dirX / len : Math.cos(this.swingAngle);
    const ny = len > 0.5 ? dirY / len : Math.sin(this.swingAngle);

    const minDist = (this.attachedCap?.getRadius() ?? 26) * LASSO_CONFIG.MIN_DISTANCE_RADII;
    const maxDist = LASSO_CONFIG.MAX_CAPTURE_DISTANCE;
    const t = Phaser.Math.Clamp((this.captureDistance - minDist) / (maxDist - minDist), 0, 1);
    const throwForce = Phaser.Math.Linear(LASSO_CONFIG.MIN_THROW_FORCE, LASSO_CONFIG.MAX_THROW_FORCE, t);

    const cap = this.attachedCap!;
    const controlDist = Phaser.Math.Distance.Between(this.controlX, this.controlY, cap.x, cap.y);
    const stretchBonus = Phaser.Math.Clamp(controlDist / LASSO_CONFIG.CONTROL_ZONE_RADIUS, 0.3, 1.0);
    const finalForce = throwForce * stretchBonus;

    this.releaseBallControl(ball);

    if (ball.body) {
      this.scene.matter.body.applyForce(ball.body, ball.body.position, {
        x: nx * finalForce,
        y: ny * finalForce,
      });
    }

    const capId = this.attachedCap?.id ?? null;

    console.log(
      `[LassoController] Throw! Force: ${finalForce.toFixed(4)}, ` +
        `Dir: (${nx.toFixed(2)}, ${ny.toFixed(2)}), stretch: ${stretchBonus.toFixed(2)}`,
    );

    this.detachFieldInput();
    this.phase = 'RELEASED';
    this.cleanup();
    this.onReleaseCallback?.(capId);
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

  private startCaptureAnimation(ball: Ball): void {
    const cap = this.attachedCap!;
    const targetX = cap.x + Math.cos(this.swingAngle) * LASSO_CONFIG.ORBIT_RADIUS;
    const targetY = cap.y + Math.sin(this.swingAngle) * LASSO_CONFIG.ORBIT_RADIUS;
    const startX = ball.x;
    const startY = ball.y;

    this.captureTween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: LASSO_CONFIG.CAPTURE_DURATION_MS,
      ease: 'Cubic.easeOut',
      onUpdate: (tween) => {
        const p = tween.getValue() ?? 0;
        const nx = Phaser.Math.Linear(startX, targetX, p);
        const ny = Phaser.Math.Linear(startY, targetY, p);
        if (ball.body && !ball.isDestroyed) {
          this.scene.matter.body.setPosition(ball.body, { x: nx, y: ny });
          ball.sprite.setPosition(nx, ny);
        }
      },
      onComplete: () => {
        this.orbitX = targetX;
        this.orbitY = targetY;
        this.phase = 'AIMING';
        this.captureTween = null;
        this.controlDot.setPosition(this.controlX, this.controlY);
        this.controlDot.setVisible(true);
        console.log('[LassoController] Capture done → AIMING');
      },
    });
  }

  private drawRope(): void {
    if (!this.attachedCap) return;
    const ball = this.getBall();
    if (!ball) return;

    this.ropeGraphics.clear();

    const capX = this.attachedCap.x;
    const capY = this.attachedCap.y;

    const ballX = this.phase === 'AIMING' ? this.orbitX : ball.x;
    const ballY = this.phase === 'AIMING' ? this.orbitY : ball.y;

    const midX = (capX + ballX) / 2;
    const midY = (capY + ballY) / 2 + 10;

    this.ropeGraphics.lineStyle(
      LASSO_CONFIG.ROPE_THICKNESS,
      LASSO_CONFIG.ROPE_COLOR,
      LASSO_CONFIG.ROPE_ALPHA,
    );
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(capX, capY),
      new Phaser.Math.Vector2(midX, midY),
      new Phaser.Math.Vector2(ballX, ballY),
    );
    const pts = curve.getPoints(24);
    this.ropeGraphics.beginPath();
    this.ropeGraphics.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      this.ropeGraphics.lineTo(pts[i].x, pts[i].y);
    }
    this.ropeGraphics.strokePath();

    if (this.phase === 'AIMING') {
      this.ropeGraphics.lineStyle(1.5, LASSO_CONFIG.ROPE_COLOR, 0.4);
      this.ropeGraphics.lineBetween(ballX, ballY, this.controlX, this.controlY);

      this.ropeGraphics.fillStyle(LASSO_CONFIG.ROPE_COLOR, 1);
      this.ropeGraphics.fillCircle(ballX, ballY, 5);
    }
  }

  private createControlDot(): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0);

    const outerRing = this.scene.add.graphics();
    outerRing.lineStyle(2.5, LASSO_CONFIG.CONTROL_DOT_BORDER_COLOR, 0.9);
    outerRing.strokeCircle(0, 0, LASSO_CONFIG.CONTROL_DOT_RADIUS + 6);
    container.add(outerRing);

    const dot = this.scene.add.graphics();
    dot.fillStyle(LASSO_CONFIG.CONTROL_DOT_COLOR, LASSO_CONFIG.CONTROL_DOT_ALPHA);
    dot.fillCircle(0, 0, LASSO_CONFIG.CONTROL_DOT_RADIUS);
    dot.lineStyle(2, LASSO_CONFIG.CONTROL_DOT_BORDER_COLOR, 1);
    dot.strokeCircle(0, 0, LASSO_CONFIG.CONTROL_DOT_RADIUS);
    container.add(dot);

    const icon = this.scene.add
      .text(0, 0, '🪢', {
        fontSize: '16px',
      })
      .setOrigin(0.5);
    container.add(icon);

    const hint = this.scene.add
      .text(0, LASSO_CONFIG.CONTROL_DOT_RADIUS + 14, 'ТЯНИ', {
        fontSize: '10px',
        fontFamily: 'Orbitron, Arial',
        color: '#ffdd44',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    container.add(hint);

    this.scene.tweens.add({
      targets: outerRing,
      alpha: { from: 0.9, to: 0.3 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    return container;
  }

  private showControlZone(capX: number, capY: number): void {
    this.controlZoneRing.setVisible(true);
    this.redrawControlZone(capX, capY);
  }

  private redrawControlZone(capX: number, capY: number): void {
    this.controlZoneRing.clear();
    this.controlZoneRing.lineStyle(1.5, LASSO_CONFIG.CONTROL_DOT_COLOR, 0.25);
    this.controlZoneRing.strokeCircle(capX, capY, LASSO_CONFIG.CONTROL_ZONE_RADIUS);
    this.controlZoneRing.fillStyle(LASSO_CONFIG.CONTROL_DOT_COLOR, 0.05);
    this.controlZoneRing.fillCircle(capX, capY, LASSO_CONFIG.CONTROL_ZONE_RADIUS);
  }

  private cleanup(): void {
    this.detachFieldInput();

    this.captureTween?.stop();
    this.captureTween = null;

    this.ropeGraphics.clear();
    this.ropeGraphics.setVisible(false);

    this.controlDot.setVisible(false);

    this.controlZoneRing.clear();
    this.controlZoneRing.setVisible(false);

    this.swingAngle = 0;
    this.captureDistance = 0;
    this.holdTimer = 0;
    this.ballControlled = false;
    this.orbitX = 0;
    this.orbitY = 0;
    this.controlX = 0;
    this.controlY = 0;
    this.activePointerId = -1;

    this.phase = 'IDLE';
  }

  private reset(): void {
    this.cancel();
    this.attachedCap = null;
  }

  public destroy(): void {
    this.detachFieldInput();
    this.cancel();
    this.ropeGraphics.destroy();
    this.controlDot.destroy();
    this.controlZoneRing.destroy();
  }
}
