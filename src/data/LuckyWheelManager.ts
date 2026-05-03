// Колесо удачи: крутка раз в 12 ч, улучшенный пул призов

import { playerData } from './PlayerData';
import { battlePassManager } from '../managers/BattlePassManager';
import { getUnitsByFaction } from './UnitsCatalog';

const STORAGE_KEY = 'soccer_caps_lucky_wheel_v1';
export const LUCKY_WHEEL_COOLDOWN_MS = 12 * 60 * 60 * 1000;

export type LuckyWheelRewardTier = 'common' | 'rare' | 'epic' | 'legendary';

export type LuckyWheelRewardId =
  | 'c70'
  | 'c180'
  | 'c450'
  | 'cr15'
  | 'cr40'
  | 'cr75'
  | 'xp120'
  | 'xp280'
  | 'frag20'
  | 'jackpot';

export interface LuckyWheelReward {
  id: LuckyWheelRewardId;
  label: string;
  /** Ранг сектора — цвет и «ощущение» дропа */
  tier: LuckyWheelRewardTier;
  /** Вес вероятности (чем больше — тем чаще). */
  weight: number;
  coins?: number;
  crystals?: number;
  bpXp?: number;
  fragments?: number;
}

/** Порядок = сектора колеса по часовой стрелке от указателя (верх). */
export const LUCKY_WHEEL_REWARDS: LuckyWheelReward[] = [
  { id: 'c70', label: '70 монет', tier: 'common', weight: 210, coins: 70 },
  { id: 'xp120', label: '120 XP BP', tier: 'common', weight: 175, bpXp: 120 },
  { id: 'cr15', label: '15 крист.', tier: 'common', weight: 168, crystals: 15 },
  { id: 'frag20', label: '20 фрагм.', tier: 'rare', weight: 118, fragments: 20 },
  { id: 'c180', label: '180 монет', tier: 'rare', weight: 105, coins: 180 },
  { id: 'cr40', label: '40 крист.', tier: 'rare', weight: 92, crystals: 40 },
  { id: 'xp280', label: '280 XP BP', tier: 'epic', weight: 58, bpXp: 280 },
  { id: 'c450', label: '450 монет', tier: 'epic', weight: 48, coins: 450 },
  { id: 'cr75', label: '75 крист.', tier: 'epic', weight: 38, crystals: 75 },
  {
    id: 'jackpot',
    label: 'МЕГА-ПРИЗ',
    tier: 'legendary',
    weight: 14,
    coins: 2500,
    crystals: 280,
    bpXp: 520,
    fragments: 35,
  },
];

interface StoredState {
  lastSpinAt: number;
}

function loadState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lastSpinAt: 0 };
    const p = JSON.parse(raw) as StoredState;
    return typeof p.lastSpinAt === 'number' ? p : { lastSpinAt: 0 };
  } catch {
    return { lastSpinAt: 0 };
  }
}

function saveState(state: StoredState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function grantFragments(amount: number): void {
  const faction = playerData.getFaction();
  if (!faction || amount <= 0) return;
  const pool = getUnitsByFaction(faction);
  if (pool.length === 0) return;
  const u = pool[Math.floor(Math.random() * pool.length)];
  playerData.addUnitFragments(u.id, amount);
}

function pickWeighted(): LuckyWheelReward {
  const sum = LUCKY_WHEEL_REWARDS.reduce((a, r) => a + r.weight, 0);
  let roll = Math.random() * sum;
  for (const r of LUCKY_WHEEL_REWARDS) {
    roll -= r.weight;
    if (roll <= 0) return r;
  }
  return LUCKY_WHEEL_REWARDS[LUCKY_WHEEL_REWARDS.length - 1];
}

function applyReward(r: LuckyWheelReward): void {
  if (r.coins && r.coins > 0) playerData.addCoins(r.coins);
  if (r.crystals && r.crystals > 0) playerData.addCrystals(r.crystals);
  if (r.bpXp && r.bpXp > 0) battlePassManager.addXP(r.bpXp, 'lucky_wheel');
  if (r.fragments && r.fragments > 0) grantFragments(r.fragments);
}

class LuckyWheelManager {
  canSpin(): boolean {
    const { lastSpinAt } = loadState();
    if (!lastSpinAt) return true;
    return Date.now() - lastSpinAt >= LUCKY_WHEEL_COOLDOWN_MS;
  }

  getMsUntilNextSpin(): number {
    const { lastSpinAt } = loadState();
    if (!lastSpinAt) return 0;
    const elapsed = Date.now() - lastSpinAt;
    const left = LUCKY_WHEEL_COOLDOWN_MS - elapsed;
    return left > 0 ? left : 0;
  }

  getRewardIndex(id: LuckyWheelRewardId): number {
    const i = LUCKY_WHEEL_REWARDS.findIndex((r) => r.id === id);
    return i >= 0 ? i : 0;
  }

  spin(): { ok: true; reward: LuckyWheelReward; index: number } | { ok: false; msLeft: number } {
    if (!this.canSpin()) {
      return { ok: false, msLeft: this.getMsUntilNextSpin() };
    }
    const reward = pickWeighted();
    applyReward(reward);
    saveState({ lastSpinAt: Date.now() });
    return { ok: true, reward, index: this.getRewardIndex(reward.id) };
  }
}

export const luckyWheelManager = new LuckyWheelManager();
