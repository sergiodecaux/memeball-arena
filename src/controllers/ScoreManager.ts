// src/controllers/ScoreManager.ts
// ✅ ИЗМЕНЕНО: Убраны ссылки на WINNING_SCORE, теперь победа определяется только по времени

import Phaser from 'phaser';
import { PlayerNumber } from '../types';

export class ScoreManager {
  private scene: Phaser.Scene;
  private scores: Record<PlayerNumber, number> = { 1: 0, 2: 0 };
  private scoreText!: Phaser.GameObjects.Text;
  private goalText!: Phaser.GameObjects.Text;
  private onWinCallback?: (winner: PlayerNumber) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createUI();
  }

  private createUI(): void {
    const { centerX, height, centerY } = this.scene.cameras.main;
    
    const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'Arial Black',
      stroke: '#000000',
    };

    this.scoreText = this.scene.add.text(centerX, height - 30, '0 : 0', {
      ...textStyle,
      fontSize: '32px',
      color: '#ffffff',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(100);

    this.goalText = this.scene.add.text(centerX, centerY, '', {
      ...textStyle,
      fontSize: '64px',
      color: '#ffff00',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(200).setVisible(false);
  }

  /**
   * Добавляет гол игроку.
   * ✅ ИЗМЕНЕНО: Больше не возвращает true при "победном голе" — 
   * победа определяется только по истечении времени.
   */
  addGoal(player: PlayerNumber): boolean {
    this.scores[player]++;
    this.scoreText.setText(`${this.scores[1]} : ${this.scores[2]}`);
    this.showGoalAnimation(player);

    // ✅ Всегда возвращаем false — матч продолжается до конца таймера
    return false;
  }

  // --- НОВЫЙ МЕТОД: Установка счета извне (для PvP) ---
  setScores(p1: number, p2: number): void {
    this.scores[1] = p1;
    this.scores[2] = p2;
    this.scoreText.setText(`${this.scores[1]} : ${this.scores[2]}`);
  }
  // ----------------------------------------------------

  /**
   * Проверяет, лидирует ли игрок
   * ✅ ИЗМЕНЕНО: Теперь просто проверяет, у кого больше голов
   */
  isLeading(player: PlayerNumber): boolean {
    const opponent: PlayerNumber = player === 1 ? 2 : 1;
    return this.scores[player] > this.scores[opponent];
  }

  /**
   * Проверяет, есть ли ничья
   */
  isDraw(): boolean {
    return this.scores[1] === this.scores[2];
  }

  /**
   * Возвращает текущего лидера или null при ничьей
   */
  getLeader(): PlayerNumber | null {
    if (this.scores[1] > this.scores[2]) return 1;
    if (this.scores[2] > this.scores[1]) return 2;
    return null;
  }

  /**
   * Возвращает разницу в счёте
   */
  getScoreDifference(): number {
    return Math.abs(this.scores[1] - this.scores[2]);
  }

  private showGoalAnimation(player: PlayerNumber): void {
    const isBlue = player === 1;
    
    this.goalText
      .setText(`⚽ GOAL!\n${isBlue ? 'Blue' : 'Red'} Team`)
      .setColor(isBlue ? '#3498db' : '#e74c3c')
      .setVisible(true)
      .setScale(0.5)
      .setAlpha(0);

    this.scene.tweens.chain({
      targets: this.goalText,
      tweens: [
        { scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' },
        { scale: 1.2, alpha: 0, duration: 500, delay: 1000, ease: 'Power2' },
      ],
      onComplete: () => this.goalText.setVisible(false),
    });
  }

  getScores(): Record<PlayerNumber, number> {
    return { ...this.scores };
  }

  reset(): void {
    this.scores = { 1: 0, 2: 0 };
    this.scoreText.setText('0 : 0');
  }

  onWin(callback: (winner: PlayerNumber) => void): void {
    this.onWinCallback = callback;
  }
}