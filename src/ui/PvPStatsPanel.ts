// src/ui/PvPStatsPanel.ts
// Панель отображения PvP статистики и рейтинга

import Phaser from 'phaser';
import { playerData } from '../data/PlayerData';
import { PvPStats, PvPMode } from '../types/pvp';
import { PvPManager } from '../managers/PvPManager';
import { tgApp } from '../utils/TelegramWebApp';

export class PvPStatsPanel extends Phaser.GameObjects.Container {
  private mode: PvPMode;
  private stats: PvPStats;
  private s: number;
  
  constructor(scene: Phaser.Scene, x: number, y: number, mode: PvPMode = 'ranked') {
    super(scene, x, y);
    
    this.mode = mode;
    this.stats = playerData.get().pvpStats || {
      casual: { rating: 1000, peak: 1000, matches: 0, wins: 0, losses: 0, draws: 0, winStreak: 0, bestWinStreak: 0 },
      ranked: { rating: 1000, peak: 1000, matches: 0, wins: 0, losses: 0, draws: 0, winStreak: 0, bestWinStreak: 0 },
      totalGoalsScored: 0,
      totalGoalsConceded: 0,
      totalPlaytime: 0,
      perfectGames: 0,
      comebacks: 0,
      lastMatchDate: 0,
    };
    this.s = tgApp.getUIScale();
    
    this.createPanel();
    scene.add.existing(this);
  }
  
  private createPanel(): void {
    const width = 350 * this.s;
    const height = 280 * this.s;
    
    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0b0b14, 0.95);
    bg.lineStyle(2, 0x9d00ff, 0.5);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 12);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 12);
    this.add(bg);
    
    // Title
    const title = this.scene.add.text(0, -height / 2 + 20 * this.s, 
      this.mode === 'ranked' ? 'РЕЙТИНГОВАЯ СТАТИСТИКА' : 'КАЗУАЛЬНАЯ СТАТИСТИКА',
      {
        fontFamily: 'Orbitron',
        fontSize: `${18 * this.s}px`,
        color: '#9d00ff',
        fontStyle: 'bold',
      }
    );
    title.setOrigin(0.5);
    this.add(title);
    
    const modeData = this.mode === 'casual' ? this.stats.casual : this.stats.ranked;
    
    // Rating
    const rating = modeData.rating;
    // TODO: Implement getRankText and getRankColor for new PVP system
    const rankText = 'Unranked'; // PvPManager.getRankText(rating);
    const rankColor = '#ffffff'; // PvPManager.getRankColor(rating);
    
    const ratingText = this.scene.add.text(0, -height / 2 + 55 * this.s,
      `${rating} MMR`, {
        fontFamily: 'Orbitron',
        fontSize: `${32 * this.s}px`,
        color: rankColor,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6,
      });
    ratingText.setOrigin(0.5);
    this.add(ratingText);
    
    const rankLabel = this.scene.add.text(0, -height / 2 + 90 * this.s,
      rankText,
      {
        fontFamily: 'Rajdhani',
        fontSize: `${16 * this.s}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      }
    );
    rankLabel.setOrigin(0.5);
    this.add(rankLabel);
    
    // Stats grid
    const statsY = -height / 2 + 120 * this.s;
    const leftX = -width / 2 + 40 * this.s;
    const rightX = width / 2 - 40 * this.s;
    
    // Left column
    this.addStatLine(leftX, statsY, 'Матчей:', modeData.matches.toString());
    this.addStatLine(leftX, statsY + 30 * this.s, 'Побед:', modeData.wins.toString());
    this.addStatLine(leftX, statsY + 60 * this.s, 'Поражений:', modeData.losses.toString());
    this.addStatLine(leftX, statsY + 90 * this.s, 'Ничьих:', modeData.draws.toString());
    
    // Right column
    this.addStatLine(rightX, statsY, 'Пик MMR:', modeData.peak.toString());
    
    const winRate = modeData.matches > 0 
      ? Math.round((modeData.wins / modeData.matches) * 100) 
      : 0;
    this.addStatLine(rightX, statsY + 30 * this.s, 'Винрейт:', `${winRate}%`);
    
    this.addStatLine(rightX, statsY + 60 * this.s, 'Серия:', modeData.winStreak.toString());
    this.addStatLine(rightX, statsY + 90 * this.s, 'Лучшая:', modeData.bestWinStreak.toString());
  }
  
  private addStatLine(x: number, y: number, label: string, value: string): void {
    const labelText = this.scene.add.text(x, y, label, {
      fontFamily: 'Rajdhani',
      fontSize: `${14 * this.s}px`,
      color: '#a0a0a0',
    });
    labelText.setOrigin(0, 0.5);
    this.add(labelText);
    
    const valueText = this.scene.add.text(x + 120 * this.s, y, value, {
      fontFamily: 'Rajdhani',
      fontSize: `${14 * this.s}px`,
      color: '#ffffff',
      fontStyle: 'bold',
    });
    valueText.setOrigin(0, 0.5);
    this.add(valueText);
  }
  
  public updateMode(mode: PvPMode): void {
    this.mode = mode;
    this.removeAll(true);
    this.createPanel();
  }
}
