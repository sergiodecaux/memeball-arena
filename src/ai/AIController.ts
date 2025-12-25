// src/ai/AIController.ts
// Simulation-based AI Controller с оптимизациями

import Phaser from 'phaser';
import { Ball } from '../entities/Ball';
import { Unit } from '../entities/Unit';
import { AIDifficulty, PlayerNumber } from '../types';
import { FIELD, CapClass, FactionId } from '../constants/gameConstants';

import { SimulationManager } from './simulation/SimulationManager';
import { CandidateGenerator } from './candidates/CandidateGenerator';
import { 
  ShotCandidate, 
  GameSnapshot, 
  CandidateGenerationContext,
  UnitSnapshot,
} from './candidates/CandidateTypes';
import { UtilityScorer, createSituationContext } from './scoring/UtilityScorer';
import { ErrorInjector, AdaptiveDifficultyDirector } from './humanizer/ErrorInjector';

// ========== ИНТЕРФЕЙСЫ ==========

interface IAIUnit {
  body: MatterJS.BodyType;
  owner: PlayerNumber;
  id: string;
  stats: any;
  getCapClass(): string;
  getRadius(): number;
  getSpeed(): number;
  getFactionId?(): string;
  canCurve?(): boolean;
  getCurveStrength?(): number;
  applyForce(fx: number, fy: number): void;
  highlight(enabled: boolean): void;
}

type AIGameUnit = Unit | IAIUnit;

interface DifficultyConfig {
  reactionTime: [number, number];
  accuracy: number;
  passChance: number;
  defenseDistance: number;
  adaptivePlay: boolean;
  maxSimulations: number;
  simulationTicks: number;
  useRicochet: boolean;
}

const CONFIG: Record<AIDifficulty, DifficultyConfig> = {
  easy: { 
    reactionTime: [1200, 1800], 
    accuracy: 0.4, 
    passChance: 0, 
    defenseDistance: 0, 
    adaptivePlay: false,
    maxSimulations: 3,
    simulationTicks: 60,
    useRicochet: false,
  },
  medium: { 
    reactionTime: [700, 1000], 
    accuracy: 0.75, 
    passChance: 0.15, 
    defenseDistance: 300, 
    adaptivePlay: false,
    maxSimulations: 5,
    simulationTicks: 90,
    useRicochet: true,
  },
  hard: { 
    reactionTime: [300, 500], 
    accuracy: 0.92, 
    passChance: 0.45, 
    defenseDistance: 420, 
    adaptivePlay: true,
    maxSimulations: 8,
    simulationTicks: 120,
    useRicochet: true,
  },
};

// ========== ГЛАВНЫЙ КЛАСС ==========

export class AIController {
  private scene: Phaser.Scene;
  private difficulty: AIDifficulty;
  private config: DifficultyConfig;
  
  private ball!: Ball;
  private aiUnits: AIGameUnit[] = [];
  private playerUnits: AIGameUnit[] = [];
  
  private isMyTurn: boolean = false;
  public isThinking: boolean = false;
  private hasMadeMove: boolean = false;
  
  private onMoveCompleteCallback?: () => void;
  private thinkingTimer?: Phaser.Time.TimerEvent;

  // Оптимизированный менеджер симуляций
  private simulationManager: SimulationManager;
  private errorInjector: ErrorInjector;
  private adaptiveDirector: AdaptiveDifficultyDirector;
  
  private score: { player: number; opponent: number } = { player: 0, opponent: 0 };
  private isInitialized = false;

  constructor(scene: Phaser.Scene, difficulty: AIDifficulty = 'medium') {
    this.scene = scene;
    this.difficulty = difficulty;
    this.config = CONFIG[difficulty];
    
    this.simulationManager = new SimulationManager();
    this.errorInjector = new ErrorInjector(difficulty);
    this.adaptiveDirector = new AdaptiveDifficultyDirector(difficulty);
    
    // Асинхронная инициализация
    this.initAsync();
  }

  private async initAsync(): Promise<void> {
    const mode = await this.simulationManager.init();
    this.isInitialized = true;
    console.log(`[AIController] Initialized with ${mode} simulation mode`);
  }

  init(aiUnits: AIGameUnit[], ball: Ball, playerUnits?: AIGameUnit[]): void {
    this.aiUnits = aiUnits;
    this.ball = ball;
    this.playerUnits = playerUnits || [];
  }

  updateScore(playerScore: number, aiScore: number): void {
    this.score = { player: playerScore, opponent: aiScore };
  }

  recordGoal(scorer: 'player' | 'ai'): void {
    this.adaptiveDirector.recordGoal(scorer);
  }

  onMoveComplete(callback: () => void): void {
    this.onMoveCompleteCallback = callback;
  }

  startTurn(): void {
    if (this.isThinking) return;
    
    if (!this.ball || !this.ball.body || this.aiUnits.some(u => !u.body)) {
      console.warn('[AIController] Cannot start turn: bodies destroyed');
      return;
    }

    console.log('[AIController] === AI TURN STARTED ===');
    this.isMyTurn = true;
    this.hasMadeMove = false;
    this.startThinking();
  }

  stop(): void {
    this.isMyTurn = false;
    this.isThinking = false;
    this.hasMadeMove = false;
    
    if (this.thinkingTimer) {
      this.thinkingTimer.remove(false);
      this.thinkingTimer = undefined;
    }
  }

  endTurn(): void {
    this.stop();
  }

  isAITurn(): boolean {
    return this.isMyTurn;
  }

  // ========== ЛОГИКА ПРИНЯТИЯ РЕШЕНИЙ ==========

  private startThinking(): void {
    if (!this.isMyTurn || this.hasMadeMove) {
      this.stop();
      return;
    }
    
    this.isThinking = true;
    const delay = this.errorInjector.getThinkingDelay();
    
    if (this.thinkingTimer) this.thinkingTimer.remove(false);

    this.thinkingTimer = this.scene.time.delayedCall(delay, () => {
      if (!this.scene.scene.isActive()) return;
      if (!this.isMyTurn || this.hasMadeMove) return;
      if (!this.ball || !this.ball.body) return;
      
      this.makeSimulationBasedDecision();
    });
  }

  private async makeSimulationBasedDecision(): Promise<void> {
    if (!this.isMyTurn || this.hasMadeMove) return;

    // Ждём инициализации если нужно
    if (!this.isInitialized) {
      console.log('[AIController] Waiting for initialization...');
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!this.isInitialized) {
        this.executePanicMove();
        return;
      }
    }

    try {
      const startTime = performance.now();
      
      // 1. Создаём снимок
      const snapshot = this.createGameSnapshot();
      
      // 2. Искажаем снимок
      const distortedSnapshot = this.errorInjector.distortSnapshot(snapshot);
      
      // 3. Генерируем кандидатов
      const candidates = this.generateCandidates(distortedSnapshot);
      
      if (candidates.length === 0) {
        console.log('[AIController] No candidates, falling back to panic move');
        this.executePanicMove();
        return;
      }

      // 4. Симулируем пакетом (оптимизировано)
      const evaluatedCandidates = await this.evaluateCandidatesOptimized(candidates, snapshot);
      
      // 5. Выбираем лучшего
      const bestCandidate = this.selectBestCandidate(evaluatedCandidates);
      
      const elapsed = performance.now() - startTime;
      console.log(`[AIController] Decision made in ${elapsed.toFixed(1)}ms`);
      
      // 6. Выполняем удар
      this.executeCandidate(bestCandidate);
      
    } catch (error) {
      console.error('[AIController] Error in simulation:', error);
      this.executePanicMove();
    }
  }

  // ========== СОЗДАНИЕ СНИМКА ==========

  private createGameSnapshot(): GameSnapshot {
    const playerUnits = this.playerUnits
      .filter(u => u.body)
      .map(u => this.unitToSnapshot(u, 1));
    
    const opponentUnits = this.aiUnits
      .filter(u => u.body)
      .map(u => this.unitToSnapshot(u, 2));

    const fieldWidth = this.scene.scale.width || FIELD.WIDTH;
    const fieldHeight = this.scene.scale.height || FIELD.HEIGHT;

    return {
      timestamp: Date.now(),
      ball: {
        id: 'ball',
        x: this.ball.body.position.x,
        y: this.ball.body.position.y,
        vx: this.ball.body.velocity.x,
        vy: this.ball.body.velocity.y,
        angle: this.ball.body.angle,
        angularVelocity: this.ball.body.angularVelocity,
        radius: this.ball.getRadius(),
        mass: this.ball.body.mass,
        restitution: this.ball.body.restitution,
        friction: this.ball.body.friction,
        frictionAir: this.ball.body.frictionAir,
      },
      units: {
        player: playerUnits,
        opponent: opponentUnits,
      },
      field: {
        width: fieldWidth,
        height: fieldHeight,
        goalWidth: 160,
        goalDepth: 40,
      },
      score: this.score,
    };
  }

  private unitToSnapshot(unit: AIGameUnit, owner: 1 | 2): UnitSnapshot {
    const capClass = this.getUnitCapClass(unit);
    const factionId = this.getUnitFactionId(unit);
    const canCurve = this.getUnitCanCurve(unit);
    const curveStrength = this.getUnitCurveStrength(unit);
    
    return {
      id: unit.id,
      x: unit.body.position.x,
      y: unit.body.position.y,
      vx: unit.body.velocity.x,
      vy: unit.body.velocity.y,
      angle: unit.body.angle,
      angularVelocity: unit.body.angularVelocity,
      radius: unit.getRadius(),
      mass: unit.body.mass,
      restitution: unit.body.restitution || 0.5,
      friction: unit.body.friction || 0.05,
      frictionAir: unit.body.frictionAir || 0.02,
      owner,
      capClass,
      factionId,
      canCurve,
      curveStrength,
    };
  }

  private getUnitCapClass(unit: AIGameUnit): CapClass {
    if (typeof unit.getCapClass === 'function') {
      return unit.getCapClass() as CapClass;
    }
    return 'balanced';
  }

  private getUnitFactionId(unit: AIGameUnit): FactionId {
    if ('getFactionId' in unit && typeof unit.getFactionId === 'function') {
      return unit.getFactionId() as FactionId;
    }
    return 'cyborg';
  }

  private getUnitCanCurve(unit: AIGameUnit): boolean {
    if ('canCurve' in unit && typeof unit.canCurve === 'function') {
      return unit.canCurve();
    }
    return false;
  }

  private getUnitCurveStrength(unit: AIGameUnit): number {
    if ('getCurveStrength' in unit && typeof unit.getCurveStrength === 'function') {
      return unit.getCurveStrength();
    }
    return 0;
  }

  // ========== ГЕНЕРАЦИЯ КАНДИДАТОВ ==========

  private generateCandidates(snapshot: GameSnapshot): ShotCandidate[] {
    const situation = createSituationContext(snapshot, 2);
    
    const context: CandidateGenerationContext = {
      snapshot,
      aiPlayer: 2,
      difficulty: this.difficulty,
      isDefending: situation.isDefending,
      isAttacking: situation.isAttacking,
      scoreDifference: situation.scoreDifference,
      maxCandidates: this.config.maxSimulations,
      includeRicochet: this.config.useRicochet,
      includePass: this.config.passChance > 0,
    };

    const generator = new CandidateGenerator(context);
    return generator.generate();
  }

  // ========== ОПТИМИЗИРОВАННАЯ ОЦЕНКА ==========

  private async evaluateCandidatesOptimized(
    candidates: ShotCandidate[], 
    snapshot: GameSnapshot
  ): Promise<ShotCandidate[]> {
    const situation = createSituationContext(snapshot, 2);

    // Используем пакетную симуляцию
    const results = await this.simulationManager.simulateBatch(
      snapshot,
      candidates,
      { maxTicks: this.config.simulationTicks }
    );

    // Оцениваем результаты
    for (const candidate of candidates) {
      const result = results.get(candidate.id);
      
      if (result) {
        const unit = snapshot.units.opponent.find(u => u.id === candidate.unitId);
        const capClass = unit?.capClass || 'balanced';
        const factionId = unit?.factionId || 'cyborg';
        
        const scorer = new UtilityScorer(
          capClass,
          factionId,
          situation,
          this.difficulty,
          2
        );
        
        candidate.simulatedScore = scorer.score(result, snapshot);
        candidate.simulationResult = result;
        
        console.log(
          `[AIController] ${candidate.type}: score=${candidate.simulatedScore.toFixed(1)}`
        );
      } else {
        candidate.simulatedScore = candidate.heuristicScore * 0.5;
      }
    }

    return candidates.sort((a, b) => 
      (b.simulatedScore || 0) - (a.simulatedScore || 0)
    );
  }

  // ========== ВЫБОР КАНДИДАТА ==========

  private selectBestCandidate(candidates: ShotCandidate[]): ShotCandidate {
    if (candidates.length === 0) {
      throw new Error('No candidates to select from');
    }

    let bestIndex = 0;
    bestIndex = this.errorInjector.maybeChooseSuboptimal(candidates, bestIndex);
    
    const selected = candidates[bestIndex];
    console.log(
      `[AIController] Selected: ${selected.type} (unit: ${selected.unitId}, ` +
      `score: ${selected.simulatedScore?.toFixed(1)})`
    );
    
    return selected;
  }

  // ========== ВЫПОЛНЕНИЕ УДАРА ==========

  private executeCandidate(candidate: ShotCandidate): void {
    const unit = this.findUnitById(candidate.unitId);
    if (!unit || !unit.body) {
      console.warn('[AIController] Unit not found:', candidate.unitId);
      this.executePanicMove();
      return;
    }

    const distortedForce = this.errorInjector.distortForce(candidate.force);
    
    const forceMultiplier = 1000;
    const forceX = distortedForce.x * forceMultiplier;
    const forceY = distortedForce.y * forceMultiplier;
    
    this.executeShot(unit, forceX, forceY);
  }

  private findUnitById(unitId: string): AIGameUnit | null {
    return this.aiUnits.find(u => u.id === unitId) || null;
  }

  private executePanicMove(): void {
    const available = this.aiUnits.filter(u => u.body && u.getSpeed() < 0.5);
    
    if (available.length === 0) {
      console.log('[AIController] No available units for panic move, retrying...');
      this.thinkingTimer = this.scene.time.delayedCall(300, () => this.startThinking());
      return;
    }

    const unit = available[0];
    const angle = Phaser.Math.Angle.Between(
      unit.body.position.x, 
      unit.body.position.y, 
      this.ball.x, 
      this.ball.y
    );
    
    const force = 150;
    this.executeShot(unit, Math.cos(angle) * force, Math.sin(angle) * force);
  }

  private executeShot(unit: AIGameUnit, forceX: number, forceY: number): void {
    if (!unit.body) return;
    
    console.log(`[AIController] Executing shot: unit=${unit.id}`);
    
    unit.highlight(true);
    
    this.scene.time.delayedCall(150, () => {
      if (unit && unit.body) {
        unit.highlight(false);
        unit.applyForce(forceX, forceY);
      }
      
      this.hasMadeMove = true;
      this.isThinking = false;
      
      if (this.onMoveCompleteCallback) {
        this.onMoveCompleteCallback();
      }
    });
  }

  // ========== ПУБЛИЧНЫЕ МЕТОДЫ ==========

  setPlayerUnits(units: AIGameUnit[]): void {
    this.playerUnits = units;
  }

  getDifficulty(): AIDifficulty {
    return this.difficulty;
  }

  setDifficulty(difficulty: AIDifficulty): void {
    this.difficulty = difficulty;
    this.config = CONFIG[difficulty];
    this.errorInjector.setDifficulty(difficulty);
  }

  getSimulationMode(): string {
    return this.simulationManager.getMode();
  }

  // ========== ОЧИСТКА ==========

  destroy(): void {
    this.stop();
    this.simulationManager.destroy();
    this.aiUnits = [];
    this.playerUnits = [];
    this.onMoveCompleteCallback = undefined;
  }
}