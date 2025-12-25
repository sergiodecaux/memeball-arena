// src/controllers/ShootingController.ts

import Phaser from 'phaser';
import { SHOOTING, CapClass } from '../constants/gameConstants';
import { Cap } from '../entities/Cap';
import { Unit } from '../entities/Unit';
import { PlayerNumber } from '../types';

interface IShootableUnit {
  body: MatterJS.BodyType;
  sprite: Phaser.GameObjects.Container;
  readonly owner: PlayerNumber;
  readonly id: string;
  
  getCapClass(): CapClass;
  getRadius(): number;
  getAimLineLength(): number;
  getCurveStrength(): number;
  
  highlight(enabled: boolean): void;
  setLastHitOffset(offset: number): void;
  applyForce(forceX: number, forceY: number): void;
  calculateShotForce(dragDistance: number, direction: Phaser.Math.Vector2): Phaser.Math.Vector2;
}

export type ShootableUnit = Cap | Unit;

export interface ShootEventData {
  cap: ShootableUnit;
  velocity: { x: number; y: number };
  localCapIndex: number;
  hitOffset?: number;
}

export class ShootingController {
  private scene: Phaser.Scene;

  private currentPlayer: PlayerNumber = 1;
  private isEnabled = true;
  private isPvPMode = false;
  private isHost = true;

  private registeredCaps: Map<ShootableUnit, number> = new Map();
  private selectedCap: ShootableUnit | null = null;

  private dragStartPos: Phaser.Math.Vector2 | null = null;
  private isAiming = false;
  private currentHitOffset = 0;

  private aimGraphics: Phaser.GameObjects.Graphics;
  private joystickGraphics: Phaser.GameObjects.Graphics;

  private onShootCallback: ((data: ShootEventData) => void) | null = null;
  private onCapSelectedCallback: ((cap: ShootableUnit | null) => void) | null = null;

  private pendingShot: { cap: ShootableUnit; localIndex: number; hitOffset: number } | null = null;
  private hasFiredThisTurn = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.aimGraphics = scene.add.graphics().setDepth(100);
    this.joystickGraphics = scene.add.graphics().setDepth(99);

    this.setupInput();
    this.scene.matter.world.on('afterupdate', this.onPhysicsUpdate, this);
  }

  setPvPMode(isPvP: boolean, isHost: boolean): void {
    this.isPvPMode = isPvP;
    this.isHost = isHost;
  }

  setCurrentPlayer(player: PlayerNumber): void {
    this.currentPlayer = player;
    if (this.selectedCap) {
      this.selectedCap.highlight(false);
      this.selectedCap = null;
      this.notifyCapSelected(null);
    }
  }

  getCurrentPlayer(): PlayerNumber {
    return this.currentPlayer;
  }

  onShoot(callback: (data: ShootEventData) => void): void {
    this.onShootCallback = callback;
  }

  onCapSelected(callback: (cap: ShootableUnit | null) => void): void {
    this.onCapSelectedCallback = callback;
  }

  private notifyCapSelected(cap: ShootableUnit | null): void {
    this.onCapSelectedCallback?.(cap);
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.clearAimingState();
      if (this.selectedCap) {
        this.selectedCap.highlight(false);
        this.selectedCap = null;
        this.notifyCapSelected(null);
      }
    } else {
      this.hasFiredThisTurn = false;
    }
  }

  getEnabled(): boolean {
    return this.isEnabled;
  }

  registerCap(cap: ShootableUnit, localIndex: number): void {
    this.registeredCaps.set(cap, localIndex);

    cap.sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.onCapPointerDown(pointer, cap);
    });
  }

  getCapIndex(cap: ShootableUnit): number {
    return this.registeredCaps.get(cap) ?? -1;
  }

  getSelectedCap(): ShootableUnit | null {
    return this.selectedCap;
  }

  private setupInput(): void {
    const input = this.scene.input;
    input.on('pointerdown', this.onPointerDown, this);
    input.on('pointermove', this.onPointerMove, this);
    input.on('pointerup', this.onPointerUp, this);
    input.on('pointerupoutside', this.onPointerUp, this);
  }

  private onCapPointerDown(pointer: Phaser.Input.Pointer, cap: ShootableUnit): void {
    if (!this.isEnabled) return;
    if (this.hasFiredThisTurn) return;
    if (cap.owner !== this.currentPlayer) return;
    if (!this.registeredCaps.has(cap)) return;

    if (this.selectedCap && this.selectedCap !== cap) {
      this.selectedCap.highlight(false);
    }

    const wasSelected = this.selectedCap === cap;
    this.selectedCap = cap;
    this.selectedCap.highlight(true);

    if (!wasSelected) {
      this.notifyCapSelected(cap);
    }

    try {
      const webApp = (window as any).Telegram?.WebApp;
      webApp?.HapticFeedback?.selectionChanged?.();
    } catch {}
  }

  private onPointerDown(pointer: Phaser.Input.Pointer, gameObjects: any[]): void {
    if (!this.isEnabled || this.hasFiredThisTurn) return;

    if (this.selectedCap) {
      this.isAiming = true;
      this.dragStartPos = new Phaser.Math.Vector2(pointer.x, pointer.y);
      this.currentHitOffset = 0;
      this.aimGraphics.clear();
      this.joystickGraphics.clear();
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isEnabled || !this.isAiming || !this.selectedCap || !this.dragStartPos) return;

    const cap = this.selectedCap;
    const dragVec = new Phaser.Math.Vector2(pointer.x - this.dragStartPos.x, pointer.y - this.dragStartPos.y);
    let dist = dragVec.length();

    if (dist < 5) {
      this.aimGraphics.clear();
      this.joystickGraphics.clear();
      return;
    }

    if (dist > SHOOTING.MAX_DRAG_DISTANCE) {
      dragVec.scale(SHOOTING.MAX_DRAG_DISTANCE / dist);
      dist = SHOOTING.MAX_DRAG_DISTANCE;
    }

    this.currentHitOffset = this.calculateHitOffset(pointer, dragVec);
    this.drawAim(cap, dragVec, dist);
    this.drawVirtualJoystick(dragVec, dist, pointer);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.isEnabled || !this.isAiming || !this.selectedCap || !this.dragStartPos) {
      this.clearAimingState();
      return;
    }
    if (this.hasFiredThisTurn) {
      this.clearAimingState();
      return;
    }

    const cap = this.selectedCap;
    const dragVec = new Phaser.Math.Vector2(pointer.x - this.dragStartPos.x, pointer.y - this.dragStartPos.y);
    let dist = dragVec.length();

    this.aimGraphics.clear();
    this.joystickGraphics.clear();

    if (dist < 10) {
      this.isAiming = false;
      this.dragStartPos = null;
      return;
    }

    if (dist > SHOOTING.MAX_DRAG_DISTANCE) {
      dragVec.scale(SHOOTING.MAX_DRAG_DISTANCE / dist);
      dist = SHOOTING.MAX_DRAG_DISTANCE;
    }

    const localIndex = this.getCapIndex(cap);
    const hitOffset = this.currentHitOffset;

    const force = cap.calculateShotForce(dist, dragVec.normalize());

    cap.setLastHitOffset(hitOffset);
    cap.applyForce(force.x, force.y);

    this.hasFiredThisTurn = true;

    this.pendingShot = {
      cap,
      localIndex,
      hitOffset,
    };

    cap.highlight(false);
    this.selectedCap = null;
    this.notifyCapSelected(null);
    
    this.isAiming = false;
    this.dragStartPos = null;

    try {
      const webApp = (window as any).Telegram?.WebApp;
      webApp?.HapticFeedback?.impactOccurred?.('heavy');
    } catch {}
    this.scene.cameras.main.shake(80, 0.002 * (dist / SHOOTING.MAX_DRAG_DISTANCE));
  }

  private onPhysicsUpdate = (): void => {
    if (!this.pendingShot) return;
    const { cap, localIndex, hitOffset } = this.pendingShot;

    const velocity = {
      x: cap.body.velocity.x,
      y: cap.body.velocity.y,
    };

    this.onShootCallback?.({
      cap,
      velocity,
      localCapIndex: localIndex,
      hitOffset,
    });

    this.pendingShot = null;
  };

  private drawAim(cap: ShootableUnit, dragVec: Phaser.Math.Vector2, dist: number): void {
    this.aimGraphics.clear();

    const capPos = cap.body.position;
    const dir = dragVec.clone().normalize().negate();

    const isTrickster = cap.getCapClass() === 'trickster';
    const hitOffset = this.currentHitOffset;

    const baseLength = dist * 1.5;
    const aimLength = baseLength * cap.getAimLineLength();

    if (isTrickster && Math.abs(hitOffset) > 0.1) {
      this.drawCurvedAimLine(capPos.x, capPos.y, dir, aimLength, hitOffset, cap);
    } else {
      this.aimGraphics.lineStyle(
        SHOOTING.AIM_LINE_WIDTH,
        SHOOTING.AIM_LINE_COLOR,
        SHOOTING.AIM_LINE_ALPHA
      );
      this.aimGraphics.lineBetween(
        capPos.x,
        capPos.y,
        capPos.x + dir.x * aimLength,
        capPos.y + dir.y * aimLength
      );
      this.drawTrajectoryDots(capPos.x, capPos.y, dir);
    }

    const powerRatio = dist / SHOOTING.MAX_DRAG_DISTANCE;
    const r = Math.floor(100 + 155 * powerRatio);
    const g = Math.floor(255 - 205 * powerRatio);
    const b = Math.floor(100 - 50 * powerRatio);
    const color = Phaser.Display.Color.GetColor(r, g, b);

    this.aimGraphics.lineStyle(4, color, 0.8);
    this.aimGraphics.strokeCircle(capPos.x, capPos.y, cap.getRadius() + 8);

    if (isTrickster && Math.abs(hitOffset) > 0.1) {
      this.drawCurveIndicator(capPos.x, capPos.y, cap.getRadius(), hitOffset);
    }
  }

  private drawVirtualJoystick(dragVec: Phaser.Math.Vector2, dist: number, pointer: Phaser.Input.Pointer): void {
    if (!this.dragStartPos) return;

    this.joystickGraphics.clear();

    const startX = this.dragStartPos.x;
    const startY = this.dragStartPos.y;

    this.joystickGraphics.lineStyle(2, 0xffffff, 0.2);
    this.joystickGraphics.strokeCircle(startX, startY, SHOOTING.MAX_DRAG_DISTANCE);

    this.joystickGraphics.lineStyle(2, 0xffffff, 0.4);
    this.joystickGraphics.lineBetween(startX, startY, pointer.x, pointer.y);

    this.joystickGraphics.fillStyle(0xffffff, 0.4);
    this.joystickGraphics.fillCircle(pointer.x, pointer.y, 13);
  }

  private drawTrajectoryDots(startX: number, startY: number, direction: Phaser.Math.Vector2): void {
    this.aimGraphics.fillStyle(
      SHOOTING.TRAJECTORY_DOTS_COLOR,
      SHOOTING.TRAJECTORY_DOTS_ALPHA
    );

    for (let i = 1; i <= SHOOTING.TRAJECTORY_DOTS_COUNT; i++) {
      const dist = i * 20;
      const radius = Math.max(SHOOTING.TRAJECTORY_DOT_RADIUS * (1 - i / 15), 2);
      this.aimGraphics.fillCircle(
        startX + direction.x * dist,
        startY + direction.y * dist,
        radius
      );
    }
  }

  // === ⭐ УСИЛЕННАЯ ВИЗУАЛИЗАЦИЯ КРИВЫХ ===
  private drawCurvedAimLine(
    startX: number,
    startY: number,
    direction: Phaser.Math.Vector2,
    length: number,
    curveAmount: number,
    cap: ShootableUnit
  ): void {
    const curveStrength = cap.getCurveStrength();
    const perpendicular = new Phaser.Math.Vector2(-direction.y, direction.x);

    // было 0.5 → стало 0.65 для более заметной кривой
    const controlOffset = curveAmount * curveStrength * length * 0.65;
    const controlX = startX + direction.x * length * 0.5 + perpendicular.x * controlOffset;
    const controlY = startY + direction.y * length * 0.5 + perpendicular.y * controlOffset;

    const endX = startX + direction.x * length;
    const endY = startY + direction.y * length;

    this.aimGraphics.lineStyle(SHOOTING.AIM_LINE_WIDTH, 0x9333ea, SHOOTING.AIM_LINE_ALPHA);

    const points: { x: number; y: number }[] = [];
    const segments = 20;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = Math.pow(1 - t, 2) * startX + 2 * (1 - t) * t * controlX + Math.pow(t, 2) * endX;
      const y = Math.pow(1 - t, 2) * startY + 2 * (1 - t) * t * controlY + Math.pow(t, 2) * endY;
      points.push({ x, y });
    }

    this.aimGraphics.beginPath();
    this.aimGraphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.aimGraphics.lineTo(points[i].x, points[i].y);
    }
    this.aimGraphics.strokePath();

    this.aimGraphics.fillStyle(0x9333ea, SHOOTING.TRAJECTORY_DOTS_ALPHA);
    for (let i = 1; i <= SHOOTING.TRAJECTORY_DOTS_COUNT; i++) {
      const t = i / (SHOOTING.TRAJECTORY_DOTS_COUNT + 1);
      const x = Math.pow(1 - t, 2) * startX + 2 * (1 - t) * t * controlX + Math.pow(t, 2) * endX;
      const y = Math.pow(1 - t, 2) * startY + 2 * (1 - t) * t * controlY + Math.pow(t, 2) * endY;
      const radius = Math.max(SHOOTING.TRAJECTORY_DOT_RADIUS * (1 - i / 15), 2);
      this.aimGraphics.fillCircle(x, y, radius);
    }
  }

  private drawCurveIndicator(capX: number, capY: number, radius: number, curveAmount: number): void {
    const indicatorRadius = radius + 15;
    const angle = curveAmount > 0 ? -Math.PI / 2 : Math.PI / 2;
    const arcStart = angle - Math.abs(curveAmount) * (Math.PI / 4);
    const arcEnd = angle + Math.abs(curveAmount) * (Math.PI / 4);

    this.aimGraphics.lineStyle(3, 0x9333ea, 0.8);
    this.aimGraphics.beginPath();
    this.aimGraphics.arc(capX, capY, indicatorRadius, arcStart, arcEnd, curveAmount < 0);
    this.aimGraphics.strokePath();

    const arrowTip = {
      x: capX + Math.cos(arcEnd) * indicatorRadius,
      y: capY + Math.sin(arcEnd) * indicatorRadius,
    };
    const arrowAngle = arcEnd + (curveAmount > 0 ? Math.PI / 2 : -Math.PI / 2);

    this.aimGraphics.fillStyle(0x9333ea, 0.8);
    this.aimGraphics.fillTriangle(
      arrowTip.x,
      arrowTip.y,
      arrowTip.x + Math.cos(arrowAngle - 0.5) * 8,
      arrowTip.y + Math.sin(arrowAngle - 0.5) * 8,
      arrowTip.x + Math.cos(arrowAngle + 0.5) * 8,
      arrowTip.y + Math.sin(arrowAngle + 0.5) * 8
    );
  }

  private calculateHitOffset(pointer: Phaser.Input.Pointer, dragVec: Phaser.Math.Vector2): number {
    if (!this.selectedCap || !this.dragStartPos) return 0;
    if (this.selectedCap.getCapClass() !== 'trickster') return 0;

    const capPos = this.selectedCap.body.position;
    if (dragVec.length() < 20) return 0;

    const perpendicular = new Phaser.Math.Vector2(-dragVec.y, dragVec.x).normalize();
    const pointerOffset = new Phaser.Math.Vector2(pointer.x - capPos.x, pointer.y - capPos.y);

    const lateralOffset = pointerOffset.dot(perpendicular);
    return Phaser.Math.Clamp(lateralOffset / 50, -1, 1);
  }

  private clearAimingState(): void {
    this.isAiming = false;
    this.dragStartPos = null;
    this.currentHitOffset = 0;
    this.aimGraphics.clear();
    this.joystickGraphics.clear();
  }

  destroy(): void {
    const input = this.scene.input;
    input.off('pointerdown', this.onPointerDown, this);
    input.off('pointermove', this.onPointerMove, this);
    input.off('pointerup', this.onPointerUp, this);
    input.off('pointerupoutside', this.onPointerUp, this);

    this.scene.matter.world.off('afterupdate', this.onPhysicsUpdate, this);

    this.aimGraphics.destroy();
    this.joystickGraphics.destroy();
    this.registeredCaps.clear();
  }
}