// src/scenes/GameScene.ts
// вњ… РР—РњР•РќР•РќРћ: РСЃРїСЂР°РІР»РµРЅ Р±Р°Рі СЃ С‚Р°Р№РјРµСЂРѕРј - РґРѕР±Р°РІР»РµРЅРѕ РїРѕР»Рµ matchDuration, РёСЃРїСЂР°РІР»РµРЅ getState()

import Phaser from 'phaser';
import { GAME, GOAL, FactionId, LASSO_CONFIG } from '../constants/gameConstants';
import { isCaptainUnitId } from '../constants/captains';
import { FieldBounds, PlayerNumber, AIDifficulty } from '../types';
import { Unit } from '../entities/Unit';
import { Ball } from '../entities/Ball';
import { FieldRenderer } from '../renderers/FieldRenderer';
import { VFXManager } from '../managers/VFXManager';
import { AudioManager } from '../managers/AudioManager';
import { AnnouncerManager } from '../managers/AnnouncerManager';
import { MultiplayerManager } from '../managers/MultiplayerManager';
import { PvPIntegrationHelper } from '../managers/PvPIntegrationHelper';
import { DEFAULT_PVP_CONFIG } from '../types/pvp';
import { playerData } from '../data/PlayerData';
import { dailyTasksManager } from '../data/DailyTasks';
import { createText } from '../utils/TextFactory';

// Core
import { eventBus, GameEvents, HapticFeedbackPayload } from '../core/EventBus';
import { MatchStateMachine, MatchPhase } from '../core/MatchStateMachine';

// Controllers
import { MatchDirector } from '../controllers/match/MatchDirector';
import { ShootingController, ShootEventData } from '../controllers/ShootingController';
import { AIController } from '../ai/AIController';
import type { AIMatchContext } from '../ai/MatchContext';
import type { AIOpponentProfile } from '../ai/AIProfile';

// Game modules
import { GameSceneSetup, GameSceneSetupResult } from './game/GameSceneSetup';
import { GameSceneData, GameUnit, StartPositions } from './game/types';
import { AbilityManager } from './game/AbilityManager';
import { CelebrationManager } from './game/CelebrationManager';
import { CollisionHandler } from './game/CollisionHandler';
import { HapticManager } from './game/HapticManager';
import { PassiveManager } from '../systems/PassiveManager';
import { CaptainMatchSystem } from '../systems/CaptainMatchSystem';
import { LevelConfig, ChapterConfig } from '../types/CampaignTypes';
import { CampaignDialogueSystem } from '../managers/CampaignDialogueSystem';
import { CARD_TEXT_RU, UI_RU, getTargetHintRU } from '../localization/cardTexts';
import { getCard, CardDefinition, CardTargetType } from '../data/CardsCatalog';

// UI
import { GameHUD } from '../ui/game/GameHUD';
import { NetworkStatusIndicator } from '../ui/game/NetworkStatusIndicator';
import { ReconnectionOverlay } from '../ui/game/ReconnectionOverlay';
import { PauseMenu } from '../ui/game/PauseMenu';
import { FormationMenu } from '../ui/game/FormationMenu';
import { ResultScreen } from '../ui/game/ResultScreen';
import { SessionPersistence } from '../utils/SessionPersistence';
import { InGameSettings } from '../ui/game/InGameSettings';
import { MatchIntroOverlay } from '../ui/game/MatchIntroOverlay';
import { AbilityButton } from '../ui/game/AbilityButton';
import { LassoButton } from '../ui/game/LassoButton';
import { LassoController } from './game/LassoController';
import { TutorialOverlay } from '../ui/game/TutorialOverlay';
import { LeagueManager } from '../managers/LeagueManager';
import { LeagueTier } from '../types/league';
import { battlePassManager } from '../managers/BattlePassManager';
import { TournamentManager } from '../managers/TournamentManager';
import { MatchContext } from './game/types';
import type { BracketStage } from '../types/tournament';
import { FallbackManager } from '../assets/fallback/FallbackManager';

import { MatchResult } from '../types/MatchResult';
import { logInfo, logWarn, logError } from '../utils/ProductionLogger';
import { safeSceneStart } from '../utils/SceneHelpers';
import { generateHumanLikeOpponentNickname } from '../utils/humanLikeNickname';
import { TutorialManager } from '../tutorial/TutorialManager';
import { TutorialStep } from '../tutorial/TutorialSteps';
import { AppLifecycle } from '../utils/AppLifecycle';

export class GameScene extends Phaser.Scene {
  // === РЎРѕСЃС‚РѕСЏРЅРёРµ (РјРёРЅРёРјР°Р»СЊРЅРѕРµ) ===
  private isInitialized = false;
  private fieldBounds!: FieldBounds;
  private startPositions!: StartPositions;

  // === РЎРѕС…СЂР°РЅС‘РЅРЅС‹Рµ С„СЂР°РєС†РёРё ===
  private storedPlayerFaction?: FactionId;
  private storedOpponentFaction?: FactionId;
  
  // ✅ NEW: Флаг пропуска интро (если пришли из MatchVSScene)
  private skipIntro: boolean = false;

  // вњ… Р"РћР'РђР'Р›Р•РќРћ: РЎРѕС…СЂР°РЅС'РЅРЅР°СЏ РґР»РёС‚РµР»СЊРЅРѕСЃС‚СЊ РјР°С‚С‡Р° (РЅРµ Р·Р°РІРёСЃРёС‚ РѕС‚ РѕСЃС‚Р°С‚РєР° РІСЂРµРјРµРЅРё)
  private matchDuration: number = GAME.DEFAULT_MATCH_DURATION;
  
  // ✅ NEW PVP: Новая система реального PVP (через PvPManager)
  private pvpHelper?: PvPIntegrationHelper;
  private isRealtimePvP: boolean = false; // Новая система (отличается от старой isPvPMode)
  
  // ✅ FIX: Флаг для защиты от повторной обработки гола
  private isProcessingGoal: boolean = false;

  // === РЎСѓС‰РЅРѕСЃС‚Рё ===
  private ball!: Ball;
  private caps: GameUnit[] = [];

  // === Р“Р»Р°РІРЅС‹Р№ РѕСЂРєРµСЃС‚СЂР°С‚РѕСЂ РјР°С‚С‡Р° ===
  private matchDirector!: MatchDirector;

  // === РљРѕРЅС‚СЂРѕР»Р»РµСЂС‹ ===
  private shootingController!: ShootingController;
  private captainMatchSystem?: CaptainMatchSystem;
  private captainSuperPanel?: Phaser.GameObjects.Container;
  private captainSuperEnergyGfx?: Phaser.GameObjects.Graphics;
  private captainSuperLastReady = false;
  private aiController?: AIController;

  // === РњРµРЅРµРґР¶РµСЂС‹ ===
  private vfxManager!: VFXManager;
  private abilityManager!: AbilityManager;
  private player2AbilityManager?: AbilityManager;
  private celebrationManager!: CelebrationManager;
  private collisionHandler!: CollisionHandler;
  private announcer!: AnnouncerManager;
  private campaignDialogue?: CampaignDialogueSystem;
  private fieldRenderer!: FieldRenderer;
  private passiveManager!: PassiveManager;
  private achievementManager?: any; // AchievementManager
  // OLD: private pvpSync - removed, using PvPSyncManager inside pvpHelper
  // OLD: private networkIndicator - removed
  // OLD: private reconnectionOverlay - removed
  // OLD: private isPausedForReconnect - removed

  // === UI ===
  private gameHUD!: GameHUD;
  private pauseMenu?: PauseMenu;
  private formationMenu?: FormationMenu;
  private resultScreen?: ResultScreen;
  private inGameSettings?: InGameSettings;
  private matchIntroOverlay?: MatchIntroOverlay;
  private abilityButton!: AbilityButton;
  private lassoController: LassoController | null = null;
  private lassoButton: LassoButton | null = null;
  private tutorialOverlay!: TutorialOverlay;
  private devOverlay?: import('../ui/DevStabilityOverlay').DevStabilityOverlay;
  
  // вњ… Р"РћР'РђР'Р›Р•РќРћ: Р¤Р»Р°Рі РґР»СЏ РїСЂРµРґРѕС‚РІСЂР°С‰РµРЅРёСЏ РјРЅРѕР¶РµСЃС‚РІРµРЅРЅРѕРіРѕ СЃРѕР·РґР°РЅРёСЏ ResultScreen
  private isResultShown: boolean = false;
  
  // === Card UI ===
  private cardPanel?: Phaser.GameObjects.Container;
  private cooldownText?: Phaser.GameObjects.Text;
  private cooldownTimer?: Phaser.Time.TimerEvent;
  private selectedCardSlotIndex: number | null = null;
  private cardInfoPopup?: Phaser.GameObjects.Container;
  private isCardTooltipOpen: boolean = false; // вњ… Task C: Track if tooltip/long-press is active

  // ===== CARD PANEL CONSTANTS =====
  private readonly CARD_SLOT_WIDTH = 70;
  private readonly CARD_SLOT_HEIGHT = 105; // Пропорции 600:900 = 2:3
  private readonly CARD_SPACING = 12;
  private readonly CARD_PANEL_Y_OFFSET = 90; // Отступ от нижнего края экрана
  /** Компактная панель SUPER капитана (правый нижний угол, ниже ряда карт) */
  private readonly CAPTAIN_SUPER_PANEL_W = 100;
  private readonly CAPTAIN_SUPER_PANEL_H = 46;
  private readonly CAPTAIN_SUPER_BOTTOM_MARGIN = 16;
  private readonly LONG_PRESS_DELAY = 400; // Миллисекунды для долгого нажатия
  private readonly ENLARGED_CARD_SCALE = 0.85; // Увеличенная карта занимает 85% высоты экрана

  // ===== CARD PANEL STATE =====
  private enlargedCardContainer?: Phaser.GameObjects.Container;
  private isCardEnlarged: boolean = false;
  private longPressTimers: Map<number, Phaser.Time.TimerEvent> = new Map();
  
  // === Event Handlers ===
  private eventHandlers: Map<string, Function> = new Map();

  /** Лента подсказок по пассивкам (экранные координаты) */
  private passiveHudToast?: Phaser.GameObjects.Container;
  private lastPassiveHudHapticAt = 0;

  // === Р РµР¶РёРј ===
  private isCampaignMode = false;
  private campaignLevelConfig?: LevelConfig;
  private campaignChapterConfig?: ChapterConfig;

  // === PvP (OLD - will be removed) ===
  // Старые переменные оставлены для обратной совместимости, но не используются
  private isHost = false;
  private myPlayerIndex: number = 0;

  // === League & Tournament ===
  private matchContext: MatchContext = 'casual';
  private tournamentId?: string;
  private seriesId?: string;
  private round?: string;
  private majorAbilityBonus = false;
  private aimAssistDisabled = false;
  
  // ✅ Данные для передачи в LeagueScene после матча
  private leagueResultData?: {
    oldStars: number;
    oldTier: LeagueTier;
    oldDivision: number;
    matchResult: 'win' | 'loss' | 'draw';
    showOrbitDecay: boolean;
  };
  private opponentName?: string; // РРјСЏ СЃРѕРїРµСЂРЅРёРєР° (РґР»СЏ РјР°СЃРєРёСЂРѕРІРєРё Р±РѕС‚РѕРІ РІ Р»РёРіРµ)
  private opponentAvatarId?: string; // вњ… РќРћР’РћР•: РђРІР°С‚Р°СЂ СЃРѕРїРµСЂРЅРёРєР° (РґР»СЏ РєРѕРЅСЃРёСЃС‚РµРЅС‚РЅРѕСЃС‚Рё)

  private get isDisguisedPvPBotMatch(): boolean {
    return (
      (this.matchContext === 'ranked' || this.matchContext === 'casual') &&
      this.isAIEnabled &&
      !this.isRealtimePvP
    );
  }

  private get hudShowsAiBranding(): boolean {
    return this.isAIEnabled && !this.isDisguisedPvPBotMatch;
  }

  private get hudTreatAsNetworkPvP(): boolean {
    return this.isRealtimePvP || this.isDisguisedPvPBotMatch;
  }

  // === AI ===
  private isAIEnabled = false;
  private aiTurnScheduled = false;
  private lastSyncedAIFormationId?: string;
  /** Сложность матча из GameSceneSetup (лига/кастом/кампания), не только кампания */
  private matchAIDifficulty: AIDifficulty = 'medium';
  private aiOpponentProfile?: AIOpponentProfile;

  // === Р’РЅСѓС‚СЂРµРЅРЅРёРµ С„Р»Р°РіРё ===
  private lastShootingCap?: GameUnit;
  private selectedCapId?: string;
  
  // вњ… Р"РћР'РђР'Р›Р•РќРћ: Р¤Р»Р°Рі Р±Р»РѕРєРёСЂРѕРІРєРё РІРІРѕРґР° РІРѕ РІСЂРµРјСЏ СЃРїРѕСЃРѕР±РЅРѕСЃС‚Рё
  private isAbilityInputActive = false;

  // Tutorial system
  private isTutorialMode: boolean = false;
  private tutorialStep?: TutorialStep;
  private tutorialManager?: TutorialManager;

  // === Lifecycle handlers ===
  private wasBackgrounded: boolean = false;
  private backgroundedAt: number = 0;
  private lifecyclePauseCallback?: () => void;
  private lifecycleResumeCallback?: () => void;

  constructor() {
    super({ key: 'GameScene' });
  }

  // ============================================================
  // LIFECYCLE
  // ============================================================

  /**
   * Настройка обработчиков lifecycle для корректной работы при сворачивании/разворачивании
   */
  private setupLifecycleHandlers(): void {
    const lifecycle = AppLifecycle.getInstance();
    
    // ✅ Сохраняем ссылки для корректной отписки
    this.lifecyclePauseCallback = () => {
      // ✅ Проверяем что сцена активна и не была уже приостановлена
      if (!this.isInitialized || this.wasBackgrounded) return;
      
      this.wasBackgrounded = true;
      this.backgroundedAt = Date.now();
      console.log('[GameScene] App backgrounded - pausing game');
      
      // Ставим игру на паузу (pause() безопасен для повторных вызовов)
      if (this.matchDirector) {
        this.matchDirector.pause();
      }
      
      // ✅ Используем встроенный Phaser API для паузы звуков
      if (this.sound && typeof this.sound.pauseAll === 'function') {
        this.sound.pauseAll();
      }
    };
    
    this.lifecycleResumeCallback = () => {
      if (!this.wasBackgrounded) return;
      
      const backgroundDuration = Date.now() - this.backgroundedAt;
      console.log('[GameScene] App resumed after', backgroundDuration, 'ms');
      
      this.wasBackgrounded = false;
      
      // Если был в фоне больше 30 секунд - возвращаемся в меню
      if (backgroundDuration > 30000) {
        console.log('[GameScene] Too long in background, returning to menu');
        this.handleMatchInterruption('Матч был прерван из-за длительного бездействия');
        return;
      }
      
      // ✅ Используем встроенный Phaser API для возобновления звуков
      if (this.sound && typeof this.sound.resumeAll === 'function') {
        this.sound.resumeAll();
      }
      
      // Показываем меню паузы только если его ещё нет
      if (!this.pauseMenu && this.isInitialized) {
        this.showPauseMenu();
      }
    };
    
    lifecycle.onPause(this.lifecyclePauseCallback);
    lifecycle.onResume(this.lifecycleResumeCallback);
  }

  /**
   * Обработка прерывания матча (возврат в меню)
   */
  private handleMatchInterruption(message: string): void {
    console.log('[GameScene] Match interrupted:', message);
    
    // Останавливаем матч
    if (this.matchDirector) {
      this.matchDirector.pause();
    }
    
    // Возвращаемся в меню
    this.scene.start('MainMenuScene', {
      showMessage: message,
    });
  }

  init(data?: GameSceneData): void {
    // #region agent log
    logInfo('GameScene', 'GameScene.init ENTRY',{hasData:!!data,matchContext:data?.matchContext,isAI:data?.isAI,playerFaction:data?.playerFaction,opponentFaction:data?.opponentFaction,teamSize:data?.teamSize,isPvP:data?.isPvP,hasPvpData:!!data?.pvpData,skipIntro:data?.skipIntro});
    // ✅ REMOVED: fetch запросы для логирования - используем ProductionLogger
    // #endregion
    this.isInitialized = false;
    this.lastShootingCap = undefined;
    this.selectedCapId = undefined;
    this.aiTurnScheduled = false;
    this.lastSyncedAIFormationId = undefined;
    this.matchAIDifficulty = 'medium';
    this.aiOpponentProfile = undefined;
    this.isAbilityInputActive = false;
    
    // ✅ NEW: Поддержка skipIntro (если пришли из MatchVSScene)
    this.skipIntro = (data as any)?.skipIntro || false;

    // ✅ NEW PVP: Определяем режим PVP
    // Поддерживаем оба варианта входа: data.isPvP (старый) и data.mode === 'pvp' (новый)
    if (data?.isPvP === true || data?.mode === 'pvp') {
      this.isRealtimePvP = true;
      console.log(`[GameScene] init(): PVP mode activated`);
      
      // Создаём PVP helper
      this.pvpHelper = new PvPIntegrationHelper(this, {
        serverUrl: DEFAULT_PVP_CONFIG.serverUrl,
        isEnabled: true,
      });
    }
    if (data?.matchContext) {
      this.matchContext = data.matchContext;
      console.log(`[GameScene] init(): matchContext set to ${this.matchContext}`);
    }

    // вњ… Р”РћР‘РђР’Р›Р•РќРћ: РЎР±СЂРѕСЃ matchDuration РїСЂРё РЅРѕРІРѕР№ РёРЅРёС†РёР°Р»РёР·Р°С†РёРё СЃС†РµРЅС‹
    this.matchDuration = GAME.DEFAULT_MATCH_DURATION;

    // вњ… Р”РћР‘РђР’Р›Р•РќРћ: РЎРѕС…СЂР°РЅСЏРµРј opponentName Рё opponentAvatarId РёР· data
    if (data?.opponentName) {
      this.opponentName = data.opponentName;
      console.log(`[GameScene] init(): opponentName set to "${this.opponentName}"`);
    }
    if (data?.opponentAvatarId) {
      this.opponentAvatarId = data.opponentAvatarId;
      console.log(`[GameScene] init(): opponentAvatarId set to "${this.opponentAvatarId}"`);
    }

    this.pauseMenu = undefined;
    this.formationMenu = undefined;
    this.resultScreen = undefined;
    this.inGameSettings = undefined;
    this.matchIntroOverlay = undefined;
    this.cardPanel = undefined;
    this.cooldownText = undefined;
    this.cooldownTimer = undefined;

    // Tutorial mode
    if (data?.isTutorialMode) {
      this.isTutorialMode = true;
      this.tutorialStep = data.tutorialStep as TutorialStep || TutorialStep.INTRO;
      console.log(`[GameScene] init(): Tutorial mode, step: ${this.tutorialStep}`);
    }
  }

  preload(): void {
    // Assets already loaded in Boot, nothing to do
  }

  create(data?: GameSceneData): void {
    // Сохраняем data для использования в onSetupComplete
    (this as any).__setupData = data;
    // #region agent log
    logInfo('GameScene', 'GameScene.create ENTRY',{hasData:!!data,matchContext:data?.matchContext,playerFaction:data?.playerFaction,opponentFaction:data?.opponentFaction});
    // ✅ REMOVED: fetch запросы для логирования - используем ProductionLogger
    // #endregion
    // вњ… Р”РћР‘РђР’Р›Р•РќРћ: РЎР±СЂРѕСЃ С„Р»Р°РіР° РґР»СЏ ResultScreen РїСЂРё СЃРѕР·РґР°РЅРёРё РЅРѕРІРѕР№ СЃС†РµРЅС‹
    this.isResultShown = false;

    // ✅ Инициализируем менеджеры событий ДО начала матча
    // (важно для real-time прогресса daily/weekly и Battle Pass XP)
    // (moved ниже: после GameSceneSetup.initialize(), т.к. внутри него вызывается eventBus.clear())
    
    // вњ… FIX 2026-01-23: РЈР±СЂР°РЅР° РґРёРЅР°РјРёС‡РµСЃРєР°СЏ Р·Р°РіСЂСѓР·РєР° С‚РµРєСЃС‚СѓСЂ
    // Р’СЃРµ С‚РµРєСЃС‚СѓСЂС‹ СѓР¶Рµ Р·Р°РіСЂСѓР¶РµРЅС‹ РІ BootScene Рё РѕСЃС‚Р°СЋС‚СЃСЏ РІ РїР°РјСЏС‚Рё
    // Р­С‚Рѕ СЃС‚Р°Р±РёР»СЊРЅР°СЏ СЃС‚СЂР°С‚РµРіРёСЏ РёР· СЃС‚Р°СЂРѕР№ РІРµСЂСЃРёРё Р±РµР· РІС‹Р»РµС‚РѕРІ
    
    // Lightweight fallbacks only. Unit PNGs are loaded explicitly before match start,
    // so generating 80+ repository canvas fallbacks here would just add jank.
    const fallbackManager = new FallbackManager(this);
    fallbackManager.ensureFactionFallbacks();
    
    // рџ”Ґ TUTORIAL OVERHAUL: Dynamic Faction Logic
    // This must happen BEFORE GameSceneSetup is called
    if (this.isLevel1_1(data)) {
      const playerFaction = playerData.getFaction() || 'magma';
      // Counter-faction logic
      const opponentFaction = playerFaction === 'magma' ? 'cyborg' : 'magma';
      
      console.log(`[GameScene] рџЋ“ Tutorial Setup: Player(${playerFaction}) vs CPU(${opponentFaction})`);
      
      // Mutate data to force this setup
      if (!data) data = {};
      data.opponentFaction = opponentFaction;
      
      // Also ensure campaign config matches
      const campaignData = data as any;
      if (campaignData?.levelConfig) {
        campaignData.levelConfig.enemyFaction = opponentFaction;
      }
    }
    
    const setup = new GameSceneSetup(this);
    
    // Асинхронная инициализация с проверкой загрузки ассетов
    setup.initialize(data).then(result => {
      this.onSetupComplete(result);
    }).catch(error => {
      console.error('[GameScene] Setup failed:', error);
      // Продолжаем даже при ошибке
      this.onSetupComplete(null as any);
    });
  }

  private onSetupComplete(result: GameSceneSetupResult): void {
    const data = (this as any).__setupData as GameSceneData | undefined;

    // ✅ ИСПРАВЛЕНО: Инициализируем менеджеры событий ПОСЛЕ eventBus.clear()
    // (GameSceneSetup.initialize() очищает EventBus, поэтому подписки должны создаваться после этого)
    this.initializeEventListeners();

    this.applySetupResult(result, data);

    // ✅ SessionPersistence: сохраняем, что мы в игре (для восстановления/диагностики)
    try {
      const state = this.getState();
      SessionPersistence.saveCurrentScene('GameScene', {
        matchContext: this.matchContext,
        difficulty: state?.aiDifficulty,
      });
    } catch (e) {
      // ignore
    }

    HapticManager.init();
    this.createMatchDirector();
    this.createControllers();
    this.createCaptainMatchSystem();
    this.createManagers();
    this.createUI();
    this.subscribeToEvents();
    
    // вњ… РЈР›РЈР§РЁР•РќРћ: Р“Р»РѕР±Р°Р»СЊРЅС‹Р№ СЃР»СѓС€Р°С‚РµР»СЊ РІРІРѕРґР° СЃ РїСЂРёРѕСЂРёС‚РµС‚РѕРј СЃРїРѕСЃРѕР±РЅРѕСЃС‚РµР№
    this.setupGlobalInput();

    // ✅ Настройка lifecycle handlers для корректной работы при сворачивании/разворачивании
    this.setupLifecycleHandlers();

    this.cameras.main.centerOn(this.fieldBounds.centerX, this.fieldBounds.centerY);
    this.scale.on('resize', this.handleResize, this);

    this.announcer = AnnouncerManager.getInstance();
    this.announcer.init(this);
    
    // вњ… LOGIC CHANGE: Immediate start for Campaign / Tutorial
    console.log(`[GameScene] create(): matchContext="${this.matchContext}", isPvP=${this.isRealtimePvP}, isCampaign=${this.isCampaignMode}, isAI=${this.isAIEnabled}, isTutorial=${this.isTutorialMode}`);
    
    // #region agent log
    // ✅ REMOVED: fetch запросы для логирования - используем ProductionLogger
    // #endregion
    
    // ✅ NEW: Если пришли из MatchVSScene — пропускаем интро
    if (this.skipIntro) {
      console.log('[GameScene] Skipping intro (came from MatchVSScene)');
      this.onMatchIntroComplete();
      this.isInitialized = true;
      return;
    }
    
    // ✅ TUTORIAL MODE: Особая обработка
    if (this.isTutorialMode) {
      console.log('[GameScene] Tutorial Mode: Setting up tutorial environment');
      
      // Пропускаем VS-экран
      this.onMatchIntroComplete();
      
      // Помечаем как инициализированную
      this.isInitialized = true;
      
      // Инициализируем систему обучения
      // Важно: это должно происходить ПОСЛЕ создания всех игровых объектов
      this.time.delayedCall(100, () => {
        this.initializeTutorial();
      });
      
      // Не продолжаем обычную ветку
      return;
    }
    
    if (this.isRealtimePvP) {
      // NEW PVP: Показываем интро и начинаем матч
      this.showMatchIntro();
    } else if (this.isCampaignMode) {
      // Skip the "VS" screen animation for campaign
      console.log('[GameScene] Campaign mode: Skipping Intro');
      this.onMatchIntroComplete();
    } else {
      // Standard VS animation for Quick Play / Local / League / Tournament
      console.log(`[GameScene] Showing Match Intro for mode: ${this.matchContext}`);
      // #region agent log
      // ✅ REMOVED: fetch запросы для логирования - используем ProductionLogger
      // #endregion
      this.showMatchIntro();
    }

    this.isInitialized = true;
    console.log('[GameScene] Initialization complete');
    
    // #region agent log
    // ✅ REMOVED: fetch запросы для логирования - используем ProductionLogger
    // #endregion
  }

  private isLevel1_1(data?: GameSceneData): boolean {
    // Helper to check if we are in the first tutorial level
    const campaignData = data as any;
    if (campaignData?.isCampaign && campaignData.levelConfig?.id === '1-1') {
      return true;
    }
    // Fallback check for first tutorial match
    const progress = playerData.getCampaignProgress();
    if (progress.currentChapterId === 'chapter_1' && !playerData.hasCompletedFirstMatchTutorial()) {
      return true;
    }
    return false;
  }

  // ============================================================
  // вњ… РџР•Р Р•Р РђР‘РћРўРђРќРћ: Р“Р›РћР‘РђР›Р¬РќР«Р™ Р’Р’РћР” РЎ РџР РРћР РРўР•РўРћРњ РЎРџРћРЎРћР‘РќРћРЎРўР•Р™
  // ============================================================

  private setupGlobalInput(): void {
    // вњ… РџСЂРёРѕСЂРёС‚РµС‚ 1: РћР±СЂР°Р±РѕС‚РєР° ESC/Back РґР»СЏ РѕС‚РјРµРЅС‹ СЃРїРѕСЃРѕР±РЅРѕСЃС‚Рё
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.abilityManager?.isActivating()) {
        console.log('[GameScene] ESC pressed - cancelling ability');
        this.abilityManager.cancelActivation();
      } else if (this.captainMatchSystem?.isUltTargeting()) {
        this.captainMatchSystem.cancelUlt();
      }
    });

    // вњ… РџСЂРёРѕСЂРёС‚РµС‚ 2: РћР±СЂР°Р±РѕС‚РєР° РєР»РёРєР° РїРѕ РѕР±СЉРµРєС‚Р°Рј (Р®РЅРёС‚С‹) РґР»СЏ СЃРїРѕСЃРѕР±РЅРѕСЃС‚РµР№
    this.input.on('gameobjectdown', (pointer: Phaser.Input.Pointer, gameObject: any) => {
      // РџСЂРѕРІРµСЂСЏРµРј РїСЂРёРѕСЂРёС‚РµС‚ СЃРїРѕСЃРѕР±РЅРѕСЃС‚РµР№
      if (this.shouldGameplayOverlayConsumeInput()) {
        const tappedUnit = this.findTappedUnit(gameObject);
        if (tappedUnit && tappedUnit instanceof Unit && this.captainMatchSystem?.handleUnitTap(tappedUnit)) {
          pointer.event.stopPropagation();
          return;
        }

        if (tappedUnit) {
          console.log('[GameScene] Global input: Unit tapped for ability', tappedUnit.id);
          const processed = this.abilityManager.onUnitTapped(tappedUnit);
          
          if (processed) {
            // РћСЃС‚Р°РЅР°РІР»РёРІР°РµРј РІСЃРїР»С‹С‚РёРµ СЃРѕР±С‹С‚РёСЏ
            pointer.event.stopPropagation();
            return;
          }
        }
      }
    });

    // вњ… РџСЂРёРѕСЂРёС‚РµС‚ 3: РћР±СЂР°Р±РѕС‚РєР° РєР»РёРєР° РїРѕ РїРѕР»СЋ РґР»СЏ СЃРїРѕСЃРѕР±РЅРѕСЃС‚РµР№ (С‚РѕС‡РєРё СЂР°Р·РјРµС‰РµРЅРёСЏ)
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // вњ… 2.C. Close card info popup if clicking outside card panel
      if (this.cardInfoPopup && this.cardPanel) {
        const panelWorldX = this.cardPanel.x;
        const panelWorldY = this.cardPanel.y;
        const panelWidth = 300; // Approximate width
        const panelHeight = 250; // Include popup area
        
        if (pointer.x < panelWorldX - panelWidth / 2 || pointer.x > panelWorldX + panelWidth / 2 ||
            pointer.y < panelWorldY - panelHeight || pointer.y > panelWorldY + 80) {
          this.hideCardInfo();
        }
      }
      
      const abilityActive = this.abilityManager?.isActivating() ?? false;

      if (abilityActive) {
        const state = this.abilityManager.getState();

        if (state === 'SELECTING_POINT') {
          console.log('[GameScene] Global input: Field tapped for ability at', pointer.worldX, pointer.worldY);
          const processed = this.abilityManager.onFieldTapped(pointer.worldX, pointer.worldY);

          if (processed) {
            pointer.event.stopPropagation();
          }
        }
      } else if (this.captainMatchSystem?.handleWorldPointer(pointer.worldX, pointer.worldY)) {
        pointer.event.stopPropagation();
      }
    });

    // вњ… РџСЂРёРѕСЂРёС‚РµС‚ 4: РџСЂР°РІС‹Р№ РєР»РёРє / РґРІРѕР№РЅРѕР№ С‚Р°Рї РґР»СЏ РѕС‚РјРµРЅС‹
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (
        pointer.rightButtonDown() &&
        (this.abilityManager?.isActivating() || this.captainMatchSystem?.isUltTargeting())
      ) {
        console.log('[GameScene] Right click - cancelling ability / captain ult');
        if (this.abilityManager?.isActivating()) {
          this.abilityManager.cancelActivation();
        }
        if (this.captainMatchSystem?.isUltTargeting()) {
          this.captainMatchSystem.cancelUlt();
        }
      }
    });

    console.log('[GameScene] Global input handlers set up with ability priority');
  }

  /**
   * вњ… Р”РћР‘РђР’Р›Р•РќРћ: РџСЂРѕРІРµСЂРєР°, РґРѕР»Р¶РЅР° Р»Рё СЃРёСЃС‚РµРјР° СЃРїРѕСЃРѕР±РЅРѕСЃС‚РµР№ РѕР±СЂР°Р±Р°С‚С‹РІР°С‚СЊ РІРІРѕРґ
   * РЎРѕРіР»Р°СЃРЅРѕ РўР—: РµСЃР»Рё AbilityManager.isActivating() === true, РІРІРѕРґ РёРґС‘С‚ С‚СѓРґР°
   */
  private shouldGameplayOverlayConsumeInput(): boolean {
    if (!this.abilityManager) return false;
    if (this.abilityManager.isActivating()) return true;
    if (this.captainMatchSystem?.isUltTargeting()) return true;
    return false;
  }

  /**
   * вњ… Р”РћР‘РђР’Р›Р•РќРћ: РџРѕРёСЃРє СЋРЅРёС‚Р° РїРѕ gameObject
   */
  private findTappedUnit(gameObject: any): GameUnit | undefined {
    return this.caps.find(cap => {
      // РџСЂРѕРІРµСЂСЏРµРј СЂР°Р·Р»РёС‡РЅС‹Рµ РІР°СЂРёР°РЅС‚С‹ РѕР±СЉРµРєС‚РѕРІ
      if (cap === gameObject) return true;
      if ((cap as any).sprite === gameObject) return true;
      if ((cap as any).container === gameObject) return true;
      
      // РџСЂРѕРІРµСЂСЏРµРј children РєРѕРЅС‚РµР№РЅРµСЂР°
      if ((cap as any).sprite?.list) {
        return (cap as any).sprite.list.includes(gameObject);
      }
      
      return false;
    });
  }

  private applySetupResult(result: GameSceneSetupResult, data?: GameSceneData): void {
    // рџ”Ґ FIX: Force Opponent Faction for Level 1-1
    // If player picks Magma, they should fight Cyborgs, not Magma.
    if (result.isCampaignMode && result.campaignLevelConfig?.id === '1-1') {
      if (result.state.playerFaction === 'magma') {
        console.log('[GameScene] Tutorial Override: Setting opponent to Cyborg');
        result.state.opponentFaction = 'cyborg';
        this.storedOpponentFaction = 'cyborg';
      }
    }

    // Apply state
    this.fieldBounds = result.fieldBounds;
    this.ball = result.ball;
    this.caps = result.caps;
    this.startPositions = result.startPositions;
    this.fieldRenderer = result.fieldRenderer;
    this.vfxManager = result.vfxManager;
    this.isCampaignMode = result.isCampaignMode;
    this.campaignLevelConfig = result.campaignLevelConfig;
    this.campaignChapterConfig = result.campaignChapterConfig;

    // OLD PVP system removed
    this.isHost = result.state.isHost;
    this.myPlayerIndex = result.state.myPlayerIndex;
    this.isAIEnabled = result.state.isAIEnabled;
    this.storedPlayerFaction = result.state.playerFaction as FactionId;
    this.storedOpponentFaction = result.state.opponentFaction as FactionId;
    this.matchAIDifficulty = result.state.aiDifficulty;
    this.aiOpponentProfile = result.state.aiOpponentProfile;
    
    // ✅ NEW PVP: Регистрируем сущности в PvPHelper
    if (this.isRealtimePvP && this.pvpHelper) {
      // Регистрируем мяч
      this.pvpHelper.registerBall(this.ball);
      
      // Регистрируем все юниты
      this.caps.forEach((cap, index) => {
        const team = cap.owner; // 1 or 2
        const unitId = `team${team}_unit${index}`;
        
        // Проверяем что cap это Unit (а не Cap)
        if (cap instanceof Unit) {
          this.pvpHelper!.registerUnit(unitId, cap);
        }
      });
      
      // Подключаемся к серверу и отправляем готовность
      this.pvpHelper.connect().then(() => {
        this.pvpHelper!.sendReady();
        console.log('[GameScene] PVP entities registered and ready signal sent');
      }).catch((error) => {
        console.error('[GameScene] PVP connection failed:', error);
      });
    }
    
    // OLD: Removed MultiplayerManager initialization
    this.matchDuration = result.state.matchDuration;
    
    // вњ… Apply matchContext from data
    if (data?.matchContext) {
      this.matchContext = data.matchContext;
      console.log(`[GameScene] Match context set to: ${this.matchContext}`);
    } else if (this.isCampaignMode) {
      this.matchContext = 'campaign';
    } else {
      this.matchContext = 'casual';
    }
    
    // вњ… Apply tournament/league specific data
    if (data?.tournamentId) {
      this.tournamentId = data.tournamentId;
      this.seriesId = data.seriesId;
      this.round = data.round;
    }
    
    if (data?.majorAbilityBonus) {
      this.majorAbilityBonus = data.majorAbilityBonus;
    }
    
    if (data?.aimAssistDisabled) {
      this.aimAssistDisabled = data.aimAssistDisabled;
    }
  }

  // ============================================================
  // РЎРћР—Р”РђРќРР• РљРћРњРџРћРќР•РќРўРћР’
  // ============================================================

  private createMatchDirector(): void {
    const state = this.getState();
    
    // рџ”Ґ FIX: Force Cyborg opponent for Level 1-1
    let opponentFaction = state.opponentFaction;
    if (this.isCampaignMode && this.campaignLevelConfig?.id === '1-1') {
      console.log('[GameScene] OVERRIDE: Level 1-1 opponent set to CYBORG');
      opponentFaction = 'cyborg';
    }

    // РћРїСЂРµРґРµР»СЏРµРј СЂРµР¶РёРј РґР»СЏ MatchDirector
    let matchDirectorMode: 'standard' | 'campaign' | 'pvp' | 'tournament' | 'league' | 'custom';
    if (this.isCampaignMode) {
      matchDirectorMode = 'campaign';
    } else if (this.isRealtimePvP) {
      matchDirectorMode = 'pvp';
    } else if (this.matchContext === 'tournament') {
      matchDirectorMode = 'tournament';
    } else if (this.matchContext === 'league') {
      matchDirectorMode = 'league';
    } else if (this.matchContext === 'casual' && this.isAIEnabled && playerData.get().currentMatchMode === 'custom') {
      matchDirectorMode = 'custom'; // РўСЂРµРЅРёСЂРѕРІРѕС‡РЅС‹Р№ СЂРµР¶РёРј
    } else {
      matchDirectorMode = 'standard';
    }
    
    console.log(`[GameScene] MatchDirector mode: ${matchDirectorMode}`);

    this.matchDirector = new MatchDirector({
      scene: this,
      mode: matchDirectorMode,
      ball: this.ball,
      caps: this.caps as Unit[],
      fieldBounds: this.fieldBounds,
      matchDuration: state.matchDuration,
      isAIMode: this.isAIEnabled,
      playerFaction: state.playerFaction,
      opponentFaction: opponentFaction, // Use override
      campaignConfig: this.isCampaignMode && this.campaignLevelConfig ? {
        levelConfig: this.campaignLevelConfig,
        winCondition: this.campaignLevelConfig.winCondition,
      } : undefined,
      pvpConfig: this.isRealtimePvP ? {
        isHost: this.isHost,
        roomId: this.pvpHelper?.getCurrentRoomId() || '',
      } : undefined,
    });

    this.matchDirector.on('goal', this.onGoal, this);
    this.matchDirector.on('matchEnd', this.onMatchEnd, this);
    this.matchDirector.on('turnChange', this.onTurnChange, this);
    this.matchDirector.on('timerWarning', this.onTimerWarning, this);
  }

  private createControllers(): void {
    this.shootingController = new ShootingController(this);
    
    // вњ… Task 1: Disable legacy Void swap-by-tap (swap should only happen via AbilityManager card ability)
    this.shootingController.setLegacyVoidSwapEnabled(false);

    // вњ… Tournament: РћС‚РєР»СЋС‡Р°РµРј aim assist РґР»СЏ Galactic Apex
    if (this.aimAssistDisabled) {
      // ShootingController РЅРµ РёРјРµРµС‚ РјРµС‚РѕРґР° setAimAssistEnabled, РЅРѕ РјРѕР¶РЅРѕ РґРѕР±Р°РІРёС‚СЊ С„Р»Р°Рі
      // РџРѕРєР° РѕСЃС‚Р°РІР»СЏРµРј РєР°Рє РµСЃС‚СЊ, РјРѕР¶РЅРѕ РґРѕР±Р°РІРёС‚СЊ РїРѕР·Р¶Рµ
      console.log('[GameScene] Aim assist disabled for Galactic Apex');
    }
    
    // ✅ NEW PVP: Подключаем callback для отправки ударов на сервер
    if (this.isRealtimePvP && this.pvpHelper) {
      this.shootingController.onPvPShot((unitId, velocity) => {
        this.pvpHelper!.sendShot(unitId, velocity);
      });
      
      // Устанавливаем PVP режим
      const myTeam = this.pvpHelper.getMyTeam();
      this.shootingController.setPvPMode(true, myTeam === 1);
      
      console.log('[GameScene] PVP ShootingController configured');
    }

    // OLD: Removed setPvPMode call (already done in createControllers)

    const myOwner: PlayerNumber = this.isRealtimePvP ? this.getMyOwner() : 1;
    let localCapIndex = 0;

    this.caps.forEach(cap => {
      if (cap.owner === myOwner) {
        this.shootingController.registerCap(cap as any, localCapIndex);
        localCapIndex++;
      }
    });

    this.shootingController.onCapSelected(this.onCapSelected.bind(this));
    this.shootingController.onShoot(this.onShoot.bind(this));
    this.shootingController.onSwap(this.onSwap.bind(this));
  }

  private createCaptainMatchSystem(): void {
    if (!this.ball || !this.matchDirector) return;

    this.captainMatchSystem = new CaptainMatchSystem({
      scene: this,
      getCaps: () => this.caps as Unit[],
      getBall: () => this.ball,
      getFieldBounds: () => this.fieldBounds,
      shootingController: this.shootingController,
      getHumanOwner: () => this.getMyOwner(),
      isPvP: this.isRealtimePvP,
    });

    this.matchDirector.setResolveTurnAdvance((lastId) =>
      this.captainMatchSystem?.resolveTurnAdvanceAfterStop(lastId) ?? 'switch'
    );

    if (this.isRealtimePvP) return;

    const { width, height } = this.cameras.main;
    const margin = Math.max(10, Math.round(width * 0.024));
    const panelW = this.CAPTAIN_SUPER_PANEL_W;
    const panelH = this.CAPTAIN_SUPER_PANEL_H;
    const cx = width - margin - panelW / 2;
    const cy = height - this.CAPTAIN_SUPER_BOTTOM_MARGIN - panelH / 2;
    const panel = this.add.container(cx, cy).setDepth(151).setScrollFactor(0);

    const hw = panelW / 2;
    const hh = panelH / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x0f172a, 0.94);
    bg.fillRoundedRect(-hw, -hh, panelW, panelH, 12);
    bg.lineStyle(2, 0x475569, 0.9);
    bg.strokeRoundedRect(-hw, -hh, panelW, panelH, 12);
    panel.add(bg);

    const energyBg = this.add.graphics();
    energyBg.fillStyle(0x1e293b, 1);
    energyBg.fillRoundedRect(-hw + 6, -hh + 8, panelW - 12, 8, 4);
    panel.add(energyBg);

    const energyFill = this.add.graphics();
    panel.add(energyFill);
    this.captainSuperEnergyGfx = energyFill;

    const btnH = 22;
    const btnY = hh - 6 - btnH / 2;
    const btnZone = this.add
      .rectangle(0, btnY, panelW - 12, btnH, 0x334155, 1)
      .setStrokeStyle(2, 0x64748b, 0.9)
      .setInteractive({ useHandCursor: true });
    btnZone.on('pointerdown', () => {
      if (this.captainMatchSystem?.tryBeginUltFromUi()) {
        AudioManager.getInstance().playUIClick();
      }
    });
    panel.add(btnZone);
    panel.add(
      this.add
        .text(0, btnY, 'SUPER', {
          fontSize: '12px',
          color: '#f8fafc',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
    );

    panel.add(
      this.add
        .text(0, -hh + 5, 'CAPTAIN', {
          fontSize: '9px',
          color: '#94a3b8',
        })
        .setOrigin(0.5)
    );

    this.captainSuperPanel = panel;
  }

  private refreshCaptainSuperHud(): void {
    if (!this.captainMatchSystem || !this.captainSuperEnergyGfx) return;
    const frac = this.captainMatchSystem.getHumanEnergyFraction();
    const ready = this.captainMatchSystem.canHumanActivateUlt();
    const panelW = this.CAPTAIN_SUPER_PANEL_W;
    const panelH = this.CAPTAIN_SUPER_PANEL_H;
    const barW = panelW - 12;
    const barLeft = -(panelW / 2) + 6;
    const barTop = -(panelH / 2) + 8;
    const barH = 8;

    this.captainSuperEnergyGfx.clear();
    this.captainSuperEnergyGfx.fillStyle(ready ? 0xf59e0b : 0x3b82f6, 1);
    if (frac > 0) {
      this.captainSuperEnergyGfx.fillRoundedRect(barLeft, barTop, barW * frac, barH, 4);
    }
    if (ready !== this.captainSuperLastReady) {
      this.captainSuperLastReady = ready;
      if (ready && this.captainSuperPanel) {
        this.tweens.killTweensOf(this.captainSuperPanel);
        this.captainSuperPanel.setScale(1);
        this.tweens.add({
          targets: this.captainSuperPanel,
          scaleX: { from: 1, to: 1.05 },
          scaleY: { from: 1, to: 1.05 },
          duration: 200,
          yoyo: true,
          repeat: 1,
          ease: 'Sine.easeInOut',
        });
      }
    }
    if (this.captainSuperPanel) {
      const hasCaptain = this.caps.some(
        (c) =>
          c.owner === this.getMyOwner() &&
          c instanceof Unit &&
          isCaptainUnitId(c.getUnitId())
      );
      if (!hasCaptain) {
        this.captainSuperLastReady = false;
      }
      this.captainSuperPanel.setVisible(hasCaptain);
    }
  }

  /** Контекст режима матча для AIController (не путать со строковым MatchContext сцен). */
  private buildAIMatchContext(): AIMatchContext {
    const pd = playerData.get();

    if (this.isRealtimePvP) {
      return { mode: 'pvp' };
    }

    if (this.isDisguisedPvPBotMatch) {
      return { mode: 'pvp' };
    }

    if (this.isCampaignMode) {
      return { mode: 'campaign' };
    }

    if (this.matchContext === 'league') {
      const lp = pd.leagueProgress;
      return {
        mode: 'league',
        leagueTier: lp?.currentTier as AIMatchContext['leagueTier'],
        leagueDivision: lp?.division,
      };
    }

    if (this.matchContext === 'tournament') {
      const t = pd.activeTournament;
      const roundFromScene = this.round as BracketStage | undefined;
      return {
        mode: 'tournament',
        tournamentTier: t?.tier,
        tournamentRound: roundFromScene ?? t?.currentRound,
      };
    }

    return { mode: 'friendly' };
  }

  /** После AbilityManager P2 — колбэк карт и корректный init ИИ */
  private setupAIController(): void {
    if (!this.isAIEnabled || this.isRealtimePvP) return;

    this.aiController = new AIController(this, this.matchAIDifficulty, this.aiOpponentProfile);

    const aiUnits = this.caps.filter(c => c.owner === 2);
    const playerUnits = this.caps.filter(c => c.owner === 1);

    this.aiController.init(aiUnits as any[], this.ball, playerUnits as any[]);

    this.aiController.setMatchContext(this.buildAIMatchContext());

    this.aiController.setCaptainShotGate((u) =>
      this.captainMatchSystem?.aiTeamShotUnitAllowed(u as Unit) ?? true
    );

    this.aiController.setCardUsedCallback((cardId, targetData) => {
      console.log(`[GameScene] AI using card: ${cardId}`, targetData);
      if (this.player2AbilityManager) {
        return this.player2AbilityManager.handleAICardUsage(cardId, targetData);
      }
      console.warn('[GameScene] player2AbilityManager missing — AI card skipped');
      return false;
    });

    this.player2AbilityManager?.alignAIDeckFromHand(this.aiController.getHandCardIds());

    this.aiController.onMoveComplete((skipDirectorShot?: boolean) => {
      this.aiTurnScheduled = false;
      if (!skipDirectorShot) {
        this.matchDirector.onShot('ai_unit');
      }
    });

    this.syncAIFormationPositions('match-start');
    this.lastSyncedAIFormationId = this.aiController.getCurrentFormation().id;
  }

  /** После createUI: LassoController создаётся позже setupAIController. */
  private wireAITricksterLasso(): void {
    if (!this.aiController || !this.lassoController) return;
    this.aiController.setTricksterLassoRunner((unit, aimX, aimY, onFinished) =>
      this.lassoController!.runAISequence(unit as GameUnit, aimX, aimY, (result) => {
        onFinished(result.ok && result.released);
      }),
    );
  }

  private createManagers(): void {
    const state = this.getState();

    this.celebrationManager = new CelebrationManager(this, {
      useFactions: state.useFactions,
      playerFaction: state.playerFaction,
      currentArena: state.currentArena,
    });

    // вњ… РРЅРёС†РёР°Р»РёР·Р°С†РёСЏ AchievementManager РґР»СЏ РјР°С‚С‡Р°
    import('../managers/AchievementManager').then(({ AchievementManager }) => {
      this.achievementManager = new AchievementManager(this);
    });

    this.collisionHandler = new CollisionHandler(
      {
        scene: this,
        fieldBounds: this.fieldBounds,
        fieldScale: this.fieldBounds.width / 600,
        isPvPMode: this.isRealtimePvP,
        isHost: this.isHost,
        useFactions: state.useFactions,
        playerFaction: state.playerFaction,
      },
      {
        getBall: () => this.ball,
        getCaps: () => this.caps,
        getLastShootingCap: () => this.lastShootingCap,
        getLastShootingCapId: () => this.lastShootingCap?.id,
        getBallSpeedBeforeCollision: () => 0,
        setBallSpeedBeforeCollision: () => {},
        getGuestLocalPhysicsUntil: () => 0,
        setGuestLocalPhysicsUntil: () => {},
        clearSnapshotBuffer: () => {},
        getFieldRenderer: () => this.fieldRenderer,
        debug: { log: () => {}, error: () => {}, incrementFrame: () => {}, getFrameCount: () => 0 } as any,
        triggerHaptic: HapticManager.trigger,
      }
    );
    this.collisionHandler.setup();
    
    // ✅ ИСПРАВЛЕНО: Сначала создаём AbilityManager
    this.createAbilityManagers();
    
    // ✅ PASSIVE SYSTEM: Создаём PassiveManager
    this.passiveManager = new PassiveManager(this, () => this.fieldBounds);
    
    // Регистрируем все юниты и мяч
    this.caps.forEach(cap => {
      if (cap instanceof Unit) {
        this.passiveManager.registerUnit(cap);
        cap.setPassiveManager(this.passiveManager);
      }
    });
    this.passiveManager.registerBall(this.ball);
    
    // Подключаем PassiveManager ко всем системам
    this.shootingController.setPassiveManager(this.passiveManager);
    this.abilityManager.setPassiveManager(this.passiveManager);
    this.player2AbilityManager?.setPassiveManager(this.passiveManager);
    this.collisionHandler.setPassiveManager(this.passiveManager);

    this.setupAIController();
    
    // Initialize CampaignDialogueSystem for campaign mode
    if (this.isCampaignMode && this.campaignLevelConfig) {
      this.campaignDialogue = new CampaignDialogueSystem(this);
      this.campaignDialogue.initForLevel(this.campaignLevelConfig);
    }
    
    // OLD: Removed old pvpSync initialization (using pvpHelper now)
  }
  
  // ============================================================
  // TUTORIAL SYSTEM
  // ============================================================

  /**
   * Инициализация системы обучения
   */
  private initializeTutorial(): void {
    console.log('[GameScene] Initializing tutorial system');
    
    // Проверяем наличие необходимых компонентов
    if (!this.shootingController) {
      console.error('[GameScene] Cannot init tutorial: shootingController not found');
      return;
    }
    
    this.tutorialManager = new TutorialManager({
      scene: this,
      playerFaction: this.storedPlayerFaction || 'magma',
      fieldBounds: this.fieldBounds,
      shootingController: this.shootingController,
      onComplete: () => this.onTutorialComplete(),
      onSkip: () => this.onTutorialSkip()
    });
    
    // Передаём игровые объекты
    const playerUnits = this.caps.filter(c => c.owner === 1);
    const aiUnits = this.caps.filter(c => c.owner === 2);
    
    console.log(`[GameScene] Tutorial units: ${playerUnits.length} player, ${aiUnits.length} AI`);
    
    // Логируем классы юнитов для отладки
    playerUnits.forEach((u, i) => {
      const capClass = u.getCapClass ? u.getCapClass() : 'unknown';
      console.log(`[GameScene] Player unit ${i}: ${u.id}, class: ${capClass}`);
    });
    
    this.tutorialManager.setGameObjects(playerUnits, aiUnits, this.ball);
    
    // Запускаем туториал
    this.tutorialManager.start();
    
    console.log('[GameScene] Tutorial system initialized and started');
  }

  /**
   * Обработка завершения обучения
   */
  private onTutorialComplete(): void {
    console.log('[GameScene] Tutorial completed successfully');
    
    // Уничтожаем менеджер
    if (this.tutorialManager) {
      this.tutorialManager.destroy();
      this.tutorialManager = undefined;
    }
    
    this.isTutorialMode = false;
    
    // Показываем сообщение об успехе (опционально)
    // this.showNotification('Обучение завершено!');
    
    // Переходим в главное меню
    this.scene.stop('GameScene');
    this.scene.start('MainMenuScene', { fromTutorial: true });
  }

  /**
   * Обработка пропуска обучения
   */
  private onTutorialSkip(): void {
    console.log('[GameScene] Tutorial skipped by user');
    
    // Уничтожаем менеджер
    if (this.tutorialManager) {
      this.tutorialManager.destroy();
      this.tutorialManager = undefined;
    }
    
    this.isTutorialMode = false;
    
    // Переходим в главное меню
    this.scene.stop('GameScene');
    this.scene.start('MainMenuScene', { fromTutorial: true, skipped: true });
  }

  private getUnitById(unitId: string): GameUnit | undefined {
    return this.caps.find(cap => {
      if (cap instanceof Unit) {
        return cap.getUnitId() === unitId;
      }
      return cap.id === unitId;
    });
  }
  
  private passiveColorToCss(color: number): string {
    const n = (color >>> 0) & 0xffffff;
    return '#' + n.toString(16).padStart(6, '0');
  }

  private pulsePassiveFeedbackThrottled(): void {
    const now = Date.now();
    if (now - this.lastPassiveHudHapticAt < 420) return;
    this.lastPassiveHudHapticAt = now;
    HapticManager.trigger('light');
  }

  /** Всплывающая подпись у фишки на поле */
  private showPassiveFloatingLabel(wx: number, wy: number, text: string, color: number): void {
    const textObj = this.add.text(wx, wy, text, {
      fontSize: '15px',
      fontStyle: 'bold',
      color: this.passiveColorToCss(color),
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: { width: Math.min(280, this.cameras.main.width * 0.42) },
    }).setOrigin(0.5).setDepth(25000);

    this.tweens.add({
      targets: textObj,
      y: wy - 44,
      alpha: 0,
      duration: 1250,
      ease: 'Power2',
      onComplete: () => textObj.destroy(),
    });
  }

  /** Компактная полоска у нижнего края (видна при любой камере) */
  private showPassiveHudBanner(text: string, color: number): void {
    const cam = this.cameras.main;
    const yTopBand = Math.max(52, Math.min(108, cam.height * 0.11));

    if (this.passiveHudToast) {
      this.passiveHudToast.destroy();
      this.passiveHudToast = undefined;
    }

    const w = Math.min(cam.width * 0.92, 460);
    const container = this.add.container(cam.centerX, yTopBand).setDepth(25001).setScrollFactor(0);
    const bg = this.add.rectangle(0, 0, w, 38, 0x050508, 0.82).setStrokeStyle(2, (color >>> 0) & 0xffffff, 0.92);
    const label = this.add.text(0, 0, text, {
      fontSize: '14px',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      color: this.passiveColorToCss(color),
      align: 'center',
      wordWrap: { width: w - 24 },
    }).setOrigin(0.5);

    container.add([bg, label]);
    container.setAlpha(0);
    this.passiveHudToast = container;

    this.tweens.add({
      targets: container,
      alpha: 1,
      duration: 110,
      ease: 'Sine.out',
      onComplete: () => {
        this.time.delayedCall(1050, () => {
          if (!this.passiveHudToast || container !== this.passiveHudToast) return;
          this.tweens.add({
            targets: container,
            alpha: 0,
            y: yTopBand - 8,
            duration: 260,
            ease: 'Sine.in',
            onComplete: () => {
              container.destroy();
              if (this.passiveHudToast === container) this.passiveHudToast = undefined;
            },
          });
        });
      },
    });
  }

  private createAbilityManagers(): void {
    const state = this.getState();
    const playerFaction = state.playerFaction || 'cyborg';
    const opponentFaction = state.opponentFaction || 'magma';

    this.abilityManager = new AbilityManager({
      scene: this,
      getCaps: () => this.caps,
      getBall: () => this.ball,
      getFieldBounds: () => this.fieldBounds,
      isHost: this.isHost,
      isPvPMode: this.isRealtimePvP,
      playerFaction,
      playerId: 1,
      vfxManager: this.vfxManager,
      canCaptainUltReady: () => this.captainMatchSystem?.canHumanActivateUlt() ?? false,
      tryBeginCaptainUlt: () => this.captainMatchSystem?.tryBeginUltFromUi() ?? false,
    });

    this.player2AbilityManager = new AbilityManager({
      scene: this,
      getCaps: () => this.caps,
      getBall: () => this.ball,
      getFieldBounds: () => this.fieldBounds,
      isHost: this.isHost,
      isPvPMode: false, // OLD PVP system removed, always false
      playerFaction: opponentFaction,
      playerId: 2,
      vfxManager: this.vfxManager,
    });

    this.setupAbilityManagerEvents();
  }

  // вњ… РЈР›РЈР§РЁР•РќРћ: РЎРѕР±С‹С‚РёСЏ AbilityManager СЃ РїСЂР°РІРёР»СЊРЅРѕР№ Р±Р»РѕРєРёСЂРѕРІРєРѕР№ РІРІРѕРґР°
  private setupAbilityManagerEvents(): void {
    this.abilityManager.on('card_activation_started', (data: any) => {
      console.log('[GameScene] Card activation started:', data);
      
      // рџ”Ґ РљР РРўРР§РќРћ: Р‘Р»РѕРєРёСЂСѓРµРј СЃС‚СЂРµР»СЊР±Сѓ СЃРѕРіР»Р°СЃРЅРѕ РўР—
      this.isAbilityInputActive = true;
      this.shootingController.setEnabled(false);
      
      // Р’РёР·СѓР°Р»СЊРЅС‹Р№ С„РёРґР±РµРє - Р·Р°С‚РµРјРЅСЏРµРј РїР°РЅРµР»СЊ СЃС‚СЂРµР»СЊР±С‹
      this.updateCardPanelUI();
      
      // Dispatch СЃРѕР±С‹С‚РёРµ РґР»СЏ UI
      eventBus.dispatch(GameEvents.ABILITY_ACTIVATION_STARTED, {
        playerId: 1,
        abilityType: data.cardId,
        targetType: data.targetType,
      });
    });

    this.abilityManager.on('card_activation_cancelled', (data: any) => {
      console.log('[GameScene] Card activation cancelled');
      
      // Р’РѕСЃСЃС‚Р°РЅР°РІР»РёРІР°РµРј СЃС‚СЂРµР»СЊР±Сѓ
      this.isAbilityInputActive = false;
      
      // Р’РєР»СЋС‡Р°РµРј СЃС‚СЂРµР»СЊР±Сѓ С‚РѕР»СЊРєРѕ РµСЃР»Рё СЃРµР№С‡Р°СЃ С…РѕРґ РёРіСЂРѕРєР°
      if (this.matchDirector.getCurrentPlayer() === 1) {
        this.shootingController.setEnabled(true);
      }
      
      this.updateCardPanelUI();
    });

    this.abilityManager.on('card_activated', (data: any) => {
      console.log('[GameScene] Card activated:', data);
      
      this.isAbilityInputActive = false;
      
      AudioManager.getInstance().playSFX('sfx_ability');
      
      // рџЋЇ РћР±РЅРѕРІР»СЏРµРј РµР¶РµРґРЅРµРІРЅРѕРµ Р·Р°РґР°РЅРёРµ РЅР° РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ СЃРїРѕСЃРѕР±РЅРѕСЃС‚РµР№
      try {
        import('../data/DailyTasks').then(({ dailyTasksManager }) => {
          dailyTasksManager.updateTaskProgress('use_abilities', 1);
        });
      } catch (error) {
        console.warn('[GameScene] Failed to update daily tasks:', error);
      }
      HapticManager.trigger('medium');
      this.updateCardPanelUI();
      
      // Р—Р°РїСѓСЃРєР°РµРј С‚Р°Р№РјРµСЂ РѕР±РЅРѕРІР»РµРЅРёСЏ РєСѓР»РґР°СѓРЅР°
      this.startCooldownTimer();
      
      // РќРµР±РѕР»СЊС€Р°СЏ Р·Р°РґРµСЂР¶РєР° РїРµСЂРµРґ РІРєР»СЋС‡РµРЅРёРµРј СЃС‚СЂРµР»СЊР±С‹ РґР»СЏ РёР·Р±РµР¶Р°РЅРёСЏ СЃР»СѓС‡Р°Р№РЅС‹С… РєР»РёРєРѕРІ
      this.time.delayedCall(300, () => {
        if (this.matchDirector.getCurrentPlayer() === 1 && !this.abilityManager.isActivating()) {
          this.shootingController.setEnabled(true);
        }
      });
    });

    this.abilityManager.on('unit_selected_for_pair', (data: any) => {
      console.log('[GameScene] Unit selected for pair:', data);
      // РњРѕР¶РЅРѕ РґРѕР±Р°РІРёС‚СЊ РІРёР·СѓР°Р»СЊРЅС‹Р№ С„РёРґР±РµРє
      HapticManager.trigger('light');
    });
  }

  private createUI(): void {
    const state = this.getState();

    // вњ… League & Tournament: РњР°СЃРєРёСЂСѓРµРј Р±РѕС‚Р° РїРѕРґ СЂРµР°Р»СЊРЅРѕРіРѕ РёРіСЂРѕРєР°
    let opponentName: string | undefined = undefined;
    if (
      (this.matchContext === 'league' ||
        this.matchContext === 'tournament' ||
        this.matchContext === 'casual' ||
        this.matchContext === 'ranked') &&
      this.isAIEnabled
    ) {
      // вњ… РРЎРџР РђР’Р›Р•РќРћ: РСЃРїРѕР»СЊР·СѓРµРј СѓР¶Рµ СѓСЃС‚Р°РЅРѕРІР»РµРЅРЅРѕРµ РёРјСЏ, РµСЃР»Рё РѕРЅРѕ РµСЃС‚СЊ
      if (this.opponentName) {
        opponentName = this.opponentName;
        console.log(`[GameScene] createUI(): Using existing opponentName: "${opponentName}"`);
      } else {
        opponentName = generateHumanLikeOpponentNickname();
        // вњ… РЎРѕС…СЂР°РЅСЏРµРј РґР»СЏ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёСЏ РІ VS preview
        this.opponentName = opponentName;
        console.log(`[GameScene] createUI(): Generated new opponentName: "${opponentName}"`);
      }
    } else if (this.isRealtimePvP) {
      opponentName = this.opponentName || 'Opponent';
    }

    this.gameHUD = new GameHUD(this, {
      isAIMode: this.hudShowsAiBranding,
      aiDifficulty: state.aiDifficulty,
      isPvP: this.hudTreatAsNetworkPvP,
      opponentName: opponentName,
      matchDuration: state.matchDuration,
      fieldSkinId: state.fieldSkinId,
      arena: state.currentArena,
      playerFaction: state.useFactions ? state.playerFaction : undefined,
      opponentFaction: state.useFactions ? state.opponentFaction : undefined,
    });

    this.gameHUD.onPause(() => {
      AudioManager.getInstance().playSFX('sfx_click');
      this.showPauseMenu();
    });

    // Ability Button (legacy - СЃРєСЂС‹С‚, РёСЃРїРѕР»СЊР·СѓРµРј РєР°СЂС‚С‹)
    this.abilityButton = new AbilityButton(this, {
      abilityManager: this.abilityManager as any,
      factionId: state.playerFaction || 'cyborg',
    });
    this.abilityButton.hide();

    this.lassoController = new LassoController(this, () => this.ball, (capId) =>
      this.handleLassoReleased(capId),
    );
    this.shootingController.setLassoActiveCheck(() => this.lassoController?.isActive() ?? false);
    this.lassoButton = new LassoButton(this, {
      lassoController: this.lassoController,
    });

    this.wireAITricksterLasso();

    this.createCardPanel();

    const isFirstTutorialMatch = this.isCampaignMode &&
      this.campaignLevelConfig?.id === '1-1' &&
      !playerData.hasCompletedFirstMatchTutorial();

    this.tutorialOverlay = new TutorialOverlay(this, isFirstTutorialMatch);

    // ✅ NEW: Показываем введение в фишки для туториала
    if (isFirstTutorialMatch && this.tutorialOverlay) {
      this.time.delayedCall(1500, () => {
        const playerCaps = this.caps
          .filter(c => c.owner === 1)
          .map(c => ({
            x: c.x,
            y: c.y,
            capClass: c.getCapClass() || 'balanced',
            unitId: c.id || '',
          }));
        
        const enemyCaps = this.caps
          .filter(c => c.owner === 2)
          .map(c => ({
            x: c.x,
            y: c.y,
            capClass: c.getCapClass() || 'balanced',
            unitId: c.id || '',
          }));
        
        this.tutorialOverlay?.showUnitsIntroduction(playerCaps, enemyCaps, () => {
          console.log('[GameScene] Units introduction complete');
          // Продолжаем обычный туториал
        });
      });
    }
  }

  // ============================================================
  // вњ… РЈР›РЈР§РЁР•РќРћ: CARD PANEL UI РЎ РљРЈР›Р”РђРЈРќРћРњ
  // ============================================================

  private createCardPanel(): void {
    const { width, height } = this.cameras.main;

    // Создать контейнер панели карт внизу экрана
    this.cardPanel = this.add.container(width / 2, height - this.CARD_PANEL_Y_OFFSET);
    this.cardPanel.setDepth(150);

    // Заполнить панель картами
    this.updateCardPanelUI();
  }

  private updateCardPanelUI(): void {
    if (!this.cardPanel) return;
    
    // Очистить старые элементы панели
    this.cardPanel.removeAll(true);

    // Получить слоты карт и кулдаун
    const slots = this.abilityManager.getCardSlots();
    const cooldownRemaining = this.abilityManager.getCooldownRemaining();

    // Рассчитать позиции для центрирования
    const totalWidth = slots.length * this.CARD_SLOT_WIDTH + (slots.length - 1) * this.CARD_SPACING;
    const startX = -totalWidth / 2 + this.CARD_SLOT_WIDTH / 2;

    // Создать UI для каждого слота
    slots.forEach((slot, index) => {
      const x = startX + index * (this.CARD_SLOT_WIDTH + this.CARD_SPACING);
      const slotContainer = this.createCardSlotUI(x, 0, slot, index, cooldownRemaining);
      this.cardPanel!.add(slotContainer);
    });
  }

  private createCardSlotUI(
    x: number,
    y: number,
    slot: { cardId: string | null; used: boolean },
    slotIndex: number,
    cooldownRemaining: number
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // ===== ПУСТОЙ ИЛИ ИСПОЛЬЗОВАННЫЙ СЛОТ =====
    if (!slot.cardId || slot.used) {
      const emptyBg = this.add.rectangle(
        0, 0,
        this.CARD_SLOT_WIDTH,
        this.CARD_SLOT_HEIGHT,
        0x1a1a2e,
        0.6
      );
      emptyBg.setStrokeStyle(2, 0x333355);
      container.add(emptyBg);
      
      if (slot.used) {
        const usedText = this.add.text(0, 0, '✓', {
          fontSize: '28px',
          color: '#666666',
        }).setOrigin(0.5);
        container.add(usedText);
      }
      
      return container;
    }

    // ===== ПОЛУЧИТЬ ДАННЫЕ КАРТЫ =====
    const card = getCard(slot.cardId);
    if (!card) {
      console.warn(`[GameScene] Card not found: ${slot.cardId}`);
      return container;
    }

    // ===== ПРОВЕРКИ СОСТОЯНИЯ =====
    const cardCount = playerData.getCardCount(slot.cardId);
    const isOutOfStock = cardCount <= 0;
    const isOnCooldown = cooldownRemaining > 0;
    const isBlocked = isOutOfStock || isOnCooldown;

    // ===== ИЗОБРАЖЕНИЕ КАРТЫ (масштабированное с 600x900) =====
    const textureKey = `card_${card.id}`;
    
    // Проверить существование текстуры
    if (!this.textures.exists(textureKey)) {
      console.warn(`[GameScene] ⚠️ Texture not found: ${textureKey}`);
      console.warn(`[GameScene] Available card textures:`, 
        Object.keys(this.textures.list).filter(k => k.startsWith('card_'))
      );
      const placeholder = this.add.rectangle(0, 0, this.CARD_SLOT_WIDTH, this.CARD_SLOT_HEIGHT, 0x444444);
      placeholder.setStrokeStyle(2, 0x666666);
      container.add(placeholder);
    } else {
      const cardImage = this.add.image(0, 0, textureKey);
      const scaleX = this.CARD_SLOT_WIDTH / 600;
      const scaleY = this.CARD_SLOT_HEIGHT / 900;
      const scale = Math.min(scaleX, scaleY);
      cardImage.setScale(scale);
      container.add(cardImage);
    }

    // ===== ЗАТЕМНЕНИЕ ЗАБЛОКИРОВАННОЙ КАРТЫ =====
    if (isBlocked) {
      const darkOverlay = this.add.rectangle(
        0, 0,
        this.CARD_SLOT_WIDTH,
        this.CARD_SLOT_HEIGHT,
        0x000000,
        0.65
      );
      container.add(darkOverlay);

      // Показать причину блокировки
      if (isOnCooldown) {
        // Таймер кулдауна
        const cdText = this.add.text(0, 0, `${Math.ceil(cooldownRemaining)}s`, {
          fontSize: '20px',
          fontFamily: 'Orbitron, sans-serif',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 4,
        }).setOrigin(0.5);
        container.add(cdText);
      } else if (isOutOfStock) {
        // Крестик "нет карт"
        const noStockIcon = this.add.text(0, 0, '✕', {
          fontSize: '32px',
          color: '#ff4444',
          stroke: '#000000',
          strokeThickness: 4,
        }).setOrigin(0.5);
        container.add(noStockIcon);
      }
    }

    // ===== СЧЁТЧИК КАРТ (x7) — правый верхний угол =====
    const badgeOffsetX = this.CARD_SLOT_WIDTH / 2 - 14;
    const badgeOffsetY = -this.CARD_SLOT_HEIGHT / 2 + 14;

    const badgeCircle = this.add.circle(
      badgeOffsetX,
      badgeOffsetY,
      13,
      isOutOfStock ? 0x660000 : 0x006600
    );
    badgeCircle.setStrokeStyle(2, 0xffffff);
    container.add(badgeCircle);

    const countText = this.add.text(badgeOffsetX, badgeOffsetY, `x${cardCount}`, {
      fontSize: '10px',
      fontFamily: 'Orbitron, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(countText);

    // ===== ПОДСВЕТКА ВЫБРАННОЙ КАРТЫ =====
    if (this.selectedCardSlotIndex === slotIndex && !isBlocked) {
      const selectionGlow = this.add.rectangle(
        0, 0,
        this.CARD_SLOT_WIDTH + 8,
        this.CARD_SLOT_HEIGHT + 8
      );
      selectionGlow.setStrokeStyle(3, 0x00ffff);
      selectionGlow.setFillStyle(0x00ffff, 0.12);
      container.addAt(selectionGlow, 0); // Добавить под карту
    }

    // ===== ИНТЕРАКТИВНАЯ ОБЛАСТЬ =====
    const hitArea = this.add.rectangle(
      0, 0,
      this.CARD_SLOT_WIDTH,
      this.CARD_SLOT_HEIGHT,
      0x000000,
      0 // Полностью прозрачная
    );
    hitArea.setInteractive({ useHandCursor: !isBlocked });
    container.add(hitArea);

    // ===== ОБРАБОТЧИКИ ВВОДА =====
    let longPressTriggered = false;

    hitArea.on('pointerdown', () => {
      longPressTriggered = false;

      // Удалить предыдущий таймер для этого слота
      const existingTimer = this.longPressTimers.get(slotIndex);
      if (existingTimer) {
        existingTimer.remove();
      }

      // Создать таймер долгого нажатия
      const longPressTimer = this.time.addEvent({
        delay: this.LONG_PRESS_DELAY,
        callback: () => {
          longPressTriggered = true;
          this.showEnlargedCard(card, cardCount, isBlocked);
          
          // Тактильный отклик
          if (typeof HapticManager !== 'undefined') {
            HapticManager.trigger('medium');
          }
        },
      });
      this.longPressTimers.set(slotIndex, longPressTimer);

      // Визуальный отклик нажатия (уменьшение)
      this.tweens.add({
        targets: container,
        scaleX: 0.92,
        scaleY: 0.92,
        duration: 100,
        ease: 'Power2',
      });
    });

    hitArea.on('pointerup', () => {
      // Очистить таймер долгого нажатия
      const timer = this.longPressTimers.get(slotIndex);
      if (timer) {
        timer.remove();
        this.longPressTimers.delete(slotIndex);
      }

      // Вернуть масштаб
      this.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
        ease: 'Power2',
      });

      // Если долгое нажатие НЕ сработало и карта НЕ увеличена — это короткий тап
      if (!longPressTriggered && !this.isCardEnlarged) {
        this.handleCardTap(slotIndex, isBlocked, cardCount);
      }
    });

    hitArea.on('pointerout', () => {
      // Очистить таймер при уходе пальца за пределы карты
      const timer = this.longPressTimers.get(slotIndex);
      if (timer) {
        timer.remove();
        this.longPressTimers.delete(slotIndex);
      }

      // Вернуть масштаб
      this.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
        ease: 'Power2',
      });
    });

    return container;
  }

  /**
   * Обработка короткого тапа по карте — выбор для активации
   */
  private handleCardTap(slotIndex: number, isBlocked: boolean, cardCount: number): void {
    // Если карта заблокирована — показать ошибку
    if (isBlocked) {
      // Тактильный отклик ошибки
      if (typeof HapticManager !== 'undefined') {
        HapticManager.trigger('error');
      }

      // Показать сообщение о причине
      if (cardCount <= 0) {
        this.showTemporaryMessage('Нет карт на складе!');
      } else {
        this.showTemporaryMessage('Карта на перезарядке!');
      }
      return;
    }

    // Если уже активируется другая карта — отменить
    if (this.abilityManager.isActivating()) {
      this.abilityManager.cancelActivation();
      this.selectedCardSlotIndex = null;
    } else if (this.abilityManager.canActivateCard(slotIndex)) {
      // Активировать выбор карты
      try {
        AudioManager.getInstance().playSFX('sfx_click');
      } catch (e) {
        // AudioManager может быть недоступен
      }

      if (typeof HapticManager !== 'undefined') {
        HapticManager.trigger('light');
      }

      this.selectedCardSlotIndex = slotIndex;
      this.abilityManager.startCardActivation(slotIndex);
    }

    // Обновить UI панели карт
    this.updateCardPanelUI();
  }

  /**
   * Показать увеличенную карту на весь экран для чтения описания
   */
  private showEnlargedCard(card: CardDefinition, cardCount: number, isBlocked: boolean): void {
    // Предотвратить повторное открытие
    if (this.isCardEnlarged) return;
    this.isCardEnlarged = true;

    const { width, height } = this.cameras.main;

    // Создать контейнер для увеличенной карты
    this.enlargedCardContainer = this.add.container(width / 2, height / 2);
    this.enlargedCardContainer.setDepth(500); // Поверх всего UI

    // ===== ЗАТЕМНЁННЫЙ ФОН =====
    const dimBackground = this.add.rectangle(
      0, 0,
      width * 2, // С запасом
      height * 2,
      0x000000,
      0.75
    );
    dimBackground.setInteractive(); // Блокирует клики под собой
    this.enlargedCardContainer.add(dimBackground);

    // ===== УВЕЛИЧЕННАЯ КАРТА =====
    const textureKey = `card_${card.id}`;
    
    // Рассчитать масштаб: карта занимает 85% высоты экрана
    const targetHeight = height * this.ENLARGED_CARD_SCALE;
    const cardScale = targetHeight / 900;

    let cardImage: Phaser.GameObjects.Image;
    
    if (this.textures.exists(textureKey)) {
      cardImage = this.add.image(0, 0, textureKey);
    } else {
      // Fallback если текстура не найдена
      cardImage = this.add.image(0, 0, 'card_back');
    }
    
    // Начальный масштаб для анимации (80% от целевого)
    cardImage.setScale(cardScale * 0.8);
    cardImage.setInteractive();
    this.enlargedCardContainer.add(cardImage);

    // ===== СЧЁТЧИК КАРТ НА УВЕЛИЧЕННОЙ КАРТЕ =====
    const scaledWidth = 600 * cardScale;
    const scaledHeight = 900 * cardScale;

    const badgeContainer = this.add.container(
      scaledWidth / 2 - 30,
      -scaledHeight / 2 + 30
    );

    const badgeBg = this.add.circle(0, 0, 24, isBlocked ? 0x880000 : 0x008800);
    badgeBg.setStrokeStyle(3, 0xffffff);
    badgeContainer.add(badgeBg);

    const badgeText = this.add.text(0, 0, `x${cardCount}`, {
      fontSize: '16px',
      fontFamily: 'Orbitron, sans-serif',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    badgeContainer.add(badgeText);

    this.enlargedCardContainer.add(badgeContainer);

    // ===== ПОДСКАЗКА ЗАКРЫТИЯ =====
    const hintText = this.add.text(0, scaledHeight / 2 + 50, 'Нажмите, чтобы закрыть', {
      fontSize: '16px',
      fontFamily: 'Orbitron, sans-serif',
      color: '#888888',
    }).setOrigin(0.5);
    this.enlargedCardContainer.add(hintText);

    // ===== АНИМАЦИЯ ПОЯВЛЕНИЯ =====
    this.enlargedCardContainer.setAlpha(0);

    // Плавное появление фона
    this.tweens.add({
      targets: this.enlargedCardContainer,
      alpha: 1,
      duration: 150,
      ease: 'Power2',
    });

    // Эффект "выпрыгивания" карты
    this.tweens.add({
      targets: cardImage,
      scale: cardScale,
      duration: 250,
      ease: 'Back.easeOut',
    });

    // ===== ОБРАБОТЧИКИ ЗАКРЫТИЯ =====
    const closeEnlargedCard = () => {
      this.hideEnlargedCard();
    };

    dimBackground.on('pointerdown', closeEnlargedCard);
    cardImage.on('pointerdown', closeEnlargedCard);
  }

  /**
   * Скрыть увеличенную карту с анимацией
   */
  private hideEnlargedCard(): void {
    if (!this.isCardEnlarged || !this.enlargedCardContainer) return;

    // Анимация исчезновения
    this.tweens.add({
      targets: this.enlargedCardContainer,
      alpha: 0,
      duration: 120,
      ease: 'Power2',
      onComplete: () => {
        if (this.enlargedCardContainer) {
          this.enlargedCardContainer.destroy();
          this.enlargedCardContainer = undefined;
        }
        this.isCardEnlarged = false;
      },
    });
  }

  /**
   * Показать временное сообщение на экране (исчезает через 1.5 секунды)
   */
  private showTemporaryMessage(message: string): void {
    const { width, height } = this.cameras.main;

    const messageText = this.add.text(width / 2, height - 160, message, {
      fontSize: '20px',
      fontFamily: 'Orbitron, sans-serif',
      color: '#ff5555',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(200);

    // Анимация: всплытие вверх + исчезновение
    this.tweens.add({
      targets: messageText,
      alpha: 0,
      y: height - 200,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => {
        messageText.destroy();
      },
    });
  }

  /**
   * вњ… Р"РћР'РђР'Р›Р•РќРћ: Р'РёР·СѓР°Р»СЊРЅС‹Р№ С„РёРґР±РµРє РїСЂРё РїРѕРїС‹С‚РєРµ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ РєР°СЂС‚Сѓ РЅР° РєСѓР»РґР°СѓРЅРµ
   */
  private showCooldownFeedback(): void {
    if (!this.cardPanel) return;
    
    // Shake effect
    this.tweens.add({
      targets: this.cardPanel,
      x: this.cardPanel.x + 5,
      duration: 50,
      yoyo: true,
      repeat: 3,
    });
  }

  /**
   * вњ… Р”РћР‘РђР’Р›Р•РќРћ: РўР°Р№РјРµСЂ РѕР±РЅРѕРІР»РµРЅРёСЏ UI РєСѓР»РґР°СѓРЅР°
   */
  private startCooldownTimer(): void {
    // РћС‡РёС‰Р°РµРј РїСЂРµРґС‹РґСѓС‰РёР№ С‚Р°Р№РјРµСЂ РµСЃР»Рё РµСЃС‚СЊ
    if (this.cooldownTimer) {
      this.cooldownTimer.destroy();
    }

    // РћР±РЅРѕРІР»СЏРµРј UI РєР°Р¶РґСѓСЋ СЃРµРєСѓРЅРґСѓ РїРѕРєР° РµСЃС‚СЊ РєСѓР»РґР°СѓРЅ
    this.cooldownTimer = this.time.addEvent({
      delay: 1000,
      callback: () => {
        const remaining = this.abilityManager.getCooldownRemaining();
        // Guard against redraw while enlarged card or tooltip is active
        if (!this.isCardTooltipOpen && !this.isCardEnlarged) {
          if (remaining > 0) {
            this.updateCardPanelUI();
          } else {
            this.cooldownTimer?.destroy();
            this.cooldownTimer = undefined;
            this.updateCardPanelUI();
          }
        }
      },
      loop: true,
    });
  }

  private getCardSymbol(cardId: string): string {
    const symbols: Record<string, string> = {
      magma_lava: 'рџЊ‹', magma_molten: 'рџ”Ґ', magma_meteor: 'в„пёЏ',
      cyborg_shield: 'рџ›ЎпёЏ', cyborg_tether: 'вљЎ', cyborg_barrier: 'рџ§±',
      void_swap: 'рџ”„', void_ghost: 'рџ‘»', void_wormhole: 'рџЊЂ',
      insect_toxin: 'вЈпёЏ', insect_mimic: 'рџЋ­', insect_parasite: 'рџ§ ',
    };
    return symbols[cardId] || 'вњ¦';
  }

  // ========== CARD INFO POPUP (RU Localization) ==========

  /**
   * вњ… Task A: Show card tooltip (used for long-press and cooldown feedback)
   */
  private showCardTooltip(
    cardContainer: Phaser.GameObjects.Container,
    card: ReturnType<typeof getCard>,
    slotIndex: number,
    cooldownSeconds?: number
  ): void {
    if (!card) return;

    const panelWorldX = this.cardPanel!.x + cardContainer.x;
    const panelWorldY = this.cardPanel!.y + cardContainer.y;
    
    this.showCardInfo(slotIndex, card.id, panelWorldX, panelWorldY, cooldownSeconds);
  }

  /**
   * вњ… 2. Show card info tooltip/popup with Russian localization
   */
  private showCardInfo(slotIndex: number, cardId: string, worldX: number, worldY: number, cooldownSeconds?: number): void {
    this.hideCardInfo(); // Remove previous popup if exists

    const card = getCard(cardId);
    if (!card) return;

    const cardText = CARD_TEXT_RU[cardId];
    const name = cardText?.name || card.name;
    const desc = cardText?.desc || card.description || 'РћРїРёСЃР°РЅРёРµ РЅРµРґРѕСЃС‚СѓРїРЅРѕ';
    const targetHint = cardText?.target || getTargetHintRU(card.targetType);

    const { width, height } = this.cameras.main;
    
    // Position popup above the card panel (or near the card)
    const panelY = height - 80;
    const popupY = panelY - 140;
    const popupX = Math.max(150, Math.min(width - 150, worldX));
    
    const popupWidth = Math.min(300, width - 40);
    const popupPadding = 16;

    this.cardInfoPopup = this.add.container(popupX, popupY);
    this.cardInfoPopup.setDepth(30000);
    // вњ… Task B: Ensure tooltip does NOT capture input - do not set interactive

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a15, 0.98);
    const popupHeight = cooldownSeconds ? 200 : 180;
    bg.fillRoundedRect(-popupWidth / 2, 0, popupWidth, popupHeight, 12);
    bg.lineStyle(2, cooldownSeconds ? 0xff6b6b : 0x00f2ff, 0.8);
    bg.strokeRoundedRect(-popupWidth / 2, 0, popupWidth, popupHeight, 12);
    this.cardInfoPopup.add(bg);

    // Title
    // ✅ ИСПРАВЛЕНО: Используем TextFactory для чётких шрифтов
    const titleText = createText(this, Math.round(0), Math.round(12), name, {
      size: 'lg',
      font: 'primary',
      color: '#ffffff',
    }).setOrigin(0.5, 0);
    this.cardInfoPopup.add(titleText);

    // Description
    // ✅ ИСПРАВЛЕНО: Используем TextFactory для чётких шрифтов
    const descText = createText(this, Math.round(0), Math.round(42), desc, {
      size: 'sm',
      font: 'primary',
      color: '#cccccc',
      maxWidth: popupWidth - popupPadding * 2,
    });
    descText.setOrigin(0.5, 0);
    descText.setLineSpacing(4);
    this.cardInfoPopup.add(descText);

    // Cooldown message if applicable
    let currentY = descText.y + descText.height + 12;
    if (cooldownSeconds !== undefined && cooldownSeconds > 0) {
      // ✅ ИСПРАВЛЕНО: Используем TextFactory для чётких шрифтов
      const cooldownText = createText(this, Math.round(0), Math.round(currentY), UI_RU.cooldown(cooldownSeconds), {
        size: 'sm',
        font: 'primary',
        color: '#ff6b6b',
      }).setOrigin(0.5, 0);
      this.cardInfoPopup.add(cooldownText);
      currentY += 24;
    }

    // Target hint
    if (targetHint && !cooldownSeconds) {
      // ✅ ИСПРАВЛЕНО: Используем TextFactory для чётких шрифтов
      const targetText = createText(this, Math.round(0), Math.round(currentY), targetHint, {
        size: 'xs',
        font: 'primary',
        color: '#00f2ff',
        fontStyle: 'italic',
      }).setOrigin(0.5, 0);
      this.cardInfoPopup.add(targetText);
    }

    // Fade-in animation
    this.cardInfoPopup.setAlpha(0);
    this.tweens.add({
      targets: this.cardInfoPopup,
      alpha: 1,
      duration: 150,
      ease: 'Quad.easeOut',
    });
  }

  /**
   * Show card info with cooldown message
   */
  private showCardInfoWithCooldown(slotIndex: number, cardId: string, worldX: number, worldY: number, cooldownSeconds: number): void {
    this.showCardInfo(slotIndex, cardId, worldX, worldY, cooldownSeconds);
  }

  /**
   * вњ… Task 2: Hide card info popup
   */
  /**
   * вњ… Task A: Hide card tooltip
   */
  private hideCardTooltip(): void {
    this.hideCardInfo();
  }

  private hideCardInfo(): void {
    if (this.cardInfoPopup) {
      this.cardInfoPopup.destroy();
      this.cardInfoPopup = undefined;
    }
    const wasOpen = this.isCardTooltipOpen;
    this.isCardTooltipOpen = false; // вњ… Task C: Reset flag
    this.selectedCardSlotIndex = null;
    this.applyCardSlotSelectionVisuals(); // Reset scales
    
    // вњ… Task C: Refresh UI after tooltip closes (if it was open)
    if (wasOpen) {
      this.updateCardPanelUI();
    }
  }

  /**
   * вњ… Task 2: Apply selection visuals to card slots
   * Finds containers by name and sets scale
   */
  private applyCardSlotSelectionVisuals(): void {
    if (!this.cardPanel) return;
    
    const deck = this.abilityManager.getDeck();
    deck.forEach((slot, index) => {
      // вњ… Task 2: Find container by name
      const slotContainer = this.cardPanel!.getByName(`card_slot_${index}`) as Phaser.GameObjects.Container;
      if (slotContainer) {
        if (index === this.selectedCardSlotIndex) {
          slotContainer.setScale(1.15);
        } else {
          slotContainer.setScale(1.0);
        }
      }
    });
  }
  
  /**
   * вњ… Task 2: Select card slot (sets selection state and shows info)
   */
  private selectCardSlot(slotIndex: number, cardId: string, x: number, y: number): void {
    this.selectedCardSlotIndex = slotIndex;
    this.applyCardSlotSelectionVisuals();
    this.showCardInfo(slotIndex, cardId, x, y);
  }

  private subscribeToEvents(): void {
    this.eventHandlers.forEach((handler, eventName) => {
      try {
        eventBus.unsubscribe(eventName as GameEvents, handler as any, this);
      } catch {
        /* noop */
      }
    });
    this.eventHandlers.clear();
    
    // UI_TIMER_UPDATED
    const onTimerUpdated = (payload: { remaining: number; total: number }) => {
      this.gameHUD?.updateMatchTimer(payload.remaining, payload.total);
    };
    this.eventHandlers.set(GameEvents.UI_TIMER_UPDATED, onTimerUpdated);
    eventBus.subscribe(GameEvents.UI_TIMER_UPDATED, onTimerUpdated, this);

    // UI_SCORE_UPDATED
    const onScoreUpdated = (payload: { player1: number; player2: number }) => {
      this.gameHUD?.updateScore(payload.player1, payload.player2);
    };
    this.eventHandlers.set(GameEvents.UI_SCORE_UPDATED, onScoreUpdated);
    eventBus.subscribe(GameEvents.UI_SCORE_UPDATED, onScoreUpdated, this);

    // CARD_ACTIVATED
    const onCardActivated = () => {
      this.updateCardPanelUI();
    };
    this.eventHandlers.set(GameEvents.CARD_ACTIVATED, onCardActivated);
    eventBus.subscribe(GameEvents.CARD_ACTIVATED, onCardActivated, this);

    // HAPTIC_FEEDBACK
    const onHapticFeedback = (payload: HapticFeedbackPayload) => {
      HapticManager.trigger(payload.type);
    };
    this.eventHandlers.set(GameEvents.HAPTIC_FEEDBACK, onHapticFeedback);
    eventBus.subscribe(GameEvents.HAPTIC_FEEDBACK, onHapticFeedback, this);

    // Пассивки: подписи на поле + компактная полоска + лёгкая вибрация (Telegram / Vibration API)
    const onPassiveActivated = (data: { x: number; y: number; text: string; color: number }) => {
      const label = `Пассивка: ${data.text}`;
      this.showPassiveFloatingLabel(data.x, data.y, label, data.color);
      this.showPassiveHudBanner(label, data.color);
      this.pulsePassiveFeedbackThrottled();
    };
    this.eventHandlers.set(GameEvents.PASSIVE_ACTIVATED, onPassiveActivated);
    eventBus.subscribe(GameEvents.PASSIVE_ACTIVATED, onPassiveActivated, this);

    const onUnitTeleportPassive = (data: { unitId: string; x: number; y: number }) => {
      const unit = this.getUnitById(data.unitId);
      if (unit && unit instanceof Unit) {
        unit.teleportTo?.(data.x, data.y);
        this.vfxManager?.playTeleportEffect?.(data.x, data.y, 0x6366f1);
      }
    };
    this.eventHandlers.set(GameEvents.UNIT_TELEPORT, onUnitTeleportPassive);
    eventBus.subscribe(GameEvents.UNIT_TELEPORT, onUnitTeleportPassive, this);

    const onPassivePush = (data: { targetUnitId: string; pushX: number; pushY: number }) => {
      const unit = this.getUnitById(data.targetUnitId);
      if (unit) {
        unit.applyForce(data.pushX * 0.01, data.pushY * 0.01);
      }
      HapticManager.trigger('medium');
    };
    this.eventHandlers.set(GameEvents.PASSIVE_PUSH, onPassivePush);
    eventBus.subscribe(GameEvents.PASSIVE_PUSH, onPassivePush, this);

    const onBallPassThrough = (data: { count: number }) => {
      this.ball.setPassThroughCount(data.count);
    };
    this.eventHandlers.set(GameEvents.BALL_PASS_THROUGH, onBallPassThrough);
    eventBus.subscribe(GameEvents.BALL_PASS_THROUGH, onBallPassThrough, this);

    const onCreateLavaPoolPassive = (data: { x: number; y: number }) => {
      if (this.abilityManager) {
        this.abilityManager.createLavaPoolAt(data.x, data.y);
      }
    };
    this.eventHandlers.set(GameEvents.CREATE_LAVA_POOL, onCreateLavaPoolPassive);
    eventBus.subscribe(GameEvents.CREATE_LAVA_POOL, onCreateLavaPoolPassive, this);

    // OLD: Removed old PVP event sending (handled by pvpHelper/server now)
  }

  private unsubscribeFromEvents(): void {
    // Правильная отписка с использованием сохранённых ссылок на обработчики
    this.eventHandlers.forEach((handler, eventName) => {
      try {
        eventBus.unsubscribe(eventName as GameEvents, handler as any, this);
      } catch (e) {
        console.warn('[GameScene] Failed to unsubscribe from:', eventName);
      }
    });
    this.eventHandlers.clear();
  }

  // ============================================================
  // EVENT HANDLERS
  // ============================================================

  private onGoal(data: { player: PlayerNumber; newScore: { player1: number; player2: number } }): void {
    // ✅ FIX: Защита от повторного вызова для одного и того же гола
    // Используем флаг вместо проверки фазы, т.к. событие приходит уже в фазе GOAL
    if (this.isProcessingGoal) return;
    this.isProcessingGoal = true;

    const isMyGoal = data.player === 1;
    
    // === УЛУЧШЕННЫЕ ЭФФЕКТЫ ===
    
    // 1. Звуки гола (goal.mp3 + flame_burst.mp3 + goal_crowd.mp3)
    AudioManager.getInstance().playGoalSounds(isMyGoal);
    
    // 2. Улучшенная вибрация
    HapticManager.triggerGoalVibration(isMyGoal);
    
    // 3. Эффекты пламени у ворот (4.7 сек - синхронно с flame_burst.mp3)
    const isTopGoal = data.player === 1;
    
    if (this.fieldBounds && this.vfxManager) {
      const goalY = isTopGoal ? this.fieldBounds.top : this.fieldBounds.bottom;
      const fieldScale = this.fieldBounds.width / 600;
      const halfGoalWidth = (GOAL.WIDTH * fieldScale) / 2;
      const goalLeftX = this.fieldBounds.centerX - halfGoalWidth;
      const goalRightX = this.fieldBounds.centerX + halfGoalWidth;
      
      // Получаем фракцию команды, которая забила гол
      const state = this.getState();
      const factionId = isTopGoal ? (state?.opponentFaction || this.storedOpponentFaction) : (state?.playerFaction || this.storedPlayerFaction);
      
      this.vfxManager.playGoalFlameEffect(
        goalY,
        goalLeftX,
        goalRightX,
        factionId,
        isTopGoal
      );
    }
    
    // 4. Тряска камеры
    this.cameras.main.shake(200, isMyGoal ? 0.008 : 0.005);
    
    // === СУЩЕСТВУЮЩИЙ КОД ===
    this.announcer.announceGoal();
    this.celebrationManager.showGoalCelebration(isMyGoal);
    
    // вњ… Trigger CampaignDialogueSystem goal events
    if (this.isCampaignMode) {
      if (data.player === 1) {
        this.campaignDialogue?.onPlayerGoal();
      } else {
        this.campaignDialogue?.onEnemyGoal();
      }
    }

    // вњ… B. Clear targeting UI on goal
    if (this.abilityManager.isActivating()) {
      this.abilityManager.cancelActivation();
    }
    this.abilityManager.forceClearTargetingUI();
    this.hideCardInfo();

    if (this.aiController) {
      this.aiController.updateScore(data.newScore.player1, data.newScore.player2);
      this.aiController.recordGoal(data.player === 1 ? 'player' : 'ai');
    }

    this.abilityButton.hide();
    this.cardPanel?.setVisible(false);
    this.shootingController.setEnabled(false);
    this.isAbilityInputActive = false;

    this.lassoController?.cancel();

    // вњ… РќРћР’РћР•: РЎРѕС…СЂР°РЅСЏРµРј СЃРѕСЃС‚РѕСЏРЅРёРµ РјР°С‚С‡Р° РїРѕСЃР»Рµ РіРѕР»Р°
    this.saveMatchProgress();

    // ✅ SessionPersistence: сохраняем состояние матча при каждом голе
    try {
      const state = this.getState();
      SessionPersistence.saveMatchState({
        score: [data.newScore.player1, data.newScore.player2],
        turn: this.matchDirector?.getTurnNumber?.() ?? 0,
        playerFaction: state?.playerFaction,
        opponentFaction: state?.opponentFaction,
        mode: this.matchContext || 'freeplay',
      });
    } catch (e) {
      // ignore
    }

    this.time.delayedCall(GAME.GOAL_DELAY, () => {
      this.celebrationManager.hide();
      this.matchDirector.continueAfterGoal();
      this.resetPositions();
      AudioManager.getInstance().playSFX('sfx_whistle', { volume: 0.5 });
      this.isProcessingGoal = false; // Сброс флага после завершения обработки гола
    });
  }

  private onMatchEnd(data: { result: MatchResult }): void {
    const { result } = data;
    
    // вњ… B. Clear targeting UI on match end
    if (this.abilityManager.isActivating()) {
      this.abilityManager.cancelActivation();
    }
    this.abilityManager.forceClearTargetingUI();
    this.hideCardInfo();
    
    // вњ… Tutorial: Special handling for tutorial level (1-1)
    // вњ… BUG FIX: Skip dialogueAfterWin for tutorial - go directly to result screen
    const isTutorialLevel = this.isCampaignMode && this.campaignLevelConfig?.id === '1-1';
    
    // вњ… Trigger CampaignDialogueSystem match end events (skip for tutorial)
    if (this.isCampaignMode && !isTutorialLevel) {
      this.campaignDialogue?.onMatchEnd(result.isWin);
    }
    
    if (isTutorialLevel && result.isWin) {
      // Mark tutorial as complete
      if (!playerData.hasCompletedFirstMatchTutorial()) {
        playerData.completeFirstMatchTutorial();
        playerData.setPendingPostWinMenuTour(true);
        playerData.setPostWinMenuTourStep('menu');
        console.log('[GameScene] Tutorial completed, post-win tour pending');
      }
      
      // вњ… FIX: Show special tutorial result screen, then go to MainMenu
      // Apply tutorial rewards: 500 coins
      playerData.addCoins(500);
      
      this.shootingController.setEnabled(false);
      this.abilityButton.hide();
      this.cardPanel?.setVisible(false);
      this.gameHUD.setPauseEnabled(false);
      this.isAbilityInputActive = false;

      if (this.aiController) this.aiController.stop();
      if (this.cooldownTimer) {
        this.cooldownTimer.destroy();
        this.cooldownTimer = undefined;
      }

      AudioManager.getInstance().stopAmbience();
      AudioManager.getInstance().playSFX('sfx_whistle');
      // ✅ ИСПРАВЛЕНО: Используем playResultMusic() для длинных треков
      this.time.delayedCall(500, () => {
        AudioManager.getInstance().playResultMusic('sfx_win');
      });
      this.announcer.announceResult(true);
      
      // Show tutorial result screen (it will handle transition to MainMenu)
      this.showResultScreen(result);

      // ✅ SessionPersistence: матч завершён нормально
      SessionPersistence.clear();
      return;
    }
    
    this.shootingController.setEnabled(false);
    this.abilityButton.hide();
    this.cardPanel?.setVisible(false);
    this.gameHUD.setPauseEnabled(false);
    this.isAbilityInputActive = false;

    if (this.aiController) this.aiController.stop();
    if (this.cooldownTimer) {
      this.cooldownTimer.destroy();
      this.cooldownTimer = undefined;
    }

    AudioManager.getInstance().stopAmbience();
    AudioManager.getInstance().playSFX('sfx_whistle');
    // ✅ ИСПРАВЛЕНО: Используем playResultMusic() для длинных треков
    this.time.delayedCall(500, () => {
      if (result.isWin) {
        AudioManager.getInstance().playResultMusic('sfx_win');
      } else if (result.isDraw) {
        // Для ничьей используем sfx_draw если есть, иначе fallback на sfx_win
        const hasDraw =
          ((this.cache as any).audio?.exists?.('sfx_draw') ?? false) ||
          this.cache.audio.has('sfx_draw');
        AudioManager.getInstance().playResultMusic(hasDraw ? 'sfx_draw' : 'sfx_win');
      } else {
        AudioManager.getInstance().playResultMusic('sfx_lose');
      }
    });

    this.announcer.announceMatchOutcome(
      result.isDraw ? 'draw' : result.isWin ? 'win' : 'loss'
    );
    
    // вњ… League & Tournament: РћР±СЂР°Р±РѕС‚РєР° СЂРµР·СѓР»СЊС‚Р°С‚РѕРІ
    this.handleMatchResult(result);
    
    this.showResultScreen(result);

    // ✅ SessionPersistence: матч завершён нормально
    SessionPersistence.clear();
  }
  
  private handleMatchResult(result: MatchResult): void {
    // рџЋЇ РћР±РЅРѕРІР»СЏРµРј РµР¶РµРґРЅРµРІРЅС‹Рµ Р·Р°РґР°РЅРёСЏ
    this.updateDailyTasks(result);
    
    if (this.matchContext === 'league') {
      this.handleLeagueResult(result);
    } else if (this.matchContext === 'tournament') {
      this.handleTournamentResult(result);
    }
  }
  
  /**
   * РћР±РЅРѕРІРёС‚СЊ РїСЂРѕРіСЂРµСЃСЃ РµР¶РµРґРЅРµРІРЅС‹С… Р·Р°РґР°РЅРёР№
   */
  private updateDailyTasks(result: MatchResult): void {
    try {
      // #region agent log
      // ✅ REMOVED: fetch запросы для логирования - используем ProductionLogger
      // #endregion
      
      // Р”РёРЅР°РјРёС‡РµСЃРєРёР№ РёРјРїРѕСЂС‚ РґР»СЏ РёР·Р±РµР¶Р°РЅРёСЏ С†РёРєР»РёС‡РµСЃРєРёС… Р·Р°РІРёСЃРёРјРѕСЃС‚РµР№
      import('../data/DailyTasks').then(({ dailyTasksManager }) => {
        // #region agent log
        // ✅ REMOVED: fetch запросы для логирования - используем ProductionLogger
        // #endregion
        
        // РЎС‹РіСЂР°С‚СЊ РјР°С‚С‡
        dailyTasksManager.updateTaskProgress('play_matches', 1);
        
        // РџРѕР±РµРґР°
        if (result.isWin) {
          dailyTasksManager.updateTaskProgress('win_matches', 1);
        }
        
        // Р“РѕР»С‹
        dailyTasksManager.updateTaskProgress('score_goals', result.playerGoals);
        
        // РљР°РјРїР°РЅРёСЏ
        if (this.isCampaignMode && result.isWin) {
          dailyTasksManager.updateTaskProgress('complete_campaign', 1);
        }
        
        // Р›РёРіР°
        if (this.matchContext === 'league') {
          dailyTasksManager.updateTaskProgress('play_league', 1);
        }
      }).catch((error) => {
        // #region agent log
        // ✅ REMOVED: fetch запросы для логирования - используем ProductionLogger
        // #endregion
        console.warn('[GameScene] Failed to import DailyTasks:', error);
      });
    } catch (error) {
      // #region agent log
      // ✅ REMOVED: fetch запросы для логирования - используем ProductionLogger
      // #endregion
      console.warn('[GameScene] Failed to update daily tasks:', error);
    }
  }
  
  private handleLeagueResult(result: MatchResult): void {
    const data = playerData.get();
    const leagueProgress = data.leagueProgress;
    
    if (!leagueProgress) {
      console.warn('[GameScene] No league progress found');
      return;
    }
    
    // вњ… РРЎРџР РђР’Р›Р•РќРћ: updateStats СѓР¶Рµ РІС‹Р·РІР°РЅ РІ MatchController/RewardCalculator
    // currentWinStreak СѓР¶Рµ РѕР±РЅРѕРІР»С‘РЅ, РїРѕСЌС‚РѕРјСѓ РїСЂРѕРІРµСЂСЏРµРј >= 3 (СЌС‚Рѕ РѕР·РЅР°С‡Р°РµС‚ 3+ РїРѕРґСЂСЏРґ)
    const currentStreak = data.stats.currentWinStreak || 0;
    const isWinStreak = result.isWin && currentStreak >= 3;
    
    console.log(`[GameScene] League match result: ${result.isWin ? 'Win' : 'Loss'}, streak: ${currentStreak}, isWinStreak: ${isWinStreak}`);
    
    // ✅ Сохраняем старые значения ДО применения результата
    const oldStars = leagueProgress.stars;
    const oldTier = leagueProgress.currentTier;
    const oldDivision = leagueProgress.division;
    
    // Применяем результат матча
    const newProgress = LeagueManager.applyMatchResult(leagueProgress, result, isWinStreak);
    const newStars = newProgress.stars;
    const newTier = newProgress.currentTier;
    const newDivision = newProgress.division;
    
    const starsDiff = newStars - oldStars;
    console.log(`[GameScene] Stars: ${oldStars} -> ${newStars} (${starsDiff > 0 ? '+' : ''}${starsDiff})`);
    
    if (oldTier !== newTier || oldDivision !== newDivision) {
      console.log(`[GameScene] Rank changed: ${oldTier} ${oldDivision} -> ${newTier} ${newDivision}`);
    }
    
    data.leagueProgress = newProgress;
    
    // ✅ Сохраняем данные для передачи в LeagueScene
    this.leagueResultData = {
      oldStars,
      oldTier,
      oldDivision,
      matchResult: result.isWin ? 'win' : (result.isDraw ? 'draw' : 'loss'),
      showOrbitDecay: LeagueManager.shouldTriggerOrbitDecay(newProgress, result)
    };
    
    playerData.save();
    console.log('[GameScene] League progress saved');
    console.log('[GameScene] League result data saved:', this.leagueResultData);

    // ✅ Dispatch события для недельных заданий (победа в лиге)
    if (result.isWin) {
      try {
        eventBus.dispatch(GameEvents.LEAGUE_MATCH_WON, {
          oldStars,
          newStars: newProgress.stars,
          tier: String(newProgress.currentTier),
        });
      } catch (e) {
        console.warn('[GameScene] Failed to dispatch LEAGUE_MATCH_WON:', e);
      }
    }
  }
  
  private handleTournamentResult(result: MatchResult): void {
    if (!this.tournamentId || !this.seriesId) {
      console.warn('[GameScene] Tournament result but no tournamentId/seriesId');
      return;
    }
    
    const data = playerData.get();
    let tournament = data.activeTournament;
    
    if (!tournament || tournament.id !== this.tournamentId) {
      console.warn('[GameScene] Tournament not found in player data');
      return;
    }
    
    // РќР°С…РѕРґРёРј СЃРµСЂРёСЋ РјР°С‚С‡РµР№
    const series = tournament.matches.find(m => m.id === this.seriesId);
    if (!series) {
      console.warn('[GameScene] Series not found in tournament');
      return;
    }
    
    // РћРїСЂРµРґРµР»СЏРµРј ID РёРіСЂРѕРєР° Рё СЃРѕРїРµСЂРЅРёРєР°
    const playerId = data.id;
    const isPlayerA = series.playerA === playerId;
    const opponentId = isPlayerA ? series.playerB : series.playerA;
    
    // РЎРѕР·РґР°С‘Рј MatchResultSummary
    const matchSummary = {
      playerAId: series.playerA,
      playerBId: series.playerB,
      winnerId: result.isWin ? (isPlayerA ? series.playerA : series.playerB) : 
                result.isDraw ? undefined : opponentId,
      goalsA: isPlayerA ? result.playerGoals : result.opponentGoals,
      goalsB: isPlayerA ? result.opponentGoals : result.playerGoals,
      isDraw: result.isDraw,
    };
    
    // РћР±РЅРѕРІР»СЏРµРј СЃРµСЂРёСЋ
    const updatedSeries = TournamentManager.updateSeriesWithMatch(series, matchSummary);
    
    // РћР±РЅРѕРІР»СЏРµРј С‚СѓСЂРЅРёСЂ
    tournament.matches = tournament.matches.map(m => 
      m.id === this.seriesId ? updatedSeries : m
    );
    
    // Р•СЃР»Рё СЃРµСЂРёСЏ Р·Р°РІРµСЂС€РµРЅР°, РїСЂРѕРґРІРёРіР°РµРј РїРѕР±РµРґРёС‚РµР»СЏ
    if (TournamentManager.isSeriesFinished(updatedSeries)) {
      tournament = TournamentManager.advanceWinnersToNextRound(tournament);
      
      // Р•СЃР»Рё РёРіСЂРѕРє РІС‹РёРіСЂР°Р» СЃРµСЂРёСЋ, РѕР±РЅРѕРІР»СЏРµРј С‚РµРєСѓС‰РёР№ СЂР°СѓРЅРґ
      if (updatedSeries.winnerId === playerId) {
        // РРіСЂРѕРє РїСЂРѕС€С‘Р» РґР°Р»СЊС€Рµ
        console.log(`[GameScene] Player advanced to next round: ${tournament.currentRound}`);
      } else {
        // РРіСЂРѕРє РІС‹Р»РµС‚РµР»
        console.log(`[GameScene] Player eliminated from tournament`);
        // РњРѕР¶РЅРѕ РїРѕРєР°Р·Р°С‚СЊ РјРѕРґР°Р» "Second Chance" РµСЃР»Рё СЌС‚Рѕ СЂР°СѓРЅРґ 1/8
        if (this.round === '16') {
          // TODO: РџРѕРєР°Р·Р°С‚СЊ РјРѕРґР°Р» Second Chance
        }
      }
    }
    
    // РЎРѕС…СЂР°РЅСЏРµРј РѕР±РЅРѕРІР»С‘РЅРЅС‹Р№ С‚СѓСЂРЅРёСЂ
    data.activeTournament = tournament;
    playerData.save();
  }

  private onTurnChange(data: { player: PlayerNumber; turnNumber: number }): void {
    const { player } = data;

    this.lassoController?.cancel();
    this.lassoButton?.setCurrentCap(null);
    this.lassoButton?.hide();

    this.captainMatchSystem?.onTurnOwnerChanged(player);
    
    // Cleanup previous state
    if (this.abilityManager.isActivating()) this.abilityManager.cancelActivation();
    this.abilityManager.forceClearTargetingUI();
    this.hideCardInfo();
    this.abilityManager.onTurnEnd(this.lastShootingCap);
    this.player2AbilityManager?.onTurnEnd();
    this.updateCardPanelUI();
    this.lastShootingCap = undefined;
    this.selectedCapId = undefined;
    this.aiTurnScheduled = false;
    this.isAbilityInputActive = false;

    this.updateCapsAuraState();

    const hudScore = this.matchDirector.getScore();
    const hudPhase = this.matchDirector.getPhase();
    const hudCurrentPlayer = this.matchDirector.getCurrentPlayer();
    this.gameHUD.updateScore(hudScore.player1, hudScore.player2);
    this.gameHUD.updateTurn(hudCurrentPlayer, hudPhase, this.isAIEnabled);
    
    // вњ… РќРћР’РћР•: РЎРѕС…СЂР°РЅСЏРµРј СЃРѕСЃС‚РѕСЏРЅРёРµ РјР°С‚С‡Р° РїРѕСЃР»Рµ СЃРјРµРЅС‹ С…РѕРґР°
    this.saveMatchProgress();

    // Check for blocking UI
    const isDialogueBlocking = this.campaignDialogue?.isBlockingInput() ?? false;
    const isTutorialBlocking = this.tutorialOverlay?.isActive() && this.tutorialOverlay.visible;
    const isBlocked = isDialogueBlocking || isTutorialBlocking;

    // ✅ NEW PVP: Обработка смены ходов
    if (this.isRealtimePvP) {
      const myOwner = this.getMyOwner();
      const isMyTurn = player === myOwner;
      
      if (isMyTurn) {
        // Мой ход в PVP
        this.shootingController.setEnabled(!isBlocked);
        this.cardPanel?.setVisible(!isBlocked && this.abilityManager.getAvailableCards().length > 0);
      } else {
        // Ход оппонента в PVP
        this.shootingController.setEnabled(false);
        this.cardPanel?.setVisible(false);
      }
      
      if (this.aiController) this.aiController.stop();
    } else if (player === 1) {
      // Player turn (не PVP)
      this.shootingController.setEnabled(!isBlocked);
      this.cardPanel?.setVisible(!isBlocked && this.abilityManager.getAvailableCards().length > 0);
      if (this.aiController) this.aiController.stop();
    } else if (this.aiController) {
      // AI Turn (не PVP)
      this.shootingController.setEnabled(false);
      this.cardPanel?.setVisible(false);
      
      if (isBlocked) {
        console.log('[GameScene] AI waiting for Nova/Dialogue to finish...');
        return; // AI waits here. The 'update' loop will resume it when UI closes.
      }
      
      this.scheduleAITurn();
    }
  }

  private onTimerWarning(data: { secondsLeft: number }): void {
    AudioManager.getInstance().playSFX('sfx_whistle', { volume: 0.5 });
    
    // вњ… Trigger CampaignDialogueSystem time warning events
    if (this.isCampaignMode) {
      this.campaignDialogue?.onTimeWarning(data.secondsLeft);
    }
  }

  private onCapSelected(cap: any | null): void {
    // вњ… РРіРЅРѕСЂРёСЂСѓРµРј РІС‹Р±РѕСЂ СЋРЅРёС‚Р° РµСЃР»Рё Р°РєС‚РёРІРЅР° СЃРїРѕСЃРѕР±РЅРѕСЃС‚СЊ
    if (this.isAbilityInputActive) {
      console.log('[GameScene] Cap selection ignored - ability input active');
      return;
    }

    if (this.lassoController?.isActive()) {
      if (!cap || cap.id !== this.selectedCapId) {
        this.lassoController.cancel();
      }
    }

    this.selectedCapId = cap?.id;
    this.updateCapsAuraState();

    if (cap && cap instanceof Unit) {
      this.abilityButton.setCurrentUnit(cap);
    } else {
      this.abilityButton.setCurrentUnit(null);
    }

    const myOwner = this.getMyOwner();
    const myTurn = this.matchDirector.getCurrentPlayer() === myOwner;
    const showLasso =
      !this.isRealtimePvP &&
      myTurn &&
      !!cap &&
      cap.owner === myOwner &&
      typeof cap.getCapClass === 'function' &&
      cap.getCapClass() === 'trickster';

    if (showLasso) {
      this.lassoButton?.setCurrentCap(cap as GameUnit);
      this.lassoButton?.show(160, this.scale.height - 100);
    } else {
      this.lassoButton?.setCurrentCap(null);
      this.lassoButton?.hide();
    }
  }

  private handleLassoReleased(capId: string | null): void {
    if (!capId) return;
    const cap = this.caps.find((c) => c.id === capId);
    if (!cap) return;

    if (this.abilityManager.isActivating()) {
      this.abilityManager.cancelActivation();
    }
    this.abilityButton.hide();
    this.cardPanel?.setVisible(false);
    this.abilityManager.forceClearTargetingUI();
    this.hideCardInfo();

    this.shootingController.setEnabled(false);
    this.isAbilityInputActive = false;

    this.lastShootingCap = cap as Unit;
    this.abilityManager.setLastActiveUnit(this.lastShootingCap);
    this.matchDirector.onShot(capId);
  }

  private onShoot(data: ShootEventData): void {
    // ✅ TUTORIAL: Проверка разрешения ввода
    if (this.isTutorialMode && this.tutorialManager) {
      if (!this.tutorialManager.isInputAllowed()) {
        console.log('[GameScene] Input blocked by tutorial (dialogue active or not waiting for action)');
        return;
      }
    }
    
    // вњ… Handle swap as a valid turn action (don't ignore it)
    if (data.isSwap) {
      // Swap consumes the turn - perform cleanup and advance match
      if (this.abilityManager.isActivating()) {
        this.abilityManager.cancelActivation();
      }
      
      this.abilityButton.hide();
      this.cardPanel?.setVisible(false);
      this.shootingController.setEnabled(false);
      this.isAbilityInputActive = false;
      
      this.lastShootingCap = data.cap as any;
      this.abilityManager.setLastActiveUnit(this.lastShootingCap);
      
      // OLD PVP system removed - swap handled by MatchDirector
      
      // вњ… Critical: Advance match so turn transitions properly
      this.matchDirector.onShot(data.cap.id);
      return;
    }
    
    // Normal shot handling (unchanged)
    if (this.abilityManager.isActivating()) {
      this.abilityManager.cancelActivation();
    }

    this.abilityButton.hide();
    this.cardPanel?.setVisible(false);
    // вњ… B. Clear targeting UI on goal
    if (this.abilityManager.isActivating()) {
      this.abilityManager.cancelActivation();
    }
    this.abilityManager.forceClearTargetingUI();
    this.hideCardInfo();

    this.shootingController.setEnabled(false);
    this.isAbilityInputActive = false;

    this.lastShootingCap = data.cap as any;
    this.abilityManager.setLastActiveUnit(this.lastShootingCap);
    
    // OLD PVP system removed - shooting handled by ShootingController + pvpHelper
    
    this.matchDirector.onShot(data.cap.id);
  }

  /**
   * Legacy swap callback (kept for compatibility).
   * Note: Swap is now processed via onShoot(isSwap=true) and matchDirector.onShot(),
   * so this callback may not be used by the current swap implementation.
   */
  private onSwap(unitA: any, unitB: any): void {
    console.log('[GameScene] Legacy swap called (swap is processed via onShoot with isSwap flag)');
  }

  private scheduleAITurn(): void {
    // вњ… FIXED: Robust AI scheduling - avoid dead states
    if (!this.aiController) return;
    
    // Reset flag if previous call failed
    this.aiTurnScheduled = false;

    // Single delayed call per turn - check conditions at execution time
    this.time.delayedCall(150, () => {
      const phase = this.matchDirector.getPhase();
      const currentPlayer = this.matchDirector.getCurrentPlayer();

      // Only start AI if conditions are still valid
      if (currentPlayer === 2 &&
          phase === MatchPhase.WAITING &&
          this.aiController &&
          !this.aiController.isThinking) {
        this.maybeSyncAIFormationBeforeAITurn();
        this.captainMatchSystem?.tryActivateAiCaptainUltIfReady();
        this.aiController.startTurn();
      }
      // Don't set aiTurnScheduled to false here - it's reset at the start of next turn
    });
    
    this.aiTurnScheduled = true;
  }

  // ============================================================
  // UPDATE
  // ============================================================

  update(time: number, delta: number): void {
    if (!this.isInitialized) return;
    
    const phase = this.matchDirector.getPhase();
    if (phase === MatchPhase.PAUSED || phase === MatchPhase.FINISHED) return;
    
    // ✅ TUTORIAL: В режиме обучения обновляем физику, но пропускаем MatchDirector
    if (this.isTutorialMode) {
      // Обновляем базовые компоненты и физику (нужно для waitForObjectsToStop)
      this.ball?.update();
      this.caps.forEach(cap => cap.update());
      this.vfxManager?.update();
      
      // НЕ делаем return - физика должна обновляться для waitForObjectsToStop()
      // Пропускаем только MatchDirector update чтобы не было автоматической смены ходов
    } else {
      this.ball.update();
      this.caps.forEach(cap => cap.update());
      this.matchDirector.update();
      
      this.abilityManager?.update(delta);
      this.player2AbilityManager?.update(delta);

      this.captainMatchSystem?.update(time, delta);
      this.refreshCaptainSuperHud();
      
      // CHEAT: BOSS NO COOLDOWN
      if (this.campaignLevelConfig?.isBoss && this.player2AbilityManager) {
        (this.player2AbilityManager as any).lastGlobalActivationTime = 0;
      }
    }
    
    this.vfxManager?.update();

    this.lassoController?.update(delta);
    this.lassoButton?.refresh();

    const score = this.matchDirector.getScore();
    const currentPlayer = this.matchDirector.getCurrentPlayer();

    this.gameHUD.updateScore(score.player1, score.player2);
    this.gameHUD.updateTurn(currentPlayer, phase, this.isAIEnabled);
  }
  
  /**
   * вњ… РќРћР’РћР•: РЎРѕС…СЂР°РЅРёС‚СЊ РїСЂРѕРіСЂРµСЃСЃ РјР°С‚С‡Р° РґР»СЏ РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёСЏ РїРѕСЃР»Рµ РїРµСЂРµР·Р°РіСЂСѓР·РєРё
   */
  private saveMatchProgress(): void {
    if (!this.matchDirector) return;
    
    const score = this.matchDirector.getScore();
    // Session state removed - no longer needed
  }

  private updateCapsAuraState(): void {
    const currentPlayer = this.matchDirector.getCurrentPlayer();
    this.caps.forEach(cap => {
      cap.setActiveTeamTurn(cap.owner === currentPlayer);
      cap.setSelected(cap.id === this.selectedCapId);
    });
  }

  private resetPositions(): void {
    // вњ… B. Clear targeting UI after reset
    this.lassoController?.cancel();
    this.abilityManager?.forceClearTargetingUI();
    this.player2AbilityManager?.forceClearTargetingUI();
    this.hideCardInfo();
    
    this.abilityManager?.reset();
    this.player2AbilityManager?.reset();
    this.ball.reset(this.startPositions.ball.x, this.startPositions.ball.y);
    
    // вњ… РРЎРџР РђР’Р›Р•РќРћ: РџРµСЂРµСЃС‡РёС‚С‹РІР°РµРј РїРѕР·РёС†РёРё РёРіСЂРѕРєР° РЅР° РѕСЃРЅРѕРІРµ Р°РєС‚СѓР°Р»СЊРЅРѕР№ С„РѕСЂРјР°С†РёРё
    this.updatePlayerPositionsFromFormation();

    if (this.aiController && this.isAIEnabled && !this.isRealtimePvP) {
      this.syncAIFormationPositions('goal-reset');
      this.lastSyncedAIFormationId = this.aiController.getCurrentFormation().id;
    } else {
      const playerTeamSize = this.caps.filter(c => c.owner === 1).length;
      this.caps.forEach((cap, i) => {
        if (cap.owner === 1) {
          return;
        }
        const oppIndex = i - playerTeamSize;
        if (oppIndex >= 0 && this.startPositions.caps[playerTeamSize + oppIndex]) {
          cap.reset(this.startPositions.caps[playerTeamSize + oppIndex].x, this.startPositions.caps[playerTeamSize + oppIndex].y);
        }
      });
    }

    this.updateCardPanelUI();
  }

  /**
   * вњ… РќРћР’РћР•: РћР±РЅРѕРІР»СЏРµС‚ РїРѕР·РёС†РёРё РёРіСЂРѕРєР° РЅР° РѕСЃРЅРѕРІРµ Р°РєС‚СѓР°Р»СЊРЅРѕР№ С„РѕСЂРјР°С†РёРё
   */
  private updatePlayerPositionsFromFormation(): void {
    const playerFormation = playerData.getSelectedFormation();
    const playerCaps = this.caps.filter(c => c.owner === 1);
    
    console.log(`[GameScene] Updating player positions from formation: ${playerFormation.name} (${playerFormation.slots.length} slots, ${playerCaps.length} caps)`);
    
    if (playerCaps.length !== playerFormation.slots.length) {
      console.warn(`[GameScene] Formation slots (${playerFormation.slots.length}) don't match player caps (${playerCaps.length}), using startPositions`);
      playerCaps.forEach((cap, i) => {
        if (this.startPositions.caps[i]) {
          cap.reset(this.startPositions.caps[i].x, this.startPositions.caps[i].y);
        }
      });
      return;
    }

    // РџРµСЂРµСЃС‡РёС‚С‹РІР°РµРј РїРѕР·РёС†РёРё РЅР° РѕСЃРЅРѕРІРµ С„РѕСЂРјР°С†РёРё
    playerFormation.slots.forEach((slot, index) => {
      const absPos = this.relativeToAbsolute(slot.x, slot.y);
      if (playerCaps[index]) {
        console.log(`[GameScene] Setting cap ${index} position: (${absPos.x.toFixed(1)}, ${absPos.y.toFixed(1)}) from formation slot (${slot.x.toFixed(2)}, ${slot.y.toFixed(2)})`);
        playerCaps[index].reset(absPos.x, absPos.y);
      }
    });
  }

  /**
   * вњ… РќРћР’РћР•: РџСЂРµРѕР±СЂР°Р·СѓРµС‚ РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅС‹Рµ РєРѕРѕСЂРґРёРЅР°С‚С‹ С„РѕСЂРјР°С†РёРё РІ Р°Р±СЃРѕР»СЋС‚РЅС‹Рµ РєРѕРѕСЂРґРёРЅР°С‚С‹ РїРѕР»СЏ
   */
  private relativeToAbsolute(relX: number, relY: number): { x: number; y: number } {
    const bounds = this.fieldBounds;
    const x = bounds.left + relX * (bounds.right - bounds.left);
    // вњ… РРЎРџР РђР’Р›Р•РќРћ: РРіСЂРѕРє РёРіСЂР°РµС‚ РІ РЅРёР¶РЅРµР№ РїРѕР»РѕРІРёРЅРµ РїРѕР»СЏ
    // relY РІ С„РѕСЂРјР°С†РёРё: 0.5 = С†РµРЅС‚СЂ РїРѕР»СЏ, 1.0 = РЅРёР· (РІРѕСЂРѕС‚Р° РёРіСЂРѕРєР°)
    // РџСЂРµРѕР±СЂР°Р·СѓРµРј: relY РѕС‚ 0.5 РґРѕ 1.0 -> y РѕС‚ centerY РґРѕ bottom
    const y = bounds.top + relY * (bounds.bottom - bounds.top);
    return { x, y };
  }

  /** Выставляет фишки AI по текущей тактической схеме AIController (те же относительные координаты, что у игрока). */
  private syncAIFormationPositions(reason: string): void {
    if (!this.aiController || !this.isAIEnabled || this.isRealtimePvP) return;

    const formation = this.aiController.getCurrentFormation();
    const aiCaps = this.caps.filter(c => c.owner === 2);
    if (!formation.slots?.length || aiCaps.length !== formation.slots.length) {
      return;
    }

    formation.slots.forEach((slot, index) => {
      const absPos = this.relativeToAbsolute(slot.x, slot.y);
      const cap = aiCaps[index];
      cap?.reset(absPos.x, absPos.y);
    });

    if (import.meta.env.DEV) {
      console.log(`[GameScene] AI formation synced (${reason}): ${formation.name}`);
    }
  }

  private maybeSyncAIFormationBeforeAITurn(): void {
    if (!this.aiController) return;
    const fid = this.aiController.getCurrentFormation().id;
    if (this.lastSyncedAIFormationId === fid) return;
    this.lastSyncedAIFormationId = fid;
    this.syncAIFormationPositions('formation-change');
  }

  // ============================================================
  // UI SCREENS
  // ============================================================

  private showMatchIntro(): void {
    if (import.meta.env.DEV) {
      console.log('[GameScene] showMatchIntro() called');
    }
    // #region agent log
    // ✅ REMOVED: fetch запросы для логирования - используем ProductionLogger
    // #endregion
    
    this.matter.world.pause();
    this.shootingController.setEnabled(false);
    this.gameHUD.setPauseEnabled(false);
    this.cardPanel?.setVisible(false);

    const state = this.getState();
    const playerName = playerData.getNickname() || 'You';
    // вњ… League & Tournament: РњР°СЃРєРёСЂСѓРµРј Р±РѕС‚Р° РїРѕРґ СЂРµР°Р»СЊРЅРѕРіРѕ РёРіСЂРѕРєР°
    let opponentName: string;
    const displayOpponent =
      typeof this.opponentName === 'string' ? this.opponentName.trim() : '';

    if (
      ((this.matchContext === 'league' ||
        this.matchContext === 'tournament' ||
        this.matchContext === 'casual' ||
        this.matchContext === 'ranked') &&
        this.isAIEnabled &&
        displayOpponent.length > 0) ||
      (this.isRealtimePvP && displayOpponent.length > 0)
    ) {
      opponentName = displayOpponent;
      console.log(`[GameScene] Using preset opponent display name: "${opponentName}"`);
    } else if (this.isAIEnabled) {
      opponentName = generateHumanLikeOpponentNickname();
      console.log('[GameScene] Using generated opponent display name for AI match');
    } else {
      opponentName = 'Player 2';
      console.log('[GameScene] Using Player 2 name');
    }

    // вњ… РџРѕР»СѓС‡Р°РµРј Р°РІР°С‚Р°СЂРєРё РёРіСЂРѕРєРѕРІ
    const playerAvatarId = playerData.get().avatarId || 'avatar_recruit';
    
    // Р”Р»СЏ РїСЂРѕС‚РёРІРЅРёРєР° РіРµРЅРµСЂРёСЂСѓРµРј СЃР»СѓС‡Р°Р№РЅСѓСЋ Р°РІР°С‚Р°СЂРєСѓ
    // вњ… РРЎРџР РђР’Р›Р•РќРћ: РСЃРїРѕР»СЊР·СѓРµРј РЎРћРҐР РђРќРЃРќРќР«Р™ Р°РІР°С‚Р°СЂ РїСЂРѕС‚РёРІРЅРёРєР° РґР»СЏ РєРѕРЅСЃРёСЃС‚РµРЅС‚РЅРѕСЃС‚Рё
    let opponentAvatarId = this.opponentAvatarId;
    
    // Р•СЃР»Рё Р°РІР°С‚Р°СЂ РЅРµ Р±С‹Р» РїРµСЂРµРґР°РЅ, РіРµРЅРµСЂРёСЂСѓРµРј РµРіРѕ (fallback РґР»СЏ СЃС‚Р°СЂС‹С… СЃРёСЃС‚РµРј)
    if (!opponentAvatarId) {
      const botAvatars = [
        'avatar_recruit', 'avatar_explorer', 'avatar_magma_warrior',
        'avatar_cyborg_elite', 'avatar_void_mystic', 'avatar_insect_hive',
        'avatar_champion', 'avatar_legend'
      ];
      opponentAvatarId = botAvatars[Math.floor(Math.random() * botAvatars.length)];
    }
    
    // РџСЂРѕРІРµСЂСЏРµРј СЃСѓС‰РµСЃС‚РІРѕРІР°РЅРёРµ С‚РµРєСЃС‚СѓСЂС‹ Р°РІР°С‚Р°СЂРєРё, РёСЃРїРѕР»СЊР·СѓРµРј fallback РµСЃР»Рё РЅРµС‚
    if (!this.textures.exists(opponentAvatarId)) {
      console.warn(`[GameScene] Avatar texture missing: ${opponentAvatarId}, using fallback`);
      opponentAvatarId = 'avatar_recruit'; // Р’СЃРµРіРґР° РґРѕСЃС‚СѓРїРЅР°СЏ Р°РІР°С‚Р°СЂРєР°
      
      // Р•СЃР»Рё РґР°Р¶Рµ recruit РЅРµ Р·Р°РіСЂСѓР¶РµРЅ, РёСЃРїРѕР»СЊР·СѓРµРј undefined (Р±СѓРґРµС‚ emoji)
      if (!this.textures.exists(opponentAvatarId)) {
        console.error(`[GameScene] Even fallback avatar missing! Using emoji`);
        opponentAvatarId = undefined as any;
      }
    }

    if (import.meta.env.DEV) {
      console.log(`[GameScene] Creating MatchIntroOverlay: player="${playerName}" (${state.playerFaction}), opponent="${opponentName}" (${state.opponentFaction})`);
    }
    
    // #region agent log
    // ✅ REMOVED: fetch запросы для логирования - используем ProductionLogger
    // #endregion
    this.matchIntroOverlay = new MatchIntroOverlay(
      this, 
      state.playerFaction || 'cyborg', 
      state.opponentFaction || 'magma', 
      playerName, 
      opponentName,
      playerAvatarId,
      opponentAvatarId
    );
    this.matchIntroOverlay.play(() => {
      if (import.meta.env.DEV) {
        console.log('[GameScene] MatchIntroOverlay completed, calling onMatchIntroComplete()');
      }
      // #region agent log
      // ✅ REMOVED: fetch запросы для логирования - используем ProductionLogger
      // #endregion
      this.onMatchIntroComplete();
    });
  }

  private onMatchIntroComplete(): void {
    console.log('[GameScene] onMatchIntroComplete() called');
    
    this.matchIntroOverlay?.destroy();
    this.matchIntroOverlay = undefined;

    // Safety flag to prevent double-start
    let isStarted = false;
    const safeStart = () => {
        if (isStarted) {
          console.warn('[GameScene] safeStart() already called, preventing double-start');
          return;
        }
        isStarted = true;
        console.log('[GameScene] safeStart() calling startGame()');
        this.startGame();
    };

    if (this.isCampaignMode && this.campaignLevelConfig?.dialogueBeforeMatch) {
      const dialogueId = this.campaignLevelConfig.dialogueBeforeMatch;
      
      // рџ”Ґ FIX: Safety Timer. If dialogue fails/hangs, start game after 2s.
      // This prevents the "Timer at 3:00, nothing happens" bug.
      const watchdog = this.time.delayedCall(2000, () => {
          console.warn('[GameScene] Dialogue watchdog triggered. Forcing start.');
          safeStart();
      });

      this.campaignDialogue?.playDialogueById(dialogueId, 100, () => {
        watchdog.remove();
        safeStart();
      });
      
    } else {
      safeStart();
    }
  }

  private startGame(): void {
    console.log('[GameScene] startGame() called - resuming physics and starting match');
    logInfo('GameScene', 'startGame called - match beginning');
    
    // вњ… РљР РРўРР§РќРћ: РЈР±РµР¶РґР°РµРјСЃСЏ С‡С‚Рѕ С„РёР·РёРєР° РІРѕР·РѕР±РЅРѕРІР»РµРЅР°
    // Р’ Matter.js РЅРµС‚ isPaused(), РїСЂРѕСЃС‚Рѕ РІСЃРµРіРґР° РІС‹Р·С‹РІР°РµРј resume РґР»СЏ РЅР°РґРµР¶РЅРѕСЃС‚Рё
    console.log('[GameScene] Resuming physics world');
    this.matter.world.resume();
    
    // вњ… РџРѕРєР°Р·С‹РІР°РµРј HUD Рё РєР°СЂС‚РѕС‡РєРё
    this.gameHUD.setPauseEnabled(true);
    this.cardPanel?.setVisible(true);
    
    // вњ… Р’РєР»СЋС‡Р°РµРј РєРѕРЅС‚СЂРѕР»Р»РµСЂ СЃС‚СЂРµР»СЊР±С‹
    this.shootingController.setEnabled(true);
    
    AudioManager.getInstance().playSFX('sfx_whistle');
    console.log('[GameScene] Starting match director...');
    this.matchDirector.startMatch();

    this.lassoController?.resetCooldown();
    
    // вњ… РРЎРџР РђР’Р›Р•РќРћ: РџСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ РјР°С‚С‡ РґРµР№СЃС‚РІРёС‚РµР»СЊРЅРѕ Р·Р°РїСѓСЃС‚РёР»СЃСЏ
    const phase = this.matchDirector.getPhase();
    console.log(`[GameScene] Match phase after start: ${phase}`);
    
    if (phase !== MatchPhase.WAITING && phase !== MatchPhase.AIMING) {
      console.error(`[GameScene] вќЊ Match did not start properly. Current phase: ${phase}`);
      // РџС‹С‚Р°РµРјСЃСЏ РёСЃРїСЂР°РІРёС‚СЊ СЃРёС‚СѓР°С†РёСЋ
      if (phase === MatchPhase.INTRO) {
        console.warn('[GameScene] вљ пёЏ Match is still in INTRO phase, attempting to fix...');
        // РџРѕРІС‚РѕСЂРЅР°СЏ РїРѕРїС‹С‚РєР° Р·Р°РїСѓСЃРєР°
        this.leakGuard.setTimeout(() => {
          this.matchDirector.startMatch();
          const newPhase = this.matchDirector.getPhase();
          if (import.meta.env.DEV) {
            console.log(`[GameScene] Retry: Match phase after second start: ${newPhase}`);
          }
          if (newPhase !== MatchPhase.WAITING && newPhase !== MatchPhase.AIMING) {
            if (import.meta.env.DEV) {
              console.error(`[GameScene] вќЊ Still failed to start match. Phase: ${newPhase}`);
            }
          }
        }, 100);
      }
    }
    
    // вњ… Trigger CampaignDialogueSystem match start event
    if (this.isCampaignMode) {
      this.campaignDialogue?.onMatchStart();
      
      // вњ… Tutorial: Show abilities hint AFTER tut_start dialogue completes
      // TutorialOverlay correctly loads portrait, so we use it for abilities hint
      const isFirstTutorialMatch = this.isCampaignMode &&
        this.campaignLevelConfig?.id === '1-1' &&
        !playerData.hasCompletedFirstMatchTutorial();
      
      if (isFirstTutorialMatch && !playerData.hasAbilitiesHintShown() && this.tutorialOverlay?.isActive()) {
        // Wait for tut_start dialogue to complete, then show TutorialOverlay
        this.waitForDialogueComplete(() => {
          // Temporarily disable input
          this.shootingController.setEnabled(false);
          this.cardPanel?.setVisible(false);
          
          // Show abilities hint using TutorialOverlay (which correctly loads portrait)
          this.tutorialOverlay.showMessage(
            'РљР°СЂС‚С‹ вЂ” СЌС‚Рѕ СЃРїРѕСЃРѕР±РЅРѕСЃС‚Рё! РќР°Р¶РјРё РЅР° РєР°СЂС‚Сѓ, Р·Р°С‚РµРј РІС‹Р±РµСЂРё С†РµР»СЊ. РСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ СЃРїРѕСЃРѕР±РЅРѕСЃС‚РµР№ вЂ” С‡Р°СЃС‚СЊ С‚Р°РєС‚РёРєРё.',
            () => {
              // Re-enable input if it's player's turn and no blocking dialogue exists
              const blocked = this.campaignDialogue?.isBlockingInput() ?? false;
              const currentPlayer = this.matchDirector.getCurrentPlayer();
              if (currentPlayer === 1 && !blocked) {
                this.shootingController.setEnabled(true);
                this.cardPanel?.setVisible(this.abilityManager.getAvailableCards().length > 0);
              }
              playerData.markAbilitiesHintShown();
            }
          );
        });
      }
    }

    const currentPlayer = this.matchDirector.getCurrentPlayer();
    console.log(`[GameScene] Match started. Current player: ${currentPlayer}, Phase: ${phase}`);
    
    if (currentPlayer === 1) {
      // вњ… Block input if dialogue is showing or tutorial overlay is showing
      const blocked = this.campaignDialogue?.isBlockingInput() ?? false;
      const showingTutorial = this.tutorialOverlay?.isActive() && this.tutorialOverlay.visible;
      if (!blocked && !showingTutorial) {
        this.shootingController.setEnabled(true);
        this.cardPanel?.setVisible(this.abilityManager.getAvailableCards().length > 0);
        console.log('[GameScene] вњ… Player input enabled');
      } else {
        console.log('[GameScene] вљ пёЏ Player input blocked by dialogue or tutorial');
      }
    } else if (this.aiController) {
      console.log('[GameScene] вњ… Scheduling AI turn');
      this.scheduleAITurn();
    } else {
      console.warn('[GameScene] вљ пёЏ No AI controller available for player 2');
    }
  }

  /**
   * Wait for CampaignDialogueSystem to complete current dialogue, then call callback
   */
  private waitForDialogueComplete(callback: () => void): void {
    // Check if dialogue is already complete
    if (!this.campaignDialogue?.isBlockingInput()) {
      callback();
      return;
    }

    // Poll every 100ms until dialogue completes
    const checkInterval = this.time.addEvent({
      delay: 100,
      callback: () => {
        if (!this.campaignDialogue?.isBlockingInput()) {
          checkInterval.remove();
          callback();
        }
      },
      repeat: -1
    });

    // Safety timeout: if dialogue doesn't complete in 30 seconds, call callback anyway
    this.time.delayedCall(30000, () => {
      if (checkInterval) {
        checkInterval.remove();
      }
      callback();
    });
  }

  private showPauseMenu(): void {
    if (this.pauseMenu) return;
    
    // вњ… B. Clear targeting UI before pausing
    if (this.abilityManager.isActivating()) {
      this.abilityManager.cancelActivation();
    }
    this.abilityManager.forceClearTargetingUI();
    this.hideCardInfo();
    
    this.matchDirector.pause();
    this.pauseMenu = new PauseMenu(this, {
      onResume: () => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.pauseMenu = undefined;
        this.matchDirector.resume();
        if (this.matchDirector.getCurrentPlayer() === 2 && this.aiController) {
          this.aiTurnScheduled = false;
          this.scheduleAITurn();
        }
      },
      onChangeFormation: this.isRealtimePvP ? undefined : () => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.pauseMenu = undefined;
        this.showFormationMenu();
      },
      onSettings: () => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.pauseMenu = undefined;
        this.showInGameSettings();
      },
      onSurrender: () => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.pauseMenu = undefined;
        this.matchDirector.surrender();
      },
    });
  }

  private showFormationMenu(): void {
    if (this.formationMenu || this.isRealtimePvP) return;
    
    // вњ… РРЎРџР РђР’Р›Р•РќРћ: РџСЂРёРѕСЃС‚Р°РЅР°РІР»РёРІР°РµРј РјР°С‚С‡ Рё С‚Р°Р№РјРµСЂ С…РѕРґР° РїСЂРё РѕС‚РєСЂС‹С‚РёРё РјРµРЅСЋ С„РѕСЂРјР°С†РёР№
    this.matchDirector.pause();
    
    // вњ… РРЎРџР РђР’Р›Р•РќРћ: РџРµСЂРµРґР°РµРј Р°РєС‚СѓР°Р»СЊРЅСѓСЋ С„СЂР°РєС†РёСЋ РёРіСЂРѕРєР° РІ FormationMenu
    const playerFaction = this.getState().playerFaction || playerData.getFaction() || 'cyborg';
    this.formationMenu = new FormationMenu(this, playerData.getSelectedFormation().id, {
      onSelect: (formation) => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.formationMenu = undefined;
        // вњ… РРЎРџР РђР’Р›Р•РќРћ: РЎРѕС…СЂР°РЅСЏРµРј С„РѕСЂРјР°С†РёСЋ Рё РїСЂРёРјРµРЅСЏРµРј РµС‘ РїСЂРё СЃР»РµРґСѓСЋС‰РµРј РіРѕР»Рµ РёР»Рё РїРµСЂРµР·Р°РїСѓСЃРєРµ
        playerData.selectFormation(formation.id);
        playerData.save();
        
        // РЈСЃС‚Р°РЅР°РІР»РёРІР°РµРј pending formation РґР»СЏ РїСЂРёРјРµРЅРµРЅРёСЏ РїСЂРё СЃР»РµРґСѓСЋС‰РµРј РіРѕР»Рµ
        // (С„РѕСЂРјР°С†РёСЏ РїСЂРёРјРµРЅСЏРµС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РїСЂРё СЃР»РµРґСѓСЋС‰РµРј РіРѕР»Рµ С‡РµСЂРµР· MatchDirector)
        this.matchDirector.resume();
        
        // РџРѕРєР°Р·С‹РІР°РµРј СѓРІРµРґРѕРјР»РµРЅРёРµ Рѕ С‚РѕРј, С‡С‚Рѕ С„РѕСЂРјР°С†РёСЏ Р±СѓРґРµС‚ РїСЂРёРјРµРЅРµРЅР° РїСЂРё СЃР»РµРґСѓСЋС‰РµРј РіРѕР»Рµ
        this.gameHUD?.showFormationAppliedNotification();
      },
      onCancel: () => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.formationMenu = undefined;
        this.matchDirector.resume();
        if (this.matchDirector.getCurrentPlayer() === 2 && this.aiController) {
          this.aiTurnScheduled = false;
          this.scheduleAITurn();
        }
      },
    }, playerFaction);
  }

  private showInGameSettings(): void {
    if (this.inGameSettings) return;
    this.inGameSettings = new InGameSettings(this, {
      onClose: () => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.inGameSettings = undefined;
        this.matchDirector.resume();
      },
    });
  }

  private showResultScreen(result: MatchResult): void {
    // вњ… Р”РћР‘РђР’Р›Р•РќРћ: РџСЂРµРґРѕС‚РІСЂР°С‰Р°РµРј РјРЅРѕР¶РµСЃС‚РІРµРЅРЅРѕРµ СЃРѕР·РґР°РЅРёРµ ResultScreen
    if (this.isResultShown) {
      console.warn('[GameScene] ResultScreen already shown, ignoring duplicate call');
      return;
    }
    this.isResultShown = true;
    
    // вњ… РРЎРџР РђР’Р›Р•РќРћ: РџРµСЂРµРґР°РµРј РґР°РЅРЅС‹Рµ РїСЂРѕС‚РёРІРЅРёРєР° РІ ResultScreen
    const resultScreenData = {
      opponentName: this.opponentName,
      opponentAvatarId: this.opponentAvatarId,
    };
    
    this.resultScreen = new ResultScreen(this, result, this.hudShowsAiBranding, resultScreenData, {
      onRematch: () => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.resultScreen = undefined;
        this.restartGame();
      },
      onMainMenu: async () => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.resultScreen = undefined;
        
        // вњ… League & Tournament: РќР°РІРёРіР°С†РёСЏ РІ Р·Р°РІРёСЃРёРјРѕСЃС‚Рё РѕС‚ РєРѕРЅС‚РµРєСЃС‚Р°
        if (this.matchContext === 'league') {
          // ✅ ДОБАВЛЕНО: Останавливаем ВСЕ звуки перед переходом
          AudioManager.getInstance().stopAllSounds();
          // ✅ Передаём сохранённые данные в LeagueScene
          if (this.leagueResultData) {
            await safeSceneStart(this, 'LeagueScene', {
              fromMatch: true,
              oldStars: this.leagueResultData.oldStars,
              oldTier: this.leagueResultData.oldTier,
              oldDivision: this.leagueResultData.oldDivision,
              matchResult: this.leagueResultData.matchResult,
              showOrbitDecay: this.leagueResultData.showOrbitDecay
            });
            // Очищаем данные после использования
            this.leagueResultData = undefined;
          } else {
            // Fallback если данные не были сохранены
            const data = playerData.get();
            const leagueProgress = data.leagueProgress;
            const oldStars = leagueProgress?.stars || 0;
            
            if (leagueProgress && LeagueManager.shouldTriggerOrbitDecay(leagueProgress, result)) {
              await safeSceneStart(this, 'LeagueScene', { 
                showOrbitDecay: true,
                fromMatch: true,
                oldStars: oldStars 
              });
            } else {
              await safeSceneStart(this, 'LeagueScene', {
                fromMatch: true,
                oldStars: oldStars
              });
            }
          }
        } else if (this.matchContext === 'tournament') {
          // ✅ ДОБАВЛЕНО: Останавливаем ВСЕ звуки перед переходом
          AudioManager.getInstance().stopAllSounds();
          // Р’РѕР·РІСЂР°С‰Р°РµРјСЃСЏ РІ СЃРµС‚РєСѓ С‚СѓСЂРЅРёСЂР°
          const data = playerData.get();
          const tournament = data.activeTournament;
          if (tournament) {
            await safeSceneStart(this, 'TournamentBracketScene', { tournament });
          } else {
            await safeSceneStart(this, 'TournamentScene');
          }
        } else if (this.isCampaignMode && this.campaignLevelConfig?.id === '1-1') {
          // ✅ ДОБАВЛЕНО: Останавливаем ВСЕ звуки перед переходом
          AudioManager.getInstance().stopAllSounds();
          // вњ… FIX: If this was tutorial, go to MainMenu with fromTutorial flag
          this.scene.start('MainMenuScene', { fromTutorial: true });
        } else {
          const targetScene = this.isCampaignMode ? 'CampaignSelectScene' : 'MainMenuScene';
          if (targetScene === 'CampaignSelectScene') {
            // ✅ ДОБАВЛЕНО: Останавливаем ВСЕ звуки перед переходом
            AudioManager.getInstance().stopAllSounds();
            await safeSceneStart(this, targetScene);
          } else {
            // ✅ ДОБАВЛЕНО: Останавливаем ВСЕ звуки перед переходом
            AudioManager.getInstance().stopAllSounds();
            this.scene.start(targetScene);
          }
        }
      },
      onNextLevel: result.isCampaign && result.unlockedNextLevel ? () => this.goToNextLevel() : undefined,
    });
  }

  private restartGame(): void {
    AudioManager.getInstance().stopAll();
    
    // вњ… B. Clear targeting UI before restart
    this.abilityManager?.forceClearTargetingUI();
    this.player2AbilityManager?.forceClearTargetingUI();
    this.hideCardInfo();
    
    this.matchDirector.reset();
    this.abilityManager?.resetForNewMatch();
    this.player2AbilityManager?.resetForNewMatch();
    if (this.aiController && this.player2AbilityManager) {
      this.player2AbilityManager.alignAIDeckFromHand(this.aiController.getHandCardIds());
    }
    this.resetPositions();
    this.shootingController.setCurrentPlayer(1);
    this.gameHUD.setPauseEnabled(true);
    this.lastShootingCap = undefined;
    this.selectedCapId = undefined;
    this.aiTurnScheduled = false;
    this.isAbilityInputActive = false;
    
    // РџРµСЂРµР·Р°РїСѓСЃРєР°РµРј С‚Р°Р№РјРµСЂ РєСѓР»РґР°СѓРЅР° РµСЃР»Рё РЅСѓР¶РЅРѕ
    if (this.cooldownTimer) {
      this.cooldownTimer.destroy();
      this.cooldownTimer = undefined;
    }
    
    AudioManager.getInstance().playAmbience('bgm_match');
    this.showMatchIntro();
  }

  private async goToNextLevel(): Promise<void> {
    await safeSceneStart(this, 'CampaignSelectScene');
  }

  // OLD: Removed setupPvP() - using pvpHelper now

  /* OLD PVP SYSTEM REMOVED - createPvPSync() method
  private createPvPSync(): void {
    import('./game/PvPSyncManager').then(({ PvPSyncManager }) => {
      import('./game/PvPDebugLogger').then(({ PvPDebugLogger }) => {
        const debug = new PvPDebugLogger();
        debug.init(this.isHost, this.mp.getMyPlayerIndex(), this.mp.getMyId());
        
        this.pvpSync = new PvPSyncManager(
          this,
          {
            isHost: this.isHost,
            myPlayerIndex: this.mp.getMyPlayerIndex(),
          },
          {
            onShootExecuted: (data: any, isMyShoot: boolean) => {
              if (!isMyShoot) {
                console.log('[GameScene] Opponent shoot executed, applying...', data);
                // Находим фишку по capId
                const cap = this.caps.find(c => c.id === data.capId);
                if (cap && data.force) {
                  // Применяем силу удара оппонента
                  const forceVec = new Phaser.Math.Vector2(data.force.x, data.force.y);
                  cap.applyForce(forceVec.x, forceVec.y);
                  
                  // Применяем hitOffset если есть (для Trickster)
                  if (data.hitOffset !== undefined && typeof (cap as any).setLastHitOffset === 'function') {
                    (cap as any).setLastHitOffset(data.hitOffset);
                  }
                  
                  // Воспроизводим эффект удара
                  if (typeof (cap as any).playHitEffect === 'function') {
                    (cap as any).playHitEffect();
                  }
                  
                  console.log('[GameScene] ✅ Opponent shoot applied to cap:', data.capId);
                } else {
                  console.warn('[GameScene] ⚠️ Cap not found for opponent shoot:', data.capId);
                }
              }
            },
            onTurnChange: (data: any) => {
              console.log('[GameScene] Turn changed to:', data.currentTurn === this.mp.getMyId() ? 'ME' : 'OPPONENT');
              
              // ✅ ИСПРАВЛЕНО: Возобновляем игру если она была на паузе
              if (this.isPausedForReconnect) {
                this.resumeGameAfterReconnect();
              }
              
              // Определяем, чей ход (1 или 2)
              const isMyTurn = data.currentTurn === this.mp.getMyId();
              const myOwner = this.getMyOwner();
              const newPlayer: PlayerNumber = isMyTurn ? myOwner : (myOwner === 1 ? 2 : 1);
              
              // Обновляем счет
              if (data.scores) {
                const myId = this.mp.getMyId();
                const opponent = this.mp.getOpponent();
                const myScore = data.scores[myId || ''] || 0;
                const oppScore = data.scores[opponent?.id || ''] || 0;
                
                // Обновляем счет в matchDirector
                this.matchDirector.setScore(myScore, oppScore);
              }
              
              // ✅ ИСПРАВЛЕНО: Переключаем ход через stateMachine
              // В PVP режиме смена хода происходит от сервера, поэтому просто устанавливаем игрока
              const stateMachine = this.matchDirector.getStateMachine();
              const currentPhase = stateMachine.getPhase();
              
              // Если мы в фазе MOVING, переходим в WAITING (но НЕ меняем игрока - это делает сервер)
              if (currentPhase === MatchPhase.MOVING) {
                // Просто переходим в WAITING без смены игрока
                stateMachine.transition(MatchPhase.WAITING);
              }
              
              // Устанавливаем текущего игрока (от сервера)
              stateMachine.setCurrentPlayer(newPlayer);
              
              // Вызываем обработчик смены хода
              // Номер хода будет увеличен автоматически при следующем выстреле
              this.onTurnChange({ player: newPlayer, turnNumber: stateMachine.getTurnNumber() });
              
              console.log('[GameScene] ✅ Turn changed to player:', newPlayer, 'phase:', stateMachine.getPhase());
            },
            onGoalScored: (data: any) => {
              console.log('[GameScene] Goal scored in PvP', data);
              
              // Определяем, кто забил гол (1 или 2)
              const myId = this.mp.getMyId();
              const opponent = this.mp.getOpponent();
              const scorerId = data.scorerId;
              const scoringPlayer: PlayerNumber = scorerId === myId 
                ? this.getMyOwner() 
                : (this.getMyOwner() === 1 ? 2 : 1);
              
              // Обновляем счет
              if (data.scores) {
                const myScore = data.scores[myId || ''] || 0;
                const oppScore = data.scores[opponent?.id || ''] || 0;
                this.matchDirector.setScore(myScore, oppScore);
              }
              
              // Применяем финальные позиции если есть
              if (data.finalPositions && this.pvpSync) {
                this.pvpSync.applyFinalPositions(this.ball, this.caps, data.finalPositions);
              }
              
              // Вызываем обработку гола через MatchDirector
              this.matchDirector.onGoalScored(scoringPlayer);
              
              console.log('[GameScene] ✅ Goal processed, scorer:', scoringPlayer);
            },
            onContinueGame: (data: any) => {
              console.log('[GameScene] Continue game after goal');
              // Определяем, чей ход после гола
              const isMyTurn = data.currentTurn === this.mp.getMyId();
              const myOwner = this.getMyOwner();
              const newPlayer: PlayerNumber = isMyTurn ? myOwner : (myOwner === 1 ? 2 : 1);
              
              // Переключаем ход через stateMachine
              const stateMachine = this.matchDirector.getStateMachine();
              stateMachine.setCurrentPlayer(newPlayer);
              
              // Возобновляем игру
              this.matchDirector.resume();
              
              // Вызываем обработчик смены хода
              this.onTurnChange({ player: newPlayer, turnNumber: stateMachine.getTurnNumber() });
              
              console.log('[GameScene] ✅ Game continued, turn:', newPlayer);
            },
            onMatchFinished: (data: any) => {
              console.log('[GameScene] PvP match finished');
              this.handlePvPMatchEnd(data);
            },
            onOpponentLeft: (reason: string, data: any) => {
              console.log('[GameScene] Opponent left:', reason);
              this.handleOpponentLeft(reason);
            },
            onTimerUpdate: (remaining: number, total: number) => {
              if (this.gameHUD) {
                // TODO: Implement timer update in GameHUD
                // this.gameHUD.updateTimer(remaining);
              }
            },
          },
          debug
        );
        
        this.pvpSync.setupListeners();
        this.pvpSync.startTimeSync();
        
        // ✅ PVP: Запускаем синхронизацию позиций для хоста
        if (this.isHost) {
          this.pvpSync.startSyncInterval(
            () => this.ball,
            () => this.caps
          );
          console.log('[GameScene] ✅ PvP position sync started (host)');
        }
        
        // ✅ 2.1: Создаем индикатор сетевого состояния
        const { width, height } = this.cameras.main;
        this.networkIndicator = new NetworkStatusIndicator(this, width - 120, 30);
        this.networkIndicator.updateMetrics({
          rtt: 0,
          jitter: 0,
          quality: 'excellent',
          isConnected: this.mp.getConnectionStatus(),
        });
        
        // ✅ 2.3: Создаем окно переподключения
        this.reconnectionOverlay = new ReconnectionOverlay(this);
        
        // ✅ 2.1: Обновляем метрики каждую секунду
        this.time.addEvent({
          delay: 1000,
          callback: () => {
            if (this.pvpSync && this.networkIndicator) {
              this.networkIndicator.updateMetrics({
                rtt: this.pvpSync.getRTT(),
                jitter: this.pvpSync.getJitter(),
                quality: this.pvpSync.getConnectionQuality(),
                isConnected: this.mp.getConnectionStatus(),
              });
            }
          },
          loop: true,
        });
        
        // ✅ 2.3: Подписываемся на события переподключения
        this.setupReconnectionHandlers();
        
        console.log('[GameScene] ✅ PvP sync initialized');
      });
    });
  } END OF createPvPSync() */

  /* OLD PVP SYSTEM REMOVED - setupReconnectionHandlers() method
  private setupReconnectionHandlers(): void {
    if (!this.isPvPMode || !this.mp || !this.reconnectionOverlay) return;
    
    // ✅ ИСПРАВЛЕНО: Подписываемся на события переподключения
    // НЕ ставим игру на паузу при обычном отключении - только показываем уведомление
    this.mp.on('disconnected', (reason: string) => {
      console.log('[GameScene] Disconnected:', reason);
      if (this.reconnectionOverlay) {
        this.reconnectionOverlay.show();
      }
      // НЕ ставим игру на паузу - игра продолжается
    });
    
    this.mp.on('reconnected', () => {
      console.log('[GameScene] Reconnected');
      if (this.reconnectionOverlay) {
        this.reconnectionOverlay.setReconnected();
      }
      // Возобновляем игру если она была на паузе
      if (this.isPausedForReconnect) {
        this.resumeGameAfterReconnect();
      }
    });
    
    // ✅ ИСПРАВЛЕНО: Обработка отключения оппонента - НЕ ставим игру на паузу
    // Игра продолжается, просто показываем уведомление
    this.mp.on('opponent_disconnected', (data: any) => {
      console.log('[GameScene] Opponent disconnected');
      if (this.reconnectionOverlay) {
        this.reconnectionOverlay.setWaitingForOpponent();
      }
      // НЕ ставим игру на паузу - оппонент может вернуться
    });
  } END OF setupReconnectionHandlers() */

  /* OLD PVP SYSTEM REMOVED - resumeGameAfterReconnect() method
  private resumeGameAfterReconnect(): void {
    if (!this.isPausedForReconnect) return;
    
    console.log('[GameScene] Resuming game after reconnect');
    this.isPausedForReconnect = false;
    
    // Возобновляем физику и матч
    this.matter.world.resume();
    this.matchDirector.resume();
  } END OF resumeGameAfterReconnect() */

  /* OLD PVP SYSTEM REMOVED - handlePvPMatchEnd() method
  private handlePvPMatchEnd(data: any): void {
    const myId = this.mp.getMyId();
    const isWin = data.winner === myId;
    const isDraw = data.winner === null;
    
    import('./game/MatchResultHelper').then(({ GameResultFactory }) => {
      import('../managers/PvPManager').then(({ PvPManager }) => {
        const opponent = this.mp.getOpponent();
        const myScore = data.scores[myId || ''] || 0;
        const oppScore = data.scores[opponent?.id || ''] || 0;
        
        const result = GameResultFactory.createPvPResult(
          'ranked', // or get from playerData
          isDraw ? null : isWin,
          myScore,
          oppScore,
          opponent?.name || 'Opponent',
          1500, // opponent rating - should come from server
          this.matchDuration,
          'time_up'
        );
        
        this.onMatchEnd({ result         });
      });
    });
  } END OF handlePvPMatchEnd() */

  /* OLD PVP SYSTEM REMOVED - handleOpponentLeft() method
  private handleOpponentLeft(reason: string): void {
    // Opponent left - award win
    import('./game/MatchResultHelper').then(({ GameResultFactory }) => {
      import('../managers/PvPManager').then(({ PvPManager }) => {
        const opponent = this.mp.getOpponent();
        const myId = this.mp.getMyId();
        const scores = this.matchDirector.getScore();
        
        const result = GameResultFactory.createPvPResult(
          'ranked',
          true, // Win by forfeit
          scores.player1,
          scores.player2,
          opponent?.name || 'Opponent',
          1500,
          this.matchDuration,
          reason === 'surrendered' ? 'surrender' : 'disconnect'
        );
        
        this.onMatchEnd({ result });
      });
    });
  } END OF handleOpponentLeft() */

  private getMyOwner(): PlayerNumber {
    if (!this.isRealtimePvP) {
      return 1;
    }
    // ✅ FIX: Используем сохраненный myPlayerIndex вместо вызова mp.getMyPlayerIndex()
    // (чтобы избежать ошибки если mp еще не инициализирован)
    return (this.myPlayerIndex + 1) as PlayerNumber; // +1 потому что индексы 0,1 -> владельцы 1,2
  }

  // вњ… РРЎРџР РђР’Р›Р•РќРћ: getState() Р±РѕР»СЊС€Рµ РќР• Р±РµСЂС‘С‚ РѕСЃС‚Р°С‚РѕРє РІСЂРµРјРµРЅРё РёР· matchDirector
  // Р’РјРµСЃС‚Рѕ СЌС‚РѕРіРѕ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ СЃРѕС…СЂР°РЅС‘РЅРЅРѕРµ Р·РЅР°С‡РµРЅРёРµ this.matchDuration
  private getState() {
    const pFaction = (this.storedPlayerFaction || playerData.getFaction() || 'cyborg') as FactionId;
    const oFaction = (this.campaignLevelConfig?.enemyFaction || this.storedOpponentFaction || 'magma') as FactionId;

    return {
      // вњ… РРЎРџР РђР’Р›Р•РќРћ: РСЃРїРѕР»СЊР·СѓРµРј СЃРѕС…СЂР°РЅС‘РЅРЅСѓСЋ РґР»РёС‚РµР»СЊРЅРѕСЃС‚СЊ РјР°С‚С‡Р°, Р° РЅРµ РѕСЃС‚Р°С‚РѕРє РІСЂРµРјРµРЅРё
      matchDuration: this.matchDuration || GAME.DEFAULT_MATCH_DURATION,
      playerFaction: pFaction,
      opponentFaction: oFaction,
      useFactions: !!playerData.getFaction(),
      aiDifficulty: this.campaignLevelConfig?.aiDifficulty ?? this.matchAIDifficulty ?? 'medium',
      fieldSkinId: playerData.get().equippedFieldSkin || 'field_default',
      currentArena: undefined,
      isPvPMode: this.isRealtimePvP,
      isHost: this.isHost,
    };
  }

  private handleResize(): void {
    this.cameras.main.centerOn(this.fieldBounds.centerX, this.fieldBounds.centerY);
    const { width, height } = this.cameras.main;
    if (this.cardPanel) {
      this.cardPanel.setPosition(width / 2, height - 80);
    }
    const lassoX = this.scale.width - LASSO_CONFIG.BUTTON_SIZE / 2 - 10;
    const lassoY =
      this.scale.height -
      this.CARD_PANEL_Y_OFFSET -
      this.CARD_SLOT_HEIGHT / 2 -
      8;
    this.lassoButton?.reposition(lassoX, lassoY);
    if (this.captainSuperPanel) {
      const margin = Math.max(10, Math.round(width * 0.024));
      const cx = width - margin - this.CAPTAIN_SUPER_PANEL_W / 2;
      const cy = height - this.CAPTAIN_SUPER_BOTTOM_MARGIN - this.CAPTAIN_SUPER_PANEL_H / 2;
      this.captainSuperPanel.setPosition(cx, cy);
    }
    // РћР±РЅРѕРІР»СЏРµРј РїРѕР·РёС†РёСЋ РєРЅРѕРїРєРё РїР°СѓР·С‹ РїСЂРё СЂРµСЃР°Р№Р·Рµ
    this.gameHUD?.updateLayout();
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  public getAbilityManager(): AbilityManager {
    return this.abilityManager;
  }

  public getVFXManager(): VFXManager {
    return this.vfxManager;
  }

  /**
   * Получить контроллер стрельбы (для TutorialManager)
   */
  public getShootingController(): any {
    return this.shootingController;
  }

  /**
   * ✅ Инициализация слушателей событий ПОСЛЕ очистки EventBus
   * Вызывается после GameSceneSetup.initialize() чтобы подписки не были удалены.
   */
  private initializeEventListeners(): void {
    // Battle Pass - слушает MATCH_FINISHED и GOAL_SCORED для начисления XP
    battlePassManager.initialize();

    // Daily Tasks - слушает события для прогресса заданий
    dailyTasksManager.initialize();

    console.log('[GameScene] Event listeners initialized after EventBus clear');
  }

  // ============================================================
  // CLEANUP
  // ============================================================

  shutdown(): void {
    // В начале метода
    if (import.meta.env.DEV) {
      import('../core/EventBus').then(({ EventBus }) => {
        const leaks = EventBus.checkForLeaks();
        if (leaks.length > 0) {
          console.warn('[GameScene] Potential EventBus leaks:', leaks);
        }
      }).catch(() => {
        // Игнорируем ошибки импорта
      });
    }
    
    // ✅ ИСПРАВЛЕНО: Корректная отписка от lifecycle событий
    if (this.lifecyclePauseCallback || this.lifecycleResumeCallback) {
      const lifecycle = AppLifecycle.getInstance();
      
      if (this.lifecyclePauseCallback) {
        lifecycle.offPause(this.lifecyclePauseCallback);
        this.lifecyclePauseCallback = undefined;
      }
      
      if (this.lifecycleResumeCallback) {
        lifecycle.offResume(this.lifecycleResumeCallback);
        this.lifecycleResumeCallback = undefined;
      }
    }
    this.wasBackgrounded = false;
    
    this.passiveHudToast?.destroy();
    this.passiveHudToast = undefined;
    
    // ✅ FIX: LeakGuard автоматически очистит все ресурсы
    // Нет необходимости вручную очищать таймеры и listeners
    
    this.devOverlay?.destroy();
    this.unsubscribeFromEvents();
    HapticManager.cleanup();
    AudioManager.getInstance().stopAll();
    this.announcer?.clear();
    this.matchDirector?.destroy();
    this.matchIntroOverlay?.destroy();
    this.tutorialOverlay?.destroy();
    this.celebrationManager?.destroy();
    this.abilityManager?.destroy();
    this.player2AbilityManager?.destroy();
    this.abilityButton?.destroy();
    this.lassoController?.destroy();
    this.lassoButton?.destroy();
    this.lassoController = null;
    this.lassoButton = null;
    this.vfxManager?.destroy();
    this.passiveManager?.destroy();
    this.captainMatchSystem?.destroy();
    this.captainSuperPanel?.destroy();
    this.achievementManager?.destroy();
    this.campaignDialogue?.destroy();
    this.campaignDialogue = undefined;
    this.aiController?.destroy();
    this.cardPanel?.destroy();
    this.gameHUD?.destroy();
    this.pauseMenu?.destroy();
    this.formationMenu?.destroy();
    this.resultScreen?.destroy();
    this.inGameSettings?.destroy();
    this.fieldRenderer?.destroy();
    this.cooldownTimer?.destroy();
    
    // вњ… B. Clear card info popup
    this.hideCardInfo();
    
    this.scale.off('resize', this.handleResize, this);
    
    // РћС‡РёС‰Р°РµРј keyboard listeners
    this.input.keyboard?.off('keydown-ESC');
    
    // вњ… FIX 2026-01-23: РќР• С‚СЂРѕРіР°РµРј С‚РµРєСЃС‚СѓСЂС‹ - РёСЃРїРѕР»СЊР·СѓРµРј СЃС‚Р°Р±РёР»СЊРЅС‹Р№ РїРѕРґС…РѕРґ
    // РўРµРєСЃС‚СѓСЂС‹ Р·Р°РіСЂСѓР¶Р°СЋС‚СЃСЏ РћР”РРќ Р РђР— РІ BootScene Рё РѕСЃС‚Р°СЋС‚СЃСЏ РІ РїР°РјСЏС‚Рё
    // Р­С‚Рѕ СЂР°Р±РѕС‚Р°РµС‚ СЃС‚Р°Р±РёР»СЊРЅРѕ Р±РµР· РІС‹Р»РµС‚РѕРІ
    
    // ✅ NEW PVP: Очищаем PVP ресурсы
    if (this.pvpHelper) {
      this.pvpHelper.destroy();
      this.pvpHelper = undefined;
    }
  }
}
