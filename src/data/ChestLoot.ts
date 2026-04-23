/**
 * Система лута из сундуков Galaxy League
 * 
 * Особенности:
 * - Исключение BP юнитов из пула фрагментов
 * - Поддержка билетов и ключей турнира
 * - Взвешенный выбор редкости юнитов
 */

import { 
  ChestData, 
  LootCategory, 
  getChestById, 
  getChestByIdCompat 
} from './ChestsCatalog';
import { playerData } from './PlayerData';
import { 
  getAllCards, 
  getCardsByRarity, 
  CardDefinition,
  CardRarity 
} from './CardsCatalog';
import { 
  getNonBattlePassUnits, 
  UnitData, 
  UnitRarity 
} from './UnitsRepository';

// ============================================================
// ТИПЫ НАГРАД
// ============================================================

export type RewardItem =
  | { type: 'coins'; amount: number }
  | { type: 'crystals'; amount: number }
  | { type: 'card'; cardId: string; cardData: CardDefinition; amount: number }
  | { type: 'fragments'; unitId: string; unitData: UnitData; amount: number }
  | { type: 'cap_unlock'; unitId: string; unitData: UnitData }
  | { type: 'tournament_key_fragment'; amount: number }
  | { type: 'tournament_ticket'; amount: number };

export interface RewardSummary {
  coins: number;
  crystals: number;
  cards: Record<string, number>;
  fragments: Record<string, number>;
  capUnlocks: string[];
  keyFragments: number;
  tickets: number;
}

// ============================================================
// ВЕСА РЕДКОСТИ
// ============================================================

/** Веса редкости юнитов для выпадения фрагментов */
const UNIT_RARITY_WEIGHTS: Record<UnitRarity, number> = {
  common: 50,      // 50%
  rare: 30,        // 30%
  epic: 15,        // 15%
  legendary: 5,    // 5%
};

/** Веса редкости карт для выпадения */
const CARD_RARITY_WEIGHTS: Record<CardRarity, number> = {
  common: 60,      // 60%
  rare: 30,        // 30%
  epic: 10,        // 10%
};

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Выбрать случайный элемент на основе весов
 */
function weightedRandom<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const [key, weight] of entries) {
    random -= weight;
    if (random <= 0) {
      return key;
    }
  }
  
  return entries[0][0];
}

/**
 * Получить случайного юнита (исключая Battle Pass)
 */
function getRandomUnit(preferredRarity?: UnitRarity): UnitData {
  const allUnits = getNonBattlePassUnits();
  
  if (allUnits.length === 0) {
    throw new Error('[ChestLoot] No non-BP units available!');
  }
  
  // Если указана предпочтительная редкость
  if (preferredRarity) {
    const unitsOfRarity = allUnits.filter(u => u.rarity === preferredRarity);
    if (unitsOfRarity.length > 0) {
      return unitsOfRarity[Math.floor(Math.random() * unitsOfRarity.length)];
    }
  }
  
  // Выбираем редкость на основе весов
  const rarity = weightedRandom(UNIT_RARITY_WEIGHTS);
  const unitsOfRarity = allUnits.filter(u => u.rarity === rarity);
  
  if (unitsOfRarity.length > 0) {
    return unitsOfRarity[Math.floor(Math.random() * unitsOfRarity.length)];
  }
  
  // Fallback: любой юнит
  return allUnits[Math.floor(Math.random() * allUnits.length)];
}

/**
 * Получить случайную карту способности
 */
function getRandomCard(preferredRarity?: CardRarity): CardDefinition {
  // Если указана предпочтительная редкость
  if (preferredRarity) {
    const cardsOfRarity = getCardsByRarity(preferredRarity);
    if (cardsOfRarity.length > 0) {
      return cardsOfRarity[Math.floor(Math.random() * cardsOfRarity.length)];
    }
  }
  
  // Выбираем редкость на основе весов
  const rarity = weightedRandom(CARD_RARITY_WEIGHTS);
  const cardsOfRarity = getCardsByRarity(rarity);
  
  if (cardsOfRarity.length > 0) {
    return cardsOfRarity[Math.floor(Math.random() * cardsOfRarity.length)];
  }
  
  // Fallback: любая карта
  const allCards = getAllCards();
  return allCards[Math.floor(Math.random() * allCards.length)];
}

/**
 * Выбрать категорию лута на основе весов
 */
function selectLootCategory(weights: Record<string, number>): LootCategory {
  // Фильтруем только ненулевые веса
  const validWeights: Record<string, number> = {};
  for (const [key, weight] of Object.entries(weights)) {
    if (weight > 0) {
      validWeights[key] = weight;
    }
  }
  
  return weightedRandom(validWeights) as LootCategory;
}

/**
 * Случайное число в диапазоне
 */
function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============================================================
// ОСНОВНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Открыть сундук и получить награды
 */
export function openChest(chestId: string): RewardItem[] {
  // Поддержка старых ID
  const chest = getChestByIdCompat(chestId);
  
  if (!chest) {
    console.warn(`[ChestLoot] Chest not found: ${chestId}`);
    return [];
  }

  const rewards: RewardItem[] = [];
  const lootProfile = chest.lootProfile;

  // ========== ГАРАНТИРОВАННЫЙ ЛУТ ==========
  if (chest.guaranteedLoot) {
    for (const guaranteed of chest.guaranteedLoot) {
      switch (guaranteed.type) {
        case 'tournament_key_fragment':
          rewards.push({ 
            type: 'tournament_key_fragment', 
            amount: guaranteed.amount || 1 
          });
          break;
        case 'tournament_ticket':
          rewards.push({ 
            type: 'tournament_ticket', 
            amount: guaranteed.amount || 1 
          });
          break;
        case 'crystals':
          rewards.push({ 
            type: 'crystals', 
            amount: guaranteed.amount || 1 
          });
          break;
      }
    }
  }

  // ========== ПРОВЕРКА НА ПОЛНУЮ РАЗБЛОКИРОВКУ ЮНИТА ==========
  // Отдельная проверка с фиксированными шансами
  const capUnlockChance = 
    chest.id === 'chest_stellar' ? 0.005 :   // 0.5%
    chest.id === 'chest_nebula' ? 0.01 :     // 1%
    chest.id === 'chest_nova' ? 0.02 :       // 2%
    chest.id === 'chest_cosmic' ? 0.05 :     // 5%
    0;
  
  if (Math.random() < capUnlockChance) {
    try {
      // Для полной разблокировки выбираем редкого+ юнита
      const rarity = weightedRandom({
        rare: 50,
        epic: 35,
        legendary: 15,
      } as Record<UnitRarity, number>);
      
      const unit = getRandomUnit(rarity as UnitRarity);
      rewards.push({ 
        type: 'cap_unlock', 
        unitId: unit.id, 
        unitData: unit 
      });
    } catch (e) {
      console.warn('[ChestLoot] Failed to get unit for cap_unlock:', e);
    }
  }

  // ========== ГЕНЕРАЦИЯ РОЛЛОВ ==========
  for (let roll = 0; roll < chest.rolls; roll++) {
    const category = selectLootCategory(lootProfile.weights);
    
    switch (category) {
      // ----- МОНЕТЫ -----
      case 'coins': {
        const amount = randomInRange(
          lootProfile.coinRange.min, 
          lootProfile.coinRange.max
        );
        rewards.push({ type: 'coins', amount });
        break;
      }
      
      // ----- КРИСТАЛЛЫ -----
      case 'crystals': {
        const range = lootProfile.crystalRange || { min: 1, max: 3 };
        const amount = randomInRange(range.min, range.max);
        rewards.push({ type: 'crystals', amount });
        break;
      }
      
      // ----- КАРТЫ СПОСОБНОСТЕЙ -----
      case 'cards': {
        const packSize = lootProfile.cardPackSize || 1;
        for (let i = 0; i < packSize; i++) {
          const card = getRandomCard();
          rewards.push({ 
            type: 'card', 
            cardId: card.id, 
            cardData: card,
            amount: 1 
          });
        }
        break;
      }
      
      // ----- ФРАГМЕНТЫ ЮНИТОВ -----
      case 'fragments': {
        const amount = randomInRange(
          lootProfile.fragmentRange.min, 
          lootProfile.fragmentRange.max
        );
        try {
          const unit = getRandomUnit();
          rewards.push({ 
            type: 'fragments', 
            unitId: unit.id, 
            unitData: unit,
            amount 
          });
        } catch (e) {
          console.warn('[ChestLoot] Failed to get unit for fragments:', e);
          // Fallback: дать монеты вместо фрагментов
          rewards.push({ 
            type: 'coins', 
            amount: amount * 50 
          });
        }
        break;
      }
      
      // ----- ФРАГМЕНТ КЛЮЧА ТУРНИРА -----
      case 'tournament_key_fragment': {
        rewards.push({ 
          type: 'tournament_key_fragment', 
          amount: 1 
        });
        break;
      }
      
      // ----- ПОЛНЫЙ БИЛЕТ НА ТУРНИР -----
      case 'tournament_ticket': {
        rewards.push({ 
          type: 'tournament_ticket', 
          amount: 1 
        });
        break;
      }
      
      // ----- ПОЛНАЯ РАЗБЛОКИРОВКА (через веса) -----
      case 'cap_unlock': {
        // Уже обработано выше отдельной проверкой
        // Но если попало через веса, даём фрагменты вместо
        const amount = randomInRange(3, 5);
        try {
          const unit = getRandomUnit();
          rewards.push({ 
            type: 'fragments', 
            unitId: unit.id, 
            unitData: unit,
            amount 
          });
        } catch (e) {
          rewards.push({ type: 'coins', amount: 200 });
        }
        break;
      }
    }
  }

  console.log(`🎁 [ChestLoot] Opened ${chest.nameRu}, got ${rewards.length} rewards`);
  return rewards;
}

/**
 * Суммировать награды для отображения
 */
export function summarizeRewards(rewards: RewardItem[]): RewardSummary {
  const summary: RewardSummary = {
    coins: 0,
    crystals: 0,
    cards: {},
    fragments: {},
    capUnlocks: [],
    keyFragments: 0,
    tickets: 0,
  };

  for (const reward of rewards) {
    switch (reward.type) {
      case 'coins':
        summary.coins += reward.amount;
        break;
      case 'crystals':
        summary.crystals += reward.amount;
        break;
      case 'card':
        summary.cards[reward.cardId] = (summary.cards[reward.cardId] || 0) + reward.amount;
        break;
      case 'fragments':
        summary.fragments[reward.unitId] = (summary.fragments[reward.unitId] || 0) + reward.amount;
        break;
      case 'cap_unlock':
        summary.capUnlocks.push(reward.unitId);
        break;
      case 'tournament_key_fragment':
        summary.keyFragments += reward.amount;
        break;
      case 'tournament_ticket':
        summary.tickets += reward.amount;
        break;
    }
  }

  return summary;
}

/**
 * Применить награды к игроку
 */
export function applyRewardsToPlayer(rewards: RewardItem[]): void {
  const summary = summarizeRewards(rewards);
  
  // Монеты
  if (summary.coins > 0) {
    playerData.addCoins(summary.coins);
    console.log(`💰 Added ${summary.coins} coins`);
  }

  // Кристаллы
  if (summary.crystals > 0) {
    playerData.addCrystals(summary.crystals);
    console.log(`💎 Added ${summary.crystals} crystals`);
  }

  // Карты способностей
  for (const [cardId, amount] of Object.entries(summary.cards)) {
    playerData.addCards(cardId, amount);
    console.log(`🃏 Added ${amount}x ${cardId}`);
  }

  // Фрагменты юнитов
  for (const [unitId, amount] of Object.entries(summary.fragments)) {
    playerData.addUnitFragments(unitId, amount);
    console.log(`🧩 Added ${amount} fragments of ${unitId}`);
  }

  // Полные разблокировки юнитов
  for (const unitId of summary.capUnlocks) {
    playerData.unlockUnit(unitId);
    console.log(`⭐ Unlocked unit: ${unitId}`);
  }

  // Фрагменты ключа турнира
  if (summary.keyFragments > 0) {
    playerData.addTournamentKeyFragments(summary.keyFragments);
    console.log(`🔑 Added ${summary.keyFragments} key fragments`);
  }

  // Билеты на турнир
  if (summary.tickets > 0) {
    playerData.addTournamentTickets(summary.tickets);
    console.log(`🎫 Added ${summary.tickets} tournament tickets`);
  }

  playerData.save();
}

/**
 * Получить ожидаемую ценность сундука (для отладки баланса)
 */
export function getChestExpectedValue(chestId: string): number {
  const chest = getChestByIdCompat(chestId);
  if (!chest) return 0;
  
  const lp = chest.lootProfile;
  const totalWeight = Object.values(lp.weights).reduce((a, b) => a + b, 0);
  
  let expectedValue = 0;
  
  // Монеты
  const coinWeight = (lp.weights.coins || 0) / totalWeight;
  const avgCoins = (lp.coinRange.min + lp.coinRange.max) / 2;
  expectedValue += coinWeight * avgCoins * chest.rolls;
  
  // Кристаллы (1 кристалл ≈ 100 монет)
  const crystalWeight = (lp.weights.crystals || 0) / totalWeight;
  const avgCrystals = lp.crystalRange 
    ? (lp.crystalRange.min + lp.crystalRange.max) / 2 
    : 2;
  expectedValue += crystalWeight * avgCrystals * 100 * chest.rolls;
  
  // Карты (1 карта ≈ 100 монет)
  const cardWeight = (lp.weights.cards || 0) / totalWeight;
  expectedValue += cardWeight * (lp.cardPackSize || 1) * 100 * chest.rolls;
  
  // Фрагменты (1 фрагмент ≈ 50 монет)
  const fragWeight = (lp.weights.fragments || 0) / totalWeight;
  const avgFrags = (lp.fragmentRange.min + lp.fragmentRange.max) / 2;
  expectedValue += fragWeight * avgFrags * 50 * chest.rolls;
  
  // Фрагменты ключа (1 фрагмент ≈ 300 монет)
  const keyWeight = (lp.weights.tournament_key_fragment || 0) / totalWeight;
  expectedValue += keyWeight * 300 * chest.rolls;
  
  // Билеты (1 билет ≈ 1000 монет)
  const ticketWeight = (lp.weights.tournament_ticket || 0) / totalWeight;
  expectedValue += ticketWeight * 1000 * chest.rolls;
  
  return Math.round(expectedValue);
}
