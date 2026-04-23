/**
 * Каталог сундуков Galaxy League
 * 
 * Новые названия сундуков:
 * - Stellar Cache (бывший Small) - начальный сундук
 * - Nebula Capsule (бывший Medium) - средний сундук  
 * - Nova Container (бывший Large) - продвинутый сундук
 * - Cosmic Vault (бывший Mystic) - премиум сундук
 */

export interface ChestPrice {
  coins?: number;
  crystals?: number;
}

export type LootCategory = 
  | 'coins' 
  | 'crystals' 
  | 'cards' 
  | 'fragments' 
  | 'cap_unlock'
  | 'tournament_key_fragment'  // Фрагмент ключа турнира (1/3)
  | 'tournament_ticket';        // Полный билет на турнир

export interface LootProfile {
  weights: {
    coins: number;
    cards: number;
    fragments: number;
    crystals?: number;
    cap_unlock?: number;
    tournament_key_fragment?: number;
    tournament_ticket?: number;
  };
  coinRange: { min: number; max: number };
  crystalRange?: { min: number; max: number };
  fragmentRange: { min: number; max: number };
  cardPackSize?: number;
}

export interface ChestData {
  id: 'chest_stellar' | 'chest_nebula' | 'chest_nova' | 'chest_cosmic';
  nameRu: string;
  nameEn: string;
  descriptionRu: string;
  descriptionEn: string;
  price: ChestPrice;
  assetKey256: string;
  assetKey512: string;
  assetPath256: string;
  assetPath512: string;
  rolls: number;
  lootProfile: LootProfile;
  /** Гарантированный лут (всегда выпадает помимо роллов) */
  guaranteedLoot?: {
    type: LootCategory;
    amount?: number;
  }[];
}

/**
 * БАЛАНС СУНДУКОВ:
 * 
 * Stellar Cache (800 монет, 3 ролла):
 * - Основной источник монет и common карт
 * - Шанс на фрагмент ключа: 5%
 * - Ожидаемая ценность: ~1000-1200 монет
 * 
 * Nebula Capsule (2000 монет, 5 роллов):
 * - Баланс карт и фрагментов юнитов
 * - Шанс на фрагмент ключа: 8%
 * - Ожидаемая ценность: ~2500-3000 монет
 * 
 * Nova Container (4500 монет, 7 роллов):
 * - Высокий шанс на редкие карты и много фрагментов
 * - Шанс на полный билет: 3%
 * - Шанс на полного юнита: 2%
 * - Ожидаемая ценность: ~5500-7000 монет
 * 
 * Cosmic Vault (20 кристаллов, 8 роллов):
 * - Премиум сундук с гарантированными кристаллами
 * - Шанс на полный билет: 8%
 * - Шанс на полного юнита: 5%
 * - Гарантированно: 1 фрагмент ключа
 */

export const CHESTS_CATALOG: Record<string, ChestData> = {
  // ============================================================
  // STELLAR CACHE (бывший Small) - Начальный сундук
  // ============================================================
  chest_stellar: {
    id: 'chest_stellar',
    nameRu: 'Звёздный Тайник',
    nameEn: 'Stellar Cache',
    descriptionRu: 'Базовый контейнер с полезными ресурсами. Отличный старт для новичков!',
    descriptionEn: 'Basic container with useful resources. Great start for beginners!',
    price: { coins: 800 },
    assetKey256: 'chest_stellar_256',
    assetKey512: 'chest_stellar_512',
    assetPath256: '/assets/chests/chest_small_512.png',
    assetPath512: '/assets/chests/chest_small_512.png',
    rolls: 3,
    lootProfile: {
      weights: {
        coins: 45,              // 45% - монеты
        cards: 30,              // 30% - карты способностей
        fragments: 15,          // 15% - фрагменты юнитов
        tournament_key_fragment: 5,  // 5% - фрагмент ключа
        crystals: 5,            // 5% - кристаллы (редко)
      },
      coinRange: { min: 150, max: 300 },
      crystalRange: { min: 1, max: 2 },
      fragmentRange: { min: 1, max: 2 },
      cardPackSize: 1,
    },
  },

  // ============================================================
  // NEBULA CAPSULE (бывший Medium) - Средний сундук
  // ============================================================
  chest_nebula: {
    id: 'chest_nebula',
    nameRu: 'Капсула Туманности',
    nameEn: 'Nebula Capsule',
    descriptionRu: 'Улучшенный контейнер с повышенным шансом на редкие награды.',
    descriptionEn: 'Enhanced container with increased chance for rare rewards.',
    price: { coins: 2000 },
    assetKey256: 'chest_nebula_256',
    assetKey512: 'chest_nebula_512',
    assetPath256: '/assets/chests/chest_medium_512.png',
    assetPath512: '/assets/chests/chest_medium_512.png',
    rolls: 5,
    lootProfile: {
      weights: {
        coins: 35,              // 35% - монеты
        cards: 30,              // 30% - карты способностей
        fragments: 20,          // 20% - фрагменты юнитов
        tournament_key_fragment: 8,  // 8% - фрагмент ключа
        crystals: 7,            // 7% - кристаллы
      },
      coinRange: { min: 300, max: 500 },
      crystalRange: { min: 1, max: 3 },
      fragmentRange: { min: 2, max: 3 },
      cardPackSize: 1,
    },
  },

  // ============================================================
  // NOVA CONTAINER (бывший Large) - Продвинутый сундук
  // ============================================================
  chest_nova: {
    id: 'chest_nova',
    nameRu: 'Контейнер Новы',
    nameEn: 'Nova Container',
    descriptionRu: 'Мощный контейнер с отличными наградами. Шанс получить полного юнита или билет на турнир!',
    descriptionEn: 'Powerful container with excellent rewards. Chance to get a full unit or tournament ticket!',
    price: { coins: 4500 },
    assetKey256: 'chest_nova_256',
    assetKey512: 'chest_nova_512',
    assetPath256: '/assets/chests/chest_large_512.png',
    assetPath512: '/assets/chests/chest_large_512.png',
    rolls: 7,
    lootProfile: {
      weights: {
        coins: 25,              // 25% - монеты
        cards: 25,              // 25% - карты способностей
        fragments: 25,          // 25% - фрагменты юнитов
        tournament_key_fragment: 10, // 10% - фрагмент ключа
        crystals: 8,            // 8% - кристаллы
        tournament_ticket: 3,   // 3% - полный билет
        cap_unlock: 4,          // 4% - полный юнит (проверка отдельно)
      },
      coinRange: { min: 500, max: 800 },
      crystalRange: { min: 2, max: 5 },
      fragmentRange: { min: 3, max: 5 },
      cardPackSize: 2,
    },
  },

  // ============================================================
  // COSMIC VAULT (бывший Mystic) - Премиум сундук
  // ============================================================
  chest_cosmic: {
    id: 'chest_cosmic',
    nameRu: 'Космическое Хранилище',
    nameEn: 'Cosmic Vault',
    descriptionRu: 'Легендарный контейнер с премиум наградами! Гарантированный фрагмент ключа и высокий шанс на эксклюзивный лут.',
    descriptionEn: 'Legendary container with premium rewards! Guaranteed key fragment and high chance for exclusive loot.',
    price: { crystals: 20 },
    assetKey256: 'chest_cosmic_256',
    assetKey512: 'chest_cosmic_512',
    assetPath256: '/assets/chests/chest_mystic_512.png',
    assetPath512: '/assets/chests/chest_mystic_512.png',
    rolls: 8,
    lootProfile: {
      weights: {
        coins: 20,              // 20% - монеты
        cards: 20,              // 20% - карты способностей
        fragments: 22,          // 22% - фрагменты юнитов
        tournament_key_fragment: 12, // 12% - фрагмент ключа
        crystals: 13,           // 13% - кристаллы
        tournament_ticket: 8,   // 8% - полный билет
        cap_unlock: 5,          // 5% - полный юнит
      },
      coinRange: { min: 600, max: 1000 },
      crystalRange: { min: 3, max: 8 },
      fragmentRange: { min: 4, max: 6 },
      cardPackSize: 2,
    },
    // Гарантированный лут
    guaranteedLoot: [
      { type: 'tournament_key_fragment', amount: 1 },
    ],
  },
};

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Получить сундук по ID
 */
export function getChestById(chestId: string): ChestData | undefined {
  return CHESTS_CATALOG[chestId];
}

/**
 * Получить все сундуки
 */
export function getAllChests(): ChestData[] {
  return Object.values(CHESTS_CATALOG);
}

/**
 * Получить сундуки за монеты
 */
export function getCoinChests(): ChestData[] {
  return getAllChests().filter(chest => chest.price.coins !== undefined);
}

/**
 * Получить сундуки за кристаллы
 */
export function getCrystalChests(): ChestData[] {
  return getAllChests().filter(chest => chest.price.crystals !== undefined);
}

// Обратная совместимость со старыми ID
export const CHEST_ID_MIGRATION: Record<string, string> = {
  'chest_small': 'chest_stellar',
  'chest_medium': 'chest_nebula',
  'chest_large': 'chest_nova',
  'chest_mystic': 'chest_cosmic',
};

/**
 * Получить сундук с поддержкой старых ID
 */
export function getChestByIdCompat(chestId: string): ChestData | undefined {
  const migratedId = CHEST_ID_MIGRATION[chestId] || chestId;
  return CHESTS_CATALOG[migratedId];
}