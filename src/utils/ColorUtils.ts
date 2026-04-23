// src/utils/ColorUtils.ts

/**
 * Утилиты для работы с цветами
 * Используются в генераторах текстур
 */

export function colorToRgb(color: number): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgb(${r},${g},${b})`;
}

export function colorToRgba(color: number, alpha: number): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function lightenColor(rgb: string, factor: number): string {
  const match = rgb.match(/\d+/g);
  if (!match) return rgb;
  
  const r = Math.min(255, parseInt(match[0]) + Math.floor(factor * 100));
  const g = Math.min(255, parseInt(match[1]) + Math.floor(factor * 100));
  const b = Math.min(255, parseInt(match[2]) + Math.floor(factor * 100));
  
  return `rgb(${r},${g},${b})`;
}

export function darkenColorRgb(rgb: string, factor: number): string {
  const match = rgb.match(/\d+/g);
  if (!match) return rgb;
  
  const r = Math.max(0, parseInt(match[0]) - Math.floor(factor * 100));
  const g = Math.max(0, parseInt(match[1]) - Math.floor(factor * 100));
  const b = Math.max(0, parseInt(match[2]) - Math.floor(factor * 100));
  
  return `rgb(${r},${g},${b})`;
}

export function darkenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const nr = Math.floor(r * (1 - factor));
  const ng = Math.floor(g * (1 - factor));
  const nb = Math.floor(b * (1 - factor));

  return `rgb(${nr},${ng},${nb})`;
}

/**
 * Конвертирует число в hex-строку цвета
 */
export function numberToHex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}