// src/scenes/game/HapticManager.ts

export class HapticManager {
  static trigger(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light'): void {
    try {
      const webApp = (window as any).Telegram?.WebApp as any;
      if (webApp?.HapticFeedback?.impactOccurred) {
        webApp.HapticFeedback.impactOccurred(style);
      }
    } catch (e) {
      // Ignore errors
    }
  }

  static triggerNotification(type: 'error' | 'success' | 'warning' = 'success'): void {
    try {
      const webApp = (window as any).Telegram?.WebApp as any;
      if (webApp?.HapticFeedback?.notificationOccurred) {
        webApp.HapticFeedback.notificationOccurred(type);
      }
    } catch (e) {
      // Ignore errors
    }
  }
}