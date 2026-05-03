// src/ui/quest/VirtualTaskScroll.ts
// Виртуализация списка заданий (daily / weekly): только видимые карточки из пула

import Phaser from 'phaser';
import { TaskCardPool, PooledTaskCard, QuestRow } from './TaskCardPool';

export interface VirtualTaskScrollConfig {
  viewportHeight: number;
  contentStartY: number;
  cardCenterX: number;
  isWeekly: boolean;
  onClaim: (taskId: string) => void;
}

export class VirtualTaskScroll {
  private tasks: QuestRow[] = [];
  private readonly rendered = new Map<number, PooledTaskCard>();
  private visible = new Set<number>();
  private dataDirty = true;
  private scrollY = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly parent: Phaser.GameObjects.Container,
    private readonly pool: TaskCardPool,
    private config: VirtualTaskScrollConfig
  ) {}

  applyConfigPatch(patch: Partial<VirtualTaskScrollConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  setTasks(tasks: QuestRow[]): void {
    this.tasks = tasks;
    this.dataDirty = true;
    this.applyVisibility();
  }

  updateScroll(scrollY: number): void {
    const changed = Math.abs(scrollY - this.scrollY) >= 0.35;
    this.scrollY = scrollY;
    if (!changed && !this.dataDirty) return;
    this.applyVisibility();
  }

  getScrollY(): number {
    return this.scrollY;
  }

  /**
   * Нижняя граница контента в локальных Y contentContainer (нижний край последней карточки).
   */
  getContentBottomY(): number {
    if (this.tasks.length === 0) {
      return this.config.contentStartY;
    }
    const rowStride = this.pool.getRowStride();
    const cardH = this.pool.getCardHeight();
    const n = this.tasks.length;
    return this.config.contentStartY + (n - 1) * rowStride + cardH;
  }

  destroy(): void {
    this.rendered.forEach((c) => this.pool.release(c));
    this.rendered.clear();
    this.visible.clear();
    this.tasks = [];
  }

  private applyVisibility(): void {
    const rowStride = this.pool.getRowStride();
    const cardH = this.pool.getCardHeight();
    const startY = this.config.contentStartY;
    const overscan = rowStride;
    const viewTop = this.scrollY - overscan;
    const viewBottom = this.scrollY + this.config.viewportHeight + overscan;

    const nextVisible = new Set<number>();
    for (let i = 0; i < this.tasks.length; i++) {
      const cardTop = startY + i * rowStride;
      const cardBottom = cardTop + cardH;
      if (cardBottom > viewTop && cardTop < viewBottom) {
        nextVisible.add(i);
      }
    }

    this.visible.forEach((idx) => {
      if (!nextVisible.has(idx)) {
        const c = this.rendered.get(idx);
        if (c) {
          this.pool.release(c);
          this.rendered.delete(idx);
        }
      }
    });

    const needData = this.dataDirty;
    nextVisible.forEach((idx) => {
      const y = startY + idx * rowStride;
      const task = this.tasks[idx];
      if (!this.rendered.has(idx)) {
        const pooled = this.pool.acquire();
        if (!pooled) {
          return;
        }
        this.pool.updateCard(
          pooled,
          task,
          this.config.cardCenterX,
          y,
          this.config.isWeekly,
          () => this.config.onClaim(task.id)
        );
        this.parent.add(pooled.container);
        this.rendered.set(idx, pooled);
      } else if (needData) {
        const pooled = this.rendered.get(idx)!;
        this.pool.updateCard(
          pooled,
          task,
          this.config.cardCenterX,
          y,
          this.config.isWeekly,
          () => this.config.onClaim(task.id)
        );
      } else {
        this.rendered.get(idx)!.container.setPosition(this.config.cardCenterX, y);
      }
    });

    this.visible = nextVisible;
    this.dataDirty = false;
  }
}
