// src/scenes/GameScene.ts

import Phaser from 'phaser';
import { FIELD, GOAL, COLLISION_CATEGORIES, STARTING_POSITIONS, BALL, GAME, CapClass } from '../constants/gameConstants';
import { FieldBounds, PlayerNumber, AIDifficulty, Formation } from '../types';
import { Ball } from '../entities/Ball';
import { Cap } from '../entities/Cap';
import { ShootingController, ShootEventData } from '../controllers/ShootingController';
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
import { 
  MultiplayerManager, 
  GameStartData, 
  ShootData, 
  PvPPlayer,
  PositionsData,
  MatchTimerData,
  MatchFinishedData,
  FinalPositions
} from '../managers/MultiplayerManager';

interface GameSceneData {
  vsAI?: boolean;
  difficulty?: AIDifficulty;
  isPvP?: boolean;
  pvpData?: GameStartData;
}

interface Snapshot {
  tick: number;
  serverTime: number;
  ball: { x: number; y: number; vx: number; vy: number };
  caps: { x: number; y: number; vx: number; vy: number }[];
  isMoving?: boolean;
}

class PvPDebugLogger {
  private isHost = false;
  private playerRole = 'UNKNOWN';
  private logHistory: string[] = [];
  private maxHistorySize = 100;
  private frameCount = 0;

  init(isHost: boolean, myPlayerIndex: number, myId: string): void {
    this.isHost = isHost;
    this.playerRole = isHost ? '🟢HOST' : '🔵GUEST';
    this.logHistory = [];
    this.frameCount = 0;
    console.log(`%c PvP DEBUG - ${this.playerRole}`, `color: ${isHost ? '#00ff00' : '#00aaff'}; font-weight: bold;`);
    console.log(`  Player ID: ${myId}, Index: ${myPlayerIndex}`);
  }

  log(category: string, message: string, data?: any): void {
    const prefix = `[${this.playerRole}][${category}]`;
    this.logHistory.push(`${Date.now()} ${prefix} ${message}`);
    if (this.logHistory.length > this.maxHistorySize) this.logHistory.shift();
    if (data !== undefined) console.log(`${prefix} ${message}`, data);
    else console.log(`${prefix} ${message}`);
  }

  warn(category: string, message: string, data?: any): void {
    console.warn(`[${this.playerRole}][${category}] ${message}`, data ?? '');
  }

  error(category: string, message: string, data?: any): void {
    console.error(`[${this.playerRole}][${category}] ${message}`, data ?? '');
  }

  logCapsState(caps: Cap[]): void {
    console.table(caps.map((cap, i) => ({
      idx: i, id: cap.id, owner: cap.owner,
      x: cap.body.position.x.toFixed(0), y: cap.body.position.y.toFixed(0)
    })));
  }

  incrementFrame(): void { this.frameCount++; }
  getFrameCount(): number { return this.frameCount; }
  dumpHistory(): void { this.logHistory.slice(-30).forEach(e => console.log(e)); }
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
  
  private isPvPMode = false;
  private pvpData?: GameStartData;
  private mp!: MultiplayerManager;
  private currentTurnId = '';
  private isHost = false;
  private myPlayerIndex = 0;
  private myPlayer?: PvPPlayer;
  private opponentPlayer?: PvPPlayer;
  private syncInterval?: Phaser.Time.TimerEvent;
  private lastShootTime = 0;
  private matchRemainingTime = 300;
  private ballSpeedBeforeCollision = 0;
  private lastCollisionTime = 0;
  private isGoalCelebrating = false;
  private celebrationContainer?: Phaser.GameObjects.Container;
  
  private snapshotBuffer: Snapshot[] = [];
  private readonly MAX_SNAPSHOTS = 30;
  private serverTimeOffset = 0;
  private timeSyncSamples: number[] = [];
  private readonly MAX_TIME_SYNC_SAMPLES = 5;
  
  // Локальная физика гостя - плавный переход
  private guestLocalPhysicsUntil = 0;
  private readonly LOCAL_PHYSICS_DURATION = 400;
  private guestBlendFactor = 0;
  private lastServerSnapshot?: Snapshot;
  
  private debug = new PvPDebugLogger();
  private debugOverlay?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data?: GameSceneData): void {
    this.isPvPMode = data?.isPvP ?? false;
    this.pvpData = data?.pvpData;
    
    if (this.isPvPMode && this.pvpData) {
      this.isAIEnabled = false;
      this.mp = MultiplayerManager.getInstance();
      this.isHost = this.mp.isHost();
      this.myPlayerIndex = this.mp.getMyPlayerIndex();
      this.currentTurnId = this.pvpData.currentTurn;
      this.myPlayer = this.mp.getMe() || undefined;
      this.opponentPlayer = this.mp.getOpponent() || undefined;
      
      if ((this.pvpData as any).serverTime) {
        const serverTime = Number((this.pvpData as any).serverTime);
        this.serverTimeOffset = serverTime - Date.now();
      }
      
      this.debug.init(this.isHost, this.myPlayerIndex, this.mp.getMyId() || 'unknown');
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
    this.lastShootTime = 0;
    this.matchRemainingTime = this.pvpData?.config.MATCH_DURATION || 300;
    this.isGoalCelebrating = false;
    this.celebrationContainer = undefined;
    this.snapshotBuffer = [];
    this.serverTimeOffset = 0;
    this.timeSyncSamples = [];
    this.guestLocalPhysicsUntil = 0;
    this.guestBlendFactor = 0;
    this.lastServerSnapshot = undefined;
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

    const fieldSkinId = this.isPvPMode ? this.pvpData?.fieldSkin : undefined;
    this.fieldRenderer = new FieldRenderer(this, this.fieldBounds, this.fieldScale, fieldSkinId);
    this.fieldRenderer.render();

    this.createWalls();
    this.createBall();
    this.createCaps();
    this.setupControllers();
    this.setupCollisions();
    this.createHUD();

    if (this.isPvPMode) {
      this.setupPvPListeners();
      this.createDebugOverlay();
      if (this.isHost) this.startSyncInterval();
      this.startTimeSync();
      this.debug.log('INIT', 'Caps created:');
      this.debug.logCapsState(this.caps);
    }
  }

  private startTimeSync(): void {
    this.time.addEvent({
      delay: 5000,
      callback: () => this.sendTimeSync(),
      loop: true
    });
    
    this.sendTimeSync();
    this.time.delayedCall(200, () => this.sendTimeSync());
    this.time.delayedCall(400, () => this.sendTimeSync());
    
    this.mp.on('pong_sync', (data: { clientTime: number; serverTime: number }) => {
      this.handlePongSync(data);
    });
  }

  private sendTimeSync(): void {
    if (this.mp?.getConnectionStatus()) {
      this.mp.sendPingSync(Date.now());
    }
  }

  private handlePongSync(data: { clientTime: number; serverTime: number }): void {
    const now = Date.now();
    const clientTimeSent = Number(data.clientTime);
    const serverTime = Number(data.serverTime);
    
    if (isNaN(clientTimeSent) || isNaN(serverTime)) return;
    
    const rtt = now - clientTimeSent;
    if (rtt > 1000) return;
    
    const offset = serverTime - now + Math.floor(rtt / 2);
    
    this.timeSyncSamples.push(offset);
    if (this.timeSyncSamples.length > this.MAX_TIME_SYNC_SAMPLES) {
      this.timeSyncSamples.shift();
    }
    
    const sorted = [...this.timeSyncSamples].sort((a, b) => a - b);
    this.serverTimeOffset = sorted[Math.floor(sorted.length / 2)];
    
    this.debug.log('TIME', `RTT: ${rtt}ms, Offset: ${this.serverTimeOffset}ms`);
  }

  private getServerTime(): number {
    return Date.now() + this.serverTimeOffset;
  }

  private createDebugOverlay(): void {
    if (!this.isPvPMode) return;
    
    this.debugOverlay = this.add.text(10, 10, '', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: this.isHost ? '#00ff00' : '#00aaff',
      backgroundColor: 'rgba(0,0,0,0.8)',
      padding: { x: 4, y: 4 }
    }).setDepth(9999).setScrollFactor(0);
    
    this.time.addEvent({
      delay: 100,
      callback: () => this.updateDebugOverlay(),
      loop: true
    });
  }

  private updateDebugOverlay(): void {
    if (!this.debugOverlay || !this.isPvPMode) return;
    
    const role = this.isHost ? 'HOST' : 'GUEST';
    const isMyTurn = this.currentTurnId === this.mp.getMyId();
    const state = this.gameStateManager.getState();
    const fps = Math.round(this.game.loop.actualFps);
    const now = this.time.now;
    const localEnd = this.guestLocalPhysicsUntil;
    const phase = localEnd === 0 ? 'SYNC' : 
                  now < localEnd ? 'LOCAL' : 
                  now < localEnd + 500 ? 'BLEND' : 'SYNC';
    
    this.debugOverlay.setText([
      `[${role}] FPS:${fps}`,
      `State:${state} Turn:${isMyTurn ? 'ME' : 'OPP'}`,
      `Phase:${phase} B:${this.guestBlendFactor.toFixed(2)}`
    ].join('\n'));
  }

  private configureMatterEngine(): void {
    const engine = (this.matter.world as any).engine;
    if (engine) {
      engine.positionIterations = 10;
      engine.velocityIterations = 10;
    }
  }

  private triggerHaptic(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light'): void {
    try { (window.Telegram?.WebApp as any)?.HapticFeedback?.impactOccurred?.(style); } catch {}
  }

  private triggerHapticNotification(type: 'error' | 'success' | 'warning' = 'success'): void {
    try { (window.Telegram?.WebApp as any)?.HapticFeedback?.notificationOccurred?.(type); } catch {}
  }

  private startSyncInterval(): void {
    this.syncInterval = this.time.addEvent({
      delay: 33,
      callback: () => this.sendPositionsToGuest(),
      loop: true
    });
  }

  private sendPositionsToGuest(): void {
    if (!this.isPvPMode || !this.isHost || !this.mp.getConnectionStatus()) return;
    
    const isMoving = this.ball.getSpeed() > 0.5 || this.caps.some(c => c.getSpeed() > 0.5);
    
    this.mp.sendSyncPositions(
      { x: this.ball.body.position.x, y: this.ball.body.position.y, vx: this.ball.body.velocity.x, vy: this.ball.body.velocity.y },
      this.caps.map(cap => ({ x: cap.body.position.x, y: cap.body.position.y, vx: cap.body.velocity.x, vy: cap.body.velocity.y })),
      isMoving
    );
  }

  private getCurrentPositions(): FinalPositions {
    return {
      ball: { x: this.ball.body.position.x, y: this.ball.body.position.y },
      caps: this.caps.map(cap => ({ x: cap.body.position.x, y: cap.body.position.y }))
    };
  }

  private setupPvPListeners(): void {
    this.mp.on('shoot_executed', (data: ShootData) => this.handleShootExecuted(data));
    this.mp.on('turn_change', (data: { currentTurn: string; scores: Record<string, number> }) => this.handleTurnChange(data));
    
    if (!this.isHost) {
      this.mp.on('positions_update', (data: PositionsData) => this.handlePositionsUpdate(data));
      this.mp.on('snapshot', (data: Snapshot) => this.handleSnapshot(data));
    }
    
    this.mp.on('match_timer', (data: MatchTimerData) => {
      this.matchRemainingTime = data.remainingTime;
      this.gameHUD.updateMatchTimer(data.remainingTime, data.totalTime);
    });
    
    this.mp.on('goal_scored', (data: { scorerId: string; scores: Record<string, number>; winner: string | null; finalPositions?: FinalPositions }) => this.handlePvPGoalScored(data));
    this.mp.on('continue_game', (data: { currentTurn: string }) => this.handleContinueGame(data));
    this.mp.on('match_finished', (data: MatchFinishedData) => this.handleMatchFinished(data));
    this.mp.on('opponent_surrendered', (data: any) => this.handleOpponentLeft('surrendered', data));
    this.mp.on('opponent_disconnected', (data: any) => this.handleOpponentLeft('disconnected', data));
  }

  private handlePositionsUpdate(data: PositionsData): void {
    if (this.isHost) return;
    
    const now = this.time.now;
    const transitionEnd = this.guestLocalPhysicsUntil + 500;
    
    const snapshot: Snapshot = {
      tick: (data as any).tick || 0,
      serverTime: Number((data as any).serverTime) || Date.now(),
      ball: data.ball,
      caps: data.caps,
      isMoving: (data as any).isMoving
    };
    
    // Всегда сохраняем последний снапшот
    this.lastServerSnapshot = snapshot;
    
    // Во время локальной физики и перехода - не добавляем в буфер
    if (now < transitionEnd && this.guestLocalPhysicsUntil > 0) {
      return;
    }
    
    this.addSnapshot(snapshot);
  }

  private handleSnapshot(data: Snapshot): void {
    if (this.isHost) return;
    
    const snapshot = { ...data, serverTime: Number(data.serverTime) || Date.now() };
    
    this.lastServerSnapshot = snapshot;
    
    const now = this.time.now;
    const transitionEnd = this.guestLocalPhysicsUntil + 500;
    
    if (now < transitionEnd && this.guestLocalPhysicsUntil > 0) {
      return;
    }
    
    this.addSnapshot(snapshot);
  }

  private addSnapshot(snapshot: Snapshot): void {
    this.snapshotBuffer.push(snapshot);
    while (this.snapshotBuffer.length > this.MAX_SNAPSHOTS) this.snapshotBuffer.shift();
  }

  private interpolateAndApply(): void {
    if (this.snapshotBuffer.length === 0) return;
    
    const latest = this.snapshotBuffer[this.snapshotBuffer.length - 1];
    
    const smoothMoveCap = (current: number, target: number): number => {
      const diff = target - current;
      const distance = Math.abs(diff);
      if (distance < 1) return current;
      const speed = Math.min(0.15, 0.05 + distance * 0.002);
      return current + diff * speed;
    };
    
    const smoothMoveBall = (current: number, target: number): number => {
      const diff = target - current;
      const distance = Math.abs(diff);
      if (distance < 1) return current;
      const speed = Math.min(0.25, 0.1 + distance * 0.003);
      return current + diff * speed;
    };
    
    const ballPos = this.ball.body.position;
    this.matter.body.setPosition(this.ball.body, { 
      x: smoothMoveBall(ballPos.x, latest.ball.x),
      y: smoothMoveBall(ballPos.y, latest.ball.y)
    });
    
    const ballVel = this.ball.body.velocity;
    this.matter.body.setVelocity(this.ball.body, {
      x: ballVel.x + (latest.ball.vx - ballVel.x) * 0.2,
      y: ballVel.y + (latest.ball.vy - ballVel.y) * 0.2
    });
    
    latest.caps.forEach((capState, i) => {
      const cap = this.caps[i];
      if (cap) {
        const capPos = cap.body.position;
        this.matter.body.setPosition(cap.body, { 
          x: smoothMoveCap(capPos.x, capState.x),
          y: smoothMoveCap(capPos.y, capState.y)
        });
        
        const capVel = cap.body.velocity;
        this.matter.body.setVelocity(cap.body, {
          x: capVel.x + (capState.vx - capVel.x) * 0.15,
          y: capVel.y + (capState.vy - capVel.y) * 0.15
        });
      }
    });
    
    if (this.snapshotBuffer.length > 5) {
      this.snapshotBuffer = this.snapshotBuffer.slice(-3);
    }
  }

  private blendWithLastSnapshot(): void {
    const snapshot = this.lastServerSnapshot;
    if (!snapshot) return;
    
    const blend = this.guestBlendFactor * 0.15;
    
    const ballPos = this.ball.body.position;
    this.matter.body.setPosition(this.ball.body, {
      x: ballPos.x + (snapshot.ball.x - ballPos.x) * blend,
      y: ballPos.y + (snapshot.ball.y - ballPos.y) * blend
    });
    
    const ballVel = this.ball.body.velocity;
    this.matter.body.setVelocity(this.ball.body, {
      x: ballVel.x + (snapshot.ball.vx - ballVel.x) * blend,
      y: ballVel.y + (snapshot.ball.vy - ballVel.y) * blend
    });
    
    snapshot.caps.forEach((capState, i) => {
      const cap = this.caps[i];
      if (!cap) return;
      
      const capPos = cap.body.position;
      this.matter.body.setPosition(cap.body, {
        x: capPos.x + (capState.x - capPos.x) * blend,
        y: capPos.y + (capState.y - capPos.y) * blend
      });
      
      const capVel = cap.body.velocity;
      this.matter.body.setVelocity(cap.body, {
        x: capVel.x + (capState.vx - capVel.x) * blend,
        y: capVel.y + (capState.vy - capVel.y) * blend
      });
    });
  }

  private applyFinalPositions(positions: FinalPositions): void {
    this.matter.body.setPosition(this.ball.body, positions.ball);
    this.matter.body.setVelocity(this.ball.body, { x: 0, y: 0 });
    this.ball.update();
    
    positions.caps.forEach((pos, i) => {
      if (this.caps[i]) {
        this.matter.body.setPosition(this.caps[i].body, pos);
        this.matter.body.setVelocity(this.caps[i].body, { x: 0, y: 0 });
        this.caps[i].update();
      }
    });
    
    this.guestLocalPhysicsUntil = 0;
    this.guestBlendFactor = 0;
    this.snapshotBuffer = [];
    this.lastServerSnapshot = undefined;
    
    this.debug.log('SYNC', 'Final positions applied');
  }

  private handleShootExecuted(data: ShootData): void {
    const isMyShoot = data.odotterId === this.mp.getMyId();
    this.debug.log('SHOOT_RECV', `capId=${data.capId} isMyShoot=${isMyShoot}`, data.force);
    
    if (isMyShoot) {
      this.debug.log('SHOOT', 'Confirmed by server');
      return;
    }
    
    this.isProcessingTurn = true;
    this.shootingController.setEnabled(false);
    this.gameStateManager.onShot();
    this.lastShootTime = this.time.now;
    
    if (this.isHost) {
      const cap = this.caps[data.capId];
      if (!cap) { this.debug.error('SHOOT', `Cap not found: ${data.capId}`); return; }
      
      if (data.position) this.matter.body.setPosition(cap.body, data.position);
      
      cap.highlight(true);
      this.time.delayedCall(200, () => cap.highlight(false));
      
      this.matter.body.setVelocity(cap.body, { x: 0, y: 0 });
      this.matter.body.setVelocity(cap.body, data.force);
    } else {
      const cap = this.caps[data.capId];
      if (cap) {
        cap.highlight(true);
        this.time.delayedCall(200, () => cap.highlight(false));
      }
    }
  }

  private handleTurnChange(data: { currentTurn: string; scores: Record<string, number> }): void {
    const isMyTurn = data.currentTurn === this.mp.getMyId();
    this.debug.log('TURN', isMyTurn ? '🎮 MY TURN' : '⏳ OPPONENT TURN');
    
    const myOwner = this.getMyOwner();
    const activeOwner: PlayerNumber = isMyTurn ? myOwner : (myOwner === 1 ? 2 : 1);
    
    this.currentTurnId = data.currentTurn;
    this.isProcessingTurn = false;
    this.updateScoreFromPvP(data.scores);
    this.gameStateManager.forceStop();
    
    // НЕ сбрасываем локальную физику - пусть плавный переход завершится
    
    this.shootingController.setCurrentPlayer(activeOwner);
    this.gameStateManager.setCurrentPlayer(activeOwner);
    this.shootingController.setEnabled(isMyTurn);
    
    this.highlightCurrentPlayerCaps();
    this.updateHUD();
  }

  private getMyOwner(): PlayerNumber {
    return (this.myPlayerIndex + 1) as PlayerNumber;
  }

  private handlePvPGoalScored(data: { scorerId: string; scores: Record<string, number>; winner: string | null; finalPositions?: FinalPositions }): void {
    if (this.isGoalCelebrating) return;
    this.isGoalCelebrating = true;
    
    this.debug.log('GOAL', 'Scored!', data);
    
    this.guestLocalPhysicsUntil = 0;
    this.guestBlendFactor = 0;
    this.snapshotBuffer = [];
    this.lastServerSnapshot = undefined;
    
    if (!this.isHost && data.finalPositions) {
      this.applyFinalPositions(data.finalPositions);
    }
    
    this.freezeAllObjects();
    
    const audio = AudioManager.getInstance();
    audio.playSFX('sfx_net', { volume: 1.5 });
    this.time.delayedCall(400, () => {
      audio.playSFX('sfx_goal');
      this.time.delayedCall(400, () => audio.playSFX('sfx_whistle', { volume: 0.8 }));
    });
    
    this.triggerHapticNotification('success');
    this.updateScoreFromPvP(data.scores);
    this.isProcessingTurn = true;
    this.shootingController.setEnabled(false);
    this.gameStateManager.setGoalState();
    this.updateHUD();
    
    const isMyGoal = data.scorerId === this.mp.getMyId();
    this.showGoalCelebration(isMyGoal);
    
    if (this.isHost) {
      this.time.delayedCall(3000, () => this.mp.sendReadyAfterGoal(data.scorerId));
    }
  }

  private freezeAllObjects(): void {
    if (this.ball?.body) {
      this.matter.body.setVelocity(this.ball.body, { x: 0, y: 0 });
      this.matter.body.setAngularVelocity(this.ball.body, 0);
    }
    this.caps.forEach(cap => {
      if (cap?.body) {
        this.matter.body.setVelocity(cap.body, { x: 0, y: 0 });
        this.matter.body.setAngularVelocity(cap.body, 0);
      }
    });
  }

  private showGoalCelebration(isMyGoal: boolean): void {
    const { width, height } = this.scale;
    this.celebrationContainer = this.add.container(0, 0).setDepth(1000);
    
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
    this.celebrationContainer.add(overlay);
    
    const goalText = this.add.text(width / 2, height / 2 - 60, '⚽ GOAL! ⚽', {
      fontSize: '56px', fontFamily: 'Arial Black', color: '#FFD700', stroke: '#000000', strokeThickness: 8
    }).setOrigin(0.5).setScale(0);
    this.celebrationContainer.add(goalText);
    
    const subText = this.add.text(width / 2, height / 2 + 20, isMyGoal ? 'You scored!' : 'Opponent scored!', {
      fontSize: '28px', fontFamily: 'Arial', color: isMyGoal ? '#00FF00' : '#FF6B6B', stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0);
    this.celebrationContainer.add(subText);
    
    this.tweens.add({ targets: goalText, scale: 1, duration: 400, ease: 'Back.easeOut' });
    this.tweens.add({ targets: subText, alpha: 1, y: height / 2 + 30, duration: 300, delay: 300 });
    
    if (isMyGoal) this.createConfetti();
    this.triggerHaptic(isMyGoal ? 'heavy' : 'medium');
  }

  private createConfetti(): void {
    const { width } = this.scale;
    const colors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF, 0xFFD700];
    
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(50, width - 50);
      const particle = this.add.rectangle(x, -20, Phaser.Math.Between(6, 12), Phaser.Math.Between(6, 12), Phaser.Math.RND.pick(colors))
        .setDepth(1001).setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
      this.celebrationContainer?.add(particle);
      this.tweens.add({
        targets: particle, y: this.scale.height + 50, x: x + Phaser.Math.Between(-80, 80),
        rotation: particle.rotation + Phaser.Math.FloatBetween(Math.PI * 2, Math.PI * 6),
        duration: Phaser.Math.Between(1500, 2500), delay: Phaser.Math.Between(0, 300)
      });
    }
  }

  private hideGoalCelebration(): void {
    if (!this.celebrationContainer) return;
    this.tweens.add({
      targets: this.celebrationContainer.list, alpha: 0, duration: 400,
      onComplete: () => { this.celebrationContainer?.destroy(true); this.celebrationContainer = undefined; }
    });
  }

  private handleContinueGame(data: { currentTurn: string }): void {
    this.debug.log('GAME', 'Continue after goal');
    this.hideGoalCelebration();
    this.isGoalCelebrating = false;
    this.snapshotBuffer = [];
    this.guestLocalPhysicsUntil = 0;
    this.guestBlendFactor = 0;
    this.lastServerSnapshot = undefined;
    
    this.currentTurnId = data.currentTurn;
    this.resetPositions();
    this.goalDetector.reset();
    this.isProcessingTurn = false;
    this.gameStateManager.forceStop();
    this.gameStateManager.setPlayingState();
    
    const isMyTurn = this.currentTurnId === this.mp.getMyId();
    const myOwner = this.getMyOwner();
    const activeOwner: PlayerNumber = isMyTurn ? myOwner : (myOwner === 1 ? 2 : 1);
    
    this.shootingController.setCurrentPlayer(activeOwner);
    this.gameStateManager.setCurrentPlayer(activeOwner);
    this.shootingController.setEnabled(isMyTurn);
    
    this.highlightCurrentPlayerCaps();
    this.updateHUD();
    AudioManager.getInstance().playSFX('sfx_whistle', { volume: 0.5 });
  }

  private handleMatchFinished(data: MatchFinishedData): void {
    this.debug.log('GAME', 'Match finished!', data);
    const isMyWin = data.winner === this.mp.getMyId();
    this.handlePvPMatchEnd(data.isDraw ? null : isMyWin, data.scores, data.reason, data.rewards);
  }

  private handleOpponentLeft(reason: string, data: any): void {
    this.debug.log('GAME', `Opponent left: ${reason}`);
    AudioManager.getInstance().stopAmbience();
    AudioManager.getInstance().playSFX('sfx_whistle');
    AudioManager.getInstance().playSFX('sfx_win', { delay: 0.5 });
    this.handlePvPMatchEnd(true, data.scores, reason, data.rewards);
  }

  private handlePvPMatchEnd(isMyWin: boolean | null, scores: Record<string, number>, reason: string, rewards?: Record<string, { coins: number; xp: number }>): void {
    this.hideGoalCelebration();
    this.isGoalCelebrating = false;
    this.gameStateManager.finish();
    this.shootingController.setEnabled(false);
    this.isProcessingTurn = true;
    this.gameHUD.setPauseEnabled(false);
    
    const audio = AudioManager.getInstance();
    audio.stopAmbience();
    audio.playSFX('sfx_whistle');
    audio.playSFX(isMyWin === null ? 'sfx_click' : (isMyWin ? 'sfx_win' : 'sfx_lose'), { delay: 0.5 });
    
    const myId = this.mp.getMyId()!;
    const myRewards = rewards?.[myId] || { coins: isMyWin ? 150 : 30, xp: isMyWin ? 50 : 15 };
    const myScore = scores[myId] || 0;
    const oppScore = scores[this.opponentPlayer?.id || ''] || 0;
    
    this.showResultScreen({
      winner: isMyWin === null ? null : (isMyWin ? 1 : 2), isWin: isMyWin === true, isDraw: isMyWin === null,
      playerGoals: myScore, opponentGoals: oppScore, xpEarned: myRewards.xp, coinsEarned: myRewards.coins,
      isPerfectGame: isMyWin && oppScore === 0, newAchievements: [], rewards: myRewards, isPvP: true, reason,
      message: this.getEndMessage(isMyWin, reason)
    });
  }

  private getEndMessage(isMyWin: boolean | null, reason: string): string {
    if (reason === 'surrendered') return 'Opponent surrendered!';
    if (reason === 'disconnected') return 'Opponent disconnected!';
    if (reason === 'time') return isMyWin === null ? "Time's up! Draw!" : (isMyWin ? "Time's up! You win!" : "Time's up! You lose!");
    return isMyWin === null ? "It's a draw!" : (isMyWin ? 'Victory!' : 'Defeat!');
  }

  private updateScoreFromPvP(scores: Record<string, number>): void {
    const myId = this.mp.getMyId()!;
    const oppId = this.opponentPlayer?.id || '';
    this.scoreManager.setScores(scores[myId] || 0, scores[oppId] || 0);
  }

  private setupControllers(): void {
    this.goalDetector = new GoalDetector(this, this.ball, this.fieldBounds, this.fieldScale);
    this.goalDetector.setCaps(this.caps, this.startPositions.caps);
    
    this.goalDetector.onGoal(player => {
      if (this.isPvPMode) {
        if (this.isHost && this.time.now > 2000) {
          const scorerId = player === 1 ? this.mp.getMyId()! : this.opponentPlayer!.id;
          this.debug.log('GOAL', `Detected! Scorer: ${scorerId}`);
          this.mp.sendGoal(scorerId, this.getCurrentPositions());
        }
      } else {
        this.handleGoal(player);
      }
    });

    this.scoreManager = new ScoreManager(this);

    this.gameStateManager = new GameStateManager(this.ball, this.caps);
    this.gameStateManager.setPvPMode(this.isPvPMode);
    this.gameStateManager.setIsHost(this.isHost);
    
    this.gameStateManager.onAllObjectsStopped(() => {
      if (this.isPvPMode && this.isHost) {
        if (this.gameStateManager.getState() === 'moving' && this.time.now - this.lastShootTime > 500) {
          this.debug.log('STATE', 'All stopped - notifying server');
          this.mp.sendObjectsStopped();
        }
      }
    });
    
    if (!this.isPvPMode) {
      this.gameStateManager.onTurnChange(player => this.onLocalTurnChange(player));
    }
    
    this.gameStateManager.onStateChange(state => this.onStateChange(state));

    this.shootingController = new ShootingController(this);
    
    if (this.isPvPMode) {
      this.shootingController.setPvPMode(true, this.isHost);
    }
    
    const myOwner = this.isPvPMode ? this.getMyOwner() : 1;
    let localCapIndex = 0;
    
    this.caps.forEach((cap, arrayIndex) => {
      if (cap.owner === myOwner) {
        this.shootingController.registerCap(cap, localCapIndex);
        localCapIndex++;
      }
    });

    if (this.isPvPMode) {
      const isMyTurn = this.currentTurnId === this.mp.getMyId();
      const activeOwner: PlayerNumber = isMyTurn ? myOwner : (myOwner === 1 ? 2 : 1);
      
      this.shootingController.setCurrentPlayer(activeOwner);
      this.gameStateManager.setCurrentPlayer(activeOwner);
      this.shootingController.setEnabled(isMyTurn);
    } else {
      this.shootingController.setCurrentPlayer(1);
      this.gameStateManager.setCurrentPlayer(1);
      this.shootingController.setEnabled(true);
    }
    
    this.shootingController.onShoot((data: ShootEventData) => {
      this.debug.log('SHOOT', `Local shoot`, { capId: data.cap.id, localCapIndex: data.localCapIndex, velocity: data.velocity });
      
      this.isProcessingTurn = true;
      this.lastShootTime = this.time.now;
      this.shootingController.setEnabled(false);
      
      // Гость: период локальной физики для плавности
      if (this.isPvPMode && !this.isHost) {
        this.snapshotBuffer = [];
        this.guestLocalPhysicsUntil = this.time.now + this.LOCAL_PHYSICS_DURATION;
        this.guestBlendFactor = 0;
        
        // Применяем силу локально
        this.matter.body.setVelocity(data.cap.body, { x: 0, y: 0 });
        this.matter.body.setVelocity(data.cap.body, { x: data.velocity.x, y: data.velocity.y });
        
        this.debug.log('PHYSICS', `Local physics for ${this.LOCAL_PHYSICS_DURATION}ms`);
      }
      
      this.gameStateManager.onShot();
      
      if (this.isPvPMode) {
        const startIndex = this.mp.getMyCapStartIndex();
        const serverCapId = startIndex + data.localCapIndex;
        this.mp.sendShoot(serverCapId, data.velocity, { x: data.cap.body.position.x, y: data.cap.body.position.y });
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
      this.debug.log('STATE', `Changed to: ${state}`);
      if (state === 'moving') this.shootingController.setEnabled(false);
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

        if (this.isPvPMode && !this.isHost) continue;

        const ballBody = pair.bodyA.label === 'ball' ? pair.bodyA : (pair.bodyB.label === 'ball' ? pair.bodyB : null);
        if (ballBody) {
          const other = pair.bodyA.label === 'ball' ? pair.bodyB.label : pair.bodyA.label;
          if (other === 'wall') this.handleBallWallCollision(ballBody);
          else if (other === 'post') this.handleBallPostCollision(ballBody);
        }
      }
    });
  }

  private handleCollisionSound(bodyA: MatterJS.BodyType, bodyB: MatterJS.BodyType): boolean {
    const velA = Math.hypot(bodyA.velocity.x, bodyA.velocity.y);
    const velB = Math.hypot(bodyB.velocity.x, bodyB.velocity.y);
    const impact = velA + velB;
    if (impact < 0.5) return false;

    const volume = Phaser.Math.Clamp(impact / 20, 0.3, 1.0);
    const audio = AudioManager.getInstance();
    
    const isBallA = bodyA.label === 'ball';
    const isBallB = bodyB.label === 'ball';
    const isCapA = bodyA.label?.startsWith('cap');
    const isCapB = bodyB.label?.startsWith('cap');
    const isWallA = bodyA.label === 'wall';
    const isWallB = bodyB.label === 'wall';

    if ((isBallA && isCapB) || (isBallB && isCapA)) {
      audio.playSFX('sfx_kick', { volume });
      if (volume > 0.5) this.triggerHaptic('light');
      return true;
    }
    if (isCapA && isCapB) {
      audio.playSFX('sfx_clack', { volume: volume * 0.9 });
      return true;
    }
    if ((isBallA && isWallB) || (isBallB && isWallA)) {
      audio.playSFX('sfx_bounce', { volume: volume * 0.7 });
      return true;
    }
    return false;
  }

  private handleBallWallCollision(ballBody: MatterJS.BodyType): void {
    if (this.isPvPMode && !this.isHost) return;
    
    const speed = this.ballSpeedBeforeCollision;
    if (speed < 2) return;
    
    const { left, right, top, bottom } = this.fieldBounds;
    const { x, y } = ballBody.position;
    const cs = 60 * this.fieldScale;
    
    const corners = {
      topLeft: x < left + cs && y < top + cs,
      topRight: x > right - cs && y < top + cs,
      bottomLeft: x < left + cs && y > bottom - cs,
      bottomRight: x > right - cs && y > bottom - cs,
    };
    
    if (Object.values(corners).some(Boolean)) {
      this.time.delayedCall(10, () => this.applyCurveBounce(ballBody, speed, corners));
    }
  }

  private handleBallPostCollision(ballBody: MatterJS.BodyType): void {
    const speed = this.ballSpeedBeforeCollision;
    if (speed < 1) return;
    AudioManager.getInstance().playSFX('sfx_post', { volume: Phaser.Math.Clamp(speed / 15, 0.4, 1.0) });
  }

  private applyCurveBounce(ballBody: MatterJS.BodyType, speed: number, corners: Record<string, boolean>): void {
    if (this.isPvPMode && !this.isHost) return;
    
    const { x: vx, y: vy } = ballBody.velocity;
    const currentSpeed = Math.sqrt(vx * vx + vy * vy);
    if (currentSpeed < 1) return;
    
    const curveSpeed = currentSpeed * Math.min(speed / 15, 0.85);
    const isVertical = Math.abs(vy) > Math.abs(vx);
    
    let curveX = 0, curveY = 0;
    
    if (corners.topLeft) { curveX = isVertical ? curveSpeed : Math.abs(vx) * 0.3; curveY = isVertical ? Math.abs(vy) * 0.3 : curveSpeed; }
    else if (corners.topRight) { curveX = isVertical ? -curveSpeed : -Math.abs(vx) * 0.3; curveY = isVertical ? Math.abs(vy) * 0.3 : curveSpeed; }
    else if (corners.bottomLeft) { curveX = isVertical ? curveSpeed : Math.abs(vx) * 0.3; curveY = isVertical ? -Math.abs(vy) * 0.3 : -curveSpeed; }
    else if (corners.bottomRight) { curveX = isVertical ? -curveSpeed : -Math.abs(vx) * 0.3; curveY = isVertical ? -Math.abs(vy) * 0.3 : -curveSpeed; }
    
    this.matter.body.setVelocity(ballBody, { x: curveX, y: curveY });
  }

  update(): void {
    const state = this.gameStateManager.getState();
    if (state === 'paused' || state === 'finished' || state === 'goal') return;
    if (this.isGoalCelebrating) return;
    
    if (this.isPvPMode) {
      this.debug.incrementFrame();
      
      if (this.isHost) {
        this.ball.update();
        this.caps.forEach(cap => cap.update());
        this.gameStateManager.update();
        this.goalDetector.update();
        this.checkBoundaries();
      } else {
        const now = this.time.now;
        const localPhysicsEnd = this.guestLocalPhysicsUntil;
        
        if (localPhysicsEnd === 0) {
          // Нет активной локальной физики - полная синхронизация
          this.guestBlendFactor = 1;
          this.interpolateAndApply();
          this.ball.syncSpriteWithBody();
          this.caps.forEach(cap => cap.syncSpriteWithBody());
        } else if (now < localPhysicsEnd) {
          // Период локальной физики - полный контроль
          this.guestBlendFactor = 0;
          this.ball.update();
          this.caps.forEach(cap => cap.update());
        } else if (now < localPhysicsEnd + 500) {
          // Переходный период - плавное смешивание
          this.guestBlendFactor = Math.min(1, (now - localPhysicsEnd) / 500);
          
          this.ball.update();
          this.caps.forEach(cap => cap.update());
          
          this.blendWithLastSnapshot();
        } else {
          // Переход завершён
          this.guestLocalPhysicsUntil = 0;
          this.guestBlendFactor = 1;
          this.interpolateAndApply();
          this.ball.syncSpriteWithBody();
          this.caps.forEach(cap => cap.syncSpriteWithBody());
        }
      }
    } else {
      this.ball.update();
      this.caps.forEach(cap => cap.update());
      this.gameStateManager.update();
      this.goalDetector.update();
      this.checkBoundaries();
    }
    
    this.updateCrowdIntensity();
  }

  private updateCrowdIntensity(): void {
    if (!this.ball || !this.fieldBounds) return;
    const dist = (this.ball.y - this.fieldBounds.top) / this.fieldBounds.height;
    const intensity = dist < 0.25 ? 0.7 : dist < 0.5 ? 0.4 : 0.2;
    AudioManager.getInstance().setAmbienceVolume(intensity);
  }

  private checkBoundaries(): void {
    const bounds = this.fieldBounds;
    const goalHW = (GOAL.WIDTH * this.fieldScale) / 2;
    
    this.constrainBody(this.ball, bounds, goalHW, 10);
    this.caps.forEach(cap => this.constrainBody(cap, bounds, 0, 10));
  }

  private constrainBody(entity: Ball | Cap, bounds: FieldBounds, goalHW: number, padding: number): void {
    const pos = entity.body.position;
    const vel = entity.body.velocity;
    const r = entity.getRadius();
    const inGoalX = goalHW > 0 && Math.abs(pos.x - bounds.centerX) < goalHW;
    
    if (pos.x < bounds.left - r - padding) {
      this.matter.body.setPosition(entity.body, { x: bounds.left + r, y: pos.y });
      this.matter.body.setVelocity(entity.body, { x: Math.abs(vel.x) * 0.5, y: vel.y });
    }
    if (pos.x > bounds.right + r + padding) {
      this.matter.body.setPosition(entity.body, { x: bounds.right - r, y: pos.y });
      this.matter.body.setVelocity(entity.body, { x: -Math.abs(vel.x) * 0.5, y: vel.y });
    }
    if (pos.y < bounds.top - r - padding && !inGoalX) {
      this.matter.body.setPosition(entity.body, { x: pos.x, y: bounds.top + r });
      this.matter.body.setVelocity(entity.body, { x: vel.x, y: Math.abs(vel.y) * 0.5 });
    }
    if (pos.y > bounds.bottom + r + padding && !inGoalX) {
      this.matter.body.setPosition(entity.body, { x: pos.x, y: bounds.bottom - r });
      this.matter.body.setVelocity(entity.body, { x: vel.x, y: -Math.abs(vel.y) * 0.5 });
    }
  }

  private createHUD(): void {
    this.gameHUD = new GameHUD(this, {
      isAIMode: this.isAIEnabled,
      aiDifficulty: this.aiDifficulty,
      isPvP: this.isPvPMode,
      opponentName: this.opponentPlayer?.name || 'Opponent',
      matchDuration: this.pvpData?.config.MATCH_DURATION || 300
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

  private handleGoal(scoringPlayer: PlayerNumber): void {
    const audio = AudioManager.getInstance();
    audio.playSFX('sfx_net', { volume: 1.5 });
    this.time.delayedCall(400, () => {
      audio.playSFX('sfx_goal');
      this.time.delayedCall(400, () => audio.playSFX('sfx_whistle', { volume: 0.8 }));
    });
    
    this.triggerHapticNotification('success');
    
    this.isProcessingTurn = true;
    this.isGoalCelebrating = true;
    this.gameStateManager.setGoalState();
    this.shootingController.setEnabled(false);
    this.matchController.addGoal(scoringPlayer);
    
    this.freezeAllObjects();
    this.showGoalCelebration(scoringPlayer === 1);
    
    const isWinningGoal = this.scoreManager.addGoal(scoringPlayer);
    
    this.time.delayedCall(GAME.GOAL_DELAY, () => {
      this.hideGoalCelebration();
      this.isGoalCelebrating = false;
      
      if (isWinningGoal) this.handleWin(scoringPlayer);
      else this.afterGoal(scoringPlayer);
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
    
    AudioManager.getInstance().stopAmbience();
    AudioManager.getInstance().playSFX('sfx_whistle');
    AudioManager.getInstance().playSFX(winner === 1 ? 'sfx_win' : 'sfx_lose', { delay: 0.5 });
    
    this.showResultScreen(this.matchController.finishMatch(winner));
  }

  private showResultScreen(result: any): void {
    this.resultScreen = new ResultScreen(this, result, this.isAIEnabled, {
      onRematch: () => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.resultScreen = undefined;
        if (this.isPvPMode) { this.cleanupPvP(); this.scene.start('MatchmakingScene'); }
        else this.restartGame();
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
      onResume: () => { AudioManager.getInstance().playSFX('sfx_click'); this.pauseMenu = undefined; this.gameStateManager.resume(); },
      onChangeFormation: this.isPvPMode ? undefined : () => { AudioManager.getInstance().playSFX('sfx_click'); this.pauseMenu = undefined; this.showFormationMenu(); },
      onSettings: () => { AudioManager.getInstance().playSFX('sfx_click'); this.pauseMenu = undefined; this.showInGameSettings(); },
      onSurrender: () => { AudioManager.getInstance().playSFX('sfx_click'); this.pauseMenu = undefined; this.handleSurrender(); },
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
      onCancel: () => { AudioManager.getInstance().playSFX('sfx_click'); this.formationMenu = undefined; this.gameStateManager.resume(); },
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
      onClose: () => { AudioManager.getInstance().playSFX('sfx_click'); this.inGameSettings = undefined; this.gameStateManager.resume(); },
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
    this.hideGoalCelebration();
    this.isGoalCelebrating = false;
    
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
    
    AudioManager.getInstance().stopAll();
    AudioManager.getInstance().playAmbience('bgm_match');
    AudioManager.getInstance().playSFX('sfx_whistle');
  }

  private resetPositions(): void {
    this.ball.reset(this.startPositions.ball.x, this.startPositions.ball.y);
    this.caps.forEach((cap, i) => cap.reset(this.startPositions.caps[i].x, this.startPositions.caps[i].y));
  }

  private highlightCurrentPlayerCaps(): void {
    if (this.isPvPMode) {
      const isMyTurn = this.currentTurnId === this.mp.getMyId();
      const myOwner = this.getMyOwner();
      this.caps.forEach(cap => cap.highlight(isMyTurn && cap.owner === myOwner));
    } else {
      const current = this.gameStateManager.getCurrentPlayer();
      const show = !this.aiController || current === 1;
      this.caps.forEach(cap => cap.highlight(show && cap.owner === current));
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
      left: centerX - w / 2, right: centerX + w / 2,
      top: centerY - h / 2, bottom: centerY + h / 2,
      centerX, centerY, width: w, height: h
    };
  }

  private relativeToAbsolute(relX: number, relY: number): { x: number; y: number } {
    return {
      x: this.fieldBounds.left + this.fieldBounds.width * relX,
      y: this.fieldBounds.top + this.fieldBounds.height * relY
    };
  }

  private createBall(): void {
    const pos = this.relativeToAbsolute(STARTING_POSITIONS.BALL.x, STARTING_POSITIONS.BALL.y);
    const ballSkinId = this.isPvPMode ? this.pvpData?.ballSkin : undefined;
    this.ball = new Ball(this, pos.x, pos.y, BALL.RADIUS * this.fieldScale, ballSkinId);
    this.startPositions.ball = pos;
  }

  private createCaps(): void {
    if (this.isPvPMode) this.createPvPCaps();
    else this.createOfflineCaps();
  }

  private createPvPCaps(): void {
    const players = this.pvpData!.players;
    const hostPlayer = players.find(p => p.playerIndex === 0)!;
    const guestPlayer = players.find(p => p.playerIndex === 1)!;
    
    const hostFormation = hostPlayer.formation || playerData.getSelectedFormation();
    const guestFormation = guestPlayer.formation || hostFormation;
    
    const hostCapSkin = hostPlayer.capSkin || 'cap_default_cyan';
    const guestCapSkin = guestPlayer.capSkin || 'cap_default_magenta';
    const defaultClasses: CapClass[] = ['sniper', 'balanced', 'tank'];
    
    const hostSlots = hostFormation?.slots || [];
    for (let i = 0; i < 3; i++) {
      const slot = hostSlots[i] || { x: 0.25 + i * 0.25, y: 0.8, capClass: defaultClasses[i] };
      const absPos = this.relativeToAbsolute(slot.x, slot.y);
      const cap = new Cap(this, absPos.x, absPos.y, 1 as PlayerNumber, `host_${i}`, slot.capClass || defaultClasses[i], this.fieldScale, hostCapSkin, { applyBonuses: false });
      this.caps.push(cap);
      this.startPositions.caps.push(absPos);
    }
    
    const guestSlots = guestFormation?.slots || hostSlots;
    for (let i = 0; i < 3; i++) {
      const slot = guestSlots[i] || { x: 0.25 + i * 0.25, y: 0.8, capClass: defaultClasses[i] };
      const absPos = this.relativeToAbsolute(slot.x, 1 - slot.y);
      const cap = new Cap(this, absPos.x, absPos.y, 2 as PlayerNumber, `guest_${i}`, slot.capClass || defaultClasses[i], this.fieldScale, guestCapSkin, { applyBonuses: false });
      this.caps.push(cap);
      this.startPositions.caps.push(absPos);
    }
  }

  private createOfflineCaps(): void {
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
      const absPos = this.relativeToAbsolute(slot.x, 1 - slot.y);
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
      collisionFilter: { category: COLLISION_CATEGORIES.WALL }
    };
    
    const postOpts: Phaser.Types.Physics.Matter.MatterBodyConfig = { ...wallOpts, restitution: 0.85, friction: 0.02, label: 'post' };
    
    this.matter.add.rectangle(left - thickness / 2, (top + bottom) / 2, thickness, bottom - top, wallOpts);
    this.matter.add.rectangle(right + thickness / 2, (top + bottom) / 2, thickness, bottom - top, wallOpts);
    this.matter.add.rectangle(left + sideWidth / 2, top - thickness / 2, sideWidth, thickness, wallOpts);
    this.matter.add.rectangle(right - sideWidth / 2, top - thickness / 2, sideWidth, thickness, wallOpts);
    this.matter.add.rectangle(left + sideWidth / 2, bottom + thickness / 2, sideWidth, thickness, wallOpts);
    this.matter.add.rectangle(right - sideWidth / 2, bottom + thickness / 2, sideWidth, thickness, wallOpts);
    
    [{ y: top, dir: -1 }, { y: bottom, dir: 1 }].forEach(({ y, dir }) => {
      this.matter.add.rectangle(centerX, y + dir * (goalDepth + thickness / 2), goalWidth, thickness, wallOpts);
      this.matter.add.rectangle(centerX - goalWidth / 2 - postThickness / 2, y + dir * goalDepth / 2, postThickness, goalDepth, postOpts);
      this.matter.add.rectangle(centerX + goalWidth / 2 + postThickness / 2, y + dir * goalDepth / 2, postThickness, goalDepth, postOpts);
    });
  }

  private cleanupPvP(): void {
    if (!this.isPvPMode) return;
    
    this.mp.off('shoot_executed');
    this.mp.off('turn_change');
    this.mp.off('positions_update');
    this.mp.off('snapshot');
    this.mp.off('match_timer');
    this.mp.off('goal_scored');
    this.mp.off('continue_game');
    this.mp.off('match_finished');
    this.mp.off('opponent_surrendered');
    this.mp.off('opponent_disconnected');
    this.mp.off('pong_sync');
    
    this.mp.clearRoom();
    
    if (this.syncInterval) { this.syncInterval.destroy(); this.syncInterval = undefined; }
    
    this.hideGoalCelebration();
    this.isGoalCelebrating = false;
    this.snapshotBuffer = [];
    this.timeSyncSamples = [];
    this.guestLocalPhysicsUntil = 0;
    this.guestBlendFactor = 0;
    this.lastServerSnapshot = undefined;
    
    if (this.debugOverlay) { this.debugOverlay.destroy(); this.debugOverlay = undefined; }
  }

  shutdown(): void {
    AudioManager.getInstance().stopAll();
    this.cleanupPvP();
    
    if (this.celebrationContainer) { this.celebrationContainer.destroy(true); this.celebrationContainer = undefined; }
    
    this.gameHUD?.destroy();
    this.pauseMenu?.destroy();
    this.formationMenu?.destroy();
    this.resultScreen?.destroy();
    this.inGameSettings?.destroy();
    this.aiController?.destroy();
  }
}