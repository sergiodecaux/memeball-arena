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
  WIDTH: 160,
  DEPTH: 40,
  POST_THICKNESS: 12,
  NET_COLOR: 0xffffff,
  POST_COLOR: 0xeeeeee,
} as const;

export const PHYSICS = {
  FRICTION_AIR: 0.015,
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
  MASS: 0.8,
  RESTITUTION: 0.85,
  FRICTION: 0.005,
  FRICTION_AIR: 0.008,
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
    description: 'All-round player. Good at everything.',
    mass: 2.5,
    radius: 28,
    restitution: 0.6,
    friction: 0.02,
    frictionAir: 0.012,
    forceMultiplier: 0.0008,
    maxForce: 0.12,
    aimLineLength: 1.0,
    canCurve: false,
    curveStrength: 0,
  },
  tank: {
    name: 'Tank',
    description: 'Heavy defender. Hard to push, weak shot.',
    mass: 5.0,
    radius: 34,
    restitution: 0.4,
    friction: 0.03,
    frictionAir: 0.015,
    forceMultiplier: 0.0005,
    maxForce: 0.08,
    aimLineLength: 0.7,
    canCurve: false,
    curveStrength: 0,
  },
  sniper: {
    name: 'Sniper',
    description: 'Precise long-range shooter. Light and fast.',
    mass: 1.5,
    radius: 24,
    restitution: 0.7,
    friction: 0.01,
    frictionAir: 0.008,
    forceMultiplier: 0.001,
    maxForce: 0.15,
    aimLineLength: 1.5,
    canCurve: false,
    curveStrength: 0,
  },
  trickster: {
    name: 'Trickster',
    description: 'Can curve the ball. Unpredictable.',
    mass: 2.0,
    radius: 26,
    restitution: 0.65,
    friction: 0.02,
    frictionAir: 0.01,
    forceMultiplier: 0.0007,
    maxForce: 0.1,
    aimLineLength: 1.0,
    canCurve: true,
    curveStrength: 0.3,
  },
} as const;

export const CAP = CAP_CLASSES.balanced;

export const SHOOTING = {
  MAX_DRAG_DISTANCE: 150,
  FORCE_MULTIPLIER: 0.0008,
  MAX_FORCE: 0.12,
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