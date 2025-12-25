// src/utils/TelegramWebApp.ts
// Утилиты для работы с Telegram Mini App

interface TelegramViewport {
  width: number;
  height: number;
  stableHeight: number;
  isExpanded: boolean;
  platform: string;
}

class TelegramWebAppManager {
  private static instance: TelegramWebAppManager;
  private webApp: TelegramWebApp | null = null;
  private viewport: TelegramViewport = {
    width: window.innerWidth,
    height: window.innerHeight,
    stableHeight: window.innerHeight,
    isExpanded: false,
    platform: 'unknown',
  };
  
  private onViewportChangeCallbacks: ((viewport: TelegramViewport) => void)[] = [];

  private constructor() {
    this.init();
  }

  static getInstance(): TelegramWebAppManager {
    if (!TelegramWebAppManager.instance) {
      TelegramWebAppManager.instance = new TelegramWebAppManager();
    }
    return TelegramWebAppManager.instance;
  }

  private init(): void {
    const tg = window.Telegram?.WebApp;
    
    if (tg) {
      this.webApp = tg;
      
      // Сообщаем Telegram что приложение готово
      tg.ready();
      
      // Раскрываем на весь экран
      tg.expand();
      
      // Отключаем вертикальные свайпы (чтобы не закрывалось случайно)
      if (tg.disableVerticalSwipes) {
        tg.disableVerticalSwipes();
      }
      
      // Устанавливаем цвета
      try {
        tg.setHeaderColor('#050505');
        tg.setBackgroundColor('#050505');
      } catch (e) {
        console.warn('[TG] Failed to set colors:', e);
      }
      
      // Получаем размеры viewport
      this.updateViewport();
      
      // Подписываемся на изменения viewport
      tg.onEvent('viewportChanged', (data: any) => {
        console.log('[TG] Viewport changed:', data);
        this.updateViewport();
        this.notifyViewportChange();
      });
      
      console.log('[TG] Telegram WebApp initialized');
      console.log('[TG] Platform:', tg.platform);
      console.log('[TG] Viewport:', this.viewport);
      
    } else {
      console.warn('[TG] Telegram WebApp not available, using fallback');
      this.updateViewport();
    }
  }

  private updateViewport(): void {
    const tg = this.webApp;
    
    if (tg) {
      this.viewport = {
        width: tg.viewportWidth || window.innerWidth,
        height: tg.viewportHeight || window.innerHeight,
        stableHeight: tg.viewportStableHeight || tg.viewportHeight || window.innerHeight,
        isExpanded: true,
        platform: tg.platform || 'unknown',
      };
    } else {
      this.viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
        stableHeight: window.innerHeight,
        isExpanded: false,
        platform: 'web',
      };
    }
  }

  private notifyViewportChange(): void {
    this.onViewportChangeCallbacks.forEach(cb => cb(this.viewport));
  }

  // ==================== PUBLIC API ====================

  /**
   * Получить текущий viewport
   */
  getViewport(): TelegramViewport {
    return { ...this.viewport };
  }

  /**
   * Получить безопасную высоту (без клавиатуры и т.д.)
   */
  getSafeHeight(): number {
    return this.viewport.stableHeight;
  }

  /**
   * Получить ширину
   */
  getWidth(): number {
    return this.viewport.width;
  }

  /**
   * Проверить, запущено ли в Telegram
   */
  isInTelegram(): boolean {
    return this.webApp !== null;
  }

  /**
   * Получить платформу (ios, android, web, etc.)
   */
  getPlatform(): string {
    return this.viewport.platform;
  }

  /**
   * Подписаться на изменение viewport
   */
  onViewportChange(callback: (viewport: TelegramViewport) => void): void {
    this.onViewportChangeCallbacks.push(callback);
  }

  /**
   * Haptic feedback
   */
  hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light'): void {
    try {
      this.webApp?.HapticFeedback?.impactOccurred(style);
    } catch (e) {}
  }

  hapticNotification(type: 'error' | 'success' | 'warning' = 'success'): void {
    try {
      this.webApp?.HapticFeedback?.notificationOccurred(type);
    } catch (e) {}
  }

  hapticSelection(): void {
    try {
      this.webApp?.HapticFeedback?.selectionChanged();
    } catch (e) {}
  }

  /**
   * Закрыть приложение
   */
  close(): void {
    this.webApp?.close();
  }

  /**
   * Получить данные пользователя
   */
  getUser(): { id: number; firstName: string; lastName?: string; username?: string } | null {
    const user = this.webApp?.initDataUnsafe?.user;
    if (!user) return null;
    
    return {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
    };
  }

  /**
   * Вычислить масштаб UI на основе viewport
   * Базовый дизайн: 375x667 (iPhone SE)
   */
  getUIScale(baseWidth = 375, baseHeight = 667): number {
    const scaleX = this.viewport.width / baseWidth;
    const scaleY = this.viewport.stableHeight / baseHeight;
    
    // Используем минимальный, но не меньше 0.7 и не больше 1.3
    return Math.max(0.7, Math.min(1.3, Math.min(scaleX, scaleY)));
  }

  /**
   * Проверить, маленький ли экран (iPhone SE и подобные)
   */
  isSmallScreen(): boolean {
    return this.viewport.stableHeight < 600;
  }

  /**
   * Проверить, длинный ли экран (iPhone 14/15 и подобные)
   */
  isTallScreen(): boolean {
    const ratio = this.viewport.stableHeight / this.viewport.width;
    return ratio > 2.0;
  }
}

// Экспортируем синглтон
export const tgApp = TelegramWebAppManager.getInstance();

// Типы для экспорта
export type { TelegramViewport };