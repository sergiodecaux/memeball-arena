// src/scenes/GameScene.ts

import Phaser from 'phaser';
import { FIELD, GOAL, COLLISION_CATEGORIES, STARTING_POSITIONS, BALL, GAME, CapClass } from '../constants/gameConstants';
import { FieldBounds, PlayerNumber, AIDifficulty, Formation } from '../types';
import { Ball } from '../entities/Ball';
import { Cap } from '../entities/Cap';
import { ShootingController } from '../controllers/ShootingController';
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
import { playerData } from '../data/PlayerData';
import { AudioManager } from '../managers/AudioManager';

export class GameScene extends Phaser.Scene {
  // Field
  private fieldBounds!: FieldBounds;
  private fieldScale = 1;

  // Game objects
  private ball!: Ball;
  private caps: Cap[] = [];
  private startPositions = { ball: { x: 0, y: 0 }, caps: [] as { x: number; y: number }[] };

  // Controllers
  private shootingController!: ShootingController;
  private gameStateManager!: GameStateManager;
  private goalDetector!: GoalDetector;
  private scoreManager!: ScoreManager;
  private fieldRenderer!: FieldRenderer;
  private matchController!: MatchController;

  // UI
  private gameHUD!: GameHUD;
  private pauseMenu?: PauseMenu;
  private formationMenu?: FormationMenu;
  private resultScreen?: ResultScreen;
  private inGameSettings?: InGameSettings;

  // AI
  private aiController?: AIController;
  private isAIEnabled = true;
  private aiDifficulty: AIDifficulty = 'medium';
  private isProcessingTurn = false;

  // Physics
  private ballSpeedBeforeCollision = 0;
  
  // Audio Debounce
  private lastCollisionTime: number = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data?: { vsAI?: boolean; difficulty?: AIDifficulty }): void {
    this.isAIEnabled = data?.vsAI ?? true;
    this.aiDifficulty = data?.difficulty ?? 'medium';
    this.isProcessingTurn = false;
    this.caps = [];
    this.startPositions = { ball: { x: 0, y: 0 }, caps: [] };
    this.pauseMenu = undefined;
    this.formationMenu = undefined;
    this.resultScreen = undefined;
    this.inGameSettings = undefined;
    this.lastCollisionTime = 0;
  }

  create(): void {
    // Инициализация звука
    const audio = AudioManager.getInstance();
    audio.init(this);
    audio.stopMusic(); // Останавливаем музыку меню
    audio.playAmbience('bgm_match'); // Включаем шум стадиона
    audio.playSFX('sfx_whistle'); // Стартовый свисток

    this.matchController = new MatchController();
    this.calculateFieldBounds();
    this.configureMatterEngine();

    this.fieldRenderer = new FieldRenderer(this, this.fieldBounds, this.fieldScale);
    this.fieldRenderer.render();

    this.createWalls();
    this.createBall();
    this.createCaps();
    this.setupControllers();
    this.setupCollisions();
    this.createHUD();
  }

  private configureMatterEngine(): void {
    const engine = (this.matter.world as any).engine;
    if (engine) {
      engine.positionIterations = 10;
      engine.velocityIterations = 10;
    }
  }

  private setupControllers(): void {
    // Goal detector
    this.goalDetector = new GoalDetector(this, this.ball, this.fieldBounds, this.fieldScale);
    this.goalDetector.setCaps(this.caps, this.startPositions.caps);
    this.goalDetector.onGoal(player => this.handleGoal(player));

    // Score manager
    this.scoreManager = new ScoreManager(this);

    // Game state
    this.gameStateManager = new GameStateManager(this.ball, this.caps);
    this.gameStateManager.onTurnChange(player => this.onTurnChange(player));
    this.gameStateManager.onStateChange(state => this.onStateChange(state));

    // Shooting
    this.shootingController = new ShootingController(this);
    this.caps
      .filter(cap => !this.aiController || cap.owner === 1)
      .forEach(cap => this.shootingController.registerCap(cap));

    this.shootingController.setCurrentPlayer(1);
    this.shootingController.onShoot(() => {
      this.isProcessingTurn = true;
      this.gameStateManager.onShot();
    });
    this.shootingController.setEnabled(true);
    this.highlightCurrentPlayerCaps();

    // AI
    if (this.isAIEnabled) {
      this.aiController = new AIController(this, 2, this.fieldBounds, this.aiDifficulty);
      this.aiController.onMove((cap, fx, fy) => this.executeAIMove(cap, fx, fy));
    }
  }

  // ==================== TURN MANAGEMENT ====================

  private onTurnChange(player: PlayerNumber): void {
    this.isProcessingTurn = false;
    this.shootingController.setCurrentPlayer(player);
    this.updateHUD();
    this.highlightCurrentPlayerCaps();

    if (player === 2 && this.aiController) {
      this.shootingController.setEnabled(false);
      this.time.delayedCall(500, () => this.triggerAITurn());
    } else {
      this.shootingController.setEnabled(true);
    }
  }

  private onStateChange(state: string): void {
    const isPlayerTurn = this.gameStateManager.getCurrentPlayer() === 1;
    const canShoot = state === 'waiting' && (!this.aiController || isPlayerTurn);
    
    this.shootingController.setEnabled(canShoot);
    if (state === 'waiting') this.isProcessingTurn = false;
    this.updateHUD();
  }

  private triggerAITurn(): void {
    if (!this.aiController || !this.gameStateManager.canPlay() || this.isProcessingTurn) return;
    if (this.gameStateManager.getCurrentPlayer() !== 2) return;

    const enemyCaps = this.caps.filter(c => c.owner === 1);
    this.aiController.makeMove(this.caps, this.ball, enemyCaps);
  }

  private executeAIMove(cap: Cap, forceX: number, forceY: number): void {
    if (this.isProcessingTurn) return;
    this.isProcessingTurn = true;

    cap.highlight(true);
    this.time.delayedCall(200, () => {
      cap.applyForce(forceX, forceY);
      this.gameStateManager.onShot();
      this.time.delayedCall(100, () => cap.highlight(false));
    });
  }

  // ==================== COLLISIONS & AUDIO ====================

  private setupCollisions(): void {
    this.matter.world.on('beforeupdate', () => {
      this.ballSpeedBeforeCollision = this.ball.getSpeed();
    });

    this.matter.world.on('collisionstart', (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
      // Ограничение частоты звуков (не чаще 50мс)
      const now = this.time.now;
      if (now - this.lastCollisionTime < 50) return;

      for (const pair of event.pairs) {
        const bodyA = pair.bodyA;
        const bodyB = pair.bodyB;

        // Обработка звуков столкновений
        const soundPlayed = this.handleCollisionSound(bodyA, bodyB);
        if (soundPlayed) {
          this.lastCollisionTime = now;
        }

        // Игровая логика столкновений
        const ballBody = this.findBallBody(bodyA, bodyB);
        if (ballBody) {
          const otherLabel = bodyA.label === 'ball' ? bodyB.label : bodyA.label;
          if (otherLabel === 'wall') {
            this.handleBallWallCollision(ballBody);
          } else if (otherLabel === 'post') {
            this.handleBallPostCollision(ballBody);
          }
        }
      }
    });
  }

  // Логика для расчета громкости и типа звука
  private handleCollisionSound(bodyA: MatterJS.BodyType, bodyB: MatterJS.BodyType): boolean {
    const isBallA = bodyA.label === 'ball';
    const isBallB = bodyB.label === 'ball';
    const isWallA = bodyA.label === 'wall'; 
    const isWallB = bodyB.label === 'wall';
    // Фишки имеют лейблы типа 'p1_0', 'p2_1'
    const isCapA = bodyA.label && bodyA.label.startsWith('p'); 
    const isCapB = bodyB.label && bodyB.label.startsWith('p');

    // Оценка силы удара (приблизительная, на основе скорости)
    const velA = Math.hypot(bodyA.velocity.x, bodyA.velocity.y);
    const velB = Math.hypot(bodyB.velocity.x, bodyB.velocity.y);
    const impactForce = velA + velB;

    // Игнорируем очень слабые касания
    if (impactForce < 0.15) return false;

    // Расчет громкости (от 0.3 до 1.0)
    const volume = Phaser.Math.Clamp(impactForce / 15, 0.3, 1.0);
    const audio = AudioManager.getInstance();

    if ((isBallA && isCapB) || (isBallB && isCapA)) {
      // Удар по мячу фишкой
      audio.playSFX('sfx_kick', { volume: volume });
      // Haptic Feedback при сильном ударе
      if (volume > 0.5) window.Telegram?.WebApp.HapticFeedback.impactOccurred('light');
      return true;

    } else if (isCapA && isCapB) {
      // Столкновение двух фишек
      audio.playSFX('sfx_clack', { volume: volume * 0.9 });
      return true;

    } else if ((isBallA && isWallB) || (isBallB && isWallA)) {
      // Мяч об стену (исключаем штангу, так как она post)
      audio.playSFX('sfx_bounce', { volume: volume * 0.7 });
      return true;
    }
    
    return false;
  }

  private findBallBody(a: MatterJS.BodyType, b: MatterJS.BodyType): MatterJS.BodyType | null {
    if (a.label === 'ball') return a;
    if (b.label === 'ball') return b;
    return null;
  }

  private handleBallWallCollision(ballBody: MatterJS.BodyType): void {
    const speed = this.ballSpeedBeforeCollision;
    if (speed < 2) return;

    const { left, right, top, bottom } = this.fieldBounds;
    const { x, y } = ballBody.position;
    const cornerSize = 60 * this.fieldScale;

    const corners = {
      topLeft: x < left + cornerSize && y < top + cornerSize,
      topRight: x > right - cornerSize && y < top + cornerSize,
      bottomLeft: x < left + cornerSize && y > bottom - cornerSize,
      bottomRight: x > right - cornerSize && y > bottom - cornerSize,
    };

    if (Object.values(corners).some(Boolean)) {
      this.time.delayedCall(10, () => this.applyCurveBounce(ballBody, speed, corners));
    } else {
      this.applyWallBoost(ballBody, speed);
    }
  }

  private handleBallPostCollision(ballBody: MatterJS.BodyType): void {
    const speed = this.ballSpeedBeforeCollision;
    if (speed < 1) return;

    // Звук штанги
    const audio = AudioManager.getInstance();
    const volume = Phaser.Math.Clamp(speed / 15, 0.4, 1.0);
    audio.playSFX('sfx_post', { volume });

    if (speed < 2) return;

    this.time.delayedCall(5, () => {
      const boost = Math.min(speed / 8, 1.8);
      const { x, y } = ballBody.velocity;
      this.matter.body.setVelocity(ballBody, {
        x: x * (0.95 + boost * 0.15),
        y: y * (0.95 + boost * 0.15),
      });
    });
  }

  private applyWallBoost(ballBody: MatterJS.BodyType, speed: number): void {
    this.time.delayedCall(5, () => {
      const boost = Math.min(speed / 10, 1.5);
      const { x, y } = ballBody.velocity;
      this.matter.body.setVelocity(ballBody, {
        x: x * (0.9 + boost * 0.1),
        y: y * (0.9 + boost * 0.1),
      });
    });
  }

  private applyCurveBounce(
    ballBody: MatterJS.BodyType,
    speed: number,
    corners: Record<string, boolean>
  ): void {
    const { x: vx, y: vy } = ballBody.velocity;
    const currentSpeed = Math.sqrt(vx * vx + vy * vy);
    if (currentSpeed < 1) return;

    const curveSpeed = currentSpeed * Math.min(speed / 15, 0.85);
    const isVertical = Math.abs(vy) > Math.abs(vx);

    let curveX = 0, curveY = 0;

    if (corners.topLeft) {
      curveX = isVertical ? curveSpeed : Math.abs(vx) * 0.3;
      curveY = isVertical ? Math.abs(vy) * 0.3 : curveSpeed;
    } else if (corners.topRight) {
      curveX = isVertical ? -curveSpeed : -Math.abs(vx) * 0.3;
      curveY = isVertical ? Math.abs(vy) * 0.3 : curveSpeed;
    } else if (corners.bottomLeft) {
      curveX = isVertical ? curveSpeed : Math.abs(vx) * 0.3;
      curveY = isVertical ? -Math.abs(vy) * 0.3 : -curveSpeed;
    } else if (corners.bottomRight) {
      curveX = isVertical ? -curveSpeed : -Math.abs(vx) * 0.3;
      curveY = isVertical ? -Math.abs(vy) * 0.3 : -curveSpeed;
    }

    this.matter.body.setVelocity(ballBody, { x: curveX, y: curveY });
  }

  // ==================== UPDATE ====================

  update(): void {
    const state = this.gameStateManager.getState();
    if (state === 'paused' || state === 'finished' || state === 'goal') return;

    this.ball.update();
    this.caps.forEach(cap => cap.update());
    this.gameStateManager.update();
    this.goalDetector.update();
    this.checkBoundaries();

    // Динамическая громкость толпы
    this.updateCrowdIntensity();
  }

  private updateCrowdIntensity(): void {
    if (!this.ball || !this.fieldBounds) return;

    // Игрок 1 всегда снизу, атакует вверх (к y = top).
    // Чем меньше Y мяча (ближе к 0), тем опаснее момент для противника.
    const distToEnemyGoal = (this.ball.y - this.fieldBounds.top) / this.fieldBounds.height;
    
    let intensity = 0.2; // Базовая громкость

    if (distToEnemyGoal < 0.25) {
      intensity = 0.7; // Опасно!
    } else if (distToEnemyGoal < 0.5) {
      intensity = 0.4; // На чужой половине
    } else {
      intensity = 0.2; // Спокойно
    }

    AudioManager.getInstance().setAmbienceVolume(intensity);
  }

  private checkBoundaries(): void {
    const bounds = this.fieldBounds;
    const goalHalfWidth = (GOAL.WIDTH * this.fieldScale) / 2;
    const padding = 10;

    this.constrainBody(this.ball, bounds, goalHalfWidth, padding);
    this.caps.forEach(cap => this.constrainBody(cap, bounds, 0, padding));
  }

  private constrainBody(
    entity: Ball | Cap,
    bounds: FieldBounds,
    goalHalfWidth: number,
    padding: number
  ): void {
    const pos = entity.body.position;
    const vel = entity.body.velocity;
    const radius = entity.getRadius();
    const inGoalX = goalHalfWidth > 0 && Math.abs(pos.x - bounds.centerX) < goalHalfWidth;

    if (pos.x < bounds.left - radius - padding) {
      this.matter.body.setPosition(entity.body, { x: bounds.left + radius, y: pos.y });
      this.matter.body.setVelocity(entity.body, { x: Math.abs(vel.x) * 0.5, y: vel.y });
    }
    if (pos.x > bounds.right + radius + padding) {
      this.matter.body.setPosition(entity.body, { x: bounds.right - radius, y: pos.y });
      this.matter.body.setVelocity(entity.body, { x: -Math.abs(vel.x) * 0.5, y: vel.y });
    }
    if (pos.y < bounds.top - radius - padding && !inGoalX) {
      this.matter.body.setPosition(entity.body, { x: pos.x, y: bounds.top + radius });
      this.matter.body.setVelocity(entity.body, { x: vel.x, y: Math.abs(vel.y) * 0.5 });
    }
    if (pos.y > bounds.bottom + radius + padding && !inGoalX) {
      this.matter.body.setPosition(entity.body, { x: pos.x, y: bounds.bottom - radius });
      this.matter.body.setVelocity(entity.body, { x: vel.x, y: -Math.abs(vel.y) * 0.5 });
    }
  }

  // ==================== HUD ====================

  private createHUD(): void {
    this.gameHUD = new GameHUD(this, {
      isAIMode: this.isAIEnabled,
      aiDifficulty: this.aiDifficulty,
    });
    this.gameHUD.onPause(() => {
      AudioManager.getInstance().playSFX('sfx_click');
      this.showPauseMenu();
    });
    this.updateHUD();
  }

  private updateHUD(): void {
    const scores = this.scoreManager.getScores();
    this.gameHUD.updateTurn(
      this.gameStateManager.getCurrentPlayer(),
      this.gameStateManager.getState(),
      this.isAIEnabled
    );
    this.gameHUD.updateScore(scores[1], scores[2]);
  }

  // ==================== GOALS & WIN ====================

  private handleGoal(scoringPlayer: PlayerNumber): void {
    // Звуки гола
    const audio = AudioManager.getInstance();
    
    // Сетка сразу
    audio.playSFX('sfx_net', { volume: 1.5 });

    // Толпа через 0.4с
    this.time.delayedCall(400, () => {
      audio.playSFX('sfx_goal', { volume: 1.0 }); 
      // Свисток через 0.8с (от начала)
      this.time.delayedCall(400, () => {
        audio.playSFX('sfx_whistle', { volume: 0.8 });
      });
    });

    window.Telegram?.WebApp.HapticFeedback.notificationOccurred('success'); // Вибрация

    this.isProcessingTurn = true;
    this.gameStateManager.setGoalState();
    this.shootingController.setEnabled(false);

    this.matchController.addGoal(scoringPlayer);
    const isWinningGoal = this.scoreManager.addGoal(scoringPlayer);

    this.time.delayedCall(GAME.GOAL_DELAY, () => {
      if (isWinningGoal) {
        this.handleWin(scoringPlayer);
      } else {
        this.afterGoal(scoringPlayer);
      }
    });
  }

  private afterGoal(scoringPlayer: PlayerNumber): void {
    if (this.matchController.applyPendingFormation()) {
      this.applyFormationToField(this.matchController.getCurrentFormation());
      this.gameHUD.hidePendingFormationBadge();
      this.gameHUD.showFormationAppliedNotification();
    }

    this.resetPositions();
    const nextPlayer: PlayerNumber = scoringPlayer === 1 ? 2 : 1;

    this.gameStateManager.forceStop();
    this.gameStateManager.setCurrentPlayer(nextPlayer);
    this.shootingController.setCurrentPlayer(nextPlayer);
    this.goalDetector.reset();
    this.highlightCurrentPlayerCaps();
    this.updateHUD();
    this.isProcessingTurn = false;
    
    // Свисток на возобновление игры
    AudioManager.getInstance().playSFX('sfx_whistle', { volume: 0.5 });

    if (nextPlayer === 1 || !this.aiController) {
      this.shootingController.setEnabled(true);
    } else {
      this.shootingController.setEnabled(false);
      this.time.delayedCall(500, () => this.triggerAITurn());
    }
  }

  private handleWin(winner: PlayerNumber): void {
    this.gameStateManager.finish();
    this.shootingController.setEnabled(false);
    this.isProcessingTurn = true;
    this.gameHUD.setPauseEnabled(false);

    // Звуки конца матча
    const audio = AudioManager.getInstance();
    audio.stopAmbience();
    audio.playSFX('sfx_whistle');
    
    if (winner === 1) {
      audio.playSFX('sfx_win', { delay: 0.5 });
    } else {
      audio.playSFX('sfx_lose', { delay: 0.5 });
    }

    const result = this.matchController.finishMatch(winner);
    this.showResultScreen(result);
  }

  private showResultScreen(result: any): void {
    this.resultScreen = new ResultScreen(this, result, this.isAIEnabled, {
      onRematch: () => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.resultScreen = undefined;
        this.restartGame();
      },
      onMainMenu: () => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.resultScreen = undefined;
        this.scene.start('MainMenuScene');
      },
    });
  }

  // ==================== MENUS ====================

  private showPauseMenu(): void {
    if (this.pauseMenu || this.gameStateManager.getState() === 'finished') return;

    this.gameStateManager.pause();
    this.pauseMenu = new PauseMenu(this, {
      onResume: () => { 
        AudioManager.getInstance().playSFX('sfx_click');
        this.pauseMenu = undefined; 
        this.gameStateManager.resume(); 
      },
      onChangeFormation: () => { 
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
    if (this.formationMenu) return;

    this.formationMenu = new FormationMenu(this, this.matchController.getCurrentFormation().id, {
      onSelect: (formation: Formation) => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.formationMenu = undefined;
        this.handleFormationSelect(formation);
        this.gameStateManager.resume();
      },
      onCancel: () => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.formationMenu = undefined;
        this.gameStateManager.resume();
      },
    });
  }

  private handleFormationSelect(formation: Formation): void {
    if (formation.id === this.matchController.getCurrentFormation().id) {
      // Даже если id тот же, классы могли измениться — обновляем
      this.matchController.updateCurrentFormation(formation);
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
      },
    });
  }

  private handleSurrender(): void {
    const result = this.matchController.handleSurrender();
    this.gameStateManager.finish();
    this.shootingController.setEnabled(false);
    this.isProcessingTurn = true;
    this.gameHUD.setPauseEnabled(false);
    
    // Звук поражения
    AudioManager.getInstance().stopAmbience();
    AudioManager.getInstance().playSFX('sfx_lose');
    
    this.showResultScreen(result);
  }

  // ==================== FORMATION ====================

  private applyFormationToField(formation: Formation): void {
    const playerCaps = this.caps.filter(c => c.owner === 1);
    const enemyCaps = this.caps.filter(c => c.owner === 2);

    formation.slots.forEach((slot, i) => {
      // Обновляем позиции игрока
      if (playerCaps[i]) {
        const pos = this.relativeToAbsolute(slot.x, slot.y);
        this.startPositions.caps[i] = pos;
        
        // Обновляем класс фишки!
        playerCaps[i].setCapClass(slot.capClass);
      }
      
      // Обновляем позиции AI (зеркально)
      if (enemyCaps[i]) {
        const pos = this.relativeToAbsolute(slot.x, 1 - slot.y);
        this.startPositions.caps[i + 3] = pos;
      }
    });
  }

  // ==================== GAME FLOW ====================

  private restartGame(): void {
    this.matchController.reset();
    this.scoreManager.reset();
    this.resetPositions();
    this.goalDetector.reset();
    this.gameStateManager.forceStop();
    this.gameStateManager.setCurrentPlayer(1);
    this.shootingController.setCurrentPlayer(1);
    this.shootingController.setEnabled(true);
    this.isProcessingTurn = false;
    this.gameHUD.setPauseEnabled(true);
    this.gameHUD.hidePendingFormationBadge();
    this.highlightCurrentPlayerCaps();
    this.updateHUD();

    // Перезапуск звуков матча
    const audio = AudioManager.getInstance();
    audio.stopAll(); // Остановить всё старое (музыку победы)
    audio.playAmbience('bgm_match');
    audio.playSFX('sfx_whistle');
  }

  private resetPositions(): void {
    this.ball.reset(this.startPositions.ball.x, this.startPositions.ball.y);
    this.caps.forEach((cap, i) => cap.reset(this.startPositions.caps[i].x, this.startPositions.caps[i].y));
  }

  private highlightCurrentPlayerCaps(): void {
    const current = this.gameStateManager.getCurrentPlayer();
    const showHighlight = !this.aiController || current === 1;
    this.caps.forEach(cap => cap.highlight(showHighlight && cap.owner === current));
  }

  // ==================== FIELD SETUP ====================

  private calculateFieldBounds(): void {
    const { centerX, centerY, width, height } = this.cameras.main;
    this.fieldScale = Math.min(
      (width - FIELD.PADDING * 2) / FIELD.WIDTH,
      (height - FIELD.PADDING * 2) / FIELD.HEIGHT
    );
    const w = FIELD.WIDTH * this.fieldScale;
    const h = FIELD.HEIGHT * this.fieldScale;

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

  private relativeToAbsolute(relX: number, relY: number): { x: number; y: number } {
    return {
      x: this.fieldBounds.left + this.fieldBounds.width * relX,
      y: this.fieldBounds.top + this.fieldBounds.height * relY,
    };
  }

  private createBall(): void {
    const pos = this.relativeToAbsolute(STARTING_POSITIONS.BALL.x, STARTING_POSITIONS.BALL.y);
    this.ball = new Ball(this, pos.x, pos.y, BALL.RADIUS * this.fieldScale);
    this.startPositions.ball = pos;
  }

  private createCaps(): void {
    const formation = this.matchController.getCurrentFormation();
    const data = playerData.get();
    const playerSkinId = data.equippedCapSkin;

    // Дефолтные классы для AI
    const aiClasses: CapClass[] = ['sniper', 'balanced', 'tank'];

    // Создаём фишки игрока 1 (снизу) — используем классы из формации
    formation.slots.forEach((slot, i) => {
      const absPos = this.relativeToAbsolute(slot.x, slot.y);
      const cap = new Cap(
        this,
        absPos.x,
        absPos.y,
        1 as PlayerNumber,
        `p1_${i}`,
        slot.capClass,    // Класс из формации!
        this.fieldScale,
        playerSkinId      // Скин игрока
      );
      this.caps.push(cap);
      this.startPositions.caps.push(absPos);
    });

    // Создаём фишки игрока 2 / AI (сверху, отзеркаленные)
    formation.slots.forEach((slot, i) => {
      const mirroredY = 1 - slot.y;
      const absPos = this.relativeToAbsolute(slot.x, mirroredY);
      const cap = new Cap(
        this,
        absPos.x,
        absPos.y,
        2 as PlayerNumber,
        `p2_${i}`,
        aiClasses[i] || 'balanced',  // AI использует свои классы
        this.fieldScale
        // AI без кастомного скина
      );
      this.caps.push(cap);
      this.startPositions.caps.push(absPos);
    });
  }

  private createWalls(): void {
    const { left, right, top, bottom, centerX } = this.fieldBounds;
    const goalWidth = GOAL.WIDTH * this.fieldScale;
    const goalDepth = GOAL.DEPTH * this.fieldScale;
    const postThickness = GOAL.POST_THICKNESS * this.fieldScale;
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
      restitution: 0.85,
      friction: 0.02,
      label: 'post',
    };

    const addRect = (x: number, y: number, w: number, h: number, opts: Phaser.Types.Physics.Matter.MatterBodyConfig) =>
      this.matter.add.rectangle(x, y, w, h, opts);

    // Side walls
    addRect(left - thickness / 2, (top + bottom) / 2, thickness, bottom - top, wallOpts);
    addRect(right + thickness / 2, (top + bottom) / 2, thickness, bottom - top, wallOpts);

    // Top/bottom walls with gaps
    addRect(left + sideWidth / 2, top - thickness / 2, sideWidth, thickness, wallOpts);
    addRect(right - sideWidth / 2, top - thickness / 2, sideWidth, thickness, wallOpts);
    addRect(left + sideWidth / 2, bottom + thickness / 2, sideWidth, thickness, wallOpts);
    addRect(right - sideWidth / 2, bottom + thickness / 2, sideWidth, thickness, wallOpts);

    // Goals
    [{ y: top, dir: -1 }, { y: bottom, dir: 1 }].forEach(({ y, dir }) => {
      addRect(centerX, y + dir * (goalDepth + thickness / 2), goalWidth, thickness, wallOpts);
      addRect(centerX - goalWidth / 2 - postThickness / 2, y + dir * goalDepth / 2, postThickness, goalDepth, postOpts);
      addRect(centerX + goalWidth / 2 + postThickness / 2, y + dir * goalDepth / 2, postThickness, goalDepth, postOpts);
    });
  }

  // ==================== SHUTDOWN ====================
  // ИСПРАВЛЕНИЕ БАГА: Останавливаем ВСЕ звуки при выходе из сцены

  shutdown(): void {
    // Останавливаем ВСЕ звуки (включая SFX победы/поражения)
    AudioManager.getInstance().stopAll();
    
    this.gameHUD?.destroy();
    this.pauseMenu?.destroy();
    this.formationMenu?.destroy();
    this.resultScreen?.destroy();
    this.inGameSettings?.destroy();
    this.aiController?.destroy();
  }
}