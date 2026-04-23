/**
 * LeakGuardPlugin - централизованное управление таймерами и listeners
 * Автоматически очищает все ресурсы при shutdown сцены
 */

/**
 * Константа для невалидного таймера (когда window недоступен)
 */
export const INVALID_TIMER = -1;

/**
 * Проверка доступности window
 */
function isWindowAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.setTimeout === 'function';
}

export class LeakGuardPlugin extends Phaser.Plugins.ScenePlugin {
  private timeouts: Set<number> = new Set();
  private intervals: Set<number> = new Set();
  private listeners: Array<{ target: EventTarget; type: string; fn: EventListenerOrEventListenerObject; options?: boolean | AddEventListenerOptions }> = [];
  private rafIds: Set<number> = new Set();

  constructor(scene: Phaser.Scene, pluginManager: Phaser.Plugins.PluginManager) {
    super(scene, pluginManager, 'LeakGuard');
  }

  boot(): void {
    // Проверка наличия scene перед подпиской на события (edge-case при hot-reload)
    if (!this.scene || !this.scene.events) {
      if (import.meta.env.DEV) {
        console.warn('[LeakGuard] boot() called but scene is not available');
      }
      return;
    }

    // Автоматическая очистка при shutdown сцены
    this.scene.events.on(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.scene.events.on(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  /**
   * Безопасный setTimeout с автоочисткой
   * @returns ID таймера или INVALID_TIMER если window недоступен
   */
  setTimeout(fn: () => void, ms: number): number /* -1 если window нет */ {
    if (!isWindowAvailable()) {
      if (import.meta.env.DEV) {
        console.warn('[LeakGuard] setTimeout called but window is not available');
      }
      return INVALID_TIMER;
    }

    try {
      const id = window.setTimeout(() => {
        this.timeouts.delete(id);
        fn();
      }, ms);
      this.timeouts.add(id);
      return id;
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error('[LeakGuard] setTimeout error:', e);
      }
      return INVALID_TIMER;
    }
  }

  /**
   * Безопасный setInterval с автоочисткой
   * @returns ID интервала или INVALID_TIMER если window недоступен
   */
  setInterval(fn: () => void, ms: number): number /* -1 если window нет */ {
    if (!isWindowAvailable()) {
      if (import.meta.env.DEV) {
        console.warn('[LeakGuard] setInterval called but window is not available');
      }
      return INVALID_TIMER;
    }

    try {
      const id = window.setInterval(fn, ms);
      this.intervals.add(id);
      return id;
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error('[LeakGuard] setInterval error:', e);
      }
      return INVALID_TIMER;
    }
  }

  /**
   * Очистка конкретного timeout (безопасно обрабатывает INVALID_TIMER)
   */
  clearTimeout(id: number): void {
    if (id === INVALID_TIMER || !isWindowAvailable()) {
      return;
    }

    try {
      window.clearTimeout(id);
      this.timeouts.delete(id);
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[LeakGuard] clearTimeout error:', e);
      }
    }
  }

  /**
   * Очистка конкретного interval (безопасно обрабатывает INVALID_TIMER)
   */
  clearInterval(id: number): void {
    if (id === INVALID_TIMER || !isWindowAvailable()) {
      return;
    }

    try {
      window.clearInterval(id);
      this.intervals.delete(id);
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[LeakGuard] clearInterval error:', e);
      }
    }
  }

  /**
   * Безопасный requestAnimationFrame
   * @returns ID RAF или INVALID_TIMER если window недоступен
   */
  requestAnimationFrame(fn: FrameRequestCallback): number /* -1 если window нет */ {
    if (!isWindowAvailable() || typeof window.requestAnimationFrame !== 'function') {
      if (import.meta.env.DEV) {
        console.warn('[LeakGuard] requestAnimationFrame called but window is not available');
      }
      return INVALID_TIMER;
    }

    try {
      const id = window.requestAnimationFrame((time) => {
        this.rafIds.delete(id);
        fn(time);
      });
      this.rafIds.add(id);
      return id;
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error('[LeakGuard] requestAnimationFrame error:', e);
      }
      return INVALID_TIMER;
    }
  }

  /**
   * Безопасное добавление event listener с автоочисткой
   */
  addListener<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    fn: (ev: WindowEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  addListener<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    fn: (ev: DocumentEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  addListener(
    target: EventTarget,
    type: string,
    fn: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void;
  addListener(
    target: EventTarget,
    type: string,
    fn: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    target.addEventListener(type, fn, options);
    this.listeners.push({ target, type, fn, options });
  }

  /**
   * Ручное удаление listener
   */
  removeListener(
    target: EventTarget,
    type: string,
    fn: EventListenerOrEventListenerObject
  ): void {
    target.removeEventListener(type, fn);
    const index = this.listeners.findIndex(
      l => l.target === target && l.type === type && l.fn === fn
    );
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Очистка всех ресурсов
   */
  private cleanupAll(): void {
    if (!isWindowAvailable()) {
      this.timeouts.clear();
      this.intervals.clear();
      this.rafIds.clear();
      this.listeners = [];
      return;
    }

    // Очистка timeouts
    this.timeouts.forEach(id => {
      if (id !== INVALID_TIMER) {
        try {
          window.clearTimeout(id);
        } catch (e) {
          // Ignore
        }
      }
    });
    this.timeouts.clear();

    // Очистка intervals
    this.intervals.forEach(id => {
      if (id !== INVALID_TIMER) {
        try {
          window.clearInterval(id);
        } catch (e) {
          // Ignore
        }
      }
    });
    this.intervals.clear();

    // Очистка RAF
    this.rafIds.forEach(id => {
      if (id !== INVALID_TIMER && typeof window.cancelAnimationFrame === 'function') {
        try {
          window.cancelAnimationFrame(id);
        } catch (e) {
          // Ignore
        }
      }
    });
    this.rafIds.clear();

    // Очистка listeners
    this.listeners.forEach(({ target, type, fn, options }) => {
      try {
        target.removeEventListener(type, fn, options);
      } catch (e) {
        // Игнорируем ошибки при удалении
      }
    });
    this.listeners = [];
  }

  shutdown(): void {
    this.cleanupAll();
  }

  destroy(): void {
    this.cleanupAll();
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  /**
   * Статистика для отладки
   */
  getStats(): { timeouts: number; intervals: number; listeners: number; rafs: number } {
    return {
      timeouts: this.timeouts.size,
      intervals: this.intervals.size,
      listeners: this.listeners.length,
      rafs: this.rafIds.size
    };
  }
}

// Расширяем типы Phaser для TypeScript
declare module 'phaser' {
  interface Scene {
    leakGuard: LeakGuardPlugin;
  }
}
