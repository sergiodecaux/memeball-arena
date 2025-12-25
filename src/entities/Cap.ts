// src/entities/Cap.ts

import Phaser from 'phaser';
import { CAP_CLASSES, COLLISION_CATEGORIES, CapClass, CapClassStats, AURA } from '../constants/gameConstants';
import { PlayerNumber, ParticleConfig, CapUpgrades } from '../types';
import { playerData } from '../data/PlayerData';
import { getCapSkin, CapSkinData, CAP_SKINS, RARITY_STAT_BONUS } from '../data/SkinsCatalog';
import { drawClassIcon, getClassColor } from '../ui/ClassIcons';
import { createCapIcon } from '../ui/CapIcon';

export interface CapOptions {
  applyUpgrades?: boolean;
  customUpgrades?: CapUpgrades;
}

export class Cap {
  public body: MatterJS.BodyType;
  public sprite: Phaser.GameObjects.Container;
  public readonly owner: PlayerNumber;
  public readonly id: string;
  public readonly capClass: CapClass;
  public stats: CapClassStats;

  private scene: Phaser.Scene;
  private scaledRadius: number;
  private baseRadius: number;
  private scale: number;
  private skinData: CapSkinData;
  private skinId: string;
  private upgrades: CapUpgrades;

  private lastHitOffset = 0;
  private lastShotTime = 0;

  private visualSprite?: Phaser.GameObjects.Sprite;
  private particleEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private highlightRing!: Phaser.GameObjects.Graphics;
  private highlightTween?: Phaser.Tweens.Tween;
  private classIconContainer?: Phaser.GameObjects.Container;
  private imageContainer?: Phaser.GameObjects.Container;

  // ========== Система ауры ==========
  private auraSprite?: Phaser.GameObjects.Image;
  private auraSelectedRing?: Phaser.GameObjects.Image;
  private auraPhase: number;
  private auraBaseScale: number = 1;
  private isSelected: boolean = false;
  private isActiveTeamTurn: boolean = true;

  private static readonly MAX_SPEED: Record<CapClass, number> = {
    balanced: 25,
    tank: 18,
    sniper: 30,
    trickster: 26,
  };

  // Счётчики для каждой команды отдельно
  private static team1Counter: number = 0;
  private static team2Counter: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    owner: PlayerNumber,
    id: string,
    skinId: string,
    scale = 1,
    options?: CapOptions
  ) {
    this.scene = scene;
    this.owner = owner;
    this.id = id;
    this.scale = scale;
    this.skinId = skinId;

    // Фаза для ауры:
    // - Своя команда (owner=1): все синхронно (фаза = 0)
    // - Противник (owner=2): небольшой разброс чтобы не было "армии клонов"
    if (owner === 1) {
      // Своя команда - синхронная пульсация
      this.auraPhase = 0;
      Cap.team1Counter++;
    } else {
      // Противник - лёгкий разброс фазы
      this.auraPhase = Cap.team2Counter * 0.3;
      Cap.team2Counter++;
    }

    this.skinData = getCapSkin(skinId) || CAP_SKINS[0];
    this.capClass = this.skinData.role;
    this.stats = { ...CAP_CLASSES[this.capClass] };
    this.baseRadius = this.stats.radius;

    const shouldApplyUpgrades = options?.applyUpgrades ?? true;

    if (options?.customUpgrades) {
      this.upgrades = { ...options.customUpgrades };
      this.applyUpgrades();
    } else if (shouldApplyUpgrades && owner === 1) {
      this.upgrades = playerData.getCapStats(skinId);
      this.applyUpgrades();
    } else {
      this.upgrades = { power: 1, mass: 1, aim: 1, technique: 1 };
    }

    this.applyRarityBonus();
    this.scaledRadius = this.stats.radius * scale;
    this.auraBaseScale = (this.scaledRadius * 2 * AURA.RADIUS_MULTIPLIER) / 128;

    this.sprite = scene.add.container(x, y).setDepth(60);
    
    this.createAura();
    this.createVisuals(x, y);
    this.createPhysicsBody(x, y);
    this.setupInteractivity();
  }

  get x(): number {
    return this.body.position.x;
  }

  get y(): number {
    return this.body.position.y;
  }

  // ========== Создание ауры ==========
  private createAura(): void {
    const teamColor = AURA.TEAM_COLORS[this.owner] ?? 0x00ffff;

    if (!this.scene.textures.exists('aura_glow')) {
      console.error('[Cap] Aura texture "aura_glow" not found!');
      return;
    }

    this.auraSprite = this.scene.add.image(0, 0, 'aura_glow');
    this.auraSprite.setScale(this.auraBaseScale * 1.2);
    this.auraSprite.setTint(teamColor);
    this.auraSprite.setAlpha(0.9);
    
    this.sprite.add(this.auraSprite);
    this.sprite.sendToBack(this.auraSprite);

    if (AURA.SELECTED_EXTRA_RING && this.scene.textures.exists('aura_selected_ring')) {
      this.auraSelectedRing = this.scene.add.image(0, 0, 'aura_selected_ring');
      this.auraSelectedRing.setScale(this.auraBaseScale);
      this.auraSelectedRing.setTint(0xffffff);
      this.auraSelectedRing.setAlpha(0);
      this.sprite.add(this.auraSelectedRing);
    }
  }

  // ========== Обновление ауры ==========
  updateAura(time: number, isActiveTeamTurn: boolean, isSelected: boolean): void {
    if (!this.auraSprite) return;
    
    this.isActiveTeamTurn = isActiveTeamTurn;
    this.isSelected = isSelected;

    const period = AURA.PULSE_PERIOD;
    
    // Сдвиг фазы между командами
    const teamPhaseOffset = this.owner === 2 ? AURA.PHASE_OFFSET_TEAM2 : 0;
    
    // Базовая амплитуда команды
    const baseAmplitude = this.owner === 1 ? AURA.AMPLITUDE_TEAM1 : AURA.AMPLITUDE_TEAM2;

    // Модификаторы от состояния хода
    let amplitudeMultiplier = 1.0;
    let speedMultiplier = 1.0;

    if (isActiveTeamTurn) {
      amplitudeMultiplier = AURA.ACTIVE_TURN_BOOST;
    } else {
      amplitudeMultiplier = AURA.INACTIVE_TURN_DAMPEN;
    }

    // Выбранная фишка
    if (isSelected) {
      speedMultiplier = AURA.SELECTED_SPEED_MULT;
      amplitudeMultiplier *= 1.3;
    }

    // Вычисляем фазу
    const adjustedPeriod = period / speedMultiplier;
    const phase = (time / adjustedPeriod) * Math.PI * 2 + this.auraPhase + teamPhaseOffset;
    const wave = Math.sin(phase);
    const normalized = (wave + 1) / 2; // 0..1

    // Применяем амплитуду
    const effectiveAmplitude = baseAmplitude * amplitudeMultiplier;
    const clampedAmplitude = Math.min(effectiveAmplitude, 1.5);

    // Вычисляем значения
    const alphaRange = AURA.ALPHA_MAX - AURA.ALPHA_MIN;
    const scaleRange = AURA.SCALE_MAX - AURA.SCALE_MIN;

    const alpha = AURA.ALPHA_MIN + alphaRange * normalized * clampedAmplitude;
    const scale = AURA.SCALE_MIN + scaleRange * normalized * clampedAmplitude;

    // Применяем
    this.auraSprite.setAlpha(Phaser.Math.Clamp(alpha, AURA.ALPHA_MIN, 1.0));
    this.auraSprite.setScale(this.auraBaseScale * scale * 1.2);

    // Дополнительное кольцо для выбранной фишки
    if (this.auraSelectedRing) {
      if (isSelected) {
        const ringWave = Math.sin(phase * 1.5);
        const ringAlpha = 0.5 + 0.5 * ((ringWave + 1) / 2);
        this.auraSelectedRing.setAlpha(ringAlpha);
        this.auraSelectedRing.setScale(this.auraBaseScale * scale * 1.1);
      } else {
        this.auraSelectedRing.setAlpha(0);
      }
    }
  }

  setSelected(selected: boolean): void {
    this.isSelected = selected;
  }

  setActiveTeamTurn(active: boolean): void {
    this.isActiveTeamTurn = active;
  }

  // Сброс счётчиков при начале новой игры
  static resetCounters(): void {
    Cap.team1Counter = 0;
    Cap.team2Counter = 0;
  }

  private applyUpgrades(): void {
    const { power, mass, aim, technique } = this.upgrades;

    const powerBonus = 1 + (power - 1) * 0.05;
    this.stats.forceMultiplier *= powerBonus;
    this.stats.maxForce *= powerBonus;

    const massBonus = 1 + (mass - 1) * 0.05;
    const restitutionPenalty = 1 - (mass - 1) * 0.02;
    this.stats.mass *= massBonus;
    this.stats.restitution = Math.max(0.2, this.stats.restitution * restitutionPenalty);

    const aimBonus = 1 + (aim - 1) * 0.1;
    this.stats.aimLineLength *= aimBonus;

    this.applyTechniqueBonus(technique);
  }

  private applyTechniqueBonus(level: number): void {
    const bonus = level - 1;

    switch (this.capClass) {
      case 'tank':
        this.stats.radius *= 1 + bonus * 0.02;
        break;
      case 'sniper':
        this.stats.frictionAir = Math.max(0.003, this.stats.frictionAir * (1 - bonus * 0.03));
        break;
      case 'trickster':
        this.stats.curveStrength *= 1 + bonus * 0.1;
        break;
      case 'balanced':
        const allBonus = 1 + bonus * 0.015;
        this.stats.forceMultiplier *= allBonus;
        this.stats.maxForce *= allBonus;
        this.stats.mass *= allBonus;
        break;
    }
  }

  private applyRarityBonus(): void {
    const rarityBonus = RARITY_STAT_BONUS[this.skinData.rarity] || 0;
    if (rarityBonus > 0) {
      const multiplier = 1 + rarityBonus / 100;
      this.stats.forceMultiplier *= multiplier;
      this.stats.maxForce *= multiplier;
    }
  }

  setLastHitOffset(offset: number): void {
    this.lastHitOffset = offset;
    this.lastShotTime = this.scene.time.now;
  }

  getLastHitOffset(): number {
    return this.lastHitOffset;
  }

  hasRecentShot(withinMs = 500): boolean {
    return this.scene.time.now - this.lastShotTime < withinMs;
  }

  getCurveStrength(): number {
    return this.stats.curveStrength;
  }

  canCurve(): boolean {
    return this.stats.canCurve && this.capClass === 'trickster';
  }

  calculateCurveForce(ballVelocity: { x: number; y: number }): { x: number; y: number } | null {
    if (!this.canCurve()) return null;
    if (!this.hasRecentShot()) return null;
    if (Math.abs(this.lastHitOffset) < 0.1) return null;

    const ballSpeed = Math.sqrt(ballVelocity.x * ballVelocity.x + ballVelocity.y * ballVelocity.y);
    if (ballSpeed < 1) return null;

    const perpX = -ballVelocity.y / ballSpeed;
    const perpY = ballVelocity.x / ballSpeed;
    const curveMagnitude = this.stats.curveStrength * this.lastHitOffset * ballSpeed * 0.15;

    this.lastHitOffset = 0;

    return { x: perpX * curveMagnitude, y: perpY * curveMagnitude };
  }

  private createVisuals(worldX: number, worldY: number): void {
    const { skinData: skin, scaledRadius: r, scene } = this;

    if (skin.visual.particleEffect) {
      this.createParticles(skin.visual.particleEffect);
    }

    const shadow = scene.add.ellipse(4, 4, r * 1.9, r * 1.6, 0x000000, 0.4);
    this.sprite.add(shadow);

    if (skin.visual.type === 'image' && skin.visual.imageKey) {
      this.createImageVisual(skin, worldX, worldY);
    } else if (skin.visual.type === 'sprite' && skin.visual.textureKey && scene.textures.exists(skin.visual.textureKey)) {
      this.createSpriteVisual(skin);
    } else {
      this.createGraphicsVisual(skin);
    }

    this.createClassIcon();
    this.createHighlightRing();
  }

  private createSpriteVisual(skin: CapSkinData): void {
    const scale = (this.scaledRadius * 2.05 / 128) * (skin.visual.scale || 1);
    this.visualSprite = this.scene.add.sprite(0, 0, skin.visual.textureKey!).setScale(scale);
    this.sprite.add(this.visualSprite);
    this.addRimHighlight();
  }

  private createImageVisual(skin: CapSkinData, worldX: number, worldY: number): void {
    const r = this.scaledRadius;

    const icon = createCapIcon(this.scene, skin, {
      radius: r,
      showRoleBadge: false,
      showShadow: false,
      showGlow: false,
    }, worldX, worldY);

    icon.setPosition(0, 0);
    
    this.imageContainer = this.createImageVisualManual(skin, worldX, worldY);
    this.sprite.add(this.imageContainer);
    
    icon.destroy();
  }

  private createImageVisualManual(skin: CapSkinData, worldX: number, worldY: number): Phaser.GameObjects.Container {
    const r = this.scaledRadius;
    const scene = this.scene;
    const container = scene.add.container(0, 0);

    const imageKey = skin.visual.imageKey!;
    if (!scene.textures.exists(imageKey)) {
      return container;
    }

    const borderColor = skin.visual.borderColor ?? skin.primaryColor;
    const borderWidth = skin.visual.borderWidth ?? 3;

    container.add(scene.add.circle(0, 0, r + borderWidth + 1, 0x000000, 0.35));
    container.add(scene.add.circle(0, 0, r + borderWidth, borderColor));
    container.add(scene.add.circle(0, 0, r, 0xffffff));

    const image = scene.add.image(0, 0, imageKey);
    const texture = scene.textures.get(imageKey);
    const frame = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const imgSize = Math.max(frame.width, frame.height);
    const targetSize = r * 2 * 0.9;
    image.setScale(targetSize / imgSize);
    container.add(image);

    const maskGraphics = scene.add.graphics();
    maskGraphics.fillStyle(0xffffff);
    maskGraphics.fillCircle(worldX, worldY, r);
    maskGraphics.setVisible(false);
    image.setMask(maskGraphics.createGeometryMask());

    (container as any)._maskGraphics = maskGraphics;
    (container as any)._maskRadius = r;

    const innerRing = scene.add.graphics();
    innerRing.lineStyle(1.2, 0xffffff, 0.35);
    innerRing.strokeCircle(0, 0, r * 0.9);
    container.add(innerRing);

    container.add(scene.add.ellipse(-r * 0.28, -r * 0.3, r * 0.55, r * 0.32, 0xffffff, 0.2));

    const topRing = scene.add.graphics();
    topRing.lineStyle(1.5, borderColor, 0.9);
    topRing.strokeCircle(0, 0, r);
    container.add(topRing);
    
    const rimRing = scene.add.graphics();
    rimRing.lineStyle(1, 0xffffff, 0.45);
    rimRing.strokeCircle(0, 0, r + borderWidth - 1);
    container.add(rimRing);

    return container;
  }

  private createGraphicsVisual(skin: CapSkinData): void {
    const g = this.scene.add.graphics();
    const r = this.scaledRadius;

    g.fillStyle(skin.primaryColor).fillCircle(0, 0, r);
    g.lineStyle(3, skin.secondaryColor).strokeCircle(0, 0, r);
    g.fillStyle(0xffffff, 0.2).fillEllipse(-r * 0.3, -r * 0.3, r * 0.4, r * 0.25);
    g.lineStyle(1, 0xffffff, 0.35);
    g.strokeCircle(0, 0, r - 2);

    this.sprite.add(g);
  }

  private addRimHighlight(): void {
    const g = this.scene.add.graphics();
    const r = this.scaledRadius;
    
    g.lineStyle(1.5, 0xffffff, 0.4);
    g.strokeCircle(0, 0, r - 1);
    
    this.sprite.add(g);
  }

  private createClassIcon(): void {
    const r = this.scaledRadius;
    const iconColor = this.skinData.visual.type === 'sprite' || this.skinData.visual.type === 'image'
      ? 0xffffff
      : getClassColor(this.capClass);

    this.classIconContainer = this.scene.add.container(r * 0.55, -r * 0.55);
    this.classIconContainer.add(this.scene.add.circle(0, 0, r * 0.28, 0x000000, 0.5));

    const icon = drawClassIcon(this.scene, 0, 0, this.capClass, r * 0.25, iconColor);
    icon.setAlpha(0.95);
    this.classIconContainer.add(icon);

    this.sprite.add(this.classIconContainer);
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
      follow: this.sprite,
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

    if (this.imageContainer) {
      const maskGraphics = (this.imageContainer as any)._maskGraphics as Phaser.GameObjects.Graphics;
      const maskRadius = (this.imageContainer as any)._maskRadius as number;
      if (maskGraphics && maskRadius) {
        maskGraphics.clear();
        maskGraphics.fillStyle(0xffffff);
        maskGraphics.fillCircle(x, y, maskRadius);
      }
    }

    if (this.visualSprite) {
      this.visualSprite.rotation = this.body.angle;
    }

    if (this.particleEmitter && this.skinData.visual.particleEffect?.followVelocity) {
      if (this.getSpeed() > 1.0) {
        this.particleEmitter.start();
      } else {
        this.particleEmitter.stop();
      }
    }

    this.updateAura(this.scene.time.now, this.isActiveTeamTurn, this.isSelected);
  }

  syncSpriteWithBody(): void {
    const { x, y } = this.body.position;
    this.sprite.setPosition(x, y);

    if (this.imageContainer) {
      const maskGraphics = (this.imageContainer as any)._maskGraphics as Phaser.GameObjects.Graphics;
      const maskRadius = (this.imageContainer as any)._maskRadius as number;
      if (maskGraphics && maskRadius) {
        maskGraphics.clear();
        maskGraphics.fillStyle(0xffffff);
        maskGraphics.fillCircle(x, y, maskRadius);
      }
    }

    if (this.visualSprite) {
      this.visualSprite.rotation = this.body.angle;
    }

    if (this.particleEmitter && this.skinData.visual.particleEffect?.followVelocity) {
      if (this.getSpeed() > 1.0) {
        this.particleEmitter.start();
      } else {
        this.particleEmitter.stop();
      }
    }

    this.updateAura(this.scene.time.now, this.isActiveTeamTurn, this.isSelected);
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

    if (this.imageContainer) {
      const maskGraphics = (this.imageContainer as any)._maskGraphics as Phaser.GameObjects.Graphics;
      const maskRadius = (this.imageContainer as any)._maskRadius as number;
      if (maskGraphics && maskRadius) {
        maskGraphics.clear();
        maskGraphics.fillStyle(0xffffff);
        maskGraphics.fillCircle(x, y, maskRadius);
      }
    }

    this.lastHitOffset = 0;
    this.lastShotTime = 0;
    this.isSelected = false;
  }

  applyForce(forceX: number, forceY: number): void {
    const maxForce = this.stats.maxForce * 2;
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

  getCapClass(): CapClass {
    return this.capClass;
  }

  getSkinId(): string {
    return this.skinId;
  }

  getUpgrades(): CapUpgrades {
    return { ...this.upgrades };
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
  playHitEffect(): void {
    // Если есть настроенный эффект частиц - создаём burst
    if (this.skinData.visual.particleEffect) {
      const config = this.skinData.visual.particleEffect;
      const { x, y } = this.body.position;
      
      if (!this.scene.textures.exists(config.texture)) return;
      
      const particles = this.scene.add.particles(x, y, config.texture, {
        speed: { min: config.speed * 0.5, max: config.speed },
        scale: config.scale,
        alpha: { start: 0.8, end: 0 },
        lifespan: config.lifespan,
        quantity: 8,
        tint: config.color,
        blendMode: config.blendMode,
        angle: { min: 0, max: 360 },
      });
      particles.setDepth(100);
      
      this.scene.time.delayedCall(config.lifespan + 100, () => particles.destroy());
    }
  }

  destroy(): void {
    this.highlightTween?.stop();
    this.particleEmitter?.destroy();
    
    if (this.auraSprite) {
      this.auraSprite.destroy();
    }
    
    if (this.auraSelectedRing) {
      this.auraSelectedRing.destroy();
    }

    if (this.imageContainer) {
      const maskGraphics = (this.imageContainer as any)._maskGraphics as Phaser.GameObjects.Graphics;
      maskGraphics?.destroy();
    }

    this.sprite.destroy();
    this.scene.matter.world.remove(this.body);
  }
}