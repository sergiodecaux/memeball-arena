// src/entities/Cap.ts

import Phaser from 'phaser';
import { CAP_CLASSES, COLLISION_CATEGORIES, CapClass, CapClassStats } from '../constants/gameConstants';
import { PlayerNumber, ParticleConfig } from '../types';
import { playerData } from '../data/PlayerData';
import { getCapSkin, CapSkinData, CAP_SKINS } from '../data/SkinsCatalog';
import { drawClassIcon, getClassColor } from '../ui/ClassIcons';

export class Cap {
  public body: MatterJS.BodyType;
  public sprite: Phaser.GameObjects.Container;
  public readonly owner: PlayerNumber;
  public readonly id: string;
  public capClass: CapClass;  // Убрали readonly — теперь можно менять
  public stats: CapClassStats;

  private scene: Phaser.Scene;
  private scaledRadius: number;
  private baseRadius: number;
  private scale: number;
  private skinData: CapSkinData;
  private skinId: string;
  private visualSprite?: Phaser.GameObjects.Sprite;
  private particleEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private highlightRing!: Phaser.GameObjects.Graphics;
  private highlightTween?: Phaser.Tweens.Tween;
  private classIconContainer?: Phaser.GameObjects.Container;

  private static readonly MAX_SPEED: Record<CapClass, number> = {
    balanced: 20,
    tank: 15,
    sniper: 22,
    trickster: 20,
  };

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    owner: PlayerNumber,
    id: string,
    capClass: CapClass = 'balanced',
    scale = 1,
    skinId?: string
  ) {
    this.scene = scene;
    this.owner = owner;
    this.id = id;
    this.capClass = capClass;
    this.scale = scale;
    this.stats = { ...CAP_CLASSES[capClass] };
    this.baseRadius = this.stats.radius;
    this.scaledRadius = this.baseRadius * scale;

    // Определение скина
    if (skinId) {
      this.skinId = skinId;
    } else {
      this.skinId = owner === 1 
        ? (playerData.get().equippedCapSkin || 'cap_default_cyan')
        : 'cap_default_magenta';
    }

    if (owner === 1) {
      this.applyBonuses(playerData.getCapTotalBonus(this.skinId));
    }

    this.skinData = getCapSkin(this.skinId) || CAP_SKINS[0];

    this.sprite = scene.add.container(x, y).setDepth(60);
    this.createVisuals();
    this.createPhysicsBody(x, y);
    this.setupInteractivity();
  }

  private applyBonuses(bonuses: { power: number; speed: number; control: number; weight: number }): void {
    const { power, speed, control, weight } = bonuses;
    
    this.stats.forceMultiplier *= 1 + power / 100;
    this.stats.maxForce *= 1 + power / 100;
    this.stats.frictionAir *= Math.max(1 - speed / 200, 0.5);
    this.stats.aimLineLength *= 1 + control / 100;
    this.stats.mass *= 1 + weight / 100;
  }

  private createVisuals(): void {
    const { skinData: skin, scaledRadius: r, scene } = this;

    // Частицы (под фишкой)
    if (skin.visual.particleEffect) {
      this.createParticles(skin.visual.particleEffect);
    }

    // Тень
    this.sprite.add(scene.add.ellipse(3, 3, r * 1.8, r * 1.5, 0x000000, 0.25));

    // Основное тело
    if (skin.visual.type === 'sprite' && skin.visual.textureKey && scene.textures.exists(skin.visual.textureKey)) {
      this.createSpriteVisual(skin);
    } else {
      this.createGraphicsVisual(skin);
    }

    // Иконка класса
    this.createClassIcon();

    // Кольцо выделения
    this.createHighlightRing();
  }

  private createSpriteVisual(skin: CapSkinData): void {
    const scale = (this.scaledRadius * 2.05 / 128) * (skin.visual.scale || 1);
    this.visualSprite = this.scene.add.sprite(0, 0, skin.visual.textureKey!)
      .setScale(scale);
    this.sprite.add(this.visualSprite);
  }

  private createGraphicsVisual(skin: CapSkinData): void {
    const g = this.scene.add.graphics();
    const r = this.scaledRadius;

    if (skin.hasGlow) {
      g.fillStyle(skin.glowColor || skin.primaryColor, 0.3).fillCircle(0, 0, r + 5);
    }
    
    g.fillStyle(skin.primaryColor).fillCircle(0, 0, r);
    g.lineStyle(3, skin.secondaryColor).strokeCircle(0, 0, r);
    g.fillStyle(0xffffff, 0.15).fillEllipse(-r * 0.3, -r * 0.3, r * 0.4, r * 0.25);
    
    this.sprite.add(g);
  }

  private createClassIcon(): void {
    const r = this.scaledRadius;
    const iconColor = this.skinData.visual.type === 'sprite' ? 0xffffff : getClassColor(this.capClass);

    // Контейнер для иконки (чтобы легко обновлять)
    this.classIconContainer = this.scene.add.container(r * 0.55, -r * 0.55);
    
    // Подложка
    this.classIconContainer.add(this.scene.add.circle(0, 0, r * 0.28, 0x000000, 0.4));

    // Иконка
    const icon = drawClassIcon(this.scene, 0, 0, this.capClass, r * 0.25, iconColor);
    icon.setAlpha(0.95);
    this.classIconContainer.add(icon);
    
    this.sprite.add(this.classIconContainer);
  }

  private updateClassIcon(): void {
    if (!this.classIconContainer) return;
    
    const r = this.scaledRadius;
    const iconColor = this.skinData.visual.type === 'sprite' ? 0xffffff : getClassColor(this.capClass);
    
    // Очищаем старую иконку
    this.classIconContainer.removeAll(true);
    
    // Подложка
    this.classIconContainer.add(this.scene.add.circle(0, 0, r * 0.28, 0x000000, 0.4));

    // Новая иконка
    const icon = drawClassIcon(this.scene, 0, 0, this.capClass, r * 0.25, iconColor);
    icon.setAlpha(0.95);
    this.classIconContainer.add(icon);
  }

  private createHighlightRing(): void {
    this.highlightRing = this.scene.add.graphics();
    this.highlightRing.lineStyle(3, 0xffff00, 0.8);
    this.highlightRing.strokeCircle(0, 0, this.scaledRadius + 6);
    this.highlightRing.setVisible(false);
    this.sprite.add(this.highlightRing);
  }

  private createParticles(config: ParticleConfig): void {
    if (!this.scene.textures.exists(config.texture)) return;

    this.particleEmitter = this.scene.add.particles(0, 0, config.texture, {
      speed: config.speed,
      scale: config.scale,
      alpha: { start: 0.8, end: 0 },
      lifespan: config.lifespan,
      frequency: config.frequency,
      blendMode: config.blendMode,
      tint: config.color,
      gravityY: config.gravityY || 0,
      quantity: config.quantity || 1,
      follow: this.sprite
    });
    this.particleEmitter.setDepth(59);

    if (config.followVelocity) {
      this.particleEmitter.stop();
    }
  }

  private createPhysicsBody(x: number, y: number): void {
    this.body = this.scene.matter.add.circle(x, y, this.scaledRadius, {
      restitution: this.stats.restitution,
      friction: this.stats.friction,
      frictionAir: this.stats.frictionAir,
      frictionStatic: 0.02,
      mass: this.stats.mass,
      label: `cap_${this.capClass}_p${this.owner}`,
      slop: 0.01,
      collisionFilter: {
        category: COLLISION_CATEGORIES.CAP,
        mask: COLLISION_CATEGORIES.WALL | COLLISION_CATEGORIES.CAP | COLLISION_CATEGORIES.BALL,
      },
    });
  }

  private setupInteractivity(): void {
    this.sprite.setInteractive(
      new Phaser.Geom.Circle(0, 0, this.scaledRadius),
      Phaser.Geom.Circle.Contains
    );
  }

  update(): void {
    this.limitSpeed();

    const { x, y } = this.body.position;
    this.sprite.setPosition(x, y);

    if (this.visualSprite) {
      this.visualSprite.rotation = this.body.angle;
    }

    // Управление частицами по скорости
    if (this.particleEmitter && this.skinData.visual.particleEffect?.followVelocity) {
      if (this.getSpeed() > 1.0) {
        this.particleEmitter.start();
      } else {
        this.particleEmitter.stop();
      }
    }
  }

  private limitSpeed(): void {
    const speed = this.getSpeed();
    const maxSpeed = Cap.MAX_SPEED[this.capClass];
    
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
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

  applyForce(forceX: number, forceY: number): void {
    const maxForce = this.stats.maxForce * 1.5;
    const forceMag = Math.sqrt(forceX * forceX + forceY * forceY);
    
    if (forceMag > maxForce) {
      const scale = maxForce / forceMag;
      forceX *= scale;
      forceY *= scale;
    }
    
    this.scene.matter.body.applyForce(this.body, this.body.position, { x: forceX, y: forceY });
  }

  calculateShotForce(dragDistance: number, direction: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const force = Math.min(dragDistance * this.stats.forceMultiplier, this.stats.maxForce);
    return new Phaser.Math.Vector2(-direction.x * force, -direction.y * force);
  }

  getAimLineLength(): number {
    return this.stats.aimLineLength;
  }

  getRadius(): number {
    return this.scaledRadius;
  }

  /**
   * Изменить класс фишки (для смены формации в игре)
   */
  setCapClass(newClass: CapClass): void {
    if (this.capClass === newClass) return;
    
    this.capClass = newClass;
    const newStats = CAP_CLASSES[newClass];
    
    // Обновляем статы
    this.stats = { ...newStats };
    
    // Применяем бонусы если это фишка игрока
    if (this.owner === 1) {
      this.applyBonuses(playerData.getCapTotalBonus(this.skinId));
    }
    
    // Обновляем физические параметры
    const body = this.body as MatterJS.BodyType;
    
    // Обновляем массу
    this.scene.matter.body.setMass(body, this.stats.mass);
    
    // Обновляем label
    body.label = `cap_${newClass}_p${this.owner}`;
    
    // Обновляем визуал иконки класса
    this.updateClassIcon();
    
    console.log(`Cap ${this.id} class changed to ${newClass}`);
  }

  /**
   * Получить текущий класс фишки
   */
  getCapClass(): CapClass {
    return this.capClass;
  }

  highlight(enabled: boolean): void {
    this.highlightRing.setVisible(enabled);
    
    if (enabled) {
      this.highlightTween = this.scene.tweens.add({
        targets: this.highlightRing,
        alpha: { from: 0.6, to: 1 },
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
    } else {
      this.highlightTween?.stop();
      this.highlightRing.setAlpha(1);
    }
  }

  destroy(): void {
    this.highlightTween?.stop();
    this.particleEmitter?.destroy();
    this.sprite.destroy();
    this.scene.matter.world.remove(this.body);
  }
}