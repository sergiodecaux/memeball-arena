// src/systems/PassiveManager.ts
// Менеджер пассивных способностей

import Phaser from 'phaser';
import { Unit } from '../entities/Unit';
import { Ball } from '../entities/Ball';
import { getUnitById, getUnitPassive, getUnitPhysicsModifier } from '../data/UnitsRepository';
import { FactionId, PLAYMAKER_PASS_RADIUS, PASSIVE_SKILL_COOLDOWN, PASSIVE_DRIBBLE_ACTIVATION_RADIUS } from '../constants/gameConstants';
import { 
  PassiveType, 
  PassiveAbility, 
  PassiveParams,
  ActivePassiveEffect,
  UnitPassiveState,
  MatchPassiveState,
  PassiveCondition 
} from '../types/passives';
import { eventBus, GameEvents } from '../core/EventBus';
import type { FieldBounds } from '../types';

/** Модификаторы карты от пассивок `card_enhance` */
export interface CardEnhancement {
  radiusBonus: number;
  durationBonus: number;
  special: string | null;
  /** Пиксели радиуса притяжения мяча (Wormhole / Затмение), не проценты */
  attractRadiusPx?: number;
}

export class PassiveManager extends Phaser.Events.EventEmitter {
  private scene: Phaser.Scene;
  private readonly getFieldBounds: () => FieldBounds;
  private state: MatchPassiveState;
  private units: Map<string, Unit> = new Map();
  private ball: Ball | null = null;
  /** Эффекты мяча от пассивок (slow_on_hit и т.д.) — раньше только слали событие без хранения */
  private ballPassiveEffects = new Map<string, { value: number; sourceUnitId: string }>();
  /** Анти-спам подсказок для аур, влияющих на мяч (гравитация / притягивание) */
  private lastBallAuraTipAtMs = 0;
  /** Анти-спам для stat_boost-пассивок при каждом ударе */
  private lastStatBoostPingAt = new Map<string, number>();
  /** Playmaker: множитель силы следующего удара получателя паса (по runtime id юнита) */
  private magneticNextShotMulByReceiverRuntimeId = new Map<string, number>();
  /** Нокаут: анти-спам по жертве (мс), чтобы не дергать Matter несколько раз подряд */
  private knockoutVictimUntilMs = new Map<string, number>();
  /** Tweens притягивания мяча перед интерактивным дриблингом */
  private dribbleAttractTweens = new Map<string, Phaser.Tweens.Tween>();

  /** Блок HUD для управления дриблингом (экранные координаты) */
  private interactiveDribbleHudBlock?: (screenX: number, screenY: number) => boolean;

  private readonly interactiveDribble = new Map<
    string,
    {
      unit: Unit;
      ball: Ball;
      passive: PassiveAbility;
      angleRef: { v: number };
      dragging: { v: boolean };
      pointerMove: (p: Phaser.Input.Pointer) => void;
      pointerDown: (p: Phaser.Input.Pointer) => void;
      pointerUp: (p: Phaser.Input.Pointer) => void;
      linkUpdater: () => void;
      aimLine: Phaser.GameObjects.Line;
      aimArrow: Phaser.GameObjects.Triangle;
      linkLine: Phaser.GameObjects.Line;
      linkPulseTween?: Phaser.Tweens.Tween;
      timer: Phaser.Time.TimerEvent | null;
    }
  >();

  /** Playmaker: прицеливание без оверлея */
  private magneticPassAttractTween: Phaser.Tweens.Tween | null = null;
  private magneticPassSession: {
    passer: Unit;
    ball: Ball;
    passive: PassiveAbility;
    targets: Unit[];
    highlights: Phaser.GameObjects.Arc[];
    labels: Phaser.GameObjects.Text[];
    aimLine: Phaser.GameObjects.Line;
    aimArrow: Phaser.GameObjects.Triangle;
    hint: Phaser.GameObjects.Text;
    pointerMove: (p: Phaser.Input.Pointer) => void;
    pointerDown: (p: Phaser.Input.Pointer) => void;
  } | null = null;

  /** Стабильные ссылки для корректной отписки в destroy() */
  private readonly boundOnGoalScored = this.onGoalScored.bind(this);
  private readonly boundOnTurnStarted = this.onTurnStarted.bind(this);
  private readonly boundOnTurnEnded = this.onTurnEnded.bind(this);
  /** Баффы позиционных пассивок (своя половина / защита ворот), пересчитываются каждый ход */
  private static readonly POSITIONAL_BUFF_PREFIX = '__pos__';

  constructor(scene: Phaser.Scene, getFieldBounds: () => FieldBounds) {
    super();
    this.scene = scene;
    this.getFieldBounds = getFieldBounds;
    this.state = this.createInitialState();
    this.setupEventListeners();
  }
  
  // ========== ИНИЦИАЛИЗАЦИЯ ==========
  
  private createInitialState(): MatchPassiveState {
    return {
      units: {},
      activeAuras: [],
      turnsSinceLastGoal: 0,
      lastGoalScoredBy: null,
    };
  }
  
  public registerUnit(unit: Unit): void {
    const unitId = unit.getUnitId();
    this.units.set(unitId, unit);

    if (!this.state.units[unitId]) {
      this.state.units[unitId] = {
        unitId,
        shotCount: 0,
        hasUsedOncePerMatch: false,
        currentStacks: {},
        activeBuffs: [],
        activeDebuffs: [],
      };
    }

    if (import.meta.env.DEV) {
      console.log(`[PassiveManager] Registered unit: ${unitId}`);
    }
  }

  public unregisterUnit(unitId: string): void {
    this.units.delete(unitId);
    delete this.state.units[unitId];
  }

  public registerBall(ball: Ball): void {
    this.ball = ball;
  }
  
  private setupEventListeners(): void {
    eventBus.on(GameEvents.GOAL_SCORED, this.boundOnGoalScored);
    eventBus.on(GameEvents.TURN_STARTED, this.boundOnTurnStarted);
    eventBus.on(GameEvents.TURN_ENDED, this.boundOnTurnEnded);
  }
  
  // ========== СОБЫТИЯ МАТЧА ==========
  
  private onGoalScored(data: { scoringPlayer: number }): void {
    this.state.lastGoalScoredBy = data.scoringPlayer;
    this.state.turnsSinceLastGoal = 0;
    
    // Обработка пассивок "после гола"
    this.units.forEach((unit, unitId) => {
      const passive = this.getUnitPassive(unitId);
      // ✅ getUnitPassive всегда возвращает PassiveAbility (с fallback)
      
      const isOwnGoal = data.scoringPlayer === this.getUnitOwner(unit);
      
      if (passive.params.condition === 'after_goal' && isOwnGoal) {
        this.applyConditionalPassive(unit, passive, 'after_goal');
      }
      
      if (passive.params.condition === 'goal_conceded' && !isOwnGoal) {
        if (passive.name === 'Возрождение феникса') {
          const st = this.state.units[unitId];
          if (st && !st.hasUsedOncePerMatch) {
            st.hasUsedOncePerMatch = true;
            this.teleportToOwnGoal(unit);
            this.showPassiveActivation(unit, passive.name, 0xff9933);
          }
        } else {
          this.applyConditionalPassive(unit, passive, 'goal_conceded');
        }
      }
      
      // Risk/Reward пассивки (например, Ragnaros)
      if (passive.type === 'risk_reward' && (passive.params.condition === 'after_goal' || passive.params.condition === 'goal_conceded')) {
        this.applyRiskRewardOnGoal(unit, passive, isOwnGoal);
      }
    });
  }
  
  private onTurnStarted(_data: { player?: number; turnNumber?: number }): void {
    this.state.turnsSinceLastGoal++;
    
    // Обновляем ауры
    this.updateAuras();
    
    // Проверяем условие "no_goal_3_turns"
    if (this.state.turnsSinceLastGoal >= 3) {
      this.units.forEach((unit, unitId) => {
        const passive = this.getUnitPassive(unitId);
        if (passive?.params.condition === 'no_goal_3_turns') {
          this.applyConditionalPassive(unit, passive, 'no_goal_3_turns');
        }
      });
    }
  }
  
  private onTurnEnded(_data: { player?: number; turnNumber?: number }): void {
    // Уменьшаем длительность эффектов
    this.tickEffectDurations();
  }

  private stripPositionalBuffs(unitId: string): void {
    const st = this.state.units[unitId];
    if (!st) return;
    st.activeBuffs = st.activeBuffs.filter(
      (b) => !b.sourceUnitId.startsWith(PassiveManager.POSITIONAL_BUFF_PREFIX)
    );
  }

  private updatePositionalPassives(): void {
    this.units.forEach((unit, unitId) => {
      const passive = this.getUnitPassive(unitId);
      if (!passive || passive.type !== 'conditional') return;

      this.stripPositionalBuffs(unitId);

      const cond = passive.params.condition;
      if (cond === 'own_half' && this.isOnOwnHalf(unit)) {
        const src = `${PassiveManager.POSITIONAL_BUFF_PREFIX}own_${unitId}`;
        this.applyBuff(unit, 'defense', passive.params.value ?? 0.15, 1, src);
      }
      if (cond === 'defending' && this.isDefending(unit) && passive.name === 'Био-крепость') {
        const src = `${PassiveManager.POSITIONAL_BUFF_PREFIX}def_${unitId}`;
        this.applyBuff(unit, 'mass', passive.params.value ?? 0.3, 1, src);
      }
    });
  }

  // ========== ОБРАБОТКА УДАРА ПО МЯЧУ ==========
  
  public onBallHit(unit: Unit, force: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const unitId = unit.getUnitId();
    const passive = this.getUnitPassive(unitId);
    const unitState = this.state.units[unitId];

    const tagBallPhysics = () => {
      if (this.ball) {
        this.ball.applyShotPhysicsModifier(getUnitPhysicsModifier(unitId));
      }
    };

    if (!passive || !unitState) {
      tagBallPhysics();
      return force;
    }
    
    // Увеличиваем счётчик ударов
    unitState.shotCount++;

    let modifiedForce = force.clone();

    switch (passive.type) {
      case 'on_hit_ball':
        modifiedForce = this.applyOnHitBall(unit, force, passive);
        break;

      case 'dribbling':
        if (!unit.isMagneticDribbleActive()) {
          modifiedForce = this.applyMaestroDribblingShot(unit, modifiedForce, passive);
        }
        break;

      case 'conditional':
        modifiedForce = this.applyConditionalOnHit(unit, force, passive, unitState);
        break;

      case 'risk_reward':
        modifiedForce = this.applyRiskRewardOnHit(unit, force, passive);
        break;

      case 'stat_boost':
        modifiedForce = this.applyStatBoostOnHit(unit, force, passive);
        break;
    }
    
    // Проверяем условия "every_Nth_shot"
    if (passive.params.condition === 'every_2nd_shot' && unitState.shotCount % 2 === 0) {
      modifiedForce = this.applyEveryNthShot(unit, modifiedForce, passive);
    }
    if (passive.params.condition === 'every_3rd_shot' && unitState.shotCount % 3 === 0) {
      modifiedForce = this.applyEveryNthShot(unit, modifiedForce, passive);
    }
    
    // Применяем бонусы от активных баффов
    modifiedForce = this.applyActiveBuffsToForce(unitId, modifiedForce);

    const magMul = this.magneticNextShotMulByReceiverRuntimeId.get(unit.id);
    if (magMul !== undefined) {
      modifiedForce.scale(Math.max(0.08, magMul));
      this.magneticNextShotMulByReceiverRuntimeId.delete(unit.id);
      this.showPassiveActivation(unit, 'Магнитный пас!', 0x44ff88);
    }

    tagBallPhysics();
    
    return modifiedForce;
  }
  
  private applyOnHitBall(unit: Unit, force: Phaser.Math.Vector2, passive: PassiveAbility): Phaser.Math.Vector2 {
    const params = passive.params;
    let modifiedForce = force.clone();
    
    // Rocket Gunner: отталкивает ближайшего врага
    if (passive.name === 'Реактивный залп') {
      if (this.pushNearestEnemy(unit, params.radius || 60, params.value || 30)) {
        this.showPassiveActivation(unit, passive.name);
      }
    }
    
    // Lava Sniper: мяч проходит сквозь первого врага
    if (passive.name === 'Расплавление') {
      this.setBallPassThrough(1);
      this.showPassiveActivation(unit, passive.name, 0xff5522);
    }

    // Venom: мяч замедляет первого врага
    if (passive.name === 'Коррозийный выстрел') {
      this.setBallSlowOnHit(unit, params.value || 0.10);
      this.showPassiveActivation(unit, passive.name, 0x66ff88);
    }
    
    return modifiedForce;
  }
  
  private applyConditionalOnHit(
    unit: Unit, 
    force: Phaser.Math.Vector2, 
    passive: PassiveAbility,
    unitState: UnitPassiveState
  ): Phaser.Math.Vector2 {
    const params = passive.params;
    let modifiedForce = force.clone();
    const condition = params.condition;
    
    // First hit bonus
    if (condition === 'first_hit' && unitState.shotCount === 1) {
      const powerBonus = 1 + (params.value || 0.20);
      modifiedForce.scale(powerBonus);
      this.showPassiveActivation(unit, passive.name);
    }
    
    // Enemy half bonus
    if (condition === 'enemy_half' && this.isOnEnemyHalf(unit)) {
      const bonus = 1 + (params.value || 0.10);
      modifiedForce.scale(bonus);
      this.showPassiveActivation(unit, passive.name, 0xffee66);
    }
    
    return modifiedForce;
  }
  
  private applyRiskRewardOnHit(unit: Unit, force: Phaser.Math.Vector2, passive: PassiveAbility): Phaser.Math.Vector2 {
    const params = passive.params;
    let modifiedForce = force.clone();
    
    // Solar Striker: 20% крит +40%, 10% провал -20%
    if (passive.name === 'Солнечная вспышка') {
      const roll = Math.random();
      if (roll < 0.20) {
        modifiedForce.scale(1.40);
        this.showPassiveActivation(unit, 'КРИТ!', 0xffff00);
      } else if (roll < 0.30) {
        modifiedForce.scale(0.80);
        this.showPassiveActivation(unit, 'Провал...', 0xff0000);
      }
    }
    
    // Wild Hellion: +25% curve, -5% accuracy (accuracy handled in ShootingController)
    if (passive.name === 'Хаотичное пламя') {
      const uid = unit.getUnitId();
      const now = Date.now();
      const prev = this.lastStatBoostPingAt.get(uid) || 0;
      if (now - prev > 2800) {
        this.lastStatBoostPingAt.set(uid, now);
        this.showPassiveActivation(unit, passive.name, 0xff7733);
      }
    }
    
    // Schrodinger: 40% телепорт после удара
    if (passive.name === 'Квантовая суперпозиция' && Math.random() < 0.40) {
      this.scheduleUnitTeleport(unit);
      this.showPassiveActivation(unit, 'Телепорт!', 0x00ffff);
    }
    
    // Entropy: 30% телепорт случайного врага
    if (passive.name === 'Шторм энтропии' && Math.random() < 0.30) {
      this.teleportRandomEnemy(unit);
      this.showPassiveActivation(unit, 'Хаос!', 0xa855f7);
    }
    
    return modifiedForce;
  }
  
  private applyStatBoostOnHit(unit: Unit, force: Phaser.Math.Vector2, passive: PassiveAbility): Phaser.Math.Vector2 {
    // Curve/mass применяются в Unit / матче — показываем реже, чтобы не забивать экран
    if (passive.name !== 'Стабильность') {
      const uid = unit.getUnitId();
      const now = Date.now();
      const prev = this.lastStatBoostPingAt.get(uid) || 0;
      if (now - prev > 2800) {
        this.lastStatBoostPingAt.set(uid, now);
        this.showPassiveActivation(unit, passive.name, 0xddddff);
      }
    }
    return force;
  }
  
  private applyEveryNthShot(unit: Unit, force: Phaser.Math.Vector2, passive: PassiveAbility): Phaser.Math.Vector2 {
    let modifiedForce = force.clone();
    
    // Omega Sniper: каждый 3-й удар +25%
    if (passive.name === 'Омега-удар') {
      modifiedForce.scale(1.25);
      this.showPassiveActivation(unit, 'Омега!', 0x00f2ff);
    }
    
    // Quasar: каждый 2-й удар проходит сквозь врага
    if (passive.name === 'Луч квазара') {
      this.setBallPassThrough(1);
      this.showPassiveActivation(unit, 'Пронзание!', 0x9d00ff);
    }
    
    return modifiedForce;
  }
  
  private applyMaestroDribblingShot(
    unit: Unit,
    force: Phaser.Math.Vector2,
    passive: PassiveAbility,
  ): Phaser.Math.Vector2 {
    const out = force.clone();
    const penalty = passive.params.speedPenalty ?? 0.4;
    const b = this.getFieldBounds();
    const cx = b.centerX;
    const enemyGoalY = unit.owner === 1 ? b.top + 35 : b.bottom - 35;
    const toGoal = new Phaser.Math.Vector2(cx - unit.body.position.x, enemyGoalY - unit.body.position.y).normalize();
    const blend = 0.09 + (passive.params.value ?? 0);
    out.x += toGoal.x * out.length() * blend;
    out.y += toGoal.y * out.length() * blend;
    out.scale(1 - penalty * 0.22);
    this.showPassiveActivation(unit, passive.name, 0xfbbf24);
    return out;
  }

  /** Playmaker: быстрая передача мяча союзнику и ослабленный «добивающий» удар получателя */
  public executeMagneticPass(passer: Unit, receiver: Unit, ball: Ball): void {
    const passive = this.getUnitPassive(passer.getUnitId());
    if (passive.type !== 'magnetic_pass') return;

    const maxR = passive.params.passRadius ?? PLAYMAKER_PASS_RADIUS;
    const bx = ball.body.position.x;
    const by = ball.body.position.y;
    const px = passer.body.position.x;
    const py = passer.body.position.y;
    if (Phaser.Math.Distance.Between(px, py, bx, by) > maxR) return;

    this.pullBallToPasser(passer, ball, () => {
      if (passer.isDestroyed || ball.isDestroyed || receiver.isDestroyed) return;
      this.tweenDeliverMagneticPass(passer, receiver, ball, passive, receiver.owner === passer.owner);
    });
  }

  /**
   * Playmaker (локально): притянуть мяч, затем прицеливание по всем фишкам; клик — пас ближайшей цели.
   */
  public beginMagneticPassTargeting(passer: Unit, ball: Ball): boolean {
    const passive = this.getUnitPassive(passer.getUnitId());
    if (passive.type !== 'magnetic_pass') return false;
    if (passer.getMagneticPassCooldownTurns() > 0) return false;

    const maxR = passive.params.passRadius ?? PLAYMAKER_PASS_RADIUS;
    const bx = ball.body.position.x;
    const by = ball.body.position.y;
    const px = passer.body.position.x;
    const py = passer.body.position.y;
    const dist = Phaser.Math.Distance.Between(px, py, bx, by);
    if (dist > maxR) {
      this.scene.events.emit('magnetic-pass-failed', { reason: 'too_far', distance: dist });
      return false;
    }

    this.cancelMagneticPassSession();

    const goal = this.enemyGoalPoint(passer);
    const ang = Phaser.Math.Angle.Between(px, py, goal.x, goal.y);
    const lead = 30;
    const targetBx = px + Math.cos(ang) * lead;
    const targetBy = py + Math.sin(ang) * lead;

    const matter = this.scene.matter;
    const pull = { x: bx, y: by };
    this.magneticPassAttractTween = this.scene.tweens.add({
      targets: pull,
      x: targetBx,
      y: targetBy,
      duration: 300,
      ease: 'Power2',
      onUpdate: () => {
        matter.body.setVelocity(ball.body, { x: 0, y: 0 });
        matter.body.setAngularVelocity(ball.body, 0);
        matter.body.setPosition(ball.body, { x: pull.x, y: pull.y });
      },
      onComplete: () => {
        this.magneticPassAttractTween = null;
        if (passer.isDestroyed || ball.isDestroyed) return;
        matter.body.setVelocity(ball.body, { x: 0, y: 0 });
        matter.body.setAngularVelocity(ball.body, 0);
        this.enterMagneticPassAimMode(passer, ball, passive);
      },
    });

    return true;
  }

  private pullBallToPasser(passer: Unit, ball: Ball, onComplete: () => void): void {
    const matter = this.scene.matter;
    const bx = ball.body.position.x;
    const by = ball.body.position.y;
    const px = passer.body.position.x;
    const py = passer.body.position.y;

    const pullToPasser = { x: bx, y: by };
    this.scene.tweens.add({
      targets: pullToPasser,
      x: px,
      y: py,
      duration: 220,
      ease: 'Quad.Out',
      onUpdate: () => {
        matter.body.setVelocity(ball.body, { x: 0, y: 0 });
        matter.body.setAngularVelocity(ball.body, 0);
        matter.body.setPosition(ball.body, { x: pullToPasser.x, y: pullToPasser.y });
      },
      onComplete: () => {
        onComplete();
      },
    });
  }

  private tweenDeliverMagneticPass(
    passer: Unit,
    receiver: Unit,
    ball: Ball,
    passive: PassiveAbility,
    grantBonusToReceiver: boolean,
  ): void {
    const bonus = passive.params.bonusStrikePower ?? 0.3;
    const matter = this.scene.matter;
    const px = passer.body.position.x;
    const py = passer.body.position.y;

    const pass = { x: px, y: py };
    this.scene.tweens.add({
      targets: pass,
      x: receiver.body.position.x,
      y: receiver.body.position.y,
      duration: 380,
      ease: 'Sine.InOut',
      onUpdate: () => {
        matter.body.setVelocity(ball.body, { x: 0, y: 0 });
        matter.body.setAngularVelocity(ball.body, 0);
        matter.body.setPosition(ball.body, { x: pass.x, y: pass.y });
      },
      onComplete: () => {
        matter.body.setVelocity(ball.body, { x: 0, y: 0 });
        matter.body.setAngularVelocity(ball.body, 0);
        if (grantBonusToReceiver) {
          this.magneticNextShotMulByReceiverRuntimeId.set(receiver.id, bonus);
          this.showPassiveActivation(passer, passive.name, 0x34d399);
        } else {
          this.scene.events.emit('pass-intercepted', { passer, interceptor: receiver });
        }
        passer.setMagneticPassCooldownTurns(PASSIVE_SKILL_COOLDOWN.MAGNETIC_PASS_TURNS);
        this.scene.events.emit('magnetic-pass-finished');
      },
    });
  }

  private unitDisplayName(unit: Unit): string {
    const repo = getUnitById(unit.getUnitId());
    return repo?.nameRu ?? repo?.name ?? unit.getUnitId();
  }

  private enterMagneticPassAimMode(passer: Unit, ball: Ball, passive: PassiveAbility): void {
    const targets = [...this.units.values()].filter(
      (u) => u !== passer && !u.isDestroyed && !u.isStunned(),
    );
    if (targets.length === 0) {
      this.scene.events.emit('magnetic-pass-failed', { reason: 'no_targets' });
      return;
    }

    const highlights: Phaser.GameObjects.Arc[] = [];
    const labels: Phaser.GameObjects.Text[] = [];

    targets.forEach((target) => {
      const isAlly = target.owner === passer.owner;
      const color = isAlly ? 0x10b981 : 0xef4444;

      const highlight = this.scene.add
        .circle(target.x, target.y, 35, color, 0.3)
        .setStrokeStyle(2, color)
        .setDepth(1500)
        .setScrollFactor(1);

      highlights.push(highlight);

      this.scene.tweens.add({
        targets: highlight,
        scale: { from: 1, to: 1.15 },
        alpha: { from: 0.3, to: 0.5 },
        duration: 500,
        yoyo: true,
        repeat: -1,
      });

      const nameLabel = this.scene.add
        .text(target.x, target.y - 50, this.unitDisplayName(target), {
          fontSize: '14px',
          color: '#ffffff',
          backgroundColor: isAlly ? '#10b981' : '#ef4444',
          padding: { x: 6, y: 3 },
        })
        .setOrigin(0.5)
        .setDepth(1501)
        .setScrollFactor(1);

      labels.push(nameLabel);
    });

    const aimLine = this.scene.add
      .line(0, 0, ball.x, ball.y, ball.x + 100, ball.y, 0x10b981, 0.85)
      .setLineWidth(5)
      .setDepth(1600)
      .setScrollFactor(1);

    const aimArrow = this.scene.add
      .triangle(ball.x + 100, ball.y, 0, -12, 24, 0, 0, 12, 0x10b981, 1)
      .setDepth(1601)
      .setScrollFactor(1);

    const cam = this.scene.cameras.main;
    const hint = this.scene.add
      .text(cam.centerX, 96, 'Цельтесь и нажмите на поле — пас ближайшей фишке (можно ошибиться)', {
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: '#10b981',
        padding: { x: 14, y: 8 },
        wordWrap: { width: Math.max(280, cam.width - 48) },
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(2000)
      .setScrollFactor(0);

    let nearestTarget: Unit | null = null;

    const refreshNearest = (wx: number, wy: number) => {
      nearestTarget = null;
      let best = Infinity;
      for (const u of targets) {
        const d = Phaser.Math.Distance.Between(wx, wy, u.x, u.y);
        if (d < best) {
          best = d;
          nearestTarget = u;
        }
      }
      if (best > 80) nearestTarget = null;

      highlights.forEach((h, i) => {
        const u = targets[i];
        const sel = u === nearestTarget;
        h.setScale(sel ? 1.3 : 1);
        h.setAlpha(sel ? 0.72 : 0.3);
      });
    };

    const pointerMove = (pointer: Phaser.Input.Pointer) => {
      if (!this.magneticPassSession) return;
      if (this.interactiveDribbleHudBlock?.(pointer.x, pointer.y)) return;

      const angle = Phaser.Math.Angle.Between(ball.x, ball.y, pointer.worldX, pointer.worldY);
      const length = 300;
      const endX = ball.x + Math.cos(angle) * length;
      const endY = ball.y + Math.sin(angle) * length;
      aimLine.setTo(ball.x, ball.y, endX, endY);
      aimArrow.setPosition(endX, endY);
      aimArrow.setRotation(angle);

      refreshNearest(pointer.worldX, pointer.worldY);

      highlights.forEach((h, i) => {
        const t = targets[i];
        h.setPosition(t.x, t.y);
      });
      labels.forEach((lbl, i) => {
        const t = targets[i];
        lbl.setPosition(t.x, t.y - 50);
      });
    };

    const pointerDown = (pointer: Phaser.Input.Pointer) => {
      const sess = this.magneticPassSession;
      if (!sess || sess.passer !== passer) return;
      if (this.interactiveDribbleHudBlock?.(pointer.x, pointer.y)) return;

      const receiver = nearestTarget;
      if (!receiver) {
        this.scene.events.emit('magnetic-pass-failed', { reason: 'no_target' });
        this.cancelMagneticPassSession();
        return;
      }

      const b = sess.ball;
      const ps = sess.passive;
      this.cancelMagneticPassSession();
      this.tweenDeliverMagneticPass(passer, receiver, b, ps, receiver.owner === passer.owner);
    };

    this.scene.input.on('pointermove', pointerMove);
    this.scene.input.on('pointerdown', pointerDown);

    refreshNearest(ball.x, ball.y);

    this.magneticPassSession = {
      passer,
      ball,
      passive,
      targets,
      highlights,
      labels,
      aimLine,
      aimArrow,
      hint,
      pointerMove,
      pointerDown,
    };

    pointerMove(this.scene.input.activePointer);
  }

  private cancelMagneticPassSession(): void {
    if (this.magneticPassAttractTween) {
      this.magneticPassAttractTween.stop();
      this.magneticPassAttractTween = null;
    }

    const sess = this.magneticPassSession;
    if (!sess) return;

    this.scene.input.off('pointermove', sess.pointerMove);
    this.scene.input.off('pointerdown', sess.pointerDown);

    sess.highlights.forEach((h) => {
      this.scene.tweens.killTweensOf(h);
      h.destroy();
    });
    sess.labels.forEach((t) => t.destroy());
    sess.aimLine.destroy();
    sess.aimArrow.destroy();
    sess.hint.destroy();

    this.magneticPassSession = null;
  }

  public setInteractiveDribbleHudBlock(fn?: (screenX: number, screenY: number) => boolean): void {
    this.interactiveDribbleHudBlock = fn;
  }

  /** Блок стандартного прицеливания/удара (дриблинг или магнитный пас в режиме прицела) */
  public consumesStandardShotInput(): boolean {
    return this.interactiveDribble.size > 0 || this.magneticPassSession !== null;
  }

  private enemyGoalPoint(unit: Unit): { x: number; y: number } {
    const b = this.getFieldBounds();
    const y = unit.owner === 1 ? b.top + 40 : b.bottom - 40;
    return { x: b.centerX, y };
  }

  /**
   * Maestro: упрощённый дриблинг — притягивание мяча к «передней» точке к чужим воротам,
   * орбита мяча вокруг фишки, прицел от мяча к курсору; отпускание — удар по силе «растяжки».
   */
  public startMagneticDribble(unit: Unit, ball: Ball): boolean {
    const passive = this.getUnitPassive(unit.getUnitId());
    if (passive.type !== 'dribbling') return false;
    if (unit.getDribblingCooldownTurns() > 0) return false;
    if (unit.isMagneticDribbleActive()) return false;

    const uid = unit.id;
    if (this.dribbleAttractTweens.has(uid) || this.interactiveDribble.has(uid)) return false;

    const ux = unit.body.position.x;
    const uy = unit.body.position.y;
    const bx = ball.body.position.x;
    const by = ball.body.position.y;
    const dist = Phaser.Math.Distance.Between(ux, uy, bx, by);
    if (dist > PASSIVE_DRIBBLE_ACTIVATION_RADIUS) {
      this.scene.events.emit('dribbling-failed', { reason: 'too_far', distance: dist });
      return false;
    }

    const matter = this.scene.matter;
    const goal = this.enemyGoalPoint(unit);
    const ang = Phaser.Math.Angle.Between(ux, uy, goal.x, goal.y);
    const attachLead = 40;
    const targetBx = ux + Math.cos(ang) * attachLead;
    const targetBy = uy + Math.sin(ang) * attachLead;

    const pull = { x: bx, y: by };
    const tw = this.scene.tweens.add({
      targets: pull,
      x: targetBx,
      y: targetBy,
      duration: 300,
      ease: 'Power2',
      onUpdate: () => {
        matter.body.setVelocity(ball.body, { x: 0, y: 0 });
        matter.body.setAngularVelocity(ball.body, 0);
        matter.body.setPosition(ball.body, { x: pull.x, y: pull.y });
      },
      onComplete: () => {
        this.dribbleAttractTweens.delete(uid);
        if (unit.isDestroyed || ball.isDestroyed) return;
        matter.body.setVelocity(ball.body, { x: 0, y: 0 });
        matter.body.setAngularVelocity(ball.body, 0);
        this.enterInteractiveDribble(unit, ball, passive);
      },
    });

    this.dribbleAttractTweens.set(uid, tw);
    return true;
  }

  private enterInteractiveDribble(unit: Unit, ball: Ball, passive: PassiveAbility): void {
    const uid = unit.id;
    const matter = this.scene.matter;

    const duration = passive.params.dribbleDuration ?? 2500;
    const orbitR = 40;
    const aimLen = 150;
    const goal = this.enemyGoalPoint(unit);
    const angleRef = { v: Phaser.Math.Angle.Between(unit.x, unit.y, goal.x, goal.y) };

    const repositionBallToOrbit = () => {
      const bx = unit.body.position.x + Math.cos(angleRef.v) * orbitR;
      const by = unit.body.position.y + Math.sin(angleRef.v) * orbitR;
      matter.body.setVelocity(ball.body, { x: 0, y: 0 });
      matter.body.setAngularVelocity(ball.body, 0);
      matter.body.setPosition(ball.body, { x: bx, y: by });
    };

    repositionBallToOrbit();

    const startBx = ball.x;
    const startBy = ball.y;
    const aimLine = this.scene.add
      .line(0, 0, startBx, startBy, startBx + Math.cos(angleRef.v) * aimLen, startBy + Math.sin(angleRef.v) * aimLen, 0xfbbf24, 0.92)
      .setLineWidth(5)
      .setDepth(1500)
      .setScrollFactor(1);

    const ax = startBx + Math.cos(angleRef.v) * aimLen;
    const ay = startBy + Math.sin(angleRef.v) * aimLen;
    const aimArrow = this.scene.add
      .triangle(ax, ay, 0, -12, 24, 0, 0, 12, 0xfbbf24, 1)
      .setDepth(1501)
      .setScrollFactor(1);

    const linkLine = this.scene.add
      .line(0, 0, unit.x, unit.y, ball.x, ball.y, 0xfbbf24, 0.55)
      .setLineWidth(3)
      .setDepth(480)
      .setScrollFactor(1);

    const linkPulseTween = this.scene.tweens.add({
      targets: linkLine,
      alpha: { from: 0.35, to: 0.85 },
      duration: 420,
      yoyo: true,
      repeat: -1,
    });

    unit.setMagneticDribbleActive(true);
    unit.setDribblingCooldownTurns(PASSIVE_SKILL_COOLDOWN.DRIBBLE_TURNS);
    this.showPassiveActivation(unit, passive.name, 0xfbbf24);

    const dragging = { v: false };

    const refreshAimGraphics = () => {
      const bx = ball.x;
      const by = ball.y;
      const ex = bx + Math.cos(angleRef.v) * aimLen;
      const ey = by + Math.sin(angleRef.v) * aimLen;
      aimLine.setTo(bx, by, ex, ey);
      aimArrow.setPosition(ex, ey);
      aimArrow.setRotation(angleRef.v);
      linkLine.setTo(unit.x, unit.y, bx, by);
    };

    const pointerMove = (pointer: Phaser.Input.Pointer) => {
      const meta = this.interactiveDribble.get(uid);
      if (!meta || !meta.unit.isMagneticDribbleActive()) return;
      if (this.interactiveDribbleHudBlock?.(pointer.x, pointer.y)) return;

      angleRef.v = Phaser.Math.Angle.Between(ball.x, ball.y, pointer.worldX, pointer.worldY);
      repositionBallToOrbit();
      refreshAimGraphics();
    };

    const pointerDown = (pointer: Phaser.Input.Pointer) => {
      const meta = this.interactiveDribble.get(uid);
      if (!meta || !meta.unit.isMagneticDribbleActive()) return;
      if (this.interactiveDribbleHudBlock?.(pointer.x, pointer.y)) return;
      dragging.v = true;
    };

    const pointerUp = (pointer: Phaser.Input.Pointer) => {
      const meta = this.interactiveDribble.get(uid);
      if (!meta || !meta.unit.isMagneticDribbleActive()) return;
      if (this.interactiveDribbleHudBlock?.(pointer.x, pointer.y)) return;
      if (!dragging.v) return;
      dragging.v = false;

      const dragDist = Phaser.Math.Distance.Between(ball.x, ball.y, pointer.worldX, pointer.worldY);
      const kickPower = Phaser.Math.Clamp(dragDist / 100, 0.12, 1);
      this.teardownInteractiveDribble(uid, 'kick', { angle: angleRef.v, power: kickPower });
    };

    const linkUpdater = () => {
      const meta = this.interactiveDribble.get(uid);
      if (!meta || !meta.unit.isMagneticDribbleActive()) return;
      refreshAimGraphics();
    };

    const timer = this.scene.time.delayedCall(duration, () =>
      this.teardownInteractiveDribble(uid, 'timeout', { angle: angleRef.v, power: 0.42 }),
    );

    this.scene.events.on('update', linkUpdater);
    this.scene.input.on('pointermove', pointerMove);
    this.scene.input.on('pointerdown', pointerDown);
    this.scene.input.on('pointerup', pointerUp);

    this.interactiveDribble.set(uid, {
      unit,
      ball,
      passive,
      angleRef,
      dragging,
      pointerMove,
      pointerDown,
      pointerUp,
      linkUpdater,
      aimLine,
      aimArrow,
      linkLine,
      linkPulseTween,
      timer,
    });

    refreshAimGraphics();
    this.scene.events.emit('dribbling-started', { unit, ball, duration });
  }

  private teardownInteractiveDribble(
    uid: string,
    kind: 'kick' | 'timeout' | 'external_clean' | 'external_release',
    kick?: { angle: number; power: number },
  ): void {
    const meta = this.interactiveDribble.get(uid);
    if (!meta) return;

    const { unit, ball, passive, pointerMove, pointerDown, pointerUp, linkUpdater, aimLine, aimArrow, linkLine, timer, angleRef } =
      meta;

    const matter = this.scene.matter;

    this.scene.events.off('update', linkUpdater);
    this.scene.input.off('pointermove', pointerMove);
    this.scene.input.off('pointerdown', pointerDown);
    this.scene.input.off('pointerup', pointerUp);
    timer?.remove(false);

    meta.linkPulseTween?.stop();
    aimLine.destroy();
    aimArrow.destroy();
    linkLine.destroy();

    matter.body.setVelocity(unit.body, { x: 0, y: 0 });
    matter.body.setAngularVelocity(unit.body, 0);

    const wasActive = unit.isMagneticDribbleActive();
    unit.setMagneticDribbleActive(false);
    unit.sprite.setRotation(0);

    this.interactiveDribble.delete(uid);

    if (!wasActive) return;

    const repo = getUnitById(unit.getUnitId());
    const pwr = repo?.stats?.power ?? 5;

    if (kind === 'kick' && kick) {
      const ang = kick.angle;
      const pow = kick.power;
      const sp = Phaser.Math.Clamp((4 + pwr * 2.4) * pow, 3.2, 18);
      matter.body.setVelocity(ball.body, { x: Math.cos(ang) * sp, y: Math.sin(ang) * sp });
      matter.body.setAngularVelocity(ball.body, 0);
      this.showPassiveActivation(unit, 'Удар!', 0xfbbf24);
      this.scene.events.emit('dribbling-finished', { unit, ball, isAutoFinish: false });
      return;
    }

    if (kind === 'timeout') {
      const ang = kick?.angle ?? angleRef.v;
      const pow = kick?.power ?? 0.42;
      const sp = Phaser.Math.Clamp((2 + pwr * 0.55) * (pow / 0.42), 2.4, 11);
      matter.body.setVelocity(ball.body, { x: Math.cos(ang) * sp, y: Math.sin(ang) * sp });
      matter.body.setAngularVelocity(ball.body, 0);
      this.showPassiveActivation(unit, 'Выход', 0xfbbf24);
      this.scene.events.emit('dribbling-finished', { unit, ball, isAutoFinish: true });
      return;
    }

    matter.body.setVelocity(ball.body, { x: 0, y: 0 });
    matter.body.setAngularVelocity(ball.body, 0);

    if (kind === 'external_release') {
      this.applyDribbleReleaseImpulse(unit, ball, passive);
    }

    this.scene.events.emit('dribbling-finished', { unit, ball, isAutoFinish: false });
  }

  /** STOP / выстрел через ShootingController / принудительная очистка. */
  public stopMagneticDribble(unit: Unit, ball: Ball, opts?: { skipReleaseImpulse?: boolean }): void {
    const uid = unit.id;
    const tw = this.dribbleAttractTweens.get(uid);
    if (tw) {
      tw.stop();
      this.dribbleAttractTweens.delete(uid);
    }

    if (this.interactiveDribble.has(uid)) {
      this.teardownInteractiveDribble(uid, opts?.skipReleaseImpulse !== false ? 'external_clean' : 'external_release');
      return;
    }

    if (unit.isMagneticDribbleActive()) {
      unit.setMagneticDribbleActive(false);
    }
  }

  private applyDribbleReleaseImpulse(unit: Unit, ball: Ball, passive: PassiveAbility): void {
    const matter = this.scene.matter;
    const b = this.getFieldBounds();
    const enemyGoalY = unit.owner === 1 ? b.top + 36 : b.bottom - 36;
    const cx = b.centerX;
    const ox = cx - ball.body.position.x;
    const oy = enemyGoalY - ball.body.position.y;
    const len = Math.sqrt(ox * ox + oy * oy) || 1;
    const nx = ox / len;
    const ny = oy / len;
    const bonus = passive.params.bonusStrikePower ?? 0.3;
    const repo = getUnitById(unit.getUnitId());
    const pwr = repo?.stats?.power ?? 5;
    const speed = Phaser.Math.Clamp(3 + pwr * bonus * 0.62, 2.4, 11);
    matter.body.setVelocity(ball.body, { x: nx * speed, y: ny * speed });
    this.showPassiveActivation(unit, 'Выход!', 0xfbbf24);
  }

  // ========== ОБРАБОТКА СТОЛКНОВЕНИЙ ==========

  public onUnitCollision(unit: Unit, enemy: Unit, impactSpeed = 0): void {
    try {
      const passive = this.getUnitPassive(unit.getUnitId());

      if (
        passive?.type === 'knockout' &&
        unit.owner !== enemy.owner &&
        impactSpeed > 0 &&
        !unit.isStunned() &&
        !enemy.isStunned()
      ) {
        const threshold = (passive.params.minSpeed ?? 320) / 52;
        if (impactSpeed >= threshold) {
          const now = this.scene.time.now;
          const until = this.knockoutVictimUntilMs.get(enemy.id) ?? 0;
          if (now >= until) {
            enemy.applyStun(passive.params.knockoutTurns ?? 1);
            this.knockoutVictimUntilMs.set(enemy.id, now + 520);
            this.showPassiveActivation(unit, passive.name, 0xef4444);
          }
        }
      }

      if (!passive || passive.type !== 'on_collision') return;

      const params = passive.params;

      // Slow enemy
      if (params.target === 'enemy' && params.value) {
        // Check for immunity (Iron Sentinel)
        if (this.hasImmunity(enemy, 'slow')) {
          this.showPassiveActivation(enemy, 'Иммунитет!', 0x00ff00);
          return;
        }

        const slowAmount = params.value;
        const duration = params.duration || 1;
        this.applyDebuff(enemy, 'slow', slowAmount, duration, unit.getUnitId());
        this.showPassiveActivation(unit, passive.name);
      }

      // Extra knockback (Juggernaut)
      if (passive.name === 'Сейсмический удар') {
        this.applyExtraKnockback(enemy, params.value || 0.30);
        this.showPassiveActivation(unit, passive.name, 0xffcc44);
        this.showPassiveActivation(enemy, 'Отброс!', 0xffaa33);
      }

      // Absorb impulse (Ironclad, Abyssal)
      if (passive.name === 'Энергощит' || passive.name === 'Поглощение бездны') {
        // Handled in collision physics
      }
    } catch (e) {
      console.error('[PassiveManager] onUnitCollision:', e);
    }
  }
  
  public onBallCollision(unit: Unit, ball: Ball): void {
    const ballSlowEffect = this.getBallEffect('slow_on_hit');
    if (!ballSlowEffect) return;

    const sourceUnit = this.units.get(ballSlowEffect.sourceUnitId);
    if (!sourceUnit || unit.owner === sourceUnit.owner) return;

    this.applyDebuff(unit, 'slow', ballSlowEffect.value, 1, ballSlowEffect.sourceUnitId);
    this.showPassiveActivation(unit, 'Замедление!', 0x88ff66);
    this.clearBallEffect('slow_on_hit');
  }
  
  // ========== АУРЫ ==========
  
  private updateAuras(): void {
    this.state.activeAuras = [];
    
    this.units.forEach((unit, unitId) => {
      const passive = this.getUnitPassive(unitId);
      if (!passive || passive.type !== 'aura') return;
      
      const params = passive.params;
      const radius = params.radius || 80;
      
      // Get units in radius
      const unitsInRadius = this.getUnitsInRadius(unit, radius);
      
      // Apply aura effects
      unitsInRadius.forEach(targetUnit => {
        const isAlly = this.isAlly(unit, targetUnit);
        const isEnemy = !isAlly && targetUnit !== unit;
        
        // Enemy debuff auras
        if (params.target === 'enemy' && isEnemy) {
          // Oblivion: -10% accuracy
          if (passive.name === 'Доминион пустоты') {
            this.applyAuraDebuff(targetUnit, 'accuracy', params.value || 0.10, unitId);
          }
          // Pheromone Master: -10% accuracy
          if (passive.name === 'Споры разума') {
            this.applyAuraDebuff(targetUnit, 'accuracy', params.value || 0.10, unitId);
          }
          // Hellion: -5% speed after hit
          if (passive.name === 'Адское пламя') {
            this.applyAuraDebuff(targetUnit, 'speed', params.value || 0.05, unitId);
          }
        }
        
        // Ally buff auras
        if (isAlly || targetUnit === unit) {
          // Scuttle: +10% speed near ally Insect
          if (passive.name === 'Скорость роя' && this.isInsect(targetUnit)) {
            this.applyAuraBuff(unit, 'speed', params.value || 0.10, unitId);
          }
          // Queen's Guard: +5% all stats to Insect allies
          if (passive.name === 'Королевский приказ' && this.isInsect(targetUnit) && targetUnit !== unit) {
            this.applyAuraBuff(targetUnit, 'all_stats', params.value || 0.05, unitId);
          }
          // Chitin: +15% defense to both when near ally
          if (passive.name === 'Укреплённый панцирь' && isAlly) {
            this.applyAuraBuff(unit, 'defense', params.value || 0.15, unitId);
            this.applyAuraBuff(targetUnit, 'defense', params.value || 0.15, unitId);
          }
          // Colossus Bug: +15% defense per Insect ally
          if (passive.name === 'Титановый экзо' && this.isInsect(targetUnit) && targetUnit !== unit) {
            this.stackAuraBuff(unit, 'defense', params.value || 0.15, unitId);
          }
        }
      });
      
      // Ball auras
      if (params.target === 'ball' && this.ball) {
        const distToBall = Phaser.Math.Distance.Between(unit.x, unit.y, this.ball.x, this.ball.y);
        if (distToBall <= radius) {
          // Gravity Well: slow ball by 20%
          if (passive.name === 'Гравитационный колодец') {
            this.applyBallSlow(params.value || 0.20);
            const now = Date.now();
            if (now - this.lastBallAuraTipAtMs > 2600) {
              this.lastBallAuraTipAtMs = now;
              this.showPassiveActivation(unit, passive.name, 0x8899ff);
            }
          }
          // Black Hole: attract ball when defending
          if (passive.name === 'Космическая броня' && this.isDefending(unit)) {
            this.attractBallToUnit(unit, params.radius || 60);
            const now = Date.now();
            if (now - this.lastBallAuraTipAtMs > 2600) {
              this.lastBallAuraTipAtMs = now;
              this.showPassiveActivation(unit, passive.name, 0x4b0082);
            }
          }
        }
      }
    });
  }
  
  // ========== УСИЛЕНИЕ КАРТ ==========
  
  public getCardEnhancement(unitId: string, cardType: string): CardEnhancement {
    const passive = this.getUnitPassive(unitId);
    if (!passive || passive.type !== 'card_enhance') {
      return { radiusBonus: 0, durationBonus: 0, special: null };
    }

    const params = passive.params;
    let result: CardEnhancement = { radiusBonus: 0, durationBonus: 0, special: null };
    
    // Magma Champion: Lava Pool +25% radius
    if (passive.name === 'Властелин лавы' && cardType === 'magma_lava') {
      result.radiusBonus = params.value || 0.25;
    }
    
    // Omega Sentinel: Shield +20% radius, +1 duration
    if (passive.name === 'Протокол стража' && cardType === 'cyborg_shield') {
      result.radiusBonus = params.value || 0.20;
      result.durationBonus = params.duration || 1;
    }
    
    if (passive.name === 'Титановый щит' && (cardType === 'cyborg_barrier' || cardType === 'cyborg_shield')) {
      result.radiusBonus = params.value || 0.30;
    }
    
    // Darkstar: Wormhole attracts ball (радиус в пикселях, не %)
    if (passive.name === 'Затмение' && cardType === 'void_wormhole') {
      result.special = 'attract_ball';
      result.attractRadiusPx = params.radius ?? 30;
    }
    
    // Portal Master: Swap with ball
    if (passive.name === 'Измерительный трюк' && cardType === 'void_swap') {
      result.special = 'swap_with_ball';
    }
    
    // Stinger: Neurotoxin +0.5 turn
    if (passive.name === 'Ядовитый укус' && cardType === 'insect_toxin') {
      result.durationBonus = params.value || 0.5;
    }
    
    // Alpha Predator: Neurotoxin AoE
    if (passive.name === 'Идеальная охота' && cardType === 'insect_toxin') {
      result.special = 'aoe_toxin';
      result.radiusBonus = params.radius || 60;
    }
    
    // Phantom Swarm: Biomimicry creates 2 fakes
    if (passive.name === 'Обманный рой' && cardType === 'insect_mimic') {
      result.special = 'double_decoy';
    }
    
    // Illusionist: Barrier creates fake barrier
    if (passive.name === 'Голограмма' && cardType === 'cyborg_barrier') {
      result.special = 'fake_barrier';
    }
    
    return result;
  }

  /** UI: карта способности усилена пассивкой активного бойца */
  public notifyCardEnhancement(unitId: string, cardTypeKey: string): void {
    const passive = this.getUnitPassive(unitId);
    if (passive.type !== 'card_enhance') return;
    const e = this.getCardEnhancement(unitId, cardTypeKey);
    if (
      !e.special &&
      e.radiusBonus <= 0 &&
      e.durationBonus <= 0 &&
      !(e.attractRadiusPx && e.attractRadiusPx > 0)
    ) {
      return;
    }
    const unit = this.units.get(unitId);
    if (!unit) return;
    const parts: string[] = [passive.name];
    if (e.radiusBonus > 0) parts.push(`+${Math.round(e.radiusBonus * 100)}% зона`);
    if (e.durationBonus > 0) parts.push(`+${e.durationBonus} ход`);
    if (e.attractRadiusPx && e.attractRadiusPx > 0) parts.push(`↓мяч ${Math.round(e.attractRadiusPx)}px`);
    if (e.special) parts.push('★');
    this.showPassiveActivation(unit, parts.join(' '), 0x7dd3fc);
  }
  
  // ========== ИММУНИТЕТЫ И КОНТРЫ ==========
  
  public hasImmunity(unit: Unit, effectType: string): boolean {
    const passive = this.getUnitPassive(unit.getUnitId());
    if (!passive || passive.type !== 'counter') return false;

    // Антитоксин: иммунитет к замедлению / стану; дебафф скорости от аур считаем замедлением
    if (passive.name === 'Антитоксин') {
      return effectType === 'slow' || effectType === 'stun' || effectType === 'speed';
    }

    return false;
  }
  
  // ========== ONCE PER MATCH ABILITIES ==========
  
  public canUseOncePerMatch(unitId: string): boolean {
    const unitState = this.state.units[unitId];
    return unitState && !unitState.hasUsedOncePerMatch;
  }
  
  public useOncePerMatch(unit: Unit): boolean {
    const unitId = unit.getUnitId();
    const unitState = this.state.units[unitId];
    const passive = this.getUnitPassive(unitId);
    
    if (!unitState || !passive || unitState.hasUsedOncePerMatch) return false;
    if (passive.params.condition !== 'once_per_match') return false;
    
    unitState.hasUsedOncePerMatch = true;
    
    // Phoenix Master: Teleport to own goal after conceding
    if (passive.name === 'Возрождение феникса') {
      this.teleportToOwnGoal(unit);
      this.showPassiveActivation(unit, 'Возрождение!', 0xff4500);
    }
    
    // Aegis: Block goal
    if (passive.name === 'Абсолютный щит') {
      this.showPassiveActivation(unit, 'Абсолютный Щит!', 0x00f2ff);
      return true; // Signal to block the goal
    }
    
    // Empress Shell: Block goal
    if (passive.name === 'Щит императрицы') {
      this.showPassiveActivation(unit, 'Щит Императрицы!', 0x39ff14);
      return true;
    }
    
    // Paradox: Undo last move
    if (passive.name === 'Временной парадокс') {
      this.showPassiveActivation(unit, 'Парадокс!', 0x9d00ff);
      return true; // Signal to undo
    }
    
    return false;
  }
  
  // ========== CONDITIONAL PASSIVES ==========
  
  private applyConditionalPassive(unit: Unit, passive: PassiveAbility, triggerCondition: PassiveCondition): void {
    const params = passive.params;
    const unitId = unit.getUnitId();
    
    // After miss: +accuracy boost
    if (triggerCondition === 'after_miss' && params.value) {
      this.applyBuff(unit, 'accuracy', params.value, 1, unitId);
      this.showPassiveActivation(unit, passive.name, 0xaaccff);
    }
    
    // After hit received: +defense
    if (triggerCondition === 'after_hit' && params.value) {
      const maxStacks = params.maxStacks || 3;
      this.stackBuff(unit, 'defense', params.value, params.duration || 1, unitId, maxStacks);
      this.showPassiveActivation(unit, passive.name, 0x88cc99);
    }
    
    // After goal: +speed
    if (triggerCondition === 'after_goal' && params.value) {
      this.applyBuff(unit, 'speed', params.value, params.duration || 2, unitId);
      this.showPassiveActivation(unit, passive.name);
    }
    
    // After ally hit: +power
    if (triggerCondition === 'ally_hit' && params.value) {
      this.applyBuff(unit, 'power', params.value, params.duration || 1, unitId);
      this.showPassiveActivation(unit, passive.name, 0xffaa77);
    }
    
    // After swap: +defense
    if (triggerCondition === 'after_swap' && params.value) {
      this.applyBuff(unit, 'defense', params.value, params.duration || 2, unitId);
      this.showPassiveActivation(unit, passive.name, 0xaabbee);
    }
    
    // No goal in 3 turns: +power
    if (triggerCondition === 'no_goal_3_turns' && params.value) {
      this.applyBuff(unit, 'power', params.value, 1, unitId);
      this.showPassiveActivation(unit, passive.name, 0xffdd66);
    }

    // Общий случай: пропущенный гол (если появятся баффы с value в данных)
    if (triggerCondition === 'goal_conceded' && typeof params.value === 'number') {
      this.applyBuff(unit, 'defense', params.value, params.duration || 2, unitId);
      this.showPassiveActivation(unit, passive.name, 0xff8888);
    }
  }
  
  private applyRiskRewardOnGoal(unit: Unit, passive: PassiveAbility, isOwnGoal: boolean): void {
    // Ragnaros: Creates lava on goal, slowed on concede
    if (passive.name === 'Извержение') {
      if (isOwnGoal) {
        this.createLavaAtCenter();
        this.showPassiveActivation(unit, 'Извержение!', 0xff4500);
      } else {
        this.applyDebuff(unit, 'speed', passive.params.value || 0.20, passive.params.duration || 2, unit.getUnitId());
        this.showPassiveActivation(unit, 'Замедлен...', 0xff0000);
      }
    }
  }
  
  // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========
  
  private getUnitPassive(unitId: string): PassiveAbility {
    // ✅ Используем безопасную функцию с fallback (всегда возвращает PassiveAbility)
    return getUnitPassive(unitId);
  }
  
  private getUnitOwner(unit: Unit): number {
    return unit.owner;
  }
  
  private isAlly(unit1: Unit, unit2: Unit): boolean {
    return unit1.owner === unit2.owner;
  }
  
  private isInsect(unit: Unit): boolean {
    const unitData = getUnitById(unit.getUnitId());
    return unitData?.factionId === 'insect';
  }
  
  private isOnEnemyHalf(unit: Unit): boolean {
    const b = this.getFieldBounds();
    const isPlayer1 = unit.owner === 1;
    return isPlayer1 ? unit.y < b.centerY : unit.y > b.centerY;
  }
  
  private isOnOwnHalf(unit: Unit): boolean {
    return !this.isOnEnemyHalf(unit);
  }
  
  private isDefending(unit: Unit): boolean {
    const b = this.getFieldBounds();
    const zone = b.height * 0.2;
    const isPlayer1 = unit.owner === 1;
    return isPlayer1 ? unit.y > b.bottom - zone : unit.y < b.top + zone;
  }
  
  private getUnitsInRadius(centerUnit: Unit, radius: number): Unit[] {
    const result: Unit[] = [];
    this.units.forEach(unit => {
      if (unit === centerUnit) return;
      const dist = Phaser.Math.Distance.Between(centerUnit.x, centerUnit.y, unit.x, unit.y);
      if (dist <= radius) {
        result.push(unit);
      }
    });
    return result;
  }
  
  // ========== ПРИМЕНЕНИЕ ЭФФЕКТОВ ==========
  
  private applyBuff(unit: Unit, stat: string, value: number, duration: number, sourceId: string): void {
    const unitState = this.state.units[unit.getUnitId()];
    if (!unitState) return;
    
    const effect: ActivePassiveEffect = {
      id: `${sourceId}_${stat}_${Date.now()}`,
      sourceUnitId: sourceId,
      targetUnitId: unit.getUnitId(),
      passiveType: 'stat_boost',
      effectType: stat,
      value,
      turnsRemaining: duration,
    };
    
    unitState.activeBuffs.push(effect);
    this.emitStatChange(unit, stat, value);
  }
  
  private stackBuff(unit: Unit, stat: string, value: number, duration: number, sourceId: string, maxStacks: number): void {
    const unitState = this.state.units[unit.getUnitId()];
    if (!unitState) return;
    
    const stackKey = `${sourceId}_${stat}`;
    const currentStacks = unitState.currentStacks[stackKey] || 0;
    
    if (currentStacks < maxStacks) {
      unitState.currentStacks[stackKey] = currentStacks + 1;
      this.applyBuff(unit, stat, value, duration, sourceId);
    }
  }
  
  private applyDebuff(unit: Unit, stat: string, value: number, duration: number, sourceId: string): void {
    const unitState = this.state.units[unit.getUnitId()];
    if (!unitState) return;

    if (this.hasImmunity(unit, stat)) {
      this.showPassiveActivation(unit, 'Иммунитет!', 0x00ff00);
      return;
    }

    const effect: ActivePassiveEffect = {
      id: `${sourceId}_${stat}_${Date.now()}`,
      sourceUnitId: sourceId,
      targetUnitId: unit.getUnitId(),
      passiveType: 'on_collision',
      effectType: stat,
      value: -value, // Negative for debuff
      turnsRemaining: duration,
    };
    
    unitState.activeDebuffs.push(effect);
    this.emitStatChange(unit, stat, -value);
  }
  
  private applyAuraBuff(unit: Unit, stat: string, value: number, sourceId: string): void {
    // Aura buffs are temporary and recalculated each turn
    this.state.activeAuras.push({
      id: `aura_${sourceId}_${stat}`,
      sourceUnitId: sourceId,
      targetUnitId: unit.getUnitId(),
      passiveType: 'aura',
      effectType: stat,
      value,
      turnsRemaining: 1,
    });
  }
  
  private stackAuraBuff(unit: Unit, stat: string, value: number, sourceId: string): void {
    const existingAura = this.state.activeAuras.find(
      a => a.sourceUnitId === sourceId && a.targetUnitId === unit.getUnitId() && a.effectType === stat
    );
    if (existingAura) {
      existingAura.value += value;
    } else {
      this.applyAuraBuff(unit, stat, value, sourceId);
    }
  }
  
  private applyAuraDebuff(unit: Unit, stat: string, value: number, sourceId: string): void {
    if (this.hasImmunity(unit, stat)) {
      this.showPassiveActivation(unit, 'Иммунитет!', 0x00ff00);
      return;
    }
    this.state.activeAuras.push({
      id: `aura_debuff_${sourceId}_${stat}`,
      sourceUnitId: sourceId,
      targetUnitId: unit.getUnitId(),
      passiveType: 'aura',
      effectType: stat,
      value: -value,
      turnsRemaining: 1,
    });
  }
  
  private applyActiveBuffsToForce(unitId: string, force: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const unitState = this.state.units[unitId];
    if (!unitState) return force;
    
    let powerMod = 1;
    
    // Apply buffs
    for (const buff of unitState.activeBuffs) {
      if (buff.effectType === 'power') {
        powerMod += buff.value;
      }
    }
    
    // Apply auras
    for (const aura of this.state.activeAuras) {
      if (aura.targetUnitId === unitId && aura.effectType === 'power') {
        powerMod += aura.value;
      }
    }
    
    return force.clone().scale(powerMod);
  }
  
  private tickEffectDurations(): void {
    // Tick buffs
    Object.values(this.state.units).forEach(unitState => {
      unitState.activeBuffs = unitState.activeBuffs.filter(buff => {
        buff.turnsRemaining--;
        return buff.turnsRemaining > 0;
      });
      
      unitState.activeDebuffs = unitState.activeDebuffs.filter(debuff => {
        debuff.turnsRemaining--;
        return debuff.turnsRemaining > 0;
      });
    });
    
    // Clear auras (recalculated each turn)
    this.state.activeAuras = [];
  }
  
  // ========== СПЕЦИАЛЬНЫЕ ЭФФЕКТЫ ==========
  
  private pushNearestEnemy(unit: Unit, radius: number, pushDistance: number): boolean {
    let nearestEnemy: Unit | null = null;
    let nearestDist = Infinity;
    
    this.units.forEach(other => {
      if (this.isAlly(unit, other)) return;
      const dist = Phaser.Math.Distance.Between(unit.x, unit.y, other.x, other.y);
      if (dist < nearestDist && dist <= radius) {
        nearestDist = dist;
        nearestEnemy = other;
      }
    });
    
    if (!nearestEnemy) return false;

    const angle = Phaser.Math.Angle.Between(unit.x, unit.y, nearestEnemy.x, nearestEnemy.y);
    const pushX = Math.cos(angle) * pushDistance;
    const pushY = Math.sin(angle) * pushDistance;

    eventBus.dispatch(GameEvents.PASSIVE_PUSH, {
      targetUnitId: nearestEnemy.getUnitId(),
      pushX,
      pushY,
    });
    this.showPassiveActivation(nearestEnemy, 'Толчок!', 0xff8844);
    return true;
  }
  
  private setBallPassThrough(count: number): void {
    eventBus.dispatch(GameEvents.BALL_PASS_THROUGH, { count });
  }
  
  private setBallSlowOnHit(sourceUnit: Unit, value: number): void {
    this.setBallEffect('slow_on_hit', value, sourceUnit.getUnitId());
  }
  
  private setBallEffect(type: string, value: number, sourceUnitId: string): void {
    this.ballPassiveEffects.set(type, { value, sourceUnitId });
    eventBus.dispatch(GameEvents.BALL_EFFECT_SET, { type, value, sourceUnitId });
  }
  
  private getBallEffect(type: string): { value: number; sourceUnitId: string } | null {
    return this.ballPassiveEffects.get(type) ?? null;
  }
  
  private clearBallEffect(type: string): void {
    this.ballPassiveEffects.delete(type);
    eventBus.dispatch(GameEvents.BALL_EFFECT_CLEAR, { type });
  }
  
  private scheduleBallTeleport(force: Phaser.Math.Vector2, distance: number): void {
    const angle = Math.atan2(force.y, force.x);
    eventBus.dispatch(GameEvents.BALL_TELEPORT_SCHEDULED, { angle, distance });
  }
  
  private scheduleUnitTeleport(unit: Unit): void {
    const b = this.getFieldBounds();
    const isPlayer1 = unit.owner === 1;
    const padX = Math.min(48, b.width * 0.08);
    const padY = Math.min(48, b.height * 0.08);
    const x = Phaser.Math.Between(b.left + padX, b.right - padX);
    const y = isPlayer1
      ? Phaser.Math.Between(b.centerY + padY, b.bottom - padY)
      : Phaser.Math.Between(b.top + padY, b.centerY - padY);
    
    eventBus.dispatch(GameEvents.UNIT_TELEPORT, {
      unitId: unit.getUnitId(),
      x,
      y,
    });
  }
  
  private teleportRandomEnemy(sourceUnit: Unit): void {
    const enemies: Unit[] = [];
    this.units.forEach(unit => {
      if (!this.isAlly(sourceUnit, unit)) {
        enemies.push(unit);
      }
    });
    
    if (enemies.length === 0) return;
    
    const randomEnemy = enemies[Math.floor(Math.random() * enemies.length)];
    const b = this.getFieldBounds();
    const pad = Math.min(56, b.width * 0.07);
    const x = Phaser.Math.Between(b.left + pad, b.right - pad);
    const y = Phaser.Math.Between(b.top + pad, b.bottom - pad);
    
    eventBus.dispatch(GameEvents.UNIT_TELEPORT, {
      unitId: randomEnemy.getUnitId(),
      x,
      y,
    });
  }
  
  private teleportToOwnGoal(unit: Unit): void {
    const b = this.getFieldBounds();
    const isPlayer1 = unit.owner === 1;
    const inset = Math.min(72, b.height * 0.12);
    const x = b.centerX + Phaser.Math.Between(-b.width * 0.12, b.width * 0.12);
    const y = isPlayer1 ? b.bottom - inset : b.top + inset;
    
    eventBus.dispatch(GameEvents.UNIT_TELEPORT, {
      unitId: unit.getUnitId(),
      x,
      y,
    });
  }
  
  private applyExtraKnockback(enemy: Unit, multiplier: number): void {
    eventBus.dispatch(GameEvents.EXTRA_KNOCKBACK, {
      targetUnitId: enemy.getUnitId(),
      multiplier: 1 + multiplier,
    });
  }
  
  private applyBallSlow(value: number): void {
    eventBus.dispatch(GameEvents.BALL_SLOW, { value });
  }
  
  private attractBallToUnit(unit: Unit, radius: number): void {
    if (!this.ball) return;
    
    const dist = Phaser.Math.Distance.Between(unit.x, unit.y, this.ball.x, this.ball.y);
    if (dist > radius) return;
    
    const angle = Phaser.Math.Angle.Between(this.ball.x, this.ball.y, unit.x, unit.y);
    const force = 0.001 * (1 - dist / radius); // Stronger when closer
    
    eventBus.dispatch(GameEvents.BALL_ATTRACT, {
      angle,
      force,
    });
  }
  
  private createLavaAtCenter(): void {
    const b = this.getFieldBounds();
    eventBus.dispatch(GameEvents.CREATE_LAVA_POOL, {
      x: b.centerX,
      y: b.centerY,
      fromPassive: true,
    });
  }
  
  // ========== ВИЗУАЛЬНЫЕ ЭФФЕКТЫ ==========
  
  private showPassiveActivation(unit: Unit, text: string, color: number = 0xffffff): void {
    eventBus.dispatch(GameEvents.PASSIVE_ACTIVATED, {
      unitId: unit.getUnitId(),
      text,
      color,
      x: unit.x,
      y: unit.y - 40,
    });
  }
  
  private emitStatChange(unit: Unit, stat: string, value: number): void {
    eventBus.dispatch(GameEvents.STAT_CHANGED, {
      unitId: unit.getUnitId(),
      stat,
      value,
    });
  }
  
  // ========== ПУБЛИЧНЫЕ ГЕТТЕРЫ ==========
  
  public getAccuracyModifier(unitId: string): number {
    const unitState = this.state.units[unitId];
    if (!unitState) return 0;
    
    let mod = 0;
    
    // From buffs
    for (const buff of unitState.activeBuffs) {
      if (buff.effectType === 'accuracy') {
        mod += buff.value;
      }
    }
    
    // From debuffs
    for (const debuff of unitState.activeDebuffs) {
      if (debuff.effectType === 'accuracy') {
        mod += debuff.value; // Already negative
      }
    }
    
    // From auras
    for (const aura of this.state.activeAuras) {
      if (aura.targetUnitId === unitId && aura.effectType === 'accuracy') {
        mod += aura.value;
      }
    }
    
    return mod;
  }
  
  public getSpeedModifier(unitId: string): number {
    const unitState = this.state.units[unitId];
    if (!unitState) return 0;
    
    let mod = 0;
    
    for (const buff of unitState.activeBuffs) {
      if (buff.effectType === 'speed') mod += buff.value;
    }
    for (const debuff of unitState.activeDebuffs) {
      if (debuff.effectType === 'speed' || debuff.effectType === 'slow') {
        mod += debuff.value;
      }
    }
    for (const aura of this.state.activeAuras) {
      if (aura.targetUnitId === unitId && aura.effectType === 'speed') {
        mod += aura.value;
      }
    }
    
    return mod;
  }
  
  public getDefenseModifier(unitId: string): number {
    const unitState = this.state.units[unitId];
    if (!unitState) return 0;
    
    let mod = 0;
    
    for (const buff of unitState.activeBuffs) {
      if (buff.effectType === 'defense') mod += buff.value;
    }
    for (const aura of this.state.activeAuras) {
      if (aura.targetUnitId === unitId && aura.effectType === 'defense') {
        mod += aura.value;
      }
    }
    
    return mod;
  }
  
  public getCurveBonus(unitId: string): number {
    const passive = this.getUnitPassive(unitId);
    if (!passive) return 0;
    
    if (passive.type === 'stat_boost' && passive.name.includes('Curve')) {
      return passive.params.value || 0;
    }
    if (passive.name === 'Танец огня') return 0.10;
    if (passive.name === 'Искривление разума') return 0.15;
    if (passive.name === 'Хаотичное пламя') return 0.25;
    
    return 0;
  }
  
  public getMassModifier(unitId: string): number {
    const passive = this.getUnitPassive(unitId);
    if (!passive) return 0;
    
    // Static mass bonuses
    if (passive.name === 'Каменная стойкость') return 0.10;
    if (passive.name === 'Ядро планеты') return 0.50;
    
    // Dynamic mass bonus (Bio-fortress when defending)
    const unitState = this.state.units[unitId];
    if (unitState) {
      let sum = 0;
      for (const buff of unitState.activeBuffs) {
        if (buff.effectType === 'mass') sum += buff.value;
      }
      if (sum !== 0) return sum;
    }
    
    return 0;
  }
  
  // ========== ОЧИСТКА ==========
  
  public destroy(): void {
    eventBus.off(GameEvents.GOAL_SCORED, this.boundOnGoalScored);
    eventBus.off(GameEvents.TURN_STARTED, this.boundOnTurnStarted);
    eventBus.off(GameEvents.TURN_ENDED, this.boundOnTurnEnded);
    this.cancelMagneticPassSession();
    this.dribbleAttractTweens.forEach((t) => t.stop());
    this.dribbleAttractTweens.clear();
    [...this.interactiveDribble.keys()].forEach((uid) => this.teardownInteractiveDribble(uid, 'external_clean'));
    this.interactiveDribble.clear();
    this.knockoutVictimUntilMs.clear();
    this.ballPassiveEffects.clear();
    this.units.clear();
    this.ball = null;
  }
}
