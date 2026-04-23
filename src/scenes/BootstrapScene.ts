// src/scenes/BootstrapScene.ts
// Instant loading screen - no external assets required

import Phaser from 'phaser';

export class BootstrapScene extends Phaser.Scene {
  private progressBarBg?: Phaser.GameObjects.Rectangle;
  private progressBarFill?: Phaser.GameObjects.Rectangle;
  private progressText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'BootstrapScene' });
  }

  create(): void {
    const { centerX, centerY, width, height } = this.cameras.main;

    // Dark background
    this.add.rectangle(centerX, centerY, width, height, 0x0a0a12);

    // Title
    this.add.text(centerX, centerY - 80, 'GALAXY LEAGUE', {
      fontFamily: 'Arial Black',
      fontSize: '32px',
      color: '#00f2ff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Status text
    this.statusText = this.add.text(centerX, centerY - 30, 'Initializing...', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Progress bar background
    const barWidth = Math.min(300, width * 0.7);
    const barHeight = 8;
    this.progressBarBg = this.add.rectangle(centerX, centerY + 20, barWidth, barHeight, 0x333333);
    this.progressBarBg.setStrokeStyle(1, 0x666666);

    // Progress bar fill
    this.progressBarFill = this.add.rectangle(
      centerX - barWidth / 2,
      centerY + 20,
      0,
      barHeight,
      0x00f2ff
    );
    this.progressBarFill.setOrigin(0, 0.5);

    // Progress text
    this.progressText = this.add.text(centerX, centerY + 50, '0%', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // Simple spinner (using graphics)
    const spinner = this.add.graphics();
    spinner.lineStyle(3, 0x00f2ff, 1);
    spinner.arc(centerX, centerY + 100, 20, 0, Math.PI * 2);
    spinner.strokePath();

    // Animate spinner
    this.tweens.add({
      targets: spinner,
      rotation: Math.PI * 2,
      duration: 1000,
      repeat: -1,
      ease: 'Linear',
    });

    // Immediately start PreloadScene
    this.scene.start('PreloadScene');
  }

  // This method can be called from PreloadScene to update progress
  updateProgress(progress: number, status?: string): void {
    if (this.progressBarFill && this.progressBarBg) {
      const barWidth = this.progressBarBg.width;
      this.progressBarFill.width = barWidth * Phaser.Math.Clamp(progress, 0, 1);
    }
    if (this.progressText) {
      this.progressText.setText(`${Math.round(progress * 100)}%`);
    }
    if (this.statusText && status) {
      this.statusText.setText(status);
    }
  }
}

