// src/ui/DebugOverlay.ts
// Debug overlay для отображения ошибок в Telegram WebView

interface ErrorInfo {
  id: string;
  timestamp: number;
  type: 'error' | 'rejection' | 'warning';
  message: string;
  stack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
  reason?: any;
}

export class DebugOverlay {
  private static instance: DebugOverlay;
  private container: HTMLDivElement | null = null;
  private errorHistory: ErrorInfo[] = [];
  private maxHistorySize = 10;
  private isVisible = false;
  private currentErrorId: string | null = null;

  private constructor() {
    this.createOverlay();
    this.setupKeyboardHandlers();
  }

  private setupKeyboardHandlers(): void {
    // Закрытие по Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
  }

  static getInstance(): DebugOverlay {
    if (!DebugOverlay.instance) {
      DebugOverlay.instance = new DebugOverlay();
    }
    return DebugOverlay.instance;
  }

  private createOverlay(): void {
    // Создаём контейнер overlay
    this.container = document.createElement('div');
    this.container.id = 'debug-overlay';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      z-index: 999999;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
      font-family: 'Orbitron', 'Arial', sans-serif;
      color: #fff;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    `;

    // Заголовок
    const header = document.createElement('div');
    header.style.cssText = `
      font-size: 24px;
      font-weight: bold;
      color: #ff4444;
      margin-bottom: 20px;
      text-align: center;
    `;
    header.textContent = '⚠️ Ошибка приложения';

    // Контейнер для сообщения
    const messageContainer = document.createElement('div');
    messageContainer.id = 'debug-message';
    messageContainer.style.cssText = `
      background: rgba(255, 68, 68, 0.1);
      border: 2px solid #ff4444;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      max-width: 90%;
      word-wrap: break-word;
      font-size: 14px;
      line-height: 1.5;
      max-height: 40vh;
      overflow-y: auto;
    `;

    // Кнопки
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
      margin-top: 16px;
    `;

    // Кнопка "Копировать"
    const copyBtn = this.createButton('📋 Копировать', () => {
      this.copyErrorToClipboard();
    });

    // Кнопка "Закрыть"
    const closeBtn = this.createButton('✕ Закрыть', () => {
      this.hide();
    });

    // Кнопка "Отправить отчёт" (опционально)
    const reportBtn = this.createButton('📤 Отправить отчёт', () => {
      this.sendErrorReport();
    });

    // Кнопка "История" (если есть несколько ошибок)
    const historyBtn = this.createButton('📜 История', () => {
      this.showHistory();
    });
    historyBtn.id = 'debug-history-btn';
    historyBtn.style.display = 'none';

    buttonContainer.appendChild(copyBtn);
    buttonContainer.appendChild(reportBtn);
    buttonContainer.appendChild(historyBtn);
    buttonContainer.appendChild(closeBtn);

    // Информация о версии/окружении
    const envInfo = document.createElement('div');
    envInfo.style.cssText = `
      margin-top: 20px;
      font-size: 12px;
      color: #888;
      text-align: center;
    `;
    envInfo.textContent = `User-Agent: ${navigator.userAgent.substring(0, 50)}...`;

    this.container.appendChild(header);
    this.container.appendChild(messageContainer);
    this.container.appendChild(buttonContainer);
    this.container.appendChild(envInfo);

    document.body.appendChild(this.container);
  }

  private createButton(text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText = `
      padding: 12px 24px;
      background: #333;
      border: 2px solid #555;
      border-radius: 6px;
      color: #fff;
      font-family: 'Orbitron', 'Arial', sans-serif;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
      min-width: 120px;
    `;
    btn.onmouseover = () => {
      btn.style.background = '#444';
      btn.style.borderColor = '#666';
    };
    btn.onmouseout = () => {
      btn.style.background = '#333';
      btn.style.borderColor = '#555';
    };
    btn.onclick = onClick;
    return btn;
  }

  private formatError(error: ErrorInfo): string {
    let text = `[${error.type.toUpperCase()}] ${error.message}\n\n`;
    
    if (error.stack) {
      text += `Stack trace:\n${error.stack}\n\n`;
    }
    
    if (error.source) {
      text += `Source: ${error.source}`;
      if (error.lineno) text += `:${error.lineno}`;
      if (error.colno) text += `:${error.colno}`;
      text += '\n\n';
    }
    
    if (error.reason) {
      text += `Reason: ${String(error.reason)}\n\n`;
    }
    
    text += `Time: ${new Date(error.timestamp).toLocaleString()}\n`;
    text += `ID: ${error.id}`;
    
    return text;
  }

  showError(error: ErrorInfo): void {
    if (!this.container) return;

    // Добавляем в историю
    this.errorHistory.unshift(error);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.pop();
    }
    this.currentErrorId = error.id;

    // Сохраняем в localStorage для отладки (последние 5 ошибок)
    try {
      const recentErrors = this.errorHistory.slice(0, 5);
      localStorage.setItem('galaxy_league_error_history', JSON.stringify(recentErrors));
    } catch (e) {
      // Игнорируем ошибки localStorage (может быть недоступен)
    }

    // Обновляем сообщение
    const messageEl = this.container.querySelector('#debug-message') as HTMLDivElement;
    if (messageEl) {
      messageEl.textContent = this.formatError(error);
    }

    // Обновляем индикатор количества ошибок и кнопку истории
    this.updateErrorCounter();
    this.updateHistoryButton();

    // Показываем overlay
    this.container.style.display = 'flex';
    this.isVisible = true;

    // Предотвращаем скролл body при открытом overlay
    document.body.style.overflow = 'hidden';

    // Закрытие по клику вне области сообщения (опционально)
    this.container.onclick = (e) => {
      if (e.target === this.container) {
        // Можно закрывать по клику вне области, но лучше оставить только кнопку
        // this.hide();
      }
    };

    // Логируем в консоль
    console.error('[DebugOverlay]', error);
  }

  private updateErrorCounter(): void {
    if (!this.container) return;
    
    // Ищем или создаём индикатор количества ошибок
    let counter = this.container.querySelector('#debug-error-counter') as HTMLDivElement;
    if (!counter) {
      counter = document.createElement('div');
      counter.id = 'debug-error-counter';
      counter.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(255, 68, 68, 0.2);
        border: 1px solid #ff4444;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 12px;
        color: #ff4444;
      `;
      this.container.appendChild(counter);
    }
    
    if (this.errorHistory.length > 1) {
      counter.textContent = `${this.errorHistory.length} ошибок`;
      counter.style.display = 'block';
    } else {
      counter.style.display = 'none';
    }
  }

  hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
      this.isVisible = false;
      document.body.style.overflow = '';
    }
  }

  private copyErrorToClipboard(): void {
    if (!this.currentErrorId) return;
    
    const error = this.errorHistory.find(e => e.id === this.currentErrorId);
    if (!error) return;

    const text = this.formatError(error);
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('✅ Скопировано в буфер обмена');
      }).catch(() => {
        this.fallbackCopy(text);
      });
    } else {
      this.fallbackCopy(text);
    }
  }

  private fallbackCopy(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      this.showToast('✅ Скопировано');
    } catch (e) {
      this.showToast('❌ Не удалось скопировать');
    }
    document.body.removeChild(textarea);
  }

  private showToast(message: string): void {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.9);
      color: #fff;
      padding: 12px 24px;
      border-radius: 6px;
      z-index: 1000000;
      font-family: 'Orbitron', 'Arial', sans-serif;
      font-size: 14px;
    `;
    document.body.appendChild(toast);
    // DebugOverlay - используем globalCleanup для очистки
    import('../utils/GlobalCleanup').then(({ globalCleanup }) => {
      globalCleanup.setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 2000);
    });
  }

  private sendErrorReport(): void {
    if (!this.currentErrorId) return;
    
    const error = this.errorHistory.find(e => e.id === this.currentErrorId);
    if (!error) return;

    const report = {
      error: {
        message: error.message,
        stack: error.stack,
        type: error.type,
        source: error.source,
        lineno: error.lineno,
        colno: error.colno,
      },
      userAgent: navigator.userAgent,
      timestamp: error.timestamp,
      url: window.location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };

    // TODO: Реализовать отправку на сервер
    // Пока просто логируем
    console.log('[ErrorReport]', report);
    
    // Можно использовать Telegram WebApp API для отправки данных
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg && tg.sendData) {
        tg.sendData(JSON.stringify({
          type: 'error_report',
          ...report,
        }));
        this.showToast('📤 Отчёт отправлен');
      } else {
        this.showToast('⚠️ Отправка недоступна');
      }
    } catch (e) {
      console.error('[ErrorReport] Failed to send:', e);
      this.showToast('❌ Ошибка отправки');
    }
  }

  getErrorHistory(): ErrorInfo[] {
    return [...this.errorHistory];
  }

  isOverlayVisible(): boolean {
    return this.isVisible;
  }

  // Загрузка истории из localStorage
  loadErrorHistoryFromStorage(): ErrorInfo[] {
    try {
      const stored = localStorage.getItem('galaxy_league_error_history');
      if (stored) {
        const parsed = JSON.parse(stored) as ErrorInfo[];
        this.errorHistory = parsed;
        return parsed;
      }
    } catch (e) {
      console.warn('[DebugOverlay] Failed to load error history from storage:', e);
    }
    return [];
  }

  // Очистка истории
  clearHistory(): void {
    this.errorHistory = [];
    try {
      localStorage.removeItem('galaxy_league_error_history');
    } catch (e) {
      // Игнорируем
    }
  }

  private updateHistoryButton(): void {
    if (!this.container) return;
    const historyBtn = this.container.querySelector('#debug-history-btn') as HTMLButtonElement;
    if (historyBtn) {
      historyBtn.style.display = this.errorHistory.length > 1 ? 'block' : 'none';
    }
  }

  private showHistory(): void {
    if (this.errorHistory.length === 0) return;

    const historyText = this.errorHistory
      .map((err, idx) => {
        return `\n--- Ошибка ${idx + 1} ---\n${this.formatError(err)}\n`;
      })
      .join('\n');

    const messageEl = this.container?.querySelector('#debug-message') as HTMLDivElement;
    if (messageEl) {
      messageEl.textContent = `История ошибок (${this.errorHistory.length}):\n${historyText}`;
      messageEl.scrollTop = 0;
    }
  }
}

export const debugOverlay = DebugOverlay.getInstance();
export type { ErrorInfo };

