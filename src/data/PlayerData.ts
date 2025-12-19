// src/data/PlayerData.ts

import { 
  getCapSkin, 
  getUpgradeCost, 
  getTotalBonusAtLevel, 
  MAX_CAP_LEVEL 
} from './SkinsCatalog';
import { CapClass } from '../constants/gameConstants';
import { Formation, FormationSlot, SkinRarity } from '../types';
import { AudioManager } from '../managers/AudioManager';

export interface OwnedSkin {
  id: string;
  unlockedAt: number;
  level: number;
}

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  goalsScored: number;
  goalsConceded: number;
  totalPlayTime: number;
  longestWinStreak: number;
  currentWinStreak: number;
  perfectGames: number;
}

export interface Achievement {
  id: string;
  unlockedAt: number;
}

export interface PlayerData {
  id: string;
  username: string;
  createdAt: number;
  lastLoginAt: number;
  coins: number;
  stars: number;
  xp: number;
  level: number;
  stats: PlayerStats;
  ownedCapSkins: OwnedSkin[];
  ownedBallSkins: OwnedSkin[];
  ownedFieldSkins: OwnedSkin[];
  equippedCapSkin: string;
  equippedBallSkin: string;
  equippedFieldSkin: string;
  
  selectedFormation: string;
  customFormations: Formation[];
  
  achievements: Achievement[];
  settings: {
    soundEnabled: boolean;
    musicEnabled: boolean;
    vibrationEnabled: boolean;
    language: string;
    screenScale: number;  // НОВОЕ: масштаб экрана (0.8 - 1.3)
  };
}

// ==================== ПРЕДУСТАНОВЛЕННЫЕ ФОРМАЦИИ ====================

export const DEFAULT_FORMATIONS: Formation[] = [
  {
    id: 'formation_2_1',
    name: '2-1',
    slots: [
      { id: 'slot_0', x: 0.5, y: 0.70, capClass: 'sniper' },
      { id: 'slot_1', x: 0.25, y: 0.85, capClass: 'balanced' },
      { id: 'slot_2', x: 0.75, y: 0.85, capClass: 'tank' },
    ],
    isCustom: false,
  },
  {
    id: 'formation_1_2',
    name: '1-2',
    slots: [
      { id: 'slot_0', x: 0.5, y: 0.85, capClass: 'tank' },
      { id: 'slot_1', x: 0.30, y: 0.70, capClass: 'sniper' },
      { id: 'slot_2', x: 0.70, y: 0.70, capClass: 'sniper' },
    ],
    isCustom: false,
  },
  {
    id: 'formation_1_1_1',
    name: '1-1-1',
    slots: [
      { id: 'slot_0', x: 0.5, y: 0.65, capClass: 'sniper' },
      { id: 'slot_1', x: 0.5, y: 0.77, capClass: 'balanced' },
      { id: 'slot_2', x: 0.5, y: 0.88, capClass: 'tank' },
    ],
    isCustom: false,
  },
  {
    id: 'formation_3_0',
    name: '3-0',
    slots: [
      { id: 'slot_0', x: 0.25, y: 0.72, capClass: 'balanced' },
      { id: 'slot_1', x: 0.50, y: 0.72, capClass: 'sniper' },
      { id: 'slot_2', x: 0.75, y: 0.72, capClass: 'balanced' },
    ],
    isCustom: false,
  },
  {
    id: 'formation_0_3',
    name: '0-3',
    slots: [
      { id: 'slot_0', x: 0.25, y: 0.88, capClass: 'tank' },
      { id: 'slot_1', x: 0.50, y: 0.88, capClass: 'tank' },
      { id: 'slot_2', x: 0.75, y: 0.88, capClass: 'tank' },
    ],
    isCustom: false,
  },
  {
    id: 'formation_triangle',
    name: '▲ Triangle',
    slots: [
      { id: 'slot_0', x: 0.5, y: 0.68, capClass: 'sniper' },
      { id: 'slot_1', x: 0.30, y: 0.85, capClass: 'balanced' },
      { id: 'slot_2', x: 0.70, y: 0.85, capClass: 'balanced' },
    ],
    isCustom: false,
  },
];

function generatePlayerId(): string {
  return 'player_' + Math.random().toString(36).substring(2, 15);
}

function createDefaultPlayerData(): PlayerData {
  return {
    id: generatePlayerId(),
    username: 'Player',
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
    coins: 500,
    stars: 10,
    xp: 0,
    level: 1,
    stats: {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      goalsScored: 0,
      goalsConceded: 0,
      totalPlayTime: 0,
      longestWinStreak: 0,
      currentWinStreak: 0,
      perfectGames: 0,
    },
    ownedCapSkins: [
      { id: 'cap_default_cyan', unlockedAt: Date.now(), level: 1 },
      { id: 'cap_default_magenta', unlockedAt: Date.now(), level: 1 },
    ],
    ownedBallSkins: [{ id: 'ball_default', unlockedAt: Date.now(), level: 1 }],
    ownedFieldSkins: [{ id: 'field_default', unlockedAt: Date.now(), level: 1 }],
    equippedCapSkin: 'cap_default_cyan',
    equippedBallSkin: 'ball_default',
    equippedFieldSkin: 'field_default',
    selectedFormation: 'formation_2_1',
    customFormations: [],
    achievements: [],
    settings: {
      soundEnabled: true,
      musicEnabled: true,
      vibrationEnabled: true,
      language: 'en',
      screenScale: 1.0,  // НОВОЕ: по умолчанию 100%
    },
  };
}

export function getXPForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

export function getRankByLevel(level: number): { name: string; icon: string; color: number } {
  if (level >= 50) return { name: 'Champion', icon: '👑', color: 0xffd700 };
  if (level >= 40) return { name: 'Diamond', icon: '💎', color: 0x67e8f9 };
  if (level >= 30) return { name: 'Platinum', icon: '🏆', color: 0xa855f7 };
  if (level >= 20) return { name: 'Gold', icon: '🥇', color: 0xfbbf24 };
  if (level >= 10) return { name: 'Silver', icon: '🥈', color: 0x94a3b8 };
  return { name: 'Bronze', icon: '🥉', color: 0xcd7f32 };
}

function convertOldFormationToNew(oldFormation: any): Formation {
  if (oldFormation.slots) {
    return oldFormation as Formation;
  }
  
  const slots: FormationSlot[] = (oldFormation.positions || []).map((pos: any, i: number) => ({
    id: `slot_${i}`,
    x: pos.x,
    y: pos.y,
    capClass: pos.capClass || 'balanced',
  }));
  
  return {
    id: oldFormation.id,
    name: oldFormation.name,
    slots,
    isCustom: oldFormation.isCustom || false,
  };
}

class PlayerDataManager {
  private readonly STORAGE_KEY = 'memeball_player_data';
  private data: PlayerData;

  constructor() {
    this.data = this.load();
  }

  private load(): PlayerData {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved && saved !== 'undefined') {
        const parsed = JSON.parse(saved);
        this.migrateData(parsed);
        
        if (parsed.settings) {
          AudioManager.getInstance().loadSettings(parsed.settings);
        }

        console.log('📂 Player data loaded');
        return parsed;
      }
    } catch (e) {
      console.warn('⚠️ Could not load player data, creating new');
    }

    console.log('📂 Creating new player data');
    const newData = createDefaultPlayerData();
    
    AudioManager.getInstance().loadSettings(newData.settings);

    this.data = newData;
    this.save();
    return newData;
  }

  private migrateData(data: any): void {
    // Миграция скинов
    ['ownedCapSkins', 'ownedBallSkins', 'ownedFieldSkins'].forEach(key => {
      if (data[key]?.length > 0) {
        data[key] = data[key].map((skin: any) => ({
          id: skin.id,
          unlockedAt: skin.unlockedAt || Date.now(),
          level: skin.level || 1,
        }));
      }
    });

    // Миграция формаций
    if (!data.selectedFormation) {
      data.selectedFormation = 'formation_2_1';
    }
    if (!data.customFormations) {
      data.customFormations = [];
    }

    data.customFormations = data.customFormations.map(convertOldFormationToNew);

    // Миграция настроек
    if (!data.settings) {
      data.settings = {
        soundEnabled: true,
        musicEnabled: true,
        vibrationEnabled: true,
        language: 'en',
        screenScale: 1.0,
      };
    }
    if (!data.settings.language) {
      data.settings.language = 'en';
    }
    // НОВОЕ: миграция screenScale
    if (data.settings.screenScale === undefined) {
      data.settings.screenScale = 1.0;
    }

    delete data.capUpgrades;

    // Миграция статистики
    if (!data.achievements) data.achievements = [];
    if (!data.xp) data.xp = 0;
    if (!data.level) data.level = 1;
    if (!data.stats) {
      data.stats = {
        gamesPlayed: 0, wins: 0, losses: 0, draws: 0,
        goalsScored: 0, goalsConceded: 0, totalPlayTime: 0,
        longestWinStreak: 0, currentWinStreak: 0, perfectGames: 0,
      };
    }
    if (!data.stats.totalPlayTime) data.stats.totalPlayTime = 0;
    if (!data.stats.longestWinStreak) data.stats.longestWinStreak = 0;
    if (!data.stats.currentWinStreak) data.stats.currentWinStreak = 0;
    if (!data.stats.perfectGames) data.stats.perfectGames = 0;
  }

  save(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Failed to save player data:', e);
    }
  }

  get(): PlayerData {
    return this.data;
  }

  // ==================== ВАЛЮТА ====================

  addCoins(amount: number): void {
    this.data.coins += amount;
    this.save();
  }

  spendCoins(amount: number): boolean {
    if (this.data.coins >= amount) {
      this.data.coins -= amount;
      this.save();
      return true;
    }
    return false;
  }

  addStars(amount: number): void {
    this.data.stars += amount;
    this.save();
  }

  spendStars(amount: number): boolean {
    if (this.data.stars >= amount) {
      this.data.stars -= amount;
      this.save();
      return true;
    }
    return false;
  }

  // ==================== XP И УРОВЕНЬ ====================

  addXP(amount: number): { leveledUp: boolean; newLevel: number } {
    this.data.xp += amount;
    let leveledUp = false;

    while (this.data.xp >= getXPForLevel(this.data.level)) {
      this.data.xp -= getXPForLevel(this.data.level);
      this.data.level++;
      leveledUp = true;
      this.addCoins(this.data.level * 50);
    }

    this.save();
    return { leveledUp, newLevel: this.data.level };
  }

  // ==================== СКИНЫ ====================

  buySkin(skinId: string, type: 'cap' | 'ball' | 'field'): void {
    const skin: OwnedSkin = { id: skinId, unlockedAt: Date.now(), level: 1 };
    switch (type) {
      case 'cap': this.data.ownedCapSkins.push(skin); break;
      case 'ball': this.data.ownedBallSkins.push(skin); break;
      case 'field': this.data.ownedFieldSkins.push(skin); break;
    }
    this.save();
  }

  ownsSkin(skinId: string, type: 'cap' | 'ball' | 'field'): boolean {
    switch (type) {
      case 'cap': return this.data.ownedCapSkins.some(s => s.id === skinId);
      case 'ball': return this.data.ownedBallSkins.some(s => s.id === skinId);
      case 'field': return this.data.ownedFieldSkins.some(s => s.id === skinId);
    }
  }

  equipSkin(skinId: string, type: 'cap' | 'ball' | 'field'): void {
    switch (type) {
      case 'cap': this.data.equippedCapSkin = skinId; break;
      case 'ball': this.data.equippedBallSkin = skinId; break;
      case 'field': this.data.equippedFieldSkin = skinId; break;
    }
    this.save();
  }

  // ==================== УЛУЧШЕНИЕ ФИШЕК ====================

  getCapLevel(skinId: string): number {
    const skin = this.data.ownedCapSkins.find(s => s.id === skinId);
    return skin?.level || 1;
  }

  upgradeCapSkin(skinId: string): boolean {
    const skin = this.data.ownedCapSkins.find(s => s.id === skinId);
    if (!skin || skin.level >= MAX_CAP_LEVEL) return false;

    const cost = getUpgradeCost(skinId, skin.level);
    if (!this.spendCoins(cost)) return false;

    skin.level++;
    this.save();
    return true;
  }

  getCapTotalBonus(skinId: string): { power: number; speed: number; control: number; weight: number } {
    const skinData = getCapSkin(skinId);
    if (!skinData) return { power: 0, speed: 0, control: 0, weight: 0 };

    const level = this.getCapLevel(skinId);
    return getTotalBonusAtLevel(skinData, level);
  }

  // ==================== ФОРМАЦИИ ====================

  getSelectedFormation(): Formation {
    const preset = DEFAULT_FORMATIONS.find(f => f.id === this.data.selectedFormation);
    if (preset) {
      const customized = this.data.customFormations.find(f => f.id === preset.id);
      return customized || preset;
    }

    const custom = this.data.customFormations.find(f => f.id === this.data.selectedFormation);
    if (custom) return custom;

    return DEFAULT_FORMATIONS[0];
  }

  selectFormation(formationId: string): void {
    this.data.selectedFormation = formationId;
    this.save();
  }

  setSlotClass(formationId: string, slotId: string, capClass: CapClass): void {
    let formation = this.data.customFormations.find(f => f.id === formationId);

    if (!formation) {
      const preset = DEFAULT_FORMATIONS.find(f => f.id === formationId);
      if (!preset) return;

      formation = {
        id: preset.id,
        name: preset.name,
        slots: preset.slots.map(s => ({ ...s })),
        isCustom: false,
      };
      this.data.customFormations.push(formation);
    }

    const slot = formation.slots.find(s => s.id === slotId);
    if (slot) {
      slot.capClass = capClass;
      this.save();
    }
  }

  setActiveFormationSlotClass(slotId: string, capClass: CapClass): void {
    this.setSlotClass(this.data.selectedFormation, slotId, capClass);
  }

  createCustomFormation(name: string, slots: FormationSlot[]): Formation {
    const id = 'custom_' + Date.now();
    const formation: Formation = { id, name, slots, isCustom: true };
    this.data.customFormations.push(formation);
    this.save();
    return formation;
  }

  updateCustomFormation(id: string, slots: FormationSlot[]): void {
    const formation = this.data.customFormations.find(f => f.id === id);
    if (formation) {
      formation.slots = slots;
      this.save();
    }
  }

  deleteCustomFormation(id: string): void {
    const index = this.data.customFormations.findIndex(f => f.id === id);
    if (index !== -1) {
      this.data.customFormations.splice(index, 1);
      if (this.data.selectedFormation === id) {
        this.data.selectedFormation = 'formation_2_1';
      }
      this.save();
    }
  }

  getAllFormations(): Formation[] {
    const result: Formation[] = [];

    DEFAULT_FORMATIONS.forEach(preset => {
      const customized = this.data.customFormations.find(f => f.id === preset.id);
      result.push(customized || preset);
    });

    this.data.customFormations
      .filter(f => f.id.startsWith('custom_'))
      .forEach(f => result.push(f));

    return result;
  }

  // ==================== СТАТИСТИКА ====================

  updateStats(result: 'win' | 'loss' | 'draw', goalsScored: number, goalsConceded: number): void {
    this.data.stats.gamesPlayed++;
    this.data.stats.goalsScored += goalsScored;
    this.data.stats.goalsConceded += goalsConceded;

    let xpGained = 10;

    switch (result) {
      case 'win':
        this.data.stats.wins++;
        this.data.stats.currentWinStreak++;
        if (this.data.stats.currentWinStreak > this.data.stats.longestWinStreak) {
          this.data.stats.longestWinStreak = this.data.stats.currentWinStreak;
        }
        this.addCoins(100);
        xpGained += 50;
        if (goalsConceded === 0) {
          this.data.stats.perfectGames++;
          this.addCoins(50);
          xpGained += 25;
        }
        break;
      case 'loss':
        this.data.stats.losses++;
        this.data.stats.currentWinStreak = 0;
        this.addCoins(20);
        xpGained += 15;
        break;
      case 'draw':
        this.data.stats.draws++;
        this.addCoins(50);
        xpGained += 25;
        break;
    }

    xpGained += goalsScored * 10;
    this.addCoins(goalsScored * 10);
    this.addXP(xpGained);
    this.save();
  }

  addPlayTime(seconds: number): void {
    this.data.stats.totalPlayTime += seconds;
    this.save();
  }

  // ==================== ДОСТИЖЕНИЯ ====================

  unlockAchievement(id: string): boolean {
    if (this.data.achievements.some(a => a.id === id)) return false;
    this.data.achievements.push({ id, unlockedAt: Date.now() });
    this.save();
    return true;
  }

  hasAchievement(id: string): boolean {
    return this.data.achievements.some(a => a.id === id);
  }

  // ==================== НАСТРОЙКИ ЭКРАНА ====================

  setScreenScale(scale: number): void {
    this.data.settings.screenScale = Phaser.Math.Clamp(scale, 0.8, 1.3);
    this.save();
  }

  getScreenScale(): number {
    return this.data.settings.screenScale || 1.0;
  }

  // ==================== СБРОС ====================

  reset(): void {
    this.data = createDefaultPlayerData();
    this.save();
  }
}

export const playerData = new PlayerDataManager();

export type { Formation, FormationSlot } from '../types';