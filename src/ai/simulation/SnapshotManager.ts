// src/ai/simulation/SnapshotManager.ts
// Создание и восстановление снимков состояния игры

import { Ball } from '../../entities/Ball';
import { Unit } from '../../entities/Unit';
import { 
  GameSnapshot, 
  BodySnapshot, 
  UnitSnapshot 
} from '../candidates/CandidateTypes';
import { FIELD, GOAL } from '../../constants/gameConstants';

export class SnapshotManager {
  
  /**
   * Создаёт полный снимок текущего состояния игры
   */
  static createSnapshot(
    ball: Ball,
    playerUnits: Unit[],
    opponentUnits: Unit[],
    score: { player: number; opponent: number },
    fieldWidth?: number,
    fieldHeight?: number
  ): GameSnapshot {
    return {
      timestamp: Date.now(),
      
      ball: this.createBallSnapshot(ball),
      
      units: {
        player: playerUnits.map(u => this.createUnitSnapshot(u)),
        opponent: opponentUnits.map(u => this.createUnitSnapshot(u)),
      },
      
      field: {
        width: fieldWidth || FIELD.WIDTH,
        height: fieldHeight || FIELD.HEIGHT,
        goalWidth: GOAL.WIDTH,
        goalDepth: GOAL.DEPTH,
      },
      
      score: { ...score },
    };
  }

  /**
   * Создаёт снимок мяча
   */
  private static createBallSnapshot(ball: Ball): BodySnapshot {
    const body = ball.body;
    return {
      id: 'ball',
      x: body.position.x,
      y: body.position.y,
      vx: body.velocity.x,
      vy: body.velocity.y,
      angle: body.angle,
      angularVelocity: body.angularVelocity,
      radius: ball.getRadius(),
      mass: body.mass,
      restitution: body.restitution,
      friction: body.friction,
      frictionAir: body.frictionAir,
    };
  }

  /**
   * Создаёт снимок юнита
   */
  private static createUnitSnapshot(unit: Unit): UnitSnapshot {
    const body = unit.body;
    return {
      id: unit.id,
      x: body.position.x,
      y: body.position.y,
      vx: body.velocity.x,
      vy: body.velocity.y,
      angle: body.angle,
      angularVelocity: body.angularVelocity,
      radius: unit.getRadius(),
      mass: body.mass,
      restitution: body.restitution,
      friction: body.friction,
      frictionAir: body.frictionAir,
      owner: unit.owner,
      capClass: unit.getCapClass(),
      factionId: unit.getFactionId(),
      canCurve: unit.canCurve(),
      curveStrength: unit.getCurveStrength(),
    };
  }

  /**
   * Сериализует снимок в JSON-строку (для Web Worker)
   */
  static serialize(snapshot: GameSnapshot): string {
    return JSON.stringify(snapshot);
  }

  /**
   * Десериализует JSON-строку обратно в снимок
   */
  static deserialize(json: string): GameSnapshot {
    return JSON.parse(json) as GameSnapshot;
  }

  /**
   * Создаёт легковесную копию снимка (без лишних данных)
   */
  static cloneSnapshot(snapshot: GameSnapshot): GameSnapshot {
    return {
      timestamp: snapshot.timestamp,
      ball: { ...snapshot.ball },
      units: {
        player: snapshot.units.player.map(u => ({ ...u })),
        opponent: snapshot.units.opponent.map(u => ({ ...u })),
      },
      field: { ...snapshot.field },
      score: { ...snapshot.score },
    };
  }

  /**
   * Вычисляет хеш снимка для сравнения состояний
   */
  static hashSnapshot(snapshot: GameSnapshot): string {
    const ball = snapshot.ball;
    const positions = [
      ball.x.toFixed(1),
      ball.y.toFixed(1),
      ...snapshot.units.player.map(u => `${u.x.toFixed(1)},${u.y.toFixed(1)}`),
      ...snapshot.units.opponent.map(u => `${u.x.toFixed(1)},${u.y.toFixed(1)}`),
    ];
    return positions.join('|');
  }

  /**
   * Проверяет, остановились ли все объекты
   */
  static areAllObjectsStopped(snapshot: GameSnapshot, threshold = 0.1): boolean {
    const ballSpeed = Math.sqrt(snapshot.ball.vx ** 2 + snapshot.ball.vy ** 2);
    if (ballSpeed > threshold) return false;

    const allUnits = [...snapshot.units.player, ...snapshot.units.opponent];
    for (const unit of allUnits) {
      const speed = Math.sqrt(unit.vx ** 2 + unit.vy ** 2);
      if (speed > threshold) return false;
    }

    return true;
  }

  /**
   * Возвращает юнита по ID из снимка
   */
  static getUnitById(snapshot: GameSnapshot, unitId: string): UnitSnapshot | null {
    const playerUnit = snapshot.units.player.find(u => u.id === unitId);
    if (playerUnit) return playerUnit;
    
    const opponentUnit = snapshot.units.opponent.find(u => u.id === unitId);
    return opponentUnit || null;
  }

  /**
   * Вычисляет расстояние от мяча до ворот
   */
  static getBallDistanceToGoal(
    snapshot: GameSnapshot, 
    goalOwner: 1 | 2
  ): number {
    const ball = snapshot.ball;
    const field = snapshot.field;
    
    // Ворота игрока 1 сверху, игрока 2 снизу
    const goalY = goalOwner === 1 ? GOAL.DEPTH : field.height - GOAL.DEPTH;
    const goalCenterX = field.width / 2;
    
    return Math.sqrt(
      (ball.x - goalCenterX) ** 2 + 
      (ball.y - goalY) ** 2
    );
  }

  /**
   * Проверяет, находится ли мяч в воротах
   */
  static isBallInGoal(snapshot: GameSnapshot): 'player' | 'opponent' | null {
    const ball = snapshot.ball;
    const field = snapshot.field;
    const goalHalfWidth = field.goalWidth / 2;
    const centerX = field.width / 2;

    // Проверка верхних ворот (игрок 1 защищает, если AI = игрок 2)
    if (ball.y < field.goalDepth) {
      if (ball.x > centerX - goalHalfWidth && ball.x < centerX + goalHalfWidth) {
        return 'player'; // Мяч в верхних воротах
      }
    }

    // Проверка нижних ворот
    if (ball.y > field.height - field.goalDepth) {
      if (ball.x > centerX - goalHalfWidth && ball.x < centerX + goalHalfWidth) {
        return 'opponent'; // Мяч в нижних воротах
      }
    }

    return null;
  }
}