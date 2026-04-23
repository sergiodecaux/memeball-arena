// Менеджер показа Level Up окон

import Phaser from 'phaser';
import { eventBus } from '../core/EventBus';
import { playerData } from '../data/PlayerData';
import { getPlayerLevelRewards, getFactionLevelRewards, hasPlayerLevelReward, hasFactionLevelReward } from '../data/LevelRewards';
import { LevelUpOverlay } from '../ui/LevelUpOverlay';
import { FactionId } from '../constants/gameConstants';

export class LevelUpManager {
  private static instance: LevelUpManager;
  private currentScene?: Phaser.Scene;
  private pendingOverlays: Array<() => void> = [];
  private isShowingOverlay = false;

  private constructor() {
    // Подписываемся на события
    eventBus.on('player:levelUp', this.handlePlayerLevelUp, this);
    eventBus.on('faction:levelUp', this.handleFactionLevelUp, this);
  }

  static getInstance(): LevelUpManager {
    if (!LevelUpManager.instance) {
      LevelUpManager.instance = new LevelUpManager();
    }
    return LevelUpManager.instance;
  }

  /**
   * Установить текущую сцену для отображения оверлеев
   */
  setScene(scene: Phaser.Scene): void {
    this.currentScene = scene;
  }

  private handlePlayerLevelUp(data: { level: number; previousLevel: number }): void {
    console.log(`[LevelUpManager] Player leveled up to ${data.level}`);
    
    // Проверяем, есть ли награда за этот уровень
    if (hasPlayerLevelReward(data.level)) {
      const rewards = getPlayerLevelRewards(data.level);
      if (rewards) {
        this.queueOverlay(() => {
          this.showPlayerLevelUp(data.level, rewards);
        });
      }
    }
  }

  private handleFactionLevelUp(data: { factionId: FactionId; level: number; previousLevel: number }): void {
    console.log(`[LevelUpManager] Faction ${data.factionId} leveled up to ${data.level}`);
    
    // Проверяем, есть ли награда за этот уровень
    if (hasFactionLevelReward(data.level)) {
      const rewards = getFactionLevelRewards(data.level, data.factionId);
      if (rewards) {
        this.queueOverlay(() => {
          this.showFactionLevelUp(data.factionId, data.level, rewards);
        });
      }
    }
  }

  private queueOverlay(callback: () => void): void {
    this.pendingOverlays.push(callback);
    this.processQueue();
  }

  private processQueue(): void {
    if (this.isShowingOverlay || this.pendingOverlays.length === 0) return;
    if (!this.currentScene) {
      console.warn('[LevelUpManager] No scene set, cannot show overlay');
      return;
    }

    this.isShowingOverlay = true;
    const next = this.pendingOverlays.shift();
    if (next) {
      next();
    }
  }

  private showPlayerLevelUp(level: number, rewards: any): void {
    if (!this.currentScene) return;

    new LevelUpOverlay(this.currentScene, {
      type: 'player',
      level,
      rewards,
      onComplete: () => {
        this.isShowingOverlay = false;
        this.processQueue();
      },
    });
  }

  private showFactionLevelUp(factionId: FactionId, level: number, rewards: any): void {
    if (!this.currentScene) return;

    new LevelUpOverlay(this.currentScene, {
      type: 'faction',
      level,
      factionId,
      rewards,
      onComplete: () => {
        this.isShowingOverlay = false;
        this.processQueue();
      },
    });
  }

  /**
   * Очистка при смене сцены
   */
  clearQueue(): void {
    this.pendingOverlays = [];
    this.isShowingOverlay = false;
  }
}
