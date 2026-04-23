// ✅ СОЗДАНО: Чистый утилитарный модуль Faction Mastery без зависимостей от состояния игрока

// ========== ТИПЫ ==========

/**
 * Тип матча для расчёта XP
 */
export type MatchType = 'quick' | 'campaign' | 'pvp';

/**
 * Описание результата матча для расчёта XP мастерства
 */
export interface MatchPerformance {
  /** Победа игрока */
  isWin: boolean;
  /** Голы игрока */
  goalsScored: number;
  /** Голы соперника */
  goalsConceded: number;
  /** true, если игрок не пропустил ни одного гола */
  isCleanSheet: boolean;
  /** Тип матча (quick / campaign / pvp) */
  matchType: MatchType;
}

/**
 * Разбивка XP за матч
 */
export interface XPBreakdown {
  /** Суммарный XP за матч */
  total: number;
  /** Базовый XP за участие в матче */
  base: number;
  /** Бонус за победу / ничью */
  winBonus: number;
  /** Бонус за забитые голы */
  goalBonus: number;
  /** Бонус за "сухой" матч */
  cleanSheetBonus: number;
}

/**
 * Описание уровня мастерства
 */
export interface MasteryLevelDefinition {
  /** Номер уровня (1..MAX_LEVEL) */
  level: number;
  /** Минимальный XP, с которого начинается этот уровень */
  xpRequired: number;
  /**
   * Размер команды, доступный на этом уровне (3–5).
   * Используется FactionMasteryManager.getTeamSize и debugSetFactionTeamSize.
   */
  teamSize: 3 | 4 | 5;
}

/**
 * Награда за повышение уровня мастерства
 */
export interface LevelUpReward {
  type: 'coins' | 'crystals';
  amount: number;
}

/**
 * Результат повышения уровня мастерства
 */
export interface LevelUpResult {
  /** Старый уровень мастерства */
  oldLevel: number;
  /** Новый уровень мастерства */
  newLevel: number;
  /** Был ли открыт новый слот (4-й или 5-й) */
  newSlotUnlocked: boolean;
  /** Индекс открытого слота (0–4) или null, если слот не открывался */
  unlockedSlotIndex: number | null;
  /** Награды за все уровни, полученные в этом апдейте XP */
  rewards: LevelUpReward[];
}

// ========== КОНСТАНТА УРОВНЕЙ МАСТЕРСТВА ==========

/**
 * Таблица уровней мастерства фракции.
 * 
 * - Уровень 1: начальный (0 XP), команда из 3 юнитов
 * - Уровень 3: открывается 4-й слот команды
 * - Уровень 6: открывается 5-й слот команды
 * - Уровень 10: максимальный уровень
 */
export const MASTERY_LEVELS: ReadonlyArray<MasteryLevelDefinition> = [
  { level: 1,  xpRequired: 0,    teamSize: 3 },
  { level: 2,  xpRequired: 100,  teamSize: 3 },
  { level: 3,  xpRequired: 250,  teamSize: 4 }, // 🔓 4-й слот
  { level: 4,  xpRequired: 450,  teamSize: 4 },
  { level: 5,  xpRequired: 700,  teamSize: 4 },
  { level: 6,  xpRequired: 1000, teamSize: 5 }, // 🔓 5-й слот
  { level: 7,  xpRequired: 1400, teamSize: 5 },
  { level: 8,  xpRequired: 1900, teamSize: 5 },
  { level: 9,  xpRequired: 2500, teamSize: 5 },
  { level: 10, xpRequired: 3200, teamSize: 5 }, // 🏆 Максимальный уровень
];

// ========== КОНСТАНТЫ ДЛЯ РАСЧЁТА XP ==========

/** Базовый XP за участие в матче */
const BASE_XP = 20;

/** XP за победу */
const WIN_XP = 30;

/** XP за ничью */
const DRAW_XP = 15;

/** XP за поражение (просто за участие) */
const LOSS_XP = 5;

/** XP за каждый забитый гол */
const GOAL_XP = 4;

/** Максимальное количество голов, учитываемых для бонуса */
const GOAL_CAP = 5;

/** XP за "сухой" матч (без пропущенных голов) */
const CLEAN_SHEET_XP = 10;

// ========== КЛАСС МЕНЕДЖЕРА ==========

/**
 * Статический утилитарный класс для работы с системой Faction Mastery.
 * 
 * Не имеет зависимостей от состояния игрока (PlayerData).
 * Только чистая логика расчётов по XP.
 */
export class FactionMasteryManager {
  
  /**
   * Рассчитывает XP мастерства за матч
   * 
   * @param perf - результат матча
   * @returns разбивка XP по категориям
   */
  static calculateMatchXP(perf: MatchPerformance): XPBreakdown {
    // Базовый XP за участие
    const base = BASE_XP;
    
    // Бонус за исход матча
    let winBonus = 0;
    
    if (perf.isWin) {
      winBonus = WIN_XP;
    } else {
      // Проверяем ничью
      const isDraw = perf.goalsScored === perf.goalsConceded;
      if (isDraw) {
        winBonus = DRAW_XP;
      } else {
        winBonus = LOSS_XP;
      }
    }
    
    // Бонус за голы (с ограничением)
    const effectiveGoals = Math.min(perf.goalsScored, GOAL_CAP);
    const goalBonus = effectiveGoals * GOAL_XP;
    
    // Бонус за "сухой" матч
    const cleanSheetBonus = perf.isCleanSheet ? CLEAN_SHEET_XP : 0;
    
    // Суммарный XP
    const total = base + winBonus + goalBonus + cleanSheetBonus;
    
    return {
      total,
      base,
      winBonus,
      goalBonus,
      cleanSheetBonus,
    };
  }
  
  /**
   * Определяет уровень мастерства по текущему XP
   * 
   * @param xp - текущий XP игрока для фракции
   * @returns определение уровня (MasteryLevelDefinition)
   */
  static getLevelByXP(xp: number): MasteryLevelDefinition {
    const clampedXP = Math.max(0, xp);
    let current = MASTERY_LEVELS[0];
    
    for (const lvl of MASTERY_LEVELS) {
      if (clampedXP >= lvl.xpRequired) {
        current = lvl;
      } else {
        break;
      }
    }
    
    return current;
  }
  
  /**
   * Возвращает размер команды по XP
   * 
   * @param xp - текущий XP игрока для фракции
   * @returns размер команды (3, 4 или 5)
   */
  static getTeamSize(xp: number): 3 | 4 | 5 {
    const levelDef = this.getLevelByXP(xp);
    return levelDef.teamSize;
  }
  
  /**
   * Возвращает XP, необходимый для следующего уровня
   * 
   * @param xp - текущий XP игрока для фракции
   * @returns XP для следующего уровня или null, если максимальный уровень
   */
  static getNextLevelXP(xp: number): number | null {
    const curr = this.getLevelByXP(xp);
    const idx = MASTERY_LEVELS.findIndex(l => l.level === curr.level);
    
    if (idx === -1 || idx === MASTERY_LEVELS.length - 1) {
      return null;
    }
    
    return MASTERY_LEVELS[idx + 1].xpRequired;
  }
  
  /**
   * Возвращает прогресс до следующего уровня (0..1)
   * 
   * @param xp - текущий XP игрока для фракции
   * @returns прогресс от 0 до 1 (1 = максимальный уровень достигнут)
   */
  static getLevelProgress(xp: number): number {
    const curr = this.getLevelByXP(xp);
    const currIdx = MASTERY_LEVELS.findIndex(l => l.level === curr.level);
    
    // Если максимальный уровень — прогресс = 1
    if (currIdx === -1 || currIdx === MASTERY_LEVELS.length - 1) {
      return 1;
    }
    
    const next = MASTERY_LEVELS[currIdx + 1];
    const currXP = curr.xpRequired;
    const nextXP = next.xpRequired;
    
    const clampedXP = Math.max(currXP, Math.min(xp, nextXP));
    const progress = (clampedXP - currXP) / (nextXP - currXP);
    
    return progress;
  }
  
  /**
   * Возвращает информацию о ранге мастерства
   * 
   * @param xp - текущий XP игрока для фракции
   * @returns объект с названием ранга, иконкой и уровнем
   */
  static getRankInfo(xp: number): { name: string; icon: string; level: number } {
    const lvlDef = this.getLevelByXP(xp);
    const lvl = lvlDef.level;
    
    if (lvl >= 10) return { name: 'Master',  icon: '👑', level: lvl };
    if (lvl >= 7)  return { name: 'Elite',   icon: '🏅', level: lvl };
    if (lvl >= 4)  return { name: 'Adept',   icon: '🥈', level: lvl };
    if (lvl >= 2)  return { name: 'Rookie',  icon: '🥉', level: lvl };
    
    return { name: 'Novice', icon: '⚪', level: lvl };
  }
  
  /**
   * Проверяет, произошло ли повышение уровня между двумя значениями XP
   * 
   * Поддерживает XP-прыжки через несколько уровней: если oldXP и newXP пересекают
   * несколько порогов (например, переход с уровня 1 на уровень 6), корректно определяет
   * изменение размера команды (3→5) и возвращает правильный результат.
   * 
   * @param oldXP - XP до начисления
   * @param newXP - XP после начисления
   * @returns результат повышения уровня или null, если уровень не изменился
   */
  static checkLevelUp(oldXP: number, newXP: number): LevelUpResult | null {
    const old = Math.max(0, oldXP);
    const now = Math.max(0, newXP);
    
    const oldDef = this.getLevelByXP(old);
    const newDef = this.getLevelByXP(now);
    
    // Если уровень не вырос — возвращаем null
    if (newDef.level <= oldDef.level) {
      return null;
    }
    
    // Определяем изменение размера команды
    // getTeamSize — чистая функция от XP, поэтому правильно обрабатывает прыжки через несколько порогов
    const oldTeamSize = oldDef.teamSize;
    const newTeamSize = newDef.teamSize;
    
    let newSlotUnlocked = false;
    let unlockedSlotIndex: number | null = null;
    
    if (newTeamSize > oldTeamSize) {
      newSlotUnlocked = true;
      // unlockedSlotIndex — индекс самого высокого открытого слота
      // 3→4 означает открытие слота с индексом 3, 3→5 — слота с индексом 4
      unlockedSlotIndex = newTeamSize - 1;
      
      // Логирование для отладки многослотовых разблокировок
      if (newTeamSize - oldTeamSize > 1) {
        console.log(
          `[FactionMasteryManager] 🎯 Multi-slot unlock: team size ${oldTeamSize} → ${newTeamSize} ` +
          `(unlocked slots ${oldTeamSize}-${unlockedSlotIndex})`
        );
      }
    }
    
    // Собираем награды за все пройденные уровни
    const rewards: LevelUpReward[] = [];
    
    for (let lvl = oldDef.level + 1; lvl <= newDef.level; lvl++) {
      // Монеты за каждый уровень
      rewards.push({ type: 'coins', amount: 100 });
      
      // Кристаллы каждые 3 уровня (3, 6, 9)
      if (lvl % 3 === 0) {
        rewards.push({ type: 'crystals', amount: 1 });
      }
    }
    
    return {
      oldLevel: oldDef.level,
      newLevel: newDef.level,
      newSlotUnlocked,
      unlockedSlotIndex,
      rewards,
    };
  }

  /**
   * Возвращает уровень мастерства, необходимый для разблокировки слота команды
   * 
   * @param slotIndex - индекс слота (0-4)
   * @returns уровень мастерства, необходимый для разблокировки, или 1 если слот всегда доступен
   */
  static getSlotUnlockLevel(slotIndex: number): number {
    // Слоты 0, 1, 2 всегда доступны (уровень 1)
    if (slotIndex < 3) {
      return 1;
    }
    
    // Слот 3 (4-й слот) открывается на уровне 3
    if (slotIndex === 3) {
      return 3;
    }
    
    // Слот 4 (5-й слот) открывается на уровне 6
    if (slotIndex === 4) {
      return 6;
    }
    
    // Для недопустимых индексов возвращаем максимальный уровень
    return 10;
  }
}