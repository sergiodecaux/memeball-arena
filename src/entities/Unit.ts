// ✅ ИЗМЕНЕНО: Juicy Version 3.0 — Enhanced Ability System & Dynamic Shadow Lag

import Phaser from 'phaser';
import { 
  CAP_CLASSES, 
  COLLISION_CATEGORIES, 
  CapClass, 
  CapClassStats, 
  FACTIONS,
  FactionId,
  FactionConfig,
  ABILITY_CONFIG,
  UnitStatus,
  FIELD,
} from '../constants/gameConstants';
import { PlayerNumber, CapUpgrades } from '../types';
import { playerData } from '../data/PlayerData';
import { getUnit, UnitData } from '../data/UnitsCatalog';
import { getUnitById as getRepositoryUnit, UnitData as RepositoryUnitData } from '../data/UnitsRepository';
import { VFXManager } from '../managers/VFXManager';
import { getMysticCapById } from '../data/CapCollectionCatalog';
import { PassiveManager } from '../systems/PassiveManager';
import { getRealUnitTextureKey } from '../utils/TextureHelpers';
import { getUnitPhysicsModifier } from '../data/UnitsRepository';

export interface UnitOptions {
  factionId?: FactionId;
  applyFactionStats?: boolean;
  applyUpgrades?: boolean;
  customUpgrades?: CapUpgrades;
  capClass?: CapClass;
  unitId?: string;
}

export class Unit {
  public body: MatterJS.BodyType;
  public sprite: Phaser.GameObjects.Container;
  public readonly owner: PlayerNumber;
  public readonly id: string;
  public isDestroyed: boolean = false;
  public readonly capClass: CapClass;
  public readonly factionId: FactionId;
  public readonly faction: FactionConfig;
  public stats: CapClassStats;

  private scene: Phaser.Scene;
  private vfxManager?: VFXManager;
  private passiveManager: PassiveManager | null = null;
  
  private readonly UNIVERSAL_RADIUS = 36;
  
  private scaledRadius: number;
  private scale: number;
  // ⚠️ REMOVED: private upgrades: CapUpgrades; - прокачка убрана
  private readonly unitId: string;
  /** Идентификатор уникальной физики — см. unitPhysicsModifiers.ts */
  private readonly physicsModifier: string | undefined;

  private lastHitOffset = 0;
  private lastShotTime = 0;

  // === ВИЗУАЛЬНЫЕ КОМПОНЕНТЫ ===
  private dropShadow?: Phaser.GameObjects.Ellipse;
  private contrastRing?: Phaser.GameObjects.Graphics;
  private factionGlow?: Phaser.GameObjects.Arc;
  private unitSprite?: Phaser.GameObjects.Image;
  private rimLight?: Phaser.GameObjects.Graphics;
  private selectionRing?: Phaser.GameObjects.Graphics;
  private gloss?: Phaser.GameObjects.Graphics;
  private fallbackImage?: Phaser.GameObjects.Graphics;

  // 🔥 Ghost Trails (Призрачный шлейф вместо линий)
  private ghostTimer: number = 0;
  private readonly GHOST_INTERVAL = 40;
  private readonly GHOST_MIN_SPEED = 10;

  // 🔥 Speed-reactive effects
  private speedGlow?: Phaser.GameObjects.Arc;
  private lastSpeed: number = 0;

  // 🔥 Squash & Stretch
  private baseScaleX: number = 1;
  private baseScaleY: number = 1;
  private targetScaleX: number = 1;
  private targetScaleY: number = 1;
  private isSquashing: boolean = false;

  // 🔥 Dynamic Shadow Lag (тень отстаёт от юнита)
  private shadowTargetX: number = 4;
  private shadowTargetY: number = 5;
  private readonly SHADOW_LAG_FACTOR = 0.15; // Чем меньше, тем сильнее отставание
  private readonly SHADOW_MAX_OFFSET = 12;

  private glowTween?: Phaser.Tweens.Tween;
  private isSelected: boolean = false;
  private isActiveTeamTurn: boolean = true;
  private selectionTween?: Phaser.Tweens.Tween;

  private textureSize: number = 512;

  // ============================================================
  // 🧬 ABILITY SYSTEM
  // ============================================================
  
  private status: UnitStatus = UnitStatus.NONE;
  private statusDuration: number = 0;
  private abilityCooldown: number = 0;
  
  // Визуальные эффекты способностей
  private shieldGraphics?: Phaser.GameObjects.Graphics;
  private shieldSensor?: MatterJS.BodyType;
  private stunOverlay?: Phaser.GameObjects.Container;
  private toxinGlow?: Phaser.GameObjects.Arc;
  private lavaIndicator?: Phaser.GameObjects.Arc;
  private stunSparkEvent?: Phaser.Time.TimerEvent;

  // 🔥 Shield pulse animation
  private shieldPulseTween?: Phaser.Tweens.Tween;
  private shieldRotation: number = 0;

  // ============================================================

  private static readonly MAX_SPEED: Record<CapClass, number> = {
    balanced: 26,
    tank: 19,
    sniper: 34,
    trickster: 30,
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
    this.unitId = options?.unitId || id;
    this.physicsModifier = getUnitPhysicsModifier(this.unitId);
    
    if (options?.capClass) {
      this.capClass = options.capClass;
    } else {
      const catalogUnit = getUnit(this.unitId);
      const repositoryUnit = catalogUnit ? undefined : getRepositoryUnit(this.unitId);
      this.capClass = catalogUnit?.capClass || (repositoryUnit?.role as CapClass | undefined) || this.detectClassFromId(this.unitId);
    }
    
    this.stats = { ...CAP_CLASSES[this.capClass] };
    
    let sizeModifier = 1.0;
    if (this.capClass === 'tank') {
      sizeModifier = 1.1; 
    }

    this.scaledRadius = this.UNIVERSAL_RADIUS * scale * sizeModifier;
    
    // ⚠️ NEW: Теперь только статы фракции, без upgrades
    // Каждый юнит имеет фиксированные статы
    if (options?.applyFactionStats !== false) {
      this.applyFactionStats();
    }

    this.sprite = scene.add.container(Math.round(x), Math.round(y)).setDepth(60);
    
    // Инициализация позиции тени
    this.shadowTargetX = 4;
    this.shadowTargetY = 5;
    
    this.createVisuals();
    this.createPhysicsBody(x, y);
    this.setupInteractivity();
    this.startGlowPulse();
  }

  get x(): number { return this.body.position.x; }
  get y(): number { return this.body.position.y; }

  public setVFXManager(manager: VFXManager): void {
    this.vfxManager = manager;
  }

  // ============================================================
  // 🧬 ABILITY SYSTEM — PUBLIC API
  // ============================================================

  /**
   * Активация способности юнита (вызывается из UI или контроллера)
   */
  public activateAbility(): boolean {
    if (this.status === UnitStatus.STUNNED) {
      console.log(`[Unit ${this.id}] Cannot activate ability while stunned`);
      return false;
    }

    if (this.abilityCooldown > 0) {
      console.log(`[Unit ${this.id}] Ability on cooldown: ${this.abilityCooldown} turns`);
      return false;
    }

    switch (this.factionId) {
      case 'cyborg':
        return this.activateEMPShield();
      case 'insect':
        return this.chargeToxin();
      default:
        return false;
    }
  }

  /**
   * Проверка: может ли юнит выполнить Void Swap
   */
  public canPerformSwap(): boolean {
    return (
      this.factionId === 'void' &&
      this.status !== UnitStatus.STUNNED &&
      this.abilityCooldown === 0
    );
  }

  /**
   * Выполнение телепортации (Void Swap)
   */
  public teleportTo(x: number, y: number): void {
    const oldX = this.x;
    const oldY = this.y;

    // Мгновенное перемещение
    this.scene.matter.body.setPosition(this.body, { x, y });
    this.scene.matter.body.setVelocity(this.body, { x: 0, y: 0 });
    this.sprite.setPosition(x, y);

    // Сброс позиции тени (мгновенное появление)
    this.shadowTargetX = 4;
    this.shadowTargetY = 5;
    if (this.dropShadow) {
      this.dropShadow.setPosition(4, 5);
    }

    // VFX эффекты телепортации
    if (this.vfxManager) {
      this.vfxManager.playTeleportEffect(oldX, oldY, this.faction.color);
      this.vfxManager.playTeleportEffect(x, y, this.faction.color);
    }

    // Эффект "прибытия" - небольшой pulse
    this.playTeleportArrivalEffect();

    try {
      (window as any).AudioManager?.getInstance?.()?.playSFX?.('sfx_teleport');
    } catch {}

    console.log(`[Unit ${this.id}] Teleported from (${oldX.toFixed(0)}, ${oldY.toFixed(0)}) to (${x.toFixed(0)}, ${y.toFixed(0)})`);
  }

  /**
   * Эффект появления после телепортации
   */
  private playTeleportArrivalEffect(): void {
    // Scale pulse
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 80,
      yoyo: true,
      ease: 'Cubic.easeOut',
    });

    // Glow flash
    if (this.factionGlow) {
      this.scene.tweens.add({
        targets: this.factionGlow,
        alpha: 1,
        scale: 1.8,
        duration: 100,
        yoyo: true,
        ease: 'Cubic.easeOut',
      });
    }
  }

  /**
   * Применение стана (вызывается при ударе Swarm юнитом)
   */
  public applyStun(duration: number): void {
    if (this.status === UnitStatus.STUNNED) return;
    
    // Щит блокирует токсин
    if (this.status === UnitStatus.SHIELDED && ABILITY_CONFIG.CYBORG_SHIELD_TOXIN_IMMUNE) {
      console.log(`[Unit ${this.id}] Stun BLOCKED by shield`);
      this.playShieldBlockEffect();
      return;
    }

    this.status = UnitStatus.STUNNED;
    this.statusDuration = duration;

    this.scene.matter.body.setVelocity(this.body, { x: 0, y: 0 });
    this.scene.matter.body.setStatic(this.body, true);

    this.createStunOverlay();
    
    // Сбрасываем выбор, если юнит был выбран
    if (this.isSelected) {
      this.setSelected(false);
    }

    try {
      // Vibration API для Game режима
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    } catch {}

    console.log(`[Unit ${this.id}] STUNNED for ${duration} turns`);
  }

  /**
   * Эффект блокировки урона щитом
   */
  private playShieldBlockEffect(): void {
    if (!this.shieldGraphics) return;

    this.scene.tweens.add({
      targets: this.shieldGraphics,
      alpha: 1,
      scale: 1.3,
      duration: 100,
      yoyo: true,
      ease: 'Cubic.easeOut',
    });

    if (this.vfxManager) {
      this.vfxManager.playShieldHitEffect(this.x, this.y, 0, this.faction.color);
    }
  }

  /**
   * Проверка: застанен ли юнит
   */
  public isStunned(): boolean {
    return this.status === UnitStatus.STUNNED;
  }

  /**
   * Проверка: активен ли щит
   */
  public hasActiveShield(): boolean {
    return this.status === UnitStatus.SHIELDED;
  }

  /**
   * Проверка: заряжен ли токсин
   */
  public hasToxinCharge(): boolean {
    return this.status === UnitStatus.TOXIC_CHARGED;
  }

  /**
   * Потребление заряда токсина (при ударе)
   */
  public consumeToxinCharge(): boolean {
    if (this.status === UnitStatus.TOXIC_CHARGED) {
      this.clearStatus();
      return true;
    }
    return false;
  }

  /**
   * Получение тела щита для коллизий
   */
  public getShieldSensor(): MatterJS.BodyType | undefined {
    return this.shieldSensor;
  }

  /**
   * Получение радиуса щита
   */
  public getShieldRadius(): number {
    return this.status === UnitStatus.SHIELDED 
      ? (ABILITY_CONFIG.CYBORG_SHIELD_RADIUS || 55) 
      : 0;
  }

  /**
   * Получение центра щита (для расчёта отражения)
   */
  public getShieldCenter(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  /**
   * Вызывается при попадании объекта в щит
   */
  public onShieldHit(impactAngle: number, impactForce: number): void {
    if (this.status !== UnitStatus.SHIELDED) return;

    // Визуальный эффект
    if (this.vfxManager) {
      this.vfxManager.playShieldHitEffect(this.x, this.y, impactAngle, this.faction.color);
    }

    // Pulse эффект на графике щита
    if (this.shieldGraphics) {
      this.scene.tweens.add({
        targets: this.shieldGraphics,
        scale: 1.15,
        alpha: 1,
        duration: 80,
        yoyo: true,
        ease: 'Cubic.easeOut',
      });
    }

    // Звук
    try {
      (window as any).AudioManager?.getInstance?.()?.playSFX?.('sfx_shield_hit');
    } catch {}
  }

  /**
   * Вызывается в конце каждого хода для обновления статусов
   */
  public onTurnEnd(): void {
    if (this.abilityCooldown > 0) {
      this.abilityCooldown--;
    }

    if (this.statusDuration > 0) {
      this.statusDuration--;
      
      if (this.statusDuration <= 0) {
        this.clearStatus();
      }
    }
  }

  /**
   * Установка кулдауна способности (для Void Swap)
   */
  public setAbilityCooldown(turns: number): void {
    this.abilityCooldown = turns;
  }

  /**
   * Пометка о нахождении в лаве (визуальный эффект)
   */
  public setInLava(inLava: boolean): void {
    if (inLava && !this.lavaIndicator) {
      this.createLavaIndicator();
    } else if (!inLava && this.lavaIndicator) {
      this.lavaIndicator.destroy();
      this.lavaIndicator = undefined;
    }
  }

  // ============================================================
  // 🧬 ABILITY SYSTEM — PRIVATE METHODS
  // ============================================================

  /**
   * Cyborg: Активация EMP Щита
   */
  private activateEMPShield(): boolean {
    if (this.status === UnitStatus.SHIELDED) return false;

    this.status = UnitStatus.SHIELDED;
    this.statusDuration = ABILITY_CONFIG.CYBORG_SHIELD_DURATION || 2;
    this.abilityCooldown = ABILITY_CONFIG.CYBORG_SHIELD_COOLDOWN || 2;

    const shieldRadius = ABILITY_CONFIG.CYBORG_SHIELD_RADIUS || 55;

    // Создаём физический сенсор щита
    this.shieldSensor = this.scene.matter.add.circle(
      this.x, 
      this.y, 
      shieldRadius, 
      {
        isSensor: true,
        isStatic: false, // Не static, чтобы можно было синхронизировать velocity
        label: `shield_${this.id}`,
        collisionFilter: {
          category: COLLISION_CATEGORIES.SHIELD,
          mask: COLLISION_CATEGORIES.BALL,
        },
      }
    );

    this.createShieldVisual();

    try {
      (window as any).AudioManager?.getInstance?.()?.playSFX?.('sfx_shield_activate');
    } catch {}

    console.log(`[Unit ${this.id}] EMP Shield ACTIVATED`);
    return true;
  }

  /**
   * Swarm: Зарядка токсина
   */
  private chargeToxin(): boolean {
    if (this.status === UnitStatus.TOXIC_CHARGED) return false;

    this.status = UnitStatus.TOXIC_CHARGED;
    this.statusDuration = (ABILITY_CONFIG.SWARM_TOXIN_CHARGE_TURNS || 2) + 1;

    this.createToxinGlow();

    console.log(`[Unit ${this.id}] Toxin CHARGED`);
    return true;
  }

  /**
   * Очистка статуса
   */
  private clearStatus(): void {
    const previousStatus = this.status;

    switch (previousStatus) {
      case UnitStatus.STUNNED:
        this.scene.matter.body.setStatic(this.body, false);
        this.sprite.setAlpha(1);
        if (this.stunSparkEvent) {
          this.stunSparkEvent.remove();
          this.stunSparkEvent = undefined;
        }
        this.stunOverlay?.destroy();
        this.stunOverlay = undefined;
        console.log(`[Unit ${this.id}] Stun CLEARED`);
        break;

      case UnitStatus.SHIELDED:
        // Анимация исчезновения щита
        if (this.shieldGraphics) {
          this.scene.tweens.add({
            targets: this.shieldGraphics,
            scale: 0,
            alpha: 0,
            duration: 200,
            ease: 'Back.easeIn',
            onComplete: () => {
              this.shieldGraphics?.destroy();
              this.shieldGraphics = undefined;
            }
          });
        }
        if (this.shieldPulseTween) {
          this.shieldPulseTween.stop();
          this.shieldPulseTween = undefined;
        }
        if (this.shieldSensor) {
          this.scene.matter.world.remove(this.shieldSensor);
          this.shieldSensor = undefined;
        }
        console.log(`[Unit ${this.id}] Shield DEACTIVATED`);
        break;

      case UnitStatus.TOXIC_CHARGED:
        if (this.toxinGlow) {
          this.scene.tweens.add({
            targets: this.toxinGlow,
            scale: 0,
            alpha: 0,
            duration: 150,
            onComplete: () => {
              this.toxinGlow?.destroy();
              this.toxinGlow = undefined;
            }
          });
        }
        console.log(`[Unit ${this.id}] Toxin charge EXPIRED`);
        break;
    }

    this.status = UnitStatus.NONE;
    this.statusDuration = 0;
  }

  // ============================================================
  // 🧬 ABILITY VISUALS
  // ============================================================

  private createShieldVisual(): void {
    this.shieldGraphics?.destroy();

    const r = ABILITY_CONFIG.CYBORG_SHIELD_RADIUS || 55;
    
    this.shieldGraphics = this.scene.add.graphics();
    this.shieldGraphics.setDepth(61);
    
    this.drawShieldGraphics(r);
    
    this.sprite.add(this.shieldGraphics);

    // Анимация появления
    this.shieldGraphics.setScale(0);
    this.scene.tweens.add({
      targets: this.shieldGraphics,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

    // Пульсация
    this.shieldPulseTween = this.scene.tweens.add({
      targets: this.shieldGraphics,
      alpha: { from: 1, to: 0.6 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Вращение "энергетических линий"
    this.shieldRotation = 0;
  }

  private drawShieldGraphics(r: number): void {
    if (!this.shieldGraphics) return;
    
    this.shieldGraphics.clear();
    
    // Внешнее свечение
    this.shieldGraphics.lineStyle(5, 0x00f2ff, 0.3);
    this.shieldGraphics.strokeCircle(0, 0, r + 3);
    
    // Основной контур
    this.shieldGraphics.lineStyle(3, 0x00f2ff, 0.9);
    this.shieldGraphics.strokeCircle(0, 0, r);
    
    // Заливка
    this.shieldGraphics.fillStyle(0x00f2ff, 0.12);
    this.shieldGraphics.fillCircle(0, 0, r);
    
    // Энергетические линии (вращаются)
    this.shieldGraphics.lineStyle(1.5, 0x00f2ff, 0.6);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + this.shieldRotation;
      const x1 = Math.cos(angle) * (r * 0.3);
      const y1 = Math.sin(angle) * (r * 0.3);
      const x2 = Math.cos(angle) * r;
      const y2 = Math.sin(angle) * r;
      this.shieldGraphics.lineBetween(x1, y1, x2, y2);
    }
    
    // Внутреннее кольцо
    this.shieldGraphics.lineStyle(1, 0x00ffff, 0.4);
    this.shieldGraphics.strokeCircle(0, 0, r * 0.5);
  }

  private createToxinGlow(): void {
    this.toxinGlow?.destroy();

    const r = this.scaledRadius + 10;

    this.toxinGlow = this.scene.add.circle(0, 0, r, 0x39ff14, 0.4);
    this.toxinGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.sprite.addAt(this.toxinGlow, 1); // После тени, перед остальным

    this.scene.tweens.add({
      targets: this.toxinGlow,
      alpha: { from: 0.4, to: 0.15 },
      scale: { from: 1, to: 1.2 },
      duration: 400,
      yoyo: true,
      repeat: -1,
    });
  }

  private createStunOverlay(): void {
    this.stunOverlay?.destroy();

    this.stunOverlay = this.scene.add.container(0, 0);
    
    // Затемнение юнита
    this.sprite.setAlpha(0.5);

    // Иконка молнии
    const stunText = this.scene.add.text(0, -this.scaledRadius - 18, '⚡', {
      fontSize: '22px',
    }).setOrigin(0.5);
    
    this.stunOverlay.add(stunText);
    this.sprite.add(this.stunOverlay);

    // Анимация иконки
    this.scene.tweens.add({
      targets: stunText,
      y: stunText.y - 6,
      duration: 300,
      yoyo: true,
      repeat: -1,
    });

    // Искры
    const sparks = this.scene.add.graphics();
    sparks.setBlendMode(Phaser.BlendModes.ADD);
    this.stunOverlay.add(sparks);

    this.stunSparkEvent = this.scene.time.addEvent({
      delay: 80,
      callback: () => {
        if (!this.stunOverlay || this.status !== UnitStatus.STUNNED) return;
        
        sparks.clear();
        sparks.lineStyle(2, 0x00f2ff, 0.8);
        
        // Рисуем случайные молнии
        for (let i = 0; i < 4; i++) {
          const startAngle = Math.random() * Math.PI * 2;
          const r1 = this.scaledRadius * 0.4;
          const r2 = this.scaledRadius * 1.1;
          
          // Ломаная линия для эффекта молнии
          const midAngle = startAngle + (Math.random() - 0.5) * 0.5;
          const midR = r1 + (r2 - r1) * 0.5;
          
          sparks.beginPath();
          sparks.moveTo(Math.cos(startAngle) * r1, Math.sin(startAngle) * r1);
          sparks.lineTo(Math.cos(midAngle) * midR, Math.sin(midAngle) * midR);
          sparks.lineTo(Math.cos(startAngle + 0.2) * r2, Math.sin(startAngle + 0.2) * r2);
          sparks.strokePath();
        }
      },
      loop: true,
    });
  }

  private createLavaIndicator(): void {
    this.lavaIndicator?.destroy();

    this.lavaIndicator = this.scene.add.circle(
      0, 
      this.scaledRadius + 6, 
      7, 
      0xff4500, 
      0.9
    );
    this.lavaIndicator.setStrokeStyle(2, 0xff6b00);
    this.sprite.add(this.lavaIndicator);

    this.scene.tweens.add({
      targets: this.lavaIndicator,
      scale: { from: 1, to: 1.4 },
      alpha: { from: 0.9, to: 0.4 },
      duration: 350,
      yoyo: true,
      repeat: -1,
    });
  }

  // ============================================================
  // EXISTING METHODS (без изменений)
  // ============================================================

  private detectClassFromId(unitId: string): CapClass {
    const id = unitId.toLowerCase();
    if (id.includes('sniper') || id.includes('scout') || id.includes('spitter')) return 'sniper';
    if (id.includes('tank') || id.includes('titan') || id.includes('mech') || id.includes('guardian') || id.includes('brood')) return 'tank';
    if (id.includes('trickster') || id.includes('inferno') || id.includes('glitch') || id.includes('bender') || id.includes('mimic')) return 'trickster';
    return 'balanced';
  }

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

  // ⚠️ REMOVED: applyUpgrades() - старая система прокачки убрана
  // ⚠️ REMOVED: applyTechniqueBonus() - старая система прокачки убрана
  // Теперь статы фиксированные для каждого юнита из UnitsRepository

  private createVisuals(): void {
    const r = this.scaledRadius;
    const unitData = this.getUnitData();

    // 1. МЯГКАЯ ТЕНЬ (теперь с лагом)
    this.dropShadow = this.scene.add.ellipse(4, 5, r * 2.5, r * 1.9, 0x000000, 0.6);
    this.sprite.add(this.dropShadow);

    // 2. 🔥 SPEED GLOW (уменьшен обратно)
    this.speedGlow = this.scene.add.circle(0, 0, r + 12, this.faction.color, 0.12);
    this.speedGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.sprite.add(this.speedGlow);

    // 3. FACTION GLOW (уменьшен обратно)
    this.factionGlow = this.scene.add.circle(0, 0, r + 8, this.faction.color, 0.7);
    this.factionGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.sprite.add(this.factionGlow);

    // 4. КОНТРАСТНЫЙ КРУГ
    this.contrastRing = this.scene.add.graphics();
    this.contrastRing.lineStyle(4, 0xffffff, 0.5);
    this.contrastRing.strokeCircle(0, 0, r + 2);
    this.sprite.add(this.contrastRing);

    // 5. ТЁМНАЯ ОСНОВА + светлая подложка для яркости
    const base = this.scene.add.circle(0, 0, r, 0x151c2d, 1);
    this.sprite.add(base);

    const brighten = this.scene.add.graphics();
    brighten.fillStyle(0xffffff, 0.18);
    brighten.fillCircle(0, 0, r * 0.9);
    brighten.setBlendMode(Phaser.BlendModes.SCREEN);
    this.sprite.add(brighten);

    // 6b. Дополнительная яркая окантовка (тонкая, faction color)
    const accentRing = this.scene.add.graphics();
    accentRing.lineStyle(2.5, this.faction.color, 0.95);
    accentRing.strokeCircle(0, 0, r + 3.5);
    accentRing.setBlendMode(Phaser.BlendModes.ADD);
    this.sprite.add(accentRing);

    // 6. ОСНОВНОЙ СПРАЙТ
    let textureKey = this.getBestTextureKey(unitData);
    const equippedCapId = playerData.getEquippedCapSkinForFaction(this.factionId);
    if (equippedCapId) {
      const capData = getMysticCapById(equippedCapId);
      if (capData && this.scene.textures.exists(capData.assetKey512)) {
        textureKey = capData.assetKey512;
      }
    }

    if (textureKey && this.scene.textures.exists(textureKey)) {
      this.attachUnitSprite(textureKey, r);
    } else {
      if (unitData?.assetPath && textureKey) {
        this.tryLoadUnitTexture(textureKey, unitData.assetPath, r);
      }
      this.createFallbackVisual();
    }

    // 7. RIM LIGHT
    this.rimLight = this.scene.add.graphics();
    this.rimLight.setBlendMode(Phaser.BlendModes.ADD);
    this.drawRimLight();
    this.sprite.add(this.rimLight);

    // 9. SELECTION RING
    this.createSelectionRing();
  }

  private attachUnitSprite(textureKey: string, r: number): void {
    try {
      if (!this.scene.textures.exists(textureKey)) {
        console.error(`[Unit] Texture "${textureKey}" does not exist, cannot attach sprite`);
        return;
      }
      
      this.unitSprite = this.scene.add.image(0, 0, textureKey);
      
      const texture = this.scene.textures.get(textureKey);
      const sourceImage = texture.getSourceImage();
      this.textureSize = sourceImage.width || 512;

      // LINEAR фильтр для HD текстур
      texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

      // Размер для pop-out эффекта
      const targetSize = r * 2.8;
      this.unitSprite.setDisplaySize(targetSize, targetSize);
      this.unitSprite.setOrigin(0.5, 0.5);
      
      this.sprite.add(this.unitSprite);
      
      if (this.fallbackImage) {
        this.fallbackImage.destroy();
        this.fallbackImage = undefined;
      }
    } catch (error) {
      console.error(`[Unit] Error attaching unit sprite for "${textureKey}":`, error);
    }
  }

  private tryLoadUnitTexture(textureKey: string, assetPath: string, r: number): void {
    if (this.scene.textures.exists(textureKey)) return;

    if (import.meta.env.DEV) {
      console.warn(`[Unit] Texture missing in gameplay: ${textureKey} (${assetPath}). Loading on the fly...`);
    }

    // Избегаем повторной загрузки того же ключа
    if ((this.scene.load as any)._queue?.list?.some?.((f: any) => f.key === textureKey)) {
      return;
    }

    const fixedAssetPath = assetPath.replace(/^\/+/, '').split('?')[0];
    this.scene.load.image(textureKey, fixedAssetPath);
    this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (this.scene.textures.exists(textureKey) && !this.unitSprite && this.sprite?.active) {
        this.attachUnitSprite(textureKey, r);
      }
    });
    this.scene.load.start();
  }

  private drawGloss(): void {
    if (!this.gloss) return;
    
    this.gloss.clear();
    const r = this.scaledRadius;
    
    this.gloss.fillStyle(0xffffff, 0.18);
    this.gloss.beginPath();
    this.gloss.arc(0, -r * 0.35, r * 0.55, Math.PI * 1.1, Math.PI * 1.9, false);
    this.gloss.arc(0, -r * 0.2, r * 0.7, Math.PI * 1.9, Math.PI * 1.1, true);
    this.gloss.closePath();
    this.gloss.fillPath();
    
    this.gloss.fillStyle(0xffffff, 0.5);
    this.gloss.fillCircle(-r * 0.25, -r * 0.4, r * 0.12);
    
    this.gloss.fillStyle(0xffffff, 0.3);
    this.gloss.fillCircle(-r * 0.1, -r * 0.25, r * 0.06);
  }

  private drawRimLight(): void {
    if (!this.rimLight) return;
    
    this.rimLight.clear();
    const r = this.scaledRadius;
    
    this.rimLight.lineStyle(3, 0x000000, 0.6);
    this.rimLight.beginPath();
    this.rimLight.arc(0, 0, r - 1, Math.PI * 0.2, Math.PI * 0.8);
    this.rimLight.strokePath();
    
    this.rimLight.lineStyle(2, 0xffffff, 0.7); 
    this.rimLight.beginPath();
    this.rimLight.arc(0, 0, r - 1, Math.PI * 1.2, Math.PI * 1.8);
    this.rimLight.strokePath();
    
    this.rimLight.lineStyle(2, this.faction.color, 0.9);
    this.rimLight.beginPath();
    this.rimLight.arc(0, 0, r - 1, Math.PI * 1.25, Math.PI * 1.75);
    this.rimLight.strokePath();
  }

  private startGlowPulse(): void {
    if (!this.factionGlow) return;
    
    this.glowTween = this.scene.tweens.add({
      targets: this.factionGlow,
      alpha: { from: 0.35, to: 0.65 }, 
      scale: { from: 1, to: 1.12 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private stopGlowPulse(): void {
    if (this.glowTween) {
      this.glowTween.stop();
      this.glowTween = undefined;
    }
  }

  private getUnitData(): UnitData | undefined {
    let unitData = getUnit(this.unitId);
    if (unitData) return unitData;

    const repositoryUnit = getRepositoryUnit(this.unitId);
    if (repositoryUnit) return this.toCatalogUnitData(repositoryUnit);

    const generatedId = this.generateLegacyUnitId();
    unitData = getUnit(generatedId);
    if (unitData) return unitData;

    const generatedRepositoryUnit = getRepositoryUnit(generatedId);
    return generatedRepositoryUnit ? this.toCatalogUnitData(generatedRepositoryUnit) : undefined;
  }

  private toCatalogUnitData(unit: RepositoryUnitData): UnitData {
    return {
      id: unit.id,
      factionId: unit.factionId,
      name: unit.name,
      title: unit.title,
      capClass: unit.role as CapClass,
      rarity: unit.rarity,
      isStarter: Boolean(unit.isStarter),
      price: unit.shopPrice ? { coins: unit.shopPrice } : {},
      assetKey: unit.assetKey,
      assetPath: unit.assetPath,
      description: unit.description,
      stats: unit.stats,
      specialAbility: unit.specialAbility,
    };
  }

  private generateLegacyUnitId(): string {
    const classMap: Record<CapClass, Record<FactionId, string>> = {
      balanced: { magma: 'grunt', cyborg: 'soldier', void: 'initiate', insect: 'drone' },
      tank: { magma: 'titan', cyborg: 'mech', void: 'guardian', insect: 'brood' },
      sniper: { magma: 'scout', cyborg: 'drone', void: 'sniper', insect: 'spitter' },
      trickster: { magma: 'inferno', cyborg: 'glitch', void: 'bender', insect: 'mimic' },
    };
    const className = classMap[this.capClass]?.[this.factionId] || this.capClass;
    return `${this.factionId}_${className}`;
  }

  private createFallbackVisual(): void {
    const r = this.scaledRadius;
    const g = this.scene.add.graphics();
    const steps = 12;
    for (let i = steps; i >= 0; i--) {
      const ratio = i / steps;
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(this.faction.colorSecondary),
        Phaser.Display.Color.ValueToColor(this.faction.color),
        100,
        ratio * 100
      );
      const hexColor = Phaser.Display.Color.GetColor(color.r, color.g, color.b);
      g.fillStyle(hexColor, 1);
      g.fillCircle(0, 0, r * 0.92 * ratio);
    }
    g.lineStyle(3, 0xffffff, 0.45);
    g.strokeCircle(0, 0, r * 0.95);
    g.lineStyle(2, this.faction.color, 0.8);
    g.strokeCircle(0, 0, r);
    this.fallbackImage = g;
    this.sprite.add(g);
  }

  private createSelectionRing(): void {
    this.selectionRing = this.scene.add.graphics();
    this.selectionRing.setVisible(false);
    this.selectionRing.setBlendMode(Phaser.BlendModes.ADD);
    this.updateSelectionRingGraphics();
    this.sprite.add(this.selectionRing);
  }

  private updateSelectionRingGraphics(): void {
    if (!this.selectionRing) return;
    this.selectionRing.clear();
    const r = this.scaledRadius;
    this.selectionRing.lineStyle(6, 0xffffff, 0.95);
    this.selectionRing.strokeCircle(0, 0, r + 6);
    this.selectionRing.lineStyle(3, this.faction.color, 1);
    this.selectionRing.strokeCircle(0, 0, r + 10);
  }

  /**
   * Выбор лучшего доступного ключа текстуры (hd, если есть)
   */
  private getBestTextureKey(unitData?: UnitData): string | undefined {
    if (!unitData) return undefined;
    const realTextureKey = getRealUnitTextureKey(this.scene, unitData);
    if (realTextureKey) {
      console.log(`[Unit] Using real texture: ${realTextureKey}`);
      return realTextureKey;
    }

    const baseKey = unitData.assetKey || unitData.id;
    const hdKey = `${baseKey}_512`;
    
    // Пробуем HD версию
    if (this.scene.textures.exists(hdKey)) {
      console.log(`[Unit] Using HD texture: ${hdKey}`);
      return hdKey;
    }
    
    // Пробуем базовую версию
    if (this.scene.textures.exists(baseKey)) {
      console.log(`[Unit] Using base texture: ${baseKey}`);
      return baseKey;
    }
    
    console.warn(`[Unit] ⚠️ Texture NOT FOUND: ${hdKey} or ${baseKey}`);
    return baseKey;
  }

  // 🔥 FIX: Реализуем метод highlight для ShootingController
  highlight(enabled: boolean): void {
    this.setSelected(enabled);
  }

  setSelected(selected: boolean): void {
    if (this.isSelected === selected) return;
    
    // Нельзя выбрать застаненного юнита
    if (selected && this.status === UnitStatus.STUNNED) {
      return;
    }
    
    this.isSelected = selected;
    if (this.selectionRing) this.selectionRing.setVisible(selected);
    if (selected) this.startSelectionPulse();
    else this.stopSelectionPulse();
  }

  private startSelectionPulse(): void {
    this.stopSelectionPulse();
    if (!this.selectionRing) return;
    this.selectionTween = this.scene.tweens.add({
      targets: this.selectionRing,
      scaleX: 1.08,
      scaleY: 1.08,
      alpha: 0.8,
      duration: 350,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private stopSelectionPulse(): void {
    if (this.selectionTween) {
      this.selectionTween.stop();
      this.selectionTween = undefined;
    }
    if (this.selectionRing) {
      this.selectionRing.setScale(1);
      this.selectionRing.setAlpha(1);
    }
  }

  setActiveTeamTurn(active: boolean): void {
    if (this.isActiveTeamTurn === active) return;
    this.isActiveTeamTurn = active;
    
    if (this.unitSprite) {
      this.unitSprite.setAlpha(1);
    }

    this.stopGlowPulse();
    
    if (this.factionGlow) {
      const baseAlpha = active ? 0.35 : 0.15;
      const peakAlpha = active ? 0.65 : 0.3;
      const duration = active ? 1000 : 1600;
      const scaleMax = active ? 1.12 : 1.05;
      
      this.glowTween = this.scene.tweens.add({
        targets: this.factionGlow,
        alpha: { from: baseAlpha, to: peakAlpha },
        scale: { from: 1, to: scaleMax },
        duration: duration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  // ============================================================
  // 🔥 MAIN UPDATE LOOP
  // ============================================================

  update(): void {
    this.limitSpeed();
    
    const { x, y } = this.body.position;
    const vx = this.body.velocity.x;
    const vy = this.body.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);
    
    // 1. Позиция спрайта
    this.sprite.setPosition(Math.round(x), Math.round(y));

    // 2. 🔥 PARALLAX GLOSS
    this.updateGlossParallax(vx, vy);

    // 3. 🔥 GHOST TRAIL
    this.updateGhostTrail(x, y, speed);

    // 4. 🔥 SPEED GLOW
    this.updateSpeedGlow(speed);

    // 5. 🔥 STRETCH
    this.updateStretch(vx, vy, speed);

    // 6. 🔥 SQUASH RECOVERY
    this.updateSquashRecovery();

    // 7. 🔥 DYNAMIC SHADOW (с лагом!)
    this.updateDynamicShadow(vx, vy, speed);

    // 8. 🧬 SHIELD POSITION & VELOCITY SYNC
    this.updateShieldSync();

    // 9. 🧬 SHIELD ROTATION ANIMATION
    this.updateShieldRotation();

    // 10. Якорь у своих ворот (Bunker Bot)
    this.updateAnchorGoalFriction();

    // 11. Xeno: лёгкое «motion blur» через альфу спрайта при скорости
    this.updateInsectSpeedBlur(speed);

    this.lastSpeed = speed;
  }

  /** У ворот своей половины резко повышаем frictionStatic — почти не сдвигается с места */
  private updateAnchorGoalFriction(): void {
    if (this.physicsModifier !== 'anchor_near_own_goal') return;
    if (this.status === UnitStatus.STUNNED) return;

    const h = FIELD.HEIGHT;
    const margin = 110;
    const nearOwn =
      this.owner === 1 ? this.body.position.y > h - margin : this.body.position.y < margin;

    this.scene.matter.body.set(this.body, {
      frictionStatic: nearOwn ? 1 : 0.12,
      friction: nearOwn ? 0.55 : this.stats.friction,
    });
  }

  private updateInsectSpeedBlur(speed: number): void {
    if (this.factionId !== 'insect' || !this.unitSprite) return;
    const t = Phaser.Math.Clamp((speed - 14) / 22, 0, 1);
    this.unitSprite.setAlpha(Phaser.Math.Linear(1, 0.82, t));
  }

  /**
   * Синхронизация позиции И скорости щита с юнитом
   * (Важно для корректного расчёта отскока Matter.js)
   */
  private updateShieldSync(): void {
    if (this.shieldSensor) {
      // Синхронизируем позицию
      this.scene.matter.body.setPosition(this.shieldSensor, this.body.position);
      
      // 🔥 ВАЖНО: Синхронизируем скорость для корректного отскока
      this.scene.matter.body.setVelocity(this.shieldSensor, this.body.velocity);
    }
  }

  /**
   * Анимация вращения энергетических линий щита
   */
  private updateShieldRotation(): void {
    if (this.shieldGraphics && this.status === UnitStatus.SHIELDED) {
      this.shieldRotation += 0.02;
      const r = ABILITY_CONFIG.CYBORG_SHIELD_RADIUS || 55;
      this.drawShieldGraphics(r);
    }
  }

  private updateGlossParallax(vx: number, vy: number): void {
    if (!this.gloss) return;
    
    const shiftX = Phaser.Math.Clamp(-vx * 1.5, -8, 8);
    const shiftY = Phaser.Math.Clamp(-vy * 1.5, -8, 8);
    
    this.gloss.setPosition(shiftX, shiftY);
  }

  private updateGhostTrail(x: number, y: number, speed: number): void {
    if (!this.unitSprite || speed < this.GHOST_MIN_SPEED) return;
    
    // Не создаём шлейф для застаненных юнитов
    if (this.status === UnitStatus.STUNNED) return;
    
    this.ghostTimer += this.scene.game.loop.delta;
    
    if (this.ghostTimer > this.GHOST_INTERVAL) {
      this.ghostTimer = 0;
      this.createGhost(x, y);
    }
  }

  private createGhost(x: number, y: number): void {
    if (!this.unitSprite) return;
    
    // ✅ НОВОЕ: Используем тот же textureKey, что и основной спрайт (с учетом скина)
    const unitData = this.getUnitData();
    let textureKey = unitData?.assetKey;
    const equippedCapId = playerData.getEquippedCapSkinForFaction(this.factionId);
    if (equippedCapId) {
      const capData = getMysticCapById(equippedCapId);
      if (capData && this.scene.textures.exists(capData.assetKey512)) {
        textureKey = capData.assetKey512;
      }
    }
    
    if (!textureKey || !this.scene.textures.exists(textureKey)) return;
    
    const ghost = this.scene.add.image(x, y, textureKey);
    ghost.setScale(this.unitSprite.scale * this.baseScaleX, this.unitSprite.scale * this.baseScaleY);
    ghost.setRotation(0);
    ghost.setAlpha(0.35);
    ghost.setTint(this.faction.color);
    ghost.setBlendMode(Phaser.BlendModes.ADD);
    ghost.setDepth(59);
    
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      scaleX: ghost.scaleX * 0.6,
      scaleY: ghost.scaleY * 0.6,
      duration: 350,
      onComplete: () => ghost.destroy()
    });
  }

  private updateSpeedGlow(speed: number): void {
    if (!this.speedGlow) return;
    
    const threshold = 5;
    const maxSpeed = 20;
    
    if (speed > threshold) {
      const intensity = Phaser.Math.Clamp((speed - threshold) / (maxSpeed - threshold), 0, 1);
      this.speedGlow.setAlpha(intensity * 0.4);
      this.speedGlow.setScale(1 + intensity * 0.3);
    } else {
      this.speedGlow.setAlpha(0);
    }
  }

  private updateStretch(vx: number, vy: number, speed: number): void {
    if (this.isSquashing) return;
    
    const threshold = 4;
    const maxStretch = 0.12;
    
    if (speed > threshold) {
      const intensity = Phaser.Math.Clamp((speed - threshold) / 20, 0, maxStretch);
      
      this.targetScaleX = 1 + intensity * 0.5;
      this.targetScaleY = 1 + intensity * 0.5;
      
    } else {
      this.targetScaleX = 1;
      this.targetScaleY = 1;
    }
    
    this.baseScaleX = Phaser.Math.Linear(this.baseScaleX, this.targetScaleX, 0.2);
    this.baseScaleY = Phaser.Math.Linear(this.baseScaleY, this.targetScaleY, 0.2);
    
    this.sprite.setScale(this.baseScaleX, this.baseScaleY);
    this.sprite.rotation = 0;
  }

  playSquashEffect(intensity: number = 1): void {
    this.isSquashing = true;
    
    const squashAmount = 0.2 * intensity;
    
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 1 + squashAmount,
      scaleY: 1 - squashAmount,
      duration: 50,
      ease: 'Cubic.easeOut',
      yoyo: true,
      onComplete: () => {
        this.isSquashing = false;
        this.sprite.setScale(1);
        this.sprite.rotation = 0; 
      }
    });
  }

  private updateSquashRecovery(): void {
    if (!this.isSquashing) {
      const currentScaleX = this.sprite.scaleX;
      const currentScaleY = this.sprite.scaleY;
      
      if (Math.abs(currentScaleX - this.baseScaleX) > 0.01 || 
          Math.abs(currentScaleY - this.baseScaleY) > 0.01) {
        this.sprite.setScale(
          Phaser.Math.Linear(currentScaleX, this.baseScaleX, 0.1),
          Phaser.Math.Linear(currentScaleY, this.baseScaleY, 0.1)
        );
      }
    }
  }

  /**
   * 🔥 УЛУЧШЕННАЯ ДИНАМИЧЕСКАЯ ТЕНЬ
   * Тень "отстаёт" от юнита при движении, создавая эффект высоты/инерции
   */
  private updateDynamicShadow(vx: number, vy: number, speed: number): void {
    if (!this.dropShadow) return;
    
    // Базовая позиция тени
    const baseX = 4;
    const baseY = 5;
    
    // Целевая позиция тени (противоположно направлению движения)
    const offsetX = Phaser.Math.Clamp(-vx * 0.8, -this.SHADOW_MAX_OFFSET, this.SHADOW_MAX_OFFSET);
    const offsetY = Phaser.Math.Clamp(-vy * 0.8, -this.SHADOW_MAX_OFFSET, this.SHADOW_MAX_OFFSET);
    
    const targetX = baseX + offsetX;
    const targetY = baseY + offsetY;
    
    // Плавное следование (лаг)
    this.shadowTargetX = Phaser.Math.Linear(this.shadowTargetX, targetX, this.SHADOW_LAG_FACTOR);
    this.shadowTargetY = Phaser.Math.Linear(this.shadowTargetY, targetY, this.SHADOW_LAG_FACTOR);
    
    this.dropShadow.setPosition(this.shadowTargetX, this.shadowTargetY);
    
    // Растяжение тени в зависимости от скорости
    const stretchFactor = 1 + speed * 0.015;
    this.dropShadow.setScale(1, stretchFactor);
    
    // Прозрачность уменьшается при высокой скорости (эффект "подъёма")
    const alpha = Phaser.Math.Clamp(0.4 - speed * 0.008, 0.15, 0.4);
    this.dropShadow.setAlpha(alpha);
  }

  playFlashEffect(): void {
    if (!this.factionGlow) return;
    
    const originalAlpha = this.factionGlow.alpha;
    const originalScale = this.factionGlow.scale;
    
    this.scene.tweens.add({
      targets: this.factionGlow,
      alpha: 1,
      scale: 1.5,
      duration: 60,
      yoyo: true,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (this.factionGlow) {
          this.factionGlow.setAlpha(originalAlpha);
          this.factionGlow.setScale(originalScale);
        }
      }
    });
  }

  playHitEffect(): void {
    const speed = this.getSpeed();
    
    if (this.vfxManager) {
      this.vfxManager.playHitEffect(this.x, this.y, this.factionId, speed);
    }

    this.playFlashEffect();
    this.playSquashEffect(Math.min(speed / 15, 1));
  }

  playCollisionEffect(otherFactionColor: number, impactForce: number): void {
    if (this.vfxManager) {
      this.vfxManager.playHitEffect(this.x, this.y, this.factionId, impactForce * 1.5);
    }
    this.playSquashEffect(Math.min(impactForce / 10, 1));
  }

  updateAura(time: number, isActiveTeamTurn: boolean, isSelected: boolean): void {}

  syncSpriteWithBody(): void {
    this.sprite.setPosition(Math.round(this.body.position.x), Math.round(this.body.position.y));
    this.sprite.rotation = 0; 
  }

  private createPhysicsBody(x: number, y: number): void {
    this.body = this.scene.matter.add.circle(x, y, this.scaledRadius, {
      label: `unit_${this.factionId}_${this.capClass}_p${this.owner}`,
      slop: 0.01,
      collisionFilter: {
        category: COLLISION_CATEGORIES.CAP,
        mask: COLLISION_CATEGORIES.WALL | COLLISION_CATEGORIES.CAP | COLLISION_CATEGORIES.BALL | COLLISION_CATEGORIES.LAVA,
      },
    });

    this.scene.matter.body.setMass(this.body, this.stats.mass);
    
    this.scene.matter.body.set(this.body, {
      restitution: this.stats.restitution,
      friction: this.stats.friction,
      frictionAir: this.stats.frictionAir,
      frictionStatic: 0.1,
    });

    if (this.capClass === 'sniper') {
      this.scene.matter.body.set(this.body, {
        restitution: 0.42,
        frictionAir: 0.012,
        frictionStatic: 0.08,
      });
    }

    if (this.capClass === 'trickster') {
      this.scene.matter.body.set(this.body, { frictionStatic: 0.06 });
    }

    this.scene.matter.body.setInertia(this.body, Infinity);

    // Магма: «тяжесть» — выше трение, как камень (глобально для фракции)
    if (this.factionId === 'magma') {
      this.scene.matter.body.set(this.body, {
        frictionStatic: 1,
        friction: 0.5,
      });
    }
  }

  private setupInteractivity(): void {
    this.sprite.setInteractive(
      new Phaser.Geom.Circle(0, 0, this.scaledRadius), 
      Phaser.Geom.Circle.Contains
    );
  }

  setLastHitOffset(offset: number): void { 
    this.lastHitOffset = offset; 
    this.lastShotTime = this.scene.time.now; 
  }
  
  getLastHitOffset(): number { return this.lastHitOffset; }
  hasRecentShot(withinMs = 500): boolean { return this.scene.time.now - this.lastShotTime < withinMs; }
  
  public setPassiveManager(manager: PassiveManager): void {
    this.passiveManager = manager;
  }
  
  getCurveStrength(): number { 
    let curve = this.stats.curveStrength;
    
    if (this.passiveManager) {
      const bonus = this.passiveManager.getCurveBonus(this.unitId);
      curve *= (1 + bonus);
    }
    
    return curve;
  }
  
  canCurve(): boolean { return this.stats.canCurve && this.capClass === 'trickster'; }
  
  getMass(): number {
    let mass = this.stats.mass;
    
    if (this.passiveManager) {
      const modifier = this.passiveManager.getMassModifier(this.unitId);
      mass *= (1 + modifier);
    }
    
    return mass;
  }
  
  getSpeedMultiplier(): number {
    let multiplier = 1.0;
    
    if (this.passiveManager) {
      multiplier += this.passiveManager.getSpeedModifier(this.unitId);
    }
    
    return Math.max(0.5, multiplier); // Minimum 50% speed
  }

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
      const ratio = maxSpeed / speed;
      this.scene.matter.body.setVelocity(this.body, {
        x: this.body.velocity.x * ratio,
        y: this.body.velocity.y * ratio,
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
    this.clearStatus();
    this.abilityCooldown = 0;

    this.scene.matter.body.setPosition(this.body, { x, y });
    this.scene.matter.body.setVelocity(this.body, { x: 0, y: 0 });
    this.scene.matter.body.setAngularVelocity(this.body, 0);
    this.scene.matter.body.setStatic(this.body, false);
    
    this.sprite.setPosition(Math.round(x), Math.round(y));
    this.sprite.setScale(1);
    this.sprite.setAlpha(1);
    this.sprite.rotation = 0; 
    
    this.baseScaleX = 1;
    this.baseScaleY = 1;
    this.targetScaleX = 1;
    this.targetScaleY = 1;
    this.lastHitOffset = 0;
    this.lastShotTime = 0;
    this.lastSpeed = 0;
    this.isSquashing = false;
    this.ghostTimer = 0;
    
    // Сброс позиции тени
    this.shadowTargetX = 4;
    this.shadowTargetY = 5;
    if (this.dropShadow) {
      this.dropShadow.setPosition(4, 5);
      this.dropShadow.setScale(1, 1);
      this.dropShadow.setAlpha(0.4);
    }
    
    this.setSelected(false);
  }

  applyForce(forceX: number, forceY: number): void {
    if (this.status === UnitStatus.STUNNED) {
      console.log(`[Unit ${this.id}] Cannot apply force while stunned`);
      return;
    }

    const maxForce = this.stats.maxForce * 2;
    const forceMag = Math.sqrt(forceX * forceX + forceY * forceY);
    if (forceMag > maxForce) {
      const ratio = maxForce / forceMag;
      forceX *= ratio; 
      forceY *= ratio;
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
  getUnitId(): string { return this.unitId; }
  getPhysicsModifier(): string | undefined { return this.physicsModifier; }
  // ⚠️ REMOVED: getUpgrades() - прокачка убрана
  getStatus(): UnitStatus { return this.status; }
  getAbilityCooldown(): number { return this.abilityCooldown; }

  destroy(): void {
  if (this.isDestroyed) return;
  this.isDestroyed = true;
  
  this.clearStatus();
  this.stopGlowPulse();
    this.stopSelectionPulse();
    if (this.stunSparkEvent) {
      this.stunSparkEvent.remove();
      this.stunSparkEvent = undefined;
    }
    if (this.shieldPulseTween) {
      this.shieldPulseTween.stop();
      this.shieldPulseTween = undefined;
    }
    this.dropShadow?.destroy();
    this.factionGlow?.destroy();
    this.speedGlow?.destroy();
    this.contrastRing?.destroy();
    this.unitSprite?.destroy();
    this.rimLight?.destroy();
    this.selectionRing?.destroy();
    this.gloss?.destroy();
    this.shieldGraphics?.destroy();
    this.stunOverlay?.destroy();
    this.toxinGlow?.destroy();
    this.lavaIndicator?.destroy();
    if (this.shieldSensor) {
      this.scene.matter.world.remove(this.shieldSensor);
    }
    this.sprite.destroy();
    this.scene.matter.world.remove(this.body);
  }

  static resetCounters(): void {
    Unit.team1Counter = 0;
    Unit.team2Counter = 0;
  }
}