// ✅ ИЗМЕНЕНО: v9 - Добавлена система Faction Mastery, динамические команды 3-5 юнитов

import { getCapSkin, getUpgradeCost, MAX_UPGRADE_LEVEL } from './SkinsCatalog';
import { FactionId, FACTION_IDS, getFactionPrice, ABILITY_CARD_PRICES } from '../constants/gameConstants';
export type { FactionId }; // ✅ ИСПРАВЛЕНО: Добавлено слово type для изолированных модулей

import { AudioManager } from '../managers/AudioManager';
import { getUnit, getStarterUnits, getUnitsByFaction } from './UnitsCatalog';
import { getStarterUnitsFromRepository } from './UnitsRepository'; // ✅ НОВОЕ: Стартовые из репозитория
import { eventBus } from '../core/EventBus';
import { 
  CampaignProgress, 
  ChapterProgress, 
  LevelProgress,
  LevelConfig,
  CampaignLevelResult,
} from '../types/CampaignTypes';
import { 
  CAMPAIGN_CHAPTERS, 
  CAMPAIGN_LEVELS, 
  getChapter,
  getNextLevel,
  getAllChaptersOrdered,
} from './CampaignData';
import { getCommonCards, getAllCardIds, getCard } from './CardsCatalog';
import { FactionMasteryManager, LevelUpResult } from '../managers/FactionMasteryManager';
import { getMysticCapById } from './CapCollectionCatalog';
import { LeagueProgress, createDefaultLeagueProgress } from '../types/league';
import { TournamentState, createDefaultTournamentState, TournamentRuntimeState } from '../types/tournament';
import { SeasonState, createNewSeasonState } from '../types/season';
import { BattlePassProgress } from './BattlePassData';
import { PvPStats, createDefaultPvPStats, PvPMode } from '../types/pvp';

// =====================================================
// 🌐 SERVER SYNC INTEGRATION
// =====================================================
import { apiClient } from '../api/ApiClient';

// Флаги для синхронизации
let serverSyncEnabled = true;
let pendingSync = false;
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const SYNC_DEBOUNCE_MS = 3000; // Синхронизация не чаще раза в 3 секунды

// ====== ВЕРСИЯ ДАННЫХ — увеличивай для принудительного сброса ======
// ⭐ INCREASED to 23 - Shop update: 20 shop units added (2026-01-20)
const DATA_VERSION = 23;

export interface CapUpgrades {
  power: number;
  mass: number;
  aim: number;
  technique: number;
}

export interface OwnedCap {
  id: string;
  unlockedAt: number;
  upgrades: CapUpgrades;
}

export interface OwnedUnit {
  id: string;
  unlockedAt: number;
  upgrades: CapUpgrades;
}

export interface OwnedSkin {
  id: string;
  unlockedAt: number;
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

export interface FormationSlot {
  id: string;
  x: number;
  y: number;
}

// ✅ ИЗМЕНЕНО: Добавлено поле teamSize
export interface Formation {
  id: string;
  name: string;
  teamSize: number; // 3, 4 или 5
  slots: FormationSlot[];
  isCustom: boolean;
}

export interface TeamSetup {
  [slotId: string]: string | null;
}

// ========== НОВЫЕ ТИПЫ ДЛЯ КАРТОЧНОЙ СИСТЕМЫ ==========

/** Инвентарь карт: cardId -> количество */
export interface CardInventory {
  cards: Record<string, number>;
}

/** Лоадаут для фракции: 3 слота для карт (null = пустой слот) */
export type FactionLoadout = [string | null, string | null, string | null];

/** Все лоадауты по фракциям */
export type AllLoadouts = Record<FactionId, FactionLoadout>;

// ✅ НОВОЕ: Интерфейс прогресса мастерства фракции
export interface FactionMasteryData {
  xp: number;
  level: number;
}

export interface PlayerData {
  id: string;
  telegramId?: number;
  telegramUsername?: string;
  telegramFirstName?: string;
  username: string;
  nickname: string;
  avatarId: string;
  ownedAvatars?: string[]; // Список купленных аватарок
  isProfileSetupComplete: boolean;
  selectedFaction?: FactionId;
  createdAt: number;
  lastLoginAt: number;
  coins: number;
  crystals: number;
  xp: number;
  level: number;
  stats: PlayerStats;
  achievements: { 
    id: string; 
    unlockedAt: number; // Первое разблокирование
    count: number; // ✅ Количество раз разблокировано
    lastUnlockedAt: number; // Последнее разблокирование
  }[];
  ownedUnits: Record<FactionId, OwnedUnit[]>;
  // ✅ ИЗМЕНЕНО: Теперь массив переменной длины (3-5 юнитов)
  factionTeams: Record<FactionId, string[]>;
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
  dataVersion?: number;
  
  // ========== НОВАЯ КАРТОЧНАЯ СИСТЕМА ==========
  /** Инвентарь карт способностей */
  inventory: CardInventory;
  /** Лоадауты карт для каждой фракции (3 слота) */
  loadouts: AllLoadouts;
  
  // ========== ПРОГРЕСС КАМПАНИИ ==========
  campaignProgress: CampaignProgress;
  /** Флаг завершения обучения (открывает Главу 1) */
  isTutorialCompleted: boolean;
  
  // ✅ НОВОЕ: Прогресс мастерства по фракциям
  factionMastery: Record<FactionId, FactionMasteryData>;
  
  // ========== КОЛЛЕКЦИОННЫЕ ФИШКИ (NEW UNIT SYSTEM - 80 UNIQUE UNITS) ==========
  /** Фрагменты юнитов: unitId -> количество (для всех 80 юнитов) */
  unitFragments?: Record<string, number>;
  /** Разблокированные уникальные юниты (для всех 80 юнитов из UnitsRepository) */
  ownedUniqueUnits?: string[];
  /** Экипированные скины фишек по фракциям (deprecated) */
  equippedCapSkinByFaction?: Partial<Record<FactionId, string>>;
  
  // ========== ТУТОРИАЛЬНЫЕ ФЛАГИ ==========
  /** Флаги туториала (подсказки и гайд-тур) */
  tutorialFlags?: {
    abilitiesHintShown?: boolean;
    pendingPostWinMenuTour?: boolean;
    postWinMenuTourShown?: boolean;
    postWinMenuTourStep?: 'menu' | 'shop' | 'team' | null;
  };
  
  // ========== ПУТЬ НОВИЧКА ==========
  rookiePath?: {
    tasks: Record<string, { progress: number; completed: boolean; claimed: boolean }>;
    pathCompleted: boolean;
    rewardClaimed: boolean;
    chosenFactionReward?: FactionId;
    startedAt: number;
    completedAt?: number;
  };
  
  // ========== GALAXY LEAGUE & TOURNAMENTS ==========
  /** Прогресс в лиге */
  leagueProgress?: LeagueProgress;
  /** Состояние турниров */
  tournamentState?: TournamentState;
  /** Состояние текущего сезона */
  seasonState?: SeasonState;
  /** Прогресс Battle Pass */
  battlePass?: BattlePassProgress;
  /** Текущий активный турнир (временное состояние) */
  activeTournament?: TournamentRuntimeState;
  /** PvP статистика и рейтинги */
  pvpStats?: PvPStats;
  /** Текущий режим матча (для отслеживания в GameScene) */
  currentMatchMode?: PvPMode | 'campaign' | 'league' | 'tournament' | 'custom';
  
  // ========== СИСТЕМА ОТСЛЕЖИВАНИЯ ЗАБРАННЫХ НАГРАД ==========
  /** Забранные награды за уровни игрока */
  claimedPlayerLevelRewards?: number[]; // [5, 10, 15, ...]
  /** Забранные награды за уровни мастерства фракций: factionId -> [level1, level2, ...] */
  claimedFactionLevelRewards?: Record<FactionId, number[]>;
}

const STARTER_CAPS = ['meme_doge', 'meme_gigachad'];
const DEFAULT_UPGRADES: CapUpgrades = { power: 1, mass: 1, aim: 1, technique: 1 };

// Стартовые юниты по фракциям (все 4 роли)
export const STARTER_UNITS_BY_FACTION: Record<FactionId, {
  balanced: string;
  tank: string;
  sniper: string;
  trickster: string;
}> = {
  magma: {
    balanced: 'magma_grunt',
    tank: 'magma_titan',
    sniper: 'magma_scout',
    trickster: 'magma_inferno',
  },
  cyborg: {
    balanced: 'cyborg_soldier',
    tank: 'cyborg_mech',
    sniper: 'cyborg_drone',
    trickster: 'cyborg_glitch',
  },
  void: {
    balanced: 'void_initiate',
    tank: 'void_guardian',
    sniper: 'void_sniper',
    trickster: 'void_bender',
  },
  insect: {
    balanced: 'insect_drone',
    tank: 'insect_brood',
    sniper: 'insect_spitter',
    trickster: 'insect_mimic',
  },
};

// Количество каждой Common карты для нового игрока
const STARTER_COMMON_CARDS_COUNT = 5;

// ✅ ИЗМЕНЕНО: Добавлен teamSize ко всем формациям + новые формации для 4 и 5 юнитов
export const DEFAULT_FORMATIONS: Formation[] = [
  // === 3 юнита ===
  { id: 'formation_2_1', name: '2-1', teamSize: 3, slots: [
    { id: 'slot_0', x: 0.5, y: 0.7 },
    { id: 'slot_1', x: 0.25, y: 0.85 },
    { id: 'slot_2', x: 0.75, y: 0.85 },
  ], isCustom: false },
  { id: 'formation_1_2', name: '1-2', teamSize: 3, slots: [
    { id: 'slot_0', x: 0.5, y: 0.85 },
    { id: 'slot_1', x: 0.3, y: 0.7 },
    { id: 'slot_2', x: 0.7, y: 0.7 },
  ], isCustom: false },
  { id: 'formation_1_1_1', name: '1-1-1', teamSize: 3, slots: [
    { id: 'slot_0', x: 0.5, y: 0.65 },
    { id: 'slot_1', x: 0.5, y: 0.77 },
    { id: 'slot_2', x: 0.5, y: 0.88 },
  ], isCustom: false },
  { id: 'formation_3_0', name: '3-0', teamSize: 3, slots: [
    { id: 'slot_0', x: 0.25, y: 0.72 },
    { id: 'slot_1', x: 0.5, y: 0.72 },
    { id: 'slot_2', x: 0.75, y: 0.72 },
  ], isCustom: false },
  { id: 'formation_0_3', name: '0-3', teamSize: 3, slots: [
    { id: 'slot_0', x: 0.25, y: 0.88 },
    { id: 'slot_1', x: 0.5, y: 0.88 },
    { id: 'slot_2', x: 0.75, y: 0.88 },
  ], isCustom: false },
  { id: 'formation_triangle', name: '▲ Triangle', teamSize: 3, slots: [
    { id: 'slot_0', x: 0.5, y: 0.68 },
    { id: 'slot_1', x: 0.3, y: 0.85 },
    { id: 'slot_2', x: 0.7, y: 0.85 },
  ], isCustom: false },
  
  // === 4 юнита ===
  { id: 'formation_box', name: 'Box 2-2', teamSize: 4, slots: [
    { id: 'slot_0', x: 0.3, y: 0.68 },
    { id: 'slot_1', x: 0.7, y: 0.68 },
    { id: 'slot_2', x: 0.3, y: 0.85 },
    { id: 'slot_3', x: 0.7, y: 0.85 },
  ], isCustom: false },
  { id: 'formation_diamond', name: 'Diamond 1-2-1', teamSize: 4, slots: [
    { id: 'slot_0', x: 0.5, y: 0.6 },
    { id: 'slot_1', x: 0.25, y: 0.75 },
    { id: 'slot_2', x: 0.75, y: 0.75 },
    { id: 'slot_3', x: 0.5, y: 0.9 },
  ], isCustom: false },
  { id: 'formation_line_4', name: 'Line 4', teamSize: 4, slots: [
    { id: 'slot_0', x: 0.2, y: 0.78 },
    { id: 'slot_1', x: 0.4, y: 0.78 },
    { id: 'slot_2', x: 0.6, y: 0.78 },
    { id: 'slot_3', x: 0.8, y: 0.78 },
  ], isCustom: false },
  { id: 'formation_y_shape', name: 'Y-Shape 1-3', teamSize: 4, slots: [
    { id: 'slot_0', x: 0.5, y: 0.65 },
    { id: 'slot_1', x: 0.2, y: 0.85 },
    { id: 'slot_2', x: 0.5, y: 0.85 },
    { id: 'slot_3', x: 0.8, y: 0.85 },
  ], isCustom: false },
  
  // === 5 юнитов ===
  { id: 'formation_wall', name: 'Wall 2-3', teamSize: 5, slots: [
    { id: 'slot_0', x: 0.35, y: 0.65 },
    { id: 'slot_1', x: 0.65, y: 0.65 },
    { id: 'slot_2', x: 0.2, y: 0.85 },
    { id: 'slot_3', x: 0.5, y: 0.85 },
    { id: 'slot_4', x: 0.8, y: 0.85 },
  ], isCustom: false },
  { id: 'formation_v', name: 'V-Formation', teamSize: 5, slots: [
    { id: 'slot_0', x: 0.5, y: 0.6 },
    { id: 'slot_1', x: 0.3, y: 0.72 },
    { id: 'slot_2', x: 0.7, y: 0.72 },
    { id: 'slot_3', x: 0.15, y: 0.88 },
    { id: 'slot_4', x: 0.85, y: 0.88 },
  ], isCustom: false },
  { id: 'formation_pentagon', name: 'Pentagon', teamSize: 5, slots: [
    { id: 'slot_0', x: 0.5, y: 0.58 },
    { id: 'slot_1', x: 0.2, y: 0.72 },
    { id: 'slot_2', x: 0.8, y: 0.72 },
    { id: 'slot_3', x: 0.3, y: 0.9 },
    { id: 'slot_4', x: 0.7, y: 0.9 },
  ], isCustom: false },
  { id: 'formation_cross', name: 'Cross 1-3-1', teamSize: 5, slots: [
    { id: 'slot_0', x: 0.5, y: 0.55 },
    { id: 'slot_1', x: 0.2, y: 0.75 },
    { id: 'slot_2', x: 0.5, y: 0.75 },
    { id: 'slot_3', x: 0.8, y: 0.75 },
    { id: 'slot_4', x: 0.5, y: 0.92 },
  ], isCustom: false },
];

// ========== ФУНКЦИЯ СОЗДАНИЯ НАЧАЛЬНОГО ПРОГРЕССА КАМПАНИИ ==========

function createDefaultCampaignProgress(): CampaignProgress {
  const chapters: Record<string, ChapterProgress> = {};
  
  Object.keys(CAMPAIGN_CHAPTERS).forEach(chapterId => {
    const chapter = CAMPAIGN_CHAPTERS[chapterId];
    const levels: Record<string, LevelProgress> = {};
    
    chapter.levelIds.forEach(levelId => {
      levels[levelId] = {
        levelId,
        completed: false,
        stars: 0,
        bestPlayerScore: 0,
        bestEnemyScore: 999,
        attempts: 0,
      };
    });
    
    chapters[chapterId] = {
      chapterId,
      unlocked: chapterId === 'chapter_1',
      totalStars: 0,
      bossDefeated: false,
      levels,
    };
  });
  
  return {
    chapters,
    totalStars: 0,
    currentChapterId: 'chapter_1',
    tutorialCompleted: false,
    version: 1,
  };
}

// ========== ФУНКЦИЯ СОЗДАНИЯ СТАРТОВОГО ИНВЕНТАРЯ КАРТ ==========

function createDefaultCardInventory(): CardInventory {
  const cards: Record<string, number> = {};
  
  const commonCards = getCommonCards();
  commonCards.forEach(card => {
    cards[card.id] = STARTER_COMMON_CARDS_COUNT;
  });
  
  console.log('🃏 Created starter card inventory:', cards);
  return { cards };
}

// ========== ФУНКЦИЯ СОЗДАНИЯ СТАРТОВЫХ ЛОАДАУТОВ (ПО ФРАКЦИЯМ) ==========

function createDefaultLoadouts(): AllLoadouts {
  return {
    magma: ['magma_lava', 'magma_molten', 'magma_meteor'],
    cyborg: ['cyborg_shield', 'cyborg_tether', 'cyborg_barrier'],
    void: ['void_swap', 'void_ghost', 'void_wormhole'],
    insect: ['insect_toxin', 'insect_mimic', 'insect_parasite'],
  };
}

// ✅ НОВОЕ: Функция создания дефолтного прогресса мастерства
function createDefaultFactionMastery(): Record<FactionId, FactionMasteryData> {
  return {
    magma: { xp: 0, level: 1 },
    cyborg: { xp: 0, level: 1 },
    void: { xp: 0, level: 1 },
    insect: { xp: 0, level: 1 },
  };
}

export function getXPForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

export function getCapTotalLevel(upgrades: CapUpgrades): number {
  return upgrades.power + upgrades.mass + upgrades.aim + upgrades.technique;
}

export function getRankByLevel(level: number): { name: string; icon: string; color: number } {
  if (level >= 50) return { name: 'Champion', icon: '👑', color: 0xffd700 };
  if (level >= 40) return { name: 'Diamond', icon: '💎', color: 0x67e8f9 };
  if (level >= 30) return { name: 'Platinum', icon: '🏆', color: 0xa855f7 };
  if (level >= 20) return { name: 'Gold', icon: '🥇', color: 0xfbbf24 };
  if (level >= 10) return { name: 'Silver', icon: '🥈', color: 0x94a3b8 };
  return { name: 'Bronze', icon: '🥉', color: 0xcd7f32 };
}

export function getTeamPower(caps: OwnedCap[]): number {
  return caps.reduce((sum, cap) => sum + getCapTotalLevel(cap.upgrades), 0);
}

function createDefaultPlayerData(tgUser?: any): PlayerData {
  const now = Date.now();
  const nickname = tgUser?.username || tgUser?.first_name || 'Player';

  return {
    id: tgUser?.id ? `tg_${tgUser.id}` : `player_${Math.random().toString(36).slice(2)}`,
    telegramId: tgUser?.id,
    telegramUsername: tgUser?.username,
    telegramFirstName: tgUser?.first_name,
    username: nickname,
    nickname,
    avatarId: 'avatar_recruit', // По умолчанию первая бесплатная
    ownedAvatars: ['avatar_recruit', 'avatar_explorer'], // Две бесплатные
    isProfileSetupComplete: true,
    selectedFaction: undefined,
    createdAt: now,
    lastLoginAt: now,
    coins: 500,
    crystals: 10,
    xp: 0,
    level: 1,
    stats: {
      gamesPlayed: 0, wins: 0, losses: 0, draws: 0,
      goalsScored: 0, goalsConceded: 0, totalPlayTime: 0,
      longestWinStreak: 0, currentWinStreak: 0, perfectGames: 0,
    },
    ownedUnits: { magma: [], cyborg: [], void: [], insect: [] }, // Старая система: базовые юниты по фракциям
    ownedUniqueUnits: [], // ⭐ NEW: Массив ID разблокированных уникальных юнитов (80 новых)
    factionTeams: { magma: ['', '', ''], cyborg: ['', '', ''], void: ['', '', ''], insect: ['', '', ''] },
    ownedCaps: STARTER_CAPS.map(id => ({ id, unlockedAt: now, upgrades: { ...DEFAULT_UPGRADES } })),
    teamSetup: { slot_0: 'meme_doge', slot_1: 'meme_gigachad', slot_2: 'meme_doge' },
    ownedBallSkins: [{ id: 'ball_plasma', unlockedAt: now }],
    ownedFieldSkins: [{ id: 'field_default', unlockedAt: now }],
    equippedBallSkin: 'ball_plasma',
    equippedFieldSkin: 'field_default',
    selectedFormation: 'formation_2_1',
    customFormations: [],
    achievements: [],
    settings: { soundEnabled: true, musicEnabled: true, vibrationEnabled: true, language: 'en', screenScale: 1.0 },
    dataVersion: DATA_VERSION,
    
    inventory: createDefaultCardInventory(),
    loadouts: createDefaultLoadouts(),
    
    campaignProgress: createDefaultCampaignProgress(),
    isTutorialCompleted: false,
    
    // ✅ НОВОЕ: Инициализация мастерства
    factionMastery: createDefaultFactionMastery(),
    
    // ========== PVP СИСТЕМА ==========
    pvpStats: createDefaultPvPStats(),
    
    // ========== КОЛЛЕКЦИОННЫЕ ФИШКИ ==========
    unitFragments: {},  // ⭐ NEW: Фрагменты для 80 уникальных юнитов
    equippedCapSkinByFaction: {},
    
    // ========== ТУТОРИАЛЬНЫЕ ФЛАГИ ==========
    tutorialFlags: {
      abilitiesHintShown: false,
      pendingPostWinMenuTour: false,
      postWinMenuTourShown: false,
      postWinMenuTourStep: null,
    },
    
    // ========== ПУТЬ НОВИЧКА ==========
    rookiePath: {
      tasks: {
        'rookie_first_win': { progress: 0, completed: false, claimed: false },
        'rookie_score_goals': { progress: 0, completed: false, claimed: false },
        'rookie_win_3': { progress: 0, completed: false, claimed: false },
        'rookie_chapter1': { progress: 0, completed: false, claimed: false },
        'rookie_boss_krag': { progress: 0, completed: false, claimed: false },
        'rookie_level_5': { progress: 0, completed: false, claimed: false },
        'rookie_perfect_game': { progress: 0, completed: false, claimed: false },
      },
      pathCompleted: false,
      rewardClaimed: false,
      startedAt: now,
    },
    
    // ========== GALAXY LEAGUE & TOURNAMENTS ==========
    leagueProgress: createDefaultLeagueProgress(),
    tournamentState: createDefaultTournamentState(),
    seasonState: createNewSeasonState(),
    
    // ========== СИСТЕМА ОТСЛЕЖИВАНИЯ ЗАБРАННЫХ НАГРАД ==========
    claimedPlayerLevelRewards: [],
    claimedFactionLevelRewards: { magma: [], cyborg: [], void: [], insect: [] },
  };
}

class PlayerDataManager {
  private STORAGE_KEY: string;
  private data: PlayerData;
  private tgUser?: any;

  constructor() {
    const tg = (window as any).Telegram?.WebApp;
    this.tgUser = tg?.initDataUnsafe?.user;
    this.STORAGE_KEY = this.tgUser?.id ? `memeball_player_data_${this.tgUser.id}` : 'memeball_player_data';
    
    this.data = this.load();
  }

  private load(): PlayerData {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // 🔥 HARD WIPE CHECK: If version doesn't match current, destroy everything.
        // ✅ FIXED (2026-01-20): Check against DATA_VERSION instead of hardcoded 16
        if (!parsed.dataVersion || parsed.dataVersion < DATA_VERSION) {
          console.warn(`⚠️ OUTDATED DATA DETECTED (v${parsed.dataVersion || 0} < ${DATA_VERSION}). FORCING WIPE.`);
          localStorage.removeItem(this.STORAGE_KEY);
          // Fall through to createDefaultPlayerData
        } else {
          // Valid version, proceed normally
          this.migrate(parsed); // Keep migrate for future minor updates (16 -> 17)
          parsed.lastLoginAt = Date.now();
          AudioManager.getInstance().loadSettings(parsed.settings);
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load player data:', e);
    }
    
    // Create new fresh data
    const newData = createDefaultPlayerData(this.tgUser);
    this.data = newData;
    this.save();
    console.log('✨ Created FRESH player profile (WIPED)');
    
    return newData;
  }

  private migrate(d: any): void {
    const now = Date.now();

    if (d.stars !== undefined) { d.crystals = d.stars; delete d.stars; }
    d.crystals = d.crystals ?? 10;
    d.coins = d.coins ?? 500;
    d.username = d.username ?? d.nickname ?? 'Player';
    d.nickname = d.nickname ?? d.username ?? 'Player';

    d.ownedUnits = d.ownedUnits ?? { magma: [], cyborg: [], void: [], insect: [] };
    d.factionTeams = d.factionTeams ?? { magma: ['', '', ''], cyborg: ['', '', ''], void: ['', '', ''], insect: ['', '', ''] };

    const factionIds: FactionId[] = ['magma', 'cyborg', 'void', 'insect'];
    factionIds.forEach(factionId => {
      const ownedUnits = d.ownedUnits[factionId] || [];
      const ownedIds = new Set(ownedUnits.map((u: any) => u.id));
      const team = d.factionTeams[factionId] || ['', '', ''];
      const defaultId = ownedUnits[0]?.id || '';
      
      // ✅ ИЗМЕНЕНО: Теперь сохраняем как массив переменной длины
      // Гарантируем минимум 3 слота
      const validatedTeam: string[] = [];
      for (let i = 0; i < Math.max(3, team.length); i++) {
        const unitId = team[i];
        validatedTeam.push(ownedIds.has(unitId) && unitId ? unitId : defaultId);
      }
      d.factionTeams[factionId] = validatedTeam;
    });

    if (!d.ownedCaps) {
      d.ownedCaps = STARTER_CAPS.map(id => ({ id, unlockedAt: now, upgrades: { ...DEFAULT_UPGRADES } }));
    }
    d.teamSetup = d.teamSetup ?? { slot_0: 'meme_doge', slot_1: 'meme_gigachad', slot_2: 'meme_doge' };

    d.ownedBallSkins = d.ownedBallSkins ?? [{ id: 'ball_plasma', unlockedAt: now }];
    d.ownedFieldSkins = d.ownedFieldSkins ?? [{ id: 'field_default', unlockedAt: now }];
    d.equippedBallSkin = d.equippedBallSkin ?? 'ball_plasma';
    d.equippedFieldSkin = d.equippedFieldSkin ?? 'field_default';

    d.selectedFormation = d.selectedFormation ?? 'formation_2_1';
    d.customFormations = d.customFormations ?? [];
    
    // ✅ НОВОЕ: Миграция кастомных формаций - добавляем teamSize
    d.customFormations.forEach((formation: any) => {
      if (formation.teamSize === undefined) {
        formation.teamSize = formation.slots?.length || 3;
        console.log(`🔄 [Migration] Added teamSize=${formation.teamSize} to custom formation ${formation.id}`);
      }
    });
    
    d.achievements = d.achievements ?? [];
    
    // ✅ МИГРАЦИЯ: Добавляем count и lastUnlockedAt к существующим достижениям
    d.achievements.forEach((ach: any) => {
      if (typeof ach.count === 'undefined') {
        ach.count = 1; // Старые достижения считаем разблокированными 1 раз
        ach.lastUnlockedAt = ach.unlockedAt || Date.now();
        console.log(`🔄 [Migration] Added count=1 to achievement ${ach.id}`);
      }
    });
    
    d.xp = d.xp ?? 0;
    d.level = d.level ?? 1;
    d.stats = d.stats ?? {
      gamesPlayed: 0, wins: 0, losses: 0, draws: 0,
      goalsScored: 0, goalsConceded: 0, totalPlayTime: 0,
      longestWinStreak: 0, currentWinStreak: 0, perfectGames: 0,
    };
    d.settings = d.settings ?? { soundEnabled: true, musicEnabled: true, vibrationEnabled: true, language: 'en', screenScale: 1.0 };
    
    d.avatarId = d.avatarId ?? 'avatar_1';
    d.isProfileSetupComplete = true;
    
    // ========== МИГРАЦИЯ КАРТОЧНОЙ СИСТЕМЫ ==========
    if (d.abilityCards !== undefined) {
      console.log('🔄 [Migration] Removing old abilityCards field');
      delete d.abilityCards;
    }
    
    if (!d.inventory || !d.inventory.cards) {
      d.inventory = createDefaultCardInventory();
      console.log('🃏 [Migration] Created new card inventory with starter cards');
    }
    
    if (!d.loadouts) {
      d.loadouts = createDefaultLoadouts();
      console.log('🎴 [Migration] Created default loadouts with starter abilities');
    } else {
      // НОВАЯ МИГРАЦИЯ: если у всех фракций лоадаут [null,null,null] — перезаписываем дефолтными картами
      const allNull = factionIds.every(f => 
        d.loadouts[f] && 
        d.loadouts[f][0] === null && 
        d.loadouts[f][1] === null && 
        d.loadouts[f][2] === null
      );

      if (allNull) {
        d.loadouts = createDefaultLoadouts();
        console.log('🎴 [Migration] All loadouts were empty → filled with default starter abilities');
      } else {
        // Просто гарантируем наличие всех фракций
        factionIds.forEach(factionId => {
          if (!d.loadouts[factionId]) {
            d.loadouts[factionId] = [null, null, null];
          }
        });
      }
    }
    
    // ========== МИГРАЦИЯ КАМПАНИИ ==========
    if (!d.campaignProgress) {
      d.campaignProgress = createDefaultCampaignProgress();
      console.log('📦 Campaign progress initialized');
    } else {
      Object.keys(CAMPAIGN_CHAPTERS).forEach(chapterId => {
        if (!d.campaignProgress.chapters[chapterId]) {
          const chapter = CAMPAIGN_CHAPTERS[chapterId];
          const levels: Record<string, LevelProgress> = {};
          
          chapter.levelIds.forEach(levelId => {
            levels[levelId] = {
              levelId,
              completed: false,
              stars: 0,
              bestPlayerScore: 0,
              bestEnemyScore: 999,
              attempts: 0,
            };
          });
          
          d.campaignProgress.chapters[chapterId] = {
            chapterId,
            unlocked: false,
            totalStars: 0,
            bossDefeated: false,
            levels,
          };
          console.log(`📦 Added new chapter: ${chapterId}`);
        }
      });
    }
    
    if (d.isTutorialCompleted === undefined) {
      d.isTutorialCompleted = false;
    }

    if (d.selectedFaction && !d.campaignProgress?.tutorialCompleted) {
      d.campaignProgress.tutorialCompleted = true;
      d.isTutorialCompleted = true;
      
      if (d.campaignProgress.chapters['chapter_1']) {
        d.campaignProgress.chapters['chapter_1'].unlocked = true;
      }
      
      console.log('🔄 [Migration] Existing player with faction — tutorial marked as completed automatically');
    }
    
    if (d.stats?.gamesPlayed > 0 && !d.campaignProgress?.tutorialCompleted) {
      d.campaignProgress.tutorialCompleted = true;
      d.isTutorialCompleted = true;
      
      if (d.campaignProgress.chapters['chapter_1']) {
        d.campaignProgress.chapters['chapter_1'].unlocked = true;
      }
      
      console.log('🔄 [Migration] Player has games played — tutorial marked as completed');
    }
    
    // ✅ НОВОЕ: Миграция Faction Mastery (v9)
    if (!d.factionMastery) {
      d.factionMastery = createDefaultFactionMastery();
      console.log('🏆 [Migration] Created default faction mastery progress');
    } else {
      // Гарантируем наличие всех фракций
      factionIds.forEach(factionId => {
        if (!d.factionMastery[factionId]) {
          d.factionMastery[factionId] = { xp: 0, level: 1 };
          console.log(`🏆 [Migration] Added missing mastery for faction: ${factionId}`);
        }
      });
    }
    
    // ✅ НОВОЕ: Миграция коллекционных фишек
    if (!d.unitFragments) {
      d.unitFragments = {};
      console.log('🧩 [Migration] Created unit fragments storage');
    }
    if (!d.ownedUniqueUnits) {
      d.ownedUniqueUnits = [];
      console.log('✨ [Migration] Created unique units storage');
    }
    if (!d.equippedCapSkinByFaction) {
      d.equippedCapSkinByFaction = {};
      console.log('🎨 [Migration] Created equipped cap skins storage');
    }
    
    // ========== МИГРАЦИЯ ТУТОРИАЛЬНЫХ ФЛАГОВ ==========
    if (!d.tutorialFlags) {
      d.tutorialFlags = {
        abilitiesHintShown: false,
        pendingPostWinMenuTour: false,
        postWinMenuTourShown: false,
        postWinMenuTourStep: null,
      };
      console.log('📚 [Migration] Created tutorial flags');
    } else {
      // Ensure all fields exist
      if (d.tutorialFlags.abilitiesHintShown === undefined) {
        d.tutorialFlags.abilitiesHintShown = false;
      }
      if (d.tutorialFlags.pendingPostWinMenuTour === undefined) {
        d.tutorialFlags.pendingPostWinMenuTour = false;
      }
      if (d.tutorialFlags.postWinMenuTourShown === undefined) {
        d.tutorialFlags.postWinMenuTourShown = false;
      }
      if (d.tutorialFlags.postWinMenuTourStep === undefined) {
        d.tutorialFlags.postWinMenuTourStep = null;
      }
    }
    
    // ========== МИГРАЦИЯ GALAXY LEAGUE & TOURNAMENTS ==========
    if (!d.leagueProgress) {
      d.leagueProgress = createDefaultLeagueProgress();
      console.log('🏆 [Migration] Created default league progress');
    }
    
    if (!d.tournamentState) {
      d.tournamentState = createDefaultTournamentState();
      console.log('🎯 [Migration] Created default tournament state');
    }
    
    if (!d.seasonState) {
      d.seasonState = createNewSeasonState();
      console.log('📅 [Migration] Created new season state');
    }
    
    // ========== МИГРАЦИЯ СИСТЕМЫ ЗАБРАННЫХ НАГРАД ==========
    if (!d.claimedPlayerLevelRewards) {
      d.claimedPlayerLevelRewards = [];
      console.log('🎁 [Migration] Initialized claimedPlayerLevelRewards');
    }
    
    if (!d.claimedFactionLevelRewards) {
      d.claimedFactionLevelRewards = { magma: [], cyborg: [], void: [], insect: [] };
      console.log('🎁 [Migration] Initialized claimedFactionLevelRewards');
    } else {
      // Убедимся что все фракции есть
      factionIds.forEach(factionId => {
        if (!d.claimedFactionLevelRewards[factionId]) {
          d.claimedFactionLevelRewards[factionId] = [];
        }
      });
    }
    
    // ========== МИГРАЦИЯ ПУТИ НОВИЧКА ==========
    if (!d.rookiePath) {
      d.rookiePath = {
        tasks: {
          'rookie_first_win': { progress: 0, completed: false, claimed: false },
          'rookie_score_goals': { progress: 0, completed: false, claimed: false },
          'rookie_win_3': { progress: 0, completed: false, claimed: false },
          'rookie_chapter1': { progress: 0, completed: false, claimed: false },
          'rookie_boss_krag': { progress: 0, completed: false, claimed: false },
          'rookie_level_5': { progress: 0, completed: false, claimed: false },
          'rookie_perfect_game': { progress: 0, completed: false, claimed: false },
        },
        pathCompleted: false,
        rewardClaimed: false,
        startedAt: now,
      };
      console.log('🎓 [Migration] Initialized rookiePath');
    }
    
    d.dataVersion = DATA_VERSION;
  }

  save(): void {
    try {
      this.data.dataVersion = DATA_VERSION;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
      
      // 🌐 Синхронизация с сервером (с debounce)
      if (serverSyncEnabled && apiClient.hasTelegramAuth()) {
        if (syncDebounceTimer) {
          clearTimeout(syncDebounceTimer);
        }
        
        syncDebounceTimer = setTimeout(() => {
          this.syncToServer();
        }, SYNC_DEBOUNCE_MS);
      }
    } catch (e) {
      console.error('[PlayerData] Save failed:', e);
    }
  }

  private async syncToServer(): Promise<void> {
    if (pendingSync) return;
    pendingSync = true;
    
    try {
      const result = await apiClient.syncWithServer(this.data);
      
      if (result.action === 'download' && result.player) {
        console.log('[PlayerData] Applying server data...');
        this.applyServerData(result.player);
      } else if (result.action === 'synced') {
        console.log('[PlayerData] Synced with server');
      } else if (result.error) {
        console.warn('[PlayerData] Sync error:', result.error);
      }
    } catch (e) {
      console.error('[PlayerData] Sync failed:', e);
    } finally {
      pendingSync = false;
    }
  }

  private applyServerData(serverPlayer: any): void {
    // Временно отключаем синхронизацию чтобы избежать loop
    serverSyncEnabled = false;
    
    try {
      // Применяем критические данные с сервера (берём максимум)
      this.data.coins = Math.max(this.data.coins, serverPlayer.coins ?? 0);
      this.data.crystals = Math.max(this.data.crystals, serverPlayer.crystals ?? 0);
      this.data.level = Math.max(this.data.level, serverPlayer.level ?? 1);
      this.data.xp = Math.max(this.data.xp, serverPlayer.xp ?? 0);
      
      // Статистика (берём максимум)
      if (serverPlayer.stats) {
        this.data.stats.gamesPlayed = Math.max(
          this.data.stats.gamesPlayed, 
          serverPlayer.stats.totalMatches ?? 0
        );
        this.data.stats.wins = Math.max(
          this.data.stats.wins,
          serverPlayer.stats.totalWins ?? 0
        );
        this.data.stats.goalsScored = Math.max(
          this.data.stats.goalsScored,
          serverPlayer.stats.totalGoalsScored ?? 0
        );
      }
      
      // Лига
      if (serverPlayer.league) {
        if (!this.data.leagueProgress) {
          this.data.leagueProgress = createDefaultLeagueProgress();
        }
        // Синхронизируем данные лиги с сервера (если есть)
        // Примечание: MMR хранится в pvpStats, а не в leagueProgress
        if (serverPlayer.league.currentTier) {
          this.data.leagueProgress.currentTier = serverPlayer.league.currentTier;
        }
        if (serverPlayer.league.division) {
          this.data.leagueProgress.division = serverPlayer.league.division;
        }
        if (serverPlayer.league.stars !== undefined) {
          this.data.leagueProgress.stars = Math.max(
            this.data.leagueProgress.stars,
            serverPlayer.league.stars
          );
        }
      }
      
      // PvP MMR (если сервер возвращает MMR)
      if (serverPlayer.mmr && this.data.pvpStats) {
        // Синхронизируем MMR для ranked режима
        if (serverPlayer.mmr.ranked !== undefined) {
          this.data.pvpStats.ranked.rating = Math.max(
            this.data.pvpStats.ranked.rating,
            serverPlayer.mmr.ranked
          );
        }
        // Синхронизируем MMR для casual режима
        if (serverPlayer.mmr.casual !== undefined) {
          this.data.pvpStats.casual.rating = Math.max(
            this.data.pvpStats.casual.rating,
            serverPlayer.mmr.casual
          );
        }
      }
      
      // Сохраняем локально без повторной синхронизации
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
      
      console.log('[PlayerData] Server data applied successfully');
    } finally {
      serverSyncEnabled = true;
    }
  }

  get(): PlayerData { return this.data; }

  getNickname(): string { return this.data.nickname; }
  setNickname(n: string): void { this.data.nickname = n; this.data.username = n; this.save(); }
  // getAvatarId() moved to Avatar System section below
  setAvatarId(id: string): void { this.data.avatarId = id; this.save(); }
  isProfileSetupComplete(): boolean { return this.data.isProfileSetupComplete; }
  markProfileComplete(): void { this.data.isProfileSetupComplete = true; this.save(); }

  getFaction(): FactionId | undefined { return this.data.selectedFaction; }
  setSelectedFaction(factionId: FactionId): void { this.setFaction(factionId); }
  hasFaction(): boolean { return !!this.data.selectedFaction; }

  getRookiePath() {
    return this.data.rookiePath;
  }

  hasCompletedInitialFactionChoice(): boolean {
    return this.data.selectedFaction !== undefined;
  }

  setInitialFaction(factionId: FactionId): void {
    if (this.data.selectedFaction !== undefined) {
      console.warn('⚠️ Initial faction already set, use switchFaction instead');
      return;
    }
    
    this.data.selectedFaction = factionId;
    const now = Date.now();

    // Выдаём ВСЕ 4 стартовых юнита фракции
    const starterUnits = STARTER_UNITS_BY_FACTION[factionId];
    const unitIds = [
      starterUnits.balanced,
      starterUnits.tank,
      starterUnits.sniper,
      starterUnits.trickster,
    ];

    unitIds.forEach(unitId => {
      if (!this.data.ownedUnits[factionId].some(u => u.id === unitId)) {
        this.data.ownedUnits[factionId].push({
          id: unitId,
          unlockedAt: now,
          upgrades: { ...DEFAULT_UPGRADES },
        });
      }
    });

    // Команда для туториала: balanced, tank, sniper (3 разных роли)
    this.data.factionTeams[factionId] = [
      starterUnits.balanced,
      starterUnits.tank,
      starterUnits.sniper,
    ];

    console.log(`🛸 Initial Faction ${factionId}: unlocked all 4 starters, team=[balanced, tank, sniper]`);
    this.save();
  }

  setFaction(factionId: FactionId): void {
    this.data.selectedFaction = factionId;
    const now = Date.now();

    // Проверяем есть ли уже юниты этой фракции
    if (this.data.ownedUnits[factionId].length === 0) {
      // Выдаём ВСЕ 4 стартовых юнита фракции
      const starterUnits = STARTER_UNITS_BY_FACTION[factionId];
      const unitIds = [
        starterUnits.balanced,
        starterUnits.tank,
        starterUnits.sniper,
        starterUnits.trickster,
      ];

      unitIds.forEach(unitId => {
        this.data.ownedUnits[factionId].push({
          id: unitId,
          unlockedAt: now,
          upgrades: { ...DEFAULT_UPGRADES },
        });
      });

      // Команда по умолчанию: balanced, tank, sniper
      this.data.factionTeams[factionId] = [
        starterUnits.balanced,
        starterUnits.tank,
        starterUnits.sniper,
      ];

      console.log(`🛸 Faction ${factionId}: unlocked all 4 starters, team=[balanced, tank, sniper]`);
    }

    this.save();
  }

  ownsFaction(factionId: FactionId): boolean {
    return this.data.selectedFaction === factionId || this.data.ownedUnits[factionId].length > 0;
  }

  getOwnedFactions(): FactionId[] {
    return FACTION_IDS.filter(f => this.ownsFaction(f));
  }

  buyFaction(factionId: FactionId): boolean {
    if (this.ownsFaction(factionId)) return false;
    const price = getFactionPrice(factionId);
    if (price.coins && !this.spendCoins(price.coins)) return false;

    const allStarters = getStarterUnits(factionId);
    const now = Date.now();

    const balancedOnly = allStarters.filter(u => u.capClass === 'balanced');
    const starterUnit = balancedOnly[0] || allStarters[0];

    if (starterUnit) {
      this.data.ownedUnits[factionId].push({
        id: starterUnit.id,
        unlockedAt: now,
        upgrades: { ...DEFAULT_UPGRADES },
      });

      this.data.factionTeams[factionId] = [starterUnit.id, starterUnit.id, starterUnit.id];
    }

    this.save();
    console.log(`✅ Bought faction: ${factionId}, starter: ${starterUnit?.id}`);
    return true;
  }

  switchFaction(factionId: FactionId): boolean {
    if (!this.ownsFaction(factionId) || this.data.selectedFaction === factionId) return false;
    this.data.selectedFaction = factionId;
    this.save();
    return true;
  }

  /**
   * Выдаёт фракцию бесплатно (для наград, промо и т.д.)
   * Выдаёт все 4 стартовых юнита
   */
  grantFactionFree(factionId: FactionId): boolean {
    // Проверяем, не владеет ли уже
    if (this.ownsFaction(factionId)) {
      console.log(`[PlayerData] Already owns faction ${factionId}`);
      return false;
    }

    const now = Date.now();
    const starterUnits = STARTER_UNITS_BY_FACTION[factionId];
    
    const unitIds = [
      starterUnits.balanced,
      starterUnits.tank,
      starterUnits.sniper,
      starterUnits.trickster,
    ];

    // Добавляем все 4 юнита
    unitIds.forEach(unitId => {
      if (!this.data.ownedUnits[factionId].some(u => u.id === unitId)) {
        this.data.ownedUnits[factionId].push({
          id: unitId,
          unlockedAt: now,
          upgrades: { ...DEFAULT_UPGRADES },
        });
      }
    });

    // Создаём команду: balanced, tank, sniper
    this.data.factionTeams[factionId] = [
      starterUnits.balanced,
      starterUnits.tank,
      starterUnits.sniper,
    ];

    this.save();
    console.log(`🎁 [PlayerData] Granted faction ${factionId} for FREE with all 4 starters`);
    
    return true;
  }

  getOwnedUnits(factionId?: FactionId): OwnedUnit[] {
    const f = factionId || this.data.selectedFaction;
    return f ? this.data.ownedUnits[f] || [] : [];
  }

  getOwnedUnit(unitId: string): OwnedUnit | undefined {
    const f = this.data.selectedFaction;
    return f ? this.data.ownedUnits[f].find(u => u.id === unitId) : undefined;
  }

  buyUnit(unitId: string, priceOverride?: number): boolean {
    const unit = getUnit(unitId);
    const f = this.data.selectedFaction;
    if (!unit || !f || unit.factionId !== f) return false;
    if (this.data.ownedUnits[f].some(u => u.id === unitId)) return false;
    
    // ✅ НОВОЕ (2026-01-20): Поддержка явной цены для юнитов из репозитория
    const price = priceOverride !== undefined ? priceOverride : (unit.price?.coins || 0);
    if (price > 0 && !this.spendCoins(price)) return false;

    this.data.ownedUnits[f].push({ id: unitId, unlockedAt: Date.now(), upgrades: { ...DEFAULT_UPGRADES } });
    this.save();
    return true;
  }

  // ❌ УДАЛЕНО: Система улучшений фишек полностью убрана
  upgradeUnit(unitId: string, stat: keyof CapUpgrades): boolean {
    console.warn('[PlayerData] upgradeUnit: Upgrade system is disabled');
    return false;
  }

  // ✅ ИЗМЕНЕНО: Возвращает массив переменной длины (3-5)
  getTeamUnits(factionId?: FactionId): string[] {
    const f = factionId || this.data.selectedFaction;
    if (!f) return ['', '', ''];
    
    const ownedUnits = this.data.ownedUnits[f] || [];
    if (ownedUnits.length === 0) return ['', '', ''];
    
    const ownedIds = new Set(ownedUnits.map(u => u.id));
    const team = this.data.factionTeams[f] || ['', '', ''];
    const defaultUnitId = ownedUnits[0].id;
    const allowedSize = this.getAllowedTeamSize(f);
    
    // Гарантируем правильную длину массива
    const validatedTeam: string[] = [];
    for (let i = 0; i < allowedSize; i++) {
      const unitId = team[i];
      validatedTeam.push(ownedIds.has(unitId) && unitId ? unitId : defaultUnitId);
    }
    
    // Обновляем если изменилось
    const needsUpdate = team.length !== validatedTeam.length || 
      validatedTeam.some((id, i) => team[i] !== id);
    
    if (needsUpdate) {
      this.data.factionTeams[f] = validatedTeam;
      this.save();
      console.log(`🔧 Team validated for ${f}:`, validatedTeam);
    }
    
    return validatedTeam;
  }

  // ✅ ИЗМЕНЕНО: Поддержка слотов 0-4
  setTeamUnit(slot: number, unitId: string, factionId?: FactionId): void {
    const f = factionId || this.data.selectedFaction;
    if (!f) return;
    
    const allowedSize = this.getAllowedTeamSize(f);
    if (slot < 0 || slot >= allowedSize) {
      console.warn(`❌ Slot ${slot} is out of range (allowed: 0-${allowedSize - 1})`);
      return;
    }
    
    if (!this.data.ownedUnits[f].some(u => u.id === unitId)) {
      console.warn(`❌ Cannot set unit ${unitId} - not owned in faction ${f}`);
      return;
    }
    
    // Гарантируем что массив достаточной длины
    while (this.data.factionTeams[f].length < allowedSize) {
      const defaultId = this.data.ownedUnits[f][0]?.id || '';
      this.data.factionTeams[f].push(defaultId);
    }
    
    this.data.factionTeams[f][slot] = unitId;
    this.save();
  }

  getUnitStats(unitId: string): CapUpgrades {
    const unit = this.getOwnedUnit(unitId);
    return unit ? { ...unit.upgrades } : { ...DEFAULT_UPGRADES };
  }

  getUnitPower(unitId: string): number {
    const unit = this.getOwnedUnit(unitId);
    return unit ? getCapTotalLevel(unit.upgrades) : 4;
  }

  addCoins(n: number): void { this.data.coins += n; this.save(); }
  spendCoins(n: number): boolean {
    if (this.data.coins < n) return false;
    this.data.coins -= n; this.save(); return true;
  }
  addCrystals(n: number): void { this.data.crystals += n; this.save(); }
  spendCrystals(n: number): boolean {
    if (this.data.crystals < n) return false;
    this.data.crystals -= n; this.save(); return true;
  }

  addXP(amount: number): { leveledUp: boolean; newLevel: number } {
    this.data.xp += amount;
    let leveledUp = false;
    let previousLevel = this.data.level;
    
    while (this.data.xp >= getXPForLevel(this.data.level)) {
      this.data.xp -= getXPForLevel(this.data.level);
      this.data.level++;
      leveledUp = true;
      this.addCoins(this.data.level * 50);
    }
    
    this.save();
    
    // ✅ Если был level up, уведомляем через eventBus
    if (leveledUp) {
      eventBus.emit('player:levelUp', { level: this.data.level, previousLevel });
    }
    
    return { leveledUp, newLevel: this.data.level };
  }

  getOwnedCaps(): OwnedCap[] { return this.data.ownedCaps; }
  ownsCap(id: string): boolean { return this.data.ownedCaps.some(c => c.id === id); }
  getOwnedCap(id: string): OwnedCap | undefined { return this.data.ownedCaps.find(c => c.id === id); }

  buyCap(capId: string): boolean {
    if (this.ownsCap(capId)) return false;
    const skin = getCapSkin(capId);
    if (!skin) return false;
    if (skin.price.coins && !this.spendCoins(skin.price.coins)) return false;
    this.data.ownedCaps.push({ id: capId, unlockedAt: Date.now(), upgrades: { ...DEFAULT_UPGRADES } });
    this.save();
    return true;
  }

  upgradeCap(capId: string, stat: keyof CapUpgrades): boolean {
    const cap = this.getOwnedCap(capId);
    if (!cap || cap.upgrades[stat] >= MAX_UPGRADE_LEVEL) return false;
    const cost = getUpgradeCost(cap.upgrades[stat]);
    if (!this.spendCoins(cost)) return false;
    cap.upgrades[stat]++;
    this.save();
    return true;
  }

  getCapStats(capId: string): CapUpgrades {
    const cap = this.getOwnedCap(capId);
    return cap ? { ...cap.upgrades } : { ...DEFAULT_UPGRADES };
  }

  getCapPower(capId: string): number {
    const cap = this.getOwnedCap(capId);
    return cap ? getCapTotalLevel(cap.upgrades) : 4;
  }

  ownsBallSkin(id: string): boolean { return this.data.ownedBallSkins.some(s => s.id === id); }
  ownsFieldSkin(id: string): boolean { return this.data.ownedFieldSkins.some(s => s.id === id); }

  buyBallSkin(id: string, price: { coins?: number }): boolean {
    if (this.ownsBallSkin(id)) return false;
    if (price.coins && !this.spendCoins(price.coins)) return false;
    this.data.ownedBallSkins.push({ id, unlockedAt: Date.now() });
    this.save();
    return true;
  }

  buyFieldSkin(id: string, price: { coins?: number }): boolean {
    if (this.ownsFieldSkin(id)) return false;
    if (price.coins && !this.spendCoins(price.coins)) return false;
    this.data.ownedFieldSkins.push({ id, unlockedAt: Date.now() });
    this.save();
    return true;
  }

  equipBallSkin(id: string): void {
    if (this.ownsBallSkin(id)) { this.data.equippedBallSkin = id; this.save(); }
  }

  equipFieldSkin(id: string): void {
    if (this.ownsFieldSkin(id)) { this.data.equippedFieldSkin = id; this.save(); }
  }

  // ✅ ИЗМЕНЕНО: Учитывает teamSize при выборе формации
  getSelectedFormation(): Formation {
    const currentSize = this.getAllowedTeamSize();
    
    const preset = DEFAULT_FORMATIONS.find(f => f.id === this.data.selectedFormation);
    if (preset && preset.teamSize === currentSize) {
      const custom = this.data.customFormations.find(f => f.id === preset.id);
      return custom || preset;
    }
    
    const custom = this.data.customFormations.find(f => f.id === this.data.selectedFormation && f.teamSize === currentSize);
    if (custom) return custom;
    
    // Если текущая формация не подходит по размеру - выбираем дефолтную
    const defaultForSize = DEFAULT_FORMATIONS.find(f => f.teamSize === currentSize);
    if (defaultForSize) {
      this.data.selectedFormation = defaultForSize.id;
      this.save();
      return defaultForSize;
    }
    
    return DEFAULT_FORMATIONS[0];
  }

  selectFormation(id: string): void { 
    const formation = DEFAULT_FORMATIONS.find(f => f.id === id) || 
                      this.data.customFormations.find(f => f.id === id);
    
    if (formation) {
      const currentSize = this.getAllowedTeamSize();
      if (formation.teamSize !== currentSize) {
        console.warn(`❌ Cannot select formation ${id} - requires ${formation.teamSize} units, player has ${currentSize}`);
        return;
      }
    }
    
    this.data.selectedFormation = id; 
    this.save(); 
  }

  // ✅ ИЗМЕНЕНО: Фильтрация по teamSize
  getAllFormations(teamSize?: number): Formation[] {
    const size = teamSize ?? this.getAllowedTeamSize();
    const result: Formation[] = [];
    
    DEFAULT_FORMATIONS
      .filter(f => f.teamSize === size)
      .forEach(preset => {
        const custom = this.data.customFormations.find(f => f.id === preset.id);
        result.push(custom || preset);
      });
    
    this.data.customFormations
      .filter(f => f.id.startsWith('custom_') && f.teamSize === size)
      .forEach(f => result.push(f));
    
    return result;
  }

  // ✅ ИЗМЕНЕНО: Требует указать teamSize
  createCustomFormation(name: string, slots: FormationSlot[], teamSize: number): Formation {
    const id = 'custom_' + Date.now();
    const formation: Formation = { id, name, teamSize, slots, isCustom: true };
    this.data.customFormations.push(formation);
    this.save();
    return formation;
  }

  updateCustomFormation(id: string, slots: FormationSlot[]): void {
    const formation = this.data.customFormations.find(f => f.id === id);
    if (formation) { formation.slots = slots; this.save(); }
  }

  deleteCustomFormation(id: string): void {
    const idx = this.data.customFormations.findIndex(f => f.id === id);
    if (idx !== -1) {
      this.data.customFormations.splice(idx, 1);
      if (this.data.selectedFormation === id) this.data.selectedFormation = 'formation_2_1';
      this.save();
    }
  }

  getTeamSetup(): TeamSetup { return { ...this.data.teamSetup }; }
  setCapInSlot(slotId: string, capId: string): void {
    if (this.ownsCap(capId)) { this.data.teamSetup[slotId] = capId; this.save(); }
  }
  getCapInSlot(slotId: string): string | null { return this.data.teamSetup[slotId] || null; }

  getTeamCapIds(): string[] {
    const formation = this.getSelectedFormation();
    return formation.slots.map(s => this.data.teamSetup[s.id] || this.data.ownedCaps[0]?.id || 'meme_doge');
  }

  addPlayTime(seconds: number): void {
    this.data.stats.totalPlayTime += seconds;
    this.save();
  }

  updateStats(result: 'win' | 'loss' | 'draw', goalsScored: number, goalsConceded: number): void {
    this.data.stats.gamesPlayed++;
    this.data.stats.goalsScored += goalsScored;
    this.data.stats.goalsConceded += goalsConceded;

    let xp = 10;
    if (result === 'win') {
      this.data.stats.wins++;
      this.data.stats.currentWinStreak++;
      this.data.stats.longestWinStreak = Math.max(this.data.stats.longestWinStreak, this.data.stats.currentWinStreak);
      this.addCoins(100);
      xp += 50;
      if (goalsConceded === 0) { this.data.stats.perfectGames++; this.addCoins(50); xp += 25; }
    } else if (result === 'loss') {
      this.data.stats.losses++;
      this.data.stats.currentWinStreak = 0;
      this.addCoins(20);
      xp += 15;
    } else {
      this.data.stats.draws++;
      this.addCoins(50);
      xp += 25;
    }

    xp += goalsScored * 10;
    this.addCoins(goalsScored * 10);
    this.addXP(xp);
    this.save();
  }

  /**
   * ✅ ОБНОВЛЕНО: Разблокировать достижение (повторяемые с подсчетом)
   * @returns true если это первое разблокирование, false если повторное
   */
  unlockAchievement(id: string): boolean {
    const existing = this.data.achievements.find(a => a.id === id);
    const now = Date.now();
    
    if (existing) {
      // ✅ Повторное разблокирование - увеличиваем счетчик
      existing.count++;
      existing.lastUnlockedAt = now;
      this.save();
      console.log(`🏆 Достижение повторно: ${id} (x${existing.count})`);
      return false; // Не первое разблокирование
    } else {
      // ✅ Первое разблокирование
      this.data.achievements.push({ 
        id, 
        unlockedAt: now,
        count: 1,
        lastUnlockedAt: now
      });
      this.save();
      console.log(`🏆 Достижение разблокировано: ${id} (x1)`);
      return true; // Первое разблокирование
    }
  }

  /**
   * ✅ НОВОЕ: Получить количество разблокировок достижения
   */
  getAchievementCount(id: string): number {
    const achievement = this.data.achievements.find(a => a.id === id);
    return achievement ? achievement.count : 0;
  }

  /**
   * ✅ НОВОЕ: Проверить разблокировано ли достижение
   */
  hasAchievement(id: string): boolean {
    return this.data.achievements.some(a => a.id === id);
  }

  // ========== AVATAR SYSTEM ==========

  /**
   * Получить текущий ID аватарки
   */
  getAvatarId(): string {
    return this.data.avatarId || 'avatar_recruit';
  }

  /**
   * Установить аватарку (только если она разблокирована)
   */
  setAvatar(avatarId: string): boolean {
    if (!this.ownsAvatar(avatarId)) {
      console.warn(`❌ Cannot set avatar ${avatarId} - not owned`);
      return false;
    }
    this.data.avatarId = avatarId;
    this.save();
    return true;
  }

  /**
   * Проверка: есть ли у игрока эта аватарка?
   */
  ownsAvatar(avatarId: string): boolean {
    if (!this.data.ownedAvatars) {
      this.data.ownedAvatars = ['avatar_recruit', 'avatar_explorer'];
      this.save();
    }
    return this.data.ownedAvatars.includes(avatarId);
  }

  /**
   * Купить аватарку за кристаллы
   */
  purchaseAvatar(avatarId: string, cost: number): boolean {
    if (this.ownsAvatar(avatarId)) {
      console.warn(`❌ Avatar ${avatarId} already owned`);
      return false;
    }
    if (this.data.crystals < cost) {
      console.warn(`❌ Not enough crystals to purchase ${avatarId} (need ${cost}, have ${this.data.crystals})`);
      return false;
    }
    this.data.crystals -= cost;
    if (!this.data.ownedAvatars) {
      this.data.ownedAvatars = [];
    }
    this.data.ownedAvatars.push(avatarId);
    this.save();
    console.log(`✅ Purchased avatar ${avatarId} for ${cost} crystals`);
    return true;
  }

  /**
   * Получить список разблокированных аватарок
   */
  getOwnedAvatars(): string[] {
    if (!this.data.ownedAvatars) {
      this.data.ownedAvatars = ['avatar_recruit', 'avatar_explorer'];
      this.save();
    }
    return [...this.data.ownedAvatars];
  }

  // ========== END AVATAR SYSTEM ==========

  setScreenScale(s: number): void {
    this.data.settings.screenScale = Math.max(0.8, Math.min(1.3, s));
    this.save();
  }

  getScreenScale(): number { return this.data.settings.screenScale; }

  // ========== НОВАЯ КАРТОЧНАЯ СИСТЕМА ==========
  
  getCardCount(cardId: string): number {
    return this.data.inventory.cards[cardId] || 0;
  }

  getCardInventory(): Record<string, number> {
    return { ...this.data.inventory.cards };
  }

  addCards(cardId: string, amount: number = 1): void {
    if (amount <= 0) return;
    this.data.inventory.cards[cardId] = (this.data.inventory.cards[cardId] || 0) + amount;
    this.save();
    console.log(`🃏 Added ${amount}x ${cardId} to inventory (total: ${this.data.inventory.cards[cardId]})`);
  }

  useCard(cardId: string): boolean {
    const count = this.data.inventory.cards[cardId] || 0;
    if (count <= 0) {
      console.warn(`❌ Cannot use card ${cardId} - not in inventory`);
      return false;
    }
    this.data.inventory.cards[cardId]--;
    if (this.data.inventory.cards[cardId] <= 0) {
      delete this.data.inventory.cards[cardId];
    }
    this.save();
    console.log(`🃏 Used card ${cardId} (remaining: ${this.data.inventory.cards[cardId] || 0})`);
    return true;
  }

  hasCard(cardId: string): boolean {
    return (this.data.inventory.cards[cardId] || 0) > 0;
  }

  getTotalCardCount(): number {
    return Object.values(this.data.inventory.cards).reduce((sum, count) => sum + count, 0);
  }

  getLoadout(factionId: FactionId): FactionLoadout {
    return [...this.data.loadouts[factionId]] as FactionLoadout;
  }

  getCurrentLoadout(): FactionLoadout {
    const faction = this.data.selectedFaction;
    if (!faction) return [null, null, null];
    return this.getLoadout(faction);
  }

  setLoadoutSlot(factionId: FactionId, slotIndex: number, cardId: string | null): boolean {
    if (slotIndex < 0 || slotIndex > 2) {
      console.warn(`❌ Invalid loadout slot index: ${slotIndex}`);
      return false;
    }

    if (cardId !== null && !this.hasCard(cardId)) {
      console.warn(`❌ Cannot set card ${cardId} in loadout - not in inventory`);
      return false;
    }

    if (cardId !== null) {
      const card = getCard(cardId);
      if (!card) {
        console.warn(`❌ Card ${cardId} not found in catalog`);
        return false;
      }
      if (card.factionId !== factionId) {
        console.warn(`❌ Card ${cardId} belongs to ${card.factionId}, not ${factionId}`);
        return false;
      }
    }

    this.data.loadouts[factionId][slotIndex] = cardId;
    this.save();
    console.log(`🎴 Set loadout slot ${slotIndex} for ${factionId}: ${cardId}`);
    return true;
  }

  clearLoadoutSlot(factionId: FactionId, slotIndex: number): void {
    this.setLoadoutSlot(factionId, slotIndex, null);
  }

  getLoadoutCardsForMatch(factionId?: FactionId): string[] {
    const f = factionId || this.data.selectedFaction;
    if (!f) return [];
    
    return this.data.loadouts[f].filter((cardId): cardId is string => cardId !== null);
  }

  validateLoadout(factionId: FactionId): { valid: boolean; invalidSlots: number[] } {
    const loadout = this.data.loadouts[factionId];
    const invalidSlots: number[] = [];

    loadout.forEach((cardId, index) => {
      if (cardId !== null && !this.hasCard(cardId)) {
        invalidSlots.push(index);
      }
    });

    return {
      valid: invalidSlots.length === 0,
      invalidSlots,
    };
  }

  cleanupInvalidLoadouts(): void {
    const factions: FactionId[] = ['magma', 'cyborg', 'void', 'insect'];
    
    factions.forEach(factionId => {
      const { invalidSlots } = this.validateLoadout(factionId);
      invalidSlots.forEach(slotIndex => {
        this.clearLoadoutSlot(factionId, slotIndex);
        console.log(`🧹 Cleared invalid card from ${factionId} loadout slot ${slotIndex}`);
      });
    });
  }

  // ========== ✅ НОВОЕ: СИСТЕМА FACTION MASTERY ==========

  /**
   * Получает данные мастерства для фракции
   */
  getFactionMastery(factionId?: FactionId): FactionMasteryData {
    const f = factionId || this.data.selectedFaction;
    if (!f) return { xp: 0, level: 1 };
    return this.data.factionMastery[f] || { xp: 0, level: 1 };
  }

  /**
   * Добавляет XP мастерства для фракции
   * Возвращает результат повышения уровня (если произошло)
   */
  addFactionXP(factionId: FactionId, amount: number): LevelUpResult | null {
    if (amount <= 0) return null;
    
    const mastery = this.data.factionMastery[factionId];
    if (!mastery) {
      this.data.factionMastery[factionId] = { xp: 0, level: 1 };
    }
    
    const oldXP = this.data.factionMastery[factionId].xp;
    const newXP = oldXP + amount;
    this.data.factionMastery[factionId].xp = newXP;
    
    // Проверяем повышение уровня
    const levelUpResult = FactionMasteryManager.checkLevelUp(oldXP, newXP);
    
    if (levelUpResult) {
      this.data.factionMastery[factionId].level = levelUpResult.newLevel;
      
      const levelJump = levelUpResult.newLevel - levelUpResult.oldLevel;
      console.log(
        `🏆 Faction ${factionId} leveled up: ${levelUpResult.oldLevel} → ${levelUpResult.newLevel} ` +
        `(${levelJump} level${levelJump > 1 ? 's' : ''})`
      );
      
      // ✅ Уведомляем через eventBus о level up фракции
      eventBus.emit('faction:levelUp', { 
        factionId, 
        level: levelUpResult.newLevel, 
        previousLevel: levelUpResult.oldLevel 
      });
      
      // Если открылся новый слот - расширяем команду
      if (levelUpResult.newSlotUnlocked && levelUpResult.unlockedSlotIndex !== null) {
        const oldSize = this.data.factionTeams[factionId]?.length || 3;
        const newSize = FactionMasteryManager.getTeamSize(newXP);
        const slotIncrease = newSize - oldSize;
        
        console.log(
          `🔓 Team size increased for ${factionId}: ${oldSize} → ${newSize} ` +
          `(unlocked ${slotIncrease} slot${slotIncrease > 1 ? 's' : ''}, highest slot index: ${levelUpResult.unlockedSlotIndex})`
        );
        
        this.expandTeamToSize(factionId, newSize);
        
        const finalSize = this.data.factionTeams[factionId]?.length || 0;
        console.log(`✅ Team ${factionId} expanded to ${finalSize} units`);
      }
      
      // Начисляем награды за уровень
      levelUpResult.rewards.forEach(reward => {
        if (reward.type === 'coins' && reward.amount) {
          this.addCoins(reward.amount);
          console.log(`💰 Level up reward: +${reward.amount} coins`);
        } else if (reward.type === 'crystals' && reward.amount) {
          this.addCrystals(reward.amount);
          console.log(`💎 Level up reward: +${reward.amount} crystals`);
        }
      });
    }
    
    this.save();
    return levelUpResult;
  }

  /**
   * Получает разрешенный размер команды для фракции (3-5)
   */
  getAllowedTeamSize(factionId?: FactionId): number {
    const f = factionId || this.data.selectedFaction;
    if (!f) return 3;
    
    const mastery = this.data.factionMastery[f];
    if (!mastery) return 3;
    
    return FactionMasteryManager.getTeamSize(mastery.xp);
  }

  /**
   * Расширяет команду до нового размера, добавляя дефолтных юнитов
   */
  expandTeamToSize(factionId: FactionId, newSize: number): void {
    const team = this.data.factionTeams[factionId] || [];
    
    if (team.length >= newSize) return;
    
    // Находим дефолтного юнита для заполнения
    const ownedUnits = this.data.ownedUnits[factionId] || [];
    let defaultUnitId = ownedUnits[0]?.id || '';
    
    // Если нет юнитов - пробуем найти Common юнита фракции
    if (!defaultUnitId) {
      const factionUnits = getUnitsByFaction(factionId);
      const commonUnit = factionUnits.find(u => u.rarity === 'common');
      if (commonUnit) {
        defaultUnitId = commonUnit.id;
        // Добавляем юнита в owned
        this.data.ownedUnits[factionId].push({
          id: commonUnit.id,
          unlockedAt: Date.now(),
          upgrades: { ...DEFAULT_UPGRADES },
        });
      }
    }
    
    // Расширяем команду
    while (team.length < newSize) {
      team.push(defaultUnitId);
    }
    
    this.data.factionTeams[factionId] = team;
    
    // Автоматически переключаем на подходящую формацию
    const currentFormation = this.getSelectedFormation();
    if (currentFormation.teamSize !== newSize) {
      const newFormation = DEFAULT_FORMATIONS.find(f => f.teamSize === newSize);
      if (newFormation) {
        this.data.selectedFormation = newFormation.id;
        console.log(`📐 Auto-switched to formation ${newFormation.name} for ${newSize} units`);
      }
    }
    
    this.save();
    console.log(`📦 Team ${factionId} expanded to ${newSize} units:`, team);
  }

  /**
   * 🔧 DEBUG: Мгновенно разблокирует максимальный размер команды для фракции
   * 
   * Используется для тестирования. Добавляет достаточно XP, чтобы гарантированно
   * разблокировать все слоты команды (до 5 юнитов).
   * 
   * @param factionId - ID фракции
   */
  debugUnlockFullTeam(factionId: FactionId): void {
    const mastery = this.data.factionMastery[factionId] || { xp: 0, level: 1 };
    
    // Максимальный уровень требует 3200 XP (уровень 10, команда из 5 юнитов)
    // Используем значение чуть больше, чтобы гарантировать достижение максимума
    const TARGET_XP_FOR_MAX_TEAM = 3500;
    
    const currentXP = mastery.xp;
    const delta = Math.max(0, TARGET_XP_FOR_MAX_TEAM - currentXP);
    
    if (delta <= 0) {
      const currentSize = FactionMasteryManager.getTeamSize(currentXP);
      console.log(
        `[Debug] Faction ${factionId} already at or above max team XP ` +
        `(current: ${currentXP} XP, team size: ${currentSize})`
      );
      return;
    }
    
    console.log(
      `[Debug] 🔧 Unlocking full team for ${factionId}: ` +
      `adding ${delta} XP (current: ${currentXP}, target: ${TARGET_XP_FOR_MAX_TEAM})`
    );
    
    const result = this.addFactionXP(factionId, delta);
    
    const finalXP = this.data.factionMastery[factionId]?.xp || 0;
    const finalSize = FactionMasteryManager.getTeamSize(finalXP);
    const actualTeamSize = this.data.factionTeams[factionId]?.length || 0;
    
    console.log(
      `[Debug] ✅ ${factionId} boosted: ` +
      `XP ${currentXP} → ${finalXP}, ` +
      `team size ${actualTeamSize} units, ` +
      `level ${result?.newLevel || mastery.level}`
    );
  }

  /**
   * Получает информацию о ранге мастерства фракции
   */
  getFactionRankInfo(factionId?: FactionId): { name: string; icon: string; level: number } {
    const f = factionId || this.data.selectedFaction;
    if (!f) return { name: 'Novice', icon: '🥉', level: 1 };
    
    const mastery = this.data.factionMastery[f];
    if (!mastery) return { name: 'Novice', icon: '🥉', level: 1 };
    
    return FactionMasteryManager.getRankInfo(mastery.xp);
  }

  /**
   * Получает прогресс до следующего уровня (0-1)
   */
  getFactionMasteryProgress(factionId?: FactionId): number {
    const f = factionId || this.data.selectedFaction;
    if (!f) return 0;
    
    const mastery = this.data.factionMastery[f];
    if (!mastery) return 0;
    
    return FactionMasteryManager.getLevelProgress(mastery.xp);
  }

  /**
   * Получает XP необходимый для следующего уровня
   */
  getFactionNextLevelXP(factionId?: FactionId): number | null {
    const f = factionId || this.data.selectedFaction;
    if (!f) return null;
    
    const mastery = this.data.factionMastery[f];
    if (!mastery) return 100;
    
    return FactionMasteryManager.getNextLevelXP(mastery.xp);
  }

  // ========== СИСТЕМА КАМПАНИИ ==========

  getCampaignProgress(): CampaignProgress {
    return this.data.campaignProgress;
  }

  isTutorialCompleted(): boolean {
    return this.data.isTutorialCompleted;
  }

  completeTutorial(): void {
    this.data.isTutorialCompleted = true;
    if (this.data.campaignProgress.chapters['chapter_1']) {
      this.data.campaignProgress.chapters['chapter_1'].unlocked = true;
    }
    this.data.campaignProgress.tutorialCompleted = true;
    this.save();
    console.log('🎓 Tutorial completed, Chapter 1 unlocked');
  }

  isChapterUnlocked(chapterId: string): boolean {
    const chapter = this.data.campaignProgress.chapters[chapterId];
    if (!chapter) return false;
    
    if (chapterId === 'chapter_1') {
      return this.data.isTutorialCompleted || chapter.unlocked;
    }
    
    return chapter.unlocked;
  }

  isLevelUnlocked(levelId: string): boolean {
    const levelConfig = CAMPAIGN_LEVELS[levelId];
    if (!levelConfig) {
      console.warn(`[Campaign] Level config not found: ${levelId}`);
      return false;
    }
    
    const chapterProgress = this.data.campaignProgress.chapters[levelConfig.chapterId];
    if (!chapterProgress) {
      console.warn(`[Campaign] Chapter progress not found: ${levelConfig.chapterId}`);
      return false;
    }
    
    if (!chapterProgress.unlocked) {
      console.log(`[Campaign] Chapter ${levelConfig.chapterId} is locked`);
      return false;
    }
    
    // Первый уровень в главе всегда разблокирован
    if (levelConfig.orderInChapter === 1) {
      console.log(`[Campaign] Level ${levelId} unlocked (first in chapter)`);
      return true;
    }
    
    const chapter = CAMPAIGN_CHAPTERS[levelConfig.chapterId];
    if (!chapter) {
      console.warn(`[Campaign] Chapter config not found: ${levelConfig.chapterId}`);
      return false;
    }
    
    const prevLevelIndex = levelConfig.orderInChapter - 2;
    if (prevLevelIndex < 0) {
      console.log(`[Campaign] Level ${levelId} unlocked (invalid prev index)`);
      return true;
    }
    
    const prevLevelId = chapter.levelIds[prevLevelIndex];
    const prevLevelProgress = chapterProgress.levels[prevLevelId];
    
    const isUnlocked = prevLevelProgress?.completed === true;
    
    console.log(`[Campaign] Level ${levelId} unlock check:`, {
      prevLevel: prevLevelId,
      prevCompleted: prevLevelProgress?.completed,
      isUnlocked,
    });
    
    return isUnlocked;
  }

  getLevelProgress(levelId: string): LevelProgress | undefined {
    const levelConfig = CAMPAIGN_LEVELS[levelId];
    if (!levelConfig) return undefined;
    
    return this.data.campaignProgress.chapters[levelConfig.chapterId]?.levels[levelId];
  }

  getLevelStars(levelId: string): number {
    const progress = this.getLevelProgress(levelId);
    return progress?.stars ?? 0;
  }

  isLevelCompleted(levelId: string): boolean {
    const progress = this.getLevelProgress(levelId);
    return progress?.completed === true;
  }

  getChapterStars(chapterId: string): number {
    const chapterProgress = this.data.campaignProgress.chapters[chapterId];
    return chapterProgress?.totalStars ?? 0;
  }

  getTotalCampaignStars(): number {
    return this.data.campaignProgress.totalStars;
  }

  isChapterBossDefeated(chapterId: string): boolean {
    const chapterProgress = this.data.campaignProgress.chapters[chapterId];
    return chapterProgress?.bossDefeated === true;
  }

  completeCampaignLevel(
    levelId: string,
    playerScore: number,
    enemyScore: number,
    won: boolean
  ): CampaignLevelResult {
    console.log(`🎯 [Campaign] completeCampaignLevel called:`, {
      levelId, playerScore, enemyScore, won
    });
    
    const levelConfig = CAMPAIGN_LEVELS[levelId];
    if (!levelConfig) {
      console.error(`[Campaign] Level ${levelId} not found in CAMPAIGN_LEVELS`);
      throw new Error(`Level ${levelId} not found`);
    }

    const chapterId = levelConfig.chapterId;
    
    // ✅ Убедиться что глава существует в прогрессе
    if (!this.data.campaignProgress.chapters[chapterId]) {
      console.warn(`[Campaign] Creating chapter progress for ${chapterId}`);
      this.data.campaignProgress.chapters[chapterId] = {
        chapterId,
        unlocked: chapterId === 'chapter_1',
        totalStars: 0,
        bossDefeated: false,
        levels: {},
      };
    }
    
    const chapterProgress = this.data.campaignProgress.chapters[chapterId];

    let levelProgress = chapterProgress.levels[levelId];
    if (!levelProgress) {
      levelProgress = {
        levelId,
        completed: false,
        stars: 0,
        bestPlayerScore: 0,
        bestEnemyScore: 999,
        attempts: 0,
      };
      chapterProgress.levels[levelId] = levelProgress;
    }

    levelProgress.attempts++;

    const isFirstClear = !levelProgress.completed && won;
    let starsEarned = 0;
    let unlockedNextLevel = false;
    let unlockedNextChapter = false;

    if (won) {
      starsEarned = this.calculateStars(levelConfig, playerScore, enemyScore);
      
      if (playerScore > levelProgress.bestPlayerScore) {
        levelProgress.bestPlayerScore = playerScore;
      }
      if (enemyScore < levelProgress.bestEnemyScore) {
        levelProgress.bestEnemyScore = enemyScore;
      }
      
      const previousStars = levelProgress.stars;
      if (starsEarned > previousStars) {
        levelProgress.stars = starsEarned;
        chapterProgress.totalStars += (starsEarned - previousStars);
        this.data.campaignProgress.totalStars += (starsEarned - previousStars);
      }
      
      if (!levelProgress.completed) {
        levelProgress.completed = true;
        levelProgress.firstCompletedAt = Date.now();
      }

      if (levelConfig.isBoss) {
        chapterProgress.bossDefeated = true;
        
        const allChapters = getAllChaptersOrdered();
        const currentChapterIndex = allChapters.findIndex(c => c.id === chapterId);
        
        if (currentChapterIndex < allChapters.length - 1) {
          const nextChapter = allChapters[currentChapterIndex + 1];
          const nextChapterProgress = this.data.campaignProgress.chapters[nextChapter.id];
          
          if (nextChapterProgress && !nextChapterProgress.unlocked) {
            nextChapterProgress.unlocked = true;
            unlockedNextChapter = true;
            console.log(`🔓 Chapter ${nextChapter.id} unlocked!`);
          }
        }
      }

      const nextLevel = getNextLevel(levelId);
      if (nextLevel && !this.isLevelCompleted(nextLevel.id)) {
        unlockedNextLevel = true;
      }
    }

    const rewards = this.calculateLevelRewards(levelConfig, isFirstClear, starsEarned);

    if (rewards.coins > 0) {
      this.addCoins(rewards.coins);
    }
    if (rewards.xp > 0) {
      this.addXP(rewards.xp);
    }

    if (isFirstClear) {
      if (rewards.unlockedUnitId) {
        this.unlockUnitById(rewards.unlockedUnitId);
      }
      if (rewards.unlockedSkinId) {
        this.unlockSkin(rewards.unlockedSkinId);
      }
    }

    this.data.campaignProgress.lastPlayedAt = Date.now();

    this.save();

    console.log(`🎯 [Campaign] Level ${levelId} completed:`, {
      won,
      starsEarned,
      isFirstClear,
      rewards,
      unlockedNextLevel,
      unlockedNextChapter,
      levelProgress: chapterProgress.levels[levelId],
    });

    return {
      levelId,
      won,
      playerScore,
      enemyScore,
      starsEarned,
      isFirstClear,
      rewards,
      unlockedNextLevel,
      unlockedNextChapter,
    };
  }

  private calculateStars(
    levelConfig: LevelConfig,
    playerScore: number,
    enemyScore: number
  ): number {
    const criteria = levelConfig.starCriteria;
    
    let stars = 1;

    if (criteria.twoStarsValue !== undefined) {
      if (levelConfig.winCondition.type === 'time_survival') {
        if (playerScore >= criteria.twoStarsValue) stars = 2;
      } else if (levelConfig.winCondition.type === 'sudden_death') {
        if (enemyScore === 0) stars = 2;
      } else {
        if (enemyScore <= criteria.twoStarsValue) stars = 2;
      }
    }

    if (criteria.threeStarsValue !== undefined && stars >= 2) {
      if (levelConfig.winCondition.type === 'time_survival') {
        if (enemyScore <= criteria.threeStarsValue) stars = 3;
      } else if (levelConfig.winCondition.type === 'score_difference') {
        if ((playerScore - enemyScore) >= criteria.threeStarsValue) stars = 3;
      } else {
        if (enemyScore <= criteria.threeStarsValue) stars = 3;
      }
    }

    return stars;
  }

  private calculateLevelRewards(
    levelConfig: LevelConfig,
    isFirstClear: boolean,
    stars: number
  ): CampaignLevelResult['rewards'] {
    const reward = levelConfig.reward;
    
    let coins = isFirstClear ? reward.firstClearCoins : reward.replayCoins;
    let xp = isFirstClear ? reward.firstClearXP : reward.replayXP;
    
    if (stars === 3 && reward.perfectBonus) {
      coins += reward.perfectBonus;
    }

    return {
      coins,
      xp,
      unlockedUnitId: isFirstClear ? reward.unlockUnitId : undefined,
      unlockedSkinId: isFirstClear ? reward.unlockSkinId : undefined,
    };
  }

  // ✅ ИСПРАВЛЕНО: Изменено с private на public для использования в RewardCalculator
  public unlockUnitById(unitId: string): boolean {
    const unit = getUnit(unitId);
    if (!unit) return false;

    const factionId = unit.factionId;
    if (this.data.ownedUnits[factionId].some(u => u.id === unitId)) {
      return false;
    }

    this.data.ownedUnits[factionId].push({
      id: unitId,
      unlockedAt: Date.now(),
      upgrades: { power: 1, mass: 1, aim: 1, technique: 1 },
    });

    console.log(`🎁 Unit ${unitId} unlocked as campaign reward!`);
    this.save();
    return true;
  }

  // ✅ НОВОЕ: Метод для разблокировки скинов (используется в RewardCalculator)
  public unlockSkin(skinId: string): boolean {
    // Проверяем, это скин мяча или поля
    if (skinId.startsWith('ball_')) {
      if (this.ownsBallSkin(skinId)) return false;
      this.data.ownedBallSkins.push({ id: skinId, unlockedAt: Date.now() });
      this.save();
      console.log(`🎁 Ball skin ${skinId} unlocked!`);
      return true;
    } 
    else if (skinId.startsWith('field_')) {
      if (this.ownsFieldSkin(skinId)) return false;
      this.data.ownedFieldSkins.push({ id: skinId, unlockedAt: Date.now() });
      this.save();
      console.log(`🎁 Field skin ${skinId} unlocked!`);
      return true;
    }
    console.warn(`❌ Unknown skin format: ${skinId}`);
    return false;
  }

  getAvailableLevels(): LevelConfig[] {
    const available: LevelConfig[] = [];
    
    Object.values(CAMPAIGN_LEVELS).forEach(level => {
      if (this.isLevelUnlocked(level.id) && !this.isLevelCompleted(level.id)) {
        available.push(level);
      }
    });
    
    return available;
  }

  getCurrentCampaignLevel(): LevelConfig | undefined {
    const available = this.getAvailableLevels();
    return available[0];
  }

  resetCampaignProgress(): void {
    this.data.campaignProgress = createDefaultCampaignProgress();
    this.data.isTutorialCompleted = false;
    this.save();
    console.log('🔄 Campaign progress reset');
  }

  hasCompletedFirstMatchTutorial(): boolean {
    return this.data.campaignProgress.tutorialCompleted === true;
  }

  completeFirstMatchTutorial(): void {
    if (this.data.campaignProgress.tutorialCompleted) {
      console.log('[PlayerData] Tutorial already completed, skipping');
      return;
    }

    this.data.campaignProgress.tutorialCompleted = true;
    this.data.isTutorialCompleted = true;

    if (this.data.campaignProgress.chapters['chapter_1']) {
      this.data.campaignProgress.chapters['chapter_1'].unlocked = true;
    }
    
    this.save();
  }

  // ========== ТУТОРИАЛЬНЫЕ ФЛАГИ ==========

  hasAbilitiesHintShown(): boolean {
    return this.data.tutorialFlags?.abilitiesHintShown === true;
  }

  markAbilitiesHintShown(): void {
    if (!this.data.tutorialFlags) {
      this.data.tutorialFlags = {
        abilitiesHintShown: false,
        pendingPostWinMenuTour: false,
        postWinMenuTourShown: false,
        postWinMenuTourStep: null,
      };
    }
    this.data.tutorialFlags.abilitiesHintShown = true;
    this.save();
  }

  shouldRunPostWinMenuTour(): boolean {
    return this.data.tutorialFlags?.pendingPostWinMenuTour === true &&
           this.data.tutorialFlags?.postWinMenuTourShown !== true;
  }

  setPendingPostWinMenuTour(value: boolean): void {
    if (!this.data.tutorialFlags) {
      this.data.tutorialFlags = {
        abilitiesHintShown: false,
        pendingPostWinMenuTour: false,
        postWinMenuTourShown: false,
        postWinMenuTourStep: null,
      };
    }
    this.data.tutorialFlags.pendingPostWinMenuTour = value;
    this.save();
  }

  setPostWinMenuTourStep(step: 'menu' | 'shop' | 'team' | null): void {
    if (!this.data.tutorialFlags) {
      this.data.tutorialFlags = {
        abilitiesHintShown: false,
        pendingPostWinMenuTour: false,
        postWinMenuTourShown: false,
        postWinMenuTourStep: null,
      };
    }
    this.data.tutorialFlags.postWinMenuTourStep = step;
    this.save();
  }

  markPostWinMenuTourShown(): void {
    if (!this.data.tutorialFlags) {
      this.data.tutorialFlags = {
        abilitiesHintShown: false,
        pendingPostWinMenuTour: false,
        postWinMenuTourShown: false,
        postWinMenuTourStep: null,
      };
    }
    this.data.tutorialFlags.postWinMenuTourShown = true;
    this.data.tutorialFlags.pendingPostWinMenuTour = false;
    this.data.tutorialFlags.postWinMenuTourStep = null;
    this.save();
  }

  getPostWinMenuTourStep(): 'menu' | 'shop' | 'team' | null {
    return this.data.tutorialFlags?.postWinMenuTourStep ?? null;
  }

  // ========== КОЛЛЕКЦИОННЫЕ ФИШКИ (MYSTIC CAPS) ==========

  /**
   * Добавить фрагменты фишки
   */
  // ⚠️ REMOVED: addCapFragments - используйте addUnitFragments
  // Старая система мистических фишек удалена

  /**
   * Получить количество фрагментов фишки
   */
  // ⚠️ REMOVED: getCapFragments - используйте getUnitFragments

  /**
   * Проверить, можно ли собрать фишку (>= 8 фрагментов)
   */
  canCraftCap(capId: string): boolean {
    const cap = getMysticCapById(capId);
    if (!cap) return false;
    return this.getUnitFragments(capId) >= cap.requiredFragments;
  }

  /**
   * Собрать фишку (потратить 8 фрагментов и разблокировать)
   */
  craftCap(capId: string): boolean {
    // 1. Check ownership  
    if (this.ownsUnit(capId)) {
      console.warn(`[PlayerData] Cap already owned: ${capId}`);
      return false;
    }
    
    // 2. Validate against Catalog
    const cap = getMysticCapById(capId);
    if (!cap) {
      console.warn(`[PlayerData] Mystic cap ${capId} not found in catalog!`);
      return false;
    }

    // 3. Check resources
    const currentFragments = this.getUnitFragments(capId);
    if (currentFragments < cap.requiredFragments) {
      console.warn(`[PlayerData] Not enough fragments: ${currentFragments}/${cap.requiredFragments}`);
      return false;
    }

    // ⚠️ REMOVED: Старая система мистических фишек
    // Теперь используется unitFragments и ownedUnits для 80 уникальных юнитов
    // Этот метод больше не должен вызываться

    // ✅ NEW: Unlock the corresponding playable Unit in ownedUnits[faction]
    // This makes it appear in TeamScene -> RESERVES and be equippable into the squad.
    if (cap.unitId) {
      const unlocked = this.unlockUnitById(cap.unitId);
      if (unlocked) {
        console.log(`🛸 Mystic unit unlocked: ${cap.unitId} (${cap.factionId})`);
      } else {
        console.log(`ℹ️ Mystic unit already owned or could not unlock: ${cap.unitId}`);
      }
    } else {
      console.warn(`[PlayerData] Mystic cap ${capId} has no unitId mapping`);
    }

    this.save();
    console.log(`✨ Successfully crafted Mystic Cap: ${capId}`);
    return true;
  }

  /**
   * Проверить, разблокирована ли фишка
   */
  // ⚠️ REMOVED: ownsCapSkin - используйте ownsUnit для новых юнитов

  /**
   * Разблокировать скин фишки
   */
  // ⚠️ REMOVED: unlockCapSkin - используйте unlockUnit для новых юнитов

  /**
   * Экипировать скин фишки для фракции
   */
  equipCapSkinForFaction(factionId: FactionId, capId: string): boolean {
    if (!this.ownsUnit(capId)) {
      console.warn(`[PlayerData] Cannot equip unowned cap skin: ${capId}`);
      return false;
    }

    const cap = getMysticCapById(capId);
    if (!cap || cap.factionId !== factionId) {
      console.warn(`[PlayerData] Cap ${capId} does not belong to faction ${factionId}`);
      return false;
    }

    if (!this.data.equippedCapSkinByFaction) {
      this.data.equippedCapSkinByFaction = {};
    }
    this.data.equippedCapSkinByFaction[factionId] = capId;
    this.save();
    console.log(`🎨 Equipped cap skin ${capId} for faction ${factionId}`);
    return true;
  }

  /**
   * Получить экипированный скин фишки для фракции
   */
  getEquippedCapSkinForFaction(factionId: FactionId): string | null {
    return this.data.equippedCapSkinByFaction?.[factionId] || null;
  }

  // ========== НОВЫЕ 80 ЮНИТОВ: ФРАГМЕНТЫ И ВЛАДЕНИЕ ==========
  
  /**
   * Добавить фрагменты юнита
   */
  addUnitFragments(unitId: string, amount: number): void {
    if (amount <= 0) return;
    if (!this.data.unitFragments) {
      this.data.unitFragments = {};
    }
    this.data.unitFragments[unitId] = (this.data.unitFragments[unitId] || 0) + amount;
    this.save();
    console.log(`🧩 Added ${amount} fragments for ${unitId} (total: ${this.data.unitFragments[unitId]})`);
  }

  /**
   * Получить количество фрагментов юнита
   */
  getUnitFragments(unitId: string): number {
    return this.data.unitFragments?.[unitId] || 0;
  }

  /**
   * Проверить можно ли скрафтить юнит
   */
  canCraftUnit(unitId: string, requiredFragments: number = 30): boolean {
    return this.getUnitFragments(unitId) >= requiredFragments;
  }

  /**
   * Скрафтить юнит из фрагментов
   */
  craftUnit(unitId: string, requiredFragments: number = 30): boolean {
    if (!this.canCraftUnit(unitId, requiredFragments)) {
      console.warn(`[PlayerData] Not enough fragments to craft unit: ${unitId}`);
      return false;
    }

    // Deduct fragments
    if (!this.data.unitFragments) {
      this.data.unitFragments = {};
    }
    this.data.unitFragments[unitId] -= requiredFragments;

    // Unlock unit
    this.unlockUnit(unitId);

    // Добавляем в список ownedUnits фракции (чтобы появился в резерве)
    const unit = getUnit(unitId);
    if (unit) {
      const f = unit.factionId;
      if (!this.data.ownedUnits[f]) {
        this.data.ownedUnits[f] = [];
      }
      const alreadyOwned = this.data.ownedUnits[f].some(u => u.id === unitId);
      if (!alreadyOwned) {
        this.data.ownedUnits[f].push({ id: unitId, unlockedAt: Date.now(), upgrades: { ...DEFAULT_UPGRADES } });
        // Автодобавление в команду, если есть пустой слот
        const team = this.data.factionTeams[f] || [];
        const allowedSize = this.getAllowedTeamSize(f);
        for (let i = 0; i < allowedSize; i++) {
          if (!team[i]) {
            team[i] = unitId;
            break;
          }
        }
        this.data.factionTeams[f] = team.slice(0, allowedSize);
      }
    }

    this.save();
    console.log(`✨ Crafted and unlocked unit: ${unitId}`);
    return true;
  }

  /**
   * Выдать юнит как награду (уровень/сундук) с автодобавлением в резерв
   */
  grantUnitReward(unitId: string): void {
    const unit = getUnit(unitId);
    if (!unit) {
      console.warn(`[PlayerData] grantUnitReward: unit not found ${unitId}`);
      return;
    }

    // Добавляем в список уникальных (чтобы считался владением)
    this.unlockUnit(unitId);

    const f = unit.factionId;
    if (!this.data.ownedUnits[f]) {
      this.data.ownedUnits[f] = [];
    }

    const alreadyOwned = this.data.ownedUnits[f].some(u => u.id === unitId);
    if (!alreadyOwned) {
      this.data.ownedUnits[f].push({ id: unitId, unlockedAt: Date.now(), upgrades: { ...DEFAULT_UPGRADES } });
      // Автодобавление в команду, если есть пустой слот
      const team = this.data.factionTeams[f] || [];
      const allowedSize = this.getAllowedTeamSize(f);
      for (let i = 0; i < allowedSize; i++) {
        if (!team[i]) {
          team[i] = unitId;
          break;
        }
      }
      this.data.factionTeams[f] = team.slice(0, allowedSize);
    }

    this.save();
    console.log(`🎁 Granted unit reward: ${unitId} for faction ${f}`);
  }

  /**
   * Проверить владеет ли игрок юнитом
   */
  ownsUnit(unitId: string): boolean {
    if (!this.data.ownedUniqueUnits) {
      this.data.ownedUniqueUnits = [];
    }
    return this.data.ownedUniqueUnits.includes(unitId);
  }

  /**
   * Разблокировать юнит (full drop из сундука)
   */
  unlockUnit(unitId: string): void {
    if (!this.data.ownedUniqueUnits) {
      this.data.ownedUniqueUnits = [];
    }
    if (!this.ownsUnit(unitId)) {
      this.data.ownedUniqueUnits.push(unitId);
      this.save();
      console.log(`✨ Unlocked unit: ${unitId}`);
      eventBus.emit('player:unitGranted', { unitId });
    }
  }

  // ========== СИСТЕМА ОТСЛЕЖИВАНИЯ ЗАБРАННЫХ НАГРАД ==========
  
  /**
   * Проверить, забрана ли награда за уровень игрока
   */
  isPlayerLevelRewardClaimed(level: number): boolean {
    if (!this.data.claimedPlayerLevelRewards) {
      this.data.claimedPlayerLevelRewards = [];
    }
    return this.data.claimedPlayerLevelRewards.includes(level);
  }

  /**
   * Пометить награду за уровень игрока как забранную
   */
  claimPlayerLevelReward(level: number): void {
    if (!this.data.claimedPlayerLevelRewards) {
      this.data.claimedPlayerLevelRewards = [];
    }
    if (!this.isPlayerLevelRewardClaimed(level)) {
      this.data.claimedPlayerLevelRewards.push(level);
      this.save();
      console.log(`✅ Claimed player level reward: ${level}`);
    }
  }

  /**
   * Проверить, забрана ли награда за уровень мастерства фракции
   */
  isFactionLevelRewardClaimed(factionId: FactionId, level: number): boolean {
    if (!this.data.claimedFactionLevelRewards) {
      this.data.claimedFactionLevelRewards = { magma: [], cyborg: [], void: [], insect: [] };
    }
    if (!this.data.claimedFactionLevelRewards[factionId]) {
      this.data.claimedFactionLevelRewards[factionId] = [];
    }
    return this.data.claimedFactionLevelRewards[factionId].includes(level);
  }

  /**
   * Пометить награду за уровень мастерства фракции как забранную
   */
  claimFactionLevelReward(factionId: FactionId, level: number): void {
    if (!this.data.claimedFactionLevelRewards) {
      this.data.claimedFactionLevelRewards = { magma: [], cyborg: [], void: [], insect: [] };
    }
    if (!this.data.claimedFactionLevelRewards[factionId]) {
      this.data.claimedFactionLevelRewards[factionId] = [];
    }
    if (!this.isFactionLevelRewardClaimed(factionId, level)) {
      this.data.claimedFactionLevelRewards[factionId].push(level);
      this.save();
      console.log(`✅ Claimed faction level reward: ${factionId} level ${level}`);
    }
  }

  // ============================================================
  // ТУРНИРНЫЕ БИЛЕТЫ И КЛЮЧИ
  // ============================================================

  /**
   * Добавить фрагменты ключа турнира
   */
  addTournamentKeyFragments(amount: number): void {
    if (amount <= 0) return;
    
    this.ensureTournamentState();
    const currentFragments = this.data.tournamentState!.keyFragments || 0;
    
    // Максимум 3 фрагмента = 1 полный ключ
    // Если больше 3, конвертируем в полные ключи
    const newTotal = currentFragments + amount;
    this.data.tournamentState!.keyFragments = newTotal % 3;
    
    // Если накопилось на полный ключ (3 фрагмента), автоматически собираем
    const fullKeys = Math.floor(newTotal / 3);
    if (fullKeys > 0) {
      console.log(`🔑 Assembled ${fullKeys} full tournament key(s)!`);
      // Ключи уже "собраны" - они просто дают право на вход
    }
    
    this.save();
    console.log(`🔑 Added ${amount} key fragments (total: ${this.data.tournamentState!.keyFragments}/3)`);
  }

  /**
   * Получить количество фрагментов ключа
   */
  getTournamentKeyFragments(): number {
    return this.data.tournamentState?.keyFragments || 0;
  }

  /**
   * Проверить есть ли полный ключ (3 фрагмента)
   */
  hasTournamentKey(): boolean {
    return this.getTournamentKeyFragments() >= 3;
  }

  /**
   * Использовать ключ для входа на турнир
   */
  useTournamentKey(): boolean {
    if (!this.hasTournamentKey()) {
      console.warn('[PlayerData] Not enough key fragments!');
      return false;
    }
    
    this.data.tournamentState!.keyFragments -= 3;
    this.save();
    console.log('🔑 Used tournament key (3 fragments)');
    return true;
  }

  /**
   * Добавить билеты на турнир
   */
  addTournamentTickets(amount: number): void {
    if (amount <= 0) return;
    
    this.ensureTournamentState();
    
    // Билеты накапливаются
    if (!this.data.tournamentState!.ticketCount) {
      this.data.tournamentState!.ticketCount = 0;
    }
    this.data.tournamentState!.ticketCount += amount;
    
    this.save();
    console.log(`🎫 Added ${amount} tournament ticket(s) (total: ${this.data.tournamentState!.ticketCount})`);
  }

  /**
   * Получить количество билетов
   */
  getTournamentTickets(): number {
    return this.data.tournamentState?.ticketCount || 0;
  }

  /**
   * Проверить есть ли билет
   */
  hasTournamentTicket(): boolean {
    return this.getTournamentTickets() > 0;
  }

  /**
   * Использовать билет для входа на турнир
   */
  useTournamentTicket(): boolean {
    if (!this.hasTournamentTicket()) {
      console.warn('[PlayerData] No tournament tickets!');
      return false;
    }
    
    this.data.tournamentState!.ticketCount! -= 1;
    this.save();
    console.log('🎫 Used tournament ticket');
    return true;
  }

  /**
   * Проверить можно ли войти на турнир (есть ключ ИЛИ билет)
   */
  canEnterTournament(): boolean {
    return this.hasTournamentKey() || this.hasTournamentTicket();
  }

  /**
   * Использовать вход на турнир (приоритет: ключ, затем билет)
   */
  useTournamentEntry(): boolean {
    if (this.hasTournamentKey()) {
      return this.useTournamentKey();
    }
    if (this.hasTournamentTicket()) {
      return this.useTournamentTicket();
    }
    return false;
  }

  /**
   * Убедиться что TournamentState инициализирован
   */
  private ensureTournamentState(): void {
    if (!this.data.tournamentState) {
      this.data.tournamentState = {
        keyFragments: 0,
        ticketCount: 0,
        hasTicket: false, // deprecated, используем ticketCount
        history: [],
      };
    }
    // Миграция со старого формата
    if (this.data.tournamentState.hasTicket && !this.data.tournamentState.ticketCount) {
      this.data.tournamentState.ticketCount = 1;
      this.data.tournamentState.hasTicket = false;
    }
  }
}

export const playerData = new PlayerDataManager();