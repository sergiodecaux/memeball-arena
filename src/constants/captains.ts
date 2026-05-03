import type { FactionId } from './gameConstants';

/** Игровые ID капитанов (совпадают с UnitsRepository). */
export const CAPTAIN_UNIT_IDS = [
  'captain_urok',
  'captain_chronos',
  'captain_ethelgard',
  'captain_xerxa',
] as const;

export type CaptainUnitId = (typeof CAPTAIN_UNIT_IDS)[number];

export const CAPTAIN_BY_FACTION: Record<FactionId, CaptainUnitId> = {
  magma: 'captain_urok',
  cyborg: 'captain_chronos',
  void: 'captain_ethelgard',
  insect: 'captain_xerxa',
};

export const CAPTAIN_MAX_ENERGY = 100;
export const CAPTAIN_ENERGY_BALL_TOUCH = 10;
export const CAPTAIN_ENERGY_GOAL_SCORED = 20;
export const CAPTAIN_ENERGY_GOAL_CONCEDED = 15;

/** Пассивки — радиусы в px (ТЗ). */
export const CAPTAIN_UROK_AURA_RADIUS = 150;
export const CAPTAIN_VOID_PULL_RADIUS = 100;
export const CAPTAIN_INSECT_SWARM_DISTANCE = 80;
export const CAPTAIN_UROK_CONE_DEG = 45;
export const CAPTAIN_UROK_CONE_RANGE = 520;

export function isCaptainUnitId(unitId: string): boolean {
  return (CAPTAIN_UNIT_IDS as readonly string[]).includes(unitId);
}
