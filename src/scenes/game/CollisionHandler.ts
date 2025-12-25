// src/scenes/game/CollisionHandler.ts

import Phaser from 'phaser';
import { Ball } from '../../entities/Ball';
import { GameUnit, hasPlayHitEffect } from './types';
import { FieldBounds } from '../../types';
import { FACTIONS, FactionId } from '../../constants/gameConstants';
import { AudioManager } from '../../managers/AudioManager';
import { FieldRenderer } from '../../renderers/FieldRenderer';
import { PvPDebugLogger } from './PvPDebugLogger';

export interface CollisionHandlerConfig {
  scene: Phaser.Scene;
  fieldBounds: FieldBounds;
  fieldScale: number;
  isPvPMode: boolean;
  isHost: boolean;
  useFactions: boolean;
  playerFaction: FactionId;
}

export interface CollisionHandlerDeps {
  getBall: () => Ball;
  getCaps: () => GameUnit[];
  getLastShootingCap: () => GameUnit | undefined;
  getLastShootingCapId: () => string | undefined;
  getBallSpeedBeforeCollision: () => number;
  setBallSpeedBeforeCollision: (speed: number) => void;
  getGuestLocalPhysicsUntil: () => number;
  setGuestLocalPhysicsUntil: (time: number) => void;
  clearSnapshotBuffer: () => void;
  getFieldRenderer: () => FieldRenderer | undefined;
  debug: PvPDebugLogger;
  triggerHaptic: (style: 'light' | 'medium' | 'heavy') => void;
}

export class CollisionHandler {
  private scene: Phaser.Scene;
  private config: CollisionHandlerConfig;
  private deps: CollisionHandlerDeps;
  private lastCollisionTime = 0;

  constructor(config: CollisionHandlerConfig, deps: CollisionHandlerDeps) {
    this.scene = config.scene;
    this.config = config;
    this.deps = deps;
  }

  setup(): void {
    this.scene.matter.world.on('beforeupdate', () => {
      this.deps.setBallSpeedBeforeCollision(this.deps.getBall().getSpeed());
    });

    this.scene.matter.world.on(
      'collisionstart',
      (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
        this.handleCollisionStart(event);
      }
    );
  }

  private handleCollisionStart(event: Phaser.Physics.Matter.Events.CollisionStartEvent): void {
    const now = this.scene.time.now;

    // Handle PvP guest local physics collisions
    if (this.config.isPvPMode && !this.config.isHost) {
      const guestLocalUntil = this.deps.getGuestLocalPhysicsUntil();
      if (guestLocalUntil > now) {
        this.handleGuestLocalCollisions(event);
      }
    }

    // Throttle collision sounds
    if (now - this.lastCollisionTime < 50) return;

    for (const pair of event.pairs) {
      const soundPlayed = this.handleCollisionSound(pair.bodyA, pair.bodyB);
      if (soundPlayed) {
        this.lastCollisionTime = now;
      }

      // Handle trickster curve (host only in PvP)
      if (!this.config.isPvPMode || this.config.isHost) {
        this.handleTricksterCurve(pair.bodyA, pair.bodyB);
      }

      // Skip physics handling for PvP guest
      if (this.config.isPvPMode && !this.config.isHost) continue;

      const ballBody =
        pair.bodyA.label === 'ball'
          ? pair.bodyA
          : pair.bodyB.label === 'ball'
          ? pair.bodyB
          : null;

      if (ballBody) {
        const other = pair.bodyA.label === 'ball' ? pair.bodyB.label : pair.bodyA.label;
        if (other === 'wall') {
          this.handleBallWallCollision(ballBody);
        } else if (other === 'post') {
          this.handleBallPostCollision(ballBody);
        }
      }
    }
  }

  private handleGuestLocalCollisions(event: Phaser.Physics.Matter.Events.CollisionStartEvent): void {
    const caps = this.deps.getCaps();
    const lastShootingCapId = this.deps.getLastShootingCapId();

    for (const pair of event.pairs) {
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;

      const ballBody =
        bodyA.label === 'ball' ? bodyA : bodyB.label === 'ball' ? bodyB : null;

      if (ballBody) {
        const otherBody = bodyA === ballBody ? bodyB : bodyA;
        const otherLabel = otherBody.label;

        if (otherLabel === 'wall' || otherLabel === 'post') {
          this.deps.debug.log(
            'COLLISION',
            `Ball collision with: ${otherLabel} - starting transition to server sync`
          );
          this.deps.setGuestLocalPhysicsUntil(0);
          this.deps.clearSnapshotBuffer();
        } else {
          const hitCap = caps.find((c) => c.body.id === otherBody.id);

          if (hitCap) {
            if (hitCap.id === lastShootingCapId) {
              this.deps.debug.log(
                'COLLISION_CHECK',
                `Ignoring - same cap that shot: ${hitCap.id}`
              );
            } else {
              this.deps.debug.log('COLLISION_CHECK', `Ball collided with cap: ${hitCap.id}`);
              this.deps.debug.log(
                'COLLISION',
                'Ball collision with cap - starting transition to server sync'
              );
              this.deps.setGuestLocalPhysicsUntil(0);
              this.deps.clearSnapshotBuffer();
            }
          }
        }
      }
    }
  }

  private handleCollisionSound(
    bodyA: MatterJS.BodyType,
    bodyB: MatterJS.BodyType
  ): boolean {
    const velA = Math.hypot(bodyA.velocity.x, bodyA.velocity.y);
    const velB = Math.hypot(bodyB.velocity.x, bodyB.velocity.y);
    const impact = velA + velB;
    if (impact < 0.5) return false;

    const volume = Phaser.Math.Clamp(impact / 20, 0.3, 1.0);
    const audio = AudioManager.getInstance();

    const isBallA = bodyA.label === 'ball';
    const isBallB = bodyB.label === 'ball';
    const isCapA = bodyA.label?.startsWith('cap') || bodyA.label?.startsWith('unit');
    const isCapB = bodyB.label?.startsWith('cap') || bodyB.label?.startsWith('unit');
    const isWallA = bodyA.label === 'wall';
    const isWallB = bodyB.label === 'wall';

    if ((isBallA && isCapB) || (isBallB && isCapA)) {
      audio.playSFX('sfx_kick', { volume });
      if (volume > 0.5) this.deps.triggerHaptic('light');
      return true;
    }
    if (isCapA && isCapB) {
      audio.playSFX('sfx_clack', { volume: volume * 0.9 });
      return true;
    }
    if ((isBallA && isWallB) || (isBallB && isWallA)) {
      audio.playSFX('sfx_bounce', { volume: volume * 0.7 });
      return true;
    }
    return false;
  }

  private handleTricksterCurve(
    bodyA: MatterJS.BodyType,
    bodyB: MatterJS.BodyType
  ): void {
    const ballBody =
      bodyA.label === 'ball' ? bodyA : bodyB.label === 'ball' ? bodyB : null;
    if (!ballBody) return;

    const otherBody = bodyA === ballBody ? bodyB : bodyA;
    const lastShootingCap = this.deps.getLastShootingCap();
    const caps = this.deps.getCaps();
    const hitCap = caps.find((c) => c.body.id === otherBody.id);

    if (!hitCap) return;
    if (hitCap !== lastShootingCap) return;

    const curveForce = hitCap.calculateCurveForce(ballBody.velocity);

    if (curveForce) {
      this.scene.matter.body.applyForce(ballBody, ballBody.position, curveForce);
      this.showCurveEffect(ballBody.position.x, ballBody.position.y, curveForce);
      console.log(`[CollisionHandler] Trickster curve applied:`, curveForce);
    }
  }

  private showCurveEffect(
    x: number,
    y: number,
    force: { x: number; y: number }
  ): void {
    const graphics = this.scene.add.graphics();
    graphics.setDepth(100);

    const color =
      this.config.useFactions && this.config.playerFaction === 'void'
        ? FACTIONS.void.color
        : 0x9333ea;

    graphics.lineStyle(2, color, 0.8);

    const angle = Math.atan2(force.y, force.x);

    graphics.beginPath();
    graphics.arc(x, y, 15, angle - 0.5, angle + 0.5);
    graphics.strokePath();

    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      scale: 2,
      duration: 400,
      ease: 'Power2',
      onComplete: () => graphics.destroy(),
    });

    const particleTexture =
      this.config.useFactions && this.config.playerFaction === 'void'
        ? 'p_smoke'
        : 'p_star';

    if (this.scene.textures.exists(particleTexture)) {
      const particles = this.scene.add.particles(x, y, particleTexture, {
        speed: { min: 30, max: 60 },
        angle: {
          min: Phaser.Math.RadToDeg(angle) - 30,
          max: Phaser.Math.RadToDeg(angle) + 30,
        },
        scale: { start: 0.3, end: 0 },
        lifespan: 300,
        quantity: 5,
        tint: color,
        blendMode: 'ADD',
      });
      particles.setDepth(99);

      this.scene.time.delayedCall(300, () => particles.destroy());
    }
  }

  private handleBallWallCollision(ballBody: MatterJS.BodyType): void {
    if (this.config.isPvPMode && !this.config.isHost) return;

    const speed = this.deps.getBallSpeedBeforeCollision();
    if (speed < 2) return;

    const { left, right, top, bottom } = this.config.fieldBounds;
    const { x, y } = ballBody.position;
    const cs = 60 * this.config.fieldScale;

    const corners = {
      topLeft: x < left + cs && y < top + cs,
      topRight: x > right - cs && y < top + cs,
      bottomLeft: x < left + cs && y > bottom - cs,
      bottomRight: x > right - cs && y > bottom - cs,
    };

    if (Object.values(corners).some(Boolean)) {
      this.scene.time.delayedCall(10, () =>
        this.applyCurveBounce(ballBody, speed, corners)
      );
    }
  }

  private handleBallPostCollision(ballBody: MatterJS.BodyType): void {
    const speed = this.deps.getBallSpeedBeforeCollision();
    if (speed < 1) return;

    const intensity = Phaser.Math.Clamp(speed / 20, 0, 1);

    const audio = AudioManager.getInstance();
    audio.playSFX('sfx_post', {
      volume: Phaser.Math.Clamp(0.5 + intensity * 0.5, 0.5, 1.0),
    });

    this.deps.triggerHaptic(intensity > 0.7 ? 'heavy' : 'medium');

    const duration = 120 + 80 * intensity;
    const intensityShake = 0.004 + 0.004 * intensity;
    this.scene.cameras.main.shake(duration, intensityShake);

    const side: 'top' | 'bottom' =
      ballBody.position.y < this.config.fieldBounds.centerY ? 'top' : 'bottom';
    this.deps.getFieldRenderer()?.playGoalPostHit(side, intensity);
  }

  private applyCurveBounce(
    ballBody: MatterJS.BodyType,
    speed: number,
    corners: Record<string, boolean>
  ): void {
    if (this.config.isPvPMode && !this.config.isHost) return;

    const { x: vx, y: vy } = ballBody.velocity;
    const currentSpeed = Math.sqrt(vx * vx + vy * vy);
    if (currentSpeed < 1) return;

    const curveSpeed = currentSpeed * Math.min(speed / 15, 0.85);
    const isVertical = Math.abs(vy) > Math.abs(vx);

    let curveX = 0,
      curveY = 0;

    if (corners.topLeft) {
      curveX = isVertical ? curveSpeed : Math.abs(vx) * 0.3;
      curveY = isVertical ? Math.abs(vy) * 0.3 : curveSpeed;
    } else if (corners.topRight) {
      curveX = isVertical ? -curveSpeed : -Math.abs(vx) * 0.3;
      curveY = isVertical ? Math.abs(vy) * 0.3 : curveSpeed;
    } else if (corners.bottomLeft) {
      curveX = isVertical ? curveSpeed : Math.abs(vx) * 0.3;
      curveY = isVertical ? -Math.abs(vy) * 0.3 : -curveSpeed;
    } else if (corners.bottomRight) {
      curveX = isVertical ? -curveSpeed : -Math.abs(vx) * 0.3;
      curveY = isVertical ? -Math.abs(vy) * 0.3 : -curveSpeed;
    }

    this.scene.matter.body.setVelocity(ballBody, { x: curveX, y: curveY });
  }

  updateConfig(config: Partial<CollisionHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}