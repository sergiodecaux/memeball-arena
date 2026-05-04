// src/types/abilities.ts
// ✅ ИСПРАВЛЕНО: Убран any из AbilityEvent.data

import { FactionId } from '../constants/gameConstants';

// ========== ТИПЫ СПОСОБНОСТЕЙ ==========

export type AbilityType = 'lava_placement' | 'energy_shield' | 'phase_swap' | 'neurotoxin';

export type AbilityTrigger = 'active' | 'on_stop' | 'on_hit' | 'passive';

export type AbilityTargetType = 
  | 'field_position'    // Magma: тап на поле
  | 'own_unit_single'   // Cyborg/Insect: выбор 1 своего юнита
  | 'own_unit_pair'     // Void: выбор 2 своих юнитов
  | 'enemy_unit'        // Будущее
  | 'none';             // Пассивные

export interface AbilityDefinition {
  id: AbilityType;
  factionId: FactionId;
  name: string;
  description: string;
  icon: string;
  trigger: AbilityTrigger;
  targetType: AbilityTargetType;
  chargeCost: number;
}

// ========== СОСТОЯНИЕ СПОСОБНОСТИ В МАТЧЕ ==========

export interface AbilityChargeState {
  charges: number;
  maxCharges: number;
  partialCharge: number;
  matchCards: number;
}

export interface AbilityActivationState {
  isActivating: boolean;
  pendingAbility: AbilityType | null;
  selectedUnitIds: string[];
  targetPosition: { x: number; y: number } | null;
}

// ========== АКТИВНЫЕ ЭФФЕКТЫ ==========

export interface ActiveAbilityEffect {
  id: string;
  type: AbilityType;
  sourceUnitId?: string;
  targetUnitId?: string;
  position?: { x: number; y: number };
  turnsRemaining: number;
  createdAtTurn: number;
}

export interface LavaPoolEffect extends ActiveAbilityEffect {
  type: 'lava_placement';
  position: { x: number; y: number };
  radius: number;
}

export interface EnergyShieldEffect extends ActiveAbilityEffect {
  type: 'energy_shield';
  targetUnitId: string;
  radius: number;
}

export interface ToxinChargeEffect extends ActiveAbilityEffect {
  type: 'neurotoxin';
  sourceUnitId: string;
  isConsumed: boolean;
}

export interface StunEffect extends ActiveAbilityEffect {
  type: 'neurotoxin';
  targetUnitId: string;
  stunTurnsRemaining: number;
}

// ========== 🆕 ТИПИЗИРОВАННЫЕ ДАННЫЕ СОБЫТИЙ ==========

export interface ChargeGainedEventData {
  previousCharges: number;
  newCharges: number;
  reason: ChargeGainReason;
}

export interface AbilityActivatedEventData {
  abilityType: AbilityType;
  sourceUnitId: string;
  targetUnitIds?: string[];
  targetPosition?: { x: number; y: number };
}

export interface LavaPoolCreatedEventData {
  poolId: string;
  position: { x: number; y: number };
  radius: number;
}

export interface ShieldActivatedEventData {
  unitId: string;
  radius: number;
  duration: number;
}

export interface SwapExecutedEventData {
  unitAId: string;
  unitBId: string;
  positionA: { x: number; y: number };
  positionB: { x: number; y: number };
}

export interface StunAppliedEventData {
  sourceUnitId: string;
  targetUnitId: string;
  duration: number;
}

export interface EffectExpiredEventData {
  effectId: string;
  effectType: AbilityType;
}

// ========== СОБЫТИЯ ==========

export type AbilityEventType = 
  | 'charge_gained'
  | 'charge_spent'
  | 'card_used'
  | 'ability_activated'
  | 'ability_effect_applied'
  | 'ability_effect_expired'
  | 'target_selection_started'
  | 'target_selection_cancelled'
  | 'target_selected'
  | 'lava_pool_created'
  | 'shield_activated'
  | 'swap_executed'
  | 'toxin_charged'
  | 'stun_applied';

// ✅ ИСПРАВЛЕНО: Типизированный data вместо any
export type AbilityEventData = 
  | ChargeGainedEventData
  | AbilityActivatedEventData
  | LavaPoolCreatedEventData
  | ShieldActivatedEventData
  | SwapExecutedEventData
  | StunAppliedEventData
  | EffectExpiredEventData
  | { reason?: string }  // Для простых событий типа card_used
  | undefined;

export interface AbilityEvent {
  type: AbilityEventType;
  abilityType?: AbilityType;
  playerId: number;
  data?: AbilityEventData;  // ✅ Теперь типизировано!
  timestamp: number;
}

export type ChargeGainReason = 
  | 'goal_scored'
  | 'goal_conceded'
  | 'ball_hit_enemy'
  | 'card_used'
  | 'accumulated';

// ========== LASSO ==========

export type LassoPhase = 'IDLE' | 'CAPTURING' | 'AIMING' | 'RELEASED';

export interface LassoAbilityState {
  phase: LassoPhase;
  cooldownRemaining: number;
  canActivate: boolean;
  captureDistance: number;
  swingAngle: number;
}