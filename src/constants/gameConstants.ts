// ✅ ИЗМЕНЕНО: Добавлены константы безопасности мяча (MAX_SPEED, OUT_OF_BOUNDS_MARGIN, MAX_ANGULAR_VELOCITY)

import { AbilityDefinition } from '../types/abilities';

export const FIELD = {
  WIDTH: 600,
  HEIGHT: 900,
  BORDER_THICKNESS: 20,
  PADDING: 40,
  GRASS_COLOR: 0x2d8c3c,
  GRASS_LINES_COLOR: 0x3da64d,
  BORDER_COLOR: 0x1a472a,
} as const;

export const GOAL = {
  WIDTH: 138,
  DEPTH: 40,
  POST_THICKNESS: 12,
  NET_COLOR: 0xffffff,
  POST_COLOR: 0xeeeeee,
} as const;

export const PHYSICS = {
  FRICTION_AIR: 0.008,
  RESTITUTION: 0.7,
  FRICTION: 0.05,
} as const;

export const COLLISION_CATEGORIES = {
  WALL: 0x0001,
  CAP: 0x0002,
  BALL: 0x0004,
  GOAL_SENSOR: 0x0008,
  LAVA: 0x0010,
  SHIELD: 0x0020,
  CORNER: 0x0040,   // NEW: Corner colliders
} as const;

export const BALL = {
  RADIUS: 15,
  COLOR: 0xffffff,
  MASS: 1.2,
  RESTITUTION: 0.88,
  FRICTION: 0.005,
  FRICTION_AIR: 0.005,
  LABEL: 'ball',

  MAX_SPEED: 42,
  MAX_SPEED_AFTER_BOUNCE: 38,
  MAX_ANGULAR_VELOCITY: 0.35,
  OUT_OF_BOUNDS_MARGIN: 80,
  CRITICAL_SPEED: 55,
  CRITICAL_SPEED_DAMPING: 0.75,

  CORNER_REDIRECT_FORCE: 0.0018,
  CORNER_PRESERVE_SPEED: 0.88,
  POST_REDIRECT_FORCE: 0.0022,
} as const;

export type CapClass = 'balanced' | 'tank' | 'sniper' | 'trickster';

export interface CapClassStats {
  name: string;
  description: string;
  mass: number;
  radius: number;
  restitution: number;
  friction: number;
  frictionAir: number;
  forceMultiplier: number;
  maxForce: number;
  aimLineLength: number;
  canCurve: boolean;
  curveStrength: number;
}

export const CAP_CLASSES: Record<CapClass, CapClassStats> = {
  // Balanced (Novice, Cyborgs)
  balanced: {
    name: 'Balanced',
    description: 'All-round player.',
    mass: 3.5,
    radius: 28,
    restitution: 0.7,
    friction: 0.05,
    frictionAir: 0.02,
    forceMultiplier: 0.0020,
    maxForce: 0.26,
    aimLineLength: 1.0,
    canCurve: false,
    curveStrength: 0,
  },
  // Tank (Magma) - Very Heavy
  tank: {
    name: 'Tank',
    description: 'Heavy defender.',
    mass: 6.0,
    radius: 34,
    restitution: 0.2,
    friction: 0.2,
    frictionAir: 0.05,
    forceMultiplier: 0.0017,
    maxForce: 0.20,
    aimLineLength: 0.7,
    canCurve: false,
    curveStrength: 0,
  },
  // Sniper (Void, Insect Spitter) - Light & Precise
  sniper: {
    name: 'Sniper',
    description: 'Glass cannon.',
    mass: 2.8,
    radius: 24,
    restitution: 0.6,
    friction: 0.02,
    frictionAir: 0.01,
    forceMultiplier: 0.0023,
    maxForce: 0.28,
    aimLineLength: 1.45,
    canCurve: false,
    curveStrength: 0,
  },
  // Trickster (Void Bender, Insect Mimic) - Bouncy & Weird
  trickster: {
    name: 'Trickster',
    description: 'Curve master.',
    mass: 3.0,
    radius: 26,
    restitution: 0.9,
    friction: 0.04,
    frictionAir: 0.015,
    forceMultiplier: 0.0019,
    maxForce: 0.24,
    aimLineLength: 1.25,
    canCurve: true,
    curveStrength: 1.25,
  },
} as const;

export const CAP = CAP_CLASSES.balanced;

export const SWIPE_NAVIGATION = {
  EDGE_ZONE_WIDTH: 25,
  THRESHOLD_PERCENT: 0.3,
  VELOCITY_THRESHOLD: 800,
  MAX_VERTICAL_DRIFT: 100,
  INDICATOR_WIDTH: 3,
  INDICATOR_COLOR: 0x00f2ff,
  INDICATOR_ALPHA_IDLE: 0.25,
  INDICATOR_ALPHA_HOVER: 0.5,
  INDICATOR_ALPHA_ACTIVE: 0.8,
  PARALLAX_FACTOR: 0.3,
  SHADOW_WIDTH: 20,
  DIMMING_MAX: 0.4,
  ANIMATION_DURATION: 200,
  SPRING_TENSION: 300,
  SPRING_FRICTION: 20,
  ARROW_SIZE: 18,
  PULSE_SPEED: 2000,
} as const;

export type FactionId = 'magma' | 'cyborg' | 'void' | 'insect';

export interface FactionStats {
  mass: number;
  bounce: number;
  speed: number;
  control?: number;
}

export interface FactionConfig {
  id: FactionId;
  name: string;
  description: string;
  assetKey: string;
  assetPath: string;
  color: number;
  colorSecondary: number;
  stats: FactionStats;
  particleEffect: {
    texture: string;
    colors: number[];
    speed: number;
    lifespan: number;
    scale: { start: number; end: number };
  };
}

export const FACTIONS: Record<FactionId, FactionConfig> = {
  magma: {
    id: 'magma',
    name: 'Magma Brutes',
    description: 'Heavy Defense. Hard to move, devastating impact.',
    assetKey: 'unit_magma',
    assetPath: '/assets/images/factions/art_magma.png',
    color: 0xff4500,
    colorSecondary: 0xff6b35,
    stats: {
      mass: 1.38,
      bounce: 0.3,
      speed: 0.85,
    },
    particleEffect: {
      texture: 'p_spark',
      colors: [0xff4500, 0xff6b00, 0xffaa00],
      speed: 80,
      lifespan: 400,
      scale: { start: 0.6, end: 0 },
    },
  },
  cyborg: {
    id: 'cyborg',
    name: 'Terran Cyborgs',
    description: 'Balanced Tech. Precision engineering for any situation.',
    assetKey: 'unit_cyborg',
    assetPath: '/assets/images/factions/art_cyborg.png',
    color: 0x00f2ff,
    colorSecondary: 0x0088ff,
    stats: {
      mass: 1.0,
      bounce: 0.7,
      speed: 1.0,
    },
    particleEffect: {
      texture: 'p_glitch',
      colors: [0x00f2ff, 0x0088ff, 0x00ffcc],
      speed: 60,
      lifespan: 300,
      scale: { start: 0.5, end: 0 },
    },
  },
  void: {
    id: 'void',
    name: 'Void Walkers',
    description: 'Phase Control. Light and elusive with powerful curve shots.',
    assetKey: 'unit_void',
    assetPath: '/assets/images/factions/art_void.png',
    color: 0x9d00ff,
    colorSecondary: 0xcc44ff,
    stats: {
      mass: 0.75,
      bounce: 0.85,
      speed: 1.0,
      control: 1.55,
    },
    particleEffect: {
      texture: 'p_smoke',
      colors: [0x9d00ff, 0xcc44ff, 0x6600cc],
      speed: 30,
      lifespan: 600,
      scale: { start: 0.8, end: 0.2 },
    },
  },
  insect: {
    id: 'insect',
    name: 'Xeno Swarm',
    description: 'Speed Assault. Lightning fast strikes, fragile but deadly.',
    assetKey: 'unit_insect',
    assetPath: '/assets/images/factions/art_insect.png',
    color: 0x39ff14,
    colorSecondary: 0x00ff00,
    stats: {
      mass: 0.82,
      bounce: 0.5,
      speed: 1.22,
    },
    particleEffect: {
      texture: 'p_drip',
      colors: [0x39ff14, 0x00ff00, 0x88ff44],
      speed: 40,
      lifespan: 500,
      scale: { start: 0.5, end: 0.1 },
    },
  },
};

export function getFaction(id: FactionId): FactionConfig {
  return FACTIONS[id];
}

export const FACTION_IDS: FactionId[] = ['magma', 'cyborg', 'void', 'insect'];
export const DEFAULT_FACTION: FactionId = 'cyborg';
export const STARTER_FACTIONS: FactionId[] = ['magma', 'cyborg'];

export function isStarterFaction(factionId: FactionId): boolean {
  return STARTER_FACTIONS.includes(factionId);
}

export const FACTION_PRICES: Record<FactionId, { coins?: number; crystals?: number }> = {
  cyborg: { coins: 15000 },
  magma: { coins: 15000 },
  void: { coins: 15000 },
  insect: { coins: 15000 },
};

export function getFactionPrice(factionId: FactionId): { coins?: number; crystals?: number } {
  return FACTION_PRICES[factionId];
}

export interface FactionArena {
  id: FactionId;
  name: string;
  assetKey: string;
  assetPath: string;
  ambientColor: number;
  lineColor: number;
  borderColor: number;
  goalColor: number;
  glowIntensity: number;
  style: 'neon' | 'industrial' | 'carbon' | 'organic';
}

export const FACTION_ARENAS: Record<FactionId, FactionArena> = {
  magma: {
    id: 'magma',
    name: 'The Crucible',
    assetKey: 'field_magma',
    assetPath: '/assets/backgrounds/field_magma.png',
    ambientColor: 0x1a0f0a,
    lineColor: 0xff4500,
    borderColor: 0xff4500,
    goalColor: 0xff6b35,
    glowIntensity: 1.2,
    style: 'industrial',
  },
  cyborg: {
    id: 'cyborg',
    name: 'Cyber Grid',
    assetKey: 'field_cyborg',
    assetPath: '/assets/backgrounds/field_cyborg.png',
    ambientColor: 0x0a0f1a,
    lineColor: 0x00f2ff,
    borderColor: 0x00f2ff,
    goalColor: 0x00f2ff,
    glowIntensity: 1.5,
    style: 'neon',
  },
  void: {
    id: 'void',
    name: 'Event Horizon',
    assetKey: 'field_void',
    assetPath: '/assets/backgrounds/field_void.png',
    ambientColor: 0x0f0a1a,
    lineColor: 0x9d00ff,
    borderColor: 0x9d00ff,
    goalColor: 0xcc44ff,
    glowIntensity: 1.3,
    style: 'carbon',
  },
  insect: {
    id: 'insect',
    name: 'The Hive',
    assetKey: 'field_insect',
    assetPath: '/assets/backgrounds/field_insect.png',
    ambientColor: 0x0a1a0f,
    lineColor: 0x39ff14,
    borderColor: 0x39ff14,
    goalColor: 0x00ff00,
    glowIntensity: 1.4,
    style: 'organic',
  },
};

export function getFactionArena(factionId: FactionId): FactionArena {
  return FACTION_ARENAS[factionId];
}

export const AURA = {
  TEAM_COLORS: {
    1: 0x00ffff,
    2: 0xff5500,
  } as Record<number, number>,
  PULSE_PERIOD: 1000,
  ALPHA_MIN: 0.5,
  ALPHA_MAX: 1.0,
  SCALE_MIN: 1.0,
  SCALE_MAX: 1.12,
  RADIUS_MULTIPLIER: 1.4,
  PHASE_OFFSET_TEAM2: Math.PI,
  AMPLITUDE_TEAM1: 1.0,
  AMPLITUDE_TEAM2: 0.75,
  SYNC_OWN_TEAM: true,
  ACTIVE_TURN_BOOST: 1.3,
  INACTIVE_TURN_DAMPEN: 0.6,
  SELECTED_SPEED_MULT: 1.8,
  SELECTED_EXTRA_RING: true,
} as const;

export const SHOOTING = {
  MAX_DRAG_DISTANCE: 150,
  FORCE_MULTIPLIER: 0.0015,
  MAX_FORCE: 0.2,
  AIM_LINE_COLOR: 0xffffff,
  AIM_LINE_ALPHA: 0.8,
  AIM_LINE_WIDTH: 3,
  TRAJECTORY_DOTS_COLOR: 0xffffff,
  TRAJECTORY_DOTS_ALPHA: 0.5,
  TRAJECTORY_DOTS_COUNT: 10,
  TRAJECTORY_DOT_RADIUS: 4,
} as const;

export const STARTING_POSITIONS = {
  BALL: { x: 0.5, y: 0.5 },
  PLAYER_1: [
    { x: 0.5, y: 0.75, capClass: 'sniper' as CapClass },
    { x: 0.25, y: 0.85, capClass: 'balanced' as CapClass },
    { x: 0.75, y: 0.85, capClass: 'tank' as CapClass },
  ],
  PLAYER_2: [
    { x: 0.5, y: 0.25, capClass: 'sniper' as CapClass },
    { x: 0.25, y: 0.15, capClass: 'balanced' as CapClass },
    { x: 0.75, y: 0.15, capClass: 'tank' as CapClass },
  ],
} as const;

export const GAME = {
  GOAL_DELAY: 2000,
  RESTART_DELAY: 1500,
  DEFAULT_MATCH_DURATION: 300,
} as const;

export enum UnitStatus {
  NONE = 0,
  STUNNED = 1,
  SHIELDED = 2,
  TOXIC_CHARGED = 3,
  IN_LAVA = 4,
}

// ========== СИСТЕМА ЗАРЯДОВ СПОСОБНОСТЕЙ ==========

export const ABILITY_CHARGE = {
  MAX_CHARGES: 2,
  START_CHARGES: 0,
  
  // Заработок в матче
  ON_GOAL_SCORED: 1,
  ON_GOAL_CONCEDED: 1,
  ON_BALL_HIT_ENEMY: 0.5,

  // 🔥 GLOBAL COOLDOWN (1 minute = 60000 ms)
  GLOBAL_COOLDOWN_MS: 60000,
} as const;

export const ABILITY_CONFIG = {
  CHARGE_COST: 1,
  
  MAGMA_LAVA_RADIUS: 50,
  MAGMA_LAVA_FRICTION: 0.12,
  MAGMA_LAVA_DURATION: 4,
  MAGMA_LAVA_MAX_ON_FIELD: 3,
  MAGMA_LAVA_MIN_DISTANCE_TO_BALL: 80,
  MAGMA_LAVA_MIN_DISTANCE_TO_UNIT: 40,
  MAGMA_LAVA_FORBIDDEN_ZONE_Y: 0.2,
  MAGMA_LAVA_SPAWN_DELAY: 200,

  CYBORG_SHIELD_RADIUS: 55,
  CYBORG_SHIELD_BOUNCE: 0.08,
  CYBORG_SHIELD_DURATION: 2,
  CYBORG_SHIELD_COOLDOWN: 2,
  CYBORG_SHIELD_MAX_ACTIVE: 1,
  CYBORG_SHIELD_TOXIN_IMMUNE: true,

  VOID_SWAP_RANGE: 9999,
  VOID_SWAP_COOLDOWN: 3,
  VOID_SWAP_ALLIES_ONLY: true,

  SWARM_TOXIN_DURATION: 2,
  SWARM_TOXIN_CHARGE_TURNS: 2,
  SWARM_TOXIN_BLOCKED_BY_SHIELD: true,
} as const;

// ========== LASSO (TRICKSTER ABILITY) ==========
export const LASSO_CONFIG = {
  COOLDOWN_MS: 30000,
  MIN_DISTANCE_RADII: 3.0,
  MAX_CAPTURE_DISTANCE: 400,
  MIN_THROW_FORCE: 0.012,
  MAX_THROW_FORCE: 0.045,
  PULL_SPEED: 6,
  SWING_SPEED: 0.04,
  MAX_SWING_ANGULAR: 0.12,
  ORBIT_RADIUS: 70,
  ROPE_COLOR: 0xffdd44,
  ROPE_THICKNESS: 2.5,
  ROPE_ALPHA: 0.85,
  CAPTURE_DURATION_MS: 300,
  MAX_HOLD_MS: 3000,
} as const;

// ========== СИСТЕМА ТОЧНОСТИ ==========

/** Базовая точность по классам */
export const BASE_ACCURACY: Record<CapClass, number> = {
  sniper: 0.96,
  balanced: 0.92,
  trickster: 0.88,
  tank: 0.84,
};

/** Модификатор точности по фракциям */
export const FACTION_ACCURACY_MODIFIER: Record<FactionId, number> = {
  cyborg: 0.05,   // Самые точные
  void: 0.02,     // Выше среднего
  insect: 0,      // Средняя
  magma: -0.03,   // Ниже среднего (сила важнее)
};

/** Максимальный разброс угла в радианах (при accuracy = 0) */
export const MAX_ACCURACY_SPREAD = Math.PI / 12; // 15 градусов

export const ABILITY_DEFINITIONS: Record<FactionId, AbilityDefinition> = {
  magma: {
    id: 'lava_placement',
    factionId: 'magma',
    name: 'Lava Pool',
    description: 'Place a lava pool that slows enemies',
    icon: '🔥',
    trigger: 'active',
    targetType: 'field_position',
    chargeCost: 1,
  },
  cyborg: {
    id: 'energy_shield',
    factionId: 'cyborg',
    name: 'Energy Shield',
    description: 'Protect a unit with a deflecting shield',
    icon: '⚡',
    trigger: 'active',
    targetType: 'own_unit_single',
    chargeCost: 1,
  },
  void: {
    id: 'phase_swap',
    factionId: 'void',
    name: 'Phase Swap',
    description: 'Swap positions of two allied units',
    icon: '🌀',
    trigger: 'active',
    targetType: 'own_unit_pair',
    chargeCost: 1,
  },
  insect: {
    id: 'neurotoxin',
    factionId: 'insect',
    name: 'Neurotoxin',
    description: 'Charge a unit to stun enemies on impact',
    icon: '☣️',
    trigger: 'active',
    targetType: 'own_unit_single',
    chargeCost: 1,
  },
};

export interface FactionAbilityConfig {
  type: 'passive' | 'active' | 'on_hit' | 'on_stop';
  name: string;
  description: string;
  icon: string;
}

export const FACTION_ABILITIES: Record<FactionId, FactionAbilityConfig> = {
  magma: {
    type: 'active',
    name: 'Lava Pool',
    description: 'Place a lava pool that slows enemies',
    icon: '🔥',
  },
  cyborg: {
    type: 'active',
    name: 'EMP Shield',
    description: 'Deflects the ball on contact',
    icon: '⚡',
  },
  void: {
    type: 'active',
    name: 'Phase Swap',
    description: 'Swap positions with an ally',
    icon: '🌀',
  },
  insect: {
    type: 'active',
    name: 'Neurotoxin',
    description: 'Stuns enemy units on impact',
    icon: '☣️',
  },
};

export const ABILITY_CARD_PRICES: Record<FactionId, { coins: number; crystals: number; packSize: number }> = {
  magma: { coins: 500, crystals: 5, packSize: 3 },
  cyborg: { coins: 500, crystals: 5, packSize: 3 },
  void: { coins: 600, crystals: 6, packSize: 3 },
  insect: { coins: 500, crystals: 5, packSize: 3 },
};

// ========== SPIN & CURVE SYSTEM ==========

export const BALL_SPIN = {
  BASE_SPIN_MULTIPLIER: 0.015,
  MAX_SPIN_VELOCITY: 0.15,
  SPIN_DECAY: 0.96,
  SPIN_TO_CURVE_RATIO: 0.0008,

  TRICKSTER_BONUS: 0.3,
  CONTROL_STAT_WEIGHT: 0.2,
  TECHNIQUE_UPGRADE_WEIGHT: 0.05,

  BASE_SPIN_CHANCE: 0.3,
  CONTROL_CHANCE_BONUS: 0.5,

  CORNER_ZONE_SIZE: 90,
  CORNER_SPIN_MULTIPLIER: 1.5,
  WALL_HUG_DISTANCE: 45,
  OPTIMAL_IMPACT_ANGLE: 0.5,
} as const;

// ========== WALL & CORNER PHYSICS ==========

export const WALL_PHYSICS = {
  // Thickness
  BASE_THICKNESS: 80,                 // px (before scaling)
  CORNER_CHAMFER_SIZE: 30,            // px (before scaling)
  
  // Restitution by zone
  SIDE_WALL_RESTITUTION: 0.75,
  END_WALL_RESTITUTION: 0.70,
  CORNER_RESTITUTION: 0.50,           // Absorbs energy
  POST_RESTITUTION: 0.92,
  
  // Friction by zone
  SIDE_WALL_FRICTION: 0.03,
  END_WALL_FRICTION: 0.04,
  CORNER_FRICTION: 0.10,              // High friction to slow down
  POST_FRICTION: 0.02,
  
  // Safety
  ESCAPE_SAFETY_MARGIN: 0,             // ✅ 2: Set to 0 - boundary correction should be positional clamping only
  ESCAPE_VELOCITY_DAMPING: 1.0,        // ✅ 2: Set to 1.0 - no velocity damping in boundary correction
} as const;