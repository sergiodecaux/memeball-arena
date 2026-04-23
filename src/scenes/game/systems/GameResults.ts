// src/scenes/game/systems/GameResults.ts
// Система обработки результатов матча

import { MatchResult } from '../../../types/MatchResult';
import { playerData } from '../../../data/PlayerData';
import { LeagueManager } from '../../../managers/LeagueManager';
import { TournamentManager } from '../../../managers/TournamentManager';
import { MatchContext } from '../types';
import { logInfo } from '../../../utils/ProductionLogger';

export interface GameResultsConfig {
  matchContext: MatchContext;
  tournamentId?: string;
  seriesId?: string;
  round?: string;
}

/**
 * Система обработки результатов матча
 * Отвечает за обновление лиги, турниров, прохождения кампании
 */
export class GameResults {
  private config: GameResultsConfig;
  
  constructor(config: GameResultsConfig) {
    this.config = config;
  }
  
  /**
   * Обработка результата матча
   */
  async processResult(result: MatchResult): Promise<void> {
    logInfo('GameResults', 'Processing match result', {
      context: this.config.matchContext,
      isWin: result.isWin,
      isDraw: result.isDraw,
    });
    
    // Обновляем ежедневные задачи
    this.updateDailyTasks(result);
    
    // Обновляем статистику
    this.updateStats(result);
    
    // Обрабатываем по контексту
    switch (this.config.matchContext) {
      case 'league':
        await this.handleLeagueResult(result);
        break;
        
      case 'tournament':
        await this.handleTournamentResult(result);
        break;
        
      case 'campaign':
        await this.handleCampaignResult(result);
        break;
        
      case 'casual':
        // Для casual только статистика
        break;
        
      default:
        console.log('[GameResults] No special handling for context:', this.config.matchContext);
    }
  }
  
  /**
   * Обновление ежедневных заданий (через DailyTasksManager)
   */
  private updateDailyTasks(result: MatchResult): void {
    try {
      logInfo('GameResults', 'Updating daily tasks', {
        isWin: result.isWin,
        playerGoals: result.playerGoals,
      });
      
      // Динамический импорт для избежания циклических зависимостей
      import('../../../data/DailyTasks').then(({ dailyTasksManager }) => {
        logInfo('GameResults', 'DailyTasks imported successfully');
        
        // Сыграть матч
        dailyTasksManager.updateTaskProgress('play_matches', 1);
        
        // Победа
        if (result.isWin) {
          dailyTasksManager.updateTaskProgress('win_matches', 1);
        }
        
        // Голы
        dailyTasksManager.updateTaskProgress('score_goals', result.playerGoals);
        
        // Кампания
        if (this.config.matchContext === 'campaign' && result.isWin) {
          dailyTasksManager.updateTaskProgress('complete_campaign', 1);
        }
        
        // Лига
        if (this.config.matchContext === 'league') {
          dailyTasksManager.updateTaskProgress('play_league', 1);
        }
      }).catch((error) => {
        console.warn('[GameResults] Failed to import DailyTasks:', error);
      });
    } catch (error) {
      console.warn('[GameResults] Failed to update daily tasks:', error);
    }
  }
  
  /**
   * Обновление базовой статистики
   */
  private updateStats(result: MatchResult): void {
    const data = playerData.get();
    
    if (!data.stats) {
      return;
    }
    
    // Обновляем базовую статистику
    data.stats.gamesPlayed += 1;
    
    if (result.isWin) {
      data.stats.wins += 1;
      data.stats.currentWinStreak += 1;
      if (data.stats.currentWinStreak > data.stats.longestWinStreak) {
        data.stats.longestWinStreak = data.stats.currentWinStreak;
      }
    } else if (result.isDraw) {
      data.stats.draws += 1;
      data.stats.currentWinStreak = 0;
    } else {
      data.stats.losses += 1;
      data.stats.currentWinStreak = 0;
    }
    
    // Обновляем голы
    data.stats.goalsScored += result.playerGoals;
    data.stats.goalsConceded += result.opponentGoals;
    
    // Perfect game
    if (result.isPerfectGame) {
      data.stats.perfectGames += 1;
    }
    
    playerData.save();
    logInfo('GameResults', 'Stats updated');
  }
  
  /**
   * Обработка результата матча лиги
   */
  private async handleLeagueResult(result: MatchResult): Promise<void> {
    logInfo('GameResults', 'Handling league result');
    
    const data = playerData.get();
    const leagueProgress = data.leagueProgress;
    
    if (!leagueProgress) {
      console.warn('[GameResults] No league progress found');
      return;
    }
    
    // Проверяем win streak
    const currentStreak = data.stats.currentWinStreak || 0;
    const isWinStreak = result.isWin && currentStreak >= 3;
    
    console.log(`[GameResults] League match result: ${result.isWin ? 'Win' : 'Loss'}, streak: ${currentStreak}, isWinStreak: ${isWinStreak}`);
    
    // Сохраняем старые звезды для анимации
    const oldStars = leagueProgress.stars;
    
    // Применяем результат матча
    const oldTier = leagueProgress.currentTier;
    const oldDivision = leagueProgress.division;
    
    const newProgress = LeagueManager.applyMatchResult(leagueProgress, result, isWinStreak);
    const newStars = newProgress.stars;
    const newTier = newProgress.currentTier;
    const newDivision = newProgress.division;
    
    const starsDiff = newStars - oldStars;
    console.log(`[GameResults] Stars: ${oldStars} -> ${newStars} (${starsDiff > 0 ? '+' : ''}${starsDiff})`);
    
    if (oldTier !== newTier || oldDivision !== newDivision) {
      console.log(`[GameResults] Rank changed: ${oldTier} ${oldDivision} -> ${newTier} ${newDivision}`);
    }
    
    data.leagueProgress = newProgress;
    
    // Проверяем Orbit Decay
    if (LeagueManager.shouldTriggerOrbitDecay(newProgress, result)) {
      console.log('[GameResults] Orbit Decay triggered');
    }
    
    playerData.save();
    console.log('[GameResults] League progress saved');
  }
  
  /**
   * Обработка результата турнирного матча
   */
  private async handleTournamentResult(result: MatchResult): Promise<void> {
    if (!this.config.tournamentId || !this.config.seriesId) {
      console.warn('[GameResults] Tournament result but no tournamentId/seriesId');
      return;
    }
    
    logInfo('GameResults', 'Handling tournament result', {
      tournamentId: this.config.tournamentId,
      seriesId: this.config.seriesId,
      round: this.config.round,
    });
    
    const data = playerData.get();
    let tournament = data.activeTournament;
    const playerId = data.id;
    
    if (!tournament || tournament.id !== this.config.tournamentId) {
      console.warn('[GameResults] Tournament not found in player data');
      return;
    }
    
    // Находим серию матчей
    const series = tournament.matches.find(m => m.id === this.config.seriesId);
    if (!series) {
      console.warn('[GameResults] Series not found in tournament');
      return;
    }
    
    // Определяем ID игрока и соперника
    const isPlayerA = series.playerA === playerId;
    const opponentId = isPlayerA ? series.playerB : series.playerA;
    
    // Создаём MatchResultSummary
    const matchSummary = {
      playerAId: series.playerA,
      playerBId: series.playerB,
      winnerId: result.isWin ? (isPlayerA ? series.playerA : series.playerB) : 
                result.isDraw ? undefined : opponentId,
      goalsA: isPlayerA ? result.playerGoals : result.opponentGoals,
      goalsB: isPlayerA ? result.opponentGoals : result.playerGoals,
      isDraw: result.isDraw,
    };
    
    // Обновляем серию
    const updatedSeries = TournamentManager.updateSeriesWithMatch(series, matchSummary);
    
    // Обновляем турнир
    tournament.matches = tournament.matches.map(m => 
      m.id === this.config.seriesId ? updatedSeries : m
    );
    
    // ✅ Если серия завершена
    if (TournamentManager.isSeriesFinished(updatedSeries)) {
      // Продвигаем победителя
      const updatedTournament = TournamentManager.advanceWinnersToNextRound(tournament);
      
      // ✅ СИМУЛИРУЕМ ВСЕ БОТ-МАТЧИ В ТЕКУЩЕМ РАУНДЕ
      const finalTournament = TournamentManager.simulateBotMatchesInCurrentRound(updatedTournament, playerId);
      
      data.activeTournament = finalTournament;
      
      if (updatedSeries.winnerId === playerId) {
        console.log('[GameResults] Player won the series, advancing to next round');
        console.log('[GameResults] Bot matches simulated for round:', finalTournament.currentRound);
      } else {
        console.log('[GameResults] Player lost the series, tournament over');
      }
    } else {
      // Серия продолжается, нужен ещё матч
      data.activeTournament = tournament;
      console.log('[GameResults] Series continues, need another match');
    }
    
    playerData.save();
    console.log('[GameResults] Tournament progress saved');
  }
  
  /**
   * Обработка результата кампании
   */
  private async handleCampaignResult(result: MatchResult): Promise<void> {
    logInfo('GameResults', 'Handling campaign result');
    
    const data = playerData.get();
    
    if (result.isWin && result.levelName) {
      // Разблокировка уровней и начисление наград производится в CampaignManager
      logInfo('GameResults', 'Campaign level completed', { level: result.levelName });
      
      // Начисляем награды
      if (result.rewards) {
        if (result.rewards.coins) {
          data.coins += result.rewards.coins;
        }
        if (result.rewards.xp) {
          data.xp += result.rewards.xp;
        }
        playerData.save();
      }
    }
  }
  
  /**
   * Получение контекста матча
   */
  getContext(): MatchContext {
    return this.config.matchContext;
  }
  
  /**
   * Обновление контекста
   */
  setContext(context: MatchContext): void {
    this.config.matchContext = context;
  }
  
  /**
   * Установка данных турнира
   */
  setTournamentData(tournamentId: string, seriesId: string, round: string): void {
    this.config.tournamentId = tournamentId;
    this.config.seriesId = seriesId;
    this.config.round = round;
  }
}
