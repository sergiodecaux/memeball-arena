// src/types/pvp.ts
// Типы для PvP системы

import { LeagueTier } from './league';

/**
 * Режимы PvP
 */
export type PvPMode = 'casual' | 'ranked';

/**
 * MMR (Matchmaking Rating) - рейтинг для подбора оппонентов
 */
export interface MMRData {
  rating: number;           // Текущий рейтинг (1000 = начальный)
  peak: number;             // Максимальный рейтинг
  matches: number;          // Всего матчей сыграно
  wins: number;             // Побед
  losses: number;           // Поражений
  draws: number;            // Ничьих
  winStreak: number;        // Текущая серия побед
  bestWinStreak: number;    // Лучшая серия побед
}

/**
 * Статистика PvP игрока
 */
export interface PvPStats {
  // Рейтинги для разных режимов
  casual: MMRData;
  ranked: MMRData;
  
  // Общая статистика
  totalGoalsScored: number;
  totalGoalsConceded: number;
  totalPlaytime: number;    // В секундах
  
  // Достижения
  perfectGames: number;      // Игры без пропущенных голов
  comebacks: number;         // Победы после проигрыша по счету
  lastMatchDate: number;     // Timestamp последнего матча
}

/**
 * Результат PvP матча
 */
export interface PvPMatchResult {
  mode: PvPMode;
  isWin: boolean;
  isDraw: boolean;
  goalsScored: number;
  goalsConceded: number;
  opponentName: string;
  opponentRating: number;
  ratingChange: number;      // Изменение MMR
  duration: number;          // Длительность матча в секундах
  timestamp: number;
}

/**
 * Награды за PvP матч
 */
export interface PvPRewards {
  coins: number;
  xp: number;
  leagueStars?: number;      // Для ranked режима
  tournamentProgress?: boolean; // Для турнирных матчей
}

/**
 * Создает дефолтные MMR данные
 */
export function createDefaultMMRData(): MMRData {
  return {
    rating: 1000,
    peak: 1000,
    matches: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winStreak: 0,
    bestWinStreak: 0,
  };
}

/**
 * Создает дефолтную PvP статистику
 */
export function createDefaultPvPStats(): PvPStats {
  return {
    casual: createDefaultMMRData(),
    ranked: createDefaultMMRData(),
    totalGoalsScored: 0,
    totalGoalsConceded: 0,
    totalPlaytime: 0,
    perfectGames: 0,
    comebacks: 0,
    lastMatchDate: 0,
  };
}

/**
 * Расчет изменения MMR на основе ELO системы
 * @param playerRating - рейтинг игрока
 * @param opponentRating - рейтинг оппонента
 * @param isWin - победа ли
 * @param isDraw - ничья ли
 * @returns изменение рейтинга
 */
export function calculateMMRChange(
  playerRating: number,
  opponentRating: number,
  isWin: boolean,
  isDraw: boolean
): number {
  const K = 32; // K-фактор (чувствительность изменений)
  
  // Ожидаемый результат (0 - поражение, 0.5 - ничья, 1 - победа)
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  
  // Фактический результат
  let actualScore = 0;
  if (isWin) actualScore = 1;
  else if (isDraw) actualScore = 0.5;
  
  // Изменение рейтинга
  const change = Math.round(K * (actualScore - expectedScore));
  
  return change;
}

/**
 * Получить диапазон поиска оппонентов на основе времени ожидания
 * @param waitTime - время ожидания в секундах
 * @param playerRating - рейтинг игрока
 * @returns [minRating, maxRating]
 */
export function getMatchmakingRange(waitTime: number, playerRating: number): [number, number] {
  // Начальный диапазон ±100
  let range = 100;
  
  // Расширяем диапазон каждые 10 секунд
  if (waitTime > 10) range = 150;
  if (waitTime > 20) range = 200;
  if (waitTime > 30) range = 300;
  if (waitTime > 60) range = 500;
  
  return [
    Math.max(0, playerRating - range),
    playerRating + range
  ];
}

/**
 * Получить лигу на основе MMR
 * Используется для отображения "неофициальной" лиги в casual режиме
 */
export function getLeagueTierFromMMR(rating: number): LeagueTier {
  if (rating < 1200) return LeagueTier.METEORITE;
  if (rating < 1400) return LeagueTier.COMET;
  if (rating < 1600) return LeagueTier.PLANET;
  if (rating < 1800) return LeagueTier.STAR;
  if (rating < 2000) return LeagueTier.NEBULA;
  return LeagueTier.CORE;
}

// ============================================================
// 🌐 REALTIME PVP MATCH TYPES
// ============================================================

/**
 * Состояние PVP подключения
 */
export type PvPConnectionState = 
  | 'disconnected' 
  | 'connecting' 
  | 'connected' 
  | 'searching' 
  | 'found' 
  | 'ready' 
  | 'playing' 
  | 'finished';

/**
 * Состояние игры от сервера
 */
export interface ServerGameState {
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    angularVelocity: number;
  } | null;
  units: {
    [unitId: string]: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      angle: number;
    };
  };
}

/**
 * Информация о матче
 */
export interface PvPMatchInfo {
  roomId: string;
  yourTeam: number; // 1 or 2
  opponentId: string;
  opponentName?: string;
  opponentRating?: number;
  mode: PvPMode;
  timeLimit: number; // seconds
}

/**
 * Текущее состояние матча
 */
export interface PvPMatchState {
  roomId: string;
  currentTeam: number;
  turnNumber: number;
  scores: { 1: number; 2: number };
  timeRemaining: number;
  isPaused: boolean;
  isOpponentDisconnected: boolean;
}

/**
 * Данные об обновлении состояния от сервера
 */
export interface PvPStateUpdate {
  state: ServerGameState;
  frame: number;
  timestamp: number;
}

/**
 * События PVP
 */
export interface PvPEvents {
  // Connection
  'PVP_CONNECTED': void;
  'PVP_DISCONNECTED': { reason: string };
  'PVP_ERROR': { type: string; message: string };
  
  // Matchmaking
  'PVP_MATCH_FOUND': {
    roomId: string;
    opponentId: string;
    yourTeam: number;
  };
  
  // Match
  'PVP_MATCH_START': {
    initialState: ServerGameState;
    yourTeam: number;
    timeLimit: number;
    currentTeam: number;
  };
  
  'PVP_MATCH_END': {
    winner: number;
    scores: { 1: number; 2: number };
    reason: string;
  };
  
  // Game
  'PVP_STATE_UPDATE': PvPStateUpdate;
  
  'PVP_TURN_CHANGE': {
    currentTeam: number;
    turnNumber: number;
  };
  
  'PVP_GOAL': {
    scoringTeam: number;
    scores: { 1: number; 2: number };
  };
  
  'PVP_GAME_PAUSED': void;
  
  // Opponent
  'PVP_OPPONENT_DISCONNECTED': {
    reconnectTimeout: number;
  };
  
  'PVP_OPPONENT_RECONNECTED': void;
}

/**
 * Конфигурация PVP режима
 */
export interface PvPConfig {
  serverUrl: string;
  autoReconnect: boolean;
  reconnectionDelay: number;
  reconnectionAttempts: number;
  stateUpdateInterval: number; // frames
  interpolationFactor: number;
}

/**
 * Дефолтная конфигурация PVP
 */
export const DEFAULT_PVP_CONFIG: PvPConfig = {
  serverUrl: 'wss://game.galaxyleague.ru', // Без порта - Nginx слушает на 443
  autoReconnect: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  stateUpdateInterval: 3,
  interpolationFactor: 0.25,
};