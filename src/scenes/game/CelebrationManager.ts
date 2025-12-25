// src/scenes/game/CelebrationManager.ts

import Phaser from 'phaser';
import { FactionId, FACTIONS, FactionArena } from '../../constants/gameConstants';

export interface CelebrationConfig {
  useFactions?: boolean;
  playerFaction?: FactionId;
  currentArena?: FactionArena;
}

export class CelebrationManager {
  private scene: Phaser.Scene;
  private container?: Phaser.GameObjects.Container;
  private config: CelebrationConfig;

  constructor(scene: Phaser.Scene, config: CelebrationConfig = {}) {
    this.scene = scene;
    this.config = config;
  }

  showGoalCelebration(isMyGoal: boolean): void {
    const { width, height } = this.scene.scale;
    this.container = this.scene.add.container(0, 0).setDepth(1000);

    // Overlay
    const overlay = this.scene.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.6
    );
    this.container.add(overlay);

    // Goal text
    const goalText = this.scene.add
      .text(width / 2, height / 2 - 60, '⚽ GOAL! ⚽', {
        fontSize: '56px',
        fontFamily: 'Arial Black',
        color: '#FFD700',
        stroke: '#000000',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScale(0);
    this.container.add(goalText);

    // Sub text
    const subText = this.scene.add
      .text(
        width / 2,
        height / 2 + 20,
        isMyGoal ? 'You scored!' : 'Opponent scored!',
        {
          fontSize: '28px',
          fontFamily: 'Arial',
          color: isMyGoal ? '#00FF00' : '#FF6B6B',
          stroke: '#000000',
          strokeThickness: 4,
        }
      )
      .setOrigin(0.5)
      .setAlpha(0);
    this.container.add(subText);

    // Animations
    this.scene.tweens.add({
      targets: goalText,
      scale: 1,
      duration: 400,
      ease: 'Back.easeOut',
    });

    this.scene.tweens.add({
      targets: subText,
      alpha: 1,
      y: height / 2 + 30,
      duration: 300,
      delay: 300,
    });

    if (isMyGoal) {
      this.createConfetti();
    }
  }

  private createConfetti(): void {
    const { width } = this.scene.scale;

    let colors: number[];
    if (this.config.useFactions && this.config.currentArena) {
      colors = [
        this.config.currentArena.lineColor,
        this.config.currentArena.goalColor,
        FACTIONS[this.config.playerFaction!].color,
        FACTIONS[this.config.playerFaction!].colorSecondary,
        0xffd700,
        0xffffff,
      ];
    } else if (this.config.useFactions && this.config.playerFaction) {
      const faction = FACTIONS[this.config.playerFaction];
      colors = [faction.color, faction.colorSecondary, 0xffd700, 0xffffff];
    } else {
      colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xffd700];
    }

    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(50, width - 50);
      const particle = this.scene.add
        .rectangle(
          x,
          -20,
          Phaser.Math.Between(6, 12),
          Phaser.Math.Between(6, 12),
          Phaser.Math.RND.pick(colors)
        )
        .setDepth(1001)
        .setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));

      this.container?.add(particle);

      this.scene.tweens.add({
        targets: particle,
        y: this.scene.scale.height + 50,
        x: x + Phaser.Math.Between(-80, 80),
        rotation: particle.rotation + Phaser.Math.FloatBetween(Math.PI * 2, Math.PI * 6),
        duration: Phaser.Math.Between(1500, 2500),
        delay: Phaser.Math.Between(0, 300),
      });
    }
  }

  hide(onComplete?: () => void): void {
    if (!this.container) {
      onComplete?.();
      return;
    }

    this.scene.tweens.add({
      targets: this.container.list,
      alpha: 0,
      duration: 400,
      onComplete: () => {
        this.container?.destroy(true);
        this.container = undefined;
        onComplete?.();
      },
    });
  }

  destroy(): void {
    this.container?.destroy(true);
    this.container = undefined;
  }

  isActive(): boolean {
    return !!this.container;
  }

  updateConfig(config: Partial<CelebrationConfig>): void {
    this.config = { ...this.config, ...config };
  }
}