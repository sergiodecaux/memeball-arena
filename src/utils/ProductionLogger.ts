// src/utils/ProductionLogger.ts
// Централизованная система логирования для production

// import { OnScreenLogger } from './OnScreenLogger'; // ✅ ОТКЛЮЧЕНО: Убрано окно Debug logs

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  sessionId: string;
  userId?: string;
  url?: string;
  userAgent?: string;
}

/**
 * Буфер для batch-отправки логов
 */
interface BufferedLogEntry {
  timestamp: number;
  level: string;
  category: string;
  message: string;
  data?: unknown;
}

class LogBuffer {
  private buffer: BufferedLogEntry[] = [];
  private readonly maxSize = 50;
  private readonly flushInterval = 10000; // 10 секунд
  private flushTimer: number | null = null;
  private readonly endpoint: string | null = null;

  constructor() {
    // Endpoint только для production, если нужен
    if (typeof window !== 'undefined' && !import.meta.env.DEV) {
      // this.endpoint = 'https://your-logging-endpoint.com/ingest';
      this.endpoint = null; // Отключено по умолчанию
    }
    this.startAutoFlush();
  }

  add(entry: BufferedLogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length >= this.maxSize) {
      this.flush();
    }
  }

  private startAutoFlush(): void {
    if (typeof window === 'undefined') return;
    
    this.flushTimer = window.setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  flush(): void {
    if (this.buffer.length === 0 || !this.endpoint) return;

    const entries = [...this.buffer];
    this.buffer = [];

    // Используем sendBeacon для надёжной отправки
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try {
        const blob = new Blob([JSON.stringify(entries)], { type: 'application/json' });
        navigator.sendBeacon(this.endpoint, blob);
      } catch (e) {
        // Fallback: просто очищаем буфер
      }
    }
  }

  destroy(): void {
    if (this.flushTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush(); // Последняя отправка
    this.buffer = [];
  }
}

const logBuffer = new LogBuffer();

class ProductionLoggerClass {
  private logs: LogEntry[] = [];
  private sessionId: string;
  private serverEndpoint: string | null = null;
  private maxLogsInMemory = 500;
  private flushInterval = 30000; // 30 секунд
  private flushTimer?: number;
  private userId?: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.loadFromLocalStorage();
    this.startAutoFlush();
    this.setupErrorHandlers();
  }

  /**
   * Настроить endpoint сервера для отправки логов
   */
  setServerEndpoint(endpoint: string): void {
    this.serverEndpoint = endpoint;
    console.log('[ProductionLogger] Server endpoint set:', endpoint);
  }

  /**
   * Установить ID пользователя
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Логировать отладочное сообщение
   */
  debug(category: string, message: string, data?: any): void {
    this.log('debug', category, message, data);
    // OnScreenLogger.debug(category, message, data); // ✅ ОТКЛЮЧЕНО
    
    // Добавляем в буфер для batch-отправки
    logBuffer.add({
      timestamp: Date.now(),
      level: 'debug',
      category,
      message,
      data
    });
  }

  /**
   * Логировать информационное сообщение
   */
  info(category: string, message: string, data?: any): void {
    this.log('info', category, message, data);
    // OnScreenLogger.info(category, message, data); // ✅ ОТКЛЮЧЕНО
    
    // Добавляем в буфер для batch-отправки
    logBuffer.add({
      timestamp: Date.now(),
      level: 'info',
      category,
      message,
      data
    });
  }

  /**
   * Логировать предупреждение
   */
  warn(category: string, message: string, data?: any): void {
    this.log('warn', category, message, data);
    // OnScreenLogger.warn(category, message, data); // ✅ ОТКЛЮЧЕНО
    if (typeof window !== 'undefined') {
      console.warn(`[${category}] ${message}`, data);
    }
    
    // Добавляем в буфер для batch-отправки
    logBuffer.add({
      timestamp: Date.now(),
      level: 'warn',
      category,
      message,
      data
    });
  }

  /**
   * Логировать ошибку
   */
  error(category: string, message: string, data?: any): void {
    this.log('error', category, message, data);
    // OnScreenLogger.error(category, message, data); // ✅ ОТКЛЮЧЕНО
    if (typeof window !== 'undefined') {
      console.error(`[${category}] ${message}`, data);
    }
    
    // Добавляем в буфер для batch-отправки
    logBuffer.add({
      timestamp: Date.now(),
      level: 'error',
      category,
      message,
      data
    });
  }

  /**
   * Логировать критическую ошибку
   */
  critical(category: string, message: string, data?: any): void {
    this.log('critical', category, message, data);
    // OnScreenLogger.error(category, `CRITICAL: ${message}`, data); // ✅ ОТКЛЮЧЕНО
    if (typeof window !== 'undefined') {
      console.error(`[CRITICAL][${category}] ${message}`, data);
    }
    
    // Добавляем в буфер для batch-отправки
    logBuffer.add({
      timestamp: Date.now(),
      level: 'critical',
      category,
      message,
      data
    });
    
    // Критические ошибки отправляем немедленно
    this.flushToServer();
    logBuffer.flush();
  }

  /**
   * Основной метод логирования
   */
  private log(level: LogLevel, category: string, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data: this.sanitizeData(data),
      sessionId: this.sessionId,
      userId: this.userId,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };

    this.logs.push(entry);

    // Ограничиваем размер буфера в памяти
    if (this.logs.length > this.maxLogsInMemory) {
      this.logs.shift();
    }

    // Сохраняем в localStorage
    this.saveToLocalStorage();

    // Для production выводим только важные логи
    if ((level === 'error' || level === 'critical') && typeof window !== 'undefined') {
      console.log(`[ProductionLogger][${level}][${category}]`, message, data);
    }
  }

  /**
   * Очистка чувствительных данных из логов
   */
  private sanitizeData(data: any): any {
    if (!data) return data;

    // Создаем копию, чтобы не изменять оригинал
    const copy = JSON.parse(JSON.stringify(data));

    // Список полей, которые нужно скрыть
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authToken'];

    const sanitize = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;

      for (const key in obj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          obj[key] = '***REDACTED***';
        } else if (typeof obj[key] === 'object') {
          sanitize(obj[key]);
        }
      }
      return obj;
    };

    return sanitize(copy);
  }

  /**
   * Отправить логи на сервер
   */
  async flushToServer(): Promise<void> {
    if (!this.serverEndpoint || this.logs.length === 0) {
      return;
    }

    const logsToSend = [...this.logs];
    
    try {
      const response = await fetch(this.serverEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: logsToSend,
          sessionId: this.sessionId,
          userId: this.userId,
        }),
      });

      if (response.ok) {
        // Успешно отправлено - очищаем отправленные логи
        this.logs = this.logs.slice(logsToSend.length);
        this.saveToLocalStorage();
        console.log(`[ProductionLogger] Flushed ${logsToSend.length} logs to server`);
      } else {
        console.warn('[ProductionLogger] Failed to flush logs:', response.status);
      }
    } catch (error) {
      console.error('[ProductionLogger] Error flushing logs:', error);
      // Не удаляем логи при ошибке отправки
    }
  }

  /**
   * Получить все логи (для ручного экспорта)
   */
  getAllLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Экспортировать логи как JSON
   */
  exportAsJSON(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      userId: this.userId,
      exportTime: Date.now(),
      logs: this.logs,
    }, null, 2);
  }

  /**
   * Очистить все логи
   */
  clearLogs(): void {
    this.logs = [];
    this.saveToLocalStorage();
  }

  /**
   * Сохранить логи в localStorage
   */
  private saveToLocalStorage(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    
    try {
      // Сохраняем только последние 200 логов в localStorage
      const logsToSave = this.logs.slice(-200);
      localStorage.setItem('production_logs', JSON.stringify(logsToSave));
    } catch (error) {
      if (typeof window !== 'undefined') {
        console.error('[ProductionLogger] Failed to save to localStorage:', error);
      }
    }
  }

  /**
   * Загрузить логи из localStorage
   */
  private loadFromLocalStorage(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    
    try {
      const saved = localStorage.getItem('production_logs');
      if (saved) {
        this.logs = JSON.parse(saved);
        if (typeof window !== 'undefined') {
          console.log(`[ProductionLogger] Loaded ${this.logs.length} logs from localStorage`);
        }
      }
    } catch (error) {
      if (typeof window !== 'undefined') {
        console.error('[ProductionLogger] Failed to load from localStorage:', error);
      }
    }
  }

  /**
   * Автоматическая отправка логов на сервер
   */
  private startAutoFlush(): void {
    if (typeof window === 'undefined') return;
    
    this.flushTimer = window.setInterval(() => {
      this.flushToServer();
    }, this.flushInterval);
  }

  /**
   * Генерация уникального ID сессии
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Настройка глобальных обработчиков ошибок
   */
  private setupErrorHandlers(): void {
    if (typeof window === 'undefined') return;
    
    // Intentionally using direct addEventListener - these handlers 
    // should persist for the entire app lifecycle
    window.addEventListener('error', (event) => {
      this.error('GlobalError', event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.stack,
      });
    });

    // Intentionally using direct addEventListener - these handlers 
    // should persist for the entire app lifecycle
    window.addEventListener('unhandledrejection', (event) => {
      this.error('UnhandledPromise', 'Unhandled promise rejection', {
        reason: event.reason,
        promise: event.promise,
      });
    });

    // Intentionally using direct addEventListener - these handlers 
    // should persist for the entire app lifecycle
    window.addEventListener('beforeunload', () => {
      this.flushToServer();
      logBuffer.flush();
    });
  }

  /**
   * Остановить логгер
   */
  destroy(): void {
    if (this.flushTimer && typeof window !== 'undefined') {
      window.clearInterval(this.flushTimer);
    }
    this.flushToServer();
    logBuffer.destroy();
  }
  
  /**
   * Статический метод для глобальной очистки
   */
  static destroy(): void {
    logBuffer.destroy();
  }
}

// Singleton instance
export const ProductionLogger = new ProductionLoggerClass();

// Экспортируем удобные функции для быстрого использования
export const logDebug = (category: string, message: string, data?: any) => 
  ProductionLogger.debug(category, message, data);

export const logInfo = (category: string, message: string, data?: any) => 
  ProductionLogger.info(category, message, data);

export const logWarn = (category: string, message: string, data?: any) => 
  ProductionLogger.warn(category, message, data);

export const logError = (category: string, message: string, data?: any) => 
  ProductionLogger.error(category, message, data);

export const logCritical = (category: string, message: string, data?: any) => 
  ProductionLogger.critical(category, message, data);
