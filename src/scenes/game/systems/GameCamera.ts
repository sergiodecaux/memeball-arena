// src/scenes/game/systems/GameCamera.ts
// Система управления камерой для GameScene

import Phaser from 'phaser';
import { FieldBounds } from '../../../types';

export interface GameCameraConfig {
  scene: Phaser.Scene;
  fieldBounds: FieldBounds;
}

/**
 * Система управления камерой
 * Отвечает за позиционирование, эффекты, ресайз
 */
export class GameCamera {
  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private fieldBounds: FieldBounds;
  
  // UI элементы для ресайза
  private cardPanel?: Phaser.GameObjects.Container;
  private gameHUD?: any;
  
  constructor(config: GameCameraConfig) {
    this.scene = config.scene;
    this.camera = config.scene.cameras.main;
    this.fieldBounds = config.fieldBounds;
  }
  
  /**
   * Инициализация камеры
   */
  setup(): void {
    this.centerOnField();
    this.setupResizeHandler();
  }
  
  /**
   * Центрирование камеры на поле
   */
  centerOnField(): void {
    this.camera.centerOn(this.fieldBounds.centerX, this.fieldBounds.centerY);
  }
  
  /**
   * Настройка обработчика ресайза
   */
  private setupResizeHandler(): void {
    this.scene.scale.on('resize', this.handleResize, this);
  }
  
  /**
   * Обработка ресайза
   */
  private handleResize(): void {
    this.centerOnField();
    
    // Обновляем позицию панели карточек
    if (this.cardPanel) {
      const { width, height } = this.camera;
      this.cardPanel.setPosition(width / 2, height - 80);
    }
    
    // Обновляем HUD
    if (this.gameHUD?.updateLayout) {
      this.gameHUD.updateLayout();
    }
  }
  
  /**
   * Регистрация панели карточек для ресайза
   */
  registerCardPanel(cardPanel: Phaser.GameObjects.Container): void {
    this.cardPanel = cardPanel;
  }
  
  /**
   * Регистрация HUD для ресайза
   */
  registerHUD(gameHUD: any): void {
    this.gameHUD = gameHUD;
  }
  
  /**
   * Следование за объектом
   */
  follow(target: Phaser.GameObjects.GameObject, lerp: number = 0.1): void {
    this.camera.startFollow(target, true, lerp, lerp);
  }
  
  /**
   * Остановка следования
   */
  stopFollow(): void {
    this.camera.stopFollow();
  }
  
  /**
   * Эффект тряски камеры
   */
  shake(duration: number = 200, intensity: number = 0.005): void {
    this.camera.shake(duration, intensity);
  }
  
  /**
   * Эффект вспышки
   */
  flash(duration: number = 200, red: number = 255, green: number = 255, blue: number = 255): void {
    this.camera.flash(duration, red, green, blue);
  }
  
  /**
   * Эффект затемнения
   */
  fade(duration: number = 500, red: number = 0, green: number = 0, blue: number = 0): void {
    this.camera.fade(duration, red, green, blue);
  }
  
  /**
   * Зум камеры
   */
  setZoom(zoom: number, duration?: number): void {
    if (duration) {
      this.scene.tweens.add({
        targets: this.camera,
        zoom: zoom,
        duration: duration,
        ease: 'Cubic.easeInOut',
      });
    } else {
      this.camera.setZoom(zoom);
    }
  }
  
  /**
   * Получение текущего зума
   */
  getZoom(): number {
    return this.camera.zoom;
  }
  
  /**
   * Панорамирование к точке
   */
  panTo(x: number, y: number, duration: number = 1000): void {
    this.scene.tweens.add({
      targets: this.camera,
      scrollX: x - this.camera.width / 2,
      scrollY: y - this.camera.height / 2,
      duration: duration,
      ease: 'Cubic.easeInOut',
    });
  }
  
  /**
   * Установка границ камеры
   */
  setBounds(x: number, y: number, width: number, height: number): void {
    this.camera.setBounds(x, y, width, height);
  }
  
  /**
   * Получение видимых границ
   */
  getWorldView(): Phaser.Geom.Rectangle {
    return this.camera.worldView;
  }
  
  /**
   * Проверка видимости объекта
   */
  isVisible(x: number, y: number, width: number = 0, height: number = 0): boolean {
    const worldView = this.camera.worldView;
    return Phaser.Geom.Rectangle.Overlaps(
      worldView,
      new Phaser.Geom.Rectangle(x, y, width, height)
    );
  }
  
  /**
   * Конвертация экранных координат в мировые
   */
  screenToWorld(screenX: number, screenY: number): Phaser.Math.Vector2 {
    return this.camera.getWorldPoint(screenX, screenY);
  }
  
  /**
   * Конвертация мировых координат в экранные
   */
  worldToScreen(worldX: number, worldY: number): Phaser.Math.Vector2 {
    // Используем worldToScreen вместо getScreenPoint
    const worldView = this.camera.worldView;
    const x = (worldX - worldView.x) * this.camera.zoom;
    const y = (worldY - worldView.y) * this.camera.zoom;
    return new Phaser.Math.Vector2(x, y);
  }
  
  /**
   * Получение размеров камеры
   */
  getSize(): { width: number; height: number } {
    return {
      width: this.camera.width,
      height: this.camera.height,
    };
  }
  
  /**
   * Получение центра камеры
   */
  getCenter(): { x: number; y: number } {
    return {
      x: this.camera.centerX,
      y: this.camera.centerY,
    };
  }
  
  /**
   * Сброс эффектов камеры
   */
  resetEffects(): void {
    this.camera.resetFX();
  }
  
  /**
   * Очистка
   */
  cleanup(): void {
    this.scene.scale.off('resize', this.handleResize, this);
    this.stopFollow();
    this.resetEffects();
  }
}
