// src/assets/AssetPackManager.ts
// Professional staged asset loading with timeout, retry, and fallback

import Phaser from 'phaser';
import { CARDS_CATALOG, getAllCardIds } from '../data/CardsCatalog';
import { UNITS_CATALOG } from '../data/UnitsCatalog';
import { FACTION_ARENAS, FACTION_IDS, FACTIONS } from '../constants/gameConstants';
import { LoadingOverlay } from '../ui/LoadingOverlay';
import { UI_ICONS } from '../ui/Icons';
import { ensureSafeImageLoading, isRealImageLoaded } from './loading/ImageLoader';

type PackName = 'core' | 'shop' | 'match' | 'campaign' | 'initialLoad' | 'rareContent';

/** Редкости юнитов, безопасные для предзагрузки */
const PRELOAD_UNIT_RARITIES = ['common', 'rare'] as const;

/** Получить список assetKey юнитов для предзагрузки */
const getPreloadUnitKeys = (): string[] =>
  UNITS_CATALOG
    .filter(
      u =>
        PRELOAD_UNIT_RARITIES.includes(u.rarity as (typeof PRELOAD_UNIT_RARITIES)[number]) ||
        u.factionId === 'magma' // стартовая фракция - грузим всю
    )
    .map(u => u.assetKey);

/** Исправление пути для Vite (убираем начальный слеш если есть) */
const normalizePath = (path: string): string => 
  path.startsWith('/') ? path.slice(1) : path;

/** Строит пакет initialLoad для предзагрузки при старте */
const buildInitialLoadPack = (): PackDefinition => {
  // Все 12 карт способностей
  const cardImages = getAllCardIds().map(id => ({
    key: `card_${id}`,
    url: normalizePath(`assets/cards/icons/${id}.png`),
  }));

  // Юниты common/rare + вся Magma
  const preloadKeys = getPreloadUnitKeys();
  const unitImages = UNITS_CATALOG
    .filter(u => preloadKeys.includes(u.assetKey))
    .map(u => ({
      key: u.assetKey,
      url: normalizePath(u.assetPath),
    }));

  // 4 арены фракций
  const arenaImages = FACTION_IDS.map(id => ({
    key: `field_${id}`,
    url: normalizePath(`assets/backgrounds/field_${id}.png`),
  }));

  // 3 варианта мячей
  const ballImages = ['plasma', 'core', 'quantum'].map(name => ({
    key: `ball_${name}`,
    url: normalizePath(`assets/sprites/balls/${name}.png`),
  }));

  // Рамки карт
  const frameImages = ['frame_common', 'frame_rare', 'frame_epic', 'card_back'].map(f => ({
    key: f,
    url: normalizePath(`assets/cards/frames/${f}.png`),
  }));

  const images = [
    ...cardImages,
    ...unitImages,
    ...arenaImages,
    ...ballImages,
    ...frameImages,
  ];

  // Основные звуки матча (имена файлов без префикса sfx_)
  const audio = [
    { key: 'sfx_kick', url: normalizePath('assets/audio/sfx/kick.mp3') },
    { key: 'sfx_goal', url: normalizePath('assets/audio/sfx/goal.mp3') },
    { key: 'sfx_whistle', url: normalizePath('assets/audio/sfx/whistle.mp3') },
    { key: 'sfx_win', url: normalizePath('assets/audio/sfx/win.mp3') },
    { key: 'sfx_lose', url: normalizePath('assets/audio/sfx/lose.mp3') },
  ];

  return { images, audio };
};

/** Строит пакет rareContent для редких юнитов (загружается по требованию) */
const buildRareContentPack = (): PackDefinition => {
  const preloadKeys = getPreloadUnitKeys();
  
  // Все юниты, которые НЕ вошли в предзагрузку
  const rareUnitImages = UNITS_CATALOG
    .filter(u => !preloadKeys.includes(u.assetKey))
    .map(u => ({
      key: u.assetKey,
      url: normalizePath(u.assetPath),
    }));

  return { images: rareUnitImages, audio: [] };
};

interface FailedFile {
  key: string;
  url: string;
  type: string;
  retries: number;
}

interface PackDefinition {
  images: Array<{ key: string; url: string }>;
  audio: Array<{ key: string; url: string }>;
}

export class AssetPackManager {
  private static loadedPacks = new Set<PackName>();
  private static packDefinitions: Record<PackName, PackDefinition> = {
    core: {
      images: [
        { key: 'ui_home_bg', url: 'assets/ui/backgrounds/home_bg.webp' },
        { key: 'logo', url: 'assets/images/logo.webp' },
        { key: 'ui_commander_nova', url: 'assets/ui/commander_nova.png' },
        // Nova portraits for tutorial dialogues (Option 1: add to core)
        // ✅ FIX: Use relative paths for public/ assets (Vite requirement with base: './')
        { key: 'portrait_nova_neutral', url: 'assets/ui/portraits/nova_happy.png' },
        { key: 'portrait_nova_happy', url: 'assets/ui/portraits/nova_happy.png' },
        { key: 'portrait_nova', url: 'assets/ui/portraits/nova_happy.png' },
        // UI Icons (PNG icons from public/assets/ui/icons/)
        { key: 'ui_nav_home', url: UI_ICONS.nav.home },
        { key: 'ui_nav_team', url: UI_ICONS.nav.team },
        { key: 'ui_nav_shop', url: UI_ICONS.nav.shop },
        { key: 'ui_nav_profile', url: UI_ICONS.nav.profile },
        { key: 'ui_match_primary', url: UI_ICONS.match.primary },
        { key: 'ui_mode_pvp', url: UI_ICONS.match.pvp },
        { key: 'ui_mode_ai', url: UI_ICONS.match.ai },
        { key: 'ui_mode_campaign', url: UI_ICONS.match.campaign },
        { key: 'ui_rewards_coins', url: UI_ICONS.rewards.coins },
        { key: 'ui_rewards_crystals', url: UI_ICONS.rewards.crystals },
        { key: 'ui_rewards_daily', url: UI_ICONS.rewards.daily },
        { key: 'ui_player_level', url: UI_ICONS.player.level },
        { key: 'ui_faction_magma', url: UI_ICONS.player.faction.magma },
        { key: 'ui_faction_cyborg', url: UI_ICONS.player.faction.cyborg },
        { key: 'ui_faction_insect', url: UI_ICONS.player.faction.insect },
        { key: 'ui_faction_void', url: UI_ICONS.player.faction.void },
        { key: 'ui_settings_gear', url: UI_ICONS.system.settings },
      ],
      audio: [
        { key: 'sfx_click', url: 'assets/audio/sfx/ui_click.mp3' },
        { key: 'ui_click', url: 'assets/audio/ui_click.mp3' },
        // Faction selection sounds
        { key: 'fx_magma_select', url: 'assets/audio/sfx/ui_click.mp3' },
        { key: 'fx_cyborg_select', url: 'assets/audio/sfx/ui_click.mp3' },
        { key: 'fx_void_select', url: 'assets/audio/sfx/ui_click.mp3' },
        { key: 'fx_terran_select', url: 'assets/audio/sfx/ui_click.mp3' },
      ],
    },
    shop: {
      images: [
        // Card frames
        { key: 'frame_common', url: 'assets/cards/frames/frame_common.png' },
        { key: 'frame_rare', url: 'assets/cards/frames/frame_rare.png' },
        { key: 'frame_epic', url: 'assets/cards/frames/frame_epic.png' },
        { key: 'card_back', url: 'assets/cards/frames/card_back.png' },
        // Карты загружаются динамически по страницам
        // ✅ FIX: Card backgrounds (fallback to frames since bg files are missing)
        // Используем абсолютные пути для файлов из public/ (Vite requirement)
        { key: 'card_bg_common', url: 'assets/cards/frames/frame_common.png' },
        { key: 'card_bg_rare', url: 'assets/cards/frames/frame_rare.png' },
        { key: 'card_bg_epic', url: 'assets/cards/frames/frame_epic.png' },
        // Boosters
        { key: 'booster_tactical', url: 'assets/ui/boosters/booster_tactical.png' },
        { key: 'booster_magma', url: 'assets/ui/boosters/booster_magma.png' },
        { key: 'booster_cyborg', url: 'assets/ui/boosters/booster_cyborg.png' },
        { key: 'booster_void', url: 'assets/ui/boosters/booster_void.png' },
        { key: 'booster_insect', url: 'assets/ui/boosters/booster_insect.png' },
        { key: 'booster_faction', url: 'assets/ui/boosters/booster_tactical.png' },
        // Chests (map _256 keys to _512.png versions since _256.png files don't exist)
        { key: 'chest_small_256', url: 'assets/chests/chest_small_512.png' },
        { key: 'chest_small_512', url: 'assets/chests/chest_small_512.png' },
        { key: 'chest_medium_256', url: 'assets/chests/chest_medium_512.png' },
        { key: 'chest_medium_512', url: 'assets/chests/chest_medium_512.png' },
        { key: 'chest_large_256', url: 'assets/chests/chest_large_512.png' },
        { key: 'chest_large_512', url: 'assets/chests/chest_large_512.png' },
        { key: 'chest_mystic_256', url: 'assets/chests/chest_mystic_512.png' },
        { key: 'chest_mystic_512', url: 'assets/chests/chest_mystic_512.png' },
        // Reward icons
        { key: 'reward_coins_256', url: 'assets/ui/rewards/reward_coins_256.png' },
        { key: 'reward_crystals_256', url: 'assets/ui/rewards/reward_crystals_256.png' },
        { key: 'reward_cards_256', url: 'assets/ui/rewards/reward_cards_256.png' },
        { key: 'reward_fragments_256', url: 'assets/ui/rewards/reward_fragments_256.png' },
        // ⚠️ REMOVED: Mystic caps - textures not loading properly
        // Cap collections and fragments removed
      ],
      audio: [
        { key: 'sfx_pack_open', url: 'assets/audio/ui/sfx_pack_open.mp3' },
        { key: 'sfx_pack_reveal', url: 'assets/audio/ui/sfx_pack_reveal.mp3' },
        { key: 'sfx_card_pop', url: 'assets/audio/ui/sfx_card_pop.mp3' },
        { key: 'sfx_cash', url: 'assets/audio/sfx/cash.mp3' },
      ],
    },
    match: {
      images: [
        // ✅ NEW: Result screen backgrounds (victory, defeat, draw)
        { key: 'result_victory_bg', url: 'assets/ui/match/result_victory_bg_1080x1920.png' },
        { key: 'result_defeat_bg', url: 'assets/ui/match/result_defeat_bg_1080x1920.png' },
        { key: 'result_draw_bg', url: 'assets/ui/match/result_draw_bg_1080x1920.png' },
        // Юниты загружаются динамически через loadUnitAssets
        // Faction tokens
        ...FACTION_IDS.map(factionId => {
          const faction = FACTIONS[factionId];
          return { key: faction.assetKey, url: faction.assetPath };
        }),
        // Arenas from FACTION_ARENAS
        ...FACTION_IDS.map(factionId => {
          const arena = FACTION_ARENAS[factionId];
          return { key: arena.assetKey, url: arena.assetPath };
        }),
        // Arena tiles (only Cyborg has specific textures, others fallback to Cyborg)
        { key: 'cyborg_floor', url: 'assets/factions/cyborg/cyborg_floor.png' },
        { key: 'cyborg_wall_straight', url: 'assets/factions/cyborg/cyborg_wall_straight.png' },
        { key: 'cyborg_wall_corner', url: 'assets/factions/cyborg/cyborg_wall_corner.png' },
        // Magma faction assets fallback to Cyborg (files don't exist)
        { key: 'magma_floor', url: 'assets/factions/cyborg/cyborg_floor.png' },
        { key: 'magma_wall_straight', url: 'assets/factions/cyborg/cyborg_wall_straight.png' },
        { key: 'magma_wall_corner', url: 'assets/factions/cyborg/cyborg_wall_corner.png' },
        // Void faction assets fallback to Cyborg (files don't exist)
        { key: 'void_floor', url: 'assets/factions/cyborg/cyborg_floor.png' },
        { key: 'void_wall_straight', url: 'assets/factions/cyborg/cyborg_wall_straight.png' },
        { key: 'void_wall_corner', url: 'assets/factions/cyborg/cyborg_wall_corner.png' },
        // Insect faction assets fallback to Cyborg (files don't exist)
        { key: 'insect_floor', url: 'assets/factions/cyborg/cyborg_floor.png' },
        { key: 'insect_wall_straight', url: 'assets/factions/cyborg/cyborg_wall_straight.png' },
        { key: 'insect_wall_corner', url: 'assets/factions/cyborg/cyborg_wall_corner.png' },
        // Ball skins
        { key: 'ball_plasma', url: 'assets/sprites/balls/plasma.png' },
        { key: 'ball_core', url: 'assets/sprites/balls/core.png' },
        { key: 'ball_quantum', url: 'assets/sprites/balls/quantum.png' },
        // Common assets
        { key: 'metal_ring', url: 'assets/sprites/common/metal_ring.png' },
        { key: 'ui_scoreboard', url: 'assets/ui/scoreboard.png' },
        // Faction art
        { key: 'art_magma', url: 'assets/images/factions/art_magma.png' },
        { key: 'art_cyborg', url: 'assets/images/factions/art_cyborg.png' },
        { key: 'art_void', url: 'assets/images/factions/art_void.png' },
        { key: 'art_insect', url: 'assets/images/factions/art_insect.png' },
        // Memes (if used in match)
        { key: 'meme_doge', url: 'assets/skins/memes/doge.png' },
        { key: 'meme_gigachad', url: 'assets/skins/memes/gigachad.png' },
        { key: 'meme_cat', url: 'assets/skins/memes/cat.png' },
        { key: 'meme_trollface', url: 'assets/skins/memes/trollface.png' },
        { key: 'meme_hamster', url: 'assets/skins/memes/hamster.png' },
      ],
      audio: [
        { key: 'bgm_match', url: 'assets/audio/bgm/stadium_ambience.mp3' },
        { key: 'sfx_kick', url: 'assets/audio/sfx/kick.mp3' },
        { key: 'sfx_clack', url: 'assets/audio/sfx/collision.mp3' },
        { key: 'sfx_bounce', url: 'assets/audio/sfx/wall_hit.mp3' },
        { key: 'sfx_post', url: 'assets/audio/sfx/post.mp3' },
        { key: 'sfx_net', url: 'assets/audio/sfx/net.mp3' },
        { key: 'sfx_goal', url: 'assets/audio/sfx/goal.mp3' },
        { key: 'sfx_whistle', url: 'assets/audio/sfx/whistle.mp3' },
        { key: 'sfx_win', url: 'assets/audio/sfx/win.mp3' },
        { key: 'sfx_lose', url: 'assets/audio/sfx/lose.mp3' },
        { key: 'sfx_whoosh', url: 'assets/audio/sfx/whoosh.mp3' },
        { key: 'sfx_impact_heavy', url: 'assets/audio/sfx/impact_heavy.mp3' },
        // Voices
        { key: 'voice_welcome', url: 'assets/audio/voice/voice_welcome.mp3' },
        { key: 'voice_vs', url: 'assets/audio/voice/voice_vs.mp3' },
        { key: 'voice_fight', url: 'assets/audio/voice/voice_fight.mp3' },
        { key: 'voice_goal', url: 'assets/audio/voice/voice_goal.mp3' },
        { key: 'voice_scream', url: 'assets/audio/voice/voice_scream.mp3' },
        { key: 'voice_dominating', url: 'assets/audio/voice/voice_dominating.mp3' },
        { key: 'voice_victory', url: 'assets/audio/voice/voice_win.mp3' },
        { key: 'voice_defeat', url: 'assets/audio/voice/voice_lose.mp3' },
        { key: 'voice_magma', url: 'assets/audio/voice/voice_magma.mp3' },
        { key: 'voice_cyborg', url: 'assets/audio/voice/voice_cyborg.mp3' },
        { key: 'voice_void', url: 'assets/audio/voice/voice_void.mp3' },
        { key: 'voice_insect', url: 'assets/audio/voice/voice_insect.mp3' },
      ],
    },
    campaign: {
      images: [
        // Campaign map assets
        { key: 'node_locked', url: 'assets/ui/campaign/node_locked.png' },
        { key: 'node_active', url: 'assets/ui/campaign/node_active.png' },
        { key: 'node_completed_1star', url: 'assets/ui/campaign/node_completed_1star.png' },
        { key: 'node_completed_2stars', url: 'assets/ui/campaign/node_completed_2stars.png' },
        { key: 'node_completed_3stars', url: 'assets/ui/campaign/node_completed_3stars.png' },
        { key: 'node_boss', url: 'assets/ui/campaign/node_boss.png' },
        { key: 'path_dotted', url: 'assets/ui/campaign/path_dotted.png' },
        // Chapter backgrounds
        { key: 'bg_chapter_magma', url: 'assets/ui/backgrounds/campaign/bg_chapter_magma.png' },
        { key: 'bg_chapter_cyborg', url: 'assets/ui/backgrounds/campaign/bg_chapter_cyborg.png' },
        { key: 'bg_chapter_void', url: 'assets/ui/backgrounds/campaign/bg_chapter_void.png' },
        { key: 'bg_chapter_insect', url: 'assets/ui/backgrounds/campaign/bg_chapter_insect.png' },
        // Boss sprites
        { key: 'boss_krag', url: 'assets/sprites/units/bosses/boss_krag.png' },
        { key: 'boss_unit734', url: 'assets/sprites/units/bosses/boss_unit734.png' },
        { key: 'boss_zra', url: 'assets/sprites/units/bosses/boss_zra.png' },
        { key: 'boss_oracle', url: 'assets/sprites/units/bosses/boss_oracle.png' },
        // Portraits
        // ✅ FIX: Use absolute paths for public/ assets (Vite requirement)
        { key: 'portrait_nova', url: 'assets/ui/portraits/nova_happy.png' },
        { key: 'portrait_nova_happy', url: 'assets/ui/portraits/nova_happy.png' },
        { key: 'portrait_nova_neutral', url: 'assets/ui/portraits/nova_happy.png' },
        { key: 'portrait_nova_determined', url: 'assets/ui/portraits/nova_happy.png' },
        { key: 'portrait_krag', url: 'assets/ui/portraits/krag_angry.png' },
        { key: 'portrait_krag_angry', url: 'assets/ui/portraits/krag_angry.png' },
        { key: 'portrait_krag_neutral', url: 'assets/ui/portraits/krag_angry.png' },
        { key: 'portrait_krag_surprised', url: 'assets/ui/portraits/krag_angry.png' },
        { key: 'portrait_unit_734', url: 'assets/ui/portraits/unit734_neutral.png' },
        { key: 'portrait_unit_734_neutral', url: 'assets/ui/portraits/unit734_neutral.png' },
        { key: 'portrait_unit734', url: 'assets/ui/portraits/unit734_neutral.png' },
        { key: 'portrait_unit734_neutral', url: 'assets/ui/portraits/unit734_neutral.png' },
        { key: 'portrait_zra', url: 'assets/ui/portraits/zra_mysterious.png' },
        { key: 'portrait_zra_neutral', url: 'assets/ui/portraits/zra_mysterious.png' },
        { key: 'portrait_zra_mysterious', url: 'assets/ui/portraits/zra_mysterious.png' },
        { key: 'portrait_oracle', url: 'assets/ui/portraits/oracle_neutral.png' },
        { key: 'portrait_oracle_neutral', url: 'assets/ui/portraits/oracle_neutral.png' },
        { key: 'portrait_oracle_menacing', url: 'assets/ui/portraits/oracle_neutral.png' },
        // Portrait announcer fallback to nova_happy (file doesn't exist)
        { key: 'portrait_announcer', url: 'assets/ui/portraits/nova_happy.png' },
        { key: 'portrait_announcer_neutral', url: 'assets/ui/portraits/nova_happy.png' },
        { key: 'portrait_announcer_happy', url: 'assets/ui/portraits/nova_happy.png' },
        // ✅ REMOVED: commander_nova key collision - use ui_commander_nova in core pack for UI overlay
        // Campaign preview images
        { key: 'campaign_ch1_l1_preview', url: 'assets/ui/campaign/ch1/ch1_l1_preview.png' },
        { key: 'campaign_ch1_l2_preview', url: 'assets/ui/campaign/ch1/ch1_l2_preview.png' },
        { key: 'campaign_ch1_l3_preview', url: 'assets/ui/campaign/ch1/ch1_l3_preview.png' },
        { key: 'campaign_ch1_l4_preview', url: 'assets/ui/campaign/ch1/ch1_l4_preview.png' },
        { key: 'campaign_ch2_l1_preview', url: 'assets/ui/campaign/ch2/ch2_l1_preview.png' },
        { key: 'campaign_ch2_l2_preview', url: 'assets/ui/campaign/ch2/ch2_l2_preview.png' },
        { key: 'campaign_ch2_l3_preview', url: 'assets/ui/campaign/ch2/ch2_l3_preview.png' },
        { key: 'campaign_ch2_l4_preview', url: 'assets/ui/campaign/ch2/ch2_l4_preview.png' },
        { key: 'campaign_ch3_l1_preview', url: 'assets/ui/campaign/ch3/ch3_l1_preview.png' },
        { key: 'campaign_ch3_l2_preview', url: 'assets/ui/campaign/ch3/ch3_l2_preview.png' },
        { key: 'campaign_ch3_l3_preview', url: 'assets/ui/campaign/ch3/ch3_l3_preview.png' },
        { key: 'campaign_ch3_l4_preview', url: 'assets/ui/campaign/ch3/ch3_l4_preview.png' },
        { key: 'campaign_ch4_l1_preview', url: 'assets/ui/campaign/ch4/ch4_l1_preview.png' },
        { key: 'campaign_ch4_l2_preview', url: 'assets/ui/campaign/ch4/ch4_l2_preview.png' },
        { key: 'campaign_ch4_l3_preview', url: 'assets/ui/campaign/ch4/ch4_l3_preview.png' },
        { key: 'campaign_ch4_l4_preview', url: 'assets/ui/campaign/ch4/ch4_l4_preview.png' },
      ],
      audio: [],
    },
    // Новые пакеты:
    initialLoad: buildInitialLoadPack(),
    rareContent: buildRareContentPack(),
  };

  static isLoaded(packName: PackName): boolean {
    return this.loadedPacks.has(packName);
  }

  static async ensure(
    scene: Phaser.Scene,
    packName: PackName,
    overlay?: LoadingOverlay
  ): Promise<void> {
    // ✅ Guard: if loader is already running, wait for it to finish to avoid progress reset / double load
    if (scene.load.isLoading()) {
      if (import.meta.env.DEV) {
        console.warn(`[AssetPackManager] Loader already running; waiting before ensuring pack "${packName}"...`);
      }
      await new Promise<void>((resolve) => {
        scene.load.once('complete', () => resolve());
      });
    }

    ensureSafeImageLoading(scene);

    // If already loaded, resolve immediately
    if (this.isLoaded(packName)) {
      if (overlay) {
        overlay.setProgress(1);
      }
      return Promise.resolve();
    }

    const pack = this.packDefinitions[packName];
    if (!pack) {
      if (import.meta.env.DEV) {
        console.error(`[AssetPackManager] Unknown pack: ${packName}`);
      }
      return Promise.resolve();
    }

    // Set max parallel downloads for Telegram
    scene.load.maxParallelDownloads = 4;

    // Build queue lists only for assets not yet loaded
    const imagesToLoad = pack.images.filter(({ key }) => !scene.textures.exists(key) || !isRealImageLoaded(key));
    const audioToLoad = pack.audio.filter(({ key }) => !(scene.cache as any).audio?.exists?.(key) && !scene.cache.audio.has(key));

    // If nothing to load, mark loaded and exit early (prevents unnecessary loader start)
    if (imagesToLoad.length === 0 && audioToLoad.length === 0) {
      if (import.meta.env.DEV) {
        console.log(`[AssetPackManager] Pack "${packName}" already loaded (no missing assets)`);
      }
      this.loadedPacks.add(packName);
      if (overlay) overlay.setProgress(1);
      return Promise.resolve();
    }

    const failedFiles: FailedFile[] = [];
    let lastProgressTime = Date.now();
    let lastProgressValue = 0;
    const STALL_TIMEOUT_MS = 10000; // 10 seconds
    const MAX_RETRIES = 2;

    return new Promise<void>((resolve) => {
      // Track progress
      const updateProgress = () => {
        const progress = scene.load.progress;
        if (overlay) {
          overlay.setProgress(progress);
        }
        
        if (progress > lastProgressValue) {
          lastProgressTime = Date.now();
          lastProgressValue = progress;
        }
      };

      // Watchdog timer
      const watchdog = scene.time.addEvent({
        delay: 1000,
        callback: () => {
          const now = Date.now();
          const stalled = now - lastProgressTime > STALL_TIMEOUT_MS;
          const isLoading = scene.load.isLoading();

          if (stalled && isLoading) {
            if (import.meta.env.DEV) {
              console.warn(`[AssetPackManager] Pack ${packName} stalled, forcing completion`);
            }
            // Force completion - fallbacks will cover missing textures
            this.loadedPacks.add(packName);
            if (overlay) {
              overlay.setProgress(1);
            }
            // Clean our listeners
            scene.load.off('fileprogress', onFileProgress);
            scene.load.off('loaderror', onLoadError);
            scene.load.off('progress', updateProgress);
            resolve();
          }
        },
        loop: true,
      });

      // File progress
      const onFileProgress = (file: Phaser.Loader.File) => {
        updateProgress();
        if (overlay && file.type === 'image') {
          overlay.setSubtext(file.key);
        }
      };
      scene.load.on('fileprogress', onFileProgress);

      // Load error
      const onLoadError = (file: Phaser.Loader.File) => {
        // Convert url to string (it can be string | string[] | object)
        const urlString = typeof file.url === 'string' 
          ? file.url 
          : Array.isArray(file.url) 
            ? file.url[0] || String(file.url)
            : String(file.url);
        
        failedFiles.push({
          key: file.key,
          url: urlString,
          type: file.type,
          retries: 0,
        });
        if (import.meta.env.DEV) {
          console.warn(`[AssetPackManager] Failed to load: ${file.key} from ${urlString}`);
        }
      };
      scene.load.on('loaderror', onLoadError);

      // Complete handler
      const onComplete = () => {
        watchdog.destroy();
        // Unsubscribe only our handlers (don't nuke other loader listeners in the app)
        scene.load.off('fileprogress', onFileProgress);
        scene.load.off('loaderror', onLoadError);
        scene.load.off('progress', updateProgress);

        // Retry failed files (up to MAX_RETRIES)
        if (failedFiles.length > 0) {
          const toRetry = failedFiles.filter(f => f.retries < MAX_RETRIES);
          if (toRetry.length > 0 && import.meta.env.DEV) {
            console.log(`[AssetPackManager] Retrying ${toRetry.length} failed files...`);
          }

          toRetry.forEach(file => {
            file.retries++;
            if (file.type === 'image') {
              scene.load.image(file.key, file.url);
            } else if (file.type === 'audio') {
              scene.load.audio(file.key, file.url);
            }
          });

          if (toRetry.length > 0) {
            scene.load.once('complete', () => {
              this.loadedPacks.add(packName);
              if (overlay) {
                overlay.setProgress(1);
              }
              if (import.meta.env.DEV && failedFiles.length > 0) {
                console.warn(`[AssetPackManager] Pack ${packName} loaded with ${failedFiles.length} failed files (fallbacks will be used)`);
              }
              resolve();
            });
            if (!scene.load.isLoading()) {
              scene.load.start();
            }
            return;
          }
        }

        // Mark as loaded
        this.loadedPacks.add(packName);
        if (overlay) {
          overlay.setProgress(1);
        }
        
        if (import.meta.env.DEV && failedFiles.length > 0) {
          console.warn(`[AssetPackManager] Pack ${packName} loaded with ${failedFiles.length} failed files (fallbacks will be used)`);
        }
        
        resolve();
      };

      scene.load.once('complete', onComplete);
      scene.load.on('progress', updateProgress);

      // Load all assets
      imagesToLoad.forEach(({ key, url }) => {
        // ✅ FIX: Для Vite с base: './' нужны относительные пути (без начального слеша)
        const finalUrl = url.startsWith('/') ? url.substring(1) : url;
        scene.load.image(key, finalUrl);
      });

      audioToLoad.forEach(({ key, url }) => {
        scene.load.audio(key, url);
      });

      // Start loading
      if (scene.load.list.size > 0 && !scene.load.isLoading()) {
        scene.load.start();
      } else {
        // No files to load, resolve immediately
        onComplete();
      }
    });
  }

  /**
   * Динамическая загрузка ассетов конкретных юнитов.
   * Вызывать перед матчем или при просмотре деталей юнита.
   */
  static async loadUnitAssets(scene: Phaser.Scene, unitKeysOrIds: string[]): Promise<void> {
    ensureSafeImageLoading(scene);
    const assetsToLoad: Array<{ key: string; url: string }> = [];
    
    // Фильтруем уникальные ключи
    const uniqueKeys = [...new Set(unitKeysOrIds)];
    
    uniqueKeys.forEach(idOrKey => {
      // Пытаемся найти по assetKey или id
      const unit = UNITS_CATALOG.find(u => u.assetKey === idOrKey || u.id === idOrKey);
      if (!unit) return;

      const key = unit.assetKey;
      
      // Проверяем, загружена ли уже текстура
      if (!scene.textures.exists(key) || !isRealImageLoaded(key)) {
        // Vite fix: убираем начальный слэш
        const url = unit.assetPath.startsWith('/') ? unit.assetPath.substring(1) : unit.assetPath;
        assetsToLoad.push({ key, url });
      }
      
      // Также можно добавить загрузку HD версии (_512), если нужно
      // const hdKey = `${key}_512`;
      // if (!scene.textures.exists(hdKey)) { ... }
    });

    if (assetsToLoad.length === 0) {
      return Promise.resolve();
    }

    console.log(`[AssetPackManager] 📦 Dynamically loading ${assetsToLoad.length} units...`);

    return new Promise((resolve) => {
      let loadedCount = 0;
      const total = assetsToLoad.length;

      // Обработчик одного файла
      const checkComplete = () => {
        loadedCount++;
        if (loadedCount >= total) {
          resolve();
        }
      };

      assetsToLoad.forEach(asset => {
        scene.load.image(asset.key, asset.url);
        // Используем once для каждого файла, так надежнее чем общий complete при параллельных загрузках
        scene.load.once(`filecomplete-image-${asset.key}`, checkComplete);
        
        // Обработка ошибок для конкретного файла
        scene.load.once(`loaderror`, (file: Phaser.Loader.File) => {
          if (file.key === asset.key) {
            console.warn(`[AssetPackManager] Failed to load unit: ${asset.key}`);
            checkComplete(); // Считаем как выполненное, чтобы не зависнуть
          }
        });
      });

      scene.load.start();
    });
  }

  /**
   * Проверяет, загружены ли юниты, и догружает недостающие.
   * Используется перед стартом матча для гарантии наличия всех текстур.
   */
  static async ensureUnitsLoaded(
    scene: Phaser.Scene,
    unitKeys: string[],
    overlay?: LoadingOverlay
  ): Promise<void> {
    const missing = unitKeys.filter(key => !scene.textures.exists(key) || !isRealImageLoaded(key));
    
    if (missing.length === 0) {
      console.log('[AssetPackManager] All units already loaded');
      return;
    }
    
    console.log(`[AssetPackManager] Loading ${missing.length} missing units:`, missing);
    
    if (overlay) {
      overlay.setText('Загрузка юнитов…');
      overlay.setProgress(0);
    }

    await this.loadUnitAssets(scene, missing);

    if (overlay) {
      overlay.setProgress(1);
    }
  }
}

