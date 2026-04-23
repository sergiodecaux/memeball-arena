// src/ui/game/ReconnectionOverlay.ts
// ✅ 2.3: Окно переподключения для PVP

import Phaser from 'phaser';

export class ReconnectionOverlay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Rectangle;
  private titleText: Phaser.GameObjects.Text;
  private statusText: Phaser.GameObjects.Text;
  private progressBar?: Phaser.GameObjects.Graphics;
  private isVisible = false;
  private reconnectAttempts = 0;
  private maxAttempts = 5;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const { width, height } = scene.cameras.main;
    
    this.container = scene.add.container(width / 2, height / 2).setDepth(300).setScrollFactor(0);
    this.container.setVisible(false);
    
    // Фон с затемнением
    this.background = scene.add.rectangle(0, 0, width, height, 0x000000, 0.7);
    this.container.add(this.background);
    
    // Панель
    const panel = scene.add.rectangle(0, 0, 400, 200, 0x1a1a1a, 0.95);
    panel.setStrokeStyle(2, 0xffffff);
    this.container.add(panel);
    
    // Заголовок
    this.titleText = scene.add.text(0, -60, 'Connection Lost', {
      fontSize: '24px',
      color: '#ffaa00',
      fontFamily: 'Arial',
    }).setOrigin(0.5);
    this.container.add(this.titleText);
    
    // Статус
    this.statusText = scene.add.text(0, 0, 'Attempting to reconnect...', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Arial',
    }).setOrigin(0.5);
    this.container.add(this.statusText);
    
    // Прогресс-бар
    this.progressBar = scene.add.graphics();
    this.container.add(this.progressBar);
  }

  show(): void {
    this.isVisible = true;
    this.container.setVisible(true);
    this.updateStatus('Attempting to reconnect...', 0);
  }

  hide(): void {
    this.isVisible = false;
    this.container.setVisible(false);
    this.reconnectAttempts = 0;
  }

  updateStatus(message: string, progress: number): void {
    this.statusText.setText(message);
    
    // Обновляем прогресс-бар
    this.progressBar?.clear();
    this.progressBar?.fillStyle(0x00ff00);
    this.progressBar?.fillRect(-150, 40, 300 * progress, 8);
    this.progressBar?.lineStyle(2, 0xffffff);
    this.progressBar?.strokeRect(-150, 40, 300, 8);
  }

  setReconnectAttempt(attempt: number, maxAttempts: number): void {
    this.reconnectAttempts = attempt;
    this.maxAttempts = maxAttempts;
    const progress = attempt / maxAttempts;
    this.updateStatus(`Reconnecting... (${attempt}/${maxAttempts})`, progress);
  }

  setWaitingForOpponent(): void {
    this.updateStatus('Waiting for opponent to reconnect...', 0.5);
  }

  setReconnected(): void {
    this.updateStatus('Reconnected! Resuming game...', 1);
    this.scene.time.delayedCall(1000, () => {
      this.hide();
    });
  }

  setFailed(): void {
    this.titleText.setText('Connection Failed');
    this.titleText.setColor('#ff0000');
    this.updateStatus('Unable to reconnect. Returning to menu...', 1);
  }

  isShowing(): boolean {
    return this.isVisible;
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
