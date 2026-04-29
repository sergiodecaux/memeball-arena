// ✅ OPTIMIZED: Split into boot/minimal vs lazy per-scene loading

import Phaser from 'phaser';
import { FACTIONS, FACTION_IDS, FACTION_ARENAS } from '../../constants/gameConstants';
import { UNITS_CATALOG } from '../../data/UnitsCatalog';
// ⚠️ REMOVED: MYSTIC_CAPS - старая система коллекций убрана
import { UNITS_REPOSITORY } from '../../data/UnitsRepository';
import {
  LEAGUE_BADGE_KEYS,
  LEAGUE_DIVISION_KEYS,
  LEAGUE_STAR_KEYS,
  LEAGUE_ORBIT_KEYS,
  TOURNAMENT_HUB_BG,
  LEAGUE_HUB_BG,
  TOURNAMENT_BACKGROUND_KEYS,
  TOURNAMENT_CUP_KEYS,
  TOURNAMENT_KEY_KEYS,
  TOURNAMENT_BRACKET_KEYS,
  AIM_ASSIST_OFF_ICON,
} from '../../config/assetKeys';

const IMAGE_LOADER_PATCH_FLAG = '__image_loader_patch_installed__';
const IMAGE_FALLBACK_WIDTH = 8;
const IMAGE_FALLBACK_HEIGHT = 8;
const realImageKeys = new Set<string>();
const fallbackImageKeys = new Set<string>();

function getBaseUrlPrefix(): string {
  const baseUrl = import.meta.env.BASE_URL || '/';
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function normalizeAssetPath(path: string): string {
  const trimmed = path.trim();

  if (!trimmed) {
    return trimmed;
  }

  // Remote/data/blob URLs should remain untouched.
  if (/^(https?:\/\/|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('/assets/')) {
    return trimmed.substring(1);
  }

  return trimmed;
}

function toResolvedUrl(path: string): string {
  if (/^(https?:\/\/|data:|blob:)/i.test(path)) {
    return path;
  }

  return new URL(path, window.location.origin + getBaseUrlPrefix()).toString();
}

function ensureFallbackTexture(scene: Phaser.Scene, key: string): void {
  if (!key || scene.textures.exists(key)) {
    return;
  }

  try {
    const fallbackCanvas = scene.textures.createCanvas(key, IMAGE_FALLBACK_WIDTH, IMAGE_FALLBACK_HEIGHT);
    const ctx = fallbackCanvas.getContext();

    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(0, 0, IMAGE_FALLBACK_WIDTH, IMAGE_FALLBACK_HEIGHT);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, IMAGE_FALLBACK_WIDTH / 2, IMAGE_FALLBACK_HEIGHT / 2);
    ctx.fillRect(IMAGE_FALLBACK_WIDTH / 2, IMAGE_FALLBACK_HEIGHT / 2, IMAGE_FALLBACK_WIDTH / 2, IMAGE_FALLBACK_HEIGHT / 2);
    fallbackCanvas.refresh();
    fallbackImageKeys.add(key);

    console.warn(`[ImageLoader] Fallback texture generated for "${key}"`);
  } catch (error) {
    console.error(`[ImageLoader] Failed to generate fallback texture for "${key}"`, error);
  }
}

function prepareImageKeyForRealAsset(scene: Phaser.Scene, key: string): boolean {
  if (!key || !scene.textures.exists(key)) {
    return true;
  }

  if (realImageKeys.has(key)) {
    return false;
  }

  try {
    scene.textures.remove(key);
    fallbackImageKeys.delete(key);
    return true;
  } catch (error) {
    console.warn(`[ImageLoader] Could not replace fallback texture "${key}"`, error);
    return false;
  }
}

export function isRealImageLoaded(key: string): boolean {
  return realImageKeys.has(key);
}

export function ensureSafeImageLoading(scene: Phaser.Scene): void {
  const loader = scene.load as Phaser.Loader.LoaderPlugin & {
    [IMAGE_LOADER_PATCH_FLAG]?: boolean;
    __originalImageLoader__?: Phaser.Loader.LoaderPlugin['image'];
  };

  if (loader[IMAGE_LOADER_PATCH_FLAG]) {
    return;
  }

  const originalImage = loader.image.bind(loader);
  loader.__originalImageLoader__ = originalImage;

  loader.on('filecomplete', (key: string, type: string) => {
    if (type === 'image') {
      realImageKeys.add(key);
      fallbackImageKeys.delete(key);
    }
  });

  loader.image = ((key: string | Phaser.Types.Loader.FileTypes.ImageFileConfig | Phaser.Types.Loader.FileTypes.ImageFileConfig[], url?: string, xhrSettings?: Phaser.Types.Loader.XHRSettingsObject) => {
    try {
      if (Array.isArray(key)) {
        const normalizedBatch = key
          .map((item) => ({
            ...item,
            url: typeof item.url === 'string' ? normalizeAssetPath(item.url) : item.url,
          }))
          .filter((item) => prepareImageKeyForRealAsset(scene, item.key));
        if (normalizedBatch.length === 0) {
          return loader;
        }
        return originalImage(normalizedBatch, url, xhrSettings);
      }

      if (typeof key === 'object' && key !== null) {
        if (!prepareImageKeyForRealAsset(scene, key.key)) {
          return loader;
        }
        const normalizedConfig = {
          ...key,
          url: typeof key.url === 'string' ? normalizeAssetPath(key.url) : key.url,
        };
        if (typeof normalizedConfig.url === 'string') {
          console.log(`[ImageLoader] Queue image: key="${normalizedConfig.key}", url="${toResolvedUrl(normalizedConfig.url)}"`);
        }
        return originalImage(normalizedConfig, url, xhrSettings);
      }

      const normalizedUrl = typeof url === 'string' ? normalizeAssetPath(url) : url;
      const imageKey = key as string;
      if (!prepareImageKeyForRealAsset(scene, imageKey)) {
        return loader;
      }
      if (typeof normalizedUrl === 'string') {
        console.log(`[ImageLoader] Queue image: key="${imageKey}", url="${toResolvedUrl(normalizedUrl)}"`);
      }
      return originalImage(imageKey, normalizedUrl, xhrSettings);
    } catch (error) {
      const keyName = typeof key === 'string' ? key : (Array.isArray(key) ? 'batch' : key.key);
      console.error(`[ImageLoader] Failed to queue image "${keyName}"`, error);
      if (typeof key === 'string') {
        ensureFallbackTexture(scene, key);
      } else if (key && !Array.isArray(key)) {
        ensureFallbackTexture(scene, key.key);
      }
      return loader;
    }
  }) as Phaser.Loader.LoaderPlugin['image'];

  loader.on('loaderror', (file: Phaser.Loader.File) => {
    if (file?.type !== 'image') {
      return;
    }
    console.warn(
      `[ImageLoader] loaderror key="${file.key}" src="${file.src || file.url || 'unknown'}"`,
    );
    ensureFallbackTexture(scene, file.key);
  });

  loader[IMAGE_LOADER_PATCH_FLAG] = true;
}

/**
 * Безопасная загрузка изображения — проверяет дубликаты
 */
function safeLoadImage(scene: Phaser.Scene, key: string, url: string): boolean {
  ensureSafeImageLoading(scene);

  // Проверяем что текстура ещё не загружена
  if (scene.textures.exists(key)) {
    return false;
  }
  
  try {
    scene.load.image(key, normalizeAssetPath(url));
    return true;
  } catch (e) {
    console.warn(`[ImageLoader] Failed to queue: ${key}`, e);
    ensureFallbackTexture(scene, key);
    return false;
  }
}

/**
 * Setup error handler for image loading
 * ⚠️ ОТКЛЮЧЕНО: Обработчик ошибок теперь только в BootScene.preload()
 * Это предотвращает дублирование обработчиков
 */
function setupErrorHandler(scene: Phaser.Scene): void {
  // ⚠️ ОТКЛЮЧЕНО — обработка ошибок в BootScene.preload()
  // scene.load.on('loaderror', ...);
}

/**
 * Loads minimal images required for boot (logo, menu background)
 */
export function loadImagesBoot(scene: Phaser.Scene): void {
  ensureSafeImageLoading(scene);

  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading boot image assets...');
  }
  
  // setupErrorHandler(scene); // ❌ УДАЛЕНО — обработка ошибок в BootScene.preload()
  
  // Only essential UI for initial menu/faction select
  loadUIAssets(scene);
  
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Boot image assets queued');
  }
}

/**
 * Loads images required for Main Menu (if not already in boot)
 */
export function loadImagesMenu(scene: Phaser.Scene): void {
  ensureSafeImageLoading(scene);

  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading menu image assets...');
  }
  
  // setupErrorHandler(scene); // ❌ УДАЛЕНО — обработка ошибок в BootScene.preload()
  
  // Menu-specific assets (faction previews/icons if needed for menu)
  loadFactionPreviews(scene);
  loadFactionIcons(scene);
  
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Menu image assets queued');
  }
}

/**
 * Loads images required for gameplay (units, arenas, ball skins)
 */
export function loadImagesGameplay(scene: Phaser.Scene): void {
  ensureSafeImageLoading(scene);

  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading gameplay image assets...');
  }
  
  // setupErrorHandler(scene); // ❌ УДАЛЕНО — обработка ошибок в BootScene.preload()
  
  // ✅ FIXED: Only load arena tiles that actually exist
  loadArenaTiles(scene);
  loadFactionUnits(scene);
  loadFactionTokens(scene);
  loadFactionArenas(scene);
  loadBallSkins(scene);
  loadCommonAssets(scene);
  loadFactionArt(scene);
  loadMemes(scene);
  
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Gameplay image assets queued');
  }
}

/**
 * Loads images required for campaign (map, chapter backgrounds, bosses, portraits)
 */
export function loadImagesCampaign(scene: Phaser.Scene): void {
  ensureSafeImageLoading(scene);

  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading campaign image assets...');
  }
  
  // setupErrorHandler(scene); // ❌ УДАЛЕНО — обработка ошибок в BootScene.preload()
  
  loadCampaignMapAssets(scene);
  loadCampaignChapterBackgrounds(scene);
  loadBossUnits(scene);
  loadCharacterPortraits(scene);
  
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Campaign image assets queued');
  }
}

/**
 * Loads images required for shop (cards, chests, cap collections, reward icons)
 */
export function loadImagesShop(scene: Phaser.Scene): void {
  ensureSafeImageLoading(scene);

  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading shop image assets...');
  }
  
  // setupErrorHandler(scene); // ❌ УДАЛЕНО — обработка ошибок в BootScene.preload()
  
  loadCardAssets(scene);
  loadChestAssets(scene);
  loadCapCollectionAssets(scene);
  loadRewardIcons(scene);
  
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Shop image assets queued');
  }
}

/**
 * Loads all images (main entry point - loads everything)
 * Split functions (loadImagesBoot, etc.) are available for future lazy loading
 */
export function loadImages(scene: Phaser.Scene): void {
  ensureSafeImageLoading(scene);

  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading all image assets...');
  }
  
  // setupErrorHandler(scene); // ❌ УДАЛЕНО — обработка ошибок в BootScene.preload()
  
  // ✅ FIXED: Only load existing assets
  loadArenaTiles(scene);
  loadUIAssets(scene);
  loadCharacterPortraits(scene);
  loadCampaignMapAssets(scene);
  loadCampaignChapterBackgrounds(scene);
  loadBossUnits(scene);
  loadFactionPreviews(scene);
  loadFactionIcons(scene);
  loadFactionArt(scene);
  loadFactionBackgrounds(scene);
  loadMemes(scene);
  loadCommonAssets(scene);
  loadFactionUnits(scene);
  loadFactionTokens(scene);
  loadFactionArenas(scene);
  loadBallSkins(scene);
  loadCardAssets(scene);
  loadChestAssets(scene);
  loadCapCollectionAssets(scene);
  loadRewardIcons(scene);
  loadLeagueAssets(scene);
  loadTournamentAssets(scene);
  loadAchievementIcons(scene);
  loadAvatars(scene);
  
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] All image assets queued');
  }
}

/**
 * Загружает ассеты карточек (только рамки, НЕ иконки)
 * Иконки карт загружаются через CARDS_CATALOG в BootScene (single source of truth)
 */
function loadCardAssets(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading card frame assets...');
  }

  const framesPath = 'assets/cards/frames';

  // Только рамки карточек (shared UI)
  scene.load.image('frame_common', `${framesPath}/frame_common.png`);
  scene.load.image('frame_rare', `${framesPath}/frame_rare.png`);
  scene.load.image('frame_epic', `${framesPath}/frame_epic.png`);
  scene.load.image('card_back', `${framesPath}/card_back.png`);
  
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Card frame assets queued (4 frames)');
  }
}

/**
 * ✅ FIXED: Only load arena tiles that actually exist in the project
 * Currently only Cyborg tiles exist. Others will use fallback generation.
 */
function loadArenaTiles(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading arena tiles (only existing files)...');
  }
  
  // === CYBORG ARENA TILES (these files exist) ===
  scene.load.image('cyborg_floor', 'assets/factions/cyborg/cyborg_floor.png');
  scene.load.image('cyborg_wall_straight', 'assets/factions/cyborg/cyborg_wall_straight.png');
  scene.load.image('cyborg_wall_corner', 'assets/factions/cyborg/cyborg_wall_corner.png');

  // ✅ REMOVED: These files don't exist - fallbacks will be generated
  // Magma, Void, Insect tiles will use procedural fallback generation
  
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Arena tiles queued (cyborg only, others use fallback)');
  }
}

function loadUIAssets(scene: Phaser.Scene): void {
  scene.load.image('logo', 'assets/images/logo.webp');
  scene.load.image('ui_home_bg', 'assets/ui/backgrounds/home_bg.webp');
  scene.load.image('ui_scoreboard', 'assets/ui/scoreboard.png');
  
  // League & Tournament backgrounds
  scene.load.image(LEAGUE_HUB_BG, 'assets/ui/backgrounds/league_hub_bg_1080x1920.webp');
  scene.load.image(TOURNAMENT_HUB_BG, 'assets/ui/backgrounds/league_hub_bg_1080x1920.webp'); // Using league bg for tournament too
  
  // ✅ NEW: Match mode selection splash arts
  scene.load.image('match_bg_campaign', 'assets/ui/match/match_bg_campaign.png');
  scene.load.image('match_bg_league', 'assets/ui/match/match_bg_league.png');
  scene.load.image('match_bg_tournament', 'assets/ui/match/match_bg_tournament.png');
  scene.load.image('match_bg_custom', 'assets/ui/match/match_bg_custom.png');
  scene.load.image('match_bg_pvp', 'assets/ui/match/match_bg_pvp.png');
  
  // ✅ NEW: Result screen backgrounds (victory, defeat, draw)
  scene.load.image('result_victory_bg', 'assets/ui/match/result_victory_bg_1080x1920.png');
  scene.load.image('result_defeat_bg', 'assets/ui/match/result_defeat_bg_1080x1920.png');
  scene.load.image('result_draw_bg', 'assets/ui/match/result_draw_bg_1080x1920.png');
  
  // ✅ NEW: VS screen backgrounds (MatchVSScene)
  scene.load.image('vs_bg_magma', 'assets/ui/match/vs_backgrounds/vs_bg_magma.png');
  scene.load.image('vs_bg_cyborg', 'assets/ui/match/vs_backgrounds/vs_bg_cyborg.png');
  scene.load.image('vs_bg_void', 'assets/ui/match/vs_backgrounds/vs_bg_void.png');
  scene.load.image('vs_bg_insect', 'assets/ui/match/vs_backgrounds/vs_bg_insect.png');
  scene.load.image('vs_bg_tactical', 'assets/ui/match/vs_backgrounds/vs_bg_tactical.png');
  
  loadUIIcons(scene);
  loadAvatars(scene);
  loadAchievementIcons(scene);
}

/**
 * Загружает PNG-иконки UI из public/assets/ui/icons/
 * Использует абсолютные пути для файлов из public/ (Vite requirement)
 */
function loadUIIcons(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading UI icons...');
  }
  
  // Navigation icons
  scene.load.image('ui_nav_home', 'assets/ui/icons/nav/icon_nav_home.png');
  scene.load.image('ui_nav_team', 'assets/ui/icons/nav/icon_nav_team.png');
  scene.load.image('ui_nav_shop', 'assets/ui/icons/nav/icon_nav_shop.png');
  scene.load.image('ui_nav_profile', 'assets/ui/icons/nav/icon_nav_profile.png');
  
  // Match icons
  scene.load.image('ui_match_primary', 'assets/ui/icons/match/icon_match_primary.png');
  scene.load.image('ui_mode_pvp', 'assets/ui/icons/match/icon_mode_pvp.png');
  scene.load.image('ui_mode_ai', 'assets/ui/icons/match/icon_mode_ai.png');
  scene.load.image('ui_mode_campaign', 'assets/ui/icons/match/icon_mode_campaign.png');
  
  // Reward icons
  scene.load.image('ui_rewards_coins', 'assets/ui/icons/rewards/icon_currency_coins.png');
  scene.load.image('ui_rewards_crystals', 'assets/ui/icons/rewards/icon_currency_crystals.png');
  scene.load.image('ui_rewards_daily', 'assets/ui/icons/rewards/icon_daily_reward.png');
  
  // Reward icons (дополнительные - опционально, если файлы существуют)
  // Если файлы не существуют, будет использован emoji fallback из getRewardEmoji
  // Примечание: Phaser выдаст предупреждение если файл не найден, но это нормально
  // ✅ ЗАКОММЕНТИРОВАНО: Файлы не существуют
  // scene.load.image('ui_rewards_xp', 'assets/ui/icons/rewards/icon_xp.png');
  // scene.load.image('ui_rewards_fragments', 'assets/ui/icons/rewards/icon_fragments.png');
  // scene.load.image('ui_rewards_cards', 'assets/ui/icons/rewards/icon_card_pack.png');
  
  // Chest icons (опционально, если файлы существуют)
  // ✅ ЗАКОММЕНТИРОВАНО: Файлы не существуют
  // scene.load.image('chest_common_256', 'assets/chests/chest_common_256.png');
  // scene.load.image('chest_rare_256', 'assets/chests/chest_rare_256.png');
  // scene.load.image('chest_epic_256', 'assets/chests/chest_epic_256.png');
  
  // Player icons
  scene.load.image('ui_player_level', 'assets/ui/icons/player/icon_player_level.png');
  scene.load.image('ui_faction_magma', 'assets/ui/icons/player/icon_faction_badge_magma.png');
  scene.load.image('ui_faction_cyborg', 'assets/ui/icons/player/icon_faction_badge_cyborg.png');
  scene.load.image('ui_faction_insect', 'assets/ui/icons/player/icon_faction_badge_insect.png');
  scene.load.image('ui_faction_void', 'assets/ui/icons/player/icon_faction_badge_void.png');
  
  // System icons
  scene.load.image('ui_settings_gear', 'assets/ui/icons/system/icon_settings_gear.png');
  
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] UI icons queued (15 icons)');
  }
}

/**
 * ✅ FIXED: Load portraits using absolute paths for Vite production builds
 * Files in public/ folder must use absolute paths starting with /
 * This ensures correct paths after Vite build (no relative path issues)
 */
function loadCharacterPortraits(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading portraits...');
  }
  
  // ✅ FIX: Use relative paths for public/ assets (Vite requirement with base: './')
  // Files in public/ are served with relative paths: assets/... (no leading slash)
  // This prevents 404 errors on production builds
  const getPortraitPath = (filename: string): string => {
    // For files in public/, use relative path (no leading slash)
    return `assets/ui/portraits/${filename}`;
  };

  // 1. NOVA (exists: nova_happy.png)
  // ✅ FIX: Загружаем nova_happy.png под ВСЕМИ возможными ключами (aliases)
  // Это гарантирует, что любой код, запрашивающий портрет Новы, получит работающую картинку
  // Для файлов в public/ используем абсолютный путь (Vite requirement)
  const novaPath = getPortraitPath('nova_happy.png');
  
  scene.load.image('portrait_nova', novaPath);
  scene.load.image('portrait_nova_happy', novaPath);
  scene.load.image('portrait_nova_neutral', novaPath);
  scene.load.image('portrait_nova_determined', novaPath);
  // ✅ FIX: ui_commander_nova также использует nova_happy.png (для TutorialOverlay)
  // Это критически важно для отображения портрета в TutorialOverlay
  scene.load.image('ui_commander_nova', novaPath);
  // ✅ FIX: commander_nova также использует nova_happy.png (для совместимости)
  scene.load.image('commander_nova', novaPath);

  // 2. KRAG (exists: krag_angry.png)
  const kragPath = getPortraitPath('krag_angry.png');
  scene.load.image('portrait_krag', kragPath);
  scene.load.image('portrait_krag_angry', kragPath);
  scene.load.image('portrait_krag_neutral', kragPath);
  scene.load.image('portrait_krag_surprised', kragPath);

  // 3. UNIT 734 (exists: unit734_neutral.png)
  const unit734Path = getPortraitPath('unit734_neutral.png');
  scene.load.image('portrait_unit_734', unit734Path);
  scene.load.image('portrait_unit_734_neutral', unit734Path);
  scene.load.image('portrait_unit734', unit734Path);
  scene.load.image('portrait_unit734_neutral', unit734Path);

  // 4. Z'RA (exists: zra_mysterious.png)
  const zraPath = getPortraitPath('zra_mysterious.png');
  scene.load.image('portrait_zra', zraPath);
  scene.load.image('portrait_zra_neutral', zraPath);
  scene.load.image('portrait_zra_mysterious', zraPath);

  // 5. ORACLE (exists: oracle_neutral.png)
  const oraclePath = getPortraitPath('oracle_neutral.png');
  scene.load.image('portrait_oracle', oraclePath);
  scene.load.image('portrait_oracle_neutral', oraclePath);
  scene.load.image('portrait_oracle_menacing', oraclePath);

  // ✅ REMOVED: portrait_announcer.png doesn't exist - will use fallback
  // Announcer portrait will be generated procedurally
  
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Portraits queued (5 portraits, announcer uses fallback)');
    console.log('[ImageLoader] Portrait paths:', {
      nova: novaPath,
      krag: kragPath,
      unit734: unit734Path,
      zra: zraPath,
      oracle: oraclePath,
    });
  }
}

function loadCampaignMapAssets(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading campaign map assets...');
  }
  
  const basePath = 'assets/ui/campaign';
  
  // Ноды уровней
  scene.load.image('node_locked', `${basePath}/node_locked.png`);
  scene.load.image('node_active', `${basePath}/node_active.png`);
  scene.load.image('node_completed_1star', `${basePath}/node_completed_1star.png`);
  scene.load.image('node_completed_2stars', `${basePath}/node_completed_2stars.png`);
  scene.load.image('node_completed_3stars', `${basePath}/node_completed_3stars.png`);
  scene.load.image('node_boss', `${basePath}/node_boss.png`);
  
  // Путь между уровнями
  scene.load.image('path_dotted', `${basePath}/path_dotted.png`);
  
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Queued campaign map assets');
  }
}

function loadCampaignChapterBackgrounds(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading campaign chapter backgrounds...');
  }
  
  const basePath = 'assets/ui/backgrounds/campaign';
  
  scene.load.image('bg_chapter_magma', `${basePath}/bg_chapter_magma.png`);
  scene.load.image('bg_chapter_cyborg', `${basePath}/bg_chapter_cyborg.png`);
  scene.load.image('bg_chapter_void', `${basePath}/bg_chapter_void.png`);
  scene.load.image('bg_chapter_insect', `${basePath}/bg_chapter_insect.png`);
  
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Queued campaign chapter backgrounds');
  }
}

function loadBossUnits(scene: Phaser.Scene): void {
  const basePath = 'assets/sprites/units/bosses';
  
  scene.load.image('boss_krag', `${basePath}/boss_krag.png`);
  scene.load.image('boss_unit734', `${basePath}/boss_unit734.png`);
  scene.load.image('boss_zra', `${basePath}/boss_zra.png`);
  scene.load.image('boss_oracle', `${basePath}/boss_oracle.png`);
  
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Queued boss unit sprites');
  }
}

function loadFactionPreviews(scene: Phaser.Scene): void {
  scene.load.image('faction_preview_magma', 'assets/ui/factions/magma/faction_preview_magma.webp');
  scene.load.image('faction_preview_cyber', 'assets/ui/factions/cyber/faction_preview_cyber.webp');
  scene.load.image('faction_preview_void', 'assets/ui/factions/void/faction_preview_void.webp');
  scene.load.image('faction_preview_terran', 'assets/ui/factions/terran/faction_preview_terran.webp');
}

function loadFactionIcons(scene: Phaser.Scene): void {
  scene.load.image('icon_faction_magma', 'assets/ui/icons/icon_faction_magma.webp');
  scene.load.image('icon_faction_cyber', 'assets/ui/icons/icon_faction_cyber.webp');
  scene.load.image('icon_faction_void', 'assets/ui/icons/icon_faction_void.webp');
  scene.load.image('icon_faction_terran', 'assets/ui/icons/icon_faction_terran.webp');
}

function loadFactionArt(scene: Phaser.Scene): void {
  scene.load.image('art_magma', 'assets/images/factions/art_magma.png');
  scene.load.image('art_cyborg', 'assets/images/factions/art_cyborg.png');
  scene.load.image('art_void', 'assets/images/factions/art_void.png');
  scene.load.image('art_insect', 'assets/images/factions/art_insect.png');
}

/**
 * Загружает вертикальные фоновые изображения фракций для CollectionScene
 * Размер: 1080x1920 (вертикальный формат для мобильных)
 */
function loadFactionBackgrounds(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading faction background images...');
  }
  
  // ✅ Фоны для Collection Scene (вертикальные 1080x1920)
  FACTION_IDS.forEach((factionId) => {
    const bgKey = `bg_faction_${factionId}`;
    const bgPath = `assets/backgrounds/${factionId}_faction_bg.jpg`;
    
    if (!scene.textures.exists(bgKey)) {
      scene.load.image(bgKey, bgPath);
    }
  });
  
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Queued faction background images (4 backgrounds)');
  }
}

function loadMemes(scene: Phaser.Scene): void {
  scene.load.setPath('assets/skins/memes');
  scene.load.image('meme_doge', 'doge.png');
  scene.load.image('meme_gigachad', 'gigachad.png');
  scene.load.image('meme_cat', 'cat.png');
  scene.load.image('meme_trollface', 'trollface.png');
  scene.load.image('meme_hamster', 'hamster.png');
  scene.load.setPath('');
}

function loadCommonAssets(scene: Phaser.Scene): void {
  scene.load.image('metal_ring', 'assets/sprites/common/metal_ring.png');
}

function loadFactionUnits(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading faction units from UNITS_CATALOG...');
  }

  let loadedCount = 0;

  UNITS_CATALOG.forEach((unit) => {
    // Убираем начальный слеш
    let assetPath = unit.assetPath;
    if (assetPath.startsWith('/')) {
      assetPath = assetPath.substring(1);
    }
    
    // Загружаем под ключом assetKey
    if (!scene.textures.exists(unit.assetKey) || !isRealImageLoaded(unit.assetKey)) {
      scene.load.image(unit.assetKey, assetPath);
      loadedCount++;
    }
  });

  if (import.meta.env.DEV) {
    console.log(`[ImageLoader] ✅ Queued ${loadedCount} units from UNITS_CATALOG`);
  }
}

function loadFactionTokens(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading faction tokens...');
  }
  for (const factionId of FACTION_IDS) {
    const faction = FACTIONS[factionId];
    const assetPath = faction.assetPath.startsWith('/') ? faction.assetPath.substring(1) : faction.assetPath;
    
    // ✅ ОТЛАДКА: Выводим что грузим для каждой фракции
    if (import.meta.env.DEV) {
      console.log(`[ImageLoader] Loading faction ${factionId}: key="${faction.assetKey}", path="${assetPath}"`);
    }
    
    scene.load.image(faction.assetKey, assetPath);
  }
  if (import.meta.env.DEV) {
    console.log(`[ImageLoader] Queued ${FACTION_IDS.length} faction tokens`);
  }
}

function loadFactionArenas(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading faction arenas...');
  }
  for (const factionId of FACTION_IDS) {
    const arena = FACTION_ARENAS[factionId];
    const assetPath = arena.assetPath.startsWith('/') ? arena.assetPath.substring(1) : arena.assetPath;
    scene.load.image(arena.assetKey, assetPath);
  }
  if (import.meta.env.DEV) {
    console.log(`[ImageLoader] Queued ${FACTION_IDS.length} arenas`);
  }
}

function loadBallSkins(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading ball skins...');
  }
  scene.load.image('ball_plasma', 'assets/sprites/balls/plasma.png');
  scene.load.image('ball_core', 'assets/sprites/balls/core.png');
  scene.load.image('ball_quantum', 'assets/sprites/balls/quantum.png');
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Queued 3 ball skins');
  }
}

/**
 * Загрузка ассетов сундуков
 * 
 * ВАЖНО: Используем новые ключи из ChestsCatalog, но старые файлы
 * Маппинг: 
 *   chest_stellar -> chest_small_512.png
 *   chest_nebula -> chest_medium_512.png
 *   chest_nova -> chest_large_512.png
 *   chest_cosmic -> chest_mystic_512.png
 */
function loadChestAssets(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading chest assets with NEW keys...');
  }
  
  // Маппинг новых ID на старые имена файлов
  const chestMapping = [
    { newId: 'chest_stellar', oldFile: 'chest_small_512.png' },
    { newId: 'chest_nebula', oldFile: 'chest_medium_512.png' },
    { newId: 'chest_nova', oldFile: 'chest_large_512.png' },
    { newId: 'chest_cosmic', oldFile: 'chest_mystic_512.png' },
  ];
  
  chestMapping.forEach(({ newId, oldFile }) => {
    const path = `assets/chests/${oldFile}`;
    
    // Загружаем под новыми ключами
    if (!scene.textures.exists(`${newId}_512`)) {
      scene.load.image(`${newId}_512`, path);
    }
    if (!scene.textures.exists(`${newId}_256`)) {
      scene.load.image(`${newId}_256`, path); // Используем тот же 512 файл
    }
  });
  
  // Также загружаем под старыми ключами для обратной совместимости
  const oldChests = ['chest_small', 'chest_medium', 'chest_large', 'chest_mystic'];
  oldChests.forEach(chestId => {
    const path512 = `assets/chests/${chestId}_512.png`;
    if (!scene.textures.exists(`${chestId}_512`)) {
      scene.load.image(`${chestId}_512`, path512);
    }
    if (!scene.textures.exists(`${chestId}_256`)) {
      scene.load.image(`${chestId}_256`, path512);
    }
  });
  
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Queued chest assets (4 chests × 2 key variants)');
  }
}

// === FIX: Load Mystic Caps using Catalog ===
function loadCapCollectionAssets(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading unique units from UnitsRepository...');
  }

  let loadedCount = 0;

  UNITS_REPOSITORY.forEach((unit) => {
    let assetPath = unit.assetPath;
    
    // Убираем начальный слеш и параметры версии
    if (assetPath.startsWith('/')) {
      assetPath = assetPath.substring(1);
    }
    // Убираем ?v=... если есть
    if (assetPath.includes('?')) {
      assetPath = assetPath.split('?')[0];
    }
    
    const hdKey = `${unit.assetKey}_512`;
    const baseKey = unit.assetKey;
    
    // Загружаем HD версию
    if (!scene.textures.exists(hdKey) || !isRealImageLoaded(hdKey)) {
      scene.load.image(hdKey, assetPath);
      loadedCount++;
    }
    
    // ВАЖНО: Загружаем также под базовым ключом (без _512)
    // Это нужно для ShopScene который использует unit.assetKey
    if (!scene.textures.exists(baseKey) || !isRealImageLoaded(baseKey)) {
      scene.load.image(baseKey, assetPath);
      loadedCount++;
    }
  });

  if (import.meta.env.DEV) {
    console.log(`[ImageLoader] ✅ Queued ${loadedCount} unit textures (HD + base keys)`);
  }
}

function loadRewardIcons(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading reward icons...');
  }
  
  const rewards = ['coins', 'crystals', 'cards', 'fragments'];
  rewards.forEach(r => {
    scene.load.image(`reward_${r}_256`, `assets/ui/rewards/reward_${r}_256.png`);
  });
  
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Queued reward icons (4 icons)');
  }
}

/**
 * Загружает ассеты лиги (бейджи, дивизионы, звёзды, Orbit-панели)
 */
function loadLeagueAssets(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading league assets...');
  }
  
  // League badges
  Object.values(LEAGUE_BADGE_KEYS).forEach(key => {
    const tier = key.replace('league_badge_', '').replace('_512', '');
    scene.load.image(key, `assets/ui/league/badges/league_badge_${tier}_512.png`);
  });
  
  // League divisions
  Object.values(LEAGUE_DIVISION_KEYS).forEach(key => {
    const div = key.replace('league_division_', '').replace('_128', '');
    scene.load.image(key, `assets/ui/league/divisions/league_division_${div}_128.png`);
  });
  
  // League stars
  scene.load.image(LEAGUE_STAR_KEYS.EMPTY, 'assets/ui/league/icons/rank_star_empty_64.png');
  scene.load.image(LEAGUE_STAR_KEYS.FULL, 'assets/ui/league/icons/rank_star_full_64.png');
  scene.load.image(LEAGUE_STAR_KEYS.GLOW, 'assets/ui/league/icons/rank_star_glow_64.png');
  
  // Orbit decay panel and icons
  scene.load.image(LEAGUE_ORBIT_KEYS.DECAY_PANEL, 'assets/ui/league/orbit/orbit_decay_panel_1600x900.png');
  scene.load.image(LEAGUE_ORBIT_KEYS.STABILIZE_ICON, 'assets/ui/league/orbit/orbit_stabilize_icon_256.png');
  scene.load.image(LEAGUE_ORBIT_KEYS.WARNING_ICON, 'assets/ui/league/orbit/orbit_warning_icon_256.png');
  
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Queued league assets');
  }
}

/**
 * Загружает ассеты турниров (фоны, кубки, ключи, сетка)
 */
function loadTournamentAssets(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading tournament assets...');
  }
  
  // Tournament backgrounds
  Object.entries(TOURNAMENT_BACKGROUND_KEYS).forEach(([tier, key]) => {
    scene.load.image(key, `assets/ui/tournament/backgrounds/${tier.toLowerCase()}_bg_1080x1920.webp`);
  });
  
  // Tournament cups
  Object.entries(TOURNAMENT_CUP_KEYS).forEach(([tier, key]) => {
    const filename = tier === 'ROOKIE' ? 'cup_rookie_draft_512.png' : 
                     tier === 'APEX' ? 'cup_galactic_apex_512.png' :
                     `cup_${tier.toLowerCase()}_512.png`;
    scene.load.image(key, `assets/ui/tournament/cups/${filename}`);
  });
  
  // Tournament keys
  // Основные ключи с полными именами
  safeLoadImage(scene, 'tournament_key_fragment_128', 'assets/ui/tournament/keys/tournament_key_fragment_128.png');
  safeLoadImage(scene, 'tournament_key_full_256', 'assets/ui/tournament/keys/tournament_key_full_256.png');
  safeLoadImage(scene, 'tournament_ticket_256x128', 'assets/ui/tournament/keys/tournament_ticket_256x128.png');
  
  // Алиасы для совместимости со старым кодом (короткие имена)
  safeLoadImage(scene, 'tournament_key_fragment', 'assets/ui/tournament/keys/tournament_key_fragment_128.png');
  safeLoadImage(scene, 'tournament_key_full', 'assets/ui/tournament/keys/tournament_key_full_256.png');
  safeLoadImage(scene, 'tournament_ticket', 'assets/ui/tournament/keys/tournament_ticket_256x128.png');
  
  // Tournament bracket slots
  scene.load.image(TOURNAMENT_BRACKET_KEYS.SLOT_DEFAULT, 'assets/ui/tournament/bracket/bracket_slot_default_480x140.png');
  scene.load.image(TOURNAMENT_BRACKET_KEYS.SLOT_WINNER, 'assets/ui/tournament/bracket/bracket_slot_winner_480x140.png');
  
  // Aim assist icon
  // ⚠️ FIX: Файл не существует, комментируем загрузку (будет сгенерирован fallback)
  // scene.load.image(AIM_ASSIST_OFF_ICON, '/assets/ui/icons/icon_aim_assist_off_128.png');
  
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] ✅ Tournament assets queued');
  }
}

// ========== VERIFICATION FUNCTIONS ==========

export function verifyUnitAssets(scene: Phaser.Scene): void {
  if (!import.meta.env.DEV) return;
  
  UNITS_CATALOG.forEach((unit) => {
    const exists = scene.textures.exists(unit.assetKey);
    if (!exists) {
      console.warn(`⚠️ [ImageLoader] Unit MISSING: ${unit.assetKey}`);
    }
  });
}

export function verifyFactionAssets(scene: Phaser.Scene): void {
  if (!import.meta.env.DEV) return;
  
  for (const factionId of FACTION_IDS) {
    const faction = FACTIONS[factionId];
    const exists = scene.textures.exists(faction.assetKey);
    if (!exists) {
      console.warn(`⚠️ [ImageLoader] Faction token MISSING: ${faction.assetKey}`);
    }
  }
}

export function verifyCommonAssets(scene: Phaser.Scene): void {
  if (!import.meta.env.DEV) return;
  
  if (!scene.textures.exists('metal_ring')) {
    console.warn('⚠️ [ImageLoader] metal_ring.png MISSING');
  }
}

export function verifyArenaAssets(scene: Phaser.Scene): void {
  if (!import.meta.env.DEV) return;
  
  for (const factionId of FACTION_IDS) {
    const arena = FACTION_ARENAS[factionId];
    const exists = scene.textures.exists(arena.assetKey);
    if (!exists) {
      console.warn(`⚠️ [ImageLoader] Arena MISSING: ${arena.name}`);
    }
  }
}

export function verifyBallAssets(scene: Phaser.Scene): void {
  if (!import.meta.env.DEV) return;
  
  const ballIds = ['ball_plasma', 'ball_core', 'ball_quantum'];
  ballIds.forEach(id => {
    if (!scene.textures.exists(id)) {
      console.warn(`⚠️ [ImageLoader] Ball MISSING: ${id}`);
    }
  });
}

export function verifyFactionArt(scene: Phaser.Scene): void {
  if (!import.meta.env.DEV) return;
  
  const artKeys = ['art_magma', 'art_cyborg', 'art_void', 'art_insect'];
  artKeys.forEach(key => {
    if (!scene.textures.exists(key)) {
      console.warn(`⚠️ [ImageLoader] Faction art MISSING: ${key}`);
    }
  });
}

export function verifyFactionUIBackgrounds(scene: Phaser.Scene): void {
  if (!import.meta.env.DEV) return;
  
  const uiIds = ['magma', 'cyber', 'void', 'terran'];
  for (const uiId of uiIds) {
    const key = `faction_preview_${uiId}`;
    if (!scene.textures.exists(key)) {
      console.warn(`❌ [ImageLoader] Preview MISSING: ${key}`);
    }
  }
}

export function verifyPortraitAssets(scene: Phaser.Scene): void {
  if (!import.meta.env.DEV) return;
  
  const portraitKeys = [
    'portrait_nova',
    'portrait_krag',
    'portrait_unit734',
    'portrait_zra',
    'portrait_oracle',
  ];

  portraitKeys.forEach(key => {
    if (!scene.textures.exists(key)) {
      console.warn(`⚠️ [ImageLoader] Portrait MISSING: ${key}`);
    }
  });
}

export function verifyCampaignMapAssets(scene: Phaser.Scene): void {
  if (!import.meta.env.DEV) return;
  
  const mapAssets = [
    'node_locked',
    'node_active',
    'node_completed_1star',
    'node_completed_2stars',
    'node_completed_3stars',
    'node_boss',
    'path_dotted',
  ];

  mapAssets.forEach(key => {
    if (!scene.textures.exists(key)) {
      console.warn(`⚠️ [ImageLoader] Campaign map asset MISSING: ${key}`);
    }
  });
}

export function verifyCampaignChapterBackgrounds(scene: Phaser.Scene): void {
  if (!import.meta.env.DEV) return;
  
  const chapters = ['magma', 'cyborg', 'void', 'insect'];
  chapters.forEach(chapter => {
    const key = `bg_chapter_${chapter}`;
    if (!scene.textures.exists(key)) {
      console.warn(`⚠️ [ImageLoader] Chapter background MISSING: ${key}`);
    }
  });
}

export function verifyBossAssets(scene: Phaser.Scene): void {
  if (!import.meta.env.DEV) return;
  
  const bosses = ['boss_krag', 'boss_unit734', 'boss_zra', 'boss_oracle'];
  bosses.forEach(key => {
    if (!scene.textures.exists(key)) {
      console.warn(`⚠️ [ImageLoader] Boss sprite MISSING: ${key}`);
    }
  });
}

export function verifyEmotionPortraits(scene: Phaser.Scene): void {
  if (!import.meta.env.DEV) return;
  
  // Only verify base portraits, emotions map to same files
  const emotionPortraits = [
    'portrait_nova_happy',
    'portrait_krag_angry',
    'portrait_unit734_neutral',
    'portrait_zra_mysterious',
    'portrait_oracle_neutral',
  ];

  emotionPortraits.forEach(key => {
    if (!scene.textures.exists(key)) {
      console.warn(`⚠️ [ImageLoader] Emotion portrait MISSING: ${key}`);
    }
  });
}

// ============================================================
// 🎭 AVATARS (256x256 PNG)
// ============================================================

/**
 * Загружает аватарки игрока (2 бесплатные + 6 премиум)
 */
function loadAvatars(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading player avatars...');
  }

  // Бесплатные (2)
  scene.load.image('avatar_recruit', 'assets/ui/avatars/avatar_recruit.png');
  scene.load.image('avatar_explorer', 'assets/ui/avatars/avatar_explorer.png');

  // Премиум (6)
  scene.load.image('avatar_magma_warrior', 'assets/ui/avatars/avatar_magma_warrior.png');
  scene.load.image('avatar_cyborg_elite', 'assets/ui/avatars/avatar_cyborg_elite.png');
  scene.load.image('avatar_void_mystic', 'assets/ui/avatars/avatar_void_mystic.png');
  scene.load.image('avatar_insect_hive', 'assets/ui/avatars/avatar_insect_hive.png');
  scene.load.image('avatar_champion', 'assets/ui/avatars/avatar_champion.png');
  scene.load.image('avatar_legend', 'assets/ui/avatars/avatar_legend.png');

  if (import.meta.env.DEV) {
    console.log('[ImageLoader] ✅ 8 avatars queued');
  }
}

// ============================================================
// 🏆 ACHIEVEMENT ICONS (128x128 PNG)
// ============================================================

/**
 * Загружает иконки достижений (34 шт)
 */
function loadAchievementIcons(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[ImageLoader] Loading achievement icons...');
  }

  // Базовые (6)
  scene.load.image('achievement_first_victory', 'assets/ui/achievements/achievement_first_victory.png');
  scene.load.image('achievement_loyal_player', 'assets/ui/achievements/achievement_loyal_player.png');
  scene.load.image('achievement_centurion', 'assets/ui/achievements/achievement_centurion.png');
  scene.load.image('achievement_rising_star', 'assets/ui/achievements/achievement_rising_star.png');
  scene.load.image('achievement_veteran', 'assets/ui/achievements/achievement_veteran.png');
  scene.load.image('achievement_master', 'assets/ui/achievements/achievement_master.png');

  // Камбэки (3)
  scene.load.image('achievement_comeback', 'assets/ui/achievements/achievement_comeback.png');
  scene.load.image('achievement_comeback_epic', 'assets/ui/achievements/achievement_comeback_epic.png');
  scene.load.image('achievement_comeback_legendary', 'assets/ui/achievements/achievement_comeback_legendary.png.png');

  // Голы (7)
  scene.load.image('achievement_first_goal', 'assets/ui/achievements/achievement_first_goal.png');
  scene.load.image('achievement_hat_trick', 'assets/ui/achievements/achievement_hat_trick.png');
  scene.load.image('achievement_goal_spree', 'assets/ui/achievements/achievement_goal_spree.png');
  scene.load.image('achievement_goal_scorer', 'assets/ui/achievements/achievement_goal_scorer.png');
  scene.load.image('achievement_goal_machine', 'assets/ui/achievements/achievement_goal_machine.png');
  scene.load.image('achievement_sniper_goal', 'assets/ui/achievements/achievement_sniper_goal.png');
  scene.load.image('achievement_trickster_curve', 'assets/ui/achievements/achievement_trickster_curve.png');

  // Защита (3)
  scene.load.image('achievement_clean_sheet', 'assets/ui/achievements/achievement_clean_sheet.png');
  scene.load.image('achievement_perfect_defender', 'assets/ui/achievements/achievement_perfect_defender.png');
  scene.load.image('achievement_tank_wall', 'assets/ui/achievements/achievement_tank_wall.png');

  // Серии побед (3)
  scene.load.image('achievement_win_streak', 'assets/ui/achievements/achievement_win_streak.png');
  scene.load.image('achievement_win_streak_epic', 'assets/ui/achievements/achievement_win_streak_epic.png');
  scene.load.image('achievement_win_streak_legendary', 'assets/ui/achievements/achievement_win_streak_legendary.png');

  // Драматургия (2)
  scene.load.image('achievement_clutch', 'assets/ui/achievements/achievement_clutch.png');
  scene.load.image('achievement_overtime_hero', 'assets/ui/achievements/achievement_overtime_hero.png');

  // Способности фракций (4)
  scene.load.image('achievement_lava_master', 'assets/ui/achievements/achievement_lava_master.png');
  scene.load.image('achievement_shield_expert', 'assets/ui/achievements/achievement_shield_expert.png');
  scene.load.image('achievement_swap_tactician', 'assets/ui/achievements/achievement_swap_tactician.png');
  scene.load.image('achievement_toxin_hunter', 'assets/ui/achievements/achievement_toxin_hunter.png');

  // Режимы (3)
  scene.load.image('achievement_campaign_hero', 'assets/ui/achievements/achievement_campaign_hero.png');
  scene.load.image('achievement_league_climber', 'assets/ui/achievements/achievement_league_climber.png');
  scene.load.image('achievement_tournament_champion', 'assets/ui/achievements/achievement_tournament_champion.png');

  // Коллекция (3)
  scene.load.image('achievement_collector', 'assets/ui/achievements/achievement_collector.png');
  scene.load.image('achievement_master_collector', 'assets/ui/achievements/achievement_master_collector.png');
  scene.load.image('achievement_complete_collection', 'assets/ui/achievements/achievement_complete_collection.png');

  if (import.meta.env.DEV) {
    console.log('[ImageLoader] ✅ 34 achievement icons queued');
  }
}


export function verifyCardAssets(scene: Phaser.Scene): void {
  if (!import.meta.env.DEV) return;
  
  const frameKeys = ['frame_common', 'frame_rare', 'frame_epic', 'card_back'];
  frameKeys.forEach(key => {
    if (!scene.textures.exists(key)) {
      console.warn(`⚠️ [ImageLoader] Card frame MISSING: ${key}`);
    }
  });
}