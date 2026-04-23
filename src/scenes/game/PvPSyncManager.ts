// src/scenes/game/PvPSyncManager.ts
// Менеджер синхронизации состояния с сервером + интерполяция

import { ServerGameState } from '../../types/pvp';

interface Snapshot {
  state: ServerGameState;
  timestamp: number;
  frame: number;
}

/**
 * Менеджер синхронизации состояний с интерполяцией
 */
export class PvPSyncManager {
  private snapshots: Snapshot[] = [];
  private maxSnapshots: number = 10;
  private interpolationFactor: number = 0.25;
  private desyncThreshold: number = 50; // pixels
  private lastRTT: number = 0;
  
  constructor(config?: { interpolationFactor?: number; desyncThreshold?: number }) {
    if (config?.interpolationFactor !== undefined) {
      this.interpolationFactor = config.interpolationFactor;
    }
    if (config?.desyncThreshold !== undefined) {
      this.desyncThreshold = config.desyncThreshold;
    }
  }
  
  /**
   * Добавить новый снапшот от сервера
   */
  public addSnapshot(state: ServerGameState, frame: number, timestamp: number): void {
    this.snapshots.push({ state, frame, timestamp });
    
    // Оставляем только последние N снапшотов
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }
  }
  
  /**
   * Получить интерполированное состояние
   */
  public getInterpolatedState(): ServerGameState | null {
    if (this.snapshots.length < 2) {
      return this.snapshots[0]?.state || null;
    }
    
    // Берём два последних снапшота
    const prev = this.snapshots[this.snapshots.length - 2];
    const current = this.snapshots[this.snapshots.length - 1];
    
    if (!prev || !current) return null;
    
    const result: ServerGameState = {
      ball: current.state.ball ? {
        x: current.state.ball.x,
        y: current.state.ball.y,
        vx: current.state.ball.vx,
        vy: current.state.ball.vy,
        angle: current.state.ball.angle,
        angularVelocity: current.state.ball.angularVelocity,
      } : null,
      units: {}
    };
    
    // Интерполяция мяча
    if (prev.state.ball && current.state.ball && result.ball) {
      result.ball.x = this.lerp(prev.state.ball.x, current.state.ball.x, this.interpolationFactor);
      result.ball.y = this.lerp(prev.state.ball.y, current.state.ball.y, this.interpolationFactor);
      result.ball.angle = this.lerpAngle(prev.state.ball.angle, current.state.ball.angle, this.interpolationFactor);
    }
    
    // Интерполяция юнитов
    for (const unitId in current.state.units) {
      const prevUnit = prev.state.units[unitId];
      const currentUnit = current.state.units[unitId];
      
      if (prevUnit && currentUnit) {
        result.units[unitId] = {
          x: this.lerp(prevUnit.x, currentUnit.x, this.interpolationFactor),
          y: this.lerp(prevUnit.y, currentUnit.y, this.interpolationFactor),
          vx: currentUnit.vx,
          vy: currentUnit.vy,
          angle: this.lerpAngle(prevUnit.angle, currentUnit.angle, this.interpolationFactor),
        };
      } else {
        result.units[unitId] = { ...currentUnit };
      }
    }
    
    return result;
  }
  
  /**
   * Применить состояние к игровым объектам с интерполяцией
   */
  public interpolateAndApply(
    ball: any,
    units: any[],
    fieldBounds: { minX: number; maxX: number; minY: number; maxY: number }
  ): void {
    const state = this.getInterpolatedState();
    if (!state) return;
    
    // Применяем к мячу
    if (ball && state.ball) {
      const distance = Math.hypot(
        ball.body.position.x - state.ball.x,
        ball.body.position.y - state.ball.y
      );
      
      if (distance > this.desyncThreshold) {
        // Hard sync - телепорт
        ball.setPosition(state.ball.x, state.ball.y);
        ball.setVelocity(state.ball.vx, state.ball.vy);
        ball.setAngle(state.ball.angle);
        ball.setAngularVelocity(state.ball.angularVelocity);
      } else {
        // Smooth interpolation
        const newX = this.lerp(ball.body.position.x, state.ball.x, this.interpolationFactor);
        const newY = this.lerp(ball.body.position.y, state.ball.y, this.interpolationFactor);
        ball.setPosition(newX, newY);
      }
    }
    
    // Применяем к юнитам
    units.forEach((unit) => {
      const unitId = this.getUnitId(unit);
      const serverUnit = state.units[unitId];
      
      if (serverUnit && unit.body) {
        const distance = Math.hypot(
          unit.body.position.x - serverUnit.x,
          unit.body.position.y - serverUnit.y
        );
        
        if (distance > this.desyncThreshold) {
          // Hard sync
          unit.setPosition(serverUnit.x, serverUnit.y);
          unit.setVelocity(serverUnit.vx, serverUnit.vy);
          unit.setAngle(serverUnit.angle);
        } else {
          // Smooth interpolation
          const newX = this.lerp(unit.body.position.x, serverUnit.x, this.interpolationFactor);
          const newY = this.lerp(unit.body.position.y, serverUnit.y, this.interpolationFactor);
          unit.setPosition(newX, newY);
        }
      }
    });
  }
  
  /**
   * Получить ID юнита
   */
  private getUnitId(unit: any): string {
    // Пытаемся получить ID из разных мест
    if (unit.id) return unit.id;
    if (unit.unitId) return unit.unitId;
    if (unit.name) return unit.name;
    return 'unknown';
  }
  
  /**
   * Линейная интерполяция
   */
  private lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
  }
  
  /**
   * Интерполяция углов (с учётом кругового характера)
   */
  private lerpAngle(start: number, end: number, t: number): number {
    const diff = ((end - start + 180) % 360) - 180;
    return start + diff * t;
  }
  
  /**
   * Обновить RTT (Round Trip Time)
   */
  public setRTT(rtt: number): void {
    this.lastRTT = rtt;
  }
  
  /**
   * Получить RTT
   */
  public getRTT(): number {
    return this.lastRTT;
  }
  
  /**
   * Очистить снапшоты
   */
  public clear(): void {
    this.snapshots = [];
  }
}
