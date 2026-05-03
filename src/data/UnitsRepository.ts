// ╔══════════════════════════════════════════════════════════════════════╗
// ║  UNITS REPOSITORY - Коллекция уникальных фишек                       ║
// ║  Система вдохновлена FIFA Ultimate Team                              ║
// ║  88 юнитов: 80 коллекционных + 4 босса + 4 премиум                 ║
// ╚══════════════════════════════════════════════════════════════════════╝

import { FactionId, CapClass } from '../constants/gameConstants';
import { PassiveAbility, PassiveType } from '../types/passives';
import type { PhysicsModifierId } from '../types/units';
import { UNIT_PHYSICS_MODIFIER_TABLE } from './unitPhysicsModifiers';
import { getUnit } from './UnitsCatalog';

// ==================== ВЕРСИЯ АССЕТОВ ====================
// ⚠️ УВЕЛИЧИВАЙ ЭТО ЧИСЛО КАЖДЫЙ РАЗ КОГДА ОБНОВЛЯЕШЬ PNG ФИШЕК!
// Это заставит Telegram перезагрузить изображения
const ASSETS_VERSION = '5'; // Капитаны + PNG в assets/units/captains

// #region agent log
try {
  console.log('[UnitsRepository] Module loading, ASSETS_VERSION:', ASSETS_VERSION);
} catch(e) {}
// #endregion

// ==================== ТИПЫ ====================

export type UnitRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface UnitStats {
  power: number;      // Сила удара (1-10)
  defense: number;    // Защита/масса (1-10)
  speed: number;      // Скорость (1-10)
  technique: number;  // Техника/точность (1-10)
}

// ========== НОВЫЕ ПОЛЯ ДЛЯ БАЛАНСА ==========
// Типы PassiveType и PassiveAbility импортируются из '../types/passives'

export interface UnitData {
  id: string;
  factionId: FactionId;
  name: string;
  title: string;           // Подзаголовок/прозвище
  role: CapClass;          // balanced | tank | sniper | trickster
  rarity: UnitRarity;
  stats: UnitStats;
  specialAbility: string;  // Название способности
  description: string;     // Лор и описание
  
  // Визуальные данные
  assetKey: string;
  assetPath: string;
  primaryColor: number;
  secondaryColor: number;
  
  // Требования для разблокировки
  fragmentsRequired: number;  // Сколько фрагментов нужно для сборки
  
  // ✅ НОВОЕ (2026-01-20): Флаги для стартовых и магазинных юнитов
  isStarter?: boolean;     // Выдается при получении фракции
  isShopItem?: boolean;    // Продается в магазине
  shopPrice?: number;      // Цена в магазине (в монетах)
  // ✅ НОВОЕ (2026-01-23): Флаг для премиум юнитов (только в магазине за кристаллы)
  isPremium?: boolean;      // Премиум юнит, доступен только в магазине за кристаллы
  premiumPrice?: number;   // Цена в кристаллах (для премиум юнитов)
  // ✅ Battle Pass эксклюзивные юниты
  isBattlePass?: boolean;
  battlePassTier?: number;
  battlePassSeason?: string;
  
  // ========== НОВЫЕ ПОЛЯ ДЛЯ БАЛАНСА ==========
  nameRu: string;              // Русское название
  accuracy: number;            // Точность 0.80-1.00
  passive: PassiveAbility;     // Пассивная способность
  /** Перекрывает таблицу `unitPhysicsModifiers.ts`, если задано */
  physicsModifier?: PhysicsModifierId;
  /** Уникальный капитан фракции (награда за 10 уровень аккаунта) */
  isCaptain?: boolean;
}

export const RARITY_COLORS: Record<UnitRarity, number> = {
  common: 0x9ca3af,      // Серый
  rare: 0x3b82f6,        // Синий
  epic: 0xa855f7,        // Фиолетовый
  legendary: 0xf59e0b,   // Золотой
};

export const RARITY_NAMES: Record<UnitRarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

// ==================== ТРЕБОВАНИЯ ФРАГМЕНТОВ ====================

export const FRAGMENTS_BY_RARITY: Record<UnitRarity, number> = {
  common: 3,
  rare: 6,
  epic: 10,
  legendary: 15,
};

// ==================== КАТАЛОГ ЮНИТОВ ====================

// #region agent log
try {
  console.log('[UnitsRepository] Before UNITS_REPOSITORY array definition');
} catch(e) {}
// #endregion

export const UNITS_REPOSITORY: UnitData[] = [
  
  // ═══════════════════════════════════════════════════════════════
  // 🔥 MAGMA BRUTES (Volcanic Warriors)
  // ═══════════════════════════════════════════════════════════════
  
  // --- BALANCED (5 units) ---
  {
    id: 'magma_ember_fang', // ✅ ИСПРАВЛЕНО: Изменен ID для избежания конфликта с magma_grunt
    factionId: 'magma',
    name: 'Ember Fang',
    title: 'Frontline Brawler',
    role: 'balanced',
    rarity: 'common',
    stats: { power: 4, defense: 3, speed: 3, technique: 3 },
    specialAbility: 'Thermal Push',
    description: 'Пехота вулканов. Стабильный и надёжный боец первой линии. [ПАССИВКА] Стабильность: Нет особых эффектов, но и нет слабостей.',
    assetKey: 'magma_ember_fang',
    assetPath: `assets/units/magma/magma_ember_fang.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xdc2626,
    secondaryColor: 0x991b1b,
    fragmentsRequired: 3,
    isStarter: true, // ✅ НОВОЕ: Стартовый юнит при получении фракции
    nameRu: 'Огнеклык',
    accuracy: 0.89,
    passive: {
      type: 'none',
      name: 'Стабильность',
      description: 'Надёжный боец без особых эффектов, но и без слабостей.',
      params: {}
    },
  },
  {
    id: 'magma_ember_soldier',
    factionId: 'magma',
    name: 'Ash Reaper',
    title: 'Ash Warrior',
    role: 'balanced',
    rarity: 'common',
    stats: { power: 3, defense: 4, speed: 3, technique: 3 },
    specialAbility: 'Cinder Strike',
    description: 'Берсерк, рождённый в углях. Не знает страха и отступления. [ПАССИВКА] Угольная ярость: При столкновении с врагом оба отлетают на равное расстояние.',
    assetKey: 'magma_ember',
    assetPath: `assets/units/magma/magma_ash_reaper.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xef4444,
    secondaryColor: 0xb91c1c,
    fragmentsRequired: 3,
    isShopItem: true,
    shopPrice: 1000,
    nameRu: 'Угольный Берсерк',
    accuracy: 0.89,
    passive: {
      type: 'on_collision',
      name: 'Угольная ярость',
      description: 'При столкновении с врагом оба отлетают на равное расстояние.',
      params: { target: 'enemy' }
    },
  },
  {
    id: 'magma_blaze_runner',
    factionId: 'magma',
    name: 'Inferno Dash',
    title: 'Flame Sprinter',
    role: 'balanced',
    rarity: 'rare',
    stats: { power: 5, defense: 3, speed: 4, technique: 4 },
    specialAbility: 'Ignition Dash',
    description: 'Быстрый как пламя. Его удары оставляют выжженные следы на поле. [ПАССИВКА] Горящий рывок: После удара по мячу +15% скорость на 1 ход.',
    assetKey: 'magma_blaze',
    assetPath: `assets/units/magma/magma_inferno_dash.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xf97316,
    secondaryColor: 0xea580c,
    fragmentsRequired: 6,
    isShopItem: true,
    shopPrice: 2500,
    nameRu: 'Огненный Шквал',
    accuracy: 0.90,
    passive: {
      type: 'on_hit_ball',
      name: 'Горящий рывок',
      description: 'После удара по мячу: +15% скорость на 1 ход.',
      params: { value: 0.15, duration: 1, target: 'self' }
    },
  },
  {
    id: 'magma_magma_champion',
    factionId: 'magma',
    name: 'Molten Warlord',
    title: 'Elite Enforcer',
    role: 'balanced',
    rarity: 'epic',
    stats: { power: 6, defense: 5, speed: 4, technique: 5 },
    specialAbility: 'Volcanic Fury',
    description: 'Чемпион вулканических арен. Магма подчиняется его воле. [ПАССИВКА] Властелин лавы: Карта Lava Pool имеет +25% радиус.',
    assetKey: 'magma_champion',
    assetPath: `assets/units/magma/magma_molten_warlord.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xdc2626,
    secondaryColor: 0x7c2d12,
    fragmentsRequired: 10,
    nameRu: 'Воитель Магмы',
    accuracy: 0.91,
    passive: {
      type: 'card_enhance',
      name: 'Властелин лавы',
      description: 'Карта Lava Pool: +25% радиус.',
      params: { value: 0.25, target: 'area' }
    },
  },
  {
    id: 'magma_pyroclast_lord',
    factionId: 'magma',
    name: 'Ragnaros',
    title: 'Avatar of Destruction',
    role: 'balanced',
    rarity: 'legendary',
    stats: { power: 8, defense: 6, speed: 5, technique: 7 },
    specialAbility: 'Eruption Core',
    description: 'Воплощение ярости вулкана. Легенды говорят, что он родился в жерле активного вулкана. [ПАССИВКА] Извержение: После гола — лава в центре. После пропуска — замедление.',
    assetKey: 'magma_pyroclast',
    assetPath: `assets/units/magma/magma_ragnaros.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xfbbf24,
    secondaryColor: 0xdc2626,
    fragmentsRequired: 15,
    nameRu: 'Владыка Катаклизма',
    accuracy: 0.91,
    passive: {
      type: 'risk_reward',
      name: 'Извержение',
      description: 'После забитого гола создаёт Lava Pool в центре поля. После пропущенного: -20% скорость на 2 хода.',
      params: { value: 0.20, duration: 2, condition: 'after_goal' }
    },
  },

  // --- TANK (5 units) ---
  {
    id: 'magma_obsidian_hulk', // ✅ ИСПРАВЛЕНО: Изменен ID для избежания конфликта с magma_titan
    factionId: 'magma',
    name: 'Obsidian Hulk',
    title: 'Obsidian Wall',
    role: 'tank',
    rarity: 'common',
    stats: { power: 5, defense: 5, speed: 1, technique: 2 },
    specialAbility: 'Stone Fortress',
    description: 'Гигант из вулканического стекла. Прочный и несокрушимый. [ПАССИВКА] Каменная стойкость: Масса +10%.',
    assetKey: 'magma_obsidian_hulk',
    assetPath: `assets/units/magma/magma_obsidian_hulk.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x44403c,
    secondaryColor: 0xdc2626,
    fragmentsRequired: 3,
    isShopItem: true,
    shopPrice: 1500,
    nameRu: 'Обсидиановый Исполин',
    accuracy: 0.82,
    passive: {
      type: 'stat_boost',
      name: 'Каменная стойкость',
      description: 'Масса +10%. Надёжный защитник.',
      params: { value: 0.10, target: 'self' }
    },
  },
  {
    id: 'magma_basalt_guard',
    factionId: 'magma',
    name: 'Geo Sentinel',
    title: 'Unbreakable Shield',
    role: 'tank',
    rarity: 'rare',
    stats: { power: 4, defense: 7, speed: 1, technique: 2 },
    specialAbility: 'Volcanic Barrier',
    description: 'Страж из раскалённого базальта. Его прикосновение обжигает. [ПАССИВКА] Жар камня: Столкновение замедляет врага на 10%.',
    assetKey: 'magma_basalt',
    assetPath: `assets/units/magma/magma_geo_sentinel.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x57534e,
    secondaryColor: 0xf97316,
    fragmentsRequired: 6,
    isShopItem: true,
    shopPrice: 2500,
    nameRu: 'Базальтовый Страж',
    accuracy: 0.83,
    passive: {
      type: 'on_collision',
      name: 'Жар камня',
      description: 'При столкновении с врагом: враг замедлен на 10% на 1 ход.',
      params: { value: 0.10, duration: 1, target: 'enemy' }
    },
  },
  {
    id: 'magma_golem',
    factionId: 'magma',
    name: 'Magma Beast',
    title: 'Molten Colossus',
    role: 'tank',
    rarity: 'rare',
    stats: { power: 6, defense: 6, speed: 2, technique: 1 },
    specialAbility: 'Magma Armor',
    description: 'Зверь, рождённый из чистой магмы. Чем сильнее удар — тем крепче броня. [ПАССИВКА] Магмовая броня: +20% защита после получения удара.',
    assetKey: 'magma_golem',
    assetPath: `assets/units/magma/magma_magma_beast.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xdc2626,
    secondaryColor: 0x44403c,
    fragmentsRequired: 6,
    nameRu: 'Лавовый Зверь',
    accuracy: 0.82,
    passive: {
      type: 'conditional',
      name: 'Магмовая броня',
      description: 'После получения удара: +20% защита на 1 ход.',
      params: { value: 0.20, duration: 1, target: 'self', condition: 'after_hit' }
    },
  },
  {
    id: 'magma_juggernaut',
    factionId: 'magma',
    name: 'Dreadforge',
    title: 'Unstoppable Force',
    role: 'tank',
    rarity: 'epic',
    stats: { power: 7, defense: 8, speed: 2, technique: 3 },
    specialAbility: 'Seismic Impact',
    description: 'Неостановимая сила. Когда Джаггернаут набирает скорость, ничто не устоит. [ПАССИВКА] Сейсмический удар: Отталкивает врага на 30% дальше.',
    assetKey: 'magma_juggernaut',
    assetPath: `assets/units/magma/magma_dreadforge.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x78350f,
    secondaryColor: 0xef4444,
    fragmentsRequired: 10,
    isShopItem: true,
    shopPrice: 5000,
    nameRu: 'Джаггернаут',
    accuracy: 0.84,
    passive: {
      type: 'on_collision',
      name: 'Сейсмический удар',
      description: 'Столкновение с врагом: отталкивает на 30% дальше.',
      params: { value: 0.30, target: 'enemy' }
    },
  },
  {
    id: 'magma_core_titan',
    factionId: 'magma',
    name: 'Planetbreaker',
    title: 'Heart of the Volcano',
    role: 'tank',
    rarity: 'legendary',
    stats: { power: 7, defense: 10, speed: 2, technique: 4 },
    specialAbility: 'Planetary Core',
    description: 'Титан из ядра умирающей планеты. Его масса искривляет пространство. [ПАССИВКА] Ядро планеты: Масса +50%, скорость -25%. Несдвигаемый.',
    assetKey: 'magma_core_titan',
    assetPath: `assets/units/magma/magma_planetbreaker.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xfbbf24,
    secondaryColor: 0x78350f,
    fragmentsRequired: 15,
    nameRu: 'Страж Преисподней',
    accuracy: 0.82,
    passive: {
      type: 'stat_boost',
      name: 'Ядро планеты',
      description: 'Масса +50%, скорость -25%. Невозможно сдвинуть при защите ворот.',
      params: { value: 0.50, target: 'self' }
    },
  },

  // --- SNIPER (5 units) ---
  {
    id: 'magma_embershot', // ✅ ИСПРАВЛЕНО: Изменен ID для избежания конфликта с magma_scout
    factionId: 'magma',
    name: 'Embershot',
    title: 'Geyser Striker',
    role: 'sniper',
    rarity: 'common',
    stats: { power: 5, defense: 2, speed: 3, technique: 4 },
    specialAbility: 'Geyser Burst',
    description: 'Метатель раскалённых искр. Каждый выстрел — точное попадание. [ПАССИВКА] Точный жар: Надёжная точность без особых эффектов.',
    assetKey: 'magma_embershot',
    assetPath: `assets/units/magma/magma_embershot.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xf97316,
    secondaryColor: 0xfef3c7,
    fragmentsRequired: 3,
    nameRu: 'Искрометатель',
    accuracy: 0.93,
    passive: {
      type: 'none',
      name: 'Точный жар',
      description: 'Стандартный снайпер. Точные удары без особых эффектов.',
      params: {}
    },
  },
  {
    id: 'magma_ash_marksman',
    factionId: 'magma',
    name: 'Soot Sniper',
    title: 'Precision Burner',
    role: 'sniper',
    rarity: 'rare',
    stats: { power: 6, defense: 2, speed: 4, technique: 5 },
    specialAbility: 'Thermal Snipe',
    description: 'Охотник, скрытый в пепле. Промах лишь делает его точнее. [ПАССИВКА] Пепельный прицел: +10% точность после промаха.',
    assetKey: 'magma_ash_marksman',
    assetPath: `assets/units/magma/magma_soot_sniper.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x92400e,
    secondaryColor: 0xfbbf24,
    fragmentsRequired: 6,
    nameRu: 'Серый Охотник',
    accuracy: 0.94,
    passive: {
      type: 'conditional',
      name: 'Пепельный прицел',
      description: 'После промаха по воротам: +10% точность следующего удара.',
      params: { value: 0.10, condition: 'after_miss' }
    },
  },
  {
    id: 'magma_inferno_shooter',
    factionId: 'magma',
    name: 'Blaze Hawk',
    title: 'Flame Cannon',
    role: 'sniper',
    rarity: 'rare',
    stats: { power: 7, defense: 2, speed: 3, technique: 5 },
    specialAbility: 'Hellfire Shot',
    description: 'Его взгляд прожигает насквозь. На чужой территории он смертоносен. [ПАССИВКА] Пылающий взор: +10% сила на половине врага.',
    assetKey: 'magma_inferno_shooter',
    assetPath: `assets/units/magma/magma_blaze_hawk.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xdc2626,
    secondaryColor: 0xfde68a,
    fragmentsRequired: 6,
    nameRu: 'Глаз Инферно',
    accuracy: 0.93,
    passive: {
      type: 'conditional',
      name: 'Пылающий взор',
      description: 'Удар по мячу: +10% сила, если мяч на половине врага.',
      params: { value: 0.10, condition: 'enemy_half' }
    },
  },
  {
    id: 'magma_lava_sniper',
    factionId: 'magma',
    name: 'Meltdown',
    title: 'Molten Precision',
    role: 'sniper',
    rarity: 'epic',
    stats: { power: 8, defense: 3, speed: 4, technique: 7 },
    specialAbility: 'Pyroclastic Cannon',
    description: 'Палач, чьи выстрелы плавят всё на пути. [ПАССИВКА] Расплавление: Мяч проходит сквозь первого врага.',
    assetKey: 'magma_lava_sniper',
    assetPath: `assets/units/magma/magma_meltdown.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xef4444,
    secondaryColor: 0x44403c,
    fragmentsRequired: 10,
    nameRu: 'Лавовый Палач',
    accuracy: 0.95,
    passive: {
      type: 'on_hit_ball',
      name: 'Расплавление',
      description: 'Мяч после удара игнорирует первое столкновение с врагом.',
      params: { target: 'ball' }
    },
  },
  {
    id: 'magma_solar_striker',
    factionId: 'magma',
    name: 'Sunfire',
    title: 'Star Forged Marksman',
    role: 'sniper',
    rarity: 'legendary',
    stats: { power: 10, defense: 3, speed: 5, technique: 9 },
    specialAbility: 'Solar Flare',
    description: 'Посланник солнца. Его удары непредсказуемы, как вспышки на звезде. [ПАССИВКА] Солнечная вспышка: 20% шанс крита +40%, 10% шанс провала -20%.',
    assetKey: 'magma_solar_striker',
    assetPath: `assets/units/magma/magma_sunfire.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xfbbf24,
    secondaryColor: 0xef4444,
    fragmentsRequired: 15,
    nameRu: 'Вестник Рассвета',
    accuracy: 0.93,
    passive: {
      type: 'risk_reward',
      name: 'Солнечная вспышка',
      description: 'Критический удар: 20% шанс +40% силы. Но 10% шанс -20% силы.',
      params: { value: 0.40, chance: 0.20 }
    },
  },

  // --- TRICKSTER (5 units) ---
  {
    id: 'magma_flame_dancer',
    factionId: 'magma',
    name: 'Pyro Jinx',
    title: 'Fire Acrobat',
    role: 'trickster',
    rarity: 'common',
    stats: { power: 3, defense: 2, speed: 4, technique: 4 },
    specialAbility: 'Ember Spiral',
    description: 'Танцовщица в языках пламени. Её движения гипнотизируют. [ПАССИВКА] Танец огня: Curve +10%.',
    assetKey: 'magma_flame_dancer',
    assetPath: `assets/units/magma/magma_pyro_jinx.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xfbbf24,
    secondaryColor: 0xef4444,
    fragmentsRequired: 3,
    nameRu: 'Огненная Фурия',
    accuracy: 0.85,
    passive: {
      type: 'stat_boost',
      name: 'Танец огня',
      description: 'Curve +10%. Базовый трикстер.',
      params: { value: 0.10, target: 'self' }
    },
  },
  {
    id: 'magma_hellion', // ✅ ИСПРАВЛЕНО: Изменен ID для избежания конфликта с magma_inferno
    factionId: 'magma',
    name: 'Hellion',
    title: 'Chaos Igniter',
    role: 'trickster',
    rarity: 'rare',
    stats: { power: 4, defense: 2, speed: 5, technique: 5 },
    specialAbility: 'Flame Spiral',
    description: 'Мелкий демон из глубин. Раздражает и обжигает. [ПАССИВКА] Адское пламя: Враги рядом теряют 5% скорости.',
    assetKey: 'magma_hellion',
    assetPath: `assets/units/magma/magma_hellion.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xf97316,
    secondaryColor: 0x7c2d12,
    fragmentsRequired: 6,
    nameRu: 'Адский Бес',
    accuracy: 0.86,
    passive: {
      type: 'aura',
      name: 'Адское пламя',
      description: 'После удара: враги в радиусе 40px теряют 5% скорости.',
      params: { value: 0.05, radius: 40, target: 'enemy' }
    },
  },
  {
    id: 'magma_smoke_phantom',
    factionId: 'magma',
    name: 'Ash Wraith',
    title: 'Ashen Illusionist',
    role: 'trickster',
    rarity: 'rare',
    stats: { power: 4, defense: 3, speed: 5, technique: 6 },
    specialAbility: 'Smoke Screen',
    description: 'Призрак, рождённый из дыма и пепла. Его присутствие душит. [ПАССИВКА] Пепельный след: Замедляет врагов в радиусе 50px на 15%.',
    assetKey: 'magma_smoke_phantom',
    assetPath: `assets/units/magma/magma_ash_wraith.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x78716c,
    secondaryColor: 0xf97316,
    fragmentsRequired: 6,
    nameRu: 'Дух Гари',
    accuracy: 0.87,
    passive: {
      type: 'aura',
      name: 'Пепельный след',
      description: 'После остановки: враги в радиусе 50px замедлены на 15% на 1 ход.',
      params: { value: 0.15, radius: 50, duration: 1, target: 'enemy' }
    },
  },
  {
    id: 'magma_wildfire_trickster',
    factionId: 'magma',
    name: 'Wild Hellion',
    title: 'Unpredictable Flame',
    role: 'trickster',
    rarity: 'epic',
    stats: { power: 5, defense: 3, speed: 6, technique: 8 },
    specialAbility: 'Chaotic Blaze',
    description: 'Неконтролируемый огонь. Непредсказуем даже для союзников. [ПАССИВКА] Хаотичное пламя: Curve +25%, точность -5%.',
    assetKey: 'magma_wildfire',
    assetPath: `assets/units/magma/magma_wildfire.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xfbbf24,
    secondaryColor: 0xdc2626,
    fragmentsRequired: 10,
    nameRu: 'Дикое Пламя',
    accuracy: 0.83,
    passive: {
      type: 'risk_reward',
      name: 'Хаотичное пламя',
      description: 'Curve +25%, но точность -5%.',
      params: { value: 0.25 }
    },
  },
  {
    id: 'magma_phoenix_master',
    factionId: 'magma',
    name: 'Fireborn',
    title: 'Eternal Flame Weaver',
    role: 'trickster',
    rarity: 'legendary',
    stats: { power: 6, defense: 4, speed: 7, technique: 10 },
    specialAbility: 'Phoenix Rebirth',
    description: 'Хранитель вечного огня. Даже смерть не может его остановить. [ПАССИВКА] Возрождение феникса: Телепорт к воротам после пропущенного гола (1 раз).',
    assetKey: 'magma_phoenix',
    assetPath: `assets/units/magma/magma_fireborn.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xf59e0b,
    secondaryColor: 0xdc2626,
    fragmentsRequired: 15,
    nameRu: 'Хранитель Искры',
    accuracy: 0.86,
    passive: {
      type: 'conditional',
      name: 'Возрождение феникса',
      description: 'Один раз за матч: после пропущенного гола телепортируется к своим воротам.',
      params: { condition: 'goal_conceded' }
    },
  },
  // === BATTLE PASS SEASON 1 EXCLUSIVE ===
  {
    id: 'magma_rocket_gunner',
    factionId: 'magma',
    name: 'Rocket Gunner',
    title: 'Explosive Expert',
    role: 'sniper',
    rarity: 'epic',
    stats: { power: 5, defense: 2, speed: 4, technique: 4 },
    specialAbility: 'Rocket Barrage',
    description: 'Маленький, но смертоносный. Его ракетные удары сметают всё на пути. [ПАССИВКА] Реактивный залп: Удар отталкивает ближайшего врага.',
    assetKey: 'magma_rocket_gunner',
    assetPath: `assets/units/magma/magma_rocket_gunner.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xdc2626,
    secondaryColor: 0xf59e0b,
    fragmentsRequired: 0,
    isBattlePass: true,
    battlePassTier: 10,
    battlePassSeason: 'season_1_galactic_legends',
    nameRu: 'Ракетный Канонир',
    accuracy: 0.94,
    passive: {
      type: 'on_hit_ball',
      name: 'Реактивный залп',
      description: 'Удар по мячу: ближайший враг в радиусе 60px отталкивается назад на 30px.',
      params: { radius: 60, value: 30, target: 'enemy' }
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 🤖 CYBORG LEGION (Cybernetic Warriors)
  // ═══════════════════════════════════════════════════════════════

  // --- BALANCED (5 units) ---
  {
    id: 'cyborg_nexus_guard', // ✅ ИСПРАВЛЕНО: Изменен ID для избежания конфликта с cyborg_soldier
    factionId: 'cyborg',
    name: 'Nexus Guard',
    title: 'Logic Unit v2.0',
    role: 'balanced',
    rarity: 'common',
    stats: { power: 3, defense: 3, speed: 3, technique: 4 },
    specialAbility: 'Targeting Matrix',
    description: 'Стандартный боевой модуль. Эмоции отключены для повышения точности. [ПАССИВКА] Матрица наведения: Высокая точность без особых эффектов.',
    assetKey: 'cyborg_nexus_guard',
    assetPath: `assets/units/cyborg/cyborg_nexus_guard.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x3b82f6,
    secondaryColor: 0x1e3a8a,
    fragmentsRequired: 3,
    isStarter: true, // ✅ НОВОЕ: Стартовый юнит при получении фракции
    nameRu: 'Страж Нексуса',
    accuracy: 0.97,
    passive: {
      type: 'none',
      name: 'Матрица наведения',
      description: 'Стабильный и точный. Без слабостей.',
      params: {}
    },
  },
  {
    id: 'cyborg_trooper',
    factionId: 'cyborg',
    name: 'Circuit Breaker',
    title: 'Standard Protocol',
    role: 'balanced',
    rarity: 'common',
    stats: { power: 4, defense: 3, speed: 3, technique: 3 },
    specialAbility: 'Auto-Calibrate',
    description: 'Штурмовой модуль первой линии. Учится на ошибках. [ПАССИВКА] Автокалибровка: +5% точность после промаха.',
    assetKey: 'cyborg_trooper',
    assetPath: `assets/units/cyborg/cyborg_circuit_breaker.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x60a5fa,
    secondaryColor: 0x1e40af,
    fragmentsRequired: 3,
    isShopItem: true,
    shopPrice: 1000,
    nameRu: 'Штурмовик',
    accuracy: 0.96,
    passive: {
      type: 'conditional',
      name: 'Автокалибровка',
      description: 'После промаха: +5% точность следующего удара.',
      params: { value: 0.05, condition: 'after_miss' }
    },
  },
  {
    id: 'cyborg_enforcer',
    factionId: 'cyborg',
    name: 'Steel Fist',
    title: 'Combat Unit v4.5',
    role: 'balanced',
    rarity: 'rare',
    stats: { power: 5, defense: 4, speed: 4, technique: 5 },
    specialAbility: 'Tactical Override',
    description: 'Модуль ликвидации угроз. Его удары оставляют вмятины в любой броне. [ПАССИВКА] Стальной кулак: Замедляет врага на 20% при столкновении.',
    assetKey: 'cyborg_enforcer',
    assetPath: `assets/units/cyborg/cyborg_steel_fist.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x2563eb,
    secondaryColor: 0x93c5fd,
    fragmentsRequired: 6,
    isShopItem: true,
    shopPrice: 2500,
    nameRu: 'Ликвидатор',
    accuracy: 0.97,
    passive: {
      type: 'on_collision',
      name: 'Стальной кулак',
      description: 'Столкновение с врагом: враг замедлен на 20% на 1 ход.',
      params: { value: 0.20, duration: 1, target: 'enemy' }
    },
  },
  {
    id: 'cyborg_sentinel',
    factionId: 'cyborg',
    name: 'Omega Shield',
    title: 'Elite Guardian',
    role: 'balanced',
    rarity: 'epic',
    stats: { power: 6, defense: 5, speed: 5, technique: 6 },
    specialAbility: 'Sentinel Protocol',
    description: 'Элитный страж с продвинутыми системами защиты. [ПАССИВКА] Протокол стража: Усиленные щиты (+20% радиус, +1 ход).',
    assetKey: 'cyborg_sentinel',
    assetPath: `assets/units/cyborg/cyborg_omega_shield.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x1d4ed8,
    secondaryColor: 0x60a5fa,
    fragmentsRequired: 10,
    nameRu: 'Часовой Омега',
    accuracy: 0.98,
    passive: {
      type: 'card_enhance',
      name: 'Протокол стража',
      description: 'Карта Energy Shield: +20% радиус и +1 ход длительности.',
      params: { value: 0.20, duration: 1 }
    },
  },
  {
    id: 'cyborg_prime',
    factionId: 'cyborg',
    name: 'Nexus One',
    title: 'Perfection Achieved',
    role: 'balanced',
    rarity: 'legendary',
    stats: { power: 8, defense: 7, speed: 6, technique: 8 },
    specialAbility: 'Apex Algorithm',
    description: 'Вершина технологической эволюции. Просчитывает всё на ходы вперёд. [ПАССИВКА] Апекс-алгоритм: Видит траекторию врага. +15% сила после 3 ходов без гола.',
    assetKey: 'cyborg_prime',
    assetPath: `assets/units/cyborg/cyborg_nexus_one.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x60a5fa,
    secondaryColor: 0xfbbf24,
    fragmentsRequired: 15,
    nameRu: 'Прайм-Юнит',
    accuracy: 0.99,
    passive: {
      type: 'conditional',
      name: 'Апекс-алгоритм',
      description: 'Видит траекторию удара врага. После 3 ударов без гола: +15% сила.',
      params: { value: 0.15, condition: 'no_goal_3_turns' }
    },
  },

  // --- TANK (5 units) ---
  {
    id: 'cyborg_ironclad', // ✅ ИСПРАВЛЕНО: Изменен ID для избежания конфликта с cyborg_mech
    factionId: 'cyborg',
    name: 'Ironclad',
    title: 'Gatekeeper v9.0',
    role: 'tank',
    rarity: 'common',
    stats: { power: 4, defense: 5, speed: 2, technique: 2 },
    specialAbility: 'Energy Shield',
    description: 'Бронированная машина. Отличный блокировщик. [ПАССИВКА] Энергощит: Поглощает 10% импульса при столкновении.',
    assetKey: 'cyborg_ironclad',
    assetPath: `assets/units/cyborg/cyborg_ironclad.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x1e3a8a,
    secondaryColor: 0x60a5fa,
    fragmentsRequired: 3,
    isShopItem: true,
    shopPrice: 1500,
    nameRu: 'Броненосец',
    accuracy: 0.87,
    passive: {
      type: 'on_collision',
      name: 'Энергощит',
      description: 'При столкновении: поглощает 10% импульса врага.',
      params: { value: 0.10, target: 'enemy' }
    },
  },
  {
    id: 'cyborg_fortress',
    factionId: 'cyborg',
    name: 'Bunker Bot',
    title: 'Impenetrable Wall',
    role: 'tank',
    rarity: 'rare',
    stats: { power: 4, defense: 7, speed: 1, technique: 2 },
    specialAbility: 'Barrier Protocol',
    description: 'Мобильная крепость. На своей территории неприступен. [ПАССИВКА] Протокол бункера: +15% защита на своей половине.',
    assetKey: 'cyborg_fortress',
    assetPath: `assets/units/cyborg/cyborg_bunker_bot.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x1e40af,
    secondaryColor: 0x3b82f6,
    fragmentsRequired: 6,
    isShopItem: true,
    shopPrice: 2500,
    nameRu: 'Ходячий Бастион',
    accuracy: 0.88,
    passive: {
      type: 'conditional',
      name: 'Протокол бункера',
      description: 'Стоя на своей половине: +15% защита.',
      params: { value: 0.15, condition: 'own_half' }
    },
  },
  {
    id: 'cyborg_bulwark',
    factionId: 'cyborg',
    name: 'Titanium',
    title: 'Titanium Guardian',
    role: 'tank',
    rarity: 'rare',
    stats: { power: 5, defense: 6, speed: 2, technique: 2 },
    specialAbility: 'Reactive Armor',
    description: 'Щит из чистого титана. Каждый удар делает его крепче. [ПАССИВКА] Реактивная броня: +10% защита после удара (до +30%).',
    assetKey: 'cyborg_bulwark',
    assetPath: `assets/units/cyborg/cyborg_titanium.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x475569,
    secondaryColor: 0x60a5fa,
    fragmentsRequired: 6,
    nameRu: 'Титановый Щит',
    accuracy: 0.87,
    passive: {
      type: 'conditional',
      name: 'Реактивная броня',
      description: 'После получения удара: +10% защита на 2 хода (стакается до +30%).',
      params: { value: 0.10, duration: 2, maxStacks: 3 }
    },
  },
  {
    id: 'cyborg_colossus',
    factionId: 'cyborg',
    name: 'Megalith',
    title: 'Steel Mountain',
    role: 'tank',
    rarity: 'epic',
    stats: { power: 6, defense: 8, speed: 2, technique: 3 },
    specialAbility: 'Titan Shield',
    description: 'Колоссальная боевая машина. Его барьеры непробиваемы. [ПАССИВКА] Титановый щит: Barrier на 30% длиннее.',
    assetKey: 'cyborg_colossus',
    assetPath: `assets/units/cyborg/cyborg_megalith.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x334155,
    secondaryColor: 0x3b82f6,
    fragmentsRequired: 10,
    isShopItem: true,
    shopPrice: 5000,
    nameRu: 'Стальной Колосс',
    accuracy: 0.89,
    passive: {
      type: 'card_enhance',
      name: 'Титановый щит',
      description: 'Карта Energy Shield: +30% размер (грави-блок).',
      params: { value: 0.30, cardType: 'energy_shield' }
    },
  },
  {
    id: 'cyborg_aegis',
    factionId: 'cyborg',
    name: 'Omega Shield',
    title: 'Ultimate Defense',
    role: 'tank',
    rarity: 'legendary',
    stats: { power: 6, defense: 10, speed: 2, technique: 5 },
    specialAbility: 'Absolute Aegis',
    description: 'Абсолютная защита. Его щиты существуют одновременно в трёх измерениях. [ПАССИВКА] Абсолютный щит: Блокирует один гол за матч.',
    assetKey: 'cyborg_aegis',
    assetPath: `assets/units/cyborg/cyborg_aegis_prime.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x1e3a8a,
    secondaryColor: 0xfbbf24,
    fragmentsRequired: 15,
    nameRu: 'Система «Эгида»',
    accuracy: 0.88,
    passive: {
      type: 'conditional',
      name: 'Абсолютный щит',
      description: 'Раз в матч: блокирует гол (мяч отскакивает от линии ворот).',
      params: { condition: 'once_per_match' }
    },
  },

  // --- SNIPER (5 units) ---
  {
    id: 'cyborg_spotter', // ✅ ИСПРАВЛЕНО: Изменен ID для избежания конфликта с cyborg_drone
    factionId: 'cyborg',
    name: 'Spotter',
    title: 'Vector Calculator',
    role: 'sniper',
    rarity: 'common',
    stats: { power: 4, defense: 2, speed: 3, technique: 5 },
    specialAbility: 'Laser Lock',
    description: 'Модуль наведения. Его точность легендарна. [ПАССИВКА] Лазерный захват: Максимальная точность без эффектов.',
    assetKey: 'cyborg_spotter',
    assetPath: `assets/units/cyborg/cyborg_spotter.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x60a5fa,
    secondaryColor: 0x1e3a8a,
    fragmentsRequired: 3,
    nameRu: 'Лазерный Наводчик',
    accuracy: 0.99,
    passive: {
      type: 'none',
      name: 'Лазерный захват',
      description: 'Самый точный common. Без дополнительных эффектов.',
      params: {}
    },
  },
  {
    id: 'cyborg_marksman',
    factionId: 'cyborg',
    name: 'Railgun',
    title: 'Precision Unit',
    role: 'sniper',
    rarity: 'rare',
    stats: { power: 6, defense: 2, speed: 4, technique: 6 },
    specialAbility: 'Rail Shot',
    description: 'Снайпер с рельсовой пушкой. Идеальная точность, но меньше силы. [ПАССИВКА] Рельсовый выстрел: Точность 100%, сила -10%.',
    assetKey: 'cyborg_marksman',
    assetPath: `assets/units/cyborg/cyborg_railgun.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x3b82f6,
    secondaryColor: 0x93c5fd,
    fragmentsRequired: 6,
    nameRu: 'Рейлганнер',
    accuracy: 1.00,
    passive: {
      type: 'risk_reward',
      name: 'Рельсовый выстрел',
      description: 'Идеальная точность. Сила удара -10%.',
      params: { value: -0.10 }
    },
  },
  {
    id: 'cyborg_sharpshooter',
    factionId: 'cyborg',
    name: 'Quantum Eye',
    title: 'Perfect Aim v2.0',
    role: 'sniper',
    rarity: 'rare',
    stats: { power: 7, defense: 2, speed: 3, technique: 6 },
    specialAbility: 'Quantum Target',
    description: 'Снайпер с квантовым прицелом. На чужой территории не промахивается. [ПАССИВКА] Квантовый прицел: +10% точность на половине врага.',
    assetKey: 'cyborg_sharpshooter',
    assetPath: `assets/units/cyborg/cyborg_quantum_eye.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x2563eb,
    secondaryColor: 0x60a5fa,
    fragmentsRequired: 6,
    nameRu: 'Квантовый Снайпер',
    accuracy: 0.99,
    passive: {
      type: 'conditional',
      name: 'Квантовый прицел',
      description: 'Удар по мячу на половине врага: +10% точность.',
      params: { value: 0.10, condition: 'enemy_half' }
    },
  },
  {
    id: 'cyborg_annihilator',
    factionId: 'cyborg',
    name: 'Devastator',
    title: 'Plasma Cannon',
    role: 'sniper',
    rarity: 'epic',
    stats: { power: 8, defense: 3, speed: 4, technique: 8 },
    specialAbility: 'Plasma Lance',
    description: 'Модуль уничтожения. Его выстрелы пробивают любую защиту. [ПАССИВКА] Плазменное копьё: Мяч игнорирует первый щит.',
    assetKey: 'cyborg_annihilator',
    assetPath: `assets/units/cyborg/cyborg_devastator.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x1e40af,
    secondaryColor: 0xfbbf24,
    fragmentsRequired: 10,
    nameRu: 'Аннигилятор',
    accuracy: 0.98,
    passive: {
      type: 'on_hit_ball',
      name: 'Плазменное копьё',
      description: 'Удар по мячу: игнорирует первый щит на пути.',
      params: { target: 'ball' }
    },
  },
  {
    id: 'cyborg_omega_sniper',
    factionId: 'cyborg',
    name: 'Deadshot',
    title: 'Probability = 100%',
    role: 'sniper',
    rarity: 'legendary',
    stats: { power: 10, defense: 3, speed: 5, technique: 10 },
    specialAbility: 'Omega Strike',
    description: 'Идеальный снайпер. Ноль промахов, ноль пощады. [ПАССИВКА] Омега-удар: Точность 100%. Каждый 3-й удар +25% сила.',
    assetKey: 'cyborg_omega',
    assetPath: `assets/units/cyborg/cyborg_deadshot.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x60a5fa,
    secondaryColor: 0xf59e0b,
    fragmentsRequired: 15,
    nameRu: 'Стрелок Зеро',
    accuracy: 1.00,
    passive: {
      type: 'conditional',
      name: 'Омега-удар',
      description: 'Идеальная точность. Каждый 3-й удар: +25% сила.',
      params: { value: 0.25, condition: 'every_3rd_shot' }
    },
  },

  // --- TRICKSTER (5 units) ---
  {
    id: 'cyborg_bug', // ✅ ИСПРАВЛЕНО: Изменен ID для избежания конфликта с cyborg_glitch
    factionId: 'cyborg',
    name: 'Bug',
    title: 'Zero-Day Exploit',
    role: 'trickster',
    rarity: 'common',
    stats: { power: 3, defense: 2, speed: 4, technique: 5 },
    specialAbility: 'System Glitch',
    description: 'Ошибка в системе, ставшая оружием. [ПАССИВКА] Системный сбой: Стабильный трикстер без особых эффектов.',
    assetKey: 'cyborg_bug',
    assetPath: `assets/units/cyborg/cyborg_bug.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xa855f7,
    secondaryColor: 0x60a5fa,
    fragmentsRequired: 3,
    nameRu: 'Системный Глитч',
    accuracy: 0.92,
    passive: {
      type: 'none',
      name: 'Системный сбой',
      description: 'Базовый трикстер с хорошей точностью.',
      params: {}
    },
  },
  {
    id: 'cyborg_hacker',
    factionId: 'cyborg',
    name: 'Ghost Protocol',
    title: 'Code Breaker',
    role: 'trickster',
    rarity: 'rare',
    stats: { power: 4, defense: 2, speed: 5, technique: 6 },
    specialAbility: 'Reality Hack',
    description: 'Взломщик реальности. Искажает траектории врагов. [ПАССИВКА] Взлом реальности: 15% шанс отклонить удар врага на 10°.',
    assetKey: 'cyborg_hacker',
    assetPath: `assets/units/cyborg/cyborg_ghost_protocol.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x8b5cf6,
    secondaryColor: 0x3b82f6,
    fragmentsRequired: 6,
    nameRu: 'Взломщик',
    accuracy: 0.93,
    passive: {
      type: 'aura',
      name: 'Взлом реальности',
      description: '15% шанс: удар врага отклоняется на 10°.',
      params: { chance: 0.15, value: 10 }
    },
  },
  {
    id: 'cyborg_phantom',
    factionId: 'cyborg',
    name: 'Phase Shift',
    title: 'Ghost Protocol',
    role: 'trickster',
    rarity: 'rare',
    stats: { power: 4, defense: 3, speed: 5, technique: 6 },
    specialAbility: 'Phase Shift',
    description: 'Призрак в машине. Существует между измерениями. [ПАССИВКА] Фазовый сдвиг: 20% шанс уклониться от столкновения.',
    assetKey: 'cyborg_phantom',
    assetPath: `assets/units/cyborg/cyborg_phase_shift.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x3b82f6,
    secondaryColor: 0x6366f1,
    fragmentsRequired: 6,
    nameRu: 'Кибер-Призрак',
    accuracy: 0.94,
    passive: {
      type: 'conditional',
      name: 'Фазовый сдвиг',
      description: '20% шанс уклониться от столкновения.',
      params: { chance: 0.20 }
    },
  },
  {
    id: 'cyborg_illusionist',
    factionId: 'cyborg',
    name: 'Mirage',
    title: 'Hologram Master',
    role: 'trickster',
    rarity: 'epic',
    stats: { power: 5, defense: 3, speed: 6, technique: 8 },
    specialAbility: 'Holo Decoy',
    description: 'Мастер голограмм. Его иллюзии неотличимы от реальности. [ПАССИВКА] Голограмма: Barrier создаёт второй фейковый барьер.',
    assetKey: 'cyborg_illusionist',
    assetPath: `assets/units/cyborg/cyborg_mirage.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x60a5fa,
    secondaryColor: 0xa855f7,
    fragmentsRequired: 10,
    nameRu: 'Проектор',
    accuracy: 0.95,
    passive: {
      type: 'card_enhance',
      name: 'Голограмма',
      description: 'Карта Barrier: создаёт 2 барьера вместо 1 (второй — фейк).',
      params: {}
    },
  },
  {
    id: 'cyborg_quantum',
    factionId: 'cyborg',
    name: 'Schrodinger',
    title: 'Superposition Master',
    role: 'trickster',
    rarity: 'legendary',
    stats: { power: 6, defense: 4, speed: 7, technique: 10 },
    specialAbility: 'Quantum Superposition',
    description: 'Квантовая аномалия. Существует во всех местах одновременно. [ПАССИВКА] Квантовая суперпозиция: 40% телепорт после удара.',
    assetKey: 'cyborg_quantum',
    assetPath: `assets/units/cyborg/cyborg_schrodinger.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x818cf8,
    secondaryColor: 0xfbbf24,
    fragmentsRequired: 15,
    nameRu: 'Аномалия',
    accuracy: 0.90,
    passive: {
      type: 'risk_reward',
      name: 'Квантовая суперпозиция',
      description: 'После удара: 40% шанс телепортироваться в случайное место своей половины.',
      params: { chance: 0.40 }
    },
  },
  // === BATTLE PASS SEASON 1 EXCLUSIVE ===
  {
    id: 'cyborg_iron_sentinel',
    factionId: 'cyborg',
    name: 'Iron Sentinel',
    title: 'Armored Guardian',
    role: 'tank',
    rarity: 'rare',
    stats: { power: 3, defense: 5, speed: 2, technique: 3 },
    specialAbility: 'Repulsor Shield',
    description: 'Страж из легированной стали. Его системы очистки нейтрализуют любой яд. [ПАССИВКА] Антитоксин: Иммунитет к замедлению и стану.',
    assetKey: 'cyborg_iron_sentinel',
    assetPath: `assets/units/cyborg/cyborg_iron_sentinel.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x3b82f6,
    secondaryColor: 0x1e3a8a,
    fragmentsRequired: 0, // Нельзя собрать из фрагментов
    isBattlePass: true,
    battlePassTier: 5,
    battlePassSeason: 'season_1_galactic_legends',
    nameRu: 'Железный Дозорный',
    accuracy: 0.88,
    passive: {
      type: 'counter',
      name: 'Антитоксин',
      description: 'Иммунитет к замедлению и стану от Insect.',
      params: { target: 'self' }
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 🌌 VOID COLLECTIVE (Cosmic Entities)
  // ═══════════════════════════════════════════════════════════════

  // --- BALANCED (5 units) ---
  {
    id: 'void_duskblade', // ✅ ИСПРАВЛЕНО: Изменен ID для избежания конфликта с void_initiate
    factionId: 'void',
    name: 'Duskblade',
    title: 'Shadow Dancer',
    role: 'balanced',
    rarity: 'common',
    stats: { power: 3, defense: 2, speed: 4, technique: 4 },
    specialAbility: 'Phase Shift',
    description: 'Воительница сумрака. Её клинок рассекает саму тьму. [ПАССИВКА] Сумеречный клинок: Стабильная точность без эффектов.',
    assetKey: 'void_duskblade',
    assetPath: `assets/units/void/void_duskblade.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x6366f1,
    secondaryColor: 0x1e1b4b,
    fragmentsRequired: 3,
    isStarter: true, // ✅ НОВОЕ: Стартовый юнит при получении фракции
    nameRu: 'Клинок Сумрака',
    accuracy: 0.94,
    passive: {
      type: 'none',
      name: 'Сумеречный клинок',
      description: 'Стабильный боец с хорошей точностью.',
      params: {}
    },
  },
  {
    id: 'void_acolyte',
    factionId: 'void',
    name: 'Twilight',
    title: 'Darkness Apprentice',
    role: 'balanced',
    rarity: 'common',
    stats: { power: 4, defense: 3, speed: 4, technique: 3 },
    specialAbility: 'Void Touch',
    description: 'Жрица пустоты. Её прикосновение высасывает силы. [ПАССИВКА] Касание бездны: 10% шанс замедлить врага.',
    assetKey: 'void_acolyte',
    assetPath: `assets/units/void/void_twilight.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x4f46e5,
    secondaryColor: 0x312e81,
    fragmentsRequired: 3,
    isShopItem: true,
    shopPrice: 1000,
    nameRu: 'Аколит Бездны',
    accuracy: 0.93,
    passive: {
      type: 'on_collision',
      name: 'Касание бездны',
      description: 'При столкновении с врагом: 10% шанс замедлить на 10%.',
      params: { chance: 0.10, value: 0.10, target: 'enemy' }
    },
  },
  {
    id: 'void_phantom_warrior',
    factionId: 'void',
    name: 'Shade',
    title: 'Ethereal Fighter',
    role: 'balanced',
    rarity: 'rare',
    stats: { power: 5, defense: 3, speed: 5, technique: 5 },
    specialAbility: 'Ethereal Strike',
    description: 'Валькирия из мира теней. Удар по ней — удар по воздуху. [ПАССИВКА] Эфирный удар: 20% шанс уклониться от столкновения.',
    assetKey: 'void_phantom_warrior',
    assetPath: `assets/units/void/void_shade.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x818cf8,
    secondaryColor: 0x4338ca,
    fragmentsRequired: 6,
    isShopItem: true,
    shopPrice: 2500,
    nameRu: 'Теневая Валькирия',
    accuracy: 0.95,
    passive: {
      type: 'conditional',
      name: 'Эфирный удар',
      description: '20% шанс уклониться от столкновения с врагом.',
      params: { chance: 0.20 }
    },
  },
  {
    id: 'void_eclipse',
    factionId: 'void',
    name: 'Darkstar',
    title: 'Cosmic Duelist',
    role: 'balanced',
    rarity: 'epic',
    stats: { power: 6, defense: 5, speed: 5, technique: 6 },
    specialAbility: 'Eclipse Nova',
    description: 'Воплощение затмения. В её присутствии свет умирает. [ПАССИВКА] Затмение: Порталы притягивают мяч в радиусе 30px.',
    assetKey: 'void_eclipse',
    assetPath: `assets/units/void/void_darkstar.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x312e81,
    secondaryColor: 0xfbbf24,
    fragmentsRequired: 10,
    nameRu: 'Эклипса',
    accuracy: 0.96,
    passive: {
      type: 'card_enhance',
      name: 'Затмение',
      description: 'Карта Wormhole: порталы притягивают мяч в радиусе 30px.',
      params: { radius: 30 }
    },
  },
  {
    id: 'void_sovereign',
    factionId: 'void',
    name: 'Oblivion',
    title: 'Master of Nothing',
    role: 'balanced',
    rarity: 'legendary',
    stats: { power: 8, defense: 6, speed: 6, technique: 8 },
    specialAbility: 'Void Dominion',
    description: 'Владычица забвения. Её взгляд заставляет забыть всё. [ПАССИВКА] Доминион пустоты: Враги в радиусе 80px теряют 10% точности.',
    assetKey: 'void_sovereign',
    assetPath: `assets/units/void/void_oblivion.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x1e1b4b,
    secondaryColor: 0xa855f7,
    fragmentsRequired: 15,
    nameRu: 'Владычица Мрака',
    accuracy: 0.94,
    passive: {
      type: 'aura',
      name: 'Доминион пустоты',
      description: 'Аура: враги в радиусе 80px теряют 10% точности.',
      params: { radius: 80, value: 0.10, target: 'enemy' }
    },
  },

  // --- TANK (5 units) ---
  {
    id: 'void_abyssal', // ✅ ИСПРАВЛЕНО: Изменен ID для избежания конфликта с void_guardian
    factionId: 'void',
    name: 'Abyssal',
    title: 'Event Horizon',
    role: 'tank',
    rarity: 'common',
    stats: { power: 3, defense: 5, speed: 2, technique: 3 },
    specialAbility: 'Void Absorption',
    description: 'Существо из глубин бездны. Поглощает всё на своём пути. [ПАССИВКА] Поглощение бездны: Поглощает 15% импульса мяча.',
    assetKey: 'void_abyssal',
    assetPath: `assets/units/void/void_abyssal.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x4338ca,
    secondaryColor: 0x818cf8,
    fragmentsRequired: 3,
    isShopItem: true,
    shopPrice: 1500,
    nameRu: 'Абиссал',
    accuracy: 0.84,
    passive: {
      type: 'on_collision',
      name: 'Поглощение бездны',
      description: 'При столкновении: поглощает 15% импульса мяча.',
      params: { value: 0.15, target: 'ball' }
    },
  },
  {
    id: 'void_anchor',
    factionId: 'void',
    name: 'Gravity Well',
    title: 'Gravity Well',
    role: 'tank',
    rarity: 'rare',
    stats: { power: 4, defense: 7, speed: 1, technique: 2 },
    specialAbility: 'Graviton Shield',
    description: 'Монолит из чистой тьмы. Его гравитация искривляет траектории. [ПАССИВКА] Гравитационный колодец: Мяч замедляется в радиусе 50px.',
    assetKey: 'void_anchor',
    assetPath: `assets/units/void/void_gravity_well.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x312e81,
    secondaryColor: 0x6366f1,
    fragmentsRequired: 6,
    isShopItem: true,
    shopPrice: 2500,
    nameRu: 'Чёрный Монолит',
    accuracy: 0.85,
    passive: {
      type: 'aura',
      name: 'Гравитационный колодец',
      description: 'Мяч в радиусе 50px замедляется на 20%.',
      params: { radius: 50, value: 0.20, target: 'ball' }
    },
  },
  {
    id: 'void_bastion',
    factionId: 'void',
    name: 'Rift Guard',
    title: 'Dimensional Fortress',
    role: 'tank',
    rarity: 'rare',
    stats: { power: 5, defense: 6, speed: 2, technique: 2 },
    specialAbility: 'Void Barrier',
    description: 'Хранитель измерений. Его защита усиливается при разломе реальности. [ПАССИВКА] Барьер разлома: +25% защита после Swap.',
    assetKey: 'void_bastion',
    assetPath: `assets/units/void/void_rift_guard.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x4f46e5,
    secondaryColor: 0x1e1b4b,
    fragmentsRequired: 6,
    nameRu: 'Хранитель Разлома',
    accuracy: 0.84,
    passive: {
      type: 'conditional',
      name: 'Барьер разлома',
      description: 'После использования Swap: +25% защита на 2 хода.',
      params: { value: 0.25, duration: 2, condition: 'after_swap' }
    },
  },
  {
    id: 'void_colossus',
    factionId: 'void',
    name: 'Black Hole',
    title: 'Cosmic Titan',
    role: 'tank',
    rarity: 'epic',
    stats: { power: 6, defense: 8, speed: 2, technique: 4 },
    specialAbility: 'Cosmic Armor',
    description: 'Пожиратель планет. Его гравитация втягивает всё вокруг. [ПАССИВКА] Космическая броня: Притягивает мяч в радиусе 60px.',
    assetKey: 'void_colossus',
    assetPath: `assets/units/void/void_black_hole.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x1e1b4b,
    secondaryColor: 0x818cf8,
    fragmentsRequired: 10,
    isShopItem: true,
    shopPrice: 5000,
    nameRu: 'Пожиратель Миров',
    accuracy: 0.86,
    passive: {
      type: 'aura',
      name: 'Космическая броня',
      description: 'При защите ворот: притягивает мяч к себе в радиусе 60px.',
      params: { radius: 60, condition: 'defending' }
    },
  },
  {
    id: 'void_singularity',
    factionId: 'void',
    name: 'Entropy',
    title: 'Black Hole Guardian',
    role: 'tank',
    rarity: 'legendary',
    stats: { power: 7, defense: 10, speed: 2, technique: 5 },
    specialAbility: 'Event Horizon',
    description: 'Коллапсирующая звезда. Из его гравитации не вырваться. [ПАССИВКА] Горизонт событий: Враги теряют 15% скорости на 2 хода.',
    assetKey: 'void_singularity',
    assetPath: `assets/units/void/void_entropy.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x000000,
    secondaryColor: 0xa855f7,
    fragmentsRequired: 15,
    nameRu: 'Коллапсар',
    accuracy: 0.85,
    passive: {
      type: 'on_collision',
      name: 'Горизонт событий',
      description: 'Враги, столкнувшиеся с ним, теряют 15% скорости на 2 хода.',
      params: { value: 0.15, duration: 2, target: 'enemy' }
    },
  },

  // --- SNIPER (5 units) ---
  {
    id: 'void_nightfall', // ✅ ИСПРАВЛЕНО: Изменен ID для избежания конфликта с void_sniper
    factionId: 'void',
    name: 'Nightfall',
    title: 'Entropy Agent',
    role: 'sniper',
    rarity: 'common',
    stats: { power: 4, defense: 2, speed: 3, technique: 5 },
    specialAbility: 'Temporal Shot',
    description: 'Охотник ночи. Его выстрелы неслышны и смертоносны. [ПАССИВКА] Темпоральный выстрел: Высокая точность без эффектов.',
    assetKey: 'void_nightfall',
    assetPath: `assets/units/void/void_nightfall.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x6366f1,
    secondaryColor: 0x1e1b4b,
    fragmentsRequired: 3,
    nameRu: 'Ночной Охотник',
    accuracy: 0.97,
    passive: {
      type: 'none',
      name: 'Темпоральный выстрел',
      description: 'Точный снайпер. Без особых эффектов.',
      params: {}
    },
  },
  {
    id: 'void_void_marksman',
    factionId: 'void',
    name: 'Voidbolt',
    title: 'Precision in Chaos',
    role: 'sniper',
    rarity: 'rare',
    stats: { power: 6, defense: 2, speed: 4, technique: 6 },
    specialAbility: 'Chaos Shot',
    description: 'Стрелок из пустоты. Его выстрелы искривляют пространство. [ПАССИВКА] Хаотичный выстрел: 25% шанс телепорта мяча на 50px.',
    assetKey: 'void_marksman',
    assetPath: `assets/units/void/void_voidbolt.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x4f46e5,
    secondaryColor: 0xa855f7,
    fragmentsRequired: 6,
    nameRu: 'Стрелок Пустоты',
    accuracy: 0.98,
    passive: {
      type: 'on_hit_ball',
      name: 'Хаотичный выстрел',
      description: '25% шанс: мяч телепортируется на 50px вперёд после удара.',
      params: { chance: 0.25, value: 50 }
    },
  },
  {
    id: 'void_astral_shooter',
    factionId: 'void',
    name: 'Starshot',
    title: 'Starlight Striker',
    role: 'sniper',
    rarity: 'rare',
    stats: { power: 7, defense: 2, speed: 3, technique: 6 },
    specialAbility: 'Astral Lance',
    description: 'Лучница звёздного света. На чужой территории её стрелы смертоносны. [ПАССИВКА] Астральное копьё: +15% сила на половине врага.',
    assetKey: 'void_astral',
    assetPath: `assets/units/void/void_starshot.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x818cf8,
    secondaryColor: 0xfbbf24,
    fragmentsRequired: 6,
    nameRu: 'Астральная Лучница',
    accuracy: 0.97,
    passive: {
      type: 'conditional',
      name: 'Астральное копьё',
      description: 'Удар на половине врага: +15% сила.',
      params: { value: 0.15, condition: 'enemy_half' }
    },
  },
  {
    id: 'void_nebula_sniper',
    factionId: 'void',
    name: 'Cosmos',
    title: 'Cosmic Precision',
    role: 'sniper',
    rarity: 'epic',
    stats: { power: 8, defense: 3, speed: 4, technique: 8 },
    specialAbility: 'Nebula Burst',
    description: 'Дочь туманности. После успеха её точность возрастает. [ПАССИВКА] Вспышка туманности: +20% точность после гола.',
    assetKey: 'void_nebula',
    assetPath: `assets/units/void/void_cosmos.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xa855f7,
    secondaryColor: 0x4f46e5,
    fragmentsRequired: 10,
    nameRu: 'Небула',
    accuracy: 0.99,
    passive: {
      type: 'conditional',
      name: 'Вспышка туманности',
      description: 'После гола: следующий удар имеет +20% точность.',
      params: { value: 0.20, condition: 'after_goal' }
    },
  },
  {
    id: 'void_quasar_striker',
    factionId: 'void',
    name: 'Pulsar',
    title: 'Galaxy Destroyer',
    role: 'sniper',
    rarity: 'legendary',
    stats: { power: 10, defense: 3, speed: 5, technique: 10 },
    specialAbility: 'Quasar Beam',
    description: 'Вестник квазара. Его лучи пронзают любую преграду. [ПАССИВКА] Луч квазара: Каждый 2-й удар проходит сквозь врага.',
    assetKey: 'void_quasar',
    assetPath: `assets/units/void/void_pulsar.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xfbbf24,
    secondaryColor: 0x6366f1,
    fragmentsRequired: 15,
    nameRu: 'Квазар',
    accuracy: 0.96,
    passive: {
      type: 'on_hit_ball',
      name: 'Луч квазара',
      description: 'Каждый 2-й удар: мяч проходит сквозь первого врага.',
      params: { condition: 'every_2nd_shot' }
    },
  },

  // --- TRICKSTER (5 units) ---
  {
    id: 'void_mindbend', // ✅ ИСПРАВЛЕНО: Изменен ID для избежания конфликта с void_bender
    factionId: 'void',
    name: 'Mindbend',
    title: 'Space Warper',
    role: 'trickster',
    rarity: 'common',
    stats: { power: 3, defense: 2, speed: 4, technique: 5 },
    specialAbility: 'Reality Warp',
    description: 'Госпожа кошмаров. Её взгляд сводит с ума. [ПАССИВКА] Искривление разума: Curve +15%.',
    assetKey: 'void_mindbend',
    assetPath: `assets/units/void/void_mindbend.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xa855f7,
    secondaryColor: 0x4f46e5,
    fragmentsRequired: 3,
    nameRu: 'Госпожа Кошмаров',
    accuracy: 0.89,
    passive: {
      type: 'stat_boost',
      name: 'Искривление разума',
      description: 'Curve +15%. Базовый трикстер.',
      params: { value: 0.15 }
    },
  },
  {
    id: 'void_trickster',
    factionId: 'void',
    name: 'Portal',
    title: 'Cosmic Jester',
    role: 'trickster',
    rarity: 'rare',
    stats: { power: 4, defense: 2, speed: 5, technique: 6 },
    specialAbility: 'Dimensional Trick',
    description: 'Повелительница порталов. Её трюки нарушают законы физики. [ПАССИВКА] Измерительный трюк: Swap работает с одним союзником и мячом.',
    assetKey: 'void_trickster',
    assetPath: `assets/units/void/void_portal.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x6366f1,
    secondaryColor: 0xa855f7,
    fragmentsRequired: 6,
    nameRu: 'Заклинательница Порталов',
    accuracy: 0.90,
    passive: {
      type: 'card_enhance',
      name: 'Измерительный трюк',
      description: 'Карта Swap: можно использовать на 1 союзника (меняет его с мячом).',
      params: {}
    },
  },
  {
    id: 'void_mirage',
    factionId: 'void',
    name: 'Echo',
    title: 'Phantom Illusionist',
    role: 'trickster',
    rarity: 'rare',
    stats: { power: 4, defense: 3, speed: 5, technique: 6 },
    specialAbility: 'Phantom Clone',
    description: 'Призрачное эхо. Никто не знает, где она на самом деле. [ПАССИВКА] Фантомный клон: 20% шанс показать ложную позицию.',
    assetKey: 'void_mirage',
    assetPath: `assets/units/void/void_echo.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x818cf8,
    secondaryColor: 0x312e81,
    fragmentsRequired: 6,
    nameRu: 'Мираж',
    accuracy: 0.91,
    passive: {
      type: 'on_hit_ball',
      name: 'Фантомный клон',
      description: 'После удара: 20% шанс создать "эхо" — враг видит ложную позицию.',
      params: { chance: 0.20 }
    },
  },
  {
    id: 'void_paradox',
    factionId: 'void',
    name: 'Timeloop',
    title: 'Time Anomaly',
    role: 'trickster',
    rarity: 'epic',
    stats: { power: 5, defense: 3, speed: 6, technique: 8 },
    specialAbility: 'Temporal Paradox',
    description: 'Парадокс времени. Может переписать прошлое. [ПАССИВКА] Временной парадокс: Отмена последнего хода (1 раз за матч).',
    assetKey: 'void_paradox',
    assetPath: `assets/units/void/void_timeloop.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x4f46e5,
    secondaryColor: 0xfbbf24,
    fragmentsRequired: 10,
    nameRu: 'Парадокс',
    accuracy: 0.92,
    passive: {
      type: 'conditional',
      name: 'Временной парадокс',
      description: 'Раз в матч: отменить свой последний ход.',
      params: { condition: 'once_per_match' }
    },
  },
  {
    id: 'void_entropy',
    factionId: 'void',
    name: 'Chaos Lord',
    title: 'Chaos Incarnate',
    role: 'trickster',
    rarity: 'legendary',
    stats: { power: 6, defense: 4, speed: 7, technique: 10 },
    specialAbility: 'Entropy Storm',
    description: 'Воплощение хаоса. Законы физики перестают работать в его присутствии. [ПАССИВКА] Шторм энтропии: 30% шанс телепортировать случайного врага.',
    assetKey: 'void_entropy',
    assetPath: `assets/units/void/void_chaos_lord.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xa855f7,
    secondaryColor: 0x1e1b4b,
    fragmentsRequired: 15,
    nameRu: 'Энтропия',
    accuracy: 0.87,
    passive: {
      type: 'risk_reward',
      name: 'Шторм энтропии',
      description: 'Удар по мячу: 30% шанс телепортировать случайного врага на случайное место.',
      params: { chance: 0.30, target: 'enemy' }
    },
  },
  // === BATTLE PASS SEASON 1 EXCLUSIVE ===
  {
    id: 'void_chaos_witch',
    factionId: 'void',
    name: 'Chaos Witch',
    title: 'Reality Bender',
    role: 'trickster',
    rarity: 'legendary',
    stats: { power: 4, defense: 3, speed: 4, technique: 6 },
    specialAbility: 'Chaos Magic',
    description: 'Повелительница хаоса, изгибающая реальность. Её магия непредсказуема. [ПАССИВКА] Магия хаоса: Все % эффекты удвоены.',
    assetKey: 'void_chaos_witch',
    assetPath: `assets/units/void/void_chaos_witch.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xa855f7,
    secondaryColor: 0xf59e0b,
    fragmentsRequired: 0,
    isBattlePass: true,
    battlePassTier: 30,
    battlePassSeason: 'season_1_galactic_legends',
    nameRu: 'Ведьма Хаоса',
    accuracy: 0.88,
    passive: {
      type: 'risk_reward',
      name: 'Магия хаоса',
      description: 'Все % эффекты удвоены (и позитивные, и негативные).',
      params: { value: 2.0 }
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 🐜 INSECT SWARM (Hive Mind)
  // ═══════════════════════════════════════════════════════════════

  // --- BALANCED (5 units) ---
  {
    id: 'insect_scuttle', // ✅ ИСПРАВЛЕНО: Изменен ID для избежания конфликта с insect_drone
    factionId: 'insect',
    name: 'Scuttle',
    title: 'Hive Link',
    role: 'balanced',
    rarity: 'common',
    stats: { power: 3, defense: 2, speed: 5, technique: 3 },
    specialAbility: 'Swarm Speed',
    description: 'Разведчик роя. Быстрее вместе с собратьями. [ПАССИВКА] Скорость роя: +10% скорость рядом с союзником Insect.',
    assetKey: 'insect_scuttle',
    assetPath: `assets/units/insect/insect_scuttle.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x84cc16,
    secondaryColor: 0x365314,
    fragmentsRequired: 3,
    isStarter: true, // ✅ НОВОЕ: Стартовый юнит при получении фракции
    nameRu: 'Скарабей',
    accuracy: 0.92,
    passive: {
      type: 'aura',
      name: 'Скорость роя',
      description: '+10% скорость, если рядом союзник Insect.',
      params: { value: 0.10, radius: 80, condition: 'ally_nearby' }
    },
  },
  {
    id: 'insect_worker',
    factionId: 'insect',
    name: 'Crawler',
    title: 'Collective Unit',
    role: 'balanced',
    rarity: 'common',
    stats: { power: 4, defense: 3, speed: 4, technique: 3 },
    specialAbility: 'Hive Mind',
    description: 'Связной улья. Если один видит мяч — его видят все. [ПАССИВКА] Разум улья: Видит радиус способностей союзников.',
    assetKey: 'insect_worker',
    assetPath: `assets/units/insect/insect_crawler.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x65a30d,
    secondaryColor: 0x3f6212,
    fragmentsRequired: 3,
    isShopItem: true,
    shopPrice: 1000,
    nameRu: 'Трутень',
    accuracy: 0.91,
    passive: {
      type: 'none',
      name: 'Разум улья',
      description: 'Видит радиус действия способностей союзников.',
      params: {}
    },
  },
  {
    id: 'insect_soldier',
    factionId: 'insect',
    name: 'Razor',
    title: 'Battle Drone',
    role: 'balanced',
    rarity: 'rare',
    stats: { power: 5, defense: 4, speed: 5, technique: 4 },
    specialAbility: 'Coordinated Strike',
    description: 'Боевой дрон улья. Действует в идеальной координации с роем. [ПАССИВКА] Координированный удар: +10% сила после удара союзника.',
    assetKey: 'insect_soldier',
    assetPath: `assets/units/insect/insect_razor.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x84cc16,
    secondaryColor: 0xa3e635,
    fragmentsRequired: 6,
    isShopItem: true,
    shopPrice: 2500,
    nameRu: 'Солдат Улья',
    accuracy: 0.93,
    passive: {
      type: 'conditional',
      name: 'Координированный удар',
      description: 'После удара союзника Insect: +10% сила на 1 ход.',
      params: { value: 0.10, duration: 1, condition: 'ally_hit' }
    },
  },
  {
    id: 'insect_elite_warrior',
    factionId: 'insect',
    name: 'Hunter-Killer',
    title: 'Apex Hunter',
    role: 'balanced',
    rarity: 'epic',
    stats: { power: 6, defense: 5, speed: 6, technique: 5 },
    specialAbility: 'Hunter Protocol',
    description: 'Элитный охотник улья. Первый удар — самый смертоносный. [ПАССИВКА] Протокол охотника: +20% сила на первый удар.',
    assetKey: 'insect_elite',
    assetPath: `assets/units/insect/insect_hunter_killer.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x65a30d,
    secondaryColor: 0xfacc15,
    fragmentsRequired: 10,
    nameRu: 'Преторианец',
    accuracy: 0.94,
    passive: {
      type: 'conditional',
      name: 'Протокол охотника',
      description: 'Первый удар по мячу в раунде: +20% сила.',
      params: { value: 0.20, condition: 'first_hit' }
    },
  },
  {
    id: 'insect_queen_guard',
    factionId: 'insect',
    name: 'Queen\'s Guard',
    title: 'Royal Protector',
    role: 'balanced',
    rarity: 'legendary',
    stats: { power: 8, defense: 7, speed: 6, technique: 7 },
    specialAbility: 'Royal Command',
    description: 'Личная гвардия королевы. Совершенство эволюции улья. [ПАССИВКА] Королевский приказ: +5% статы союзникам Insect в радиусе.',
    assetKey: 'insect_queen_guard',
    assetPath: `assets/units/insect/insect_praetorian.png?v=${ASSETS_VERSION}`, // Используем praetorian как queen_guard
    primaryColor: 0xfacc15,
    secondaryColor: 0x84cc16,
    fragmentsRequired: 15,
    nameRu: 'Гвардеец Королевы',
    accuracy: 0.93,
    passive: {
      type: 'aura',
      name: 'Королевский приказ',
      description: 'Аура: союзники Insect в радиусе 100px получают +5% ко всем статам.',
      params: { radius: 100, value: 0.05 }
    },
  },

  // --- TANK (5 units) ---
  {
    id: 'insect_carapace', // ✅ ИСПРАВЛЕНО: Изменен ID для избежания конфликта с insect_brood
    factionId: 'insect',
    name: 'Carapace',
    title: 'Chitin Guard',
    role: 'tank',
    rarity: 'common',
    stats: { power: 4, defense: 5, speed: 1, technique: 2 },
    specialAbility: 'Adaptive Armor',
    description: 'Живой панцирь улья. Адаптируется к любой угрозе. [ПАССИВКА] Адаптивная броня: +10% защита после удара.',
    assetKey: 'insect_carapace',
    assetPath: `assets/units/insect/insect_carapace.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x365314,
    secondaryColor: 0x84cc16,
    fragmentsRequired: 3,
    isShopItem: true,
    shopPrice: 1500,
    nameRu: 'Живой Панцирь',
    accuracy: 0.82,
    passive: {
      type: 'conditional',
      name: 'Адаптивная броня',
      description: 'После получения удара: +10% защита на 1 ход.',
      params: { value: 0.10, duration: 1, condition: 'after_hit' }
    },
  },
  {
    id: 'insect_chitin',
    factionId: 'insect',
    name: 'Chitin',
    title: 'Shell Fortress',
    role: 'tank',
    rarity: 'rare',
    stats: { power: 4, defense: 7, speed: 1, technique: 2 },
    specialAbility: 'Hardened Shell',
    description: 'Страж из хитина. Вместе с союзниками непробиваем. [ПАССИВКА] Укреплённый панцирь: +15% защита при союзнике рядом.',
    assetKey: 'insect_chitin',
    assetPath: `assets/units/insect/insect_chitin.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x3f6212,
    secondaryColor: 0x65a30d,
    fragmentsRequired: 6,
    isShopItem: true,
    shopPrice: 2500,
    nameRu: 'Хитиновый Страж',
    accuracy: 0.83,
    passive: {
      type: 'aura',
      name: 'Укреплённый панцирь',
      description: 'Стоя рядом с союзником: +15% защита обоим.',
      params: { value: 0.15, radius: 60 }
    },
  },
  {
    id: 'insect_titan_beetle',
    factionId: 'insect',
    name: 'Colossus Bug',
    title: 'Armored Colossus',
    role: 'tank',
    rarity: 'rare',
    stats: { power: 5, defense: 6, speed: 2, technique: 2 },
    specialAbility: 'Titanium Exo',
    description: 'Бронированный колосс. Размером с небольшой танк.',
    assetKey: 'insect_titan_beetle',
    assetPath: `assets/units/insect/insect_colossus_bug.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x44403c,
    secondaryColor: 0x84cc16,
    fragmentsRequired: 6,
    nameRu: 'Колосс Жук',
    accuracy: 0.75,
    passive: {
      type: 'none',
      name: '',
      description: '',
      params: {}
    },
  },
  {
    id: 'insect_behemoth',
    factionId: 'insect',
    name: 'Leviathan',
    title: 'Living Mountain',
    role: 'tank',
    rarity: 'epic',
    stats: { power: 6, defense: 8, speed: 2, technique: 3 },
    specialAbility: 'Bio-Fortress',
    description: 'Левиафан роя. При защите гнезда становится неподвижной крепостью. [ПАССИВКА] Био-крепость: +30% масса при защите ворот.',
    assetKey: 'insect_behemoth',
    assetPath: `assets/units/insect/insect_leviathan.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x365314,
    secondaryColor: 0xa3e635,
    fragmentsRequired: 10,
    isShopItem: true,
    shopPrice: 5000,
    nameRu: 'Бегемот Роя',
    accuracy: 0.85,
    passive: {
      type: 'conditional',
      name: 'Био-крепость',
      description: 'При защите ворот: масса +30%.',
      params: { value: 0.30, condition: 'defending' }
    },
  },
  {
    id: 'insect_empress_shell',
    factionId: 'insect',
    name: 'Immortal',
    title: 'Eternal Defender',
    role: 'tank',
    rarity: 'legendary',
    stats: { power: 6, defense: 10, speed: 2, technique: 5 },
    specialAbility: 'Empress Aegis',
    description: 'Эгида улья. Последняя линия обороны королевы. [ПАССИВКА] Щит императрицы: Блокирует один гол за матч.',
    assetKey: 'insect_empress',
    assetPath: `assets/units/insect/insect_immortal.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xfacc15,
    secondaryColor: 0x365314,
    fragmentsRequired: 15,
    nameRu: 'Эгида Улья',
    accuracy: 0.83,
    passive: {
      type: 'conditional',
      name: 'Щит императрицы',
      description: 'Раз в матч: поглощает удар, который забил бы гол.',
      params: { condition: 'once_per_match' }
    },
  },

  // --- SNIPER (5 units) ---
  {
    id: 'insect_venom', // ✅ ИСПРАВЛЕНО: Изменен ID для избежания конфликта с insect_spitter
    factionId: 'insect',
    name: 'Venom',
    title: 'Toxin Injector',
    role: 'sniper',
    rarity: 'common',
    stats: { power: 5, defense: 1, speed: 3, technique: 4 },
    specialAbility: 'Corrosive Shot',
    description: 'Плевальщик кислотой. Его слюна разъедает всё. [ПАССИВКА] Коррозийный выстрел: Мяч замедляет первого врага на 10%.',
    assetKey: 'insect_venom',
    assetPath: `assets/units/insect/insect_venom.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x84cc16,
    secondaryColor: 0x10b981,
    fragmentsRequired: 3,
    nameRu: 'Плевальщик',
    accuracy: 0.95,
    passive: {
      type: 'on_hit_ball',
      name: 'Коррозийный выстрел',
      description: 'Удар по мячу: мяч замедляет первого врага на 10%.',
      params: { value: 0.10, target: 'enemy' }
    },
  },
  {
    id: 'insect_sniper_bug',
    factionId: 'insect',
    name: 'Stinger',
    title: 'Silent Striker',
    role: 'sniper',
    rarity: 'rare',
    stats: { power: 6, defense: 2, speed: 4, technique: 6 },
    specialAbility: 'Venom Strike',
    description: 'Снайпер улья. Его жало несёт смертельный яд. [ПАССИВКА] Ядовитый укус: Neurotoxin действует дольше.',
    assetKey: 'insect_sniper_bug',
    assetPath: `assets/units/insect/insect_stinger.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x65a30d,
    secondaryColor: 0xa3e635,
    fragmentsRequired: 6,
    nameRu: 'Жало',
    accuracy: 0.96,
    passive: {
      type: 'card_enhance',
      name: 'Ядовитый укус',
      description: 'Карта Neurotoxin: стан +0.5 хода.',
      params: { value: 0.5 }
    },
  },
  {
    id: 'insect_mantis_striker',
    factionId: 'insect',
    name: 'Reaper',
    title: 'Bladed Assassin',
    role: 'sniper',
    rarity: 'rare',
    stats: { power: 7, defense: 2, speed: 3, technique: 6 },
    specialAbility: 'Blade Slash',
    description: 'Богомол-убийца. После успешной охоты становится ещё опаснее. [ПАССИВКА] Удар лезвия: +15% скорость после гола.',
    assetKey: 'insect_mantis',
    assetPath: `assets/units/insect/insect_reaper.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x3f6212,
    secondaryColor: 0xfacc15,
    fragmentsRequired: 6,
    nameRu: 'Богомол-Жнец',
    accuracy: 0.95,
    passive: {
      type: 'conditional',
      name: 'Удар лезвия',
      description: 'После гола: +15% скорость на 2 хода.',
      params: { value: 0.15, duration: 2, condition: 'after_goal' }
    },
  },
  {
    id: 'insect_wasp_hunter',
    factionId: 'insect',
    name: 'Hornet',
    title: 'Sky Predator',
    role: 'sniper',
    rarity: 'epic',
    stats: { power: 8, defense: 3, speed: 4, technique: 8 },
    specialAbility: 'Stinger Barrage',
    description: 'Оса-охотник. Её жало находит цель даже после рикошета. [ПАССИВКА] Залп жала: 25% шанс рикошета к воротам.',
    assetKey: 'insect_wasp',
    assetPath: `assets/units/insect/insect_hornet.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xfacc15,
    secondaryColor: 0x44403c,
    fragmentsRequired: 10,
    nameRu: 'Оса-Убийца',
    accuracy: 0.97,
    passive: {
      type: 'on_hit_ball',
      name: 'Залп жала',
      description: 'Удар по мячу: 25% шанс — мяч отскочит от первого врага в сторону ворот.',
      params: { chance: 0.25 }
    },
  },
  {
    id: 'insect_apex_predator',
    factionId: 'insect',
    name: 'Alpha',
    title: 'Evolution Peak',
    role: 'sniper',
    rarity: 'legendary',
    stats: { power: 10, defense: 3, speed: 5, technique: 10 },
    specialAbility: 'Perfect Hunt',
    description: 'Вершина эволюции улья. Совершенный хищник. [ПАССИВКА] Идеальная охота: Neurotoxin бьёт по всем врагам в радиусе.',
    assetKey: 'insect_apex',
    assetPath: `assets/units/insect/insect_alpha.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xfacc15,
    secondaryColor: 0x84cc16,
    fragmentsRequired: 15,
    nameRu: 'Альфа-Хищник',
    accuracy: 0.96,
    passive: {
      type: 'card_enhance',
      name: 'Идеальная охота',
      description: 'Карта Neurotoxin: действует на ВСЕХ врагов в радиусе 60px.',
      params: { radius: 60 }
    },
  },

  // --- TRICKSTER (5 units) ---
  {
    id: 'insect_changeling', // ✅ ИСПРАВЛЕНО: Изменен ID для избежания конфликта с insect_mimic
    factionId: 'insect',
    name: 'Changeling',
    title: 'Master of Disguise',
    role: 'trickster',
    rarity: 'common',
    stats: { power: 3, defense: 2, speed: 5, technique: 5 },
    specialAbility: 'Adaptive Trajectory',
    description: 'Мимик улья. Адаптирует траекторию под цель. [ПАССИВКА] Адаптивная траектория: Curve автоматически к ближайшему врагу.',
    assetKey: 'insect_changeling',
    assetPath: `assets/units/insect/insect_changeling.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xa3e635,
    secondaryColor: 0x365314,
    fragmentsRequired: 3,
    nameRu: 'Мимик',
    accuracy: 0.87,
    passive: {
      type: 'stat_boost',
      name: 'Адаптивная траектория',
      description: 'Curve зависит от ближайшего врага (curve к нему).',
      params: {}
    },
  },
  {
    id: 'insect_deceiver',
    factionId: 'insect',
    name: 'Phantom Swarm',
    title: 'Illusion Weaver',
    role: 'trickster',
    rarity: 'rare',
    stats: { power: 4, defense: 2, speed: 5, technique: 6 },
    specialAbility: 'Swarm Decoy',
    description: 'Обманщик роя. Его иллюзии сбивают с толку. [ПАССИВКА] Обманный рой: Biomimicry создаёт 2 фейка.',
    assetKey: 'insect_deceiver',
    assetPath: `assets/units/insect/insect_phantom_swarm.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x84cc16,
    secondaryColor: 0xa855f7,
    fragmentsRequired: 6,
    nameRu: 'Ложный Рой',
    accuracy: 0.88,
    passive: {
      type: 'card_enhance',
      name: 'Обманный рой',
      description: 'Карта Biomimicry: создаёт 2 фейковых мяча вместо 1.',
      params: {}
    },
  },
  {
    id: 'insect_morph',
    factionId: 'insect',
    name: 'Shapeshifter',
    title: 'Shape Shifter',
    role: 'trickster',
    rarity: 'rare',
    stats: { power: 4, defense: 3, speed: 5, technique: 6 },
    specialAbility: 'Bio-Morph',
    description: 'Метаморф улья. Копирует способности собратьев. [ПАССИВКА] Биоморф: Копирует пассивку ближайшего союзника.',
    assetKey: 'insect_morph',
    assetPath: `assets/units/insect/insect_shapeshifter.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x65a30d,
    secondaryColor: 0xa3e635,
    fragmentsRequired: 6,
    nameRu: 'Метаморф',
    accuracy: 0.89,
    passive: {
      type: 'conditional',
      name: 'Биоморф',
      description: 'Может копировать пассивку ближайшего союзника.',
      params: { condition: 'ally_nearby' }
    },
  },
  {
    id: 'insect_pheromone_master',
    factionId: 'insect',
    name: 'Mind-Eater',
    title: 'Mind Controller',
    role: 'trickster',
    rarity: 'epic',
    stats: { power: 5, defense: 3, speed: 6, technique: 8 },
    specialAbility: 'Mind Spores',
    description: 'Мастер феромонов. Его споры затуманивают разум. [ПАССИВКА] Споры разума: Враги в радиусе теряют 10% точность.',
    assetKey: 'insect_pheromone',
    assetPath: `assets/units/insect/insect_mind_eater.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xa855f7,
    secondaryColor: 0x84cc16,
    fragmentsRequired: 10,
    nameRu: 'Феромонщик',
    accuracy: 0.90,
    passive: {
      type: 'aura',
      name: 'Споры разума',
      description: 'Враги в радиусе 50px: -10% точность.',
      params: { radius: 50, value: 0.10, target: 'enemy' }
    },
  },
  {
    id: 'insect_hive_oracle',
    factionId: 'insect',
    name: 'Overmind',
    title: 'Swarm Mind Nexus',
    role: 'trickster',
    rarity: 'legendary',
    stats: { power: 6, defense: 4, speed: 7, technique: 10 },
    specialAbility: 'Hive Consciousness',
    description: 'Сверхразум улья. Видит будущее через миллион глаз. [ПАССИВКА] Сознание улья: Видит все траектории врага.',
    assetKey: 'insect_oracle',
    assetPath: `assets/units/insect/insect_overmind.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xfacc15,
    secondaryColor: 0xa855f7,
    fragmentsRequired: 15,
    nameRu: 'Оракул Улья',
    accuracy: 0.88,
    passive: {
      type: 'conditional',
      name: 'Сознание улья',
      description: 'Видит ВСЕ траектории ударов врага на 1 ход вперёд.',
      params: {}
    },
  },
  // === BATTLE PASS SEASON 1 EXCLUSIVE ===
  {
    id: 'insect_gamma_beast',
    factionId: 'insect',
    name: 'Gamma Beast',
    title: 'Unstoppable Force',
    role: 'tank',
    rarity: 'epic',
    stats: { power: 6, defense: 4, speed: 2, technique: 2 },
    specialAbility: 'Gamma Rage',
    description: 'Гамма-мутант невероятной силы. Чем больше урона — тем сильнее удары. [ПАССИВКА] Гамма-ярость: +30% сила после удара (до +60%).',
    assetKey: 'insect_gamma_beast',
    assetPath: `assets/units/insect/insect_gamma_beast.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x84cc16,
    secondaryColor: 0x365314,
    fragmentsRequired: 0,
    isBattlePass: true,
    battlePassTier: 20,
    battlePassSeason: 'season_1_galactic_legends',
    nameRu: 'Гамма-Мутант',
    accuracy: 0.83,
    passive: {
      type: 'risk_reward',
      name: 'Гамма-ярость',
      description: 'После получения удара: +30% сила следующего удара. Стакается до +60%.',
      params: { value: 0.30 }
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // 👑 CAMPAIGN BOSS UNITS (4 units)
  // ═══════════════════════════════════════════════════════════════
  
  {
    id: 'boss_krag',
    factionId: 'magma',
    name: 'Krag, Magma Lord',
    title: 'The Unstoppable',
    role: 'tank',
    rarity: 'legendary',
    stats: { power: 5, defense: 5, speed: 2, technique: 3 },
    specialAbility: 'Lava Eruption',
    description: 'Повелитель магмы. Сокрушает всё на своём пути. [ПАССИВКА] Власть вулкана: +20% сила и защита.',
    assetKey: 'boss_krag',
    assetPath: '/assets/sprites/units/bosses/boss_krag.png',
    primaryColor: 0xf59e0b,
    secondaryColor: 0xdc2626,
    fragmentsRequired: 20, // Боссы требуют больше фрагментов
    nameRu: 'Краг, Повелитель Магмы',
    accuracy: 0.82,
    passive: {
      type: 'stat_boost',
      name: 'Власть вулкана',
      description: '+20% сила и защита. Босс магмы.',
      params: { value: 0.20, target: 'self' }
    },
  },
  {
    id: 'boss_unit734',
    factionId: 'cyborg',
    name: 'Unit 734',
    title: 'Tactical Mainframe',
    role: 'balanced',
    rarity: 'legendary',
    stats: { power: 4, defense: 5, speed: 4, technique: 5 },
    specialAbility: 'Perfect Shield',
    description: 'Вычисляет вероятность победы с точностью 100%. [ПАССИВКА] Тактический процессор: +15% ко всем статам.',
    assetKey: 'boss_unit734',
    assetPath: '/assets/sprites/units/bosses/boss_unit734.png',
    primaryColor: 0x60a5fa,
    secondaryColor: 0x1e3a8a,
    fragmentsRequired: 20,
    nameRu: 'Юнит 734',
    accuracy: 0.97,
    passive: {
      type: 'stat_boost',
      name: 'Тактический процессор',
      description: '+15% ко всем статам. Босс киборгов.',
      params: { value: 0.15, target: 'self' }
    },
  },
  {
    id: 'boss_zra',
    factionId: 'void',
    name: "Z'ra, The Seer",
    title: 'Void Matriarch',
    role: 'trickster',
    rarity: 'legendary',
    stats: { power: 3, defense: 3, speed: 5, technique: 5 },
    specialAbility: 'Dimension Swap',
    description: 'Манипулирует пространством и временем, чтобы запутать противников. [ПАССИВКА] Видение бездны: +25% curve и скорость.',
    assetKey: 'boss_zra',
    assetPath: '/assets/sprites/units/bosses/boss_zra.png',
    primaryColor: 0xa855f7,
    secondaryColor: 0x1e1b4b,
    fragmentsRequired: 20,
    nameRu: "З'ра, Провидица",
    accuracy: 0.90,
    passive: {
      type: 'stat_boost',
      name: 'Видение бездны',
      description: '+25% curve и скорость. Босс пустоты.',
      params: { value: 0.25, target: 'self' }
    },
  },
  {
    id: 'boss_oracle',
    factionId: 'insect',
    name: 'Hive Oracle',
    title: 'Swarm Mind',
    role: 'sniper',
    rarity: 'legendary',
    stats: { power: 5, defense: 2, speed: 5, technique: 5 },
    specialAbility: 'Neurotoxin Burst',
    description: 'Вершина эволюции улья. Быстрый и смертоносный. [ПАССИВКА] Разум роя: +20% точность и скорость.',
    assetKey: 'boss_oracle',
    assetPath: '/assets/sprites/units/bosses/boss_oracle.png',
    primaryColor: 0xfacc15,
    secondaryColor: 0x84cc16,
    fragmentsRequired: 20,
    nameRu: 'Оракул Улья',
    accuracy: 0.98,
    passive: {
      type: 'stat_boost',
      name: 'Разум роя',
      description: '+20% точность и скорость. Босс насекомых.',
      params: { value: 0.20, target: 'self' }
    },
  },
  
  // ═══════════════════════════════════════════════════════════════
  // 💎 PREMIUM SHOP-EXCLUSIVE UNITS (1000 Crystals each)
  // ═══════════════════════════════════════════════════════════════
  
  {
    id: 'magma_thunder_god',
    factionId: 'magma',
    name: 'Magma Thunder God',
    title: 'Volcanic Deity',
    role: 'balanced',
    rarity: 'legendary',
    stats: { power: 85, defense: 85, speed: 80, technique: 80 },
    specialAbility: 'Divine Eruption',
    description: 'Легендарный воин вулканического царства, владеющий силой грома и магмы. [ПАССИВКА] Божественное извержение: +30% сила и защита.',
    assetKey: 'magma_thunder_god',
    assetPath: `assets/units/magma/magma_thunder_god.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xff4500,
    secondaryColor: 0xdc2626,
    fragmentsRequired: 15,
    isPremium: true,
    premiumPrice: 1000,
    nameRu: 'Бог Грома Магмы',
    accuracy: 0.92,
    passive: {
      type: 'stat_boost',
      name: 'Божественное извержение',
      description: '+30% сила и защита. Премиум юнит.',
      params: { value: 0.30, target: 'self' }
    },
  },
  {
    id: 'insect_toxic_overlord',
    factionId: 'insect',
    name: 'Insect Toxic Overlord',
    title: 'Venom Master',
    role: 'balanced',
    rarity: 'legendary',
    stats: { power: 82, defense: 88, speed: 82, technique: 85 },
    specialAbility: 'Toxic Dominion',
    description: 'Верховный правитель роя насекомых, повелевающий смертельными токсинами. [ПАССИВКА] Токсичное господство: +25% ко всем статам.',
    assetKey: 'insect_toxic_overlord',
    assetPath: `assets/units/insect/insect_toxic_overlord.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x39ff14,
    secondaryColor: 0x22c55e,
    fragmentsRequired: 15,
    isPremium: true,
    premiumPrice: 1000,
    nameRu: 'Токсичный Повелитель',
    accuracy: 0.92,
    passive: {
      type: 'stat_boost',
      name: 'Токсичное господство',
      description: '+25% ко всем статам. Премиум юнит.',
      params: { value: 0.25, target: 'self' }
    },
  },
  {
    id: 'cyborg_blue_streak',
    factionId: 'cyborg',
    name: 'Cyborg Blue Streak',
    title: 'Lightning Runner',
    role: 'trickster',
    rarity: 'legendary',
    stats: { power: 70, defense: 70, speed: 95, technique: 85 },
    specialAbility: 'Quantum Dash',
    description: 'Кибернетический спидстер, движущийся быстрее света. [ПАССИВКА] Квантовый рывок: +40% скорость и curve.',
    assetKey: 'cyborg_blue_streak',
    assetPath: `assets/units/cyborg/cyborg_blue_streak.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x00f2ff,
    secondaryColor: 0x3b82f6,
    fragmentsRequired: 15,
    isPremium: true,
    premiumPrice: 1000,
    nameRu: 'Синяя Молния',
    accuracy: 0.93,
    passive: {
      type: 'stat_boost',
      name: 'Квантовый рывок',
      description: '+40% скорость и curve. Премиум юнит.',
      params: { value: 0.40, target: 'self' }
    },
  },
  {
    id: 'void_demon_hunter',
    factionId: 'void',
    name: 'Void Demon Hunter',
    title: 'Shadow Sniper',
    role: 'sniper',
    rarity: 'legendary',
    stats: { power: 90, defense: 70, speed: 75, technique: 90 },
    specialAbility: 'Void Precision',
    description: 'Мастер-снайпер из пустоты, поражающий с безошибочной точностью из теней. [ПАССИВКА] Точность пустоты: +35% точность и сила.',
    assetKey: 'void_demon_hunter',
    assetPath: `assets/units/void/void_demon_hunter.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x9d00ff,
    secondaryColor: 0x6b21a8,
    fragmentsRequired: 15,
    isPremium: true,
    premiumPrice: 1000,
    nameRu: 'Охотник Демонов',
    accuracy: 1.00,
    passive: {
      type: 'stat_boost',
      name: 'Точность пустоты',
      description: '+35% точность и сила. Премиум юнит.',
      params: { value: 0.35, target: 'self' }
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // ⚓ КАПИТАНЫ (награда: 10 уровень аккаунта — выбор 1 из 4)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'captain_urok',
    factionId: 'magma',
    name: 'Urok',
    title: 'World-Breaker',
    role: 'tank',
    rarity: 'legendary',
    stats: { power: 92, defense: 96, speed: 72, technique: 78 },
    specialAbility: 'Tectonic Rift',
    description:
      'Танк-инициатор магмы. [ПАССИВКА] Осада гор: союзники в радиусе 150 px получают ×1.3 массу. [УЛЬТА] Тектонический разлом: конус 45°, отбрасывание и блок выбора на ход соперника.',
    assetKey: 'captain_urok',
    assetPath: `assets/units/captains/captain_urok.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xea580c,
    secondaryColor: 0xb91c1c,
    fragmentsRequired: 99,
    isCaptain: true,
    nameRu: 'Урок «Разрушитель миров»',
    accuracy: 0.91,
    passive: {
      type: 'none',
      name: 'Осада гор',
      description: 'Аура: масса союзников ×1.3 в радиусе 150 px от Урока.',
      params: {},
    },
  },
  {
    id: 'captain_chronos',
    factionId: 'cyborg',
    name: 'Chronos',
    title: 'Arbiter of Time',
    role: 'balanced',
    rarity: 'legendary',
    stats: { power: 82, defense: 84, speed: 80, technique: 94 },
    specialAbility: 'Stasis Sphere',
    description:
      'Тактик киборгов. [ПАССИВКА] Общая сеть: прицел союзников +40%, виден второй отскок. [УЛЬТА] Сфера стазиса: юнит замирает (static) на два цикла остановки.',
    assetKey: 'captain_chronos',
    assetPath: `assets/units/captains/captain_chronos.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x38bdf8,
    secondaryColor: 0x2563eb,
    fragmentsRequired: 99,
    isCaptain: true,
    nameRu: 'Хронос «Судья времени»',
    accuracy: 0.94,
    passive: {
      type: 'none',
      name: 'Общая сеть',
      description: 'Линия прицела союзников длиннее на 40%; подсказка второго отскока.',
      params: {},
    },
  },
  {
    id: 'captain_ethelgard',
    factionId: 'void',
    name: 'Ethelgard',
    title: 'Star-Eater',
    role: 'tank',
    rarity: 'legendary',
    stats: { power: 86, defense: 90, speed: 76, technique: 88 },
    specialAbility: 'Collapse',
    description:
      'Защитник пустоты. [ПАССИВКА] Тёмная гравитация: мяч в 100 px тянется к ближайшему союзнику Void. [УЛЬТА] Коллапс: сингулярность 2 с.',
    assetKey: 'captain_ethelgard',
    assetPath: `assets/units/captains/captain_ethelgard.png?v=${ASSETS_VERSION}`,
    primaryColor: 0xa855f7,
    secondaryColor: 0x6b21a8,
    fragmentsRequired: 99,
    isCaptain: true,
    nameRu: 'Этельгард «Пожиратель звёзд»',
    accuracy: 0.96,
    passive: {
      type: 'none',
      name: 'Тёмная гравитация',
      description: 'Мяч у союзников Void в радиусе 100 px слегка притягивается к ним.',
      params: {},
    },
  },
  {
    id: 'captain_xerxa',
    factionId: 'insect',
    name: 'Xerxa',
    title: 'Scavenger Queen',
    role: 'balanced',
    rarity: 'legendary',
    stats: { power: 88, defense: 82, speed: 88, technique: 86 },
    specialAbility: 'Swarm Call',
    description:
      'Лидер роя. [ПАССИВКА] Разум роя: два насекомых ближе 80 px — +15% сила. [УЛЬТА] Зов роя: после удара Ксерксой — ещё один ход насекомым при 50% силы.',
    assetKey: 'captain_xerxa',
    assetPath: `assets/units/captains/captain_xerxa.png?v=${ASSETS_VERSION}`,
    primaryColor: 0x4ade80,
    secondaryColor: 0x166534,
    fragmentsRequired: 99,
    isCaptain: true,
    nameRu: 'Ксеркса «Королева падальщиков»',
    accuracy: 0.93,
    passive: {
      type: 'none',
      name: 'Разум роя',
      description: 'Пары насекомых одной команды ближе 80 px получают +15% к силе удара.',
      params: {},
    },
  },
];

// #region agent log
try {
  console.log('[UnitsRepository] UNITS_REPOSITORY array defined, length:', UNITS_REPOSITORY.length);
  // 88 юнитов: 80 коллекционных + 4 босса + 4 премиум
  if (UNITS_REPOSITORY.length < 80) {
    console.warn('[UnitsRepository] WARNING: Less than 80 units, got:', UNITS_REPOSITORY.length);
  } else {
    console.log('[UnitsRepository] ✅ Units loaded successfully:', UNITS_REPOSITORY.length);
  }
} catch(e) {
  console.error('[UnitsRepository] Error after array definition:', e);
}
// #endregion

// ==================== HELPER FUNCTIONS ====================

/**
 * Получить юнита по ID
 */
export function getUnitById(id: string): UnitData | undefined {
  return UNITS_REPOSITORY.find(unit => unit.id === id);
}

/**
 * Получить всех юнитов фракции
 * ✅ ИСПРАВЛЕНО: Добавлена защита от undefined и null
 */
export function getUnitsByFaction(factionId: FactionId): UnitData[] {
  // Защита от undefined
  if (!factionId) {
    console.warn('[UnitsRepository] getUnitsByFaction called with undefined factionId');
    return [];
  }

  if (!UNITS_REPOSITORY || !Array.isArray(UNITS_REPOSITORY)) {
    console.error('[UnitsRepository] UNITS_REPOSITORY is not initialized or not an array');
    return [];
  }

  try {
    return UNITS_REPOSITORY.filter(unit => {
      if (!unit || typeof unit !== 'object') {
        return false;
      }
      return unit.factionId === factionId;
    });
  } catch (error) {
    console.error('[UnitsRepository] Error filtering units:', error);
    return [];
  }
}

/**
 * Получить юниты фракции БЕЗ Battle Pass юнитов
 * Используется в CollectionScene для избежания дублирования
 */
export function getCollectionUnitsByFaction(factionId: FactionId): UnitData[] {
  const allUnits = getUnitsByFaction(factionId);
  return allUnits.filter(unit => unit && !unit.isBattlePass);
}

/**
 * Получить только юниты Battle Pass
 */
export function getBattlePassUnits(): UnitData[] {
  if (!UNITS_REPOSITORY || !Array.isArray(UNITS_REPOSITORY)) {
    return [];
  }
  return UNITS_REPOSITORY.filter(unit => unit?.isBattlePass === true);
}

/**
 * Получить юниты Battle Pass для конкретного сезона
 */
export function getBattlePassUnitsBySeason(seasonId: string): UnitData[] {
  if (!UNITS_REPOSITORY || !Array.isArray(UNITS_REPOSITORY)) {
    return [];
  }
  return UNITS_REPOSITORY.filter(
    unit => unit?.isBattlePass && unit.battlePassSeason === seasonId
  );
}

/**
 * Получить юнитов фракции по роли
 */
export function getUnitsByFactionAndRole(factionId: FactionId, role: CapClass): UnitData[] {
  return UNITS_REPOSITORY.filter(unit => unit.factionId === factionId && unit.role === role);
}

/**
 * Получить юнитов фракции по редкости
 */
export function getUnitsByFactionAndRarity(factionId: FactionId, rarity: UnitRarity): UnitData[] {
  return UNITS_REPOSITORY.filter(unit => unit.factionId === factionId && unit.rarity === rarity);
}

/**
 * Получить всех юнитов по редкости
 */
export function getUnitsByRarity(rarity: UnitRarity): UnitData[] {
  return UNITS_REPOSITORY.filter(unit => unit.rarity === rarity);
}

/**
 * Получить все юниты, исключая Battle Pass
 */
export function getNonBattlePassUnits(): UnitData[] {
  return UNITS_REPOSITORY.filter(unit => unit && !unit.isBattlePass);
}

/**
 * Получить юниты по редкости (исключая BP)
 */
export function getNonBPUnitsByRarity(rarity: UnitRarity): UnitData[] {
  return UNITS_REPOSITORY.filter(
    unit => unit && !unit.isBattlePass && unit.rarity === rarity
  );
}

/**
 * Получить всех юнитов по роли
 */
export function getUnitsByRole(role: CapClass): UnitData[] {
  return UNITS_REPOSITORY.filter(unit => unit.role === role);
}

/**
 * Получить стартовых юнитов для фракции (3 random common units)
 */
export function getStarterUnitsForFaction(factionId: FactionId): UnitData[] {
  const commonUnits = UNITS_REPOSITORY.filter(
    unit => unit.factionId === factionId && unit.rarity === 'common'
  );
  
  // Перемешиваем и берём первые 3
  const shuffled = [...commonUnits].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

/**
 * Рассчитать общий рейтинг юнита (для сортировки)
 */
export function calculateUnitRating(unit: UnitData): number {
  const { power, defense, speed, technique } = unit.stats;
  const baseRating = power + defense + speed + technique;
  
  // Бонус за редкость
  const rarityBonus = {
    common: 0,
    rare: 2,
    epic: 4,
    legendary: 6,
  }[unit.rarity];
  
  return baseRating + rarityBonus;
}

/**
 * Получить цвет редкости
 */
export function getRarityColor(rarity: UnitRarity): number {
  return RARITY_COLORS[rarity];
}

/**
 * Получить название редкости
 */
export function getRarityName(rarity: UnitRarity): string {
  return RARITY_NAMES[rarity];
}

/**
 * Получить количество фрагментов для редкости
 */
export function getFragmentsRequired(rarity: UnitRarity): number {
  return FRAGMENTS_BY_RARITY[rarity];
}

/**
 * Получить иконку роли
 */
export function getRoleIcon(role: CapClass): string {
  const icons = {
    balanced: '⚖️',
    tank: '🛡️',
    sniper: '🎯',
    trickster: '🌀',
  };
  return icons[role];
}

/**
 * Получить название роли
 */
export function getRoleName(role: CapClass): string {
  const names = {
    balanced: 'Balanced',
    tank: 'Tank',
    sniper: 'Sniper',
    trickster: 'Trickster',
  };
  return names[role];
}

// ==================== СТАТИСТИКА ====================

/**
 * Получить статистику по всему репозиторию
 */
export function getRepositoryStats() {
  const total = UNITS_REPOSITORY.length;
  const byFaction = {
    magma: UNITS_REPOSITORY.filter(u => u.factionId === 'magma').length,
    cyborg: UNITS_REPOSITORY.filter(u => u.factionId === 'cyborg').length,
    void: UNITS_REPOSITORY.filter(u => u.factionId === 'void').length,
    insect: UNITS_REPOSITORY.filter(u => u.factionId === 'insect').length,
  };
  const byRarity = {
    common: UNITS_REPOSITORY.filter(u => u.rarity === 'common').length,
    rare: UNITS_REPOSITORY.filter(u => u.rarity === 'rare').length,
    epic: UNITS_REPOSITORY.filter(u => u.rarity === 'epic').length,
    legendary: UNITS_REPOSITORY.filter(u => u.rarity === 'legendary').length,
  };
  const byRole = {
    balanced: UNITS_REPOSITORY.filter(u => u.role === 'balanced').length,
    tank: UNITS_REPOSITORY.filter(u => u.role === 'tank').length,
    sniper: UNITS_REPOSITORY.filter(u => u.role === 'sniper').length,
    trickster: UNITS_REPOSITORY.filter(u => u.role === 'trickster').length,
  };
  
  return { total, byFaction, byRarity, byRole };
}

// ==================== СТАРТОВЫЕ И МАГАЗИННЫЕ ЮНИТЫ ====================

/**
 * Получить стартовые юниты из репозитория для указанной фракции
 * Выдаются игроку при получении новой фракции
 */
export function getStarterUnitsFromRepository(factionId: FactionId): UnitData[] {
  return UNITS_REPOSITORY.filter(
    u => u.factionId === factionId && u.isStarter === true
  );
}

/**
 * Получить магазинные юниты из репозитория для указанной фракции
 * Показываются в магазине для покупки
 */
export function getShopUnitsFromRepository(factionId: FactionId): UnitData[] {
  return UNITS_REPOSITORY.filter(
    u => u.factionId === factionId && u.isShopItem === true
  ).sort((a, b) => {
    // Сортировка по цене (от дешевых к дорогим)
    const priceA = a.shopPrice || 0;
    const priceB = b.shopPrice || 0;
    return priceA - priceB;
  });
}

/**
 * Получить все стартовые юниты из репозитория
 */
export function getAllStarterUnits(): UnitData[] {
  return UNITS_REPOSITORY.filter(u => u.isStarter === true);
}

/**
 * Получить все магазинные юниты из репозитория
 */
export function getAllShopUnits(): UnitData[] {
  return UNITS_REPOSITORY.filter(u => u.isShopItem === true);
}

/**
 * Получить все премиум юниты (только в магазине за кристаллы)
 */
export function getPremiumUnits(): UnitData[] {
  return UNITS_REPOSITORY.filter(u => u.isPremium === true);
}

/**
 * Получить премиум юнит по ID
 */
export function getPremiumUnitById(unitId: string): UnitData | undefined {
  return UNITS_REPOSITORY.find(u => u.id === unitId && u.isPremium === true);
}

// ========== HELPER ФУНКЦИИ ==========

/**
 * Безопасное получение accuracy с fallback
 */
export function getUnitAccuracy(unitId: string): number {
  const unit = getUnitById(unitId);
  if (unit?.accuracy !== undefined) {
    return unit.accuracy;
  }
  // Fallback по классу
  const unitFromCatalog = getUnit(unitId);
  const role = unitFromCatalog?.capClass || unit?.role || 'balanced';
  const defaultAccuracy: Record<string, number> = {
    sniper: 0.96,
    balanced: 0.92,
    trickster: 0.88,
    tank: 0.84
  };
  return defaultAccuracy[role] || 0.90;
}

/**
 * Безопасное получение passive с fallback
 */
export function getUnitPassive(unitId: string): PassiveAbility {
  const unit = getUnitById(unitId);
  if (unit?.passive) {
    return unit.passive;
  }
  // Fallback - пустая пассивка
  return {
    type: 'none',
    name: 'Стабильность',
    description: 'Нет особых эффектов.',
    params: {}
  };
}

/**
 * Получить локализованное название юнита
 */
export function getUnitDisplayName(unitId: string): string {
  const unit = getUnitById(unitId);
  if (unit?.nameRu) {
    return unit.nameRu;
  }
  // Fallback на английское название
  return unit?.name || unitId;
}

/**
 * Получить локализованное название из объекта юнита
 */
export function getDisplayName(unit: { name: string; nameRu?: string } | UnitData | null | undefined): string {
  if (!unit) return 'Unknown';
  if ('nameRu' in unit && unit.nameRu) {
    return unit.nameRu;
  }
  return unit.name || 'Unknown';
}

/** Уникальная физика фишки для Matter.js / геймплея */
export function getUnitPhysicsModifier(unitId: string): PhysicsModifierId | undefined {
  const row = UNITS_REPOSITORY.find(u => u.id === unitId);
  return row?.physicsModifier ?? UNIT_PHYSICS_MODIFIER_TABLE[unitId];
}
