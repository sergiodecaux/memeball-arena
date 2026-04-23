// src/ui/league/LeagueInfoPanel.ts
// Панель информации о текущей лиге

import Phaser from 'phaser';
import { LeagueTier, LeagueProgress } from '../../types/league';
import { getLeagueTierInfo, getLeagueReward } from '../../types/leagueRewards';
import { getColors, getFonts } from '../../config/themes';
import { tgApp } from '../../utils/TelegramWebApp';
import { LEAGUE_DIVISION_KEYS } from '../../config/assetKeys';

export interface LeagueInfoPanelConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  progress: LeagueProgress;
}

/**
 * Панель с информацией о лиге, прогрессе и наградах
 */
export class LeagueInfoPanel {
  private scene: Phaser.Scene;
  private config: LeagueInfoPanelConfig;
  private container: Phaser.GameObjects.Container;
  
  constructor(scene: Phaser.Scene, config: LeagueInfoPanelConfig) {
    this.scene = scene;
    this.config = config;
    this.container = this.scene.add.container(config.x, config.y);
    
    this.createPanel();
  }
  
  /**
   * Создаёт панель
   */
  private createPanel(): void {
    const colors = getColors();
    const fonts = getFonts();
    const s = tgApp.getUIScale();
    const info = getLeagueTierInfo(this.config.progress.currentTier);
    
    const panelWidth = this.config.width;
    const panelHeight = this.config.height;
    
    // Фон панели
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0a12, 0.75);
    bg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 15 * s);
    bg.lineStyle(2 * s, info.color, 0.5);
    bg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 15 * s);
    this.container.add(bg);
    
    let currentY = -panelHeight / 2 + 20 * s;
    
    // Текущий ранг
    currentY = this.createCurrentRank(currentY, panelWidth, info, s, colors, fonts);
    
    // Прогресс звёзд
    currentY = this.createStarsProgress(currentY, panelWidth, s, colors, fonts);
    
    // Награды
    currentY = this.createRewardsSection(currentY, panelWidth, info, s, colors, fonts);
    
    // Правила
    currentY = this.createRulesSection(currentY, panelWidth, s, colors, fonts);
  }
  
  /**
   * Создаёт секцию с текущим рангом
   */
  private createCurrentRank(
    startY: number,
    panelWidth: number,
    info: any,
    s: number,
    colors: any,
    fonts: any
  ): number {
    // Заголовок
    const title = this.scene.add.text(0, startY, '🏆 ТЕКУЩИЙ РАНГ', {
      fontSize: `${fonts.sizes.md * s}px`,
      fontFamily: fonts.primary,
      color: colors.uiAccent,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.container.add(title);
    
    startY += 30 * s;
    
    // Название лиги и дивизион
    const division = this.config.progress.division;
    const divisionRoman = ['I', 'II', 'III'][division - 1];
    const rankText = `${info.nameRu.toUpperCase()} • ДИВИЗИОН ${divisionRoman}`;
    
    const rank = this.scene.add.text(0, startY, rankText, {
      fontSize: `${fonts.sizes.lg * s}px`,
      fontFamily: fonts.primary,
      color: colors.uiText,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.container.add(rank);
    
    // Иконка дивизиона
    const divisionKey = LEAGUE_DIVISION_KEYS[divisionRoman];
    if (this.scene.textures.exists(divisionKey)) {
      const divisionIcon = this.scene.add.image(panelWidth / 4, startY, divisionKey);
      divisionIcon.setDisplaySize(30 * s, 30 * s);
      this.container.add(divisionIcon);
    }
    
    startY += 40 * s;
    
    return startY;
  }
  
  /**
   * Создаёт секцию с прогрессом звёзд
   */
  private createStarsProgress(
    startY: number,
    panelWidth: number,
    s: number,
    colors: any,
    fonts: any
  ): number {
    // Заголовок
    const title = this.scene.add.text(0, startY, '⭐ ПРОГРЕСС', {
      fontSize: `${fonts.sizes.md * s}px`,
      fontFamily: fonts.primary,
      color: colors.uiAccent,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.container.add(title);
    
    startY += 30 * s;
    
    // Текст прогресса
    const starsLeft = this.config.progress.maxStars - this.config.progress.stars;
    const progressText = starsLeft === 0 
      ? 'Готов к повышению!' 
      : `Ещё ${starsLeft} ★ до следующего дивизиона`;
      
    const progress = this.scene.add.text(0, startY, progressText, {
      fontSize: `${fonts.sizes.sm * s}px`,
      fontFamily: fonts.primary,
      color: colors.uiTextSecondary,
      align: 'center',
    }).setOrigin(0.5);
    this.container.add(progress);
    
    startY += 25 * s;
    
    // Прогресс-бар
    const barWidth = panelWidth * 0.7;
    const barHeight = 10 * s;
    const progressPercent = this.config.progress.stars / this.config.progress.maxStars;
    
    // Фон бара
    const barBg = this.scene.add.graphics();
    barBg.fillStyle(0x1a1a2e, 1);
    barBg.fillRoundedRect(-barWidth / 2, startY, barWidth, barHeight, 5 * s);
    this.container.add(barBg);
    
    // Заполненная часть
    const barFill = this.scene.add.graphics();
    const info = getLeagueTierInfo(this.config.progress.currentTier);
    barFill.fillStyle(info.color, 1);
    barFill.fillRoundedRect(-barWidth / 2, startY, barWidth * progressPercent, barHeight, 5 * s);
    this.container.add(barFill);
    
    // Звёзды
    const starsText = `${this.config.progress.stars} / ${this.config.progress.maxStars}`;
    const stars = this.scene.add.text(0, startY + barHeight / 2, starsText, {
      fontSize: `${fonts.sizes.xs * s}px`,
      fontFamily: fonts.primary,
      color: colors.uiText,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.container.add(stars);
    
    startY += 35 * s;
    
    return startY;
  }
  
  /**
   * Создаёт секцию с наградами
   */
  private createRewardsSection(
    startY: number,
    panelWidth: number,
    info: any,
    s: number,
    colors: any,
    fonts: any
  ): number {
    // Заголовок
    const title = this.scene.add.text(0, startY, '🎁 НАГРАДЫ ЗА ДИВИЗИОН', {
      fontSize: `${fonts.sizes.md * s}px`,
      fontFamily: fonts.primary,
      color: colors.uiAccent,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.container.add(title);
    
    startY += 30 * s;
    
    // Получаем награды
    const reward = getLeagueReward(
      this.config.progress.currentTier,
      this.config.progress.division
    );
    
    // Отображаем награды
    const rewardItems: string[] = [];
    if (reward.rewards.coins) {
      rewardItems.push(`💰 ${reward.rewards.coins.toLocaleString()} монет`);
    }
    if (reward.rewards.crystals) {
      rewardItems.push(`💎 ${reward.rewards.crystals} кристаллов`);
    }
    if (reward.rewards.cardPack) {
      const packNames = {
        common: 'Common Pack',
        rare: 'Rare Pack',
        epic: 'Epic Pack',
      };
      rewardItems.push(`📦 ${packNames[reward.rewards.cardPack]}`);
    }
    
    rewardItems.forEach((item, index) => {
      const itemText = this.scene.add.text(0, startY + index * 20 * s, item, {
        fontSize: `${fonts.sizes.sm * s}px`,
        fontFamily: fonts.primary,
        color: colors.uiText,
        align: 'center',
      }).setOrigin(0.5);
      this.container.add(itemText);
    });
    
    startY += rewardItems.length * 20 * s + 15 * s;
    
    // Описание награды
    const desc = this.scene.add.text(0, startY, reward.description, {
      fontSize: `${fonts.sizes.xs * s}px`,
      fontFamily: fonts.primary,
      color: colors.uiTextSecondary,
      align: 'center',
      wordWrap: { width: panelWidth * 0.8 },
    }).setOrigin(0.5);
    this.container.add(desc);
    
    startY += 40 * s;
    
    return startY;
  }
  
  /**
   * Создаёт секцию с правилами
   */
  private createRulesSection(
    startY: number,
    panelWidth: number,
    s: number,
    colors: any,
    fonts: any
  ): number {
    // Заголовок
    const title = this.scene.add.text(0, startY, 'ℹ️ ПРАВИЛА', {
      fontSize: `${fonts.sizes.md * s}px`,
      fontFamily: fonts.primary,
      color: colors.uiAccent,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.container.add(title);
    
    startY += 30 * s;
    
    // Правила
    const rules = [
      '🏆 Победа: +1 ★',
      '🔥 Серия (3+ побед): +2 ★',
      '💔 Поражение: -1 ★',
      '🤝 Ничья: 0 ★',
    ];
    
    if (this.config.progress.currentTier !== 'meteorite') {
      rules.push('⚠️ 0 звёзд при поражении: Orbit Decay');
    }
    
    rules.forEach((rule, index) => {
      const ruleText = this.scene.add.text(0, startY + index * 22 * s, rule, {
        fontSize: `${fonts.sizes.sm * s}px`,
        fontFamily: fonts.primary,
        color: colors.uiTextSecondary,
        align: 'center',
      }).setOrigin(0.5);
      this.container.add(ruleText);
    });
    
    return startY;
  }
  
  /**
   * Обновить прогресс
   */
  updateProgress(progress: LeagueProgress): void {
    this.config.progress = progress;
    this.container.removeAll(true);
    this.createPanel();
  }
  
  /**
   * Получить контейнер
   */
  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
  
  /**
   * Уничтожить панель
   */
  destroy(): void {
    this.container.destroy(true);
  }
}

