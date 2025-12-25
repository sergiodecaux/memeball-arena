// src/entities/Unit.ts
// ФИНАЛЬНАЯ ВЕРСИЯ — СНАЙПЕР БЕЗ ОТСКОКОВ (ПУШКА!)

import Phaser from 'phaser';
import { 
  CAP_CLASSES, 
  COLLISION_CATEGORIES, 
  CapClass, 
  CapClassStats, 
  AURA,
  FACTIONS,
  FactionId,
  FactionConfig
} from '../constants/gameConstants';
import { PlayerNumber, CapUpgrades } from '../types';
import { playerData } from '../data/PlayerData';
import { getUnit } from '../data/UnitsCatalog';

export interface UnitOptions {
  factionId?: FactionId;
  applyFactionStats?: boolean;
  applyUpgrades?: boolean;
  customUpgrades?: CapUpgrades;
  capClass?: CapClass;
}

export class Unit {
  public body: MatterJS.BodyType;
  public sprite: Phaser.GameObjects.Container;
  public readonly owner: PlayerNumber;
  public readonly id: string;
  public readonly capClass: CapClass;
  public readonly factionId: FactionId;
  public readonly faction: FactionConfig;
  public stats: CapClassStats;

  private scene: Phaser.Scene;
  private scaledRadius: number;
  private baseRadius: number;
  private scale: number;
  private upgrades: CapUpgrades;

  private lastHitOffset = 0;
  private lastShotTime = 0;

  // === ВИЗУАЛЬНЫЕ КОМПОНЕНТЫ ===
  private shadowSprite?: Phaser.GameObjects.Arc;
  private glowRing?: Phaser.GameObjects.Image;
  private unitSprite?: Phaser.GameObjects.Image;
  private metalRing?: Phaser.GameObjects.Image;
  private subtleShine?: Phaser.GameObjects.Graphics;
  private highlightRing!: Phaser.GameObjects.Graphics;
  private highlightTween?: Phaser.Tweens.Tween;

  private auraSprite?: Phaser.GameObjects.Image;
  private auraSelectedRing?: Phaser.GameObjects.Image;
  private auraPhase: number;
  private auraBaseScale: number = 1;
  private isSelected: boolean = false;
  private isActiveTeamTurn: boolean = true;

  private wobblePhase: number = 0;

  // === УЛУЧШЕННЫЕ МАКСИМАЛЬНЫЕ СКОРОСТИ ===
  private static readonly MAX_SPEED: Record<CapClass, number> = {
    balanced: 26,
    tank: 19,
    sniper: 34,            // было 30 → ПУШКА!
    trickster: 30,         // было 26
  };

  private static team1Counter: number = 0;
  private static team2Counter: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    owner: PlayerNumber,
    id: string,
    scale = 1,
    options?: UnitOptions
  ) {
    this.scene = scene;
    this.owner = owner;
    this.id = id;
    this.scale = scale;

    const defaultFaction = playerData.getFaction() || 'cyborg';
    this.factionId = options?.factionId || defaultFaction;
    this.faction = FACTIONS[this.factionId];

    this.capClass = options?.capClass || 'balanced';
    this.stats = { ...CAP_CLASSES[this.capClass] };
    this.baseRadius = this.stats.radius;

    if (owner === 1) {
      this.auraPhase = 0;
      Unit.team1Counter++;
    } else {
      this.auraPhase = Unit.team2Counter * 0.3;
      Unit.team2Counter++;
    }

    this.wobblePhase = Math.random() * Math.PI * 2;

    if (options?.customUpgrades) {
      this.upgrades = { ...options.customUpgrades };
      if (options.applyUpgrades !== false) this.applyUpgrades();
    } else if (options?.applyUpgrades !== false && owner === 1) {
      this.upgrades = { power: 1, mass: 1, aim: 1, technique: 1 };
      this.applyUpgrades();
    } else {
      this.upgrades = { power: 1, mass: 1, aim: 1, technique: 1 };
    }

    if (options?.applyFactionStats !== false) {
      this.applyFactionStats();
    }

    this.scaledRadius = this.stats.radius * scale;
    this.auraBaseScale = (this.scaledRadius * 2 * AURA.RADIUS_MULTIPLIER) / 128;

    this.sprite = scene.add.container(x, y).setDepth(60);
    
    this.createVisuals();
    this.createAura();
    this.createPhysicsBody(x, y);
    this.setupInteractivity();
  }

  get x(): number { return this.body.position.x; }
  get y(): number { return this.body.position.y; }

  private applyFactionStats(): void {
    const f = this.faction.stats;
    this.stats.mass *= f.mass;
    this.stats.restitution = Phaser.Math.Clamp(this.stats.restitution * f.bounce, 0.1, 0.95);
    this.stats.forceMultiplier *= f.speed;
    this.stats.maxForce *= f.speed;
    if (f.control && this.capClass === 'trickster') {
      this.stats.curveStrength *= f.control;
    }
  }

  private applyUpgrades(): void {
    const { power, mass, aim, technique } = this.upgrades;
    this.stats.forceMultiplier *= 1 + (power - 1) * 0.05;
    this.stats.maxForce *= 1 + (power - 1) * 0.05;
    this.stats.mass *= 1 + (mass - 1) * 0.05;
    this.stats.restitution = Math.max(0.2, this.stats.restitution * (1 - (mass - 1) * 0.02));
    this.stats.aimLineLength *= 1 + (aim - 1) * 0.1;
    this.applyTechniqueBonus(technique);
  }

  private applyTechniqueBonus(level: number): void {
    const bonus = level - 1;
    switch (this.capClass) {
      case 'tank': this.stats.radius *= 1 + bonus * 0.02; break;
      case 'sniper': this.stats.frictionAir = Math.max(0.003, this.stats.frictionAir * (1 - bonus * 0.03)); break;
      case 'trickster': this.stats.curveStrength *= 1 + bonus * 0.1; break;
      case 'balanced': 
        const b = 1 + bonus * 0.015;
        this.stats.forceMultiplier *= b;
        this.stats.maxForce *= b;
        this.stats.mass *= b;
        break;
    }
  }

  // =============================================
  // ИДЕАЛЬНАЯ СЛОЁНАЯ СТРУКТУРА
  // =============================================
  private createVisuals(): void {
    const r = this.scaledRadius;

    // === СЛОЙ 1: ТЕНЬ НА ПОЛУ ===
    this.shadowSprite = this.scene.add.circle(4, 4, r * 0.85, 0x000000, 0.5);
    this.sprite.add(this.shadowSprite);

    // === СЛОЙ 2: КОЛЬЦЕВОЕ СВЕЧЕНИЕ (ЦВЕТНОЕ, ПОД ЮНИТОМ) ===
    if (!this.scene.textures.exists('unit_glow_ring')) {
      this.generateGlowRingTexture();
    }
    this.glowRing = this.scene.add.image(0, 0, 'unit_glow_ring');
    this.glowRing.setTint(this.faction.color);
    this.glowRing.setBlendMode(Phaser.BlendModes.ADD);
    this.glowRing.setAlpha(0.5);
    this.glowRing.setScale((r * 2.1) / 128);
    this.sprite.add(this.glowRing);

    // === СЛОЙ 3: ЧЁРНАЯ ПОДЛОЖКА ===
    const blackBase = this.scene.add.circle(0, 0, r, 0x000000, 0.7);
    this.sprite.add(blackBase);

    // === СЛОЙ 4: ОСНОВНОЙ ЮНИТ (ПИКСЕЛЬ-АРТ) ===
    const unitData = this.getUnitData();
    if (unitData && this.scene.textures.exists(unitData.assetKey)) {
      this.unitSprite = this.scene.add.image(0, 0, unitData.assetKey);
      this.unitSprite.setScale(r * 2 / 256);
      this.unitSprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.sprite.add(this.unitSprite);
    } else {
      this.createFallbackVisual();
    }

    // === СЛОЙ 5: МЕТАЛЛИЧЕСКОЕ КОЛЬЦО (СТАЛЬНОЕ!) ===
    this.metalRing = this.scene.add.image(0, 0, 'metal_ring');
    this.metalRing.setScale((r * 2.1) / 256);
    this.sprite.add(this.metalRing);

    // === СЛОЙ 6: ТОНКИЙ БЛИК ===
    this.subtleShine = this.scene.add.graphics();
    this.subtleShine.fillStyle(0xffffff, 0.08);
    this.subtleShine.fillEllipse(-r * 0.25, -r * 0.3, r * 0.5, r * 0.35);
    this.subtleShine.setBlendMode(Phaser.BlendModes.ADD);
    this.sprite.add(this.subtleShine);

    // === СЛОЙ 7: ИКОНКА КЛАССА ===
    this.createClassIndicator();

    // === СЛОЙ 8: КОЛЬЦО ВЫДЕЛЕНИЯ ===
    this.createHighlightRing();
  }

  private generateGlowRingTexture(): void {
    const size = 128;
    const canvas = this.scene.textures.createCanvas('unit_glow_ring', size, size);
    const ctx = canvas.getContext();
    
    const grad = ctx.createRadialGradient(64, 64, 30, 64, 64, 64);
    grad.addColorStop(0, '#00000000');
    grad.addColorStop(0.65, '#00000000');
    grad.addColorStop(0.75, '#ffffff44');
    grad.addColorStop(0.85, '#ffffff88');
    grad.addColorStop(0.95, '#ffffff44');
    grad.addColorStop(1, '#ffffff00');
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }

  private getUnitData() {
    const classMap: Record<CapClass, string> = {
      balanced: this.getBalancedUnitName(),
      tank: this.getTankUnitName(),
      sniper: this.getSniperUnitName(),
      trickster: this.getTricksterUnitName(),
    };
    const unitId = `${this.factionId}_${classMap[this.capClass]}`;
    return getUnit(unitId);
  }

  private getBalancedUnitName(): string { 
    const m: Record<FactionId, string> = {magma:'grunt', cyborg:'soldier', void:'initiate', insect:'drone'}; 
    return m[this.factionId]; 
  }
  
  private getTankUnitName(): string { 
    const m: Record<FactionId, string> = {magma:'titan', cyborg:'mech', void:'guardian', insect:'brood'}; 
    return m[this.factionId]; 
  }
  
  private getSniperUnitName(): string { 
    const m: Record<FactionId, string> = {magma:'scout', cyborg:'drone', void:'sniper', insect:'spitter'}; 
    return m[this.factionId]; 
  }
  
  private getTricksterUnitName(): string { 
    const m: Record<FactionId, string> = {magma:'inferno', cyborg:'glitch', void:'bender', insect:'mimic'}; 
    return m[this.factionId]; 
  }

  private createFallbackVisual(): void {
    const r = this.scaledRadius;
    const g = this.scene.add.graphics();
    g.fillStyle(this.faction.color, 1);
    g.fillCircle(0, 0, r);
    g.fillStyle(this.faction.colorSecondary, 0.5);
    g.fillCircle(0, 0, r * 0.7);
    this.sprite.add(g);
  }

  private createClassIndicator(): void {
    const r = this.scaledRadius;
    const container = this.scene.add.container(r * 0.6, -r * 0.6);
    
    const bg = this.scene.add.circle(0, 0, r * 0.24, 0x000000, 0.85);
    const bgRing = this.scene.add.circle(0, 0, r * 0.24, 0xffffff, 0).setStrokeStyle(1.5, 0xffffff, 0.6);
    container.add([bg, bgRing]);
    
    const symbols: Record<CapClass, string> = { balanced: '⚖', tank: '🛡', sniper: '🎯', trickster: '🌀' };
    const symbol = this.scene.add.text(0, 0, symbols[this.capClass], { 
      fontSize: `${r * 0.3}px`,
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(symbol);
    
    this.sprite.add(container);
  }

  private createHighlightRing(): void {
    this.highlightRing = this.scene.add.graphics();
    this.highlightRing.lineStyle(5, 0xffff00, 0.95);
    this.highlightRing.strokeCircle(0, 0, this.scaledRadius + 10);
    this.highlightRing.setVisible(false);
    this.sprite.add(this.highlightRing);
  }

  private createAura(): void {
    if (!this.scene.textures.exists('aura_glow')) return;

    this.auraSprite = this.scene.add.image(0, 0, 'aura_glow');
    this.auraSprite.setScale(this.auraBaseScale * 1.4);
    this.auraSprite.setTint(this.faction.color);
    this.auraSprite.setAlpha(0.7);
    this.auraSprite.setBlendMode(Phaser.BlendModes.ADD);
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

  updateAura(time: number, isActiveTeamTurn: boolean, isSelected: boolean): void {
    if (!this.auraSprite) return;
    
    this.isActiveTeamTurn = isActiveTeamTurn;
    this.isSelected = isSelected;

    const period = AURA.PULSE_PERIOD;
    const teamPhaseOffset = this.owner === 2 ? AURA.PHASE_OFFSET_TEAM2 : 0;
    const baseAmplitude = this.owner === 1 ? AURA.AMPLITUDE_TEAM1 : AURA.AMPLITUDE_TEAM2;

    let amplitudeMultiplier = isActiveTeamTurn ? AURA.ACTIVE_TURN_BOOST : AURA.INACTIVE_TURN_DAMPEN;
    if (isSelected) amplitudeMultiplier *= 1.4;

    const phase = (time / period) * Math.PI * 2 + this.auraPhase + teamPhaseOffset;
    const wave = Math.sin(phase);
    const normalized = (wave + 1) / 2;
    const effectiveAmplitude = Math.min(baseAmplitude * amplitudeMultiplier, 1.5);

    const alpha = AURA.ALPHA_MIN + (AURA.ALPHA_MAX - AURA.ALPHA_MIN) * normalized * effectiveAmplitude;
    const scale = AURA.SCALE_MIN + (AURA.SCALE_MAX - AURA.SCALE_MIN) * normalized * effectiveAmplitude;

    this.auraSprite.setAlpha(Phaser.Math.Clamp(alpha * 0.7, AURA.ALPHA_MIN * 0.7, 0.85));
    this.auraSprite.setScale(this.auraBaseScale * scale * 1.4);

    if (this.auraSelectedRing) {
      this.auraSelectedRing.setAlpha(isSelected ? 0.6 + 0.4 * normalized : 0);
      this.auraSelectedRing.setScale(this.auraBaseScale * scale * 1.2);
    }
  }

  update(): void {
    this.limitSpeed();

    const { x, y } = this.body.position;
    this.sprite.setPosition(x, y);

    const speed = this.getSpeed();

    if (this.unitSprite && speed > 0.1) {
      const wobble = Math.sin((this.scene.time.now / 2000) * Math.PI * 2 + this.wobblePhase) * Phaser.Math.DegToRad(10);
      this.unitSprite.rotation = wobble;
    } else if (this.unitSprite) {
      this.unitSprite.rotation = Phaser.Math.Linear(this.unitSprite.rotation, 0, 0.15);
    }

    this.updateAura(this.scene.time.now, this.isActiveTeamTurn, this.isSelected);
  }

  syncSpriteWithBody(): void {
    this.sprite.setPosition(this.body.position.x, this.body.position.y);
    this.update();
  }

  // === ⭐⭐⭐ ИДЕАЛЬНАЯ ФИЗИКА ДЛЯ СНАЙПЕРА (БЕЗ ОТСКОКОВ!) ⭐⭐⭐ ===
  private createPhysicsBody(x: number, y: number): void {
    this.body = this.scene.matter.add.circle(x, y, this.scaledRadius, {
      label: `unit_${this.factionId}_${this.capClass}_p${this.owner}`,
      slop: 0.01,              // было 0.02 → ВДВОЕ меньше проваливания!
      collisionFilter: {
        category: COLLISION_CATEGORIES.CAP,
        mask: COLLISION_CATEGORIES.WALL | COLLISION_CATEGORIES.CAP | COLLISION_CATEGORIES.BALL,
      },
    });

    // Устанавливаем массу жёстко
    this.scene.matter.body.setMass(this.body, this.stats.mass);

    // Базовый материал
    this.scene.matter.body.set(this.body, {
      restitution: this.stats.restitution,
      friction: this.stats.friction,
      frictionAir: this.stats.frictionAir,
      frictionStatic: 0.1,
    });

    // === ⭐ СПЕЦИАЛЬНАЯ НАСТРОЙКА ДЛЯ СНАЙПЕРА (АБСОЛЮТНАЯ ПУШКА БЕЗ ОТСКОКОВ!) ===
    if (this.capClass === 'sniper') {
      this.scene.matter.body.set(this.body, {
        restitution: 0.42,        // было 0.68 → почти НЕ отскакивает от мяча!
        frictionAir: 0.012,       // было 0.006 → останавливается за 1.5 сек
        frictionStatic: 0.08,     // было 0.05 → НЕ скользит после удара
      });
      
      console.log(`[Unit] 🎯 Sniper ${this.id} configured as HEAVY CANNON (mass: ${this.stats.mass.toFixed(2)}, restitution: 0.42, frictionAir: 0.012, slop: 0.01)`);
    }

    // === ⭐ НАСТРОЙКА ДЛЯ ТРИКСТЕРА (КРИВЫЕ) ===
    if (this.capClass === 'trickster') {
      this.scene.matter.body.set(this.body, {
        frictionStatic: 0.06,
      });
      
      console.log(`[Unit] 🌀 Trickster ${this.id} configured (curveStrength: ${this.stats.curveStrength.toFixed(2)})`);
    }

    // Фиксируем инерцию (не вращаются)
    this.scene.matter.body.setInertia(this.body, Infinity);
  }

  private setupInteractivity(): void {
    this.sprite.setInteractive(new Phaser.Geom.Circle(0, 0, this.scaledRadius), Phaser.Geom.Circle.Contains);
  }

  playHitEffect(): void {
    const effect = this.faction.particleEffect;
    const { x, y } = this.body.position;

    let textureKey = effect.texture;
    if (!this.scene.textures.exists(textureKey)) textureKey = 'p_glow';

    const particles = this.scene.add.particles(x, y, textureKey, {
      speed: { min: effect.speed * 0.5, max: effect.speed },
      scale: effect.scale,
      alpha: { start: 0.9, end: 0 },
      lifespan: effect.lifespan,
      quantity: 12,
      tint: effect.colors,
      blendMode: 'ADD',
      angle: { min: 0, max: 360 },
    });
    particles.setDepth(100);
    this.scene.time.delayedCall(effect.lifespan + 100, () => particles.destroy());
  }

  setLastHitOffset(offset: number): void { this.lastHitOffset = offset; this.lastShotTime = this.scene.time.now; }
  getLastHitOffset(): number { return this.lastHitOffset; }
  hasRecentShot(withinMs = 500): boolean { return this.scene.time.now - this.lastShotTime < withinMs; }
  getCurveStrength(): number { return this.stats.curveStrength; }
  canCurve(): boolean { return this.stats.canCurve && this.capClass === 'trickster'; }

  calculateCurveForce(ballVelocity: { x: number; y: number }): { x: number; y: number } | null {
    if (!this.canCurve() || !this.hasRecentShot() || Math.abs(this.lastHitOffset) < 0.1) return null;
    const ballSpeed = Math.sqrt(ballVelocity.x ** 2 + ballVelocity.y ** 2);
    if (ballSpeed < 1) return null;
    const perpX = -ballVelocity.y / ballSpeed;
    const perpY = ballVelocity.x / ballSpeed;
    const curveMagnitude = this.stats.curveStrength * this.lastHitOffset * ballSpeed * 0.15;
    this.lastHitOffset = 0;
    return { x: perpX * curveMagnitude, y: perpY * curveMagnitude };
  }

  private limitSpeed(): void {
    const speed = this.getSpeed();
    const maxSpeed = Unit.MAX_SPEED[this.capClass];
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

  isStopped(threshold = 0.1): boolean { return this.getSpeed() < threshold; }

  reset(x: number, y: number): void {
    this.scene.matter.body.setPosition(this.body, { x, y });
    this.scene.matter.body.setVelocity(this.body, { x: 0, y: 0 });
    this.scene.matter.body.setAngularVelocity(this.body, 0);
    this.sprite.setPosition(x, y);
    this.lastHitOffset = 0;
    this.lastShotTime = 0;
    this.isSelected = false;
  }

  applyForce(forceX: number, forceY: number): void {
    const maxForce = this.stats.maxForce * 2;
    const forceMag = Math.sqrt(forceX * forceX + forceY * forceY);
    if (forceMag > maxForce) {
      const scale = maxForce / forceMag;
      forceX *= scale; forceY *= scale;
    }
    this.scene.matter.body.applyForce(this.body, this.body.position, { x: forceX, y: forceY });
    this.playHitEffect();
  }

  calculateShotForce(dragDistance: number, direction: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const force = Math.min(dragDistance * this.stats.forceMultiplier, this.stats.maxForce);
    return new Phaser.Math.Vector2(-direction.x * force, -direction.y * force);
  }

  getAimLineLength(): number { return this.stats.aimLineLength; }
  getRadius(): number { return this.scaledRadius; }
  getCapClass(): CapClass { return this.capClass; }
  getFactionId(): FactionId { return this.factionId; }
  getUpgrades(): CapUpgrades { return { ...this.upgrades }; }

  highlight(enabled: boolean): void {
    this.highlightRing.setVisible(enabled);
    if (enabled) {
      this.highlightTween = this.scene.tweens.add({
        targets: this.highlightRing,
        alpha: { from: 0.7, to: 1 },
        duration: 450,
        yoyo: true,
        repeat: -1,
      });
    } else {
      this.highlightTween?.stop();
      this.highlightRing.setAlpha(1);
    }
  }

  setSelected(selected: boolean): void { this.isSelected = selected; }
  setActiveTeamTurn(active: boolean): void { this.isActiveTeamTurn = active; }

  destroy(): void {
    this.highlightTween?.stop();
    this.auraSprite?.destroy();
    this.auraSelectedRing?.destroy();
    this.glowRing?.destroy();
    this.shadowSprite?.destroy();
    this.metalRing?.destroy();
    this.subtleShine?.destroy();
    this.unitSprite?.destroy();
    this.sprite.destroy();
    this.scene.matter.world.remove(this.body);
  }

  static resetCounters(): void {
    Unit.team1Counter = 0;
    Unit.team2Counter = 0;
  }
}