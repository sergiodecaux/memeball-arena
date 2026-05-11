// src/ai/roles/UnitRoles.ts — роли AI на поле (GK / disrupt / finish и т.д.)

import type { AIUnit } from '../scoring/AbilityScorer';

export type UnitRole =
  | 'goalkeeper'
  | 'defender'
  | 'disruptor'
  | 'playmaker'
  | 'opportunist'
  | 'finisher'
  | 'flex';

export interface RoleBehavior {
  role: UnitRole;
  priorities: {
    defendGoal: number;
    attackGoal: number;
    disruptOpponent: number;
    createChances: number;
    huntOpenGoals: number;
    longShots: number;
  };
  preferredZone: { min: number; max: number };
  description: string;
}

export const ROLE_BEHAVIORS: Record<UnitRole, RoleBehavior> = {
  goalkeeper: {
    role: 'goalkeeper',
    priorities: {
      defendGoal: 1.0,
      attackGoal: 0.1,
      disruptOpponent: 0.25,
      createChances: 0.05,
      huntOpenGoals: 0.0,
      longShots: 0.0,
    },
    preferredZone: { min: 0.0, max: 0.18 },
    description: 'Stays near own goal, last line of defense',
  },
  defender: {
    role: 'defender',
    priorities: {
      defendGoal: 0.85,
      attackGoal: 0.32,
      disruptOpponent: 0.45,
      createChances: 0.22,
      huntOpenGoals: 0.12,
      longShots: 0.22,
    },
    preferredZone: { min: 0.0, max: 0.42 },
    description: 'Own half, occasional attacks',
  },
  disruptor: {
    role: 'disruptor',
    priorities: {
      defendGoal: 0.42,
      attackGoal: 0.52,
      disruptOpponent: 1.0,
      createChances: 0.32,
      huntOpenGoals: 0.22,
      longShots: 0.32,
    },
    preferredZone: { min: 0.18, max: 0.72 },
    description: 'Disrupts threats, clears danger',
  },
  playmaker: {
    role: 'playmaker',
    priorities: {
      defendGoal: 0.22,
      attackGoal: 0.62,
      disruptOpponent: 0.32,
      createChances: 1.0,
      huntOpenGoals: 0.42,
      longShots: 0.42,
    },
    preferredZone: { min: 0.28, max: 0.82 },
    description: 'Orchestrates, creates chances',
  },
  opportunist: {
    role: 'opportunist',
    priorities: {
      defendGoal: 0.12,
      attackGoal: 0.85,
      disruptOpponent: 0.22,
      createChances: 0.52,
      huntOpenGoals: 1.0,
      longShots: 0.35,
    },
    preferredZone: { min: 0.38, max: 0.95 },
    description: 'Hunts open goals',
  },
  finisher: {
    role: 'finisher',
    priorities: {
      defendGoal: 0.12,
      attackGoal: 1.0,
      disruptOpponent: 0.22,
      createChances: 0.42,
      huntOpenGoals: 0.65,
      longShots: 1.0,
    },
    preferredZone: { min: 0.48, max: 1.0 },
    description: 'Long-range and key finishes',
  },
  flex: {
    role: 'flex',
    priorities: {
      defendGoal: 0.5,
      attackGoal: 0.5,
      disruptOpponent: 0.5,
      createChances: 0.5,
      huntOpenGoals: 0.5,
      longShots: 0.5,
    },
    preferredZone: { min: 0.2, max: 0.82 },
    description: 'Flexible',
  },
};

export type FieldBoundsLike = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
};

export class RoleManager {
  public static assignRoles(units: AIUnit[]): Map<string, UnitRole> {
    const roles = new Map<string, UnitRole>();

    const tanks = units.filter((u) => u.getCapClass() === 'tank');
    const enforcers = units.filter((u) => u.getCapClass() === 'enforcer');
    const tricksters = units.filter((u) => u.getCapClass() === 'trickster');
    const playmakers = units.filter((u) => u.getCapClass() === 'playmaker');
    const maestros = units.filter((u) => u.getCapClass() === 'maestro');
    const snipers = units.filter((u) => u.getCapClass() === 'sniper');
    const balanced = units.filter((u) => u.getCapClass() === 'balanced');

    if (tanks.length > 0) {
      roles.set(tanks[0].id, 'goalkeeper');
    } else if (enforcers.length > 0) {
      roles.set(enforcers[0].id, 'goalkeeper');
    } else if (balanced.length > 0) {
      roles.set(balanced[0].id, 'goalkeeper');
    }

    for (let i = 1; i < tanks.length; i++) {
      roles.set(tanks[i].id, 'defender');
    }

    for (const enforcer of enforcers) {
      if (!roles.has(enforcer.id)) {
        roles.set(enforcer.id, 'disruptor');
      }
    }

    for (const maestro of maestros) {
      roles.set(maestro.id, 'playmaker');
    }

    for (const trickster of tricksters) {
      roles.set(trickster.id, 'opportunist');
    }

    for (const playmaker of playmakers) {
      roles.set(playmaker.id, 'opportunist');
    }

    for (const sniper of snipers) {
      roles.set(sniper.id, 'finisher');
    }

    for (const bal of balanced) {
      if (!roles.has(bal.id)) {
        roles.set(bal.id, 'flex');
      }
    }

    for (const u of units) {
      if (!roles.has(u.id)) {
        roles.set(u.id, 'flex');
      }
    }

    return roles;
  }

  public static getRoleBehavior(role: UnitRole): RoleBehavior {
    return ROLE_BEHAVIORS[role];
  }

  public static isInPreferredZone(unit: AIUnit, role: UnitRole, fieldBounds: { top: number; bottom: number; height: number }): boolean {
    const behavior = this.getRoleBehavior(role);
    const unitY = unit.body.position.y;
    const normalizedY = (unitY - fieldBounds.top) / Math.max(1, fieldBounds.height);
    return normalizedY >= behavior.preferredZone.min && normalizedY <= behavior.preferredZone.max;
  }

  /** Абсолютная точка «якоря» роли: slotX 0–1 по ширине поля, Y по нормализованной зоне (0 = верх / ворота AI). */
  public static getTargetPosition(role: UnitRole, fieldBounds: FieldBoundsLike, slotX = 0.5): { x: number; y: number } {
    const behavior = this.getRoleBehavior(role);
    const targetYNorm = (behavior.preferredZone.min + behavior.preferredZone.max) / 2;
    return {
      x: fieldBounds.left + slotX * fieldBounds.width,
      y: fieldBounds.top + targetYNorm * fieldBounds.height,
    };
  }
}
