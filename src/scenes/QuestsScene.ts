// QuestsScene.ts - Простая сцена ежедневных заданий (по образцу ShopScene/TeamScene)

import Phaser from 'phaser';
import { playerData } from '../data/PlayerData';
import { AudioManager } from '../managers/AudioManager';
import { tgApp } from '../utils/TelegramWebApp';
import { dailyTasksManager } from '../data/DailyTasks';
import { SwipeNavigationManager } from '../ui/SwipeNavigationManager';
import { battlePassManager } from '../managers/BattlePassManager';
import { getCurrentSeason, BP_XP_REWARDS, getXPProgress } from '../data/BattlePassData';
import { getColors, getFonts, hexToString } from '../config/themes';
import { hapticSelection } from '../utils/Haptics';
import { rookiePathManager, ROOKIE_PATH_FINAL_REWARD } from '../data/RookiePath';
import { FactionId } from '../constants/gameConstants';
import { RookieFactionWheelOverlay } from '../ui/RookieFactionWheelOverlay';
import { ensureSafeImageLoading } from '../assets/loading/ImageLoader';
import { loadAudioMenu, loadAudioRewardClaim } from '../assets/loading/AudioLoader';
import type { QuestRow } from '../ui/quest/TaskCardPool';
import type { DailyTaskType } from '../data/DailyTasks';

export class QuestsScene extends Phaser.Scene {
  private scrollY = 0;
  private maxScrollY = 0;
  private contentContainer!: Phaser.GameObjects.Container;
  private isDragging = false;
  private lastPointerY = 0;
  private scrollVelocity = 0;
  /** Чтобы не двигать контейнер каждый кадр при инерции */
  private lastAppliedContentY = Number.NaN;
  private headerCoinText?: Phaser.GameObjects.Text;
  private headerCrystalText?: Phaser.GameObjects.Text;
  
  private topInset = 0;
  private bottomInset = 0;
  private headerHeight = 110;
  private topOffset = 0;
  private swipeManager?: SwipeNavigationManager;
  
  private activeTab: 'path' | 'daily' | 'weekly' | 'battlepass' = 'path';
  private tabContainer!: Phaser.GameObjects.Container;
  private s!: number;
  /** GeometryMask в координатах экрана (не внутри контейнера скролла) */
  private contentScrollMask?: Phaser.GameObjects.Graphics;
  
  constructor() {
    super({ key: 'QuestsScene' });
  }

  preload(): void {
    ensureSafeImageLoading(this);
    if (!this.textures.exists('ui_rewards_coins')) {
      this.load.image('ui_rewards_coins', 'assets/ui/icons/rewards/icon_currency_coins.png');
      this.load.image('ui_rewards_crystals', 'assets/ui/icons/rewards/icon_currency_crystals.png');
    }
    loadAudioMenu(this);
    loadAudioRewardClaim(this);
  }

  create(data?: { tab?: string }): void {
    if (import.meta.env.DEV) {
      console.log('[QuestsScene] create', data?.tab);
    }
    // Устанавливаем активную вкладку из data если есть
    if (data?.tab && ['path', 'daily', 'weekly', 'battlepass'].includes(data.tab)) {
      this.activeTab = data.tab as any;
    }
    
    this.topInset = tgApp.getTopInset();
    this.bottomInset = tgApp.getBottomInset();
    AudioManager.getInstance().init(this);
    
    const { width, height } = this.cameras.main;
    this.s = Math.min(width / 390, height / 844);
    
    this.createBackground();
    this.createHeader();
    this.createTabs();
    this.contentContainer = this.add.container(0, this.topOffset).setDepth(1);
    this.ensureContentScrollMask();
    this.createContent();
    this.applyScrollPosition();
    this.setupScrolling();
    
    this.swipeManager = new SwipeNavigationManager(this, {
      onBack: () => this.handleBack(),
    });
    this.swipeManager.enable();
    if (import.meta.env.DEV) {
      console.log('[QuestsScene] create done');
    }
  }
  
  shutdown(): void {
    this.swipeManager?.destroy();
    this.contentScrollMask?.destroy();
    this.contentScrollMask = undefined;
  }
  
  update(): void {
    if (!this.isDragging && Math.abs(this.scrollVelocity) > 0.5) {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + this.scrollVelocity, 0, this.maxScrollY);
      this.scrollVelocity *= 0.92;
      this.applyScrollPosition();
    }
  }

  private sortQuestRows(tasks: QuestRow[]): QuestRow[] {
    return [...tasks].sort((a, b) => {
      const stateA = a.claimed ? 2 : a.completed ? 0 : 1;
      const stateB = b.claimed ? 2 : b.completed ? 0 : 1;
      return stateA - stateB;
    });
  }

  
  private handleBack(): void {
    AudioManager.getInstance().playUIClick();
    this.scene.start('MainMenuScene');
  }
  
  private createBackground(): void {
    const { width, height } = this.cameras.main;

    const bg = this.add.graphics();
    for (let y = 0; y < height; y++) {
      const ratio = y / height;
      const r = Math.floor(8 + ratio * 12);
      const g = Math.floor(8 + ratio * 8);
      const b = Math.floor(25 + ratio * 15);
      bg.fillStyle((r << 16) | (g << 8) | b, 1);
      bg.fillRect(0, y, width, 1);
    }

    for (let i = 0; i < 50; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.FloatBetween(0.5, 1.5),
        0xffffff,
        Phaser.Math.FloatBetween(0.2, 0.6)
      );
      this.tweens.add({
        targets: star,
        alpha: 0.1,
        duration: Phaser.Math.Between(1500, 3000),
        yoyo: true,
        repeat: -1,
      });
    }
  }
  
  private createHeader(): void {
    const { width } = this.cameras.main;
    const data = playerData.get();
    const fonts = getFonts();
    const colors = getColors();
    const s = this.s;

    this.headerHeight = 95 + this.topInset;
    /** Как ShopScene.visibleAreaTop — контент ниже панели вкладок */
    this.topOffset = 155 + this.topInset;

    const hdr = this.add.graphics().setDepth(100);
    hdr.fillStyle(0x000000, 0.9);
    hdr.fillRect(0, 0, width, this.headerHeight);
    hdr.lineStyle(2, colors.uiAccent, 0.4);
    hdr.lineBetween(0, this.headerHeight, width, this.headerHeight);

    const backBtn = this.add.container(20, 28 + this.topInset).setDepth(101);
    const backCircle = this.add.graphics();
    backCircle.fillStyle(0x050816, 0.95);
    backCircle.fillCircle(0, 0, 18);
    backCircle.lineStyle(1, colors.uiAccent, 0.55);
    backCircle.strokeCircle(0, 0, 18);
    backBtn.add(backCircle);

    const backText = this.add.text(0, 0, '←', {
      fontSize: `${20 * s}px`,
      fontFamily: fonts.tech,
      color: hexToString(colors.uiAccent),
      fontStyle: 'bold',
    }).setOrigin(0.5);
    backBtn.add(backText);

    backBtn.setSize(36, 36);
    backBtn.setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.handleBack());

    this.add
      .text(width / 2, 28 + this.topInset, '✦ ЗАДАНИЯ ✦', {
        fontSize: `${16 * s}px`,
        fontFamily: fonts.tech,
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(101);

    this.add
      .text(width / 2, 48 + this.topInset, 'Путь · Ежедневные · Неделя · Battle Pass', {
        fontSize: `${9 * s}px`,
        fontFamily: fonts.tech,
        color: hexToString(colors.uiAccent),
      })
      .setOrigin(0.5)
      .setDepth(101);

    const currencyY = 72 + this.topInset;
    const currBg = this.add.graphics().setDepth(100);
    currBg.fillStyle(0x1a1a2e, 0.8);
    currBg.fillRoundedRect(width / 2 - 100, currencyY - 12, 200, 24, 12);
    
    // Монеты
    const coinsIcon = this.add.image(width / 2 - 85, currencyY, 'ui_rewards_coins');
    coinsIcon.setDisplaySize(14, 14);
    coinsIcon.setOrigin(0, 0.5);
    coinsIcon.setDepth(101);
    
    this.headerCoinText = this.add.text(width / 2 - 25, currencyY, `${data.coins}`, {
      fontSize: `${13 * s}px`,
      fontFamily: fonts.tech,
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(101);
    
    // Кристаллы
    const crystalsIcon = this.add.image(width / 2 + 15, currencyY, 'ui_rewards_crystals');
    crystalsIcon.setDisplaySize(14, 14);
    crystalsIcon.setOrigin(0, 0.5);
    crystalsIcon.setDepth(101);
    
    this.headerCrystalText = this.add.text(width / 2 + 85, currencyY, `${data.crystals}`, {
      fontSize: `${13 * s}px`,
      fontFamily: fonts.tech,
      color: '#ff00ff',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(101);
  }

  private refreshHeaderCurrency(): void {
    const data = playerData.get();
    this.headerCoinText?.setText(`${data.coins}`);
    this.headerCrystalText?.setText(`${data.crystals}`);
  }

  private clearContentArea(): void {
    this.scrollY = 0;
    this.scrollVelocity = 0;
    this.lastAppliedContentY = Number.NaN;
    if (this.contentContainer) {
      this.contentContainer.removeAll(true);
    }
  }

  /**
   * Маска в мировых координатах (как mask в ShopScene), иначе при скролле «окно» уезжает
   * вместе с контейнером и снизу остаётся пустая тёмная полоса и артефакты по краям.
   */
  private ensureContentScrollMask(): void {
    const { width, height } = this.cameras.main;
    const viewH = Math.max(40, height - this.topOffset - this.bottomInset);
    if (!this.contentScrollMask || !this.contentScrollMask.scene) {
      this.contentScrollMask = this.add.graphics();
      this.contentScrollMask.setDepth(2);
      this.contentScrollMask.setVisible(false);
    }
    this.contentScrollMask.clear();
    this.contentScrollMask.fillStyle(0xffffff, 1);
    this.contentScrollMask.fillRect(0, this.topOffset, width + 16, viewH);
    this.contentContainer.setMask(this.contentScrollMask.createGeometryMask());
  }

  /** Перерисовка без полного scene.restart — дешевле для WebView */
  private redrawQuestsUI(): void {
    if (!this.scene.isActive()) return;
    this.refreshHeaderCurrency();
    this.tabContainer?.destroy(true);
    this.clearContentArea();
    this.ensureContentScrollMask();
    this.createTabs();
    this.createContent();
    this.applyScrollPosition();
  }

  private switchTab(tabId: string): void {
    if (this.activeTab === tabId) return;
    this.activeTab = tabId as QuestsScene['activeTab'];
    this.tabContainer.destroy(true);
    this.clearContentArea();
    this.ensureContentScrollMask();
    this.createTabs();
    this.createContent();
    this.applyScrollPosition();
  }

  private createTabs(): void {
    const { width } = this.scale;
    const colors = getColors();
    const fonts = getFonts();

    const tabs: { id: string; label: string; badge?: number }[] = [
      { id: 'path', label: '🌟 ПУТЬ' },
      { id: 'daily', label: '📋 ДЕНЬ' },
      { id: 'weekly', label: '📅 НЕДЕЛЯ' },
      { id: 'battlepass', label: '🎫 PASS' },
    ];

    rookiePathManager.initialize();
    const rookieClaimable = rookiePathManager.getClaimableCount();
    const canClaimFinal = rookiePathManager.canClaimFinalReward();
    if (rookieClaimable > 0 || canClaimFinal) {
      tabs[0].badge = rookieClaimable + (canClaimFinal ? 1 : 0);
    }

    if (!rookiePathManager.shouldShowRookiePath()) {
      tabs.shift();
      if (this.activeTab === 'path') {
        this.activeTab = 'daily';
      }
    }

    const n = tabs.length;
    const margin = 12;
    const gap = 2;
    const tabW = (width - margin * 2 - gap * (n - 1)) / n;
    const tabH = 42;
    const y = 105 + this.topInset;

    this.tabContainer = this.add.container(0, 0).setDepth(89);

    const tabsBg = this.add.graphics()
      .fillStyle(0x000000, 0.5)
      .fillRoundedRect(10, y - 3, width - 20, tabH + 6, 22);
    this.tabContainer.add(tabsBg);

    tabs.forEach((tab, i) => {
      const x = margin + i * (tabW + gap);
      const isActive = this.activeTab === tab.id;

      const bg = this.add.graphics();
      if (isActive) {
        bg.fillStyle(colors.uiAccent, 1);
        bg.fillRoundedRect(x, y, tabW, tabH, 20);
        bg.lineStyle(2, 0xffffff, 0.6);
        bg.strokeRoundedRect(x, y, tabW, tabH, 20);
      } else {
        bg.fillStyle(0x050816, 0.9);
        bg.fillRoundedRect(x, y, tabW, tabH, 20);
        bg.lineStyle(1, 0x1f2937, 0.8);
        bg.strokeRoundedRect(x, y, tabW, tabH, 20);
      }
      this.tabContainer.add(bg);

      const tabText = this.add
        .text(x + tabW / 2, y + tabH / 2, tab.label, {
          fontSize: isActive ? '10px' : '9px',
          fontFamily: fonts.tech,
          color: isActive ? '#000000' : '#9ca3af',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      tabText.setResolution(2);
      this.tabContainer.add(tabText);

      let badgeCount = tab.badge ?? 0;
      if (tab.id === 'battlepass' && badgeCount === 0) {
        const unclaimed = battlePassManager.getUnclaimedCount();
        if (unclaimed > 0) badgeCount = unclaimed;
      }

      if (badgeCount > 0) {
        const bx = x + tabW - 6;
        const by = y + 8;
        const badgeG = this.add.graphics();
        badgeG.fillStyle(0xef4444, 1);
        badgeG.fillCircle(bx, by, 9);
        this.tabContainer.add(badgeG);
        this.tabContainer.add(
          this.add
            .text(bx, by, `${Math.min(badgeCount, 99)}`, {
              fontSize: '10px',
              fontFamily: fonts.tech,
              color: '#ffffff',
              fontStyle: 'bold',
            })
            .setOrigin(0.5)
        );
      }

      const hit = this.add
        .rectangle(x + tabW / 2, y + tabH / 2, tabW, tabH, 0, 0)
        .setInteractive({ useHandCursor: true });
      this.tabContainer.add(hit);

      hit.on('pointerdown', () => {
        if (this.activeTab !== tab.id) {
          AudioManager.getInstance().playUIClick();
          hapticSelection();
          this.switchTab(tab.id);
        }
      });
    });
  }
  
  private createContent(): void {
    const { width, height } = this.cameras.main;

    if (this.activeTab === 'path') {
      this.renderRookiePath();
    } else if (this.activeTab === 'battlepass') {
      this.renderBattlePassInfo();
    } else if (this.activeTab === 'weekly') {
      const weeklyData = dailyTasksManager.getWeeklyData();
      this.renderDailyWeeklyPathStyle(weeklyData.tasks, true);
    } else {
      const dailyData = dailyTasksManager.getDailyData();
      this.renderDailyWeeklyPathStyle(dailyData.tasks, false);
    }
  }

  private dailyQuestIcon(type: DailyTaskType): string {
    const m: Record<DailyTaskType, string> = {
      play_matches: '⚽',
      win_matches: '🏆',
      score_goals: '⚽',
      clean_sheets: '🛡️',
      complete_campaign: '📜',
      play_league: '🌟',
      play_tournament: '🏆',
      use_abilities: '✨',
    };
    return m[type] ?? '📋';
  }

  private dailyWeeklyQuestIcon(task: QuestRow, isWeekly: boolean): string {
    if (isWeekly && 'icon' in task && task.icon) return task.icon;
    if (!isWeekly && 'type' in task) return this.dailyQuestIcon(task.type as DailyTaskType);
    return '📋';
  }

  private formatDailyWeeklyRewardCompact(reward: QuestRow['reward']): string {
    const lines: string[] = [];
    if (reward.coins && reward.coins > 0) lines.push(`💰 ${reward.coins}`);
    if (reward.crystals && reward.crystals > 0) lines.push(`💎 ${reward.crystals}`);
    if (reward.xp && reward.xp > 0) lines.push(`⭐ ${reward.xp}`);
    if (reward.fragments && reward.fragments > 0) lines.push(`🧩 ${reward.fragments}`);
    return lines.join('\n') || '—';
  }

  /** Ежедневные / недельные — те же карточки 80px и кнопка «ЗАБРАТЬ», что у Пути новичка */
  private renderDailyWeeklyPathStyle(tasks: QuestRow[], isWeekly: boolean): void {
    const { width, height } = this.cameras.main;

    if (!tasks || tasks.length === 0) {
      console.warn(`[QuestsScene] No ${isWeekly ? 'weekly' : 'daily'} tasks found`);
      this.createEmptyState();
      this.maxScrollY = 0;
      return;
    }

    const sortedTasks = this.sortQuestRows(tasks);
    const cardWidth = Math.min(width - 40, 380);
    const cardX = width / 2;
    let y = 20;

    sortedTasks.forEach((task) => {
      const card = this.createDailyWeeklyTaskCard(cardX, y, cardWidth, task, isWeekly);
      this.contentContainer.add(card);
      y += 90;
    });

    const visibleHeight = height - this.topOffset - this.bottomInset;
    this.maxScrollY = Math.max(0, y - visibleHeight + 40);
  }

  private createDailyWeeklyTaskCard(
    x: number,
    y: number,
    width: number,
    task: QuestRow,
    isWeekly: boolean,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const cardH = 80;

    let bgColor = 0x1a1a2e;
    let borderColor = 0x374151;
    let opacity = 1;

    if (task.claimed) {
      borderColor = 0x38bdf8;
      opacity = 0.6;
    } else if (task.completed) {
      borderColor = 0x22c55e;
    }

    const bg = this.add.graphics();
    bg.fillStyle(bgColor, 0.9);
    bg.fillRoundedRect(-width / 2, 0, width, cardH, 10);
    bg.lineStyle(2, borderColor, opacity);
    bg.strokeRoundedRect(-width / 2, 0, width, cardH, 10);
    container.add(bg);

    const iconChar = this.dailyWeeklyQuestIcon(task, isWeekly);
    container.add(
      this.add
        .text(-width / 2 + 25, cardH / 2, iconChar, {
          fontSize: '24px',
        })
        .setOrigin(0.5),
    );

    container.add(
      this.add.text(-width / 2 + 55, 15, task.title, {
        fontSize: '14px',
        fontFamily: 'Orbitron, Arial',
        color: task.claimed ? '#888888' : '#ffffff',
        fontStyle: 'bold',
        wordWrap: { width: width - 170 },
        maxLines: 2,
      }).setOrigin(0, 0),
    );

    container.add(
      this.add.text(-width / 2 + 55, 35, task.description, {
        fontSize: '11px',
        fontFamily: 'Rajdhani, Arial',
        color: '#888888',
        wordWrap: { width: width - 170 },
        maxLines: 2,
      }).setOrigin(0, 0),
    );

    const progressStr = `${task.progress}/${task.maxProgress}`;
    const progressColor = task.completed ? '#22c55e' : '#a0a0a0';
    container.add(
      this.add.text(-width / 2 + 55, 55, progressStr, {
        fontSize: '12px',
        fontFamily: 'Rajdhani, Arial',
        color: progressColor,
        fontStyle: 'bold',
      }).setOrigin(0, 0),
    );

    const rewardX = width / 2 - 80;
    container.add(
      this.add.text(rewardX, 20, this.formatDailyWeeklyRewardCompact(task.reward), {
        fontSize: '11px',
        fontFamily: 'Rajdhani, Arial',
        color: '#ffd700',
        align: 'right',
      }).setOrigin(1, 0),
    );

    if (task.completed && !task.claimed) {
      const btn = this.createRookieClaimButton(width / 2 - 50, cardH / 2, 70, 28, () => {
        if (isWeekly) {
          this.handleClaimWeeklyTask(task.id);
        } else {
          this.handleClaimTask(task.id);
        }
      });
      container.add(btn);
    } else if (task.claimed) {
      container.add(
        this.add
          .text(width / 2 - 20, cardH / 2, '✓', {
            fontSize: '20px',
            color: '#38bdf8',
          })
          .setOrigin(0.5),
      );
    }

    return container;
  }
  
  private createEmptyState(): void {
    this.contentContainer.add(
      this.add.text(this.cameras.main.width / 2, 120, 'Нет активных заданий', {
        fontSize: `${15 * this.s}px`,
        fontFamily: getFonts().primary,
        color: '#cbd5e1',
      }).setOrigin(0.5)
    );
  }

  private rewardSubtitleLines(reward: {
    coins?: number;
    crystals?: number;
    xp?: number;
    fragments?: number;
  }): string[] {
    const lines: string[] = [];
    if (reward.coins && reward.coins > 0) lines.push(`${reward.coins} монет`);
    if (reward.crystals && reward.crystals > 0) lines.push(`${reward.crystals} кристаллов`);
    if (reward.xp && reward.xp > 0) lines.push(`${reward.xp} опыта Battle Pass`);
    if (reward.fragments && reward.fragments > 0) lines.push(`${reward.fragments} фрагментов`);
    return lines;
  }

  private scheduleQuestsRestart(delayMs: number): void {
    this.time.delayedCall(delayMs, () => this.redrawQuestsUI());
  }

  private showClaimCelebration(category: string, detail: string): void {
    const { width, height } = this.cameras.main;
    const fonts = getFonts();
    const s = this.s;

    const root = this.add.container(width / 2, height * 0.4).setDepth(5000);

    const dim = this.add.rectangle(0, 0, width + 20, height + 20, 0x020617, 0.62);
    dim.setInteractive();
    root.add(dim);

    const panelW = Math.min(width - 40, 360);
    const panelH = 118 * s;
    const frame = this.add.graphics();
    frame.fillStyle(0x0f172a, 0.97);
    frame.fillRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 18 * s);
    frame.lineStyle(3, 0xffc857, 0.9);
    frame.strokeRoundedRect(-panelW / 2, -panelH / 2, panelW, panelH, 18 * s);
    frame.lineStyle(1, 0x22d3ee, 0.45);
    frame.strokeRoundedRect(-panelW / 2 + 3, -panelH / 2 + 3, panelW - 6, panelH - 6, 15 * s);
    root.add(frame);

    const shine = this.add.graphics();
    shine.fillStyle(0xfbbf24, 0.08);
    shine.fillCircle(0, -panelH * 0.22, panelW * 0.32);
    root.add(shine);

    root.add(
      this.add
        .text(0, -26 * s, category.toUpperCase(), {
          fontFamily: fonts.tech,
          fontSize: `${13 * s}px`,
          color: '#fde68a',
          fontStyle: 'bold',
          letterSpacing: 1.5,
        })
        .setOrigin(0.5)
    );

    root.add(
      this.add
        .text(0, 10 * s, detail || 'Награда получена!', {
          fontFamily: fonts.primary,
          fontSize: `${17 * s}px`,
          color: '#f8fafc',
          align: 'center',
          fontStyle: 'bold',
          stroke: '#020617',
          strokeThickness: 5,
          wordWrap: { width: panelW - 28 },
        })
        .setOrigin(0.5)
    );

    root.setScale(0.88);
    this.tweens.add({
      targets: root,
      scale: 1,
      duration: 220,
      ease: 'Back.out',
    });

    this.time.delayedCall(780, () => {
      if (!root.active) return;
      this.tweens.add({
        targets: root,
        alpha: 0,
        duration: 200,
        onComplete: () => root.destroy(true),
      });
    });
  }

  private handleClaimTask(taskId: string): void {
    const daily = dailyTasksManager.getDailyData();
    const task = daily.tasks.find((t) => t.id === taskId);
    const detail = task ? this.rewardSubtitleLines(task.reward).join('\n') : '';

    if (!dailyTasksManager.claimTaskReward(taskId)) return;

    AudioManager.getInstance().playSFX('sfx_cash', { volume: 0.78 });
    AudioManager.getInstance().playSFX('sfx_card_pop', { volume: 0.45 });
    this.refreshHeaderCurrency();
    this.showClaimCelebration('Задание выполнено', detail);
    this.scheduleQuestsRestart(1020);
  }

  private handleClaimWeeklyTask(taskId: string): void {
    const weekly = dailyTasksManager.getWeeklyData();
    const task = weekly.tasks.find((t) => t.id === taskId);
    const detail = task ? this.rewardSubtitleLines(task.reward as any).join('\n') : '';

    if (!dailyTasksManager.claimWeeklyTaskReward(taskId)) return;

    AudioManager.getInstance().playSFX('sfx_cash', { volume: 0.78 });
    AudioManager.getInstance().playSFX('sfx_card_pop', { volume: 0.45 });
    this.refreshHeaderCurrency();
    this.showClaimCelebration('Недельное задание', detail);
    this.scheduleQuestsRestart(1020);
  }
  
  private renderBattlePassInfo(): void {
    const { width } = this.scale;
    const s = this.s;
    const fonts = getFonts();
    const season = getCurrentSeason();
    const progress = battlePassManager.getProgress();
    const xpInfo = getXPProgress(progress.currentXP, progress.currentTier);
    
    let y = 20 * s;
    
    // Заголовок
    const header = this.add.container(width / 2, y);
    header.add(this.add.text(0, 0, `🎫 ${season.name}`, {
      fontSize: `${18 * s}px`, fontFamily: fonts.tech, color: '#a855f7',
    }).setOrigin(0.5));
    this.contentContainer.add(header);
    
    y += 50 * s;
    
    // Прогресс
    const progressCard = this.add.container(width / 2, y);
    const cardBg = this.add.graphics();
    cardBg.fillGradientStyle(0x111b2e, 0x141e35, 0x0c1220, 0x0c1220, 1, 1, 1, 1);
    cardBg.fillRoundedRect(-(width - 40 * s) / 2, -40 * s, width - 40 * s, 80 * s, 12 * s);
    cardBg.lineStyle(2, 0xfbbf24, 0.75);
    cardBg.strokeRoundedRect(-(width - 40 * s) / 2, -40 * s, width - 40 * s, 80 * s, 12 * s);
    cardBg.lineStyle(1, 0x22d3ee, 0.4);
    cardBg.strokeRoundedRect(-(width - 40 * s) / 2 + 2, -38 * s, width - 40 * s - 4, 76 * s, 10 * s);
    progressCard.add(cardBg);
    
    progressCard.add(this.add.text(0, -20 * s, 'ТЕКУЩИЙ ПРОГРЕСС', {
      fontSize: `${11 * s}px`, fontFamily: fonts.tech, color: '#64748b',
    }).setOrigin(0.5));
    
    progressCard.add(this.add.text(0, 10 * s, `Tier ${progress.currentTier} / ${season.maxTier}`, {
      fontSize: `${20 * s}px`, fontFamily: fonts.tech, color: '#ffffff',
    }).setOrigin(0.5));
    
    this.contentContainer.add(progressCard);
    
    y += 110 * s;
    
    // ✅ ДОБАВЛЕНО: Прогресс-бар XP
    const barWidth = width - 60 * s;
    const barHeight = 20 * s;
    const barX = 30 * s;
    const barY = y;
    
    // Фон прогресс-бара
    const barBg = this.add.graphics();
    barBg.fillStyle(0x1f2937, 0.8);
    barBg.fillRoundedRect(barX, barY, barWidth, barHeight, 10 * s);
    barBg.lineStyle(2, 0x374151, 1);
    barBg.strokeRoundedRect(barX, barY, barWidth, barHeight, 10 * s);
    this.contentContainer.add(barBg);
    
    // Заполнение прогресс-бара
    const fillWidth = barWidth * xpInfo.progress;
    if (fillWidth > 0) {
      const barFill = this.add.graphics();
      barFill.fillStyle(0x00d4ff, 1);
      barFill.fillRoundedRect(barX + 2, barY + 2, fillWidth - 4, barHeight - 4, 8 * s);
      this.contentContainer.add(barFill);
    }
    
    // Текст прогресса
    this.contentContainer.add(this.add.text(barX + barWidth / 2, barY + barHeight / 2, 
      `${xpInfo.current} / ${xpInfo.needed} XP`, {
      fontSize: `${12 * s}px`,
      fontFamily: fonts.primary,
      color: '#ffffff',
      stroke: '#000',
      strokeThickness: 1
    }).setOrigin(0.5));
    
    y += 40 * s;
    
    // Способы получения XP
    const xpTitle = this.add.text(20 * s, y, '⭐ СПОСОБЫ ПОЛУЧЕНИЯ XP', {
      fontSize: `${12 * s}px`, fontFamily: fonts.tech, color: '#94a3b8',
    });
    this.contentContainer.add(xpTitle);
    
    y += 30 * s;
    
    const xpMethods = [
      { label: 'Победа в матче', xp: BP_XP_REWARDS.MATCH_WIN },
      { label: 'Поражение в матче', xp: BP_XP_REWARDS.MATCH_LOSS },
      { label: 'Ничья', xp: BP_XP_REWARDS.MATCH_DRAW },
      { label: 'Забитый гол', xp: BP_XP_REWARDS.GOAL_SCORED },
      { label: 'Сухой матч (победа)', xp: BP_XP_REWARDS.CLEAN_SHEET },
    ];
    
    xpMethods.forEach((method, index) => {
      const methodY = y + index * 30 * s;
      
      this.contentContainer.add(this.add.text(30 * s, methodY, method.label, {
        fontSize: `${12 * s}px`, fontFamily: fonts.primary, color: '#94a3b8',
      }));
      
      this.contentContainer.add(this.add.text(width - 30 * s, methodY, `+${method.xp} XP`, {
        fontSize: `${12 * s}px`, fontFamily: fonts.tech, color: '#38bdf8',
      }).setOrigin(1, 0));
    });
    
    y += xpMethods.length * 30 * s + 40 * s;
    
    // Кнопка
    const goBtn = this.add.container(width / 2, y);
    
    const btnBg = this.add.graphics();
    btnBg.fillGradientStyle(0xc084fc, 0xa855f7, 0x7c3aed, 0x5b21b6, 1);
    btnBg.fillRoundedRect(-100 * s, -22 * s, 200 * s, 44 * s, 22 * s);
    btnBg.lineStyle(2, 0xfde68a, 0.9);
    btnBg.strokeRoundedRect(-100 * s, -22 * s, 200 * s, 44 * s, 22 * s);
    goBtn.add(btnBg);
    
    goBtn.add(this.add.text(0, 0, '🎫 ОТКРЫТЬ BATTLE PASS', {
      fontSize: `${13 * s}px`, fontFamily: fonts.tech, color: '#ffffff',
    }).setOrigin(0.5));
    
    goBtn.setSize(200 * s, 44 * s);
    goBtn.setInteractive({ useHandCursor: true });
    goBtn.on('pointerdown', () => this.scene.start('BattlePassScene'));
    
    this.contentContainer.add(goBtn);
    
    // Обновляем maxScrollY
    const { height } = this.scale;
    const visibleHeight = height - this.topOffset - this.bottomInset;
    this.maxScrollY = Math.max(0, y + 50 * s - visibleHeight + 40);
  }

  private setupScrolling(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y < this.topOffset) return;
      
      this.isDragging = true;
      this.lastPointerY = pointer.y;
      this.scrollVelocity = 0;
    });
    
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      
      const delta = pointer.y - this.lastPointerY;
      this.scrollY = Phaser.Math.Clamp(this.scrollY - delta, 0, this.maxScrollY);
      this.lastPointerY = pointer.y;
      this.scrollVelocity = delta;
      
      this.applyScrollPosition();
    });
    
    this.input.on('pointerup', () => {
      this.isDragging = false;
    });
  }
  
  private applyScrollPosition(): void {
    if (!this.contentContainer) return;
    const y = this.topOffset - this.scrollY;
    if (this.lastAppliedContentY === y) return;
    this.lastAppliedContentY = y;
    this.contentContainer.y = y;
  }

  // ═══════════════════════════════════════════════════════════════
  // ROOKIE PATH RENDERING
  // ═══════════════════════════════════════════════════════════════

  private renderRookiePath(): void {
    const { width } = this.cameras.main;
    const cardWidth = Math.min(width - 40, 380);
    const cardX = width / 2;
    let y = 20;

    // Инициализируем менеджер
    rookiePathManager.initialize();
    rookiePathManager.updateAllProgress();

    const tasks = rookiePathManager.getTasks();
    const completedCount = rookiePathManager.getCompletedCount();
    const totalCount = rookiePathManager.getTotalCount();
    const pathCompleted = rookiePathManager.isPathCompleted();
    const canClaimFinal = rookiePathManager.canClaimFinalReward();

    // ═══════════════════════════════════════════════════════════════
    // ЗАГОЛОВОК С ПРОГРЕССОМ
    // ═══════════════════════════════════════════════════════════════
    
    const headerContainer = this.add.container(cardX, y);
    
    // Фон заголовка
    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x1e1e2e, 0.9);
    headerBg.fillRoundedRect(-cardWidth / 2, 0, cardWidth, 80, 12);
    headerBg.lineStyle(2, pathCompleted ? 0xffd700 : 0x6366f1, 1);
    headerBg.strokeRoundedRect(-cardWidth / 2, 0, cardWidth, 80, 12);
    headerContainer.add(headerBg);

    // Заголовок
    const title = this.add.text(0, 15, '🌟 ПУТЬ НОВИЧКА 🌟', {
      fontSize: '18px',
      fontFamily: 'Orbitron, Arial',
      color: pathCompleted ? '#ffd700' : '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    headerContainer.add(title);

    // Прогресс текст
    const progressText = this.add.text(0, 42, `Прогресс: ${completedCount}/${totalCount}`, {
      fontSize: '14px',
      fontFamily: 'Rajdhani, Arial',
      color: '#a0a0a0',
    }).setOrigin(0.5);
    headerContainer.add(progressText);

    // Прогресс бар
    const barWidth = cardWidth - 40;
    const barHeight = 8;
    const barX = -barWidth / 2;
    const barY = 62;
    
    headerBg.fillStyle(0x374151, 1);
    headerBg.fillRoundedRect(barX, barY, barWidth, barHeight, 4);
    
    const progress = completedCount / totalCount;
    if (progress > 0) {
      headerBg.fillStyle(pathCompleted ? 0xffd700 : 0x6366f1, 1);
      headerBg.fillRoundedRect(barX, barY, barWidth * progress, barHeight, 4);
    }

    this.contentContainer.add(headerContainer);
    y += 100;

    // ═══════════════════════════════════════════════════════════════
    // ГЛАВНАЯ НАГРАДА (показываем всегда)
    // ═══════════════════════════════════════════════════════════════
    
    const rewardCard = this.createFinalRewardCard(cardX, y, cardWidth, pathCompleted, canClaimFinal);
    this.contentContainer.add(rewardCard);
    y += 140;

    // ═══════════════════════════════════════════════════════════════
    // ЗАДАНИЯ
    // ═══════════════════════════════════════════════════════════════
    
    // Сортировка: можно забрать → в процессе → забрано
    const sortedTasks = [...tasks].sort((a, b) => {
      const stateA = a.claimed ? 2 : (a.completed ? 0 : 1);
      const stateB = b.claimed ? 2 : (b.completed ? 0 : 1);
      return stateA - stateB;
    });

    sortedTasks.forEach((task) => {
      const card = this.createRookieTaskCard(cardX, y, cardWidth, task);
      this.contentContainer.add(card);
      y += 90;
    });

    // Обновляем высоту контента для скролла
    const { height } = this.cameras.main;
    const visibleHeight = height - this.topOffset - this.bottomInset;
    this.maxScrollY = Math.max(0, y - visibleHeight + 40);
  }

  private createRookieTaskCard(
    x: number, 
    y: number, 
    width: number, 
    task: any
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const height = 80;

    // Определяем цвета по состоянию
    let bgColor = 0x1a1a2e;
    let borderColor = 0x374151;
    let opacity = 1;

    if (task.claimed) {
      borderColor = 0x38bdf8; // Синий - забрано
      opacity = 0.6;
    } else if (task.completed) {
      borderColor = 0x22c55e; // Зелёный - можно забрать
    }

    // Фон
    const bg = this.add.graphics();
    bg.fillStyle(bgColor, 0.9);
    bg.fillRoundedRect(-width / 2, 0, width, height, 10);
    bg.lineStyle(2, borderColor, opacity);
    bg.strokeRoundedRect(-width / 2, 0, width, height, 10);
    container.add(bg);

    // Иконка
    const icon = this.add.text(-width / 2 + 25, height / 2, task.icon, {
      fontSize: '24px',
    }).setOrigin(0.5);
    container.add(icon);

    // Заголовок
    const title = this.add.text(-width / 2 + 55, 15, task.title, {
      fontSize: '14px',
      fontFamily: 'Orbitron, Arial',
      color: task.claimed ? '#888888' : '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0, 0);
    container.add(title);

    // Описание
    const desc = this.add.text(-width / 2 + 55, 35, task.description, {
      fontSize: '11px',
      fontFamily: 'Rajdhani, Arial',
      color: '#888888',
    }).setOrigin(0, 0);
    container.add(desc);

    // Прогресс
    const progressStr = `${task.progress}/${task.maxProgress}`;
    const progressColor = task.completed ? '#22c55e' : '#a0a0a0';
    const progressText = this.add.text(-width / 2 + 55, 55, progressStr, {
      fontSize: '12px',
      fontFamily: 'Rajdhani, Arial',
      color: progressColor,
      fontStyle: 'bold',
    }).setOrigin(0, 0);
    container.add(progressText);

    // Награды (справа)
    const rewardX = width / 2 - 80;
    const rewardText = this.add.text(rewardX, 20, 
      `💰 ${task.reward.coins}\n💎 ${task.reward.crystals}`, {
      fontSize: '11px',
      fontFamily: 'Rajdhani, Arial',
      color: '#ffd700',
      align: 'right',
    }).setOrigin(1, 0);
    container.add(rewardText);

    // Кнопка "ЗАБРАТЬ" или статус
    if (task.completed && !task.claimed) {
      const btn = this.createRookieClaimButton(width / 2 - 50, height / 2, 70, 28, () => {
        if (!rookiePathManager.claimTaskReward(task.id)) return;
        const detail = this.rewardSubtitleLines(task.reward).join('\n');
        AudioManager.getInstance().playSFX('sfx_cash', { volume: 0.78 });
        AudioManager.getInstance().playSFX('sfx_card_pop', { volume: 0.45 });
        this.showClaimCelebration('Путь новичка', detail || 'Награда получена');
        this.scheduleQuestsRestart(1020);
      });
      container.add(btn);
    } else if (task.claimed) {
      const claimed = this.add.text(width / 2 - 20, height / 2, '✓', {
        fontSize: '20px',
        color: '#38bdf8',
      }).setOrigin(0.5);
      container.add(claimed);
    }

    return container;
  }

  private createFinalRewardCard(
    x: number,
    y: number,
    width: number,
    pathCompleted: boolean,
    canClaim: boolean
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const height = 120;

    // Фон с градиентом
    const bg = this.add.graphics();
    
    if (canClaim) {
      // Золотой градиент если можно забрать
      bg.fillGradientStyle(0xffd700, 0xffd700, 0xb8860b, 0xb8860b, 1);
    } else if (rookiePathManager.isRewardClaimed()) {
      // Серый если уже забрано
      bg.fillStyle(0x2a2a3e, 0.9);
    } else {
      // Тёмный фиолетовый пока в процессе
      bg.fillStyle(0x1e1e3e, 0.9);
    }
    
    bg.fillRoundedRect(-width / 2, 0, width, height, 12);
    bg.lineStyle(2, canClaim ? 0xffd700 : 0x6366f1, 1);
    bg.strokeRoundedRect(-width / 2, 0, width, height, 12);
    container.add(bg);

    // Заголовок
    const titleText = canClaim ? '🎁 ЗАБЕРИ НАГРАДУ! 🎁' : '🎁 ГЛАВНАЯ НАГРАДА';
    const title = this.add.text(0, 18, titleText, {
      fontSize: '16px',
      fontFamily: 'Orbitron, Arial',
      color: canClaim ? '#1a1a2e' : '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(title);

    // Описание награды
    const rewardDesc = this.add.text(0, 45, 
      `Вторая фракция на выбор (колесо)\n+${ROOKIE_PATH_FINAL_REWARD.coins} 💰  +${ROOKIE_PATH_FINAL_REWARD.crystals} 💎`, {
      fontSize: '12px',
      fontFamily: 'Rajdhani, Arial',
      color: canClaim ? '#1a1a2e' : '#cccccc',
      align: 'center',
    }).setOrigin(0.5);
    container.add(rewardDesc);

    // Кнопка или статус
    if (canClaim) {
      const btn = this.createRookieClaimButton(0, 90, 155, 32, () => {
        this.showFactionSelectionOverlay();
      }, 'КОЛЕСО ФРАКЦИЙ');
      container.add(btn);
    } else if (rookiePathManager.isRewardClaimed()) {
      const claimed = this.add.text(0, 90, '✓ Награда получена', {
        fontSize: '12px',
        fontFamily: 'Rajdhani, Arial',
        color: '#38bdf8',
      }).setOrigin(0.5);
      container.add(claimed);
    } else {
      // Прогресс до награды
      const remaining = rookiePathManager.getTotalCount() - rookiePathManager.getCompletedCount();
      const hint = this.add.text(0, 90, `Осталось заданий: ${remaining}`, {
        fontSize: '12px',
        fontFamily: 'Rajdhani, Arial',
        color: '#888888',
      }).setOrigin(0.5);
      container.add(hint);
    }

    return container;
  }

  private createRookieClaimButton(
    x: number, 
    y: number, 
    width: number, 
    height: number, 
    onClick: () => void,
    label: string = 'ЗАБРАТЬ'
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillGradientStyle(0xfff1b8, 0xffc24a, 0xf59e0b, 0xb45309, 1);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 8);
    bg.lineStyle(2, 0xfffbeb, 0.9);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 8);
    container.add(bg);

    const text = this.add.text(0, 0, label, {
      fontSize: '11px',
      fontFamily: getFonts().tech,
      color: '#1a0f08',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(text);

    const hitArea = this.add.rectangle(0, 0, width, height, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerdown', onClick);
    hitArea.on('pointerover', () => bg.setAlpha(0.8));
    hitArea.on('pointerout', () => bg.setAlpha(1));

    return container;
  }

  private showFactionSelectionOverlay(): void {
    const currentFaction = playerData.getFaction();

    const availableFactions: FactionId[] = ['magma', 'cyborg', 'void', 'insect'].filter(
      (f) => f !== currentFaction
    ) as FactionId[];

    new RookieFactionWheelOverlay(this, availableFactions, (chosenFaction: FactionId) => {
      if (rookiePathManager.claimFinalReward(chosenFaction)) {
        this.showSuccessMessage(chosenFaction);
        this.time.delayedCall(2000, () => {
          this.redrawQuestsUI();
        });
      }
    });
  }

  private showSimpleFactionSelection(availableFactions: FactionId[]): void {
    const { width, height } = this.cameras.main;
    
    // Простой оверлей с кнопками выбора фракции
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
      .setDepth(2000)
      .setInteractive();
    
    const container = this.add.container(width / 2, height / 2).setDepth(2001);
    
    const title = this.add.text(0, -200, 'ВЫБЕРИ ФРАКЦИЮ', {
      fontSize: '24px',
      fontFamily: 'Orbitron, Arial',
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(title);
    
    const desc = this.add.text(0, -160, 'Награда за завершение Пути Новичка', {
      fontSize: '14px',
      fontFamily: 'Rajdhani, Arial',
      color: '#cccccc',
    }).setOrigin(0.5);
    container.add(desc);
    
    // Кнопки фракций
    availableFactions.forEach((factionId, index) => {
      const btnY = -50 + index * 80;
      const btn = this.add.container(0, btnY);
      
      const btnBg = this.add.graphics();
      btnBg.fillStyle(0x1e293b, 0.9);
      btnBg.fillRoundedRect(-120, -30, 240, 60, 12);
      btnBg.lineStyle(2, 0x6366f1, 1);
      btnBg.strokeRoundedRect(-120, -30, 240, 60, 12);
      btn.add(btnBg);
      
      const btnText = this.add.text(0, 0, factionId.toUpperCase(), {
        fontSize: '18px',
        fontFamily: 'Orbitron, Arial',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      btn.add(btnText);
      
      const hitArea = this.add.rectangle(0, 0, 240, 60, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      btn.add(hitArea);
      
      hitArea.on('pointerdown', () => {
        if (rookiePathManager.claimFinalReward(factionId)) {
          AudioManager.getInstance().playSFX('sfx_cash');
          overlay.destroy();
          container.destroy();
          this.showSuccessMessage(factionId);
          this.time.delayedCall(2000, () => {
            this.redrawQuestsUI();
          });
        }
      });
      
      container.add(btn);
    });
  }

  private showSuccessMessage(faction: FactionId): void {
    const { width, height } = this.cameras.main;
    
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
      .setDepth(100);
    
    const message = this.add.text(width / 2, height / 2, 
      `🎉 Поздравляем!\n\nФракция ${faction.toUpperCase()} разблокирована!\n\n+${ROOKIE_PATH_FINAL_REWARD.coins} 💰\n+${ROOKIE_PATH_FINAL_REWARD.crystals} 💎`, {
      fontSize: '20px',
      fontFamily: 'Orbitron, Arial',
      color: '#ffd700',
      align: 'center',
    }).setOrigin(0.5).setDepth(101);

    this.tweens.add({
      targets: [overlay, message],
      alpha: { from: 0, to: 1 },
      duration: 500,
    });
  }
}
