// src/types/tournament.ts
// Типы для системы Weekend Tournaments

import { LeagueTier } from './league';
import { FactionId } from '../constants/gameConstants';

export type TournamentTier = 'rookie' | 'minor' | 'major' | 'apex';

export type BracketStage = '16' | '8' | '4' | '2' | '1';

export interface TournamentHistoryEntry {
  tier: TournamentTier;
  wins: number;
  bestPlacement: BracketStage;
}

export interface TournamentState {
  keyFragments: number;        // 0..2 (фрагменты ключа, 3 = полный ключ)
  ticketCount?: number;        // Количество билетов (НОВОЕ ПОЛЕ)
  hasTicket: boolean;          // deprecated, для обратной совместимости
  activeTournamentId?: string;
  activeTier?: TournamentTier;
  history: TournamentHistoryEntry[];
}

/**
 * Создаёт дефолтный TournamentState
 */
export function createDefaultTournamentState(): TournamentState {
  return {
    keyFragments: 0,
    ticketCount: 0,
    hasTicket: false,
    history: [],
  };
}

/**
 * 🎮 Размер команды (количество фишек) для каждого турнира
 * Чем выше турнир, тем больше фишек в команде
 */
export const TOURNAMENT_TEAM_SIZE: Record<TournamentTier, number> = {
  rookie: 3, // Начальный турнир - 3 фишки
  minor: 4, // Средний турнир - 4 фишки
  major: 5, // Топ турнир - 5 фишек
  apex: 5, // Высший турнир - 5 фишек
};

/** Длительность матча (сек), по принципу фишки = минуты */
export const TOURNAMENT_MATCH_DURATION: Record<TournamentTier, number> = {
  rookie: 180,
  minor: 240,
  major: 300,
  apex: 300,
};

// ========== TOURNAMENT RUNTIME STATE ==========

export type ParticipantId = string;

export interface TournamentParticipant {
  id: ParticipantId;
  name: string;
  avatarKey: string;
  isBot: boolean;             // НЕ показывать в UI
  leagueTier: LeagueTier;
  faction: FactionId;
  difficulty?: number;        // 0.0–1.0, чем выше — сильнее (для ботов)
}

export interface MatchSeriesState {
  id: string;
  round: BracketStage;
  playerA: ParticipantId;
  playerB: ParticipantId;
  winsA: number;
  winsB: number;
  draws: number;
  matchesPlayed: number;      // 0..3
  finished: boolean;
  winnerId?: ParticipantId;
  // ✅ BO2 Logic: сумма голов за два матча
  totalGoalsA?: number;
  totalGoalsB?: number;
}

export interface TournamentRuntimeState {
  id: string;
  tier: TournamentTier;
  participants: TournamentParticipant[];
  matches: MatchSeriesState[];  // вся сетка
  currentRound: BracketStage;
}

export interface MatchResultSummary {
  playerAId: ParticipantId;
  playerBId: ParticipantId;
  winnerId?: ParticipantId;   // undefined = ничья
  goalsA: number;
  goalsB: number;
  isDraw: boolean;
}

/**
 * Получить порядковый номер стадии (для сравнения)
 */
export function getBracketStageOrder(stage: BracketStage): number {
  const order: Record<BracketStage, number> = {
    '16': 1,
    '8': 2,
    '4': 3,
    '2': 4,
    '1': 5,
  };
  return order[stage];
}

/**
 * Получить следующую стадию (для продвижения)
 */
export function getNextBracketStage(stage: BracketStage): BracketStage | null {
  const order = getBracketStageOrder(stage);
  if (order >= 5) return null; // Финал - последняя стадия
  
  const stages: BracketStage[] = ['16', '8', '4', '2', '1'];
  return stages[order];
}

