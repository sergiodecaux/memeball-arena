// src/scenes/MainMenuScene.ts
// Главное меню — чистый оркестратор компонентов

import Phaser from 'phaser';
import { getColors, hexToString, getFonts } from '../config/themes';
import { playerData } from '../data/PlayerData';
import { i18n } from '../localization/i18n';
import { FACTIONS } from '../constants/gameConstants';
import { AudioManager } from '../managers/AudioManager';
import { OffersManager } from '../data/OffersManager';
import { tgApp } from '../utils/TelegramWebApp';
import { hapticImpact, hapticSelection } from '../utils/Haptics';
import { isWeekend, devToggleWeekend } from '../utils/WeekUtils';
import { devPromoteLeague } from '../utils/DevTestUtils'; // 🧪 DEV TEST: убрать в релизе
import { SeasonManager } from '../managers/SeasonManager';
import { createText, TextPresets } from '../utils/TextFactory';

// UI компоненты
import { MenuBackground } from '../ui/menu/MenuBackground';
import { MenuHeader, MenuHeaderCallbacks } from '../ui/menu/MenuHeader';
import { BottomNav, BottomNavCallbacks } from '../ui/menu/BottomNav';
import { OfferDisplaySystem, OfferDisplayCallbacks } from '../ui/menu/offers/OfferDisplaySystem';
import { MenuModalManager, MenuModalCallbacks } from '../ui/menu/MenuModalManager';
import { TutorialOverlay } from '../ui/game/TutorialOverlay';
import { BattlePassBanner } from '../ui/menu/BattlePassBanner';
import { versionChecker, VersionInfo } from '../utils/VersionChecker';
import { UpdateNotificationOverlay } from '../ui/UpdateNotificationOverlay';
import { globalCleanup } from '../utils/GlobalCleanup';
import { loadImagesBoot, loadImagesMenu } from '../assets/loading/ImageLoader';
import { loadAudioMenu } from '../assets/loading/AudioLoader';

export class MainMenuScene extends Phaser.Scene {
  private s: number = 1;

  // Компоненты UI
  private background?: MenuBackground;
  private header?: MenuHeader;
  private bottomNav?: BottomNav;
  private offerSystem?: OfferDisplaySystem;
  private modalManager?: MenuModalManager;
  private tutorialOverlay?: TutorialOverlay;
  private tourHighlight?: Phaser.GameObjects.Graphics;
  private achievementManager?: any; // AchievementManager
  private battlePassBanner?: BattlePassBanner;
  private updateOverlay?: UpdateNotificationOverlay;

  // Новые контейнеры для блочной структуры
  private mainContainer?: Phaser.GameObjects.Container;
  private uiContainer?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  preload(): void {
    loadImagesBoot(this);
    loadImagesMenu(this);
    loadAudioMenu(this);

    // Локальная подгрузка иконок главного меню (хранятся в public/assets/ui/main)
    this.load.image('icon_repository_sci', 'assets/ui/main/icon_repository_sci.png');
    this.load.image('icon_tasks_sci', 'assets/ui/main/icon_tasks_sci.png');
  }

  shutdown(): void {
    console.log('[MainMenuScene] shutdown');
    this.cleanupScene();
  }

  private cleanupScene(): void {
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.input.removeAllListeners();

    // Останавливаем проверку при выходе из сцены
    versionChecker.stopPeriodicCheck();

    // Важно: сначала удалить крупные контейнеры, чтобы гарантированно очистить UI
    this.mainContainer?.destroy();
    this.uiContainer?.destroy();

    this.background?.destroy();
    this.offerSystem?.destroy();
    this.modalManager?.destroy();
    this.tutorialOverlay?.destroy();
    this.tourHighlight?.destroy();
    this.achievementManager?.destroy();
    this.bottomNav?.destroy();
    this.battlePassBanner?.destroy();

    this.background = undefined;
    this.header = undefined;
    this.bottomNav = undefined;
    this.offerSystem = undefined;
    this.modalManager = undefined;
    this.tutorialOverlay = undefined;
    this.tourHighlight = undefined;
    this.achievementManager = undefined;
    this.battlePassBanner = undefined;
    this.mainContainer = undefined;
    this.uiContainer = undefined;
    // ✅ BUG FIX: dialogueOverlay removed - no longer used
  }

  create(data?: { fromTutorial?: boolean; showMessage?: string }): void {
    console.log('[MainMenuScene] ========== CREATE STARTED ==========');
    console.log('[MainMenuScene] Scene active:', this.scene.isActive());
    console.log('[MainMenuScene] Camera size:', this.cameras.main.width, 'x', this.cameras.main.height);
    console.log('[MainMenuScene] Game size:', this.game.config.width, 'x', this.game.config.height);
    
    // ✅ ДОБАВИТЬ: Очистка старых таймеров при возврате в меню
    // (для случаев soft-перезапуска через "Exit to Menu")
    if (typeof globalCleanup.getActiveCount === 'function') {
      const activeCount = globalCleanup.getActiveCount();
      if (activeCount > 10) { // Если слишком много активных таймеров
        console.log('[MainMenuScene] Cleaning up stale timers, count:', activeCount);
        globalCleanup.cleanup();
      }
    }

    this.cleanupScene();
    this.s = tgApp.getUIScale();

    // 1) Инициализация систем (Logic Layer) — СОХРАНЕНО
    this.initSystems();

    // 2) Инициализация UI-компонентов-оркестраторов (header/nav/modals/offers)
    this.initMenuManagers();

    // 3) Базовый UI: фон
    this.background = new MenuBackground(this);
    this.background.create();
    this.background.startAnimations();

    // 4) Контейнеры для блочной структуры
    this.mainContainer = this.add.container(0, 0).setDepth(5);
    this.uiContainer = this.add.container(0, 0).setDepth(100);

    // 5) Новая верстка (4 зоны)
    this.initHeader();
    this.createHeroSection();
    this.createActionGrid();
    this.createPrimaryZone(); // BattlePass + большая кнопка "В БОЙ" над навигацией
    this.initBottomNav();
    this.createFooter();

    // 6) Post-logic (Офферы, Туториал, обработка data) — СОХРАНЕНО
    OffersManager.generateOffers();
    this.offerSystem?.renderOffersHubButton();
    this.time.delayedCall(800, () => this.offerSystem?.checkAndShowOffer());
    this.handleStartLogic(data);

    // ✅ Запуск проверки обновлений
    versionChecker.startPeriodicCheck((versionInfo: VersionInfo) => {
      this.showUpdateNotification(versionInfo);
    });
    
    console.log('[MainMenuScene] ========== CREATE COMPLETED ==========');
    console.log('[MainMenuScene] Children count:', this.children?.length || 0);

    // Принудительно скрываем loading screen
    if (typeof (window as any).hideLoadingScreen === 'function') {
      (window as any).hideLoadingScreen();
    }
  }

  /**
   * 1) Инициализация систем (Logic Layer) — НЕ УДАЛЯТЬ
   */
  private initSystems(): void {
    // Аудио
    const audio = AudioManager.getInstance();
    audio.init(this);

    // ✅ ДОБАВЛЕНО: Останавливаем любые звуки с предыдущих сцен (включая result win/lose)
    audio.stopAllSounds();

    // ✅ УБРАНО stopAll() — playMusic сам проверит и не перезапустит если уже играет
    audio.playMusic('bgm_menu');

    // ✅ УЛУЧШЕНО: Множественные способы разблокировки
    const unlockAndPlay = () => {
      audio.unlockAudioContext();
      // Убираем слушатели после первого срабатывания
      this.input.off('pointerdown', unlockAndPlay);
      this.input.off('pointerup', unlockAndPlay);
    };
    this.input.on('pointerdown', unlockAndPlay);
    this.input.on('pointerup', unlockAndPlay);

    // ✅ ДОБАВЛЕНО: Также пробуем через таймер (если первый клик был вне Phaser canvas)
    this.time.delayedCall(100, () => {
      if (!audio.isPlaying('bgm_menu')) {
        audio.unlockAudioContext();
      }
    });

    // ✅ Проверка сезонов при запуске
    const playerDataObj = playerData.get();
    SeasonManager.processSeasonEnd(playerDataObj);

    // ✅ Асинхронные импорты закомментированы для отладки
    // TODO: Вернуть после исправления загрузки
    // import('../managers/LevelUpManager').then(({ LevelUpManager }) => {
    //   LevelUpManager.getInstance().setScene(this);
    // });

    // import('../managers/AchievementManager').then(({ AchievementManager }) => {
    //   this.achievementManager = new AchievementManager(this);
    //   this.achievementManager.checkAllAchievements();
    // });

    // import('../data/DailyTasks').then(({ dailyTasksManager }) => {
    //   dailyTasksManager.initialize();
    // });
  }
  
  /**
   * ✅ НОВОЕ: Показать уведомление об обновлении
   */
  private showUpdateNotification(versionInfo: VersionInfo): void {
    // Не показываем повторно если уже открыто
    if (this.updateOverlay) {
      return;
    }
    
    console.log('[MainMenuScene] Showing update notification');
    this.updateOverlay = new UpdateNotificationOverlay(this, versionInfo);
    
    // Очищаем ссылку когда оверлей уничтожен
    this.updateOverlay.once('destroy', () => {
      this.updateOverlay = undefined;
    });
  }

  /**
   * ✅ НОВОЕ: Показать сообщение пользователю
   */
  private showMessage(message: string): void {
    // Можно использовать существующий модальный менеджер или создать простое уведомление
    const { width, height } = this.cameras.main;
    const messageContainer = this.add.container(width / 2, height / 2);
    messageContainer.setDepth(10000);
    
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRoundedRect(-width / 2, -60, width, 120, 16);
    messageContainer.add(bg);
    
    const text = this.add.text(0, 0, message, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ffffff',
      wordWrap: { width: width - 80 },
      align: 'center',
    }).setOrigin(0.5);
    messageContainer.add(text);
    
    // Автоматически скрываем через 3 секунды
    this.time.delayedCall(3000, () => {
      this.tweens.add({
        targets: messageContainer,
        alpha: 0,
        duration: 300,
        onComplete: () => messageContainer.destroy(),
      });
    });
  }

  /**
   * 2) Инициализация UI-оркестраторов (без отрисовки layout)
   */
  private initMenuManagers(): void {
    // Система офферов
    const offerCallbacks: OfferDisplayCallbacks = {
      onOfferClaimed: () => this.scene.restart(),
      onModalClosed: () => {},
    };
    this.offerSystem = new OfferDisplaySystem(this, offerCallbacks);

    // Менеджер модалок
    const modalCallbacks: MenuModalCallbacks = {
      onModeSelected: (mode) => {
        if (mode === 'ai') {
          this.modalManager?.showDifficultySelection();
        } else if (mode === 'campaign') {
          this.safeSceneStart('CampaignSelectScene');
        } else if (mode === 'league') {
          this.safeSceneStart('LeagueScene');
        } else if (mode === 'tournament') {
          this.safeSceneStart('TournamentScene');
        } else {
          this.safeSceneStart('MatchmakingScene');
        }
      },
      onDifficultySelected: (difficulty) => {
        this.safeSceneStart('GameScene', { vsAI: true, difficulty });
      },
      onLanguageSelected: () => this.scene.restart(),
      onFactionSwitched: () => this.scene.restart(),
      onModalClosed: () => {},
    };
    this.modalManager = new MenuModalManager(this, modalCallbacks);

    // Хедер
    const headerCallbacks: MenuHeaderCallbacks = {
      onProfileClick: () => this.safeSceneStart('ProfileScene'),
      onSettingsClick: () => this.safeSceneStart('SettingsScene'),
      onFactionSwitchClick: () => this.modalManager?.showFactionSwitchModal(),
      // =====================================================
      // 🧪 DEV TEST: Добавление валюты - УДАЛИТЬ ПЕРЕД РЕЛИЗОМ!
      // =====================================================
      onAddCurrencyClick: () => {
        playerData.addCoins(1000);
        this.scene.restart();
      },
      onAddCrystalsClick: () => {
        const data = playerData.get();
        data.crystals += 500;
        playerData.save();
        this.scene.restart();
      },
      // =====================================================
      // 🧪 DEV TEST: Тестирование лиги и турниров - УДАЛИТЬ ПЕРЕД РЕЛИЗОМ!
      // =====================================================
      onDevPromoteLeague: () => {
        devPromoteLeague();
        this.scene.restart();
      },
      onDevToggleWeekend: () => {
        const isWeekendNow = devToggleWeekend();
        this.scene.restart();
      },
      // =====================================================
    };
    this.header = new MenuHeader(this, headerCallbacks);

    // Нижняя навигация
    const navCallbacks: BottomNavCallbacks = {
      onNavigate: (scene) => {
        if (scene) {
          this.safeSceneStart(scene);
        }
      },
    };
    this.bottomNav = new BottomNav(this, 'home', navCallbacks);
  }

  private initHeader(): void {
    this.header?.create();
  }

  private initBottomNav(): void {
    this.bottomNav?.create();
  }

  /**
   * 6) Post-logic (первый запуск / тур / сообщения) — СОХРАНИТЬ ЛОГИКУ
   */
  private handleStartLogic(data?: { fromTutorial?: boolean; showMessage?: string }): void {
    // Первый запуск — выбор языка
    if (i18n.isFirstLaunch()) {
      this.time.delayedCall(300, () => {
        this.modalManager?.showLanguageSelection(true);
      });
    }

    // ✅ BUG FIX: Removed tutorial onboarding dialogue - user requested removal
    // Tutorial onboarding dialogue removed

    // ✅ Post-win tutorial tour: Check if we should start the menu tour
    if (playerData.shouldRunPostWinMenuTour() && playerData.getPostWinMenuTourStep() === 'menu') {
      this.time.delayedCall(1000, () => {
        this.startMenuTour();
      });
    }

    // ✅ НОВОЕ: Показываем сообщение о прерванном матче, если есть
    if (data?.showMessage) {
      this.time.delayedCall(500, () => {
        this.showMessage(data.showMessage as string);
      });
    }
  }

  /**
   * Создаёт интерактивную зону с ТОЧНЫМИ границами (без растягивания)
   */
  private setExactHitArea(
    container: Phaser.GameObjects.Container,
    width: number,
    height: number,
    useHandCursor: boolean = true
  ): void {
    container.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, width, height),
      Phaser.Geom.Rectangle.Contains
    );

    if (useHandCursor) {
      container.input!.cursor = 'pointer';
    }
  }

  private async safeSceneStart(sceneKey: string, data?: object): Promise<void> {
    // ✅ Post-win tour: Intercept shop navigation to set tour step
    if (sceneKey === 'ShopScene' && playerData.getPostWinMenuTourStep() === 'menu') {
      this.tourHighlight?.destroy();
      this.tutorialOverlay?.hide();
      playerData.setPostWinMenuTourStep('shop');
    }
    
    this.cleanupScene();
    this.scene.stop('MainMenuScene');
    
    // ⚡ Динамическая загрузка сцен
    const { safeSceneStart: startScene } = await import('../utils/SceneHelpers');
    await startScene(this, sceneKey, data);
  }
  
  // 🧪 TEST: Кнопки для тестирования (убрать в релизе)
  // ✅ УДАЛЕНО: createTestButtons() - заменен на DEV панель в MenuHeader

  // ================= CENTER SECTION =================

  private createHeroSection(): void {
    const { width } = this.cameras.main;
    const topInset = tgApp.getTopInset();
    const s = this.s;
    
    // Чуть опускаем логотип, чтобы он не прилипал к хедеру
    const startY = topInset + 130 * s;

    const container = this.add.container(width / 2, startY);
    this.mainContainer?.add(container);

    // --- ЛОГОТИП ---
    const title = createText(this, 0, 0, 'GALAXY\nLEAGUE', {
      font: 'tech',
      size: 'hero', // Используем самый большой пресет
      color: '#ffffff',
    });
    
    // Ручное переопределение размера для массивности
    title.setFontSize(54 * s); 
    title.setOrigin(0.5);
    title.setAlign('center');
    title.setLineSpacing(-10 * s);
    title.setStyle({ fontStyle: '900' }); // Extra Bold

    // Неоновая обводка и мощная тень
    title.setStroke('#00f2ff', 3);
    title.setShadow(0, 0, 'rgba(0, 242, 255, 0.8)', 32, true, true);
    
    container.add(title);

    // Анимация "дыхания" логотипа
    this.tweens.add({
        targets: title,
        scale: 1.03,
        duration: 4000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });

    // --- БЕЙДЖ СЕЗОНА ---
    // Располагаем под логотипом
    const badgeY = title.height * 0.85 + 10 * s;
    const seasonW = 120 * s;
    const seasonH = 28 * s;

    const badgeBg = this.add.graphics();
    badgeBg.fillStyle(0x000000, 0.7);
    badgeBg.fillRoundedRect(-seasonW / 2, badgeY - seasonH / 2, seasonW, seasonH, 14 * s);
    // Золотая обводка
    badgeBg.lineStyle(1, 0xffd700, 1);
    badgeBg.strokeRoundedRect(-seasonW / 2, badgeY - seasonH / 2, seasonW, seasonH, 14 * s);
    container.add(badgeBg);

    // Текст: Сезон 1
    const seasonText = createText(this, 0, badgeY, `${i18n.t('season')} 1`, {
      size: 'sm',
      font: 'tech',
      color: '#ffd700',
    }).setOrigin(0.5);
    
    // Убедимся, что текст читаемый
    seasonText.setFontSize(16 * s);
    seasonText.setShadow(0, 1, '#000000', 2, false, true);
    
    container.add(seasonText);
  }

  private createActionGrid(): void {
    const { width, height } = this.cameras.main;
    const s = this.s;
    const gridY = height * 0.38; // Центр свободной зоны

    const container = this.add.container(width / 2, gridY);
    this.mainContainer?.add(container);

    const btnSize = 80 * s;
    const gap = 20 * s;

    // Кнопка ЗАДАЧИ (слева)
    this.createCircularActionButton(
      container,
      -btnSize / 1.5 - gap,
      0,
      btnSize,
      'ЗАДАЧИ',
      0x22c55e,
      'icon_tasks_sci',
      () => this.safeSceneStart('QuestsScene')
    );

    // Кнопка КОЛЛЕКЦИЯ (справа)
    this.createCircularActionButton(
      container,
      btnSize / 1.5 + gap,
      0,
      btnSize,
      'КОЛЛЕКЦИЯ',
      0x00f2ff,
      'icon_repository_sci',
      () => this.safeSceneStart('CollectionScene')
    );
  }

  private createCircularActionButton(
    parent: Phaser.GameObjects.Container,
    x: number,
    y: number,
    size: number,
    label: string,
    color: number,
    iconKey: string,
    onClick: () => void
  ): void {
    const s = this.s;
    const btn = this.add.container(x, y);
    parent.add(btn);

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a1f, 0.8);
    bg.fillRoundedRect(-size / 2, -size / 2, size, size, 16 * s);
    bg.lineStyle(1, color, 0.6);
    bg.strokeRoundedRect(-size / 2, -size / 2, size, size, 16 * s);
    btn.add(bg);

    if (this.textures.exists(iconKey)) {
      const icon = this.add.image(0, -5 * s, iconKey);
      icon.setDisplaySize(size * 0.5, size * 0.5);
      btn.add(icon);
    } else {
      btn.add(this.add.circle(0, -5 * s, size * 0.2, color, 0.3));
    }

    const text = createText(this, 0, size / 2 - 12 * s, label, {
      size: 'xs',
      font: 'tech',
      color: '#ffffff',
    }).setOrigin(0.5);
    if (label.length > 8) text.setScale(0.8);
    btn.add(text);

    btn.setInteractive(
      new Phaser.Geom.Rectangle(-size / 2, -size / 2, size, size),
      Phaser.Geom.Rectangle.Contains
    );
    btn.on('pointerdown', () => {
      AudioManager.getInstance().playUIClick();
      hapticSelection();
      this.tweens.add({ targets: btn, scale: 0.95, duration: 50, yoyo: true });
      onClick();
    });
  }

  private createPrimaryZone(): void {
    const { width, height } = this.cameras.main;
    const s = this.s;
    const bottomInset = tgApp.getSafeAreaInset().bottom;
    const navHeight = 72 * s + bottomInset;

    // 1. Сначала размещаем Battle Pass (Якорь - низ экрана над навигацией)
    // Отступ от навигации 10px
    const bpHeight = 90 * s;
    const bpWidth = Math.min(width - 32 * s, 340 * s);
    const bpY = height - navHeight - bpHeight / 2 - 15 * s;

    this.battlePassBanner = new BattlePassBanner(
      this,
      width / 2,
      bpY,
      bpWidth,
      bpHeight,
      s,
      () => this.safeSceneStart('BattlePassScene')
    );
    this.battlePassBanner.create();

    // Добавляем в контейнер
    const bpContainer = (this.battlePassBanner as any).container as Phaser.GameObjects.Container | undefined;
    if (bpContainer) {
      this.mainContainer?.add(bpContainer);
    }

    // 2. Кнопка МАТЧ (Размещаем НАД Battle Pass)
    const btnH = 76 * s; // Высокая, удобная кнопка
    const btnW = Math.min(width - 40 * s, 320 * s);
    // Отступ вверх от Battle Pass (25px)
    const btnY = bpY - (bpHeight / 2) - (btnH / 2) - 25 * s;

    const playContainer = this.add.container(width / 2, btnY);
    this.mainContainer?.add(playContainer);

    // --- Визуал кнопки ---

    // 1. Внешнее свечение (Glow)
    const glow = this.add.graphics();
    glow.fillStyle(0x00f2ff, 0.3);
    glow.fillRoundedRect(-btnW / 2 - 4, -btnH / 2 - 4, btnW + 8, btnH + 8, 24 * s);
    playContainer.add(glow);

    // 2. Основной фон (Градиент)
    const bg = this.add.graphics();
    // Яркий Cyberpunk градиент (Cyan -> Blue)
    bg.fillGradientStyle(0x00f2ff, 0x00f2ff, 0x2255ff, 0x2255ff, 1);
    bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 20 * s);
    playContainer.add(bg);

    // 3. Стеклянный блик сверху (для объема)
    const shine = this.add.graphics();
    shine.fillStyle(0xffffff, 0.15);
    shine.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH / 2, { tl: 20 * s, tr: 20 * s, bl: 0, br: 0 });
    playContainer.add(shine);

    // 4. Обводка (Stroke)
    const stroke = this.add.graphics();
    stroke.lineStyle(2, 0xaaddff, 0.8);
    stroke.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 20 * s);
    playContainer.add(stroke);

    // --- Текст и Иконка ---

    // Иконка мечей (если есть), если нет - не упадет
    if (this.textures.exists('ui_match_primary')) {
      const icon = this.add.image(-50 * s, 0, 'ui_match_primary');
      icon.setDisplaySize(36 * s, 36 * s);
      icon.setTint(0x001133); // Темно-синий тинт для контраста на яркой кнопке
      playContainer.add(icon);
    }

    const label = createText(this, 10 * s, 0, 'МАТЧ', {
      size: 'xl', // Крупный шрифт
      font: 'tech',
      color: '#001133', // Темный текст на яркой кнопке читается лучше
    }).setOrigin(0.5);
    label.setStyle({ fontStyle: '900' }); // Extra Bold
    playContainer.add(label);

    // --- Анимация ---

    // Пульсация всей кнопки (Призыв к действию)
    this.tweens.add({
      targets: playContainer,
      scale: 1.03,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Пульсация свечения (отдельно, быстрее)
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.2, to: 0.5 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // --- Интерактив ---
    playContainer.setInteractive(
      new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH),
      Phaser.Geom.Rectangle.Contains
    );

    playContainer.on('pointerdown', () => {
      AudioManager.getInstance().playUIClick();
      hapticImpact('heavy');
      this.tweens.add({ targets: playContainer, scale: 0.95, duration: 80, yoyo: true });
    });

    playContainer.on('pointerup', () => {
      this.safeSceneStart('MatchModeSelectScene');
    });
  }


  // ================= POST-WIN TOUR =================

  private startMenuTour(): void {
    if (!this.bottomNav) return;

    // Create tutorial overlay
    this.tutorialOverlay = new TutorialOverlay(this, true);
    this.add.existing(this.tutorialOverlay);

    // Highlight shop button
    const shopContainer = this.bottomNav.getNavItemContainer('shop');
    const shopHit = this.bottomNav.getNavItemHit('shop');
    
    if (shopHit) {
      const bounds = shopHit.getBounds();
      this.tourHighlight = this.add.graphics();
      this.tourHighlight.lineStyle(3, 0x00f2ff, 1);
      this.tourHighlight.strokeRoundedRect(bounds.x - 5, bounds.y - 5, bounds.width + 10, bounds.height + 10, 12);
      this.tourHighlight.setDepth(101);
      
      // Pulse animation
      this.tweens.add({
        targets: this.tourHighlight,
        alpha: { from: 0.5, to: 1 },
        duration: 800,
        yoyo: true,
        repeat: -1,
      });
    }

    // Show message and intercept shop navigation
    this.tutorialOverlay.showMessage(
      'Это главное меню. Используй нижнюю навигацию. Нажми на "Магазин".',
      () => {
        // Navigation is intercepted via safeSceneStart override (shop navigation sets tour step)
        console.log('[MainMenuTour] Waiting for shop navigation...');
      }
    );
  }

  // ================= FOOTER =================

  private createFooter(): void {
    const { width, height } = this.cameras.main;
    const s = this.s;
    const bottomInset = tgApp.getSafeAreaInset().bottom;
    const navHeight = 72 * s + bottomInset;
    const y = height - navHeight - 8 * s;

    // ✅ ИСПРАВЛЕНО: Используем TextFactory для чётких шрифтов
    createText(this, Math.round(12 * s), Math.round(y), 'v0.9.0-galaxy', {
      size: 'xs',
      font: 'primary',
      color: '#333344',
    }).setDepth(80).setOrigin(0, 1);
  }
}