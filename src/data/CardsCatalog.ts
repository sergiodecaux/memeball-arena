// ✅ СОЗДАНО: Новый каталог всех 12 карт способностей

// ========== ТИПЫ ==========

export type CardRarity = 'common' | 'rare' | 'epic';

export type CardTargetType = 
  | 'point'           // Точка на поле (Meteor, Lava, Barrier, Mimic, Wormhole)
  | 'unit_self'       // Свой юнит (Shield, Ghost, Toxin, Tether)
  | 'unit_enemy'      // Вражеский юнит (Parasite)
  | 'unit_ally_pair'  // Пара союзных юнитов (Swap)
  | 'none';           // Без цели (Molten Ball)

export interface CardDefinition {
  id: string;
  factionId: 'magma' | 'cyborg' | 'void' | 'insect';
  name: string;
  description: string;
  rarity: CardRarity;
  targetType: CardTargetType;
  assetPath: string;
  price: number;
}

// ========== КАТАЛОГ КАРТ ==========

export const CARDS_CATALOG: Record<string, CardDefinition> = {
  // ===== MAGMA FACTION =====
  magma_lava: {
    id: 'magma_lava',
    factionId: 'magma',
    name: 'Lava Pool',
    description: 'Creates a slowing zone that reduces enemy movement speed.',
    rarity: 'common',
    targetType: 'point',
    assetPath: '/assets/cards/icons/magma_lava.png',
    price: 50,
  },
  magma_molten: {
    id: 'magma_molten',
    factionId: 'magma',
    name: 'Molten Ball',
    description: 'Ball stuns enemies on contact for a short duration.',
    rarity: 'rare',
    targetType: 'none',
    assetPath: '/assets/cards/icons/magma_molten.png',
    price: 100,
  },
  magma_meteor: {
    id: 'magma_meteor',
    factionId: 'magma',
    name: 'Meteor Strike',
    description: 'Explosive impact at target point, creates a crater obstacle.',
    rarity: 'epic',
    targetType: 'point',
    assetPath: '/assets/cards/icons/magma_meteor.png',
    price: 200,
  },

  // ===== CYBORG FACTION =====
  cyborg_shield: {
    id: 'cyborg_shield',
    factionId: 'cyborg',
    name: 'Energy Shield',
    description: 'Creates a protective barrier that repels the ball.',
    rarity: 'common',
    targetType: 'unit_self',
    assetPath: '/assets/cards/icons/cyborg_shield.png',
    price: 50,
  },
  cyborg_tether: {
    id: 'cyborg_tether',
    factionId: 'cyborg',
    name: 'Magnetic Tether',
    description: 'Links the ball to the unit with a magnetic force.',
    rarity: 'rare',
    targetType: 'unit_self',
    assetPath: '/assets/cards/icons/cyborg_tether.png',
    price: 100,
  },
  cyborg_barrier: {
    id: 'cyborg_barrier',
    factionId: 'cyborg',
    name: 'Photon Barrier',
    description: 'Creates a bouncing wall at target location.',
    rarity: 'epic',
    targetType: 'point',
    assetPath: '/assets/cards/icons/cyborg_barrier.png',
    price: 200,
  },

  // ===== VOID FACTION =====
  void_swap: {
    id: 'void_swap',
    factionId: 'void',
    name: 'Phase Swap',
    description: 'Instantly swaps positions of two allied units.',
    rarity: 'common',
    targetType: 'unit_ally_pair',
    assetPath: '/assets/cards/icons/void_swap.png',
    price: 50,
  },
  void_ghost: {
    id: 'void_ghost',
    factionId: 'void',
    name: 'Ghost Phase',
    description: 'Unit becomes ethereal, ignoring obstacles but still hitting the ball.',
    rarity: 'rare',
    targetType: 'unit_self',
    assetPath: '/assets/cards/icons/void_ghost.png',
    price: 100,
  },
  void_wormhole: {
    id: 'void_wormhole',
    factionId: 'void',
    name: 'Wormhole',
    description: 'Creates two teleport portals on the field.',
    rarity: 'epic',
    targetType: 'point',
    assetPath: '/assets/cards/icons/void_wormhole.png',
    price: 200,
  },

  // ===== INSECT FACTION =====
  insect_toxin: {
    id: 'insect_toxin',
    factionId: 'insect',
    name: 'Neurotoxin',
    description: 'Poisons enemy on contact, slowing their actions.',
    rarity: 'common',
    targetType: 'unit_self',
    assetPath: '/assets/cards/icons/insect_toxin.png',
    price: 50,
  },
  insect_mimic: {
    id: 'insect_mimic',
    factionId: 'insect',
    name: 'Biomimicry',
    description: 'Spawns a fake decoy ball at target location.',
    rarity: 'rare',
    targetType: 'point',
    assetPath: '/assets/cards/icons/insect_mimic.png',
    price: 100,
  },
  insect_parasite: {
    id: 'insect_parasite',
    factionId: 'insect',
    name: 'Neural Parasite',
    description: 'Take temporary control of an enemy unit.',
    rarity: 'epic',
    targetType: 'unit_enemy',
    assetPath: '/assets/cards/icons/insect_parasite.png',
    price: 200,
  },
};

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

/**
 * Получить карту по ID
 */
export function getCard(cardId: string): CardDefinition | undefined {
  return CARDS_CATALOG[cardId];
}

/**
 * Получить все карты
 */
export function getAllCards(): CardDefinition[] {
  return Object.values(CARDS_CATALOG);
}

/**
 * Получить карты по фракции
 */
export function getCardsByFaction(factionId: string): CardDefinition[] {
  return Object.values(CARDS_CATALOG).filter(card => card.factionId === factionId);
}

/**
 * Получить карты по редкости
 */
export function getCardsByRarity(rarity: CardRarity): CardDefinition[] {
  return Object.values(CARDS_CATALOG).filter(card => card.rarity === rarity);
}

/**
 * Получить все Common карты (для стартового инвентаря)
 */
export function getCommonCards(): CardDefinition[] {
  return getCardsByRarity('common');
}

/**
 * Получить все ID карт
 */
export function getAllCardIds(): string[] {
  return Object.keys(CARDS_CATALOG);
}

/**
 * Получить шанс выпадения по редкости (для Gacha)
 */
export function getDropChance(rarity: CardRarity): number {
  switch (rarity) {
    case 'common': return 0.70;  // 70%
    case 'rare': return 0.25;    // 25%
    case 'epic': return 0.05;    // 5%
    default: return 0;
  }
}

/**
 * Случайный выбор карты с учётом весов редкости
 * @param factionId Если указан, выбираем только из этой фракции
 */
export function rollRandomCard(factionId?: string): CardDefinition {
  const pool = factionId 
    ? getCardsByFaction(factionId) 
    : getAllCards();
  
  const roll = Math.random();
  let targetRarity: CardRarity;
  
  if (roll < 0.05) {
    targetRarity = 'epic';
  } else if (roll < 0.30) {
    targetRarity = 'rare';
  } else {
    targetRarity = 'common';
  }
  
  const candidates = pool.filter(card => card.rarity === targetRarity);
  
  // Fallback если нет карт нужной редкости
  if (candidates.length === 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Открыть пак карт (Gacha)
 * @param count Количество карт в паке
 * @param factionId Если указан, карты только из этой фракции
 */
export function openCardPack(count: number, factionId?: string): CardDefinition[] {
  const result: CardDefinition[] = [];
  
  for (let i = 0; i < count; i++) {
    result.push(rollRandomCard(factionId));
  }
  
  return result;
}

// ========== КОНСТАНТЫ ДЛЯ GACHA ==========

export const BOOSTER_PRICES = {
  FACTION_BOOSTER: 150,   // 3 карты выбранной фракции
  TACTICAL_BOOSTER: 100,  // 3 случайные карты
} as const;

export const BOOSTER_CARD_COUNT = 3;