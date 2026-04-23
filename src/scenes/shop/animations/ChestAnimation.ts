// src/scenes/shop/animations/ChestAnimation.ts
// Анимация открытия сундука (упрощённая версия)

import Phaser from 'phaser';
import { AudioManager } from '../../../managers/AudioManager';

export interface ChestAnimationConfig {
  scene: Phaser.Scene;
  chestId: string;
  onComplete: (rewards: any[]) => void;
}

/**
 * Анимация открытия сундука
 */
export class ChestAnimation {
  private scene: Phaser.Scene;
  private config: ChestAnimationConfig;
  private overlay?: Phaser.GameObjects.Container;
  
  constructor(config: ChestAnimationConfig) {
    this.scene = config.scene;
    this.config = config;
  }
  
  /**
   * Запуск анимации
   */
  play(): void {
    console.log('[ChestAnimation] Playing chest animation:', this.config.chestId);
    
    // Создаём блокирующий overlay на время анимации
    const blocker = this.scene.add.rectangle(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.centerY,
      this.scene.cameras.main.width,
      this.scene.cameras.main.height,
      0x000000, 0
    );
    blocker.setInteractive();
    blocker.setDepth(9999);
    
    // Блокируем все касания
    blocker.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.event) {
        pointer.event.preventDefault();
        pointer.event.stopPropagation();
      }
    });
    
    AudioManager.getInstance().playSFX('sfx_click');
    
    // Через секунду завершаем и убираем блокер
    this.scene.time.delayedCall(1000, () => {
      blocker.destroy();
      this.config.onComplete([]);
    });
  }
  
  /**
   * Очистка
   */
  cleanup(): void {
    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = undefined;
    }
  }
}
