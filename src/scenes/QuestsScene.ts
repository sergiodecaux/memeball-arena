// QuestsScene.ts - Простая сцена ежедневных заданий (по образцу ShopScene/TeamScene)

import Phaser from 'phaser';
import { playerData } from '../data/PlayerData';
import { AudioManager } from '../managers/AudioManager';
import { tgApp } from '../utils/TelegramWebApp';
import { dailyTasksManager, DailyTask } from '../data/DailyTasks';
import { SwipeNavigationManager } from '../ui/SwipeNavigationManager';
import { battlePassManager } from '../managers/BattlePassManager';
import { getCurrentSeason, BP_XP_REWARDS, getXPProgress } from '../data/BattlePassData';
import { getFonts } from '../config/themes';
import { rookiePathManager, ROOKIE_PATH_FINAL_REWARD } from '../data/RookiePath';
import { FactionId } from '../constants/gameConstants';
import { RookieFactionRewardOverlay } from '../ui/RookieFactionRewardOverlay';
import { ensureSafeImageLoading } from '../assets/loading/ImageLoader';
import { loadAudioMenu, loadAudioRewardClaim } from '../assets/loading/AudioLoader';

interface TaskCard {
  container: Phaser.GameObjects.Container;
  y: number;
  height: number;
}

export class QuestsScene extends Phaser.Scene {
  private scrollY = 0;
  private maxScrollY = 0;
  private contentContainer!: Phaser.GameObjects.Container;
  private cards: TaskCard[] = [];
  private isDragging = false;
  private lastPointerY = 0;
  private scrollVelocity = 0;
  
  private topInset = 0;
  private bottomInset = 0;
  private headerHeight = 110;
  private topOffset = 0;
  private swipeManager?: SwipeNavigationManager;
  
  private activeTab: 'path' | 'daily' | 'weekly' | 'battlepass' = 'path';
  private tabContainer!: Phaser.GameObjects.Container;
  private s!: number;
  
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
    this.createContent();
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
  }
  
  update(): void {
    if (!this.isDragging && Math.abs(this.scrollVelocity) > 0.5) {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + this.scrollVelocity, 0, this.maxScrollY);
      this.scrollVelocity *= 0.92;
      this.updateCardPositions();
    }
  }
  
  private handleBack(): void {
    AudioManager.getInstance().playUIClick();
    this.scene.start('MainMenuScene');
  }
  
  private createBackground(): void {
    const { width, height } = this.cameras.main;

    const base = Math.max(width, height);
    this.add.rectangle(width / 2, height / 2, width + 16, height + 16, 0x090f1f, 1);

    const blobs = this.add.graphics();
    blobs.fillStyle(0x8b5cf6, 0.11);
    blobs.fillCircle(-base * 0.02, height * 0.12, base * 0.52);
    blobs.fillStyle(0x06b6d4, 0.09);
    blobs.fillCircle(width + base * 0.06, height * 0.36, base * 0.48);
    blobs.fillStyle(0xfbbf24, 0.045);
    blobs.fillCircle(width * 0.45, height * 0.92, base * 0.35);
    blobs.setBlendMode(Phaser.BlendModes.ADD);

    this.add.rectangle(width / 2, height - 72, width, 160, 0x000000, 0.35);
  }
  
  private createHeader(): void {
    const { width } = this.cameras.main;
    const data = playerData.get();
    const fonts = getFonts();
    const s = this.s;
    
    this.headerHeight = 95 + this.topInset;
    // Обновляем topOffset для табов
    this.topOffset = this.headerHeight + 50 * this.s;
    
    // Фон header
    const hdr = this.add.graphics().setDepth(100);
    hdr.fillGradientStyle(0x0a0f22, 0x0f1628, 0x080c18, 0x080c18, 0.94, 0.94, 0.94, 0.94);
    hdr.fillRect(0, 0, width, this.headerHeight);
    hdr.fillStyle(0xfbbf24, 0.06);
    hdr.fillRect(0, 0, width, Math.min(this.headerHeight, 72 + this.topInset));
    hdr.lineStyle(3, 0xffc857, 0.45);
    hdr.lineBetween(0, this.headerHeight, width, this.headerHeight);
    hdr.lineStyle(1, 0x06b6d4, 0.25);
    hdr.lineBetween(0, this.headerHeight - 2, width, this.headerHeight - 2);
    
    // Кнопка назад
    const backBtn = this.add.container(20, 28 + this.topInset).setDepth(101);
    const backCircle = this.add.graphics();
    backCircle.fillStyle(0x1f2937, 0.9);
    backCircle.fillCircle(0, 0, 18);
    backCircle.lineStyle(1, 0x38bdf8, 0.6);
    backCircle.strokeCircle(0, 0, 18);
    backBtn.add(backCircle);
    
    const backText = this.add.text(0, 0, '←', {
      fontSize: `${22 * s}px`,
      fontFamily: fonts.primary,
      color: '#fffbeb',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    backBtn.add(backText);
    
    backBtn.setSize(36, 36);
    backBtn.setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => this.handleBack());
    
    // Заголовок
    this.add.text(width / 2, 28 + this.topInset, 'ЗАДАНИЯ', {
      fontSize: `${19 * s}px`,
      fontFamily: fonts.tech,
      color: '#fff6dc',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5).setDepth(101);
    
    this.add.text(width / 2, 49 + this.topInset, 'Путь · Ежедневные · Недельный пропуск', {
      fontSize: `${11 * s}px`,
      fontFamily: fonts.primary,
      color: '#bae6fd',
    }).setOrigin(0.5).setDepth(101);
    
    // Валюта
    const currencyY = 72 + this.topInset;
    const currBg = this.add.graphics().setDepth(100);
    currBg.fillStyle(0x1a1a2e, 0.8);
    currBg.fillStyle(0x1e293b, 0.85);
    currBg.fillRoundedRect(width / 2 - 100, currencyY - 12, 200, 24, 12);
    currBg.lineStyle(1, 0xfbbf24, 0.35);
    currBg.strokeRoundedRect(width / 2 - 100, currencyY - 12, 200, 24, 12);
    
    // Монеты
    const coinsIcon = this.add.image(width / 2 - 85, currencyY, 'ui_rewards_coins');
    coinsIcon.setDisplaySize(14, 14);
    coinsIcon.setOrigin(0, 0.5);
    coinsIcon.setDepth(101);
    
    this.add.text(width / 2 - 25, currencyY, `${data.coins}`, {
      fontSize: `${13 * s}px`,
      fontFamily: fonts.tech,
      color: '#fde68a',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(101);
    
    // Кристаллы
    const crystalsIcon = this.add.image(width / 2 + 15, currencyY, 'ui_rewards_crystals');
    crystalsIcon.setDisplaySize(14, 14);
    crystalsIcon.setOrigin(0, 0.5);
    crystalsIcon.setDepth(101);
    
    this.add.text(width / 2 + 85, currencyY, `${data.crystals}`, {
      fontSize: `${13 * s}px`,
      fontFamily: fonts.tech,
      color: '#e9d5ff',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(101);
  }

  private createTabs(): void {
    const { width } = this.scale;
    const s = this.s;
    const fonts = getFonts();
    
    const tabY = this.headerHeight + 5 * s;
    this.tabContainer = this.add.container(0, tabY).setDepth(100);
    
    const tabs: { id: string; label: string; icon: string; badge?: number }[] = [
      { id: 'path', label: 'ПУТЬ', icon: '🌟' },  // НОВАЯ ВКЛАДКА - ПЕРВАЯ!
      { id: 'daily', label: 'ЕЖЕДНЕВНЫЕ', icon: '📋' },
      { id: 'weekly', label: 'НЕДЕЛЬНЫЕ', icon: '📅' },
      { id: 'battlepass', label: 'BATTLE PASS', icon: '🎫' },
    ];

    // Добавляем бейдж для пути новичка если есть незабранные награды
    rookiePathManager.initialize();
    const rookieClaimable = rookiePathManager.getClaimableCount();
    const canClaimFinal = rookiePathManager.canClaimFinalReward();
    if (rookieClaimable > 0 || canClaimFinal) {
      tabs[0].badge = rookieClaimable + (canClaimFinal ? 1 : 0);
    }

    // Скрываем вкладку "ПУТЬ" если путь завершен и награда получена
    if (!rookiePathManager.shouldShowRookiePath()) {
      tabs.shift(); // Удаляем первую вкладку
      // Если активная вкладка была 'path', переключаемся на 'daily'
      if (this.activeTab === 'path') {
        this.activeTab = 'daily';
      }
    }
    
    const tabWidth = (width - 30 * s) / tabs.length;
    
    tabs.forEach((tab, index) => {
      const tabX = 15 * s + index * tabWidth + tabWidth / 2;
      const isActive = this.activeTab === tab.id;
      
      const tabBtn = this.add.container(tabX, 0);

      const bg = this.add.graphics();
      const tw = tabWidth - 6;
      const th = 34 * s;
      const bx = -tabWidth / 2 + 3;
      const by = -17 * s;
      bg.fillStyle(isActive ? 0x1a1528 : 0x0b1120, 1);
      bg.fillRoundedRect(bx, by, tw, th, 10 * s);
      if (isActive) {
        bg.lineStyle(2, 0xffc857, 0.95);
        bg.strokeRoundedRect(bx, by, tw, th, 10 * s);
        bg.lineStyle(1, 0x22d3ee, 0.5);
        bg.strokeRoundedRect(bx + 2, by + 2, tw - 4, th - 4, 8 * s);
      } else {
        bg.lineStyle(1, 0x334155, 0.65);
        bg.strokeRoundedRect(bx, by, tw, th, 10 * s);
      }
      tabBtn.add(bg);

      tabBtn.add(this.add.text(0, 0, `${tab.icon} ${tab.label}`, {
        fontSize: `${9 * s}px`,
        fontFamily: fonts.tech,
        color: isActive ? '#fff1c2' : '#94a3b8',
      }).setOrigin(0.5));
      
      // Бейдж для вкладок
      if (tab.badge && tab.badge > 0) {
        const badge = this.add.graphics();
        badge.fillStyle(0xef4444, 1);
        badge.fillCircle(tabWidth / 2 - 15 * s, -8 * s, 8 * s);
        tabBtn.add(badge);
        
        tabBtn.add(this.add.text(tabWidth / 2 - 15 * s, -8 * s, `${tab.badge}`, {
          fontSize: `${8 * s}px`, fontFamily: fonts.tech, color: '#ffffff',
        }).setOrigin(0.5));
      } else if (tab.id === 'battlepass') {
        const unclaimed = battlePassManager.getUnclaimedCount();
        if (unclaimed > 0) {
          const badge = this.add.graphics();
          badge.fillStyle(0xef4444, 1);
          badge.fillCircle(tabWidth / 2 - 15 * s, -8 * s, 8 * s);
          tabBtn.add(badge);
          
          tabBtn.add(this.add.text(tabWidth / 2 - 15 * s, -8 * s, `${unclaimed}`, {
            fontSize: `${8 * s}px`, fontFamily: fonts.tech, color: '#ffffff',
          }).setOrigin(0.5));
        }
      }
      
      tabBtn.setSize(tabWidth, 38 * s);
      tabBtn.setInteractive({ useHandCursor: true });
      tabBtn.on('pointerdown', () => {
        if (this.activeTab !== tab.id) {
          this.activeTab = tab.id as any;
          this.scene.restart({ tab: tab.id });
        }
      });
      
      this.tabContainer.add(tabBtn);
    });
  }
  
  private createContent(): void {
    const { width, height } = this.cameras.main;
    
    this.contentContainer = this.add.container(0, this.topOffset).setDepth(1);
    
    if (this.activeTab === 'path') {
      this.renderRookiePath();
    } else if (this.activeTab === 'battlepass') {
      this.renderBattlePassInfo();
    } else if (this.activeTab === 'weekly') {
      const weeklyData = dailyTasksManager.getWeeklyData();
      this.renderTasks(weeklyData.tasks as any[], true);
    } else {
      const dailyData = dailyTasksManager.getDailyData();
      this.renderTasks(dailyData.tasks as any[], false);
    }
  }

  private renderTasks(tasks: any[], isWeekly: boolean): void {
    const { width, height } = this.cameras.main;

    if (!tasks || tasks.length === 0) {
      console.warn(`[QuestsScene] No ${isWeekly ? 'weekly' : 'daily'} tasks found`);
      this.createEmptyState();
      return;
    }

    // Сортировка: CLAIMABLE -> IN_PROGRESS -> CLAIMED
    const sortedTasks = [...tasks].sort((a, b) => {
      const stateA = a.claimed ? 2 : (a.completed ? 0 : 1);
      const stateB = b.claimed ? 2 : (b.completed ? 0 : 1);
      return stateA - stateB;
    });

    this.cards = [];

    let y = 20;
    const cardWidth = Math.min(width - 32, 370);
    const cardX = width / 2;

    sortedTasks.forEach((task) => {
      const card = this.createTaskCard(cardX, y, cardWidth, task, isWeekly);
      this.contentContainer.add(card.container);
      this.cards.push(card);

      y += card.height + 16;
    });

    const visibleHeight = height - this.topOffset - this.bottomInset;
    this.maxScrollY = Math.max(0, y - visibleHeight + 40);
  }
  
  private createTaskCard(x: number, y: number, width: number, task: DailyTask, isWeekly: boolean = false): TaskCard {
    const fonts = getFonts();
    const container = this.add.container(x, y);
    const height = 150;
    const padding = 14;
    
    const isCompleted = task.completed;
    const isClaimed = task.claimed;
    const isClaimable = isCompleted && !isClaimed;
    
    // Фон карточки (тёмная панель + рамка статуса)
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x111b2e, 0x141e35, 0x0c1220, 0x0c1220, 0.98, 0.98, 0.98, 0.98);
    bg.fillRoundedRect(-width / 2, 0, width, height, 14);

    let borderColor = 0x334155;
    let borderAlpha = 0.65;

    if (isClaimable) {
      borderColor = 0xffc857;
      borderAlpha = 1;
    } else if (isClaimed) {
      borderColor = 0x38bdf8;
      borderAlpha = 0.65;
    }

    bg.lineStyle(2, borderColor, borderAlpha);
    bg.strokeRoundedRect(-width / 2, 0, width, height, 14);
    if (isClaimable) {
      bg.lineStyle(1, 0x22c55e, 0.65);
      bg.strokeRoundedRect(-width / 2 + 2, 2, width - 4, height - 4, 12);
    }
    container.add(bg);
    
    // Заголовок
    const title = this.add.text(-width / 2 + padding, padding, task.title, {
      fontSize: '16px',
      fontFamily: fonts.tech,
      color: '#fef9c3',
      fontStyle: 'bold',
      wordWrap: { width: width - padding * 2 - 24 },
    }).setOrigin(0, 0);
    container.add(title);
    
    // Описание
    const desc = this.add.text(-width / 2 + padding, padding + 24, task.description, {
      fontSize: '12px',
      fontFamily: fonts.primary,
      color: '#94a3b8',
      wordWrap: { width: width - padding * 2 },
    }).setOrigin(0, 0);
    container.add(desc);
    
    // Прогресс текст
    const progressText = this.add.text(-width / 2 + padding, padding + 48, `Прогресс: ${task.progress}/${task.maxProgress}`, {
      fontSize: '13px',
      fontFamily: fonts.primary,
      color: '#e2e8f0',
    }).setOrigin(0, 0);
    container.add(progressText);
    
    // Прогресс-бар
    const barWidth = width - padding * 2;
    const barHeight = 10;
    const barY = padding + 70;
    
    const barBg = this.add.graphics();
    barBg.fillStyle(0x1f2937, 0.8);
    barBg.fillRoundedRect(-width / 2 + padding, barY, barWidth, barHeight, 5);
    container.add(barBg);
    
    const progress = Math.min(task.progress / task.maxProgress, 1);
    const fillWidth = barWidth * progress;
    
    if (fillWidth > 0) {
      const barFill = this.add.graphics();
      barFill.fillStyle(isCompleted ? 0x34d399 : 0x22d3ee, 1);
      barFill.fillRoundedRect(-width / 2 + padding, barY, fillWidth, barHeight, 5);
      container.add(barFill);
    }
    
    // Награды
    const rewardY = barY + 24;
    let rewardX = -width / 2 + padding;
    
    const rewardLabel = this.add.text(rewardX, rewardY, 'Награды:', {
      fontSize: '12px',
      fontFamily: fonts.tech,
      color: '#fde68a',
    }).setOrigin(0, 0);
    container.add(rewardLabel);
    rewardX += 70;
    
    if (task.reward.coins) {
      const coinIcon = this.add.image(rewardX, rewardY + 8, 'ui_rewards_coins');
      coinIcon.setDisplaySize(18, 18);
      coinIcon.setOrigin(0, 0.5);
      container.add(coinIcon);
      
      const coinText = this.add.text(rewardX + 22, rewardY, `${task.reward.coins}`, {
        fontSize: '14px',
        fontFamily: fonts.tech,
        color: '#fcd34d',
        fontStyle: 'bold',
      }).setOrigin(0, 0);
      container.add(coinText);
      rewardX += 80;
    }
    
    if (task.reward.crystals) {
      const crystalIcon = this.add.image(rewardX, rewardY + 8, 'ui_rewards_crystals');
      crystalIcon.setDisplaySize(18, 18);
      crystalIcon.setOrigin(0, 0.5);
      container.add(crystalIcon);
      
      const crystalText = this.add.text(rewardX + 22, rewardY, `${task.reward.crystals}`, {
        fontSize: '14px',
        fontFamily: fonts.tech,
        color: '#ddd6fe',
        fontStyle: 'bold',
      }).setOrigin(0, 0);
      container.add(crystalText);
    }
    
    // Кнопка
    const btnY = height - padding - 16;
    const btnWidth = 110;
    const btnHeight = 36;
    const btnX = width / 2 - padding - btnWidth / 2;
    
    if (isClaimable) {
      const btn = this.createClaimButton(btnX, btnY, btnWidth, btnHeight, () => {
        if (isWeekly) this.handleClaimWeeklyTask(task.id);
        else this.handleClaimTask(task.id);
      });
      container.add(btn);
    } else if (isClaimed) {
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x1e293b, 0.82);
    btnBg.fillRoundedRect(btnX - btnWidth / 2, btnY - btnHeight / 2, btnWidth, btnHeight, 999);
      container.add(btnBg);
      
      const btnText = this.add.text(btnX, btnY, 'ЗАБРАНО', {
        fontSize: '12px',
        fontFamily: fonts.tech,
        color: '#94a3b8',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      container.add(btnText);
    }
    
    // ВАЖНО: Устанавливаем ТОЧНУЮ область нажатия для карточки
    const cardHitArea = new Phaser.Geom.Rectangle(-width / 2, 0, width, height);
    container.setInteractive(cardHitArea, Phaser.Geom.Rectangle.Contains);
    
    return { container, y, height };
  }
  
  private createClaimButton(
    x: number,
    y: number,
    width: number,
    height: number,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const btn = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillGradientStyle(0xfff1b8, 0xffc24a, 0xf59e0b, 0xb45309, 1);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 999);
    bg.lineStyle(2, 0xfffbeb, 0.95);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 999);
    btn.add(bg);

    const text = this.add.text(0, 0, 'ЗАБРАТЬ', {
      fontSize: '13px',
      fontFamily: fonts.tech,
      color: '#1a0f08',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    btn.add(text);

    const hitArea = new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height);
    btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
    btn.setSize(width, height);
    btn.on('pointerdown', onClick);

    return btn;
  }
  
  private createEmptyState(): void {
    const { width, height } = this.cameras.main;

    this.add.text(width / 2, height / 2, 'Нет активных заданий', {
      fontSize: '16px',
      fontFamily: getFonts().primary,
      color: '#94a3b8',
    }).setOrigin(0.5).setDepth(10);
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
    this.time.delayedCall(delayMs, () => {
      if (!this.scene.isActive()) return;
      this.scene.restart({ tab: this.activeTab });
    });
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
    shine.fillStyle(0xfbbf24, 0.12);
    shine.fillCircle(0, -panelH * 0.22, panelW * 0.35);
    shine.setBlendMode(Phaser.BlendModes.ADD);
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
    this.tweens.add({
      targets: shine,
      alpha: 0.45,
      duration: 420,
      yoyo: true,
      repeat: 1,
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
      
      this.updateCardPositions();
    });
    
    this.input.on('pointerup', () => {
      this.isDragging = false;
    });
  }
  
  private updateCardPositions(): void {
    this.contentContainer.y = this.topOffset - this.scrollY;
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
      `Бесплатная вторая фракция!\n+${ROOKIE_PATH_FINAL_REWARD.coins} 💰  +${ROOKIE_PATH_FINAL_REWARD.crystals} 💎`, {
      fontSize: '12px',
      fontFamily: 'Rajdhani, Arial',
      color: canClaim ? '#1a1a2e' : '#cccccc',
      align: 'center',
    }).setOrigin(0.5);
    container.add(rewardDesc);

    // Кнопка или статус
    if (canClaim) {
      const btn = this.createRookieClaimButton(0, 90, 140, 32, () => {
        this.showFactionSelectionOverlay();
      }, 'ВЫБРАТЬ ФРАКЦИЮ');
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
    
    // Фракции доступные для выбора (все кроме текущей)
    const availableFactions: FactionId[] = ['magma', 'cyborg', 'void', 'insect']
      .filter(f => f !== currentFaction) as FactionId[];

    // Используем красивый overlay для выбора фракции
    const overlay = new RookieFactionRewardOverlay(
      this,
      availableFactions,
      (chosenFaction: FactionId) => {
        if (rookiePathManager.claimFinalReward(chosenFaction)) {
          // Показываем сообщение об успехе
          this.showSuccessMessage(chosenFaction);
          // Перезагружаем сцену
          this.time.delayedCall(2000, () => {
            this.scene.restart({ tab: 'path' });
          });
        }
      }
    );
    overlay.show();
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
            this.scene.restart({ tab: 'path' });
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
