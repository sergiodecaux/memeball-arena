// src/utils/OnScreenLogger.ts
// Визуальный логгер для отображения ошибок прямо в игре

export class OnScreenLogger {
  private static container?: HTMLDivElement;
  private static logs: string[] = [];
  private static maxLogs = 20;
  private static isVisible = true;

  static init() {
    // ✅ ОТКЛЮЧЕНО: Debug logs окно убрано по запросу пользователя
    return;
    
    console.log('[OnScreenLogger] init() called');
    
    if (this.container) {
      console.log('[OnScreenLogger] Already initialized');
      return;
    }

    // Создаем контейнер логов
    this.container = document.createElement('div');
    this.container.id = 'onscreen-logger';
    this.container.style.cssText = `
      position: fixed;
      top: 50px;
      left: 10px;
      right: 10px;
      max-width: 95vw;
      max-height: 70vh;
      background: rgba(0, 0, 0, 0.95);
      color: #00ff00;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      padding: 15px;
      border: 3px solid #00ff00;
      border-radius: 12px;
      overflow-y: auto;
      z-index: 999999;
      box-shadow: 0 0 30px rgba(0, 255, 0, 0.5);
    `;

    // Заголовок
    const header = document.createElement('div');
    header.style.cssText = `
      font-weight: bold;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 2px solid #00ff00;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 16px;
    `;
    header.innerHTML = `
      <span>🐛 DEBUG LOGS</span>
      <button id="toggle-logger" style="background: #00ff00; color: black; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold;">Hide</button>
    `;
    this.container.appendChild(header);

    // Контейнер для логов
    const logsContainer = document.createElement('div');
    logsContainer.id = 'logs-content';
    logsContainer.style.cssText = `
      max-height: 55vh;
      overflow-y: auto;
      font-size: 12px;
      line-height: 1.6;
    `;
    this.container.appendChild(logsContainer);

    document.body.appendChild(this.container);
    console.log('[OnScreenLogger] Container added to body');

    // Toggle button
    const toggleBtn = document.getElementById('toggle-logger');
    toggleBtn?.addEventListener('click', () => {
      this.toggle();
    });

    // Добавляем большую плавающую кнопку для показа логов
    this.createFloatingButton();

    console.log('[OnScreenLogger] ✅ Initialized successfully');
    
    // Тестовое сообщение
    this.info('System', 'OnScreenLogger активирован!');
  }

  private static createFloatingButton() {
    const floatingBtn = document.createElement('button');
    floatingBtn.id = 'floating-logger-btn';
    floatingBtn.innerHTML = '🐛';
    floatingBtn.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      background: #00ff00;
      color: black;
      border: 3px solid #000;
      border-radius: 50%;
      font-size: 30px;
      cursor: pointer;
      z-index: 999998;
      box-shadow: 0 4px 12px rgba(0, 255, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    floatingBtn.addEventListener('click', () => {
      if (this.container) {
        const isHidden = this.container.style.display === 'none';
        this.container.style.display = isHidden ? 'block' : 'none';
        this.isVisible = isHidden;
      }
    });
    
    document.body.appendChild(floatingBtn);
    console.log('[OnScreenLogger] Floating button created');
  }

  static toggle() {
    this.isVisible = !this.isVisible;
    if (this.container) {
      this.container.style.display = this.isVisible ? 'block' : 'none';
    }
    const toggleBtn = document.getElementById('toggle-logger');
    if (toggleBtn) {
      toggleBtn.textContent = this.isVisible ? 'Hide' : 'Show';
    }
  }

  static log(level: 'info' | 'warn' | 'error' | 'debug', category: string, message: string, data?: any) {
    const timestamp = new Date().toISOString().substr(11, 12);
    const color = {
      info: '#00ff00',
      warn: '#ffaa00',
      error: '#ff0000',
      debug: '#00aaff'
    }[level];

    const emoji = {
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      debug: '🔍'
    }[level];

    let logText = `${emoji} [${timestamp}] [${category}] ${message}`;
    if (data) {
      logText += `\n📦 ${JSON.stringify(data, null, 2)}`;
    }

    this.logs.push(`<div style="color: ${color}; margin-bottom: 8px; padding: 5px; background: rgba(255,255,255,0.05); border-left: 3px solid ${color};">${logText.replace(/\n/g, '<br>')}</div>`);

    // Ограничиваем количество логов
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.render();
  }

  static info(category: string, message: string, data?: any) {
    this.log('info', category, message, data);
  }

  static warn(category: string, message: string, data?: any) {
    this.log('warn', category, message, data);
  }

  static error(category: string, message: string, data?: any) {
    this.log('error', category, message, data);
  }

  static debug(category: string, message: string, data?: any) {
    this.log('debug', category, message, data);
  }

  static clear() {
    this.logs = [];
    this.render();
  }

  private static render() {
    const logsContent = document.getElementById('logs-content');
    if (logsContent) {
      logsContent.innerHTML = this.logs.join('');
      // Автоскролл вниз
      logsContent.scrollTop = logsContent.scrollHeight;
    }
  }
}

// ✅ ОТКЛЮЧЕНО: Автоинициализация убрана по запросу пользователя
// Автоинициализация при импорте
// if (typeof window !== 'undefined') {
//   // Пробуем инициализировать сразу
//   const tryInit = () => {
//     if (document.body) {
//       OnScreenLogger.init();
//       console.log('[OnScreenLogger] Auto-initialized');
//     } else {
//       console.log('[OnScreenLogger] Body not ready, waiting...');
//       setTimeout(tryInit, 100);
//     }
//   };
//
//   if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', tryInit);
//   } else {
//     tryInit();
//   }
//   
//   // Дополнительная попытка через секунду на всякий случай
//   setTimeout(() => {
//     if (!OnScreenLogger['container']) {
//       console.warn('[OnScreenLogger] Forcing init after 1 second');
//       OnScreenLogger.init();
//     }
//   }, 1000);
// }
