// src/controllers/ShootingController.ts

import Phaser from 'phaser';
import { SHOOTING } from '../constants/gameConstants';
import { Cap } from '../entities/Cap';
import { PlayerNumber } from '../types';

export interface ShootEventData {
  cap: Cap;
  velocity: { x: number; y: number };
  localCapIndex: number;
}

export class ShootingController {
  private scene: Phaser.Scene;
  private isDragging = false;
  private selectedCap: Cap | null = null;
  private dragStartPoint: Phaser.Math.Vector2 | null = null;
  private aimGraphics: Phaser.GameObjects.Graphics;
  private currentPlayer: PlayerNumber = 1;
  private onShootCallback: ((data: ShootEventData) => void) | null = null;
  
  private isEnabled = true;
  private isPvPMode = false;
  private isHost = true;
  
  // Map от Cap к ЛОКАЛЬНОМУ индексу (0,1,2 для своих фишек)
  private registeredCaps: Map<Cap, number> = new Map();
  
  private pendingShot: { cap: Cap; localIndex: number } | null = null;
  
  // Флаг чтобы предотвратить повторные выстрелы
  private hasFiredThisTurn = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.aimGraphics = scene.add.graphics().setDepth(100);
    this.setupInput();
    
    this.scene.matter.world.on('afterupdate', this.onPhysicsUpdate, this);
  }

  setPvPMode(isPvP: boolean, isHost: boolean): void {
    this.isPvPMode = isPvP;
    this.isHost = isHost;
    console.log('[ShootingController] PvP mode:', isPvP, 'isHost:', isHost);
  }

  /**
   * Устанавливает текущего игрока (owner команды, чей сейчас ход)
   * В PvP: 1 = Host team, 2 = Guest team
   */
  setCurrentPlayer(player: PlayerNumber): void {
    this.currentPlayer = player;
    console.log('[ShootingController] Current player set to:', player);
  }

  getCurrentPlayer(): PlayerNumber {
    return this.currentPlayer;
  }

  onShoot(callback: (data: ShootEventData) => void): void {
    this.onShootCallback = callback;
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.cancelDrag();
    } else {
      // При включении сбрасываем флаг выстрела
      this.hasFiredThisTurn = false;
    }
    console.log('[ShootingController] setEnabled:', enabled);
  }
  
  getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Регистрирует фишку для управления
   * @param cap - фишка
   * @param localIndex - локальный индекс (0, 1, 2 для своих фишек)
   */
  registerCap(cap: Cap, localIndex: number): void {
    this.registeredCaps.set(cap, localIndex);
    console.log('[ShootingController] Registered cap:', cap.id, 'owner:', cap.owner, 'localIndex:', localIndex);
    
    cap.sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.onPointerDown(pointer, cap);
    });
  }

  getCapIndex(cap: Cap): number {
    return this.registeredCaps.get(cap) ?? -1;
  }

  private setupInput(): void {
    this.scene.input.on('pointermove', this.onPointerMove, this);
    this.scene.input.on('pointerup', this.onPointerUp, this);
    this.scene.input.on('pointerupoutside', this.onPointerUp, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer, cap: Cap): void {
    // Проверяем все условия
    if (!this.isEnabled) {
      console.log('[ShootingController] Disabled, ignoring click on:', cap.id);
      return;
    }
    
    if (this.isDragging) {
      console.log('[ShootingController] Already dragging, ignoring');
      return;
    }
    
    if (this.hasFiredThisTurn) {
      console.log('[ShootingController] Already fired this turn, ignoring');
      return;
    }
    
    // Проверяем что это фишка текущей команды
    if (cap.owner !== this.currentPlayer) {
      console.log('[ShootingController] Not current player cap - cap.owner:', cap.owner, 'currentPlayer:', this.currentPlayer);
      return;
    }
    
    // Проверяем что это зарегистрированная (своя) фишка
    if (!this.registeredCaps.has(cap)) {
      console.log('[ShootingController] Cap not registered (not mine):', cap.id);
      return;
    }

    this.isDragging = true;
    this.selectedCap = cap;
    this.dragStartPoint = new Phaser.Math.Vector2(pointer.x, pointer.y);
    cap.highlight(true);
    
    console.log('[ShootingController] Started dragging:', cap.id, 'owner:', cap.owner);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isDragging || !this.selectedCap || !this.dragStartPoint) return;
    
    if (!this.isEnabled) {
      this.cancelDrag();
      return;
    }

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
    
    if (!this.isEnabled || this.hasFiredThisTurn) {
      this.cancelDrag();
      return;
    }

    const dragVector = new Phaser.Math.Vector2(
      pointer.x - this.dragStartPoint.x,
      pointer.y - this.dragStartPoint.y
    );

    const distance = Math.min(dragVector.length(), SHOOTING.MAX_DRAG_DISTANCE);

    if (distance < 10) {
      this.cancelDrag();
      return;
    }

    const cap = this.selectedCap;
    const localIndex = this.getCapIndex(cap);
    
    // Помечаем что уже выстрелили
    this.hasFiredThisTurn = true;
    
    const force = cap.calculateShotForce(distance, dragVector.normalize());
    
    console.log('[ShootingController] Applying force to:', cap.id, 'force:', force, 'distance:', distance);
    
    cap.applyForce(force.x, force.y);
    
    this.pendingShot = {
      cap,
      localIndex
    };

    this.finishDrag();
  }

  private onPhysicsUpdate = (): void => {
    if (!this.pendingShot) return;
    
    const { cap, localIndex } = this.pendingShot;
    
    const velocity = {
      x: cap.body.velocity.x,
      y: cap.body.velocity.y
    };
    
    console.log('[ShootingController] Shot complete - cap:', cap.id, 'localIndex:', localIndex, 'velocity:', velocity);
    
    this.onShootCallback?.({
      cap,
      velocity,
      localCapIndex: localIndex
    });
    
    this.pendingShot = null;
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

    const powerRatio = distance / SHOOTING.MAX_DRAG_DISTANCE;
    const r = Math.floor(100 + 155 * powerRatio);
    const g = Math.floor(255 - 205 * powerRatio);
    const b = Math.floor(100 - 50 * powerRatio);
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
    this.scene.matter.world.off('afterupdate', this.onPhysicsUpdate, this);
    this.aimGraphics.destroy();
    this.registeredCaps.clear();
  }
}