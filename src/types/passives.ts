// src/types/passives.ts
// Система пассивных способностей юнитов

import { FactionId } from '../constants/gameConstants';

// ========== ТИПЫ ПАССИВОК ==========

export type PassiveType = 
  | 'none'           // Нет особого эффекта (common универсальные)
  | 'stat_boost'     // Постоянный бонус к характеристике
  | 'on_hit_ball'    // При ударе по мячу
  | 'on_collision'   // При столкновении с врагом
  | 'aura'           // Постоянный эффект в радиусе
  | 'conditional'    // При определённом условии
  | 'card_enhance'   // Усиливает карту фракции
  | 'counter'        // Контрит определённое
  | 'risk_reward';   // Риск/награда

export type PassiveTarget = 'self' | 'ally' | 'enemy' | 'ball' | 'area';

export type PassiveCondition = 
  | 'none'
  | 'after_miss'           // После промаха
  | 'after_hit'            // После получения удара
  | 'after_goal'           // После забитого гола
  | 'goal_conceded'        // После пропущенного гола
  | 'enemy_half'           // На половине врага
  | 'own_half'             // На своей половине
  | 'defending'            // При защите ворот
  | 'ally_nearby'          // Союзник рядом
  | 'ally_hit'             // После удара союзника
  | 'first_hit'            // Первый удар в раунде
  | 'every_2nd_shot'       // Каждый 2-й удар
  | 'every_3rd_shot'       // Каждый 3-й удар
  | 'no_goal_3_turns'      // 3 хода без гола
  | 'once_per_match'       // Один раз за матч
  | 'after_swap';          // После использования Swap

export type CardEnhanceType = 
  | 'lava_pool'
  | 'energy_shield'
  | 'barrier'
  | 'wormhole'
  | 'swap'
  | 'neurotoxin'
  | 'biomimicry';

// ========== ИНТЕРФЕЙС ПАССИВКИ ==========

export interface PassiveParams {
  value?: number;           // Сила эффекта (0.1 = 10%)
  duration?: number;        // Длительность в ходах
  radius?: number;          // Радиус в px
  chance?: number;          // Шанс срабатывания (0-1)
  target?: PassiveTarget;   // Цель эффекта
  condition?: PassiveCondition; // Условие срабатывания
  cardType?: CardEnhanceType;   // Тип усиливаемой карты
  stackable?: boolean;      // Можно ли стакать эффект
  maxStacks?: number;       // Максимум стаков
}

export interface PassiveAbility {
  type: PassiveType;
  name: string;             // Название пассивки
  description: string;      // Описание эффекта
  params: PassiveParams;
}

// ========== АКТИВНЫЕ ЭФФЕКТЫ ==========

export interface ActivePassiveEffect {
  id: string;
  sourceUnitId: string;
  targetUnitId?: string;
  passiveType: PassiveType;
  effectType: string;       // 'speed_boost', 'defense_boost', 'slow', etc.
  value: number;
  turnsRemaining: number;
  stacks?: number;
}

// ========== СОСТОЯНИЕ ПАССИВОК В МАТЧЕ ==========

export interface UnitPassiveState {
  unitId: string;
  shotCount: number;        // Счётчик ударов
  hasUsedOncePerMatch: boolean; // Использовал ли "раз за матч"
  currentStacks: Record<string, number>; // Текущие стаки эффектов
  activeBuffs: ActivePassiveEffect[];
  activeDebuffs: ActivePassiveEffect[];
}

export interface MatchPassiveState {
  units: Record<string, UnitPassiveState>;
  activeAuras: ActivePassiveEffect[];
  turnsSinceLastGoal: number;
  lastGoalScoredBy: number | null; // playerId
}
