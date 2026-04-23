// src/scenes/BootScene.ts
// ✅ ИЗМЕНЕНО: Заменён несуществующий метод fillStar на fillCircle

import Phaser from 'phaser';
import { ParticleTextures } from '../assets/textures/ParticleTextures';
import { CapTextures } from '../assets/textures/CapTextures';
import { BallTextures } from '../assets/textures/BallTextures';
import { FieldTextures } from '../assets/textures/FieldTextures';
import { AvatarTextures } from '../assets/textures/AvatarTextures';
import { playerData } from '../data/PlayerData';
import { SessionPersistence } from '../utils/SessionPersistence';

// Loaders
import { loadAudio } from '../assets/loading/AudioLoader';
import { loadImages, loadImagesBoot } from '../assets/loading/ImageLoader';
import { UNITS_CATALOG } from '../data/UnitsCatalog';
import { CARDS_CATALOG, getAllCards } from '../data/CardsCatalog';

// Generators
import { CampaignGenerator } from '../assets/generation/CampaignGenerator';
import { FactionGenerator } from '../assets/generation/FactionGenerator';
import { UIGenerator } from '../assets/generation/UIGenerator';

// Configurators
import { applyHybridTextureFiltering, generateMipmapsForHDTextures } from '../utils/TextureConfigurator';

// Глобальный флаг для защиты от повторной загрузки
declare global {
  interface Window {
    __BOOT_ASSETS_LOADED__?: boolean;
  }
}

export class BootScene extends Phaser.Scene {
  private navigationStarted = false;
  private failedAssets: string[] = [];

  constructor() {
    super({ key: 'BootScene' });
  }

  // ✅ Сброс флагов при каждом запуске сцены
  init(): void {
    this.navigationStarted = false;
    this.failedAssets = [];
    // ✅ НЕ сбрасываем window.__BOOT_ASSETS_LOADED__ — он должен сохраняться между restart
  }

  preload(): void {
    console.log('[BootScene] preload started');
    
    // ✅ ЕДИНСТВЕННЫЙ обработчик ошибок загрузки
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn('[BootScene] Failed to load:', file.key, file.url);
      this.failedAssets.push(file.key);
    });
    
    // Прогресс загрузки
    this.load.on('progress', (value: number) => {
      const percent = Math.round(value * 100);
      if (typeof (window as any).updateLoadingProgress === 'function') {
        (window as any).updateLoadingProgress(percent, `Загрузка... ${percent}%`);
      }
    });
    
    this.load.on('complete', () => {
      console.log('[BootScene] Assets loaded');
      if (typeof (window as any).updateLoadingProgress === 'function') {
        (window as any).updateLoadingProgress(100, 'Запуск игры...');
      }
    });
    
    // ========================================
    // ЗАГРУЗКА АССЕТОВ - ТОЛЬКО ЧЕРЕЗ loadImages()
    // НЕ вызываем отдельные методы - они уже внутри loadImages()
    // ========================================
    
    try {
      loadImages(this);
      console.log('[BootScene] loadImages() called');
    } catch (e) {
      console.error('[BootScene] loadImages() error:', e);
    }
    
    // Аудио - опционально
    try {
      loadAudio(this);
      console.log('[BootScene] loadAudio() called');
    } catch (e) {
      console.error('[BootScene] loadAudio() error:', e);
    }
    
    // ========================================
    // ДОПОЛНИТЕЛЬНО: Иконки карточек способностей
    // ========================================
    try {
      this.loadCardAssets();
      console.log('[BootScene] loadCardAssets() called');
    } catch (e) {
      console.error('[BootScene] loadCardAssets() error:', e);
    }
    
    console.log('[BootScene] preload complete');
  }

  /**
   * Загружает только критические ассеты для быстрого старта
   */
  private loadCriticalAssets(): void {
    if (import.meta.env.DEV) {
      console.log('[BootScene] Loading CRITICAL assets only...');
    }
    
    // 1. UI элементы для меню
    this.loadCriticalUI();
    
    // 2. Базовые текстуры (мяч, поле)
    this.loadCriticalGameAssets();
    
    // 3. Юниты текущей фракции игрока (только 5-10 штук)
    this.loadPlayerFactionUnits();
    
    // 4. Аудио - только критические звуки
    this.loadCriticalAudio();
  }

  private loadCriticalUI(): void {
    // Загружаем только основные UI элементы через loadImagesBoot
    loadImagesBoot(this);
    
    // Role icons (128x128)
    this.load.image('role_balanced', 'assets/ui/icons/roles/role_balanced.png');
    this.load.image('role_tank', 'assets/ui/icons/roles/role_tank.png');
    this.load.image('role_sniper', 'assets/ui/icons/roles/role_sniper.png');
    this.load.image('role_trickster', 'assets/ui/icons/roles/role_trickster.png');
  }

  private loadCriticalGameAssets(): void {
    // Мяч и базовые игровые элементы
    // Эти генерируются процедурно, поэтому не нужно загружать
  }

  private loadPlayerFactionUnits(): void {
    // ОПТИМИЗАЦИЯ: Загружаем только 3-4 базовых юнита для меню (если они там отображаются)
    // Или вообще убираем, если в меню используются только портреты (portraits)
    try {
      const playerFaction = playerData.getFaction() || 'cyborg';
      
      // Импортируем репозиторий динамически
      import('../data/UnitsRepository').then(({ UNITS_REPOSITORY }) => {
        // Берем только первые 3-4 юнита текущей фракции
        const factionUnits = UNITS_REPOSITORY.filter(
          (u: any) => u.factionId === playerFaction
        ).slice(0, 4); // Только 4 базовых юнита
        
        if (import.meta.env.DEV) {
          console.log(`[BootScene] Loading ${factionUnits.length} basic units for faction: ${playerFaction}`);
        }
        
        factionUnits.forEach((unit: any) => {
          const hdKey = `${unit.assetKey}_512`;
          let assetPath = unit.assetPath;
          if (assetPath.startsWith('/')) {
            assetPath = assetPath.substring(1);
          }
          
          if (!this.textures.exists(hdKey)) {
            this.load.image(hdKey, assetPath);
          }
        });
      }).catch((e) => {
        if (import.meta.env.DEV) {
          console.warn('[BootScene] Could not load faction units:', e);
        }
      });
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[BootScene] Could not load faction units:', e);
      }
    }
  }

  private loadCriticalAudio(): void {
    // Загружаем только UI звуки, музыку загрузим позже
    const criticalSounds = [
      { key: 'sfx_click', path: 'assets/audio/ui/click.mp3' },
      { key: 'sfx_goal', path: 'assets/audio/sfx/goal.mp3' },
    ];
    
    criticalSounds.forEach(sound => {
      if (!this.cache.audio.exists(sound.key)) {
        this.load.audio(sound.key, sound.path);
      }
    });
  }


  /**
   * Загрузка ассетов карт способностей
   * ✅ УПРОЩЕНО: Используем тот же подход что и для юнитов
   */
  private loadCardAssets(): void {
    const cards = Object.values(CARDS_CATALOG);
    let loadedCount = 0;
    
    if (import.meta.env.DEV) {
      console.log(`[BootScene] 🃏 Loading ${cards.length} card assets...`);
    }
    
    cards.forEach(card => {
      const textureKey = `card_${card.id}`;
      
      // Убираем начальный слеш для Vite
      let assetPath = card.assetPath;
      if (assetPath.startsWith('/')) {
        assetPath = assetPath.substring(1);
      }
      
      // ✅ ПРОСТО: Загружаем только если ещё не загружено (как юниты)
      if (!this.textures.exists(textureKey)) {
        this.load.image(textureKey, assetPath);
        loadedCount++;
      }
    });
    
    if (import.meta.env.DEV) {
      console.log(`[BootScene] 🃏 Queued ${loadedCount} card textures`);
    }
    
    // Загружаем бустеры
    this.loadCardCommonAssets();
  }

  /**
   * Загрузка ассетов турнира (билеты и ключи)
   */
  private loadTournamentAssets(): void {
    // ✅ ИСПРАВЛЕННЫЕ ПУТИ (папка keys)
    const tournamentAssets = [
      { key: 'tournament_key_fragment_128', path: 'assets/ui/tournament/keys/tournament_key_fragment_128.png' },
      { key: 'tournament_key_full_256', path: 'assets/ui/tournament/keys/tournament_key_full_256.png' },
      { key: 'tournament_ticket_256x128', path: 'assets/ui/tournament/keys/tournament_ticket_256x128.png' },
    ];

    tournamentAssets.forEach(({ key, path }) => {
      if (!this.textures.exists(key)) {
        this.load.image(key, path);
        this.load.once(`loaderror`, (file: any) => {
          if (file.key === key) {
            if (import.meta.env.DEV) {
              console.warn(`[BootScene] Tournament asset not found: ${key}, will use placeholder`);
            }
            // Создадим placeholder в create() если ассет не загрузился
          }
        });
      }
    });
  }

  /**
   * Загрузка preview изображений для уровней кампании
   */
  private loadCampaignPreviewImages(): void {
    const campaignPreviewImages: { key: string; path: string }[] = [
      { key: 'campaign_ch1_l1_preview', path: 'assets/ui/campaign/ch1/ch1_l1_preview.png' },
      { key: 'campaign_ch1_l2_preview', path: 'assets/ui/campaign/ch1/ch1_l2_preview.png' },
      { key: 'campaign_ch1_l3_preview', path: 'assets/ui/campaign/ch1/ch1_l3_preview.png' },
      { key: 'campaign_ch1_l4_preview', path: 'assets/ui/campaign/ch1/ch1_l4_preview.png' },

      { key: 'campaign_ch2_l1_preview', path: 'assets/ui/campaign/ch2/ch2_l1_preview.png' },
      { key: 'campaign_ch2_l2_preview', path: 'assets/ui/campaign/ch2/ch2_l2_preview.png' },
      { key: 'campaign_ch2_l3_preview', path: 'assets/ui/campaign/ch2/ch2_l3_preview.png' },
      { key: 'campaign_ch2_l4_preview', path: 'assets/ui/campaign/ch2/ch2_l4_preview.png' },

      { key: 'campaign_ch3_l1_preview', path: 'assets/ui/campaign/ch3/ch3_l1_preview.png' },
      { key: 'campaign_ch3_l2_preview', path: 'assets/ui/campaign/ch3/ch3_l2_preview.png' },
      { key: 'campaign_ch3_l3_preview', path: 'assets/ui/campaign/ch3/ch3_l3_preview.png' },
      { key: 'campaign_ch3_l4_preview', path: 'assets/ui/campaign/ch3/ch3_l4_preview.png' },

      { key: 'campaign_ch4_l1_preview', path: 'assets/ui/campaign/ch4/ch4_l1_preview.png' },
      { key: 'campaign_ch4_l2_preview', path: 'assets/ui/campaign/ch4/ch4_l2_preview.png' },
      { key: 'campaign_ch4_l3_preview', path: 'assets/ui/campaign/ch4/ch4_l3_preview.png' },
      { key: 'campaign_ch4_l4_preview', path: 'assets/ui/campaign/ch4/ch4_l4_preview.png' },
    ];

    campaignPreviewImages.forEach(({ key, path }) => {
      this.load.image(key, path);
    });
  }

  /**
   * Загрузка общих ассетов для карточной системы (рамки + бустеры)
   * ✅ УПРОЩЕНО: Без лишних проверок
   */
  private loadCardCommonAssets(): void {
    if (import.meta.env.DEV) {
      console.log('[BootScene] Loading card common assets...');
    }
    
    // Рамки карт
    if (!this.textures.exists('card_bg_common')) {
      this.load.image('card_bg_common', 'assets/cards/frames/frame_common.png');
    }
    if (!this.textures.exists('card_bg_rare')) {
      this.load.image('card_bg_rare', 'assets/cards/frames/frame_rare.png');
    }
    if (!this.textures.exists('card_bg_epic')) {
      this.load.image('card_bg_epic', 'assets/cards/frames/frame_epic.png');
    }
    
    // Бустеры
    if (!this.textures.exists('booster_tactical')) {
      this.load.image('booster_tactical', 'assets/ui/boosters/booster_tactical.png');
    }
    if (!this.textures.exists('booster_magma')) {
      this.load.image('booster_magma', 'assets/ui/boosters/booster_magma.png');
    }
    if (!this.textures.exists('booster_cyborg')) {
      this.load.image('booster_cyborg', 'assets/ui/boosters/booster_cyborg.png');
    }
    if (!this.textures.exists('booster_void')) {
      this.load.image('booster_void', 'assets/ui/boosters/booster_void.png');
    }
    if (!this.textures.exists('booster_insect')) {
      this.load.image('booster_insect', 'assets/ui/boosters/booster_insect.png');
    }
    if (!this.textures.exists('booster_faction')) {
      this.load.image('booster_faction', 'assets/ui/boosters/booster_tactical.png');
    }
    
    if (import.meta.env.DEV) {
      console.log('[BootScene] Card common assets queued');
    }
  }

  create(): void {
    console.log('[BootScene] create started');
    
    // Генерируем базовые текстуры (как в рабочей версии)
    try {
      new ParticleTextures(this).generate();
      new CapTextures(this).generate();
      new BallTextures(this).generate();
      new FieldTextures(this).generate();
      new AvatarTextures(this).generate();
    } catch (e) {
      console.warn('[BootScene] Texture generation failed:', e);
    }
    
    console.log('[BootScene] Starting MainMenuScene...');
    
    // Простой переход к MainMenuScene
    this.scene.start('MainMenuScene');
    
    // Скрываем loading screen через 100ms
    this.time.delayedCall(100, () => {
      if (typeof (window as any).hideLoadingScreen === 'function') {
        (window as any).hideLoadingScreen();
      }
    });
  }

  /**
   * ✅ FIX: Создает базовые ключи юнитов как aliases к _512 версиям
   * Например: 'magma_ember_fang' -> alias к 'magma_ember_fang_512'
   */
  private createUnitAliases(): void {
    // Динамический импорт для избежания циклических зависимостей
    import('../data/UnitsRepository').then(({ UNITS_REPOSITORY }) => {
      let aliasCount = 0;
      let magmaAliases = 0;
      UNITS_REPOSITORY.forEach(unit => {
        // ⚠️ FIX: Используем unit.assetKey для создания alias, а не unit.id!
        const hdKey = `${unit.assetKey}_512`;
        const baseKey = unit.assetKey;
        
        // Если _512 текстура существует, но базовая нет - создаем alias
        if (this.textures.exists(hdKey) && !this.textures.exists(baseKey)) {
          const hdTexture = this.textures.get(hdKey);
          this.textures.addImage(baseKey, hdTexture.getSourceImage() as HTMLImageElement);
          aliasCount++;
          
          if (unit.factionId === 'magma' && unit.isShopItem) {
            magmaAliases++;
            if (import.meta.env.DEV) {
              console.log(`[BootScene] 🔥 Created alias for MAGMA shop unit: "${baseKey}" -> "${hdKey}"`);
            }
          }
        } else if (unit.factionId === 'magma' && unit.isShopItem) {
          if (import.meta.env.DEV) {
            console.warn(`[BootScene] ⚠️ MAGMA shop unit alias not created: hdKey="${hdKey}" exists=${this.textures.exists(hdKey)}, baseKey="${baseKey}" exists=${this.textures.exists(baseKey)}`);
          }
        }
        
        // ✅ FIX: Создаем алиас и для unit.id, если он отличается от assetKey
        // Это нужно для совместимости с кодом, который использует unit.id
        if (unit.id !== unit.assetKey) {
          const idHdKey = `${unit.assetKey}_512`; // HD ключ всегда на основе assetKey
          if (this.textures.exists(idHdKey) && !this.textures.exists(unit.id)) {
            const idHdTexture = this.textures.get(idHdKey);
            this.textures.addImage(unit.id, idHdTexture.getSourceImage() as HTMLImageElement);
            aliasCount++;
            
            if (import.meta.env.DEV) {
              console.log(`[BootScene] ✅ Created alias for unit.id: "${unit.id}" -> "${idHdKey}"`);
            }
          }
        }
      });
      
      if (import.meta.env.DEV) {
        console.log(`[BootScene] ✅ Created ${aliasCount} unit texture aliases (${magmaAliases} magma shop units)`);
      }
    }).catch(err => {
      if (import.meta.env.DEV) {
        console.warn('[BootScene] Failed to create unit aliases:', err);
      }
    });
  }

  /**
   * Генерация placeholder'ов для ассетов турнира
   */
  private generateTournamentPlaceholders(): void {
    const tournamentAssets = [
      { key: 'tournament_key_fragment', color: 0xffaa00, icon: '🔑' },
      { key: 'tournament_ticket', color: 0x00ff88, icon: '🎫' },
      { key: 'tournament_key_full', color: 0xffd700, icon: '🔐' },
    ];

    tournamentAssets.forEach(({ key, color, icon }) => {
      if (!this.textures.exists(key)) {
        // Создаём простой placeholder
        const graphics = this.add.graphics();
        graphics.fillStyle(color, 0.8);
        graphics.fillCircle(0, 0, 64);
        graphics.lineStyle(3, 0xffffff, 1);
        graphics.strokeCircle(0, 0, 64);
        
        // Генерируем текстуру
        graphics.generateTexture(key, 128, 128);
        graphics.destroy();
        
        if (import.meta.env.DEV) {
          console.log(`[BootScene] Generated placeholder for ${key}`);
        }
      }
    });
  }

  /**
   * Quiet asset verification - only logs counts, not per-asset
   */
  private verifyAssetsQuiet(): void {
    // Just check counts, don't log each one
    const unitKeys = UNITS_CATALOG.map(u => u.assetKey);
    const loadedUnits = unitKeys.filter(k => this.textures.exists(k)).length;
    if (import.meta.env.DEV) {
      console.log(`[Boot] Units: ${loadedUnits}/${unitKeys.length}`);
    }
    
    const ballKeys = ['ball_plasma', 'ball_core', 'ball_quantum'];
    const loadedBalls = ballKeys.filter(k => this.textures.exists(k)).length;
    if (import.meta.env.DEV) {
      console.log(`[Boot] Balls: ${loadedBalls}/${ballKeys.length}`);
    }
    
    const cardKeys = getAllCards().map(c => `card_${c.id}`);
    const loadedCards = cardKeys.filter(k => this.textures.exists(k)).length;
    if (import.meta.env.DEV) {
      console.log(`[Boot] Cards: ${loadedCards}/${cardKeys.length}`);
    }
  }

  /**
   * Generate all fallbacks (full coverage for missing textures)
   * Each generator method checks if texture exists before creating
   */
  private generateAllFallbacks(): void {
    // UI Generator
    const uiGenerator = new UIGenerator(this);
    uiGenerator.generateMetalRingTexture();
    uiGenerator.generateAuraTexture();
    uiGenerator.generateSelectedRingTexture();
    uiGenerator.generateScoreboardFallback();
    uiGenerator.generatePortraitFallbacks();
    
    // Tournament assets placeholders
    this.generateTournamentPlaceholders();
    uiGenerator.generateEmotionPortraitFallbacks();
    uiGenerator.generateFactionParticleTextures();

    // Faction Generator
    const factionGenerator = new FactionGenerator(this);
    factionGenerator.generateFactionFallbacks();
    factionGenerator.generateUnitFallbacks();
    factionGenerator.generateArenaFallbacks();
    factionGenerator.generateFactionArtFallbacks();
    factionGenerator.generateFactionUIBackgroundFallbacks();

    // Campaign Generator
    const campaignGenerator = new CampaignGenerator(this);
    campaignGenerator.generateCampaignMapFallbacks();
    campaignGenerator.generateStarFallbacks();
    campaignGenerator.generateCampaignChapterBackgroundFallbacks();
    campaignGenerator.generateBossFallbacks();
  }

  /**
   * Boot sanity check - verify key assets exist (DEV only)
   */
  private bootSanityCheck(): void {
    if (import.meta.env.DEV) {
      console.log('[BootCheck] card_magma_lava:', this.textures.exists('card_magma_lava'));
      console.log('[BootCheck] booster_tactical:', this.textures.exists('booster_tactical'));
      if (UNITS_CATALOG.length > 0) {
        console.log('[BootCheck] sample unit:', this.textures.exists(UNITS_CATALOG[0].assetKey));
      }
      console.log('[BootCheck] ui_home_bg:', this.textures.exists('ui_home_bg'));
    }
  }

  /**
   * ✅ НОВОЕ: Применяет мипмапы к _512 версиям всех юнитов
   * Улучшает качество текстур при масштабировании и динамике
   */
  private applyUnitMipmaps(): void {
    if (import.meta.env.DEV) {
      console.log('[BootScene] Applying mipmaps to HD unit textures...');
    }

    // Импортируем UNITS_REPOSITORY для получения списка всех юнитов
    import('../data/UnitsRepository').then(({ UNITS_REPOSITORY }) => {
      // Динамический импорт TextureConfigurator
      import('../utils/TextureConfigurator').then(({ generateMipmapsForKeys }) => {
        // ✅ FIX: Используем unit.assetKey вместо unit.id, так как текстуры загружаются по assetKey
        const unitKeys = UNITS_REPOSITORY.map(u => `${u.assetKey}_512`);
        generateMipmapsForKeys(this, unitKeys);
        
        if (import.meta.env.DEV) {
          console.log(`[BootScene] ✅ Mipmaps applied to ${unitKeys.length} unit textures`);
        }
      });
    }).catch(err => {
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) {
          console.warn('[BootScene] Failed to apply unit mipmaps:', err);
        }
      }
    });
  }

  private async navigateToNextScene(): Promise<void> {
    console.log('[BootScene] navigateToNextScene() called');
    
    // Защита от повторного вызова
    if (this.navigationStarted) {
      console.warn('[BootScene] Navigation already started, skipping');
      return;
    }
    this.navigationStarted = true;
    console.log('[BootScene] Navigation started, determining target scene...');

    try {
      if (import.meta.env.DEV) {
        console.log('[BootScene] ========== NAVIGATING TO NEXT SCENE ==========');
      }
      
      // ✅ Проверяем, есть ли сохранённое состояние сессии
      const savedSession = SessionPersistence.getRestoredState();
      if (savedSession) {
        if (import.meta.env.DEV) {
          console.log('[BootScene] Found saved session:', savedSession.currentScene);
        }
        
        // Если был прерван матч, показываем сообщение и идём в меню
        if (savedSession.matchState) {
          if (import.meta.env.DEV) {
            console.log('[BootScene] Match was interrupted, going to menu');
          }
          SessionPersistence.clear();
          this.scene.start('MainMenuScene', {
            showMessage: 'Предыдущий матч был прерван',
          });
          // ✅ Скрываем loading screen после запуска сцены
          this.hideLoadingScreenDelayed();
          return;
        }
      }

      const data = playerData.get();

      if (import.meta.env.DEV) {
        console.log('[BootScene] Navigation:', {
          faction: data.selectedFaction,
          profile: data.isProfileSetupComplete,
        });
      }

      if (!data.selectedFaction) {
        if (import.meta.env.DEV) {
          console.log('[BootScene] → FactionSelectScene (dynamic)');
        }
        // ⚡ Динамическая загрузка FactionSelectScene
        const { SceneLoader } = await import('../managers/SceneLoader');
        await SceneLoader.loadAndStart(this, 'FactionSelectScene');
        // ✅ Скрываем loading screen после успешной загрузки
        this.hideLoadingScreenDelayed();
        return;
      }

      if (!data.isProfileSetupComplete) {
        if (import.meta.env.DEV) {
          console.log('[BootScene] → ProfileSetupScene (dynamic)');
        }
        // ⚡ Динамическая загрузка ProfileSetupScene
        const { SceneLoader } = await import('../managers/SceneLoader');
        await SceneLoader.loadAndStart(this, 'ProfileSetupScene');
        // ✅ Скрываем loading screen после успешной загрузки
        this.hideLoadingScreenDelayed();
        return;
      }

      if (import.meta.env.DEV) {
        console.log('[BootScene] → MainMenuScene');
      }
      
      try {
        console.log('[BootScene] Starting MainMenuScene...');
        this.scene.start('MainMenuScene');
        this.hideLoadingScreenDelayed();
      } catch (error) {
        console.error('[BootScene] Failed to start MainMenuScene:', error);
        // Показываем ошибку пользователю
        if (typeof (window as any).updateLoadingProgress === 'function') {
          (window as any).updateLoadingProgress(100, 'Ошибка загрузки. Перезагрузите страницу.');
        }
      }
      
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[BootScene] Navigation error:', error);
      }
      // Fallback
      try {
        this.scene.start('MainMenuScene');
        this.hideLoadingScreenDelayed();
      } catch (fallbackError) {
        if (import.meta.env.DEV) {
          console.error('[BootScene] Critical fallback error:', fallbackError);
        }
        // ✅ Даже при ошибке скрываем loading screen
        this.hideLoadingScreenDelayed();
      }
    }
  }

  // ✅ Новый метод — скрываем loading screen после полного рендера MainMenuScene
  private hideLoadingScreenDelayed(): void {
    // Ждём пока MainMenuScene будет активна и отрендерена
    const maxAttempts = 20; // Максимум 2 секунды (20 * 100ms)
    let attempts = 0;
    
    const checkMainMenuReady = () => {
      attempts++;
      const mainMenuScene = this.scene.get('MainMenuScene');
      
      // Проверяем что сцена существует, активна и имеет хотя бы один дочерний элемент
      if (mainMenuScene && 
          mainMenuScene.scene.isActive() && 
          mainMenuScene.children && 
          mainMenuScene.children.length > 0) {
        
        console.log('[BootScene] MainMenuScene is ready, hiding loading screen');
        
        // Даём ещё немного времени на полный рендер
        this.time.delayedCall(100, () => {
          if (typeof (window as any).hideLoadingScreen === 'function') {
            (window as any).hideLoadingScreen();
          }
        });
      } else if (attempts < maxAttempts) {
        // Повторяем проверку через 100ms
        this.time.delayedCall(100, checkMainMenuReady);
      } else {
        // Fallback: скрываем loading screen после таймаута
        console.warn('[BootScene] MainMenuScene not ready after timeout, forcing hide');
        if (typeof (window as any).hideLoadingScreen === 'function') {
          (window as any).hideLoadingScreen();
        }
      }
    };
    
    // Начинаем проверку через 200ms после старта MainMenuScene
    this.time.delayedCall(200, checkMainMenuReady);
  }

}