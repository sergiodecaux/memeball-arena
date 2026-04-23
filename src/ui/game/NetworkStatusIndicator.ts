// src/ui/game/NetworkStatusIndicator.ts
// ✅ 2.1: Индикатор сетевого состояния для PVP

import Phaser from 'phaser';

export interface NetworkMetrics {
  rtt: number;
  jitter: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  isConnected: boolean;
}

export class NetworkStatusIndicator {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private pingText: Phaser.GameObjects.Text;
  private qualityIndicator: Phaser.GameObjects.Graphics;
  private warningText?: Phaser.GameObjects.Text;
  
  private currentMetrics: NetworkMetrics = {
    rtt: 0,
    jitter: 0,
    quality: 'excellent',
    isConnected: true,
  };

  private readonly COLORS = {
    excellent: 0x00ff00, // Зеленый
    good: 0x88ff00,      // Желто-зеленый
    fair: 0xffaa00,     // Оранжевый
    poor: 0xff0000,     // Красный
  };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.scene = scene;
    
    this.container = scene.add.container(x, y).setDepth(200).setScrollFactor(0);
    
    // Индикатор качества соединения (кружок)
    this.qualityIndicator = scene.add.graphics();
    this.container.add(this.qualityIndicator);
    
    // Текст с ping
    this.pingText = scene.add.text(25, 0, 'Ping: --ms', {
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0, 0.5);
    this.container.add(this.pingText);
    
    this.updateIndicator();
  }

  updateMetrics(metrics: Partial<NetworkMetrics>): void {
    this.currentMetrics = { ...this.currentMetrics, ...metrics };
    this.updateIndicator();
  }

  private updateIndicator(): void {
    const { rtt, jitter, quality, isConnected } = this.currentMetrics;
    
    // Обновляем цвет индикатора
    this.qualityIndicator.clear();
    const color = this.COLORS[quality];
    
    if (!isConnected) {
      // Серый при отключении
      this.qualityIndicator.fillStyle(0x888888);
    } else {
      this.qualityIndicator.fillStyle(color);
    }
    
    this.qualityIndicator.fillCircle(0, 0, 8);
    
    // Обновляем текст ping
    if (isConnected) {
      this.pingText.setText(`Ping: ${Math.round(rtt)}ms`);
      this.pingText.setColor('#ffffff');
    } else {
      this.pingText.setText('Disconnected');
      this.pingText.setColor('#ff0000');
    }
    
    // Показываем предупреждение при плохом соединении
    if (quality === 'poor' && isConnected) {
      this.showWarning('High latency detected!');
    } else if (rtt > 300 && isConnected) {
      this.showWarning('Connection unstable');
    } else {
      this.hideWarning();
    }
  }

  private showWarning(text: string): void {
    if (!this.warningText) {
      this.warningText = this.scene.add.text(0, 25, text, {
        fontSize: '12px',
        color: '#ffaa00',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5, 0).setDepth(201);
      this.container.add(this.warningText);
    } else {
      this.warningText.setText(text);
      this.warningText.setVisible(true);
    }
  }

  private hideWarning(): void {
    if (this.warningText) {
      this.warningText.setVisible(false);
    }
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
