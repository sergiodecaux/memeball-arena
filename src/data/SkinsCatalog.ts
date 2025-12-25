// src/data/SkinsCatalog.ts

import { SkinRarity, SkinVisualConfig, ParticleConfig } from '../types';
import { CapClass } from '../constants/gameConstants';

export interface SkinPrice {
  coins?: number;
  crystals?: number;
}

export interface RarityBonus {
  power: number;
  speed: number;
  control: number;
  weight: number;
}

// === CONSTANTS ===
export const MAX_UPGRADE_LEVEL = 10;
export const UPGRADE_COSTS = [0, 100, 250, 500, 800, 1200, 1800, 2500, 3500, 5000];

export const RARITY_STAT_BONUS: Record<SkinRarity, number> = {
  basic: 0,
  common: 5,
  rare: 10,
  epic: 15,
  legendary: 20,
};

// === DATA INTERFACES ===

export interface CapSkinData {
  id: string;
  name: string;
  role: CapClass;
  rarity: SkinRarity;
  price: SkinPrice;
  description: string;
  
  primaryColor: number;
  secondaryColor: number;
  glowColor?: number;
  hasGlow: boolean;
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

// ✅ ИСПРАВЛЕНО: Добавлен 'organic' в тип style
export type FieldStyle = 'neon' | 'industrial' | 'carbon' | 'organic' | 'generic';

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

  // ✅ ИСПРАВЛЕНО: Используем расширенный тип FieldStyle
  style?: FieldStyle;
  goalFrameColor?: number;
  goalNetColor?: number;
  goalDepthMultiplier?: number;
}

// ==================== CAP SKINS (MEME CHARACTERS) ====================

export const CAP_SKINS: CapSkinData[] = [
  // ========== STARTER MEMES (Free) ==========
  {
    id: 'meme_doge',
    name: 'Doge',
    role: 'balanced',
    rarity: 'basic',
    price: {},
    description: 'Much balance. Very skill. Wow.',
    primaryColor: 0xdeb887,
    secondaryColor: 0xc4a574,
    hasGlow: true,
    glowColor: 0xffd700,
    visual: {
      type: 'image',
      imageKey: 'meme_doge',
      borderColor: 0xffd700,
      borderWidth: 3,
    }
  },
  {
    id: 'meme_gigachad',
    name: 'Gigachad',
    role: 'tank',
    rarity: 'basic',
    price: {},
    description: 'Yes, I defend the goal. We exist.',
    primaryColor: 0x2d2d2d,
    secondaryColor: 0x1a1a1a,
    hasGlow: true,
    glowColor: 0x4a90d9,
    visual: {
      type: 'image',
      imageKey: 'meme_gigachad',
      borderColor: 0x4a90d9,
      borderWidth: 3,
    }
  },

  // ========== UNLOCKABLE MEMES ==========
  {
    id: 'meme_cat',
    name: 'Screaming Cat',
    role: 'sniper',
    rarity: 'rare',
    price: { coins: 2000 },
    description: 'WHAT DO YOU MEAN OFFSIDE?!',
    primaryColor: 0xf5deb3,
    secondaryColor: 0xe8d4a3,
    hasGlow: true,
    glowColor: 0xff6b6b,
    visual: {
      type: 'image',
      imageKey: 'meme_cat',
      borderColor: 0xff6b6b,
      borderWidth: 3,
      particleEffect: {
        texture: 'p_spark',
        color: [0xff6b6b, 0xffffff],
        blendMode: 'ADD',
        speed: 50,
        scale: { start: 0.3, end: 0 },
        lifespan: 300,
        frequency: 100,
        followVelocity: true,
        quantity: 2
      }
    }
  },
  {
    id: 'meme_trollface',
    name: 'Trollface',
    role: 'trickster',
    rarity: 'rare',
    price: { coins: 2000 },
    description: 'Problem? Physics is just a suggestion.',
    primaryColor: 0xffffff,
    secondaryColor: 0xe0e0e0,
    hasGlow: true,
    glowColor: 0x00ff00,
    visual: {
      type: 'image',
      imageKey: 'meme_trollface',
      borderColor: 0x00ff00,
      borderWidth: 3,
    }
  },
  {
    id: 'meme_hamster',
    name: 'Sad Hamster',
    role: 'balanced',
    rarity: 'epic',
    price: { coins: 3000 },
    description: 'Plays with tears in eyes. Still wins.',
    primaryColor: 0x8b7355,
    secondaryColor: 0x6b5344,
    hasGlow: true,
    glowColor: 0xffb7c5,
    visual: {
      type: 'image',
      imageKey: 'meme_hamster',
      borderColor: 0xffc0cb,
      borderWidth: 2,
      particleEffect: {
        texture: 'p_petal',
        color: [0xffb7c5, 0xffc0cb, 0xffd1dc, 0xffe4e9],
        blendMode: 'NORMAL',
        speed: 12,
        scale: { start: 0.35, end: 0.1 },
        lifespan: 2000,
        frequency: 200,
        followVelocity: false,
        quantity: 1,
        gravityY: 15
      }
    }
  },

  // ========== BALANCED ROLE ==========
  {
    id: 'cap_electric',
    name: 'Electric',
    role: 'balanced',
    rarity: 'common',
    price: { coins: 500 },
    description: 'Shockingly average at everything.',
    primaryColor: 0xfbbf24,
    secondaryColor: 0x1e3a8a,
    hasGlow: true,
    glowColor: 0xfde047,
    visual: {
      type: 'sprite',
      textureKey: 'skin_electric',
      particleEffect: {
        texture: 'p_spark',
        color: [0xfde047, 0x3b82f6, 0xffffff],
        blendMode: 'ADD',
        speed: 60,
        scale: { start: 0.4, end: 0 },
        lifespan: 150,
        frequency: 50,
        followVelocity: false,
        quantity: 3
      }
    }
  },
  {
    id: 'cap_aqua',
    name: 'Aqua Marine',
    role: 'balanced',
    rarity: 'common',
    price: { coins: 500 },
    description: 'Goes with the flow.',
    primaryColor: 0x06b6d4,
    secondaryColor: 0x0e7490,
    hasGlow: true,
    glowColor: 0x22d3ee,
    visual: {
      type: 'sprite',
      textureKey: 'skin_aqua',
      particleEffect: {
        texture: 'p_bubble',
        color: [0x67e8f9, 0x06b6d4],
        blendMode: 'NORMAL',
        speed: 20,
        scale: { start: 0.5, end: 0.1 },
        lifespan: 1000,
        frequency: 100,
        followVelocity: false,
        quantity: 2,
        gravityY: -30
      }
    }
  },
  {
    id: 'cap_hologram',
    name: 'Holographic',
    role: 'balanced',
    rarity: 'common',
    price: { coins: 1000 },
    description: 'Is this even real?',
    primaryColor: 0x818cf8,
    secondaryColor: 0x34d399,
    hasGlow: true,
    glowColor: 0xc4b5fd,
    visual: {
      type: 'sprite',
      textureKey: 'skin_hologram',
      particleEffect: {
        texture: 'p_glow',
        color: [0x818cf8, 0x34d399, 0xfbbf24, 0xf472b6],
        blendMode: 'ADD',
        speed: 15,
        scale: { start: 0.3, end: 0 },
        lifespan: 600,
        frequency: 100,
        followVelocity: true,
        quantity: 1
      }
    }
  },
  {
    id: 'cap_nature',
    name: 'Nature Spirit',
    role: 'balanced',
    rarity: 'rare',
    price: { coins: 2000 },
    description: 'One with the grass. Literally.',
    primaryColor: 0x22c55e,
    secondaryColor: 0x854d0e,
    hasGlow: true,
    glowColor: 0x86efac,
    visual: {
      type: 'sprite',
      textureKey: 'skin_nature',
      particleEffect: {
        texture: 'p_petal',
        color: [0x22c55e, 0x86efac, 0x365314],
        blendMode: 'NORMAL',
        speed: 20,
        scale: { start: 0.5, end: 0.1 },
        lifespan: 1200,
        frequency: 60,
        followVelocity: false,
        quantity: 3,
        gravityY: 15
      }
    }
  },

  // ========== TANK ROLE ==========
  {
    id: 'cap_frost_king',
    name: 'Frost King',
    role: 'tank',
    rarity: 'rare',
    price: { coins: 1500 },
    description: 'Cold as ice. Immovable as glacier.',
    primaryColor: 0x0ea5e9,
    secondaryColor: 0xffffff,
    hasGlow: true,
    glowColor: 0xbae6fd,
    visual: {
      type: 'sprite',
      textureKey: 'skin_frost_king',
      particleEffect: {
        texture: 'p_shard',
        color: [0xffffff, 0xbae6fd, 0x0ea5e9],
        blendMode: 'ADD',
        speed: 35,
        scale: { start: 0.6, end: 0 },
        lifespan: 800,
        frequency: 40,
        followVelocity: false,
        quantity: 4
      }
    }
  },
  {
    id: 'cap_magma',
    name: 'Magma Core',
    role: 'tank',
    rarity: 'rare',
    price: { coins: 2500 },
    description: 'Heavy as lava. Hot tempered.',
    primaryColor: 0xff4500,
    secondaryColor: 0x7f1d1d,
    hasGlow: true,
    glowColor: 0xff6347,
    visual: {
      type: 'sprite',
      textureKey: 'skin_magma',
      particleEffect: {
        texture: 'p_smoke',
        color: [0xff4500, 0x000000],
        blendMode: 'ADD',
        speed: 30,
        scale: { start: 0.7, end: 0 },
        lifespan: 700,
        frequency: 50,
        followVelocity: true,
        quantity: 2
      }
    }
  },
  {
    id: 'cap_dragon',
    name: 'Emerald Dragon',
    role: 'tank',
    rarity: 'rare',
    price: { coins: 3000 },
    description: 'Ancient guardian of the goal.',
    primaryColor: 0x10b981,
    secondaryColor: 0x064e3b,
    hasGlow: true,
    glowColor: 0x34d399,
    visual: {
      type: 'sprite',
      textureKey: 'skin_dragon',
      particleEffect: {
        texture: 'p_flame',
        color: [0x34d399, 0x059669, 0x10b981],
        blendMode: 'ADD',
        speed: 25,
        scale: { start: 0.8, end: 0 },
        lifespan: 800,
        frequency: 60,
        followVelocity: true,
        quantity: 2
      }
    }
  },
  {
    id: 'cap_divine',
    name: 'Divine Angel',
    role: 'tank',
    rarity: 'epic',
    price: { coins: 5000 },
    description: 'Heaven-sent goalkeeper.',
    primaryColor: 0xffffff,
    secondaryColor: 0xfcd34d,
    hasGlow: true,
    glowColor: 0xfef3c7,
    visual: {
      type: 'sprite',
      textureKey: 'skin_divine',
      particleEffect: {
        texture: 'p_glow',
        color: [0xffffff, 0xfcd34d, 0xfef3c7],
        blendMode: 'ADD',
        speed: 20,
        scale: { start: 0.6, end: 0 },
        lifespan: 1200,
        frequency: 40,
        followVelocity: false,
        quantity: 3,
        gravityY: -20
      }
    }
  },

  // ========== SNIPER ROLE ==========
  {
    id: 'cap_ice',
    name: 'Glacial',
    role: 'sniper',
    rarity: 'common',
    price: { coins: 1000 },
    description: 'Precision cold as ice.',
    primaryColor: 0x0ea5e9,
    secondaryColor: 0x0284c7,
    hasGlow: true,
    glowColor: 0x7dd3fc,
    visual: {
      type: 'sprite',
      textureKey: 'skin_ice',
      particleEffect: {
        texture: 'p_shard',
        color: [0xe0f2fe, 0x0ea5e9, 0xffffff],
        blendMode: 'ADD',
        speed: 25,
        scale: { start: 0.4, end: 0 },
        lifespan: 500,
        frequency: 100,
        followVelocity: true,
        quantity: 2
      }
    }
  },
  {
    id: 'cap_phoenix',
    name: 'Phoenix',
    role: 'sniper',
    rarity: 'rare',
    price: { coins: 1500 },
    description: 'One shot, one goal. Reborn from ashes.',
    primaryColor: 0xef4444,
    secondaryColor: 0xfbbf24,
    hasGlow: true,
    glowColor: 0xf97316,
    visual: {
      type: 'sprite',
      textureKey: 'skin_phoenix',
      particleEffect: {
        texture: 'p_flame',
        color: [0xef4444, 0xfbbf24, 0xffffff],
        blendMode: 'ADD',
        speed: 40,
        scale: { start: 0.8, end: 0 },
        lifespan: 600,
        frequency: 30,
        followVelocity: false,
        quantity: 3,
        gravityY: -60
      }
    }
  },
  {
    id: 'cap_thunder',
    name: 'Thunder God',
    role: 'sniper',
    rarity: 'rare',
    price: { coins: 2000 },
    description: 'Strikes like lightning.',
    primaryColor: 0x3b82f6,
    secondaryColor: 0xfbbf24,
    hasGlow: true,
    glowColor: 0x60a5fa,
    visual: {
      type: 'sprite',
      textureKey: 'skin_thunder',
      particleEffect: {
        texture: 'p_spark',
        color: [0xfde047, 0x3b82f6, 0xffffff],
        blendMode: 'ADD',
        speed: 80,
        scale: { start: 0.5, end: 0 },
        lifespan: 100,
        frequency: 30,
        followVelocity: false,
        quantity: 5
      }
    }
  },
  {
    id: 'cap_celestial',
    name: 'Celestial',
    role: 'sniper',
    rarity: 'epic',
    price: { coins: 4000 },
    description: 'Guided by the stars.',
    primaryColor: 0x1e3a8a,
    secondaryColor: 0xfbbf24,
    hasGlow: true,
    glowColor: 0x3b82f6,
    visual: {
      type: 'sprite',
      textureKey: 'skin_celestial',
      particleEffect: {
        texture: 'p_spark',
        color: [0xffffff, 0xfbbf24, 0x3b82f6],
        blendMode: 'ADD',
        speed: 30,
        scale: { start: 0.4, end: 0 },
        lifespan: 1500,
        frequency: 40,
        followVelocity: false,
        quantity: 4
      }
    }
  },
  {
    id: 'cap_quantum',
    name: 'Quantum',
    role: 'sniper',
    rarity: 'epic',
    price: { coins: 6000 },
    description: 'The ball is already in the goal. Probably.',
    primaryColor: 0x06b6d4,
    secondaryColor: 0xd946ef,
    hasGlow: true,
    glowColor: 0x67e8f9,
    visual: {
      type: 'sprite',
      textureKey: 'skin_quantum',
      particleEffect: {
        texture: 'p_spark',
        color: [0x06b6d4, 0xd946ef, 0xffffff, 0x000000],
        blendMode: 'ADD',
        speed: 100,
        scale: { start: 0.3, end: 0 },
        lifespan: 200,
        frequency: 20,
        followVelocity: false,
        quantity: 6
      }
    }
  },

  // ========== TRICKSTER ROLE ==========
  {
    id: 'cap_shadow',
    name: 'Shadow',
    role: 'trickster',
    rarity: 'common',
    price: { coins: 800 },
    description: 'Now you see me, now you dont.',
    primaryColor: 0x1f2937,
    secondaryColor: 0x111827,
    hasGlow: true,
    glowColor: 0x6b7280,
    visual: {
      type: 'sprite',
      textureKey: 'skin_shadow',
      particleEffect: {
        texture: 'p_smoke',
        color: [0x374151, 0x1f2937, 0x000000],
        blendMode: 'NORMAL',
        speed: 10,
        scale: { start: 0.8, end: 0 },
        lifespan: 800,
        frequency: 60,
        followVelocity: true,
        quantity: 2
      }
    }
  },
  {
    id: 'cap_toxic',
    name: 'Bio Hazard',
    role: 'trickster',
    rarity: 'common',
    price: { coins: 1000 },
    description: 'Toxic gameplay. Literally.',
    primaryColor: 0x22c55e,
    secondaryColor: 0x14532d,
    hasGlow: true,
    glowColor: 0x4ade80,
    visual: {
      type: 'sprite',
      textureKey: 'skin_toxic',
      particleEffect: {
        texture: 'p_bubble',
        color: [0x4ade80, 0x22c55e],
        blendMode: 'NORMAL',
        speed: 15,
        scale: { start: 0.5, end: 0 },
        lifespan: 800,
        frequency: 80,
        followVelocity: true,
        quantity: 2
      }
    }
  },
  {
    id: 'cap_void',
    name: 'Void Walker',
    role: 'trickster',
    rarity: 'rare',
    price: { coins: 2000 },
    description: 'Bends space around the ball.',
    primaryColor: 0x581c87,
    secondaryColor: 0x0f0f0f,
    hasGlow: true,
    glowColor: 0x7c3aed,
    visual: {
      type: 'sprite',
      textureKey: 'skin_void',
      particleEffect: {
        texture: 'p_glow',
        color: [0x581c87, 0x7c3aed, 0x000000],
        blendMode: 'ADD',
        speed: 20,
        scale: { start: 1.0, end: 0 },
        lifespan: 1000,
        frequency: 50,
        followVelocity: true,
        quantity: 2
      }
    }
  },
  {
    id: 'cap_rainbow',
    name: 'Rainbow Prism',
    role: 'trickster',
    rarity: 'epic',
    price: { coins: 5000 },
    description: 'Physics? More like physics-ish.',
    primaryColor: 0xffffff,
    secondaryColor: 0x6366f1,
    hasGlow: true,
    glowColor: 0xf472b6,
    visual: {
      type: 'sprite',
      textureKey: 'skin_rainbow',
      particleEffect: {
        texture: 'p_glow',
        color: [0xef4444, 0xf97316, 0xfbbf24, 0x22c55e, 0x3b82f6, 0x8b5cf6, 0xec4899],
        blendMode: 'ADD',
        speed: 25,
        scale: { start: 0.5, end: 0 },
        lifespan: 800,
        frequency: 30,
        followVelocity: true,
        quantity: 3
      }
    }
  },
  {
    id: 'cap_galaxy',
    name: 'Stardust',
    role: 'trickster',
    rarity: 'epic',
    price: { coins: 6000 },
    description: 'Curves like a spiral galaxy.',
    primaryColor: 0x6366f1,
    secondaryColor: 0x0f172a,
    hasGlow: true,
    glowColor: 0x818cf8,
    visual: {
      type: 'sprite',
      textureKey: 'skin_galaxy',
      particleEffect: {
        texture: 'p_spark',
        color: [0xffffff, 0xa855f7, 0x6366f1],
        blendMode: 'ADD',
        speed: 40,
        scale: { start: 0.5, end: 0 },
        lifespan: 800,
        frequency: 30,
        followVelocity: true,
        quantity: 3
      }
    }
  },

  // ========== LEGENDARY (All roles) ==========
  {
    id: 'cap_infernal',
    name: 'Infernal Demon',
    role: 'sniper',
    rarity: 'legendary',
    price: { coins: 8000 },
    description: 'Straight from hell. One shot, one soul.',
    primaryColor: 0x7f1d1d,
    secondaryColor: 0x000000,
    hasGlow: true,
    glowColor: 0xef4444,
    visual: {
      type: 'sprite',
      textureKey: 'skin_infernal',
      particleEffect: {
        texture: 'p_flame',
        color: [0xef4444, 0x7f1d1d, 0x000000, 0xfbbf24],
        blendMode: 'ADD',
        speed: 50,
        scale: { start: 1.0, end: 0.2 },
        lifespan: 900,
        frequency: 20,
        followVelocity: false,
        quantity: 4,
        gravityY: -80
      }
    }
  },
  {
    id: 'cap_demon',
    name: 'Abyssal Lord',
    role: 'trickster',
    rarity: 'legendary',
    price: { coins: 8000 },
    description: 'Reality bends to his will.',
    primaryColor: 0x581c87,
    secondaryColor: 0x000000,
    hasGlow: true,
    glowColor: 0xd8b4fe,
    visual: {
      type: 'sprite',
      textureKey: 'skin_demon',
      particleEffect: {
        texture: 'p_flame',
        color: [0xa855f7, 0x581c87],
        blendMode: 'ADD',
        speed: 50,
        scale: { start: 1.0, end: 0.2 },
        lifespan: 900,
        frequency: 20,
        followVelocity: false,
        gravityY: -80,
        quantity: 3
      }
    }
  },
  {
    id: 'cap_sakura',
    name: 'Cherry Blossom',
    role: 'balanced',
    rarity: 'legendary',
    price: { coins: 8000 },
    description: 'Grace in every move.',
    primaryColor: 0xfda4af,
    secondaryColor: 0xfb7185,
    hasGlow: true,
    glowColor: 0xfecdd3,
    visual: {
      type: 'sprite',
      textureKey: 'skin_sakura',
      particleEffect: {
        texture: 'p_petal',
        color: [0xfda4af, 0xfecdd3, 0xffffff],
        blendMode: 'NORMAL',
        speed: 25,
        scale: { start: 0.4, end: 0.1 },
        lifespan: 1500,
        frequency: 80,
        followVelocity: false,
        quantity: 2,
        gravityY: 20
      }
    }
  },
];

// ==================== BALL SKINS ====================
//
// УБРАЛИ ВСЕ СТАРЫЕ МЯЧИ, ЗАМЕНИЛИ НА 3 НОВЫХ ОРБА С PNG.
//

export const BALL_SKINS: BallSkinData[] = [
  {
    id: 'ball_plasma',
    name: 'Plasma Orb',
    rarity: 'basic',
    price: {},
    primaryColor: 0xffffff,
    secondaryColor: 0x00fff5,
    glowColor: 0x00fff5,
    hasGlow: true,
    hasTrail: true,
    trailColor: 0x00fff5,
    textureKey: 'ball_plasma',
    particleEffect: {
      texture: 'p_glow',
      color: [0x00fff5, 0x88ffff, 0xffffff],
      blendMode: 'ADD',
      speed: 30,
      scale: { start: 0.5, end: 0 },
      lifespan: 400,
      frequency: 40,
      followVelocity: true,
      quantity: 2
    }
  },
  {
    id: 'ball_core',
    name: 'Energy Core',
    rarity: 'rare',
    price: { coins: 5000 },
    primaryColor: 0xffdd00,
    secondaryColor: 0xff6600,
    glowColor: 0xff8800,
    hasGlow: true,
    hasTrail: true,
    trailColor: 0xff6600,
    textureKey: 'ball_core',
    particleEffect: {
      texture: 'p_flame',
      color: [0xff6600, 0xff8800, 0xffaa00],
      blendMode: 'ADD',
      speed: 40,
      scale: { start: 0.8, end: 0 },
      lifespan: 350,
      frequency: 25,
      followVelocity: true,
      quantity: 3
    }
  },
  {
    id: 'ball_quantum',
    name: 'Quantum Sphere',
    rarity: 'epic',
    price: { coins: 12000 },
    primaryColor: 0x00ff00,
    secondaryColor: 0x88ff44,
    glowColor: 0x00ff88,
    hasGlow: true,
    hasTrail: true,
    trailColor: 0x00ff00,
    textureKey: 'ball_quantum',
    particleEffect: {
      texture: 'p_glow',
      color: [0x00ff00, 0x44ff44, 0x88ff88],
      blendMode: 'ADD',
      speed: 35,
      scale: { start: 0.6, end: 0 },
      lifespan: 450,
      frequency: 30,
      followVelocity: true,
      quantity: 3
    }
  },
];

// ==================== FIELD SKINS ====================

export const FIELD_SKINS: FieldSkinData[] = [
  {
    id: 'field_default',
    name: 'Neon Cyber',
    rarity: 'basic',
    price: {},
    style: 'neon',
    fieldColor: 0x05080a,
    lineColor: 0x00f3ff,
    borderColor: 0x00f3ff,
    goalColor: 0x00f3ff,
    goalFrameColor: 0x00f3ff,
    goalNetColor: 0x00f3ff,
    goalDepthMultiplier: 1.0,
    textureKey: 'tex_field_circuit',
    effects: [
      {
        type: 'border',
        animatedBorder: true,
        borderPulse: true,
        glowColor: 0x00f3ff,
        glowIntensity: 0.8
      },
      {
        type: 'ambient',
        ambientGlow: true,
        glowColor: 0x00f3ff,
        glowIntensity: 0.25
      },
      {
        type: 'particles',
        particleTexture: 'p_glow',
        particleColors: [0x00f3ff, 0xffffff],
        particleCount: 18,
        particleSpeed: 12,
        particleScale: { start: 0.35, end: 0 },
        particleLifespan: 2200
      }
    ]
  },
  {
    id: 'field_industrial',
    name: 'Industrial Zone',
    rarity: 'rare',
    price: { coins: 2000 },
    style: 'industrial',
    fieldColor: 0x202020,
    lineColor: 0xffcc00,
    borderColor: 0x333333,
    goalColor: 0xffcc00,
    goalFrameColor: 0xffcc00,
    goalNetColor: 0x888888,
    goalDepthMultiplier: 1.0,
    textureKey: 'tex_field_industrial',
    effects: [
      {
        type: 'border',
        animatedBorder: false,
        borderPulse: false,
        glowColor: 0xffcc00,
        glowIntensity: 0.4
      },
      {
        type: 'ambient',
        ambientGlow: true,
        glowColor: 0xffcc00,
        glowIntensity: 0.15
      },
      {
        type: 'particles',
        particleTexture: 'p_spark',
        particleColors: [0xffcc00, 0xffffff],
        particleCount: 14,
        particleSpeed: 18,
        particleScale: { start: 0.3, end: 0 },
        particleLifespan: 1800
      }
    ]
  },
  {
    id: 'field_elite_carbon',
    name: 'Elite Carbon',
    rarity: 'epic',
    price: { coins: 4000 },
    style: 'carbon',
    fieldColor: 0x151515,
    lineColor: 0xb3b3b3,
    borderColor: 0x404040,
    goalColor: 0xffffff,
    goalFrameColor: 0xffffff,
    goalNetColor: 0xffffff,
    goalDepthMultiplier: 1.1,
    textureKey: 'tex_field_carbon',
    effects: [
      {
        type: 'border',
        animatedBorder: true,
        borderPulse: false,
        glowColor: 0xffffff,
        glowIntensity: 0.35
      },
      {
        type: 'ambient',
        ambientGlow: true,
        glowColor: 0xff0040,
        glowIntensity: 0.2
      }
    ]
  }
];

// ---- АЛИАСЫ СТАРЫХ ПОЛЕЙ НА НОВЫЕ 3 СТИЛЯ ----
export const FIELD_SKIN_ALIASES: Record<string, string> = {
  field_default: 'field_default',
  field_classic: 'field_default',
  field_night: 'field_default',
  field_neon: 'field_default',
  field_void: 'field_default',
  field_rainbow: 'field_default',
  field_lava: 'field_industrial',
  field_ice: 'field_industrial',
  field_sakura: 'field_elite_carbon',
  field_celestial: 'field_elite_carbon',
};

export function resolveFieldSkinId(id: string): string {
  return FIELD_SKIN_ALIASES[id] || id;
}

// === HELPER FUNCTIONS ===

export function getCapSkin(id: string): CapSkinData | undefined {
  return CAP_SKINS.find(s => s.id === id);
}

export function getBallSkin(id: string): BallSkinData | undefined {
  return BALL_SKINS.find(s => s.id === id);
}

export function getFieldSkin(id: string): FieldSkinData | undefined {
  const mappedId = resolveFieldSkinId(id);
  return FIELD_SKINS.find(s => s.id === mappedId);
}

export function getCapsByRole(role: CapClass): CapSkinData[] {
  return CAP_SKINS.filter(s => s.role === role);
}

export function getRarityName(rarity: SkinRarity): string {
  return rarity.charAt(0).toUpperCase() + rarity.slice(1);
}

export function formatPrice(price: SkinPrice): string {
  if (price.crystals) return `💎 ${price.crystals}`;
  if (price.coins) return `🪙 ${price.coins}`;
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

export function getRoleIcon(role: CapClass): string {
  const icons: Record<CapClass, string> = {
    balanced: '⚖️',
    tank: '🛡️',
    sniper: '🎯',
    trickster: '🌀'
  };
  return icons[role];
}

export function getRoleName(role: CapClass): string {
  const names: Record<CapClass, string> = {
    balanced: 'Balanced',
    tank: 'Tank',
    sniper: 'Sniper',
    trickster: 'Trickster'
  };
  return names[role];
}

export function getRoleColor(role: CapClass): number {
  const colors: Record<CapClass, number> = {
    balanced: 0x22c55e,
    tank: 0x3b82f6,
    sniper: 0xef4444,
    trickster: 0xa855f7
  };
  return colors[role];
}

export function getUpgradeCost(currentLevel: number): number {
  if (currentLevel >= MAX_UPGRADE_LEVEL) return 0;
  return UPGRADE_COSTS[currentLevel] || 5000;
}