/**
 * Dev Overlay для мониторинга стабильности игры
 * Показывает статистику памяти, подписок и таймеров
 * Активируется только в DEV режиме
 */
export class DevStabilityOverlay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private texts: Map<string, Phaser.GameObjects.Text> = new Map();
  private updateTimer: Phaser.Time.TimerEvent | null = null;
  private isVisible = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    
    if (import.meta.env.DEV) {
      this.create();
    }
  }

  private create(): void {
    const { width } = this.scene.scale;
    
    this.container = this.scene.add.container(width - 200, 10);
    this.container.setDepth(10000);
    this.container.setScrollFactor(0);
    
    // Фон
    const bg = this.scene.add.rectangle(0, 0, 190, 120, 0x000000, 0.7);
    bg.setOrigin(0, 0);
    this.container.add(bg);
    
    // Заголовок
    const title = this.scene.add.text(5, 5, '🔧 Stability Monitor', {
      fontSize: '12px',
      color: '#00ff00'
    });
    this.container.add(title);
    
    // Метрики
    const metrics = ['memory', 'eventbus', 'leakguard', 'fps'];
    metrics.forEach((metric, i) => {
      const text = this.scene.add.text(5, 25 + i * 20, `${metric}: --`, {
        fontSize: '10px',
        color: '#ffffff'
      });
      this.texts.set(metric, text);
      this.container.add(text);
    });
    
    // Обновление каждую секунду
    this.updateTimer = this.scene.time.addEvent({
      delay: 1000,
      callback: this.update,
      callbackScope: this,
      loop: true
    });
    
    // Скрыто по умолчанию, активируется по клавише
    this.container.setVisible(false);
    
    // Toggle по клавише F12 или тап 3 пальцами
    this.scene.input.keyboard?.on('keydown-F12', this.toggle, this);
  }

  toggle(): void {
    if (!this.container) return;
    this.isVisible = !this.isVisible;
    this.container.setVisible(this.isVisible);
  }

  private update(): void {
    if (!this.isVisible || !this.container) return;
    
    // Memory (если доступно)
    const memoryText = this.texts.get('memory');
    if (memoryText && (performance as any).memory) {
      const mem = (performance as any).memory;
      const used = Math.round(mem.usedJSHeapSize / 1024 / 1024);
      const total = Math.round(mem.totalJSHeapSize / 1024 / 1024);
      memoryText.setText(`Memory: ${used}/${total} MB`);
    }
    
    // EventBus stats (если добавили в Запросе 20)
    const eventText = this.texts.get('eventbus');
    if (eventText) {
      import('../core/EventBus').then(({ EventBus }) => {
        const stats = EventBus.getSubscriptionStats();
        const total = Object.values(stats).reduce((a: number, b: number) => a + b, 0);
        eventText.setText(`EventBus: ${total} subs`);
      }).catch(() => {
        eventText.setText('EventBus: N/A');
      });
    }
    
    // LeakGuard stats
    const leakText = this.texts.get('leakguard');
    if (leakText && this.scene.leakGuard) {
      const stats = this.scene.leakGuard.getStats();
      leakText.setText(`LeakGuard: T${stats.timeouts} I${stats.intervals} L${stats.listeners}`);
    }
    
    // FPS
    const fpsText = this.texts.get('fps');
    if (fpsText) {
      const fps = Math.round(this.scene.game.loop.actualFps);
      const color = fps >= 55 ? '#00ff00' : fps >= 30 ? '#ffff00' : '#ff0000';
      fpsText.setText(`FPS: ${fps}`);
      fpsText.setColor(color);
    }
  }

  destroy(): void {
    this.updateTimer?.destroy();
    this.container?.destroy();
    this.texts.clear();
  }
}
