// src/entities/Ball.ts

import Phaser from 'phaser';
import { COLLISION_CATEGORIES } from '../constants/gameConstants';
import { getColors } from '../config/themes';
import { playerData } from '../data/PlayerData';
import { getBallSkin, BallSkinData } from '../data/SkinsCatalog';

export class Ball {
  public body: MatterJS.BodyType;
  public sprite: Phaser.GameObjects.Container;

  private scene: Phaser.Scene;
  private radius: number;
  private skinData: BallSkinData;
  private ballSprite!: Phaser.GameObjects.Sprite;
  private glowSprite?: Phaser.GameObjects.Sprite;
  private trailEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private particleEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  private static readonly PHYSICS = {
    RADIUS: 15,
    MASS: 0.8,
    RESTITUTION: 0.9,
    FRICTION: 0.002,
    FRICTION_AIR: 0.008,
    FRICTION_STATIC: 0.001,
    MAX_SPEED: 28,
  };

  private static readonly DEFAULT_SKIN: BallSkinData = {
    id: 'ball_default',
    name: 'Classic',
    rarity: 'basic',
    price: {},
    primaryColor: 0xffffff,
    secondaryColor: 0x00fff5,
    glowColor: 0x00fff5,
    hasGlow: true,
    hasTrail: false,
    textureKey: 'ball_default'
  };

  constructor(scene: Phaser.Scene, x: number, y: number, radius?: number) {
    this.scene = scene;
    this.radius = radius || Ball.PHYSICS.RADIUS;
    this.skinData = getBallSkin(playerData.get().equippedBallSkin) || Ball.DEFAULT_SKIN;

    this.sprite = scene.add.container(x, y).setDepth(50);
    
    this.createTrail();
    this.createParticles();
    this.createVisuals();
    this.createPhysicsBody(x, y);
  }

  private createVisuals(): void {
    const { skinData: skin, radius: r, scene } = this;
    const colors = getColors();

    // Тень
    this.sprite.add(
      scene.add.ellipse(3, 3, r * 2, r * 1.5, colors.shadowColor, colors.shadowAlpha * 0.5)
    );

    // Свечение
    if (skin.hasGlow) {
      this.createGlow();
    }

    // Тело мяча
    this.createBallSprite();
  }

  private createGlow(): void {
    const { scene, radius: r, skinData: skin } = this;
    
    // Используем p_glow или создаём свою текстуру
    let texKey = 'p_glow';
    let scale = r / 10;
    
    if (!scene.textures.exists('p_glow')) {
      texKey = this.generateGlowTexture();
      scale = r / 32 * 1.5;
    }

    this.glowSprite = scene.add.sprite(0, 0, texKey)
      .setTint(skin.glowColor)
      .setAlpha(0.4)
      .setScale(scale);
    
    this.sprite.add(this.glowSprite);

    scene.tweens.add({
      targets: this.glowSprite,
      alpha: { from: 0.3, to: 0.6 },
      scaleX: scale * 1.2,
      scaleY: scale * 1.2,
      duration: 800,
      yoyo: true,
      repeat: -1
    });
  }

  private generateGlowTexture(): string {
    const key = 'ball_glow_tex';
    if (this.scene.textures.exists(key)) return key;
    
    const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff).fillCircle(32, 32, 32);
    g.generateTexture(key, 64, 64);
    g.destroy();
    return key;
  }

  private createBallSprite(): void {
    const { scene, radius: r, skinData: skin } = this;
    
    // Проверяем наличие текстуры по textureKey из скина
    const textureKey = skin.textureKey;
    
    if (textureKey && scene.textures.exists(textureKey)) {
      // Используем сгенерированную текстуру
      this.ballSprite = scene.add.sprite(0, 0, textureKey)
        .setScale((r * 2) / 64); // 64 = размер текстуры мяча
    } else {
      // Fallback: рисуем программно
      this.ballSprite = this.createFallbackBallSprite();
    }
    
    this.sprite.add(this.ballSprite);
  }

  private createFallbackBallSprite(): Phaser.GameObjects.Sprite {
    const { scene, radius: r, skinData: skin } = this;
    const key = `ball_fallback_${skin.id}`;
    
    if (!scene.textures.exists(key)) {
      const g = scene.make.graphics({ x: 0, y: 0, add: false });
      const size = 64;
      const center = size / 2;
      const ballRadius = 30;
      
      // Основа
      g.fillStyle(skin.primaryColor);
      g.fillCircle(center, center, ballRadius);
      
      // Паттерн (футбольный мяч)
      g.fillStyle(skin.secondaryColor);
      // Центральный пятиугольник
      this.drawPentagonOnGraphics(g, center, center, 10);
      // Боковые
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
        this.drawPentagonOnGraphics(g, center + Math.cos(angle) * 18, center + Math.sin(angle) * 18, 6);
      }
      
      // Обводка
      g.lineStyle(2, skin.glowColor);
      g.strokeCircle(center, center, ballRadius);
      
      // Блик
      g.fillStyle(0xffffff, 0.4);
      g.fillEllipse(center - 8, center - 8, 10, 6);
      
      g.generateTexture(key, size, size);
      g.destroy();
    }
    
    return scene.add.sprite(0, 0, key).setScale((r * 2) / 64);
  }

  private drawPentagonOnGraphics(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(angle) * size;
      const py = y + Math.sin(angle) * size;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fillPath();
  }

  private createTrail(): void {
    if (!this.skinData.hasTrail) return;

    const texKey = this.scene.textures.exists('p_spark') ? 'p_spark' : this.generateTrailTexture();

    this.trailEmitter = this.scene.add.particles(0, 0, texKey, {
      speed: 10,
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 300,
      blendMode: 'ADD',
      tint: this.skinData.trailColor || this.skinData.primaryColor,
      frequency: 20,
      follow: this.sprite
    });
    this.trailEmitter.setDepth(49).stop();
  }

  private generateTrailTexture(): string {
    const key = 'ball_trail_tex';
    if (this.scene.textures.exists(key)) return key;
    
    const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff).fillCircle(8, 8, 8);
    g.generateTexture(key, 16, 16);
    g.destroy();
    return key;
  }

  private createParticles(): void {
    const effect = this.skinData.particleEffect;
    if (!effect) return;

    const texKey = this.scene.textures.exists(effect.texture) ? effect.texture : 'p_spark';
    if (!this.scene.textures.exists(texKey)) return;

    this.particleEmitter = this.scene.add.particles(0, 0, texKey, {
      speed: effect.speed,
      scale: effect.scale,
      alpha: { start: 0.8, end: 0 },
      lifespan: effect.lifespan,
      frequency: effect.frequency,
      blendMode: effect.blendMode as Phaser.BlendModes,
      tint: effect.color,
      gravityY: effect.gravityY || 0,
      quantity: effect.quantity || 1,
      follow: this.sprite
    });
    this.particleEmitter.setDepth(49);

    if (effect.followVelocity) {
      this.particleEmitter.stop();
    }
  }

  private createPhysicsBody(x: number, y: number): void {
    const P = Ball.PHYSICS;
    this.body = this.scene.matter.add.circle(x, y, this.radius, {
      restitution: P.RESTITUTION,
      friction: P.FRICTION,
      frictionAir: P.FRICTION_AIR,
      frictionStatic: P.FRICTION_STATIC,
      mass: P.MASS,
      label: 'ball',
      slop: 0.01,
      collisionFilter: {
        category: COLLISION_CATEGORIES.BALL,
        mask: COLLISION_CATEGORIES.WALL | COLLISION_CATEGORIES.CAP,
      },
    });
  }

  update(): void {
    this.limitSpeed();

    const { x, y } = this.body.position;
    this.sprite.setPosition(x, y);

    const speed = this.getSpeed();

    // Вращение мяча
    if (speed > 0.1) {
      this.ballSprite.rotation += speed * 0.05;
    }

    // Trail эмиттер
    if (this.trailEmitter) {
      if (speed > 2) {
        this.trailEmitter.start();
        this.trailEmitter.particleX = -this.body.velocity.x;
        this.trailEmitter.particleY = -this.body.velocity.y;
      } else {
        this.trailEmitter.stop();
      }
    }

    // Particle эмиттер (для скинов с эффектами)
    if (this.particleEmitter && this.skinData.particleEffect?.followVelocity) {
      if (speed > 1.5) {
        this.particleEmitter.start();
      } else {
        this.particleEmitter.stop();
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
    this.particleEmitter?.destroy();
    this.sprite.destroy();
    this.scene.matter.world.remove(this.body);
  }
}