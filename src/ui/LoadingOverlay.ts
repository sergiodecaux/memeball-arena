// src/ui/LoadingOverlay.ts
// Reusable loading overlay with progress bar

import Phaser from 'phaser';

export class LoadingOverlay {
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Rectangle;
  private progressBarBg: Phaser.GameObjects.Rectangle;
  private progressBarFill: Phaser.GameObjects.Rectangle;
  private textLabel: Phaser.GameObjects.Text;
  private subtextLabel?: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const { centerX, centerY, width, height } = scene.cameras.main;

    this.container = scene.add.container(centerX, centerY);

    // Dark background with slight transparency
    this.background = scene.add.rectangle(0, 0, width, height, 0x000000, 0.8);
    this.container.add(this.background);

    // Progress bar background
    const barWidth = Math.min(300, width * 0.7);
    const barHeight = 8;
    this.progressBarBg = scene.add.rectangle(0, 20, barWidth, barHeight, 0x333333);
    this.progressBarBg.setStrokeStyle(1, 0x666666);
    this.container.add(this.progressBarBg);

    // Progress bar fill
    this.progressBarFill = scene.add.rectangle(
      -barWidth / 2,
      20,
      0,
      barHeight,
      0x00f2ff
    );
    this.progressBarFill.setOrigin(0, 0.5);
    this.container.add(this.progressBarFill);

    // Main text label
    this.textLabel = scene.add.text(0, -20, 'Loading...', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.textLabel.setOrigin(0.5);
    this.container.add(this.textLabel);

    // Subtext (optional, for current file name)
    this.subtextLabel = scene.add.text(0, 50, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#aaaaaa',
    });
    this.subtextLabel.setOrigin(0.5);
    this.subtextLabel.setVisible(false);
    this.container.add(this.subtextLabel);

    // Set depth to appear above everything
    this.container.setDepth(10000);
  }

  setProgress(value: number): void {
    // Clamp to 0-1
    const clamped = Phaser.Math.Clamp(value, 0, 1);
    
    const barWidth = this.progressBarBg.width;
    this.progressBarFill.width = barWidth * clamped;
  }

  setText(text: string): void {
    this.textLabel.setText(text);
  }

  setSubtext(text: string): void {
    if (this.subtextLabel) {
      this.subtextLabel.setText(text);
      this.subtextLabel.setVisible(text.length > 0);
    }
  }

  destroy(): void {
    this.container.destroy();
  }
}

