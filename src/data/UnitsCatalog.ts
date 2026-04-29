// src/data/UnitsCatalog.ts

import { FactionId, CapClass } from '../constants/gameConstants';
import { UNITS_REPOSITORY, getUnitById as getUnitFromRepository } from './UnitsRepository';

export type SkinRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface SkinPrice {
  coins?: number;
  crystals?: number;
}

export interface UnitData {
  id: string;
  factionId: FactionId;
  name: string;
  title: string;
  capClass: CapClass;
  rarity: SkinRarity;
  isStarter: boolean;
  price: SkinPrice;
  assetKey: string;
  assetPath: string;
  description: string;
  stats: { power: number; defense: number; speed: number; technique: number };
  specialAbility?: string;
}

export const UNITS_CATALOG: UnitData[] = [
  // ═══════════════════════════════════════════════════════════════
  // MAGMA
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'magma_grunt',
    factionId: 'magma',
    name: 'Magma Grunt',
    title: 'Rookie Brawler',
    capClass: 'balanced',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'magma_grunt',
    assetPath: 'assets/units/magma/magma_ember_fang.png',
    description: 'Пехота Вулкана. Они верят, что лучший пас — это тот, который сбивает противника с ног.',
    stats: { power: 2, defense: 2, speed: 2, technique: 2 },
    specialAbility: undefined,
  },
  // Magma Tank
  {
    id: 'magma_titan',
    factionId: 'magma',
    name: 'Magma Titan',
    title: 'Rookie Defender',
    capClass: 'tank',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'magma_titan',
    assetPath: 'assets/units/magma/magma_obsidian_hulk.png',
    description: 'Тяжёлый защитник. Медленный, но его сложно сдвинуть с места.',
    stats: { power: 2, defense: 3, speed: 1, technique: 1 },
    specialAbility: undefined,
  },
  // Magma Sniper
  {
    id: 'magma_scout',
    factionId: 'magma',
    name: 'Magma Scout',
    title: 'Rookie Striker',
    capClass: 'sniper',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'magma_scout',
    assetPath: 'assets/units/magma/magma_embershot.png',
    description: 'Точный стрелок. Бьёт издалека, но хрупкий.',
    stats: { power: 3, defense: 1, speed: 2, technique: 2 },
    specialAbility: undefined,
  },
  // Magma Trickster
  {
    id: 'magma_inferno',
    factionId: 'magma',
    name: 'Magma Inferno',
    title: 'Rookie Trickster',
    capClass: 'trickster',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'magma_inferno',
    assetPath: 'assets/units/magma/magma_hellion.png',
    description: 'Непредсказуемый игрок. Может закручивать удары.',
    stats: { power: 2, defense: 1, speed: 2, technique: 3 },
    specialAbility: undefined,
  },

  // ═══════════════════════════════════════════════════════════════
  // CYBORG
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'cyborg_soldier',
    factionId: 'cyborg',
    name: 'Cyborg Soldier',
    title: 'Rookie Soldier',
    capClass: 'balanced',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'cyborg_soldier',
    assetPath: '/assets/sprites/factions/cyborg/soldier.png',
    description: 'Стандартный модуль Лиги. Эмоции отключены для повышения точности пасов.',
    stats: { power: 2, defense: 2, speed: 2, technique: 2 },
    specialAbility: undefined,
  },
  // Cyborg Tank
  {
    id: 'cyborg_mech',
    factionId: 'cyborg',
    name: 'Cyborg Mech',
    title: 'Rookie Defender',
    capClass: 'tank',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'cyborg_mech',
    assetPath: '/assets/sprites/factions/cyborg/mech.png',
    description: 'Бронированная машина. Отличный блокировщик.',
    stats: { power: 2, defense: 3, speed: 1, technique: 1 },
    specialAbility: undefined,
  },
  // Cyborg Sniper
  {
    id: 'cyborg_drone',
    factionId: 'cyborg',
    name: 'Cyborg Drone',
    title: 'Rookie Striker',
    capClass: 'sniper',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'cyborg_drone',
    assetPath: '/assets/sprites/factions/cyborg/drone.png',
    description: 'Точность превыше всего. Дальнобойный удар.',
    stats: { power: 3, defense: 1, speed: 2, technique: 2 },
    specialAbility: undefined,
  },
  // Cyborg Trickster
  {
    id: 'cyborg_glitch',
    factionId: 'cyborg',
    name: 'Cyborg Glitch',
    title: 'Rookie Trickster',
    capClass: 'trickster',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'cyborg_glitch',
    assetPath: '/assets/sprites/factions/cyborg/glitch.png',
    description: 'Системный сбой. Траектория непредсказуема.',
    stats: { power: 2, defense: 1, speed: 2, technique: 3 },
    specialAbility: undefined,
  },

  // ═══════════════════════════════════════════════════════════════
  // VOID
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'void_initiate',
    factionId: 'void',
    name: 'Void Initiate',
    title: 'Rookie Initiate',
    capClass: 'balanced',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'void_initiate',
    assetPath: '/assets/sprites/factions/void/initiate.png',
    description: 'Они существуют одновременно здесь и нигде. Мяч проходит сквозь них... иногда.',
    stats: { power: 2, defense: 2, speed: 2, technique: 2 },
    specialAbility: undefined,
  },
  // Void Tank
  {
    id: 'void_guardian',
    factionId: 'void',
    name: 'Void Guardian',
    title: 'Rookie Defender',
    capClass: 'tank',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'void_guardian',
    assetPath: '/assets/sprites/factions/void/guardian.png',
    description: 'Страж пустоты. Поглощает удары.',
    stats: { power: 2, defense: 3, speed: 1, technique: 1 },
    specialAbility: undefined,
  },
  // Void Sniper
  {
    id: 'void_sniper',
    factionId: 'void',
    name: 'Void Sniper',
    title: 'Rookie Striker',
    capClass: 'sniper',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'void_sniper',
    assetPath: '/assets/sprites/factions/void/sniper.png',
    description: 'Стреляет из тени. Точный и смертоносный.',
    stats: { power: 3, defense: 1, speed: 2, technique: 2 },
    specialAbility: undefined,
  },
  // Void Trickster
  {
    id: 'void_bender',
    factionId: 'void',
    name: 'Void Bender',
    title: 'Rookie Trickster',
    capClass: 'trickster',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'void_bender',
    assetPath: '/assets/sprites/factions/void/bender.png',
    description: 'Искривляет пространство. Мяч летит по дуге.',
    stats: { power: 2, defense: 1, speed: 2, technique: 3 },
    specialAbility: undefined,
  },

  // ═══════════════════════════════════════════════════════════════
  // BATTLE PASS SEASON 1 EXCLUSIVE UNITS
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'cyborg_iron_sentinel',
    factionId: 'cyborg',
    name: 'Iron Sentinel',
    title: 'Armored Guardian',
    capClass: 'tank',
    rarity: 'rare',
    isStarter: false,
    price: {}, // BP exclusive
    assetKey: 'cyborg_iron_sentinel',
    assetPath: '/assets/units/cyborg/cyborg_iron_sentinel.png',
    description: 'Бронированный страж из легированной стали. Его репульсорный щит отражает любые атаки.',
    stats: { power: 3, defense: 5, speed: 2, technique: 3 },
    specialAbility: 'Repulsor Shield',
  },
  {
    id: 'magma_rocket_gunner',
    factionId: 'magma',
    name: 'Rocket Gunner',
    title: 'Explosive Expert',
    capClass: 'sniper',
    rarity: 'epic',
    isStarter: false,
    price: {},
    assetKey: 'magma_rocket_gunner',
    assetPath: '/assets/units/magma/magma_rocket_gunner.png',
    description: 'Маленький, но смертоносный. Его ракетные удары сметают всё на пути к воротам.',
    stats: { power: 5, defense: 2, speed: 4, technique: 4 },
    specialAbility: 'Rocket Barrage',
  },
  {
    id: 'insect_gamma_beast',
    factionId: 'insect',
    name: 'Gamma Beast',
    title: 'Unstoppable Force',
    capClass: 'tank',
    rarity: 'epic',
    isStarter: false,
    price: {},
    assetKey: 'insect_gamma_beast',
    assetPath: '/assets/units/insect/insect_gamma_beast.png',
    description: 'Гамма-мутант невероятной силы. Чем больше урона получает, тем сильнее его удары.',
    stats: { power: 6, defense: 4, speed: 2, technique: 2 },
    specialAbility: 'Gamma Rage',
  },
  {
    id: 'void_chaos_witch',
    factionId: 'void',
    name: 'Chaos Witch',
    title: 'Reality Bender',
    capClass: 'trickster',
    rarity: 'legendary',
    isStarter: false,
    price: {},
    assetKey: 'void_chaos_witch',
    assetPath: '/assets/units/void/void_chaos_witch.png',
    description: 'Повелительница хаоса, изгибающая реальность. Её непредсказуемая магия меняет ход любого матча.',
    stats: { power: 4, defense: 3, speed: 4, technique: 6 },
    specialAbility: 'Chaos Magic',
  },

  // ═══════════════════════════════════════════════════════════════
  // INSECT
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'insect_drone',
    factionId: 'insect',
    name: 'Swarm Drone',
    title: 'Rookie Drone',
    capClass: 'balanced',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'insect_drone',
    assetPath: '/assets/sprites/factions/insect/drone.png',
    description: 'Не имеет имени, только цель. Если один видит мяч, его видят все.',
    stats: { power: 2, defense: 2, speed: 2, technique: 2 },
    specialAbility: undefined,
  },
  // Insect Tank
  {
    id: 'insect_brood',
    factionId: 'insect',
    name: 'Insect Brood',
    title: 'Rookie Defender',
    capClass: 'tank',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'insect_brood',
    assetPath: '/assets/sprites/factions/insect/brood.png',
    description: 'Бронированный жук. Твёрдый панцирь.',
    stats: { power: 2, defense: 3, speed: 1, technique: 1 },
    specialAbility: undefined,
  },
  // Insect Sniper
  {
    id: 'insect_spitter',
    factionId: 'insect',
    name: 'Insect Spitter',
    title: 'Rookie Striker',
    capClass: 'sniper',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'insect_spitter',
    assetPath: '/assets/sprites/factions/insect/spitter.png',
    description: 'Плюётся кислотой. Дальнобойный.',
    stats: { power: 3, defense: 1, speed: 2, technique: 2 },
    specialAbility: undefined,
  },
  // Insect Trickster
  {
    id: 'insect_mimic',
    factionId: 'insect',
    name: 'Insect Mimic',
    title: 'Rookie Trickster',
    capClass: 'trickster',
    rarity: 'common',
    isStarter: true,
    price: {},
    assetKey: 'insect_mimic',
    assetPath: '/assets/sprites/factions/insect/mimic.png',
    description: 'Мастер обмана. Закручивает траектории.',
    stats: { power: 2, defense: 1, speed: 2, technique: 3 },
    specialAbility: undefined,
  },

  // ═══════════════════════════════════════════════════════════════
  // BOSS UNITS (CAMPAIGN ONLY)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'boss_krag',
    factionId: 'magma',
    name: 'Krag, Magma Lord',
    title: 'The Unstoppable',
    capClass: 'tank',
    rarity: 'legendary',
    isStarter: false,
    price: { coins: 99999 }, // Unobtainable
    assetKey: 'boss_krag',
    assetPath: '/assets/sprites/units/bosses/boss_krag.png',
    description: 'The ruler of the Magma Brutes. Crushes everything in his path.',
    stats: { power: 5, defense: 5, speed: 2, technique: 3 },
    specialAbility: 'Lava Eruption',
  },
  {
    id: 'boss_unit734',
    factionId: 'cyborg',
    name: 'Unit 734',
    title: 'Tactical Mainframe',
    capClass: 'balanced',
    rarity: 'legendary',
    isStarter: false,
    price: { coins: 99999 },
    assetKey: 'boss_unit734',
    assetPath: '/assets/sprites/units/bosses/boss_unit734.png',
    description: 'Calculates victory probability with 100% accuracy.',
    stats: { power: 4, defense: 5, speed: 4, technique: 5 },
    specialAbility: 'Perfect Shield',
  },
  {
    id: 'boss_zra',
    factionId: 'void',
    name: "Z'ra, The Seer",
    title: 'Void Matriarch',
    capClass: 'trickster',
    rarity: 'legendary',
    isStarter: false,
    price: { coins: 99999 },
    assetKey: 'boss_zra',
    assetPath: '/assets/sprites/units/bosses/boss_zra.png',
    description: 'Manipulates space and time to confuse opponents.',
    stats: { power: 3, defense: 3, speed: 5, technique: 5 },
    specialAbility: 'Dimension Swap',
  },
  {
    id: 'boss_oracle',
    factionId: 'insect',
    name: 'Hive Oracle',
    title: 'Swarm Mind',
    capClass: 'sniper',
    rarity: 'legendary',
    isStarter: false,
    price: { coins: 99999 },
    assetKey: 'boss_oracle',
    assetPath: '/assets/sprites/units/bosses/boss_oracle.png',
    description: 'The apex of the hive evolution. Fast and deadly.',
    stats: { power: 5, defense: 2, speed: 5, technique: 5 },
    specialAbility: 'Neurotoxin Burst',
  },

  // === BATTLE PASS SEASON 1 EXCLUSIVE UNITS ===

  // 🟢 FREE PASS REWARD (Tier 5) — Rare
  {
    id: 'cyborg_iron_sentinel',
    factionId: 'cyborg',
    name: 'Iron Sentinel',
    title: 'Armored Guardian',
    capClass: 'tank',
    rarity: 'rare',
    isStarter: false,
    price: {}, // BP exclusive
    assetKey: 'cyborg_iron_sentinel',
    assetPath: '/assets/units/cyborg/cyborg_iron_sentinel.png',
    description: 'Бронированный страж из легированной стали. Его репульсорный щит отражает любые атаки.',
    stats: { power: 3, defense: 5, speed: 2, technique: 3 },
    specialAbility: 'Repulsor Shield',
  },

  // 🟠 PREMIUM REWARD (Tier 10) — Epic
  {
    id: 'magma_rocket_gunner',
    factionId: 'magma',
    name: 'Rocket Gunner',
    title: 'Explosive Expert',
    capClass: 'sniper',
    rarity: 'epic',
    isStarter: false,
    price: {},
    assetKey: 'magma_rocket_gunner',
    assetPath: '/assets/units/magma/magma_rocket_gunner.png',
    description: 'Маленький, но смертоносный. Его ракетные удары сметают всё на пути к воротам.',
    stats: { power: 5, defense: 2, speed: 4, technique: 4 },
    specialAbility: 'Rocket Barrage',
  },

  // 🟢 PREMIUM REWARD (Tier 20) — Epic
  {
    id: 'insect_gamma_beast',
    factionId: 'insect',
    name: 'Gamma Beast',
    title: 'Unstoppable Force',
    capClass: 'tank',
    rarity: 'epic',
    isStarter: false,
    price: {},
    assetKey: 'insect_gamma_beast',
    assetPath: '/assets/units/insect/insect_gamma_beast.png',
    description: 'Гамма-мутант невероятной силы. Чем больше урона получает, тем сильнее его удары.',
    stats: { power: 6, defense: 4, speed: 2, technique: 2 },
    specialAbility: 'Gamma Rage',
  },

  // 🟣 PREMIUM REWARD (Tier 30 - FINAL) — Legendary
  {
    id: 'void_chaos_witch',
    factionId: 'void',
    name: 'Chaos Witch',
    title: 'Reality Bender',
    capClass: 'trickster',
    rarity: 'legendary',
    isStarter: false,
    price: {},
    assetKey: 'void_chaos_witch',
    assetPath: '/assets/units/void/void_chaos_witch.png',
    description: 'Повелительница хаоса, изгибающая реальность. Её непредсказуемая магия меняет ход любого матча.',
    stats: { power: 4, defense: 3, speed: 4, technique: 6 },
    specialAbility: 'Chaos Magic',
  },
];

/**
 * Легендарные юниты для обучающего матча
 * ВАЖНО: ID должны существовать в UNITS_REPOSITORY!
 * Игрок временно получает их ТОЛЬКО на первый матч
 * Доступны только для стартовых фракций (Magma, Cyborg)
 */
export const TUTORIAL_LEGENDARY_UNITS: Partial<Record<FactionId, string[]>> = {
  magma: [
    'magma_core_titan',      // Легендарный танк - Planetbreaker
    'magma_solar_striker',   // Легендарный снайпер - Sunfire
    'magma_phoenix_master',  // Легендарный трикстер - Fireborn
  ],
  cyborg: [
    'cyborg_aegis',          // Легендарный танк - Omega Shield
    'cyborg_omega_sniper',   // Легендарный снайпер - Deadshot
    'cyborg_quantum',        // Легендарный трикстер - Schrodinger
  ],
  // void и insect будут добавлены когда разблокируются
};

export function getUnit(unitId: string): UnitData | undefined {
  // ⭐ NEW: Сначала ищем в базовых юнитах (UNITS_CATALOG)
  const basicUnit = UNITS_CATALOG.find((u) => u.id === unitId);
  if (basicUnit) {
    return basicUnit;
  }
  
  // ⭐ NEW: Если не найдено, ищем в новых 84 уникальных юнитах (UNITS_REPOSITORY)
  const uniqueUnit = getUnitFromRepository(unitId);
  if (uniqueUnit) {
    // Конвертируем UnitData из UnitsRepository в формат UnitsCatalog
    return {
      id: uniqueUnit.id,
      factionId: uniqueUnit.factionId,
      name: uniqueUnit.name,
      title: uniqueUnit.title,
      capClass: uniqueUnit.role as any, // role → capClass
      rarity: uniqueUnit.rarity as any,
      isStarter: uniqueUnit.isStarter || false, // ✅ НОВОЕ: Поддержка стартовых юнитов
      price: uniqueUnit.shopPrice ? { coins: uniqueUnit.shopPrice } : (uniqueUnit.premiumPrice ? { crystals: uniqueUnit.premiumPrice } : {}), // ✅ НОВОЕ: Поддержка магазинных цен и премиум цен
      assetKey: uniqueUnit.assetKey, // ✅ ИСПРАВЛЕНО: Используем assetKey из Repository, а не id
      assetPath: uniqueUnit.assetPath,
      description: uniqueUnit.description,
      stats: uniqueUnit.stats,
      specialAbility: uniqueUnit.specialAbility,
    };
  }
  
  return undefined;
}

export function getUnitsByFaction(factionId: FactionId): UnitData[] {
  return UNITS_CATALOG.filter((u) => u.factionId === factionId);
}

export function getStarterUnits(factionId: FactionId): UnitData[] {
  return UNITS_CATALOG.filter((u) => u.factionId === factionId && u.isStarter);
}

export function getPurchasableUnits(factionId: FactionId): UnitData[] {
  return UNITS_CATALOG.filter((u) => u.factionId === factionId && !u.isStarter);
}

export function getRarityColor(rarity: SkinRarity): number {
  switch (rarity) {
    case 'common': return 0x9ca3af;
    case 'rare': return 0x3b82f6;
    case 'epic': return 0xa855f7;
    case 'legendary': return 0xf59e0b;
    default: return 0x9ca3af;
  }
}

export function getRarityName(rarity: SkinRarity): string {
  switch (rarity) {
    case 'common': return 'Common';
    case 'rare': return 'Rare';
    case 'epic': return 'Epic';
    case 'legendary': return 'Legendary';
    default: return 'Common';
  }
}

export function getClassColor(capClass: CapClass): number {
  switch (capClass) {
    case 'balanced': return 0x22c55e;
    case 'tank': return 0x3b82f6;
    case 'sniper': return 0xf59e0b;
    case 'trickster': return 0xa855f7;
    default: return 0x9ca3af;
  }
}

export function getClassIcon(capClass: CapClass): string {
  switch (capClass) {
    case 'balanced': return '⚖️';
    case 'tank': return '🛡️';
    case 'sniper': return '🎯';
    case 'trickster': return '🌀';
    default: return '❓';
  }
}

export function getClassName(capClass: CapClass): string {
  switch (capClass) {
    case 'balanced': return 'Balanced';
    case 'tank': return 'Tank';
    case 'sniper': return 'Sniper';
    case 'trickster': return 'Trickster';
    default: return 'Unknown';
  }
}

export function formatPrice(price: SkinPrice): string {
  if (price.crystals) return `💎 ${price.crystals}`;
  if (price.coins) return `💰 ${price.coins}`;
  return 'FREE';
}

export const MAX_UPGRADE_LEVEL = 10;

export function getUpgradeCost(currentLevel: number): number {
  if (currentLevel >= MAX_UPGRADE_LEVEL) return 0;
  const costs = [0, 100, 200, 350, 500, 750, 1000, 1500, 2000, 3000];
  return costs[currentLevel] || 3000;
}