// src/data/SkinsCatalog.ts

import { SkinRarity, SkinVisualConfig, ParticleConfig } from '../types';

export interface SkinPrice {
  coins?: number;
  stars?: number;
}

export interface RarityBonus {
  power: number;
  speed: number;
  control: number;
  weight: number;
}

// === CONSTANTS ===
export const MAX_CAP_LEVEL = 25;
export const BONUS_PER_LEVEL = 1;

export const RARITY_BONUSES: Record<SkinRarity, RarityBonus> = {
  basic: { power: 0, speed: 0, control: 0, weight: 0 },
  common: { power: 2, speed: 2, control: 1, weight: 2 },
  rare: { power: 5, speed: 4, control: 3, weight: 5 },
  epic: { power: 8, speed: 6, control: 5, weight: 8 },
  legendary: { power: 12, speed: 8, control: 7, weight: 12 },
};

export const UPGRADE_COST_MULTIPLIER: Record<SkinRarity, number> = {
  basic: 1.0, common: 0.9, rare: 0.75, epic: 0.6, legendary: 0.5,
};

export const BASE_UPGRADE_COSTS: number[] = [
  0, 100, 200, 300, 450, 600, 800, 1100, 1500, 2000,
  2600, 3300, 4100, 5000, 6000, 7200, 8500, 10000, 12000, 15000,
  18000, 22000, 26000, 30000, 35000,
];

// === DATA INTERFACES ===

export interface CapSkinData {
  id: string;
  name: string;
  rarity: SkinRarity;
  price: SkinPrice;
  primaryColor: number;
  secondaryColor: number;
  glowColor?: number;
  hasGlow: boolean;
  bonusPower?: number;
  bonusSpeed?: number;
  bonusControl?: number;
  bonusWeight?: number;
  visual: SkinVisualConfig;
}

export interface BallSkinData {
  id: string;
  name: string;
  rarity: SkinRarity;
  price: SkinPrice;
  primaryColor: number;
  secondaryColor: number;
  glowColor: number;
  hasGlow: boolean;
  hasTrail: boolean;
  trailColor?: number;
  textureKey?: string;
  particleEffect?: ParticleConfig;
}

export interface FieldEffectConfig {
  type: 'particles' | 'ambient' | 'border' | 'overlay';
  particleTexture?: string;
  particleColors?: number[];
  particleCount?: number;
  particleSpeed?: number;
  particleScale?: { start: number; end: number };
  particleAlpha?: { start: number; end: number };
  particleLifespan?: number;
  animatedBorder?: boolean;
  borderPulse?: boolean;
  ambientGlow?: boolean;
  glowColor?: number;
  glowIntensity?: number;
}

export interface FieldSkinData {
  id: string;
  name: string;
  rarity: SkinRarity;
  price: SkinPrice;
  fieldColor: number;
  lineColor: number;
  borderColor: number;
  goalColor: number;
  textureKey?: string;
  effects?: FieldEffectConfig[];
}

// ==================== CAP SKINS ====================
// textureKey должен совпадать с ключами в CapTextures.ts

export const CAP_SKINS: CapSkinData[] = [
  // ========== BASIC ==========
  {
    id: 'cap_default_cyan',
    name: 'Neon Cyan',
    rarity: 'basic',
    price: {},
    primaryColor: 0x06b6d4,
    secondaryColor: 0x0891b2,
    hasGlow: true,
    glowColor: 0x06b6d4,
    visual: { type: 'sprite', textureKey: 'skin_basic_cyan' }
  },
  {
    id: 'cap_default_magenta',
    name: 'Neon Magenta',
    rarity: 'basic',
    price: {},
    primaryColor: 0xd946ef,
    secondaryColor: 0xbe185d,
    hasGlow: true,
    glowColor: 0xd946ef,
    visual: { type: 'sprite', textureKey: 'skin_basic_magenta' }
  },

  // ========== COMMON ==========
  {
    id: 'cap_steel',
    name: 'Steel Plate',
    rarity: 'common',
    price: { coins: 1000 },
    primaryColor: 0x71717a,
    secondaryColor: 0x3f3f46,
    hasGlow: false,
    bonusWeight: 3,
    visual: {
      type: 'sprite',
      textureKey: 'skin_steel',
      particleEffect: {
        texture: 'p_spark', color: [0xffffff, 0xa1a1aa], blendMode: 'ADD',
        speed: 30, scale: { start: 0.2, end: 0 }, lifespan: 200,
        frequency: 200, followVelocity: true, quantity: 2
      }
    }
  },
  {
    id: 'cap_wood',
    name: 'Wooden Classic',
    rarity: 'common',
    price: { coins: 800 },
    primaryColor: 0x92400e,
    secondaryColor: 0x78350f,
    hasGlow: false,
    bonusControl: 2,
    visual: { type: 'sprite', textureKey: 'skin_wood' }
  },
  {
    id: 'cap_neon_green',
    name: 'Neon Green',
    rarity: 'common',
    price: { coins: 1200 },
    primaryColor: 0x22c55e,
    secondaryColor: 0x16a34a,
    hasGlow: true,
    glowColor: 0x4ade80,
    bonusSpeed: 2,
    visual: { type: 'sprite', textureKey: 'skin_neon_green' }
  },
  {
    id: 'cap_neon_orange',
    name: 'Neon Orange',
    rarity: 'common',
    price: { coins: 1200 },
    primaryColor: 0xf97316,
    secondaryColor: 0xea580c,
    hasGlow: true,
    glowColor: 0xfb923c,
    bonusPower: 2,
    visual: { type: 'sprite', textureKey: 'skin_neon_orange' }
  },
  {
    id: 'cap_carbon',
    name: 'Carbon Fiber',
    rarity: 'common',
    price: { coins: 1500 },
    primaryColor: 0x404040,
    secondaryColor: 0x171717,
    hasGlow: false,
    bonusWeight: 4,
    visual: { type: 'sprite', textureKey: 'skin_carbon' }
  },
  {
    id: 'cap_gold',
    name: 'Royal Gold',
    rarity: 'common',
    price: { coins: 2000 },
    primaryColor: 0xf59e0b,
    secondaryColor: 0xb45309,
    hasGlow: true,
    glowColor: 0xfcd34d,
    bonusPower: 2,
    visual: {
      type: 'sprite',
      textureKey: 'skin_gold',
      particleEffect: {
        texture: 'p_spark', color: [0xfcd34d, 0xfbbf24], blendMode: 'ADD',
        speed: 15, scale: { start: 0.3, end: 0 }, lifespan: 400,
        frequency: 150, followVelocity: true, quantity: 1
      }
    }
  },

  // ========== RARE ==========
  {
    id: 'cap_electric',
    name: 'Electric',
    rarity: 'rare',
    price: { coins: 3000 },
    primaryColor: 0xfbbf24,
    secondaryColor: 0x1e3a8a,
    hasGlow: true,
    glowColor: 0xfde047,
    bonusSpeed: 5,
    visual: {
      type: 'sprite',
      textureKey: 'skin_electric',
      particleEffect: {
        texture: 'p_spark', color: [0xfde047, 0x3b82f6, 0xffffff], blendMode: 'ADD',
        speed: 60, scale: { start: 0.4, end: 0 }, lifespan: 150,
        frequency: 50, followVelocity: false, quantity: 3
      }
    }
  },
  {
    id: 'cap_aqua',
    name: 'Aqua Marine',
    rarity: 'rare',
    price: { coins: 3500 },
    primaryColor: 0x06b6d4,
    secondaryColor: 0x0e7490,
    hasGlow: true,
    glowColor: 0x22d3ee,
    bonusControl: 4,
    visual: {
      type: 'sprite',
      textureKey: 'skin_aqua',
      particleEffect: {
        texture: 'p_bubble', color: [0x67e8f9, 0x06b6d4], blendMode: 'NORMAL',
        speed: 20, scale: { start: 0.5, end: 0.1 }, lifespan: 1000,
        frequency: 100, followVelocity: false, quantity: 2, gravityY: -30
      }
    }
  },
  {
    id: 'cap_shadow',
    name: 'Shadow',
    rarity: 'rare',
    price: { coins: 4000 },
    primaryColor: 0x1f2937,
    secondaryColor: 0x111827,
    hasGlow: true,
    glowColor: 0x6b7280,
    bonusSpeed: 4,
    visual: {
      type: 'sprite',
      textureKey: 'skin_shadow',
      particleEffect: {
        texture: 'p_smoke', color: [0x374151, 0x1f2937, 0x000000], blendMode: 'NORMAL',
        speed: 10, scale: { start: 0.8, end: 0 }, lifespan: 800,
        frequency: 60, followVelocity: true, quantity: 2
      }
    }
  },
  {
    id: 'cap_sakura',
    name: 'Cherry Blossom',
    rarity: 'rare',
    price: { coins: 4500 },
    primaryColor: 0xfda4af,
    secondaryColor: 0xfb7185,
    hasGlow: true,
    glowColor: 0xfecdd3,
    bonusControl: 5,
    visual: {
      type: 'sprite',
      textureKey: 'skin_sakura',
      particleEffect: {
        texture: 'p_petal', color: [0xfda4af, 0xfecdd3, 0xffffff], blendMode: 'NORMAL',
        speed: 25, scale: { start: 0.4, end: 0.1 }, lifespan: 1500,
        frequency: 80, followVelocity: false, quantity: 2, gravityY: 20
      }
    }
  },
  {
    id: 'cap_hologram',
    name: 'Holographic',
    rarity: 'rare',
    price: { coins: 5000 },
    primaryColor: 0x818cf8,
    secondaryColor: 0x34d399,
    hasGlow: true,
    glowColor: 0xc4b5fd,
    bonusPower: 3,
    bonusSpeed: 3,
    visual: {
      type: 'sprite',
      textureKey: 'skin_hologram',
      particleEffect: {
        texture: 'p_glow', color: [0x818cf8, 0x34d399, 0xfbbf24, 0xf472b6], blendMode: 'ADD',
        speed: 15, scale: { start: 0.3, end: 0 }, lifespan: 600,
        frequency: 100, followVelocity: true, quantity: 1
      }
    }
  },
  {
    id: 'cap_toxic',
    name: 'Bio Hazard',
    rarity: 'rare',
    price: { coins: 4000 },
    primaryColor: 0x22c55e,
    secondaryColor: 0x14532d,
    hasGlow: true,
    glowColor: 0x4ade80,
    bonusSpeed: 4,
    visual: {
      type: 'sprite',
      textureKey: 'skin_toxic',
      particleEffect: {
        texture: 'p_bubble', color: [0x4ade80, 0x22c55e], blendMode: 'NORMAL',
        speed: 15, scale: { start: 0.5, end: 0 }, lifespan: 800,
        frequency: 80, followVelocity: true, quantity: 2
      }
    }
  },
  {
    id: 'cap_ice',
    name: 'Glacial',
    rarity: 'rare',
    price: { coins: 4500 },
    primaryColor: 0x0ea5e9,
    secondaryColor: 0x0284c7,
    hasGlow: true,
    glowColor: 0x7dd3fc,
    bonusControl: 4,
    visual: {
      type: 'sprite',
      textureKey: 'skin_ice',
      particleEffect: {
        texture: 'p_shard', color: [0xe0f2fe, 0x0ea5e9, 0xffffff], blendMode: 'ADD',
        speed: 25, scale: { start: 0.4, end: 0 }, lifespan: 500,
        frequency: 100, followVelocity: true, quantity: 2
      }
    }
  },

  // ========== EPIC ==========
  {
    id: 'cap_phoenix',
    name: 'Phoenix',
    rarity: 'epic',
    price: { stars: 40 },
    primaryColor: 0xef4444,
    secondaryColor: 0xfbbf24,
    hasGlow: true,
    glowColor: 0xf97316,
    bonusPower: 8,
    bonusSpeed: 4,
    visual: {
      type: 'sprite',
      textureKey: 'skin_phoenix',
      particleEffect: {
        texture: 'p_flame', color: [0xef4444, 0xfbbf24, 0xffffff], blendMode: 'ADD',
        speed: 40, scale: { start: 0.8, end: 0 }, lifespan: 600,
        frequency: 30, followVelocity: false, quantity: 3, gravityY: -60
      }
    }
  },
  {
    id: 'cap_frost_king',
    name: 'Frost King',
    rarity: 'epic',
    price: { stars: 50 },
    primaryColor: 0x0ea5e9,
    secondaryColor: 0xffffff,
    hasGlow: true,
    glowColor: 0xbae6fd,
    bonusControl: 8,
    bonusWeight: 4,
    visual: {
      type: 'sprite',
      textureKey: 'skin_frost_king',
      particleEffect: {
        texture: 'p_shard', color: [0xffffff, 0xbae6fd, 0x0ea5e9], blendMode: 'ADD',
        speed: 35, scale: { start: 0.6, end: 0 }, lifespan: 800,
        frequency: 40, followVelocity: false, quantity: 4
      }
    }
  },
  {
    id: 'cap_void',
    name: 'Void Walker',
    rarity: 'epic',
    price: { stars: 60 },
    primaryColor: 0x581c87,
    secondaryColor: 0x0f0f0f,
    hasGlow: true,
    glowColor: 0x7c3aed,
    bonusSpeed: 8,
    visual: {
      type: 'sprite',
      textureKey: 'skin_void',
      particleEffect: {
        texture: 'p_glow', color: [0x581c87, 0x7c3aed, 0x000000], blendMode: 'ADD',
        speed: 20, scale: { start: 1.0, end: 0 }, lifespan: 1000,
        frequency: 50, followVelocity: true, quantity: 2
      }
    }
  },
  {
    id: 'cap_thunder',
    name: 'Thunder God',
    rarity: 'epic',
    price: { stars: 70 },
    primaryColor: 0x3b82f6,
    secondaryColor: 0xfbbf24,
    hasGlow: true,
    glowColor: 0x60a5fa,
    bonusPower: 10,
    visual: {
      type: 'sprite',
      textureKey: 'skin_thunder',
      particleEffect: {
        texture: 'p_spark', color: [0xfde047, 0x3b82f6, 0xffffff], blendMode: 'ADD',
        speed: 80, scale: { start: 0.5, end: 0 }, lifespan: 100,
        frequency: 30, followVelocity: false, quantity: 5
      }
    }
  },
  {
    id: 'cap_nature',
    name: 'Nature Spirit',
    rarity: 'epic',
    price: { stars: 55 },
    primaryColor: 0x22c55e,
    secondaryColor: 0x854d0e,
    hasGlow: true,
    glowColor: 0x86efac,
    bonusControl: 6,
    bonusSpeed: 4,
    visual: {
      type: 'sprite',
      textureKey: 'skin_nature',
      particleEffect: {
        texture: 'p_petal', color: [0x22c55e, 0x86efac, 0x365314], blendMode: 'NORMAL',
        speed: 20, scale: { start: 0.5, end: 0.1 }, lifespan: 1200,
        frequency: 60, followVelocity: false, quantity: 3, gravityY: 15
      }
    }
  },
  {
    id: 'cap_magma',
    name: 'Magma Core',
    rarity: 'epic',
    price: { stars: 60 },
    primaryColor: 0xff4500,
    secondaryColor: 0x7f1d1d,
    hasGlow: true,
    glowColor: 0xff6347,
    bonusPower: 8,
    visual: {
      type: 'sprite',
      textureKey: 'skin_magma',
      particleEffect: {
        texture: 'p_smoke', color: [0xff4500, 0x000000], blendMode: 'ADD',
        speed: 30, scale: { start: 0.7, end: 0 }, lifespan: 700,
        frequency: 50, followVelocity: true, quantity: 2
      }
    }
  },
  {
    id: 'cap_dragon',
    name: 'Emerald Dragon',
    rarity: 'epic',
    price: { stars: 80 },
    primaryColor: 0x10b981,
    secondaryColor: 0x064e3b,
    hasGlow: true,
    glowColor: 0x34d399,
    bonusWeight: 6,
    bonusPower: 5,
    visual: {
      type: 'sprite',
      textureKey: 'skin_dragon',
      particleEffect: {
        texture: 'p_flame', color: [0x34d399, 0x059669, 0x10b981], blendMode: 'ADD',
        speed: 25, scale: { start: 0.8, end: 0 }, lifespan: 800,
        frequency: 60, followVelocity: true, quantity: 2
      }
    }
  },

  // ========== LEGENDARY ==========
  {
    id: 'cap_celestial',
    name: 'Celestial',
    rarity: 'legendary',
    price: { stars: 120 },
    primaryColor: 0x1e3a8a,
    secondaryColor: 0xfbbf24,
    hasGlow: true,
    glowColor: 0x3b82f6,
    bonusPower: 8,
    bonusControl: 8,
    visual: {
      type: 'sprite',
      textureKey: 'skin_celestial',
      particleEffect: {
        texture: 'p_spark', color: [0xffffff, 0xfbbf24, 0x3b82f6], blendMode: 'ADD',
        speed: 30, scale: { start: 0.4, end: 0 }, lifespan: 1500,
        frequency: 40, followVelocity: false, quantity: 4
      }
    }
  },
  {
    id: 'cap_rainbow',
    name: 'Rainbow Prism',
    rarity: 'legendary',
    price: { stars: 150 },
    primaryColor: 0xffffff,
    secondaryColor: 0x6366f1,
    hasGlow: true,
    glowColor: 0xf472b6,
    bonusSpeed: 10,
    bonusControl: 6,
    visual: {
      type: 'sprite',
      textureKey: 'skin_rainbow',
      particleEffect: {
        texture: 'p_glow', color: [0xef4444, 0xf97316, 0xfbbf24, 0x22c55e, 0x3b82f6, 0x8b5cf6, 0xec4899], blendMode: 'ADD',
        speed: 25, scale: { start: 0.5, end: 0 }, lifespan: 800,
        frequency: 30, followVelocity: true, quantity: 3
      }
    }
  },
  {
    id: 'cap_infernal',
    name: 'Infernal Demon',
    rarity: 'legendary',
    price: { stars: 180 },
    primaryColor: 0x7f1d1d,
    secondaryColor: 0x000000,
    hasGlow: true,
    glowColor: 0xef4444,
    bonusPower: 15,
    visual: {
      type: 'sprite',
      textureKey: 'skin_infernal',
      particleEffect: {
        texture: 'p_flame', color: [0xef4444, 0x7f1d1d, 0x000000, 0xfbbf24], blendMode: 'ADD',
        speed: 50, scale: { start: 1.0, end: 0.2 }, lifespan: 900,
        frequency: 20, followVelocity: false, quantity: 4, gravityY: -80
      }
    }
  },
  {
    id: 'cap_divine',
    name: 'Divine Angel',
    rarity: 'legendary',
    price: { stars: 180 },
    primaryColor: 0xffffff,
    secondaryColor: 0xfcd34d,
    hasGlow: true,
    glowColor: 0xfef3c7,
    bonusControl: 12,
    bonusSpeed: 6,
    visual: {
      type: 'sprite',
      textureKey: 'skin_divine',
      particleEffect: {
        texture: 'p_glow', color: [0xffffff, 0xfcd34d, 0xfef3c7], blendMode: 'ADD',
        speed: 20, scale: { start: 0.6, end: 0 }, lifespan: 1200,
        frequency: 40, followVelocity: false, quantity: 3, gravityY: -20
      }
    }
  },
  {
    id: 'cap_quantum',
    name: 'Quantum',
    rarity: 'legendary',
    price: { stars: 200 },
    primaryColor: 0x06b6d4,
    secondaryColor: 0xd946ef,
    hasGlow: true,
    glowColor: 0x67e8f9,
    bonusPower: 8,
    bonusSpeed: 8,
    bonusControl: 6,
    visual: {
      type: 'sprite',
      textureKey: 'skin_quantum',
      particleEffect: {
        texture: 'p_spark', color: [0x06b6d4, 0xd946ef, 0xffffff, 0x000000], blendMode: 'ADD',
        speed: 100, scale: { start: 0.3, end: 0 }, lifespan: 200,
        frequency: 20, followVelocity: false, quantity: 6
      }
    }
  },
  {
    id: 'cap_galaxy',
    name: 'Stardust',
    rarity: 'legendary',
    price: { stars: 150 },
    primaryColor: 0x6366f1,
    secondaryColor: 0x0f172a,
    hasGlow: true,
    glowColor: 0x818cf8,
    bonusControl: 10,
    visual: {
      type: 'sprite',
      textureKey: 'skin_galaxy',
      particleEffect: {
        texture: 'p_spark', color: [0xffffff, 0xa855f7, 0x6366f1], blendMode: 'ADD',
        speed: 40, scale: { start: 0.5, end: 0 }, lifespan: 800,
        frequency: 30, followVelocity: true, quantity: 3
      }
    }
  },
  {
    id: 'cap_demon',
    name: 'Abyssal Lord',
    rarity: 'legendary',
    price: { stars: 200 },
    primaryColor: 0x581c87,
    secondaryColor: 0x000000,
    hasGlow: true,
    glowColor: 0xd8b4fe,
    bonusPower: 12,
    visual: {
      type: 'sprite',
      textureKey: 'skin_demon',
      particleEffect: {
        texture: 'p_flame', color: [0xa855f7, 0x581c87], blendMode: 'ADD',
        speed: 50, scale: { start: 1.0, end: 0.2 }, lifespan: 900,
        frequency: 20, followVelocity: false, gravityY: -80, quantity: 3
      }
    }
  }
];

// ==================== BALL SKINS ====================

// Замените секцию BALL_SKINS в src/data/SkinsCatalog.ts

export const BALL_SKINS: BallSkinData[] = [
  // ========== BASIC ==========
  {
    id: 'ball_default',
    name: 'Classic Tech',
    rarity: 'basic',
    price: {},
    primaryColor: 0xffffff,
    secondaryColor: 0x000000,
    glowColor: 0x00ffff,
    hasGlow: true,
    hasTrail: false,
    textureKey: 'ball_default'
  },

  // ========== COMMON ==========
  {
    id: 'ball_tennis',
    name: 'Tennis Ball',
    rarity: 'common',
    price: { coins: 1000 },
    primaryColor: 0xbef264,
    secondaryColor: 0x84cc16,
    glowColor: 0xd9f99d,
    hasGlow: false,
    hasTrail: false,
    textureKey: 'ball_tennis'
  },
  {
    id: 'ball_beach',
    name: 'Beach Ball',
    rarity: 'common',
    price: { coins: 1200 },
    primaryColor: 0xffffff,
    secondaryColor: 0xef4444,
    glowColor: 0xffffff,
    hasGlow: false,
    hasTrail: false,
    textureKey: 'ball_beach'
  },

  // ========== RARE ==========
  {
    id: 'ball_golden',
    name: 'Golden Orb',
    rarity: 'rare',
    price: { coins: 3000 },
    primaryColor: 0xfcd34d,
    secondaryColor: 0xb45309,
    glowColor: 0xfcd34d,
    hasGlow: true,
    hasTrail: true,
    trailColor: 0xfcd34d,
    textureKey: 'ball_golden',
    particleEffect: {
      texture: 'p_spark', color: [0xfcd34d], blendMode: 'ADD',
      speed: 20, scale: { start: 0.3, end: 0 }, lifespan: 400,
      frequency: 50, followVelocity: true, quantity: 2
    }
  },
  {
    id: 'ball_disco',
    name: 'Disco Ball',
    rarity: 'rare',
    price: { coins: 3500 },
    primaryColor: 0xc0c0c0,
    secondaryColor: 0x808080,
    glowColor: 0xffffff,
    hasGlow: true,
    hasTrail: true,
    trailColor: 0xffffff,
    textureKey: 'ball_disco',
    particleEffect: {
      texture: 'p_spark', color: [0xffffff, 0xff69b4, 0x00ffff, 0xffd700], blendMode: 'ADD',
      speed: 40, scale: { start: 0.2, end: 0 }, lifespan: 300,
      frequency: 40, followVelocity: false, quantity: 3
    }
  },

  // ========== EPIC ==========
  {
    id: 'ball_plasma',
    name: 'Plasma Core',
    rarity: 'epic',
    price: { stars: 50 },
    primaryColor: 0x818cf8,
    secondaryColor: 0x4f46e5,
    glowColor: 0x818cf8,
    hasGlow: true,
    hasTrail: true,
    trailColor: 0x818cf8,
    textureKey: 'ball_plasma',
    particleEffect: {
      texture: 'p_glow', color: [0x818cf8, 0xc4b5fd], blendMode: 'ADD',
      speed: 30, scale: { start: 0.5, end: 0 }, lifespan: 500,
      frequency: 30, followVelocity: true, quantity: 3
    }
  },
  {
    id: 'ball_meteor',
    name: 'Meteor',
    rarity: 'epic',
    price: { stars: 60 },
    primaryColor: 0xef4444,
    secondaryColor: 0x7f1d1d,
    glowColor: 0xf97316,
    hasGlow: true,
    hasTrail: true,
    trailColor: 0xef4444,
    textureKey: 'ball_meteor',
    particleEffect: {
      texture: 'p_flame', color: [0xef4444, 0xf97316, 0xfbbf24], blendMode: 'ADD',
      speed: 50, scale: { start: 0.8, end: 0 }, lifespan: 400,
      frequency: 20, followVelocity: true, quantity: 4
    }
  },
  {
    id: 'ball_snowball',
    name: 'Snowball',
    rarity: 'epic',
    price: { stars: 55 },
    primaryColor: 0xffffff,
    secondaryColor: 0xbae6fd,
    glowColor: 0xe0f2fe,
    hasGlow: true,
    hasTrail: true,
    trailColor: 0xffffff,
    textureKey: 'ball_snowball',
    particleEffect: {
      texture: 'p_shard', color: [0xffffff, 0xbae6fd], blendMode: 'ADD',
      speed: 25, scale: { start: 0.4, end: 0 }, lifespan: 600,
      frequency: 40, followVelocity: true, quantity: 3
    }
  },
  {
    id: 'ball_electric',
    name: 'Electric Orb',
    rarity: 'epic',
    price: { stars: 65 },
    primaryColor: 0x3b82f6,
    secondaryColor: 0xfbbf24,
    glowColor: 0x60a5fa,
    hasGlow: true,
    hasTrail: true,
    trailColor: 0xfbbf24,
    textureKey: 'ball_electric',
    particleEffect: {
      texture: 'p_spark', color: [0xfbbf24, 0x3b82f6, 0xffffff], blendMode: 'ADD',
      speed: 80, scale: { start: 0.3, end: 0 }, lifespan: 150,
      frequency: 30, followVelocity: false, quantity: 5
    }
  },

  // ========== LEGENDARY ==========
  {
    id: 'ball_inferno',
    name: 'Sun Eater',
    rarity: 'legendary',
    price: { stars: 100 },
    primaryColor: 0xff0000,
    secondaryColor: 0xfacc15,
    glowColor: 0xff4500,
    hasGlow: true,
    hasTrail: true,
    trailColor: 0xff4500,
    textureKey: 'ball_inferno',
    particleEffect: {
      texture: 'p_flame', color: [0xff4500, 0xfacc15, 0xffffff], blendMode: 'ADD',
      speed: 60, scale: { start: 1.0, end: 0 }, lifespan: 500,
      frequency: 15, followVelocity: true, quantity: 5, gravityY: -50
    }
  },
  {
    id: 'ball_blackhole',
    name: 'Black Hole',
    rarity: 'legendary',
    price: { stars: 120 },
    primaryColor: 0x1e1b4b,
    secondaryColor: 0x000000,
    glowColor: 0x7c3aed,
    hasGlow: true,
    hasTrail: true,
    trailColor: 0x7c3aed,
    textureKey: 'ball_blackhole',
    particleEffect: {
      texture: 'p_glow', color: [0x7c3aed, 0x581c87, 0x000000], blendMode: 'ADD',
      speed: 15, scale: { start: 0.8, end: 0.1 }, lifespan: 1000,
      frequency: 25, followVelocity: false, quantity: 4
    }
  },
  {
    id: 'ball_starcore',
    name: 'Star Core',
    rarity: 'legendary',
    price: { stars: 150 },
    primaryColor: 0xffffff,
    secondaryColor: 0xfcd34d,
    glowColor: 0xfef3c7,
    hasGlow: true,
    hasTrail: true,
    trailColor: 0xfcd34d,
    textureKey: 'ball_starcore',
    particleEffect: {
      texture: 'p_spark', color: [0xffffff, 0xfcd34d, 0xfbbf24], blendMode: 'ADD',
      speed: 50, scale: { start: 0.5, end: 0 }, lifespan: 600,
      frequency: 20, followVelocity: false, quantity: 6
    }
  },
  {
    id: 'ball_portal',
    name: 'Portal Sphere',
    rarity: 'legendary',
    price: { stars: 180 },
    primaryColor: 0x06b6d4,
    secondaryColor: 0xd946ef,
    glowColor: 0x22d3ee,
    hasGlow: true,
    hasTrail: true,
    trailColor: 0xd946ef,
    textureKey: 'ball_portal',
    particleEffect: {
      texture: 'p_glow', color: [0x06b6d4, 0xd946ef, 0xffffff], blendMode: 'ADD',
      speed: 40, scale: { start: 0.6, end: 0 }, lifespan: 700,
      frequency: 25, followVelocity: true, quantity: 4
    }
  }
];

// ==================== FIELD SKINS ====================

export const FIELD_SKINS: FieldSkinData[] = [
  // ========== BASIC ==========
  {
    id: 'field_default',
    name: 'Cyber Grid',
    rarity: 'basic',
    price: {},
    fieldColor: 0x0f172a,
    lineColor: 0x0ea5e9,
    borderColor: 0x1e40af,
    goalColor: 0x0ea5e9,
    textureKey: 'tex_field_hex'
  },
  {
    id: 'field_classic',
    name: 'Classic Green',
    rarity: 'basic',
    price: {},
    fieldColor: 0x166534,
    lineColor: 0xffffff,
    borderColor: 0x14532d,
    goalColor: 0xffffff
  },

  // ========== COMMON ==========
  {
    id: 'field_night',
    name: 'Night Arena',
    rarity: 'common',
    price: { coins: 2000 },
    fieldColor: 0x0f0f23,
    lineColor: 0x6366f1,
    borderColor: 0x312e81,
    goalColor: 0x818cf8,
    effects: [{
      type: 'particles',
      particleTexture: 'p_spark',
      particleColors: [0xffffff, 0x818cf8],
      particleCount: 20,
      particleSpeed: 5,
      particleScale: { start: 0.2, end: 0 },
      particleLifespan: 3000
    }]
  },

  // ========== RARE ==========
  {
    id: 'field_lava',
    name: 'Lava Pit',
    rarity: 'rare',
    price: { coins: 4000 },
    fieldColor: 0x1a0a0a,
    lineColor: 0xef4444,
    borderColor: 0x7f1d1d,
    goalColor: 0xf97316,
    effects: [
      {
        type: 'border',
        animatedBorder: true,
        glowColor: 0xef4444,
        glowIntensity: 0.5
      },
      {
        type: 'particles',
        particleTexture: 'p_flame',
        particleColors: [0xef4444, 0xf97316, 0xfbbf24],
        particleCount: 15,
        particleSpeed: 30,
        particleScale: { start: 0.5, end: 0 },
        particleLifespan: 800,
        particleAlpha: { start: 0.8, end: 0 }
      }
    ]
  },
  {
    id: 'field_ice',
    name: 'Ice Rink',
    rarity: 'rare',
    price: { coins: 4500 },
    fieldColor: 0x0c4a6e,
    lineColor: 0xbae6fd,
    borderColor: 0x0369a1,
    goalColor: 0x7dd3fc,
    effects: [
      {
        type: 'ambient',
        ambientGlow: true,
        glowColor: 0xbae6fd,
        glowIntensity: 0.3
      },
      {
        type: 'particles',
        particleTexture: 'p_shard',
        particleColors: [0xffffff, 0xbae6fd, 0xe0f2fe],
        particleCount: 25,
        particleSpeed: 15,
        particleScale: { start: 0.3, end: 0 },
        particleLifespan: 2000
      }
    ]
  },
  {
    id: 'field_jungle',
    name: 'Jungle',
    rarity: 'rare',
    price: { coins: 5000 },
    fieldColor: 0x14532d,
    lineColor: 0x22c55e,
    borderColor: 0x166534,
    goalColor: 0x4ade80,
    effects: [{
      type: 'particles',
      particleTexture: 'p_petal',
      particleColors: [0x22c55e, 0x86efac, 0x365314],
      particleCount: 20,
      particleSpeed: 10,
      particleScale: { start: 0.4, end: 0.1 },
      particleLifespan: 2500
    }]
  },
  {
    id: 'field_desert',
    name: 'Desert Storm',
    rarity: 'rare',
    price: { coins: 4500 },
    fieldColor: 0x78350f,
    lineColor: 0xfcd34d,
    borderColor: 0x92400e,
    goalColor: 0xfbbf24,
    effects: [{
      type: 'particles',
      particleTexture: 'p_smoke',
      particleColors: [0xfcd34d, 0xd97706, 0x92400e],
      particleCount: 30,
      particleSpeed: 25,
      particleScale: { start: 0.6, end: 0.1 },
      particleLifespan: 1500
    }]
  },
  {
    id: 'field_ocean',
    name: 'Ocean Floor',
    rarity: 'rare',
    price: { coins: 5000 },
    fieldColor: 0x0c4a6e,
    lineColor: 0x06b6d4,
    borderColor: 0x155e75,
    goalColor: 0x22d3ee,
    effects: [
      {
        type: 'ambient',
        ambientGlow: true,
        glowColor: 0x06b6d4,
        glowIntensity: 0.2
      },
      {
        type: 'particles',
        particleTexture: 'p_bubble',
        particleColors: [0x67e8f9, 0x06b6d4, 0xffffff],
        particleCount: 30,
        particleSpeed: 20,
        particleScale: { start: 0.4, end: 0.1 },
        particleLifespan: 2000
      }
    ]
  },
  {
    id: 'field_circuit',
    name: 'Mainframe',
    rarity: 'rare',
    price: { coins: 5000 },
    fieldColor: 0x022c22,
    lineColor: 0x22c55e,
    borderColor: 0x15803d,
    goalColor: 0x4ade80,
    textureKey: 'tex_field_circuit',
    effects: [{
      type: 'border',
      animatedBorder: true,
      borderPulse: true,
      glowColor: 0x22c55e,
      glowIntensity: 0.4
    }]
  },

  // ========== EPIC ==========
  {
    id: 'field_thunder',
    name: 'Thunderdome',
    rarity: 'epic',
    price: { stars: 50 },
    fieldColor: 0x1e1b4b,
    lineColor: 0x8b5cf6,
    borderColor: 0x4c1d95,
    goalColor: 0xa78bfa,
    effects: [
      {
        type: 'border',
        animatedBorder: true,
        glowColor: 0x8b5cf6,
        glowIntensity: 0.6
      },
      {
        type: 'particles',
        particleTexture: 'p_spark',
        particleColors: [0xffffff, 0x8b5cf6, 0xfbbf24],
        particleCount: 15,
        particleSpeed: 100,
        particleScale: { start: 0.4, end: 0 },
        particleLifespan: 200
      }
    ]
  },
  {
    id: 'field_neon',
    name: 'Neon City',
    rarity: 'epic',
    price: { stars: 60 },
    fieldColor: 0x0f0f1a,
    lineColor: 0xf472b6,
    borderColor: 0xdb2777,
    goalColor: 0x22d3ee,
    effects: [
      {
        type: 'border',
        animatedBorder: true,
        borderPulse: true,
        glowColor: 0xf472b6,
        glowIntensity: 0.7
      },
      {
        type: 'ambient',
        ambientGlow: true,
        glowColor: 0x22d3ee,
        glowIntensity: 0.2
      }
    ]
  },
  {
    id: 'field_haunted',
    name: 'Haunted',
    rarity: 'epic',
    price: { stars: 70 },
    fieldColor: 0x1a1a2e,
    lineColor: 0x4ade80,
    borderColor: 0x374151,
    goalColor: 0x86efac,
    effects: [
      {
        type: 'ambient',
        ambientGlow: true,
        glowColor: 0x4ade80,
        glowIntensity: 0.15
      },
      {
        type: 'particles',
        particleTexture: 'p_smoke',
        particleColors: [0x4ade80, 0x374151, 0x1f2937],
        particleCount: 20,
        particleSpeed: 8,
        particleScale: { start: 1.0, end: 0.2 },
        particleLifespan: 3000,
        particleAlpha: { start: 0.4, end: 0 }
      }
    ]
  },
  {
    id: 'field_sakura',
    name: 'Sakura Garden',
    rarity: 'epic',
    price: { stars: 65 },
    fieldColor: 0x1a0a10,
    lineColor: 0xfda4af,
    borderColor: 0x9f1239,
    goalColor: 0xfb7185,
    effects: [{
      type: 'particles',
      particleTexture: 'p_petal',
      particleColors: [0xfda4af, 0xfecdd3, 0xffffff, 0xfb7185],
      particleCount: 40,
      particleSpeed: 15,
      particleScale: { start: 0.5, end: 0.1 },
      particleLifespan: 4000
    }]
  },
  {
    id: 'field_void',
    name: 'Void Arena',
    rarity: 'epic',
    price: { stars: 75 },
    fieldColor: 0x020617,
    lineColor: 0xa855f7,
    borderColor: 0x7c3aed,
    goalColor: 0xd8b4fe,
    textureKey: 'tex_field_hex',
    effects: [
      {
        type: 'ambient',
        ambientGlow: true,
        glowColor: 0xa855f7,
        glowIntensity: 0.25
      },
      {
        type: 'particles',
        particleTexture: 'p_glow',
        particleColors: [0xa855f7, 0x7c3aed, 0x581c87],
        particleCount: 25,
        particleSpeed: 10,
        particleScale: { start: 0.6, end: 0 },
        particleLifespan: 2000
      }
    ]
  },

  // ========== LEGENDARY ==========
  {
    id: 'field_blackhole',
    name: 'Black Hole',
    rarity: 'legendary',
    price: { stars: 100 },
    fieldColor: 0x030303,
    lineColor: 0x7c3aed,
    borderColor: 0x581c87,
    goalColor: 0xa855f7,
    effects: [
      {
        type: 'ambient',
        ambientGlow: true,
        glowColor: 0x7c3aed,
        glowIntensity: 0.4
      },
      {
        type: 'particles',
        particleTexture: 'p_glow',
        particleColors: [0x7c3aed, 0xa855f7, 0xffffff],
        particleCount: 50,
        particleSpeed: 5,
        particleScale: { start: 0.3, end: 0.8 },
        particleLifespan: 3000,
        particleAlpha: { start: 0.8, end: 0 }
      }
    ]
  },
  {
    id: 'field_rainbow',
    name: 'Rainbow Road',
    rarity: 'legendary',
    price: { stars: 120 },
    fieldColor: 0x0f0f0f,
    lineColor: 0xffffff,
    borderColor: 0x6366f1,
    goalColor: 0xffffff,
    effects: [
      {
        type: 'border',
        animatedBorder: true,
        borderPulse: true,
        glowColor: 0xf472b6,
        glowIntensity: 0.6
      },
      {
        type: 'particles',
        particleTexture: 'p_glow',
        particleColors: [0xef4444, 0xf97316, 0xfbbf24, 0x22c55e, 0x3b82f6, 0x8b5cf6, 0xec4899],
        particleCount: 35,
        particleSpeed: 20,
        particleScale: { start: 0.4, end: 0 },
        particleLifespan: 1500
      }
    ]
  },
  {
    id: 'field_volcanic',
    name: 'Volcanic',
    rarity: 'legendary',
    price: { stars: 150 },
    fieldColor: 0x1a0505,
    lineColor: 0xef4444,
    borderColor: 0x450a0a,
    goalColor: 0xfbbf24,
    effects: [
      {
        type: 'border',
        animatedBorder: true,
        glowColor: 0xef4444,
        glowIntensity: 0.8
      },
      {
        type: 'particles',
        particleTexture: 'p_flame',
        particleColors: [0xef4444, 0xf97316, 0xfbbf24, 0xffffff],
        particleCount: 40,
        particleSpeed: 50,
        particleScale: { start: 0.8, end: 0 },
        particleLifespan: 1000,
        particleAlpha: { start: 1, end: 0 }
      },
      {
        type: 'particles',
        particleTexture: 'p_spark',
        particleColors: [0xfbbf24, 0xffffff],
        particleCount: 20,
        particleSpeed: 80,
        particleScale: { start: 0.3, end: 0 },
        particleLifespan: 600
      }
    ]
  },
  {
    id: 'field_celestial',
    name: 'Celestial Arena',
    rarity: 'legendary',
    price: { stars: 200 },
    fieldColor: 0x0a0a1a,
    lineColor: 0xfcd34d,
    borderColor: 0xb45309,
    goalColor: 0xfef3c7,
    effects: [
      {
        type: 'ambient',
        ambientGlow: true,
        glowColor: 0xfcd34d,
        glowIntensity: 0.3
      },
      {
        type: 'border',
        animatedBorder: true,
        borderPulse: true,
        glowColor: 0xfcd34d,
        glowIntensity: 0.5
      },
      {
        type: 'particles',
        particleTexture: 'p_spark',
        particleColors: [0xffffff, 0xfcd34d, 0xfef3c7],
        particleCount: 60,
        particleSpeed: 8,
        particleScale: { start: 0.3, end: 0 },
        particleLifespan: 4000
      }
    ]
  }
];

// === HELPERS ===

export function getCapSkin(id: string): CapSkinData | undefined {
  return CAP_SKINS.find(s => s.id === id);
}

export function getBallSkin(id: string): BallSkinData | undefined {
  return BALL_SKINS.find(s => s.id === id);
}

export function getFieldSkin(id: string): FieldSkinData | undefined {
  return FIELD_SKINS.find(s => s.id === id);
}

export function getRarityName(rarity: SkinRarity): string {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

export function formatPrice(price: SkinPrice): string {
  if (price.stars) return `⭐ ${price.stars}`;
  if (price.coins) return `💰 ${price.coins}`;
  return 'Free';
}

export function getRarityColor(rarity: SkinRarity): number {
  const colors: Record<SkinRarity, number> = {
    basic: 0x94a3b8,
    common: 0x22c55e,
    rare: 0x3b82f6,
    epic: 0xa855f7,
    legendary: 0xfacc15
  };
  return colors[rarity];
}

export function getSkinBaseBonus(skin: CapSkinData): RarityBonus {
  const r = RARITY_BONUSES[skin.rarity];
  return {
    power: r.power + (skin.bonusPower || 0),
    speed: r.speed + (skin.bonusSpeed || 0),
    control: r.control + (skin.bonusControl || 0),
    weight: r.weight + (skin.bonusWeight || 0),
  };
}

export function getTotalBonusAtLevel(skin: CapSkinData, level: number): RarityBonus {
  const base = getSkinBaseBonus(skin);
  const add = (level - 1) * BONUS_PER_LEVEL;
  return {
    power: base.power + add,
    speed: base.speed + add,
    control: base.control + add,
    weight: base.weight + add
  };
}

export function getUpgradeCost(skinId: string, currentLevel: number): number {
  const skin = getCapSkin(skinId);
  if (!skin || currentLevel >= MAX_CAP_LEVEL) return 0;
  const baseCost = BASE_UPGRADE_COSTS[currentLevel] || 15000;
  return Math.floor(baseCost * UPGRADE_COST_MULTIPLIER[skin.rarity]);
}