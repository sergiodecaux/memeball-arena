// src/utils/Haptics.ts
// Haptic feedback для Telegram Game (через Vibration API)

/**
 * Короткий удар (impact) — используем для BATTLE и кнопок покупки
 */
export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium'): void {
  if (!navigator.vibrate) return;
  
  switch (style) {
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

/**
 * Лёгкий feedback при выборе/переключении — вкладки, свитчи, выбор фракции
 */
export function hapticSelection(): void {
  if (navigator.vibrate) {
    navigator.vibrate(5);
  }
}

/**
 * Уведомления (success, warning, error)
 */
export function hapticNotification(type: 'success' | 'warning' | 'error'): void {
  if (!navigator.vibrate) return;
  
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
