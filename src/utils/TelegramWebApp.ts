// src/utils/TelegramWebApp.ts
// Менеджер для работы с Telegram WebApp API

export interface TelegramViewport {
  width: number;
  height: number;
  stableHeight: number;
  isExpanded: boolean;
  platform: string;
}

type ViewportChangeCallback = (viewport: TelegramViewport) => void;

class TelegramWebAppManager {
  private static instance: TelegramWebAppManager;
  private initialized = false;
  private viewport: TelegramViewport;
  private viewportChangeCallbacks: ViewportChangeCallback[] = [];
  public performanceClass: 'LOW' | 'AVERAGE' | 'HIGH' | 'UNKNOWN' = 'UNKNOWN';

  private constructor() {
    this.viewport = {
      width: window.innerWidth || 390,
      height: window.innerHeight || 844,
      stableHeight: window.innerHeight || 844,
      isExpanded: true,
      platform: this.detectPlatform(),
    };
  }

  static getInstance(): TelegramWebAppManager {
    if (!TelegramWebAppManager.instance) {
      TelegramWebAppManager.instance = new TelegramWebAppManager();
    }
    return TelegramWebAppManager.instance;
  }

  static getSafeWindow(): Window {
    return typeof window !== 'undefined' ? window : { innerWidth: 390, innerHeight: 844 } as any;
  }

  private detectPlatform(): string {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (/android/.test(ua)) return 'android';
    return 'unknown';
  }

  public get webApp(): any {
    return (window as any).Telegram?.WebApp || null;
  }

  public initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.init();
  }

  private init(): void {
    const tg = (window as any).Telegram?.WebApp;
    
    console.log('[TelegramWebApp] init() started, Telegram WebApp available:', !!tg);
    
    if (tg) {
      // 1. ready() - сообщаем Telegram что приложение готово
      try {
        tg.ready();
        console.log('[TelegramWebApp] ready() called');
      } catch (e) {
        console.warn('[TelegramWebApp] ready() failed:', e);
      }
      
      // 2. expand() - раскрываем на весь экран
      // ✅ УБРАНО: expand() вызывается централизованно в main.ts через waitForViewportExpansion()
      // try {
      //   tg.expand();
      //   console.log('[TelegramWebApp] expand() called');
      // } catch (e) {
      //   console.warn('[TelegramWebApp] expand() failed:', e);
      // }
      
      // 3. Устанавливаем цвета заголовка (если доступно)
      try {
        if (typeof tg.setHeaderColor === 'function') {
          tg.setHeaderColor('#050505');
        }
        if (typeof tg.setBackgroundColor === 'function') {
          tg.setBackgroundColor('#050505');
        }
      } catch (e) {
        console.warn('[TelegramWebApp] setColors failed:', e);
      }
      
      // 4. Подписываемся на события Telegram
      this.attachTelegramEventListeners(tg);
    }
    
    // 5. Устанавливаем цвет фона
    this.setGameBackground();
    
    // 6. Определяем класс производительности
    this.parsePerformanceClass();
    
    // 7. Блокируем нежелательное поведение браузера
    this.disableBrowserBehaviors();
    
    // 8. Обновляем viewport
    this.updateViewport();
    
    // 9. Слушаем изменения размера окна (fallback)
    this.attachResizeListener();
  }

  private setGameBackground(): void {
    const tg = (window as any).Telegram?.WebApp;
    const bgColor = tg?.themeParams?.bg_color || '#050505';
    
    document.body.style.backgroundColor = bgColor;
    document.documentElement.style.backgroundColor = bgColor;
    
    console.log('[TelegramWebApp] Background color set to:', bgColor);
  }

  private parsePerformanceClass(): void {
    const ua = navigator.userAgent;
    
    // Простая эвристика для определения производительности
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isOldAndroid = /Android [1-6]\./.test(ua);
    const isLowMemory = (navigator as any).deviceMemory && (navigator as any).deviceMemory < 4;
    
    if (isOldAndroid || isLowMemory) {
      this.performanceClass = 'LOW';
    } else if (isIOS) {
      this.performanceClass = 'HIGH';
    } else {
      this.performanceClass = 'AVERAGE';
    }

    if (typeof (window as any).debugLog === 'function') {
      (window as any).debugLog('Performance class: ' + this.performanceClass);
    }
  }

  private disableBrowserBehaviors(): void {
    // CSS для блокировки свайпов и скролла
    document.body.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehaviorY = 'none';
    document.body.style.touchAction = 'manipulation';
    document.documentElement.style.overscrollBehavior = 'none';
    document.documentElement.style.touchAction = 'manipulation';
    
    // Предотвращаем pull-to-refresh
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.overflow = 'hidden';
  }

  private updateViewport(): void {
    const tg = (window as any).Telegram?.WebApp;
    
    if (tg) {
      this.viewport = {
        width: window.innerWidth || 390,
        height: tg.viewportHeight || window.innerHeight || 844,
        stableHeight: tg.viewportStableHeight || tg.viewportHeight || window.innerHeight || 844,
        isExpanded: tg.isExpanded ?? true,
        platform: this.detectPlatform(),
      };
      console.log('[TelegramWebApp] Viewport updated from Telegram:', this.viewport);
    } else {
      this.viewport = {
        width: window.innerWidth || 390,
        height: window.innerHeight || 844,
        stableHeight: window.innerHeight || 844,
        isExpanded: true,
        platform: this.detectPlatform(),
      };
    }
  }

  private attachResizeListener(): void {
    let resizeTimeout: number = -1;
    
    const handleResize = () => {
      if (resizeTimeout !== -1) {
        clearTimeout(resizeTimeout);
      }
      
      resizeTimeout = window.setTimeout(() => {
        resizeTimeout = -1;
        this.updateViewport();
        this.notifyViewportChange();
      }, 300);
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
  }

  private attachTelegramEventListeners(tg: any): void {
    try {
      // Слушаем изменение viewport от Telegram
      if (typeof tg.onEvent === 'function') {
        tg.onEvent('viewportChanged', (event: { isStateStable: boolean }) => {
          console.log('[TelegramWebApp] viewportChanged event:', event);
          this.updateViewport();
          this.notifyViewportChange();
        });
        
        // Слушаем изменение темы
        tg.onEvent('themeChanged', () => {
          console.log('[TelegramWebApp] themeChanged event');
          this.setGameBackground();
        });
      }
    } catch (e) {
      console.warn('[TelegramWebApp] Failed to attach Telegram event listeners:', e);
    }
  }

  private notifyViewportChange(): void {
    this.viewportChangeCallbacks.forEach(cb => {
      try {
        cb(this.getViewport());
      } catch (e) {
        console.error('[TelegramWebApp] Viewport callback error:', e);
      }
    });
  }

  public getViewport(): TelegramViewport {
    return { ...this.viewport };
  }

  public onViewportChange(callback: ViewportChangeCallback): void {
    this.viewportChangeCallbacks.push(callback);
  }

  public offViewportChange(callback: ViewportChangeCallback): void {
    const index = this.viewportChangeCallbacks.indexOf(callback);
    if (index !== -1) {
      this.viewportChangeCallbacks.splice(index, 1);
    }
  }

  public getPerformanceClass(): 'LOW' | 'AVERAGE' | 'HIGH' | 'UNKNOWN' {
    return this.performanceClass;
  }

  // Методы для совместимости (заглушки)
  public getTopInset(): number {
    return 0;
  }

  public getBottomInset(): number {
    return 0;
  }

  public getSafeAreaInset(): { top: number; bottom: number; left: number; right: number } {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  public isAvailable(): boolean {
    return typeof (window as any).Telegram !== 'undefined' && 
           typeof (window as any).Telegram.WebApp !== 'undefined';
  }

  public isInTelegram(): boolean {
    return this.isAvailable();
  }

  public shareScore(): void {
    const tg = (window as any).Telegram?.WebApp;
    
    if (!tg) {
      console.warn('[TelegramWebApp] shareScore() - Telegram WebApp not available');
      return;
    }
    
    // В Telegram WebApp для шаринга можно использовать:
    // 1. sendData() - отправить данные боту
    // 2. openTelegramLink() - открыть ссылку для шаринга
    // 3. switchInlineQuery() - переключиться на inline режим
    
    try {
      // Пример: отправляем данные о счёте боту
      // Бот может обработать и предложить поделиться
      if (typeof tg.sendData === 'function') {
        // sendData закрывает WebApp, используем только если это желаемое поведение
        console.log('[TelegramWebApp] shareScore() - sendData available but not called (closes app)');
      }
      
      // Альтернатива: используем switchInlineQuery для шаринга
      if (typeof tg.switchInlineQuery === 'function') {
        // tg.switchInlineQuery('score:1000', ['users', 'groups', 'channels']);
        console.log('[TelegramWebApp] shareScore() - switchInlineQuery available');
      }
      
      console.log('[TelegramWebApp] shareScore() called - implement sharing logic as needed');
    } catch (e) {
      console.warn('[TelegramWebApp] shareScore() failed:', e);
    }
  }

  public hapticFeedback(type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning'): void {
    // Haptic недоступен в Game режиме - заглушка
    // Можно использовать Vibration API как fallback
    if (navigator.vibrate) {
      switch (type) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(20);
          break;
        case 'heavy':
          navigator.vibrate(30);
          break;
        case 'success':
          navigator.vibrate([10, 50, 10]);
          break;
        case 'error':
          navigator.vibrate([30, 50, 30]);
          break;
        case 'warning':
          navigator.vibrate([20, 30, 20]);
          break;
      }
    }
  }

  // Методы для совместимости с существующим кодом
  public hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light'): void {
    this.hapticFeedback(style);
  }

  public hapticSelection(): void {
    if (navigator.vibrate) {
      navigator.vibrate(5);
    }
  }

  public hapticNotification(type: 'error' | 'success' | 'warning' = 'success'): void {
    this.hapticFeedback(type);
  }

  public close(): void {
    // В Game режиме закрытие недоступно
    console.log('[TelegramWebApp] close() not available in Game mode');
  }

  public getInitData(): { user?: { id: number; first_name: string; last_name?: string; username?: string; language_code?: string } } {
    const tg = (window as any).Telegram?.WebApp;
    if (tg && tg.initDataUnsafe) {
      return tg.initDataUnsafe;
    }
    return {};
  }

  public getSafeHeight(): number {
    return this.viewport.stableHeight;
  }

  public getUIScale(baseWidth = 375, baseHeight = 667): number {
    const scaleX = this.viewport.width / baseWidth;
    const scaleY = this.viewport.stableHeight / baseHeight;
    return Math.max(0.7, Math.min(1.3, Math.min(scaleX, scaleY)));
  }
}

export const tgApp = TelegramWebAppManager.getInstance();
export { TelegramWebAppManager };
