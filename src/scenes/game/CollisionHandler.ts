// src/scenes/game/CollisionHandler.ts
// 🔥 JUICY VERSION — Полная интеграция визуальных эффектов
// ✅ ИЗМЕНЕНО: Добавлен ограничитель скорости мяча после отскоков (MAX_SPEED_AFTER_BOUNCE)

import Phaser from 'phaser';
import { FieldBounds } from '../../types';
import { FACTIONS, FactionId, BALL, BALL_SPIN, WALL_PHYSICS } from '../../constants/gameConstants';
import { Ball } from '../../entities/Ball';
import { AudioManager } from '../../managers/AudioManager';
import { FieldRenderer } from '../../renderers/FieldRenderer';
import { PvPDebugLogger } from './PvPDebugLogger';
import { IGameUnit } from './types';
import { PassiveManager } from '../../systems/PassiveManager';
import { Unit } from '../../entities/Unit';
import { eventBus, GameEvents } from '../../core/EventBus';

// Тип для мяча с juice-методами  
interface JuicyBall {
  body: MatterJS.BodyType;
  getSpeed(): number;
  getRadius(): number;
  onHitByUnit?(factionId: FactionId, impactForce: number): void;
  onWallBounce?(impactForce: number): void;
  playSquashEffect?(intensity: number): void;
  applyWallSpin?(wallNormal: { x: number; y: number }, impactSpeed: number, controlBonus: number): void;
  isCornerGoalTrajectory?(): { isActive: boolean; targetGoal: 'top' | 'bottom' | null };
}

export interface CollisionHandlerConfig {
  scene: Phaser.Scene;
  fieldBounds: FieldBounds;
  fieldScale: number;
  isPvPMode: boolean;
  isHost: boolean;
  useFactions: boolean;
  playerFaction?: FactionId;
}

export interface CollisionHandlerCallbacks {
  getBall: () => Ball;
  getCaps: () => IGameUnit[];
  getLastShootingCap: () => IGameUnit | undefined;
  getLastShootingCapId: () => string | undefined;
  getBallSpeedBeforeCollision: () => number;
  setBallSpeedBeforeCollision: (speed: number) => void;
  getGuestLocalPhysicsUntil: () => number;
  setGuestLocalPhysicsUntil: (time: number) => void;
  clearSnapshotBuffer: () => void;
  getFieldRenderer: () => FieldRenderer;
  debug: PvPDebugLogger;
  triggerHaptic: (type: 'light' | 'medium' | 'heavy') => void;
}

export class CollisionHandler {
  private scene: Phaser.Scene;
  private config: CollisionHandlerConfig;
  private callbacks: CollisionHandlerCallbacks;
  private passiveManager: PassiveManager | null = null;
  
  // 🔥 Кэш для отслеживания столкновений
  private recentCollisions: Map<string, number> = new Map();
  private readonly COLLISION_COOLDOWN = 100; // ms между одинаковыми столкновениями
  
  // 🔥 Для screen shake
  private lastShakeTime: number = 0;
  private readonly SHAKE_COOLDOWN = 50;

  // ✅ НОВОЕ: Счётчик быстрых последовательных отскоков (признак "застревания в углу")
  private rapidBounceCount: number = 0;
  private lastBounceTime: number = 0;
  private readonly RAPID_BOUNCE_WINDOW = 150; // ms — если отскоки чаще, это "застревание"
  private readonly RAPID_BOUNCE_THRESHOLD = 3; // После N быстрых отскоков — экстренный damping

  constructor(config: CollisionHandlerConfig, callbacks: CollisionHandlerCallbacks) {
    this.scene = config.scene;
    this.config = config;
    this.callbacks = callbacks;
  }

  setup(): void {
    this.scene.matter.world.on('collisionstart', this.handleCollisionStart, this);
    this.scene.matter.world.on('collisionactive', this.handleCollisionActive, this);
    
    if (import.meta.env.DEV) {
      console.log('[CollisionHandler] 🔥 Juicy collision system initialized');
    }
  }
  
  public setPassiveManager(manager: PassiveManager): void {
    this.passiveManager = manager;
  }

  // ============================================================
  // 🔥 MAIN COLLISION HANDLER
  // ============================================================

  private handleCollisionStart(event: Phaser.Physics.Matter.Events.CollisionStartEvent): void {
    const pairs = event.pairs;

    for (const pair of pairs) {
      const { bodyA, bodyB } = pair;
      const labelA = bodyA.label || '';
      const labelB = bodyB.label || '';

      // Сохраняем скорость мяча до столкновения
      if (labelA === 'ball' || labelB === 'ball') {
        const ball = this.callbacks.getBall();
        this.callbacks.setBallSpeedBeforeCollision(ball.getSpeed());
      }

      // === BALL vs UNIT ===
      if (this.isBallVsUnit(labelA, labelB)) {
        this.handleBallUnitCollision(bodyA, bodyB, labelA, labelB);
      }
      // === UNIT vs UNIT ===
      else if (this.isUnitVsUnit(labelA, labelB)) {
        this.handleUnitUnitCollision(bodyA, bodyB, labelA, labelB);
      }
      // === BALL vs WALL ===
      else if (this.isBallVsWall(labelA, labelB)) {
        this.handleBallWallCollision(bodyA, bodyB, labelA, labelB);
      }
      // === UNIT vs WALL ===
      else if (this.isUnitVsWall(labelA, labelB)) {
        this.handleUnitWallCollision(bodyA, bodyB, labelA, labelB);
      }
      // === BALL vs POST ===
      else if (this.isBallVsPost(labelA, labelB)) {
        this.handleBallPostCollision(bodyA, bodyB);
      }
    }
  }

  private handleCollisionActive(event: Phaser.Physics.Matter.Events.CollisionActiveEvent): void {
    // Для активных столкновений (например, curve force)
    for (const pair of event.pairs) {
      const { bodyA, bodyB } = pair;
      const labelA = bodyA.label || '';
      const labelB = bodyB.label || '';

      if (this.isBallVsUnit(labelA, labelB)) {
        this.applyCurveForce(bodyA, bodyB, labelA, labelB);
      }
    }
  }

  // ============================================================
  // ✅ НОВОЕ: Ограничитель скорости после отскока
  // ============================================================

  /**
   * Применяет мягкий лимит скорости после отскока от стены/штанги.
   * Также детектит "застревание в углу" по частоте отскоков.
   */
  private limitBallSpeedAfterBounce(ball: JuicyBall, isPostHit: boolean = false): void {
    const now = this.scene.time.now;
    
    // ✅ 3.A: Low-speed gate - prevent emergency damping at low speeds
    const vx0 = ball.body.velocity.x;
    const vy0 = ball.body.velocity.y;
    const s0 = Math.sqrt(vx0 * vx0 + vy0 * vy0);

    if (s0 < 3) {
      // Ball is just resting/rolling near wall - ignore rapid bounce detection
      this.rapidBounceCount = 0;
      this.lastBounceTime = now;
      return;
    }

    const timeSinceLastBounce = now - this.lastBounceTime;

    // Детекция быстрых последовательных отскоков (застревание в углу)
    if (timeSinceLastBounce < this.RAPID_BOUNCE_WINDOW) {
      this.rapidBounceCount++;
      
      // ✅ 3.B: Disable emergency damping by raising threshold (keep logic but prevent triggering)
      if (this.rapidBounceCount >= this.RAPID_BOUNCE_THRESHOLD * 10) {
        // Only trigger at extreme corner trap (10x threshold) - effectively disabled for normal cases
          if (import.meta.env.DEV) {
            console.warn(`[CollisionHandler] ⚠️ Extreme rapid bounce detected (${this.rapidBounceCount}x), applying emergency damping`);
          }
        
        const vx = ball.body.velocity.x;
        const vy = ball.body.velocity.y;
        
        // Reduced emergency damping - only for extreme cases
        const emergencyDamping = 0.7;
        this.scene.matter.body.setVelocity(ball.body, {
          x: vx * emergencyDamping,
          y: vy * emergencyDamping,
        });
        
        // Do not zero angular velocity unless absolutely necessary
        // this.scene.matter.body.setAngularVelocity(ball.body, 0);
        
        // Сбрасываем счётчик
        this.rapidBounceCount = 0;
        this.lastBounceTime = now;
        
        return;
      }
    } else {
      // Отскоки не частые — сбрасываем счётчик
      this.rapidBounceCount = 0;
    }

    this.lastBounceTime = now;

    // ✅ 3.C: Immediate clamp with hysteresis (remove delayedCall)
    const vx = ball.body.velocity.x;
    const vy = ball.body.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);

    // Для штанги используем более жёсткий лимит
    const maxSpeed = isPostHit
      ? BALL.MAX_SPEED_AFTER_BOUNCE * 0.85
      : BALL.MAX_SPEED_AFTER_BOUNCE;

    // ✅ 3.C: Hysteresis - only clamp if significantly over limit (5% margin)
    if (speed > maxSpeed * 1.05) {
      const scale = maxSpeed / speed;
      this.scene.matter.body.setVelocity(ball.body, {
        x: vx * scale,
        y: vy * scale,
      });
      
      if (import.meta.env.DEV) {
        console.log(`[CollisionHandler] 🛑 Ball speed clamped after bounce: ${speed.toFixed(1)} → ${maxSpeed.toFixed(1)}`);
      }
    }
  }

  // ============================================================
  // 🔥 BALL vs UNIT — Главное столкновение
  // ============================================================

  private handleBallUnitCollision(
    bodyA: MatterJS.BodyType,
    bodyB: MatterJS.BodyType,
    labelA: string,
    labelB: string
  ): void {
    const ball = this.callbacks.getBall();
    const caps = this.callbacks.getCaps();
    
    const isBallA = labelA === 'ball';
    const unitBody = isBallA ? bodyB : bodyA;
    const ballBody = isBallA ? bodyA : bodyB;

    // Находим юнита
    const unit = caps.find(c => c.body === unitBody);
    if (!unit) return;
    
    // ✅ ПАССИВКА: Проверяем pass-through
    if (ball && ball.consumePassThrough()) {
      // Мяч проходит сквозь юнита
      if (import.meta.env.DEV) {
        console.log('[Collision] Ball passed through unit');
      }
      return;
    }
    
    // ✅ ПАССИВКА: Проверяем slow on hit
    if (ball && this.passiveManager && unit instanceof Unit) {
      const slowEffect = ball.getAndClearSlowOnHit();
      if (slowEffect) {
        // Применяем замедление к юниту
        this.passiveManager.onBallCollision(unit, ball);
      }
    }

    // Проверка кулдауна столкновения
    const collisionKey = `ball_${unit.id}`;
    if (this.isOnCooldown(collisionKey)) return;
    this.setCollisionCooldown(collisionKey);

    // Расчёт силы удара
    const relVelX = ballBody.velocity.x - unitBody.velocity.x;
    const relVelY = ballBody.velocity.y - unitBody.velocity.y;
    const impactSpeed = Math.sqrt(relVelX * relVelX + relVelY * relVelY);
    const impactForce = impactSpeed * (unit.body.mass || 1) * 0.5;

    if (import.meta.env.DEV) {
      console.log(`[Collision] ⚽ Ball hit by ${unit.factionId} unit, force: ${impactForce.toFixed(1)}`);
    }

    // Emit event for tutorial system and VFXManager
    eventBus.emit(GameEvents.COLLISION_BALL_UNIT, {
      unitId: unit.id,
      factionId: unit.factionId,  // ✅ Добавлено для VFXManager
      impactForce,
      position: { x: ballBody.position.x, y: ballBody.position.y },  // ✅ Переименовано из ballPosition
      // Для обратной совместимости с TutorialManager:
      unitOwner: unit.owner,
      unitClass: (unit as any).capClass || 'balanced',
    });

    // 🔥 ВИЗУАЛЬНЫЕ ЭФФЕКТЫ

    // 1. Эффект на юните
    if (unit.playHitEffect) {
      unit.playHitEffect();
    }
    
    if (unit.playSquashEffect) {
      unit.playSquashEffect(Math.min(impactForce / 12, 1));
    }
    
    if (unit.playImpactRing) {
      unit.playImpactRing(Math.min(impactForce / 10, 1.2));
    }

    // 2. Эффект на мяче
    if (ball.onHitByUnit) {
      ball.onHitByUnit(unit.factionId, impactForce);
    } else if (ball.playSquashEffect) {
      ball.playSquashEffect(Math.min(impactForce / 10, 1));
    }

    // 3. Вспышка поля (если есть FieldRenderer)
    this.flashField(unit.factionId);

    // 4. Hit offset для curve
    this.calculateHitOffset(this.callbacks.getBall(), unit);

    // 5. 🔥 AUDIO
    this.playHitSound(impactForce);

    // 6. 🔥 HAPTIC
    this.triggerHaptic(impactForce);

    // 7. 🔥 SCREEN SHAKE для мощных ударов
    if (impactForce > 8) {
      this.screenShake(impactForce);
    }

    // 8. 🔥 HIT STOP для очень мощных ударов
    if (impactForce > 15) {
      this.hitStop(25);
    }

    // ✅ НОВОЕ: Сбрасываем счётчик быстрых отскоков при ударе юнита
    // (удар юнита — это "нормальное" событие, не застревание)
    this.rapidBounceCount = 0;

    // PvP: Сброс синхронизации после удара
    if (this.config.isPvPMode && !this.config.isHost) {
      const guestUntil = this.callbacks.getGuestLocalPhysicsUntil();
      if (guestUntil > 0 && this.scene.time.now < guestUntil) {
        this.callbacks.debug.log('COLLISION', 'Ball-unit collision during local physics');
      }
    }
  }

  // ============================================================
  // 🔥 UNIT vs UNIT — Столкновение юнитов
  // ============================================================

  private handleUnitUnitCollision(
    bodyA: MatterJS.BodyType,
    bodyB: MatterJS.BodyType,
    labelA: string,
    labelB: string
  ): void {
    const caps = this.callbacks.getCaps();

    const unitA = caps.find(c => c.body === bodyA);
    const unitB = caps.find(c => c.body === bodyB);

    if (!unitA || !unitB) return;
    
    // ✅ ПАССИВКА: Обработка столкновений юнитов
    if (this.passiveManager && unitA instanceof Unit && unitB instanceof Unit) {
      this.passiveManager.onUnitCollision(unitA, unitB);
      this.passiveManager.onUnitCollision(unitB, unitA);
    }

    // Кулдаун
    const collisionKey = `unit_${unitA.id}_${unitB.id}`;
    if (this.isOnCooldown(collisionKey)) return;
    this.setCollisionCooldown(collisionKey);

    // Расчёт силы
    const relVelX = bodyA.velocity.x - bodyB.velocity.x;
    const relVelY = bodyA.velocity.y - bodyB.velocity.y;
    const impactSpeed = Math.sqrt(relVelX * relVelX + relVelY * relVelY);
    const impactForce = impactSpeed * 0.8;

    if (impactForce < 2) return; // Игнорируем слабые столкновения

    if (import.meta.env.DEV) {
      console.log(`[Collision] 💥 Unit collision: ${unitA.factionId} vs ${unitB.factionId}, force: ${impactForce.toFixed(1)}`);
    }

    // Точка столкновения (середина между центрами)
    const collisionX = (bodyA.position.x + bodyB.position.x) / 2;
    const collisionY = (bodyA.position.y + bodyB.position.y) / 2;

    // 🔥 ВИЗУАЛЬНЫЕ ЭФФЕКТЫ

    // 1. Эффекты на обоих юнитах
    if (unitA.playCollisionEffect) {
      unitA.playCollisionEffect(unitB.faction.color, impactForce);
    } else {
      if (unitA.playHitEffect) unitA.playHitEffect();
      if (unitA.playSquashEffect) unitA.playSquashEffect(Math.min(impactForce / 10, 0.8));
    }

    if (unitB.playCollisionEffect) {
      unitB.playCollisionEffect(unitA.faction.color, impactForce);
    } else {
      if (unitB.playHitEffect) unitB.playHitEffect();
      if (unitB.playSquashEffect) unitB.playSquashEffect(Math.min(impactForce / 10, 0.8));
    }

    // 2. Искры в точке столкновения
    this.createCollisionSparks(collisionX, collisionY, unitA.factionId, unitB.factionId, impactForce);

    // 3. 🔥 AUDIO
    this.playBumpSound(impactForce);

    // 4. 🔥 HAPTIC
    this.triggerHaptic(impactForce * 0.7);

    // 5. 🔥 SCREEN SHAKE
    if (impactForce > 6) {
      this.screenShake(impactForce * 0.8);
    }
  }

  // ============================================================
  // 🔥 BALL vs WALL — Отскок от стены
  // ============================================================

  private handleBallWallCollision(
    bodyA: MatterJS.BodyType,
    bodyB: MatterJS.BodyType,
    labelA: string,
    labelB: string
  ): void {
    const ball = this.callbacks.getBall() as JuicyBall;
    const speedBefore = this.callbacks.getBallSpeedBeforeCollision();
    const impactForce = speedBefore;

    // Get wall body
    const wallBody = labelA === 'ball' ? bodyB : bodyA;
    const wallLabel = labelA === 'ball' ? labelB : labelA;
    
    // Calculate wall normal
    const wallNormal = this.getWallNormal(wallLabel, ball.body.position);
    
    // === SPIN SYSTEM ===
    // Get control bonus from last shooting unit
    const lastShootingCap = this.callbacks.getLastShootingCap();
    let controlBonus = 0;
    
    if (lastShootingCap) {
      // Base control from unit stats
      const baseControl = (lastShootingCap as any).stats?.control || 0;
      
      // Trickster class bonus
      const isTrickster = (lastShootingCap as any).capClass === 'trickster';
      const tricksterBonus = isTrickster ? BALL_SPIN.TRICKSTER_BONUS : 0;
      
      // Faction bonus (Void has control stat)
      const factionControl = (lastShootingCap as any).faction?.stats?.control || 1;
      const factionBonus = (factionControl - 1) * BALL_SPIN.CONTROL_STAT_WEIGHT; // Void gets ~0.11 bonus
      
      // Upgrade bonus (technique upgrade)
      const upgradeLevel = (lastShootingCap as any).upgrades?.technique || 1;
      const upgradeBonus = (upgradeLevel - 1) * BALL_SPIN.TECHNIQUE_UPGRADE_WEIGHT; // 5% per level
      
      controlBonus = Phaser.Math.Clamp(
        baseControl + tricksterBonus + factionBonus + upgradeBonus,
        0,
        1
      );
    }
    
    // Apply spin
    if (ball.applyWallSpin && impactForce > 5) {
      ball.applyWallSpin(wallNormal, impactForce, controlBonus);
    }
    
    // === CORNER DETECTION ===
    const isCornerHit = this.isCornerZone(ball.body.position);
    if (isCornerHit) {
      this.handleCornerBounce(ball, wallNormal, impactForce, controlBonus);
    }

    // ✅ ДОБАВЛЕНО: Ограничитель скорости после отскока
    this.limitBallSpeedAfterBounce(ball, false);

    if (impactForce < 3) return; // Игнорируем слабые отскоки

    if (import.meta.env.DEV) {
      console.log(`[Collision] 🧱 Ball wall bounce, force: ${impactForce.toFixed(1)}, spin: ${controlBonus.toFixed(2)}`);
    }

    // 🔥 ЭФФЕКТЫ

    // 1. Эффект на мяче
    if (ball.onWallBounce) {
      ball.onWallBounce(impactForce);
    } else if (ball.playSquashEffect) {
      ball.playSquashEffect(Math.min(impactForce / 15, 0.8));
    }

    // 2. Искры на стене
    const ballPos = ball.body.position;
    this.createWallSparks(ballPos.x, ballPos.y, impactForce);

    // 3. Вспышка на линии поля
    this.flashFieldBorder(impactForce);

    // 4. 🔥 AUDIO
    this.playWallSound(impactForce);

    // 5. 🔥 HAPTIC
    if (impactForce > 8) {
      this.callbacks.triggerHaptic('light');
    }

    // 6. 🔥 SCREEN SHAKE
    if (impactForce > 12) {
      this.screenShake(impactForce * 0.5);
    }
  }

  // ============================================================
  // 🔥 UNIT vs WALL
  // ============================================================

  private handleUnitWallCollision(
    bodyA: MatterJS.BodyType,
    bodyB: MatterJS.BodyType,
    labelA: string,
    labelB: string
  ): void {
    const caps = this.callbacks.getCaps();
    const unitBody = labelA.startsWith('unit_') ? bodyA : bodyB;
    
    const unit = caps.find(c => c.body === unitBody);
    if (!unit) return;

    const speed = unit.getSpeed();
    if (speed < 3) return;

    const impactForce = speed * 0.8;

    // Кулдаун
    const collisionKey = `wall_${unit.id}`;
    if (this.isOnCooldown(collisionKey)) return;
    this.setCollisionCooldown(collisionKey);

    if (import.meta.env.DEV) {
      console.log(`[Collision] 🧱 Unit wall bounce: ${unit.factionId}, force: ${impactForce.toFixed(1)}`);
    }

    // 🔥 ЭФФЕКТЫ

    // 1. Squash на юните
    if (unit.playSquashEffect) {
      unit.playSquashEffect(Math.min(impactForce / 12, 0.7));
    }

    // 2. Маленькие искры
    const pos = unit.body.position;
    this.createWallSparks(pos.x, pos.y, impactForce * 0.5, unit.faction.color);

    // 3. 🔥 AUDIO (тихий удар)
    this.playWallSound(impactForce * 0.5);
  }

  // ============================================================
  // 🔥 BALL vs POST — Удар в штангу
  // ============================================================

  private handleBallPostCollision(bodyA: MatterJS.BodyType, bodyB: MatterJS.BodyType): void {
    const ball = this.callbacks.getBall() as JuicyBall;
    const speedBefore = this.callbacks.getBallSpeedBeforeCollision();
    const impactForce = speedBefore * 1.2; // Штанга = больше эффекта

    if (import.meta.env.DEV) {
      console.log(`[Collision] 🥅 BALL HIT POST! force: ${impactForce.toFixed(1)}`);
    }

    // ✅ ДОБАВЛЕНО: Ограничитель скорости после отскока от штанги (более жёсткий)
    this.limitBallSpeedAfterBounce(ball, true);

    // 🔥 ДРАМАТИЧЕСКИЕ ЭФФЕКТЫ

    // 1. Squash
    if (ball.playSquashEffect) {
      ball.playSquashEffect(Math.min(impactForce / 10, 1.2));
    }

    // 2. Большая вспышка
    const pos = ball.body.position;
    this.createPostHitEffect(pos.x, pos.y, impactForce);

    // 3. 🔥 AUDIO — громкий звук штанги
    this.playPostSound(impactForce);

    // 4. 🔥 SCREEN SHAKE — обязательно
    this.screenShake(impactForce * 1.5);

    // 5. 🔥 HIT STOP — драматическая пауза
    this.hitStop(40);

    // 6. 🔥 HAPTIC
    this.callbacks.triggerHaptic('heavy');
  }

  // ============================================================
  // 🔥 CURVE FORCE — Подкрутка мяча
  // ============================================================

  private applyCurveForce(
    bodyA: MatterJS.BodyType,
    bodyB: MatterJS.BodyType,
    labelA: string,
    labelB: string
  ): void {
    const ball = this.callbacks.getBall();
    const lastShootingCap = this.callbacks.getLastShootingCap();

    if (!lastShootingCap) return;
    if (!lastShootingCap.canCurve?.() || !lastShootingCap.hasRecentShot?.()) return;

    const ballVel = ball.body.velocity;
    const curveForce = lastShootingCap.calculateCurveForce?.(ballVel);

    if (curveForce) {
      this.scene.matter.body.applyForce(ball.body, ball.body.position, curveForce);
      
      // 🔥 Визуальный эффект подкрутки
      this.createCurveTrail(ball.body.position.x, ball.body.position.y, lastShootingCap.factionId);
    }
  }

  private calculateHitOffset(ball: Ball, unit: IGameUnit): void {
    const ballPos = ball.body.position;
    const unitPos = unit.body.position;
    
    const dx = ballPos.x - unitPos.x;
    const dy = ballPos.y - unitPos.y;
    
    // Вектор движения мяча
    const ballVel = ball.body.velocity;
    const ballSpeed = Math.sqrt(ballVel.x * ballVel.x + ballVel.y * ballVel.y);
    
    if (ballSpeed < 1) {
      unit.setLastHitOffset(0);
      return;
    }

    // Перпендикуляр к направлению движения
    const perpX = -ballVel.y / ballSpeed;
    const perpY = ballVel.x / ballSpeed;
    
    // Проекция смещения на перпендикуляр
    const offset = (dx * perpX + dy * perpY) / unit.getRadius();
    
    unit.setLastHitOffset(Phaser.Math.Clamp(offset, -1, 1));
  }

  // ============================================================
  // 🔥 VISUAL EFFECTS — Создание эффектов
  // ============================================================

  private createCollisionSparks(
    x: number, 
    y: number, 
    faction1: FactionId, 
    faction2: FactionId, 
    force: number
  ): void {
    const color1 = FACTIONS[faction1].color;
    const color2 = FACTIONS[faction2].color;
    const count = Math.ceil(force * 1.5);

    const texture = this.scene.textures.exists('p_spark') ? 'p_spark' : '__WHITE';

    const particles = this.scene.add.particles(x, y, texture, {
      speed: { min: 60 + force * 5, max: 150 + force * 10 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 300,
      quantity: count,
      tint: [color1, color2, 0xffffff],
      blendMode: 'ADD',
      angle: { min: 0, max: 360 },
    });

    particles.setDepth(101);
    this.scene.time.delayedCall(400, () => particles.destroy());
  }

  private createWallSparks(x: number, y: number, force: number, color: number = 0xffffff): void {
    const count = Math.ceil(force * 0.8);
    const texture = this.scene.textures.exists('p_spark') ? 'p_spark' : '__WHITE';

    const particles = this.scene.add.particles(x, y, texture, {
      speed: { min: 40, max: 120 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 0.9, end: 0 },
      lifespan: 200,
      quantity: count,
      tint: [color, 0xffffff, 0xcccccc],
      blendMode: 'ADD',
      angle: { min: 0, max: 360 },
    });

    particles.setDepth(101);
    this.scene.time.delayedCall(250, () => particles.destroy());
  }

  private createPostHitEffect(x: number, y: number, force: number): void {
    // 1. Большой взрыв искр
    const texture = this.scene.textures.exists('p_spark') ? 'p_spark' : '__WHITE';

    const particles = this.scene.add.particles(x, y, texture, {
      speed: { min: 100, max: 300 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 500,
      quantity: Math.ceil(force * 2),
      tint: [0xffffff, 0xffff00, 0xff8800],
      blendMode: 'ADD',
      angle: { min: 0, max: 360 },
    });

    particles.setDepth(102);
    this.scene.time.delayedCall(600, () => particles.destroy());

    // 2. Расширяющееся кольцо
    const ring = this.scene.add.graphics();
    ring.setDepth(100);
    ring.setBlendMode(Phaser.BlendModes.ADD);

    const ringAnim = { radius: 10, alpha: 1 };
    const maxRadius = 50 + force * 3;

    this.scene.tweens.add({
      targets: ringAnim,
      radius: maxRadius,
      alpha: 0,
      duration: 300,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        ring.clear();
        ring.lineStyle(4, 0xffffff, ringAnim.alpha);
        ring.strokeCircle(x, y, ringAnim.radius);
        ring.lineStyle(2, 0xffff00, ringAnim.alpha * 0.7);
        ring.strokeCircle(x, y, ringAnim.radius * 0.7);
      },
      onComplete: () => ring.destroy(),
    });

    // 3. Вспышка экрана
    this.screenFlash(0xffffff, 0.3, 100);
  }

  private createCurveTrail(x: number, y: number, factionId: FactionId): void {
    const color = FACTIONS[factionId].color;
    const texture = this.scene.textures.exists('p_smoke') ? 'p_smoke' : '__WHITE';

    const particles = this.scene.add.particles(x, y, texture, {
      speed: { min: 20, max: 50 },
      scale: { start: 0.5, end: 0.1 },
      alpha: { start: 0.4, end: 0 },
      lifespan: 400,
      quantity: 3,
      tint: color,
      blendMode: 'ADD',
    });

    particles.setDepth(49);
    this.scene.time.delayedCall(500, () => particles.destroy());
  }

  // ============================================================
  // 🔥 FIELD EFFECTS
  // ============================================================

  private flashField(factionId: FactionId): void {
    const fieldRenderer = this.callbacks.getFieldRenderer();
    if (fieldRenderer && typeof (fieldRenderer as any).flashField === 'function') {
      (fieldRenderer as any).flashField(factionId);
    }
  }

  private flashFieldBorder(intensity: number): void {
    const fieldRenderer = this.callbacks.getFieldRenderer();
    if (fieldRenderer && typeof (fieldRenderer as any).flashBorder === 'function') {
      (fieldRenderer as any).flashBorder(intensity);
    }
  }

  // ============================================================
  // 🔥 SCREEN EFFECTS
  // ============================================================

  private screenShake(force: number): void {
    const now = this.scene.time.now;
    if (now - this.lastShakeTime < this.SHAKE_COOLDOWN) return;
    this.lastShakeTime = now;

    const intensity = Phaser.Math.Clamp(force * 0.0008, 0.002, 0.015);
    const duration = Phaser.Math.Clamp(force * 5, 40, 150);

    this.scene.cameras.main.shake(duration, intensity);
  }

  private hitStop(ms: number): void {
    // Кратковременная пауза физики для драматизма
    this.scene.matter.world.pause();
    
    this.scene.time.delayedCall(ms, () => {
      this.scene.matter.world.resume();
    });
  }

  private screenFlash(color: number, alpha: number, duration: number): void {
    const { width, height } = this.scene.cameras.main;
    
    const flash = this.scene.add.rectangle(
      width / 2, height / 2, width, height, color, 0
    );
    flash.setScrollFactor(0).setDepth(999);

    this.scene.tweens.add({
      targets: flash,
      alpha: { from: alpha, to: 0 },
      duration: duration,
      ease: 'Cubic.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  // ============================================================
  // 🔥 AUDIO
  // ============================================================

  private playHitSound(force: number): void {
    const audio = AudioManager.getInstance();
    const volume = Phaser.Math.Clamp(0.3 + force * 0.05, 0.3, 1.0);
    
    audio.playSFX('sfx_kick', { volume });
    
    // Дополнительный звук для мощных ударов
    if (force > 12) {
      audio.playSFX('sfx_impact', { volume: volume * 0.7, delay: 0.02 });
    }
  }

  private playBumpSound(force: number): void {
    const audio = AudioManager.getInstance();
    const volume = Phaser.Math.Clamp(0.2 + force * 0.04, 0.2, 0.7);
    
    audio.playSFX('sfx_bump', { volume });
  }

  private playWallSound(force: number): void {
    const audio = AudioManager.getInstance();
    const volume = Phaser.Math.Clamp(0.2 + force * 0.03, 0.2, 0.6);
    
    audio.playSFX('sfx_wall', { volume });
  }

  private playPostSound(force: number): void {
    const audio = AudioManager.getInstance();
    
    // Звук штанги — громкий и резонирующий
    audio.playSFX('sfx_post', { volume: 1.0 });
    
    // Дополнительный металлический звон
    audio.playSFX('sfx_clang', { volume: 0.8, delay: 0.05 });
  }

  // ============================================================
  // 🔥 HAPTIC
  // ============================================================

  private triggerHaptic(force: number): void {
    if (force > 10) {
      this.callbacks.triggerHaptic('heavy');
    } else if (force > 5) {
      this.callbacks.triggerHaptic('medium');
    } else if (force > 2) {
      this.callbacks.triggerHaptic('light');
    }
  }

  // ============================================================
  // ✅ NEW: SPIN & CORNER SYSTEM
  // ============================================================

  /**
   * Get the outward-facing normal of a wall based on its label and ball position
   */
  private getWallNormal(
    wallLabel: string, 
    ballPos: { x: number; y: number }
  ): { x: number; y: number } {
    const bounds = this.config.fieldBounds;
    
    // Handle corner zones
    if (wallLabel.includes('corner')) {
      // Diagonal normal for corners (45°)
      if (wallLabel.includes('tl')) return { x: 0.707, y: 0.707 };
      if (wallLabel.includes('tr')) return { x: -0.707, y: 0.707 };
      if (wallLabel.includes('bl')) return { x: 0.707, y: -0.707 };
      if (wallLabel.includes('br')) return { x: -0.707, y: -0.707 };
    }
    
    // Determine which wall based on position
    const distToLeft = Math.abs(ballPos.x - bounds.left);
    const distToRight = Math.abs(ballPos.x - bounds.right);
    const distToTop = Math.abs(ballPos.y - bounds.top);
    const distToBottom = Math.abs(ballPos.y - bounds.bottom);
    
    const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);
    
    // Standard walls
    if (minDist === distToLeft) return { x: 1, y: 0 };
    if (minDist === distToRight) return { x: -1, y: 0 };
    if (minDist === distToTop) return { x: 0, y: 1 };
    if (minDist === distToBottom) return { x: 0, y: -1 };
    
    return { x: 0, y: 1 }; // Default
  }

  /**
   * Check if position is in a corner zone
   */
  private isCornerZone(pos: { x: number; y: number }): boolean {
    const bounds = this.config.fieldBounds;
    const cornerSize = BALL_SPIN.CORNER_ZONE_SIZE * this.config.fieldScale;
    
    const nearLeft = pos.x < bounds.left + cornerSize;
    const nearRight = pos.x > bounds.right - cornerSize;
    const nearTop = pos.y < bounds.top + cornerSize;
    const nearBottom = pos.y > bounds.bottom - cornerSize;
    
    return (nearLeft || nearRight) && (nearTop || nearBottom);
  }

  /**
   * Special handling for corner bounces
   */
  private handleCornerBounce(
    ball: JuicyBall,
    wallNormal: { x: number; y: number },
    impactForce: number,
    controlBonus: number
  ): void {
    // Additional spin in corners
    if (ball.applyWallSpin) {
      ball.applyWallSpin(wallNormal, impactForce * BALL_SPIN.CORNER_SPIN_MULTIPLIER, controlBonus * 1.2);
    }
    
    // Apply slight "guiding" force toward center of field
    const bounds = this.config.fieldBounds;
    const ballPos = ball.body.position;
    
    const toCenterX = bounds.centerX - ballPos.x;
    const toCenterY = bounds.centerY - ballPos.y;
    const toCenterDist = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);
    
    if (toCenterDist > 0) {
      const guideForce = 0.0005 * impactForce;
      this.scene.matter.body.applyForce(ball.body, ball.body.position, {
        x: (toCenterX / toCenterDist) * guideForce,
        y: (toCenterY / toCenterDist) * guideForce,
      });
    }
    
    // VFX for corner bounce
    this.createCornerSparks(ballPos.x, ballPos.y, impactForce);
  }

  /**
   * Create corner-specific VFX
   */
  private createCornerSparks(x: number, y: number, force: number): void {
    const count = Math.ceil(force * 1.2);
    const texture = this.scene.textures.exists('p_spark') ? 'p_spark' : '__WHITE';

    const particles = this.scene.add.particles(x, y, texture, {
      speed: { min: 50, max: 150 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 300,
      quantity: count,
      tint: [0x00ffff, 0xff00ff, 0xffffff], // Spin colors
      blendMode: 'ADD',
      angle: { min: 0, max: 360 },
    });

    particles.setDepth(101);
    this.scene.time.delayedCall(350, () => particles.destroy());
  }

  /**
   * Called when ball enters goal after corner trajectory
   * Plays special sound sequence
   */
  private playCornerGoalSequence(): void {
    const audio = AudioManager.getInstance();
    
    // First: Post hit sound
    audio.playSFX('sfx_post', { volume: 0.8 });
    
    // Then after delay: Goal sound
    this.scene.time.delayedCall(150, () => {
      audio.playSFX('sfx_goal_dramatic', { volume: 1.0 });
    });
    
    // Haptic sequence
    this.callbacks.triggerHaptic('medium');
    this.scene.time.delayedCall(100, () => {
      this.callbacks.triggerHaptic('heavy');
    });
  }

  // ============================================================
  // COLLISION DETECTION HELPERS
  // ============================================================

  private isBallVsUnit(labelA: string, labelB: string): boolean {
    return (labelA === 'ball' && labelB.startsWith('unit_')) ||
           (labelB === 'ball' && labelA.startsWith('unit_'));
  }

  private isUnitVsUnit(labelA: string, labelB: string): boolean {
    return labelA.startsWith('unit_') && labelB.startsWith('unit_');
  }

  private isBallVsWall(labelA: string, labelB: string): boolean {
    return (labelA === 'ball' && (labelB === 'wall' || labelB.startsWith('wall_') || labelB.startsWith('corner_'))) ||
           (labelB === 'ball' && (labelA === 'wall' || labelA.startsWith('wall_') || labelA.startsWith('corner_')));
  }

  /**
   * ✅ 4: Fix unit-wall collision detection by matching actual labels used in GameSceneSetup
   */
  private isUnitVsWall(labelA: string, labelB: string): boolean {
    const isWall = (l: string) =>
      l === 'wall' || l.startsWith('wall_') || l.startsWith('corner_') || l === 'post';

    return (labelA.startsWith('unit_') && isWall(labelB)) ||
           (labelB.startsWith('unit_') && isWall(labelA));
  }

  private isBallVsPost(labelA: string, labelB: string): boolean {
    return (labelA === 'ball' && labelB === 'post') ||
           (labelB === 'ball' && labelA === 'post');
  }

  // ============================================================
  // COOLDOWN MANAGEMENT
  // ============================================================

  private isOnCooldown(key: string): boolean {
    const lastTime = this.recentCollisions.get(key);
    if (!lastTime) return false;
    return this.scene.time.now - lastTime < this.COLLISION_COOLDOWN;
  }

  private setCollisionCooldown(key: string): void {
    this.recentCollisions.set(key, this.scene.time.now);
    
    // Очистка старых записей
    if (this.recentCollisions.size > 50) {
      const now = this.scene.time.now;
      this.recentCollisions.forEach((time, k) => {
        if (now - time > 1000) {
          this.recentCollisions.delete(k);
        }
      });
    }
  }

  // ============================================================
  // CLEANUP
  // ============================================================

  destroy(): void {
    const world = this.scene.matter?.world;
    if (world) {
      world.off('collisionstart', this.handleCollisionStart, this);
      world.off('collisionactive', this.handleCollisionActive, this);
      // Убеждаемся, что все события отписаны
      // Если используется collisionend, добавьте:
      // world.off('collisionend', this.handleCollisionEnd, this);
    }
    
    // Очистка ссылок
    this.recentCollisions.clear();
    this.scene = null as any;
  }
}