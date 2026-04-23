// src/tutorial/TutorialSteps.ts

import { FactionId } from '../types';

/**
 * Шаги обучения — строго последовательные
 */
export enum TutorialStep {
  // === ВВЕДЕНИЕ ===
  INTRO = 'intro',
  
  // === ТАНК: Защита ворот ===
  TANK_INTRO = 'tank_intro',           // Диалог: объяснение танка
  TANK_SITUATION = 'tank_situation',   // Диалог: объяснение ситуации
  TANK_SELECT = 'tank_select',         // Ждём выбор танка
  TANK_AIM = 'tank_aim',               // Ждём удар (к своим воротам)
  TANK_AI_SHOT = 'tank_ai_shot',       // ИИ бьёт, танк блокирует
  TANK_RESULT = 'tank_result',         // Диалог: успех!
  
  // === СНАЙПЕР: Забить гол ===
  SNIPER_INTRO = 'sniper_intro',
  SNIPER_SITUATION = 'sniper_situation',
  SNIPER_SELECT = 'sniper_select',
  SNIPER_AIM = 'sniper_aim',           // Ждём удар (к воротам врага)
  SNIPER_RESULT = 'sniper_result',
  
  // === BALANCED: Универсальность ===
  BALANCED_INTRO = 'balanced_intro',
  BALANCED_SITUATION = 'balanced_situation',
  BALANCED_SELECT = 'balanced_select',
  BALANCED_AIM = 'balanced_aim',
  BALANCED_RESULT = 'balanced_result',
  
  // === ЗАВЕРШЕНИЕ ===
  OUTRO = 'outro',
  FREE_PRACTICE = 'free_practice',
  COMPLETED = 'completed'
}

/**
 * Порядок шагов
 */
export const TUTORIAL_STEP_ORDER: TutorialStep[] = [
  TutorialStep.INTRO,
  
  TutorialStep.TANK_INTRO,
  TutorialStep.TANK_SITUATION,
  TutorialStep.TANK_SELECT,
  TutorialStep.TANK_AIM,
  TutorialStep.TANK_AI_SHOT,
  TutorialStep.TANK_RESULT,
  
  TutorialStep.SNIPER_INTRO,
  TutorialStep.SNIPER_SITUATION,
  TutorialStep.SNIPER_SELECT,
  TutorialStep.SNIPER_AIM,
  TutorialStep.SNIPER_RESULT,
  
  TutorialStep.BALANCED_INTRO,
  TutorialStep.BALANCED_SITUATION,
  TutorialStep.BALANCED_SELECT,
  TutorialStep.BALANCED_AIM,
  TutorialStep.BALANCED_RESULT,
  
  TutorialStep.OUTRO,
  TutorialStep.FREE_PRACTICE,
  TutorialStep.COMPLETED
];

/**
 * Получить следующий шаг
 */
export function getNextStep(current: TutorialStep): TutorialStep {
  const index = TUTORIAL_STEP_ORDER.indexOf(current);
  if (index === -1 || index >= TUTORIAL_STEP_ORDER.length - 1) {
    return TutorialStep.COMPLETED;
  }
  return TUTORIAL_STEP_ORDER[index + 1];
}

/**
 * Позиция юнита (относительные координаты 0-1)
 */
export interface TutorialPosition {
  x: number;  // 0 = левый край, 1 = правый край
  y: number;  // 0 = верх, 1 = низ
}

/**
 * Конфигурация юнита для обучения
 */
export interface TutorialUnitConfig {
  class: 'tank' | 'sniper' | 'balanced';
  position: TutorialPosition;
}

/**
 * Конфигурация ситуации
 */
export interface TutorialSituationConfig {
  // Юниты
  playerUnits: TutorialUnitConfig[];
  aiUnits: TutorialUnitConfig[];
  
  // Мяч
  ballPosition: TutorialPosition;
  
  // Целевой юнит игрока (какой нужно выбрать)
  targetPlayerUnitClass: 'tank' | 'sniper' | 'balanced';
  
  // Целевая зона для удара (относительные координаты)
  targetZone: TutorialPosition;
  targetZoneRadius: number;  // в пикселях
  
  // Скриптованный удар ИИ (опционально)
  aiShot?: {
    unitIndex: number;       // какой юнит ИИ бьёт
    targetPosition: TutorialPosition;  // куда бьёт
    force: number;           // сила удара (0-1)
    delay: number;           // задержка перед ударом (ms)
  };
}

/**
 * Конфигурации ситуаций для каждого класса
 */
export const TUTORIAL_SITUATIONS: Record<string, TutorialSituationConfig> = {
  
  // ═══════════════════════════════════════════════════════════════
  // ТАНК: Защита ворот
  // Ситуация: мяч у ИИ, ИИ ударит в ворота игрока, нужно заблокировать
  // ═══════════════════════════════════════════════════════════════
  tank: {
    playerUnits: [
      { class: 'tank', position: { x: 0.25, y: 0.5 } },     // Танк слева от центра
    ],
    aiUnits: [
      { class: 'sniper', position: { x: 0.7, y: 0.5 } },    // ИИ снайпер справа
    ],
    ballPosition: { x: 0.65, y: 0.5 },  // Мяч рядом с ИИ
    
    targetPlayerUnitClass: 'tank',
    
    // Целевая зона: перед своими воротами
    targetZone: { x: 0.12, y: 0.5 },
    targetZoneRadius: 60,
    
    // ИИ ударит после того как игрок поставит танка
    aiShot: {
      unitIndex: 0,
      targetPosition: { x: 0.05, y: 0.5 },  // В ворота игрока
      force: 0.6,
      delay: 1000
    }
  },
  
  // ═══════════════════════════════════════════════════════════════
  // СНАЙПЕР: Забить гол
  // Ситуация: чистая линия к воротам, лёгкий гол
  // ═══════════════════════════════════════════════════════════════
  sniper: {
    playerUnits: [
      { class: 'sniper', position: { x: 0.5, y: 0.5 } },    // Снайпер в центре
    ],
    aiUnits: [
      { class: 'tank', position: { x: 0.85, y: 0.3 } },     // ИИ танк сверху (не мешает)
    ],
    ballPosition: { x: 0.45, y: 0.5 },  // Мяч рядом со снайпером
    
    targetPlayerUnitClass: 'sniper',
    
    // Целевая зона: ворота противника
    targetZone: { x: 0.95, y: 0.5 },
    targetZoneRadius: 80,
    
    // Нет скриптованного удара ИИ — просто забиваем гол
    aiShot: undefined
  },
  
  // ═══════════════════════════════════════════════════════════════
  // BALANCED: Универсальность
  // Ситуация: мяч в центре, можно атаковать ИЛИ защищаться
  // Показываем что balanced хорош везде
  // ═══════════════════════════════════════════════════════════════
  balanced: {
    playerUnits: [
      { class: 'balanced', position: { x: 0.35, y: 0.5 } }, // Balanced слева от центра
    ],
    aiUnits: [
      { class: 'balanced', position: { x: 0.75, y: 0.4 } }, // ИИ balanced справа сверху
    ],
    ballPosition: { x: 0.5, y: 0.5 },  // Мяч точно в центре
    
    targetPlayerUnitClass: 'balanced',
    
    // Целевая зона: можно бить куда угодно (большая зона)
    // Но показываем зону к воротам противника
    targetZone: { x: 0.9, y: 0.5 },
    targetZoneRadius: 100,
    
    aiShot: undefined
  }
};

/**
 * Диалоги Командора Новы
 */
export const TUTORIAL_DIALOGUES: Record<string, string> = {
  // === ВВЕДЕНИЕ ===
  'intro_1': 'Добро пожаловать в Galaxy League, рекрут! Я Командор Нова.',
  'intro_2': 'Твоя цель проста: забей мяч в ворота противника!',
  'intro_3': 'Но сначала я покажу тебе три типа бойцов. Каждый уникален!',
  
  // === ТАНК ===
  'tank_intro_1': 'Начнём с ТАНКА — самого прочного бойца в твоей команде!',
  'tank_intro_2': 'Танки медленные, но мощные. Их главная сила — защита.',
  
  'tank_situation_1': 'Видишь? Противник готовится ударить в твои ворота!',
  'tank_situation_2': 'Быстро! Выбери танка и поставь его перед воротами!',
  
  'tank_select': 'Нажми на ТАНКА, чтобы выбрать его!',
  
  'tank_aim': 'Отлично! Теперь потяни НАЗАД и ударь танка К СВОИМ ВОРОТАМ — он должен встать на защиту!',
  
  'tank_result_1': 'Превосходно! Танк заблокировал удар!',
  'tank_result_2': 'Запомни: танки — твоя последняя линия обороны!',
  
  // === СНАЙПЕР ===
  'sniper_intro_1': 'Теперь познакомься со СНАЙПЕРОМ!',
  'sniper_intro_2': 'Снайперы — твоё главное оружие для забивания голов. Они бьют далеко и точно!',
  
  'sniper_situation_1': 'Смотри: путь к воротам свободен!',
  'sniper_situation_2': 'Самое время для точного удара!',
  
  'sniper_select': 'Выбери СНАЙПЕРА!',
  
  'sniper_aim': 'Прицелься в ворота противника и ударь!',
  
  'sniper_result_1': 'ГОООЛ! Отличный удар!',
  'sniper_result_2': 'Снайперы смертоносны на дистанции. Держи их подальше от врагов!',
  
  // === BALANCED ===
  'balanced_intro_1': 'И наконец — УНИВЕРСАЛ!',
  'balanced_intro_2': 'Универсалы хороши во всём: и в атаке, и в защите.',
  
  'balanced_situation_1': 'Мяч в центре поля. Что делать?',
  'balanced_situation_2': 'С универсалом ты можешь всё! Попробуй атаковать!',
  
  'balanced_select': 'Выбери УНИВЕРСАЛА!',
  
  'balanced_aim': 'Ударь в сторону ворот противника!',
  
  'balanced_result_1': 'Отлично! Универсалы — основа любой команды!',
  'balanced_result_2': 'Комбинируй их с танками и снайперами для максимальной эффективности.',
  
  // === ЗАВЕРШЕНИЕ ===
  'outro_1': 'Ты освоил все три типа бойцов!',
  'outro_2': 'Теперь у тебя есть 2 минуты на свободную практику.',
  'outro_3': 'Экспериментируй, пробуй разные тактики!',
  
  'practice_start': 'Время практики! Попробуй забить гол.',
  
  'complete_1': 'Поздравляю, рекрут!',
  'complete_2': 'Ты готов к настоящим сражениям в Galaxy League!',
  
  // === Подсказки ===
  'hint_drag': 'Потяни НАЗАД и отпусти, чтобы ударить!',
  'hint_wrong_unit': 'Выбери указанного бойца!',
  'hint_wrong_direction': 'Целься в подсвеченную зону!',
};

/**
 * Получить диалоги для шага
 */
export function getDialoguesForStep(step: TutorialStep): string[] {
  switch (step) {
    case TutorialStep.INTRO:
      return ['intro_1', 'intro_2', 'intro_3'];
      
    case TutorialStep.TANK_INTRO:
      return ['tank_intro_1', 'tank_intro_2'];
    case TutorialStep.TANK_SITUATION:
      return ['tank_situation_1', 'tank_situation_2'];
    case TutorialStep.TANK_RESULT:
      return ['tank_result_1', 'tank_result_2'];
      
    case TutorialStep.SNIPER_INTRO:
      return ['sniper_intro_1', 'sniper_intro_2'];
    case TutorialStep.SNIPER_SITUATION:
      return ['sniper_situation_1', 'sniper_situation_2'];
    case TutorialStep.SNIPER_RESULT:
      return ['sniper_result_1', 'sniper_result_2'];
      
    case TutorialStep.BALANCED_INTRO:
      return ['balanced_intro_1', 'balanced_intro_2'];
    case TutorialStep.BALANCED_SITUATION:
      return ['balanced_situation_1', 'balanced_situation_2'];
    case TutorialStep.BALANCED_RESULT:
      return ['balanced_result_1', 'balanced_result_2'];
      
    case TutorialStep.OUTRO:
      return ['outro_1', 'outro_2', 'outro_3'];
      
    default:
      return [];
  }
}

/**
 * Получить текст подсказки для шага
 */
export function getHintForStep(step: TutorialStep): string {
  switch (step) {
    case TutorialStep.TANK_SELECT:
      return TUTORIAL_DIALOGUES['tank_select'];
    case TutorialStep.TANK_AIM:
      return TUTORIAL_DIALOGUES['tank_aim'];
      
    case TutorialStep.SNIPER_SELECT:
      return TUTORIAL_DIALOGUES['sniper_select'];
    case TutorialStep.SNIPER_AIM:
      return TUTORIAL_DIALOGUES['sniper_aim'];
      
    case TutorialStep.BALANCED_SELECT:
      return TUTORIAL_DIALOGUES['balanced_select'];
    case TutorialStep.BALANCED_AIM:
      return TUTORIAL_DIALOGUES['balanced_aim'];
      
    default:
      return '';
  }
}
