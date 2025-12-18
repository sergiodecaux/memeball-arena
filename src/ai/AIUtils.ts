// src/ai/AIUtils.ts

import { Position, FieldBounds } from '../types';
import { Cap } from '../entities/Cap';
import { Ball } from '../entities/Ball';

/**
 * Утилиты для расчётов AI
 */
export class AIUtils {
  
  /**
   * Расстояние между двумя точками
   */
  static distance(p1: Position, p2: Position): number {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  }

  /**
   * Угол от точки p1 к точке p2 (в радианах)
   */
  static angleTo(p1: Position, p2: Position): number {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
  }

  /**
   * Нормализованный вектор направления
   */
  static directionTo(from: Position, to: Position): Position {
    const dist = this.distance(from, to);
    if (dist === 0) return { x: 0, y: 0 };
    return {
      x: (to.x - from.x) / dist,
      y: (to.y - from.y) / dist,
    };
  }

  /**
   * Позиция тела Matter.js
   */
  static getBodyPosition(body: MatterJS.BodyType): Position {
    return { x: body.position.x, y: body.position.y };
  }

  /**
   * Позиция фишки
   */
  static getCapPosition(cap: Cap): Position {
    return this.getBodyPosition(cap.body);
  }

  /**
   * Позиция мяча
   */
  static getBallPosition(ball: Ball): Position {
    return this.getBodyPosition(ball.body);
  }

  /**
   * Центр ворот противника (для Player 2 - верхние ворота)
   */
  static getEnemyGoalCenter(fieldBounds: FieldBounds, isPlayer2: boolean): Position {
    return {
      x: fieldBounds.centerX,
      y: isPlayer2 ? fieldBounds.top : fieldBounds.bottom,
    };
  }

  /**
   * Центр своих ворот
   */
  static getOwnGoalCenter(fieldBounds: FieldBounds, isPlayer2: boolean): Position {
    return {
      x: fieldBounds.centerX,
      y: isPlayer2 ? fieldBounds.bottom : fieldBounds.top,
    };
  }

  /**
   * Проверяет, находится ли мяч в опасной зоне (близко к своим воротам)
   */
  static isBallInDangerZone(
    ball: Ball,
    fieldBounds: FieldBounds,
    isPlayer2: boolean,
    dangerZoneRatio: number = 0.3
  ): boolean {
    const ballPos = this.getBallPosition(ball);
    const ownGoal = this.getOwnGoalCenter(fieldBounds, isPlayer2);
    const dangerDistance = fieldBounds.height * dangerZoneRatio;
    
    return this.distance(ballPos, ownGoal) < dangerDistance;
  }

  /**
   * Проверяет, находится ли мяч в зоне атаки (близко к воротам противника)
   */
  static isBallInAttackZone(
    ball: Ball,
    fieldBounds: FieldBounds,
    isPlayer2: boolean,
    attackZoneRatio: number = 0.35
  ): boolean {
    const ballPos = this.getBallPosition(ball);
    const enemyGoal = this.getEnemyGoalCenter(fieldBounds, isPlayer2);
    const attackDistance = fieldBounds.height * attackZoneRatio;
    
    return this.distance(ballPos, enemyGoal) < attackDistance;
  }

  /**
   * Находит ближайшую фишку к точке
   */
  static findClosestCap(caps: Cap[], target: Position): Cap | null {
    let closest: Cap | null = null;
    let minDist = Infinity;
    
    for (const cap of caps) {
      const dist = this.distance(this.getCapPosition(cap), target);
      if (dist < minDist) {
        minDist = dist;
        closest = cap;
      }
    }
    
    return closest;
  }

  /**
   * Находит лучшую позицию для удара по мячу в сторону ворот
   */
  static calculateShotPosition(
    ball: Ball,
    goalCenter: Position
  ): { angle: number; direction: Position } {
    const ballPos = this.getBallPosition(ball);
    const angle = this.angleTo(ballPos, goalCenter);
    const direction = this.directionTo(ballPos, goalCenter);
    
    return { angle, direction };
  }

  /**
   * Вычисляет точку, откуда нужно ударить по мячу, чтобы он полетел в цель
   */
  static calculateHitPoint(
    ballPos: Position,
    targetPos: Position,
    ballRadius: number,
    capRadius: number
  ): Position {
    // Направление от мяча к цели
    const dir = this.directionTo(ballPos, targetPos);
    
    // Точка удара - с противоположной стороны мяча
    const hitDistance = ballRadius + capRadius + 2; // небольшой зазор
    
    return {
      x: ballPos.x - dir.x * hitDistance,
      y: ballPos.y - dir.y * hitDistance,
    };
  }

  /**
   * Добавляет случайную ошибку к углу (для имитации неточности)
   */
  static addAngleError(angle: number, errorRange: number): number {
    const error = (Math.random() - 0.5) * 2 * errorRange;
    return angle + error;
  }

  /**
   * Добавляет случайную ошибку к силе удара
   */
  static addForceError(force: number, errorRange: number): number {
    const error = 1 + (Math.random() - 0.5) * 2 * errorRange;
    return force * error;
  }

  /**
   * Проверяет, есть ли прямая линия между двумя точками (без препятствий)
   */
  static hasLineOfSight(
    from: Position,
    to: Position,
    obstacles: Position[],
    obstacleRadius: number
  ): boolean {
    const dist = this.distance(from, to);
    const steps = Math.ceil(dist / 10);
    
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const checkPoint = {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      };
      
      for (const obstacle of obstacles) {
        if (this.distance(checkPoint, obstacle) < obstacleRadius) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Оценивает "опасность" позиции мяча для AI (0-1)
   */
  static evaluateDangerLevel(
    ball: Ball,
    fieldBounds: FieldBounds,
    isPlayer2: boolean
  ): number {
    const ballPos = this.getBallPosition(ball);
    const ownGoal = this.getOwnGoalCenter(fieldBounds, isPlayer2);
    const maxDist = fieldBounds.height;
    const dist = this.distance(ballPos, ownGoal);
    
    // Чем ближе к своим воротам, тем опаснее
    return Math.max(0, 1 - dist / maxDist);
  }

  /**
   * Оценивает "возможность атаки" (0-1)
   */
  static evaluateAttackOpportunity(
    ball: Ball,
    fieldBounds: FieldBounds,
    isPlayer2: boolean
  ): number {
    const ballPos = this.getBallPosition(ball);
    const enemyGoal = this.getEnemyGoalCenter(fieldBounds, isPlayer2);
    const maxDist = fieldBounds.height;
    const dist = this.distance(ballPos, enemyGoal);
    
    // Чем ближе к воротам противника, тем лучше
    return Math.max(0, 1 - dist / maxDist);
  }
}