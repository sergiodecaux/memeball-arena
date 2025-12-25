// src/constants/gameConstants.ts

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
  WIDTH: 138,              // было 160 → идеально 23% поля
  DEPTH: 40,
  POST_THICKNESS: 12,
  NET_COLOR: 0xffffff,
  POST_COLOR: 0xeeeeee,
} as const;

export const PHYSICS = {
  FRICTION_AIR: 0.008,     // было 0.015 → объекты живут дольше
  RESTITUTION: 0.7,
  FRICTION: 0.05,
} as const;

export const COLLISION_CATEGORIES = {
  WALL: 0x0001,
  CAP: 0x0002,
  BALL: 0x0004,
  GOAL_SENSOR: 0x0008,
} as const;

export const BALL = {
  RADIUS: 15,
  COLOR: 0xffffff,
  MASS: 1.2,               // было 0.8 → тяжелее для стабильных столкновений
  RESTITUTION: 0.88,       // было 0.85 → больше отскоков
  FRICTION: 0.005,
  FRICTION_AIR: 0.005,     // было 0.008 → мяч летает дальше
  LABEL: 'ball',
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
  balanced: {
    name: 'Balanced',
    description: 'All-round player.',
    mass: 3.5,
    radius: 28,
    restitution: 0.5,
    friction: 0.05,
    frictionAir: 0.018,        // было 0.02 → быстрее останавливается
    forceMultiplier: 0.0020,   // было 0.0018 → чуть сильнее
    maxForce: 0.26,            // было 0.22
    aimLineLength: 1.0,
    canCurve: false,
    curveStrength: 0,
  },
  tank: {
    name: 'Tank',
    description: 'Heavy defender.',
    mass: 6.8,                 // было 8.0 → теперь можно пробить
    radius: 34,
    restitution: 0.1,
    friction: 0.2,
    frictionAir: 0.04,         // было 0.05 → чуть живее
    forceMultiplier: 0.0017,   // было 0.0015
    maxForce: 0.20,            // было 0.18
    aimLineLength: 0.7,
    canCurve: false,
    curveStrength: 0,
  },
  sniper: {
    name: 'Sniper',
    description: 'Glass cannon.',
    mass: 3.2,                 // было 2.6 → финал с insect: 2.62 (ratio 2.18)
    radius: 24,
    restitution: 0.48,         // было 0.65 → меньше отскок!
    friction: 0.02,
    frictionAir: 0.010,        // было 0.006 → быстрее останавливается
    forceMultiplier: 0.0023,   // было 0.0028 → сильный, но не имба
    maxForce: 0.28,            // было 0.35 → убрали сверхдальний выстрел
    aimLineLength: 1.45,       // было 1.6
    canCurve: false,
    curveStrength: 0,
  },
  trickster: {
    name: 'Trickster',
    description: 'Curve master.',
    mass: 3.0,
    radius: 26,
    restitution: 0.5,
    friction: 0.04,
    frictionAir: 0.012,        // было 0.015 → быстрее
    forceMultiplier: 0.0019,   // было 0.0016
    maxForce: 0.24,            // было 0.20
    aimLineLength: 1.25,       // было 1.1
    canCurve: true,
    curveStrength: 1.25,       // было 0.45 → КРИВЫЕ НАКОНЕЦ-ТО РАБОТАЮТ!
  },
} as const;

export const CAP = CAP_CLASSES.balanced;

// ========== ФРАКЦИИ (ALIEN FACTIONS) ==========

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
    assetPath: 'assets/sprites/factions/magma/token.png',
    color: 0xff4500,
    colorSecondary: 0xff6b35,
    stats: {
      mass: 1.38,              // было 1.5 → тяжёлые, но пробиваемые
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
    assetPath: 'assets/sprites/factions/cyborg/token.png',
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
    assetPath: 'assets/sprites/factions/void/token.png',
    color: 0x9d00ff,
    colorSecondary: 0xcc44ff,
    stats: {
      mass: 0.75,
      bounce: 0.85,
      speed: 1.0,
      control: 1.55,           // было 1.4 → кривые реально опасны
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
    assetPath: 'assets/sprites/factions/insect/token.png',
    color: 0x39ff14,
    colorSecondary: 0x00ff00,
    stats: {
      mass: 0.82,              // было 0.7 → финальная масса sniper+insect = 2.62
      bounce: 0.5,
      speed: 1.22,             // было 1.35 → больше не ракета
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

// ========== ФРАКЦИОННЫЕ АРЕНЫ ==========

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
    assetPath: 'assets/backgrounds/field_magma.png',
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
    assetPath: 'assets/backgrounds/field_cyborg.png',
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
    assetPath: 'assets/backgrounds/field_void.png',
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
    assetPath: 'assets/backgrounds/field_insect.png',
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

// ========== АУРА ==========
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
  WINNING_SCORE: 3,
  GOAL_DELAY: 2000,
  RESTART_DELAY: 1500,
} as const;

export const FACTION_PRICES: Record<FactionId, { coins?: number; crystals?: number }> = {
  cyborg: {},
  magma: { coins: 15000 },
  void: { coins: 15000 },
  insect: { coins: 15000 },
};

export function getFactionPrice(factionId: FactionId): { coins?: number; crystals?: number } {
  return FACTION_PRICES[factionId];
}