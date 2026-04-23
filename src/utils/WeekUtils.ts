// src/utils/WeekUtils.ts
// Утилиты для работы с днями недели (будни/выходные для турниров)

// =====================================================
// DEV TEST: Принудительный режим выходных
// =====================================================
let devForceWeekend = false;

export function devToggleWeekend(): boolean {
  devForceWeekend = !devForceWeekend;
  console.log(`[DEV TEST] Force weekend mode: ${devForceWeekend ? 'ON' : 'OFF'}`);
  return devForceWeekend;
}

/**
 * Проверяет, является ли день выходным (Сб-Вс)
 * DEV TEST: Учитывает принудительный режим выходных
 */
export function isWeekend(date: Date = new Date()): boolean {
  // DEV TEST: Если включен режим выходных
  if (devForceWeekend) return true;
  
  const day = date.getDay(); // 0 = воскресенье, 6 = суббота
  return day === 0 || day === 6;
}

/**
 * Проверяет, является ли день будним (Пн-Пт)
 */
export function isWeekday(date: Date = new Date()): boolean {
  return !isWeekend(date);
}

/**
 * Получает текущий день недели (0 = воскресенье, 1 = понедельник, ..., 6 = суббота)
 */
export function getDayOfWeek(date: Date = new Date()): number {
  return date.getDay();
}

