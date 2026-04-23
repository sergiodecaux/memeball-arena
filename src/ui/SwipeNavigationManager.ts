// ✅ ИЗМЕНЕНО: Добавлена опция canSwipe для блокировки свайпа во время drag-and-drop

import Phaser from 'phaser';

export interface SwipeNavigationConfig {
  onBack: () => void;
  edgeZoneWidth?: number;
  thresholdPercent?: number;
  velocityThreshold?: number;
  enabled?: boolean;
  /** Функция проверки, можно ли сейчас свайпать (для блокировки во время drag-and-drop) */
  canSwipe?: () => boolean;
}

interface SwipeState {
  isActive: boolean;
  startX: number;
  startY: number;
  startTime: number;
  currentX: number;
  pointerId: number | null;
}

export class SwipeNavigationManager {
  private scene: Phaser.Scene;
  private config: Required<SwipeNavigationConfig>;
  private state: SwipeState;
  
  // Визуальные элементы
  private edgeIndicator?: Phaser.GameObjects.Graphics;
  private swipeOverlay?: Phaser.GameObjects.Graphics;
  private shadowGraphics?: Phaser.GameObjects.Graphics;
  private backLabel?: Phaser.GameObjects.Container;
  private pulseTimer?: Phaser.Time.TimerEvent;
  
  // Размеры экрана
  private screenWidth: number;
  private screenHeight: number;
  
  // Флаги
  private isEnabled: boolean = false;
  private isDestroyed: boolean = false;

  constructor(scene: Phaser.Scene, config: SwipeNavigationConfig) {
    this.scene = scene;
    this.screenWidth = scene.cameras.main.width;
    this.screenHeight = scene.cameras.main.height;
    
    this.config = {
      onBack: config.onBack,
      edgeZoneWidth: config.edgeZoneWidth ?? 25,
      thresholdPercent: config.thresholdPercent ?? 0.3,
      velocityThreshold: config.velocityThreshold ?? 800,
      enabled: config.enabled ?? true,
      canSwipe: config.canSwipe ?? (() => true),
    };
    
    this.state = {
      isActive: false,
      startX: 0,
      startY: 0,
      startTime: 0,
      currentX: 0,
      pointerId: null,
    };
    
    this.createVisuals();
    
    if (this.config.enabled) {
      this.enable();
    }
  }

  private createVisuals(): void {
    // Индикатор у левого края (тонкая полоска)
    this.edgeIndicator = this.scene.add.graphics();
    this.edgeIndicator.setDepth(100);
    this.drawEdgeIndicator(0.25);
    
    // Оверлей затемнения (изначально невидим)
    this.swipeOverlay = this.scene.add.graphics();
    this.swipeOverlay.setDepth(99);
    this.swipeOverlay.setAlpha(0);
    
    // Тень от "съезжающего" экрана
    this.shadowGraphics = this.scene.add.graphics();
    this.shadowGraphics.setDepth(98);
    this.shadowGraphics.setAlpha(0);
    
    // Лейбл "← Back"
    this.createBackLabel();
    
    // Пульсация индикатора
    this.startPulseAnimation();
  }

  private drawEdgeIndicator(alpha: number): void {
    if (!this.edgeIndicator) return;
    
    this.edgeIndicator.clear();
    
    const topInset = this.getTopInset();
    const bottomInset = this.getBottomInset();
    const indicatorHeight = this.screenHeight - topInset - bottomInset - 100;
    const y = topInset + 50;
    
    // Градиент от яркого к прозрачному
    const segments = 8;
    const segmentWidth = 3;
    
    for (let i = 0; i < segments; i++) {
      const segmentAlpha = alpha * (1 - i / segments) * 0.8;
      this.edgeIndicator.fillStyle(0x00f2ff, segmentAlpha);
      this.edgeIndicator.fillRect(i * segmentWidth, y, segmentWidth, indicatorHeight);
    }
    
    // Яркая линия у самого края
    this.edgeIndicator.fillStyle(0x00f2ff, alpha);
    this.edgeIndicator.fillRoundedRect(2, y, 3, indicatorHeight, 1.5);
  }

  private createBackLabel(): void {
    this.backLabel = this.scene.add.container(60, this.screenHeight / 2);
    this.backLabel.setDepth(101);
    this.backLabel.setAlpha(0);
    
    // Фон
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0a15, 0.9);
    bg.fillRoundedRect(-50, -20, 100, 40, 20);
    bg.lineStyle(1.5, 0x00f2ff, 0.5);
    bg.strokeRoundedRect(-50, -20, 100, 40, 20);
    this.backLabel.add(bg);
    
    // Стрелка
    const arrow = this.scene.add.text(-35, 0, '◀', {
      fontSize: '18px',
      color: '#00f2ff',
    }).setOrigin(0.5);
    this.backLabel.add(arrow);
    
    // Текст
    const text = this.scene.add.text(5, 0, 'BACK', {
      fontSize: '14px',
      fontFamily: 'Orbitron, sans-serif',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.backLabel.add(text);
  }

  private startPulseAnimation(): void {
    if (this.isDestroyed) return;
    
    let pulseAlpha = 0.25;
    let increasing = true;
    
    this.pulseTimer = this.scene.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        if (this.isDestroyed || this.state.isActive) return;
        
        if (increasing) {
          pulseAlpha += 0.01;
          if (pulseAlpha >= 0.4) increasing = false;
        } else {
          pulseAlpha -= 0.01;
          if (pulseAlpha <= 0.2) increasing = true;
        }
        
        this.drawEdgeIndicator(pulseAlpha);
      },
    });
  }

  private getTopInset(): number {
    const registry = this.scene.game.registry;
    return registry.get('safeAreaTopInset') || 0;
  }

  private getBottomInset(): number {
    const registry = this.scene.game.registry;
    return registry.get('safeAreaBottomInset') || 0;
  }

  public enable(): void {
    if (this.isEnabled || this.isDestroyed) return;
    this.isEnabled = true;
    
    this.scene.input.on('pointerdown', this.onPointerDown, this);
    this.scene.input.on('pointermove', this.onPointerMove, this);
    this.scene.input.on('pointerup', this.onPointerUp, this);
    this.scene.input.on('pointerupoutside', this.onPointerUp, this);
    
    this.edgeIndicator?.setVisible(true);
  }

  public disable(): void {
    if (!this.isEnabled || this.isDestroyed) return;
    this.isEnabled = false;
    
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointerupoutside', this.onPointerUp, this);
    
    this.cancelSwipe();
    this.edgeIndicator?.setVisible(false);
  }

  private onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    // Блокируем только начало (чтобы не запускались нативные жесты/refresh)
    if (pointer.event) {
      pointer.event.preventDefault();
    }
    
    if (!this.isEnabled || this.state.isActive) return;
    
    // ✅ ДОБАВЛЕНО: Проверяем canSwipe перед началом свайпа
    if (!this.config.canSwipe()) {
      return;
    }
    
    // Проверяем, что касание в зоне левого края
    if (pointer.x <= this.config.edgeZoneWidth) {
      this.state = {
        isActive: true,
        startX: pointer.x,
        startY: pointer.y,
        startTime: Date.now(),
        currentX: pointer.x,
        pointerId: pointer.id,
      };
      
      // Хаптика начала
      this.triggerHaptic('selection');
      
      // Показываем начальное состояние
      this.drawEdgeIndicator(0.6);
    }
  };

  private onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.state.isActive || pointer.id !== this.state.pointerId) return;
    
    // ✅ ДОБАВЛЕНО: Проверяем canSwipe во время свайпа (на случай если drag начался)
    if (!this.config.canSwipe()) {
      this.cancelSwipe();
      return;
    }
    
    const deltaX = pointer.x - this.state.startX;
    
    // Игнорируем движение влево
    if (deltaX < 0) return;
    
    this.state.currentX = pointer.x;
    
    // Проверяем вертикальное отклонение (если слишком большое - отменяем)
    const deltaY = Math.abs(pointer.y - this.state.startY);
    if (deltaY > 100) {
      this.cancelSwipe();
      return;
    }
    
    // Прогресс свайпа (0-1)
    const progress = Math.min(deltaX / (this.screenWidth * this.config.thresholdPercent), 1);
    
    this.updateSwipeVisuals(progress, deltaX);
    
    // Хаптика при пересечении порога
    if (progress >= 1 && deltaX < this.screenWidth * this.config.thresholdPercent + 20) {
      this.triggerHaptic('light');
    }
  };

  private onPointerUp = (pointer: Phaser.Input.Pointer): void => {
    // ДОБАВИТЬ ЭТО:
    if (pointer.event) {
      pointer.event.preventDefault();
    }
    
    if (!this.state.isActive || pointer.id !== this.state.pointerId) return;
    
    const deltaX = pointer.x - this.state.startX;
    const deltaTime = Date.now() - this.state.startTime;
    const velocity = deltaX / (deltaTime / 1000); // px/sec
    
    const thresholdPx = this.screenWidth * this.config.thresholdPercent;
    
    // Проверяем условия срабатывания
    const passedThreshold = deltaX >= thresholdPx;
    const fastSwipe = velocity >= this.config.velocityThreshold && deltaX > 50;
    
    if (passedThreshold || fastSwipe) {
      this.completeSwipe();
    } else {
      this.cancelSwipe();
    }
  };

  private updateSwipeVisuals(progress: number, deltaX: number): void {
    // Затемнение
    if (this.swipeOverlay) {
      this.swipeOverlay.clear();
      this.swipeOverlay.fillStyle(0x000000, 0.4 * (1 - progress));
      this.swipeOverlay.fillRect(0, 0, this.screenWidth, this.screenHeight);
      this.swipeOverlay.setAlpha(progress);
    }
    
    // Тень
    if (this.shadowGraphics) {
      this.shadowGraphics.clear();
      const shadowX = deltaX - 20;
      
      // Градиентная тень
      for (let i = 0; i < 20; i++) {
        const alpha = (20 - i) / 20 * 0.3 * progress;
        this.shadowGraphics.fillStyle(0x000000, alpha);
        this.shadowGraphics.fillRect(shadowX + i, 0, 1, this.screenHeight);
      }
      this.shadowGraphics.setAlpha(1);
    }
    
    // Индикатор края
    this.drawEdgeIndicator(0.3 + progress * 0.5);
    
    // Лейбл "Back"
    if (this.backLabel) {
      this.backLabel.setAlpha(progress);
      this.backLabel.setX(40 + deltaX * 0.3);
    }
  }

  private completeSwipe(): void {
    this.triggerHaptic('medium');
    
    // Анимация завершения
    if (this.backLabel) {
      this.scene.tweens.add({
        targets: this.backLabel,
        x: this.screenWidth * 0.4,
        alpha: 0,
        duration: 150,
        ease: 'Power2',
      });
    }
    
    if (this.swipeOverlay) {
      this.scene.tweens.add({
        targets: this.swipeOverlay,
        alpha: 0,
        duration: 150,
        ease: 'Power2',
      });
    }
    
    // Небольшая задержка перед переходом
    this.scene.time.delayedCall(100, () => {
      if (!this.isDestroyed) {
        this.config.onBack();
      }
    });
    
    this.resetState();
  }

  private cancelSwipe(): void {
    if (!this.state.isActive) return;
    
    // Пружинящая анимация возврата
    if (this.backLabel) {
      this.scene.tweens.add({
        targets: this.backLabel,
        x: 60,
        alpha: 0,
        duration: 200,
        ease: 'Back.easeOut',
      });
    }
    
    if (this.swipeOverlay) {
      this.scene.tweens.add({
        targets: this.swipeOverlay,
        alpha: 0,
        duration: 200,
        ease: 'Power2',
      });
    }
    
    if (this.shadowGraphics) {
      this.scene.tweens.add({
        targets: this.shadowGraphics,
        alpha: 0,
        duration: 200,
        ease: 'Power2',
      });
    }
    
    this.drawEdgeIndicator(0.25);
    this.resetState();
  }

  private resetState(): void {
    this.state = {
      isActive: false,
      startX: 0,
      startY: 0,
      startTime: 0,
      currentX: 0,
      pointerId: null,
    };
  }

  private triggerHaptic(type: 'selection' | 'light' | 'medium' | 'heavy'): void {
    try {
      // Используем Vibration API для Game режима
      if (navigator.vibrate) {
        switch (type) {
          case 'selection':
            navigator.vibrate(5);
            break;
          case 'light':
            navigator.vibrate(10);
            break;
          case 'medium':
            navigator.vibrate(20);
            break;
          case 'heavy':
            navigator.vibrate(30);
            break;
        }
      }
    } catch (e) {
      // Хаптика недоступна
    }
  }

  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    
    this.disable();
    
    this.pulseTimer?.destroy();
    this.edgeIndicator?.destroy();
    this.swipeOverlay?.destroy();
    this.shadowGraphics?.destroy();
    this.backLabel?.destroy();
  }
}