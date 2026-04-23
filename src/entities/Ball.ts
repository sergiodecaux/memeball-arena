// ✅ ИЗМЕНЕНО: Усилен ограничитель скорости, добавлен out-of-bounds guard с fieldBounds, добавлен критический damping

import Phaser from 'phaser';
import { COLLISION_CATEGORIES, FactionId, FACTIONS, BALL, BALL_SPIN, WALL_PHYSICS, GOAL, FIELD } from '../constants/gameConstants';
import { playerData } from '../data/PlayerData';
import { getBallSkin, BallSkinData } from '../data/SkinsCatalog';
import { FieldBounds } from '../types';

export class Ball {
  public body!: MatterJS.BodyType;
  public sprite: Phaser.GameObjects.Container;
  public isDestroyed: boolean = false;

  private scene: Phaser.Scene;
  private radius: number;
  private skinData: BallSkinData;
  private ballSprite!: Phaser.GameObjects.Sprite;
  private glowSprite?: Phaser.GameObjects.Sprite;
  private trailEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  // 🔥 Визуальные эффекты
  private speedGlow?: Phaser.GameObjects.Arc;
  private energyRing?: Phaser.GameObjects.Graphics;
  private motionTrail?: Phaser.GameObjects.Graphics;
  private impactRing?: Phaser.GameObjects.Graphics;
  private coreGlow?: Phaser.GameObjects.Arc;

  // 🔥 Trail points для кастомного следа
  private trailPoints: Array<{ x: number; y: number; alpha: number; size: number }> = [];
  private readonly TRAIL_LENGTH = 20;
  private readonly TRAIL_MIN_SPEED = 2;

  // 🔥 Состояние для эффектов
  private lastSpeed: number = 0;
  private energyPhase: number = 0;
  private pulsePhase: number = 0;
  private isHighSpeed: boolean = false;
  private lastHitTime: number = 0;
  private lastHitFaction?: FactionId;

  // 🔥 Squash & Stretch
  private baseScale: number = 1;
  private targetScaleX: number = 1;
  private targetScaleY: number = 1;
  private currentScaleX: number = 1;
  private currentScaleY: number = 1;
  private isSquashing: boolean = false;

  // ✅ Границы поля для out-of-bounds guard
  private fieldBounds?: FieldBounds;

  // ✅ Счётчик последовательных кадров с критической скоростью
  private criticalSpeedFrames: number = 0;

  // === SPIN SYSTEM ===
  private spinVelocity: number = 0;           // Current angular momentum (rad/frame)
  private spinDecay: number = BALL_SPIN.SPIN_DECAY;
  private spinToCurveRatio: number = BALL_SPIN.SPIN_TO_CURVE_RATIO;
  private lastWallHitTime: number = 0;
  private lastWallHitNormal: { x: number; y: number } = { x: 0, y: 0 };

  // Visual spin indicator
  private spinTrailColor: number = 0xffffff;
  private isSpinActive: boolean = false;

  // === PASSIVE SYSTEM ===
  private passThroughCount: number = 0;
  private slowOnHitValue: number = 0;
  private slowOnHitSource: string = '';

  private static readonly PHYSICS = {
    RADIUS: 15,
    MASS: 1.2,
    RESTITUTION: 0.88,
    FRICTION: 0.002,
    FRICTION_AIR: 0.005,
    FRICTION_STATIC: 0.001,
    MAX_SPEED: 28,
  };

  private static readonly DEFAULT_SKIN_ID = 'ball_plasma';

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    radius?: number,
    skinId?: string
  ) {
    this.scene = scene;
    this.radius = radius || Ball.PHYSICS.RADIUS;

    const player = playerData.get();
    const equippedId = player.equippedBallSkin;
    const effectiveSkinId = skinId || equippedId || Ball.DEFAULT_SKIN_ID;

    const skin = getBallSkin(effectiveSkinId) || getBallSkin(Ball.DEFAULT_SKIN_ID);
    if (!skin) {
      throw new Error('[Ball] No valid ball skin found');
    }
    this.skinData = skin;

    this.baseScale = (this.radius * 2) / 256;

    console.log('[Ball] Using skin:', this.skinData.id, this.skinData.name);

    this.sprite = scene.add.container(x, y).setDepth(50);

    this.createVisuals();
    this.createTrail();
    this.createPhysicsBody(x, y);
  }

  get x(): number { return this.body.position.x; }
  get y(): number { return this.body.position.y; }

  // ✅ Метод для установки границ поля
  setFieldBounds(bounds: FieldBounds): void {
    this.fieldBounds = bounds;
    console.log('[Ball] Field bounds set:', bounds);
  }

  // ===============================================================
  // 🔥 ВИЗУАЛ
  // ===============================================================

  private createVisuals(): void {
    const r = this.radius;

    // 0. 🔥 MOTION TRAIL (рисуется в мировых координатах)
    this.motionTrail = this.scene.add.graphics();
    this.motionTrail.setDepth(48);

    // 1. Тень под мячом
    const shadow = this.scene.add.ellipse(3, 3, r * 2.2, r * 1.5, 0x000000, 0.5);
    this.sprite.add(shadow);

    // 2. 🔥 SPEED GLOW — внешнее свечение при скорости
    this.speedGlow = this.scene.add.circle(0, 0, r * 2.5, this.skinData.glowColor, 0);
    this.speedGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.sprite.add(this.speedGlow);

    // 3. 🔥 CORE GLOW — ядро энергии
    this.coreGlow = this.scene.add.circle(0, 0, r * 1.8, this.skinData.glowColor, 0.25);
    this.coreGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.sprite.add(this.coreGlow);

    // 4. Основное свечение
    if (this.skinData.hasGlow) {
      this.createGlow();
    }

    // 5. 🔥 ENERGY RING — вращающееся энергетическое кольцо
    this.energyRing = this.scene.add.graphics();
    this.energyRing.setBlendMode(Phaser.BlendModes.ADD);
    this.sprite.add(this.energyRing);

    // 6. Спрайт мяча
    this.createBallSprite();

    // 7. 🔥 IMPACT RING — кольцо удара
    this.impactRing = this.scene.add.graphics();
    this.impactRing.setBlendMode(Phaser.BlendModes.ADD);
    this.sprite.add(this.impactRing);

    // 8. Блики поверх всего
    this.createHighlights();
  }

  private createGlow(): void {
    const r = this.radius;
    const texKey = this.ensureGlowTexture();

    this.glowSprite = this.scene.add.sprite(0, 0, texKey)
      .setTint(this.skinData.glowColor)
      .setAlpha(0.6)
      .setScale(r / 14)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.sprite.add(this.glowSprite);

    // Пульсация
    this.scene.tweens.add({
      targets: this.glowSprite,
      alpha: { from: 0.45, to: 0.8 },
      scale: { from: r / 14, to: r / 11 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private ensureGlowTexture(): string {
    const key = 'ball_glow_radial';
    if (this.scene.textures.exists(key)) return key;

    const size = 128;
    const canvas = this.scene.textures.createCanvas(key, size, size);
    const ctx = canvas!.getContext();

    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.4)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    canvas!.refresh();

    return key;
  }

  private createBallSprite(): void {
    const texKey = this.skinData.textureKey;

    if (texKey && this.scene.textures.exists(texKey)) {
      this.ballSprite = this.scene.add.sprite(0, 0, texKey)
        .setOrigin(0.5)
        .setScale(this.baseScale);
    } else {
      this.ballSprite = this.createFallbackBallSprite();
    }

    this.sprite.add(this.ballSprite);
  }

  private createFallbackBallSprite(): Phaser.GameObjects.Sprite {
    const r = this.radius;
    const key = `ball_fallback_${this.skinData.id}`;

    if (this.scene.textures.exists(key)) {
      return this.scene.add.sprite(0, 0, key).setScale(this.baseScale);
    }

    const size = 256;
    const center = size / 2;
    const ballRadius = 100;

    const g = this.scene.add.graphics();
    g.setVisible(false);

    // Основной круг с градиентом (имитация)
    for (let i = 10; i >= 0; i--) {
      const ratio = i / 10;
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(this.skinData.secondaryColor),
        Phaser.Display.Color.ValueToColor(this.skinData.primaryColor),
        100,
        ratio * 100
      );
      g.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
      g.fillCircle(center, center, ballRadius * ratio);
    }

    // Энергетическое ядро
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(center, center, ballRadius * 0.3);

    // Блик
    g.fillStyle(0xffffff, 0.6);
    g.fillEllipse(center - 30, center - 35, 45, 25);
    
    // Маленький блик
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(center - 35, center - 40, 8);

    g.generateTexture(key, size, size);
    g.destroy();

    return this.scene.add.sprite(0, 0, key).setScale(this.baseScale);
  }

  private createHighlights(): void {
    const r = this.radius;
    const highlights = this.scene.add.graphics();
    
    // Основной блик
    highlights.fillStyle(0xffffff, 0.25);
    highlights.beginPath();
    highlights.arc(0, -r * 0.3, r * 0.5, Math.PI * 1.1, Math.PI * 1.9, false);
    highlights.arc(0, -r * 0.15, r * 0.65, Math.PI * 1.9, Math.PI * 1.1, true);
    highlights.closePath();
    highlights.fillPath();
    
    // Яркая точка
    highlights.fillStyle(0xffffff, 0.6);
    highlights.fillCircle(-r * 0.2, -r * 0.35, r * 0.1);
    
    this.sprite.add(highlights);
  }

  // ===============================================================
  // 🔥 TRAIL — Улучшенный след
  // ===============================================================

  private createTrail(): void {
    if (!this.skinData.hasTrail) return;

    const texKey = this.ensureParticleTexture();

    this.trailEmitter = this.scene.add.particles(0, 0, texKey, {
      speed: { min: 10, max: 40 },
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: 500,
      blendMode: 'ADD',
      tint: this.skinData.trailColor || this.skinData.glowColor,
      frequency: 20,
      follow: this.sprite,
    });
    this.trailEmitter.setDepth(49).stop();
  }

  private ensureParticleTexture(): string {
    const key = 'ball_particle_glow';
    if (this.scene.textures.exists(key)) return key;

    const g = this.scene.add.graphics().setVisible(false);
    
    // Мягкий градиентный круг
    for (let i = 8; i > 0; i--) {
      const alpha = (1 - i / 8) * 1;
      g.fillStyle(0xffffff, alpha);
      g.fillCircle(8, 8, i);
    }
    
    g.generateTexture(key, 16, 16);
    g.destroy();
    return key;
  }

  // ===============================================================
  // 🔥 MAIN UPDATE LOOP
  // ===============================================================

  update(): void {
    // ✅ 1 (Recommended): Reordered for better impulse handling
    // 1. Velocity limits first
    this.clampVelocity();
    
    // 2. Apply spin curve force
    this.applySpinCurve();

    // 3. Decay spin over time
    this.decaySpin();
    
    // 4. Non-invasive position clamp (only when actually outside bounds)
    this.preventEscape();
    
    // 5. Out of bounds check (safety net)
    this.checkOutOfBounds();

    const { x, y } = this.body.position;
    const vx = this.body.velocity.x;
    const vy = this.body.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);

    // Позиция
    this.sprite.setPosition(x, y);

    // 1. Вращение
    this.updateRotation(speed);

    // 2. 🔥 STRETCH — растяжение в направлении движения
    this.updateStretch(vx, vy, speed);

    // 3. 🔥 MOTION TRAIL — кастомный след
    this.updateMotionTrail(x, y, speed);

    // 4. 🔥 SPEED GLOW — свечение от скорости
    this.updateSpeedGlow(speed);

    // 5. 🔥 CORE GLOW — пульсация ядра
    this.updateCoreGlow(speed);

    // 6. 🔥 ENERGY RING — вращающееся кольцо
    this.updateEnergyRing(speed);

    // 7. 🔥 Particle trail
    this.updateParticleTrail(speed, vx, vy);

    // 8. 🔥 SQUASH RECOVERY
    this.updateSquashRecovery();

    // 9. 🔥 HIT FLASH — затухание вспышки удара
    this.updateHitFlash();

    this.lastSpeed = speed;
  }

  /**
   * ✅ Ограничение скорости и угловой скорости
   */
  private clampVelocity(): void {
    if (!this.body) return;

    const body = this.body as MatterJS.BodyType;
    const vel = body.velocity;
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

    // Защита от NaN/Infinity
    if (!isFinite(speed) || isNaN(vel.x) || isNaN(vel.y)) {
      console.error('[Ball] ⚠️ Invalid velocity detected! Resetting...');
      this.scene.matter.body.setVelocity(this.body, { x: 0, y: 0 });
      this.scene.matter.body.setAngularVelocity(this.body, 0);
      return;
    }

    // Критическая скорость — экстренное торможение
    if (speed > BALL.CRITICAL_SPEED) {
      const factor = BALL.CRITICAL_SPEED / speed;
      this.scene.matter.body.setVelocity(this.body, {
        x: vel.x * factor * BALL.CRITICAL_SPEED_DAMPING,
        y: vel.y * factor * BALL.CRITICAL_SPEED_DAMPING,
      });
      // Визуальный фидбек
      this.playFlashEffect(0xff6600);
    } else if (speed > BALL.MAX_SPEED) {
      // Обычный лимит скорости
      const factor = BALL.MAX_SPEED / speed;
      this.scene.matter.body.setVelocity(this.body, {
        x: vel.x * factor,
        y: vel.y * factor,
      });
    }

    // Ограничение угловой скорости
    if (Math.abs(body.angularVelocity) > BALL.MAX_ANGULAR_VELOCITY) {
      const clamped = Phaser.Math.Clamp(
        body.angularVelocity,
        -BALL.MAX_ANGULAR_VELOCITY,
        BALL.MAX_ANGULAR_VELOCITY
      );
      this.scene.matter.body.setAngularVelocity(this.body, clamped);
    }
  }

  /**
   * ✅ Проверка выхода за границы поля и возврат мяча внутрь
   */
  private checkOutOfBounds(): void {
    if (!this.body) return;

    const { x, y } = this.body.position;

    // Проверка на NaN/Infinity позиции
    if (!isFinite(x) || !isFinite(y)) {
      console.error('[Ball] ⚠️ Invalid position detected! Resetting to center...');
      this.resetToCenter();
      return;
    }

    const bounds = this.fieldBounds || this.getFallbackBounds();
    const margin = BALL.OUT_OF_BOUNDS_MARGIN;

    const outLeft = x < bounds.left - margin;
    const outRight = x > bounds.right + margin;
    const outTop = y < bounds.top - margin;
    const outBottom = y > bounds.bottom + margin;

    if (outLeft || outRight || outTop || outBottom) {
      console.warn(
        `[Ball] ⚠️ Out of bounds! Position: (${x.toFixed(1)}, ${y.toFixed(
          1
        )}), Bounds: L${bounds.left} R${bounds.right} T${bounds.top} B${bounds.bottom}`
      );

      const safeMargin = 30;
      let newX = x;
      let newY = y;

      if (outLeft) newX = bounds.left + safeMargin;
      if (outRight) newX = bounds.right - safeMargin;
      if (outTop) newY = bounds.top + safeMargin;
      if (outBottom) newY = bounds.bottom - safeMargin;

      this.scene.matter.body.setPosition(this.body, { x: newX, y: newY });
      this.scene.matter.body.setVelocity(this.body, { x: 0, y: 0 });
      this.scene.matter.body.setAngularVelocity(this.body, 0);

      this.sprite.setPosition(newX, newY);

      this.playFlashEffect(0xff0000);

      this.trailPoints = [];
      this.motionTrail?.clear();
    }
  }

  /**
   * ✅ 1: Non-invasive boundary correction — only clamp when ball center is actually outside bounds
   * Do not damp velocity here; let physics handle impulse transfer normally
   */
  private preventEscape(): void {
    if (!this.body || !this.fieldBounds) return;

    const b = this.fieldBounds;
    const r = this.radius;

    // Allowed region for BALL CENTER
    const minX = b.left + r;
    const maxX = b.right - r;

    // Respect goal opening in Y (same approach as existing code)
    const goalHalfWidth = GOAL.WIDTH * (b.width / FIELD.WIDTH) / 2;
    const isInGoalX = Math.abs(this.body.position.x - b.centerX) < goalHalfWidth;

    const minY = b.top + r;
    const maxY = b.bottom - r;

    let x = this.body.position.x;
    let y = this.body.position.y;

    let changed = false;

    if (x < minX) { x = minX; changed = true; }
    else if (x > maxX) { x = maxX; changed = true; }

    if (!isInGoalX) {
      if (y < minY) { y = minY; changed = true; }
      else if (y > maxY) { y = maxY; changed = true; }
    }

    if (changed) {
      this.scene.matter.body.setPosition(this.body, { x, y });
      // IMPORTANT: do not damp velocity here
    }
  }

  /**
   * ✅ NEW: Apply spin when ball hits wall at an angle
   * @param wallNormal — normalized vector pointing away from wall
   * @param impactSpeed — speed at moment of impact
   * @param controlBonus — 0-1 bonus from shooting unit's control stat
   */
  public applyWallSpin(
    wallNormal: { x: number; y: number },
    impactSpeed: number,
    controlBonus: number = 0
  ): void {
    const vel = this.body.velocity;
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
    
    if (speed < 3) return; // Ignore slow impacts
    
    // Calculate impact angle (0 = perpendicular, 1 = parallel to wall)
    const velNormalized = { x: vel.x / speed, y: vel.y / speed };
    const dot = velNormalized.x * wallNormal.x + velNormalized.y * wallNormal.y;
    const impactAngle = Math.abs(dot); // 0-1, where 0 is grazing, 1 is head-on
    
    // Spin is strongest at grazing angles (30-60 degrees)
    // impactAngle 0.5 = 60° = maximum spin
    // impactAngle 0.0 = 90° (parallel) = no meaningful contact
    // impactAngle 1.0 = 0° (head-on) = no spin, just bounce
    
    const optimalAngle = BALL_SPIN.OPTIMAL_IMPACT_ANGLE;
    const angleMultiplier = 1 - Math.abs(impactAngle - optimalAngle) * 2;
    
    if (angleMultiplier < 0.2) return; // Angle not suitable for spin
    
    // Determine spin direction (cross product)
    const cross = velNormalized.x * wallNormal.y - velNormalized.y * wallNormal.x;
    const spinDirection = Math.sign(cross);
    
    // Base spin calculation
    const baseSpin = impactSpeed * BALL_SPIN.BASE_SPIN_MULTIPLIER * angleMultiplier;
    
    // Control bonus (from unit stats)
    const controlMultiplier = 1 + controlBonus * 0.5; // Up to 50% bonus
    
    // Random factor for unpredictability (skill-based chance)
    const skillChance = BALL_SPIN.BASE_SPIN_CHANCE + controlBonus * BALL_SPIN.CONTROL_CHANCE_BONUS; // 30-80% chance based on control
    if (Math.random() > skillChance) {
      // Spin attempt failed — just normal bounce
      this.spinVelocity *= 0.5; // Reduce existing spin
      return;
    }
    
    // Apply spin (clamp to max)
    this.spinVelocity = Phaser.Math.Clamp(
      spinDirection * baseSpin * controlMultiplier,
      -BALL_SPIN.MAX_SPIN_VELOCITY,
      BALL_SPIN.MAX_SPIN_VELOCITY
    );
    this.isSpinActive = true;
    this.lastWallHitTime = this.scene.time.now;
    this.lastWallHitNormal = { ...wallNormal };
    
    // Visual feedback — change trail color based on spin direction
    this.spinTrailColor = spinDirection > 0 ? 0x00ffff : 0xff00ff;
    
    console.log(`[Ball] Spin applied: ${this.spinVelocity.toFixed(3)}, angle: ${impactAngle.toFixed(2)}, control: ${controlBonus.toFixed(2)}`);
  }

  /**
   * ✅ NEW: Convert current spin into lateral force
   * This makes the ball curve while moving
   */
  private applySpinCurve(): void {
    if (!this.isSpinActive || Math.abs(this.spinVelocity) < 0.001) {
      this.isSpinActive = false;
      return;
    }
    
    const vel = this.body.velocity;
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
    
    if (speed < 1) {
      this.isSpinActive = false;
      return;
    }
    
    // Perpendicular direction to velocity
    const perpX = -vel.y / speed;
    const perpY = vel.x / speed;
    
    // Curve force proportional to spin and speed
    const curveForce = this.spinVelocity * this.spinToCurveRatio * speed;
    
    // Apply force
    this.scene.matter.body.applyForce(this.body, this.body.position, {
      x: perpX * curveForce,
      y: perpY * curveForce,
    });
    
    // Rotate ball sprite based on spin
    this.ballSprite.rotation += this.spinVelocity * 2;
  }

  /**
   * ✅ NEW: Decay spin over time
   */
  private decaySpin(): void {
    this.spinVelocity *= this.spinDecay;
    
    if (Math.abs(this.spinVelocity) < 0.001) {
      this.spinVelocity = 0;
      this.isSpinActive = false;
    }
  }

  /**
   * ✅ NEW: Check if ball is in "corner goal" trajectory
   * Returns true if ball is hugging wall toward goal
   */
  public isCornerGoalTrajectory(): { isActive: boolean; targetGoal: 'top' | 'bottom' | null } {
    if (!this.isSpinActive || !this.fieldBounds) {
      return { isActive: false, targetGoal: null };
    }
    
    const { x, y } = this.body.position;
    const vel = this.body.velocity;
    const bounds = this.fieldBounds;
    
    // Check if ball is near side wall
    const nearLeftWall = x < bounds.left + this.radius * 3;
    const nearRightWall = x > bounds.right - this.radius * 3;
    
    if (!nearLeftWall && !nearRightWall) {
      return { isActive: false, targetGoal: null };
    }
    
    // Check velocity direction (moving toward which goal?)
    const movingToTop = vel.y < -2;
    const movingToBottom = vel.y > 2;
    
    if (!movingToTop && !movingToBottom) {
      return { isActive: false, targetGoal: null };
    }
    
    // Check if in corner zone (top or bottom 20% of field)
    const topZone = y < bounds.top + bounds.height * 0.25;
    const bottomZone = y > bounds.bottom - bounds.height * 0.25;
    
    if (topZone && movingToTop) {
      return { isActive: true, targetGoal: 'top' };
    }
    
    if (bottomZone && movingToBottom) {
      return { isActive: true, targetGoal: 'bottom' };
    }
    
    return { isActive: false, targetGoal: null };
  }

  /**
   * ✅ Fallback-границы, если fieldBounds не установлены
   */
  private getFallbackBounds(): FieldBounds {
    // Пытаемся получить из сцены
    // @ts-ignore
    if ((this.scene as any).fieldBounds) {
      // @ts-ignore
      return (this.scene as any).fieldBounds as FieldBounds;
    }
    
    // Используем размеры экрана с отступом
    const left = 50;
    const right = this.scene.scale.width - 50;
    const top = 50;
    const bottom = this.scene.scale.height - 50;
    const width = right - left;
    const height = bottom - top;
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;

    return {
      left,
      right,
      top,
      bottom,
      centerX,
      centerY,
      width,
      height,
    };
  }

  /**
   * ✅ Сброс мяча в центр поля
   */
  private resetToCenter(): void {
    const bounds = this.fieldBounds || this.getFallbackBounds();
    const centerX = (bounds.left + bounds.right) / 2;
    const centerY = (bounds.top + bounds.bottom) / 2;

    this.scene.matter.body.setPosition(this.body, { x: centerX, y: centerY });
    this.scene.matter.body.setVelocity(this.body, { x: 0, y: 0 });
    this.scene.matter.body.setAngularVelocity(this.body, 0);
    
    this.sprite.setPosition(centerX, centerY);
    this.sprite.rotation = 0;
    this.ballSprite.rotation = 0;
    
    this.trailPoints = [];
    this.motionTrail?.clear();
    
    this.playFlashEffect(0xff0000);
    
    console.log(`[Ball] Reset to center: (${centerX}, ${centerY})`);
  }

  // ===============================================================
  // 🔥 ROTATION — Вращение
  // ===============================================================

  private updateRotation(speed: number): void {
    if (speed > 0.1) {
      const rotationSpeed = speed * 0.06;
      this.ballSprite.rotation += rotationSpeed;
    }
  }

  // ===============================================================
  // 🔥 STRETCH — Растяжение при движении
  // ===============================================================

  private updateStretch(vx: number, vy: number, speed: number): void {
    if (this.isSquashing) return;

    const threshold = 3;
    const maxStretch = 0.18;

    if (speed > threshold) {
      const intensity = Phaser.Math.Clamp((speed - threshold) / 20, 0, maxStretch);
      const angle = Math.atan2(vy, vx);
      
      this.targetScaleX = 1 + intensity;
      this.targetScaleY = 1 - intensity * 0.4;
      this.sprite.rotation = angle;
    } else {
      this.targetScaleX = 1;
      this.targetScaleY = 1;
      this.sprite.rotation = 0;
    }

    this.currentScaleX = Phaser.Math.Linear(this.currentScaleX, this.targetScaleX, 0.15);
    this.currentScaleY = Phaser.Math.Linear(this.currentScaleY, this.targetScaleY, 0.15);

    this.ballSprite.setScale(this.baseScale * this.currentScaleX, this.baseScale * this.currentScaleY);
  }

  // ===============================================================
  // 🔥 MOTION TRAIL — Кастомный светящийся след
  // ===============================================================

  private updateMotionTrail(x: number, y: number, speed: number): void {
    if (!this.motionTrail) return;

    if (speed > this.TRAIL_MIN_SPEED) {
      const intensity = Math.min(speed / 15, 1);
      this.trailPoints.unshift({
        x,
        y,
        alpha: intensity,
        size: this.radius * (0.8 + intensity * 0.4),
      });
    }

    while (this.trailPoints.length > this.TRAIL_LENGTH) {
      this.trailPoints.pop();
    }

    this.trailPoints.forEach(p => {
      p.alpha *= 0.88;
      p.size *= 0.95;
    });

    this.trailPoints = this.trailPoints.filter(p => p.alpha > 0.02);

    this.drawMotionTrail();
  }

  private drawMotionTrail(): void {
    if (!this.motionTrail) return;

    this.motionTrail.clear();

    if (this.trailPoints.length < 2) return;

    // Use spin color if active, otherwise faction color or default
    const trailColor = this.isSpinActive && this.spinTrailColor !== 0xffffff
      ? this.spinTrailColor
      : (this.lastHitFaction 
          ? FACTIONS[this.lastHitFaction].color 
          : this.skinData.glowColor);

    for (let i = 1; i < this.trailPoints.length; i++) {
      const p1 = this.trailPoints[i - 1];
      const p2 = this.trailPoints[i];

      const alpha = p1.alpha * 0.4;
      const width = p1.size * 1.2;

      this.motionTrail.lineStyle(width, trailColor, alpha);
      this.motionTrail.lineBetween(p1.x, p1.y, p2.x, p2.y);
    }

    if (this.trailPoints.length > 0) {
      const head = this.trailPoints[0];
      this.motionTrail.fillStyle(trailColor, head.alpha * 0.3);
      this.motionTrail.fillCircle(head.x, head.y, head.size * 0.6);
    }
  }

  // ===============================================================
  // 🔥 SPEED GLOW — Свечение при скорости
  // ===============================================================

  private updateSpeedGlow(speed: number): void {
    if (!this.speedGlow) return;

    const threshold = 5;
    const maxSpeed = BALL.MAX_SPEED;

    if (speed > threshold) {
      const intensity = Phaser.Math.Clamp((speed - threshold) / (maxSpeed - threshold), 0, 1);
      this.speedGlow.setAlpha(intensity * 0.5);
      this.speedGlow.setScale(1 + intensity * 0.4);
      
      if (this.lastHitFaction && this.scene.time.now - this.lastHitTime < 2000) {
        this.speedGlow.setFillStyle(FACTIONS[this.lastHitFaction].color, intensity * 0.5);
      } else {
        this.speedGlow.setFillStyle(this.skinData.glowColor, intensity * 0.5);
      }
    } else {
      this.speedGlow.setAlpha(0);
    }
  }

  // ===============================================================
  // 🔥 CORE GLOW — Пульсация ядра
  // ===============================================================

  private updateCoreGlow(speed: number): void {
    if (!this.coreGlow) return;

    this.pulsePhase += 0.1;
    
    const basePulse = 0.25 + Math.sin(this.pulsePhase) * 0.1;
    const speedBonus = Math.min(speed / 20, 0.3);
    
    this.coreGlow.setAlpha(basePulse + speedBonus);
    this.coreGlow.setScale(1 + Math.sin(this.pulsePhase * 0.7) * 0.05 + speedBonus * 0.2);
  }

  // ===============================================================
  // 🔥 ENERGY RING — Вращающееся кольцо
  // ===============================================================

  private updateEnergyRing(speed: number): void {
    if (!this.energyRing) return;

    this.energyRing.clear();

    if (speed < 1) return;

    const r = this.radius;
    this.energyPhase += 0.12 + speed * 0.015;

    const segments = 12;
    const ringRadius = r * 1.2;
    const alpha = Math.min(speed / 12, 0.6);

    const ringColor = this.lastHitFaction && this.scene.time.now - this.lastHitTime < 1500
      ? FACTIONS[this.lastHitFaction].color
      : this.skinData.glowColor;

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2 + this.energyPhase;
      const nextAngle = ((i + 0.6) / segments) * Math.PI * 2 + this.energyPhase;

      const wobble = Math.sin(angle * 4 + this.energyPhase * 2) * 2;
      const rr = ringRadius + wobble;

      const x1 = Math.cos(angle) * rr;
      const y1 = Math.sin(angle) * rr;
      const x2 = Math.cos(nextAngle) * rr;
      const y2 = Math.sin(nextAngle) * rr;

      const segmentAlpha = alpha * (0.5 + Math.sin(angle + this.energyPhase) * 0.5);
      
      this.energyRing.lineStyle(2, ringColor, segmentAlpha);
      this.energyRing.lineBetween(x1, y1, x2, y2);
    }
  }

  // ===============================================================
  // 🔥 PARTICLE TRAIL — Стандартный эмиттер
  // ===============================================================

  private updateParticleTrail(speed: number, vx: number, vy: number): void {
    if (!this.trailEmitter) return;

    if (speed > 3) {
      this.trailEmitter.start();
      this.trailEmitter.particleX = -vx * 1.5;
      this.trailEmitter.particleY = -vy * 1.5;
    } else {
      this.trailEmitter.stop();
    }
  }

  // ===============================================================
  // 🔥 SQUASH — Сжатие при ударе
  // ===============================================================

  playSquashEffect(intensity: number = 1): void {
    this.isSquashing = true;

    const squashAmount = 0.25 * intensity;

    this.scene.tweens.add({
      targets: this,
      currentScaleX: 1 + squashAmount,
      currentScaleY: 1 - squashAmount,
      duration: 40,
      ease: 'Cubic.easeOut',
      yoyo: true,
      onUpdate: () => {
        this.ballSprite.setScale(
          this.baseScale * this.currentScaleX,
          this.baseScale * this.currentScaleY
        );
      },
      onComplete: () => {
        this.isSquashing = false;
        this.currentScaleX = 1;
        this.currentScaleY = 1;
      },
    });
  }

  private updateSquashRecovery(): void {
    if (!this.isSquashing) {
      if (Math.abs(this.currentScaleX - this.targetScaleX) > 0.01) {
        this.currentScaleX = Phaser.Math.Linear(this.currentScaleX, this.targetScaleX, 0.15);
        this.currentScaleY = Phaser.Math.Linear(this.currentScaleY, this.targetScaleY, 0.15);
      }
    }
  }

  // ===============================================================
  // 🔥 HIT EFFECTS — Эффекты удара
  // ===============================================================

  onHitByUnit(factionId: FactionId, impactForce: number): void {
    this.lastHitTime = this.scene.time.now;
    this.lastHitFaction = factionId;

    const faction = FACTIONS[factionId];
    const intensity = Math.min(impactForce / 15, 1.5);

    this.playImpactRing(faction.color, intensity);
    this.playFlashEffect(faction.color);
    this.playSquashEffect(intensity);
    this.playHitParticles(faction, impactForce);

    if (impactForce > 10) {
      this.scene.cameras.main.shake(60, 0.006 * intensity);
    }
  }

  private playImpactRing(color: number, intensity: number): void {
    if (!this.impactRing) return;

    const r = this.radius;
    const maxRadius = r * 2.5 * intensity;
    const ring = { radius: r, alpha: 0.9 };

    this.scene.tweens.add({
      targets: ring,
      radius: maxRadius,
      alpha: 0,
      duration: 250,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        if (!this.impactRing) return;
        this.impactRing.clear();
        this.impactRing.lineStyle(3, color, ring.alpha);
        this.impactRing.strokeCircle(0, 0, ring.radius);
        this.impactRing.lineStyle(2, 0xffffff, ring.alpha * 0.5);
        this.impactRing.strokeCircle(0, 0, ring.radius * 0.7);
      },
      onComplete: () => {
        this.impactRing?.clear();
      },
    });
  }

  private playFlashEffect(color: number): void {
    if (!this.coreGlow) return;

    const originalColor = this.skinData.glowColor;

    this.coreGlow.setFillStyle(color);

    this.scene.tweens.add({
      targets: this.coreGlow,
      alpha: 1,
      scale: 1.5,
      duration: 50,
      yoyo: true,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (this.coreGlow) {
          this.coreGlow.setFillStyle(originalColor);
        }
      },
    });
  }

  private playHitParticles(faction: typeof FACTIONS[FactionId], impactForce: number): void {
    const { x, y } = this.body.position;
    const config = faction.particleEffect;
    
    const texture = this.scene.textures.exists(config.texture)
      ? config.texture
      : 'ball_particle_glow';

    const particles = this.scene.add.particles(x, y, texture, {
      speed: { min: config.speed * 0.6, max: config.speed * 1.3 },
      scale: { start: config.scale.start * 1.2, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: config.lifespan,
      quantity: Math.ceil(10 + impactForce),
      tint: config.colors,
      blendMode: 'ADD',
      angle: { min: 0, max: 360 },
    });
    
    particles.setDepth(100);
    this.scene.time.delayedCall(config.lifespan + 100, () => particles.destroy());
  }

  private updateHitFlash(): void {
    if (this.lastHitFaction && this.scene.time.now - this.lastHitTime > 3000) {
      this.lastHitFaction = undefined;
    }
  }

  onWallBounce(impactForce: number): void {
    const intensity = Math.min(impactForce / 12, 1);

    this.playWallSparks(intensity);
    this.playSquashEffect(intensity * 0.7);

    if (this.impactRing && intensity > 0.3) {
      const r = this.radius;
      const ring = { radius: r * 0.5, alpha: 0.6 };

      this.scene.tweens.add({
        targets: ring,
        radius: r * 1.5,
        alpha: 0,
        duration: 150,
        onUpdate: () => {
          if (!this.impactRing) return;
          this.impactRing.clear();
          this.impactRing.lineStyle(2, 0xffffff, ring.alpha);
          this.impactRing.strokeCircle(0, 0, ring.radius);
        },
        onComplete: () => this.impactRing?.clear(),
      });
    }

    if (impactForce > 8) {
      this.scene.cameras.main.shake(40, 0.004 * intensity);
    }
  }

  private playWallSparks(intensity: number): void {
    const { x, y } = this.body.position;
    const texture = this.scene.textures.exists('p_spark') ? 'p_spark' : 'ball_particle_glow';

    const particles = this.scene.add.particles(x, y, texture, {
      speed: { min: 60, max: 150 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 250,
      quantity: Math.ceil(6 * intensity),
      tint: [0xffffff, 0xcccccc, 0xaaaaaa],
      blendMode: 'ADD',
      angle: { min: 0, max: 360 },
    });

    particles.setDepth(100);
    this.scene.time.delayedCall(300, () => particles.destroy());
  }

  // ===============================================================
  // ФИЗИКА
  // ===============================================================

  private createPhysicsBody(x: number, y: number): void {
    const P = Ball.PHYSICS;
    const physicsRadius = this.radius + 1;

    this.body = this.scene.matter.add.circle(x, y, physicsRadius, {
      restitution: P.RESTITUTION,
      friction: P.FRICTION,
      frictionAir: P.FRICTION_AIR,
      frictionStatic: P.FRICTION_STATIC,
      mass: P.MASS,
      label: 'ball',
      slop: 0.01, // ✅ 1: Increased from 0.001 to reduce sticking/jitter in wall contacts
      collisionFilter: {
        category: COLLISION_CATEGORIES.BALL,
        mask: COLLISION_CATEGORIES.WALL | COLLISION_CATEGORIES.CAP | COLLISION_CATEGORIES.CORNER,
      },
    });

    console.log(`[Ball] ⚽ Created (mass: ${P.MASS}, restitution: ${P.RESTITUTION})`);
  }

  // ===============================================================
  // PUBLIC API
  // ===============================================================

  syncSpriteWithBody(): void {
    const { x, y } = this.body.position;
    this.sprite.setPosition(x, y);

    const speed = this.getSpeed();
    if (speed > 0.1) {
      this.ballSprite.rotation += speed * 0.03;
    }

    if (this.trailEmitter) {
      if (speed > 2) {
        this.trailEmitter.start();
      } else {
        this.trailEmitter.stop();
      }
    }
  }

  getSpeed(): number {
    const { x, y } = this.body.velocity;
    return Math.sqrt(x * x + y * y);
  }

  isStopped(threshold = 0.1): boolean {
    return this.getSpeed() < threshold;
  }

  reset(x: number, y: number): void {
    this.scene.matter.body.setPosition(this.body, { x, y });
    this.scene.matter.body.setVelocity(this.body, { x: 0, y: 0 });
    this.scene.matter.body.setAngularVelocity(this.body, 0);
    this.sprite.setPosition(x, y);
    this.sprite.rotation = 0;
    this.ballSprite.rotation = 0;
    this.currentScaleX = 1;
    this.currentScaleY = 1;
    this.targetScaleX = 1;
    this.targetScaleY = 1;
    this.trailPoints = [];
    this.motionTrail?.clear();
    this.lastHitFaction = undefined;
    this.lastHitTime = 0;
    this.lastSpeed = 0;
    this.criticalSpeedFrames = 0;
    this.spinVelocity = 0;
    this.isSpinActive = false;
    this.lastWallHitTime = 0;
    this.lastWallHitNormal = { x: 0, y: 0 };
    this.spinTrailColor = 0xffffff;
    this.passThroughCount = 0;
    this.slowOnHitValue = 0;
    this.slowOnHitSource = '';
  }

  getPosition(): { x: number; y: number } {
    return { x: this.body.position.x, y: this.body.position.y };
  }

  getVelocity(): { x: number; y: number } {
    return { x: this.body.velocity.x, y: this.body.velocity.y };
  }

  getRadius(): number {
    return this.radius;
  }

  applyImpulse(x: number, y: number): void {
    this.scene.matter.body.applyForce(this.body, this.body.position, { x, y });
  }

  // ========== PASSIVE SYSTEM METHODS ==========
  
  public setPassThroughCount(count: number): void {
    this.passThroughCount = count;
  }

  public consumePassThrough(): boolean {
    if (this.passThroughCount > 0) {
      this.passThroughCount--;
      return true;
    }
    return false;
  }

  public setSlowOnHit(value: number, sourceId: string): void {
    this.slowOnHitValue = value;
    this.slowOnHitSource = sourceId;
  }

  public getAndClearSlowOnHit(): { value: number; sourceId: string } | null {
    if (this.slowOnHitValue > 0) {
      const result = { value: this.slowOnHitValue, sourceId: this.slowOnHitSource };
      this.slowOnHitValue = 0;
      this.slowOnHitSource = '';
      return result;
    }
    return null;
  }

  destroy(): void {
  if (this.isDestroyed) return;
  this.isDestroyed = true;
  
  this.trailEmitter?.destroy();
  this.glowSprite?.destroy();
    this.speedGlow?.destroy();
    this.coreGlow?.destroy();
    this.energyRing?.destroy();
    this.motionTrail?.destroy();
    this.impactRing?.destroy();
    this.sprite.destroy();
    this.scene.matter.world.remove(this.body);
  }
}