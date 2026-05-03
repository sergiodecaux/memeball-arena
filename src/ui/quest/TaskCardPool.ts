// src/ui/quest/TaskCardPool.ts
// Пул переиспользуемых карточек заданий (daily / weekly)

import Phaser from 'phaser';
import type { DailyTask, WeeklyTask } from '../../data/DailyTasks';
import { getColors, getFonts } from '../../config/themes';

export type QuestRow = DailyTask | WeeklyTask;

export interface PooledTaskCard {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Graphics;
  iconText: Phaser.GameObjects.Text;
  titleText: Phaser.GameObjects.Text;
  descText: Phaser.GameObjects.Text;
  progressText: Phaser.GameObjects.Text;
  progressBar: Phaser.GameObjects.Graphics;
  progressBarFill: Phaser.GameObjects.Graphics;
  rewardText: Phaser.GameObjects.Text;
  claimBtn: Phaser.GameObjects.Container;
  claimedBadge: Phaser.GameObjects.Container;
  inUse: boolean;
}

export class TaskCardPool {
  private scene: Phaser.Scene;
  private pool: PooledTaskCard[] = [];
  private readonly poolSize: number;
  private cardWidth: number;
  private readonly getScale: () => number;

  constructor(scene: Phaser.Scene, cardWidth: number, getScale: () => number, poolSize = 12) {
    this.scene = scene;
    this.cardWidth = cardWidth;
    this.getScale = getScale;
    this.poolSize = poolSize;
    this.initializePool();
  }

  setCardWidth(w: number): void {
    this.cardWidth = w;
  }

  private initializePool(): void {
    const fonts = getFonts();
    const s = this.getScale();

    for (let i = 0; i < this.poolSize; i++) {
      const container = this.scene.add.container(0, 0).setVisible(false).setScrollFactor(1);

      const background = this.scene.add.graphics();
      const iconText = this.scene.add
        .text(0, 0, '', { fontSize: `${24 * s}px` })
        .setOrigin(0.5, 0.5)
        .setVisible(false);

      const titleText = this.scene.add.text(0, 0, '', {
        fontSize: `${15 * s}px`,
        fontFamily: fonts.tech,
        color: '#ffffff',
        fontStyle: 'bold',
        wordWrap: { width: this.cardWidth - 28 },
        maxLines: 2,
      });

      const descText = this.scene.add.text(0, 0, '', {
        fontSize: `${11 * s}px`,
        fontFamily: fonts.primary,
        color: '#9ca3af',
        wordWrap: { width: this.cardWidth - 28 },
        maxLines: 2,
      });

      const progressText = this.scene.add.text(0, 0, '', {
        fontSize: `${12 * s}px`,
        fontFamily: fonts.primary,
        color: '#d1d5db',
      });

      const progressBar = this.scene.add.graphics();
      const progressBarFill = this.scene.add.graphics();

      const rewardText = this.scene.add.text(0, 0, '', {
        fontSize: `${11 * s}px`,
        fontFamily: fonts.tech,
        color: '#ffd700',
        wordWrap: { width: this.cardWidth - 28 },
      });

      const claimBtn = this.buildClaimButton();
      const claimedBadge = this.buildClaimedBadge();
      claimBtn.setVisible(false);
      claimedBadge.setVisible(false);

      container.add([
        background,
        iconText,
        titleText,
        descText,
        progressText,
        progressBar,
        progressBarFill,
        rewardText,
        claimBtn,
        claimedBadge,
      ]);

      this.pool.push({
        container,
        background,
        iconText,
        titleText,
        descText,
        progressText,
        progressBar,
        progressBarFill,
        rewardText,
        claimBtn,
        claimedBadge,
        inUse: false,
      });
    }
  }

  private buildClaimButton(): Phaser.GameObjects.Container {
    const btn = this.scene.add.container(0, 0);
    const fonts = getFonts();
    const colors = getColors();
    const s = this.getScale();
    const bw = Math.round(118 * s);
    const bh = Math.round(34 * s);

    const bg = this.scene.add.graphics();
    bg.fillGradientStyle(colors.uiAccent, colors.uiAccent, colors.uiSecondary, colors.uiSecondary, 1, 1, 1, 1);
    bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 999);
    bg.lineStyle(2, 0xffffff, 0.75);
    bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 999);
    btn.add(bg);

    btn.add(
      this.scene.add
        .text(0, 0, 'ЗАБРАТЬ', {
          fontSize: `${13 * s}px`,
          fontFamily: fonts.tech,
          color: '#000000',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
    );

    const hitArea = new Phaser.Geom.Rectangle(-bw / 2, -bh / 2, bw, bh);
    btn.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
    btn.setSize(bw, bh);
    return btn;
  }

  private buildClaimedBadge(): Phaser.GameObjects.Container {
    const wrap = this.scene.add.container(0, 0);
    const fonts = getFonts();
    const s = this.getScale();
    const bw = Math.round(118 * s);
    const bh = Math.round(34 * s);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1e293b, 0.82);
    bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 999);
    wrap.add(bg);

    wrap.add(
      this.scene.add
        .text(0, 0, 'ЗАБРАНО', {
          fontSize: `${11 * s}px`,
          fontFamily: fonts.tech,
          color: '#94a3b8',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
    );
    return wrap;
  }

  acquire(): PooledTaskCard | null {
    const card = this.pool.find((c) => !c.inUse);
    if (!card) return null;
    card.inUse = true;
    card.container.setVisible(true);
    return card;
  }

  release(card: PooledTaskCard): void {
    card.claimBtn.removeAllListeners();
    card.claimBtn.disableInteractive();
    card.claimBtn.setVisible(false);
    card.claimedBadge.setVisible(false);
    card.iconText.setVisible(false);
    card.background.clear();
    card.progressBar.clear();
    card.progressBarFill.clear();
    card.inUse = false;
    card.container.setVisible(false);
    if (card.container.parentContainer) {
      card.container.parentContainer.remove(card.container, false);
    }
  }

  /**
   * @param x — центр карточки по X (как в QuestsScene)
   * @param y — верх карточки по Y в координатах contentContainer
   */
  updateCard(
    card: PooledTaskCard,
    task: QuestRow,
    x: number,
    y: number,
    isWeekly: boolean,
    onClaim: () => void
  ): void {
    const s = this.getScale();
    const colors = getColors();
    const width = this.cardWidth;
    const height = Math.round(160 * s);
    const padding = Math.round(14 * s);
    const iconCol =
      isWeekly && 'icon' in task && task.icon ? Math.round(34 * s) : 0;

    card.container.setPosition(x, y);

    const titleX = -width / 2 + padding + iconCol;

    // Фон и рамка (как карточки в ShopScene)
    const bg = card.background;
    bg.clear();
    const isCompleted = task.completed;
    const isClaimed = task.claimed;
    const isClaimable = isCompleted && !isClaimed;

    bg.fillStyle(0x0a0a15, 0.98);
    bg.fillRoundedRect(-width / 2, 0, width, height, 16);

    const borderColor = isClaimable ? colors.uiAccent : isClaimed ? 0x22c55e : 0x444455;
    const borderAlpha = isClaimable ? 1 : isClaimed ? 0.65 : 0.55;
    bg.lineStyle(2, borderColor, borderAlpha);
    bg.strokeRoundedRect(-width / 2, 0, width, height, 16);

    if (iconCol > 0 && 'icon' in task && task.icon) {
      card.iconText
        .setText(String(task.icon))
        .setPosition(-width / 2 + padding + iconCol / 2, padding + Math.round(20 * s))
        .setVisible(true);
    } else {
      card.iconText.setVisible(false);
    }

    card.titleText
      .setText(task.title)
      .setPosition(titleX, padding)
      .setStyle({ wordWrap: { width: width - padding * 2 - iconCol } });

    card.descText
      .setText(task.description)
      .setPosition(titleX, padding + Math.round(38 * s))
      .setStyle({ wordWrap: { width: width - padding * 2 - iconCol } });

    const progressLineY = padding + Math.round(62 * s);
    card.progressText
      .setText(`Прогресс: ${task.progress} / ${task.maxProgress}`)
      .setPosition(titleX, progressLineY);

    const barWidth = width - padding * 2;
    const barHeight = Math.max(8, Math.round(9 * s));
    const barY = progressLineY + Math.round(18 * s);

    card.progressBar.clear();
    card.progressBar.fillStyle(0x1f2937, 0.8);
    card.progressBar.fillRoundedRect(-width / 2 + padding, barY, barWidth, barHeight, 5);

    card.progressBarFill.clear();
    const progress = Math.min(task.progress / task.maxProgress, 1);
    const fillWidth = barWidth * progress;
    if (fillWidth > 0) {
      card.progressBarFill.fillStyle(isCompleted ? colors.uiAccent : 0x475569, 1);
      card.progressBarFill.fillRoundedRect(-width / 2 + padding, barY, fillWidth, barHeight, 5);
    }

    const rewardY = barY + barHeight + Math.round(14 * s);
    const rewardSummary = this.formatRewards(task.reward);
    card.rewardText
      .setText(`Награды: ${rewardSummary}`)
      .setPosition(-width / 2 + padding, rewardY)
      .setStyle({ wordWrap: { width: width - padding * 2 } });

    const btnY = height - padding - Math.round(18 * s);
    const btnW = Math.round(118 * s);
    const btnX = width / 2 - padding - btnW / 2;

    card.claimBtn.setPosition(btnX, btnY);
    card.claimedBadge.setPosition(btnX, btnY);

    card.claimBtn.removeAllListeners();
    card.claimBtn.disableInteractive();

    if (isClaimable) {
      card.claimBtn.setVisible(true);
      card.claimedBadge.setVisible(false);
      const halfW = btnW / 2;
      const halfH = Math.round(17 * s);
      card.claimBtn.setInteractive(
        new Phaser.Geom.Rectangle(-halfW, -halfH, btnW, halfH * 2),
        Phaser.Geom.Rectangle.Contains
      );
      card.claimBtn.once('pointerdown', () => {
        this.scene.time.delayedCall(0, () => {
          try {
            onClaim();
          } catch (e) {
            console.warn('[TaskCardPool] onClaim error', e);
          }
        });
      });
    } else if (isClaimed) {
      card.claimBtn.setVisible(false);
      card.claimedBadge.setVisible(true);
    } else {
      card.claimBtn.setVisible(false);
      card.claimedBadge.setVisible(false);
    }
  }

  private formatRewards(reward: QuestRow['reward']): string {
    const parts: string[] = [];
    if (reward.coins && reward.coins > 0) parts.push(`${reward.coins} монет`);
    if (reward.crystals && reward.crystals > 0) parts.push(`${reward.crystals} кристаллов`);
    if (reward.xp && reward.xp > 0) parts.push(`${reward.xp} XP Battle Pass`);
    if (reward.fragments && reward.fragments > 0) parts.push(`${reward.fragments} фрагментов`);
    return parts.join('  ·  ');
  }

  getCardHeight(): number {
    return Math.round(160 * this.getScale());
  }

  getCardSpacing(): number {
    return 16;
  }

  getRowStride(): number {
    return this.getCardHeight() + this.getCardSpacing();
  }

  destroy(): void {
    this.pool.forEach((c) => c.container.destroy(true));
    this.pool = [];
  }
}
