/**
 * Глобальный менеджер очистки для кода, работающего вне Phaser сцен
 * Ленивая инициализация для совместимости с ранней загрузкой модулей
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

class GlobalCleanupManager {
  private timeouts: Set<number> = new Set();
  private intervals: Set<number> = new Set();
  private listeners: Array<{ target: EventTarget; type: string; fn: EventListenerOrEventListenerObject }> = [];

  /**
   * Безопасный setTimeout с автоочисткой
   * @returns ID таймера или INVALID_TIMER если window недоступен
   */
  setTimeout(fn: () => void, ms: number): number {
    if (!isWindowAvailable()) {
      if (import.meta.env.DEV) {
        console.warn('[GlobalCleanup] setTimeout called but window is not available');
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
        console.error('[GlobalCleanup] setTimeout error:', e);
      }
      return INVALID_TIMER;
    }
  }

  /**
   * Безопасный setInterval с автоочисткой
   * @returns ID интервала или INVALID_TIMER если window недоступен
   */
  setInterval(fn: () => void, ms: number): number {
    if (!isWindowAvailable()) {
      if (import.meta.env.DEV) {
        console.warn('[GlobalCleanup] setInterval called but window is not available');
      }
      return INVALID_TIMER;
    }

    try {
      const id = window.setInterval(fn, ms);
      this.intervals.add(id);
      return id;
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error('[GlobalCleanup] setInterval error:', e);
      }
      return INVALID_TIMER;
    }
  }

  /**
   * Очистка timeout (безопасно обрабатывает INVALID_TIMER)
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
        console.warn('[GlobalCleanup] clearTimeout error:', e);
      }
    }
  }

  /**
   * Очистка interval (безопасно обрабатывает INVALID_TIMER)
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
        console.warn('[GlobalCleanup] clearInterval error:', e);
      }
    }
  }

  addListener(
    target: EventTarget,
    type: string,
    fn: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    if (!isWindowAvailable()) {
      if (import.meta.env.DEV) {
        console.warn('[GlobalCleanup] addListener called but window is not available');
      }
      return;
    }

    try {
      target.addEventListener(type, fn, options);
      this.listeners.push({ target, type, fn });
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error('[GlobalCleanup] addListener error:', e);
      }
    }
  }

  removeListener(target: EventTarget, type: string, fn: EventListenerOrEventListenerObject): void {
    if (!isWindowAvailable()) {
      return;
    }

    try {
      target.removeEventListener(type, fn);
      const index = this.listeners.findIndex(
        l => l.target === target && l.type === type && l.fn === fn
      );
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[GlobalCleanup] removeListener error:', e);
      }
    }
  }

  /**
   * Возвращает количество активных таймеров и listeners
   * Используется для диагностики утечек
   */
  getActiveCount(): number {
    return this.timeouts.size + this.intervals.size + this.listeners.length;
  }

  /**
   * Логирует текущее состояние (для отладки)
   */
  debugState(): void {
    if (import.meta.env.DEV) {
      console.log('[GlobalCleanup] State:', {
        timeouts: this.timeouts.size,
        intervals: this.intervals.size,
        listeners: this.listeners.length,
      });
    }
  }

  cleanup(): void {
    if (!isWindowAvailable()) {
      return;
    }

    try {
      this.timeouts.forEach(id => {
        if (id !== INVALID_TIMER) {
          window.clearTimeout(id);
        }
      });
      this.timeouts.clear();

      this.intervals.forEach(id => {
        if (id !== INVALID_TIMER) {
          window.clearInterval(id);
        }
      });
      this.intervals.clear();

      this.listeners.forEach(({ target, type, fn }) => {
        try {
          target.removeEventListener(type, fn);
        } catch (e) {
          // Ignore
        }
      });
      this.listeners = [];
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error('[GlobalCleanup] cleanup error:', e);
      }
    }
  }
}

// Ленивая инициализация
let _instance: GlobalCleanupManager | null = null;

function getGlobalCleanup(): GlobalCleanupManager {
  if (!_instance) {
    _instance = new GlobalCleanupManager();
  }
  return _instance;
}

// Экспорт для обратной совместимости
export const globalCleanup = {
  setTimeout: (fn: () => void, ms: number) => getGlobalCleanup().setTimeout(fn, ms),
  setInterval: (fn: () => void, ms: number) => getGlobalCleanup().setInterval(fn, ms),
  clearTimeout: (id: number) => getGlobalCleanup().clearTimeout(id),
  clearInterval: (id: number) => getGlobalCleanup().clearInterval(id),
  addListener: (target: EventTarget, type: string, fn: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) =>
    getGlobalCleanup().addListener(target, type, fn, options),
  removeListener: (target: EventTarget, type: string, fn: EventListenerOrEventListenerObject) =>
    getGlobalCleanup().removeListener(target, type, fn),
  getActiveCount: () => getGlobalCleanup().getActiveCount(),
  debugState: () => getGlobalCleanup().debugState(),
  cleanup: () => getGlobalCleanup().cleanup(),
};

// Типизация для TypeScript
export type GlobalCleanup = ReturnType<typeof getGlobalCleanup>;
