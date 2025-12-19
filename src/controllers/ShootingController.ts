// src/controllers/ShootingController.ts

import Phaser from 'phaser';
import { SHOOTING } from '../constants/gameConstants';
import { Cap } from '../entities/Cap';
import { PlayerNumber } from '../types';

export class ShootingController {
  private scene: Phaser.Scene;
  private isDragging = false;
  private selectedCap: Cap | null = null;
  private dragStartPoint: Phaser.Math.Vector2 | null = null;
  private aimGraphics: Phaser.GameObjects.Graphics;
  private currentPlayer: PlayerNumber = 1;
  private onShootCallback: ((cap: Cap) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.aimGraphics = scene.add.graphics().setDepth(100);
    this.setupInput();
  }

  setCurrentPlayer(player: PlayerNumber): void {
    this.currentPlayer = player;
  }

  getCurrentPlayer(): PlayerNumber {
    return this.currentPlayer;
  }

  onShoot(callback: (cap: Cap) => void): void {
    this.onShootCallback = callback;
  }

  setEnabled(enabled: boolean): void {
    if (!enabled) this.cancelDrag();
  }

  registerCap(cap: Cap): void {
    cap.sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.onPointerDown(pointer, cap);
    });
  }

  private setupInput(): void {
    this.scene.input.on('pointermove', this.onPointerMove, this);
    this.scene.input.on('pointerup', this.onPointerUp, this);
    this.scene.input.on('pointerupoutside', this.onPointerUp, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer, cap: Cap): void {
    if (cap.owner !== this.currentPlayer) return;

    this.isDragging = true;
    this.selectedCap = cap;
    this.dragStartPoint = new Phaser.Math.Vector2(pointer.x, pointer.y);
    cap.highlight(true);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isDragging || !this.selectedCap || !this.dragStartPoint) return;

    const dragVector = new Phaser.Math.Vector2(
      pointer.x - this.dragStartPoint.x,
      pointer.y - this.dragStartPoint.y
    );

    const distance = Math.min(dragVector.length(), SHOOTING.MAX_DRAG_DISTANCE);
    dragVector.normalize().scale(distance);

    this.drawAimLine(dragVector, distance);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.isDragging || !this.selectedCap || !this.dragStartPoint) return;

    const dragVector = new Phaser.Math.Vector2(
      pointer.x - this.dragStartPoint.x,
      pointer.y - this.dragStartPoint.y
    );

    const distance = Math.min(dragVector.length(), SHOOTING.MAX_DRAG_DISTANCE);

    if (distance < 10) {
      this.cancelDrag();
      return;
    }

    const force = this.selectedCap.calculateShotForce(distance, dragVector.normalize());
    this.selectedCap.applyForce(force.x, force.y);

    this.onShootCallback?.(this.selectedCap);
    this.finishDrag();
  }

  private drawAimLine(dragVector: Phaser.Math.Vector2, distance: number): void {
    const cap = this.selectedCap;
    if (!cap) return;

    const { x: capX, y: capY } = cap.body.position;
    this.aimGraphics.clear();

    const aimDirection = dragVector.clone().normalize().negate();
    const aimLength = distance * 1.5 * cap.getAimLineLength();

    this.aimGraphics.lineStyle(SHOOTING.AIM_LINE_WIDTH, SHOOTING.AIM_LINE_COLOR, SHOOTING.AIM_LINE_ALPHA);
    this.aimGraphics.lineBetween(capX, capY, capX + aimDirection.x * aimLength, capY + aimDirection.y * aimLength);

    this.drawTrajectoryDots(capX, capY, aimDirection);

    // ИСПРАВЛЕНО: используем правильный формат для интерполяции цвета
    const powerRatio = distance / SHOOTING.MAX_DRAG_DISTANCE;
    
    // Интерполяция от зелёного к красному
    const r = Math.floor(100 + (255 - 100) * powerRatio);
    const g = Math.floor(255 + (50 - 255) * powerRatio);
    const b = Math.floor(100 + (50 - 100) * powerRatio);
    
    const color = Phaser.Display.Color.GetColor(r, g, b);

    this.aimGraphics.lineStyle(4, color, 0.8);
    this.aimGraphics.strokeCircle(capX, capY, cap.getRadius() + 8);
  }

  private drawTrajectoryDots(startX: number, startY: number, direction: Phaser.Math.Vector2): void {
    this.aimGraphics.fillStyle(SHOOTING.TRAJECTORY_DOTS_COLOR, SHOOTING.TRAJECTORY_DOTS_ALPHA);

    for (let i = 1; i <= SHOOTING.TRAJECTORY_DOTS_COUNT; i++) {
      const dist = i * 20;
      const radius = Math.max(SHOOTING.TRAJECTORY_DOT_RADIUS * (1 - i / 15), 2);
      this.aimGraphics.fillCircle(startX + direction.x * dist, startY + direction.y * dist, radius);
    }
  }

  private cancelDrag(): void {
    this.selectedCap?.highlight(false);
    this.resetDragState();
  }

  private finishDrag(): void {
    this.selectedCap?.highlight(false);
    this.resetDragState();
  }

  private resetDragState(): void {
    this.isDragging = false;
    this.selectedCap = null;
    this.dragStartPoint = null;
    this.aimGraphics.clear();
  }

  destroy(): void {
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointerupoutside', this.onPointerUp, this);
    this.aimGraphics.destroy();
  }
}