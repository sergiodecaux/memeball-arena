// src/managers/BattlePassManager.ts
// Менеджер для управления прогрессом Battle Pass

import Phaser from 'phaser';
import { eventBus, GameEvents } from '../core/EventBus';
import { playerData } from '../data/PlayerData';
import { 
  BattlePassProgress, 
  BattlePassReward,
  BP_XP_REWARDS,
  getCurrentSeason,
  createDefaultProgress,
  getTierForXP,
  getXPProgress,
  formatTimeRemaining,
} from '../data/BattlePassData';
import { UNITS_CATALOG } from '../data/UnitsCatalog';
import { getUnitById, getDisplayName } from '../data/UnitsRepository';

class BattlePassManager extends Phaser.Events.EventEmitter {
  private static instance: BattlePassManager;
  private eventBusListeners: Array<{ event: GameEvents; callback: (payload: any) => void }> = [];
  
  static readonly EVENTS = {
    XP_GAINED: 'bp:xp_gained',
    TIER_UP: 'bp:tier_up',
    REWARD_CLAIMED: 'bp:reward_claimed',
    PREMIUM_PURCHASED: 'bp:premium_purchased',
  };

  private constructor() {
    super();
    this.initialize();
  }

  static getInstance(): BattlePassManager {
    if (!BattlePassManager.instance) {
      BattlePassManager.instance = new BattlePassManager();
    }
    return BattlePassManager.instance;
  }

  /**
   * ✅ Public initializer - всегда переподписывается, т.к. EventBus мог быть очищен
   * (safe to call multiple times).
   */
  public initialize(): void {
    // Удаляем старые подписки если есть
    this.eventBusListeners.forEach(({ event, callback }) => {
      eventBus.unsubscribe(event, callback);
    });
    this.eventBusListeners = [];
    
    // Переподписываемся
    this.initListeners();
    console.log('[BattlePass] ✅ Initialized and subscribed to events');
  }

  private initListeners(): void {
    console.log('[BattlePass] Initializing event listeners...');
    
    // MATCH_FINISHED payload: { winner: PlayerNumber | null, scores: {player1, player2}, reason }
    const matchFinishedCallback = (payload: any) => {
      console.log('[BattlePass] 📥 MATCH_FINISHED received:', payload);
      
      const isWin = payload.winner === 1;
      const isDraw = payload.scores?.player1 === payload.scores?.player2;
      const isCleanSheet = isWin && payload.scores?.player2 === 0;

      let xp: number;
      let reason: string;

      if (isWin) {
        xp = BP_XP_REWARDS.MATCH_WIN;
        reason = 'match_win';
      } else if (isDraw) {
        xp = BP_XP_REWARDS.MATCH_DRAW;
        reason = 'match_draw';
      } else {
        xp = BP_XP_REWARDS.MATCH_LOSS;
        reason = 'match_loss';
      }

      this.addXP(xp, reason);

      if (isCleanSheet) {
        this.addXP(BP_XP_REWARDS.CLEAN_SHEET, 'clean_sheet');
      }

      console.log(`[BattlePass] Match finished: ${reason}, +${xp} XP`);
    };
    
    eventBus.subscribe(GameEvents.MATCH_FINISHED, matchFinishedCallback);
    this.eventBusListeners.push({ event: GameEvents.MATCH_FINISHED, callback: matchFinishedCallback });

    // GOAL_SCORED payload: { scoringPlayer: PlayerNumber, scores }
    const goalScoredCallback = (payload: any) => {
      console.log('[BattlePass] 📥 GOAL_SCORED received:', payload);
      
      if (payload.scoringPlayer === 1) {
        this.addXP(BP_XP_REWARDS.GOAL_SCORED, 'goal');
        console.log(`[BattlePass] Goal scored, +${BP_XP_REWARDS.GOAL_SCORED} XP`);
      }
    };
    
    eventBus.subscribe(GameEvents.GOAL_SCORED, goalScoredCallback);
    this.eventBusListeners.push({ event: GameEvents.GOAL_SCORED, callback: goalScoredCallback });

    console.log('[BattlePass] Event listeners initialized');
  }

  // === ПРОГРЕСС ===
  
  getProgress(): BattlePassProgress {
    const data = playerData.get();
    
    if (!data.battlePass || data.battlePass.seasonId !== getCurrentSeason().id) {
      const newProgress = createDefaultProgress();
      data.battlePass = newProgress;
      playerData.save();
      return newProgress;
    }
    
    return data.battlePass;
  }

  addXP(amount: number, source: string): void {
    const data = playerData.get();
    const progress = this.getProgress();
    const oldTier = progress.currentTier;
    
    progress.currentXP += amount;
    progress.currentTier = getTierForXP(progress.currentXP);
    
      data.battlePass = progress;
    playerData.save();
    
    this.emit(BattlePassManager.EVENTS.XP_GAINED, { amount, source, total: progress.currentXP });
    
    if (progress.currentTier > oldTier) {
      for (let t = oldTier + 1; t <= progress.currentTier; t++) {
        this.emit(BattlePassManager.EVENTS.TIER_UP, { tier: t });
      }
    }
    
    console.log(`[BattlePass] +${amount} XP (${source}). Total: ${progress.currentXP}, Tier: ${progress.currentTier}`);
  }

  // === НАГРАДЫ ===
  
  canClaimReward(tier: number, isPremium: boolean): boolean {
    const progress = this.getProgress();
    if (tier > progress.currentTier) return false;
    if (isPremium && !progress.isPremium) return false;
    
    const claimed = isPremium ? progress.claimedPremiumTiers : progress.claimedFreeTiers;
    return !claimed.includes(tier);
  }

  claimReward(tier: number, isPremium: boolean): { 
    reward: BattlePassReward; 
    unitData?: any;
  } | null {
    if (!this.canClaimReward(tier, isPremium)) return null;
    
    const tierData = getCurrentSeason().tiers.find(t => t.tier === tier);
    if (!tierData) return null;
    
    const reward = isPremium ? tierData.premiumReward : tierData.freeReward;
    if (!reward) return null;
    
    let unitData: any = undefined;
    
    // Применяем награду
    if (reward.type === 'unit' && reward.itemId) {
      this.unlockUnit(reward.itemId);
      unitData = getUnitById(reward.itemId);
    } else {
      this.applyReward(reward);
    }
    
    // Отмечаем как полученную
    const data = playerData.get();
    const progress = this.getProgress();
    if (isPremium) {
      progress.claimedPremiumTiers.push(tier);
    } else {
      progress.claimedFreeTiers.push(tier);
    }
      data.battlePass = progress;
    playerData.save();
    
    this.emit(BattlePassManager.EVENTS.REWARD_CLAIMED, { tier, isPremium, reward, unitData });
    
    return { reward, unitData };
  }

  private applyReward(reward: BattlePassReward): void {
    const data = playerData.get();
    
    switch (reward.type) {
      case 'coins':
        playerData.addCoins(reward.amount || 0);
        break;
      case 'crystals':
        playerData.addCrystals(reward.amount || 0);
        break;
      case 'xp':
        playerData.addXP(reward.amount || 0);
        break;
      case 'fragments':
        const frags = data.unitFragments || {};
        const key = reward.itemId || `${reward.factionId}_common`;
        frags[key] = (frags[key] || 0) + (reward.amount || 0);
        data.unitFragments = frags;
        playerData.save();
        break;
    }
  }

  private unlockUnit(unitId: string): void {
    // Используем встроенный метод
    playerData.unlockUnit(unitId);
    
    // Также добавляем в ownedUnits для совместимости с командой
    const unit = getUnitById(unitId);
    if (unit) {
      const data = playerData.get();
      const factionUnits = [...(data.ownedUnits[unit.factionId] || [])];
      
      if (!factionUnits.some(u => u.id === unitId)) {
        factionUnits.push({
          id: unitId,
          unlockedAt: Date.now(),
          upgrades: { power: 1, mass: 1, aim: 1, technique: 1 },
        });
        
        data.ownedUnits[unit.factionId] = factionUnits;
        playerData.save();
      }
      
      console.log(`✨ [BattlePass] Unit unlocked: ${getDisplayName(unit)} (${unit.factionId})`);
    }
  }

  // === PREMIUM ===
  
  purchasePremium(): boolean {
    const data = playerData.get();
    const price = getCurrentSeason().premiumPrice.crystals;
    
    if (data.crystals < price) return false;
    
    const progress = this.getProgress();
    progress.isPremium = true;
    progress.premiumPurchasedAt = Date.now();
    
    playerData.spendCrystals(price);
      data.battlePass = progress;
    playerData.save();
    
    this.emit(BattlePassManager.EVENTS.PREMIUM_PURCHASED, {});
    return true;
  }

  isPremium(): boolean {
    return this.getProgress().isPremium;
  }

  // === СТАТИСТИКА ===
  
  getTimeRemaining(): number {
    return Math.max(0, getCurrentSeason().endDate - Date.now());
  }

  getUnclaimedCount(): number {
    const progress = this.getProgress();
    let count = 0;
    
    for (const tier of getCurrentSeason().tiers) {
      if (tier.tier > progress.currentTier) break;
      if (tier.freeReward && !progress.claimedFreeTiers.includes(tier.tier)) count++;
      if (tier.premiumReward && progress.isPremium && !progress.claimedPremiumTiers.includes(tier.tier)) count++;
    }
    
    return count;
  }

  getBannerInfo(): {
    tier: number;
    maxTier: number;
    progress: number;
    timeRemaining: string;
    featuredUnit: string;
    hasUnclaimed: boolean;
    isPremium: boolean;
  } {
    const progress = this.getProgress();
    const season = getCurrentSeason();
    const xpInfo = getXPProgress(progress.currentXP, progress.currentTier);
    
    return {
      tier: progress.currentTier,
      maxTier: season.maxTier,
      progress: xpInfo.progress,
      timeRemaining: formatTimeRemaining(this.getTimeRemaining()),
      featuredUnit: season.featuredUnitName,
      hasUnclaimed: this.getUnclaimedCount() > 0,
      isPremium: progress.isPremium,
    };
  }
}

export const battlePassManager = BattlePassManager.getInstance();
export { BattlePassManager };
