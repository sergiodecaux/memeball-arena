// src/ai/simulation/SimulationWorker.ts
// Web Worker для фоновых симуляций AI

import { 
  GameSnapshot, 
  SimulationResult, 
  ForceVector,
  SimulationConfig,
  BodySnapshot,
  UnitSnapshot
} from '../candidates/CandidateTypes';
import { COLLISION_CATEGORIES, FIELD, GOAL } from '../../constants/gameConstants';

// Типы сообщений
export interface WorkerRequest {
  type: 'simulate' | 'batch_simulate' | 'init';
  id: string;
  payload: SimulatePayload | BatchSimulatePayload | null;
}

export interface SimulatePayload {
  snapshot: GameSnapshot;
  unitId: string;
  force: ForceVector;
  config?: Partial<SimulationConfig>;
}

export interface BatchSimulatePayload {
  snapshot: GameSnapshot;
  candidates: Array<{
    id: string;
    unitId: string;
    force: ForceVector;
  }>;
  config?: Partial<SimulationConfig>;
}

export interface WorkerResponse {
  type: 'result' | 'batch_result' | 'error' | 'ready';
  id: string;
  payload: SimulationResult | SimulationResult[] | string | null;
}

// Код воркера как строка (будет создан через Blob)
const workerCode = `
// Matter.js будет загружен в воркер
let Matter = null;

// Симулятор внутри воркера
class WorkerSimulator {
  constructor() {
    this.engine = null;
    this.world = null;
    this.ballBody = null;
    this.unitBodies = new Map();
    this.walls = [];
    this.currentSnapshot = null;
    this.wallBounces = 0;
    this.unitCollisions = [];
    this.goalScored = null;
  }

  init() {
    if (!Matter) return false;
    
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: 0, scale: 0 },
    });
    this.world = this.engine.world;
    
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) {
        const { bodyA, bodyB } = pair;
        
        if (this.isBallWallCollision(bodyA, bodyB)) {
          this.wallBounces++;
        }
        
        const unitId = this.getBallUnitCollision(bodyA, bodyB);
        if (unitId && !this.unitCollisions.includes(unitId)) {
          this.unitCollisions.push(unitId);
        }
      }
    });
    
    return true;
  }

  isBallWallCollision(bodyA, bodyB) {
    const labels = [bodyA.label, bodyB.label];
    return labels.includes('ball') && labels.some(l => l.startsWith('wall'));
  }

  getBallUnitCollision(bodyA, bodyB) {
    if (bodyA.label === 'ball' && bodyB.label.startsWith('sim_')) {
      return bodyB.label.replace('sim_', '');
    }
    if (bodyB.label === 'ball' && bodyA.label.startsWith('sim_')) {
      return bodyA.label.replace('sim_', '');
    }
    return null;
  }

  loadSnapshot(snapshot) {
    this.reset();
    this.currentSnapshot = JSON.parse(JSON.stringify(snapshot));
    
    this.createWalls(snapshot.field);
    this.createBall(snapshot.ball);
    this.createUnits(snapshot.units.player, snapshot.units.opponent);
  }

  reset() {
    if (this.world) {
      Matter.World.clear(this.world, false);
    }
    this.ballBody = null;
    this.unitBodies.clear();
    this.walls = [];
    this.wallBounces = 0;
    this.unitCollisions = [];
    this.goalScored = null;
    this.currentSnapshot = null;
  }

  createWalls(field) {
    const thickness = 50;
    const { width, height, goalWidth, goalDepth } = field;
    const goalHalfWidth = goalWidth / 2;
    const centerX = width / 2;

    this.walls.push(this.createWall(-thickness / 2, height / 2, thickness, height, 'wall_left'));
    this.walls.push(this.createWall(width + thickness / 2, height / 2, thickness, height, 'wall_right'));

    const topLeftWidth = centerX - goalHalfWidth;
    this.walls.push(this.createWall(topLeftWidth / 2, -thickness / 2, topLeftWidth, thickness, 'wall_top_left'));
    this.walls.push(this.createWall(centerX + goalHalfWidth + topLeftWidth / 2, -thickness / 2, topLeftWidth, thickness, 'wall_top_right'));

    this.walls.push(this.createWall(topLeftWidth / 2, height + thickness / 2, topLeftWidth, thickness, 'wall_bottom_left'));
    this.walls.push(this.createWall(centerX + goalHalfWidth + topLeftWidth / 2, height + thickness / 2, topLeftWidth, thickness, 'wall_bottom_right'));

    this.walls.push(this.createWall(centerX - goalHalfWidth, -goalDepth / 2, 10, goalDepth, 'post_top_left'));
    this.walls.push(this.createWall(centerX + goalHalfWidth, -goalDepth / 2, 10, goalDepth, 'post_top_right'));
    this.walls.push(this.createWall(centerX - goalHalfWidth, height + goalDepth / 2, 10, goalDepth, 'post_bottom_left'));
    this.walls.push(this.createWall(centerX + goalHalfWidth, height + goalDepth / 2, 10, goalDepth, 'post_bottom_right'));
  }

  createWall(x, y, w, h, label) {
    const wall = Matter.Bodies.rectangle(x, y, w, h, {
      isStatic: true,
      label,
      restitution: 0.9,
      friction: 0.05,
    });
    Matter.World.add(this.world, wall);
    return wall;
  }

  createBall(snapshot) {
    this.ballBody = Matter.Bodies.circle(snapshot.x, snapshot.y, snapshot.radius, {
      label: 'ball',
      mass: snapshot.mass,
      restitution: snapshot.restitution,
      friction: snapshot.friction,
      frictionAir: snapshot.frictionAir,
    });
    
    Matter.Body.setVelocity(this.ballBody, { x: snapshot.vx, y: snapshot.vy });
    Matter.World.add(this.world, this.ballBody);
  }

  createUnits(playerUnits, opponentUnits) {
    const allUnits = [...playerUnits, ...opponentUnits];
    
    for (const unit of allUnits) {
      const body = Matter.Bodies.circle(unit.x, unit.y, unit.radius, {
        label: 'sim_' + unit.id,
        mass: unit.mass,
        restitution: unit.restitution,
        friction: unit.friction,
        frictionAir: unit.frictionAir,
      });
      
      Matter.Body.setVelocity(body, { x: unit.vx, y: unit.vy });
      Matter.World.add(this.world, body);
      this.unitBodies.set(unit.id, body);
    }
  }

  simulate(unitId, force, config) {
    const cfg = {
      maxTicks: 120,
      stopThreshold: 0.1,
      stopOnGoal: true,
      ...config
    };
    
    const startTime = performance.now();
    
    this.wallBounces = 0;
    this.unitCollisions = [];
    this.goalScored = null;

    const unitBody = this.unitBodies.get(unitId);
    if (!unitBody) {
      return this.createFallbackResult(performance.now() - startTime);
    }
    
    Matter.Body.applyForce(unitBody, unitBody.position, {
      x: force.x,
      y: force.y,
    });

    let ticks = 0;
    for (ticks = 0; ticks < cfg.maxTicks; ticks++) {
      Matter.Engine.update(this.engine, 1000 / 60);
      
      if (cfg.stopOnGoal && this.checkGoal()) {
        break;
      }
      
      if (this.areAllStopped(cfg.stopThreshold)) {
        break;
      }
      
      this.limitSpeeds();
    }

    return this.buildResult(ticks, performance.now() - startTime);
  }

  checkGoal() {
    if (!this.ballBody || !this.currentSnapshot) return false;
    
    const { x, y } = this.ballBody.position;
    const field = this.currentSnapshot.field;
    const goalHalfWidth = field.goalWidth / 2;
    const centerX = field.width / 2;

    if (y < 0 && x > centerX - goalHalfWidth && x < centerX + goalHalfWidth) {
      this.goalScored = 'player';
      return true;
    }

    if (y > field.height && x > centerX - goalHalfWidth && x < centerX + goalHalfWidth) {
      this.goalScored = 'opponent';
      return true;
    }

    return false;
  }

  areAllStopped(threshold) {
    if (!this.ballBody) return true;
    
    const ballSpeed = Math.sqrt(
      this.ballBody.velocity.x ** 2 + 
      this.ballBody.velocity.y ** 2
    );
    if (ballSpeed > threshold) return false;

    for (const body of this.unitBodies.values()) {
      const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
      if (speed > threshold) return false;
    }

    return true;
  }

  limitSpeeds() {
    const MAX_BALL_SPEED = 28;
    const MAX_UNIT_SPEED = 25;

    if (this.ballBody) {
      const speed = Math.sqrt(
        this.ballBody.velocity.x ** 2 + 
        this.ballBody.velocity.y ** 2
      );
      if (speed > MAX_BALL_SPEED) {
        const scale = MAX_BALL_SPEED / speed;
        Matter.Body.setVelocity(this.ballBody, {
          x: this.ballBody.velocity.x * scale,
          y: this.ballBody.velocity.y * scale,
        });
      }
    }

    for (const body of this.unitBodies.values()) {
      const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
      if (speed > MAX_UNIT_SPEED) {
        const scale = MAX_UNIT_SPEED / speed;
        Matter.Body.setVelocity(body, {
          x: body.velocity.x * scale,
          y: body.velocity.y * scale,
        });
      }
    }
  }

  buildResult(ticks, executionTimeMs) {
    const unitPositions = {};
    for (const [id, body] of this.unitBodies) {
      unitPositions[id] = { x: body.position.x, y: body.position.y };
    }

    const ballPos = this.ballBody 
      ? { x: this.ballBody.position.x, y: this.ballBody.position.y }
      : { x: 0, y: 0 };
    
    const ballVel = this.ballBody
      ? { x: this.ballBody.velocity.x, y: this.ballBody.velocity.y }
      : { x: 0, y: 0 };

    const field = this.currentSnapshot?.field || { width: 600, height: 900 };
    
    return {
      ballPosition: ballPos,
      ballVelocity: ballVel,
      unitPositions,
      goalScored: this.goalScored,
      wallBounces: this.wallBounces,
      unitCollisions: this.unitCollisions,
      ballDistanceToOpponentGoal: this.calculateDistanceToGoal(ballPos, 'opponent', field),
      ballDistanceToOwnGoal: this.calculateDistanceToGoal(ballPos, 'player', field),
      ownUnitsInDefenseZone: 0,
      enemyUnitsPushedDistance: 0,
      simulationTicks: ticks,
      executionTimeMs,
    };
  }

  createFallbackResult(executionTimeMs) {
    return {
      ballPosition: { x: 0, y: 0 },
      ballVelocity: { x: 0, y: 0 },
      unitPositions: {},
      goalScored: null,
      wallBounces: 0,
      unitCollisions: [],
      ballDistanceToOpponentGoal: 1000,
      ballDistanceToOwnGoal: 1000,
      ownUnitsInDefenseZone: 0,
      enemyUnitsPushedDistance: 0,
      simulationTicks: 0,
      executionTimeMs,
    };
  }

  calculateDistanceToGoal(ballPos, goalOwner, field) {
    const goalY = goalOwner === 'player' ? 0 : field.height;
    const goalCenterX = field.width / 2;
    return Math.sqrt((ballPos.x - goalCenterX) ** 2 + (ballPos.y - goalY) ** 2);
  }
}

const simulator = new WorkerSimulator();

// Загрузка Matter.js в воркер
importScripts('https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js');
Matter = self.Matter;
simulator.init();

self.postMessage({ type: 'ready', id: 'init', payload: null });

// Обработка сообщений
self.onmessage = function(e) {
  const { type, id, payload } = e.data;
  
  try {
    if (type === 'simulate') {
      simulator.loadSnapshot(payload.snapshot);
      const result = simulator.simulate(payload.unitId, payload.force, payload.config);
      self.postMessage({ type: 'result', id, payload: result });
    }
    else if (type === 'batch_simulate') {
      const results = [];
      for (const candidate of payload.candidates) {
        simulator.loadSnapshot(payload.snapshot);
        const result = simulator.simulate(candidate.unitId, candidate.force, payload.config);
        results.push({ ...result, candidateId: candidate.id });
      }
      self.postMessage({ type: 'batch_result', id, payload: results });
    }
  } catch (error) {
    self.postMessage({ type: 'error', id, payload: error.message });
  }
};
`;

/**
 * Менеджер Web Worker для AI симуляций
 */
export class SimulationWorkerManager {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = new Map();
  private isReady = false;
  private requestIdCounter = 0;
  private initPromise: Promise<boolean> | null = null;

  /**
   * Инициализирует Web Worker
   */
  async init(): Promise<boolean> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve) => {
      try {
        // Проверяем поддержку Web Worker
        if (typeof Worker === 'undefined') {
          console.warn('[SimulationWorker] Web Workers not supported');
          resolve(false);
          return;
        }

        // Создаём Worker из Blob
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        this.worker = new Worker(workerUrl);

        // Таймаут инициализации
        const initTimeout = setTimeout(() => {
          console.warn('[SimulationWorker] Init timeout');
          resolve(false);
        }, 5000);

        this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
          const { type, id, payload } = e.data;

          if (type === 'ready') {
            clearTimeout(initTimeout);
            this.isReady = true;
            console.log('[SimulationWorker] Ready');
            resolve(true);
            return;
          }

          const pending = this.pendingRequests.get(id);
          if (!pending) return;

          clearTimeout(pending.timeout);
          this.pendingRequests.delete(id);

          if (type === 'error') {
            pending.reject(new Error(payload as string));
          } else {
            pending.resolve(payload);
          }
        };

        this.worker.onerror = (error) => {
          console.error('[SimulationWorker] Error:', error);
          clearTimeout(initTimeout);
          resolve(false);
        };

      } catch (error) {
        console.error('[SimulationWorker] Failed to create:', error);
        resolve(false);
      }
    });

    return this.initPromise;
  }

  /**
   * Проверяет готовность воркера
   */
  isWorkerReady(): boolean {
    return this.isReady && this.worker !== null;
  }

  /**
   * Симулирует один удар
   */
  async simulate(
    snapshot: GameSnapshot,
    unitId: string,
    force: ForceVector,
    config?: Partial<SimulationConfig>
  ): Promise<SimulationResult> {
    if (!this.isWorkerReady()) {
      throw new Error('Worker not ready');
    }

    const id = `sim_${++this.requestIdCounter}`;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Simulation timeout'));
      }, 3000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      this.worker!.postMessage({
        type: 'simulate',
        id,
        payload: { snapshot, unitId, force, config }
      } as WorkerRequest);
    });
  }

  /**
   * Симулирует пакет ударов
   */
  async batchSimulate(
    snapshot: GameSnapshot,
    candidates: Array<{ id: string; unitId: string; force: ForceVector }>,
    config?: Partial<SimulationConfig>
  ): Promise<Array<SimulationResult & { candidateId: string }>> {
    if (!this.isWorkerReady()) {
      throw new Error('Worker not ready');
    }

    const id = `batch_${++this.requestIdCounter}`;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Batch simulation timeout'));
      }, 10000);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      this.worker!.postMessage({
        type: 'batch_simulate',
        id,
        payload: { snapshot, candidates, config }
      } as WorkerRequest);
    });
  }

  /**
   * Уничтожает воркер
   */
  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Worker destroyed'));
    }
    this.pendingRequests.clear();
    this.isReady = false;
    this.initPromise = null;
  }
}