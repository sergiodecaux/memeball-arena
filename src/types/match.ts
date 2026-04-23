// src/types/match.ts
// 🆕 Централизованные типы для состояния матча

import { PlayerNumber, AIDifficulty } from './index';
import { FactionId, FactionArena } from '../constants/gameConstants';

// ========== ФАЗЫ ИГРЫ ==========

/**
 * Фазы хода в матче
 */
export type TurnPhase = 
  | 'waiting'     // Ожидание действия игрока
  | 'aiming'      // Игрок прицеливается
  | 'moving'      // Объекты в движении
  | 'goal'        // Празднование гола
  | 'paused'      // Пауза
  | 'finished';   // Матч окончен

/**
 * Режимы игры
 */
export type GameMode = 
  | 'single_player'   // Против AI
  | 'local_pvp'       // Локальный мультиплеер (будущее)
  | 'online_pvp'      // Онлайн PvP
  | 'campaign'        // Режим кампании
  | 'tutorial';       // Обучение

// ========== КОНФИГУРАЦИЯ МАТЧА ==========

/**
 * Полная конфигурация для запуска матча
 * Используется при переходе в GameScene
 */
export interface MatchConfig {
  // === Режим ===
  mode: GameMode;
  
  // === AI настройки ===
  aiDifficulty?: AIDifficulty;
  
  // === Фракции ===
  useFactions: boolean;
  playerFaction?: FactionId;
  opponentFaction?: FactionId;
  useArena?: boolean;
  
  // === Время ===
  matchDuration: number;  // секунды
  
  // === PvP (если mode === 'online_pvp') ===
  pvpRoomId?: string;
  isHost?: boolean;
  
  // === Кампания (если mode === 'campaign') ===
  campaignLevelId?: string;
  
  // === Скины ===
  ballSkinId?: string;
  fieldSkinId?: string;
}

// ========== СОСТОЯНИЕ ХОДА ==========

/**
 * Информация о текущем ходе
 */
export interface TurnState {
  /** Чей ход (1 или 2) */
  currentPlayer: PlayerNumber;
  
  /** Текущая фаза */
  phase: TurnPhase;
  
  /** Номер хода с начала матча */
  turnNumber: number;
  
  /** ID выбранного юнита (если есть) */
  selectedUnitId?: string;
  
  /** ID юнита, который последним стрелял */
  lastShootingUnitId?: string;
  
  /** Время начала хода (для таймера хода в PvP) */
  turnStartTime?: number;
}

// ========== СОСТОЯНИЕ СЧЁТА ==========

/**
 * Счёт матча
 */
export interface ScoreState {
  player1: number;
  player2: number;
}

// ========== СОСТОЯНИЕ ТАЙМЕРА ==========

/**
 * Состояние таймера матча
 */
export interface TimerState {
  /** Оставшееся время в секундах */
  remaining: number;
  
  /** Общая длительность матча */
  total: number;
  
  /** Таймер на паузе? */
  isPaused: boolean;
  
  /** Время последнего обновления */
  lastUpdateTime: number;
}

// ========== АГРЕГИРОВАННОЕ СОСТОЯНИЕ МАТЧА ==========

/**
 * Полное состояние матча (для State Machine)
 * Это "чистое" состояние без ссылок на Phaser объекты
 */
export interface MatchState {
  // === Конфигурация ===
  config: MatchConfig;
  
  // === Ход ===
  turn: TurnState;
  
  // === Счёт ===
  score: ScoreState;
  
  // === Таймер ===
  timer: TimerState;
  
  // === Флаги ===
  isGoalCelebrating: boolean;
  isProcessingTurn: boolean;
  isMatchStarted: boolean;
  isMatchFinished: boolean;
  
  // === Мета ===
  matchStartTime: number;
  
  // === Арена (если используются фракции) ===
  arena?: FactionArena;
}

// ========== ФАБРИКА НАЧАЛЬНОГО СОСТОЯНИЯ ==========

/**
 * Создаёт начальное состояние матча
 */
export function createInitialMatchState(config: MatchConfig): MatchState {
  return {
    config,
    turn: {
      currentPlayer: 1,
      phase: 'waiting',
      turnNumber: 0,
      selectedUnitId: undefined,
      lastShootingUnitId: undefined,
    },
    score: {
      player1: 0,
      player2: 0,
    },
    timer: {
      remaining: config.matchDuration,
      total: config.matchDuration,
      isPaused: true,
      lastUpdateTime: Date.now(),
    },
    isGoalCelebrating: false,
    isProcessingTurn: false,
    isMatchStarted: false,
    isMatchFinished: false,
    matchStartTime: 0,
    arena: undefined,
  };
}