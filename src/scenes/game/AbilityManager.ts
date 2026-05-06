// src/scenes/game/AbilityManager.ts
// ✅ ИЗМЕНЕНО: Добавлена улучшенная валидация, физика коллизий согласно ТЗ

import Phaser from 'phaser';
import { 
  ABILITY_CONFIG,
  ABILITY_CHARGE,
  FACTIONS, 
  FactionId,
  UnitStatus,
  COLLISION_CATEGORIES,
} from '../../constants/gameConstants';
import { Unit } from '../../entities/Unit';
import { Ball } from '../../entities/Ball';
import { LavaPool } from './LavaPool';
import { GameUnit } from './types';
import { playerData } from '../../data/PlayerData';
import { PlayerNumber, FieldBounds } from '../../types';
import { 
  eventBus, 
  GameEvents,
} from '../../core/EventBus';
import { 
  getCard, 
  CardDefinition, 
  CardTargetType,
  getCardsByFaction,
} from '../../data/CardsCatalog';
import { getUnitById } from '../../data/UnitsRepository';
import { VFXManager } from '../../managers/VFXManager';
import { PassiveManager } from '../../systems/PassiveManager';

// Порядок редкостей для авто-экипировки
const RARITY_ORDER: Record<string, number> = {
  common: 0,
  rare: 1,
  epic: 2,
};

export type AbilityState = 
  | 'IDLE'
  | 'SELECTING_POINT'
  | 'SELECTING_UNIT_SELF'
  | 'SELECTING_UNIT_ENEMY'
  | 'SELECTING_UNIT_PAIR'
  | 'EXECUTING';

export interface AbilityManagerConfig {
  scene: Phaser.Scene;
  getCaps: () => GameUnit[];
  getBall: () => Ball;
  getFieldBounds: () => FieldBounds;
  isHost: boolean;
  isPvPMode: boolean;
  playerFaction: FactionId;
  playerId: PlayerNumber;
  vfxManager?: VFXManager;
  /** UI капитана: энергия полная и можно начать SUPER */
  canCaptainUltReady?: () => boolean;
  /** Запуск режима ульты капитана (CaptainMatchSystem) */
  tryBeginCaptainUlt?: () => boolean;
  /** Списать энергию SUPER без режима таргета */
  trySpendCaptainUltEnergy?: () => boolean;
}

export interface CardSlot {
  cardId: string | null;
  used: boolean;
}

export interface ActiveEffect {
  id: string;
  type: string;
  data: any;
  expiresAtTurn?: number;
  destroy: () => void;
}

// ✅ ДОБАВЛЕНО: Интерфейс для отслеживания объектов в лаве
interface LavaAffectedBody {
  body: MatterJS.BodyType;
  pool: LavaPool;
  ticksInLava: number;
}

export class AbilityManager extends Phaser.Events.EventEmitter {
  private scene: Phaser.Scene;
  private getCaps: () => GameUnit[];
  private getBall: () => Ball;
  private getFieldBounds: () => FieldBounds;
  private isHost: boolean;
  private isPvPMode: boolean;
  private factionId: FactionId;
  private playerId: PlayerNumber;
  private vfxManager?: VFXManager;
  private canCaptainUltReady?: () => boolean;
  private tryBeginCaptainUlt?: () => boolean;
  private trySpendCaptainUltEnergy?: () => boolean;

  // === КАРТОЧНАЯ СИСТЕМА ===
  private deck: CardSlot[] = [];
  private currentState: AbilityState = 'IDLE';
  private pendingCardId: string | null = null;
  private selectedUnits: string[] = [];
  private targetPosition: { x: number; y: number } | null = null;

  // === 🕐 ГЛОБАЛЬНЫЙ КУЛДАУН ===
  private lastGlobalActivationTime: number = 0;
  private readonly COOLDOWN_MS = 60000; // 60 секунд (fallback)

  // === АКТИВНЫЕ ЭФФЕКТЫ ===
  private activeEffects: ActiveEffect[] = [];
  private lavaPools: LavaPool[] = [];
  private lavaIdCounter: number = 0;

  // ✅ ДОБАВЛЕНО: Отслеживание объектов в лаве для вязкости
  private bodiesInLava: Map<MatterJS.BodyType, LavaAffectedBody> = new Map();

  // === UI ДЛЯ ТАРГЕТИНГА ===
  private targetingCursor?: Phaser.GameObjects.Container;
  private validPlacementZone?: Phaser.GameObjects.Graphics;
  private unitHighlights: Map<string, Phaser.GameObjects.Graphics> = new Map();

  // === СОСТОЯНИЕ МАТЧА ===
  private currentTurn: number = 0;
  private lastActiveUnit?: GameUnit;
  
  // === PASSIVE SYSTEM ===
  private passiveManager: PassiveManager | null = null;

  // ✅ ДОБАВЛЕНО: Константы валидации согласно ТЗ
  private readonly GOAL_ZONE_PERCENT = 0.20;      // 20% от края - запретная зона для лавы
  private readonly MIN_DISTANCE_TO_BALL = 80;      // 80px минимум до мяча для лавы
  private readonly MIN_DISTANCE_TO_UNIT = 60;      // 60px минимум до юнитов
  private readonly LAVA_VISCOSITY = 0.92;          // Коэффициент замедления в лаве
  private readonly SHIELD_REFLECT_FORCE = 0.15;    // Сила отражения от щита

  constructor(config: AbilityManagerConfig) {
    super();
    
    this.scene = config.scene;
    this.getCaps = config.getCaps;
    this.getBall = config.getBall;
    this.getFieldBounds = config.getFieldBounds;
    this.isHost = config.isHost;
    this.isPvPMode = config.isPvPMode;
    this.factionId = config.playerFaction;
    this.playerId = config.playerId;
    this.vfxManager = config.vfxManager;
    this.canCaptainUltReady = config.canCaptainUltReady;
    this.tryBeginCaptainUlt = config.tryBeginCaptainUlt;
    this.trySpendCaptainUltEnergy = config.trySpendCaptainUltEnergy;

    this.initializeDeck();
    this.setupCollisionListeners();

    console.log(`[AbilityManager P${this.playerId}] Initialized with cooldown system`);
  }

  private initializeDeck(): void {
    if (this.playerId === 1) {
      let loadout = playerData.getLoadoutCardsForMatch(this.factionId);
      if (loadout.length === 0) {
        loadout = this.autoEquipDeck();
      }
      this.deck = loadout.map(cardId => ({ cardId: cardId, used: false }));
      while (this.deck.length < 3) {
        this.deck.push({ cardId: null, used: false });
      }
    } else {
      this.deck = this.generateAIDeck();
    }
  }

  private autoEquipDeck(): string[] {
    const inventory = playerData.getCardInventory();
    const factionCards = getCardsByFaction(this.factionId);
    const availableCards = factionCards
      .filter(card => inventory[card.id] > 0)
      .sort((a, b) => (RARITY_ORDER[a.rarity] ?? 999) - (RARITY_ORDER[b.rarity] ?? 999));
    return availableCards.slice(0, 3).map(card => card.id);
  }

  private generateAIDeck(): CardSlot[] {
    const factionCards = getCardsByFaction(this.factionId);
    const commonCards = factionCards.filter(c => c.rarity === 'common');
    const aiCards: CardSlot[] = [];
    const numCards = Math.random() > 0.5 ? 2 : 1;
    for (let i = 0; i < numCards && i < commonCards.length; i++) {
      aiCards.push({ cardId: commonCards[i % commonCards.length].id, used: false });
    }
    while (aiCards.length < 3) aiCards.push({ cardId: null, used: false });
    return aiCards;
  }

  /** Первые уникальные карты из руки ИИ — чтобы колода P2 совпадала с AIController. */
  public alignAIDeckFromHand(cardIds: string[]): void {
    if (this.playerId !== 2) return;
    const slots: CardSlot[] = [];
    const seen = new Set<string>();
    for (const id of cardIds) {
      if (!id || seen.has(id)) continue;
      if (!getCard(id)) continue;
      seen.add(id);
      slots.push({ cardId: id, used: false });
      if (slots.length >= 3) break;
    }
    while (slots.length < 3) slots.push({ cardId: null, used: false });
    this.deck = slots;
  }

  // ============================================================
  // PUBLIC API — КУЛДАУН И КАРТЫ
  // ============================================================

  /** 
   * Возвращает оставшееся время кулдауна в секундах.
   * Если 0 — способность готова к использованию.
   */
  public getCooldownRemaining(): number {
    const now = Date.now();
    const diff = now - this.lastGlobalActivationTime;
    const cooldownMs = (ABILITY_CHARGE as any).GLOBAL_COOLDOWN_MS || this.COOLDOWN_MS;
    const remaining = cooldownMs - diff;
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  public getAvailableCards(): CardDefinition[] {
    return this.deck
      .filter(slot => slot.cardId !== null && !slot.used)
      .map(slot => getCard(slot.cardId!)!)
      .filter(card => card !== undefined);
  }

  public getCardInSlot(slotIndex: number): CardDefinition | null {
    if (slotIndex < 0 || slotIndex >= this.deck.length) return null;
    const slot = this.deck[slotIndex];
    if (!slot.cardId || slot.used) return null;
    return getCard(slot.cardId) || null;
  }

  public canActivateCard(slotIndex: number): boolean {
    if (this.currentState !== 'IDLE') return false;
    
    // Проверка глобального кулдауна
    if (this.getCooldownRemaining() > 0) return false;

    const card = this.getCardInSlot(slotIndex);
    return card !== null;
  }

  public startCardActivation(slotIndex: number): boolean {
    // 1. Проверка кулдауна
    const cooldown = this.getCooldownRemaining();
    if (cooldown > 0) {
      console.log(`[AbilityManager] Cooldown active. Wait ${cooldown}s`);
      eventBus.dispatch(GameEvents.HAPTIC_FEEDBACK, { type: 'error' });
      return false;
    }

    const card = this.getCardInSlot(slotIndex);
    if (!card) {
      console.log(`[AbilityManager P${this.playerId}] No card in slot ${slotIndex}`);
      return false;
    }

    if (this.currentState !== 'IDLE') {
      console.log(`[AbilityManager P${this.playerId}] Already in state: ${this.currentState}`);
      return false;
    }

    this.pendingCardId = card.id;
    this.selectedUnits = [];
    this.targetPosition = null;

    this.transitionToTargetingState(card.targetType);

    eventBus.dispatch(GameEvents.ABILITY_ACTIVATION_STARTED, {
      playerId: this.playerId,
      abilityType: card.id,
      targetType: card.targetType,
    });

    this.emit('card_activation_started', {
      cardId: card.id,
      targetType: card.targetType,
    });

    console.log(`[AbilityManager P${this.playerId}] Started activation: ${card.name}`);
    return true;
  }

  public cancelActivation(): void {
    // ✅ A. Strengthen cleanup - always clear UI even if state seems reset
    this.hideTargetingUI();
    this.clearUnitHighlights();
    
    // Ensure no leftover highlight graphics remain
    if (this.unitHighlights.size > 0) {
      this.unitHighlights.forEach(h => {
        if (h && !h.scene) {
          this.unitHighlights.delete(h as any);
        }
      });
      this.clearUnitHighlights();
    }

    const cardId = this.pendingCardId;
    this.currentState = 'IDLE';
    this.pendingCardId = null;
    this.selectedUnits = [];
    this.targetPosition = null;

    eventBus.dispatch(GameEvents.ABILITY_ACTIVATION_CANCELLED, { playerId: this.playerId });
    this.emit('card_activation_cancelled', { cardId });
  }

  /**
   * ✅ A. Hard cleanup method that can be called by GameScene at key moments
   * Ensures all targeting UI and highlights are removed
   */
  public forceClearTargetingUI(): void {
    this.hideTargetingUI();
    this.clearUnitHighlights();
    
    // Additionally reset activation state safely without spending card
    this.currentState = 'IDLE';
    this.pendingCardId = null;
    this.selectedUnits = [];
    this.targetPosition = null;
    
    // Ensure event listeners are removed
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    
    // Clear any lingering graphics
    if (this.validPlacementZone) {
      this.validPlacementZone.destroy();
      this.validPlacementZone = undefined;
    }
    if (this.targetingCursor) {
      this.targetingCursor.destroy();
      this.targetingCursor = undefined;
    }
  }

  public getState(): AbilityState { return this.currentState; }
  public isActivating(): boolean { return this.currentState !== 'IDLE'; }
  public getDeck(): CardSlot[] { return [...this.deck]; }

  /**
   * Получить текущие слоты карт (копия массива)
   */
  public getCardSlots(): CardSlot[] {
    return [...this.deck];
  }

  // ============================================================
  // STATE MACHINE
  // ============================================================

  private transitionToTargetingState(targetType: CardTargetType): void {
    switch (targetType) {
      case 'point':
        this.currentState = 'SELECTING_POINT';
        this.showPointTargetingUI();
        break;
      case 'unit_self':
        this.currentState = 'SELECTING_UNIT_SELF';
        this.highlightSelectableUnits('self');
        break;
      case 'unit_enemy':
        this.currentState = 'SELECTING_UNIT_ENEMY';
        this.highlightSelectableUnits('enemy');
        break;
      case 'unit_ally_pair':
        this.currentState = 'SELECTING_UNIT_PAIR';
        this.highlightSelectableUnits('self');
        break;
      case 'none':
        this.executeCard();
        break;
    }
  }

  // ============================================================
  // INPUT HANDLING
  // ============================================================

  public onFieldTapped(x: number, y: number): boolean {
    if (this.currentState !== 'SELECTING_POINT') return false;
    const card = getCard(this.pendingCardId!);
    if (!card) return false;

    // ✅ УЛУЧШЕНО: Подробная валидация с фидбеком
    const validation = this.validatePointTarget(x, y, card.id);
    if (!validation.valid) {
      this.playInvalidPlacementFeedback(validation.reason);
      return false;
    }

    this.targetPosition = { x, y };
    this.executeCard();
    return true;
  }

  public onUnitTapped(unit: GameUnit): boolean {
    if (this.currentState === 'IDLE') return false;
    const card = getCard(this.pendingCardId!);
    if (!card) return false;

    switch (this.currentState) {
      case 'SELECTING_UNIT_SELF':
        if (unit.owner !== this.playerId) {
          this.playInvalidPlacementFeedback('wrong_owner');
          return false;
        }
        // ✅ ДОБАВЛЕНО: Проверка статуса юнита
        if (!this.isUnitValidForAbility(unit, card.id)) {
          return false;
        }
        this.selectedUnits = [unit.id];
        this.executeCard();
        return true;

      case 'SELECTING_UNIT_ENEMY':
        if (unit.owner === this.playerId) {
          this.playInvalidPlacementFeedback('wrong_owner');
          return false;
        }
        this.selectedUnits = [unit.id];
        this.executeCard();
        return true;

      case 'SELECTING_UNIT_PAIR':
        if (unit.owner !== this.playerId) {
          this.playInvalidPlacementFeedback('wrong_owner');
          return false;
        }
        
        // ✅ ДОБАВЛЕНО: Проверка на STUNNED для Void Swap
        if (!this.isUnitValidForAbility(unit, card.id)) {
          return false;
        }
        
        if (this.selectedUnits.length === 0) {
          this.selectedUnits.push(unit.id);
          this.highlightSelectedUnit(unit.id, true);
          this.emit('unit_selected_for_pair', { unitId: unit.id, step: 1 });
          // Пассивка «Измерительный трюк»: один выбранный союзник меняется местами с мячом
          if (card.id === 'void_swap' && this.isVoidSwapBallExchangeActive()) {
            this.executeCard();
            return true;
          }
          return true;
        } else if (this.selectedUnits.length === 1) {
          if (this.selectedUnits[0] === unit.id) {
            this.highlightSelectedUnit(unit.id, false);
            this.selectedUnits = [];
            return true;
          }
          
          // ✅ Проверяем второй юнит тоже
          if (!this.isUnitValidForAbility(unit, card.id)) {
            return false;
          }
          
          this.selectedUnits.push(unit.id);
          this.executeCard();
          return true;
        }
        return false;

      default: return false;
    }
  }

  // ✅ ДОБАВЛЕНО: Проверка валидности юнита для способности
  private isUnitValidForAbility(unit: GameUnit, cardId: string): boolean {
    if (!(unit instanceof Unit)) return true; // Не Unit - пропускаем проверку
    
    // Void Swap нельзя применять на застаненных юнитов
    if (cardId === 'void_swap') {
      if (unit.isStunned()) {
        this.playInvalidPlacementFeedback('unit_stunned');
        console.log(`[AbilityManager] Cannot swap stunned unit: ${unit.id}`);
        return false;
      }
    }
    
    // Можно добавить другие проверки для других способностей
    
    return true;
  }

  // ============================================================
  // ✅ УЛУЧШЕНО: ВАЛИДАЦИЯ ТОЧКИ РАЗМЕЩЕНИЯ
  // ============================================================

  private validatePointTarget(x: number, y: number, cardId: string): { valid: boolean; reason?: string } {
    const bounds = this.getFieldBounds();
    const ball = this.getBall();
    const units = this.getCaps();
    
    const margin = 30;

    // Проверка границ поля
    if (x < bounds.left + margin || x > bounds.right - margin) {
      return { valid: false, reason: 'out_of_bounds' };
    }
    if (y < bounds.top + margin || y > bounds.bottom - margin) {
      return { valid: false, reason: 'out_of_bounds' };
    }

    // Специфичные проверки для лавы
    if (cardId === 'magma_lava') {
      // ✅ ТЗ: Запретить установку в зоне ворот (20% от края)
      const forbiddenHeight = bounds.height * this.GOAL_ZONE_PERCENT;
      
      if (this.playerId === 1) {
        // Игрок 1 защищает нижние ворота - нельзя ставить там
        if (y > bounds.bottom - forbiddenHeight) {
          return { valid: false, reason: 'goal_zone' };
        }
      } else {
        // Игрок 2 защищает верхние ворота
        if (y < bounds.top + forbiddenHeight) {
          return { valid: false, reason: 'goal_zone' };
        }
      }

      // ✅ ТЗ: Запретить установку ближе 80px к мячу
      const ballPos = ball.getPosition();
      const distToBall = Phaser.Math.Distance.Between(x, y, ballPos.x, ballPos.y);
      if (distToBall < this.MIN_DISTANCE_TO_BALL) {
        return { valid: false, reason: 'too_close_to_ball' };
      }

      // Запретить установку слишком близко к юнитам
      for (const unit of units) {
        const distToUnit = Phaser.Math.Distance.Between(x, y, unit.x, unit.y);
        if (distToUnit < this.MIN_DISTANCE_TO_UNIT) {
          return { valid: false, reason: 'too_close_to_unit' };
        }
      }
    }

    // Проверки для других способностей с точечным размещением
    if (cardId === 'cyborg_barrier') {
      // Барьер не должен перекрывать ворота полностью
      const goalMargin = 50;
      if (y < bounds.top + goalMargin || y > bounds.bottom - goalMargin) {
        return { valid: false, reason: 'blocking_goal' };
      }
    }

    return { valid: true };
  }

  // Обёртка для обратной совместимости
  private isValidPointTarget(x: number, y: number, cardId: string): boolean {
    return this.validatePointTarget(x, y, cardId).valid;
  }

  // ============================================================
  // EXECUTION
  // ============================================================

  private executeCard(): void {
    const card = getCard(this.pendingCardId!);
    if (!card) {
      this.cancelActivation();
      return;
    }

    this.currentState = 'EXECUTING';
    this.hideTargetingUI();
    this.clearUnitHighlights();

    const success = this.applyCard(card.id, {
      position: this.targetPosition,
      unitIds: this.selectedUnits,
    });

    if (success) {
      this.markCardAsUsed(card.id);
      
      // 🔥 АКТИВИРУЕМ ГЛОБАЛЬНЫЙ КУЛДАУН
      this.lastGlobalActivationTime = Date.now();

      if (this.playerId === 1) {
        playerData.useCard(card.id);
      }

      eventBus.dispatch(GameEvents.ABILITY_ACTIVATED, {
        playerId: this.playerId,
        abilityType: card.id,
      });

      this.emit('card_activated', {
        cardId: card.id,
        success: true,
      });

      console.log(`[AbilityManager P${this.playerId}] Card executed: ${card.name}. Cooldown started.`);
    } else {
      console.log(`[AbilityManager P${this.playerId}] Card execution failed: ${card.name}`);
    }

    this.currentState = 'IDLE';
    this.pendingCardId = null;
    this.selectedUnits = [];
    this.targetPosition = null;
  }

  private markCardAsUsed(cardId: string): void {
    const slot = this.deck.find(s => s.cardId === cardId && !s.used);
    if (slot) {
      slot.used = true;

      // ✅ NEW: Dispatch card usage event (for weekly tasks, analytics, etc.)
      try {
        eventBus.dispatch(GameEvents.CARD_USED, { cardId, playerId: this.playerId });
      } catch (e) {
        console.warn('[AbilityManager] Failed to dispatch CARD_USED:', e);
      }
    }
  }

  private resolveCapByUnitRef(unitRef: string): GameUnit | undefined {
    for (const c of this.getCaps()) {
      if (c.id === unitRef) return c;
      if (c instanceof Unit && c.getUnitId() === unitRef) return c;
    }
    return undefined;
  }

  /**
   * Капитанская ульта из UI: lastActiveUnit часто ещё «прошлый стрелок» до выстрела.
   * Берём явный runtime id из AbilityButton (unitIds[0]), иначе lastActiveUnit.
   */
  private resolveCaptainActivatingUnit(
    captainCatalogId: string,
    data: { unitIds?: string[] },
  ): Unit | undefined {
    const tryUnit = (u: GameUnit | undefined): Unit | undefined => {
      if (!u || !(u instanceof Unit)) return undefined;
      if (u.owner !== this.playerId) return undefined;
      if (u.getUnitId() !== captainCatalogId) return undefined;
      if (!getUnitById(u.getUnitId())?.isCaptain) return undefined;
      return u;
    };

    const explicitId = data.unitIds?.[0];
    if (explicitId) {
      const fromExplicit = tryUnit(this.resolveCapByUnitRef(explicitId));
      if (fromExplicit) return fromExplicit;
    }

    return tryUnit(this.getLastActiveUnit());
  }

  public applyCard(cardId: string, data: { position?: { x: number; y: number } | null; unitIds?: string[]; }): boolean {
    if (cardId.startsWith('captain_')) {
      return this.applyCaptainAbility(cardId, data);
    }

    const card = getCard(cardId);
    if (!card) {
      console.warn(`[AbilityManager] Card not found: ${cardId}`);
      return false;
    }

    // ✅ Проверка валидности данных под targetType
    if (card.targetType === 'point' && !data.position) {
      console.warn(`[AbilityManager] Card ${cardId} requires position`);
      return false;
    }

    if (
      (card.targetType === 'unit_self' || card.targetType === 'unit_enemy') &&
      (!data.unitIds || data.unitIds.length < 1)
    ) {
      console.warn(`[AbilityManager] Card ${cardId} requires unitIds`);
      return false;
    }

    if (card.targetType === 'unit_ally_pair') {
      const ids = data.unitIds;
      if (cardId === 'void_swap' && ids?.length === 1) {
        if (!this.isVoidSwapBallExchangeActive()) {
          console.warn(`[AbilityManager] void_swap with 1 unit requires card_enhance swap_with_ball`);
          return false;
        }
      } else if (!ids || ids.length < 2) {
        console.warn(`[AbilityManager] Card ${cardId} requires 2 unitIds`);
        return false;
      }
    }

    try {
      switch (cardId) {
        case 'magma_lava':          return this.applyLavaPool(data.position!);
        case 'magma_molten':        return this.applyMoltenBall();
        case 'magma_meteor':        return this.applyMeteorStrike(data.position!);
        case 'cyborg_shield':       return this.applyEnergyShield(data.unitIds![0]);
        case 'cyborg_tether':       return this.applyMagneticTether(data.unitIds![0]);
        case 'cyborg_barrier':      return this.applyPhotonBarrier(data.position!);
        case 'void_swap':
          if (data.unitIds!.length === 1) {
            return this.applyPhaseSwapWithBall(data.unitIds![0]);
          }
          return this.applyPhaseSwap(data.unitIds![0], data.unitIds![1]);
        case 'void_ghost':          return this.applyGhostPhase(data.unitIds![0]);
        case 'void_wormhole':       return this.applyWormhole(data.position!);
        case 'insect_toxin':        return this.applyNeurotoxin(data.unitIds![0]);
        case 'insect_mimic':        return this.applyBiomimicry(data.position!);
        case 'insect_parasite':     return this.applyNeuralParasite(data.unitIds![0]);
        default:
          console.warn(`[AbilityManager] Unknown card: ${cardId}`);
          return false;
      }
    } catch (error) {
      console.error(`[AbilityManager] Error applying card ${cardId}:`, error);
      // ✅ Хаптик фидбек об ошибке (и в логах будет видно, что карта упала)
      try {
        eventBus.dispatch(GameEvents.HAPTIC_FEEDBACK, { type: 'error' });
      } catch {}
      return false;
    }
  }

  /** SUPER капитана (энергия + локальный матч) — для AbilityButton */
  public canActivateCaptainUlt(): boolean {
    if (this.playerId !== 1) return false;
    return this.canCaptainUltReady?.() ?? false;
  }

  public beginCaptainUltTargeting(): boolean {
    return this.tryBeginCaptainUlt?.() ?? false;
  }

  /**
   * Ультимейт капитана: без камеры и без unit.activateAbility.
   */
  private applyCaptainAbility(
    captainId: string,
    data: { position?: { x: number; y: number } | null; unitIds?: string[] },
  ): boolean {
    console.log(`[AbilityManager] applyCaptainAbility called:`, {
      captainId,
      data,
      playerId: this.playerId,
    });

    const activeUnit = this.resolveCaptainActivatingUnit(captainId, data);

    if (!activeUnit) {
      console.warn(`[AbilityManager] Captain ability: нет подходящего юнита для ${captainId}`);
      return false;
    }

    console.log(`[AbilityManager] Captain unit resolved:`, {
      runtimeId: activeUnit.id,
      catalogId: activeUnit instanceof Unit ? activeUnit.getUnitId() : 'unknown',
      owner: activeUnit.owner,
    });

    const enemyTargetId = data.unitIds?.find((id) => {
      const u = this.resolveCapByUnitRef(id);
      return u instanceof Unit && u.owner !== this.playerId;
    });

    const chronosNeedsPick = captainId === 'captain_chronos' && !enemyTargetId;

    console.log(`[AbilityManager] Chronos needs target pick: ${chronosNeedsPick}`);

    if (!chronosNeedsPick) {
      const energySpent = this.trySpendCaptainUltEnergy?.() ?? false;
      console.log(`[AbilityManager] Energy spent: ${energySpent}`);
      if (!energySpent) {
        console.warn(`[AbilityManager] Captain SUPER: энергия недоступна (${captainId})`);
        return false;
      }
    }

    console.log(`[AbilityManager] Activating captain ability: ${captainId}`);

    if (this.vfxManager) {
      this.vfxManager.playCaptainAbilityEffect(
        captainId,
        activeUnit.x,
        activeUnit.y,
        activeUnit.factionId,
      );
    }

    try {
      eventBus.dispatch(GameEvents.HAPTIC_FEEDBACK, { type: 'heavy' });
    } catch {}

    let success = false;

    if (captainId === 'captain_chronos') {
      if (enemyTargetId) {
        success = this.applyStasisSphere([enemyTargetId]);
      } else {
        if (!this.tryBeginCaptainUlt) {
          console.warn('[AbilityManager] Chronos requires target pick — hook missing');
          return false;
        }
        console.log('[AbilityManager] Starting Chronos targeting mode');
        success = this.tryBeginCaptainUlt();
      }
    } else {
      switch (captainId) {
        case 'captain_urok':
          console.log('[AbilityManager] Executing Tectonic Rift');
          success = this.applyTectonicRift(activeUnit);
          break;
        case 'captain_ethelgard':
          console.log('[AbilityManager] Executing Collapse');
          success = this.applyCollapse(activeUnit);
          break;
        case 'captain_xerxa':
          console.log('[AbilityManager] Executing Swarm Call');
          success = this.applySwarmCall(activeUnit);
          break;
        default:
          console.warn(`[AbilityManager] Unknown captain ability: ${captainId}`);
          return false;
      }
    }

    console.log(`[AbilityManager] Captain ability result: ${success ? 'SUCCESS' : 'FAILED'}`);

    if (success) {
      try {
        eventBus.dispatch(GameEvents.ABILITY_ACTIVATED, {
          playerId: this.playerId,
          abilityType: captainId,
        });
      } catch {}
    }

    return success;
  }

  /** Тектонический разлом (Урок): отбрасывает врагов в радиусе. */
  private applyTectonicRift(captain: GameUnit): boolean {
    const radius = 120;
    const force = 0.08;

    const caps = this.getCaps();
    let affectedCount = 0;

    caps.forEach((cap) => {
      if (cap.owner === captain.owner) return;

      const dist = Phaser.Math.Distance.Between(captain.x, captain.y, cap.x, cap.y);

      if (dist < radius) {
        const angle = Math.atan2(cap.y - captain.y, cap.x - captain.x);

        this.scene.matter.body.applyForce(cap.body, cap.body.position, {
          x: Math.cos(angle) * force,
          y: Math.sin(angle) * force,
        });

        affectedCount++;

        if (this.vfxManager) {
          this.vfxManager.playShieldHitEffect(cap.x, cap.y, 0, FACTIONS.magma.color);
        }
      }
    });

    console.log(`[AbilityManager] Tectonic Rift affected ${affectedCount} enemies`);
    return true;
  }

  /** Сфера стазиса (Хронос): стан цели на 2 хода. */
  private applyStasisSphere(unitIds: string[]): boolean {
    const targetId = unitIds[0];
    const target = this.resolveCapByUnitRef(targetId);

    if (!target || !(target instanceof Unit)) {
      console.warn('[AbilityManager] Stasis Sphere: target not found');
      return false;
    }

    if (target.owner === this.playerId) {
      console.warn('[AbilityManager] Stasis Sphere: нужна вражеская цель');
      return false;
    }

    target.applyStun(2);

    const freezeEffect = this.scene.add.circle(target.x, target.y, 40, 0x00ffff, 0.3);
    freezeEffect.setDepth(100);
    freezeEffect.setStrokeStyle(3, 0x00ffff, 0.8);

    this.scene.tweens.add({
      targets: freezeEffect,
      alpha: 0,
      scale: 1.5,
      duration: 500,
      yoyo: true,
      repeat: 3,
      onComplete: () => freezeEffect.destroy(),
    });

    console.log(`[AbilityManager] Stasis Sphere frozen: ${targetId}`);
    return true;
  }

  /** Коллапс (Этельгард): притяжение к капитану несколько секунд. */
  private applyCollapse(captain: GameUnit): boolean {
    const radius = 150;
    const pullForce = 0.003;
    const duration = 2000;

    const singularity = this.scene.add.circle(captain.x, captain.y, radius, 0xa855f7, 0.2);
    singularity.setDepth(50);
    singularity.setStrokeStyle(4, 0xa855f7, 0.8);

    this.scene.tweens.add({
      targets: singularity,
      scale: 0.5,
      alpha: 0.4,
      duration,
      yoyo: true,
      onComplete: () => singularity.destroy(),
    });

    const pullHandler = () => {
      const caps = this.getCaps();
      const ball = this.getBall();

      caps.forEach((cap) => {
        const dist = Phaser.Math.Distance.Between(captain.x, captain.y, cap.x, cap.y);
        if (dist < radius && dist > 10) {
          const angle = Math.atan2(captain.y - cap.y, captain.x - cap.x);
          const force = pullForce * (1 - dist / radius);

          this.scene.matter.body.applyForce(cap.body, cap.body.position, {
            x: Math.cos(angle) * force,
            y: Math.sin(angle) * force,
          });
        }
      });

      if (ball?.body) {
        const ballDist = Phaser.Math.Distance.Between(captain.x, captain.y, ball.x, ball.y);
        if (ballDist < radius && ballDist > 10) {
          const angle = Math.atan2(captain.y - ball.y, captain.x - ball.x);
          const force = pullForce * (1 - ballDist / radius);

          this.scene.matter.body.applyForce(ball.body, ball.body.position, {
            x: Math.cos(angle) * force,
            y: Math.sin(angle) * force,
          });
        }
      }
    };

    this.scene.events.on('update', pullHandler);

    this.scene.time.delayedCall(duration, () => {
      this.scene.events.off('update', pullHandler);
    });

    console.log(`[AbilityManager] Collapse activated for ${duration}ms`);
    return true;
  }

  /** Зов роя (Ксеркса): помечает союзное насекомое для бонусного хода (событие для матча). */
  private applySwarmCall(captain: GameUnit): boolean {
    const caps = this.getCaps();

    const allyInsects = caps.filter(
      (cap) =>
        cap.owner === captain.owner &&
        cap.id !== captain.id &&
        cap instanceof Unit &&
        cap.factionId === 'insect',
    );

    if (allyInsects.length === 0) {
      console.warn('[AbilityManager] Swarm Call: no ally insects found');
      return false;
    }

    const chosen = Phaser.Utils.Array.GetRandom(allyInsects);

    const glow = this.scene.add.circle(chosen.x, chosen.y, 50, 0x4ade80, 0.5);
    glow.setDepth(100);
    glow.setBlendMode(Phaser.BlendModes.ADD);

    this.scene.tweens.add({
      targets: glow,
      scale: 2,
      alpha: 0,
      duration: 800,
      onComplete: () => glow.destroy(),
    });

    console.log(`[AbilityManager] Swarm Call: extra turn hint for ${chosen.id}`);

    try {
      eventBus.dispatch(GameEvents.EXTRA_TURN_GRANTED, {
        unitId: chosen.id,
        powerMultiplier: 0.5,
      });
    } catch {}

    return true;
  }

  /**
   * ✅ NEW: Handle AI card usage (bypasses UI and directly applies the card)
   */
  public handleAICardUsage(cardId: string, targetData: any): boolean {
    const card = getCard(cardId);
    if (!card) {
      console.warn(`[AbilityManager] AI card not found: ${cardId}`);
      return false;
    }

    console.log(`[AbilityManager] AI activating card: ${card.name} (${cardId})`, targetData);

    // Prepare data in the format expected by applyCard
    const data: { position?: { x: number; y: number } | null; unitIds?: string[]; } = {};

    if (targetData?.position) {
      data.position = targetData.position;
    }

    if (targetData?.unitIds) {
      data.unitIds = targetData.unitIds;
    }

    const success = this.applyCard(cardId, data);

    if (success) {
      this.markCardAsUsed(cardId);
      this.lastGlobalActivationTime = Date.now();

      eventBus.dispatch(GameEvents.ABILITY_ACTIVATED, {
        playerId: this.playerId,
        abilityType: cardId,
      });

      this.emit('card_activated', {
        cardId: card.id,
        success: true,
      });

      console.log(`[AbilityManager P${this.playerId}] AI card executed: ${card.name}`);
    } else {
      console.warn(`[AbilityManager] AI card execution failed: ${card.name}`);
    }

    return success;
  }

  // ============================================================
  // CARD IMPLEMENTATIONS
  // ============================================================

  private applyLavaPool(position: { x: number; y: number }): boolean {
    const { x, y } = position;
    
    // ✅ ПАССИВКА: Проверка усиления от юнита
    let radiusMultiplier = 1.0;
    const activeUnit = this.getLastActiveUnit();
    if (activeUnit && activeUnit instanceof Unit && this.passiveManager) {
      const enhancement = this.passiveManager.getCardEnhancement(
        activeUnit.getUnitId(), 
        'magma_lava'
      );
      radiusMultiplier += enhancement.radiusBonus;
      this.passiveManager.notifyCardEnhancement(activeUnit.getUnitId(), 'magma_lava');
    }
    
    this.lavaIdCounter++;
    const poolId = `lava_${this.playerId}_${this.lavaIdCounter}`;
    const baseRadius = ABILITY_CONFIG.MAGMA_LAVA_RADIUS || 50;
    const enhancedRadius = baseRadius * radiusMultiplier;
    const pool = new LavaPool(this.scene, x, y, poolId, enhancedRadius);
    this.lavaPools.push(pool);

    const radius = pool.getRadius();

    if (this.vfxManager) {
      const effect = this.vfxManager.createLavaPool(x, y, radius, 4000);
      this.activeEffects.push({
        id: poolId,
        type: 'lava_pool',
        data: { pool, vfxEffect: effect },
        expiresAtTurn: this.currentTurn + (ABILITY_CONFIG.MAGMA_LAVA_DURATION || 4),
        destroy: () => {
          effect.destroy();
          pool.destroy();
        },
      });
    } else {
      // Если нет VFX менеджера, всё равно добавляем эффект для отслеживания
      this.activeEffects.push({
        id: poolId,
        type: 'lava_pool',
        data: { pool },
        expiresAtTurn: this.currentTurn + (ABILITY_CONFIG.MAGMA_LAVA_DURATION || 4),
        destroy: () => {
          pool.destroy();
        },
      });
    }

    eventBus.dispatch(GameEvents.LAVA_POOL_CREATED, {
      id: poolId,
      playerId: this.playerId,
      position: { x, y },
      radius,
    });

    console.log(`[AbilityManager] Lava Pool created at (${x.toFixed(0)}, ${y.toFixed(0)})`);
    return true;
  }

  private applyMoltenBall(): boolean {
    const ball = this.getBall();
    if (!ball) return false;

    if (this.vfxManager) {
      const ballContainer = ball.sprite;
      const ballSprite = ballContainer?.getAt?.(0) as Phaser.GameObjects.Arc | undefined;
      
      if (ballSprite) {
        const effect = this.vfxManager.createMoltenBallEffect(ballSprite);
        
        const effectId = `molten_${Date.now()}`;
        this.activeEffects.push({
          id: effectId,
          type: 'molten_ball',
          data: { effect },
          expiresAtTurn: this.currentTurn + 3,
          destroy: () => effect.destroy(),
        });

        const updateHandler = () => {
          if (this.activeEffects.find(e => e.id === effectId)) {
            effect.update();
          }
        };
        this.scene.events.on('update', updateHandler);

        const originalDestroy = this.activeEffects[this.activeEffects.length - 1].destroy;
        this.activeEffects[this.activeEffects.length - 1].destroy = () => {
          this.scene.events.off('update', updateHandler);
          originalDestroy();
        };
      }
    }

    console.log(`[AbilityManager] Molten Ball activated`);
    return true;
  }

  private applyMeteorStrike(position: { x: number; y: number }): boolean {
    const { x, y } = position;
    const craterRadius = 40;

    if (this.vfxManager) {
      const crater = this.vfxManager.playMeteorStrike(x, y, craterRadius);

      const craterBody = this.scene.matter.add.circle(x, y, craterRadius, {
        isStatic: true,
        isSensor: false,
        label: `crater_${Date.now()}`,
        collisionFilter: {
          category: COLLISION_CATEGORIES.WALL,
          mask: COLLISION_CATEGORIES.CAP | COLLISION_CATEGORIES.BALL,
        },
      });

      const effectId = `crater_${Date.now()}`;
      this.activeEffects.push({
        id: effectId,
        type: 'meteor_crater',
        data: { crater, craterBody },
        expiresAtTurn: this.currentTurn + 10,
        destroy: () => {
          crater.destroy();
          this.scene.matter.world.remove(craterBody);
        },
      });

      this.damageUnitsInRadius(x, y, craterRadius * 1.5);
    }

    console.log(`[AbilityManager] Meteor Strike at (${x.toFixed(0)}, ${y.toFixed(0)})`);
    return true;
  }

  private damageUnitsInRadius(x: number, y: number, radius: number): void {
    const caps = this.getCaps();
    caps.forEach(cap => {
      const dist = Phaser.Math.Distance.Between(x, y, cap.x, cap.y);
      if (dist < radius && cap.owner !== this.playerId) {
        const angle = Math.atan2(cap.y - y, cap.x - x);
        const force = 0.05;
        this.scene.matter.body.applyForce(cap.body, cap.body.position, {
          x: Math.cos(angle) * force,
          y: Math.sin(angle) * force,
        });
      }
    });
  }

  private applyEnergyShield(unitId: string): boolean {
    const unit = this.resolveCapByUnitRef(unitId);
    if (!unit || !(unit instanceof Unit)) return false;

    const success = unit.activateAbility({ fromAbilityCard: true });
    if (!success) return false;

    // ✅ ПАССИВКА: Проверка усиления
    let radiusMultiplier = 1.0;
    let durationBonus = 0;
    if (this.passiveManager) {
      const enhancement = this.passiveManager.getCardEnhancement(unitId, 'cyborg_shield');
      radiusMultiplier += enhancement.radiusBonus;
      durationBonus = enhancement.durationBonus;
      this.passiveManager.notifyCardEnhancement(unitId, 'cyborg_shield');
    }
    
    const baseRadius = ABILITY_CONFIG.CYBORG_SHIELD_RADIUS || 60;
    const shieldRadius = baseRadius * radiusMultiplier;

    // ✅ ДОБАВЛЕНО: Создаём физический сенсор щита для отражения
    const shieldBody = this.scene.matter.add.circle(unit.x, unit.y, shieldRadius, {
      isSensor: false, // Не сенсор - физическое тело для отражения!
      isStatic: false,
      label: `shield_${unitId}`,
      collisionFilter: {
        category: COLLISION_CATEGORIES.WALL,
        mask: COLLISION_CATEGORIES.BALL,
      },
      restitution: 1.5, // Сильный отскок
      friction: 0,
      frictionAir: 0,
    });

    if (this.vfxManager) {
      const shieldEffect = this.vfxManager.createEnergyShield(
        unitId, 
        unit.x, 
        unit.y, 
        shieldRadius
      );

      const effectId = `shield_${unitId}`;
      this.activeEffects.push({
        id: effectId,
        type: 'energy_shield',
        data: { shieldEffect, unitId, shieldBody },
        expiresAtTurn: this.currentTurn + (ABILITY_CONFIG.CYBORG_SHIELD_DURATION || 3) + durationBonus,
        destroy: () => {
          shieldEffect.destroy();
          this.scene.matter.world.remove(shieldBody);
        },
      });

      // Обновляем позицию щита синхронно с юнитом
      const updateHandler = () => {
        const effect = this.activeEffects.find(e => e.id === effectId);
        if (effect) {
          const currentUnit = this.resolveCapByUnitRef(unitId);
          if (currentUnit) {
            effect.data.shieldEffect.update(currentUnit.x, currentUnit.y);
            // ✅ Синхронизируем позицию и скорость физического тела щита
            this.scene.matter.body.setPosition(effect.data.shieldBody, {
              x: currentUnit.x,
              y: currentUnit.y,
            });
            if (currentUnit.body.velocity) {
              this.scene.matter.body.setVelocity(effect.data.shieldBody, currentUnit.body.velocity);
            }
          }
        }
      };
      this.scene.events.on('update', updateHandler);

      const originalDestroy = this.activeEffects[this.activeEffects.length - 1].destroy;
      this.activeEffects[this.activeEffects.length - 1].destroy = () => {
        this.scene.events.off('update', updateHandler);
        originalDestroy();
      };
    }

    eventBus.dispatch(GameEvents.VFX_STATUS_EFFECT, {
      x: unit.x,
      y: unit.y,
      type: 'shield',
    });

    console.log(`[AbilityManager] Energy Shield on ${unitId}`);
    return true;
  }

  private applyMagneticTether(unitId: string): boolean {
    const unit = this.resolveCapByUnitRef(unitId);
    if (!unit) return false;

    const ball = this.getBall();
    if (!ball) return false;

    if (this.vfxManager) {
      const tetherEffect = this.vfxManager.createTether(unitId);

      const effectId = `tether_${unitId}`;
      this.activeEffects.push({
        id: effectId,
        type: 'magnetic_tether',
        data: { tetherEffect, unitId },
        expiresAtTurn: this.currentTurn + 3,
        destroy: () => tetherEffect.destroy(),
      });

      const updateHandler = () => {
        const activeEffect = this.activeEffects.find(e => e.id === effectId);
        if (activeEffect && activeEffect.data.tetherEffect) {
          const currentUnit = this.resolveCapByUnitRef(unitId);
          const currentBall = this.getBall();
          if (currentUnit && currentBall) {
            const ballPos = currentBall.getPosition();
            activeEffect.data.tetherEffect.update(
              currentUnit.x, currentUnit.y,
              ballPos.x, ballPos.y
            );
          }
        }
      };
      this.scene.events.on('update', updateHandler);

      const originalDestroy = this.activeEffects[this.activeEffects.length - 1].destroy;
      this.activeEffects[this.activeEffects.length - 1].destroy = () => {
        this.scene.events.off('update', updateHandler);
        originalDestroy();
      };
    }

    console.log(`[AbilityManager] Magnetic Tether on ${unitId}`);
    return true;
  }

  private applyPhotonBarrier(position: { x: number; y: number }): boolean {
    const { x, y } = position;
    let lengthMult = 1;
    const activeUnit = this.getLastActiveUnit();
    if (activeUnit && activeUnit instanceof Unit && this.passiveManager) {
      const enhancement = this.passiveManager.getCardEnhancement(
        activeUnit.getUnitId(),
        'cyborg_barrier'
      );
      lengthMult += enhancement.radiusBonus;
      this.passiveManager.notifyCardEnhancement(activeUnit.getUnitId(), 'cyborg_barrier');
    }

    let barrierLength = 100 * lengthMult;

    const x1 = x - barrierLength / 2;
    const x2 = x + barrierLength / 2;
    const y1 = y;
    const y2 = y;

    if (this.vfxManager) {
      const barrierEffect = this.vfxManager.createPhotonBarrier(x1, y1, x2, y2);

      const barrierBody = this.scene.matter.add.rectangle(
        x, y, barrierLength, 10,
        {
          isStatic: true,
          label: `barrier_${Date.now()}`,
          collisionFilter: {
            category: COLLISION_CATEGORIES.WALL,
            mask: COLLISION_CATEGORIES.BALL,
          },
          restitution: 1.2,
        }
      );

      const effectId = `barrier_${Date.now()}`;
      this.activeEffects.push({
        id: effectId,
        type: 'photon_barrier',
        data: { barrierEffect, barrierBody },
        expiresAtTurn: this.currentTurn + 5,
        destroy: () => {
          barrierEffect.destroy();
          this.scene.matter.world.remove(barrierBody);
        },
      });
    }

    console.log(`[AbilityManager] Photon Barrier at (${x.toFixed(0)}, ${y.toFixed(0)})`);
    return true;
  }

  private applyPhaseSwap(unitId1: string, unitId2: string): boolean {
    const unit1 = this.resolveCapByUnitRef(unitId1);
    const unit2 = this.resolveCapByUnitRef(unitId2);

    // ✅ Расширенные проверки
    if (!unit1 || !unit2) {
      console.warn('[AbilityManager] Phase Swap: units not found');
      return false;
    }

    if (!(unit1 instanceof Unit) || !(unit2 instanceof Unit)) {
      console.warn('[AbilityManager] Phase Swap: not Unit instances');
      return false;
    }

    if (!unit1.body || !unit2.body) {
      console.warn('[AbilityManager] Phase Swap: units have no bodies');
      return false;
    }

    // ✅ Дополнительная проверка на stunned (на случай если состояние изменилось)
    if (unit1.isStunned() || unit2.isStunned()) {
      console.log('[AbilityManager] Cannot swap - one of the units is stunned');
      this.playInvalidPlacementFeedback('unit_stunned');
      return false;
    }

    const pos1 = { x: unit1.x, y: unit1.y };
    const pos2 = { x: unit2.x, y: unit2.y };

    // ✅ Безопасный телепорт с try/catch (+ fallback)
    try {
      if (typeof (unit1 as any).teleportTo === 'function') {
        unit1.teleportTo(pos2.x, pos2.y);
        unit2.teleportTo(pos1.x, pos1.y);
      } else {
        // Fallback: прямая установка позиции через Matter
        if (this.scene?.matter?.body) {
          this.scene.matter.body.setPosition(unit1.body, pos2);
          this.scene.matter.body.setPosition(unit2.body, pos1);
          this.scene.matter.body.setVelocity(unit1.body, { x: 0, y: 0 });
          this.scene.matter.body.setVelocity(unit2.body, { x: 0, y: 0 });
        }
      }
    } catch (e) {
      console.error('[AbilityManager] Phase Swap: teleport failed', e);
      return false;
    }

    // ✅ ДОБАВЛЕНО: VFX для свапа с электрическим шлейфом
    if (this.vfxManager) {
      try {
        this.vfxManager.playTeleportEffect(pos1.x, pos1.y, FACTIONS.void.color);
        this.vfxManager.playTeleportEffect(pos2.x, pos2.y, FACTIONS.void.color);
        
        // Электрическая линия между точками свапа
        this.vfxManager.playSwapTrailEffect(pos1.x, pos1.y, pos2.x, pos2.y, FACTIONS.void.color);
      } catch (e) {
        console.warn('[AbilityManager] Phase Swap: VFX error', e);
      }
    }

    eventBus.dispatch(GameEvents.SWAP_EXECUTED, {
      playerId: this.playerId,
      unit1Id: unitId1,
      unit2Id: unitId2,
      pos1,
      pos2,
    });

    const activeForSwap = this.getLastActiveUnit();
    if (activeForSwap && activeForSwap instanceof Unit && this.passiveManager) {
      const uid = activeForSwap.getUnitId();
      const e = this.passiveManager.getCardEnhancement(uid, 'void_swap');
      if (e.special || e.radiusBonus > 0 || e.durationBonus > 0) {
        this.passiveManager.notifyCardEnhancement(uid, 'void_swap');
      }
    }

    console.log(`[AbilityManager] Phase Swap: ${unitId1} <-> ${unitId2}`);
    return true;
  }

  /**
   * Пассивка «Измерительный трюк» (void_trickster): обмен позициями одного союзника и мяча.
   */
  private applyPhaseSwapWithBall(unitId: string): boolean {
    const unit = this.resolveCapByUnitRef(unitId);
    const ball = this.getBall();

    if (!unit || !ball?.body) {
      console.warn('[AbilityManager] Phase Swap+Ball: unit or ball not found');
      return false;
    }

    if (!(unit instanceof Unit)) {
      console.warn('[AbilityManager] Phase Swap+Ball: target must be Unit');
      return false;
    }

    if (!unit.body) {
      console.warn('[AbilityManager] Phase Swap+Ball: unit has no body');
      return false;
    }

    if (unit.isStunned()) {
      this.playInvalidPlacementFeedback('unit_stunned');
      return false;
    }

    const posUnit = { x: unit.x, y: unit.y };
    const posBall = ball.getPosition();

    try {
      if (typeof (unit as Unit).teleportTo === 'function') {
        unit.teleportTo(posBall.x, posBall.y);
      } else {
        this.scene.matter.body.setPosition(unit.body, posBall);
        this.scene.matter.body.setVelocity(unit.body, { x: 0, y: 0 });
        unit.sprite?.setPosition?.(posBall.x, posBall.y);
      }

      this.scene.matter.body.setPosition(ball.body, posUnit);
      this.scene.matter.body.setVelocity(ball.body, { x: 0, y: 0 });
      this.scene.matter.body.setAngularVelocity(ball.body, 0);
      ball.sprite.setPosition(posUnit.x, posUnit.y);
    } catch (e) {
      console.error('[AbilityManager] Phase Swap+Ball: teleport failed', e);
      return false;
    }

    if (this.vfxManager) {
      try {
        this.vfxManager.playTeleportEffect(posUnit.x, posUnit.y, FACTIONS.void.color);
        this.vfxManager.playTeleportEffect(posBall.x, posBall.y, FACTIONS.void.color);
        this.vfxManager.playSwapTrailEffect(posUnit.x, posUnit.y, posBall.x, posBall.y, FACTIONS.void.color);
      } catch (err) {
        console.warn('[AbilityManager] Phase Swap+Ball: VFX error', err);
      }
    }

    eventBus.dispatch(GameEvents.SWAP_EXECUTED, {
      playerId: this.playerId,
      unit1Id: unitId,
      unit2Id: 'ball',
      pos1: posUnit,
      pos2: posBall,
    });

    if (this.passiveManager) {
      const active = this.getLastActiveUnit();
      if (active && active instanceof Unit) {
        const e = this.passiveManager.getCardEnhancement(active.getUnitId(), 'void_swap');
        if (e.special === 'swap_with_ball') {
          this.passiveManager.notifyCardEnhancement(active.getUnitId(), 'void_swap');
        }
      }
    }

    console.log(`[AbilityManager] Phase Swap+Ball: ${unitId} <-> ball`);
    return true;
  }

  private applyGhostPhase(unitId: string): boolean {
    const unit = this.resolveCapByUnitRef(unitId);

    // ✅ Полная проверка валидности
    if (!unit) {
      console.warn(`[AbilityManager] Ghost Phase: unit ${unitId} not found`);
      return false;
    }

    if (!unit.body) {
      console.warn(`[AbilityManager] Ghost Phase: unit ${unitId} has no body`);
      return false;
    }

    if (!this.scene?.matter?.world) {
      console.warn('[AbilityManager] Ghost Phase: Matter world not available');
      return false;
    }

    // ✅ Безопасное сохранение оригинальной маски
    let originalMask: number;
    try {
      originalMask = unit.body.collisionFilter?.mask ?? 0xffffffff;
    } catch (e) {
      console.warn('[AbilityManager] Ghost Phase: failed to get collision mask', e);
      return false;
    }

    // ✅ Безопасная установка новой маски (только BALL)
    try {
      this.scene.matter.body.set(unit.body, {
        collisionFilter: {
          category: unit.body.collisionFilter?.category ?? COLLISION_CATEGORIES.CAP,
          mask: COLLISION_CATEGORIES.BALL,
        },
      });
    } catch (e) {
      console.error('[AbilityManager] Ghost Phase: failed to set collision filter', e);
      return false;
    }

    try {
      unit.sprite?.setAlpha?.(0.5);
    } catch {}

    if (this.vfxManager) {
      const ghostEffect = this.vfxManager.createGhostPhase(unitId, unit.x, unit.y);

      const effectId = `ghost_${unitId}`;
      this.activeEffects.push({
        id: effectId,
        type: 'ghost_phase',
        data: { ghostEffect, unitId, originalMask },
        expiresAtTurn: this.currentTurn + 2,
        destroy: () => {
          // ✅ Безопасная очистка VFX
          try {
            ghostEffect?.destroy?.();
          } catch (e) {
            console.warn('[AbilityManager] Ghost Phase: error destroying VFX', e);
          }

          // ✅ Проверка перед восстановлением (юнит/боди/мир могут быть уже уничтожены)
          const u = this.resolveCapByUnitRef(unitId);
          if (u && u.body && this.scene?.matter?.world) {
            try {
              u.sprite?.setAlpha?.(1);
              this.scene.matter.body.set(u.body, {
                collisionFilter: {
                  category: u.body.collisionFilter?.category ?? COLLISION_CATEGORIES.CAP,
                  mask: originalMask,
                },
              });
            } catch (e) {
              console.warn('[AbilityManager] Ghost Phase: error restoring collision', e);
            }
          }
        },
      });

      // ✅ Безопасный update handler (ошибки внутри игнорируем)
      const updateHandler = () => {
        try {
          const effect = this.activeEffects.find(e => e.id === effectId);
          if (effect && effect.data?.ghostEffect) {
            const currentUnit = this.resolveCapByUnitRef(unitId);
            if (currentUnit) {
              effect.data.ghostEffect.update?.(currentUnit.x, currentUnit.y);
            }
          }
        } catch {
          // ignore - эффект мог быть уже уничтожен
        }
      };
      this.scene.events.on('update', updateHandler);

      const originalDestroy = this.activeEffects[this.activeEffects.length - 1].destroy;
      this.activeEffects[this.activeEffects.length - 1].destroy = () => {
        this.scene.events.off('update', updateHandler);
        originalDestroy();
      };
    }

    console.log(`[AbilityManager] Ghost Phase on ${unitId}`);
    return true;
  }

  private applyWormhole(position: { x: number; y: number }): boolean {
    const { x, y } = position;
    const bounds = this.getFieldBounds();
    const x2 = bounds.centerX + (bounds.centerX - x);
    const y2 = bounds.centerY + (bounds.centerY - y);

    let attractRadiusPx = 0;
    const activeWh = this.getLastActiveUnit();
    if (activeWh && activeWh instanceof Unit && this.passiveManager) {
      const enhancement = this.passiveManager.getCardEnhancement(activeWh.getUnitId(), 'void_wormhole');
      this.passiveManager.notifyCardEnhancement(activeWh.getUnitId(), 'void_wormhole');
      if (enhancement.special === 'attract_ball' && enhancement.attractRadiusPx && enhancement.attractRadiusPx > 0) {
        attractRadiusPx = enhancement.attractRadiusPx;
      }
    }

    // Базовые проверки
    if (!this.scene?.matter?.world) {
      console.warn('[AbilityManager] Wormhole: Matter world not available');
      return false;
    }

    const portalRadius = 35;
    const wormholeId = `wormhole_${Date.now()}`;

    // ✅ Создаём физические сенсоры для порталов (category LAVA используется как общая категория сенсоров)
    let portalA: MatterJS.BodyType;
    let portalB: MatterJS.BodyType;

    try {
      portalA = this.scene.matter.add.circle(x, y, portalRadius, {
        isSensor: true,
        isStatic: true,
        label: `wormhole_A_${wormholeId}`,
        collisionFilter: {
          category: COLLISION_CATEGORIES.LAVA,
          mask: COLLISION_CATEGORIES.BALL | COLLISION_CATEGORIES.CAP,
        },
      });

      portalB = this.scene.matter.add.circle(x2, y2, portalRadius, {
        isSensor: true,
        isStatic: true,
        label: `wormhole_B_${wormholeId}`,
        collisionFilter: {
          category: COLLISION_CATEGORIES.LAVA,
          mask: COLLISION_CATEGORIES.BALL | COLLISION_CATEGORIES.CAP,
        },
      });
    } catch (e) {
      console.error('[AbilityManager] Wormhole: failed to create portal sensors', e);
      return false;
    }

    // Отслеживание недавних телепортов (cooldown)
    const recentTeleports = new Set<string>();
    const TELEPORT_COOLDOWN = 500; // ms

    const collisionHandler = (event: any) => {
      try {
        event.pairs.forEach((pair: any) => {
          const bodyA: MatterJS.BodyType = pair.bodyA;
          const bodyB: MatterJS.BodyType = pair.bodyB;

          // Определяем портал и объект
          let portal: MatterJS.BodyType | null = null;
          let entity: MatterJS.BodyType | null = null;
          let isPortalA = false;

          if (bodyA === portalA || bodyA === portalB) {
            portal = bodyA;
            entity = bodyB;
            isPortalA = bodyA === portalA;
          } else if (bodyB === portalA || bodyB === portalB) {
            portal = bodyB;
            entity = bodyA;
            isPortalA = bodyB === portalA;
          }

          if (!portal || !entity) return;

          // Проверяем cooldown
          const entityKey = entity.label || String((entity as any).id || 'unknown');
          if (recentTeleports.has(entityKey)) return;

          const targetPos = isPortalA ? { x: x2, y: y2 } : { x, y };

          try {
            // Телепорт позиции
            this.scene.matter.body.setPosition(entity, targetPos);

            // Инвертируем скорость (чтобы не было "залипания" в портале)
            const vel = (entity as any).velocity;
            if (vel) {
              this.scene.matter.body.setVelocity(entity, {
                x: -vel.x * 0.8,
                y: -vel.y * 0.8,
              });
            }

            // VFX
            if (this.vfxManager) {
              this.vfxManager.playTeleportEffect(targetPos.x, targetPos.y, FACTIONS.void.color);
            }

            // EventBus (безопасно)
            try {
              eventBus.dispatch(GameEvents.WORMHOLE_TELEPORT, {
                wormholeId,
                entityType: entity.label === 'ball' ? 'ball' : 'unit',
                entityId: entityKey,
                fromPortal: isPortalA ? 'A' : 'B',
                toPortal: isPortalA ? 'B' : 'A',
              });
            } catch {}

            // cooldown
            recentTeleports.add(entityKey);
            this.scene.time.delayedCall(TELEPORT_COOLDOWN, () => {
              recentTeleports.delete(entityKey);
            });

            console.log(
              `[AbilityManager] Wormhole teleport: ${entityKey} -> (${targetPos.x.toFixed(0)}, ${targetPos.y.toFixed(0)})`
            );
          } catch (e) {
            console.warn('[AbilityManager] Wormhole teleport failed:', e);
          }
        });
      } catch {
        // ignore
      }
    };

    // ✅ Подключаем обработчик коллизий
    try {
      this.scene.matter.world.on('collisionstart', collisionHandler);
    } catch (e) {
      console.warn('[AbilityManager] Wormhole: failed to attach collision handler', e);
    }

    // VFX (опционально)
    let wormholeEffect: any = undefined;
    if (this.vfxManager) {
      try {
        wormholeEffect = this.vfxManager.createWormhole(x, y, x2, y2);
      } catch (e) {
        console.warn('[AbilityManager] Wormhole: VFX error', e);
      }
    }

    // EventBus creation
    try {
      eventBus.dispatch(GameEvents.WORMHOLE_CREATED, {
        wormholeId,
        playerId: this.playerId,
        portalA: { x, y },
        portalB: { x: x2, y: y2 },
        duration: 4,
      });
    } catch {}

    // Регистрируем активный эффект для корректного cleanup/expiry
    const attractUpdate =
      attractRadiusPx > 0
        ? () => {
            const ball = this.getBall();
            if (!ball?.body) return;
            const pullToward = (px: number, py: number) => {
              const d = Phaser.Math.Distance.Between(ball.x, ball.y, px, py);
              if (d > attractRadiusPx || d < 4) return;
              const f = 0.00022 * (1 - d / attractRadiusPx);
              const ang = Math.atan2(py - ball.y, px - ball.x);
              this.scene.matter.body.applyForce(ball.body, ball.body.position, {
                x: Math.cos(ang) * f,
                y: Math.sin(ang) * f,
              });
            };
            pullToward(x, y);
            pullToward(x2, y2);
          }
        : undefined;

    if (attractUpdate) {
      this.scene.events.on('update', attractUpdate);
    }

    this.activeEffects.push({
      id: wormholeId,
      type: 'wormhole',
      data: { wormholeEffect, portalA, portalB, collisionHandler, pos1: { x, y }, pos2: { x: x2, y: y2 }, attractUpdate },
      expiresAtTurn: this.currentTurn + 4,
      destroy: () => {
        try {
          wormholeEffect?.destroy?.();
        } catch (e) {
          console.warn('[AbilityManager] Wormhole destroy: VFX error', e);
        }

        if (attractUpdate) {
          try {
            this.scene.events.off('update', attractUpdate);
          } catch {}
        }

        try {
          this.scene.matter.world.off('collisionstart', collisionHandler);
        } catch {}

        try {
          this.scene.matter.world.remove(portalA);
          this.scene.matter.world.remove(portalB);
        } catch (e) {
          console.warn('[AbilityManager] Wormhole destroy: removing bodies failed', e);
        }
      },
    });

    console.log(
      `[AbilityManager] Wormhole: (${x.toFixed(0)}, ${y.toFixed(0)}) <-> (${x2.toFixed(0)}, ${y2.toFixed(0)})`
    );
    return true;
  }

  private applyNeurotoxin(unitId: string): boolean {
    const unit = this.resolveCapByUnitRef(unitId);
    if (!unit || !(unit instanceof Unit)) return false;

    const success = unit.activateAbility({ fromAbilityCard: true });
    if (!success) return false;

    if (this.passiveManager) {
      const enhancement = this.passiveManager.getCardEnhancement(unitId, 'insect_toxin');
      this.passiveManager.notifyCardEnhancement(unitId, 'insect_toxin');
      if (enhancement.durationBonus > 0) {
        unit.extendToxicChargeDuration(Math.ceil(enhancement.durationBonus));
      }
      if (enhancement.special === 'aoe_toxin' && (enhancement.radiusBonus || 0) > 0) {
        const r = enhancement.radiusBonus || 60;
        this.damageUnitsInRadius(unit.x, unit.y, r);
      }
    }

    eventBus.dispatch(GameEvents.VFX_STATUS_EFFECT, {
      x: unit.x,
      y: unit.y,
      type: 'toxin',
    });

    console.log(`[AbilityManager] Neurotoxin charged on ${unitId}`);
    return true;
  }

  private applyBiomimicry(position: { x: number; y: number }): boolean {
    const { x, y } = position;
    const ball = this.getBall();
    if (!ball) return false;

    const ballRadius = 15;

    let doubleDecoy = false;
    const activeMimic = this.getLastActiveUnit();
    if (activeMimic && activeMimic instanceof Unit && this.passiveManager) {
      const enhancement = this.passiveManager.getCardEnhancement(activeMimic.getUnitId(), 'insect_mimic');
      this.passiveManager.notifyCardEnhancement(activeMimic.getUnitId(), 'insect_mimic');
      doubleDecoy = enhancement.special === 'double_decoy';
    }

    const spawnMimicAt = (mx: number, my: number): void => {
      if (!this.vfxManager) return;

      const mimicEffect = this.vfxManager.createMimicBall(mx, my, ballRadius);

      const mimicBody = this.scene.matter.add.circle(mx, my, ballRadius, {
        isSensor: true,
        isStatic: false,
        label: `mimic_${Date.now()}`,
        collisionFilter: {
          category: COLLISION_CATEGORIES.BALL,
          mask: COLLISION_CATEGORIES.CAP,
        },
      });

      const randomAngle = Math.random() * Math.PI * 2;
      const speed = 5;
      this.scene.matter.body.setVelocity(mimicBody, {
        x: Math.cos(randomAngle) * speed,
        y: Math.sin(randomAngle) * speed,
      });

      const effectId = `mimic_${Date.now()}`;
      this.activeEffects.push({
        id: effectId,
        type: 'mimic_ball',
        data: { mimicEffect, mimicBody },
        expiresAtTurn: this.currentTurn + 3,
        destroy: () => {
          mimicEffect.destroy();
          this.scene.matter.world.remove(mimicBody);
        },
      });

      const collisionHandler = (event: any) => {
        event.pairs.forEach((pair: any) => {
          if (pair.bodyA === mimicBody || pair.bodyB === mimicBody) {
            const activeEffect = this.activeEffects.find((e) => e.id === effectId);
            if (activeEffect) {
              activeEffect.destroy();
              this.activeEffects = this.activeEffects.filter((e) => e.id !== effectId);
            }
          }
        });
      };
      this.scene.matter.world.on('collisionstart', collisionHandler);

      const originalDestroy = this.activeEffects[this.activeEffects.length - 1].destroy;
      this.activeEffects[this.activeEffects.length - 1].destroy = () => {
        this.scene.matter.world.off('collisionstart', collisionHandler);
        originalDestroy();
      };
    };

    if (this.vfxManager) {
      spawnMimicAt(x, y);
      if (doubleDecoy) {
        spawnMimicAt(x + 42, y - 28);
      }
    }

    console.log(
      `[AbilityManager] Biomimicry (fake ball) at (${x.toFixed(0)}, ${y.toFixed(0)})` +
        (doubleDecoy ? ' +decoy' : '')
    );
    return true;
  }

  private applyNeuralParasite(unitId: string): boolean {
    const unit = this.resolveCapByUnitRef(unitId);
    if (!unit) return false;

    if (this.vfxManager) {
      this.vfxManager.playParasiteEffect(unit.x, unit.y, 3000);
    }

    console.log(`[AbilityManager] Neural Parasite on ${unitId}`);
    return true;
  }

  // ============================================================
  // UI METHODS
  // ============================================================

  private showPointTargetingUI(): void {
    this.hideTargetingUI();

    const bounds = this.getFieldBounds();
    const card = getCard(this.pendingCardId!);
    if (!card) return;

    this.validPlacementZone = this.scene.add.graphics();
    this.validPlacementZone.setDepth(50);
    this.validPlacementZone.fillStyle(0x00ff00, 0.1);
    
    const forbiddenHeight = bounds.height * this.GOAL_ZONE_PERCENT;
    if (this.playerId === 1) {
      this.validPlacementZone.fillRect(
        bounds.left, bounds.top,
        bounds.right - bounds.left,
        bounds.height - forbiddenHeight
      );
    } else {
      this.validPlacementZone.fillRect(
        bounds.left, bounds.top + forbiddenHeight,
        bounds.right - bounds.left,
        bounds.height - forbiddenHeight
      );
    }

    this.targetingCursor = this.scene.add.container(0, 0);
    this.targetingCursor.setDepth(100);

    const cursorRadius = 40;
    const cursorGraphics = this.scene.add.graphics();
    cursorGraphics.lineStyle(3, FACTIONS[this.factionId].color, 0.8);
    cursorGraphics.strokeCircle(0, 0, cursorRadius);
    cursorGraphics.fillStyle(FACTIONS[this.factionId].color, 0.2);
    cursorGraphics.fillCircle(0, 0, cursorRadius);
    this.targetingCursor.add(cursorGraphics);

    this.targetingCursor.setVisible(false);

    this.scene.input.on('pointermove', this.onPointerMove, this);
    this.scene.input.on('pointerdown', this.onPointerDown, this);
  }

  private hideTargetingUI(): void {
    if (this.targetingCursor) {
      this.targetingCursor.destroy();
      this.targetingCursor = undefined;
    }
    if (this.validPlacementZone) {
      this.validPlacementZone.destroy();
      this.validPlacementZone = undefined;
    }

    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerdown', this.onPointerDown, this);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.targetingCursor) return;

    this.targetingCursor.setPosition(pointer.worldX, pointer.worldY);
    this.targetingCursor.setVisible(true);

    const validation = this.validatePointTarget(pointer.worldX, pointer.worldY, this.pendingCardId!);
    const cursorGraphics = this.targetingCursor.getAt(0) as Phaser.GameObjects.Graphics;
    
    if (cursorGraphics) {
      cursorGraphics.clear();
      const color = validation.valid ? FACTIONS[this.factionId].color : 0xff0000;
      cursorGraphics.lineStyle(3, color, 0.8);
      cursorGraphics.strokeCircle(0, 0, 40);
      cursorGraphics.fillStyle(color, 0.2);
      cursorGraphics.fillCircle(0, 0, 40);
    }
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.currentState === 'SELECTING_POINT') {
      this.onFieldTapped(pointer.worldX, pointer.worldY);
    }
  }

  private highlightSelectableUnits(type: 'self' | 'enemy'): void {
    this.clearUnitHighlights();

    const caps = this.getCaps();
    const targetOwner = type === 'self' ? this.playerId : (this.playerId === 1 ? 2 : 1);
    const card = getCard(this.pendingCardId!);

    caps.forEach(cap => {
      if (cap.owner === targetOwner) {
        // ✅ ДОБАВЛЕНО: Проверяем валидность юнита для текущей способности
        let isValidTarget = true;
        let highlightColor = 0x00ff00;
        
        if (card && !this.isUnitValidForAbilityCheck(cap, card.id)) {
          isValidTarget = false;
          highlightColor = 0x888888; // Серый для недоступных
        }
        
        const highlight = this.scene.add.graphics();
        highlight.setDepth(55);
        highlight.lineStyle(4, highlightColor, isValidTarget ? 0.8 : 0.4);
        highlight.strokeCircle(0, 0, cap.getRadius() + 10);

        highlight.setPosition(cap.x, cap.y);
        this.unitHighlights.set(cap.id, highlight);

        if (isValidTarget) {
          this.scene.tweens.add({
            targets: highlight,
            alpha: 0.4,
            duration: 500,
            yoyo: true,
            repeat: -1,
          });
        }
      }
    });
  }

  // Версия без вывода ошибок (для подсветки)
  private isUnitValidForAbilityCheck(unit: GameUnit, cardId: string): boolean {
    if (!(unit instanceof Unit)) return true;
    
    if (cardId === 'void_swap') {
      if (unit.isStunned()) {
        return false;
      }
    }
    
    return true;
  }

  private highlightSelectedUnit(unitId: string, selected: boolean): void {
    const highlight = this.unitHighlights.get(unitId);
    if (highlight && selected) {
      highlight.clear();
      highlight.lineStyle(4, 0xffff00, 1);
      const cap = this.resolveCapByUnitRef(unitId);
      if (cap) {
        highlight.strokeCircle(0, 0, cap.getRadius() + 10);
      }
    }
  }

  private clearUnitHighlights(): void {
    this.unitHighlights.forEach(highlight => highlight.destroy());
    this.unitHighlights.clear();
  }

  // ✅ УЛУЧШЕНО: Более информативный фидбек
  private playInvalidPlacementFeedback(reason?: string): void {
    this.scene.cameras.main.shake(50, 0.005);
    eventBus.dispatch(GameEvents.HAPTIC_FEEDBACK, { type: 'error' });
    
    // Можно добавить всплывающую подсказку в зависимости от reason
    if (reason) {
      console.log(`[AbilityManager] Invalid placement: ${reason}`);
    }
  }

  // ============================================================
  // ✅ УЛУЧШЕНО: COLLISION HANDLING (Физика щитов и лавы)
  // ============================================================

  private setupCollisionListeners(): void {
    this.scene.matter.world.on('collisionstart', this.onCollisionStart, this);
    this.scene.matter.world.on('collisionactive', this.onCollisionActive, this);
    this.scene.matter.world.on('collisionend', this.onCollisionEnd, this);
  }

  private onCollisionStart(event: Phaser.Physics.Matter.Events.CollisionStartEvent): void {
    event.pairs.forEach(pair => {
      this.handleShieldCollision(pair.bodyA, pair.bodyB, pair);
      this.handleToxinCollision(pair.bodyA, pair.bodyB);
      this.handleLavaEnter(pair.bodyA, pair.bodyB);
    });
  }

  private onCollisionActive(event: Phaser.Physics.Matter.Events.CollisionActiveEvent): void {
    // Обработка вязкости лавы происходит в update() для более плавного эффекта
  }

  private onCollisionEnd(event: Phaser.Physics.Matter.Events.CollisionEndEvent): void {
    event.pairs.forEach(pair => {
      this.handleLavaExit(pair.bodyA, pair.bodyB);
    });
  }

  // ✅ ПЕРЕРАБОТАНО: Физическое отражение от щита согласно ТЗ
  private handleShieldCollision(
    bodyA: MatterJS.BodyType, 
    bodyB: MatterJS.BodyType,
    pair: MatterJS.ICollisionPair
  ): void {
    const shieldBody = [bodyA, bodyB].find(b => b.label?.startsWith('shield_'));
    const ballBody = [bodyA, bodyB].find(b => b.label === 'ball');

    if (!shieldBody || !ballBody) return;

    const shieldPos = shieldBody.position;
    const ballPos = ballBody.position;
    
    // ✅ ТЗ: Рассчитать нормаль от центра щита к объекту
    const dx = ballPos.x - shieldPos.x;
    const dy = ballPos.y - shieldPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist === 0) return;
    
    // Нормаль от щита к мячу
    const normalX = dx / dist;
    const normalY = dy / dist;
    
    // Текущая скорость мяча
    const velX = ballBody.velocity.x;
    const velY = ballBody.velocity.y;
    
    // ✅ ТЗ: Отразить вектор скорости объекта
    // Формула отражения: v' = v - 2(v·n)n
    const dotProduct = velX * normalX + velY * normalY;
    
    const reflectedVelX = velX - 2 * dotProduct * normalX;
    const reflectedVelY = velY - 2 * dotProduct * normalY;
    
    // ✅ ТЗ: Применить импульс (Force ~0.15)
    const boostFactor = 1 + this.SHIELD_REFLECT_FORCE;
    
    this.scene.matter.body.setVelocity(ballBody, {
      x: reflectedVelX * boostFactor,
      y: reflectedVelY * boostFactor,
    });

    // VFX эффект удара по щиту
    if (this.vfxManager) {
      const angle = Math.atan2(dy, dx);
      
      // Точка контакта на поверхности щита
      const shieldRadius = 60; // Радиус щита
      const hitX = shieldPos.x + normalX * shieldRadius;
      const hitY = shieldPos.y + normalY * shieldRadius;
      
      this.vfxManager.playShieldHitEffect(hitX, hitY, angle);
    }

    // Звук и хаптик
    eventBus.dispatch(GameEvents.HAPTIC_FEEDBACK, { type: 'medium' });
    
    console.log(`[AbilityManager] Shield reflected ball. New velocity: (${reflectedVelX.toFixed(2)}, ${reflectedVelY.toFixed(2)})`);
  }

  private handleToxinCollision(bodyA: MatterJS.BodyType, bodyB: MatterJS.BodyType): void {
    const unitA = this.findUnitByBody(bodyA);
    const unitB = this.findUnitByBody(bodyB);

    if (!unitA || !unitB) return;
    if (!(unitA instanceof Unit) || !(unitB instanceof Unit)) return;
    if (unitA.owner === unitB.owner) return;

    [unitA, unitB].forEach((attacker, i) => {
      const defender = i === 0 ? unitB : unitA;
      
      if (attacker.hasToxinCharge() && attacker.factionId === 'insect') {
        if (attacker.consumeToxinCharge()) {
          defender.applyStun(ABILITY_CONFIG.SWARM_TOXIN_DURATION || 2);

          if (this.vfxManager) {
            this.vfxManager.playToxinEffect(defender.x, defender.y);
          }

          eventBus.dispatch(GameEvents.STUN_APPLIED, {
            attackerId: attacker.id,
            targetId: defender.id,
            duration: ABILITY_CONFIG.SWARM_TOXIN_DURATION || 2,
          });
        }
      }
    });
  }

  // ✅ ДОБАВЛЕНО: Вход в лаву
  private handleLavaEnter(bodyA: MatterJS.BodyType, bodyB: MatterJS.BodyType): void {
    const lavaBody = [bodyA, bodyB].find(b => b.label?.startsWith('lava_'));
    const targetBody = [bodyA, bodyB].find(b => 
      b.label === 'ball' || b.label?.startsWith('unit_')
    );

    if (!lavaBody || !targetBody) return;
    
    // Находим соответствующий LavaPool
    const lavaId = lavaBody.label?.replace('lava_', '');
    const pool = this.lavaPools.find(p => p.id === `lava_${lavaId}` || p.id === lavaBody.label);
    
    if (!pool) return;

    // Регистрируем тело в лаве
    if (!this.bodiesInLava.has(targetBody)) {
      this.bodiesInLava.set(targetBody, {
        body: targetBody,
        pool: pool,
        ticksInLava: 0,
      });
      
      console.log(`[AbilityManager] ${targetBody.label} entered lava`);
      
      // Обновляем статус юнита
      const unit = this.findUnitByBody(targetBody);
      if (unit instanceof Unit) {
        unit.setInLava(true);
      }
    }
  }

  // ✅ ДОБАВЛЕНО: Выход из лавы
  private handleLavaExit(bodyA: MatterJS.BodyType, bodyB: MatterJS.BodyType): void {
    const lavaBody = [bodyA, bodyB].find(b => b.label?.startsWith('lava_'));
    const targetBody = [bodyA, bodyB].find(b => 
      b.label === 'ball' || b.label?.startsWith('unit_')
    );

    if (!lavaBody || !targetBody) return;

    if (this.bodiesInLava.has(targetBody)) {
      this.bodiesInLava.delete(targetBody);
      
      console.log(`[AbilityManager] ${targetBody.label} exited lava`);
      
      // Обновляем статус юнита
      const unit = this.findUnitByBody(targetBody);
      if (unit instanceof Unit) {
        unit.setInLava(false);
      }
    }
  }

  // Старый метод для обратной совместимости (но логика перенесена в update)
  private handleLavaCollision(bodyA: MatterJS.BodyType, bodyB: MatterJS.BodyType): void {
    // Логика теперь в applyLavaViscosityEffects()
  }

  // ✅ ДОБАВЛЕНО: Применение эффекта вязкости лавы (вызывается в update)
  private applyLavaViscosityEffects(): void {
    this.bodiesInLava.forEach((data, body) => {
      data.ticksInLava++;
      
      // ✅ ТЗ: Каждый тик физики умножать скорость объекта на 0.92
      if (body.velocity) {
        const newVelX = body.velocity.x * this.LAVA_VISCOSITY;
        const newVelY = body.velocity.y * this.LAVA_VISCOSITY;
        
        this.scene.matter.body.setVelocity(body, {
          x: newVelX,
          y: newVelY,
        });
        
        // ✅ ТЗ: Применять небольшое вращение (эффект затягивания)
        data.pool.applyViscosity(body);
      }
    });
  }

  private findUnitByBody(body: MatterJS.BodyType): GameUnit | undefined {
    if (!body.label?.startsWith('unit_')) return undefined;
    return this.getCaps().find(c => c.body === body);
  }

  // ============================================================
  // TURN MANAGEMENT
  // ============================================================

  public onTurnEnd(lastActiveUnit?: GameUnit): void {
    this.currentTurn++;

    if (this.isActivating()) {
      this.cancelActivation();
    }

    this.getCaps().forEach(cap => {
      if (cap instanceof Unit) {
        cap.onTurnEnd();
        cap.setInLava(false);
      }
    });

    // Очищаем отслеживание лавы
    this.bodiesInLava.clear();

    const expiredEffects = this.activeEffects.filter(
      e => e.expiresAtTurn !== undefined && e.expiresAtTurn <= this.currentTurn
    );
    
    expiredEffects.forEach(effect => {
      effect.destroy();
      console.log(`[AbilityManager] Effect expired: ${effect.type}`);
    });
    
    this.activeEffects = this.activeEffects.filter(
      e => e.expiresAtTurn === undefined || e.expiresAtTurn > this.currentTurn
    );

    this.lavaPools.forEach(pool => pool.decrementDuration());
    const expiredPools = this.lavaPools.filter(pool => pool.isExpired());
    expiredPools.forEach(pool => {
      eventBus.dispatch(GameEvents.LAVA_POOL_EXPIRED, { id: pool.id });
      pool.destroy();
    });
    this.lavaPools = this.lavaPools.filter(pool => !pool.isExpired());

    console.log(
      `[AbilityManager P${this.playerId}] Turn ${this.currentTurn} ended. Active effects: ${this.activeEffects.length}`
    );
  }

  public setLastActiveUnit(unit: GameUnit): void {
    this.lastActiveUnit = unit;
  }
  
  public setPassiveManager(manager: PassiveManager): void {
    this.passiveManager = manager;
  }
  
  private getLastActiveUnit(): GameUnit | undefined {
    return this.lastActiveUnit;
  }

  /** У активного юнита пассивка «Измерительный трюк» — swap одного союзника с мячом. */
  private isVoidSwapBallExchangeActive(): boolean {
    const u = this.getLastActiveUnit();
    if (!u || !(u instanceof Unit) || !this.passiveManager) return false;
    return this.passiveManager.getCardEnhancement(u.getUnitId(), 'void_swap').special === 'swap_with_ball';
  }

  public getCurrentTurn(): number {
    return this.currentTurn;
  }

  // ============================================================
  // UPDATE (вызывается каждый кадр)
  // ============================================================

  public update(delta?: number): void {
    // Обновляем лавовые лужи
    this.lavaPools.forEach(pool => pool.update(delta));

    // ✅ ДОБАВЛЕНО: Применяем эффект вязкости лавы
    this.applyLavaViscosityEffects();

    // Обновляем подсветку юнитов (и авто-очистка если не активируем карту)
    if (this.currentState === 'IDLE' && this.unitHighlights.size > 0) {
      this.clearUnitHighlights();
    } else {
      this.unitHighlights.forEach((highlight, unitId) => {
        const cap = this.resolveCapByUnitRef(unitId);
        if (cap) {
          highlight.setPosition(cap.x, cap.y);
        }
      });
    }

    // Обновляем щиты
    this.activeEffects.forEach(effect => {
      if (effect.type === 'energy_shield' && effect.data.shieldEffect) {
        const unit = this.resolveCapByUnitRef(effect.data.unitId);
        if (unit) {
          effect.data.shieldEffect.update(unit.x, unit.y);
        }
      }
    });
  }

  // ============================================================
  // GETTERS
  // ============================================================

  public getLavaPools(): LavaPool[] {
    return [...this.lavaPools];
  }
  
  // Новый метод для создания лавы от пассивки:
  public createLavaPoolAt(x: number, y: number): void {
    this.lavaIdCounter++;
    const poolId = `lava_passive_${this.lavaIdCounter}`;
    const baseRadius = ABILITY_CONFIG.MAGMA_LAVA_RADIUS || 50;
    const pool = new LavaPool(this.scene, x, y, poolId, baseRadius);
    this.lavaPools.push(pool);
    
    if (this.vfxManager) {
      this.vfxManager.createLavaPool(x, y, pool.getRadius(), 4000);
    }
    
    this.activeEffects.push({
      id: poolId,
      type: 'lava_pool',
      data: { pool },
      expiresAtTurn: this.currentTurn + (ABILITY_CONFIG.MAGMA_LAVA_DURATION || 4),
      destroy: () => {
        pool.destroy();
      },
    });
  }

  public getActiveEffects(): ActiveEffect[] {
    return [...this.activeEffects];
  }

  // ============================================================
  // LEGACY METHODS (для обратной совместимости)
  // ============================================================

  public getCharges(): number { return this.getAvailableCards().length; }
  public getMaxCharges(): number { return 3; }
  public getPartialCharge(): number { return 0; }
  public getMatchCards(): CardSlot[] { return this.deck.filter(s => s.cardId && !s.used); }
  
  public startActivation(): boolean {
    const availableSlot = this.deck.findIndex(s => s.cardId && !s.used);
    if (availableSlot === -1) return false;
    return this.startCardActivation(availableSlot);
  }
  
  public canActivate(): boolean { 
    return this.getAvailableCards().length > 0 && 
           this.currentState === 'IDLE' && 
           this.getCooldownRemaining() === 0; 
  }
  
  public hasCharge(): boolean { return this.getAvailableCards().length > 0; }

  // ============================================================
  // RESET & CLEANUP
  // ============================================================

  public reset(): void {
    this.cancelActivation();
    this.activeEffects.forEach(effect => effect.destroy());
    this.activeEffects = [];
    this.lavaPools.forEach(pool => pool.destroy());
    this.lavaPools = [];
    this.lavaIdCounter = 0;
    this.lastActiveUnit = undefined;
    this.currentTurn = 0;
    this.bodiesInLava.clear();
    // Don't reset global cooldown on standard reset (between rounds)
  }

  public resetForNewMatch(): void {
    this.reset();
    this.lastGlobalActivationTime = 0; // Reset cooldown for new match
    this.initializeDeck();
  }

  public setVFXManager(manager: VFXManager): void {
    this.vfxManager = manager;
  }

  public destroy(): void {
    this.scene.matter.world.off('collisionstart', this.onCollisionStart, this);
    this.scene.matter.world.off('collisionactive', this.onCollisionActive, this);
    this.scene.matter.world.off('collisionend', this.onCollisionEnd, this);
    this.hideTargetingUI();
    this.clearUnitHighlights();
    this.reset();
    this.removeAllListeners();
  }
}