// src/controllers/match/MatchController.ts
import { PlayerNumber, Formation } from '../../types';
import { playerData } from '../../data/PlayerData';

export interface MatchResult {
  winner: PlayerNumber | null;
  playerGoals: number;
  opponentGoals: number;
  xpEarned: number;
  coinsEarned: number;
  isWin: boolean;
  isDraw?: boolean;
  isPerfectGame: boolean;
  newAchievements: string[];
  isPvP?: boolean;
  reason?: string;
}

export interface MatchState {
  scores: Record<PlayerNumber, number>;
  currentFormation: Formation;
  pendingFormation: Formation | null;
  matchStartTime: number;
  isFinished: boolean;
  matchDuration: number;
  timeLeft: number;
}

export class MatchController {
  private state: MatchState;
  private timerEvent?: Phaser.Time.TimerEvent;

  constructor() {
    this.state = {
      scores: { 1: 0, 2: 0 },
      currentFormation: playerData.getSelectedFormation(),
      pendingFormation: null,
      matchStartTime: Date.now(),
      isFinished: false,
      matchDuration: 300000,
      timeLeft: 300
    };
  }

  startMatch(scene: Phaser.Scene): void {
    this.state.matchStartTime = Date.now();
    this.state.timeLeft = 300;

    this.timerEvent = scene.time.addEvent({
      delay: 1000,
      callback: this.updateTimer,
      callbackScope: this,
      loop: true
    });
  }

  private updateTimer(): void {
    const elapsed = Date.now() - this.state.matchStartTime;
    this.state.timeLeft = Math.max(0, Math.floor((this.state.matchDuration - elapsed) / 1000));

    if (this.state.timeLeft === 0 && !this.state.isFinished) {
      this.finishMatchByTime();
    }
  }

  addGoal(player: PlayerNumber): void {
    this.state.scores[player]++;
  }

  getScores(): Record<PlayerNumber, number> {
    return { ...this.state.scores };
  }

  getTimeLeft(): number {
    return this.state.timeLeft;
  }

  getMatchDuration(): number {
    return 300;
  }

  getTimeString(): string {
    const mins = Math.floor(this.state.timeLeft / 60);
    const secs = this.state.timeLeft % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  finishMatchByTime(): MatchResult {
    this.state.isFinished = true;
    const playerGoals = this.state.scores[1];
    const opponentGoals = this.state.scores[2];

    if (playerGoals > opponentGoals) return this.finishMatch(1);
    if (opponentGoals > playerGoals) return this.finishMatch(2);
    return this.finishMatch(null);
  }

  finishMatch(winner: PlayerNumber | null): MatchResult {
    this.state.isFinished = true;
    if (this.timerEvent) this.timerEvent.destroy();

    const playerGoals = this.state.scores[1];
    const opponentGoals = this.state.scores[2];
    const isWin = winner === 1;
    const isDraw = winner === null;
    const isPerfectGame = isWin && opponentGoals === 0;

    let xpEarned = isWin ? 80 : isDraw ? 40 : 20;
    let coinsEarned = isWin ? 150 : isDraw ? 75 : 30;

    if (isPerfectGame) {
      xpEarned += 40;
      coinsEarned += 100;
    }

    xpEarned += playerGoals * 12;
    coinsEarned += playerGoals * 15;

    const result: 'win' | 'loss' | 'draw' = isWin ? 'win' : isDraw ? 'draw' : 'loss';
    playerData.updateStats(result, playerGoals, opponentGoals);

    const playTimeSeconds = Math.floor((Date.now() - this.state.matchStartTime) / 1000);
    playerData.addPlayTime(playTimeSeconds);

    const newAchievements = this.checkAchievements(isWin, playerGoals, opponentGoals);

    return {
      winner,
      playerGoals,
      opponentGoals,
      xpEarned,
      coinsEarned,
      isWin,
      isDraw,
      isPerfectGame,
      newAchievements,
    };
  }

  surrender(): MatchResult {
    return this.finishMatch(2);
  }

  private checkAchievements(isWin: boolean, playerGoals: number, opponentGoals: number): string[] {
    const achievements: string[] = [];
    const stats = playerData.get().stats;

    if (isWin && stats.wins === 1) achievements.push('first_victory');
    if (stats.currentWinStreak >= 5) achievements.push('unstoppable');
    if (playerGoals >= 7) achievements.push('goal_machine');
    if (isWin && opponentGoals === 0) achievements.push('clean_sheet');

    achievements.forEach(id => playerData.unlockAchievement(id));
    return achievements;
  }

  reset(): void {
    if (this.timerEvent) this.timerEvent.destroy();
    
    this.state = {
      scores: { 1: 0, 2: 0 },
      currentFormation: playerData.getSelectedFormation(),
      pendingFormation: null,
      matchStartTime: Date.now(),
      isFinished: false,
      matchDuration: 300000,
      timeLeft: 300
    };
  }

  getCurrentFormation(): Formation { 
    return this.state.currentFormation; 
  }
  
  setPendingFormation(f: Formation): void { 
    this.state.pendingFormation = f; 
    playerData.selectFormation(f.id); 
  }
  
  applyPendingFormation(): boolean {
    if (this.state.pendingFormation) {
      this.state.currentFormation = this.state.pendingFormation;
      this.state.pendingFormation = null;
      return true;
    }
    return false;
  }
  
  hasPendingFormation(): boolean { 
    return this.state.pendingFormation !== null; 
  }
}