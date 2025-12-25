// src/scenes/GameScene.ts
// ФИНАЛЬНАЯ ВЕРСИЯ — ИДЕАЛЬНАЯ ФИЗИКА + БАЛАНС

import Phaser from 'phaser';
import {
  FIELD,
  GOAL,
  COLLISION_CATEGORIES,
  GAME,
  FACTIONS,
  FactionId,
  getFactionArena,
  FactionArena,
} from '../constants/gameConstants';
import { FieldBounds, PlayerNumber, AIDifficulty } from '../types';
import { Ball } from '../entities/Ball';
import { ShootingController, ShootEventData, ShootableUnit } from '../controllers/ShootingController';
import { GameStateManager } from '../controllers/GameStateManager';
import { GoalDetector } from '../controllers/GoalDetector';
import { ScoreManager } from '../controllers/ScoreManager';
import { FieldRenderer } from '../renderers/FieldRenderer';
import { AIController } from '../ai/AIController';
import { MatchController } from '../controllers/match/MatchController';
import { GameHUD } from '../ui/game/GameHUD';
import { PauseMenu } from '../ui/game/PauseMenu';
import { FormationMenu } from '../ui/game/FormationMenu';
import { ResultScreen } from '../ui/game/ResultScreen';
import { InGameSettings } from '../ui/game/InGameSettings';
import { playerData, Formation } from '../data/PlayerData';
import { AudioManager } from '../managers/AudioManager';
import { MultiplayerManager, FinalPositions, ShootData } from '../managers/MultiplayerManager';

// Game module imports
import {
  GameSceneData,
  GameUnit,
  StartPositions,
  Snapshot,
  hasPlayHitEffect,
  createInitialState,
  GameSceneState,
} from './game/types';
import { PvPDebugLogger } from './game/PvPDebugLogger';
import { MatchTimerManager } from './game/MatchTimerManager';
import { CelebrationManager } from './game/CelebrationManager';
import { EntityFactory } from './game/EntityFactory';
import { CollisionHandler } from './game/CollisionHandler';
import { PvPSyncManager } from './game/PvPSyncManager';
import { HapticManager } from './game/HapticManager';
import { ResultHelper, MatchResult } from './game/ResultHelper';

export class GameScene extends Phaser.Scene {
  // === Core State ===
  private state!: GameSceneState;

  // === Entities ===
  private ball!: Ball;
  private caps: GameUnit[] = [];
  private startPositions!: StartPositions;
  private fieldBounds!: FieldBounds;

  // === Controllers ===
  private shootingController!: ShootingController;
  private gameStateManager!: GameStateManager;
  private goalDetector!: GoalDetector;
  private scoreManager!: ScoreManager;
  private matchController!: MatchController;
  private aiController?: AIController;

  // === Renderers ===
  private fieldRenderer!: FieldRenderer;

  // === Managers ===
  private matchTimer!: MatchTimerManager;
  private celebrationManager!: CelebrationManager;
  private collisionHandler!: CollisionHandler;
  private pvpSyncManager?: PvPSyncManager;
  private mp!: MultiplayerManager;
  private debug = new PvPDebugLogger();

  // === UI ===
  private gameHUD!: GameHUD;
  private pauseMenu?: PauseMenu;
  private formationMenu?: FormationMenu;
  private resultScreen?: ResultScreen;
  private inGameSettings?: InGameSettings;
  private debugOverlay?: Phaser.GameObjects.Text;

  // === Tracking ===
  private lastShootingCap?: GameUnit;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data?: GameSceneData): void {
    this.state = createInitialState();
    this.initializeMode(data);
    this.startPositions = { ball: { x: 0, y: 0 }, caps: [] };
    this.caps = [];
    this.lastShootingCap = undefined;

    // Reset UI references
    this.pauseMenu = undefined;
    this.formationMenu = undefined;
    this.resultScreen = undefined;
    this.inGameSettings = undefined;
  }

  private initializeMode(data?: GameSceneData): void {
    this.state.isPvPMode = data?.isPvP ?? false;
    this.state.pvpData = data?.pvpData;

    // Faction setup
    const playerHasFaction = !!playerData.getFaction();
    this.state.useFactions = data?.useFactions ?? playerHasFaction;

    if (this.state.useFactions) {
      this.state.playerFaction = data?.playerFaction || playerData.getFaction() || 'cyborg';
      this.state.opponentFaction = data?.opponentFaction || this.getRandomOpponentFaction();

      const useArena = data?.useArena ?? true;
      if (useArena) {
        this.state.currentArena = getFactionArena(this.state.playerFaction);
        console.log(`[GameScene] Arena selected: ${this.state.currentArena.name}`);
      }

      console.log(`[GameScene] Faction mode: player=${this.state.playerFaction}, opponent=${this.state.opponentFaction}`);
    }

    // PvP setup
    if (this.state.isPvPMode && this.state.pvpData) {
      this.state.isAIEnabled = false;
      this.mp = MultiplayerManager.getInstance();
      this.state.isHost = this.mp.isHost();
      this.state.myPlayerIndex = this.mp.getMyPlayerIndex();
      this.state.currentTurnId = this.state.pvpData.currentTurn;
      this.state.myPlayer = this.mp.getMe() || undefined;
      this.state.opponentPlayer = this.mp.getOpponent() || undefined;

      if ((this.state.pvpData as any).serverTime) {
        const serverTime = Number((this.state.pvpData as any).serverTime);
        this.state.serverTimeOffset = serverTime - Date.now();
      }

      this.state.matchDuration = this.state.pvpData.config.MATCH_DURATION || 300;
    } else {
      this.state.isAIEnabled = data?.vsAI ?? true;
      this.state.aiDifficulty = data?.difficulty ?? 'medium';
      this.state.matchDuration = data?.matchDuration ?? 300;
    }

    this.state.matchRemainingTime = this.state.matchDuration;

    // Field skin
    this.state.fieldSkinId = this.state.isPvPMode
      ? this.state.pvpData?.fieldSkin || playerData.get().equippedFieldSkin || 'field_default'
      : playerData.get().equippedFieldSkin || 'field_default';
  }

  private getRandomOpponentFaction(): FactionId {
    const allFactions: FactionId[] = ['magma', 'cyborg', 'void', 'insect'];
    const available = allFactions.filter((f) => f !== this.state.playerFaction);
    return Phaser.Math.RND.pick(available);
  }

  create(): void {
    this.setupAudio();
    this.setupPhysics();
    this.calculateFieldBounds();
    this.createField();
    this.createEntities();
    this.createWalls();
    this.setupManagers();
    this.setupControllers();
    this.createUI();

    if (this.state.isPvPMode) {
      this.setupPvP();
    } else {
      this.startOfflineMatch();
    }

    this.updateCapsAuraState();
  }

  private setupAudio(): void {
    const audio = AudioManager.getInstance();
    audio.init(this);
    audio.stopMusic();
    audio.playAmbience('bgm_match');
    audio.playSFX('sfx_whistle');
  }

  // === ⭐ УЛУЧШЕННАЯ НАСТРОЙКА ФИЗИКИ ===
  private setupPhysics(): void {
    if (this.matter.world.runner) {
      (this.matter.world.runner as any).isFixed = true;
      (this.matter.world.runner as any).delta = 1000 / 60;
    }

    const engine = (this.matter.world as any).engine;
    if (engine) {
      engine.positionIterations = 14;      // было 10 → больше точности
      engine.velocityIterations = 14;      // было 10 → больше точности
      engine.constraintIterations = 4;     // ⭐ НОВОЕ — убивает phantom collisions
    }
    
    console.log('[GameScene] ⚙️ Physics engine optimized for high-speed collisions');
  }

  private calculateFieldBounds(): void {
    const { centerX, centerY, width, height } = this.cameras.main;

    this.state.fieldScale = Math.min(
      (width - FIELD.PADDING * 2) / FIELD.WIDTH,
      (height - FIELD.PADDING * 2) / FIELD.HEIGHT
    );

    const w = FIELD.WIDTH * this.state.fieldScale;
    const h = FIELD.HEIGHT * this.state.fieldScale;

    this.fieldBounds = {
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

  private createField(): void {
    this.fieldRenderer = new FieldRenderer(
      this,
      this.fieldBounds,
      this.state.fieldScale,
      this.state.fieldSkinId,
      this.state.currentArena
    );
    this.fieldRenderer.render();
  }

  private createEntities(): void {
    this.matchController = new MatchController();

    if (!this.state.isPvPMode) {
      this.matchController.startMatch(this);
    }

    const factory = new EntityFactory({
      scene: this,
      fieldBounds: this.fieldBounds,
      fieldScale: this.state.fieldScale,
      isPvPMode: this.state.isPvPMode,
      pvpData: this.state.pvpData,
      isHost: this.state.isHost,
      useFactions: this.state.useFactions,
      playerFaction: this.state.playerFaction,
      opponentFaction: this.state.opponentFaction,
      formation: this.matchController.getCurrentFormation(),
    });

    // Create ball
    const ballResult = factory.createBall();
    this.ball = ballResult.ball;
    this.startPositions.ball = ballResult.startPosition;

    // Create caps
    const capsResult = factory.createCaps();
    this.caps = capsResult.caps;
    this.startPositions.caps = capsResult.startPositions;

    // Set pixel-perfect mode
    this.caps.forEach((cap) => {
      const unitSprite = (cap as any).unitSprite;
      if (unitSprite?.texture) {
        unitSprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    });
    console.log('%c[GameScene] ✨ All units set to PIXEL-PERFECT mode', 'color: #00ff00; font-weight: bold;');
  }

  // === ⭐ СТОЙКИ ВОРОТ УПРУГИЕ ===
  private createWalls(): void {
    const { left, right, top, bottom, centerX } = this.fieldBounds;
    const goalWidth = GOAL.WIDTH * this.state.fieldScale;
    const goalDepth = GOAL.DEPTH * this.state.fieldScale;
    const postThickness = GOAL.POST_THICKNESS * this.state.fieldScale;
    const thickness = FIELD.BORDER_THICKNESS * 2;
    const sideWidth = (right - left - goalWidth) / 2;

    const wallOpts: Phaser.Types.Physics.Matter.MatterBodyConfig = {
      isStatic: true,
      restitution: 0.7,
      friction: 0.05,
      label: 'wall',
      collisionFilter: { category: COLLISION_CATEGORIES.WALL },
    };

    const postOpts: Phaser.Types.Physics.Matter.MatterBodyConfig = {
      ...wallOpts,
      restitution: 0.92,         // было 0.85 → стойки упругие!
      friction: 0.02,
      label: 'post',
    };

    // Side walls
    this.matter.add.rectangle(left - thickness / 2, (top + bottom) / 2, thickness, bottom - top, wallOpts);
    this.matter.add.rectangle(right + thickness / 2, (top + bottom) / 2, thickness, bottom - top, wallOpts);

    // Top walls (with goal gap)
    this.matter.add.rectangle(left + sideWidth / 2, top - thickness / 2, sideWidth, thickness, wallOpts);
    this.matter.add.rectangle(right - sideWidth / 2, top - thickness / 2, sideWidth, thickness, wallOpts);

    // Bottom walls (with goal gap)
    this.matter.add.rectangle(left + sideWidth / 2, bottom + thickness / 2, sideWidth, thickness, wallOpts);
    this.matter.add.rectangle(right - sideWidth / 2, bottom + thickness / 2, sideWidth, thickness, wallOpts);

    // Goals
    [{ y: top, dir: -1 }, { y: bottom, dir: 1 }].forEach(({ y, dir }) => {
      // Back wall of goal
      this.matter.add.rectangle(centerX, y + dir * (goalDepth + thickness / 2), goalWidth, thickness, wallOpts);
      // Goal posts ⭐
      this.matter.add.rectangle(centerX - goalWidth / 2 - postThickness / 2, y + dir * goalDepth / 2, postThickness, goalDepth, postOpts);
      this.matter.add.rectangle(centerX + goalWidth / 2 + postThickness / 2, y + dir * goalDepth / 2, postThickness, goalDepth, postOpts);
    });
    
    console.log('[GameScene] 🥅 Goal posts configured with high restitution (0.92)');
  }

  private setupManagers(): void {
    // Celebration manager
    this.celebrationManager = new CelebrationManager(this, {
      useFactions: this.state.useFactions,
      playerFaction: this.state.playerFaction,
      currentArena: this.state.currentArena,
    });

    // Match timer
    this.matchTimer = new MatchTimerManager(this, this.state.matchDuration, {
      onTick: (remaining, total) => {
        this.state.matchRemainingTime = remaining;
        this.gameHUD?.updateMatchTimer(remaining, total);
      },
      onTimeUp: () => this.handleMatchTimeUp(),
      onWarning30: () => AudioManager.getInstance().playSFX('sfx_whistle', { volume: 0.5 }),
      onWarning10: () => HapticManager.trigger('light'),
    });

    // Collision handler
    this.collisionHandler = new CollisionHandler(
      {
        scene: this,
        fieldBounds: this.fieldBounds,
        fieldScale: this.state.fieldScale,
        isPvPMode: this.state.isPvPMode,
        isHost: this.state.isHost,
        useFactions: this.state.useFactions,
        playerFaction: this.state.playerFaction,
      },
      {
        getBall: () => this.ball,
        getCaps: () => this.caps,
        getLastShootingCap: () => this.lastShootingCap,
        getLastShootingCapId: () => this.state.lastShootingCapId,
        getBallSpeedBeforeCollision: () => this.state.ballSpeedBeforeCollision,
        setBallSpeedBeforeCollision: (speed) => { this.state.ballSpeedBeforeCollision = speed; },
        getGuestLocalPhysicsUntil: () => this.state.guestLocalPhysicsUntil,
        setGuestLocalPhysicsUntil: (time) => { this.state.guestLocalPhysicsUntil = time; },
        clearSnapshotBuffer: () => {
          this.state.snapshotBuffer = [];
          this.pvpSyncManager?.clearState();
        },
        getFieldRenderer: () => this.fieldRenderer,
        debug: this.debug,
        triggerHaptic: HapticManager.trigger,
      }
    );
    this.collisionHandler.setup();
  }

  private setupControllers(): void {
    // Goal detector
    this.goalDetector = new GoalDetector(this, this.ball, this.fieldBounds, this.state.fieldScale);
    this.goalDetector.setCaps(this.caps as any, this.startPositions.caps);
    this.goalDetector.onGoal((player) => this.onGoalDetected(player));

    // Score manager
    this.scoreManager = new ScoreManager(this);

    // Game state manager
    this.gameStateManager = new GameStateManager(this.ball, this.caps as any);
    this.gameStateManager.setPvPMode(this.state.isPvPMode);
    this.gameStateManager.setIsHost(this.state.isHost);

    this.gameStateManager.onAllObjectsStopped(() => {
      if (this.state.isPvPMode && this.state.isHost) {
        if (this.gameStateManager.getState() === 'moving' && 
            this.time.now - this.state.lastShootTime > 500) {
          this.debug.log('STATE', 'All stopped - notifying server');
          this.mp.sendObjectsStopped();
        }
      }
    });

    if (!this.state.isPvPMode) {
      this.gameStateManager.onTurnChange((player) => this.onLocalTurnChange(player));
    }

    this.gameStateManager.onStateChange((state) => this.onStateChange(state));

    // Shooting controller
    this.shootingController = new ShootingController(this);

    if (this.state.isPvPMode) {
      this.shootingController.setPvPMode(true, this.state.isHost);
    }

    const myOwner = this.state.isPvPMode ? this.getMyOwner() : 1;
    let localCapIndex = 0;

    this.caps.forEach((cap) => {
      if (cap.owner === myOwner) {
        this.shootingController.registerCap(cap as any, localCapIndex);
        localCapIndex++;
      }
    });

    if (this.state.isPvPMode) {
      const isMyTurn = this.state.currentTurnId === this.mp.getMyId();
      const activeOwner: PlayerNumber = isMyTurn ? myOwner : (myOwner === 1 ? 2 : 1);

      this.shootingController.setCurrentPlayer(activeOwner);
      this.gameStateManager.setCurrentPlayer(activeOwner);
      this.shootingController.setEnabled(isMyTurn);
    } else {
      this.shootingController.setCurrentPlayer(1);
      this.gameStateManager.setCurrentPlayer(1);
      this.shootingController.setEnabled(true);
    }

    this.shootingController.onCapSelected((cap: ShootableUnit | null) => {
      this.state.selectedCapId = cap?.id;
      this.updateCapsAuraState();
    });

    this.shootingController.onShoot((data: ShootEventData) => this.handleShoot(data));

    this.highlightCurrentPlayerCaps();

    // === AI Controller (ОБНОВЛЁННАЯ ВЕРСИЯ) ===
    if (this.state.isAIEnabled && !this.state.isPvPMode) {
      this.aiController = new AIController(this, this.state.aiDifficulty);
      
      // Юниты AI (player 2)
      const aiUnits = this.caps.filter((c) => c.owner === 2);
      
      // Юниты игрока (player 1) - для полной симуляции
      const playerUnits = this.caps.filter((c) => c.owner === 1);
      
      // Инициализируем с обеими командами
      this.aiController.init(aiUnits as any[], this.ball, playerUnits as any[]);
      
      this.aiController.onMoveComplete(() => {
        console.log('[GameScene] AI move complete');
        this.gameStateManager.onShot();
      });
    }
  }

  private createUI(): void {
    this.gameHUD = new GameHUD(this, {
      isAIMode: this.state.isAIEnabled,
      aiDifficulty: this.state.aiDifficulty,
      isPvP: this.state.isPvPMode,
      opponentName: this.state.opponentPlayer?.name || 'Opponent',
      matchDuration: this.state.matchDuration,
      fieldSkinId: this.state.fieldSkinId,
      arena: this.state.currentArena,
      playerFaction: this.state.useFactions ? this.state.playerFaction : undefined,
      opponentFaction: this.state.useFactions ? this.state.opponentFaction : undefined,
    });

    this.gameHUD.onPause(() => {
      AudioManager.getInstance().playSFX('sfx_click');
      this.showPauseMenu();
    });

    this.gameHUD.updateMatchTimer(this.state.matchRemainingTime, this.state.matchDuration);
    this.updateHUD();
  }

  private setupPvP(): void {
    this.pvpSyncManager = new PvPSyncManager(
      this,
      { isHost: this.state.isHost, myPlayerIndex: this.state.myPlayerIndex },
      {
        onShootExecuted: (data, isMyShoot) => this.handlePvPShootExecuted(data, isMyShoot),
        onTurnChange: (data) => this.handlePvPTurnChange(data),
        onGoalScored: (data) => this.handlePvPGoalScored(data),
        onContinueGame: (data) => this.handlePvPContinueGame(data),
        onMatchFinished: (data) => this.handlePvPMatchFinished(data),
        onOpponentLeft: (reason, data) => this.handlePvPOpponentLeft(reason, data),
        onTimerUpdate: (remaining, total) => {
          this.state.matchRemainingTime = remaining;
          this.gameHUD.updateMatchTimer(remaining, total);
        },
      },
      this.debug
    );

    this.pvpSyncManager.setupListeners();
    this.pvpSyncManager.startTimeSync();

    if (this.state.isHost) {
      this.pvpSyncManager.startSyncInterval(
        () => this.ball,
        () => this.caps
      );
    }

    this.createDebugOverlay();
    this.debug.log('INIT', 'Caps created:');
    this.debug.logCapsState(this.caps);
  }

  private startOfflineMatch(): void {
    this.matchTimer.start();
  }

  private createDebugOverlay(): void {
    if (!this.state.isPvPMode) return;

    this.debugOverlay = this.add
      .text(10, 10, '', {
        fontSize: '11px',
        fontFamily: 'monospace',
        color: this.state.isHost ? '#00ff00' : '#00aaff',
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: { x: 4, y: 4 },
      })
      .setDepth(9999)
      .setScrollFactor(0);

    this.time.addEvent({
      delay: 100,
      callback: () => this.updateDebugOverlay(),
      loop: true,
    });
  }

  private updateDebugOverlay(): void {
    if (!this.debugOverlay || !this.state.isPvPMode) return;

    const role = this.state.isHost ? 'HOST' : 'GUEST';
    const isMyTurn = this.state.currentTurnId === this.mp.getMyId();
    const state = this.gameStateManager.getState();
    const fps = Math.round(this.game.loop.actualFps);
    const now = this.time.now;
    const inLocal = this.state.guestLocalPhysicsUntil > 0 && now < this.state.guestLocalPhysicsUntil;
    const phase = inLocal ? 'LOCAL' : 'SYNC';
    const snapshotCount = this.pvpSyncManager?.getSnapshotBuffer().length || 0;

    const arenaInfo = this.state.currentArena ? `\nArena: ${this.state.currentArena.name}` : '';
    const factionInfo = this.state.useFactions ? `\nFaction: ${this.state.playerFaction}${arenaInfo}` : '';

    this.debugOverlay.setText([
      `[${role}] FPS:${fps}`,
      `State:${state} Turn:${isMyTurn ? 'ME' : 'OPP'}`,
      `Phase:${phase} Snaps:${snapshotCount}${factionInfo}`,
    ].join('\n'));
  }

  // === UPDATE LOOP ===

  update(): void {
    const state = this.gameStateManager.getState();
    if (state === 'paused' || state === 'finished' || state === 'goal') return;
    if (this.state.isGoalCelebrating) return;

    if (this.state.isPvPMode) {
      this.updatePvP();
    } else {
      this.updateOffline();
    }

    this.updateCrowdIntensity();
  }

  private updatePvP(): void {
    this.debug.incrementFrame();

    if (this.state.isHost) {
      this.ball.update();
      this.caps.forEach((cap) => cap.update());
      this.gameStateManager.update();
      this.goalDetector.update();
      this.checkBoundaries();
    } else {
      const now = this.time.now;
      const inLocalPhysics = this.state.guestLocalPhysicsUntil > 0 && now < this.state.guestLocalPhysicsUntil;

      if (inLocalPhysics) {
        this.ball.update();
        this.caps.forEach((cap) => cap.update());
        this.checkBoundaries();

        if (this.debug.getFrameCount() % 60 === 0) {
          this.debug.log('LOCAL_PHYSICS', 'Running local simulation');
        }

        // Drift correction
        const lastSnapshot = this.pvpSyncManager?.getLastServerSnapshot();
        if (lastSnapshot && now > this.state.syncGracePeriodUntil) {
          const dist = Phaser.Math.Distance.Between(
            this.ball.x,
            this.ball.y,
            lastSnapshot.ball.x,
            lastSnapshot.ball.y
          );

          if (dist > 200) {
            this.debug.log('SYNC', `Critical drift (${dist.toFixed(1)}px), hard reset`);
            this.state.guestLocalPhysicsUntil = 0;
            this.pvpSyncManager?.clearState();
          } else if (dist > 10) {
            const lerpFactor = 0.2;
            const newBallX = Phaser.Math.Linear(this.ball.body.position.x, lastSnapshot.ball.x, lerpFactor);
            const newBallY = Phaser.Math.Linear(this.ball.body.position.y, lastSnapshot.ball.y, lerpFactor);
            const newBallVX = Phaser.Math.Linear(this.ball.body.velocity.x, lastSnapshot.ball.vx, lerpFactor);
            const newBallVY = Phaser.Math.Linear(this.ball.body.velocity.y, lastSnapshot.ball.vy, lerpFactor);

            this.matter.body.setPosition(this.ball.body, { x: newBallX, y: newBallY });
            this.matter.body.setVelocity(this.ball.body, { x: newBallVX, y: newBallVY });
          }
        }
      } else {
        this.pvpSyncManager?.interpolateAndApply(this.ball, this.caps, this.fieldBounds);
        this.ball.syncSpriteWithBody();
        this.caps.forEach((cap) => cap.syncSpriteWithBody());
      }
    }
  }

  private updateOffline(): void {
    this.ball.update();
    this.caps.forEach((cap) => cap.update());
    this.gameStateManager.update();
    this.goalDetector.update();
    this.checkBoundaries();
  }

  private updateCrowdIntensity(): void {
    if (!this.ball || !this.fieldBounds) return;
    const dist = (this.ball.y - this.fieldBounds.top) / this.fieldBounds.height;
    const intensity = dist < 0.25 ? 0.7 : dist < 0.5 ? 0.4 : 0.2;
    AudioManager.getInstance().setAmbienceVolume(intensity);
  }

  private checkBoundaries(): void {
    const bounds = this.fieldBounds;
    const goalHW = (GOAL.WIDTH * this.state.fieldScale) / 2;

    this.constrainBody(this.ball, bounds, goalHW, 5);
    this.caps.forEach((cap) => this.constrainBody(cap, bounds, 0, 5));
  }

  private constrainBody(
    entity: Ball | GameUnit,
    bounds: FieldBounds,
    goalHW: number,
    padding: number
  ): void {
    const pos = entity.body.position;
    const vel = entity.body.velocity;
    const r = entity.getRadius();
    const inGoalX = goalHW > 0 && Math.abs(pos.x - bounds.centerX) < goalHW;

    if (pos.x < bounds.left + r - padding) {
      this.matter.body.setPosition(entity.body, { x: bounds.left + r, y: pos.y });
      this.matter.body.setVelocity(entity.body, { x: Math.abs(vel.x) * 0.5, y: vel.y });
    }
    if (pos.x > bounds.right - r + padding) {
      this.matter.body.setPosition(entity.body, { x: bounds.right - r, y: pos.y });
      this.matter.body.setVelocity(entity.body, { x: -Math.abs(vel.x) * 0.5, y: vel.y });
    }
    if (pos.y < bounds.top + r - padding && !inGoalX) {
      this.matter.body.setPosition(entity.body, { x: pos.x, y: bounds.top + r });
      this.matter.body.setVelocity(entity.body, { x: vel.x, y: Math.abs(vel.y) * 0.5 });
    }
    if (pos.y > bounds.bottom - r + padding && !inGoalX) {
      this.matter.body.setPosition(entity.body, { x: pos.x, y: bounds.bottom - r });
      this.matter.body.setVelocity(entity.body, { x: vel.x, y: -Math.abs(vel.y) * 0.5 });
    }
  }

  // === SHOOTING ===

  private handleShoot(data: ShootEventData): void {
    this.debug.log('SHOOT', 'Local shoot', {
      capId: data.cap.id,
      localCapIndex: data.localCapIndex,
      velocity: data.velocity,
      hitOffset: data.hitOffset,
    });

    this.state.isProcessingTurn = true;
    this.state.lastShootTime = this.time.now;
    this.shootingController.setEnabled(false);

    this.state.selectedCapId = undefined;
    this.updateCapsAuraState();

    this.state.lastShootingCapId = data.cap.id;
    this.lastShootingCap = data.cap as any;
    this.state.syncGracePeriodUntil = this.time.now + 500;

    const shootingCap = this.caps.find((c) => c.id === data.cap.id);
    if (shootingCap && hasPlayHitEffect(shootingCap)) {
      shootingCap.playHitEffect();
    }

    if (this.state.isPvPMode && !this.state.isHost) {
      this.pvpSyncManager?.clearState();
      this.state.guestLocalPhysicsUntil = this.time.now + 10000;

      this.matter.body.setVelocity(data.cap.body, { x: 0, y: 0 });
      this.matter.body.setVelocity(data.cap.body, { x: data.velocity.x, y: data.velocity.y });

      const speed = Math.sqrt(data.velocity.x * data.velocity.x + data.velocity.y * data.velocity.y);
      this.debug.log('PHYSICS', `Local physics started (speed: ${speed.toFixed(1)})`);
    }

    this.gameStateManager.onShot();

    if (this.state.isPvPMode) {
      const startIndex = this.mp.getMyCapStartIndex();
      const serverCapId = startIndex + data.localCapIndex;

      const shootData: any = {
        capId: serverCapId,
        force: data.velocity,
        position: { x: data.cap.body.position.x, y: data.cap.body.position.y },
      };

      if (data.hitOffset !== undefined && Math.abs(data.hitOffset) > 0.1) {
        shootData.hitOffset = data.hitOffset;
      }

      this.mp.sendShoot(serverCapId, data.velocity, shootData.position, shootData.hitOffset);
    }
  }

  // === PVP HANDLERS ===

  private handlePvPShootExecuted(data: ShootData, isMyShoot: boolean): void {
    this.debug.log('SHOOT_RECV', `capId=${data.capId} isMyShoot=${isMyShoot}`, data.force);

    if (isMyShoot) {
      this.debug.log('SHOOT', 'Confirmed by server');
      return;
    }

    this.state.isProcessingTurn = true;
    this.shootingController.setEnabled(false);
    this.gameStateManager.onShot();
    this.state.lastShootTime = this.time.now;

    this.state.selectedCapId = undefined;
    this.updateCapsAuraState();

    if (!this.state.isHost) {
      this.state.guestLocalPhysicsUntil = 0;
      this.pvpSyncManager?.clearState();
    }

    if (this.state.isHost) {
      const cap = this.caps[data.capId];
      if (!cap) {
        this.debug.error('SHOOT', `Cap not found: ${data.capId}`);
        return;
      }

      if (data.position) {
        this.matter.body.setPosition(cap.body, data.position);
      }

      cap.highlight(true);
      this.time.delayedCall(200, () => cap.highlight(false));

      this.lastShootingCap = cap;

      if ((data as any).hitOffset !== undefined) {
        cap.setLastHitOffset((data as any).hitOffset);
      }

      this.matter.body.setVelocity(cap.body, { x: 0, y: 0 });
      this.matter.body.setVelocity(cap.body, data.force);

      if (hasPlayHitEffect(cap)) {
        cap.playHitEffect();
      }
    } else {
      const cap = this.caps[data.capId];
      if (cap) {
        cap.highlight(true);
        this.time.delayedCall(200, () => cap.highlight(false));
      }
    }
  }

  private handlePvPTurnChange(data: { currentTurn: string; scores: Record<string, number> }): void {
    const isMyTurn = data.currentTurn === this.mp.getMyId();
    this.debug.log('TURN', isMyTurn ? '🎮 MY TURN' : '⏳ OPPONENT TURN');

    const myOwner = this.getMyOwner();
    const activeOwner: PlayerNumber = isMyTurn ? myOwner : (myOwner === 1 ? 2 : 1);

    this.state.currentTurnId = data.currentTurn;
    this.state.isProcessingTurn = false;
    this.state.selectedCapId = undefined;
    this.updateScoreFromPvP(data.scores);
    this.gameStateManager.forceStop();

    // Apply last snapshot on turn change (guest only)
    if (!this.state.isHost) {
      const lastSnapshot = this.pvpSyncManager?.getLastServerSnapshot();
      if (lastSnapshot) {
        this.debug.log('SYNC', 'Applying snapshot on turn change');
        this.matter.body.setPosition(this.ball.body, { x: lastSnapshot.ball.x, y: lastSnapshot.ball.y });
        this.matter.body.setVelocity(this.ball.body, { x: lastSnapshot.ball.vx, y: lastSnapshot.ball.vy });
        this.ball.syncSpriteWithBody();

        lastSnapshot.caps.forEach((capState, i) => {
          const cap = this.caps[i];
          if (cap) {
            this.matter.body.setPosition(cap.body, { x: capState.x, y: capState.y });
            this.matter.body.setVelocity(cap.body, { x: capState.vx, y: capState.vy });
            cap.syncSpriteWithBody();
          }
        });
      }
    }

    this.state.guestLocalPhysicsUntil = 0;
    this.pvpSyncManager?.clearState();
    this.state.lastShootingCapId = undefined;
    this.lastShootingCap = undefined;
    this.state.syncGracePeriodUntil = 0;

    this.shootingController.setCurrentPlayer(activeOwner);
    this.gameStateManager.setCurrentPlayer(activeOwner);
    this.shootingController.setEnabled(isMyTurn);

    this.highlightCurrentPlayerCaps();
    this.updateCapsAuraState();
    this.updateHUD();
  }

  private handlePvPGoalScored(data: {
    scorerId: string;
    scores: Record<string, number>;
    winner: string | null;
    finalPositions?: FinalPositions;
  }): void {
    if (this.state.isGoalCelebrating) return;
    this.state.isGoalCelebrating = true;

    this.debug.log('GOAL', 'Scored!', data);

    this.state.guestLocalPhysicsUntil = 0;
    this.pvpSyncManager?.clearState();
    this.state.lastShootingCapId = undefined;
    this.lastShootingCap = undefined;
    this.state.selectedCapId = undefined;

    if (!this.state.isHost && data.finalPositions) {
      this.pvpSyncManager?.applyFinalPositions(this.ball, this.caps, data.finalPositions);
    }

    this.freezeAllObjects();

    const audio = AudioManager.getInstance();
    audio.playSFX('sfx_net', { volume: 1.5 });
    this.time.delayedCall(400, () => {
      audio.playSFX('sfx_goal');
      this.time.delayedCall(400, () => audio.playSFX('sfx_whistle', { volume: 0.8 }));
    });

    HapticManager.triggerNotification('success');
    this.updateScoreFromPvP(data.scores);
    this.state.isProcessingTurn = true;
    this.shootingController.setEnabled(false);
    this.gameStateManager.setGoalState();
    this.updateHUD();

    const isMyGoal = data.scorerId === this.mp.getMyId();
    this.celebrationManager.showGoalCelebration(isMyGoal);
    HapticManager.trigger(isMyGoal ? 'heavy' : 'medium');

    if (this.state.isHost) {
      this.time.delayedCall(3000, () => this.mp.sendReadyAfterGoal(data.scorerId));
    }
  }

  private handlePvPContinueGame(data: { currentTurn: string }): void {
    this.debug.log('GAME', 'Continue after goal');
    this.celebrationManager.hide();
    this.state.isGoalCelebrating = false;

    this.state.guestLocalPhysicsUntil = 0;
    this.pvpSyncManager?.clearState();
    this.state.lastShootingCapId = undefined;
    this.lastShootingCap = undefined;
    this.state.selectedCapId = undefined;

    this.state.currentTurnId = data.currentTurn;
    this.resetPositions();
    this.goalDetector.reset();
    this.state.isProcessingTurn = false;
    this.gameStateManager.forceStop();
    this.gameStateManager.setPlayingState();

    const isMyTurn = this.state.currentTurnId === this.mp.getMyId();
    const myOwner = this.getMyOwner();
    const activeOwner: PlayerNumber = isMyTurn ? myOwner : (myOwner === 1 ? 2 : 1);

    this.shootingController.setCurrentPlayer(activeOwner);
    this.gameStateManager.setCurrentPlayer(activeOwner);
    this.shootingController.setEnabled(isMyTurn);

    this.highlightCurrentPlayerCaps();
    this.updateCapsAuraState();
    this.updateHUD();
    AudioManager.getInstance().playSFX('sfx_whistle', { volume: 0.5 });
  }

  private handlePvPMatchFinished(data: any): void {
    this.debug.log('GAME', 'Match finished!', data);
    const isMyWin = data.winner === this.mp.getMyId();
    this.handlePvPMatchEnd(data.isDraw ? null : isMyWin, data.scores, data.reason, data.rewards);
  }

  private handlePvPOpponentLeft(reason: string, data: any): void {
    this.debug.log('GAME', `Opponent left: ${reason}`);
    AudioManager.getInstance().stopAmbience();
    AudioManager.getInstance().playSFX('sfx_whistle');
    AudioManager.getInstance().playSFX('sfx_win', { delay: 0.5 });
    this.handlePvPMatchEnd(true, data.scores, reason, data.rewards);
  }

  private handlePvPMatchEnd(
    isMyWin: boolean | null,
    scores: Record<string, number>,
    reason: string,
    rewards?: Record<string, { coins: number; xp: number }>
  ): void {
    this.celebrationManager.hide();
    this.state.isGoalCelebrating = false;
    this.gameStateManager.finish();
    this.shootingController.setEnabled(false);
    this.state.isProcessingTurn = true;
    this.gameHUD.setPauseEnabled(false);

    const audio = AudioManager.getInstance();
    audio.stopAmbience();
    audio.playSFX('sfx_whistle');
    audio.playSFX(isMyWin === null ? 'sfx_click' : isMyWin ? 'sfx_win' : 'sfx_lose', { delay: 0.5 });

    const myId = this.mp.getMyId()!;
    const myRewards = rewards?.[myId] || { coins: isMyWin ? 150 : 30, xp: isMyWin ? 50 : 15 };
    const myScore = scores[myId] || 0;
    const oppScore = scores[this.state.opponentPlayer?.id || ''] || 0;

    const result = ResultHelper.createPvPResult(isMyWin, myScore, oppScore, reason, myRewards);
    this.showResultScreen(result);
  }

  // === GOAL HANDLING ===

  private onGoalDetected(player: PlayerNumber): void {
    if (this.state.isPvPMode) {
      if (this.state.isHost && this.time.now > 2000) {
        const scorerId = player === 1 ? this.mp.getMyId()! : this.state.opponentPlayer!.id;
        this.debug.log('GOAL', `Detected! Scorer: ${scorerId}`);
        this.mp.sendGoal(scorerId, this.getCurrentPositions());
      }
    } else {
      this.handleOfflineGoal(player);
    }
  }

  private handleOfflineGoal(scoringPlayer: PlayerNumber): void {
    const audio = AudioManager.getInstance();
    audio.playSFX('sfx_net', { volume: 1.5 });
    this.time.delayedCall(400, () => {
      audio.playSFX('sfx_goal');
      this.time.delayedCall(400, () => audio.playSFX('sfx_whistle', { volume: 0.8 }));
    });

    HapticManager.triggerNotification('success');

    this.state.isProcessingTurn = true;
    this.state.isGoalCelebrating = true;
    this.state.selectedCapId = undefined;
    this.gameStateManager.setGoalState();
    this.shootingController.setEnabled(false);

    if (this.aiController) {
      this.aiController.stop();
    }

    this.matchTimer.pause();
    this.matchController.addGoal(scoringPlayer);
    this.scoreManager.addGoal(scoringPlayer);

    // === ОБНОВЛЯЕМ СЧЁТ В AI ДЛЯ АДАПТИВНОЙ ИГРЫ ===
    if (this.aiController) {
      const scores = this.scoreManager.getScores();
      this.aiController.updateScore(scores[1], scores[2]);
      this.aiController.recordGoal(scoringPlayer === 1 ? 'player' : 'ai');
    }

    this.freezeAllObjects();
    this.celebrationManager.showGoalCelebration(scoringPlayer === 1);
    HapticManager.trigger(scoringPlayer === 1 ? 'heavy' : 'medium');

    this.time.delayedCall(GAME.GOAL_DELAY, () => {
      this.celebrationManager.hide();
      this.state.isGoalCelebrating = false;
      this.afterOfflineGoal(scoringPlayer);
    });
  }

  private afterOfflineGoal(scoringPlayer: PlayerNumber): void {
    if (this.matchController.applyPendingFormation()) {
      this.applyFormationToField(this.matchController.getCurrentFormation());
      this.gameHUD.hidePendingFormationBadge();
      this.gameHUD.showFormationAppliedNotification();
    }

    this.resetPositions();

    const nextPlayer: PlayerNumber = scoringPlayer === 1 ? 2 : 1;

    if (this.aiController) {
      this.aiController.stop();
    }

    this.gameStateManager.forceStop();
    this.gameStateManager.setCurrentPlayer(nextPlayer);
    this.shootingController.setCurrentPlayer(nextPlayer);
    this.goalDetector.reset();
    this.highlightCurrentPlayerCaps();
    this.updateCapsAuraState();
    this.updateHUD();
    this.state.isProcessingTurn = false;
    this.lastShootingCap = undefined;
    this.state.selectedCapId = undefined;

    this.matchTimer.resume();
    AudioManager.getInstance().playSFX('sfx_whistle', { volume: 0.5 });

    if (nextPlayer === 1) {
      this.shootingController.setEnabled(true);
    } else if (this.aiController) {
      this.shootingController.setEnabled(false);
      this.time.delayedCall(500, () => {
        if (this.gameStateManager.getCurrentPlayer() === 2) {
          this.aiController?.startTurn();
        }
      });
    }
  }

  private handleMatchTimeUp(): void {
    console.log('[GameScene] Match time is up!');

    this.matchTimer.stop();

    if (this.aiController) {
      this.aiController.stop();
    }

    const scores = this.scoreManager.getScores();
    let winner: PlayerNumber | null = null;

    if (scores[1] > scores[2]) {
      winner = 1;
    } else if (scores[2] > scores[1]) {
      winner = 2;
    }

    this.gameStateManager.finish();
    this.shootingController.setEnabled(false);
    this.state.isProcessingTurn = true;
    this.gameHUD.setPauseEnabled(false);

    const audio = AudioManager.getInstance();
    audio.stopAmbience();
    audio.playSFX('sfx_whistle');

    if (winner === null) {
      audio.playSFX('sfx_click', { delay: 0.5 });
    } else if (winner === 1) {
      audio.playSFX('sfx_win', { delay: 0.5 });
    } else {
      audio.playSFX('sfx_lose', { delay: 0.5 });
    }

    const result = ResultHelper.createTimeUpResult(winner, scores);
    this.showResultScreen(result);
  }

  // === TURN HANDLING ===

  private onLocalTurnChange(player: PlayerNumber): void {
    if (this.state.isPvPMode) return;

    console.log(`[GameScene] Turn changed to player ${player}`);

    this.state.isProcessingTurn = false;
    this.lastShootingCap = undefined;
    this.state.selectedCapId = undefined;
    this.shootingController.setCurrentPlayer(player);
    this.updateHUD();
    this.highlightCurrentPlayerCaps();
    this.updateCapsAuraState();

    if (player === 2 && this.aiController) {
      console.log('[GameScene] Starting AI turn');
      this.shootingController.setEnabled(false);
      this.aiController.startTurn();
    } else {
      console.log('[GameScene] Starting Player turn');
      if (this.aiController) {
        this.aiController.stop();
      }
      this.shootingController.setEnabled(true);
    }
  }

  private onStateChange(state: string): void {
    console.log(`[GameScene] State changed to: ${state}`);

    if (this.state.isPvPMode) {
      this.debug.log('STATE', `Changed to: ${state}`);
      if (state === 'moving') {
        this.shootingController.setEnabled(false);
      }
    } else {
      const currentPlayer = this.gameStateManager.getCurrentPlayer();
      const isPlayerTurn = currentPlayer === 1;

      if (state === 'moving') {
        this.shootingController.setEnabled(false);
      } else if (state === 'waiting') {
        if (isPlayerTurn) {
          this.shootingController.setEnabled(true);
          if (this.aiController) {
            this.aiController.stop();
          }
        } else if (this.aiController) {
          if (currentPlayer === 2 && !this.aiController.isThinking) {
            console.log('[GameScene] Objects stopped, starting AI turn');
            this.aiController.startTurn();
          }
        }
      }
    }

    if (state === 'waiting') {
      this.state.isProcessingTurn = false;
      this.lastShootingCap = undefined;
      this.state.selectedCapId = undefined;
      this.updateCapsAuraState();
    }

    if (!this.state.isPvPMode) {
      if (state === 'paused') {
        this.matchTimer.pause();
      } else if (state === 'waiting' || state === 'moving') {
        this.matchTimer.resume();
      }
    }

    this.updateHUD();
  }

  // === UI ===

  private updateHUD(): void {
    const scores = this.scoreManager.getScores();

    if (this.state.isPvPMode) {
      const isMyTurn = this.state.currentTurnId === this.mp.getMyId();
      this.gameHUD.updateTurn(isMyTurn ? 1 : 2, this.gameStateManager.getState(), false);
    } else {
      this.gameHUD.updateTurn(
        this.gameStateManager.getCurrentPlayer(),
        this.gameStateManager.getState(),
        this.state.isAIEnabled
      );
    }

    this.gameHUD.updateScore(scores[1], scores[2]);
  }

  private showPauseMenu(): void {
    if (this.pauseMenu || this.gameStateManager.getState() === 'finished') return;

    this.gameStateManager.pause();
    this.matchTimer.pause();

    this.pauseMenu = new PauseMenu(this, {
      onResume: () => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.pauseMenu = undefined;
        this.gameStateManager.resume();
        this.matchTimer.resume();
      },
      onChangeFormation: this.state.isPvPMode
        ? undefined
        : () => {
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
        this.handleSurrender();
      },
    });
  }

  private showFormationMenu(): void {
    if (this.formationMenu || this.state.isPvPMode) return;

    this.formationMenu = new FormationMenu(this, this.matchController.getCurrentFormation().id, {
      onSelect: (formation: Formation) => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.formationMenu = undefined;
        this.handleFormationSelect(formation);
        this.gameStateManager.resume();
        this.matchTimer.resume();
      },
      onCancel: () => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.formationMenu = undefined;
        this.gameStateManager.resume();
        this.matchTimer.resume();
      },
    });
  }

  private handleFormationSelect(formation: Formation): void {
    if (formation.id === this.matchController.getCurrentFormation().id) {
      return;
    }
    this.matchController.setPendingFormation(formation);
    this.gameHUD.showPendingFormationBadge(formation.name);
  }

  private showInGameSettings(): void {
    if (this.inGameSettings) return;

    this.inGameSettings = new InGameSettings(this, {
      onClose: () => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.inGameSettings = undefined;
        this.gameStateManager.resume();
        this.matchTimer.resume();
      },
    });
  }

  private showResultScreen(result: MatchResult): void {
    this.resultScreen = new ResultScreen(this, result, this.state.isAIEnabled, {
      onRematch: () => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.resultScreen = undefined;
        if (this.state.isPvPMode) {
          this.cleanupPvP();
          this.scene.start('MatchmakingScene');
        } else {
          this.restartGame();
        }
      },
      onMainMenu: () => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.resultScreen = undefined;
        this.cleanupPvP();
        this.scene.start('MainMenuScene');
      },
    });
  }

  private handleSurrender(): void {
    this.matchTimer.stop();

    if (this.state.isPvPMode) {
      this.mp.sendSurrender();
    }

    if (this.aiController) {
      this.aiController.stop();
    }

    const matchControllerResult = this.matchController.surrender();

    const result: MatchResult = {
      winner: matchControllerResult.winner ?? null,
      isWin: matchControllerResult.isWin ?? false,
      isDraw: matchControllerResult.isDraw ?? false,
      playerGoals: matchControllerResult.playerGoals ?? 0,
      opponentGoals: matchControllerResult.opponentGoals ?? 0,
      xpEarned: matchControllerResult.xpEarned ?? 0,
      coinsEarned: matchControllerResult.coinsEarned ?? 0,
      isPerfectGame: matchControllerResult.isPerfectGame ?? false,
      newAchievements: matchControllerResult.newAchievements ?? [],
      reason: 'surrender',
      message: 'You surrendered!',
    };

    this.gameStateManager.finish();
    this.shootingController.setEnabled(false);
    this.state.isProcessingTurn = true;
    this.gameHUD.setPauseEnabled(false);

    AudioManager.getInstance().stopAmbience();
    AudioManager.getInstance().playSFX('sfx_lose');

    this.showResultScreen(result);
  }

  // === HELPERS ===

  private getMyOwner(): PlayerNumber {
    return (this.state.myPlayerIndex + 1) as PlayerNumber;
  }

  private getCurrentPositions(): FinalPositions {
    return {
      ball: { x: this.ball.body.position.x, y: this.ball.body.position.y },
      caps: this.caps.map((cap) => ({ x: cap.body.position.x, y: cap.body.position.y })),
    };
  }

  private updateScoreFromPvP(scores: Record<string, number>): void {
    const myId = this.mp.getMyId()!;
    const oppId = this.state.opponentPlayer?.id || '';
    this.scoreManager.setScores(scores[myId] || 0, scores[oppId] || 0);
  }

  private freezeAllObjects(): void {
    if (this.ball?.body) {
      this.matter.body.setVelocity(this.ball.body, { x: 0, y: 0 });
      this.matter.body.setAngularVelocity(this.ball.body, 0);
    }
    this.caps.forEach((cap) => {
      if (cap?.body) {
        this.matter.body.setVelocity(cap.body, { x: 0, y: 0 });
        this.matter.body.setAngularVelocity(cap.body, 0);
      }
    });
  }

  private resetPositions(): void {
    this.ball.reset(this.startPositions.ball.x, this.startPositions.ball.y);
    this.caps.forEach((cap, i) => {
      cap.reset(this.startPositions.caps[i].x, this.startPositions.caps[i].y);
    });
  }

  private highlightCurrentPlayerCaps(): void {
    if (this.state.isPvPMode) {
      const isMyTurn = this.state.currentTurnId === this.mp.getMyId();
      const myOwner = this.getMyOwner();
      this.caps.forEach((cap) => cap.highlight(isMyTurn && cap.owner === myOwner));
    } else {
      const current = this.gameStateManager.getCurrentPlayer();
      const show = !this.aiController || current === 1;
      this.caps.forEach((cap) => cap.highlight(show && cap.owner === current));
    }
  }

  private updateCapsAuraState(): void {
    const currentPlayer = this.gameStateManager?.getCurrentPlayer() || 1;

    this.caps.forEach((cap) => {
      const isActiveTeamTurn = cap.owner === currentPlayer;
      const isSelected = cap.id === this.state.selectedCapId;

      cap.setActiveTeamTurn(isActiveTeamTurn);
      cap.setSelected(isSelected);
    });
  }

  private applyFormationToField(formation: Formation): void {
    const playerCaps = this.caps.filter((c) => c.owner === 1);
    const enemyCaps = this.caps.filter((c) => c.owner === 2);

    formation.slots.forEach((slot, i) => {
      if (playerCaps[i]) {
        const pos = this.relativeToAbsolute(slot.x, slot.y);
        this.startPositions.caps[i] = pos;
      }
      if (enemyCaps[i]) {
        const pos = this.relativeToAbsolute(slot.x, 1 - slot.y);
        this.startPositions.caps[i + 3] = pos;
      }
    });
  }

  private relativeToAbsolute(relX: number, relY: number): { x: number; y: number } {
    return {
      x: this.fieldBounds.left + this.fieldBounds.width * relX,
      y: this.fieldBounds.top + this.fieldBounds.height * relY,
    };
  }

  private restartGame(): void {
    this.celebrationManager.hide();
    this.state.isGoalCelebrating = false;

    this.matchTimer.reset();

    if (this.aiController) {
      this.aiController.stop();
    }

    this.matchController.reset();
    this.matchController.startMatch(this);

    this.scoreManager.reset();
    this.resetPositions();
    this.goalDetector.reset();
    this.gameStateManager.forceStop();
    this.gameStateManager.setCurrentPlayer(1);
    this.shootingController.setCurrentPlayer(1);
    this.shootingController.setEnabled(true);
    this.state.isProcessingTurn = false;
    this.lastShootingCap = undefined;
    this.state.selectedCapId = undefined;
    this.gameHUD.setPauseEnabled(true);
    this.gameHUD.hidePendingFormationBadge();
    this.highlightCurrentPlayerCaps();
    this.updateCapsAuraState();
    this.updateHUD();

    this.matchTimer.start();

    AudioManager.getInstance().stopAll();
    AudioManager.getInstance().playAmbience('bgm_match');
    AudioManager.getInstance().playSFX('sfx_whistle');
  }

  // === CLEANUP ===

  private cleanupPvP(): void {
    if (!this.state.isPvPMode) return;

    this.pvpSyncManager?.cleanup();
    this.pvpSyncManager = undefined;

    this.mp.clearRoom();

    this.celebrationManager.hide();
    this.state.isGoalCelebrating = false;
    this.state.guestLocalPhysicsUntil = 0;
    this.state.snapshotBuffer = [];
    this.state.timeSyncSamples = [];
    this.state.lastServerSnapshot = undefined;
    this.lastShootingCap = undefined;
    this.state.selectedCapId = undefined;

    if (this.debugOverlay) {
      this.debugOverlay.destroy();
      this.debugOverlay = undefined;
    }
  }

  shutdown(): void {
    AudioManager.getInstance().stopAll();

    this.matchTimer?.destroy();
    this.celebrationManager?.destroy();
    this.cleanupPvP();

    if (this.aiController) {
      this.aiController.destroy();
      this.aiController = undefined;
    }

    this.gameHUD?.destroy();
    this.pauseMenu?.destroy();
    this.formationMenu?.destroy();
    this.resultScreen?.destroy();
    this.inGameSettings?.destroy();
    this.fieldRenderer?.destroy();
  }
}