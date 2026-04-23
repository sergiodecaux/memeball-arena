// src/scenes/shop/animations/BoosterAnimation.ts
// Анимация открытия бустера (упрощённая версия)

import Phaser from 'phaser';
import { AudioManager } from '../../../managers/AudioManager';

export interface BoosterAnimationConfig {
  scene: Phaser.Scene;
  boosterId: string;
  onComplete: (cards: any[]) => void;
}

/**
 * Анимация открытия бустера
 */
export class BoosterAnimation {
  private scene: Phaser.Scene;
  private config: BoosterAnimationConfig;
  private overlay?: Phaser.GameObjects.Container;
  
  constructor(config: BoosterAnimationConfig) {
    this.scene = config.scene;
    this.config = config;
  }
  
  /**
   * Запуск анимации
   */
  play(): void {
    console.log('[BoosterAnimation] Playing booster animation:', this.config.boosterId);
    
    // Простая заглушка
    AudioManager.getInstance().playSFX('sfx_click');
    
    // Через секунду завершаем
    this.scene.time.delayedCall(1000, () => {
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
