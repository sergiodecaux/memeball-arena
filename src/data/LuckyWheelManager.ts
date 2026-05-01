// Колесо удачи: крутка раз в 12 ч, редкие достойные призы

import { playerData } from './PlayerData';
import { battlePassManager } from '../managers/BattlePassManager';

const STORAGE_KEY = 'soccer_caps_lucky_wheel_v1';
export const LUCKY_WHEEL_COOLDOWN_MS = 12 * 60 * 60 * 1000;

export type LuckyWheelRewardId =
  | 'c40'
  | 'c120'
  | 'c350'
  | 'cr12'
  | 'cr35'
  | 'xp100'
  | 'cr90'
  | 'jackpot';

export interface LuckyWheelReward {
  id: LuckyWheelRewardId;
  label: string;
  /** Вес вероятности (чем больше — тем чаще). Джекпот — очень редкий. */
  weight: number;
  coins?: number;
  crystals?: number;
  bpXp?: number;
}

/** Порядок совпадает с секторами колеса (по часовой стрелке от верха). */
export const LUCKY_WHEEL_REWARDS: LuckyWheelReward[] = [
  { id: 'c40', label: '40 монет', weight: 280, coins: 40 },
  { id: 'cr12', label: '12 кристаллов', weight: 220, crystals: 12 },
  { id: 'xp100', label: '100 XP BP', weight: 160, bpXp: 100 },
  { id: 'c120', label: '120 монет', weight: 130, coins: 120 },
  { id: 'cr35', label: '35 кристаллов', weight: 95, crystals: 35 },
  { id: 'c350', label: '350 монет', weight: 72, coins: 350 },
  { id: 'cr90', label: '90 кристаллов', weight: 38, crystals: 90 },
  { id: 'jackpot', label: 'Джекпот!', weight: 5, coins: 1200, crystals: 150 },
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

  /** Индекс сектора для анимации. */
  getRewardIndex(id: LuckyWheelRewardId): number {
    const i = LUCKY_WHEEL_REWARDS.findIndex((r) => r.id === id);
    return i >= 0 ? i : 0;
  }

  /**
   * Выполняет крутку: проверка КД, выбор приза, начисление, сохранение времени.
   */
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
