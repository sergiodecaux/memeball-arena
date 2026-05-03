// src/scenes/game/GameSceneSetup.ts
// 🔧 Модуль инициализации GameScene — вынесенная логика создания
// ✅ ИЗМЕНЕНО: Добавлена поддержка динамического размера команды (Faction Mastery v9)
// ✅ ИЗМЕНЕНО: Добавлена передача fieldBounds в мяч для out-of-bounds guard

import Phaser from 'phaser';
import { FIELD, GOAL, COLLISION_CATEGORIES, GAME, FACTIONS, FactionId, getFactionArena, WALL_PHYSICS } from '../../constants/gameConstants';
import { FieldBounds, PlayerNumber, normalizeGameAIDifficulty } from '../../types';
import { deriveAIProfileFromKey } from '../../ai/AIProfile';
import { Unit } from '../../entities/Unit';
import { Ball } from '../../entities/Ball';
import { playerData } from '../../data/PlayerData';
import { FieldRenderer } from '../../renderers/FieldRenderer';
import { VFXManager } from '../../managers/VFXManager';
import { AudioManager } from '../../managers/AudioManager';
import { eventBus } from '../../core/EventBus';
import { GameSceneState, GameSceneData, StartPositions, GameUnit } from './types';
import { EntityFactory } from './EntityFactory';
import { applyCaptainSlotToAiUnitIds } from '../../utils/aiCaptainRoster';
import { LevelConfig, ChapterConfig } from '../../types/CampaignTypes';
import { getChapter } from '../../data/CampaignData';
import { MultiplayerManager } from '../../managers/MultiplayerManager';
import { AssetPackManager } from '../../assets/AssetPackManager';
import { isRealImageLoaded } from '../../assets/loading/ImageLoader';
import { LoadingOverlay } from '../../ui/LoadingOverlay';
import { getUnit, TUTORIAL_LEGENDARY_UNITS } from '../../data/UnitsCatalog';
import { getUnitById as getRepositoryUnit, UNITS_REPOSITORY } from '../../data/UnitsRepository';
import { STARTER_UNITS_BY_FACTION } from '../../data/PlayerData';

// ========== РЕЗУЛЬТАТ ИНИЦИАЛИЗАЦИИ ==========

export interface GameSceneSetupResult {
  state: GameSceneState;
  fieldBounds: FieldBounds;
  ball: Ball;
  caps: GameUnit[];
  startPositions: StartPositions;
  fieldRenderer: FieldRenderer;
  vfxManager: VFXManager;
  
  // Campaign
  isCampaignMode: boolean;
  campaignLevelConfig?: LevelConfig;
  campaignChapterConfig?: ChapterConfig;
  
  // ✅ ДОБАВЛЕНО: Размер команды для AI
  playerTeamSize: number;
}

// ========== КЛАСС ИНИЦИАЛИЗАЦИИ ==========

export class GameSceneSetup {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Полная инициализация сцены
   */
  async initialize(data?: GameSceneData): Promise<GameSceneSetupResult> {
    // ✅ FIX: Не очищаем EventBus полностью, только игровые события
    // Глобальные менеджеры (DailyTasks, BattlePass) должны сохранять свои подписки
    eventBus.clearGameEvents();

    // 2. Создаём начальное состояние
    const { state, isCampaignMode, campaignLevelConfig, campaignChapterConfig } = 
      this.initializeState(data);

    // 3. Настраиваем аудио
    this.setupAudio();

    // 4. Настраиваем физику
    this.setupPhysics();

    // 5. Рассчитываем границы поля
    const fieldBounds = this.calculateFieldBounds(state.fieldScale);

    // 5.5. Догружаем реальные PNG для поля, мяча и общих матчевых UI.
    await this.ensureStaticMatchAssetsLoaded();

    // 6. Создаём рендерер поля
    const fieldRenderer = this.createFieldRenderer(fieldBounds, state);

    // 7. Создаём VFX Manager
    const vfxManager = new VFXManager(this.scene);

    // Determine team sizes
    let playerTeamSize: number;
    let aiTeamSize: number;

    // 🎮 Приоритет 1: Задан размер команды (лига / турнир / PvP по уровню и т.д.)
    if (data?.teamSize !== undefined) {
      const desired = Phaser.Math.Clamp(data.teamSize, 3, 5);
      const masteryCap =
        state.useFactions && state.playerFaction
          ? playerData.getAllowedTeamSize(state.playerFaction)
          : 5;
      const effective = Math.max(3, Math.min(desired, masteryCap));
      playerTeamSize = effective;
      aiTeamSize = effective;

      console.log(
        `[GameSceneSetup] Match sizing from data: desired=${desired}, masteryCap=${masteryCap}, effective=${effective}`
      );
    } 
    // Приоритет 2: Кампания с переопределением
    else if (isCampaignMode && campaignLevelConfig) {
      const override = campaignLevelConfig.teamSizeOverride;
      playerTeamSize = this.getPlayerTeamSize(state, override, data);
      aiTeamSize = override ?? playerTeamSize; // symmetric when override not set
    } 
    // Приоритет 3: Стандартное определение размера
    else {
      playerTeamSize = this.getPlayerTeamSize(state, undefined, data);
      aiTeamSize = playerTeamSize;
    }

    // 7.5. Проверяем загрузку юнитов перед созданием сущностей
    await this.ensureMatchAssetsLoaded(state, playerTeamSize, aiTeamSize, campaignLevelConfig);

    // 8. Создаём сущности (с учётом размера команды)
    const { ball, caps, startPositions } = this.createEntities(
      fieldBounds,
      state,
      playerTeamSize,
      aiTeamSize,
      campaignLevelConfig
    );

    // ✅ ДОБАВЛЕНО: Передаём границы поля в мяч для out-of-bounds guard
    ball.setFieldBounds(fieldBounds);

    // 9. Создаём стены
    this.createWalls(fieldBounds, state.fieldScale);

    // 10. Инжектим VFX в юниты
    caps.forEach(cap => {
      if (cap instanceof Unit) {
        cap.setVFXManager(vfxManager);
      }
    });

    console.log(`[GameSceneSetup] ✅ Initialized with teamSize: player=${playerTeamSize}, ai=${aiTeamSize}`);

    return {
      state,
      fieldBounds,
      ball,
      caps,
      startPositions,
      fieldRenderer,
      vfxManager,
      isCampaignMode,
      campaignLevelConfig,
      campaignChapterConfig,
      playerTeamSize,
    };
  }

  // ============================================================
  // ИНИЦИАЛИЗАЦИЯ СОСТОЯНИЯ
  // ============================================================

  private initializeState(data?: GameSceneData): {
    state: GameSceneState;
    isCampaignMode: boolean;
    campaignLevelConfig?: LevelConfig;
    campaignChapterConfig?: ChapterConfig;
  } {
    const state = this.createInitialState();
    let isCampaignMode = false;
    let campaignLevelConfig: LevelConfig | undefined;
    let campaignChapterConfig: ChapterConfig | undefined;

    // Проверяем режим кампании
    const campaignData = data as any;
    if (campaignData?.isCampaign && campaignData.levelConfig) {
      isCampaignMode = true;
      campaignLevelConfig = campaignData.levelConfig;
      campaignChapterConfig = campaignData.chapterConfig || getChapter(campaignData.levelConfig.chapterId);
      
      this.initializeCampaignMode(state, campaignLevelConfig, campaignChapterConfig);
    } else {
      this.initializeStandardMode(state, data);
    }

    return { state, isCampaignMode, campaignLevelConfig, campaignChapterConfig };
  }

  private createInitialState(): GameSceneState {
    return {
      isPvPMode: false,
      isAIEnabled: true,
      aiDifficulty: 'medium',
      useFactions: false,
      playerFaction: 'cyborg',
      opponentFaction: 'cyborg',
      currentArena: undefined,
      pvpData: undefined,
      isHost: false,
      myPlayerIndex: 0,
      currentTurnId: '',
      myPlayer: undefined,
      opponentPlayer: undefined,
      isProcessingTurn: false,
      isGoalCelebrating: false,
      lastShootTime: 0,
      lastCollisionTime: 0,
      ballSpeedBeforeCollision: 0,
      selectedCapId: undefined,
      lastShootingCapId: undefined,
      matchDuration: GAME.DEFAULT_MATCH_DURATION,
      matchRemainingTime: GAME.DEFAULT_MATCH_DURATION,
      snapshotBuffer: [],
      serverTimeOffset: 0,
      timeSyncSamples: [],
      guestLocalPhysicsUntil: 0,
      syncGracePeriodUntil: 0,
      lastServerSnapshot: undefined,
      fieldScale: 1,
      fieldSkinId: 'field_default',
      aiIncludeCaptain: false,
    };
  }

  /** Бот получает капитана при уровне игрока ≥ 10 и матче против AI. */
  private refreshAiCaptainFlag(
    state: GameSceneState,
    data?: GameSceneData,
    campaignLevel?: LevelConfig
  ): void {
    const accountLevel = playerData.get().level ?? 1;
    if (accountLevel < 10) {
      state.aiIncludeCaptain = false;
      return;
    }
    if (campaignLevel?.id === '1-1') {
      state.aiIncludeCaptain = false;
      return;
    }
    if (campaignLevel?.isBoss) {
      state.aiIncludeCaptain = false;
      return;
    }
    if (!state.isAIEnabled) {
      state.aiIncludeCaptain = false;
      return;
    }
    state.aiIncludeCaptain = true;
  }

  private initializeCampaignMode(
    state: GameSceneState,
    levelConfig: LevelConfig,
    chapterConfig?: ChapterConfig
  ): void {
    state.isPvPMode = false;
    state.isAIEnabled = true;
    state.aiDifficulty = levelConfig.aiDifficulty;
    state.useFactions = true;
    state.playerFaction = playerData.getFaction() || 'cyborg';
    state.opponentFaction = levelConfig.enemyFaction;
    state.currentArena = getFactionArena(levelConfig.enemyFaction);
    state.matchDuration = levelConfig.matchDuration || GAME.DEFAULT_MATCH_DURATION;
    state.matchRemainingTime = state.matchDuration;
    state.fieldSkinId = playerData.get().equippedFieldSkin || 'field_default';

    state.aiOpponentProfile = deriveAIProfileFromKey(
      `campaign|${levelConfig.id}|${levelConfig.aiDifficulty}`
    );

    console.log(`[GameSceneSetup] Campaign Level: ${levelConfig.name}, AI: ${levelConfig.aiDifficulty}`);
    this.refreshAiCaptainFlag(state, undefined, levelConfig);
  }

  private initializeStandardMode(state: GameSceneState, data?: GameSceneData): void {
    state.isPvPMode = data?.isPvP === true || data?.mode === 'pvp';
    state.pvpData = data?.pvpData;

    console.log(
      `[GameSceneSetup] initializeStandardMode: isPvP=${data?.isPvP}, mode=${data?.mode}, hasPvpData=${!!data?.pvpData}, isPvPMode=${state.isPvPMode}`
    );

    const playerHasFaction = !!playerData.getFaction();
    
    // ✅ ИСПРАВЛЕНО: Для лиги и турниров всегда используем фракции
    const isLeagueOrTournament = data?.matchContext === 'league' || data?.matchContext === 'tournament';
    state.useFactions = data?.useFactions ?? (isLeagueOrTournament || playerHasFaction);

    if (state.useFactions) {
      state.playerFaction = data?.playerFaction || playerData.getFaction() || 'magma';
      state.opponentFaction = data?.opponentFaction || this.getRandomOpponentFaction(state.playerFaction);
      
      const useArena = data?.useArena ?? true;
      if (useArena) {
        state.currentArena = getFactionArena(state.playerFaction);
      }
    }

    if (state.isPvPMode && state.pvpData) {
      // ✅ ДОБАВЛЕНО: Настройка PVP параметров из MultiplayerManager
      const mp = MultiplayerManager.getInstance();
      state.isAIEnabled = false;
      state.matchDuration =
        data?.matchDuration ??
        state.pvpData.config.MATCH_DURATION ??
        GAME.DEFAULT_MATCH_DURATION;
      state.isHost = mp.isHost();
      state.myPlayerIndex = mp.getMyPlayerIndex();
      state.myPlayer = mp.getMe();
      state.opponentPlayer = mp.getOpponent();
      state.currentTurnId = state.pvpData.currentTurn;
      
      // ✅ ИСПРАВЛЕНО: Используем скин поля, который прислал сервер (от Хоста)
      // Это гарантирует, что у обоих игроков будет одинаковое поле
      state.fieldSkinId = state.pvpData.fieldSkin || 'field_default';
      
      console.log(`[GameSceneSetup] ✅ PVP Mode initialized - Host: ${state.isHost}, PlayerIndex: ${state.myPlayerIndex}, Skin: ${state.fieldSkinId}`);
    } else {
      // ✅ ИСПРАВЛЕНО: Поддержка обоих полей isAI и vsAI
      state.isAIEnabled = data?.isAI ?? data?.vsAI ?? true;
      {
        const raw = data?.aiDifficulty ?? data?.difficulty;
        state.aiDifficulty = normalizeGameAIDifficulty(raw, 'medium');
        const profileKey = `${data?.opponentName ?? 'cpu'}|${state.aiDifficulty}|${data?.matchContext ?? 'casual'}`;
        state.aiOpponentProfile = data?.aiOpponentProfile ?? deriveAIProfileFromKey(profileKey);
        console.log(`[GameSceneSetup] AI difficulty normalized: ${raw} → ${state.aiDifficulty}, profile: ${state.aiOpponentProfile?.tier}`);
      }
      state.matchDuration = data?.matchDuration ?? GAME.DEFAULT_MATCH_DURATION;
      state.fieldSkinId = playerData.get().equippedFieldSkin || 'field_default';
    }

    state.matchRemainingTime = state.matchDuration;

    this.refreshAiCaptainFlag(state, data);
  }

  private getRandomOpponentFaction(playerFaction: FactionId): FactionId {
    const allFactions: FactionId[] = ['magma', 'cyborg', 'void', 'insect'];
    const available = allFactions.filter(f => f !== playerFaction);
    return Phaser.Math.RND.pick(available);
  }

  // ============================================================
  // ✅ ДОБАВЛЕНО: Определение размера команды
  // ============================================================

  /**
   * Получить размер команды игрока на основе Faction Mastery
   * @param state Состояние сцены
   * @param overrideTeamSize Опциональное переопределение размера (для тестовых уровней кампании)
   */
  private getPlayerTeamSize(
    state: GameSceneState,
    overrideTeamSize?: number,
    sceneData?: GameSceneData
  ): number {
    // Legacy PvP (MultiplayerManager + pvpData): без явного teamSize из сцены — 3 юнита
    if (
      state.isPvPMode &&
      state.pvpData &&
      (sceneData?.teamSize === undefined || sceneData.teamSize <= 0)
    ) {
      return 3;
    }

    // PvP без server roster: размер матча по мастерству фракции, не по числу заполненных слотов в меню
    if (
      state.isPvPMode &&
      !state.pvpData &&
      state.useFactions &&
      state.playerFaction &&
      (sceneData?.teamSize === undefined || sceneData.teamSize <= 0)
    ) {
      return Math.min(5, Math.max(3, playerData.getAllowedTeamSize(state.playerFaction)));
    }

    // Если есть явное переопределение (тестовый уровень кампании), используем его
    if (overrideTeamSize !== undefined) {
      const clamped = Phaser.Math.Clamp(overrideTeamSize, 3, 5);
      console.log(`[GameSceneSetup] Using teamSizeOverride=${overrideTeamSize} → clamped=${clamped}`);
      return clamped;
    }

    // Поведение по умолчанию: используем Faction Mastery / PlayerData
    if (state.useFactions && state.playerFaction) {
      const allowedSize = playerData.getAllowedTeamSize(state.playerFaction);
      const actualTeam = playerData.getTeamUnits(state.playerFaction);
      
      // Возвращаем меньшее из разрешённого и фактического размера команды
      const teamSize = Math.min(allowedSize, actualTeam.length);
      
      console.log(
        `[GameSceneSetup] Faction: ${state.playerFaction}, allowedSize: ${allowedSize}, actualTeam: ${actualTeam.length}, using: ${Math.max(3, teamSize)}`
      );
      
      return Math.max(3, teamSize); // Минимум 3
    }

    // Fallback
    return 3;
  }

  // ============================================================
  // ФИЗИКА И АУДИО
  // ============================================================

  private setupAudio(): void {
    const audio = AudioManager.getInstance();
    audio.init(this.scene);
    audio.stopMusic();
    audio.playAmbience('bgm_match');
  }

  private setupPhysics(): void {
    if (this.scene.matter.world.runner) {
      (this.scene.matter.world.runner as any).isFixed = true;
      (this.scene.matter.world.runner as any).delta = 1000 / 60;
    }

    const engine = (this.scene.matter.world as any).engine;
    if (engine) {
      // Enhanced iterations for better collision accuracy
      engine.positionIterations = 20;  // Was 14
      engine.velocityIterations = 20;   // Was 14
      engine.constraintIterations = 6;  // Was 4
      
      // Enable sleeping for performance (optional)
      engine.enableSleeping = false; // Keep disabled for real-time accuracy
    }
  }

  private async ensureStaticMatchAssetsLoaded(): Promise<void> {
    const miniOverlay = new LoadingOverlay(this.scene);
    miniOverlay.setText('Загрузка матча…');

    try {
      await AssetPackManager.ensure(this.scene, 'match', miniOverlay);
    } finally {
      miniOverlay.destroy();
    }
  }

  // ============================================================
  // ПОЛЕ И СУЩНОСТИ
  // ============================================================

  private calculateFieldBounds(currentScale: number): FieldBounds {
    const { centerX, centerY, width, height } = this.scene.cameras.main;

    const fieldScale = Math.min(
      (width - FIELD.PADDING * 2) / FIELD.WIDTH,
      (height - FIELD.PADDING * 2) / FIELD.HEIGHT
    ) * 1.1;

    const w = FIELD.WIDTH * fieldScale;
    const h = FIELD.HEIGHT * fieldScale;

    return {
      left: centerX - w / 2,
      right: centerX + w / 2,
      top: centerY - h / 2,
      bottom: centerY + h / 2,
      centerX,
      centerY,
      width: w,
      height: h,
    };
  }

  private createFieldRenderer(fieldBounds: FieldBounds, state: GameSceneState): FieldRenderer {
    const fieldScale = fieldBounds.width / FIELD.WIDTH;
    
    const renderer = new FieldRenderer(
      this.scene,
      fieldBounds,
      fieldScale,
      state.fieldSkinId,
      state.currentArena
    );
    renderer.render();
    
    return renderer;
  }

  // ✅ ИЗМЕНЕНО: Добавлены параметры playerTeamSize и aiTeamSize для поддержки переопределения размера команды
  private createEntities(
    fieldBounds: FieldBounds,
    state: GameSceneState,
    playerTeamSize: number,
    aiTeamSize: number,
    campaignLevelConfig?: LevelConfig
  ): { ball: Ball; caps: GameUnit[]; startPositions: StartPositions } {
    // ✅ Проверяем является ли это туториальным матчем
    const isTutorialMatch = this.checkIfTutorialMatch(campaignLevelConfig);
    const fieldScale = fieldBounds.width / FIELD.WIDTH;

    // Helper to map Chapter to Boss ID
    const getBossIdForChapter = (chapterId?: string): string | undefined => {
      switch (chapterId) {
        case 'chapter_1': return 'boss_krag';
        case 'chapter_2': return 'boss_unit734';
        case 'chapter_3': return 'boss_zra';
        case 'chapter_4': return 'boss_oracle';
        default: return undefined;
      }
    };

    // ✅ ИСПРАВЛЕНО: Выбираем правильную формацию для расстановки
    // В PvP режиме мы должны брать формацию ИЗ ДАННЫХ СЕРВЕРА (state.pvpData)
    // чтобы расстановка соответствовала тому, что видят другие игроки
    let formationToUse = playerData.getSelectedFormation();
    
    if (state.isPvPMode && state.pvpData) {
      const myPlayer = state.pvpData.players[state.myPlayerIndex];
      if (myPlayer && myPlayer.formation) {
        console.log('[GameSceneSetup] Using formation from server data:', myPlayer.formation);
        formationToUse = myPlayer.formation;
      } else {
        console.warn('[GameSceneSetup] Server player data missing formation, falling back to local');
      }
    }

    // ✅ ИЗМЕНЕНО: Передаём размер команды в EntityFactory
    const factory = new EntityFactory({
      scene: this.scene,
      fieldBounds,
      fieldScale,
      isPvPMode: state.isPvPMode,
      pvpData: state.pvpData,
      isHost: state.isHost,
      useFactions: state.useFactions,
      playerFaction: state.playerFaction,
      opponentFaction: state.opponentFaction,
      formation: formationToUse, // Используем правильную формацию
      // ✅ ДОБАВЛЕНО: Новые параметры для динамического размера
      playerTeamSize: playerTeamSize,
      aiTeamSize: aiTeamSize,
      // ✅ NEW: AI difficulty for upgrade scaling
      aiDifficulty: state.aiDifficulty,
      // ✅ ADDED: Boss level configuration
      isBossLevel: campaignLevelConfig?.isBoss || false,
      bossUnitId: campaignLevelConfig?.isBoss 
        ? getBossIdForChapter(campaignLevelConfig.chapterId) 
        : undefined,
      // ✅ NEW: Tutorial match flag
      isTutorialMatch: isTutorialMatch,
      aiProfile: state.aiOpponentProfile,
      aiIncludeCaptain: !!state.aiIncludeCaptain,
    });

    const ballResult = factory.createBall();
    const capsResult = factory.createCaps();

    console.log(`[GameSceneSetup] Created ${capsResult.caps.length} caps (player=${playerTeamSize}, ai=${aiTeamSize})`);

    return {
      ball: ballResult.ball,
      caps: capsResult.caps,
      startPositions: {
        ball: ballResult.startPosition,
        caps: capsResult.startPositions,
      },
    };
  }

  /**
   * Проверяет и догружает ассеты юнитов для матча
   */
  private async ensureMatchAssetsLoaded(
    state: GameSceneState,
    playerTeamSize: number,
    aiTeamSize: number,
    campaignLevelConfig?: LevelConfig
  ): Promise<void> {
    // Получаем список ID юнитов команд (логика аналогична EntityFactory)
    const playerTeamIds = this.getPlayerTeamIds(state, playerTeamSize, campaignLevelConfig);
    const opponentTeamIds = this.getOpponentTeamIds(state, aiTeamSize, campaignLevelConfig);

    // Конвертируем ID в assetKey
    const allUnitKeys: string[] = [];
    
    [...playerTeamIds, ...opponentTeamIds].forEach(unitId => {
      // Ищем в UNITS_CATALOG
      const unit = getUnit(unitId);
      if (unit) {
        allUnitKeys.push(unit.assetKey);
        return;
      }
      
      // Ищем в UNITS_REPOSITORY
      const repoUnit = getRepositoryUnit(unitId);
      if (repoUnit) {
        allUnitKeys.push(repoUnit.assetKey);
      }
    });

    // Уникальные ключи
    const uniqueKeys = [...new Set(allUnitKeys)];
    
    if (uniqueKeys.length === 0) {
      console.log('[GameSceneSetup] No units to check');
      return;
    }

    // Проверяем, нужна ли догрузка
    const missing = uniqueKeys.filter(k => !this.scene.textures.exists(k) || !isRealImageLoaded(k));
    
    if (missing.length === 0) {
      console.log('[GameSceneSetup] All unit assets already loaded');
      return;
    }

    console.log(`[GameSceneSetup] Need to load ${missing.length} unit assets`);
    
    // Показываем мини-лоадер
    const miniOverlay = new LoadingOverlay(this.scene);
    miniOverlay.setText('Загрузка юнитов…');
    
    try {
      await AssetPackManager.ensureUnitsLoaded(this.scene, uniqueKeys, miniOverlay);
    } finally {
      miniOverlay.destroy();
    }
  }

  /**
   * Получает список ID юнитов команды игрока (логика из EntityFactory)
   */
  private getPlayerTeamIds(
    state: GameSceneState,
    teamSize: number,
    campaignLevelConfig?: LevelConfig
  ): string[] {
    if (!state.useFactions || !state.playerFaction) {
      return [];
    }

    // Проверяем туториал
    const isTutorialMatch = this.checkIfTutorialMatch(campaignLevelConfig);
    if (isTutorialMatch) {
      const legendaryUnits = TUTORIAL_LEGENDARY_UNITS[state.playerFaction];
      if (legendaryUnits && legendaryUnits.length >= teamSize) {
        return legendaryUnits.slice(0, teamSize);
      }
    }

    // Обычная логика
    const savedTeam = playerData.getTeamUnits(state.playerFaction);
    if (savedTeam && savedTeam.length >= teamSize) {
      return savedTeam.slice(0, teamSize);
    }

    // Fallback на стартовые
    const starters = STARTER_UNITS_BY_FACTION[state.playerFaction];
    if (starters) {
      return [starters.balanced, starters.tank, starters.sniper].slice(0, teamSize);
    }

    return [];
  }

  /**
   * Получает список ID юнитов команды противника (логика из EntityFactory)
   */
  private getOpponentTeamIds(
    state: GameSceneState,
    teamSize: number,
    campaignLevelConfig?: LevelConfig
  ): string[] {
    if (!state.useFactions || !state.opponentFaction) {
      return [];
    }

    // Для боссов
    if (campaignLevelConfig?.isBoss) {
      const getBossIdForChapter = (chapterId?: string): string | undefined => {
        switch (chapterId) {
          case 'chapter_1': return 'boss_krag';
          case 'chapter_2': return 'boss_unit734';
          case 'chapter_3': return 'boss_zra';
          case 'chapter_4': return 'boss_oracle';
          default: return undefined;
        }
      };
      const bossId = getBossIdForChapter(campaignLevelConfig.chapterId);
      if (bossId) {
        return [bossId];
      }
    }

    // Для AI с учётом сложности
    let team: string[] = [];

    if (state.aiDifficulty && state.aiDifficulty !== 'easy') {
      const factionUnits = UNITS_REPOSITORY.filter(
        (u: any) => u.factionId === state.opponentFaction && !u.isCaptain
      );

      for (let i = 0; i < teamSize; i++) {
        if (factionUnits.length > 0) {
          const randomUnit = factionUnits[Math.floor(Math.random() * factionUnits.length)];
          team.push(randomUnit.id);
        }
      }
    } else {
      const starters = STARTER_UNITS_BY_FACTION[state.opponentFaction];
      if (starters) {
        team = [starters.balanced, starters.tank, starters.sniper].slice(0, teamSize);
      }
    }

    if (!state.aiIncludeCaptain || team.length === 0) {
      return team;
    }

    return applyCaptainSlotToAiUnitIds(team, state.opponentFaction, teamSize, {
      includeCaptain: true,
      reserveBossSlot: false,
    });
  }

  /**
   * ✅ NEW: Проверяет является ли это туториальным матчем
   */
  private checkIfTutorialMatch(campaignLevelConfig?: LevelConfig): boolean {
    // Проверка 1: это уровень 1-1
    if (campaignLevelConfig?.id === '1-1') {
      return true;
    }
    
    // Проверка 2: туториал ещё не завершён
    if (!playerData.hasCompletedFirstMatchTutorial()) {
      return true;
    }
    
    return false;
  }

  private createWalls(fieldBounds: FieldBounds, fieldScale: number): void {
    const { left, right, top, bottom, centerX } = fieldBounds;
    const scale = fieldBounds.width / FIELD.WIDTH;
    
    const goalWidth = GOAL.WIDTH * scale;
    const goalDepth = GOAL.DEPTH * scale;
    const postThickness = GOAL.POST_THICKNESS * scale;
    
    // ✅ ENHANCED: Increased wall thickness for better collision detection
    const thickness = WALL_PHYSICS.BASE_THICKNESS * scale; // Was FIELD.BORDER_THICKNESS * 2
    const sideWidth = (right - left - goalWidth) / 2;

    // ✅ ENHANCED: Different wall properties by zone
    const sideWallOpts: Phaser.Types.Physics.Matter.MatterBodyConfig = {
      isStatic: true,
      restitution: WALL_PHYSICS.SIDE_WALL_RESTITUTION,
      friction: WALL_PHYSICS.SIDE_WALL_FRICTION,
      label: 'wall_side',
      collisionFilter: { category: COLLISION_CATEGORIES.WALL },
    };

    const endWallOpts: Phaser.Types.Physics.Matter.MatterBodyConfig = {
      isStatic: true,
      restitution: WALL_PHYSICS.END_WALL_RESTITUTION,
      friction: WALL_PHYSICS.END_WALL_FRICTION,
      label: 'wall_endline',
      collisionFilter: { category: COLLISION_CATEGORIES.WALL },
    };

    const postOpts: Phaser.Types.Physics.Matter.MatterBodyConfig = {
      isStatic: true,
      restitution: WALL_PHYSICS.POST_RESTITUTION,
      friction: WALL_PHYSICS.POST_FRICTION,
      label: 'post',
      collisionFilter: { category: COLLISION_CATEGORIES.WALL },
    };

    // Боковые стены (side walls)
    this.scene.matter.add.rectangle(left - thickness / 2, (top + bottom) / 2, thickness, bottom - top, sideWallOpts);
    this.scene.matter.add.rectangle(right + thickness / 2, (top + bottom) / 2, thickness, bottom - top, sideWallOpts);

    // Верхние стены (с промежутком для ворот) - end walls
    this.scene.matter.add.rectangle(left + sideWidth / 2, top - thickness / 2, sideWidth, thickness, endWallOpts);
    this.scene.matter.add.rectangle(right - sideWidth / 2, top - thickness / 2, sideWidth, thickness, endWallOpts);

    // Нижние стены - end walls
    this.scene.matter.add.rectangle(left + sideWidth / 2, bottom + thickness / 2, sideWidth, thickness, endWallOpts);
    this.scene.matter.add.rectangle(right - sideWidth / 2, bottom + thickness / 2, sideWidth, thickness, endWallOpts);

    // Ворота
    [{ y: top, dir: -1 }, { y: bottom, dir: 1 }].forEach(({ y, dir }) => {
      this.scene.matter.add.rectangle(centerX, y + dir * (goalDepth + thickness / 2), goalWidth, thickness, endWallOpts);
      this.scene.matter.add.rectangle(centerX - goalWidth / 2 - postThickness / 2, y + dir * goalDepth / 2, postThickness, goalDepth, postOpts);
      this.scene.matter.add.rectangle(centerX + goalWidth / 2 + postThickness / 2, y + dir * goalDepth / 2, postThickness, goalDepth, postOpts);
    });

    // ✅ NEW: Create chamfered corners
    this.createCornerChamfers(fieldBounds, scale);
  }

  /**
   * ✅ NEW: Create chamfered corner colliders to prevent ball from getting stuck
   * Creates triangular colliders at each corner to guide ball smoothly
   */
  private createCornerChamfers(fieldBounds: FieldBounds, scale: number): void {
    const { left, right, top, bottom } = fieldBounds;
    const chamferSize = WALL_PHYSICS.CORNER_CHAMFER_SIZE * scale;

    const cornerOpts: Phaser.Types.Physics.Matter.MatterBodyConfig = {
      isStatic: true,
      restitution: WALL_PHYSICS.CORNER_RESTITUTION,
      friction: WALL_PHYSICS.CORNER_FRICTION,
      collisionFilter: { category: COLLISION_CATEGORIES.CORNER },
    };

    // Top-Left corner
    const topLeftChamfer = this.scene.matter.add.fromVertices(
      left + chamferSize / 2,
      top + chamferSize / 2,
      [
        { x: 0, y: 0 },
        { x: chamferSize, y: 0 },
        { x: 0, y: chamferSize }
      ],
      {
        ...cornerOpts,
        label: 'corner_tl',
      }
    );

    // Top-Right corner
    const topRightChamfer = this.scene.matter.add.fromVertices(
      right - chamferSize / 2,
      top + chamferSize / 2,
      [
        { x: 0, y: 0 },
        { x: -chamferSize, y: 0 },
        { x: 0, y: chamferSize }
      ],
      {
        ...cornerOpts,
        label: 'corner_tr',
      }
    );

    // Bottom-Left corner
    const bottomLeftChamfer = this.scene.matter.add.fromVertices(
      left + chamferSize / 2,
      bottom - chamferSize / 2,
      [
        { x: 0, y: 0 },
        { x: chamferSize, y: 0 },
        { x: 0, y: -chamferSize }
      ],
      {
        ...cornerOpts,
        label: 'corner_bl',
      }
    );

    // Bottom-Right corner
    const bottomRightChamfer = this.scene.matter.add.fromVertices(
      right - chamferSize / 2,
      bottom - chamferSize / 2,
      [
        { x: 0, y: 0 },
        { x: -chamferSize, y: 0 },
        { x: 0, y: -chamferSize }
      ],
      {
        ...cornerOpts,
        label: 'corner_br',
      }
    );

    console.log('[GameSceneSetup] ✅ Created 4 chamfered corner colliders');
  }
}