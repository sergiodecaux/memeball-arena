/**
 * AppLifecycle - Управление жизненным циклом приложения
 * 
 * Решает проблемы:
 * - Обновление при получении push-уведомлений
 * - Обновление при создании скриншотов
 * - Некорректное поведение при возврате из фона
 */

type LifecycleCallback = () => void;

class AppLifecycle {
  private static instance: AppLifecycle;
  private initialized = false;
  
  private wasHidden = false;
  private hiddenTimestamp = 0;
  private pauseCallbacks: LifecycleCallback[] = [];
  private resumeCallbacks: LifecycleCallback[] = [];
  
  // Порог для определения "быстрого" возврата (уведомление/скриншот)
  private readonly QUICK_RETURN_THRESHOLD = 5000; // 5 секунд
  
  // ✅ FIX: Сохраняем ссылки на bound функции для корректного removeEventListener
  private boundOnBlur: () => void;
  private boundOnFocus: () => void;
  private boundOnPageHide: () => void;
  private boundOnPageShow: () => void;
  private visibilityHandler: () => void;

  static getInstance(): AppLifecycle {
    if (!AppLifecycle.instance) {
      AppLifecycle.instance = new AppLifecycle();
    }
    return AppLifecycle.instance;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // ✅ FIX: Сохраняем ссылки на bound функции для корректного removeEventListener
    this.boundOnBlur = this.onBlur.bind(this);
    this.boundOnFocus = this.onFocus.bind(this);
    this.boundOnPageHide = this.onPageHide.bind(this);
    this.boundOnPageShow = this.onPageShow.bind(this);

    // Используем globalCleanup для автоматической очистки
    const { globalCleanup } = await import('./GlobalCleanup');
    
    // Основной обработчик видимости (сохраняем как поле класса для destroy())
    this.visibilityHandler = this.onVisibilityChange.bind(this);
    globalCleanup.addListener(document, 'visibilitychange', this.visibilityHandler);
    
    globalCleanup.addListener(window, 'blur', this.boundOnBlur);
    globalCleanup.addListener(window, 'focus', this.boundOnFocus);
    globalCleanup.addListener(window, 'pagehide', this.boundOnPageHide);
    globalCleanup.addListener(window, 'pageshow', this.boundOnPageShow);

    // Telegram специфичные события
    this.initTelegramEvents();

    console.log('[AppLifecycle] Initialized');
  }

  private initTelegramEvents(): void {
    // Подписка на viewportChanged обрабатывается в TelegramWebApp.ts
    // Здесь ничего не делаем, чтобы избежать дублирования
    if (import.meta.env.DEV) {
      console.log('[AppLifecycle] Telegram viewport events handled by TelegramWebApp');
    }
  }

  private onVisibilityChange(): void {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    if (document.visibilityState === 'hidden') {
      this.wasHidden = true;
      this.hiddenTimestamp = Date.now();
      console.log('[AppLifecycle] App hidden');
      
      // ✅ iOS: Приостанавливаем Phaser для экономии ресурсов
      if (isIOS && (window as any).__GAME__) {
        const game = (window as any).__GAME__ as Phaser.Game;
        if (game.loop) {
          game.loop.sleep();
        }
      }
      
      this.pauseCallbacks.forEach(cb => {
        try { cb(); } catch (e) { console.error('[AppLifecycle] Pause callback error:', e); }
      });
      
    } else if (document.visibilityState === 'visible') {
      const hiddenDuration = Date.now() - this.hiddenTimestamp;
      const isQuickReturn = hiddenDuration < this.QUICK_RETURN_THRESHOLD;
      
      console.log('[AppLifecycle] App visible, hidden for:', hiddenDuration, 'ms');

      // ✅ iOS: Возобновляем Phaser
      if (isIOS && (window as any).__GAME__) {
        const game = (window as any).__GAME__ as Phaser.Game;
        if (game.loop) {
          game.loop.wake();
        }
      }

      if (this.wasHidden) {
        this.resumeCallbacks.forEach(cb => {
          try { cb(); } catch (e) { console.error('[AppLifecycle] Resume callback error:', e); }
        });
      }

      this.wasHidden = false;
    }
  }

  private onBlur(): void {
    console.log('[AppLifecycle] Window blur - ignoring (might be screenshot)');
    // НЕ делаем ничего при blur - это может быть скриншот
  }

  private onFocus(): void {
    console.log('[AppLifecycle] Window focus');
    // НЕ перезагружаем при focus
  }

  private onPageHide(e: PageTransitionEvent): void {
    console.log('[AppLifecycle] Page hide, persisted:', e.persisted);
  }

  private onPageShow(e: PageTransitionEvent): void {
    console.log('[AppLifecycle] Page show, persisted:', e.persisted);
    // Если страница из кэша - не перезагружаем
  }

  /**
   * Регистрирует колбэк на паузу приложения
   */
  onPause(callback: LifecycleCallback): void {
    this.pauseCallbacks.push(callback);
  }

  /**
   * Отписывается от событий паузы
   */
  offPause(callback: LifecycleCallback): void {
    const index = this.pauseCallbacks.indexOf(callback);
    if (index !== -1) {
      this.pauseCallbacks.splice(index, 1);
    }
  }

  /**
   * Регистрирует колбэк на возобновление приложения
   */
  onResume(callback: LifecycleCallback): void {
    this.resumeCallbacks.push(callback);
  }

  /**
   * Отписывается от событий возобновления
   */
  offResume(callback: LifecycleCallback): void {
    const index = this.resumeCallbacks.indexOf(callback);
    if (index !== -1) {
      this.resumeCallbacks.splice(index, 1);
    }
  }

  /**
   * Проверяет, был ли быстрый возврат (уведомление/скриншот)
   */
  wasQuickReturn(): boolean {
    const duration = Date.now() - this.hiddenTimestamp;
    return duration < this.QUICK_RETURN_THRESHOLD;
  }

  async destroy(): Promise<void> {
    // Используем globalCleanup для правильной отписки
    const { globalCleanup } = await import('./GlobalCleanup');
    
    if (this.visibilityHandler) {
      globalCleanup.removeListener(document, 'visibilitychange', this.visibilityHandler);
    }
    globalCleanup.removeListener(window, 'blur', this.boundOnBlur);
    globalCleanup.removeListener(window, 'focus', this.boundOnFocus);
    globalCleanup.removeListener(window, 'pagehide', this.boundOnPageHide);
    globalCleanup.removeListener(window, 'pageshow', this.boundOnPageShow);
    
    console.log('[AppLifecycle] destroyed');
  }
}

export function initAppLifecycle(): void {
  AppLifecycle.getInstance().init();
}

export { AppLifecycle };
