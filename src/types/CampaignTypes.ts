// src/types/CampaignTypes.ts
// Типы данных для системы кампании

import { FactionId } from '../constants/gameConstants';
import { AIDifficulty } from '../types';

// ========== УСЛОВИЯ ПОБЕДЫ ==========

export type WinConditionType = 
  | 'score_limit'      // Классика: первый до N голов
  | 'time_survival'    // Выжить X секунд, не проиграв
  | 'sudden_death'     // Золотой гол
  | 'puzzle'           // Забить за 1 удар
  | 'no_goals_against' // Не пропустить ни одного гола
  | 'score_difference'; // Выиграть с разницей N голов

export interface WinCondition {
  type: WinConditionType;
  /** Для score_limit: количество голов для победы */
  scoreLimit?: number;
  /** Для time_survival: время в секундах */
  timeLimit?: number;
  /** Для score_difference: минимальная разница */
  scoreDifference?: number;
  /** Для puzzle: максимум попыток */
  maxAttempts?: number;
}

// ========== МОДИФИКАТОРЫ ПОЛЯ ==========

export type FieldModifierType = 
  | 'none'
  | 'lava_floor'      // Глобальное замедление
  | 'ice_floor'       // Скользкий пол (низкое трение)
  | 'sticky_walls'    // Стены поглощают удар
  | 'small_goals'     // Уменьшенные ворота
  | 'large_goals'     // Увеличенные ворота
  | 'heavy_ball'      // Тяжёлый мяч
  | 'light_ball';     // Лёгкий мяч

export interface FieldModifier {
  type: FieldModifierType;
  /** Множитель эффекта (например, friction для lava_floor) */
  intensity?: number;
}

// ========== НАГРАДЫ ==========

export interface LevelReward {
  /** Монеты за первое прохождение */
  firstClearCoins: number;
  /** XP за первое прохождение */
  firstClearXP: number;
  /** Монеты за повторное прохождение */
  replayCoins: number;
  /** XP за повторное прохождение */
  replayXP: number;
  /** Бонусные монеты за 3 звезды */
  perfectBonus?: number;
  /** ID юнита, который разблокируется (опционально) */
  unlockUnitId?: string;
  /** ID скина, который разблокируется (опционально) */
  unlockSkinId?: string;
}

// ========== КРИТЕРИИ ЗВЁЗД ==========

export interface StarCriteria {
  /** 1 звезда: просто победить */
  oneStar: string;
  /** 2 звезды: условие */
  twoStars: string;
  /** 3 звезды: сложное условие */
  threeStars: string;
  /** Числовые параметры для проверки */
  twoStarsValue?: number;
  threeStarsValue?: number;
}

// ========== КОНФИГ УРОВНЯ ==========

export interface LevelConfig {
  /** Уникальный ID уровня (например, '1-1', '2-3') */
  id: string;
  /** ID главы */
  chapterId: string;
  /** Порядковый номер в главе (1, 2, 3...) */
  orderInChapter: number;
  /** Название уровня */
  name: string;
  /** Краткое описание */
  description: string;
  
  // === Враг ===
  /** Фракция противника */
  enemyFaction: FactionId;
  /** Сложность ИИ */
  aiDifficulty: AIDifficulty;
  /** Кастомные ID юнитов врага (если не указано — стандартные) */
  enemyUnitIds?: string[];
  
  // === Условия ===
  /** Условие победы */
  winCondition: WinCondition;
  /** Модификаторы поля */
  fieldModifiers?: FieldModifier[];
  /** Длительность матча в секундах (если есть таймер) */
  matchDuration?: number;
  
  // === Арена ===
  /** Переопределение арены (если не указано — используется арена фракции врага) */
  arenaOverride?: string;
  
  // === Награды ===
  reward: LevelReward;
  /** Критерии для получения звёзд */
  starCriteria: StarCriteria;
  
  // === Диалоги ===
  /** ID диалога перед матчем */
  dialogueBeforeMatch?: string;
  /** ID диалога после победы */
  dialogueAfterWin?: string;
  /** ID диалога после поражения */
  dialogueAfterLose?: string;
  /** Диалоги во время матча (по триггерам) */
  inMatchDialogues?: InMatchDialogue[];
  
  // === Флаги ===
  /** Это босс-уровень? */
  isBoss?: boolean;
  /** Это обучающий уровень? */
  isTutorial?: boolean;
  /** Требуется ли предыдущий уровень для разблокировки */
  requiresPreviousLevel?: boolean;
  
  // === Тестирование / Разработка ===
  /** Переопределение размера команды для тестовых уровней (3, 4 или 5 единиц на сторону). 
   * Используется только в кампании/offline матчах, игнорирует ограничения Faction Mastery. */
  teamSizeOverride?: 3 | 4 | 5;

  // === Mission Preview ===
  /** Key of preloaded Phaser texture for mission preview artwork */
  previewImageKey?: string;

  /**
   * Short mission objective to be shown in the preview screen.
   * If not set, fallback to `description`.
   */
  shortObjective?: string;
}

// ========== ДИАЛОГИ ВО ВРЕМЯ МАТЧА ==========

export type DialogueTrigger = 
  | 'match_start'
  | 'first_player_goal'
  | 'first_enemy_goal'
  | 'player_leading'
  | 'enemy_leading'
  | 'match_point_player'
  | 'match_point_enemy'
  | 'time_warning_30s'
  | 'time_warning_10s';

export interface InMatchDialogue {
  trigger: DialogueTrigger;
  dialogueId: string;
  /** Показывать только один раз за матч */
  oncePerMatch?: boolean;
}

// ========== ПЕРСОНАЖИ ДИАЛОГОВ ==========

export type CharacterId = 
  | 'nova'        // Командор Нова (наставник)
  | 'krag'        // Краг (Magma босс)
  | 'unit_734'    // Юнит 734 (Cyborg босс)
  | 'zra'         // З'ра (Void босс)
  | 'oracle'      // Оракул (Insect босс)
  | 'announcer';  // Комментатор

export type CharacterEmotion = 
  | 'neutral'
  | 'happy'
  | 'angry'
  | 'surprised'
  | 'sad'
  | 'determined'
  | 'mysterious'
  | 'menacing';

export interface DialogueLine {
  /** ID персонажа */
  characterId: CharacterId;
  /** Текст реплики */
  text: string;
  /** Эмоция персонажа */
  emotion?: CharacterEmotion;
  /** Позиция аватара (слева/справа) */
  position?: 'left' | 'right';
  /** Задержка перед показом (мс) */
  delay?: number;
  /** Автоматически скрыть через N мс (0 = ждать клика) */
  autoHide?: number;
  /** Ставить игру на паузу? */
  pauseGame?: boolean;
}

export interface DialogueEntry {
  /** Уникальный ID диалога */
  id: string;
  /** Массив реплик */
  lines: DialogueLine[];
  /** Можно ли пропустить диалог */
  skippable?: boolean;
  /** Приоритет (выше = важнее) */
  priority?: number;
}

// ========== ГЛАВА ==========

export interface ChapterConfig {
  /** Уникальный ID главы (например, 'chapter_1') */
  id: string;
  /** Порядковый номер главы */
  order: number;
  /** Название главы */
  name: string;
  /** Описание главы */
  description: string;
  /** Фракция-антагонист главы */
  factionId: FactionId;
  /** Список ID уровней в главе */
  levelIds: string[];
  /** ID босс-уровня */
  bossLevelId?: string;
  /** Ключ фонового ассета для карты */
  backgroundAssetKey?: string;
  /** Цвет акцента главы */
  accentColor: number;
  /** Иконка главы */
  icon: string;
  /** Требования для разблокировки */
  unlockRequirement?: ChapterUnlockRequirement;
}

export interface ChapterUnlockRequirement {
  /** ID предыдущей главы, которую нужно пройти */
  previousChapterId?: string;
  /** Минимум звёзд в предыдущей главе */
  minStars?: number;
  /** Нужно ли пройти босса предыдущей главы */
  requireBossDefeat?: boolean;
}

// ========== ПРОГРЕСС ИГРОКА ==========

export interface LevelProgress {
  /** ID уровня */
  levelId: string;
  /** Пройден ли уровень */
  completed: boolean;
  /** Количество звёзд (0-3) */
  stars: number;
  /** Лучший счёт игрока */
  bestPlayerScore: number;
  /** Лучший счёт врага (меньше = лучше) */
  bestEnemyScore: number;
  /** Время первого прохождения */
  firstCompletedAt?: number;
  /** Количество попыток */
  attempts: number;
}

export interface ChapterProgress {
  /** ID главы */
  chapterId: string;
  /** Разблокирована ли глава */
  unlocked: boolean;
  /** Общее количество звёзд в главе */
  totalStars: number;
  /** Пройден ли босс */
  bossDefeated: boolean;
  /** Прогресс по уровням */
  levels: Record<string, LevelProgress>;
}

export interface CampaignProgress {
  /** Прогресс по главам */
  chapters: Record<string, ChapterProgress>;
  /** Общее количество звёзд */
  totalStars: number;
  /** Текущая активная глава */
  currentChapterId: string;
  /** Пройдено ли обучение */
  tutorialCompleted: boolean;
  /** Время последней игры в кампанию */
  lastPlayedAt?: number;
  /** Версия данных прогресса */
  version: number;
}

// ========== ДАННЫЕ ДЛЯ ЗАПУСКА УРОВНЯ ==========

export interface CampaignLevelLaunchData {
  isCampaign: true;
  levelConfig: LevelConfig;
  chapterConfig: ChapterConfig;
  isFirstAttempt: boolean;
  currentStars: number;
}

// ========== РЕЗУЛЬТАТ УРОВНЯ КАМПАНИИ ==========

export interface CampaignLevelResult {
  levelId: string;
  won: boolean;
  playerScore: number;
  enemyScore: number;
  starsEarned: number;
  isFirstClear: boolean;
  rewards: {
    coins: number;
    xp: number;
    unlockedUnitId?: string;
    unlockedSkinId?: string;
  };
  /** Разблокирован ли следующий уровень */
  unlockedNextLevel: boolean;
  /** Разблокирована ли следующая глава */
  unlockedNextChapter: boolean;
}