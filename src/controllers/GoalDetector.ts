// src/controllers/GoalDetector.ts

import Phaser from 'phaser';
import { GOAL } from '../constants/gameConstants';
import { FieldBounds, PlayerNumber } from '../types';
import { Ball } from '../entities/Ball';
import { Cap } from '../entities/Cap';

interface Zone {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export class GoalDetector {
  private scene: Phaser.Scene;
  private ball: Ball;
  private caps: Cap[] = [];
  private capStartPositions = new Map<string, { x: number; y: number }>();
  
  private topGoalZone!: Zone;
  private bottomGoalZone!: Zone;
  private goalScored = false;
  
  private onGoalCallback?: (scoringPlayer: PlayerNumber) => void;

  private static readonly STOP_THRESHOLD = 0.3;

  constructor(
    scene: Phaser.Scene,
    ball: Ball,
    fieldBounds: FieldBounds,
    fieldScale: number
  ) {
    this.scene = scene;
    this.ball = ball;
    this.calculateGoalZones(fieldBounds, fieldScale);
  }

  setCaps(caps: Cap[], startPositions: { x: number; y: number }[]): void {
    this.caps = caps;
    this.capStartPositions.clear();
    
    caps.forEach((cap, i) => {
      if (startPositions[i]) {
        this.capStartPositions.set(cap.id, startPositions[i]);
      }
    });
  }

  private calculateGoalZones(bounds: FieldBounds, scale: number): void {
    const halfWidth = (GOAL.WIDTH * scale) / 2;
    const depth = GOAL.DEPTH * scale;
    
    this.topGoalZone = {
      minX: bounds.centerX - halfWidth,
      maxX: bounds.centerX + halfWidth,
      minY: bounds.top - depth,
      maxY: bounds.top,
    };
    
    this.bottomGoalZone = {
      minX: bounds.centerX - halfWidth,
      maxX: bounds.centerX + halfWidth,
      minY: bounds.bottom,
      maxY: bounds.bottom + depth,
    };
  }

  update(): void {
    this.checkCapsInGoal();
    
    if (this.goalScored) return;
    
    const { x, y } = this.ball.body.position;
    
    if (this.isInZone(x, y, this.topGoalZone)) {
      this.triggerGoal(1);
    } else if (this.isInZone(x, y, this.bottomGoalZone)) {
      this.triggerGoal(2);
    }
  }

  private checkCapsInGoal(): void {
    for (const cap of this.caps) {
      if (cap.capClass === 'tank') continue;
      
      const { x, y } = cap.body.position;
      const inGoal = this.isInZone(x, y, this.topGoalZone) || 
                     this.isInZone(x, y, this.bottomGoalZone);
      
      if (inGoal && cap.isStopped(GoalDetector.STOP_THRESHOLD)) {
        this.teleportCapToSpawn(cap);
      }
    }
  }

  private teleportCapToSpawn(cap: Cap): void {
    const startPos = this.capStartPositions.get(cap.id);
    if (!startPos) return;
    
    const { x: oldX, y: oldY } = cap.body.position;
    
    // Эффекты
    this.createTeleportEffect(oldX, oldY, 0xff4444, true);  // Disappear
    this.createTeleportEffect(startPos.x, startPos.y, 0x44ff44, false); // Appear
    
    // Телепорт
    cap.reset(startPos.x, startPos.y);
  }

  private createTeleportEffect(x: number, y: number, color: number, shrink: boolean): void {
    const ring = this.scene.add.circle(x, y, shrink ? 35 : 15, 0x000000, 0)
      .setStrokeStyle(3, color)
      .setDepth(100);
    
    this.scene.tweens.add({
      targets: ring,
      scale: shrink ? 0 : 2.5,
      alpha: 0,
      duration: shrink ? 250 : 400,
      ease: 'Power2',
      onComplete: () => ring.destroy(),
    });
    
    // Flash только при появлении
    if (!shrink) {
      const flash = this.scene.add.circle(x, y, 40, 0xffff00, 0.8).setDepth(100);
      this.scene.tweens.add({
        targets: flash,
        alpha: 0,
        scale: 1.5,
        duration: 300,
        ease: 'Power2',
        onComplete: () => flash.destroy(),
      });
    }
  }

  private isInZone(x: number, y: number, zone: Zone): boolean {
    return x >= zone.minX && x <= zone.maxX && y >= zone.minY && y <= zone.maxY;
  }

  private triggerGoal(scoringPlayer: PlayerNumber): void {
    if (this.goalScored) return;
    
    this.goalScored = true;
    this.onGoalCallback?.(scoringPlayer);
  }

  reset(): void {
    this.goalScored = false;
  }

  onGoal(callback: (scoringPlayer: PlayerNumber) => void): void {
    this.onGoalCallback = callback;
  }
}