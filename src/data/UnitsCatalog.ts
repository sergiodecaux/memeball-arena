// src/data/UnitsCatalog.ts

import { FactionId, CapClass } from '../constants/gameConstants';

export type SkinRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface SkinPrice {
  coins?: number;
  crystals?: number;
}

/** Юнит в каталоге */
export interface UnitData {
  id: string;
  factionId: FactionId;
  name: string;
  capClass: CapClass;
  rarity: SkinRarity;
  isStarter: boolean;
  price: SkinPrice;
  assetKey: string;
  assetPath: string;
  description?: string;
}

/** Юниты всех фракций (4 фракции × 4 юнита = 16) */
export const UNITS_CATALOG: UnitData[] = [
  // ==================== MAGMA BRUTES ====================
  {
    id: 'magma_grunt',
    factionId: 'magma',
    name: 'Magma Grunt',
    capClass: 'balanced',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'magma_grunt',
    assetPath: 'assets/sprites/factions/magma/grunt.png',
    description: 'Balanced heavy unit',
  },
  {
    id: 'magma_titan',
    factionId: 'magma',
    name: 'Magma Titan',
    capClass: 'tank',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'magma_titan',
    assetPath: 'assets/sprites/factions/magma/titan.png',
    description: 'Super heavy defensive wall',
  },
  {
    id: 'magma_scout',
    factionId: 'magma',
    name: 'Magma Scout',
    capClass: 'sniper',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'magma_scout',
    assetPath: 'assets/sprites/factions/magma/scout.png',
    description: 'Long-range power shooter',
  },
  {
    id: 'magma_inferno',
    factionId: 'magma',
    name: 'Inferno Lord',
    capClass: 'trickster',
    rarity: 'rare',
    isStarter: false,
    price: { coins: 2500 },
    assetKey: 'magma_inferno',
    assetPath: 'assets/sprites/factions/magma/inferno.png',
    description: 'Elite fire controller',
  },

  // ==================== TERRAN CYBORGS ====================
  {
    id: 'cyborg_soldier',
    factionId: 'cyborg',
    name: 'Cyborg Soldier',
    capClass: 'balanced',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'cyborg_soldier',
    assetPath: 'assets/sprites/factions/cyborg/soldier.png',
    description: 'Standard balanced unit',
  },
  {
    id: 'cyborg_mech',
    factionId: 'cyborg',
    name: 'Assault Mech',
    capClass: 'tank',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'cyborg_mech',
    assetPath: 'assets/sprites/factions/cyborg/mech.png',
    description: 'Armored defender',
  },
  {
    id: 'cyborg_drone',
    factionId: 'cyborg',
    name: 'Sniper Drone',
    capClass: 'sniper',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'cyborg_drone',
    assetPath: 'assets/sprites/factions/cyborg/drone.png',
    description: 'Precision targeting system',
  },
  {
    id: 'cyborg_glitch',
    factionId: 'cyborg',
    name: 'Glitch Operative',
    capClass: 'trickster',
    rarity: 'rare',
    isStarter: false,
    price: { coins: 2500 },
    assetKey: 'cyborg_glitch',
    assetPath: 'assets/sprites/factions/cyborg/glitch.png',
    description: 'Unpredictable hacker',
  },

  // ==================== VOID WALKERS ====================
  {
    id: 'void_initiate',
    factionId: 'void',
    name: 'Void Initiate',
    capClass: 'balanced',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'void_initiate',
    assetPath: 'assets/sprites/factions/void/initiate.png',
    description: 'Balanced void entity',
  },
  {
    id: 'void_guardian',
    factionId: 'void',
    name: 'Void Guardian',
    capClass: 'tank',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'void_guardian',
    assetPath: 'assets/sprites/factions/void/guardian.png',
    description: 'Phase-shifting defender',
  },
  {
    id: 'void_sniper',
    factionId: 'void',
    name: 'Void Sniper',
    capClass: 'sniper',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'void_sniper',
    assetPath: 'assets/sprites/factions/void/sniper.png',
    description: 'Telekinetic marksman',
  },
  {
    id: 'void_bender',
    factionId: 'void',
    name: 'Reality Bender',
    capClass: 'trickster',
    rarity: 'rare',
    isStarter: false,
    price: { coins: 2500 },
    assetKey: 'void_bender',
    assetPath: 'assets/sprites/factions/void/bender.png',
    description: 'Master of curved shots',
  },

  // ==================== XENO SWARM ====================
  {
    id: 'insect_drone',
    factionId: 'insect',
    name: 'Swarm Drone',
    capClass: 'balanced',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'insect_drone',
    assetPath: 'assets/sprites/factions/insect/drone.png',
    description: 'Fast balanced bug',
  },
  {
    id: 'insect_brood',
    factionId: 'insect',
    name: 'Brood Tank',
    capClass: 'tank',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'insect_brood',
    assetPath: 'assets/sprites/factions/insect/brood.png',
    description: 'Chitinous armor',
  },
  {
    id: 'insect_spitter',
    factionId: 'insect',
    name: 'Acid Spitter',
    capClass: 'sniper',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'insect_spitter',
    assetPath: 'assets/sprites/factions/insect/spitter.png',
    description: 'Long-range acid shots',
  },
  {
    id: 'insect_mimic',
    factionId: 'insect',
    name: 'Hive Mimic',
    capClass: 'trickster',
    rarity: 'rare',
    isStarter: false,
    price: { coins: 2500 },
    assetKey: 'insect_mimic',
    assetPath: 'assets/sprites/factions/insect/mimic.png',
    description: 'Adaptive trickster',
  },
];

/** Получить юнита по ID */
export function getUnit(unitId: string): UnitData | undefined {
  return UNITS_CATALOG.find((u) => u.id === unitId);
}

/** Получить всех юнитов фракции */
export function getUnitsByFaction(factionId: FactionId): UnitData[] {
  return UNITS_CATALOG.filter((u) => u.factionId === factionId);
}

/** Получить стартовых юнитов фракции */
export function getStarterUnits(factionId: FactionId): UnitData[] {
  return UNITS_CATALOG.filter((u) => u.factionId === factionId && u.isStarter);
}

/** Получить цвет редкости */
export function getRarityColor(rarity: SkinRarity): number {
  switch (rarity) {
    case 'common':
      return 0x9ca3af;
    case 'rare':
      return 0x3b82f6;
    case 'epic':
      return 0xa855f7;
    case 'legendary':
      return 0xf59e0b;
    default:
      return 0x9ca3af;
  }
}

/** Получить имя редкости */
export function getRarityName(rarity: SkinRarity): string {
  switch (rarity) {
    case 'common':
      return 'Common';
    case 'rare':
      return 'Rare';
    case 'epic':
      return 'Epic';
    case 'legendary':
      return 'Legendary';
    default:
      return 'Common';
  }
}

/** Получить цвет класса */
export function getClassColor(capClass: CapClass): number {
  switch (capClass) {
    case 'balanced':
      return 0x3b82f6;
    case 'tank':
      return 0x22c55e;
    case 'sniper':
      return 0xf59e0b;
    case 'trickster':
      return 0xa855f7;
    default:
      return 0x9ca3af;
  }
}

/** Получить иконку класса */
export function getClassIcon(capClass: CapClass): string {
  switch (capClass) {
    case 'balanced':
      return '⚖️';
    case 'tank':
      return '🛡️';
    case 'sniper':
      return '🎯';
    case 'trickster':
      return '✨';
    default:
      return '❓';
  }
}

/** Получить имя класса */
export function getClassName(capClass: CapClass): string {
  switch (capClass) {
    case 'balanced':
      return 'Balanced';
    case 'tank':
      return 'Tank';
    case 'sniper':
      return 'Sniper';
    case 'trickster':
      return 'Trickster';
    default:
      return 'Unknown';
  }
}

/** Форматировать цену */
export function formatPrice(price: SkinPrice): string {
  if (price.crystals) return `💎 ${price.crystals}`;
  if (price.coins) return `💰 ${price.coins}`;
  return 'FREE';
}

/** Стоимость прокачки параметра (1-10) */
export const MAX_UPGRADE_LEVEL = 10;

export function getUpgradeCost(currentLevel: number): number {
  if (currentLevel >= MAX_UPGRADE_LEVEL) return 0;
  return 100 + currentLevel * 50;
}