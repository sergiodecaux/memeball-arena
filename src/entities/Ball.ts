// src/entities/Ball.ts
// ВЕРСИЯ С PNG-ОРБАМИ И ЭФФЕКТАМИ + УЛУЧШЕННАЯ ФИЗИКА

import Phaser from 'phaser';
import { COLLISION_CATEGORIES } from '../constants/gameConstants';
import { playerData } from '../data/PlayerData';
import { getBallSkin, BallSkinData } from '../data/SkinsCatalog';

export class Ball {
  public body!: MatterJS.BodyType;
  public sprite: Phaser.GameObjects.Container;

  private scene: Phaser.Scene;
  private radius: number;
  private skinData: BallSkinData;
  private ballSprite!: Phaser.GameObjects.Sprite;
  private glowSprite?: Phaser.GameObjects.Sprite;
  private trailEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  private static readonly PHYSICS = {
    RADIUS: 15,
    MASS: 1.2,              // было 0.8
    RESTITUTION: 0.88,      // было 0.85
    FRICTION: 0.002,
    FRICTION_AIR: 0.005,    // было 0.008
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
    const effectiveSkinId =
      skinId ||
      equippedId ||
      Ball.DEFAULT_SKIN_ID;

    const skin = getBallSkin(effectiveSkinId) || getBallSkin(Ball.DEFAULT_SKIN_ID);
    if (!skin) {
      throw new Error('[Ball] No valid ball skin found');
    }
    this.skinData = skin;

    console.log('[Ball] Using skin:', this.skinData.id, this.skinData.name);

    this.sprite = scene.add.container(x, y).setDepth(50);

    this.createVisuals();
    this.createTrail();
    this.createPhysicsBody(x, y);
  }

  get x(): number {
    return this.body.position.x;
  }

  get y(): number {
    return this.body.position.y;
  }

  // ================= ВИЗУАЛ =================

  private createVisuals(): void {
    const r = this.radius;

    // Тень под мячом
    const shadow = this.scene.add.ellipse(3, 3, r * 2, r * 1.4, 0x000000, 0.45);
    this.sprite.add(shadow);

    // Свечение
    if (this.skinData.hasGlow) {
      this.createGlow();
    }

    // Спрайт мяча (PNG или процедурный fallback)
    this.createBallSprite();
  }

  private createGlow(): void {
    const r = this.radius;
    const texKey = this.ensureGlowTexture();

    this.glowSprite = this.scene.add.sprite(0, 0, texKey)
      .setTint(this.skinData.glowColor)
      .setAlpha(0.55)
      .setScale(r / 16)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.sprite.add(this.glowSprite);

    // Пульсация свечения
    this.scene.tweens.add({
      targets: this.glowSprite,
      alpha: { from: 0.4, to: 0.75 },
      scale: { from: r / 16, to: r / 13 },
      duration: 900,
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
    grad.addColorStop(0.4, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    canvas!.refresh();

    return key;
  }

  private createBallSprite(): void {
    const r = this.radius;
    const texKey = this.skinData.textureKey;

    if (texKey && this.scene.textures.exists(texKey)) {
      // PNG-орб 256x256
      this.ballSprite = this.scene.add.sprite(0, 0, texKey)
        .setOrigin(0.5)
        .setScale((r * 2) / 256);
    } else {
      this.ballSprite = this.createFallbackBallSprite();
    }

    this.sprite.add(this.ballSprite);
  }

  private createFallbackBallSprite(): Phaser.GameObjects.Sprite {
    const r = this.radius;
    const key = `ball_fallback_${this.skinData.id}`;

    if (this.scene.textures.exists(key)) {
      return this.scene.add.sprite(0, 0, key).setScale((r * 2) / 256);
    }

    const size = 256;
    const center = size / 2;
    const ballRadius = 100;

    const g = this.scene.add.graphics();
    g.setVisible(false);

    // Основной круг
    g.fillStyle(this.skinData.primaryColor, 1);
    g.fillCircle(center, center, ballRadius);

    // Внутреннее энергетическое ядро
    g.fillStyle(this.skinData.secondaryColor, 0.7);
    g.fillCircle(center, center, ballRadius * 0.7);

    // Концентрические кольца
    g.lineStyle(4, this.skinData.glowColor, 0.9);
    for (let i = 0; i < 3; i++) {
      const off = i * 10;
      g.strokeCircle(center - off * 0.4, center - off * 0.4, ballRadius - off * 2);
    }

    // Блик
    g.fillStyle(0xffffff, 0.5);
    g.fillEllipse(center - 35, center - 40, 50, 28);

    g.generateTexture(key, size, size);
    g.destroy();

    return this.scene.add.sprite(0, 0, key).setScale((r * 2) / 256);
  }

  // ================= ШЛЕЙФ =================

  private createTrail(): void {
    if (!this.skinData.hasTrail) return;

    const texKey = this.ensureParticleTexture();

    this.trailEmitter = this.scene.add.particles(0, 0, texKey, {
      speed: { min: 10, max: 35 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: 450,
      blendMode: 'ADD',
      tint: this.skinData.trailColor || this.skinData.glowColor,
      frequency: 25,
      follow: this.sprite,
    });
    this.trailEmitter.setDepth(49).stop();
  }

  private ensureParticleTexture(): string {
    const key = 'ball_particle_glow';
    if (this.scene.textures.exists(key)) return key;

    const g = this.scene.add.graphics().setVisible(false);
    g.fillStyle(0xffffff).fillCircle(8, 8, 8);
    g.generateTexture(key, 16, 16);
    g.destroy();
    return key;
  }

  // ================= ФИЗИКА =================

  private createPhysicsBody(x: number, y: number): void {
    const P = Ball.PHYSICS;
    this.body = this.scene.matter.add.circle(x, y, this.radius, {
      restitution: P.RESTITUTION,
      friction: P.FRICTION,
      frictionAir: P.FRICTION_AIR,
      frictionStatic: P.FRICTION_STATIC,
      mass: P.MASS,
      label: 'ball',
      slop: 0.01,              // ⭐ явно указываем (меньше проваливания)
      collisionFilter: {
        category: COLLISION_CATEGORIES.BALL,
        mask: COLLISION_CATEGORIES.WALL | COLLISION_CATEGORIES.CAP,
      },
    });
    
    console.log(`[Ball] ⚽ Ball configured (mass: ${P.MASS}, restitution: ${P.RESTITUTION}, slop: 0.01)`);
  }

  // ================= UPDATE =================

  update(): void {
    this.limitSpeed();

    const { x, y } = this.body.position;
    this.sprite.setPosition(x, y);

    const speed = this.getSpeed();

    // Вращение пропорционально скорости
    if (speed > 0.1) {
      this.ballSprite.rotation += speed * 0.05;
    }

    // Лёгкое увеличение при высокой скорости
    const baseScale = (this.radius * 2) / 256;
    if (speed > 5) {
      const factor = 1 + (Math.min(speed, Ball.PHYSICS.MAX_SPEED) / Ball.PHYSICS.MAX_SPEED) * 0.15;
      this.ballSprite.setScale(baseScale * factor);
    } else {
      this.ballSprite.setScale(baseScale);
    }

    // Шлейф
    if (this.trailEmitter) {
      if (speed > 2) {
        this.trailEmitter.start();
        this.trailEmitter.particleX = -this.body.velocity.x * 2;
        this.trailEmitter.particleY = -this.body.velocity.y * 2;
      } else {
        this.trailEmitter.stop();
      }
    }
  }

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

  private limitSpeed(): void {
    const speed = this.getSpeed();
    if (speed > Ball.PHYSICS.MAX_SPEED) {
      const scale = Ball.PHYSICS.MAX_SPEED / speed;
      this.scene.matter.body.setVelocity(this.body, {
        x: this.body.velocity.x * scale,
        y: this.body.velocity.y * scale,
      });
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

  destroy(): void {
    this.trailEmitter?.destroy();
    this.glowSprite?.destroy();
    this.sprite.destroy();
    this.scene.matter.world.remove(this.body);
  }
}