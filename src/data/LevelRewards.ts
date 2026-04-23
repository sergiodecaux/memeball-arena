// Система наград за повышение уровня игрока и фракций

import { FactionId } from '../constants/gameConstants';
import { UNITS_REPOSITORY } from './UnitsRepository';

export type RewardType = 'coins' | 'crystals' | 'unit_choice' | 'fragments' | 'card_pack' | 'chest';

export interface LevelReward {
  level: number;
  rewards: {
    type: RewardType;
    amount?: number;
    choices?: string[]; // Для unit_choice - массив ID юнитов на выбор
    message?: string;
  }[];
}

// ========== НАГРАДЫ ЗА УРОВЕНЬ ИГРОКА ==========
export const PLAYER_LEVEL_REWARDS: LevelReward[] = [
  {
    level: 2,
    rewards: [
      { type: 'coins', amount: 500, message: 'Добро пожаловать!' },
      { type: 'crystals', amount: 50 },
    ],
  },
  {
    level: 3,
    rewards: [
      { type: 'coins', amount: 750 },
      { type: 'card_pack', amount: 1 },
    ],
  },
  {
    level: 4,
    rewards: [
      { type: 'coins', amount: 900 },
      { type: 'crystals', amount: 75 },
    ],
  },
  {
    level: 5,
    rewards: [
      { type: 'coins', amount: 1000 },
      { type: 'crystals', amount: 100 },
      { type: 'chest', amount: 1, message: 'Малый сундук' },
    ],
  },
  {
    level: 6,
    rewards: [
      { type: 'coins', amount: 1200 },
      { type: 'card_pack', amount: 1 },
    ],
  },
  {
    level: 7,
    rewards: [
      { type: 'coins', amount: 1500 },
      { type: 'card_pack', amount: 2 },
    ],
  },
  {
    level: 8,
    rewards: [
      { type: 'coins', amount: 1800 },
      { type: 'crystals', amount: 150 },
    ],
  },
  {
    level: 9,
    rewards: [
      { type: 'coins', amount: 2000 },
      { type: 'fragments', amount: 15 },
    ],
  },
  {
    level: 10,
    rewards: [
      { type: 'coins', amount: 2500 },
      { type: 'crystals', amount: 250 },
      { type: 'chest', amount: 1, message: 'Средний сундук' },
    ],
  },
  {
    level: 12,
    rewards: [
      { type: 'coins', amount: 3000 },
      { type: 'card_pack', amount: 2 },
    ],
  },
  {
    level: 15,
    rewards: [
      { type: 'coins', amount: 5000 },
      { type: 'crystals', amount: 500 },
    ],
  },
  {
    level: 18,
    rewards: [
      { type: 'coins', amount: 7500 },
      { type: 'card_pack', amount: 3 },
    ],
  },
  {
    level: 20,
    rewards: [
      { type: 'coins', amount: 10000 },
      { type: 'crystals', amount: 1000 },
      { type: 'chest', amount: 1, message: 'Большой сундук' },
    ],
  },
  {
    level: 25,
    rewards: [
      { type: 'coins', amount: 15000 },
      { type: 'crystals', amount: 1500 },
      { type: 'chest', amount: 1, message: 'Эпический сундук' },
    ],
  },
  {
    level: 30,
    rewards: [
      { type: 'coins', amount: 25000 },
      { type: 'crystals', amount: 2500 },
    ],
  },
];

// ========== НАГРАДЫ ЗА УРОВЕНЬ ФРАКЦИИ ==========
export const FACTION_LEVEL_REWARDS: LevelReward[] = [
  {
    level: 2,
    rewards: [
      { type: 'coins', amount: 300 },
      { type: 'fragments', amount: 10, message: 'Фрагменты фракции' },
    ],
  },
  {
    level: 3,
    rewards: [
      { 
        type: 'unit_choice', 
        choices: [], // Заполним динамически по фракции
        message: 'Выбери юнита!' 
      },
    ],
  },
  {
    level: 4,
    rewards: [
      { type: 'coins', amount: 750 },
      { type: 'fragments', amount: 15 },
    ],
  },
  {
    level: 5,
    rewards: [
      { type: 'coins', amount: 1000 },
      { type: 'fragments', amount: 20 },
    ],
  },
  {
    level: 6,
    rewards: [
      { type: 'coins', amount: 1250 },
      { type: 'card_pack', amount: 1 },
    ],
  },
  {
    level: 7,
    rewards: [
      { 
        type: 'unit_choice', 
        choices: [],
        message: 'Выбери юнита!' 
      },
    ],
  },
  {
    level: 8,
    rewards: [
      { type: 'coins', amount: 1600 },
      { type: 'crystals', amount: 150 },
    ],
  },
  {
    level: 9,
    rewards: [
      { type: 'coins', amount: 1800 },
      { type: 'fragments', amount: 25 },
    ],
  },
  {
    level: 10,
    rewards: [
      { type: 'coins', amount: 2000 },
      { type: 'crystals', amount: 200 },
      { 
        type: 'unit_choice', 
        choices: [],
        message: 'Выбери редкого юнита!' 
      },
    ],
  },
  {
    level: 12,
    rewards: [
      { type: 'coins', amount: 3000 },
      { type: 'fragments', amount: 30 },
    ],
  },
  {
    level: 15,
    rewards: [
      { type: 'coins', amount: 5000 },
      { 
        type: 'unit_choice', 
        choices: [],
        message: 'Выбери эпика!' 
      },
    ],
  },
  {
    level: 18,
    rewards: [
      { type: 'coins', amount: 7500 },
      { type: 'crystals', amount: 750 },
    ],
  },
  {
    level: 20,
    rewards: [
      { type: 'coins', amount: 10000 },
      { type: 'crystals', amount: 1000 },
      { type: 'chest', amount: 1, message: 'Большой сундук' },
    ],
  },
];

/**
 * Получить награды за уровень игрока
 */
export function getPlayerLevelRewards(level: number): LevelReward | undefined {
  return PLAYER_LEVEL_REWARDS.find(r => r.level === level);
}

/**
 * Получить награды за уровень фракции
 */
export function getFactionLevelRewards(level: number, factionId: FactionId): LevelReward | undefined {
  const baseRewards = FACTION_LEVEL_REWARDS.find(r => r.level === level);
  if (!baseRewards) return undefined;

  // Клонируем награды и заполняем choices для unit_choice
  const rewards = JSON.parse(JSON.stringify(baseRewards)) as LevelReward;
  
  rewards.rewards.forEach(reward => {
    if (reward.type === 'unit_choice' && reward.choices) {
      reward.choices = generateUnitChoices(factionId, level);
    }
  });

  return rewards;
}

/**
 * Генерировать 3 юнита на выбор по уровню и фракции
 */
export function generateUnitChoices(factionId: FactionId, level: number): string[] {
  const factionUnits = UNITS_REPOSITORY.filter(u => u.factionId === factionId);
  
  // Определяем доступные редкости по уровню
  let allowedRarities: string[] = [];
  if (level <= 5) {
    allowedRarities = ['common', 'rare'];
  } else if (level <= 10) {
    allowedRarities = ['rare', 'epic'];
  } else {
    allowedRarities = ['epic', 'legendary'];
  }
  
  // Фильтруем юнитов по редкости
  let availableUnits = factionUnits.filter(u => allowedRarities.includes(u.rarity));
  
  // Если недостаточно юнитов нужной редкости, добавляем любых
  if (availableUnits.length < 3) {
    availableUnits = factionUnits;
  }
  
  // Выбираем случайные 3 юнита
  const shuffled = [...availableUnits].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.min(3, shuffled.length));
  
  // Если все еще не хватает, заполняем дубликатами
  while (selected.length < 3 && factionUnits.length > 0) {
    selected.push(factionUnits[0]);
  }
  
  return selected.map(u => u.id);
}

/**
 * Проверить, есть ли награда за этот уровень
 */
export function hasPlayerLevelReward(level: number): boolean {
  return PLAYER_LEVEL_REWARDS.some(r => r.level === level);
}

export function hasFactionLevelReward(level: number): boolean {
  return FACTION_LEVEL_REWARDS.some(r => r.level === level);
}
