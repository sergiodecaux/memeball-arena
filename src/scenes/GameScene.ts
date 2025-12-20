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
import { MultiplayerManager, GameStartData, ShootData, PvPPlayer } from '../managers/MultiplayerManager';

interface GameSceneData {
  vsAI?: boolean;
  difficulty?: AIDifficulty;
  isPvP?: boolean;
  pvpData?: GameStartData;
}

export class GameScene extends Phaser.Scene {
  private fieldBounds!: FieldBounds;
  private fieldScale = 1;

  private ball!: Ball;
  private caps: Cap[] = [];
  private startPositions = { ball: { x: 0, y: 0 }, caps: [] as { x: number; y: number }[] };

  private shootingController!: ShootingController;
  private gameStateManager!: GameStateManager;
  private goalDetector!: GoalDetector;
  private scoreManager!: ScoreManager;
  private fieldRenderer!: FieldRenderer;
  private matchController!: MatchController;

  private gameHUD!: GameHUD;
  private pauseMenu?: PauseMenu;
  private formationMenu?: FormationMenu;
  private resultScreen?: ResultScreen;
  private inGameSettings?: InGameSettings;

  private aiController?: AIController;
  private isAIEnabled = true;
  private aiDifficulty: AIDifficulty = 'medium';
  private isProcessingTurn = false;

  // PVP
  private isPvPMode = false;
  private pvpData?: GameStartData;
  private mp!: MultiplayerManager;
  private currentTurnId: string = '';
  private pvpOpponentName: string = 'Opponent';
  private isHost = false;
  private syncInterval?: Phaser.Time.TimerEvent;

  private ballSpeedBeforeCollision = 0;
  private lastCollisionTime: number = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data?: GameSceneData): void {
    this.isPvPMode = data?.isPvP ?? false;
    this.pvpData = data?.pvpData;
    
    if (this.isPvPMode && this.pvpData) {
      this.isAIEnabled = false;
      this.mp = MultiplayerManager.getInstance();
      this.currentTurnId = this.pvpData.currentTurn;
      this.isHost = this.mp.isHost();
      
      const opponent = this.pvpData.players.find(p => p.id !== this.mp.getMyId());
      this.pvpOpponentName = opponent?.name || 'Opponent';
      
      console.log('[PvP] Init - isHost:', this.isHost, 'myId:', this.mp.getMyId());
    } else {
      this.isAIEnabled = data?.vsAI ?? true;
      this.aiDifficulty = data?.difficulty ?? 'medium';
    }
    
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
    const audio = AudioManager.getInstance();
    audio.init(this);
    audio.stopMusic();
    audio.playAmbience('bgm_match');
    audio.playSFX('sfx_whistle');

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

    if (this.isPvPMode) {
      this.setupPvPListeners();
      if (this.isHost) {
        this.startSyncInterval();
      }
    }
  }

  // ==================== PVP ====================

  private startSyncInterval(): void {
    this.syncInterval = this.time.addEvent({
      delay: 50,
      callback: () => this.sendPositionsToOpponent(),
      loop: true
    });
  }

  private sendPositionsToOpponent(): void {
    if (!this.isPvPMode || !this.mp.getConnectionStatus() || !this.isHost) return;
    
    const ballPos = this.ball.body.position;
    const ballVel = this.ball.body.velocity;
    
    const capsData = this.caps.map(cap => ({
      x: cap.body.position.x,
      y: cap.body.position.y,
      vx: cap.body.velocity.x,
      vy: cap.body.velocity.y
    }));
    
    this.mp.sendSyncPositions(
      { x: ballPos.x, y: ballPos.y, vx: ballVel.x, vy: ballVel.y },
      capsData
    );
  }

  private setupPvPListeners(): void {
    this.mp.on('opponent_shoot', (data: ShootData) => {
      console.log('[PvP] Opponent shoot received:', data);
      this.handleOpponentShoot(data);
    });

    this.mp.on('turn_change', (data: { currentTurn: string; scores: Record<string, number> }) => {
      console.log('[PvP] Turn change from server:', data.currentTurn);
      this.currentTurnId = data.currentTurn;
      this.applyTurnChange();
    });

    if (!this.isHost) {
      this.mp.on('positions_update', (data: any) => {
        this.applyPositionsFromHost(data);
      });
    }

    this.mp.on('goal_scored', (data: { scorerId: string; scores: Record<string, number>; winner: string | null }) => {
      if (data.winner) {
        const isMyWin = data.winner === this.mp.getMyId();
        this.handleWin(isMyWin ? 1 : 2);
      }
    });

    this.mp.on('continue_game', (data: { currentTurn: string }) => {
      console.log('[PvP] Continue game:', data.currentTurn);
      this.currentTurnId = data.currentTurn;
      this.applyTurnChange();
    });

    this.mp.on('opponent_surrendered', () => this.handleOpponentSurrendered());
    this.mp.on('opponent_disconnected', () => this.handleOpponentDisconnected());
  }

  private applyTurnChange(): void {
    const isMyTurn = this.currentTurnId === this.mp.getMyId();
    console.log('[PvP] applyTurnChange - isMyTurn:', isMyTurn);
    
    this.isProcessingTurn = false;
    this.gameStateManager.forceStop();
    this.shootingController.setEnabled(isMyTurn);
    this.highlightCurrentPlayerCaps();
    this.updateHUD();
  }

  private applyPositionsFromHost(data: any): void {
    if (!data.ball || !data.caps) return;
    
    this.matter.body.setPosition(this.ball.body, { 
      x: this.mirrorX(data.ball.x), 
      y: this.mirrorY(data.ball.y) 
    });
    if (data.ball.vx !== undefined) {
      this.matter.body.setVelocity(this.ball.body, { 
        x: -data.ball.vx, 
        y: -data.ball.vy 
      });
    }
    
    data.caps.forEach((capData: any, i: number) => {
      const mirroredIndex = i < 3 ? i + 3 : i - 3;
      const cap = this.caps[mirroredIndex];
      if (cap) {
        this.matter.body.setPosition(cap.body, { 
          x: this.mirrorX(capData.x), 
          y: this.mirrorY(capData.y) 
        });
        if (capData.vx !== undefined) {
          this.matter.body.setVelocity(cap.body, { 
            x: -capData.vx, 
            y: -capData.vy 
          });
        }
      }
    });
  }

  private mirrorX(x: number): number {
    return this.fieldBounds.left + (this.fieldBounds.right - x);
  }

  private mirrorY(y: number): number {
    return this.fieldBounds.top + (this.fieldBounds.bottom - y);
  }

  private sendShootToServer(cap: Cap): void {
    const capIndex = this.caps.findIndex(c => c === cap);
    const force = cap.body.velocity;
    const position = cap.body.position;
    
    console.log('[PvP] Sending shoot:', capIndex, force);
    
    this.mp.sendShoot(
      capIndex,
      { x: force.x, y: force.y },
      { x: position.x, y: position.y },
      Math.atan2(force.y, force.x)
    );
  }

  private handleOpponentShoot(data: ShootData): void {
    const mirroredCapId = data.capId < 3 ? data.capId + 3 : data.capId - 3;
    const cap = this.caps[mirroredCapId];
    if (!cap) {
      console.error('[PvP] Cap not found:', mirroredCapId);
      return;
    }

    console.log('[PvP] Applying opponent shot to cap:', mirroredCapId);
    
    this.isProcessingTurn = true;
    this.shootingController.setEnabled(false);
    cap.highlight(true);
    
    // Применяем силу с небольшой задержкой
    this.time.delayedCall(50, () => {
      cap.applyForce(-data.force.x, -data.force.y);
      this.gameStateManager.onShot();
      this.time.delayedCall(100, () => cap.highlight(false));
    });
  }

  private handleOpponentSurrendered(): void {
    AudioManager.getInstance().stopAmbience();
    AudioManager.getInstance().playSFX('sfx_whistle');
    AudioManager.getInstance().playSFX('sfx_win', { delay: 0.5 });

    this.gameStateManager.finish();
    this.shootingController.setEnabled(false);
    
    this.showResultScreen({
      winner: 1 as PlayerNumber,
      isWin: true,
      playerGoals: this.scoreManager.getScores()[1],
      opponentGoals: this.scoreManager.getScores()[2],
      xpEarned: 50,
      coinsEarned: 150,
      isPerfectGame: false,
      newAchievements: [],
      rewards: { coins: 150, xp: 50 },
      isPvP: true,
      message: 'Opponent surrendered!'
    });
  }

  private handleOpponentDisconnected(): void {
    AudioManager.getInstance().stopAmbience();
    AudioManager.getInstance().playSFX('sfx_whistle');
    AudioManager.getInstance().playSFX('sfx_win', { delay: 0.5 });

    this.gameStateManager.finish();
    this.shootingController.setEnabled(false);
    
    this.showResultScreen({
      winner: 1 as PlayerNumber,
      isWin: true,
      playerGoals: this.scoreManager.getScores()[1],
      opponentGoals: this.scoreManager.getScores()[2],
      xpEarned: 50,
      coinsEarned: 150,
      isPerfectGame: false,
      newAchievements: [],
      rewards: { coins: 150, xp: 50 },
      isPvP: true,
      message: 'Opponent disconnected!'
    });
  }

  // ==================== CONTROLLERS ====================

  private configureMatterEngine(): void {
    const engine = (this.matter.world as any).engine;
    if (engine) {
      engine.positionIterations = 10;
      engine.velocityIterations = 10;
    }
  }

  private setupControllers(): void {
    this.goalDetector = new GoalDetector(this, this.ball, this.fieldBounds, this.fieldScale);
    this.goalDetector.setCaps(this.caps, this.startPositions.caps);
    this.goalDetector.onGoal(player => this.handleGoal(player));

    this.scoreManager = new ScoreManager(this);

    this.gameStateManager = new GameStateManager(this.ball, this.caps);
    this.gameStateManager.setPvPMode(this.isPvPMode);
    this.gameStateManager.setIsHost(this.isHost);
    
    if (this.isPvPMode) {
      // Только хост отправляет objects_stopped
      this.gameStateManager.onAllObjectsStopped(() => {
        if (this.isHost) {
          console.log('[PvP] Host: sending objects_stopped');
          this.mp.sendObjectsStopped();
        }
      });
    } else {
      this.gameStateManager.onTurnChange(player => this.onLocalTurnChange(player));
    }
    
    this.gameStateManager.onStateChange(state => this.onStateChange(state));

    this.shootingController = new ShootingController(this);
    
    this.caps
      .filter(cap => cap.owner === 1)
      .forEach(cap => this.shootingController.registerCap(cap));

    this.shootingController.setCurrentPlayer(1);
    this.gameStateManager.setCurrentPlayer(1);
    
    if (this.isPvPMode) {
      const isMyTurn = this.currentTurnId === this.mp.getMyId();
      console.log('[PvP] Initial setup - isMyTurn:', isMyTurn);
      this.shootingController.setEnabled(isMyTurn);
    } else {
      this.shootingController.setEnabled(true);
    }
    
    this.shootingController.onShoot((cap) => {
      console.log('[PvP] Shot executed');
      this.isProcessingTurn = true;
      this.gameStateManager.onShot();
      
      if (this.isPvPMode && cap) {
        this.sendShootToServer(cap);
        this.shootingController.setEnabled(false);
      }
    });
    
    this.highlightCurrentPlayerCaps();

    if (this.isAIEnabled && !this.isPvPMode) {
      this.aiController = new AIController(this, 2, this.fieldBounds, this.aiDifficulty);
      this.aiController.onMove((cap, fx, fy) => this.executeAIMove(cap, fx, fy));
    }
  }

  private onLocalTurnChange(player: PlayerNumber): void {
    if (this.isPvPMode) return;
    
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
    if (this.isPvPMode) {
      if (state === 'moving') {
        this.shootingController.setEnabled(false);
      }
      // В waiting управление включается через applyTurnChange
    } else {
      const isPlayerTurn = this.gameStateManager.getCurrentPlayer() === 1;
      const canShoot = state === 'waiting' && (!this.aiController || isPlayerTurn);
      this.shootingController.setEnabled(canShoot);
    }
    
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

  // ==================== COLLISIONS ====================

  private setupCollisions(): void {
    this.matter.world.on('beforeupdate', () => {
      this.ballSpeedBeforeCollision = this.ball.getSpeed();
    });

    this.matter.world.on('collisionstart', (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
      const now = this.time.now;
      if (now - this.lastCollisionTime < 50) return;

      for (const pair of event.pairs) {
        const soundPlayed = this.handleCollisionSound(pair.bodyA, pair.bodyB);
        if (soundPlayed) this.lastCollisionTime = now;

        const ballBody = this.findBallBody(pair.bodyA, pair.bodyB);
        if (ballBody) {
          const otherLabel = pair.bodyA.label === 'ball' ? pair.bodyB.label : pair.bodyA.label;
          if (otherLabel === 'wall') this.handleBallWallCollision(ballBody);
          else if (otherLabel === 'post') this.handleBallPostCollision(ballBody);
        }
      }
    });
  }

  private handleCollisionSound(bodyA: MatterJS.BodyType, bodyB: MatterJS.BodyType): boolean {
    const isBallA = bodyA.label === 'ball';
    const isBallB = bodyB.label === 'ball';
    const isWallA = bodyA.label === 'wall';
    const isWallB = bodyB.label === 'wall';
    const isCapA = bodyA.label?.startsWith('cap');
    const isCapB = bodyB.label?.startsWith('cap');

    const velA = Math.hypot(bodyA.velocity.x, bodyA.velocity.y);
    const velB = Math.hypot(bodyB.velocity.x, bodyB.velocity.y);
    const impactForce = velA + velB;

    if (impactForce < 0.15) return false;

    const volume = Phaser.Math.Clamp(impactForce / 15, 0.3, 1.0);
    const audio = AudioManager.getInstance();

    if ((isBallA && isCapB) || (isBallB && isCapA)) {
      audio.playSFX('sfx_kick', { volume });
      if (volume > 0.5) window.Telegram?.WebApp.HapticFeedback.impactOccurred('light');
      return true;
    } else if (isCapA && isCapB) {
      audio.playSFX('sfx_clack', { volume: volume * 0.9 });
      return true;
    } else if ((isBallA && isWallB) || (isBallB && isWallA)) {
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

    AudioManager.getInstance().playSFX('sfx_post', { volume: Phaser.Math.Clamp(speed / 15, 0.4, 1.0) });

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

  private applyCurveBounce(ballBody: MatterJS.BodyType, speed: number, corners: Record<string, boolean>): void {
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
    this.updateCrowdIntensity();
  }

  private updateCrowdIntensity(): void {
    if (!this.ball || !this.fieldBounds) return;
    const distToEnemyGoal = (this.ball.y - this.fieldBounds.top) / this.fieldBounds.height;
    let intensity = distToEnemyGoal < 0.25 ? 0.7 : distToEnemyGoal < 0.5 ? 0.4 : 0.2;
    AudioManager.getInstance().setAmbienceVolume(intensity);
  }

  private checkBoundaries(): void {
    const bounds = this.fieldBounds;
    const goalHalfWidth = (GOAL.WIDTH * this.fieldScale) / 2;
    this.constrainBody(this.ball, bounds, goalHalfWidth, 10);
    this.caps.forEach(cap => this.constrainBody(cap, bounds, 0, 10));
  }

  private constrainBody(entity: Ball | Cap, bounds: FieldBounds, goalHalfWidth: number, padding: number): void {
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
      isPvP: this.isPvPMode,
      opponentName: this.pvpOpponentName,
    });
    this.gameHUD.onPause(() => {
      AudioManager.getInstance().playSFX('sfx_click');
      this.showPauseMenu();
    });
    this.updateHUD();
  }

  private updateHUD(): void {
    const scores = this.scoreManager.getScores();
    
    if (this.isPvPMode) {
      const isMyTurn = this.currentTurnId === this.mp.getMyId();
      this.gameHUD.updateTurn(isMyTurn ? 1 : 2, this.gameStateManager.getState(), false);
    } else {
      this.gameHUD.updateTurn(this.gameStateManager.getCurrentPlayer(), this.gameStateManager.getState(), this.isAIEnabled);
    }
    
    this.gameHUD.updateScore(scores[1], scores[2]);
  }

  // ==================== GOALS ====================

  private handleGoal(scoringPlayer: PlayerNumber): void {
    const audio = AudioManager.getInstance();
    audio.playSFX('sfx_net', { volume: 1.5 });

    this.time.delayedCall(400, () => {
      audio.playSFX('sfx_goal', { volume: 1.0 });
      this.time.delayedCall(400, () => audio.playSFX('sfx_whistle', { volume: 0.8 }));
    });

    window.Telegram?.WebApp.HapticFeedback.notificationOccurred('success');

    this.isProcessingTurn = true;
    this.gameStateManager.setGoalState();
    this.shootingController.setEnabled(false);

    this.matchController.addGoal(scoringPlayer);
    const isWinningGoal = this.scoreManager.addGoal(scoringPlayer);

    if (this.isPvPMode) {
      const scorerId = scoringPlayer === 1
        ? this.mp.getMyId()!
        : this.pvpData!.players.find(p => p.id !== this.mp.getMyId())!.id;
      this.mp.sendGoal(scorerId);
    }

    this.time.delayedCall(GAME.GOAL_DELAY, () => {
      if (isWinningGoal) this.handleWin(scoringPlayer);
      else this.afterGoal(scoringPlayer);
    });
  }

  private afterGoal(scoringPlayer: PlayerNumber): void {
    if (!this.isPvPMode && this.matchController.applyPendingFormation()) {
      this.applyFormationToField(this.matchController.getCurrentFormation());
      this.gameHUD.hidePendingFormationBadge();
      this.gameHUD.showFormationAppliedNotification();
    }

    this.resetPositions();
    
    if (this.isPvPMode) {
      const scorerId = scoringPlayer === 1
        ? this.mp.getMyId()!
        : this.pvpData!.players.find(p => p.id !== this.mp.getMyId())!.id;
      
      this.goalDetector.reset();
      this.isProcessingTurn = false;
      this.shootingController.setEnabled(false);
      AudioManager.getInstance().playSFX('sfx_whistle', { volume: 0.5 });
      this.mp.sendReadyAfterGoal(scorerId);
      return;
    }
    
    const nextPlayer: PlayerNumber = scoringPlayer === 1 ? 2 : 1;
    this.gameStateManager.forceStop();
    this.gameStateManager.setCurrentPlayer(nextPlayer);
    this.shootingController.setCurrentPlayer(nextPlayer);
    this.goalDetector.reset();
    this.highlightCurrentPlayerCaps();
    this.updateHUD();
    this.isProcessingTurn = false;

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

    const audio = AudioManager.getInstance();
    audio.stopAmbience();
    audio.playSFX('sfx_whistle');

    const isMyWin = winner === 1;
    audio.playSFX(isMyWin ? 'sfx_win' : 'sfx_lose', { delay: 0.5 });

    const result = this.matchController.finishMatch(winner);
    if (this.isPvPMode) {
      result.rewards = isMyWin ? { coins: 150, xp: 50 } : { coins: 30, xp: 10 };
      result.isPvP = true;
    }

    this.showResultScreen(result);
  }

  // ==================== UI ====================

  private showResultScreen(result: any): void {
    this.resultScreen = new ResultScreen(this, result, this.isAIEnabled, {
      onRematch: () => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.resultScreen = undefined;
        if (this.isPvPMode) {
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

  private showPauseMenu(): void {
    if (this.pauseMenu || this.gameStateManager.getState() === 'finished') return;

    this.gameStateManager.pause();
    this.pauseMenu = new PauseMenu(this, {
      onResume: () => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.pauseMenu = undefined;
        this.gameStateManager.resume();
      },
      onChangeFormation: this.isPvPMode ? undefined : () => {
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
    if (this.formationMenu || this.isPvPMode) return;

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
    if (this.isPvPMode) this.mp.sendSurrender();

    const result = this.matchController.handleSurrender();
    this.gameStateManager.finish();
    this.shootingController.setEnabled(false);
    this.isProcessingTurn = true;
    this.gameHUD.setPauseEnabled(false);

    AudioManager.getInstance().stopAmbience();
    AudioManager.getInstance().playSFX('sfx_lose');

    this.showResultScreen(result);
  }

  // ==================== FIELD ====================

  private applyFormationToField(formation: Formation): void {
    const playerCaps = this.caps.filter(c => c.owner === 1);
    const enemyCaps = this.caps.filter(c => c.owner === 2);

    formation.slots.forEach((slot, i) => {
      if (playerCaps[i]) {
        const pos = this.relativeToAbsolute(slot.x, slot.y);
        this.startPositions.caps[i] = pos;
        playerCaps[i].setCapClass(slot.capClass);
      }
      if (enemyCaps[i]) {
        const pos = this.relativeToAbsolute(slot.x, 1 - slot.y);
        this.startPositions.caps[i + 3] = pos;
      }
    });
  }

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

    const audio = AudioManager.getInstance();
    audio.stopAll();
    audio.playAmbience('bgm_match');
    audio.playSFX('sfx_whistle');
  }

  private resetPositions(): void {
    this.ball.reset(this.startPositions.ball.x, this.startPositions.ball.y);
    this.caps.forEach((cap, i) => cap.reset(this.startPositions.caps[i].x, this.startPositions.caps[i].y));
  }

  private highlightCurrentPlayerCaps(): void {
    if (this.isPvPMode) {
      const isMyTurn = this.currentTurnId === this.mp.getMyId();
      this.caps.forEach(cap => cap.highlight(isMyTurn && cap.owner === 1));
    } else {
      const current = this.gameStateManager.getCurrentPlayer();
      const showHighlight = !this.aiController || current === 1;
      this.caps.forEach(cap => cap.highlight(showHighlight && cap.owner === current));
    }
  }

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
    const aiClasses: CapClass[] = ['sniper', 'balanced', 'tank'];

    formation.slots.forEach((slot, i) => {
      const absPos = this.relativeToAbsolute(slot.x, slot.y);
      const cap = new Cap(this, absPos.x, absPos.y, 1 as PlayerNumber, `p1_${i}`, slot.capClass, this.fieldScale, playerSkinId);
      this.caps.push(cap);
      this.startPositions.caps.push(absPos);
    });

    formation.slots.forEach((slot, i) => {
      const mirroredY = 1 - slot.y;
      const absPos = this.relativeToAbsolute(slot.x, mirroredY);
      const cap = new Cap(this, absPos.x, absPos.y, 2 as PlayerNumber, `p2_${i}`, aiClasses[i] || 'balanced', this.fieldScale);
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
      isStatic: true, restitution: 0.7, friction: 0.05, label: 'wall',
      collisionFilter: { category: COLLISION_CATEGORIES.WALL },
    };

    const postOpts: Phaser.Types.Physics.Matter.MatterBodyConfig = {
      ...wallOpts, restitution: 0.85, friction: 0.02, label: 'post',
    };

    const addRect = (x: number, y: number, w: number, h: number, opts: Phaser.Types.Physics.Matter.MatterBodyConfig) =>
      this.matter.add.rectangle(x, y, w, h, opts);

    addRect(left - thickness / 2, (top + bottom) / 2, thickness, bottom - top, wallOpts);
    addRect(right + thickness / 2, (top + bottom) / 2, thickness, bottom - top, wallOpts);
    addRect(left + sideWidth / 2, top - thickness / 2, sideWidth, thickness, wallOpts);
    addRect(right - sideWidth / 2, top - thickness / 2, sideWidth, thickness, wallOpts);
    addRect(left + sideWidth / 2, bottom + thickness / 2, sideWidth, thickness, wallOpts);
    addRect(right - sideWidth / 2, bottom + thickness / 2, sideWidth, thickness, wallOpts);

    [{ y: top, dir: -1 }, { y: bottom, dir: 1 }].forEach(({ y, dir }) => {
      addRect(centerX, y + dir * (goalDepth + thickness / 2), goalWidth, thickness, wallOpts);
      addRect(centerX - goalWidth / 2 - postThickness / 2, y + dir * goalDepth / 2, postThickness, goalDepth, postOpts);
      addRect(centerX + goalWidth / 2 + postThickness / 2, y + dir * goalDepth / 2, postThickness, goalDepth, postOpts);
    });
  }

  // ==================== CLEANUP ====================

  private cleanupPvP(): void {
    if (this.isPvPMode) {
      this.mp.off('opponent_shoot');
      this.mp.off('turn_change');
      this.mp.off('goal_scored');
      this.mp.off('continue_game');
      this.mp.off('opponent_surrendered');
      this.mp.off('opponent_disconnected');
      this.mp.off('positions_update');
      this.mp.clearRoom();
      
      if (this.syncInterval) {
        this.syncInterval.destroy();
        this.syncInterval = undefined;
      }
    }
  }

  shutdown(): void {
    AudioManager.getInstance().stopAll();
    this.cleanupPvP();
    this.gameHUD?.destroy();
    this.pauseMenu?.destroy();
    this.formationMenu?.destroy();
    this.resultScreen?.destroy();
    this.inGameSettings?.destroy();
    this.aiController?.destroy();
  }
}