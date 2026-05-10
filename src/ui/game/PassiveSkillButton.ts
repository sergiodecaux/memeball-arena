// Кнопка пассивного классового навыка (Playmaker / Maestro) — стиль как у LassoButton.

import Phaser from 'phaser';
import { LASSO_CONFIG } from '../../constants/gameConstants';
import type { GameUnit } from '../../scenes/game/types';
import { Unit } from '../../entities/Unit';
import { getUnitPassive } from '../../data/UnitsRepository';

export interface PassiveSkillButtonConfig {
  /** Магнитный пас */
  onMagneticPass?: (unit: Unit) => void;
  /** Дриблинг — старт интерактивного режима (GameScene → PassiveManager) */
  onDribble?: (unit: Unit) => void;
  /** Превью радиуса дриблинга при наведении на кнопку (Maestro, не во время КД) */
  onMaestroRangePreview?: (unit: Unit | null) => void;
  /** Досрочная остановка активного дриблинга */
  onStopDribble?: (unit: Unit) => void;
}

export class PassiveSkillButton {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private config: PassiveSkillButtonConfig;

  private background: Phaser.GameObjects.Graphics;
  private iconText: Phaser.GameObjects.Text;
  private cooldownOverlay: Phaser.GameObjects.Graphics;
  private cooldownText: Phaser.GameObjects.Text;
  private statusText: Phaser.GameObjects.Text;
  private glowEffect: Phaser.GameObjects.Arc;
  private pulseEffect?: Phaser.Tweens.Tween;

  private hitArea: Phaser.GameObjects.Rectangle;
  /** Маленькая кнопка STOP над основной (только во время дриблинга) */
  private stopHit: Phaser.GameObjects.Rectangle;
  private stopLabel: Phaser.GameObjects.Text;

  private isVisible = false;
  private currentCap: GameUnit | null = null;

  private readonly SIZE = LASSO_CONFIG.BUTTON_SIZE;
  private readonly COLOR_MAGNETIC = 0x10b981;
  private readonly COLOR_DRIBBLE = 0xfbbf24;
  private readonly COLOR_DISABLED = 0x444444;

  constructor(scene: Phaser.Scene, config: PassiveSkillButtonConfig) {
    this.scene = scene;
    this.config = config;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(200);
    this.container.setVisible(false);
    this.container.setAlpha(0);
    this.container.setScrollFactor(0);

    this.glowEffect = this.scene.add.circle(0, 0, this.SIZE * 0.55, this.COLOR_MAGNETIC, 0);
    this.glowEffect.setBlendMode(Phaser.BlendModes.ADD);
    this.container.add(this.glowEffect);

    this.background = this.scene.add.graphics();
    this.container.add(this.background);

    this.iconText = this.scene.add
      .text(0, -6, '⭐', {
        fontSize: '22px',
      })
      .setOrigin(0.5);
    this.container.add(this.iconText);

    this.statusText = this.scene.add
      .text(0, this.SIZE / 2 - 10, 'ПАССИВ', {
        fontSize: '8px',
        fontFamily: 'Orbitron, Arial',
        color: '#a7f3d0',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    this.container.add(this.statusText);

    this.cooldownOverlay = this.scene.add.graphics();
    this.cooldownOverlay.setVisible(false);
    this.container.add(this.cooldownOverlay);

    this.cooldownText = this.scene.add
      .text(0, 0, '', {
        fontSize: '18px',
        fontFamily: 'Orbitron, Arial',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.container.add(this.cooldownText);

    this.hitArea = this.scene.add.rectangle(0, 0, this.SIZE, this.SIZE, 0x000000, 0);
    this.hitArea.setInteractive({ useHandCursor: true });
    this.hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      this.onClick();
    });
    this.hitArea.on('pointerover', () => {
      this.onHover(true);
      this.emitMaestroRangePreview(true);
    });
    this.hitArea.on('pointerout', () => {
      this.onHover(false);
      this.emitMaestroRangePreview(false);
    });
    this.container.add(this.hitArea);

    this.stopHit = this.scene.add
      .rectangle(0, -this.SIZE * 0.72, Math.round(this.SIZE * 0.92), 22, 0xef4444, 0.96)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.stopHit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event?.stopPropagation?.();
      this.onStopDribblePressed();
    });
    this.container.add(this.stopHit);

    this.stopLabel = this.scene.add
      .text(0, -this.SIZE * 0.72, 'STOP', {
        fontSize: '11px',
        fontFamily: 'Orbitron, Arial',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.container.add(this.stopLabel);

    this.scene.events.on('update', this.onUpdate, this);
    this.drawBackground(this.COLOR_MAGNETIC, false);
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  private onUpdate(): void {
    if (!this.isVisible) return;
    this.updateVisuals();
  }

  private passiveKind(): 'magnetic_pass' | 'dribbling' | null {
    const cap = this.currentCap;
    if (!cap || !(cap instanceof Unit)) return null;
    const t = getUnitPassive(cap.getUnitId()).type;
    return t === 'magnetic_pass' || t === 'dribbling' ? t : null;
  }

  private updateVisuals(): void {
    const cap = this.currentCap instanceof Unit ? this.currentCap : null;
    const kind = this.passiveKind();

    if (!cap || !kind) {
      this.drawBackground(this.COLOR_DISABLED, false);
      this.statusText.setText('—').setColor('#555555');
      this.cooldownOverlay.setVisible(false);
      this.cooldownText.setVisible(false);
      this.iconText.setAlpha(0.35);
      this.stopHit.setVisible(false);
      this.stopLabel.setVisible(false);
      this.stopPulse();
      return;
    }

    const readyColor = kind === 'magnetic_pass' ? this.COLOR_MAGNETIC : this.COLOR_DRIBBLE;
    const label = kind === 'magnetic_pass' ? 'МАГ.ПАС' : 'ДРИБЛ';

    const cd =
      kind === 'magnetic_pass' ? cap.getMagneticPassCooldownTurns() : cap.getDribblingCooldownTurns();
    const dribbling = kind === 'dribbling' && cap.isMagneticDribbleActive();

    if (dribbling) {
      this.drawBackground(this.COLOR_DRIBBLE, true);
      this.iconText.setText('🏃').setAlpha(1);
      this.statusText.setText('ДРИБЛ').setColor('#fde047');
      this.cooldownOverlay.setVisible(false);
      this.cooldownText.setVisible(false);
      this.stopHit.setVisible(true);
      this.stopLabel.setVisible(true);
      this.stopPulse();
      return;
    }

    this.stopHit.setVisible(false);
    this.stopLabel.setVisible(false);

    if (cd > 0) {
      const s = this.SIZE;
      this.cooldownOverlay.clear();
      this.cooldownOverlay.fillStyle(0x000000, 0.75);
      this.cooldownOverlay.fillRoundedRect(-s / 2, -s / 2, s, s, 12);
      this.cooldownOverlay.setVisible(true);
      this.cooldownText.setText(String(cd)).setVisible(true);
      this.iconText.setAlpha(0.28);
      this.drawBackground(this.COLOR_DISABLED, false);
      this.statusText.setText('КД').setColor('#666666');
      this.stopPulse();
      return;
    }

    this.cooldownOverlay.setVisible(false);
    this.cooldownText.setVisible(false);
    this.iconText.setAlpha(1);
    this.iconText.setText(kind === 'magnetic_pass' ? '⭐' : '⚡');
    this.drawBackground(readyColor, false);
    this.statusText.setText(label).setColor(kind === 'magnetic_pass' ? '#a7f3d0' : '#fde68a');
    this.startPulse(readyColor);
  }

  private drawBackground(color: number, isActive: boolean): void {
    const s = this.SIZE;
    const r = 12;
    this.background.clear();
    this.background.fillStyle(isActive ? 0x1a1208 : 0x101820, 0.96);
    this.background.fillRoundedRect(-s / 2, -s / 2, s, s, r);
    this.background.lineStyle(isActive ? 2.5 : 1.5, color, isActive ? 1 : 0.82);
    this.background.strokeRoundedRect(-s / 2, -s / 2, s, s, r);
  }

  private onStopDribblePressed(): void {
    const cap = this.currentCap instanceof Unit ? this.currentCap : null;
    const kind = this.passiveKind();
    if (!cap || kind !== 'dribbling' || !cap.isMagneticDribbleActive()) return;
    this.config.onStopDribble?.(cap);
  }

  private onClick(): void {
    const cap = this.currentCap instanceof Unit ? this.currentCap : null;
    const kind = this.passiveKind();
    if (!cap || !kind) {
      this.playShake();
      return;
    }

    if (kind === 'dribbling' && cap.isMagneticDribbleActive()) {
      this.playShake();
      return;
    }

    const cd =
      kind === 'magnetic_pass' ? cap.getMagneticPassCooldownTurns() : cap.getDribblingCooldownTurns();
    if (cd > 0) {
      this.playShake();
      return;
    }

    if (kind === 'magnetic_pass') {
      this.config.onMagneticPass?.(cap);
    } else {
      this.config.onDribble?.(cap);
    }
  }

  private emitMaestroRangePreview(hovering: boolean): void {
    const fn = this.config.onMaestroRangePreview;
    if (!fn) return;
    if (!hovering) {
      fn(null);
      return;
    }
    const cap = this.currentCap instanceof Unit ? this.currentCap : null;
    const kind = this.passiveKind();
    if (!cap || kind !== 'dribbling' || cap.isMagneticDribbleActive()) {
      fn(null);
      return;
    }
    fn(cap);
  }

  private onHover(over: boolean): void {
    this.scene.tweens.add({
      targets: this.container,
      scaleX: over ? 1.08 : 1,
      scaleY: over ? 1.08 : 1,
      duration: 80,
    });
  }

  private playShake(): void {
    const sx = this.container.x;
    this.scene.tweens.add({
      targets: this.container,
      x: sx - 4,
      duration: 35,
      yoyo: true,
      repeat: 3,
      onComplete: () => this.container.setX(sx),
    });
  }

  private startPulse(color: number): void {
    if (this.pulseEffect) return;
    this.pulseEffect = this.scene.tweens.add({
      targets: this.glowEffect,
      alpha: { from: 0, to: 0.45 },
      duration: 820,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.glowEffect.setFillStyle(color, this.glowEffect.alpha * 0.45);
      },
    });
  }

  private stopPulse(): void {
    this.pulseEffect?.stop();
    this.pulseEffect = undefined;
    this.glowEffect.setFillStyle(this.COLOR_MAGNETIC, 0);
  }

  public show(x: number, y: number): void {
    this.container.setPosition(x, y);
    if (this.isVisible) return;
    this.container.setVisible(true).setScale(0.6).setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      scale: 1,
      alpha: 1,
      duration: 160,
      ease: 'Back.easeOut',
    });
    this.isVisible = true;
    this.updateVisuals();
  }

  public hide(): void {
    if (!this.isVisible) return;
    this.emitMaestroRangePreview(false);
    this.stopPulse();
    this.scene.tweens.add({
      targets: this.container,
      scale: 0.6,
      alpha: 0,
      duration: 120,
      ease: 'Cubic.easeIn',
      onComplete: () => this.container.setVisible(false),
    });
    this.isVisible = false;
  }

  public reposition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  public refresh(): void {
    this.updateVisuals();
  }

  public setCurrentCap(cap: GameUnit | null): void {
    this.currentCap = cap;
    if (this.isVisible) this.updateVisuals();
  }

  public destroy(): void {
    this.emitMaestroRangePreview(false);
    this.scene.events.off('update', this.onUpdate, this);
    this.stopPulse();
    this.container.destroy(true);
  }
}
