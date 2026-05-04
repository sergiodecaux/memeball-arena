// src/ui/game/LassoButton.ts
// Маленькая кнопка лассо — только активирует механику.
// Управление маятником происходит на поле через LassoController.

import Phaser from 'phaser';
import { LassoController, LassoPhase } from '../../scenes/game/LassoController';
import type { GameUnit } from '../../scenes/game/types';
import { LASSO_CONFIG } from '../../constants/gameConstants';

export interface LassoButtonConfig {
  lassoController: LassoController;
  onActivate?: () => void;
  onRelease?: () => void;
}

export class LassoButton {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private config: LassoButtonConfig;
  private lassoController: LassoController;

  private background: Phaser.GameObjects.Graphics;
  private iconText: Phaser.GameObjects.Text;
  private cooldownOverlay: Phaser.GameObjects.Graphics;
  private cooldownText: Phaser.GameObjects.Text;
  private statusText: Phaser.GameObjects.Text;
  private glowEffect: Phaser.GameObjects.Arc;
  private pulseEffect?: Phaser.Tweens.Tween;

  private isVisible: boolean = false;
  private currentPhase: LassoPhase = 'IDLE';
  private currentCap: GameUnit | null = null;

  private readonly SIZE = LASSO_CONFIG.BUTTON_SIZE;
  private readonly COLOR_READY = 0xa855f7;
  private readonly COLOR_ACTIVE = 0xffdd44;
  private readonly COLOR_COOLDOWN = 0x444444;

  constructor(scene: Phaser.Scene, config: LassoButtonConfig) {
    this.scene = scene;
    this.config = config;
    this.lassoController = config.lassoController;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(200);
    this.container.setVisible(false);
    this.container.setAlpha(0);
    this.container.setScrollFactor(0);

    this.createVisuals();
    this.scene.events.on('update', this.onUpdate, this);
  }

  private createVisuals(): void {
    const s = this.SIZE;

    this.glowEffect = this.scene.add.circle(0, 0, s * 0.6, this.COLOR_READY, 0);
    this.glowEffect.setBlendMode(Phaser.BlendModes.ADD);
    this.container.add(this.glowEffect);

    this.background = this.scene.add.graphics();
    this.drawBackground(this.COLOR_READY, false);
    this.container.add(this.background);

    this.iconText = this.scene.add
      .text(0, -6, '🪢', {
        fontSize: '22px',
      })
      .setOrigin(0.5);
    this.container.add(this.iconText);

    this.statusText = this.scene.add
      .text(0, s / 2 - 10, 'ЛАССО', {
        fontSize: '8px',
        fontFamily: 'Orbitron, Arial',
        color: '#cc88ff',
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

    const hitArea = this.scene.add.rectangle(0, 0, s, s, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    this.container.add(hitArea);

    hitArea.on('pointerdown', () => this.onClick());
    hitArea.on('pointerover', () => this.onHover(true));
    hitArea.on('pointerout', () => this.onHover(false));
  }

  private drawBackground(color: number, isActive: boolean): void {
    const s = this.SIZE;
    const r = 12;
    this.background.clear();
    this.background.fillStyle(isActive ? 0x2a1800 : 0x1a1030, 0.96);
    this.background.fillRoundedRect(-s / 2, -s / 2, s, s, r);
    this.background.lineStyle(isActive ? 2.5 : 1.5, color, isActive ? 1 : 0.8);
    this.background.strokeRoundedRect(-s / 2, -s / 2, s, s, r);
  }

  private onUpdate(): void {
    if (!this.isVisible) return;
    this.updateVisuals();
  }

  private updateVisuals(): void {
    const state = this.lassoController.getState();
    this.currentPhase = state.phase;

    if (state.cooldownRemaining > 0 && state.phase === 'IDLE') {
      this.cooldownOverlay.clear();
      const s = this.SIZE;
      this.cooldownOverlay.fillStyle(0x000000, 0.75);
      this.cooldownOverlay.fillRoundedRect(-s / 2, -s / 2, s, s, 12);
      this.cooldownOverlay.setVisible(true);
      this.cooldownText.setText(String(state.cooldownRemaining));
      this.cooldownText.setVisible(true);
      this.iconText.setAlpha(0.25);
      this.drawBackground(this.COLOR_COOLDOWN, false);
      this.statusText.setText('КД').setColor('#666666');
      this.stopPulse();
      return;
    }

    this.cooldownOverlay.setVisible(false);
    this.cooldownText.setVisible(false);
    this.iconText.setAlpha(1);

    switch (state.phase) {
      case 'IDLE': {
        const ok = this.currentCap ? this.lassoController.canActivate(this.currentCap) : false;
        if (ok) {
          this.drawBackground(this.COLOR_READY, false);
          this.statusText.setText('ЛАССО').setColor('#cc88ff');
          this.startPulse();
        } else {
          this.drawBackground(this.COLOR_COOLDOWN, false);
          this.statusText.setText('ДАЛЕКО').setColor('#555555');
          this.stopPulse();
        }
        break;
      }
      case 'CAPTURING': {
        this.drawBackground(this.COLOR_ACTIVE, true);
        this.statusText.setText('ЗАХВАТ').setColor('#ffdd44');
        this.stopPulse();
        break;
      }
      case 'AIMING': {
        this.drawBackground(this.COLOR_ACTIVE, true);
        this.statusText.setText('ТЯНИ!').setColor('#ff8800');
        this.stopPulse();
        this.iconText.setAlpha(0.5 + 0.5 * Math.sin(Date.now() / 220));
        break;
      }
    }
  }

  private onClick(): void {
    const state = this.lassoController.getState();

    if (state.phase === 'AIMING') {
      this.lassoController.cancel();
      return;
    }

    if (state.phase === 'CAPTURING') return;

    if (state.cooldownRemaining > 0) {
      this.playShake();
      return;
    }

    if (!this.currentCap) {
      this.playShake();
      return;
    }

    const success = this.lassoController.activate(this.currentCap);
    if (success) {
      this.config.onActivate?.();
      const ripple = this.scene.add.circle(
        this.container.x,
        this.container.y,
        this.SIZE / 2,
        this.COLOR_ACTIVE,
        0.5,
      );
      ripple.setDepth(199).setBlendMode(Phaser.BlendModes.ADD).setScrollFactor(0);
      this.scene.tweens.add({
        targets: ripple,
        scale: 2.5,
        alpha: 0,
        duration: 300,
        onComplete: () => ripple.destroy(),
      });
    } else {
      this.playShake();
    }
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

  private startPulse(): void {
    if (this.pulseEffect) return;
    this.pulseEffect = this.scene.tweens.add({
      targets: this.glowEffect,
      alpha: { from: 0, to: 0.5 },
      duration: 850,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.glowEffect.setFillStyle(this.COLOR_READY, this.glowEffect.alpha * 0.5);
      },
    });
  }

  private stopPulse(): void {
    this.pulseEffect?.stop();
    this.pulseEffect = undefined;
    this.glowEffect.setFillStyle(this.COLOR_READY, 0);
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
  }

  public hide(): void {
    if (!this.isVisible) return;
    if (this.lassoController.isActive()) this.lassoController.cancel();
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

  public refresh(): void {}

  public setCurrentCap(cap: GameUnit | null): void {
    this.currentCap = cap;
    this.lassoController.setAttachedCap(cap);
  }

  public isShowing(): boolean {
    return this.isVisible;
  }

  public destroy(): void {
    this.scene.events.off('update', this.onUpdate, this);
    this.stopPulse();
    this.container.destroy();
  }
}
