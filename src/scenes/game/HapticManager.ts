// src/scenes/game/HapticManager.ts
// 🔄 REFACTORED — Подписывается на EventBus

import { eventBus, GameEvents, HapticFeedbackPayload } from '../../core/EventBus';

type ImpactType = 'light' | 'medium' | 'heavy';
type NotificationType = 'success' | 'warning' | 'error';
export type HapticType = ImpactType | NotificationType;

export class HapticManager {
  private static isVibrationEnabled: boolean = true;
  private static isSubscribed: boolean = false;

  /**
   * Инициализация — подписка на EventBus
   */
  static init(): void {
    if (this.isSubscribed) return;
    
    eventBus.subscribe(GameEvents.HAPTIC_FEEDBACK, this.onHapticEvent, this);
    this.isSubscribed = true;
    
    console.log('[HapticManager] Initialized and subscribed to EventBus');
  }

  /**
   * Очистка подписок
   */
  static cleanup(): void {
    if (!this.isSubscribed) return;
    
    eventBus.unsubscribe(GameEvents.HAPTIC_FEEDBACK, this.onHapticEvent, this);
    this.isSubscribed = false;
  }

  /**
   * Обработчик события из EventBus
   */
  private static onHapticEvent(payload: HapticFeedbackPayload): void {
    this.trigger(payload.type);
  }

  /**
   * Включить/выключить вибрацию
   */
  static setEnabled(enabled: boolean): void {
    this.isVibrationEnabled = enabled;
  }

  /**
   * Проверить, включена ли вибрация
   */
  static isEnabled(): boolean {
    return this.isVibrationEnabled;
  }

  /**
   * Универсальный метод тактильной обратной связи
   * Автоматически определяет impact или notification
   * Использует Vibration API для Game режима
   */
  static trigger(type: HapticType): void {
    if (!this.isVibrationEnabled) return;
    if (!navigator.vibrate) return;

    try {
      // Impact types
      if (type === 'light' || type === 'medium' || type === 'heavy') {
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
        }
      } 
      // Notification types
      else if (type === 'success' || type === 'warning' || type === 'error') {
        switch (type) {
          case 'success':
            navigator.vibrate([10, 50, 10]);
            break;
          case 'warning':
            navigator.vibrate([20, 30, 20]);
            break;
          case 'error':
            navigator.vibrate([30, 50, 30]);
            break;
        }
      }
    } catch (e) {
      // Vibration not available
    }
  }

  /**
   * Тактильная обратная связь (impact)
   * Использует Vibration API для Game режима
   */
  static triggerImpact(type: ImpactType): void {
    if (!this.isVibrationEnabled) return;
    if (!navigator.vibrate) return;

    try {
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
      }
    } catch (e) {
      // Vibration not available
    }
  }

  /**
   * Уведомление (notification)
   * Использует Vibration API для Game режима
   */
  static triggerNotification(type: NotificationType): void {
    if (!this.isVibrationEnabled) return;
    if (!navigator.vibrate) return;

    try {
      switch (type) {
        case 'success':
          navigator.vibrate([10, 50, 10]);
          break;
        case 'warning':
          navigator.vibrate([20, 30, 20]);
          break;
        case 'error':
          navigator.vibrate([30, 50, 30]);
          break;
      }
    } catch (e) {
      // Vibration not available
    }
  }

  /**
   * Выбор (selection changed)
   * Использует Vibration API для Game режима
   */
  static triggerSelection(): void {
    if (!this.isVibrationEnabled) return;
    if (!navigator.vibrate) return;

    try {
      navigator.vibrate(5);
    } catch (e) {
      // Vibration not available
    }
  }

  /**
   * Специальная вибрация для гола - эпичная и запоминающаяся
   * @param isMyGoal - мой гол (более сильная) или соперника
   */
  static triggerGoalVibration(isMyGoal: boolean): void {
    if (!this.isVibrationEnabled) return;
    if (!navigator.vibrate) return;

    try {
      if (isMyGoal) {
        // Эпичный паттерн для своего гола: нарастающая вибрация + финальный удар
        navigator.vibrate([
          30,   // короткий удар
          50,   // пауза
          50,   // средний удар
          50,   // пауза
          80,   // сильный удар
          80,   // пауза
          120,  // очень сильный финальный удар
        ]);
      } else {
        // Для гола соперника - более мягкий паттерн
        navigator.vibrate([
          20,   // удар
          40,   // пауза
          40,   // удар
        ]);
      }
    } catch (e) {
      // Vibration not available
    }
  }
}