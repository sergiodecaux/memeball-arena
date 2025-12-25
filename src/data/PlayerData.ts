// src/data/PlayerData.ts

import {
  getCapSkin,
  getUpgradeCost,
  MAX_UPGRADE_LEVEL,
  CAP_SKINS,
} from './SkinsCatalog';
import { CapClass, FactionId, DEFAULT_FACTION, FACTIONS, FACTION_IDS, getFactionPrice } from '../constants/gameConstants';
import { AudioManager } from '../managers/AudioManager';
import { getUnit, getStarterUnits, UNITS_CATALOG } from './UnitsCatalog';

// ==================== INTERFACES ====================

/** Прокачка юнита/фишки (4 параметра, каждый 1-10) */
export interface CapUpgrades {
  power: number;
  mass: number;
  aim: number;
  technique: number;
}

/** Старая фишка (Legacy Cap) */
export interface OwnedCap {
  id: string;
  unlockedAt: number;
  upgrades: CapUpgrades;
}

/** Юнит фракции в коллекции игрока */
export interface OwnedUnit {
  id: string;
  unlockedAt: number;
  upgrades: CapUpgrades;
}

/** Скин мяча/поля */
export interface OwnedSkin {
  id: string;
  unlockedAt: number;
}

/** Статистика игрока */
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

/** Достижение */
export interface Achievement {
  id: string;
  unlockedAt: number;
}

/** Слот формации */
export interface FormationSlot {
  id: string;
  x: number;
  y: number;
}

/** Формация */
export interface Formation {
  id: string;
  name: string;
  slots: FormationSlot[];
  isCustom: boolean;
}

/** Telegram user */
interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
}

/** Команда игрока (Legacy) */
export interface TeamSetup {
  [slotId: string]: string | null;
}

/** Основные данные игрока */
export interface PlayerData {
  id: string;
  telegramId?: number;
  telegramUsername?: string;
  telegramFirstName?: string;
  telegramLastName?: string;
  telegramPhotoUrl?: string;

  username: string;
  nickname: string;
  avatarId: string;
  isProfileSetupComplete: boolean;

  // === ФРАКЦИЯ ===
  selectedFaction?: FactionId;

  createdAt: number;
  lastLoginAt: number;

  coins: number;
  crystals: number;

  xp: number;
  level: number;
  stats: PlayerStats;
  achievements: Achievement[];

  // === ЮНИТЫ ФРАКЦИЙ ===
  ownedUnits: Record<FactionId, OwnedUnit[]>;
  factionTeams: Record<FactionId, [string, string, string]>;

  // === LEGACY (старые фишки) ===
  ownedCaps: OwnedCap[];
  teamSetup: TeamSetup;

  ownedBallSkins: OwnedSkin[];
  ownedFieldSkins: OwnedSkin[];

  equippedBallSkin: string;
  equippedFieldSkin: string;

  selectedFormation: string;
  customFormations: Formation[];

  settings: {
    soundEnabled: boolean;
    musicEnabled: boolean;
    vibrationEnabled: boolean;
    language: string;
    screenScale: number;
  };
}

// ==================== CONSTANTS ====================

const STARTER_CAPS = ['meme_doge', 'meme_gigachad'];

const DEFAULT_UPGRADES: CapUpgrades = {
  power: 1,
  mass: 1,
  aim: 1,
  technique: 1,
};

const DEFAULT_AVATAR_ID = 'avatar_blue';

// ==================== FORMATIONS ====================

export const DEFAULT_FORMATIONS: Formation[] = [
  {
    id: 'formation_2_1',
    name: '2-1',
    slots: [
      { id: 'slot_0', x: 0.5, y: 0.7 },
      { id: 'slot_1', x: 0.25, y: 0.85 },
      { id: 'slot_2', x: 0.75, y: 0.85 },
    ],
    isCustom: false,
  },
  {
    id: 'formation_1_2',
    name: '1-2',
    slots: [
      { id: 'slot_0', x: 0.5, y: 0.85 },
      { id: 'slot_1', x: 0.3, y: 0.7 },
      { id: 'slot_2', x: 0.7, y: 0.7 },
    ],
    isCustom: false,
  },
  {
    id: 'formation_1_1_1',
    name: '1-1-1',
    slots: [
      { id: 'slot_0', x: 0.5, y: 0.65 },
      { id: 'slot_1', x: 0.5, y: 0.77 },
      { id: 'slot_2', x: 0.5, y: 0.88 },
    ],
    isCustom: false,
  },
  {
    id: 'formation_3_0',
    name: '3-0',
    slots: [
      { id: 'slot_0', x: 0.25, y: 0.72 },
      { id: 'slot_1', x: 0.5, y: 0.72 },
      { id: 'slot_2', x: 0.75, y: 0.72 },
    ],
    isCustom: false,
  },
  {
    id: 'formation_0_3',
    name: '0-3',
    slots: [
      { id: 'slot_0', x: 0.25, y: 0.88 },
      { id: 'slot_1', x: 0.5, y: 0.88 },
      { id: 'slot_2', x: 0.75, y: 0.88 },
    ],
    isCustom: false,
  },
  {
    id: 'formation_triangle',
    name: '▲ Triangle',
    slots: [
      { id: 'slot_0', x: 0.5, y: 0.68 },
      { id: 'slot_1', x: 0.3, y: 0.85 },
      { id: 'slot_2', x: 0.7, y: 0.85 },
    ],
    isCustom: false,
  },
];

// ==================== HELPERS ====================

function generatePlayerId(): string {
  return 'player_' + Math.random().toString(36).substring(2, 15);
}

function getDefaultNicknameFromTelegram(user?: TelegramUser): string {
  if (!user) return 'Player';
  return user.username || user.first_name || user.last_name || 'Player';
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

export function getCapTotalLevel(upgrades: CapUpgrades): number {
  return upgrades.power + upgrades.mass + upgrades.aim + upgrades.technique;
}

export function getTeamPower(caps: OwnedCap[]): number {
  return caps.reduce((sum, cap) => sum + getCapTotalLevel(cap.upgrades), 0);
}

// ==================== CREATE DEFAULT DATA ====================

function createDefaultPlayerData(telegramUser?: TelegramUser): PlayerData {
  const now = Date.now();
  const telegramId = telegramUser?.id;
  const nickname = getDefaultNicknameFromTelegram(telegramUser);

  const ownedCaps: OwnedCap[] = STARTER_CAPS.map(id => ({
    id,
    unlockedAt: now,
    upgrades: { ...DEFAULT_UPGRADES },
  }));

  const teamSetup: TeamSetup = {
    slot_0: 'meme_doge',
    slot_1: 'meme_gigachad',
    slot_2: 'meme_doge',
  };

  return {
    id: telegramId ? `tg_${telegramId}` : generatePlayerId(),

    telegramId,
    telegramUsername: telegramUser?.username,
    telegramFirstName: telegramUser?.first_name,
    telegramLastName: telegramUser?.last_name,
    telegramPhotoUrl: telegramUser?.photo_url,

    username: nickname,
    nickname,
    avatarId: DEFAULT_AVATAR_ID,
    isProfileSetupComplete: false,

    selectedFaction: undefined,

    createdAt: now,
    lastLoginAt: now,
    coins: 500,
    crystals: 10,
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

    ownedUnits: {
      magma: [],
      cyborg: [],
      void: [],
      insect: [],
    },
    factionTeams: {
      magma: ['', '', ''],
      cyborg: ['', '', ''],
      void: ['', '', ''],
      insect: ['', '', ''],
    },

    ownedCaps,
    teamSetup,

    ownedBallSkins: [{ id: 'ball_plasma', unlockedAt: now }],
    ownedFieldSkins: [{ id: 'field_default', unlockedAt: now }],

    equippedBallSkin: 'ball_plasma',
    equippedFieldSkin: 'field_default',

    selectedFormation: 'formation_2_1',
    customFormations: [],

    achievements: [],
    settings: {
      soundEnabled: true,
      musicEnabled: true,
      vibrationEnabled: true,
      language: 'en',
      screenScale: 1.0,
    },
  };
}

// ==================== PLAYER DATA MANAGER ====================

class PlayerDataManager {
  private readonly LEGACY_STORAGE_KEY = 'memeball_player_data';
  private STORAGE_KEY: string;
  private data: PlayerData;
  private telegramUser?: TelegramUser;

  constructor() {
    const tg = (window as any).Telegram?.WebApp;
    const user: TelegramUser | undefined = tg?.initDataUnsafe?.user;

    this.telegramUser = user;

    if (user?.id) {
      this.STORAGE_KEY = `${this.LEGACY_STORAGE_KEY}_${user.id}`;
    } else {
      this.STORAGE_KEY = this.LEGACY_STORAGE_KEY;
    }

    this.data = this.load();
  }

  // ==================== LOAD / SAVE ====================

  private load(): PlayerData {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved && saved !== 'undefined') {
        const parsed: PlayerData = JSON.parse(saved);
        this.migrateData(parsed);
        this.attachTelegramInfo(parsed);
        parsed.lastLoginAt = Date.now();

        if (parsed.settings) {
          AudioManager.getInstance().loadSettings(parsed.settings);
        }

        console.log('📂 Player data loaded');
        return parsed;
      }

      if (this.STORAGE_KEY !== this.LEGACY_STORAGE_KEY) {
        const legacy = localStorage.getItem(this.LEGACY_STORAGE_KEY);
        if (legacy && legacy !== 'undefined') {
          const parsedLegacy: PlayerData = JSON.parse(legacy);
          this.migrateData(parsedLegacy);
          this.attachTelegramInfo(parsedLegacy);
          parsedLegacy.lastLoginAt = Date.now();

          if (parsedLegacy.settings) {
            AudioManager.getInstance().loadSettings(parsedLegacy.settings);
          }

          this.data = parsedLegacy;
          this.save();
          console.log('📂 Player data migrated from legacy key');
          return parsedLegacy;
        }
      }
    } catch (e) {
      console.warn('⚠️ Could not load player data, creating new', e);
    }

    console.log('📂 Creating new player data');
    const newData = createDefaultPlayerData(this.telegramUser);
    AudioManager.getInstance().loadSettings(newData.settings);
    this.data = newData;
    this.save();
    return newData;
  }

  private attachTelegramInfo(data: PlayerData): void {
    if (!this.telegramUser) return;

    const u = this.telegramUser;
    data.telegramId = u.id;
    data.telegramUsername = u.username;
    data.telegramFirstName = u.first_name;
    data.telegramLastName = u.last_name;
    data.telegramPhotoUrl = u.photo_url;

    if (!data.nickname || data.nickname === 'Player') {
      const nickFromTg = u.username || u.first_name || u.last_name || data.nickname;
      if (nickFromTg) {
        data.nickname = nickFromTg;
      }
    }

    if (!data.username) {
      data.username = data.nickname || getDefaultNicknameFromTelegram(u);
    }
  }

  private migrateData(data: any): void {
    const now = Date.now();

    if (data.stars !== undefined && data.crystals === undefined) {
      data.crystals = data.stars;
      delete data.stars;
    }
    if (data.crystals === undefined) {
      data.crystals = 10;
    }

    if (!data.ownedUnits) {
      data.ownedUnits = {
        magma: [],
        cyborg: [],
        void: [],
        insect: [],
      };
    }

    if (!data.factionTeams) {
      data.factionTeams = {
        magma: ['', '', ''],
        cyborg: ['', '', ''],
        void: ['', '', ''],
        insect: ['', '', ''],
      };
    }

    if (data.selectedFaction && data.ownedUnits[data.selectedFaction].length === 0) {
      const starters = getStarterUnits(data.selectedFaction);
      starters.forEach((unit) => {
        data.ownedUnits[data.selectedFaction].push({
          id: unit.id,
          unlockedAt: now,
          upgrades: { ...DEFAULT_UPGRADES },
        });
      });

      const starterIds = starters.slice(0, 3).map(u => u.id);
      data.factionTeams[data.selectedFaction] = [
        starterIds[0] || '',
        starterIds[1] || '',
        starterIds[2] || '',
      ];

      console.log(`🛸 Migrated faction units for ${data.selectedFaction}`);
    }

    if (!data.ownedCaps) {
      data.ownedCaps = [];

      if (data.ownedCapSkins && Array.isArray(data.ownedCapSkins)) {
        for (const oldSkin of data.ownedCapSkins) {
          const skinId = typeof oldSkin === 'string' ? oldSkin : oldSkin.id;
          const skinData = getCapSkin(skinId);

          if (skinData) {
            const oldLevel = typeof oldSkin === 'object' ? (oldSkin.level || 1) : 1;
            const baseLevel = Math.min(Math.ceil(oldLevel / 6), MAX_UPGRADE_LEVEL);

            data.ownedCaps.push({
              id: skinId,
              unlockedAt: typeof oldSkin === 'object' ? (oldSkin.unlockedAt || now) : now,
              upgrades: {
                power: baseLevel,
                mass: baseLevel,
                aim: baseLevel,
                technique: baseLevel,
              },
            });
          }
        }
      }

      for (const starterId of STARTER_CAPS) {
        if (!data.ownedCaps.find((c: OwnedCap) => c.id === starterId)) {
          data.ownedCaps.push({
            id: starterId,
            unlockedAt: now,
            upgrades: { ...DEFAULT_UPGRADES },
          });
        }
      }

      delete data.ownedCapSkins;
      delete data.equippedCapSkin;
    }

    if (!data.teamSetup) {
      data.teamSetup = {
        slot_0: data.ownedCaps[0]?.id || 'meme_doge',
        slot_1: data.ownedCaps[1]?.id || 'meme_gigachad',
        slot_2: data.ownedCaps[0]?.id || 'meme_doge',
      };
    }

    if (data.customFormations) {
      data.customFormations = data.customFormations.map((f: any) => ({
        id: f.id,
        name: f.name,
        slots: (f.slots || f.positions || []).map((s: any, i: number) => ({
          id: s.id || `slot_${i}`,
          x: s.x,
          y: s.y,
        })),
        isCustom: f.isCustom || false,
      }));
    }

    if (data.ownedBallSkins) {
      data.ownedBallSkins = data.ownedBallSkins.map((s: any) => ({
        id: typeof s === 'string' ? s : s.id,
        unlockedAt: typeof s === 'object' ? (s.unlockedAt || now) : now,
      }));
    } else {
      data.ownedBallSkins = [{ id: 'ball_plasma', unlockedAt: now }];
    }

    if (data.ownedFieldSkins) {
      data.ownedFieldSkins = data.ownedFieldSkins.map((s: any) => ({
        id: typeof s === 'string' ? s : s.id,
        unlockedAt: typeof s === 'object' ? (s.unlockedAt || now) : now,
      }));
    } else {
      data.ownedFieldSkins = [{ id: 'field_default', unlockedAt: now }];
    }

    if (!data.selectedFormation) {
      data.selectedFormation = 'formation_2_1';
    }
    if (!data.customFormations) {
      data.customFormations = [];
    }

    if (!data.settings) {
      data.settings = {
        soundEnabled: true,
        musicEnabled: true,
        vibrationEnabled: true,
        language: 'en',
        screenScale: 1.0,
      };
    }
    if (data.settings.screenScale === undefined) {
      data.settings.screenScale = 1.0;
    }

    if (!data.achievements) data.achievements = [];
    if (!data.xp) data.xp = 0;
    if (!data.level) data.level = 1;

    if (!data.stats) {
      data.stats = {
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
      };
    }

    if (!data.nickname) {
      data.nickname = data.username || 'Player';
    }
    if (!data.username) {
      data.username = data.nickname;
    }
    if (!data.avatarId) {
      data.avatarId = DEFAULT_AVATAR_ID;
    }
    if (data.isProfileSetupComplete === undefined) {
      data.isProfileSetupComplete = true;
    }
    
    // ✅ МИГРАЦИЯ: Дефолтный мяч
    if (!data.equippedBallSkin || data.equippedBallSkin === 'ball_default') {
      data.equippedBallSkin = 'ball_plasma';
      if (!data.ownedBallSkins.some(s => s.id === 'ball_plasma')) {
        data.ownedBallSkins.push({ id: 'ball_plasma', unlockedAt: now });
      }
    }
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

  // ==================== PROFILE ====================

  getNickname(): string {
    return this.data.nickname || this.data.username || 'Player';
  }

  setNickname(nickname: string): void {
    this.data.nickname = nickname;
    this.data.username = nickname;
    this.save();
  }

  getAvatarId(): string {
    return this.data.avatarId || DEFAULT_AVATAR_ID;
  }

  setAvatarId(avatarId: string): void {
    this.data.avatarId = avatarId;
    this.save();
  }

  isProfileSetupComplete(): boolean {
    return !!this.data.isProfileSetupComplete;
  }

  markProfileComplete(): void {
    this.data.isProfileSetupComplete = true;
    this.save();
  }

  // ==================== FACTION ====================

  /** Получить активную фракцию */
  getFaction(): FactionId | undefined {
    return this.data.selectedFaction;
  }

  /** Установить активную фракцию (при первом выборе или переключении) */
  setFaction(factionId: FactionId): void {
    this.data.selectedFaction = factionId;

    // Выдаём стартовых юнитов если их нет
    if (this.data.ownedUnits[factionId].length === 0) {
      const starters = getStarterUnits(factionId);
      const now = Date.now();

      starters.forEach((unit) => {
        this.data.ownedUnits[factionId].push({
          id: unit.id,
          unlockedAt: now,
          upgrades: { ...DEFAULT_UPGRADES },
        });
      });

      const starterIds = starters.slice(0, 3).map(u => u.id);
      this.data.factionTeams[factionId] = [
        starterIds[0] || '',
        starterIds[1] || '',
        starterIds[2] || '',
      ];

      console.log(`🛸 Faction ${factionId} initialized with starter units`);
    }

    this.save();
  }

  /** Проверка владения фракцией */
  ownsFaction(factionId: FactionId): boolean {
    if (this.data.selectedFaction === factionId) return true;
    return this.data.ownedUnits[factionId].length > 0;
  }

  /** Получить список купленных фракций */
  getOwnedFactions(): FactionId[] {
    const owned: FactionId[] = [];
    
    for (const factionId of FACTION_IDS) {
      if (this.ownsFaction(factionId)) {
        owned.push(factionId);
      }
    }
    
    return owned;
  }

  /** Купить новую фракцию */
  buyFaction(factionId: FactionId): boolean {
    if (this.ownsFaction(factionId)) return false;
    
    const price = getFactionPrice(factionId);
    
    if (price.crystals) {
      if (!this.spendCrystals(price.crystals)) return false;
    } else if (price.coins) {
      if (!this.spendCoins(price.coins)) return false;
    }
    
    const starters = getStarterUnits(factionId);
    const now = Date.now();
    
    starters.forEach((unit) => {
      this.data.ownedUnits[factionId].push({
        id: unit.id,
        unlockedAt: now,
        upgrades: { ...DEFAULT_UPGRADES },
      });
    });
    
    const starterIds = starters.slice(0, 3).map(u => u.id);
    this.data.factionTeams[factionId] = [
      starterIds[0] || '',
      starterIds[1] || '',
      starterIds[2] || '',
    ];
    
    this.save();
    console.log(`✅ Bought faction: ${factionId}`);
    return true;
  }

  /** Переключиться на другую фракцию */
  switchFaction(factionId: FactionId): boolean {
    if (!this.ownsFaction(factionId)) return false;
    if (this.data.selectedFaction === factionId) return false;
    
    this.data.selectedFaction = factionId;
    this.save();
    console.log(`🔄 Switched to faction: ${factionId}`);
    return true;
  }

  /** Проверка наличия фракции (алиас для совместимости) */
  hasFaction(): boolean {
    return !!this.data.selectedFaction;
  }

  // ==================== UNITS (FACTIONS) ====================

  getOwnedUnits(factionId?: FactionId): OwnedUnit[] {
    const faction = factionId || this.data.selectedFaction;
    if (!faction) return [];
    return this.data.ownedUnits[faction] || [];
  }

  buyUnit(unitId: string): boolean {
    const unitData = getUnit(unitId);
    if (!unitData) return false;

    const faction = this.data.selectedFaction;
    if (!faction || unitData.factionId !== faction) return false;

    if (this.data.ownedUnits[faction].some(u => u.id === unitId)) return false;

    if (unitData.price.crystals) {
      if (!this.spendCrystals(unitData.price.crystals)) return false;
    } else if (unitData.price.coins) {
      if (!this.spendCoins(unitData.price.coins)) return false;
    }

    this.data.ownedUnits[faction].push({
      id: unitId,
      unlockedAt: Date.now(),
      upgrades: { ...DEFAULT_UPGRADES },
    });

    this.save();
    console.log(`✅ Bought unit: ${unitId}`);
    return true;
  }

  upgradeUnit(unitId: string, stat: keyof CapUpgrades): boolean {
    const faction = this.data.selectedFaction;
    if (!faction) return false;

    const unit = this.data.ownedUnits[faction].find(u => u.id === unitId);
    if (!unit) return false;

    const currentLevel = unit.upgrades[stat];
    if (currentLevel >= MAX_UPGRADE_LEVEL) return false;

    const cost = getUpgradeCost(currentLevel);
    if (!this.spendCoins(cost)) return false;

    unit.upgrades[stat]++;
    this.save();
    return true;
  }

  getTeamUnits(): string[] {
    const faction = this.data.selectedFaction;
    if (!faction) return [];
    return this.data.factionTeams[faction] || ['', '', ''];
  }

  setTeamUnit(slot: number, unitId: string): void {
    const faction = this.data.selectedFaction;
    if (!faction || slot < 0 || slot > 2) return;

    if (!this.data.ownedUnits[faction].some(u => u.id === unitId)) return;

    this.data.factionTeams[faction][slot] = unitId;
    this.save();
  }

  getOwnedUnit(unitId: string): OwnedUnit | undefined {
    const faction = this.data.selectedFaction;
    if (!faction) return undefined;
    return this.data.ownedUnits[faction].find(u => u.id === unitId);
  }

  getUnitStats(unitId: string): CapUpgrades {
    const unit = this.getOwnedUnit(unitId);
    if (!unit) {
      return { ...DEFAULT_UPGRADES };
    }
    return { ...unit.upgrades };
  }

  getUnitPower(unitId: string): number {
    const unit = this.getOwnedUnit(unitId);
    if (!unit) return 4;
    return getCapTotalLevel(unit.upgrades);
  }

  // ==================== CURRENCY ====================

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

  addCrystals(amount: number): void {
    this.data.crystals += amount;
    this.save();
  }

  spendCrystals(amount: number): boolean {
    if (this.data.crystals >= amount) {
      this.data.crystals -= amount;
      this.save();
      return true;
    }
    return false;
  }

  // ==================== XP & LEVEL ====================

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

  // ==================== LEGACY CAPS ====================

  getOwnedCaps(): OwnedCap[] {
    return this.data.ownedCaps;
  }

  ownsCap(capId: string): boolean {
    return this.data.ownedCaps.some(c => c.id === capId);
  }

  getOwnedCap(capId: string): OwnedCap | undefined {
    return this.data.ownedCaps.find(c => c.id === capId);
  }

  buyCap(capId: string): boolean {
    if (this.ownsCap(capId)) return false;

    const skinData = getCapSkin(capId);
    if (!skinData) return false;

    if (skinData.price.crystals) {
      if (!this.spendCrystals(skinData.price.crystals)) return false;
    } else if (skinData.price.coins) {
      if (!this.spendCoins(skinData.price.coins)) return false;
    }

    this.data.ownedCaps.push({
      id: capId,
      unlockedAt: Date.now(),
      upgrades: { ...DEFAULT_UPGRADES },
    });

    this.save();
    return true;
  }

  upgradeCap(capId: string, stat: keyof CapUpgrades): boolean {
    const cap = this.getOwnedCap(capId);
    if (!cap) return false;

    const currentLevel = cap.upgrades[stat];
    if (currentLevel >= MAX_UPGRADE_LEVEL) return false;

    const cost = getUpgradeCost(currentLevel);
    if (!this.spendCoins(cost)) return false;

    cap.upgrades[stat]++;
    this.save();
    return true;
  }

  getCapStats(capId: string): CapUpgrades {
    const cap = this.getOwnedCap(capId);
    if (!cap) {
      return { ...DEFAULT_UPGRADES };
    }
    return { ...cap.upgrades };
  }

  getCapPower(capId: string): number {
    const cap = this.getOwnedCap(capId);
    if (!cap) return 4;
    return getCapTotalLevel(cap.upgrades);
  }

  // ==================== BALL & FIELD SKINS ====================

  ownsBallSkin(skinId: string): boolean {
    return this.data.ownedBallSkins.some(s => s.id === skinId);
  }

  ownsFieldSkin(skinId: string): boolean {
    return this.data.ownedFieldSkins.some(s => s.id === skinId);
  }

  buyBallSkin(skinId: string, price: { coins?: number; crystals?: number }): boolean {
    if (this.ownsBallSkin(skinId)) return false;

    if (price.crystals) {
      if (!this.spendCrystals(price.crystals)) return false;
    } else if (price.coins) {
      if (!this.spendCoins(price.coins)) return false;
    }

    this.data.ownedBallSkins.push({
      id: skinId,
      unlockedAt: Date.now(),
    });
    this.save();
    return true;
  }

  buyFieldSkin(skinId: string, price: { coins?: number; crystals?: number }): boolean {
    if (this.ownsFieldSkin(skinId)) return false;

    if (price.crystals) {
      if (!this.spendCrystals(price.crystals)) return false;
    } else if (price.coins) {
      if (!this.spendCoins(price.coins)) return false;
    }

    this.data.ownedFieldSkins.push({
      id: skinId,
      unlockedAt: Date.now(),
    });
    this.save();
    return true;
  }

  equipBallSkin(skinId: string): void {
    if (this.ownsBallSkin(skinId)) {
      this.data.equippedBallSkin = skinId;
      this.save();
    }
  }

  equipFieldSkin(skinId: string): void {
    if (this.ownsFieldSkin(skinId)) {
      this.data.equippedFieldSkin = skinId;
      this.save();
    }
  }

  // ==================== TEAM & FORMATIONS (LEGACY) ====================

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

  getTeamSetup(): TeamSetup {
    return { ...this.data.teamSetup };
  }

  setCapInSlot(slotId: string, capId: string): void {
    if (!this.ownsCap(capId)) return;
    this.data.teamSetup[slotId] = capId;
    this.save();
  }

  getCapInSlot(slotId: string): string | null {
    return this.data.teamSetup[slotId] || null;
  }

  getTeamCapIds(): string[] {
    const formation = this.getSelectedFormation();
    return formation.slots.map(slot =>
      this.data.teamSetup[slot.id] || this.data.ownedCaps[0]?.id || 'meme_doge'
    );
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

  // ==================== STATS ====================

  updateStats(
    result: 'win' | 'loss' | 'draw',
    goalsScored: number,
    goalsConceded: number
  ): void {
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

  // ==================== ACHIEVEMENTS ====================

  unlockAchievement(id: string): boolean {
    if (this.data.achievements.some(a => a.id === id)) return false;
    this.data.achievements.push({ id, unlockedAt: Date.now() });
    this.save();
    return true;
  }

  hasAchievement(id: string): boolean {
    return this.data.achievements.some(a => a.id === id);
  }

  // ==================== SETTINGS ====================

  setScreenScale(scale: number): void {
    this.data.settings.screenScale = Phaser.Math.Clamp(scale, 0.8, 1.3);
    this.save();
  }

  getScreenScale(): number {
    return this.data.settings.screenScale || 1.0;
  }

  // ==================== RESET ====================

  reset(): void {
    this.data = createDefaultPlayerData(this.telegramUser);
    this.save();
  }
}

// ==================== EXPORT ====================

export const playerData = new PlayerDataManager();