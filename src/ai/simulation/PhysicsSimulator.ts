// src/ai/simulation/PhysicsSimulator.ts
// Теневой мир Matter.js для симуляции ударов без рендеринга

import { 
  GameSnapshot, 
  BodySnapshot, 
  UnitSnapshot,
  SimulationConfig,
  SimulationResult,
  ForceVector
} from '../candidates/CandidateTypes';
import { SnapshotManager } from './SnapshotManager';
import { COLLISION_CATEGORIES, FIELD, GOAL } from '../../constants/gameConstants';

// Используем глобальный Matter из window (загружается Phaser)
const Matter = (window as any).Matter;

/**
 * Симулятор физики для AI
 * Создаёт изолированный мир Matter.js для просчёта ударов
 */
export class PhysicsSimulator {
  private engine: any;
  private world: any;
  
  // Тела в симуляции
  private ballBody: MatterJS.BodyType | null = null;
  private unitBodies: Map<string, MatterJS.BodyType> = new Map();
  private walls: MatterJS.BodyType[] = [];
  
  // Текущий снимок
  private currentSnapshot: GameSnapshot | null = null;
  
  // Счётчики для результата
  private wallBounces = 0;
  private unitCollisions: string[] = [];
  private goalScored: 'player' | 'opponent' | null = null;

  // Конфиг по умолчанию
  private static readonly DEFAULT_CONFIG: SimulationConfig = {
    maxTicks: 120,  // 2 секунды при 60 FPS
    stopThreshold: 0.1,
    stopOnGoal: true,
    positionIterations: 6,
    velocityIterations: 4,
  };

  constructor() {
    this.initEngine();
  }

  private initEngine(): void {
    // Проверяем доступность Matter.js
    if (typeof Matter === 'undefined') {
      console.error('[PhysicsSimulator] Matter.js is not available!');
      return;
    }

    // Создаём движок без гравитации (вид сверху)
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: 0, scale: 0 },
    });
    this.world = this.engine.world;
    
    // Подписка на коллизии
    this.setupCollisionHandlers();
  }

  /**
   * Загружает снимок состояния в симулятор
   */
  loadSnapshot(snapshot: GameSnapshot): void {
    if (!this.engine) {
      this.initEngine();
    }
    
    this.reset();
    this.currentSnapshot = SnapshotManager.cloneSnapshot(snapshot);
    
    this.createWalls(snapshot.field);
    this.createBall(snapshot.ball);
    this.createUnits(snapshot.units.player, snapshot.units.opponent);
  }

  /**
   * Запускает симуляцию удара и возвращает результат
   */
  simulate(
    unitId: string, 
    force: ForceVector,
    config: Partial<SimulationConfig> = {}
  ): SimulationResult {
    const cfg = { ...PhysicsSimulator.DEFAULT_CONFIG, ...config };
    const startTime = performance.now();
    
    // Сбрасываем счётчики
    this.wallBounces = 0;
    this.unitCollisions = [];
    this.goalScored = null;

    // Находим юнит и применяем силу
    const unitBody = this.unitBodies.get(unitId);
    if (!unitBody) {
      console.warn(`[PhysicsSimulator] Unit ${unitId} not found, using fallback`);
      return this.createFallbackResult(performance.now() - startTime);
    }
    
    Matter.Body.applyForce(unitBody, unitBody.position, {
      x: force.x,
      y: force.y,
    });

    // Прогоняем симуляцию
    let ticks = 0;
    for (ticks = 0; ticks < cfg.maxTicks; ticks++) {
      Matter.Engine.update(this.engine, 1000 / 60);  // 60 FPS
      
      // Проверяем гол
      if (cfg.stopOnGoal && this.checkGoal()) {
        break;
      }
      
      // Проверяем остановку всех объектов
      if (this.areAllStopped(cfg.stopThreshold)) {
        break;
      }
      
      // Ограничиваем скорости
      this.limitSpeeds();
    }

    const executionTime = performance.now() - startTime;

    return this.buildResult(ticks, executionTime);
  }

  /**
   * Сбрасывает симулятор
   */
  reset(): void {
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

  /**
   * Уничтожает симулятор
   */
  destroy(): void {
    this.reset();
    if (this.engine) {
      Matter.Engine.clear(this.engine);
    }
  }

  // ========== ПРИВАТНЫЕ МЕТОДЫ ==========

  private setupCollisionHandlers(): void {
    if (!this.engine) return;
    
    Matter.Events.on(this.engine, 'collisionStart', (event: any) => {
      for (const pair of event.pairs) {
        const { bodyA, bodyB } = pair;
        
        // Мяч столкнулся со стеной
        if (this.isBallWallCollision(bodyA, bodyB)) {
          this.wallBounces++;
        }
        
        // Мяч столкнулся с юнитом
        const unitId = this.getBallUnitCollision(bodyA, bodyB);
        if (unitId && !this.unitCollisions.includes(unitId)) {
          this.unitCollisions.push(unitId);
        }
      }
    });
  }

  private isBallWallCollision(bodyA: MatterJS.BodyType, bodyB: MatterJS.BodyType): boolean {
    const labels = [bodyA.label, bodyB.label];
    return labels.includes('ball') && labels.some(l => l.startsWith('wall'));
  }

  private getBallUnitCollision(bodyA: MatterJS.BodyType, bodyB: MatterJS.BodyType): string | null {
    if (bodyA.label === 'ball' && bodyB.label.startsWith('sim_')) {
      return bodyB.label.replace('sim_', '');
    }
    if (bodyB.label === 'ball' && bodyA.label.startsWith('sim_')) {
      return bodyA.label.replace('sim_', '');
    }
    return null;
  }

  private createWalls(field: { width: number; height: number; goalWidth: number; goalDepth: number }): void {
    const thickness = 50;
    const { width, height, goalWidth, goalDepth } = field;
    const goalHalfWidth = goalWidth / 2;
    const centerX = width / 2;

    // Левая стена
    this.walls.push(this.createWall(-thickness / 2, height / 2, thickness, height, 'wall_left'));
    
    // Правая стена
    this.walls.push(this.createWall(width + thickness / 2, height / 2, thickness, height, 'wall_right'));

    // Верхняя стена (с вырезом под ворота)
    const topLeftWidth = centerX - goalHalfWidth;
    this.walls.push(this.createWall(topLeftWidth / 2, -thickness / 2, topLeftWidth, thickness, 'wall_top_left'));
    this.walls.push(this.createWall(centerX + goalHalfWidth + topLeftWidth / 2, -thickness / 2, topLeftWidth, thickness, 'wall_top_right'));

    // Нижняя стена (с вырезом под ворота)
    this.walls.push(this.createWall(topLeftWidth / 2, height + thickness / 2, topLeftWidth, thickness, 'wall_bottom_left'));
    this.walls.push(this.createWall(centerX + goalHalfWidth + topLeftWidth / 2, height + thickness / 2, topLeftWidth, thickness, 'wall_bottom_right'));

    // Штанги ворот (верх)
    this.walls.push(this.createWall(centerX - goalHalfWidth, -goalDepth / 2, 10, goalDepth, 'post_top_left'));
    this.walls.push(this.createWall(centerX + goalHalfWidth, -goalDepth / 2, 10, goalDepth, 'post_top_right'));
    
    // Штанги ворот (низ)
    this.walls.push(this.createWall(centerX - goalHalfWidth, height + goalDepth / 2, 10, goalDepth, 'post_bottom_left'));
    this.walls.push(this.createWall(centerX + goalHalfWidth, height + goalDepth / 2, 10, goalDepth, 'post_bottom_right'));
  }

  private createWall(x: number, y: number, w: number, h: number, label: string): MatterJS.BodyType {
    const wall = Matter.Bodies.rectangle(x, y, w, h, {
      isStatic: true,
      label,
      restitution: 0.9,
      friction: 0.05,
      collisionFilter: {
        category: COLLISION_CATEGORIES.WALL,
        mask: COLLISION_CATEGORIES.BALL | COLLISION_CATEGORIES.CAP,
      },
    });
    Matter.World.add(this.world, wall);
    return wall;
  }

  private createBall(snapshot: BodySnapshot): void {
    this.ballBody = Matter.Bodies.circle(snapshot.x, snapshot.y, snapshot.radius, {
      label: 'ball',
      mass: snapshot.mass,
      restitution: snapshot.restitution,
      friction: snapshot.friction,
      frictionAir: snapshot.frictionAir,
      collisionFilter: {
        category: COLLISION_CATEGORIES.BALL,
        mask: COLLISION_CATEGORIES.WALL | COLLISION_CATEGORIES.CAP,
      },
    });
    
    Matter.Body.setVelocity(this.ballBody, { x: snapshot.vx, y: snapshot.vy });
    Matter.World.add(this.world, this.ballBody);
  }

  private createUnits(playerUnits: UnitSnapshot[], opponentUnits: UnitSnapshot[]): void {
    const allUnits = [...playerUnits, ...opponentUnits];
    
    for (const unit of allUnits) {
      const body = Matter.Bodies.circle(unit.x, unit.y, unit.radius, {
        label: `sim_${unit.id}`,
        mass: unit.mass,
        restitution: unit.restitution,
        friction: unit.friction,
        frictionAir: unit.frictionAir,
        collisionFilter: {
          category: COLLISION_CATEGORIES.CAP,
          mask: COLLISION_CATEGORIES.WALL | COLLISION_CATEGORIES.CAP | COLLISION_CATEGORIES.BALL,
        },
      });
      
      Matter.Body.setVelocity(body, { x: unit.vx, y: unit.vy });
      Matter.World.add(this.world, body);
      this.unitBodies.set(unit.id, body);
    }
  }

  private checkGoal(): boolean {
    if (!this.ballBody || !this.currentSnapshot) return false;
    
    const { x, y } = this.ballBody.position;
    const field = this.currentSnapshot.field;
    const goalHalfWidth = field.goalWidth / 2;
    const centerX = field.width / 2;

    // Верхние ворота
    if (y < 0 && x > centerX - goalHalfWidth && x < centerX + goalHalfWidth) {
      this.goalScored = 'player';
      return true;
    }

    // Нижние ворота
    if (y > field.height && x > centerX - goalHalfWidth && x < centerX + goalHalfWidth) {
      this.goalScored = 'opponent';
      return true;
    }

    return false;
  }

  private areAllStopped(threshold: number): boolean {
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

  private limitSpeeds(): void {
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

  private buildResult(ticks: number, executionTimeMs: number): SimulationResult {
    const unitPositions = new Map<string, { x: number; y: number }>();
    for (const [id, body] of this.unitBodies) {
      unitPositions.set(id, { x: body.position.x, y: body.position.y });
    }

    const ballPos = this.ballBody 
      ? { x: this.ballBody.position.x, y: this.ballBody.position.y }
      : { x: 0, y: 0 };
    
    const ballVel = this.ballBody
      ? { x: this.ballBody.velocity.x, y: this.ballBody.velocity.y }
      : { x: 0, y: 0 };

    const field = this.currentSnapshot?.field || { width: FIELD.WIDTH, height: FIELD.HEIGHT };
    
    return {
      ballPosition: ballPos,
      ballVelocity: ballVel,
      unitPositions,
      goalScored: this.goalScored,
      wallBounces: this.wallBounces,
      unitCollisions: this.unitCollisions,
      ballDistanceToOpponentGoal: this.calculateDistanceToGoal(ballPos, 'opponent', field),
      ballDistanceToOwnGoal: this.calculateDistanceToGoal(ballPos, 'player', field),
      ownUnitsInDefenseZone: this.countUnitsInDefenseZone('player', field),
      enemyUnitsPushedDistance: 0,
      simulationTicks: ticks,
      executionTimeMs,
    };
  }

  private createFallbackResult(executionTimeMs: number): SimulationResult {
    return {
      ballPosition: { x: 0, y: 0 },
      ballVelocity: { x: 0, y: 0 },
      unitPositions: new Map(),
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

  private calculateDistanceToGoal(
    ballPos: { x: number; y: number },
    goalOwner: 'player' | 'opponent',
    field: { width: number; height: number }
  ): number {
    const goalY = goalOwner === 'player' ? 0 : field.height;
    const goalCenterX = field.width / 2;
    return Math.sqrt((ballPos.x - goalCenterX) ** 2 + (ballPos.y - goalY) ** 2);
  }

  private countUnitsInDefenseZone(
    team: 'player' | 'opponent',
    field: { width: number; height: number }
  ): number {
    if (!this.currentSnapshot) return 0;
    
    const units = team === 'player' 
      ? this.currentSnapshot.units.player 
      : this.currentSnapshot.units.opponent;
    
    const zoneStart = team === 'player' ? field.height * 0.66 : 0;
    const zoneEnd = team === 'player' ? field.height : field.height * 0.33;

    let count = 0;
    for (const unit of units) {
      const body = this.unitBodies.get(unit.id);
      if (body && body.position.y >= zoneStart && body.position.y <= zoneEnd) {
        count++;
      }
    }
    return count;
  }
}