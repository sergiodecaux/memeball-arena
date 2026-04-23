// src/data/BattlePassData.ts
// Данные и типы для системы Battle Pass

import { FactionId } from '../types';

// === ТИПЫ ===

export type BattlePassRewardType = 
  | 'coins' 
  | 'crystals' 
  | 'xp' 
  | 'unit' 
  | 'fragments' 
  | 'card_pack' 
  | 'chest'
  | 'tournament_key_fragment'  // ✅ ДОБАВЛЕНО
  | 'tournament_ticket';       // ✅ ДОБАВЛЕНО

export interface BattlePassReward {
  type: BattlePassRewardType;
  amount?: number;
  itemId?: string;
  factionId?: FactionId;
}

export interface BattlePassTier {
  tier: number;
  xpRequired: number;
  freeReward?: BattlePassReward;
  premiumReward?: BattlePassReward;
  isUnitReward?: boolean;
  unitRarity?: 'rare' | 'epic' | 'legendary';
}

export interface BattlePassProgress {
  seasonId: string;
  currentTier: number;
  currentXP: number;
  isPremium: boolean;
  premiumPurchasedAt?: number;
  claimedFreeTiers: number[];
  claimedPremiumTiers: number[];
}

export interface BattlePassSeason {
  id: string;
  name: string;
  themeColor: number;
  startDate: number;
  endDate: number;
  maxTier: number;
  tiers: BattlePassTier[];
  premiumPrice: { crystals: number };
  featuredUnitId: string;
  featuredUnitName: string;
}

// === КОНСТАНТЫ ===

export const BP_XP_PER_TIER = 100;
export const BP_MAX_TIER = 30;
export const BP_PREMIUM_PRICE = 500;
export const BP_SEASON_DURATION = 14 * 24 * 60 * 60 * 1000; // 14 дней

export const BP_XP_REWARDS = {
  MATCH_WIN: 30,
  MATCH_LOSS: 10,
  MATCH_DRAW: 15,
  GOAL_SCORED: 5,
  CLEAN_SHEET: 10,
  DAILY_LOGIN: 10,
};

// === ЦВЕТА ===

export const BP_COLORS = {
  background: 0x0f172a,
  cardBg: 0x1e293b,
  accent: 0x00f2ff,
  accentPink: 0xff00de,
  gold: 0xffd700,
  tierLocked: 0x374151,
  tierUnlocked: 0x38bdf8,
  tierCurrent: 0x00f2ff,
  free: 0x38bdf8,
  premium: 0xffd700,
  rare: 0x3b82f6,
  epic: 0xa855f7,
  legendary: 0xf59e0b,
  progressBg: 0x020617,
  progressFill: 0x38bdf8,
};

// === СЕЗОН 1 ===

export const BATTLE_PASS_SEASON_1: BattlePassSeason = {
  id: 'season_1_galactic_legends',
  name: 'Galactic Legends',
  themeColor: 0xa855f7,
  startDate: Date.now(),
  endDate: Date.now() + BP_SEASON_DURATION,
  maxTier: 30,
  premiumPrice: { crystals: BP_PREMIUM_PRICE },
  featuredUnitId: 'void_chaos_witch',
  featuredUnitName: 'Chaos Witch',
  
  tiers: [
    // Tier 1
    { tier: 1, xpRequired: 0,
      freeReward: { type: 'coins', amount: 100 },
      premiumReward: { type: 'coins', amount: 250 },
    },
    // Tier 2
    { tier: 2, xpRequired: 100,
      freeReward: { type: 'xp', amount: 50 },
      premiumReward: { type: 'crystals', amount: 15 },
    },
    // Tier 3
    { tier: 3, xpRequired: 200,
      freeReward: { type: 'coins', amount: 150 },
      premiumReward: { type: 'card_pack', itemId: 'basic_pack' },
    },
    // Tier 4
    { tier: 4, xpRequired: 300,
      freeReward: { type: 'fragments', amount: 5, factionId: 'cyborg' },
      premiumReward: { type: 'coins', amount: 350 },
    },
    // ═══ Tier 5: FREE UNIT — Iron Sentinel ═══
    { tier: 5, xpRequired: 400,
      freeReward: { type: 'unit', itemId: 'cyborg_iron_sentinel' },
      premiumReward: { type: 'crystals', amount: 30 },
      isUnitReward: true,
      unitRarity: 'rare',
    },
    // Tier 6
    { tier: 6, xpRequired: 500,
      freeReward: { type: 'coins', amount: 200 },
      premiumReward: { type: 'fragments', amount: 10, factionId: 'magma' },
    },
    // Tier 7
    { tier: 7, xpRequired: 600,
      freeReward: { type: 'xp', amount: 75 },
      premiumReward: { type: 'coins', amount: 450 },
    },
    // Tier 8
    { tier: 8, xpRequired: 700,
      freeReward: { type: 'coins', amount: 250 },
      premiumReward: { type: 'chest', itemId: 'chest_medium' },
    },
    // Tier 9
    { tier: 9, xpRequired: 800,
      freeReward: { type: 'fragments', amount: 8, factionId: 'magma' },
      premiumReward: { type: 'crystals', amount: 40 },
    },
    // ═══ Tier 10: PREMIUM UNIT — Rocket Gunner ═══
    { tier: 10, xpRequired: 900,
      freeReward: { type: 'tournament_key_fragment', amount: 1 },  // ✅ ДОБАВЛЕНО
      premiumReward: { type: 'unit', itemId: 'magma_rocket_gunner' },
      isUnitReward: true,
      unitRarity: 'epic',
    },
    // Tier 11-19
    { tier: 11, xpRequired: 1000,
      freeReward: { type: 'xp', amount: 100 },
      premiumReward: { type: 'coins', amount: 500 },
    },
    { tier: 12, xpRequired: 1100,
      freeReward: { type: 'coins', amount: 350 },
      premiumReward: { type: 'card_pack', itemId: 'premium_pack' },
    },
    { tier: 13, xpRequired: 1200,
      freeReward: { type: 'fragments', amount: 10, factionId: 'insect' },
      premiumReward: { type: 'crystals', amount: 50 },
    },
    { tier: 14, xpRequired: 1300,
      freeReward: { type: 'coins', amount: 400 },
      premiumReward: { type: 'coins', amount: 600 },
    },
    { tier: 15, xpRequired: 1400,
      freeReward: { type: 'coins', amount: 500 },
      premiumReward: { type: 'tournament_key_fragment', amount: 1 },  // ✅ ДОБАВЛЕНО
    },
    { tier: 16, xpRequired: 1500,
      freeReward: { type: 'xp', amount: 100 },
      premiumReward: { type: 'crystals', amount: 60 },
    },
    { tier: 17, xpRequired: 1600,
      freeReward: { type: 'coins', amount: 450 },
      premiumReward: { type: 'coins', amount: 700 },
    },
    { tier: 18, xpRequired: 1700,
      freeReward: { type: 'fragments', amount: 12, factionId: 'void' },
      premiumReward: { type: 'card_pack', itemId: 'epic_pack' },
    },
    { tier: 19, xpRequired: 1800,
      freeReward: { type: 'coins', amount: 500 },
      premiumReward: { type: 'crystals', amount: 75 },
    },
    // ═══ Tier 20: PREMIUM UNIT — Gamma Beast ═══
    { tier: 20, xpRequired: 1900,
      freeReward: { type: 'tournament_key_fragment', amount: 1 },  // ✅ ДОБАВЛЕНО
      premiumReward: { type: 'unit', itemId: 'insect_gamma_beast' },
      isUnitReward: true,
      unitRarity: 'epic',
    },
    // Tier 21-29
    { tier: 21, xpRequired: 2000,
      freeReward: { type: 'xp', amount: 125 },
      premiumReward: { type: 'coins', amount: 800 },
    },
    { tier: 22, xpRequired: 2100,
      freeReward: { type: 'coins', amount: 550 },
      premiumReward: { type: 'fragments', amount: 20, factionId: 'void' },
    },
    { tier: 23, xpRequired: 2200,
      freeReward: { type: 'fragments', amount: 15, factionId: 'cyborg' },
      premiumReward: { type: 'crystals', amount: 80 },
    },
    { tier: 24, xpRequired: 2300,
      freeReward: { type: 'coins', amount: 600 },
      premiumReward: { type: 'chest', itemId: 'chest_large' },
    },
    { tier: 25, xpRequired: 2400,
      freeReward: { type: 'coins', amount: 800 },
      premiumReward: { type: 'tournament_key_fragment', amount: 1 },  // ✅ ДОБАВЛЕНО
    },
    { tier: 26, xpRequired: 2500,
      freeReward: { type: 'xp', amount: 150 },
      premiumReward: { type: 'crystals', amount: 100 },
    },
    { tier: 27, xpRequired: 2600,
      freeReward: { type: 'coins', amount: 700 },
      premiumReward: { type: 'card_pack', itemId: 'legendary_pack' },
    },
    { tier: 28, xpRequired: 2700,
      freeReward: { type: 'fragments', amount: 20, factionId: 'magma' },
      premiumReward: { type: 'coins', amount: 1200 },
    },
    { tier: 29, xpRequired: 2800,
      freeReward: { type: 'coins', amount: 800 },
      premiumReward: { type: 'crystals', amount: 150 },
    },
    // ═══ Tier 30: FINAL — Chaos Witch (LEGENDARY) ═══
    { tier: 30, xpRequired: 2900,
      freeReward: { type: 'tournament_ticket', amount: 1 },  // ✅ ДОБАВЛЕНО
      premiumReward: { type: 'unit', itemId: 'void_chaos_witch' },
      isUnitReward: true,
      unitRarity: 'legendary',
    },
  ],
};

// === ФУНКЦИИ ===

export function getCurrentSeason(): BattlePassSeason {
  return BATTLE_PASS_SEASON_1;
}

export function createDefaultProgress(): BattlePassProgress {
  return {
    seasonId: getCurrentSeason().id,
    currentTier: 1,
    currentXP: 0,
    isPremium: false,
    claimedFreeTiers: [],
    claimedPremiumTiers: [],
  };
}

export function getTierForXP(xp: number): number {
  const season = getCurrentSeason();
  let tier = 1;
  for (const t of season.tiers) {
    if (xp >= t.xpRequired) tier = t.tier;
    else break;
  }
  return Math.min(tier, season.maxTier);
}

export function getXPProgress(currentXP: number, currentTier: number): { 
  current: number; 
  needed: number; 
  progress: number 
} {
  const season = getCurrentSeason();
  const currentTierData = season.tiers.find(t => t.tier === currentTier);
  const nextTierData = season.tiers.find(t => t.tier === currentTier + 1);
  
  if (!nextTierData) {
    return { current: 0, needed: 0, progress: 1 };
  }
  
  const currentTierXP = currentTierData?.xpRequired || 0;
  const xpInTier = currentXP - currentTierXP;
  const xpForNext = nextTierData.xpRequired - currentTierXP;
  
  return {
    current: xpInTier,
    needed: xpForNext,
    progress: xpInTier / xpForNext,
  };
}

export function formatTimeRemaining(ms: number): string {
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  
  if (days > 0) return `${days}д ${hours}ч`;
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}ч ${minutes}м`;
}
