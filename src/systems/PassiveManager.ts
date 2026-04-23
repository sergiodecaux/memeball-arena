// src/systems/PassiveManager.ts
// Менеджер пассивных способностей

import Phaser from 'phaser';
import { Unit } from '../entities/Unit';
import { Ball } from '../entities/Ball';
import { getUnitById, getUnitPassive } from '../data/UnitsRepository';
import { FactionId } from '../constants/gameConstants';
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

export class PassiveManager extends Phaser.Events.EventEmitter {
  private scene: Phaser.Scene;
  private state: MatchPassiveState;
  private units: Map<string, Unit> = new Map();
  private ball: Ball | null = null;
  private playerId: number;
  
  constructor(scene: Phaser.Scene, playerId: number) {
    super();
    this.scene = scene;
    this.playerId = playerId;
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
    
    this.state.units[unitId] = {
      unitId,
      shotCount: 0,
      hasUsedOncePerMatch: false,
      currentStacks: {},
      activeBuffs: [],
      activeDebuffs: [],
    };
    
    console.log(`[PassiveManager] Registered unit: ${unitId}`);
  }
  
  public registerBall(ball: Ball): void {
    this.ball = ball;
  }
  
  private setupEventListeners(): void {
    eventBus.on(GameEvents.GOAL_SCORED, this.onGoalScored.bind(this));
    eventBus.on(GameEvents.TURN_STARTED, this.onTurnStarted.bind(this));
    eventBus.on(GameEvents.TURN_ENDED, this.onTurnEnded.bind(this));
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
        this.applyConditionalPassive(unit, passive, 'goal_conceded');
      }
      
      // Risk/Reward пассивки (например, Ragnaros)
      if (passive.type === 'risk_reward' && (passive.params.condition === 'after_goal' || passive.params.condition === 'goal_conceded')) {
        this.applyRiskRewardOnGoal(unit, passive, isOwnGoal);
      }
    });
  }
  
  private onTurnStarted(data: { turn: number; playerId: number }): void {
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
  
  private onTurnEnded(data: { turn: number }): void {
    // Уменьшаем длительность эффектов
    this.tickEffectDurations();
  }
  
  // ========== ОБРАБОТКА УДАРА ПО МЯЧУ ==========
  
  public onBallHit(unit: Unit, force: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const unitId = unit.getUnitId();
    const passive = this.getUnitPassive(unitId);
    const unitState = this.state.units[unitId];
    
    if (!passive || !unitState) return force;
    
    // Увеличиваем счётчик ударов
    unitState.shotCount++;
    
    let modifiedForce = force.clone();
    
    switch (passive.type) {
      case 'on_hit_ball':
        modifiedForce = this.applyOnHitBall(unit, force, passive);
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
    
    return modifiedForce;
  }
  
  private applyOnHitBall(unit: Unit, force: Phaser.Math.Vector2, passive: PassiveAbility): Phaser.Math.Vector2 {
    const params = passive.params;
    let modifiedForce = force.clone();
    
    // Rocket Gunner: отталкивает ближайшего врага
    if (passive.name === 'Реактивный залп') {
      this.pushNearestEnemy(unit, params.radius || 60, params.value || 30);
    }
    
    // Lava Sniper: мяч проходит сквозь первого врага
    if (passive.name === 'Расплавление') {
      this.setBallPassThrough(1);
    }
    
    // Voidbolt: 25% телепорт мяча вперёд
    if (passive.name === 'Хаотичный выстрел' && Math.random() < (params.chance || 0.25)) {
      this.scheduleBallTeleport(force, params.value || 50);
    }
    
    // Venom: мяч замедляет первого врага
    if (passive.name === 'Коррозийный выстрел') {
      this.setBallSlowOnHit(params.value || 0.10);
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
      // Curve bonus применяется в Unit.ts
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
    // Curve boost применяется в Unit.ts через getCurveBonus()
    // Mass boost применяется при создании юнита
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
  
  // ========== ОБРАБОТКА СТОЛКНОВЕНИЙ ==========
  
  public onUnitCollision(unit: Unit, enemy: Unit): void {
    const passive = this.getUnitPassive(unit.getUnitId());
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
    }
    
    // Absorb impulse (Ironclad, Abyssal)
    if (passive.name === 'Энергощит' || passive.name === 'Поглощение бездны') {
      // Handled in collision physics
    }
  }
  
  public onBallCollision(unit: Unit, ball: Ball): void {
    // Check for ball slow effect
    const ballSlowEffect = this.getBallEffect('slow_on_hit');
    if (ballSlowEffect && this.isEnemy(unit)) {
      this.applyDebuff(unit, 'slow', ballSlowEffect.value, 1, ballSlowEffect.sourceUnitId);
      this.clearBallEffect('slow_on_hit');
    }
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
          }
          // Black Hole: attract ball when defending
          if (passive.name === 'Космическая броня' && this.isDefending(unit)) {
            this.attractBallToUnit(unit, params.radius || 60);
          }
        }
      }
    });
  }
  
  // ========== УСИЛЕНИЕ КАРТ ==========
  
  public getCardEnhancement(unitId: string, cardType: string): { radiusBonus: number; durationBonus: number; special: string | null } {
    const passive = this.getUnitPassive(unitId);
    if (!passive || passive.type !== 'card_enhance') {
      return { radiusBonus: 0, durationBonus: 0, special: null };
    }
    
    const params = passive.params;
    let result = { radiusBonus: 0, durationBonus: 0, special: null as string | null };
    
    // Magma Champion: Lava Pool +25% radius
    if (passive.name === 'Властелин лавы' && cardType === 'magma_lava') {
      result.radiusBonus = params.value || 0.25;
    }
    
    // Omega Sentinel: Shield +20% radius, +1 duration
    if (passive.name === 'Протокол стража' && cardType === 'cyborg_shield') {
      result.radiusBonus = params.value || 0.20;
      result.durationBonus = params.duration || 1;
    }
    
    // Colossus (Cyborg): Barrier +30% length
    if (passive.name === 'Титановый щит' && cardType === 'cyborg_barrier') {
      result.radiusBonus = params.value || 0.30;
    }
    
    // Darkstar: Wormhole attracts ball
    if (passive.name === 'Затмение' && cardType === 'void_wormhole') {
      result.special = 'attract_ball';
      result.radiusBonus = params.radius || 30;
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
  
  // ========== ИММУНИТЕТЫ И КОНТРЫ ==========
  
  public hasImmunity(unit: Unit, effectType: string): boolean {
    const passive = this.getUnitPassive(unit.getUnitId());
    if (!passive || passive.type !== 'counter') return false;
    
    // Iron Sentinel: Immunity to slow and stun from Insect
    if (passive.name === 'Антитоксин') {
      return effectType === 'slow' || effectType === 'stun';
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
    }
    
    // After hit received: +defense
    if (triggerCondition === 'after_hit' && params.value) {
      const maxStacks = params.maxStacks || 3;
      this.stackBuff(unit, 'defense', params.value, params.duration || 1, unitId, maxStacks);
    }
    
    // After goal: +speed
    if (triggerCondition === 'after_goal' && params.value) {
      this.applyBuff(unit, 'speed', params.value, params.duration || 2, unitId);
      this.showPassiveActivation(unit, passive.name);
    }
    
    // After ally hit: +power
    if (triggerCondition === 'ally_hit' && params.value) {
      this.applyBuff(unit, 'power', params.value, params.duration || 1, unitId);
    }
    
    // Defending: +mass or +defense
    if (triggerCondition === 'defending' && this.isDefending(unit)) {
      if (passive.name === 'Био-крепость') {
        this.applyBuff(unit, 'mass', params.value || 0.30, 1, unitId);
      }
    }
    
    // Own half: +defense
    if (triggerCondition === 'own_half' && this.isOnOwnHalf(unit)) {
      this.applyBuff(unit, 'defense', params.value || 0.15, 1, unitId);
    }
    
    // After swap: +defense
    if (triggerCondition === 'after_swap' && params.value) {
      this.applyBuff(unit, 'defense', params.value, params.duration || 2, unitId);
    }
    
    // No goal in 3 turns: +power
    if (triggerCondition === 'no_goal_3_turns' && params.value) {
      this.applyBuff(unit, 'power', params.value, 1, unitId);
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
  
  private isEnemy(unit: Unit): boolean {
    return unit.owner !== this.playerId;
  }
  
  private isAlly(unit1: Unit, unit2: Unit): boolean {
    return unit1.owner === unit2.owner;
  }
  
  private isInsect(unit: Unit): boolean {
    const unitData = getUnitById(unit.getUnitId());
    return unitData?.factionId === 'insect';
  }
  
  private isOnEnemyHalf(unit: Unit): boolean {
    const fieldWidth = this.scene.scale.width;
    const isPlayer1 = unit.owner === 1;
    return isPlayer1 ? unit.x > fieldWidth / 2 : unit.x < fieldWidth / 2;
  }
  
  private isOnOwnHalf(unit: Unit): boolean {
    return !this.isOnEnemyHalf(unit);
  }
  
  private isDefending(unit: Unit): boolean {
    const fieldWidth = this.scene.scale.width;
    const isPlayer1 = unit.owner === 1;
    const goalZone = fieldWidth * 0.2;
    return isPlayer1 ? unit.x < goalZone : unit.x > fieldWidth - goalZone;
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
  
  private pushNearestEnemy(unit: Unit, radius: number, pushDistance: number): void {
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
    
    if (nearestEnemy) {
      const angle = Phaser.Math.Angle.Between(unit.x, unit.y, nearestEnemy.x, nearestEnemy.y);
      const pushX = Math.cos(angle) * pushDistance;
      const pushY = Math.sin(angle) * pushDistance;
      
      // Apply push force
      eventBus.dispatch(GameEvents.PASSIVE_PUSH, {
        targetUnitId: nearestEnemy.getUnitId(),
        pushX,
        pushY,
      });
    }
  }
  
  private setBallPassThrough(count: number): void {
    eventBus.dispatch(GameEvents.BALL_PASS_THROUGH, { count });
  }
  
  private setBallSlowOnHit(value: number): void {
    // Store effect to apply on next ball-enemy collision
    this.setBallEffect('slow_on_hit', value, 'venom');
  }
  
  private setBallEffect(type: string, value: number, sourceId: string): void {
    eventBus.dispatch(GameEvents.BALL_EFFECT_SET, { type, value, sourceUnitId: sourceId });
  }
  
  private getBallEffect(type: string): ActivePassiveEffect | null {
    // Get from ball state - implemented in Ball.ts
    return null;
  }
  
  private clearBallEffect(type: string): void {
    eventBus.dispatch(GameEvents.BALL_EFFECT_CLEAR, { type });
  }
  
  private scheduleBallTeleport(force: Phaser.Math.Vector2, distance: number): void {
    const angle = Math.atan2(force.y, force.x);
    eventBus.dispatch(GameEvents.BALL_TELEPORT_SCHEDULED, { angle, distance });
  }
  
  private scheduleUnitTeleport(unit: Unit): void {
    const fieldWidth = this.scene.scale.width;
    const fieldHeight = this.scene.scale.height;
    const isPlayer1 = unit.owner === 1;
    
    // Random position on own half
    const x = isPlayer1 
      ? Phaser.Math.Between(50, fieldWidth / 2 - 50)
      : Phaser.Math.Between(fieldWidth / 2 + 50, fieldWidth - 50);
    const y = Phaser.Math.Between(50, fieldHeight - 50);
    
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
    const fieldWidth = this.scene.scale.width;
    const fieldHeight = this.scene.scale.height;
    
    // Random position anywhere
    const x = Phaser.Math.Between(100, fieldWidth - 100);
    const y = Phaser.Math.Between(100, fieldHeight - 100);
    
    eventBus.dispatch(GameEvents.UNIT_TELEPORT, {
      unitId: randomEnemy.getUnitId(),
      x,
      y,
    });
  }
  
  private teleportToOwnGoal(unit: Unit): void {
    const fieldWidth = this.scene.scale.width;
    const fieldHeight = this.scene.scale.height;
    const isPlayer1 = unit.owner === 1;
    
    const x = isPlayer1 ? 80 : fieldWidth - 80;
    const y = fieldHeight / 2;
    
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
    const fieldWidth = this.scene.scale.width;
    const fieldHeight = this.scene.scale.height;
    
    eventBus.dispatch(GameEvents.CREATE_LAVA_POOL, {
      x: fieldWidth / 2,
      y: fieldHeight / 2,
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
      for (const buff of unitState.activeBuffs) {
        if (buff.effectType === 'mass') return buff.value;
      }
    }
    
    return 0;
  }
  
  // ========== ОЧИСТКА ==========
  
  public destroy(): void {
    eventBus.off(GameEvents.GOAL_SCORED, this.onGoalScored.bind(this));
    eventBus.off(GameEvents.TURN_STARTED, this.onTurnStarted.bind(this));
    eventBus.off(GameEvents.TURN_ENDED, this.onTurnEnded.bind(this));
    this.units.clear();
    this.ball = null;
  }
}
