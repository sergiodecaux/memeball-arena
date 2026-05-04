// 🎯 SCI-FI TACTICAL CONTROLLER WITH ABILITY SUPPORT

import Phaser from 'phaser';
import {
  SHOOTING,
  CapClass,
  FACTIONS,
  FactionId,
  ABILITY_CONFIG,
  MAX_ACCURACY_SPREAD,
  TANK_ZONE_BONUS,
} from '../constants/gameConstants';
import { Cap } from '../entities/Cap';
import { Unit } from '../entities/Unit';
import { PlayerNumber } from '../types';
import { getUnitById, getUnitAccuracy, getUnitPhysicsModifier } from '../data/UnitsRepository';
import { PassiveManager } from '../systems/PassiveManager';

// === EXPORTED INTERFACES ===

export interface IShootableUnit {
  body: MatterJS.BodyType;
  sprite: Phaser.GameObjects.Container;
  readonly owner: PlayerNumber;
  readonly id: string;
  
  getCapClass(): CapClass;
  getRadius(): number;
  getAimLineLength(): number;
  getCurveStrength(): number;
  getFactionId?(): FactionId;
  
  highlight(enabled: boolean): void;
  setLastHitOffset(offset: number): void;
  applyForce(forceX: number, forceY: number): void;
  calculateShotForce(dragDistance: number, direction: Phaser.Math.Vector2): Phaser.Math.Vector2;
  
  // 🧬 Ability methods (optional)
  isStunned?(): boolean;
  canPerformSwap?(): boolean;
  teleportTo?(x: number, y: number): void;
  setAbilityCooldown?(turns: number): void;
}

export type ShootableUnit = Cap | Unit;

export interface ShootEventData {
  cap: ShootableUnit;
  velocity: { x: number; y: number };
  localCapIndex: number;
  hitOffset?: number;
  isSwap?: boolean;
}

// === TYPE GUARDS ===

function isUnit(cap: ShootableUnit): cap is Unit {
  return cap instanceof Unit;
}

function hasFactionId(cap: ShootableUnit): cap is ShootableUnit & { getFactionId(): FactionId } {
  return typeof (cap as any).getFactionId === 'function';
}

function hasAbilityMethods(cap: ShootableUnit): cap is Unit {
  return (
    typeof (cap as any).isStunned === 'function' &&
    typeof (cap as any).canPerformSwap === 'function'
  );
}

// === CONFIG ===
const CONTROL_CONFIG = {
  WALL_BUFFER: 60,
  MIN_DRAG_DISTANCE: 15,
  SHORT_TAP_DURATION: 200,
  
  VISUALS: {
    TRAJECTORY_POINTS: 8,
    POWER_BAR_WIDTH: 24,
    POWER_BAR_HEIGHT: 180,
  },
  
  SNIPER: {
    JOYSTICK_RADIUS: 140,
    SENSITIVITY: 1.0,
  }
};

export class ShootingController {
  private scene: Phaser.Scene;

  private currentPlayer: PlayerNumber = 1;
  private isEnabled = true;
  private isPvPMode = false;
  private isHost = true;

  private registeredCaps: Map<ShootableUnit, number> = new Map();
  private selectedCap: ShootableUnit | null = null;

  // Input State
  private dragStartPos: Phaser.Math.Vector2 | null = null;
  private isAiming = false;
  private currentHitOffset = 0;

  private pointerDownTime: number = 0;
  private pointerDownPos: Phaser.Math.Vector2 | null = null;

  // === VISUALS ===
  private trajectoryGraphics: Phaser.GameObjects.Graphics;
  private reticleGraphics: Phaser.GameObjects.Graphics;
  private endMarker: Phaser.GameObjects.Arc;
  private joystickGraphics: Phaser.GameObjects.Graphics;
  private powerBar: Phaser.GameObjects.Container;
  private tutorialZoneGraphics: Phaser.GameObjects.Graphics;

  // 🧬 Void Swap визуал
  private swapTargetIndicator?: Phaser.GameObjects.Graphics;
  private swapLineGraphics?: Phaser.GameObjects.Graphics;
  private legacyVoidSwapEnabled = false; // ✅ Task 1: Legacy swap disabled by default

  // Animation State
  private dashOffset: number = 0;
  private aimLoopEvent?: Phaser.Time.TimerEvent;

  // Callbacks
  private onShootCallback: ((data: ShootEventData) => void) | null = null;
  private onCapSelectedCallback: ((cap: ShootableUnit | null) => void) | null = null;
  private onSwapCallback: ((unitA: ShootableUnit, unitB: ShootableUnit) => void) | null = null;
  // ✅ PVP: Callback для отправки удара на сервер
  private onPvPShotCallback: ((unitId: string, velocity: { x: number; y: number }) => void) | null = null;
  
  // ✅ Passive System
  private passiveManager: PassiveManager | null = null;

  private captainTrajectoryHooks: {
    getDistanceMultiplier(): number;
    shouldAlwaysDrawSecondBounce(): boolean;
  } | null = null;
  private captainShotForceScale: ((cap: ShootableUnit) => number) | null = null;
  private captainSelectionFilter: ((cap: ShootableUnit) => boolean) | null = null;

  private isLassoActiveCheck: () => boolean = () => false;

  private pendingShot: { cap: ShootableUnit; localIndex: number; hitOffset: number } | null = null;
  private hasFiredThisTurn = false;

  private isNearWall: { near: boolean; side: string | null } = { near: false, side: null };

  // ═══════════════════════════════════════════════════════════════
  // TUTORIAL SYSTEM
  // ═══════════════════════════════════════════════════════════════

  /** ID юнита, который разрешено выбирать (null = любой) */
  private tutorialAllowedUnitId: string | null = null;

  /** Целевая зона для удара */
  private tutorialTargetZone: { x: number; y: number; radius: number } | null = null;

  /** Callback при выборе правильного юнита */
  private tutorialOnUnitSelected: ((unitId: string) => void) | null = null;

  /** Callback при выполнении удара */
  private tutorialOnShotExecuted: (() => void) | null = null;

  /** Режим обучения активен */
  private isTutorialMode: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    this.reticleGraphics = scene.add.graphics().setDepth(50);
    this.trajectoryGraphics = scene.add.graphics().setDepth(51);
    this.endMarker = scene.add.circle(0, 0, 6, 0xffffff).setDepth(52).setVisible(false);
    
    this.joystickGraphics = scene.add.graphics().setDepth(100);
    this.powerBar = this.createPowerBar();
    this.tutorialZoneGraphics = scene.add.graphics().setDepth(49);

    // 🧬 Void Swap graphics
    this.swapTargetIndicator = scene.add.graphics().setDepth(55);
    this.swapLineGraphics = scene.add.graphics().setDepth(54);

    this.setupInput();
    this.setupAnimations();
    this.scene.matter.world.on('afterupdate', this.onPhysicsUpdate, this);
  }

  private setupAnimations(): void {
    this.aimLoopEvent = this.scene.time.addEvent({
      delay: 40,
      callback: () => {
        if (this.isAiming && this.selectedCap && this.dragStartPos) {
          this.dashOffset -= 2;
          if (this.dashOffset < 0) this.dashOffset = 20;
          
          if (this.scene.input.activePointer.isDown) {
             const pointer = this.scene.input.activePointer;
             this.updateVisuals(pointer.x, pointer.y);
          }
        } else if (this.selectedCap && !this.isAiming) {
            const pulse = 1 + Math.sin(this.scene.time.now * 0.005) * 0.05;
            this.drawSelectionReticle(this.selectedCap, pulse);
            
            // 🧬 Обновляем индикаторы Void Swap
            this.updateSwapIndicators();
        }
        
        // ✅ TUTORIAL: Постоянная отрисовка целевой зоны
        this.drawTutorialTargetZone();
      },
      loop: true
    });
  }

  // ============================================================
  // 🧬 VOID SWAP LOGIC
  // ============================================================

  /**
   * Получение factionId с безопасной проверкой типа
   */
  private getCapFactionId(cap: ShootableUnit): FactionId | undefined {
    if (isUnit(cap)) {
      return cap.getFactionId();
    }
    if (hasFactionId(cap)) {
      return cap.getFactionId();
    }
    return undefined;
  }

  /**
   * Проверка: выбран ли Void юнит, готовый к свапу
   */
  private isVoidSwapMode(): boolean {
    // ✅ Task 1: Early return if legacy swap is disabled
    if (!this.legacyVoidSwapEnabled) return false;
    
    if (!this.selectedCap) return false;
    
    const factionId = this.getCapFactionId(this.selectedCap);
    if (factionId !== 'void') return false;

    if (isUnit(this.selectedCap)) {
      return this.selectedCap.canPerformSwap();
    }

    return false;
  }

  /**
   * ✅ Task 1: Enable/disable legacy Void swap-by-tap mode
   * This should be false to prevent auto-swap. Swap should only happen via AbilityManager card ability.
   */
  public setLegacyVoidSwapEnabled(enabled: boolean): void {
    this.legacyVoidSwapEnabled = enabled;
    if (!enabled) {
      // Clear any swap visuals
      if (this.swapTargetIndicator) {
        this.swapTargetIndicator.clear();
      }
      if (this.swapLineGraphics) {
        this.swapLineGraphics.clear();
      }
    }
  }

  /**
   * Получение доступных целей для свапа (союзники)
   */
  private getSwapTargets(): ShootableUnit[] {
    if (!this.selectedCap) return [];

    const targets: ShootableUnit[] = [];
    
    for (const [cap] of this.registeredCaps) {
      if (cap === this.selectedCap) continue;
      if (cap.owner !== this.selectedCap.owner) continue;
      
      // Проверяем, что цель не застанена
      if (isUnit(cap) && cap.isStunned()) {
        continue;
      }

      targets.push(cap);
    }

    return targets;
  }

  /**
   * Обновление визуальных индикаторов для Void Swap
   */
  private updateSwapIndicators(): void {
    if (!this.swapTargetIndicator || !this.swapLineGraphics) return;

    this.swapTargetIndicator.clear();
    this.swapLineGraphics.clear();

    if (!this.isVoidSwapMode() || !this.selectedCap) return;

    const targets = this.getSwapTargets();
    const voidColor = FACTIONS.void.color;

    // Рисуем линии и индикаторы к союзникам
    targets.forEach(target => {
      const sx = this.selectedCap!.body.position.x;
      const sy = this.selectedCap!.body.position.y;
      const tx = target.body.position.x;
      const ty = target.body.position.y;

      // Пунктирная линия
      this.swapLineGraphics!.lineStyle(2, voidColor, 0.3);
      this.drawDashedLine(this.swapLineGraphics!, sx, sy, tx, ty, 10, 10);

      // Кольцо вокруг цели
      const r = target.getRadius() + 10;
      this.swapTargetIndicator!.lineStyle(2, voidColor, 0.6);
      this.swapTargetIndicator!.strokeCircle(tx, ty, r);

      // Иконка свапа
      this.swapTargetIndicator!.lineStyle(2, voidColor, 0.8);
      this.drawSwapArrows(this.swapTargetIndicator!, tx, ty, r);
    });
  }

  private drawSwapArrows(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number): void {
    const arrowSize = 8;
    
    // Левая стрелка (←)
    g.beginPath();
    g.moveTo(x - r - 5, y);
    g.lineTo(x - r - 5 - arrowSize, y - arrowSize/2);
    g.moveTo(x - r - 5, y);
    g.lineTo(x - r - 5 - arrowSize, y + arrowSize/2);
    g.strokePath();

    // Правая стрелка (→)
    g.beginPath();
    g.moveTo(x + r + 5, y);
    g.lineTo(x + r + 5 + arrowSize, y - arrowSize/2);
    g.moveTo(x + r + 5, y);
    g.lineTo(x + r + 5 + arrowSize, y + arrowSize/2);
    g.strokePath();
  }

  /**
   * Выполнение Void Swap
   */
  private executeSwap(unitA: ShootableUnit, unitB: ShootableUnit): void {
    console.log(`[ShootingController] Executing Void Swap: ${unitA.id} <-> ${unitB.id}`);

    // Вызываем callback
    this.onSwapCallback?.(unitA, unitB);

    // Отправляем событие как "выстрел" с нулевой скоростью
    this.onShootCallback?.({
      cap: unitA,
      velocity: { x: 0, y: 0 },
      localCapIndex: this.getCapIndex(unitA),
      isSwap: true,
    });

    this.hasFiredThisTurn = true;
    this.deselectCap();

    // Haptic (Vibration API для Game режима)
    try {
      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
    } catch {}
  }

  // ============================================================
  // 🔥 VISUALS
  // ============================================================

  private updateVisuals(pointerX: number, pointerY: number): void {
      if (!this.selectedCap || !this.dragStartPos) return;

      // Очищаем Swap индикаторы при прицеливании
      this.swapTargetIndicator?.clear();
      this.swapLineGraphics?.clear();

      const dx = pointerX - this.dragStartPos.x;
      const dy = pointerY - this.dragStartPos.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      dist *= CONTROL_CONFIG.SNIPER.SENSITIVITY;

      if (dist < CONTROL_CONFIG.MIN_DRAG_DISTANCE) {
          this.clearActiveVisuals();
          this.drawSelectionReticle(this.selectedCap, 1);
          return;
      }

      const maxDist = CONTROL_CONFIG.SNIPER.JOYSTICK_RADIUS;
      const rawDist = dist;
      if (dist > maxDist) dist = maxDist;

      const forcePct = dist / maxDist;
      const color = this.getGradientColor(forcePct);

      this.drawSciFiJoystick(this.dragStartPos.x, this.dragStartPos.y, dx, dy, rawDist, maxDist, color);

      const dragVector = new Phaser.Math.Vector2(dx, dy);
      const shotDir = dragVector.clone().normalize().negate();
      
      this.drawTrajectoryRaycast(this.selectedCap, shotDir, forcePct, color);
      this.drawActiveReticle(this.selectedCap, shotDir, forcePct, color);
      this.updatePowerBar(forcePct, color);

      if (forcePct > 0.9) {
          const shake = (forcePct - 0.9) * 5;
          const p = this.selectedCap.body.position;
          this.selectedCap.sprite.setPosition(
              p.x + (Math.random() - 0.5) * shake, 
              p.y + (Math.random() - 0.5) * shake
          );
      } else {
          const p = this.selectedCap.body.position;
          this.selectedCap.sprite.setPosition(p.x, p.y);
      }
      
      // ✅ TUTORIAL: Отрисовка целевой зоны
      this.drawTutorialTargetZone();
  }

  private drawSciFiJoystick(cx: number, cy: number, dx: number, dy: number, dist: number, maxDist: number, color: number): void {
      this.joystickGraphics.clear();

      const angle = Math.atan2(dy, dx);
      const visualDist = Math.min(dist, maxDist);
      const thumbX = cx + Math.cos(angle) * visualDist;
      const thumbY = cy + Math.sin(angle) * visualDist;

      this.joystickGraphics.lineStyle(2, 0xffffff, 0.3);
      this.joystickGraphics.strokeCircle(cx, cy, maxDist);
      this.joystickGraphics.lineStyle(2, color, 0.5);
      this.joystickGraphics.strokeCircle(cx, cy, 20);

      this.joystickGraphics.lineStyle(3, color, 0.6);
      this.joystickGraphics.lineBetween(cx, cy, thumbX, thumbY);

      this.joystickGraphics.fillStyle(color, 1);
      this.joystickGraphics.fillCircle(thumbX, thumbY, 12);
      this.joystickGraphics.lineStyle(2, 0xffffff, 1);
      this.joystickGraphics.strokeCircle(thumbX, thumbY, 16);

      this.joystickGraphics.fillStyle(color, 0.3);
      this.joystickGraphics.fillCircle(thumbX, thumbY, 25);
  }

  private drawTrajectoryRaycast(cap: ShootableUnit, dir: Phaser.Math.Vector2, force: number, color: number): void {
      this.trajectoryGraphics.clear();
      
      const startX = cap.body.position.x;
      const startY = cap.body.position.y;
      
      const aimLength = cap.getAimLineLength();
      let aimDistMult = 1;
      let lineWidth = 4;
      if (cap instanceof Unit) {
        const mod = getUnitPhysicsModifier(cap.getUnitId());
        if (mod === 'laser_aim_line') {
          aimDistMult = 1.16;
          lineWidth = 2;
        } else if (mod === 'cosmos_long_range_aim') {
          aimDistMult = 1.42;
          lineWidth = 3;
        }
      }
      aimDistMult *= this.captainTrajectoryHooks?.getDistanceMultiplier?.() ?? 1;
      const dist = (300 + (force * 500 * aimLength)) * aimDistMult;

      const hit = this.raycastWalls(startX, startY, dir.x, dir.y, dist);
      
      const endX = hit ? hit.x : startX + dir.x * dist;
      const endY = hit ? hit.y : startY + dir.y * dist;

      this.trajectoryGraphics.lineStyle(lineWidth, color, 0.8);
      this.drawDashedLine(this.trajectoryGraphics, startX + dir.x * 30, startY + dir.y * 30, endX, endY, 15, 10);

      this.endMarker.setVisible(true);
      this.endMarker.setPosition(endX, endY);
      this.endMarker.setFillStyle(color);
      this.endMarker.setScale(1 + force * 0.5);

      if (hit) {
          let rx = dir.x;
          let ry = dir.y;
          if (hit.normal === 'h') ry = -ry; else rx = -rx;
          
          const bounceX = endX + rx * 150;
          const bounceY = endY + ry * 150;
          
          this.trajectoryGraphics.lineStyle(2, color, 0.4);
          this.trajectoryGraphics.lineBetween(endX, endY, bounceX, bounceY);
          
          this.reticleGraphics.lineStyle(2, 0xffffff, 0.8);
          this.drawCross(this.reticleGraphics, endX, endY, 8);
      }
  }

  private drawActiveReticle(cap: ShootableUnit, dir: Phaser.Math.Vector2, force: number, color: number): void {
      this.reticleGraphics.clear();
      const x = cap.body.position.x;
      const y = cap.body.position.y;
      const r = cap.getRadius() + 15;
      const angle = Math.atan2(dir.y, dir.x);

      this.reticleGraphics.lineStyle(2, 0xffffff, 0.3);
      this.reticleGraphics.strokeCircle(x, y, r);

      this.reticleGraphics.lineStyle(4, color, 0.9);
      this.reticleGraphics.beginPath();
      const arc = Math.PI * 0.3 + (Math.PI * 1.5 * force);
      this.reticleGraphics.arc(x, y, r, angle - arc/2, angle + arc/2);
      this.reticleGraphics.strokePath();

      const arrowX = x + Math.cos(angle) * (r + 10);
      const arrowY = y + Math.sin(angle) * (r + 10);
      this.reticleGraphics.fillStyle(color);
      this.drawTriangle(this.reticleGraphics, arrowX, arrowY, angle, 8);
  }

  private drawSelectionReticle(cap: ShootableUnit, scale: number): void {
      this.reticleGraphics.clear();
      this.trajectoryGraphics.clear();
      this.endMarker.setVisible(false);
      
      const x = cap.body.position.x;
      const y = cap.body.position.y;
      const r = (cap.getRadius() + 15) * scale;

      // Определяем цвет в зависимости от режима
      const isVoidSwapReady = this.isVoidSwapMode();
      const color = isVoidSwapReady ? FACTIONS.void.color : 0x00f2ff;

      this.reticleGraphics.lineStyle(2, color, 0.6);
      this.reticleGraphics.strokeCircle(x, y, r);
      
      this.reticleGraphics.lineStyle(3, 0xffffff, 0.8);
      this.reticleGraphics.beginPath();
      this.reticleGraphics.arc(x, y, r + 5, 0, 0.5);
      this.reticleGraphics.strokePath();
      this.reticleGraphics.beginPath();
      this.reticleGraphics.arc(x, y, r + 5, Math.PI, Math.PI + 0.5);
      this.reticleGraphics.strokePath();

      // 🧬 Если Void Swap готов - показываем иконку
      if (isVoidSwapReady) {
        this.reticleGraphics.lineStyle(2, FACTIONS.void.color, 1);
        this.reticleGraphics.strokeCircle(x, y - r - 20, 12);
        
        // Символ свапа (↔)
        this.reticleGraphics.lineStyle(2, 0xffffff, 1);
        this.reticleGraphics.lineBetween(x - 8, y - r - 20, x + 8, y - r - 20);
        this.reticleGraphics.lineBetween(x - 8, y - r - 20, x - 4, y - r - 24);
        this.reticleGraphics.lineBetween(x - 8, y - r - 20, x - 4, y - r - 16);
        this.reticleGraphics.lineBetween(x + 8, y - r - 20, x + 4, y - r - 24);
        this.reticleGraphics.lineBetween(x + 8, y - r - 20, x + 4, y - r - 16);
      }
  }

  /**
   * ✅ TUTORIAL: Отрисовка целевой зоны для удара
   */
  private drawTutorialTargetZone(): void {
      if (!this.tutorialTargetZone || !this.tutorialZoneGraphics) return;
      
      this.tutorialZoneGraphics.clear();
      
      const { x, y, radius } = this.tutorialTargetZone;
      const time = this.scene.time.now;
      
      // Пульсация
      const pulse = 0.7 + Math.sin(time * 0.004) * 0.3;
      const pulseRadius = radius * (0.9 + Math.sin(time * 0.003) * 0.1);
      
      // Внешний круг (пульсирующий)
      this.tutorialZoneGraphics.lineStyle(3, 0x00ff00, pulse * 0.8);
      this.tutorialZoneGraphics.strokeCircle(x, y, pulseRadius);
      
      // Заливка
      this.tutorialZoneGraphics.fillStyle(0x00ff00, 0.1 * pulse);
      this.tutorialZoneGraphics.fillCircle(x, y, pulseRadius);
      
      // Внутренний круг
      this.tutorialZoneGraphics.lineStyle(2, 0x00ff00, 0.5);
      this.tutorialZoneGraphics.strokeCircle(x, y, radius * 0.3);
      
      // Перекрестие
      const crossSize = radius * 0.4;
      this.tutorialZoneGraphics.lineStyle(2, 0x00ff00, 0.6);
      this.tutorialZoneGraphics.beginPath();
      this.tutorialZoneGraphics.moveTo(x - crossSize, y);
      this.tutorialZoneGraphics.lineTo(x + crossSize, y);
      this.tutorialZoneGraphics.moveTo(x, y - crossSize);
      this.tutorialZoneGraphics.lineTo(x, y + crossSize);
      this.tutorialZoneGraphics.strokePath();
  }

  // === HELPERS ===

  private getGradientColor(pct: number): number {
      const colorLow = new Phaser.Display.Color(0, 242, 255);
      const colorMed = new Phaser.Display.Color(157, 0, 255);
      const colorHigh = new Phaser.Display.Color(255, 30, 30);
      
      let colorObj: Phaser.Types.Display.ColorObject;
      
      if (pct < 0.5) {
        colorObj = Phaser.Display.Color.Interpolate.ColorWithColor(colorLow, colorMed, 100, pct * 200);
      } else {
        colorObj = Phaser.Display.Color.Interpolate.ColorWithColor(colorMed, colorHigh, 100, (pct - 0.5) * 200);
      }
      return Phaser.Display.Color.GetColor(colorObj.r, colorObj.g, colorObj.b);
  }

  private drawDashedLine(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, dash: number, gap: number) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) return;
      const nx = dx / len;
      const ny = dy / len;
      let cur = -this.dashOffset;
      g.beginPath();
      while(cur < len) {
          const s = Math.max(0, cur);
          const e = Math.min(len, cur + dash);
          if (s < len) {
              g.moveTo(x1 + nx*s, y1 + ny*s);
              g.lineTo(x1 + nx*e, y1 + ny*e);
          }
          cur += dash + gap;
      }
      g.strokePath();
  }

  private drawTriangle(g: Phaser.GameObjects.Graphics, x: number, y: number, angle: number, size: number) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const pCos = Math.cos(angle + 1.57); 
      const pSin = Math.sin(angle + 1.57);
      g.beginPath();
      g.moveTo(x + cos * size, y + sin * size); 
      g.lineTo(x - cos * size + pCos * size * 0.6, y - sin * size + pSin * size * 0.6);
      g.lineTo(x - cos * size - pCos * size * 0.6, y - sin * size - pSin * size * 0.6);
      g.fillPath();
  }

  private drawCross(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number) {
      g.beginPath();
      g.moveTo(x - size, y - size); g.lineTo(x + size, y + size);
      g.moveTo(x + size, y - size); g.lineTo(x - size, y + size);
      g.strokePath();
  }

  private raycastWalls(sx: number, sy: number, dx: number, dy: number, maxDist: number): { x: number; y: number; normal: 'h' | 'v' } | null {
      const bodies = this.scene.matter.world.getAllBodies();
      const walls = bodies.filter(b => b.label === 'wall' || b.label === 'post');
      let closest: { x: number; y: number; normal: 'h' | 'v'; dist: number } | null = null;
      let minDist = maxDist;

      const cast = (x1: number, y1: number, x2: number, y2: number, norm: 'h'|'v') => {
          const x3 = sx; const y3 = sy;
          const x4 = sx + dx * maxDist; const y4 = sy + dy * maxDist;
          const den = (y4-y3)*(x2-x1) - (x4-x3)*(y2-y1);
          if (den === 0) return;
          const ua = ((x4-x3)*(y1-y3) - (y4-y3)*(x1-x3)) / den;
          if (ua >= 0 && ua <= 1) {
              const ub = ((x2-x1)*(y1-y3) - (y2-y1)*(x1-x3)) / den;
              if (ub >= 0 && ub <= 1) {
                  const hitX = x1 + ua*(x2-x1);
                  const hitY = y1 + ua*(y2-y1);
                  const d = Math.sqrt((hitX-sx)**2 + (hitY-sy)**2);
                  if (d < minDist && d > 10) { 
                      minDist = d;
                      closest = { x: hitX, y: hitY, normal: norm, dist: d };
                  }
              }
          }
      };

      walls.forEach(wall => {
          const b = wall.bounds;
          cast(b.min.x, b.min.y, b.max.x, b.min.y, 'h');
          cast(b.max.x, b.min.y, b.max.x, b.max.y, 'v');
          cast(b.max.x, b.max.y, b.min.x, b.max.y, 'h');
          cast(b.min.x, b.max.y, b.min.x, b.min.y, 'v');
      });
      return closest;
  }

  // ============================================================
  // POWER BAR
  // ============================================================

  private createPowerBar(): Phaser.GameObjects.Container {
    const { POWER_BAR_WIDTH, POWER_BAR_HEIGHT } = CONTROL_CONFIG.VISUALS;
    const container = this.scene.add.container(this.scene.scale.width - 35, this.scene.scale.height / 2);
    container.setDepth(150).setVisible(false).setAlpha(0);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRoundedRect(-POWER_BAR_WIDTH / 2, -POWER_BAR_HEIGHT / 2, POWER_BAR_WIDTH, POWER_BAR_HEIGHT, 12);
    bg.lineStyle(2, 0xffffff, 0.3);
    bg.strokeRoundedRect(-POWER_BAR_WIDTH / 2, -POWER_BAR_HEIGHT / 2, POWER_BAR_WIDTH, POWER_BAR_HEIGHT, 12);
    container.add(bg);

    const fill = this.scene.add.graphics(); fill.setName('powerFill'); container.add(fill);
    const text = this.scene.add.text(0, POWER_BAR_HEIGHT / 2 + 18, '0%', { fontSize: '12px', fontFamily: 'Orbitron', color: '#ffffff' }).setOrigin(0.5);
    text.setName('percentText'); container.add(text);

    return container;
  }

  private updatePowerBar(power: number, color: number): void {
      if (power < 0.1 && this.powerBar.visible) {
          this.powerBar.setVisible(false);
          return;
      } else if (power >= 0.1 && !this.powerBar.visible) {
          this.powerBar.setVisible(true);
          this.powerBar.setAlpha(1);
      }

      const { POWER_BAR_WIDTH, POWER_BAR_HEIGHT } = CONTROL_CONFIG.VISUALS;
      const fill = this.powerBar.getByName('powerFill') as Phaser.GameObjects.Graphics;
      const text = this.powerBar.getByName('percentText') as Phaser.GameObjects.Text;
      
      fill.clear();
      const h = POWER_BAR_HEIGHT * power;
      fill.fillStyle(color, 0.9);
      fill.fillRoundedRect(-(POWER_BAR_WIDTH-8)/2, POWER_BAR_HEIGHT/2 - h, POWER_BAR_WIDTH-8, h, 6);
      text.setText(`${Math.round(power * 100)}%`);
      text.setColor(Phaser.Display.Color.IntegerToColor(color).rgba);
  }

  // ============================================================
  // INPUT HANDLERS
  // ============================================================

  setPvPMode(isPvP: boolean, isHost: boolean): void { this.isPvPMode = isPvP; this.isHost = isHost; }
  setCurrentPlayer(player: PlayerNumber): void { this.currentPlayer = player; this.deselectCap(); this.hasFiredThisTurn = false; }
  getCurrentPlayer(): PlayerNumber { return this.currentPlayer; }
  onShoot(callback: (data: ShootEventData) => void): void { this.onShootCallback = callback; }
  onCapSelected(callback: (cap: ShootableUnit | null) => void): void { this.onCapSelectedCallback = callback; }
  onSwap(callback: (unitA: ShootableUnit, unitB: ShootableUnit) => void): void { this.onSwapCallback = callback; }
  // ✅ PVP: Регистрирует callback для отправки PVP ударов
  onPvPShot(callback: (unitId: string, velocity: { x: number; y: number }) => void): void { this.onPvPShotCallback = callback; }
  // ✅ Passive System
  public setPassiveManager(manager: PassiveManager): void {
    this.passiveManager = manager;
  }

  public setCaptainTrajectoryHooks(
    hooks: {
      getDistanceMultiplier(): number;
      shouldAlwaysDrawSecondBounce(): boolean;
    } | null
  ): void {
    this.captainTrajectoryHooks = hooks;
  }

  public setCaptainShotForceScale(fn: ((cap: ShootableUnit) => number) | null): void {
    this.captainShotForceScale = fn;
  }

  public setCaptainSelectionFilter(fn: ((cap: ShootableUnit) => boolean) | null): void {
    this.captainSelectionFilter = fn;
  }

  public setLassoActiveCheck(fn: (() => boolean) | null): void {
    this.isLassoActiveCheck = fn ?? (() => false);
  }

  setEnabled(enabled: boolean): void { this.isEnabled = enabled; if (!enabled) { this.clearAimingState(); this.deselectCap(); } else { this.hasFiredThisTurn = false; } }
  registerCap(cap: ShootableUnit, localIndex: number): void { this.registeredCaps.set(cap, localIndex); cap.sprite.setInteractive({ useHandCursor: true }); }
  getCapIndex(cap: ShootableUnit): number { return this.registeredCaps.get(cap) ?? -1; }
  
  /**
   * ✅ PVP: Генерирует unitId для отправки на сервер
   * Формат: team{N}_unit{index}
   */
  private generateUnitId(cap: ShootableUnit, localIndex: number): string {
    const team = cap.owner; // 1 or 2
    return `team${team}_unit${localIndex}`;
  }

  private setupInput(): void {
    const input = this.scene.input;
    input.on('pointerdown', this.onPointerDown, this);
    input.on('pointermove', this.onPointerMove, this);
    input.on('pointerup', this.onPointerUp, this);
    input.on('pointerupoutside', this.onPointerUp, this);
  }

  // === POINTER DOWN ===
  private onPointerDown(pointer: Phaser.Input.Pointer, gameObjects: any[]): void {
    if (!this.isEnabled || this.hasFiredThisTurn) return;
    if (this.isLassoActiveCheck()) return;

    this.pointerDownTime = Date.now();
    this.pointerDownPos = new Phaser.Math.Vector2(pointer.x, pointer.y);

    const clickedCap = this.findClickedCap(pointer.x, pointer.y);

    // 🧬 VOID SWAP: Если выбран Void юнит и кликаем на союзника
    if (this.selectedCap && this.isVoidSwapMode() && clickedCap) {
      // Проверяем что это союзник и не тот же юнит
      if (clickedCap !== this.selectedCap && clickedCap.owner === this.selectedCap.owner) {
        // Проверяем что цель не застанена
        if (isUnit(clickedCap) && clickedCap.isStunned()) {
          console.log('[ShootingController] Cannot swap with stunned unit');
          this.showErrorFeedback(clickedCap);
          return;
        }

        this.executeSwap(this.selectedCap, clickedCap);
        return;
      }
    }

    // 🧬 STUN CHECK: Нельзя выбрать застаненного юнита
    if (clickedCap && isUnit(clickedCap) && clickedCap.isStunned()) {
      console.log('[ShootingController] Cannot select stunned unit');
      this.showErrorFeedback(clickedCap);
      return;
    }

    if (clickedCap && isUnit(clickedCap) && clickedCap.isCaptainSelectionBanned()) {
      console.log('[ShootingController] Captain rift — выбор запрещён');
      this.showErrorFeedback(clickedCap);
      return;
    }

    if (clickedCap) {
        if (this.selectedCap !== clickedCap) this.selectCap(clickedCap);
        this.startAiming(pointer);
    } else if (this.selectedCap && !this.isAiming) {
        const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, this.selectedCap.body.position.x, this.selectedCap.body.position.y);
        if (dist < 200) {
            this.startAiming(pointer);
        } else {
            this.deselectCap();
        }
    }
  }

  /**
   * Показать feedback ошибки (тряска)
   */
  private showErrorFeedback(cap: ShootableUnit): void {
    const originalX = cap.sprite.x;
    
    this.scene.tweens.add({
      targets: cap.sprite,
      x: originalX + 5,
      duration: 50,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        cap.sprite.x = originalX;
      }
    });

    try {
      // Vibration API для Game режима
      if (navigator.vibrate) {
        navigator.vibrate([30, 50, 30]);
      }
    } catch {}
  }

  private findClickedCap(x: number, y: number): ShootableUnit | undefined {
      for (const [cap] of this.registeredCaps) {
          // Проверка владельца
          if (cap.owner !== this.currentPlayer) continue;
          
          // ✅ TUTORIAL: Ограничение выбора юнита
          if (this.tutorialAllowedUnitId !== null) {
              if (cap.id !== this.tutorialAllowedUnitId) {
                  continue; // Пропускаем неразрешённых юнитов
              }
          }

          if (this.captainSelectionFilter && !this.captainSelectionFilter(cap)) {
            continue;
          }
          
          // Проверка попадания в радиус
          const pos = cap.body.position;
          const clickRadius = cap.getRadius ? cap.getRadius() + 20 : 50;
          
          if (Phaser.Math.Distance.Between(x, y, pos.x, pos.y) <= clickRadius) {
              return cap;
          }
      }
      return undefined;
  }

  private selectCap(cap: ShootableUnit): void {
      if (this.selectedCap) this.selectedCap.highlight(false);
      this.selectedCap = cap;
      this.selectedCap.highlight(true);
      this.onCapSelectedCallback?.(cap);
      
      this.drawSelectionReticle(cap, 1);
      
      try {
        // Vibration API для Game режима
        if (navigator.vibrate) {
          navigator.vibrate(5);
        }
      } catch {}
      
      // ✅ TUTORIAL: Вызов callback при выборе юнита
      if (this.isTutorialMode && this.tutorialOnUnitSelected && cap) {
          this.tutorialOnUnitSelected(cap.id);
      }
  }

  private deselectCap(): void {
      if (this.selectedCap) {
          this.selectedCap.highlight(false);
          const p = this.selectedCap.body.position;
          this.selectedCap.sprite.setPosition(p.x, p.y);
          this.selectedCap = null;
      }
      this.onCapSelectedCallback?.(null);
      this.clearAimingState();
      
      // Очищаем Swap индикаторы
      this.swapTargetIndicator?.clear();
      this.swapLineGraphics?.clear();
  }

  private startAiming(pointer: Phaser.Input.Pointer): void {
      this.isAiming = true;
      this.dragStartPos = new Phaser.Math.Vector2(pointer.x, pointer.y);
      this.joystickGraphics.setVisible(true);
      this.currentHitOffset = 0;
  }

  // === POINTER MOVE ===
  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isEnabled || !this.isAiming || !this.selectedCap || !this.dragStartPos) return;
    if (this.isLassoActiveCheck()) return;
    this.updateVisuals(pointer.x, pointer.y);
    
    const dx = pointer.x - this.dragStartPos.x;
    const dy = pointer.y - this.dragStartPos.y;
    let dist = Math.sqrt(dx*dx + dy*dy);
    const dragVec = new Phaser.Math.Vector2(dx, dy);
    this.currentHitOffset = this.calculateHitOffset(pointer, dragVec, dist);
  }

  // === POINTER UP ===
  private onPointerUp(pointer: Phaser.Input.Pointer): void {
      if (!this.isEnabled || !this.isAiming || !this.selectedCap || !this.dragStartPos) return;
      if (this.isLassoActiveCheck()) return;

      const dx = pointer.x - this.dragStartPos.x;
      const dy = pointer.y - this.dragStartPos.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      dist *= CONTROL_CONFIG.SNIPER.SENSITIVITY;

      if (dist < CONTROL_CONFIG.MIN_DRAG_DISTANCE) {
          const duration = Date.now() - this.pointerDownTime;
          if (duration < CONTROL_CONFIG.SHORT_TAP_DURATION) {
               this.isAiming = false;
               this.clearActiveVisuals();
               this.drawSelectionReticle(this.selectedCap, 1);
               this.updateSwapIndicators();
               return; 
          }
          this.deselectCap();
          return;
      }

      const maxDist = CONTROL_CONFIG.SNIPER.JOYSTICK_RADIUS;
      if (dist > maxDist) dist = maxDist;
      
      const dragDirection = new Phaser.Math.Vector2(dx, dy).normalize();
      const shotDirection = dragDirection.clone();
      
      const force = this.selectedCap.calculateShotForce(dist, shotDirection);
      this.executeShot(this.selectedCap, force);
  }

  private executeShot(cap: ShootableUnit, force: Phaser.Math.Vector2): void {
      if (this.isLassoActiveCheck()) return;

      let modifiedForce = force.clone();
      
      // ✅ ПАССИВКИ: Модификация силы удара
      if (cap instanceof Unit && this.passiveManager) {
        modifiedForce = this.passiveManager.onBallHit(cap, modifiedForce);
      }

      const capMul = this.captainShotForceScale?.(cap) ?? 1;
      if (capMul !== 1) {
        modifiedForce.set(modifiedForce.x * capMul, modifiedForce.y * capMul);
      }
      
      // ✅ ТОЧНОСТЬ: Применение разброса
      if (cap instanceof Unit) {
        modifiedForce = this.applyAccuracySpread(cap, modifiedForce);
      }
      
      cap.setLastHitOffset(this.currentHitOffset);
      
      if (this.isPvPMode) {
        // ✅ PVP: Отправляем удар на сервер вместо локальной симуляции
        const localIndex = this.getCapIndex(cap);
        const unitId = this.generateUnitId(cap, localIndex);
        
        if (this.onPvPShotCallback) {
          this.onPvPShotCallback(unitId, {
            x: modifiedForce.x,
            y: modifiedForce.y,
          });
          
          console.log(`[ShootingController] PVP shot sent: ${unitId}`, force);
        } else {
          console.warn('[ShootingController] PVP callback not registered!');
        }
        
        // ⚠️ НЕ применяем локальную физику!
        // Сервер сам применит силу и отправит обновлённое состояние
        
      } else {
        // Обычная локальная игра
        cap.applyForce(modifiedForce.x, modifiedForce.y);
        
        // Сохраняем информацию о pending shot для callback
        const localIndex = this.getCapIndex(cap);
        this.pendingShot = { cap, localIndex, hitOffset: this.currentHitOffset };
      }
      
      this.hasFiredThisTurn = true;
      try {
        // Vibration API для Game режима
        if (navigator.vibrate) {
          navigator.vibrate(20);
        }
      } catch {}
      this.deselectCap();
      
      // ✅ TUTORIAL: Вызов callback при выполнении удара
      if (this.isTutorialMode && this.tutorialOnShotExecuted) {
          // Небольшая задержка чтобы физика успела примениться
          this.scene.time.delayedCall(100, () => {
              this.tutorialOnShotExecuted?.();
          });
      }
  }
  
  // Новый метод для применения точности:
  private applyAccuracySpread(unit: Unit, force: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    // ✅ Используем безопасную функцию с fallback
    let accuracy = getUnitAccuracy(unit.getUnitId());
    
    // Применяем модификаторы от пассивок
    if (this.passiveManager) {
      accuracy += this.passiveManager.getAccuracyModifier(unit.getUnitId());
    }

    if (unit.getCapClass() === 'tank' && unit.isOnOwnHalf()) {
      accuracy += TANK_ZONE_BONUS.ACCURACY_PENALTY_OWN_HALF;
    }

    // Clamp accuracy
    accuracy = Phaser.Math.Clamp(accuracy, 0.5, 1.0);

    const mod = getUnitPhysicsModifier(unit.getUnitId());
    if (mod === 'stable_accuracy_097') {
      accuracy = 0.97;
    }
    if (mod === 'perfect_accuracy_line') {
      accuracy = 1.0;
    }
    
    if (accuracy >= 1.0) return force;
    
    // Calculate spread
    const maxSpread = MAX_ACCURACY_SPREAD; // 15 degrees in radians
    const spread = (1 - accuracy) * maxSpread;
    
    const angle = Math.atan2(force.y, force.x);
    const randomSpread = (Math.random() - 0.5) * 2 * spread;
    const newAngle = angle + randomSpread;
    
    const magnitude = Math.sqrt(force.x * force.x + force.y * force.y);
    
    return new Phaser.Math.Vector2(
      Math.cos(newAngle) * magnitude,
      Math.sin(newAngle) * magnitude
    );
  }

  private calculateHitOffset(pointer: Phaser.Input.Pointer, dragVec: Phaser.Math.Vector2, dist: number): number {
    if (!this.selectedCap || !this.dragStartPos) return 0;
    if (this.selectedCap.getCapClass() !== 'trickster') return 0;
    if (dist < 20) return 0;

    const capPos = this.selectedCap.body.position;
    const perpendicular = new Phaser.Math.Vector2(-dragVec.y, dragVec.x).normalize();
    const pointerOffset = new Phaser.Math.Vector2(pointer.x - capPos.x, pointer.y - capPos.y);
    const lateralOffset = pointerOffset.dot(perpendicular);
    return Phaser.Math.Clamp(lateralOffset / 50, -1, 1);
  }

  private onPhysicsUpdate(): void {
    if (!this.pendingShot) return;
    const { cap, localIndex, hitOffset } = this.pendingShot;
    this.onShootCallback?.({
      cap,
      velocity: { x: cap.body.velocity.x, y: cap.body.velocity.y },
      localCapIndex: localIndex,
      hitOffset,
    });
    this.pendingShot = null;
  }

  private clearAimingState(): void {
    this.isAiming = false;
    this.dragStartPos = null;
    this.currentHitOffset = 0;
    this.clearActiveVisuals();
    this.reticleGraphics.clear();
  }

  private clearActiveVisuals(): void {
    this.joystickGraphics.clear();
    this.trajectoryGraphics.clear();
    this.endMarker.setVisible(false);
    this.powerBar.setVisible(false);
    // Не очищаем tutorialZoneGraphics здесь, так как зона должна быть видна постоянно
  }

  destroy(): void {
    this.aimLoopEvent?.remove();
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointerupoutside', this.onPointerUp, this);
    this.scene.matter.world.off('afterupdate', this.onPhysicsUpdate, this);

    this.reticleGraphics.destroy();
    this.trajectoryGraphics.destroy();
    this.joystickGraphics.destroy();
    this.endMarker.destroy();
    this.powerBar.destroy();
    this.swapTargetIndicator?.destroy();
    this.swapLineGraphics?.destroy();
    this.tutorialZoneGraphics?.destroy();
    this.registeredCaps.clear();
  }

  // ═══════════════════════════════════════════════════════════════
  // TUTORIAL API
  // ═══════════════════════════════════════════════════════════════

  /**
   * Включить режим обучения
   */
  public enableTutorialMode(): void {
    this.isTutorialMode = true;
    console.log('[ShootingController] Tutorial mode enabled');
  }

  /**
   * Выключить режим обучения
   */
  public disableTutorialMode(): void {
    this.isTutorialMode = false;
    this.clearTutorialRestrictions();
    console.log('[ShootingController] Tutorial mode disabled');
  }

  /**
   * Ограничить выбор только указанным юнитом
   * @param unitId ID юнита или null для снятия ограничения
   */
  public setTutorialAllowedUnit(unitId: string | null): void {
    this.tutorialAllowedUnitId = unitId;
    console.log(`[ShootingController] Tutorial allowed unit: ${unitId || 'any'}`);
  }

  /**
   * Получить ID разрешённого юнита
   */
  public getTutorialAllowedUnitId(): string | null {
    return this.tutorialAllowedUnitId;
  }

  /**
   * Установить целевую зону для удара (будет визуализироваться)
   * @param x X координата центра зоны
   * @param y Y координата центра зоны  
   * @param radius Радиус зоны в пикселях
   */
  public setTutorialTargetZone(x: number, y: number, radius: number): void {
    this.tutorialTargetZone = { x, y, radius };
    console.log(`[ShootingController] Tutorial target zone: (${x.toFixed(0)}, ${y.toFixed(0)}) r=${radius}`);
  }

  /**
   * Получить целевую зону
   */
  public getTutorialTargetZone(): { x: number; y: number; radius: number } | null {
    return this.tutorialTargetZone;
  }

  /**
   * Установить callback при выборе юнита
   */
  public setTutorialOnUnitSelected(callback: ((unitId: string) => void) | null): void {
    this.tutorialOnUnitSelected = callback;
  }

  /**
   * Установить callback при выполнении удара
   */
  public setTutorialOnShotExecuted(callback: (() => void) | null): void {
    this.tutorialOnShotExecuted = callback;
  }

  /**
   * Очистить все tutorial ограничения
   */
  public clearTutorialRestrictions(): void {
    this.tutorialAllowedUnitId = null;
    this.tutorialTargetZone = null;
    this.tutorialOnUnitSelected = null;
    this.tutorialOnShotExecuted = null;
    this.tutorialZoneGraphics?.clear();
    console.log('[ShootingController] Tutorial restrictions cleared');
  }

  /**
   * Получить ID текущего выбранного юнита
   */
  public getSelectedUnitId(): string | null {
    return this.selectedCap?.id || null;
  }
}