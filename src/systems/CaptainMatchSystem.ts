import Phaser from 'phaser';
import { Ball } from '../entities/Ball';
import { Unit } from '../entities/Unit';
import { PlayerNumber, FieldBounds } from '../types';
import { eventBus, GameEvents } from '../core/EventBus';
import {
  CAPTAIN_ENERGY_BALL_TOUCH,
  CAPTAIN_ENERGY_GOAL_CONCEDED,
  CAPTAIN_ENERGY_GOAL_SCORED,
  CAPTAIN_INSECT_SWARM_DISTANCE,
  CAPTAIN_MAX_ENERGY,
  CAPTAIN_UROK_AURA_RADIUS,
  CAPTAIN_UROK_CONE_DEG,
  CAPTAIN_UROK_CONE_RANGE,
  CAPTAIN_VOID_PULL_RADIUS,
  isCaptainUnitId,
} from '../constants/captains';
import { FACTIONS } from '../constants/gameConstants';
import { ShootingController } from '../controllers/ShootingController';
import { MatchPhase } from '../core/MatchStateMachine';

export interface CaptainMatchSystemDeps {
  scene: Phaser.Scene;
  getCaps: () => Unit[];
  getBall: () => Ball;
  getFieldBounds: () => FieldBounds;
  shootingController: ShootingController;
  /** Локальный «главный» игрок (1 в офлайне; в PvP — ваш slot). */
  getHumanOwner: () => PlayerNumber;
  isPvP: boolean;
  /** Для отключения физики SUPER во время гола / завершения матча (до сброса позиций). */
  getMatchPhase?: () => MatchPhase;
}

type UltMode =
  | 'idle'
  | 'urok_aim_cone'
  | 'chronos_pick'
  | 'void_pick_point';

export class CaptainMatchSystem {
  private deps: CaptainMatchSystemDeps;
  private destroyed = false;

  private energyByOwner: Record<PlayerNumber, number> = { 1: 0, 2: 0 };

  private ultMode: UltMode = 'idle';

  private urokCaptain?: Unit;

  private massAuraRestore = new Map<string, number>();

  private swarmGfx?: Phaser.GameObjects.Graphics;

  private singularity?: { x: number; y: number; until: number };
  private singularityVfxRing?: Phaser.GameObjects.Arc;

  private captainStasisTurns = new Map<string, number>();

  /** Xerxa: после SUPER — ход Ксеркой, затем другим насекомым (50%). */
  private xerxaPhase: 'off' | 'need_xerxa' | 'need_insect' = 'off';
  private insectRushNext = false;
  /** runtime id фишки Xerxa — исключается из бонусного хода насекомого */
  private xerxaInsectExcludeRuntimeId?: string;

  private boundCollisionBall?: (p: import('../core/EventBus').CollisionBallUnitPayload) => void;
  private boundGoal?: (p: import('../core/EventBus').GoalScoredPayload) => void;
  private boundStopped?: (p: import('../core/EventBus').ObjectsStoppedPayload) => void;

  constructor(deps: CaptainMatchSystemDeps) {
    this.deps = deps;
    this.bindShootingHooks();

    this.boundCollisionBall = (payload) => this.onBallUnitCollision(payload);
    this.boundGoal = (payload) => this.onGoal(payload);
    this.boundStopped = () => this.onObjectsStopped();
    eventBus.subscribe(GameEvents.COLLISION_BALL_UNIT, this.boundCollisionBall);
    eventBus.subscribe(GameEvents.GOAL_SCORED, this.boundGoal);
    eventBus.subscribe(GameEvents.OBJECTS_STOPPED, this.boundStopped);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.boundCollisionBall) eventBus.unsubscribe(GameEvents.COLLISION_BALL_UNIT, this.boundCollisionBall);
    if (this.boundGoal) eventBus.unsubscribe(GameEvents.GOAL_SCORED, this.boundGoal);
    if (this.boundStopped) eventBus.unsubscribe(GameEvents.OBJECTS_STOPPED, this.boundStopped);

    this.massAuraRestore.forEach((mass, uid) => {
      const u = this.deps.getCaps().find((c) => c.id === uid);
      if (u && !u.isDestroyed) {
        this.deps.scene.matter.body.setMass(u.body, mass);
      }
    });
    this.massAuraRestore.clear();
    this.swarmGfx?.destroy();
    this.swarmGfx = undefined;
    this.clearSingularityVfx();
    this.deps.shootingController.setCaptainTrajectoryHooks(null);
    this.deps.shootingController.setCaptainShotForceScale(null);
    this.deps.shootingController.setCaptainSelectionFilter(null);
  }

  getHumanEnergyFraction(): number {
    const o = this.deps.getHumanOwner();
    return Math.min(1, this.energyByOwner[o] / CAPTAIN_MAX_ENERGY);
  }

  canHumanActivateUlt(): boolean {
    const o = this.deps.getHumanOwner();
    const energy = this.energyByOwner[o];
    const hasCaptain = this.findCaptain(o) !== undefined;
    const isIdle = this.ultMode === 'idle';
    const notXerxa = this.xerxaPhase === 'off';

    const canActivate =
      !this.deps.isPvP &&
      energy >= CAPTAIN_MAX_ENERGY &&
      hasCaptain &&
      isIdle &&
      notXerxa;

    if (import.meta.env.DEV) {
      console.log('[CaptainMatchSystem] canHumanActivateUlt check:', {
        owner: o,
        energy,
        maxEnergy: CAPTAIN_MAX_ENERGY,
        hasCaptain,
        isIdle,
        notXerxa,
        isPvP: this.deps.isPvP,
        result: canActivate,
      });
    }

    return canActivate;
  }

  /** Только списать энергию SUPER (мгновенная ульта через AbilityManager без режима таргета). */
  tryConsumeHumanCaptainUltEnergy(): boolean {
    if (!this.canHumanActivateUlt()) return false;
    const o = this.deps.getHumanOwner();
    this.energyByOwner[o] = 0;
    return true;
  }

  tryBeginUltFromUi(): boolean {
    if (!this.canHumanActivateUlt()) return false;
    const owner = this.deps.getHumanOwner();
    const captain = this.findCaptain(owner);
    if (!captain) return false;

    this.energyByOwner[owner] = 0;

    const uid = captain.getUnitId();

    if (uid === 'captain_urok') {
      this.urokCaptain = captain;
      this.ultMode = 'urok_aim_cone';
      return true;
    }
    if (uid === 'captain_chronos') {
      this.ultMode = 'chronos_pick';
      return true;
    }
    if (uid === 'captain_ethelgard') {
      this.ultMode = 'void_pick_point';
      return true;
    }
    if (uid === 'captain_xerxa') {
      this.xerxaPhase = 'need_xerxa';
      this.applyXerxaSelectionGate(owner);
      this.ultMode = 'idle';
      return true;
    }

    return false;
  }

  cancelUlt(): void {
    this.ultMode = 'idle';
    this.urokCaptain = undefined;
    this.xerxaPhase = 'off';
    this.xerxaInsectExcludeRuntimeId = undefined;
    this.insectRushNext = false;
    this.singularity = undefined;
    this.clearSingularityVfx();
    this.deps.shootingController.setCaptainSelectionFilter(null);
  }

  isUltTargeting(): boolean {
    return this.ultMode !== 'idle' || this.xerxaPhase !== 'off';
  }

  resolveTurnAdvanceAfterStop(lastShooterUnitRuntimeId?: string): 'switch' | 'same_player' {
    const caps = this.deps.getCaps();
    const lastCap = lastShooterUnitRuntimeId
      ? caps.find((c) => c.id === lastShooterUnitRuntimeId)
      : undefined;

    if (this.xerxaPhase === 'need_xerxa' && lastCap && lastCap.getUnitId() === 'captain_xerxa') {
      this.xerxaPhase = 'need_insect';
      this.insectRushNext = true;
      this.applyInsectBonusGate(lastCap.owner, lastCap.id);
      return 'same_player';
    }

    if (this.xerxaPhase === 'need_insect') {
      this.xerxaPhase = 'off';
      this.insectRushNext = false;
      this.xerxaInsectExcludeRuntimeId = undefined;
      this.deps.shootingController.setCaptainSelectionFilter(null);
      return 'switch';
    }

    return 'switch';
  }

  onTurnOwnerChanged(nextOwner: PlayerNumber): void {
    const caps = this.deps.getCaps();
    if (nextOwner === 1) {
      caps.filter((u) => !u.isDestroyed && u.owner === 2).forEach((u) => u.tickCaptainSelectionBanTurn());
    } else {
      caps.filter((u) => !u.isDestroyed && u.owner === 1).forEach((u) => u.tickCaptainSelectionBanTurn());
    }

    if (this.ultMode === 'idle') {
      this.refreshPassiveTrajectoryHooks(nextOwner);
    }
  }

  handleWorldPointer(worldX: number, worldY: number): boolean {
    if (this.ultMode === 'urok_aim_cone' && this.urokCaptain) {
      this.fireUrokCone(this.urokCaptain, worldX, worldY);
      this.ultMode = 'idle';
      this.urokCaptain = undefined;
      return true;
    }
    if (this.ultMode === 'void_pick_point') {
      this.spawnSingularity(worldX, worldY);
      this.ultMode = 'idle';
      return true;
    }
    return false;
  }

  handleUnitTap(unit: Unit): boolean {
    if (this.ultMode !== 'chronos_pick') return false;
    unit.enterCaptainStasis();
    this.captainStasisTurns.set(unit.id, 2);
    this.ultMode = 'idle';
    return true;
  }

  aiTeamShotUnitAllowed(unit: Unit): boolean {
    if (unit.owner !== 2) return true;
    if (this.xerxaPhase === 'need_xerxa') {
      return unit.getUnitId() === 'captain_xerxa';
    }
    if (this.xerxaPhase === 'need_insect') {
      return (
        unit.getFactionId() === 'insect' &&
        unit.id !== this.xerxaInsectExcludeRuntimeId
      );
    }
    return true;
  }

  /**
   * Автоактивация SUPER бота (локальный матч / лига / бот-PvP без realtime-синхронизации).
   */
  tryActivateAiCaptainUltIfReady(): boolean {
    const owner = 2 as PlayerNumber;
    if (this.destroyed || this.deps.isPvP) return false;
    if (!this.teamHasCaptain(owner)) return false;
    if (this.energyByOwner[owner] < CAPTAIN_MAX_ENERGY) return false;
    if (this.ultMode !== 'idle') return false;
    if (this.xerxaPhase !== 'off') return false;

    const captain = this.findCaptain(owner);
    if (!captain) return false;

    if (Math.random() > 0.62) return false;

    const uid = captain.getUnitId();
    this.energyByOwner[owner] = 0;

    if (uid === 'captain_urok') {
      const ball = this.deps.getBall();
      this.fireUrokCone(captain, ball.body.position.x, ball.body.position.y);
      return true;
    }

    if (uid === 'captain_chronos') {
      const t = this.pickAiChronosVictim();
      if (!t) {
        this.energyByOwner[owner] = CAPTAIN_MAX_ENERGY;
        return false;
      }
      t.enterCaptainStasis();
      this.captainStasisTurns.set(t.id, 2);
      return true;
    }

    if (uid === 'captain_ethelgard') {
      const ball = this.deps.getBall();
      this.spawnSingularity(ball.body.position.x, ball.body.position.y);
      return true;
    }

    if (uid === 'captain_xerxa') {
      this.xerxaPhase = 'need_xerxa';
      this.applyXerxaSelectionGate(owner);
      return true;
    }

    this.energyByOwner[owner] = CAPTAIN_MAX_ENERGY;
    return false;
  }

  private pickAiChronosVictim(): Unit | undefined {
    const ball = this.deps.getBall();
    const enemies = this.deps.getCaps().filter((u) => u.owner === 1);
    if (enemies.length === 0) return undefined;
    let best: Unit | undefined;
    let bestD = Infinity;
    for (const e of enemies) {
      const dx = e.body.position.x - ball.body.position.x;
      const dy = e.body.position.y - ball.body.position.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) {
        bestD = d2;
        best = e;
      }
    }
    return best;
  }

  update(_time: number, delta: number): void {
    if (this.destroyed) return;

    const phase = this.deps.getMatchPhase?.();
    if (phase === MatchPhase.GOAL || phase === MatchPhase.FINISHED) {
      if (
        this.singularity ||
        this.ultMode !== 'idle' ||
        this.urokCaptain ||
        this.xerxaPhase !== 'off'
      ) {
        this.cancelUlt();
      }
      return;
    }

    const caps = this.deps.getCaps();
    const ball = this.deps.getBall();

    this.applyUrokMassAura(caps);
    this.applyVoidBallPull(ball, caps, delta);
    this.drawInsectSwarmLinks(caps);

    const now = Date.now();
    if (this.singularity && now < this.singularity.until) {
      this.applySingularityForces(this.singularity, delta);
    } else if (this.singularity && now >= this.singularity.until) {
      this.singularity = undefined;
      this.clearSingularityVfx();
    }

    const owner = this.deps.shootingController.getCurrentPlayer?.();
    if (owner !== undefined && this.ultMode === 'idle') {
      this.refreshPassiveTrajectoryHooks(owner);
    }
  }

  private findCaptain(owner: PlayerNumber): Unit | undefined {
    return this.deps.getCaps().find((u) => u.owner === owner && isCaptainUnitId(u.getUnitId()));
  }

  private teamHasCaptain(owner?: PlayerNumber): boolean {
    if (owner === undefined) return false;
    return this.findCaptain(owner) !== undefined;
  }

  private addEnergy(owner: PlayerNumber, amt: number): void {
    if (!this.teamHasCaptain(owner)) return;

    const oldEnergy = this.energyByOwner[owner];
    this.energyByOwner[owner] = Math.min(CAPTAIN_MAX_ENERGY, oldEnergy + amt);

    if (import.meta.env.DEV) {
      console.log('[CaptainMatchSystem] Energy added:', {
        owner,
        amount: amt,
        oldEnergy,
        newEnergy: this.energyByOwner[owner],
        maxEnergy: CAPTAIN_MAX_ENERGY,
      });
    }
  }

  private onBallUnitCollision(payload: import('../core/EventBus').CollisionBallUnitPayload): void {
    const owner = payload.unitOwner;
    if (owner === undefined) return;
    this.addEnergy(owner, CAPTAIN_ENERGY_BALL_TOUCH);
  }

  private onGoal(payload: import('../core/EventBus').GoalScoredPayload): void {
    this.cancelUlt();

    const scorer = payload.scoringPlayer;
    this.addEnergy(scorer, CAPTAIN_ENERGY_GOAL_SCORED);
    const conceding = scorer === 1 ? 2 : 1;
    this.addEnergy(conceding, CAPTAIN_ENERGY_GOAL_CONCEDED);
  }

  private onObjectsStopped(): void {
    const caps = this.deps.getCaps();
    caps.forEach((u) => {
      if (u.isDestroyed) return;
      const left = this.captainStasisTurns.get(u.id);
      if (left === undefined) return;
      const next = left - 1;
      if (next <= 0) {
        this.captainStasisTurns.delete(u.id);
        u.exitCaptainStasis();
      } else {
        this.captainStasisTurns.set(u.id, next);
      }
    });
  }

  private bindShootingHooks(): void {
    this.deps.shootingController.setCaptainShotForceScale((cap) => {
      let m = 1;
      if (cap instanceof Unit) {
        m *= this.getInsectSwarmPowerMul(cap);
      }
      if (this.insectRushNext && cap instanceof Unit && cap.getFactionId() === 'insect') {
        m *= 0.5;
      }
      return m;
    });
  }

  private refreshPassiveTrajectoryHooks(forOwner: PlayerNumber): void {
    const chronos = this.deps
      .getCaps()
      .find((u) => u.owner === forOwner && u.getUnitId() === 'captain_chronos');
    if (!chronos) {
      this.deps.shootingController.setCaptainTrajectoryHooks(null);
      return;
    }
    this.deps.shootingController.setCaptainTrajectoryHooks({
      getDistanceMultiplier: () => 1.4,
      shouldAlwaysDrawSecondBounce: () => true,
    });
  }

  private applyUrokMassAura(caps: Unit[]): void {
    const touched = new Set<string>();
    for (const cap of caps) {
      if (cap.isDestroyed || cap.getUnitId() !== 'captain_urok') continue;
      const ox = cap.owner;
      const cx = cap.body.position.x;
      const cy = cap.body.position.y;
      for (const ally of caps) {
        if (ally.isDestroyed || ally.owner !== ox || ally.id === cap.id) continue;
        const dx = ally.body.position.x - cx;
        const dy = ally.body.position.y - cy;
        if (dx * dx + dy * dy <= CAPTAIN_UROK_AURA_RADIUS * CAPTAIN_UROK_AURA_RADIUS) {
          touched.add(ally.id);
          if (!this.massAuraRestore.has(ally.id)) {
            this.massAuraRestore.set(ally.id, ally.body.mass);
          }
          const base = this.massAuraRestore.get(ally.id)!;
          this.deps.scene.matter.body.setMass(ally.body, base * 1.3);
        }
      }
    }
    this.massAuraRestore.forEach((baseMass, id) => {
      if (touched.has(id)) return;
      const u = caps.find((c) => c.id === id);
      if (u && !u.isDestroyed) {
        this.deps.scene.matter.body.setMass(u.body, baseMass);
      }
      this.massAuraRestore.delete(id);
    });
  }

  private applyVoidBallPull(ball: Ball, caps: Unit[], delta: number): void {
    const voidAllies = caps.filter((u) => !u.isDestroyed && u.getFactionId() === 'void');
    if (voidAllies.length === 0) return;
    const bx = ball.body.position.x;
    const by = ball.body.position.y;
    let nearest: Unit | undefined;
    let best = CAPTAIN_VOID_PULL_RADIUS * CAPTAIN_VOID_PULL_RADIUS;
    for (const u of voidAllies) {
      const dx = u.body.position.x - bx;
      const dy = u.body.position.y - by;
      const d2 = dx * dx + dy * dy;
      if (d2 < best) {
        best = d2;
        nearest = u;
      }
    }
    if (!nearest || best > CAPTAIN_VOID_PULL_RADIUS * CAPTAIN_VOID_PULL_RADIUS) return;

    const pull = (delta / 1000) * 0.000045 * nearest.body.mass;
    const vx = nearest.body.position.x - bx;
    const vy = nearest.body.position.y - by;
    const len = Math.sqrt(vx * vx + vy * vy) || 1;
    this.deps.scene.matter.body.applyForce(ball.body, ball.body.position, {
      x: (vx / len) * pull,
      y: (vy / len) * pull,
    });
  }

  private getInsectSwarmPowerMul(unit: Unit): number {
    if (unit.getFactionId() !== 'insect') return 1;
    const caps = this.deps.getCaps();
    const allies = caps.filter(
      (u) => u.owner === unit.owner && u.getFactionId() === 'insect' && u.id !== unit.id
    );
    for (const o of allies) {
      const dx = o.body.position.x - unit.body.position.x;
      const dy = o.body.position.y - unit.body.position.y;
      if (dx * dx + dy * dy <= CAPTAIN_INSECT_SWARM_DISTANCE * CAPTAIN_INSECT_SWARM_DISTANCE) {
        return 1.15;
      }
    }
    return 1;
  }

  private drawInsectSwarmLinks(caps: Unit[]): void {
    const insects = caps.filter((u) => !u.isDestroyed && u.getFactionId() === 'insect');
    if (!this.swarmGfx) {
      this.swarmGfx = this.deps.scene.add.graphics().setDepth(55);
    }
    this.swarmGfx.clear();
    for (let i = 0; i < insects.length; i++) {
      for (let j = i + 1; j < insects.length; j++) {
        if (insects[i].owner !== insects[j].owner) continue;
        const dx = insects[i].body.position.x - insects[j].body.position.x;
        const dy = insects[i].body.position.y - insects[j].body.position.y;
        if (dx * dx + dy * dy > CAPTAIN_INSECT_SWARM_DISTANCE * CAPTAIN_INSECT_SWARM_DISTANCE) continue;
        this.swarmGfx.lineStyle(2, 0x39ff14, 0.35);
        this.swarmGfx.lineBetween(
          insects[i].body.position.x,
          insects[i].body.position.y,
          insects[j].body.position.x,
          insects[j].body.position.y
        );
      }
    }
  }

  /**
   * Тектонический конус: направление от капитана к точке тапа.
   * Короткий вектор (тап возле Урока) давал почти нулевой normalize() — импульса не было.
   */
  private fireUrokCone(captain: Unit, aimWorldX: number, aimWorldY: number): void {
    if (captain.isDestroyed || !captain.body) return;

    const cx = captain.body.position.x;
    const cy = captain.body.position.y;
    const owner = captain.owner;

    let dx = aimWorldX - cx;
    let dy = aimWorldY - cy;
    let len = Math.sqrt(dx * dx + dy * dy);
    const minAim = 36;
    if (len < minAim) {
      const ball = this.deps.getBall();
      if (ball?.body) {
        dx = ball.body.position.x - cx;
        dy = ball.body.position.y - cy;
        len = Math.sqrt(dx * dx + dy * dy);
      }
    }
    if (len < minAim) {
      dx = 240;
      dy = 0;
      len = 240;
    }
    const dirX = dx / len;
    const dirY = dy / len;

    const caps = this.deps.getCaps();
    const cam = this.deps.scene.cameras.main;
    cam.shake(340, 0.018);

    const waveColor = FACTIONS[captain.factionId]?.color ?? 0xff5722;
    for (let i = 0; i < 3; i++) {
      const ring = this.deps.scene.add.circle(cx, cy, 48 + i * 36, waveColor, 0).setDepth(88 + i);
      ring.setStrokeStyle(5 - i, waveColor, 0.95 - i * 0.22);
      this.deps.scene.time.delayedCall(i * 70, () => {
        if (!ring.active) return;
        this.deps.scene.tweens.add({
          targets: ring,
          scaleX: 3.2,
          scaleY: 3.2,
          alpha: 0,
          duration: 520,
          ease: 'Cubic.easeOut',
          onComplete: () => {
            try {
              ring.destroy();
            } catch {
              /* scene teardown */
            }
          },
        });
      });
    }

    try {
      eventBus.dispatch(GameEvents.HAPTIC_FEEDBACK, { type: 'heavy' });
    } catch {}

    const halfRad = Phaser.Math.DegToRad(CAPTAIN_UROK_CONE_DEG / 2);
    const forward = Math.atan2(dirY, dirX);

    const impulsePerMass = 0.052;

    for (const u of caps) {
      if (u.isDestroyed || !u.body || u.owner === owner) continue;
      const ux = u.body.position.x - cx;
      const uy = u.body.position.y - cy;
      const dist = Math.sqrt(ux * ux + uy * uy);
      if (dist > CAPTAIN_UROK_CONE_RANGE || dist < 8) continue;
      const ang = Math.atan2(uy, ux);
      let deltaAng = ang - forward;
      while (deltaAng > Math.PI) deltaAng -= Math.PI * 2;
      while (deltaAng < -Math.PI) deltaAng += Math.PI * 2;
      if (Math.abs(deltaAng) > halfRad) continue;

      const nx = ux / dist;
      const ny = uy / dist;
      const falloff = 0.55 + 0.45 * (1 - dist / CAPTAIN_UROK_CONE_RANGE);
      const force = impulsePerMass * u.body.mass * falloff;
      this.deps.scene.matter.body.applyForce(u.body, u.body.position, { x: nx * force, y: ny * force });
      u.applyCaptainRiftSelectionBan(1);
    }
  }

  private clearSingularityVfx(): void {
    if (!this.singularityVfxRing) return;
    try {
      this.deps.scene.tweens.killTweensOf(this.singularityVfxRing);
      this.singularityVfxRing.destroy();
    } catch {
      /* уже уничтожен или сцена закрыта */
    }
    this.singularityVfxRing = undefined;
  }

  private spawnSingularity(x: number, y: number): void {
    this.clearSingularityVfx();
    const durationMs = 2800;
    this.singularity = { x, y, until: Date.now() + durationMs };

    const cam = this.deps.scene.cameras.main;
    cam.flash(160, 110, 70, 210, false, undefined, 0.38);
    cam.shake(380, 0.011);

    const ring = this.deps.scene.add.circle(x, y, 36, 0x581c87, 0.42).setDepth(91);
    ring.setStrokeStyle(8, 0xe9d5ff, 0.95);
    this.singularityVfxRing = ring;
    this.deps.scene.tweens.add({
      targets: ring,
      scaleX: 6,
      scaleY: 6,
      alpha: 0.12,
      duration: durationMs,
      ease: 'Cubic.easeOut',
    });

    const core = this.deps.scene.add.circle(x, y, 22, 0x1e1b4b, 0.92).setDepth(93);
    this.deps.scene.tweens.add({
      targets: core,
      scaleX: 2.1,
      scaleY: 2.1,
      alpha: 0,
      duration: durationMs - 200,
      ease: 'Sine.easeInOut',
      onComplete: () => core.destroy(),
    });

    try {
      eventBus.dispatch(GameEvents.HAPTIC_FEEDBACK, { type: 'heavy' });
    } catch {}
  }

  /** Притяжение к точке SUPER — раньше сила была слишком мала, эффект почти не чувствовался. */
  private applySingularityForces(s: { x: number; y: number }, delta: number): void {
    const ball = this.deps.getBall();
    if (!ball?.body) return;

    const caps = this.deps.getCaps();
    const bodies: MatterJS.BodyType[] = [];
    for (const u of caps) {
      if (u.isDestroyed || !u.body) continue;
      bodies.push(u.body);
    }
    bodies.push(ball.body);
    const dt = Math.min(Math.max(delta, 8), 40);
    const dtNorm = dt / 1000;

    for (const body of bodies) {
      if (!body) continue;
      const dx = s.x - body.position.x;
      const dy = s.y - body.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      if (dist > 920 || dist < 14) continue;

      const invR2 = 1 / (dist * dist + 1800);
      const pull = dtNorm * body.mass * 520 * invR2;

      try {
        this.deps.scene.matter.body.applyForce(body, body.position, {
          x: (dx / dist) * pull,
          y: (dy / dist) * pull,
        });
      } catch {
        continue;
      }
    }
  }

  private applyXerxaSelectionGate(owner: PlayerNumber): void {
    this.deps.shootingController.setCaptainSelectionFilter((cap) => {
      if (!(cap instanceof Unit)) return false;
      return cap.owner === owner && cap.getUnitId() === 'captain_xerxa';
    });
  }

  private applyInsectBonusGate(owner: PlayerNumber, excludeRuntimeId: string): void {
    this.xerxaInsectExcludeRuntimeId = excludeRuntimeId;
    this.deps.shootingController.setCaptainSelectionFilter((cap) => {
      if (!(cap instanceof Unit)) return false;
      return cap.owner === owner && cap.getFactionId() === 'insect' && cap.id !== excludeRuntimeId;
    });
  }
}
