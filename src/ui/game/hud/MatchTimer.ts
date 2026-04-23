// src/ui/game/hud/MatchTimer.ts
// Компонент таймера матча

import Phaser from 'phaser';
import { getFonts, getColors } from '../../../config/themes';

export interface MatchTimerConfig {
  /** Начальное время в секундах */
  initialTime: number;
  
  /** Показывать иконку */
  showIcon?: boolean;
}

export class MatchTimer {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private timerText: Phaser.GameObjects.Text;
  
  private remainingTime: number;
  private totalTime: number;

  constructor(scene: Phaser.Scene, x: number, y: number, config: MatchTimerConfig) {
    this.scene = scene;
    this.remainingTime = config.initialTime;
    this.totalTime = config.initialTime;
    
    this.container = scene.add.container(x, y).setDepth(101);
    this.timerText = this.createTimer(config);
  }

  private createTimer(config: MatchTimerConfig): Phaser.GameObjects.Text {
    const colors = getColors();
    const fonts = getFonts();

    // Фон
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRoundedRect(-50, -12, 100, 24, 12);
    bg.lineStyle(1, colors.uiAccent, 0.4);
    bg.strokeRoundedRect(-50, -12, 100, 24, 12);
    this.container.add(bg);

    // Иконка
    if (config.showIcon !== false) {
      const icon = this.scene.add
        .text(-35, 0, '⏱️', { fontSize: '12px' })
        .setOrigin(0.5);
      this.container.add(icon);
    }

    // Текст времени
    const timeText = this.formatTime(this.remainingTime);
    const text = this.scene.add
      .text(5, 0, timeText, {
        fontSize: '14px',
        fontFamily: fonts.tech,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    this.container.add(text);

    return text;
  }

  // ========== PUBLIC API ==========

  update(remainingTime: number, totalTime?: number): void {
    this.remainingTime = remainingTime;
    if (totalTime !== undefined) {
      this.totalTime = totalTime;
    }

    this.timerText.setText(this.formatTime(remainingTime));
    this.updateColor(remainingTime);
  }

  private updateColor(remainingTime: number): void {
    if (remainingTime <= 30) {
      this.timerText.setColor('#ff4444');
      
      // Пульсация в последние 10 секунд
      if (remainingTime <= 10 && remainingTime > 0) {
        this.scene.tweens.add({
          targets: this.timerText,
          scale: { from: 1, to: 1.25 },
          duration: 250,
          yoyo: true,
        });
      }
    } else if (remainingTime <= 60) {
      this.timerText.setColor('#ffaa00');
    } else {
      this.timerText.setColor('#ffffff');
    }
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  getRemainingTime(): number {
    return this.remainingTime;
  }

  getTotalTime(): number {
    return this.totalTime;
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  destroy(): void {
    this.container.destroy();
  }
}