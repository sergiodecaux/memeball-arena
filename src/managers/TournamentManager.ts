// src/managers/TournamentManager.ts
// Менеджер системы Weekend Tournaments

import {
  TournamentTier,
  TournamentParticipant,
  TournamentRuntimeState,
  MatchSeriesState,
  MatchResultSummary,
  BracketStage,
  ParticipantId,
  getBracketStageOrder,
  getNextBracketStage,
} from '../types/tournament';
import { LeagueTier, getLeagueTierOrder } from '../types/league';
import { FactionId, FACTION_IDS } from '../constants/gameConstants';
import { PlayerData } from '../data/PlayerData';
import { playerData } from '../data/PlayerData';
import { BattlePassManager } from './BattlePassManager';

// ========== КОНСТАНТЫ ==========

const TOURNAMENT_PARTICIPANTS = 16;
const DRAW_PROBABILITY = 0.08; // 8% вероятность ничьей в матче

// SciFi имена для ботов
const SCI_FI_PREFIXES = ['Neon', 'Cyber', 'Void', 'Quantum', 'Nova', 'Astro', 'Plasma', 'Pulse', 'Crystal', 'Shadow', 'Phantom', 'Nexus'];
const SCI_FI_SUFFIXES = ['Viper', 'Titan', 'Walker', 'Strike', 'Blade', 'Force', 'Storm', 'Flux', 'Core', 'Edge', 'Wing', 'Prime'];

// Маппинг турнирных тиров на диапазоны сложности
const TIER_DIFFICULTY_RANGES: Record<TournamentTier, { min: number; max: number }> = {
  rookie: { min: 0.2, max: 0.4 },
  minor: { min: 0.4, max: 0.6 },
  major: { min: 0.6, max: 0.8 },
  apex: { min: 0.8, max: 1.0 },
};

// Маппинг турнирных тиров на требуемые лиги
const TIER_REQUIRED_LEAGUES: Record<TournamentTier, LeagueTier[]> = {
  rookie: [LeagueTier.METEORITE],
  minor: [LeagueTier.COMET],
  major: [LeagueTier.PLANET, LeagueTier.STAR],
  apex: [LeagueTier.NEBULA, LeagueTier.CORE],
};

// ✅ ДОБАВЛЕНО: Интерфейс наград за этапы турнира
export interface TournamentReward {
  coins?: number;
  crystals?: number;
  xp?: number;
  keyFragments?: number;
  ticket?: number;
  title?: string;
  exclusiveUnit?: string;
}

// ✅ ДОБАВЛЕНО: Награды за этапы турнира
export const TOURNAMENT_ROUND_REWARDS: Record<TournamentTier, Record<BracketStage, TournamentReward>> = {
  rookie: {
    '16': { coins: 100, xp: 20 },
    '8': { coins: 200, xp: 40, keyFragments: 1 },
    '4': { coins: 400, xp: 60 },
    '2': { coins: 800, xp: 100, keyFragments: 1 },
    '1': { coins: 2000, crystals: 20, xp: 200, ticket: 1, title: 'Чемпион Rookie' },
  },
  minor: {
    '16': { coins: 150, xp: 30 },
    '8': { coins: 300, xp: 50, keyFragments: 1 },
    '4': { coins: 600, xp: 80, crystals: 5 },
    '2': { coins: 1200, xp: 120, keyFragments: 1 },
    '1': { coins: 3000, crystals: 40, xp: 300, ticket: 1, title: 'Чемпион Minor' },
  },
  major: {
    '16': { coins: 200, xp: 40 },
    '8': { coins: 500, xp: 70, keyFragments: 1 },
    '4': { coins: 1000, xp: 100, crystals: 10 },
    '2': { coins: 2000, xp: 150, keyFragments: 1, crystals: 15 },
    '1': { coins: 5000, crystals: 80, xp: 400, ticket: 1, title: 'Чемпион Major' },
  },
  apex: {
    '16': { coins: 300, xp: 50 },
    '8': { coins: 700, xp: 100, keyFragments: 1 },
    '4': { coins: 1500, xp: 150, crystals: 20 },
    '2': { coins: 3000, xp: 200, keyFragments: 1, crystals: 30 },
    '1': { coins: 10000, crystals: 150, xp: 500, ticket: 1, title: 'Чемпион Apex', exclusiveUnit: 'apex_champion_unit' },
  },
};

// ========== КЛАСС МЕНЕДЖЕРА ==========

export class TournamentManager {
  /**
   * Генерирует SciFi имя для бота
   */
  private static generateBotName(): string {
    const prefix = SCI_FI_PREFIXES[Math.floor(Math.random() * SCI_FI_PREFIXES.length)];
    const suffix = SCI_FI_SUFFIXES[Math.floor(Math.random() * SCI_FI_SUFFIXES.length)];
    const number = Math.floor(Math.random() * 99) + 1;
    return `${prefix}${suffix} ${number}`;
  }

  /**
   * Генерирует случайную фракцию
   */
  private static generateRandomFaction(): FactionId {
    return FACTION_IDS[Math.floor(Math.random() * FACTION_IDS.length)];
  }

  /**
   * Генерирует случайный аватар (простой ID)
   */
  private static generateRandomAvatar(): string {
    return `avatar_${Math.floor(Math.random() * 10) + 1}`;
  }

  /**
   * Генерирует лигу для бота на основе типа турнира
   */
  private static generateBotLeagueTier(tier: TournamentTier): LeagueTier {
    const requiredLeagues = TIER_REQUIRED_LEAGUES[tier];
    // Случайно выбираем одну из требуемых лиг
    return requiredLeagues[Math.floor(Math.random() * requiredLeagues.length)];
  }

  /**
   * Создаёт участника-бота
   */
  private static createBotParticipant(tier: TournamentTier, index: number): TournamentParticipant {
    const leagueTier = this.generateBotLeagueTier(tier);
    const difficultyRange = TIER_DIFFICULTY_RANGES[tier];
    const difficulty = difficultyRange.min + Math.random() * (difficultyRange.max - difficultyRange.min);

    return {
      id: `bot_${Date.now()}_${index}`,
      name: this.generateBotName(),
      avatarKey: this.generateRandomAvatar(),
      isBot: true,
      leagueTier,
      faction: this.generateRandomFaction(),
      difficulty,
    };
  }
  
  /**
   * Создаёт участника из реального игрока (для PvP турниров)
   */
  static createRealPlayerParticipant(
    playerId: string,
    playerName: string,
    avatarKey: string,
    leagueTier: LeagueTier,
    faction: FactionId
  ): TournamentParticipant {
    return {
      id: playerId,
      name: playerName,
      avatarKey,
      isBot: false,
      leagueTier,
      faction,
      difficulty: undefined, // Не используется для реальных игроков
    };
  }

  /**
   * Создаёт участника из данных игрока
   */
  private static createPlayerParticipant(playerData: PlayerData, tier: TournamentTier): TournamentParticipant {
    const leagueProgress = playerData.leagueProgress;
    if (!leagueProgress) {
      throw new Error('Player does not have league progress');
    }

    return {
      id: playerData.id,
      name: playerData.nickname,
      avatarKey: playerData.avatarId,
      isBot: false,
      leagueTier: leagueProgress.currentTier,
      faction: playerData.selectedFaction || 'cyborg',
      difficulty: undefined, // Не используется для игрока
    };
  }

  /**
   * Создаёт начальную сетку матчей для стадии 16
   */
  private static createInitialBracket(
    participants: TournamentParticipant[]
  ): MatchSeriesState[] {
    const matches: MatchSeriesState[] = [];
    
    // Распределяем 16 участников по 8 парам
    for (let i = 0; i < TOURNAMENT_PARTICIPANTS; i += 2) {
      const matchId = `match_16_${i / 2}`;
      matches.push({
        id: matchId,
        round: '16',
        playerA: participants[i].id,
        playerB: participants[i + 1].id,
        winsA: 0,
        winsB: 0,
        draws: 0,
        matchesPlayed: 0,
        finished: false,
      });
    }
    
    return matches;
  }

  /**
   * Создаёт новый турнир
   */
  static createTournament(tier: TournamentTier, playerData: PlayerData): TournamentRuntimeState {
    const participants: TournamentParticipant[] = [];
    
    // Добавляем игрока
    const playerParticipant = this.createPlayerParticipant(playerData, tier);
    participants.push(playerParticipant);
    
    // Генерируем остальных ботов (15 ботов для 16 участников)
    for (let i = 1; i < TOURNAMENT_PARTICIPANTS; i++) {
      participants.push(this.createBotParticipant(tier, i));
    }
    
    // Перемешиваем участников (но игрок всегда первый для простоты)
    // На практике можно сделать более сложную логику распределения
    const shuffled = [participants[0], ...participants.slice(1).sort(() => Math.random() - 0.5)];
    
    // Создаём начальную сетку
    const matches = this.createInitialBracket(shuffled);
    
    return {
      id: `tournament_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      tier,
      participants: shuffled,
      matches,
      currentRound: '16',
    };
  }

  /**
   * ✅ BO3: Обновляет серию матчей результатом одного матча
   * Первый до 2 побед. Ничья в матче = очко обоим (не считается как победа).
   * Если после 2 матчей счёт 1:1 или 0:0 - играется 3й матч.
   * Если в 3м матче ничья - играется 4й и т.д. до победителя.
   */
  static updateSeriesWithMatch(
    series: MatchSeriesState,
    matchResult: MatchResultSummary
  ): MatchSeriesState {
    const newSeries = { ...series };
    newSeries.matchesPlayed++;
    
    // Считаем голы (для статистики и тай-брейка)
    if (newSeries.totalGoalsA === undefined) newSeries.totalGoalsA = 0;
    if (newSeries.totalGoalsB === undefined) newSeries.totalGoalsB = 0;
    newSeries.totalGoalsA += matchResult.goalsA;
    newSeries.totalGoalsB += matchResult.goalsB;

    // ✅ Считаем победы в матчах (ничья не даёт победу никому)
    if (matchResult.isDraw) {
      newSeries.draws++;
      // Ничья в матче - НЕ считается как победа ни для кого
      console.log(`[Tournament] Match ${newSeries.matchesPlayed}: Draw (${matchResult.goalsA}:${matchResult.goalsB})`);
    } else if (matchResult.winnerId === series.playerA) {
      newSeries.winsA++;
      console.log(`[Tournament] Match ${newSeries.matchesPlayed}: Player A wins (${matchResult.goalsA}:${matchResult.goalsB})`);
    } else if (matchResult.winnerId === series.playerB) {
      newSeries.winsB++;
      console.log(`[Tournament] Match ${newSeries.matchesPlayed}: Player B wins (${matchResult.goalsA}:${matchResult.goalsB})`);
    }

    // ✅ BO3: Первый до 2 побед
    const WINS_TO_WIN_SERIES = 2;
    
    if (newSeries.winsA >= WINS_TO_WIN_SERIES) {
      newSeries.finished = true;
      newSeries.winnerId = series.playerA;
      console.log(`[Tournament] Series finished: Player A wins ${newSeries.winsA}:${newSeries.winsB}`);
    } else if (newSeries.winsB >= WINS_TO_WIN_SERIES) {
      newSeries.finished = true;
      newSeries.winnerId = series.playerB;
      console.log(`[Tournament] Series finished: Player B wins ${newSeries.winsB}:${newSeries.winsA}`);
    }
    
    // ✅ Если серия не завершена, проверяем нужен ли ещё матч
    if (!newSeries.finished) {
      const maxPossibleMatches = (WINS_TO_WIN_SERIES - 1) * 2 + 1 + newSeries.draws; // 3 + draws
      console.log(`[Tournament] Series continues: ${newSeries.winsA}:${newSeries.winsB}, matches: ${newSeries.matchesPlayed}/${maxPossibleMatches}`);
    }

    return newSeries;
  }

  /**
   * ✅ BO3: Проверяет, завершена ли серия
   */
  static isSeriesFinished(series: MatchSeriesState): boolean {
    return series.finished && series.winnerId !== undefined;
  }

  /**
   * ✅ Проверяет нужен ли ещё матч в серии
   */
  static needsAnotherMatch(series: MatchSeriesState): boolean {
    if (series.finished) return false;
    
    const WINS_TO_WIN_SERIES = 2;
    return series.winsA < WINS_TO_WIN_SERIES && series.winsB < WINS_TO_WIN_SERIES;
  }

  /**
   * ✅ BO2: Разрешает ничью, если после 3 матчей всё ещё нет победителя
   */
  static resolveTieIfNeeded(series: MatchSeriesState): MatchSeriesState {
    if (series.matchesPlayed >= 3 && !series.finished && !series.winnerId) {
      // Если после 3 матчей всё ещё ничья - используем RNG
      const newSeries = { ...series };
      newSeries.finished = true;
      newSeries.winnerId = Math.random() > 0.5 ? series.playerA : series.playerB;
      return newSeries;
    }
    return series;
  }

  /**
   * ✅ BO3: Симулирует серию между двумя ботами (первый до 2 побед)
   */
  static simulateBotSeries(
    participantA: TournamentParticipant,
    participantB: TournamentParticipant,
    seriesId: string
  ): MatchSeriesState {
    const series: MatchSeriesState = {
      id: seriesId,
      round: '16', // Будет обновлено позже
      playerA: participantA.id,
      playerB: participantB.id,
      winsA: 0,
      winsB: 0,
      draws: 0,
      matchesPlayed: 0,
      finished: false,
      totalGoalsA: 0,
      totalGoalsB: 0,
    };

    const difficultyA = participantA.difficulty || 0.5;
    const difficultyB = participantB.difficulty || 0.5;
    const winProbabilityA = difficultyA / (difficultyA + difficultyB);
    const WINS_TO_WIN_SERIES = 2;

    // ✅ Симулируем матчи до тех пор, пока кто-то не наберёт 2 победы
    while (!series.finished && series.matchesPlayed < 5) { // Максимум 5 матчей (на случай множественных ничьих)
      series.matchesPlayed++;

      // Генерируем голы (0-5 для каждой команды)
      const goalsA = Math.floor(Math.random() * (winProbabilityA > 0.5 ? 6 : 4));
      const goalsB = Math.floor(Math.random() * (winProbabilityA < 0.5 ? 6 : 4));
      
      series.totalGoalsA! += goalsA;
      series.totalGoalsB! += goalsB;

      // ✅ Считаем победы (ничья не даёт победу)
      if (goalsA > goalsB) {
        series.winsA++;
      } else if (goalsB > goalsA) {
        series.winsB++;
      } else {
        series.draws++;
      }

      // ✅ Проверяем завершение серии
      if (series.winsA >= WINS_TO_WIN_SERIES) {
        series.finished = true;
        series.winnerId = series.playerA;
        console.log(`[Tournament] Bot series finished: ${participantA.name} wins ${series.winsA}:${series.winsB}`);
      } else if (series.winsB >= WINS_TO_WIN_SERIES) {
        series.finished = true;
        series.winnerId = series.playerB;
        console.log(`[Tournament] Bot series finished: ${participantB.name} wins ${series.winsB}:${series.winsA}`);
      }
    }

    // ✅ Если после 5 матчей всё ещё нет победителя (множественные ничьи) - используем RNG
    if (!series.finished) {
      series.finished = true;
      series.winnerId = Math.random() > 0.5 ? series.playerA : series.playerB;
      console.log(`[Tournament] Bot series tie-breaker: ${series.winnerId === series.playerA ? participantA.name : participantB.name} wins by RNG`);
    }

    return series;
  }

  /**
   * Продвигает победителей в следующую стадию
   */
  static advanceWinnersToNextRound(
    tournament: TournamentRuntimeState
  ): TournamentRuntimeState {
    const currentRound = tournament.currentRound;
    const nextRound = getNextBracketStage(currentRound);
    
    if (!nextRound) {
      // Турнир завершён
      return tournament;
    }

    // Находим все завершённые серии текущего раунда
    const finishedMatches = tournament.matches.filter(
      m => m.round === currentRound && m.finished && m.winnerId
    );

    if (finishedMatches.length === 0) {
      return tournament; // Нет завершённых матчей
    }

    // Создаём новые серии для следующего раунда
    const newMatches: MatchSeriesState[] = [];
    const winners = finishedMatches.map(m => m.winnerId!);

    // Парные матчи (победитель 1 vs победитель 2, победитель 3 vs победитель 4, и т.д.)
    for (let i = 0; i < winners.length; i += 2) {
      if (i + 1 < winners.length) {
        const matchId = `match_${nextRound}_${i / 2}`;
        newMatches.push({
          id: matchId,
          round: nextRound,
          playerA: winners[i],
          playerB: winners[i + 1],
          winsA: 0,
          winsB: 0,
          draws: 0,
          matchesPlayed: 0,
          finished: false,
        });
      }
    }

    // Обновляем турнир
    const updatedTournament = {
      ...tournament,
      matches: [...tournament.matches, ...newMatches],
      currentRound: nextRound,
    };

    return updatedTournament;
  }

  /**
   * Находит серию, в которой участвует игрок в текущем раунде
   */
  static findPlayerSeries(
    tournament: TournamentRuntimeState,
    playerId: ParticipantId
  ): MatchSeriesState | null {
    return (
      tournament.matches.find(
        m => m.round === tournament.currentRound && (m.playerA === playerId || m.playerB === playerId)
      ) || null
    );
  }

  /**
   * Симулирует все бот-серии в текущем раунде (кроме тех, где участвует игрок)
   */
  static simulateBotMatchesInCurrentRound(
    tournament: TournamentRuntimeState,
    playerId: ParticipantId
  ): TournamentRuntimeState {
    const currentRound = tournament.currentRound;
    const updatedMatches = tournament.matches.map(series => {
      // Пропускаем серии, где участвует игрок или уже завершённые
      if (series.finished || series.round !== currentRound) {
        return series;
      }
      
      if (series.playerA === playerId || series.playerB === playerId) {
        return series; // Не симулируем серии игрока
      }

      // Находим участников
      const participantA = tournament.participants.find(p => p.id === series.playerA);
      const participantB = tournament.participants.find(p => p.id === series.playerB);

      if (!participantA || !participantB) {
        return series; // Участники не найдены
      }

      // Симулируем серию
      return this.simulateBotSeries(participantA, participantB, series.id);
    });

    return {
      ...tournament,
      matches: updatedMatches,
    };
  }

  /**
   * Получить участника по ID
   */
  static getParticipant(
    tournament: TournamentRuntimeState,
    participantId: ParticipantId
  ): TournamentParticipant | null {
    return tournament.participants.find(p => p.id === participantId) || null;
  }

  /**
   * Проверяет доступность турнира для игрока по лиге
   */
  static isTournamentAccessible(tier: TournamentTier, playerLeagueTier: LeagueTier): boolean {
    const requiredLeagues = TIER_REQUIRED_LEAGUES[tier];
    return requiredLeagues.includes(playerLeagueTier);
  }

  /**
   * ✅ ДОБАВЛЕНО: Выдаёт награду за прохождение этапа турнира
   */
  static grantRoundReward(tier: TournamentTier, round: BracketStage): TournamentReward {
    const reward = TOURNAMENT_ROUND_REWARDS[tier][round];
    
    if (reward.coins) playerData.addCoins(reward.coins);
    if (reward.crystals) playerData.addCrystals(reward.crystals);
    if (reward.xp) {
      // Добавляем XP через BattlePassManager если доступен
      try {
        const battlePassManager = BattlePassManager.getInstance();
        battlePassManager.addXP(reward.xp, 'tournament_round');
      } catch (e) {
        console.warn('[TournamentManager] BattlePassManager not available for XP reward');
      }
    }
    if (reward.keyFragments) playerData.addTournamentKeyFragments(reward.keyFragments);
    if (reward.ticket) playerData.addTournamentTickets(reward.ticket);
    if (reward.title) {
      // TODO: Добавить метод для титулов в PlayerData
      console.log(`[TournamentManager] Title unlocked: ${reward.title}`);
    }
    if (reward.exclusiveUnit) {
      // TODO: Добавить метод для эксклюзивных юнитов
      console.log(`[TournamentManager] Exclusive unit unlocked: ${reward.exclusiveUnit}`);
    }
    
    playerData.save();
    return reward;
  }
}

