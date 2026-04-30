/**
 * Система проверки и управления версиями игры
 * Решает проблему кэширования в Telegram WebApp
 */

import { globalCleanup } from './GlobalCleanup';

export interface VersionInfo {
  version: string;
  buildTime: string;
  forceUpdate: boolean;
  changelog: string[];
}

// ✅ Текущая версия клиента (обновляется автоматически при билде)
export const CURRENT_VERSION = '1.0.103';

const VERSION_CHECK_INTERVAL = 3 * 60 * 1000; // Проверка каждые 3 минуты
const VERSION_URL = `${import.meta.env.BASE_URL}version.json`;

class VersionChecker {
  private static instance: VersionChecker;
  private checkInterval?: ReturnType<typeof setInterval>;
  private updateCallback?: (info: VersionInfo) => void;
  private lastCheckedVersion?: string;

  private constructor() {}

  static getInstance(): VersionChecker {
    if (!VersionChecker.instance) {
      VersionChecker.instance = new VersionChecker();
    }
    return VersionChecker.instance;
  }

  /**
   * Проверяет наличие обновлений на сервере
   */
  async checkForUpdates(): Promise<VersionInfo | null> {
    try {
      // Добавляем timestamp чтобы гарантированно обойти кэш
      const cacheBuster = Date.now();
      const response = await fetch(`${VERSION_URL}?_=${cacheBuster}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      });

      if (!response.ok) {
        console.warn('[VersionChecker] Failed to fetch version.json:', response.status);
        return null;
      }

      const serverVersion: VersionInfo = await response.json();
      
      console.log(`[VersionChecker] Server version: ${serverVersion.version}, Client version: ${CURRENT_VERSION}`);

      // Проверяем нужно ли обновление
      if (this.isNewerVersion(serverVersion.version, CURRENT_VERSION)) {
        // Не показываем повторно то же обновление
        if (this.lastCheckedVersion === serverVersion.version) {
          return null;
        }
        
        this.lastCheckedVersion = serverVersion.version;
        console.log(`[VersionChecker] 🚀 New version available: ${serverVersion.version}`);
        return serverVersion;
      }

      return null;
    } catch (error) {
      console.error('[VersionChecker] Error checking version:', error);
      return null;
    }
  }

  /**
   * Сравнивает версии (semver)
   */
  private isNewerVersion(serverVersion: string, clientVersion: string): boolean {
    const serverParts = serverVersion.split('.').map(Number);
    const clientParts = clientVersion.split('.').map(Number);

    for (let i = 0; i < Math.max(serverParts.length, clientParts.length); i++) {
      const server = serverParts[i] || 0;
      const client = clientParts[i] || 0;
      
      if (server > client) return true;
      if (server < client) return false;
    }
    
    return false;
  }

  /**
   * Запускает периодическую проверку обновлений
   */
  startPeriodicCheck(onUpdateAvailable: (info: VersionInfo) => void): void {
    this.updateCallback = onUpdateAvailable;

    // Проверяем сразу при старте (с небольшой задержкой)
    globalCleanup.setTimeout(async () => {
      const info = await this.checkForUpdates();
      if (info && this.updateCallback) {
        this.updateCallback(info);
      }
    }, 2000);

    // Периодическая проверка
    this.checkInterval = globalCleanup.setInterval(async () => {
      const info = await this.checkForUpdates();
      if (info && this.updateCallback) {
        this.updateCallback(info);
      }
    }, VERSION_CHECK_INTERVAL);

    console.log('[VersionChecker] Started periodic version checks');
  }

  /**
   * Останавливает периодическую проверку
   */
  stopPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    console.log('[VersionChecker] Stopped periodic version checks');
  }

  /**
   * Принудительно обновляет приложение
   */
  async forceUpdate(): Promise<void> {
    console.log('[VersionChecker] 🔄 Forcing update...');

    try {
      // 1. Очищаем Service Worker кэши
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => {
            console.log(`[VersionChecker] Deleting cache: ${cacheName}`);
            return caches.delete(cacheName);
          })
        );
      }

      // 2. Отменяем регистрацию Service Worker
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(registration => {
            console.log('[VersionChecker] Unregistering SW');
            return registration.unregister();
          })
        );
      }

      // 3. Очищаем localStorage флаг (опционально)
      localStorage.setItem('app_last_update', Date.now().toString());

    } catch (error) {
      console.error('[VersionChecker] Error during cache cleanup:', error);
    }

    // 4. Жёсткая перезагрузка
    // @ts-ignore - location.reload(true) deprecated но работает
    window.location.reload(true);
  }

  /**
   * Получить текущую версию клиента
   */
  getCurrentVersion(): string {
    return CURRENT_VERSION;
  }
}

export const versionChecker = VersionChecker.getInstance();
