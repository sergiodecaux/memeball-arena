// ============================================================
// AVATAR SYSTEM - Система аватарок игрока
// ============================================================

export interface AvatarConfig {
  id: string;
  name: string;
  description: string;
  textureKey: string;
  rarity: 'free' | 'premium';
  price?: { crystals: number };
}

export const AVATARS: AvatarConfig[] = [
  // ========== БЕСПЛАТНЫЕ (2 штуки) ==========
  {
    id: 'avatar_recruit',
    name: 'Recruit',
    description: 'Стандартная аватарка новичка',
    textureKey: 'avatar_recruit',
    rarity: 'free',
  },
  {
    id: 'avatar_explorer',
    name: 'Explorer',
    description: 'Первопроходец галактики',
    textureKey: 'avatar_explorer',
    rarity: 'free',
  },

  // ========== ПРЕМИУМ (6 штук) ==========
  {
    id: 'avatar_magma_warrior',
    name: 'Magma Warrior',
    description: 'Боевой дух огненной фракции',
    textureKey: 'avatar_magma_warrior',
    rarity: 'premium',
    price: { crystals: 150 },
  },
  {
    id: 'avatar_cyborg_elite',
    name: 'Cyborg Elite',
    description: 'Элита киберкорпуса',
    textureKey: 'avatar_cyborg_elite',
    rarity: 'premium',
    price: { crystals: 150 },
  },
  {
    id: 'avatar_void_mystic',
    name: 'Void Mystic',
    description: 'Мистик межзвездной пустоты',
    textureKey: 'avatar_void_mystic',
    rarity: 'premium',
    price: { crystals: 150 },
  },
  {
    id: 'avatar_insect_hive',
    name: 'Insect Hive',
    description: 'Повелитель роя',
    textureKey: 'avatar_insect_hive',
    rarity: 'premium',
    price: { crystals: 150 },
  },
  {
    id: 'avatar_champion',
    name: 'Champion',
    description: 'Легендарный чемпион галактики',
    textureKey: 'avatar_champion',
    rarity: 'premium',
    price: { crystals: 300 },
  },
  {
    id: 'avatar_legend',
    name: 'Legend',
    description: 'Икона спорта межзвездной лиги',
    textureKey: 'avatar_legend',
    rarity: 'premium',
    price: { crystals: 500 },
  },
];

/**
 * Получить конфигурацию аватарки
 */
export function getAvatar(avatarId: string): AvatarConfig | undefined {
  return AVATARS.find((a) => a.id === avatarId);
}

/**
 * Получить список доступных (бесплатных) аватарок
 */
export function getFreeAvatars(): AvatarConfig[] {
  return AVATARS.filter((a) => a.rarity === 'free');
}

/**
 * Получить список премиум аватарок
 */
export function getPremiumAvatars(): AvatarConfig[] {
  return AVATARS.filter((a) => a.rarity === 'premium');
}
