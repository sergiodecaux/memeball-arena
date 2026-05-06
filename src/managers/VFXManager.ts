// ✅ ИЗМЕНЕНО: VFXManager v3.0 — Enhanced Shield/Swap Effects + Liquid Lava

import Phaser from 'phaser';
import { FactionId, FACTIONS } from '../constants/gameConstants';
import { 
  eventBus, 
  GameEvents,
  VFXHitEffectPayload,
  VFXTeleportEffectPayload,
  VFXShieldHitPayload,
  VFXLavaSpawnPayload,
  VFXToxinPayload,
  VFXStatusPayload,
  VFXWallHitPayload,
  CollisionBallUnitPayload,
  CollisionBallWallPayload,
} from '../core/EventBus';

// ============================================================
// ТИПЫ ДЛЯ ЭФФЕКТОВ СПОСОБНОСТЕЙ
// ============================================================

export interface LavaPoolEffect {
  container: Phaser.GameObjects.Container;
  emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  graphics: Phaser.GameObjects.Graphics;
  time: number;
  radius: number;
  vertices: { angle: number; offset: number; speed: number }[];
  update: (delta: number) => void;
  destroy: () => void;
}

export interface EnergyShieldEffect {
  graphics: Phaser.GameObjects.Graphics;
  update: (x: number, y: number) => void;
  destroy: () => void;
}

export interface GhostPhaseEffect {
  trail: Phaser.GameObjects.Particles.ParticleEmitter;
  update: (x: number, y: number) => void;
  destroy: () => void;
}

export interface TetherEffect {
  graphics: Phaser.GameObjects.Graphics;
  update: (unitX: number, unitY: number, ballX: number, ballY: number) => void;
  destroy: () => void;
}

export interface BarrierEffect {
  graphics: Phaser.GameObjects.Graphics;
  glowTween: Phaser.Tweens.Tween;
  destroy: () => void;
}

export interface CraterEffect {
  container: Phaser.GameObjects.Container;
  destroy: () => void;
}

export interface WormholeEffect {
  portalA: Phaser.GameObjects.Container;
  portalB: Phaser.GameObjects.Container;
  update: () => void;
  destroy: () => void;
}

export interface MimicBallEffect {
  sprite: Phaser.GameObjects.Arc;
  glowEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  destroy: () => void;
}

// ✅ ДОБАВЛЕНО: Void Swap Trail Effect
export interface VoidSwapTrailEffect {
  graphics: Phaser.GameObjects.Graphics;
  destroy: () => void;
}

export type StatusEffectType = 'stun' | 'shield' | 'toxin' | 'lava' | 'ghost' | 'tether' | 'parasite';

export class VFXManager {
  private scene: Phaser.Scene;
  
  // Particle Emitters
  private sparksEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private smokeEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private ringEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

  // Активные эффекты способностей (для обновления в update)
  private activeLavaPools: LavaPoolEffect[] = [];
  private activeShields: Map<string, EnergyShieldEffect> = new Map();
  private activeGhosts: Map<string, GhostPhaseEffect> = new Map();
  private activeTethers: Map<string, TetherEffect> = new Map();
  private activeBarriers: BarrierEffect[] = [];
  private activeWormholes: WormholeEffect[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.generateTextures();
    this.createEmitters();
    this.subscribeToEvents();
  }

  // ============================================================
  // EVENT SUBSCRIPTIONS
  // ============================================================

  private subscribeToEvents(): void {
    eventBus.subscribe(GameEvents.VFX_HIT_EFFECT, this.onHitEffectRequested, this);
    eventBus.subscribe(GameEvents.VFX_TELEPORT_EFFECT, this.onTeleportEffectRequested, this);
    eventBus.subscribe(GameEvents.VFX_SHIELD_HIT_EFFECT, this.onShieldHitRequested, this);
    eventBus.subscribe(GameEvents.VFX_LAVA_SPAWN_EFFECT, this.onLavaSpawnRequested, this);
    eventBus.subscribe(GameEvents.VFX_TOXIN_EFFECT, this.onToxinEffectRequested, this);
    eventBus.subscribe(GameEvents.VFX_STATUS_EFFECT, this.onStatusEffectRequested, this);
    eventBus.subscribe(GameEvents.VFX_WALL_HIT, this.onWallHitRequested, this);
    eventBus.subscribe(GameEvents.COLLISION_BALL_UNIT, this.onBallUnitCollision, this);
    eventBus.subscribe(GameEvents.COLLISION_BALL_WALL, this.onBallWallCollision, this);
  }

  private unsubscribeFromEvents(): void {
    eventBus.unsubscribe(GameEvents.VFX_HIT_EFFECT, this.onHitEffectRequested, this);
    eventBus.unsubscribe(GameEvents.VFX_TELEPORT_EFFECT, this.onTeleportEffectRequested, this);
    eventBus.unsubscribe(GameEvents.VFX_SHIELD_HIT_EFFECT, this.onShieldHitRequested, this);
    eventBus.unsubscribe(GameEvents.VFX_LAVA_SPAWN_EFFECT, this.onLavaSpawnRequested, this);
    eventBus.unsubscribe(GameEvents.VFX_TOXIN_EFFECT, this.onToxinEffectRequested, this);
    eventBus.unsubscribe(GameEvents.VFX_STATUS_EFFECT, this.onStatusEffectRequested, this);
    eventBus.unsubscribe(GameEvents.VFX_WALL_HIT, this.onWallHitRequested, this);
    eventBus.unsubscribe(GameEvents.COLLISION_BALL_UNIT, this.onBallUnitCollision, this);
    eventBus.unsubscribe(GameEvents.COLLISION_BALL_WALL, this.onBallWallCollision, this);
  }

  // ============================================================
  // EVENT HANDLERS
  // ============================================================

  private onHitEffectRequested(payload: VFXHitEffectPayload): void {
    this.playHitEffect(payload.x, payload.y, payload.factionId, payload.intensity);
  }

  private onTeleportEffectRequested(payload: VFXTeleportEffectPayload): void {
    this.playTeleportEffect(payload.x, payload.y, payload.color);
  }

  private onShieldHitRequested(payload: VFXShieldHitPayload): void {
    this.playShieldHitEffect(payload.x, payload.y, payload.angle);
  }

  private onLavaSpawnRequested(payload: VFXLavaSpawnPayload): void {
    this.playLavaSpawnEffect(payload.x, payload.y, payload.radius);
  }

  private onToxinEffectRequested(payload: VFXToxinPayload): void {
    this.playToxinEffect(payload.x, payload.y);
  }

  private onStatusEffectRequested(payload: VFXStatusPayload): void {
    this.playStatusEffect(payload.x, payload.y, payload.type as StatusEffectType);
  }

  private onWallHitRequested(payload: VFXWallHitPayload): void {
    this.playWallHit(payload.x, payload.y, payload.intensity);
  }

  private onBallUnitCollision(payload: CollisionBallUnitPayload): void {
    // Защита от undefined
    if (!payload || !payload.position) {
      console.warn('[VFXManager] onBallUnitCollision: invalid payload', payload);
      return;
    }
    
    this.playHitEffect(
      payload.position.x,
      payload.position.y,
      payload.factionId || 'magma',  // fallback если factionId отсутствует
      payload.impactForce || 10
    );
  }

  private onBallWallCollision(payload: CollisionBallWallPayload): void {
    this.playWallHit(payload.position.x, payload.position.y, payload.impactForce);
  }

  // ============================================================
  // TEXTURE GENERATION
  // ============================================================

  private generateTextures(): void {
    // 1. Soft Glow Particle
    if (!this.scene.textures.exists('vfx_soft_glow')) {
      const canvas = this.scene.textures.createCanvas('vfx_soft_glow', 64, 64);
      const ctx = canvas!.getContext();
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.5)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      canvas!.refresh();
    }

    // 2. Spark
    if (!this.scene.textures.exists('vfx_spark')) {
      const canvas = this.scene.textures.createCanvas('vfx_spark', 32, 32);
      const ctx = canvas!.getContext();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.quadraticCurveTo(18, 14, 32, 16);
      ctx.quadraticCurveTo(18, 18, 16, 32);
      ctx.quadraticCurveTo(14, 18, 0, 16);
      ctx.quadraticCurveTo(14, 14, 16, 0);
      ctx.fill();
      canvas!.refresh();
    }

    // 3. Shockwave Ring
    if (!this.scene.textures.exists('vfx_ring')) {
      const canvas = this.scene.textures.createCanvas('vfx_ring', 128, 128);
      const ctx = canvas!.getContext();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(64, 64, 60, 0, Math.PI * 2);
      ctx.stroke();
      canvas!.refresh();
    }

    // 4. Teleport particle
    if (!this.scene.textures.exists('vfx_teleport')) {
      const canvas = this.scene.textures.createCanvas('vfx_teleport', 32, 32);
      const ctx = canvas!.getContext();
      const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(157, 0, 255, 1)');
      grad.addColorStop(0.5, 'rgba(157, 0, 255, 0.5)');
      grad.addColorStop(1, 'rgba(157, 0, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
      canvas!.refresh();
    }

    // 5. Lava bubble
    if (!this.scene.textures.exists('vfx_lava_bubble')) {
      const canvas = this.scene.textures.createCanvas('vfx_lava_bubble', 16, 16);
      const ctx = canvas!.getContext();
      const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, 'rgba(255, 200, 50, 1)');
      grad.addColorStop(0.5, 'rgba(255, 69, 0, 0.8)');
      grad.addColorStop(1, 'rgba(255, 69, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 16, 16);
      canvas!.refresh();
    }

    // 6. Toxin drip
    if (!this.scene.textures.exists('vfx_toxin')) {
      const canvas = this.scene.textures.createCanvas('vfx_toxin', 16, 16);
      const ctx = canvas!.getContext();
      const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, 'rgba(57, 255, 20, 1)');
      grad.addColorStop(0.5, 'rgba(57, 255, 20, 0.6)');
      grad.addColorStop(1, 'rgba(57, 255, 20, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 16, 16);
      canvas!.refresh();
    }

    // 7. Ghost trail particle
    if (!this.scene.textures.exists('vfx_ghost_trail')) {
      const canvas = this.scene.textures.createCanvas('vfx_ghost_trail', 24, 24);
      const ctx = canvas!.getContext();
      const grad = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
      grad.addColorStop(0, 'rgba(138, 43, 226, 0.8)');
      grad.addColorStop(0.5, 'rgba(138, 43, 226, 0.3)');
      grad.addColorStop(1, 'rgba(138, 43, 226, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 24, 24);
      canvas!.refresh();
    }

    // 8. Lightning segment
    if (!this.scene.textures.exists('vfx_lightning')) {
      const canvas = this.scene.textures.createCanvas('vfx_lightning', 8, 32);
      const ctx = canvas!.getContext();
      const grad = ctx.createLinearGradient(0, 0, 8, 0);
      grad.addColorStop(0, 'rgba(0, 200, 255, 0)');
      grad.addColorStop(0.5, 'rgba(0, 200, 255, 1)');
      grad.addColorStop(1, 'rgba(0, 200, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 8, 32);
      canvas!.refresh();
    }

    // 9. Portal swirl particle
    if (!this.scene.textures.exists('vfx_portal')) {
      const canvas = this.scene.textures.createCanvas('vfx_portal', 16, 16);
      const ctx = canvas!.getContext();
      const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, 'rgba(128, 0, 255, 1)');
      grad.addColorStop(0.6, 'rgba(75, 0, 130, 0.6)');
      grad.addColorStop(1, 'rgba(75, 0, 130, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 16, 16);
      canvas!.refresh();
    }

    // 10. Meteor fire particle
    if (!this.scene.textures.exists('vfx_meteor_fire')) {
      const canvas = this.scene.textures.createCanvas('vfx_meteor_fire', 24, 24);
      const ctx = canvas!.getContext();
      const grad = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
      grad.addColorStop(0, 'rgba(255, 255, 200, 1)');
      grad.addColorStop(0.3, 'rgba(255, 150, 0, 0.9)');
      grad.addColorStop(0.7, 'rgba(255, 50, 0, 0.5)');
      grad.addColorStop(1, 'rgba(100, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 24, 24);
      canvas!.refresh();
    }

    // 11. Smoke particle
    if (!this.scene.textures.exists('vfx_smoke')) {
      const canvas = this.scene.textures.createCanvas('vfx_smoke', 32, 32);
      const ctx = canvas!.getContext();
      const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(80, 80, 80, 0.6)');
      grad.addColorStop(0.5, 'rgba(50, 50, 50, 0.3)');
      grad.addColorStop(1, 'rgba(30, 30, 30, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
      canvas!.refresh();
    }

    // 🔥 12. Electric arc particle (для Void Swap)
    if (!this.scene.textures.exists('vfx_electric_arc')) {
      const canvas = this.scene.textures.createCanvas('vfx_electric_arc', 16, 16);
      const ctx = canvas!.getContext();
      const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, 'rgba(157, 0, 255, 1)');
      grad.addColorStop(0.3, 'rgba(200, 100, 255, 0.8)');
      grad.addColorStop(1, 'rgba(157, 0, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 16, 16);
      canvas!.refresh();
    }

    // 🔥 13. Shield impact arc
    if (!this.scene.textures.exists('vfx_shield_arc')) {
      const canvas = this.scene.textures.createCanvas('vfx_shield_arc', 64, 32);
      const ctx = canvas!.getContext();
      const grad = ctx.createLinearGradient(0, 16, 64, 16);
      grad.addColorStop(0, 'rgba(0, 242, 255, 0)');
      grad.addColorStop(0.2, 'rgba(0, 242, 255, 0.8)');
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.8, 'rgba(0, 242, 255, 0.8)');
      grad.addColorStop(1, 'rgba(0, 242, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(32, 48, 40, Math.PI * 1.2, Math.PI * 1.8, false);
      ctx.arc(32, 48, 35, Math.PI * 1.8, Math.PI * 1.2, true);
      ctx.fill();
      canvas!.refresh();
    }
  }

  // ============================================================
  // EMITTER CREATION
  // ============================================================

  private createEmitters(): void {
    // SPARKS
    this.sparksEmitter = this.scene.add.particles(0, 0, 'vfx_spark', {
      lifespan: { min: 200, max: 400 },
      speed: { min: 150, max: 350 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 },
      blendMode: 'ADD',
      emitting: false
    }).setDepth(100);

    // SMOKE
    this.smokeEmitter = this.scene.add.particles(0, 0, 'vfx_soft_glow', {
      lifespan: { min: 500, max: 800 },
      speed: { min: 20, max: 60 },
      scale: { start: 0.5, end: 1.5 },
      alpha: { start: 0.4, end: 0 },
      blendMode: 'SCREEN',
      emitting: false
    }).setDepth(99);

    // RING
    this.ringEmitter = this.scene.add.particles(0, 0, 'vfx_ring', {
      lifespan: 300,
      scale: { start: 0.2, end: 2.5 },
      alpha: { start: 0.8, end: 0 },
      blendMode: 'ADD',
      emitting: false
    }).setDepth(98);
  }

  // ============================================================
  // ОСНОВНЫЕ ЭФФЕКТЫ
  // ============================================================

  public playHitEffect(x: number, y: number, factionId: FactionId, intensity: number): void {
    const faction = FACTIONS[factionId];
    const color = faction.color;
    
    const power = Phaser.Math.Clamp(intensity / 10, 0.5, 2.0);

    // 1. Sparks
    this.sparksEmitter.explode(Math.floor(10 * power), x, y);
    this.sparksEmitter.setParticleTint(color);

    // 2. Ring
    this.ringEmitter.explode(1, x, y);
    this.ringEmitter.setParticleTint(color);
    
    // 3. Smoke for heavy hits
    if (power > 1.0) {
      this.smokeEmitter.explode(5, x, y);
      this.smokeEmitter.setParticleTint(faction.colorSecondary);
    }

    // 4. Screen Shake
    if (power > 0.8) {
      const shakeInt = 0.005 * power;
      this.scene.cameras.main.shake(100, shakeInt);
    }

    // 5. Hit Stop
    if (power > 1.2) {
      this.triggerHitStop(20 + power * 10);
    }

    // 6. Chromatic Aberration
    if (power > 1.5) {
      this.triggerChromaticAberration(x, y, 64 * power);
    }
  }

  public playWallHit(x: number, y: number, intensity: number): void {
    this.sparksEmitter.setParticleTint(0xffffff);
    this.sparksEmitter.explode(Math.floor(5 * intensity), x, y);
    
    if (intensity > 1) {
       this.scene.cameras.main.shake(50, 0.002);
    }
  }

  public playTeleportEffect(x: number, y: number, color: number): void {
    // 1. Flash
    const flash = this.scene.add.circle(x, y, 50, color, 0.8);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    flash.setDepth(150);

    this.scene.tweens.add({
      targets: flash,
      scale: { from: 0.3, to: 2 },
      alpha: { from: 0.8, to: 0 },
      duration: 300,
      ease: 'Cubic.easeOut',
      onComplete: () => flash.destroy(),
    });

    // 2. Expanding ring
    const ring = this.scene.add.graphics();
    ring.setPosition(x, y);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    ring.setDepth(149);

    const ringAnim = { radius: 10, alpha: 1 };
    this.scene.tweens.add({
      targets: ringAnim,
      radius: 80,
      alpha: 0,
      duration: 400,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        ring.clear();
        ring.lineStyle(3, color, ringAnim.alpha);
        ring.strokeCircle(0, 0, ringAnim.radius);
      },
      onComplete: () => ring.destroy(),
    });

    // 3. Particles
    const particles = this.scene.add.particles(x, y, 'vfx_teleport', {
      speed: { min: 50, max: 150 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 400,
      quantity: 20,
      tint: color,
      blendMode: 'ADD',
      angle: { min: 0, max: 360 },
    });
    particles.setDepth(148);
    
    this.scene.time.delayedCall(500, () => particles.destroy());

    // 4. Screen shake
    this.scene.cameras.main.shake(80, 0.004);
  }

  // ============================================================
  // 🔥 ENHANCED: Shield Hit Effect с дугой и направленными искрами
  // ============================================================

  public playShieldHitEffect(x: number, y: number, angle: number, shieldColor?: number): void {
    const color = shieldColor || FACTIONS.cyborg.color;

    // 1. Impact flash в точке удара
    const impact = this.scene.add.circle(x, y, 25, color, 1);
    impact.setBlendMode(Phaser.BlendModes.ADD);
    impact.setDepth(150);

    this.scene.tweens.add({
      targets: impact,
      scale: 2.5,
      alpha: 0,
      duration: 180,
      onComplete: () => impact.destroy(),
    });

    // 2. 🔥 ДУГА (Arc) в точке удара — рисуем полукруг в направлении отражения
    const arcGraphics = this.scene.add.graphics();
    arcGraphics.setPosition(x, y);
    arcGraphics.setBlendMode(Phaser.BlendModes.ADD);
    arcGraphics.setDepth(151);

    const arcAnim = { scale: 0.3, alpha: 1 };
    const arcRadius = 40;
    
    this.scene.tweens.add({
      targets: arcAnim,
      scale: 1.5,
      alpha: 0,
      duration: 250,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        arcGraphics.clear();
        
        // Внешняя дуга (свечение)
        arcGraphics.lineStyle(8 * arcAnim.scale, color, arcAnim.alpha * 0.4);
        arcGraphics.beginPath();
        arcGraphics.arc(0, 0, arcRadius * arcAnim.scale, angle - Math.PI * 0.4, angle + Math.PI * 0.4, false);
        arcGraphics.strokePath();
        
        // Основная дуга
        arcGraphics.lineStyle(4 * arcAnim.scale, 0xffffff, arcAnim.alpha);
        arcGraphics.beginPath();
        arcGraphics.arc(0, 0, arcRadius * arcAnim.scale, angle - Math.PI * 0.35, angle + Math.PI * 0.35, false);
        arcGraphics.strokePath();
        
        // Внутренняя яркая дуга
        arcGraphics.lineStyle(2 * arcAnim.scale, color, arcAnim.alpha);
        arcGraphics.beginPath();
        arcGraphics.arc(0, 0, arcRadius * arcAnim.scale * 0.7, angle - Math.PI * 0.3, angle + Math.PI * 0.3, false);
        arcGraphics.strokePath();
      },
      onComplete: () => arcGraphics.destroy(),
    });

    // 3. 🔥 Направленный взрыв искр (в направлении отскока)
    for (let i = 0; i < 12; i++) {
      const sparkAngle = angle + (Math.random() - 0.5) * 1.2; // Разброс ±0.6 радиан
      const sparkSpeed = 80 + Math.random() * 120;
      const sparkSize = 3 + Math.random() * 4;
      
      const spark = this.scene.add.circle(x, y, sparkSize, color, 1);
      spark.setBlendMode(Phaser.BlendModes.ADD);
      spark.setDepth(149);

      const endX = x + Math.cos(sparkAngle) * sparkSpeed;
      const endY = y + Math.sin(sparkAngle) * sparkSpeed;

      this.scene.tweens.add({
        targets: spark,
        x: endX,
        y: endY,
        alpha: 0,
        scale: 0,
        duration: 150 + Math.random() * 150,
        ease: 'Cubic.easeOut',
        onComplete: () => spark.destroy(),
      });
    }

    // 4. Electric arcs (молнии от точки удара)
    const lightning = this.scene.add.graphics();
    lightning.setDepth(148);

    for (let i = 0; i < 4; i++) {
      const boltAngle = angle + (Math.random() - 0.5) * 1.5;
      
      lightning.lineStyle(2, color, 0.9);
      lightning.beginPath();
      lightning.moveTo(x, y);
      
      const segments = 5;
      let lastX = x;
      let lastY = y;
      
      for (let j = 1; j <= segments; j++) {
        const t = j / segments;
        const dist = 50 * t;
        const jitterX = (Math.random() - 0.5) * 20;
        const jitterY = (Math.random() - 0.5) * 20;
        
        const nx = x + Math.cos(boltAngle) * dist + jitterX;
        const ny = y + Math.sin(boltAngle) * dist + jitterY;
        lightning.lineTo(nx, ny);
        lastX = nx;
        lastY = ny;
      }
      
      lightning.strokePath();
    }

    this.scene.tweens.add({
      targets: lightning,
      alpha: 0,
      duration: 120,
      onComplete: () => lightning.destroy(),
    });

    // 5. Hexagonal ripple (гексагональная рябь — футуристичный стиль)
    const hexRipple = this.scene.add.graphics();
    hexRipple.setPosition(x, y);
    hexRipple.setBlendMode(Phaser.BlendModes.ADD);
    hexRipple.setDepth(147);

    const hexAnim = { radius: 10, alpha: 0.8 };
    this.scene.tweens.add({
      targets: hexAnim,
      radius: 60,
      alpha: 0,
      duration: 300,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        hexRipple.clear();
        hexRipple.lineStyle(2, color, hexAnim.alpha);
        hexRipple.beginPath();
        
        // Рисуем шестиугольник
        for (let i = 0; i <= 6; i++) {
          const hexAngle = (i / 6) * Math.PI * 2 - Math.PI / 6;
          const hx = Math.cos(hexAngle) * hexAnim.radius;
          const hy = Math.sin(hexAngle) * hexAnim.radius;
          if (i === 0) {
            hexRipple.moveTo(hx, hy);
          } else {
            hexRipple.lineTo(hx, hy);
          }
        }
        hexRipple.strokePath();
      },
      onComplete: () => hexRipple.destroy(),
    });

    // 6. Sound
    try {
      (window as any).AudioManager?.getInstance?.()?.playSFX?.('sfx_shield_hit');
    } catch {}

    // 7. Small screen shake
    this.scene.cameras.main.shake(60, 0.003);
  }

  // ============================================================
  // 🔥 NEW: Void Swap Trail — электрическая линия между точками
  // ============================================================

  public playVoidSwapTrail(x1: number, y1: number, x2: number, y2: number, color?: number): VoidSwapTrailEffect {
    const trailColor = color || FACTIONS.void.color;
    
    const graphics = this.scene.add.graphics();
    graphics.setDepth(155);

    // Параметры анимации
    const duration = 400;
    const segments = 12;
    
    // Начальные вспышки в обеих точках
    this.playTeleportEffect(x1, y1, trailColor);
    this.playTeleportEffect(x2, y2, trailColor);

    // Анимация молнии между точками
    let elapsed = 0;
    const updateInterval = 25; // мс между обновлениями

    const drawLightning = () => {
      graphics.clear();
      
      const progress = elapsed / duration;
      const alpha = 1 - progress;
      
      if (alpha <= 0) {
        return;
      }

      const dx = x2 - x1;
      const dy = y2 - y1;

      // Основная молния (толстая, с glow)
      graphics.lineStyle(6, trailColor, alpha * 0.3);
      graphics.beginPath();
      graphics.moveTo(x1, y1);

      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const baseX = x1 + dx * t;
        const baseY = y1 + dy * t;
        
        // Амплитуда уменьшается к концам
        const amplitude = Math.sin(t * Math.PI) * 25 * (1 - progress * 0.5);
        const jitterX = (Math.random() - 0.5) * amplitude;
        const jitterY = (Math.random() - 0.5) * amplitude;
        
        graphics.lineTo(baseX + jitterX, baseY + jitterY);
      }
      graphics.lineTo(x2, y2);
      graphics.strokePath();

      // Тонкая яркая линия по центру
      graphics.lineStyle(2, 0xffffff, alpha * 0.9);
      graphics.beginPath();
      graphics.moveTo(x1, y1);

      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const baseX = x1 + dx * t;
        const baseY = y1 + dy * t;
        
        const amplitude = Math.sin(t * Math.PI) * 15 * (1 - progress * 0.5);
        const jitterX = (Math.random() - 0.5) * amplitude;
        const jitterY = (Math.random() - 0.5) * amplitude;
        
        graphics.lineTo(baseX + jitterX, baseY + jitterY);
      }
      graphics.lineTo(x2, y2);
      graphics.strokePath();

      // Ответвления молнии
      if (Math.random() > 0.3) {
        const branchT = 0.3 + Math.random() * 0.4;
        const branchX = x1 + dx * branchT;
        const branchY = y1 + dy * branchT;
        const branchAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * Math.PI;
        const branchLength = 20 + Math.random() * 30;

        graphics.lineStyle(1.5, trailColor, alpha * 0.7);
        graphics.beginPath();
        graphics.moveTo(branchX, branchY);
        
        let bx = branchX;
        let by = branchY;
        for (let j = 0; j < 3; j++) {
          const t = (j + 1) / 3;
          bx += Math.cos(branchAngle) * (branchLength / 3) + (Math.random() - 0.5) * 10;
          by += Math.sin(branchAngle) * (branchLength / 3) + (Math.random() - 0.5) * 10;
          graphics.lineTo(bx, by);
        }
        graphics.strokePath();
      }
    };

    // Таймер обновления
    const timer = this.scene.time.addEvent({
      delay: updateInterval,
      callback: () => {
        elapsed += updateInterval;
        if (elapsed >= duration) {
          timer.destroy();
          graphics.destroy();
        } else {
          drawLightning();
        }
      },
      loop: true,
    });

    // Первая отрисовка
    drawLightning();

    // Частицы вдоль линии
    const particleCount = 10;
    for (let i = 0; i < particleCount; i++) {
      const t = i / particleCount;
      const px = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 20;
      const py = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 20;
      
      const particle = this.scene.add.circle(px, py, 3 + Math.random() * 3, trailColor, 0.8);
      particle.setBlendMode(Phaser.BlendModes.ADD);
      particle.setDepth(154);

      const targetX = px + (Math.random() - 0.5) * 40;
      const targetY = py + (Math.random() - 0.5) * 40;

      this.scene.tweens.add({
        targets: particle,
        x: targetX,
        y: targetY,
        alpha: 0,
        scale: 0,
        duration: 300 + Math.random() * 200,
        delay: i * 30,
        onComplete: () => particle.destroy(),
      });
    }

    // Screen shake
    this.scene.cameras.main.shake(100, 0.005);

    return {
      graphics,
      destroy: () => {
        timer.destroy();
        graphics.destroy();
      },
    };
  }
  // ✅ Алиас для совместимости с AbilityManager
  public playSwapTrailEffect(x1: number, y1: number, x2: number, y2: number, color?: number): VoidSwapTrailEffect {
    return this.playVoidSwapTrail(x1, y1, x2, y2, color);
  }
  public playToxinEffect(x: number, y: number): void {
    const color = FACTIONS.insect.color;

    // 1. Poison cloud
    const cloud = this.scene.add.circle(x, y, 40, color, 0.5);
    cloud.setBlendMode(Phaser.BlendModes.ADD);
    cloud.setDepth(150);

    this.scene.tweens.add({
      targets: cloud,
      scale: 2,
      alpha: 0,
      duration: 500,
      ease: 'Cubic.easeOut',
      onComplete: () => cloud.destroy(),
    });

    // 2. Toxin drops
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const drop = this.scene.add.circle(x, y, 5, color, 0.9);
      drop.setBlendMode(Phaser.BlendModes.ADD);
      drop.setDepth(149);

      this.scene.tweens.add({
        targets: drop,
        x: x + Math.cos(angle) * (40 + Math.random() * 20),
        y: y + Math.sin(angle) * (40 + Math.random() * 20),
        alpha: 0,
        scale: 0.3,
        duration: 400 + Math.random() * 200,
        ease: 'Cubic.easeOut',
        onComplete: () => drop.destroy(),
      });
    }

    // 3. Screen shake
    this.scene.cameras.main.shake(100, 0.006);
  }

  public playLavaSpawnEffect(x: number, y: number, radius: number): void {
    const color = FACTIONS.magma.color;

    // 1. Expanding fire ring
    const ring = this.scene.add.graphics();
    ring.setPosition(x, y);
    ring.setDepth(10);

    const ringAnim = { radius: 5, alpha: 1 };
    this.scene.tweens.add({
      targets: ringAnim,
      radius: radius,
      alpha: 0.8,
      duration: 300,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        ring.clear();
        ring.fillStyle(color, ringAnim.alpha * 0.3);
        ring.fillCircle(0, 0, ringAnim.radius);
        ring.lineStyle(3, 0xffaa00, ringAnim.alpha);
        ring.strokeCircle(0, 0, ringAnim.radius);
      },
      onComplete: () => ring.destroy(),
    });

    // 2. Lava splashes
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
      const splash = this.scene.add.circle(x, y, 6, 0xffaa00, 1);
      splash.setDepth(11);

      const dist = radius * 0.8 + Math.random() * 20;
      
      this.scene.tweens.add({
        targets: splash,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist - 20,
        duration: 300,
        ease: 'Cubic.easeOut',
      });

      this.scene.tweens.add({
        targets: splash,
        y: y + Math.sin(angle) * dist + 10,
        alpha: 0,
        scale: 0.3,
        duration: 200,
        delay: 300,
        ease: 'Cubic.easeIn',
        onComplete: () => splash.destroy(),
      });
    }

    // 3. Screen shake
    this.scene.cameras.main.shake(60, 0.003);
  }

  public playStatusEffect(x: number, y: number, type: StatusEffectType): void {
    const icons: Record<StatusEffectType, string> = {
      stun: '⚡',
      shield: '🛡️',
      toxin: '☣️',
      lava: '🔥',
      ghost: '👻',
      tether: '🔗',
      parasite: '🧠',
    };

    const icon = this.scene.add.text(x, y - 50, icons[type] || '✦', {
      fontSize: '32px',
    }).setOrigin(0.5);
    icon.setDepth(200);

    this.scene.tweens.add({
      targets: icon,
      y: y - 80,
      alpha: 0,
      scale: 1.5,
      duration: 600,
      ease: 'Cubic.easeOut',
      onComplete: () => icon.destroy(),
    });
  }

  // ============================================================
  // 🌋 LIQUID LAVA POOL — Vertex Animation (жидкие края)
  // ============================================================

  public createLavaPool(x: number, y: number, radius: number, duration: number): LavaPoolEffect {
    const container = this.scene.add.container(x, y).setDepth(5);

    // Создаём вершины для анимации жидких краёв
    const vertexCount = 16;
    const vertices: { angle: number; offset: number; speed: number }[] = [];
    
    for (let i = 0; i < vertexCount; i++) {
      vertices.push({
        angle: (i / vertexCount) * Math.PI * 2,
        offset: Math.random() * Math.PI * 2, // Фаза синусоиды
        speed: 0.8 + Math.random() * 0.8, // Скорость колебания
      });
    }

    // Graphics для жидкой лавы
    const lavaGraphics = this.scene.add.graphics();
    container.add(lavaGraphics);

    // Партикл-эмиттер — оранжевые пузырьки
    const emitter = this.scene.add.particles(x, y, 'vfx_lava_bubble', {
      lifespan: { min: 600, max: 1200 },
      speed: { min: 10, max: 30 },
      angle: { min: 250, max: 290 },
      scale: { start: 0.8, end: 0.2 },
      alpha: { start: 0.9, end: 0 },
      frequency: 80,
      quantity: 2,
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Circle(0, 0, radius * 0.8),
      },
      blendMode: 'ADD',
    }).setDepth(6);

    // Периодические искры
    const sparksTimer = this.scene.time.addEvent({
      delay: 300,
      callback: () => {
        const sparkX = x + (Math.random() - 0.5) * radius * 1.5;
        const sparkY = y + (Math.random() - 0.5) * radius * 1.5;
        this.sparksEmitter.setParticleTint(0xffaa00);
        this.sparksEmitter.explode(2, sparkX, sparkY);
      },
      loop: true,
    });

    let time = 0;

    const drawLiquidLava = () => {
      lavaGraphics.clear();

      // === СЛОЙ 1: Внешнее свечение (Glow) ===
      const glowPoints: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < vertexCount; i++) {
        const v = vertices[i];
        const wobble = Math.sin(time * v.speed + v.offset) * 8;
        const r = radius + 15 + wobble;
        glowPoints.push(new Phaser.Math.Vector2(
          Math.cos(v.angle) * r,
          Math.sin(v.angle) * r
        ));
      }
      
      lavaGraphics.fillStyle(0xff4500, 0.25);
      lavaGraphics.beginPath();
      lavaGraphics.moveTo(glowPoints[0].x, glowPoints[0].y);
      for (let i = 1; i < glowPoints.length; i++) {
        // Сглаживание через bezier
        const prev = glowPoints[i - 1];
        const curr = glowPoints[i];
        const next = glowPoints[(i + 1) % glowPoints.length];
        const cpX = curr.x;
        const cpY = curr.y;
        lavaGraphics.lineTo(cpX, cpY);
      }
      lavaGraphics.closePath();
      lavaGraphics.fillPath();

      // === СЛОЙ 2: Основная масса (Solid) ===
      const mainPoints: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < vertexCount; i++) {
        const v = vertices[i];
        const wobble = Math.sin(time * v.speed + v.offset) * 5;
        const r = radius + wobble;
        mainPoints.push(new Phaser.Math.Vector2(
          Math.cos(v.angle) * r,
          Math.sin(v.angle) * r
        ));
      }

      lavaGraphics.fillStyle(0xff4500, 0.7);
      lavaGraphics.beginPath();
      lavaGraphics.moveTo(mainPoints[0].x, mainPoints[0].y);
      for (let i = 1; i <= mainPoints.length; i++) {
        const curr = mainPoints[i % mainPoints.length];
        lavaGraphics.lineTo(curr.x, curr.y);
      }
      lavaGraphics.closePath();
      lavaGraphics.fillPath();

      // === СЛОЙ 3: Яркое ядро (Core) ===
      const corePoints: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < vertexCount; i++) {
        const v = vertices[i];
        const wobble = Math.sin(time * v.speed * 1.5 + v.offset + Math.PI) * 3;
        const r = radius * 0.55 + wobble;
        corePoints.push(new Phaser.Math.Vector2(
          Math.cos(v.angle) * r,
          Math.sin(v.angle) * r
        ));
      }

      lavaGraphics.fillStyle(0xffaa00, 0.9);
      lavaGraphics.beginPath();
      lavaGraphics.moveTo(corePoints[0].x, corePoints[0].y);
      for (let i = 1; i <= corePoints.length; i++) {
        const curr = corePoints[i % corePoints.length];
        lavaGraphics.lineTo(curr.x, curr.y);
      }
      lavaGraphics.closePath();
      lavaGraphics.fillPath();

      // === Яркое свечение в центре ===
      const centerGlow = Math.sin(time * 2) * 0.15 + 0.85;
      lavaGraphics.fillStyle(0xffcc00, centerGlow * 0.6);
      lavaGraphics.fillCircle(0, 0, radius * 0.25);
    };

    // Анимация появления
    container.setScale(0);
    container.setAlpha(0);
    this.scene.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });

    // Автоматическое уничтожение через duration
    const destroyTimer = this.scene.time.delayedCall(duration, () => {
      effect.destroy();
    });

    const effect: LavaPoolEffect = {
      container,
      emitter,
      graphics: lavaGraphics,
      time: 0,
      radius,
      vertices,
      update: (delta: number) => {
        time += delta * 0.001; // Преобразуем в секунды
        effect.time = time;
        drawLiquidLava();
      },
      destroy: () => {
        destroyTimer.destroy();
        sparksTimer.destroy();
        
        // Анимация исчезновения
        this.scene.tweens.add({
          targets: container,
          scale: 0,
          alpha: 0,
          duration: 300,
          ease: 'Back.easeIn',
          onComplete: () => {
            emitter.destroy();
            container.destroy();
          },
        });
        
        const idx = this.activeLavaPools.indexOf(effect);
        if (idx !== -1) this.activeLavaPools.splice(idx, 1);
      },
    };

    // Первая отрисовка
    drawLiquidLava();

    this.activeLavaPools.push(effect);
    return effect;
  }

  // ============================================================
  // ☄️ METEOR STRIKE — Тряска камеры + взрыв частиц + кратер
  // ============================================================

  public playMeteorStrike(x: number, y: number, craterRadius: number): CraterEffect {
    // 1. Предупреждающий индикатор (тень падающего метеора)
    const shadow = this.scene.add.ellipse(x, y, craterRadius * 2.5, craterRadius * 1.2, 0x000000, 0.3);
    shadow.setDepth(4);
    shadow.setScale(0.3);

    this.scene.tweens.add({
      targets: shadow,
      scale: 1,
      alpha: 0.6,
      duration: 500,
      ease: 'Cubic.easeIn',
      onComplete: () => shadow.destroy(),
    });

    // 2. Падение метеора (после задержки)
    this.scene.time.delayedCall(500, () => {
      // Сильная тряска камеры
      this.scene.cameras.main.shake(300, 0.02);

      // Вспышка
      const flash = this.scene.add.circle(x, y, craterRadius * 3, 0xffffff, 1);
      flash.setBlendMode(Phaser.BlendModes.ADD).setDepth(200);
      this.scene.tweens.add({
        targets: flash,
        alpha: 0,
        scale: 2,
        duration: 200,
        onComplete: () => flash.destroy(),
      });

      // Взрыв огненных частиц
      const fireExplosion = this.scene.add.particles(x, y, 'vfx_meteor_fire', {
        speed: { min: 100, max: 300 },
        angle: { min: 0, max: 360 },
        scale: { start: 1.5, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: { min: 400, max: 800 },
        quantity: 30,
        blendMode: 'ADD',
      }).setDepth(150);

      this.scene.time.delayedCall(100, () => fireExplosion.stop());
      this.scene.time.delayedCall(1000, () => fireExplosion.destroy());

      // Дым
      const smokeExplosion = this.scene.add.particles(x, y, 'vfx_smoke', {
        speed: { min: 30, max: 80 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.5, end: 2 },
        alpha: { start: 0.7, end: 0 },
        lifespan: { min: 800, max: 1500 },
        quantity: 15,
        blendMode: 'SCREEN',
      }).setDepth(149);

      this.scene.time.delayedCall(200, () => smokeExplosion.stop());
      this.scene.time.delayedCall(2000, () => smokeExplosion.destroy());

      // Ударная волна
      this.ringEmitter.setParticleTint(0xff4500);
      this.ringEmitter.explode(2, x, y);
    });

    // 3. Создание кратера (Fade In)
    const craterContainer = this.scene.add.container(x, y).setDepth(3);
    craterContainer.setAlpha(0);

    // Внешний край кратера
    const craterOuter = this.scene.add.graphics();
    craterOuter.fillStyle(0x2a1a0a, 0.9);
    craterOuter.fillCircle(0, 0, craterRadius);
    craterContainer.add(craterOuter);

    // Внутренняя часть (темнее)
    const craterInner = this.scene.add.graphics();
    craterInner.fillStyle(0x1a0a00, 0.95);
    craterInner.fillCircle(0, 0, craterRadius * 0.7);
    craterContainer.add(craterInner);

    // Трещины
    const cracks = this.scene.add.graphics();
    cracks.lineStyle(2, 0xff4500, 0.6);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      cracks.moveTo(0, 0);
      const endX = Math.cos(angle) * craterRadius * 1.3;
      const endY = Math.sin(angle) * craterRadius * 1.3;
      cracks.lineTo(endX * 0.5, endY * 0.5);
      cracks.lineTo(endX * 0.5 + (Math.random() - 0.5) * 10, endY * 0.5 + (Math.random() - 0.5) * 10);
      cracks.lineTo(endX, endY);
    }
    cracks.strokePath();
    craterContainer.add(cracks);

    // Fade In кратера
    this.scene.time.delayedCall(600, () => {
      this.scene.tweens.add({
        targets: craterContainer,
        alpha: 1,
        duration: 300,
        ease: 'Cubic.easeOut',
      });
    });

    const effect: CraterEffect = {
      container: craterContainer,
      destroy: () => {
        this.scene.tweens.add({
          targets: craterContainer,
          alpha: 0,
          duration: 500,
          onComplete: () => craterContainer.destroy(),
        });
      },
    };

    return effect;
  }

  // ============================================================
  // 🛡️ ENERGY SHIELD — Вращающийся полупрозрачный круг
  // ============================================================

  public createEnergyShield(unitId: string, x: number, y: number, radius: number): EnergyShieldEffect {
    const color = FACTIONS.cyborg.color;

    const graphics = this.scene.add.graphics();
    graphics.setDepth(50);

    let angle = 0;
    let pulseAlpha = 0.5;

    const updateShield = (newX: number, newY: number) => {
      graphics.clear();
      graphics.setPosition(newX, newY);

      // Основной круг
      graphics.lineStyle(3, color, pulseAlpha);
      graphics.strokeCircle(0, 0, radius);

      // Внутреннее свечение
      graphics.fillStyle(color, pulseAlpha * 0.2);
      graphics.fillCircle(0, 0, radius);

      // Вращающиеся сегменты
      for (let i = 0; i < 4; i++) {
        const segAngle = angle + (i * Math.PI / 2);
        const arcStart = segAngle - 0.3;
        const arcEnd = segAngle + 0.3;
        
        graphics.lineStyle(4, 0x00ffff, pulseAlpha * 0.8);
        graphics.beginPath();
        graphics.arc(0, 0, radius - 3, arcStart, arcEnd, false);
        graphics.strokePath();
      }

      angle += 0.05;
    };

    // Пульсация
    this.scene.tweens.add({
      targets: { alpha: pulseAlpha },
      alpha: 0.8,
      duration: 500,
      yoyo: true,
      repeat: -1,
      onUpdate: (tween) => {
        pulseAlpha = tween.getValue();
      },
    });

    updateShield(x, y);

    const effect: EnergyShieldEffect = {
      graphics,
      update: (newX: number, newY: number) => updateShield(newX, newY),
      destroy: () => {
        graphics.destroy();
        this.activeShields.delete(unitId);
      },
    };

    this.activeShields.set(unitId, effect);
    return effect;
  }

  // ============================================================
  // 👻 GHOST PHASE — Alpha 0.5 + шлейф частиц
  // ============================================================

  public createGhostPhase(unitId: string, x: number, y: number): GhostPhaseEffect {
    const color = FACTIONS.void.color;

    // Шлейф частиц
    const trail = this.scene.add.particles(x, y, 'vfx_ghost_trail', {
      speed: { min: 5, max: 20 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 400,
      frequency: 30,
      quantity: 2,
      blendMode: 'ADD',
      tint: color,
    }).setDepth(45);

    const effect: GhostPhaseEffect = {
      trail,
      update: (newX: number, newY: number) => {
        trail.setPosition(newX, newY);
      },
      destroy: () => {
        trail.stop();
        this.scene.time.delayedCall(500, () => trail.destroy());
        this.activeGhosts.delete(unitId);
      },
    };

    this.activeGhosts.set(unitId, effect);
    return effect;
  }

  // ============================================================
  // ⚡ MAGNETIC TETHER — Линия молнии между юнитом и мячом
  // ============================================================

  public createTether(unitId: string): TetherEffect {
    const graphics = this.scene.add.graphics();
    graphics.setDepth(55);

    let flickerTime = 0;

    const updateTether = (unitX: number, unitY: number, ballX: number, ballY: number) => {
      graphics.clear();
      flickerTime += 0.2;

      const segments = 8;
      const dx = ballX - unitX;
      const dy = ballY - unitY;

      // Основная линия молнии
      graphics.lineStyle(3, 0x00d4ff, 0.8 + Math.sin(flickerTime) * 0.2);
      graphics.beginPath();
      graphics.moveTo(unitX, unitY);

      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const midX = unitX + dx * t + (Math.random() - 0.5) * 15;
        const midY = unitY + dy * t + (Math.random() - 0.5) * 15;
        graphics.lineTo(midX, midY);
      }

      graphics.lineTo(ballX, ballY);
      graphics.strokePath();

      // Свечение
      graphics.lineStyle(8, 0x00d4ff, 0.2);
      graphics.beginPath();
      graphics.moveTo(unitX, unitY);
      graphics.lineTo(ballX, ballY);
      graphics.strokePath();

      // Искры на концах
      if (Math.random() > 0.7) {
        this.sparksEmitter.setParticleTint(0x00d4ff);
        this.sparksEmitter.explode(1, ballX, ballY);
      }
    };

    const effect: TetherEffect = {
      graphics,
      update: updateTether,
      destroy: () => {
        graphics.destroy();
        this.activeTethers.delete(unitId);
      },
    };

    this.activeTethers.set(unitId, effect);
    return effect;
  }

  // ============================================================
  // 🧱 PHOTON BARRIER — Неоновая светящаяся стена
  // ============================================================

  public createPhotonBarrier(x1: number, y1: number, x2: number, y2: number): BarrierEffect {
    const graphics = this.scene.add.graphics();
    graphics.setDepth(40);

    let glowIntensity = 0.8;

    const drawBarrier = () => {
      graphics.clear();

      // Внешнее свечение
      graphics.lineStyle(12, 0x00ffff, glowIntensity * 0.3);
      graphics.lineBetween(x1, y1, x2, y2);

      // Среднее свечение
      graphics.lineStyle(6, 0x00d4ff, glowIntensity * 0.6);
      graphics.lineBetween(x1, y1, x2, y2);

      // Основная линия
      graphics.lineStyle(3, 0xffffff, glowIntensity);
      graphics.lineBetween(x1, y1, x2, y2);

      // Концевые точки
      graphics.fillStyle(0x00ffff, glowIntensity);
      graphics.fillCircle(x1, y1, 6);
      graphics.fillCircle(x2, y2, 6);
    };

    drawBarrier();

    // Пульсация
    const glowTween = this.scene.tweens.add({
      targets: { intensity: glowIntensity },
      intensity: 1,
      duration: 300,
      yoyo: true,
      repeat: -1,
      onUpdate: (tween) => {
        glowIntensity = tween.getValue();
        drawBarrier();
      },
    });

    // Периодические искры вдоль барьера
    const sparkTimer = this.scene.time.addEvent({
      delay: 200,
      callback: () => {
        const t = Math.random();
        const sparkX = x1 + (x2 - x1) * t;
        const sparkY = y1 + (y2 - y1) * t;
        this.sparksEmitter.setParticleTint(0x00ffff);
        this.sparksEmitter.explode(2, sparkX, sparkY);
      },
      loop: true,
    });

    const effect: BarrierEffect = {
      graphics,
      glowTween,
      destroy: () => {
        sparkTimer.destroy();
        glowTween.stop();
        
        // Анимация исчезновения
        this.scene.tweens.add({
          targets: graphics,
          alpha: 0,
          duration: 300,
          onComplete: () => graphics.destroy(),
        });

        const idx = this.activeBarriers.indexOf(effect);
        if (idx !== -1) this.activeBarriers.splice(idx, 1);
      },
    };

    this.activeBarriers.push(effect);
    return effect;
  }

  // ============================================================
  // 🌀 WORMHOLE — Два телепорт-портала
  // ============================================================

  public createWormhole(x1: number, y1: number, x2: number, y2: number): WormholeEffect {
    const createPortal = (x: number, y: number, isEntry: boolean): Phaser.GameObjects.Container => {
      const container = this.scene.add.container(x, y).setDepth(35);
      const color = isEntry ? 0x8b00ff : 0x4b0082;

      // Вращающиеся кольца
      for (let i = 0; i < 3; i++) {
        const ring = this.scene.add.graphics();
        ring.lineStyle(3 - i, color, 0.8 - i * 0.2);
        ring.strokeCircle(0, 0, 30 + i * 8);
        container.add(ring);

        this.scene.tweens.add({
          targets: ring,
          angle: isEntry ? 360 : -360,
          duration: 2000 + i * 500,
          repeat: -1,
        });
      }

      // Центральное ядро
      const core = this.scene.add.circle(0, 0, 15, 0x000000, 0.9);
      container.add(core);

      const coreGlow = this.scene.add.circle(0, 0, 20, color, 0.5);
      coreGlow.setBlendMode(Phaser.BlendModes.ADD);
      container.add(coreGlow);

      this.scene.tweens.add({
        targets: coreGlow,
        scale: 1.3,
        alpha: 0.3,
        duration: 800,
        yoyo: true,
        repeat: -1,
      });

      // Частицы засасывания/выброса
      const particles = this.scene.add.particles(0, 0, 'vfx_portal', {
        speed: isEntry ? { min: -50, max: -20 } : { min: 20, max: 50 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.6, end: 0 },
        alpha: { start: 0.8, end: 0 },
        lifespan: 600,
        frequency: 100,
        quantity: 1,
        emitZone: {
          type: 'edge',
          source: new Phaser.Geom.Circle(0, 0, 40),
          quantity: 16,
        },
        blendMode: 'ADD',
      });
      container.add(particles);

      return container;
    };

    const portalA = createPortal(x1, y1, true);
    const portalB = createPortal(x2, y2, false);

    // Связывающая линия между порталами
    const connectionLine = this.scene.add.graphics();
    connectionLine.setDepth(34);
    
    let lineAlpha = 0;
    this.scene.tweens.add({
      targets: { alpha: lineAlpha },
      alpha: 0.3,
      duration: 500,
      yoyo: true,
      repeat: -1,
      onUpdate: (tween) => {
        lineAlpha = tween.getValue();
        connectionLine.clear();
        connectionLine.lineStyle(2, 0x8b00ff, lineAlpha);
        connectionLine.lineBetween(x1, y1, x2, y2);
      },
    });

    const effect: WormholeEffect = {
      portalA,
      portalB,
      update: () => {
        // Можно добавить динамическое поведение
      },
      destroy: () => {
        this.scene.tweens.add({
          targets: [portalA, portalB, connectionLine],
          alpha: 0,
          scale: 0,
          duration: 500,
          onComplete: () => {
            portalA.destroy();
            portalB.destroy();
            connectionLine.destroy();
          },
        });

        const idx = this.activeWormholes.indexOf(effect);
        if (idx !== -1) this.activeWormholes.splice(idx, 1);
      },
    };

    this.activeWormholes.push(effect);
    return effect;
  }

  // ============================================================
  // 🎾 MIMIC BALL — Фейковый мяч с мерцающим свечением
  // ============================================================

  public createMimicBall(x: number, y: number, radius: number): MimicBallEffect {
    const color = FACTIONS.insect.color;

    // Фейковый мяч
    const sprite = this.scene.add.circle(x, y, radius, 0xffffff, 0.9);
    sprite.setStrokeStyle(2, color);
    sprite.setDepth(60);

    // Мерцающее свечение
    const glowEmitter = this.scene.add.particles(x, y, 'vfx_soft_glow', {
      speed: { min: 5, max: 15 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 300,
      frequency: 100,
      quantity: 1,
      tint: color,
      blendMode: 'ADD',
    }).setDepth(59);

    // Мерцание
    this.scene.tweens.add({
      targets: sprite,
      alpha: 0.6,
      duration: 200,
      yoyo: true,
      repeat: -1,
    });

    const effect: MimicBallEffect = {
      sprite,
      glowEmitter,
      destroy: () => {
        // Эффект исчезновения при обнаружении
        this.scene.tweens.add({
          targets: sprite,
          scale: 1.5,
          alpha: 0,
          duration: 200,
          onComplete: () => sprite.destroy(),
        });

        // Взрыв частиц
        const burstParticles = this.scene.add.particles(x, y, 'vfx_toxin', {
          speed: { min: 50, max: 150 },
          angle: { min: 0, max: 360 },
          scale: { start: 1, end: 0 },
          alpha: { start: 1, end: 0 },
          lifespan: 400,
          quantity: 15,
          blendMode: 'ADD',
        });
        this.scene.time.delayedCall(500, () => burstParticles.destroy());

        glowEmitter.destroy();
      },
    };

    return effect;
  }

  // ============================================================
  // 🧠 NEURAL PARASITE — Эффект контроля над врагом
  // ============================================================

  public playParasiteEffect(targetX: number, targetY: number, duration: number): void {
    const color = FACTIONS.insect.color;

    // Кольцо контроля вокруг цели
    const controlRing = this.scene.add.graphics();
    controlRing.setPosition(targetX, targetY);
    controlRing.setDepth(55);

    let ringAngle = 0;
    const ringRadius = 40;

    const updateRing = () => {
      controlRing.clear();
      
      // Вращающееся кольцо
      controlRing.lineStyle(3, color, 0.8);
      controlRing.beginPath();
      
      for (let i = 0; i < 4; i++) {
        const startAngle = ringAngle + (i * Math.PI / 2);
        const endAngle = startAngle + Math.PI / 4;
        controlRing.arc(0, 0, ringRadius, startAngle, endAngle, false);
      }
      controlRing.strokePath();

      ringAngle += 0.05;
    };

    const ringTimer = this.scene.time.addEvent({
      delay: 16,
      callback: updateRing,
      loop: true,
    });

    // Частицы паразитирования
    const parasiteEmitter = this.scene.add.particles(targetX, targetY, 'vfx_toxin', {
      speed: { min: -30, max: 30 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 0.7, end: 0 },
      lifespan: 600,
      frequency: 150,
      quantity: 1,
      blendMode: 'ADD',
    }).setDepth(54);

    // Автоуничтожение
    this.scene.time.delayedCall(duration, () => {
      ringTimer.destroy();
      controlRing.destroy();
      parasiteEmitter.destroy();

      // Эффект освобождения
      this.ringEmitter.setParticleTint(color);
      this.ringEmitter.explode(2, targetX, targetY);
    });
  }

  // ============================================================
  // 🔥 MOLTEN BALL — Эффект горящего мяча
  // ============================================================

  public createMoltenBallEffect(ballSprite: Phaser.GameObjects.Arc): {
    emitter: Phaser.GameObjects.Particles.ParticleEmitter;
    update: () => void;
    destroy: () => void;
  } {
    const emitter = this.scene.add.particles(0, 0, 'vfx_lava_bubble', {
      speed: { min: 10, max: 40 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: 300,
      frequency: 50,
      quantity: 2,
      blendMode: 'ADD',
      follow: ballSprite,
    }).setDepth(59);

    // Свечение вокруг мяча
    const glow = this.scene.add.circle(0, 0, ballSprite.radius * 1.5, 0xff4500, 0.3);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    glow.setDepth(58);

    this.scene.tweens.add({
      targets: glow,
      scale: 1.2,
      alpha: 0.15,
      duration: 300,
      yoyo: true,
      repeat: -1,
    });

    return {
      emitter,
      update: () => {
        glow.setPosition(ballSprite.x, ballSprite.y);
      },
      destroy: () => {
        emitter.destroy();
        glow.destroy();
      },
    };
  }

  // ============================================================
  // 🔥 INVALID TARGET FEEDBACK — Визуальный фидбек ошибки
  // ============================================================

  public playInvalidTargetEffect(x: number, y: number): void {
    // Красная вспышка
    const flash = this.scene.add.circle(x, y, 40, 0xff0000, 0.6);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    flash.setDepth(200);

    this.scene.tweens.add({
      targets: flash,
      scale: 1.5,
      alpha: 0,
      duration: 200,
      onComplete: () => flash.destroy(),
    });

    // Крестик
    const crossGraphics = this.scene.add.graphics();
    crossGraphics.setPosition(x, y);
    crossGraphics.setDepth(201);
    crossGraphics.lineStyle(4, 0xff0000, 1);
    crossGraphics.lineBetween(-15, -15, 15, 15);
    crossGraphics.lineBetween(-15, 15, 15, -15);

    this.scene.tweens.add({
      targets: crossGraphics,
      alpha: 0,
      scale: 1.5,
      duration: 300,
      onComplete: () => crossGraphics.destroy(),
    });

    // Тряска камеры (лёгкая)
    this.scene.cameras.main.shake(50, 0.003);

    // Haptic feedback (Vibration API для Game режима)
    try {
      if (navigator.vibrate) {
        navigator.vibrate([30, 50, 30]);
      }
    } catch {}
  }

  // ============================================================
  // 🔥 VALID TARGET HIGHLIGHT — Подсветка валидной цели
  // ============================================================

  public createTargetHighlight(x: number, y: number, radius: number, color: number): {
    update: (newX: number, newY: number) => void;
    destroy: () => void;
  } {
    const graphics = this.scene.add.graphics();
    graphics.setDepth(45);

    let pulseScale = 1;
    let pulseAlpha = 0.6;

    const drawHighlight = () => {
      graphics.clear();
      graphics.setPosition(x, y);

      // Внешнее свечение
      graphics.lineStyle(4, color, pulseAlpha * 0.5);
      graphics.strokeCircle(0, 0, radius * pulseScale + 5);

      // Основное кольцо
      graphics.lineStyle(3, color, pulseAlpha);
      graphics.strokeCircle(0, 0, radius * pulseScale);

      // Пунктирные линии (целеуказатель)
      graphics.lineStyle(2, 0xffffff, pulseAlpha * 0.7);
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const innerR = radius * 0.5;
        const outerR = radius * 0.8;
        graphics.lineBetween(
          Math.cos(angle) * innerR, Math.sin(angle) * innerR,
          Math.cos(angle) * outerR, Math.sin(angle) * outerR
        );
      }
    };

    // Пульсация
    const pulseTween = this.scene.tweens.add({
      targets: { scale: pulseScale, alpha: pulseAlpha },
      scale: 1.1,
      alpha: 0.9,
      duration: 400,
      yoyo: true,
      repeat: -1,
      onUpdate: (tween) => {
      const target = tween.targets[0] as { scale: number; alpha: number };
      pulseScale = target.scale;
      pulseAlpha = target.alpha;
      drawHighlight();
    },
    });

    drawHighlight();

    return {
      update: (newX: number, newY: number) => {
        x = newX;
        y = newY;
        drawHighlight();
      },
      destroy: () => {
        pulseTween.stop();
        graphics.destroy();
      },
    };
  }

  // ============================================================
  // 🔥 ABILITY READY INDICATOR — Индикатор готовности способности
  // ============================================================

  public playAbilityReadyEffect(x: number, y: number, factionId: FactionId): void {
    const color = FACTIONS[factionId].color;

    // Восходящие частицы
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const particle = this.scene.add.circle(
        x + Math.cos(angle) * 30,
        y + Math.sin(angle) * 30,
        4,
        color,
        0.9
      );
      particle.setBlendMode(Phaser.BlendModes.ADD);
      particle.setDepth(100);

      this.scene.tweens.add({
        targets: particle,
        x: x,
        y: y - 40,
        alpha: 0,
        scale: 0,
        duration: 500,
        delay: i * 50,
        ease: 'Cubic.easeOut',
        onComplete: () => particle.destroy(),
      });
    }

    // Кольцо
    const ring = this.scene.add.graphics();
    ring.setPosition(x, y);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    ring.setDepth(99);

    const ringAnim = { radius: 20, alpha: 1 };
    this.scene.tweens.add({
      targets: ringAnim,
      radius: 50,
      alpha: 0,
      duration: 400,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        ring.clear();
        ring.lineStyle(3, color, ringAnim.alpha);
        ring.strokeCircle(0, 0, ringAnim.radius);
      },
      onComplete: () => ring.destroy(),
    });
  }

  // ============================================================
  // UPDATE — Вызывается каждый кадр для активных эффектов
  // ============================================================

  public update(delta: number = 16): void {
    // Обновление активных Lava Pools с жидкой анимацией
    this.activeLavaPools.forEach(pool => pool.update(delta));

    // Обновление активных Wormholes
    this.activeWormholes.forEach(wormhole => wormhole.update());
  }

  // ============================================================
  // SPECIAL EFFECTS
  // ============================================================

  private triggerHitStop(durationMs: number): void {
    this.scene.tweens.timeScale = 0.1;
    
    this.scene.time.delayedCall(durationMs, () => {
        this.scene.tweens.timeScale = 1;
    });
  }

  private triggerChromaticAberration(x: number, y: number, radius: number): void {
    const red = this.scene.add.circle(x - 3, y, radius, 0xff0000, 0.5);
    const blue = this.scene.add.circle(x + 3, y, radius, 0x0000ff, 0.5);
    
    red.setBlendMode('ADD').setDepth(200);
    blue.setBlendMode('ADD').setDepth(200);

    this.scene.tweens.add({
        targets: [red, blue],
        alpha: 0,
        scale: 1.2,
        duration: 100,
        onComplete: () => {
            red.destroy();
            blue.destroy();
        }
    });
  }

  // ============================================================
  // 🔥 GOAL FLAME EFFECT — Эффект пламени у ворот при голе
  // ============================================================

  /**
   * Эффект пламени у ворот при голе
   * Длительность: 4.7 секунды (синхронизировано со звуком flame_burst.mp3)
   * 
   * @param goalY - Y координата ворот (верхние или нижние)
   * @param goalLeftX - X координата левого края ворот
   * @param goalRightX - X координата правого края ворот
   * @param factionId - фракция для цвета пламени (опционально)
   * @param isTopGoal - верхние ворота (true) или нижние (false)
   */
  public playGoalFlameEffect(
    goalY: number,
    goalLeftX: number,
    goalRightX: number,
    factionId?: FactionId,
    isTopGoal: boolean = true
  ): void {
    const FLAME_DURATION = 4700; // 4.7 секунды - синхронизировано со звуком
    const FADE_OUT_START = 3500; // Начинаем затухание за 1.2 сек до конца
    
    // Определяем цвета пламени в зависимости от фракции
    const flameColors = factionId ? this.getFactionFlameColors(factionId) : {
      inner: 0xffff00,
      middle: 0xff8800,
      outer: 0xff4400
    };

    // Создаём пламя с ЛЕВОГО края ворот
    this.createFlameColumn(goalLeftX - 15, goalY, flameColors, isTopGoal, FLAME_DURATION, FADE_OUT_START);
    
    // Создаём пламя с ПРАВОГО края ворот
    this.createFlameColumn(goalRightX + 15, goalY, flameColors, isTopGoal, FLAME_DURATION, FADE_OUT_START);
  }

  private getFactionFlameColors(factionId: FactionId): { inner: number; middle: number; outer: number } {
    switch (factionId) {
      case 'magma':
        return { inner: 0xffff00, middle: 0xff6600, outer: 0xff0000 };
      case 'cyborg':
        return { inner: 0x00ffff, middle: 0x0088ff, outer: 0x0044aa };
      case 'void':
        return { inner: 0xdd88ff, middle: 0x8800ff, outer: 0x440088 };
      case 'insect':
        return { inner: 0xaaff00, middle: 0x66cc00, outer: 0x228800 };
      default:
        return { inner: 0xffff00, middle: 0xff8800, outer: 0xff4400 };
    }
  }

  private createFlameColumn(
    x: number, 
    y: number, 
    colors: { inner: number; middle: number; outer: number },
    isTopGoal: boolean,
    duration: number,
    fadeOutStart: number
  ): void {
    // Направление пламени (вверх для нижних ворот, вниз для верхних)
    const angleMin = isTopGoal ? 80 : -100;
    const angleMax = isTopGoal ? 100 : -80;
    
    // Внешний слой (большие частицы, полупрозрачные)
    const outerFlame = this.scene.add.particles(x, y, 'vfx_soft_glow', {
      speed: { min: 60, max: 120 },
      angle: { min: angleMin, max: angleMax },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: { min: 400, max: 600 },
      frequency: 30,
      quantity: 2,
      tint: colors.outer,
      blendMode: 'ADD',
    }).setDepth(150);

    // Средний слой
    const middleFlame = this.scene.add.particles(x, y, 'vfx_soft_glow', {
      speed: { min: 80, max: 140 },
      angle: { min: angleMin, max: angleMax },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: { min: 350, max: 500 },
      frequency: 25,
      quantity: 2,
      tint: colors.middle,
      blendMode: 'ADD',
    }).setDepth(151);

    // Внутренний слой (яркое ядро)
    const innerFlame = this.scene.add.particles(x, y, 'vfx_spark', {
      speed: { min: 100, max: 160 },
      angle: { min: angleMin, max: angleMax },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 300, max: 450 },
      frequency: 20,
      quantity: 3,
      tint: colors.inner,
      blendMode: 'ADD',
    }).setDepth(152);

    // Искры (летят дольше и выше)
    const sparks = this.scene.add.particles(x, y, 'vfx_spark', {
      speed: { min: 150, max: 280 },
      angle: { min: angleMin - 25, max: angleMax + 25 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 500, max: 900 },
      frequency: 40,
      quantity: 1,
      tint: colors.inner,
      blendMode: 'ADD',
    }).setDepth(153);

    // Плавное затухание - уменьшаем frequency
    this.scene.time.delayedCall(fadeOutStart, () => {
      outerFlame.setFrequency(80);
      middleFlame.setFrequency(70);
      innerFlame.setFrequency(60);
      sparks.setFrequency(120);
    });

    // Останавливаем эмиттеры в конце duration
    this.scene.time.delayedCall(duration, () => {
      outerFlame.stop();
      middleFlame.stop();
      innerFlame.stop();
      sparks.stop();
    });

    // Уничтожаем через 1 секунду после остановки
    this.scene.time.delayedCall(duration + 1000, () => {
      outerFlame.destroy();
      middleFlame.destroy();
      innerFlame.destroy();
      sparks.destroy();
    });
  }

  // ============================================================
  // GETTERS для активных эффектов
  // ============================================================

  public getActiveShield(unitId: string): EnergyShieldEffect | undefined {
    return this.activeShields.get(unitId);
  }

  public getActiveGhost(unitId: string): GhostPhaseEffect | undefined {
    return this.activeGhosts.get(unitId);
  }

  public getActiveTether(unitId: string): TetherEffect | undefined {
    return this.activeTethers.get(unitId);
  }

  public getActiveLavaPools(): LavaPoolEffect[] {
    return this.activeLavaPools;
  }

  /**
   * Визуальный акцент при активации ульты капитана (вспышка + ударные кольца).
   */
  public playCaptainAbilityEffect(captainId: string, x: number, y: number, factionId: FactionId): void {
    const color = FACTIONS[factionId].color;

    const flash = this.scene.add.circle(x, y, 120, color, 0.75);
    flash.setDepth(1000);
    flash.setBlendMode(Phaser.BlendModes.ADD);

    this.scene.tweens.add({
      targets: flash,
      scaleX: 3.2,
      scaleY: 3.2,
      alpha: 0,
      duration: 780,
      ease: 'Cubic.easeOut',
      onComplete: () => flash.destroy(),
    });

    const wave1 = this.scene.add.circle(x, y, 56, color, 0);
    wave1.setDepth(999);
    wave1.setStrokeStyle(6, color, 1);

    this.scene.tweens.add({
      targets: wave1,
      scaleX: 5.5,
      scaleY: 5.5,
      alpha: 0,
      duration: 950,
      ease: 'Cubic.easeOut',
      onComplete: () => wave1.destroy(),
    });

    this.scene.time.delayedCall(180, () => {
      const wave2 = this.scene.add.circle(x, y, 48, color, 0);
      wave2.setDepth(999);
      wave2.setStrokeStyle(4, color, 0.85);

      this.scene.tweens.add({
        targets: wave2,
        scaleX: 4.8,
        scaleY: 4.8,
        alpha: 0,
        duration: 820,
        ease: 'Cubic.easeOut',
        onComplete: () => wave2.destroy(),
      });
    });

    if (this.scene.textures.exists('particle')) {
      const particles = this.scene.add.particles(x, y, 'particle', {
        speed: { min: 80, max: 260 },
        scale: { start: 1.2, end: 0 },
        alpha: { start: 0.95, end: 0 },
        tint: color,
        lifespan: 900,
        quantity: 24,
        blendMode: Phaser.BlendModes.ADD,
      });
      particles.setDepth(998);
      this.scene.time.delayedCall(1000, () => particles.destroy());
    }

    if (import.meta.env.DEV) {
      console.log(`[VFXManager] Captain ability effect: ${captainId}`);
    }
  }

  // ============================================================
  // CLEANUP
  // ============================================================

  public destroy(): void {
    this.unsubscribeFromEvents();

    // Очистка всех активных эффектов
    this.activeLavaPools.forEach(pool => pool.destroy());
    this.activeLavaPools = [];

    this.activeShields.forEach(shield => shield.destroy());
    this.activeShields.clear();

    this.activeGhosts.forEach(ghost => ghost.destroy());
    this.activeGhosts.clear();

    this.activeTethers.forEach(tether => tether.destroy());
    this.activeTethers.clear();

    this.activeBarriers.forEach(barrier => barrier.destroy());
    this.activeBarriers = [];

    this.activeWormholes.forEach(wormhole => wormhole.destroy());
    this.activeWormholes = [];

    this.sparksEmitter?.destroy();
    this.smokeEmitter?.destroy();
    this.ringEmitter?.destroy();
  }
}
      