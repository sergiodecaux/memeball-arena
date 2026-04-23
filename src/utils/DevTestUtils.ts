// =====================================================
// DEV TEST UTILITIES - УДАЛИТЬ ПЕРЕД РЕЛИЗОМ!
// =====================================================

import { playerData } from '../data/PlayerData';
import { LeagueManager } from '../managers/LeagueManager';
import { LeagueTier } from '../types/league';

/**
 * DEV TEST: Добавить кристаллы для тестирования
 */
export function devAddCrystals(amount: number = 1000): void {
  const data = playerData.get();
  data.crystals += amount;
  playerData.save();
  console.log(`[DEV TEST] Added ${amount} crystals. Total: ${data.crystals}`);
}

/**
 * DEV TEST: Добавить монеты для тестирования
 */
export function devAddCoins(amount: number = 10000): void {
  const data = playerData.get();
  data.coins += amount;
  playerData.save();
  console.log(`[DEV TEST] Added ${amount} coins. Total: ${data.coins}`);
}

/**
 * DEV TEST: Повысить лигу на 1 дивизион (экспортируем для использования)
 */
export function devPromoteLeague(): void {
  const data = playerData.get();
  if (!data.leagueProgress) {
    console.warn('[DEV TEST] No league progress found');
    return;
  }
  
  const progress = data.leagueProgress;
  
  // Переходим на следующий дивизион или лигу
  if (progress.division > 1) {
    progress.division = (progress.division - 1) as 1 | 2 | 3;
    progress.stars = 0;
    console.log(`[DEV TEST] Promoted to Division ${progress.division}`);
  } else {
    // Переход в следующую лигу
    const tiers: LeagueTier[] = [
      LeagueTier.METEORITE,
      LeagueTier.COMET,
      LeagueTier.PLANET,
      LeagueTier.STAR,
      LeagueTier.NEBULA,
      LeagueTier.CORE,
    ];
    
    const currentIndex = tiers.indexOf(progress.currentTier);
    if (currentIndex < tiers.length - 1) {
      progress.currentTier = tiers[currentIndex + 1];
      progress.division = 3;
      progress.stars = 0;
      console.log(`[DEV TEST] Promoted to ${progress.currentTier} League`);
    } else {
      console.log('[DEV TEST] Already at max league (Core I)');
    }
  }
  
  playerData.save();
}

/**
 * DEV TEST: Включить/выключить режим выходных дней
 */
let devWeekendMode = false;

export function devToggleWeekendMode(): boolean {
  devWeekendMode = !devWeekendMode;
  console.log(`[DEV TEST] Weekend mode: ${devWeekendMode ? 'ON' : 'OFF'}`);
  return devWeekendMode;
}

export function devIsWeekendMode(): boolean {
  return devWeekendMode;
}

/**
 * DEV TEST: Получить текущий режим выходных
 */
export function devGetWeekendStatus(): string {
  const now = new Date();
  const day = now.getDay();
  const isRealWeekend = day === 0 || day === 6;
  const isForcedWeekend = devIsWeekendMode();
  
  if (isForcedWeekend) return 'FORCED WEEKEND (DEV)';
  if (isRealWeekend) return 'REAL WEEKEND';
  return 'WEEKDAY';
}

