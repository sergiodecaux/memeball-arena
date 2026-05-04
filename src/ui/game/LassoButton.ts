// src/ui/game/LassoButton.ts
// Кнопка Лассо для Trickster-юнитов (появляется рядом с панелью способностей)

import Phaser from 'phaser';
import { LassoController, LassoPhase } from '../../scenes/game/LassoController';
import type { GameUnit } from '../../scenes/game/types';

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

  private isVisible = false;
  private currentPhase: LassoPhase = 'IDLE';
  private currentCap: GameUnit | null = null;

  private readonly WIDTH = 80;
  private readonly HEIGHT = 100;
  private readonly COLOR_READY = 0xa855f7;
  private readonly COLOR_ACTIVE = 0xffdd44;
  private readonly COLOR_COOLDOWN = 0x333333;

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
  }

  private createVisuals(): void {
    this.glowEffect = this.scene.add.circle(0, 0, this.WIDTH * 0.7, this.COLOR_READY, 0);
    this.glowEffect.setBlendMode(Phaser.BlendModes.ADD);
    this.container.add(this.glowEffect);

    this.background = this.scene.add.graphics();
    this.drawBackground(this.COLOR_READY, false);
    this.container.add(this.background);

    this.iconText = this.scene.add.text(0, -18, '🪢', {
      fontSize: '32px',
    }).setOrigin(0.5);
    this.container.add(this.iconText);

    this.statusText = this.scene.add.text(0, 30, 'LASSO', {
      fontSize: '10px',
      fontFamily: 'Orbitron, Arial',
      color: '#a855f7',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.container.add(this.statusText);

    this.cooldownOverlay = this.scene.add.graphics();
    this.cooldownOverlay.setVisible(false);
    this.container.add(this.cooldownOverlay);

    this.cooldownText = this.scene.add
      .text(0, 0, '', {
        fontSize: '26px',
        fontFamily: 'Orbitron, Arial',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.container.add(this.cooldownText);

    const hitArea = this.scene.add.rectangle(0, 0, this.WIDTH, this.HEIGHT, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    this.container.add(hitArea);

    hitArea.on('pointerover', () => this.onHover());
    hitArea.on('pointerout', () => this.onHoverEnd());
    hitArea.on('pointerdown', () => this.onPress());
    hitArea.on('pointerup', () => this.onClick());
  }

  private drawBackground(color: number, isActive: boolean): void {
    const w = this.WIDTH;
    const h = this.HEIGHT;
    const radius = 12;

    this.background.clear();
    this.background.lineStyle(isActive ? 3 : 2, color, isActive ? 1 : 0.8);
    this.background.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);

    const fillColor = isActive ? 0x2a1a00 : 0x1a1a2e;
    this.background.fillStyle(fillColor, 0.95);
    this.background.fillRoundedRect(-w / 2, -h / 2, w, h, radius);

    this.background.lineStyle(1, 0xffffff, 0.15);
    this.background.strokeRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, radius - 2);
  }

  /** Вызывать из GameScene.update, когда кнопка видима */
  public refresh(): void {
    if (!this.isVisible) return;
    this.updateVisuals();
  }

  private updateVisuals(): void {
    const state = this.lassoController.getState();
    this.currentPhase = state.phase;

    if (state.cooldownRemaining > 0 && state.phase === 'IDLE') {
      this.showCooldown(state.cooldownRemaining);
      return;
    }

    this.cooldownOverlay.setVisible(false);
    this.cooldownText.setVisible(false);
    this.iconText.setAlpha(1);

    switch (state.phase) {
      case 'IDLE': {
        const canActivate = this.currentCap ? this.lassoController.canActivate(this.currentCap) : false;

        if (canActivate) {
          this.drawBackground(this.COLOR_READY, false);
          this.statusText.setText('LASSO');
          this.statusText.setColor('#a855f7');
          this.startPulse();
        } else {
          this.drawBackground(this.COLOR_COOLDOWN, false);
          this.statusText.setText('TOO CLOSE');
          this.statusText.setColor('#666666');
          this.stopPulse();
        }
        break;
      }

      case 'CAPTURING': {
        this.drawBackground(this.COLOR_ACTIVE, true);
        this.statusText.setText('CATCHING...');
        this.statusText.setColor('#ffdd44');
        this.stopPulse();
        this.glowEffect.setFillStyle(this.COLOR_ACTIVE, 0.25);
        break;
      }

      case 'SWINGING': {
        this.drawBackground(this.COLOR_ACTIVE, true);
        this.statusText.setText('RELEASE!');
        this.statusText.setColor('#ff8800');
        this.stopPulse();
        this.iconText.setAlpha(Math.sin(Date.now() / 200) * 0.4 + 0.6);
        break;
      }

      default:
        break;
    }
  }

  private showCooldown(seconds: number): void {
    this.stopPulse();

    this.cooldownOverlay.clear();
    this.cooldownOverlay.fillStyle(0x000000, 0.7);
    this.cooldownOverlay.fillRoundedRect(-this.WIDTH / 2, -this.HEIGHT / 2, this.WIDTH, this.HEIGHT, 12);
    this.cooldownOverlay.setVisible(true);

    this.cooldownText.setText(seconds.toString());
    this.cooldownText.setVisible(true);
    this.iconText.setAlpha(0.3);
    this.drawBackground(this.COLOR_COOLDOWN, false);
    this.statusText.setText('COOLDOWN');
    this.statusText.setColor('#666666');
  }

  private onHover(): void {
    if (this.currentPhase === 'IDLE') {
      this.scene.tweens.add({
        targets: this.container,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
        ease: 'Cubic.easeOut',
      });
    }
  }

  private onHoverEnd(): void {
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1,
      scaleY: 1,
      duration: 100,
      ease: 'Cubic.easeOut',
    });
  }

  private onPress(): void {
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 0.95,
      scaleY: 0.95,
      duration: 50,
    });
  }

  private onClick(): void {
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1,
      scaleY: 1,
      duration: 100,
    });

    const state = this.lassoController.getState();

    if (state.phase === 'SWINGING') {
      this.lassoController.release();
      this.config.onRelease?.();
      this.playReleaseEffect();
      return;
    }

    if (state.phase === 'IDLE') {
      if (state.cooldownRemaining > 0) {
        this.playShakeEffect();
        return;
      }

      if (!this.currentCap) {
        this.playShakeEffect();
        return;
      }

      const success = this.lassoController.activate(this.currentCap);
      if (success) {
        this.config.onActivate?.();
        this.playActivationEffect();
      } else {
        this.playShakeEffect();
      }
    }
  }

  private playActivationEffect(): void {
    const ripple = this.scene.add.circle(this.container.x, this.container.y, this.WIDTH / 2, this.COLOR_ACTIVE, 0.5);
    ripple.setDepth(199).setBlendMode(Phaser.BlendModes.ADD).setScrollFactor(0);

    this.scene.tweens.add({
      targets: ripple,
      scale: 2,
      alpha: 0,
      duration: 300,
      onComplete: () => ripple.destroy(),
    });
  }

  private playReleaseEffect(): void {
    this.scene.cameras.main.shake(80, 0.005);
  }

  private playShakeEffect(): void {
    const startX = this.container.x;
    this.scene.tweens.add({
      targets: this.container,
      x: startX - 5,
      duration: 50,
      yoyo: true,
      repeat: 3,
      onComplete: () => this.container.setX(startX),
    });
  }

  private startPulse(): void {
    if (this.pulseEffect) return;

    this.glowEffect.setFillStyle(this.COLOR_READY, 0.35);
    this.pulseEffect = this.scene.tweens.add({
      targets: this.glowEffect,
      alpha: { from: 0.15, to: 0.45 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private stopPulse(): void {
    if (this.pulseEffect) {
      this.pulseEffect.stop();
      this.pulseEffect = undefined;
    }
    this.glowEffect.setAlpha(1);
    this.glowEffect.setFillStyle(this.COLOR_READY, 0);
  }

  public show(x: number, y: number): void {
    if (this.isVisible) {
      this.container.setPosition(x, y);
      this.updateVisuals();
      return;
    }

    this.container.setPosition(x, y);
    this.container.setVisible(true);
    this.container.setScale(0.5);
    this.container.setAlpha(0);

    this.updateVisuals();

    this.scene.tweens.add({
      targets: this.container,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

    this.isVisible = true;
  }

  public hide(): void {
    if (!this.isVisible) return;

    if (this.lassoController.isActive()) {
      this.lassoController.cancel();
    }

    this.stopPulse();

    this.scene.tweens.add({
      targets: this.container,
      scale: 0.5,
      alpha: 0,
      duration: 150,
      ease: 'Cubic.easeIn',
      onComplete: () => this.container.setVisible(false),
    });

    this.isVisible = false;
  }

  public setCurrentCap(cap: GameUnit | null): void {
    this.currentCap = cap;
    this.lassoController.setAttachedCap(cap);
  }

  public isShowing(): boolean {
    return this.isVisible;
  }

  public reposition(x: number, y: number): void {
    if (!this.isVisible) return;
    this.container.setPosition(x, y);
  }

  public destroy(): void {
    this.stopPulse();
    this.container.destroy();
  }
}
