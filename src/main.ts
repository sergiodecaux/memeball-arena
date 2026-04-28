import { gameConfig } from './config/gameConfig';

declare global {
  interface Window {
    DEV_MODE?: boolean;
  }
}

console.log('🚀 Starting Galaxy League...');

const CHUNK_RELOAD_MARKER = 'gl_chunk_reload_once';

const isLocalDevHost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
window.DEV_MODE = isLocalDevHost;

function ensurePromisePolyfill(): void {
  if (typeof window.Promise !== 'undefined') {
    return;
  }

  type Resolve<T> = (value: T | PromiseLike<T>) => void;
  type Reject = (reason?: unknown) => void;
  type Executor<T> = (resolve: Resolve<T>, reject: Reject) => void;

  class PromisePolyfill<T = unknown> {
    private state: 'pending' | 'fulfilled' | 'rejected' = 'pending';
    private value: unknown;
    private handlers: Array<{
      onFulfilled?: (value: unknown) => unknown;
      onRejected?: (reason: unknown) => unknown;
      resolve: Resolve<unknown>;
      reject: Reject;
    }> = [];

    constructor(executor: Executor<T>) {
      const resolve: Resolve<T> = (value) => {
        this.fulfill(value);
      };
      const reject: Reject = (reason) => {
        this.reject(reason);
      };

      try {
        executor(resolve, reject);
      } catch (error) {
        reject(error);
      }
    }

    private fulfill(value: unknown): void {
      if (this.state !== 'pending') {
        return;
      }
      this.state = 'fulfilled';
      this.value = value;
      this.flushHandlers();
    }

    private reject(reason: unknown): void {
      if (this.state !== 'pending') {
        return;
      }
      this.state = 'rejected';
      this.value = reason;
      this.flushHandlers();
    }

    private flushHandlers(): void {
      setTimeout(() => {
        this.handlers.forEach((handler) => this.handle(handler));
        this.handlers = [];
      }, 0);
    }

    private handle(handler: {
      onFulfilled?: (value: unknown) => unknown;
      onRejected?: (reason: unknown) => unknown;
      resolve: Resolve<unknown>;
      reject: Reject;
    }): void {
      if (this.state === 'pending') {
        this.handlers.push(handler);
        return;
      }

      const callback = this.state === 'fulfilled' ? handler.onFulfilled : handler.onRejected;
      if (!callback) {
        if (this.state === 'fulfilled') {
          handler.resolve(this.value);
        } else {
          handler.reject(this.value);
        }
        return;
      }

      try {
        handler.resolve(callback(this.value));
      } catch (error) {
        handler.reject(error);
      }
    }

    then<TResult1 = T, TResult2 = never>(
      onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
      onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): PromisePolyfill<TResult1 | TResult2> {
      return new PromisePolyfill<TResult1 | TResult2>((resolve, reject) => {
        this.handle({
          onFulfilled: onFulfilled ?? undefined,
          onRejected: onRejected ?? undefined,
          resolve,
          reject
        });
      });
    }

    catch<TResult = never>(
      onRejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
    ): PromisePolyfill<T | TResult> {
      return this.then(undefined, onRejected);
    }

    static resolve<T>(value: T): PromisePolyfill<T> {
      return new PromisePolyfill<T>((resolve) => resolve(value));
    }

    static reject(reason?: unknown): PromisePolyfill<never> {
      return new PromisePolyfill<never>((_, reject) => reject(reason));
    }
  }

  (window as any).Promise = PromisePolyfill;
}

function supportsDynamicImport(): boolean {
  try {
    // Throws on browsers that cannot parse dynamic import syntax.
    // eslint-disable-next-line no-new-func
    new Function('return import("data:text/javascript,export default 1")');
    return true;
  } catch {
    return false;
  }
}

function isBrowserCompatible(): boolean {
  const supportsModuleScripts = 'noModule' in HTMLScriptElement.prototype;
  return supportsModuleScripts && supportsDynamicImport();
}

function showUnsupportedBrowserMessage(): void {
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#050505;color:#fff;font-family:Arial,sans-serif;padding:24px;text-align:center;">
      <div>
        <h1 style="margin:0 0 12px;font-size:24px;">Браузер не поддерживается</h1>
        <p style="margin:0;font-size:16px;line-height:1.5;opacity:0.9;">
          Обновите браузер до последней версии или откройте игру в Chrome / Safari / Firefox.
        </p>
      </div>
    </div>
  `;
}

function disableServiceWorkers(): void {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      void registration.unregister();
    });
  });
}

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk \d+ failed/i.test(message);
}

function tryRecoverFromChunkError(reason: string): boolean {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_MARKER) === '1') {
      return false;
    }
    sessionStorage.setItem(CHUNK_RELOAD_MARKER, '1');
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('_v', Date.now().toString());
    console.warn(`[Main] ${reason}. Reloading with cache-buster...`);
    window.location.replace(nextUrl.toString());
    return true;
  } catch {
    return false;
  }
}

function installChunkErrorRecovery(): void {
  window.addEventListener('error', (event) => {
    if (isChunkLoadError(event.error) || isChunkLoadError((event as ErrorEvent).message)) {
      tryRecoverFromChunkError('Detected chunk load error');
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) {
      tryRecoverFromChunkError('Detected chunk load rejection');
    }
  });
}

function initTelegramWebApp(): void {
  const tg = (window as any).Telegram?.WebApp;
  if (!tg) {
    console.log('[Main] Telegram WebApp not available');
    return;
  }

  requestAnimationFrame(() => {
    try {
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#050505');
      tg.setBackgroundColor('#050505');
      console.log('[Main] Telegram WebApp initialized');
    } catch (e) {
      console.warn('[Main] Telegram WebApp init failed:', e);
    }
  });
}

async function initGame(): Promise<void> {
  console.log('[Main] Initializing game...');

  ensurePromisePolyfill();

  if (!isBrowserCompatible()) {
    showUnsupportedBrowserMessage();
    return;
  }

  disableServiceWorkers();

  initTelegramWebApp();

  try {
    const PhaserModule = await import('phaser');
    const Phaser = PhaserModule.default;
    const game = new Phaser.Game(gameConfig);

    (window as any).game = game;
    (window as any).__GAME__ = game;

    console.log('[Main] Phaser.Game created');
    sessionStorage.removeItem(CHUNK_RELOAD_MARKER);
  } catch (error) {
    console.error('[Main] Failed to import Phaser module:', error);
    if (isChunkLoadError(error) && tryRecoverFromChunkError('Phaser import chunk failed')) {
      return;
    }
    showUnsupportedBrowserMessage();
  }
}

installChunkErrorRecovery();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void initGame();
  });
} else {
  void initGame();
}
