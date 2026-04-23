// src/managers/NarrativeManager.ts
// Менеджер нарратива — управляет очередью диалогов и триггерами

import Phaser from 'phaser';
import {
  DialogueEntry,
  DialogueLine,
  DialogueTrigger,
  InMatchDialogue,
  LevelConfig,
} from '../types/CampaignTypes';
import { CAMPAIGN_DIALOGUES, getDialogue } from '../data/CampaignData';
import { CommsLinkOverlay } from '../ui/game/CommsLinkOverlay';

interface QueuedDialogue {
  entry: DialogueEntry;
  priority: number;
  context?: string;
}

interface TriggerState {
  triggered: boolean;
  oncePerMatch: boolean;
}

export class NarrativeManager {
  private scene: Phaser.Scene;
  private commsLink: CommsLinkOverlay;
  private levelConfig?: LevelConfig;
  
  // Очередь диалогов
  private dialogueQueue: QueuedDialogue[] = [];
  private isProcessingQueue: boolean = false;
  
  // Текущий диалог
  private currentDialogue?: DialogueEntry;
  private currentLineIndex: number = 0;
  
  // Состояние триггеров
  private triggerStates: Map<string, TriggerState> = new Map();
  
  // Флаги событий матча
  private matchEvents = {
    playerGoals: 0,
    enemyGoals: 0,
    matchStarted: false,
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.commsLink = new CommsLinkOverlay(scene, {
      pauseOnShow: true,
      onComplete: () => this.onDialogueLineComplete(),
    });
  }

  /**
   * Инициализировать менеджер для уровня кампании
   */
  initForLevel(levelConfig: LevelConfig): void {
    this.levelConfig = levelConfig;
    this.resetState();
    
    // Регистрируем in-match диалоги
    if (levelConfig.inMatchDialogues) {
      levelConfig.inMatchDialogues.forEach(imd => {
        this.triggerStates.set(imd.trigger, {
          triggered: false,
          oncePerMatch: imd.oncePerMatch ?? true,
        });
      });
    }
    
    console.log('[NarrativeManager] Initialized for level:', levelConfig.id);
  }

  /**
   * Сбросить состояние
   */
  resetState(): void {
    this.dialogueQueue = [];
    this.isProcessingQueue = false;
    this.currentDialogue = undefined;
    this.currentLineIndex = 0;
    this.triggerStates.clear();
    this.matchEvents = {
      playerGoals: 0,
      enemyGoals: 0,
      matchStarted: false,
    };
  }

  // ========== ПУБЛИЧНЫЕ МЕТОДЫ ДЛЯ ПОКАЗА ДИАЛОГОВ ==========

  /**
   * Показать диалог по ID
   */
  showDialogue(dialogueId: string, priority: number = 50): void {
    const entry = getDialogue(dialogueId);
    if (!entry) {
      console.warn(`[NarrativeManager] Dialogue not found: ${dialogueId}`);
      return;
    }
    
    this.queueDialogue(entry, priority);
  }

  /**
   * Добавить диалог в очередь
   */
  queueDialogue(entry: DialogueEntry, priority?: number): void {
    const prio = priority ?? entry.priority ?? 50;
    
    this.dialogueQueue.push({
      entry,
      priority: prio,
    });
    
    // Сортируем по приоритету (выше = важнее = первым)
    this.dialogueQueue.sort((a, b) => b.priority - a.priority);
    
    console.log(`[NarrativeManager] Queued dialogue: ${entry.id} (priority: ${prio})`);
    
    // Начинаем обработку если не идёт
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  /**
   * Показать быстрое сообщение (без очереди, низкий приоритет)
   */
  showQuickMessage(
    characterId: 'nova' | 'announcer',
    text: string,
    autoHide: number = 3000
  ): void {
    // Если уже показывается важный диалог — пропускаем
    if (this.commsLink.isShowing()) {
      return;
    }
    
    const tempEntry: DialogueEntry = {
      id: `quick_${Date.now()}`,
      lines: [{
        characterId,
        text,
        autoHide,
        pauseGame: false,
      }],
      skippable: true,
      priority: 10,
    };
    
    this.startDialogue(tempEntry);
  }

  // ========== ОБРАБОТКА ОЧЕРЕДИ ==========

  private processQueue(): void {
    if (this.dialogueQueue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }
    
    // Если комментарий уже показывается — ждём
    if (this.commsLink.isShowing()) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    const next = this.dialogueQueue.shift();
    if (next) {
      this.startDialogue(next.entry);
    }
  }

  private startDialogue(entry: DialogueEntry): void {
    this.currentDialogue = entry;
    this.currentLineIndex = 0;
    
    console.log(`[NarrativeManager] Starting dialogue: ${entry.id}`);
    
    this.showCurrentLine();
  }

  private showCurrentLine(): void {
    if (!this.currentDialogue) return;
    
    if (this.currentLineIndex >= this.currentDialogue.lines.length) {
      // Диалог завершён
      this.onDialogueComplete();
      return;
    }
    
    const line = this.currentDialogue.lines[this.currentLineIndex];
    
    // Задержка перед показом
    const delay = line.delay ?? 0;
    
    if (delay > 0) {
      this.scene.time.delayedCall(delay, () => {
        this.commsLink.show(line, () => this.onDialogueLineComplete());
      });
    } else {
      this.commsLink.show(line, () => this.onDialogueLineComplete());
    }
  }

  private onDialogueLineComplete(): void {
    if (!this.currentDialogue) return;
    
    this.currentLineIndex++;
    
    // Небольшая пауза между репликами
    this.scene.time.delayedCall(200, () => {
      this.showCurrentLine();
    });
  }

  private onDialogueComplete(): void {
    console.log(`[NarrativeManager] Dialogue complete: ${this.currentDialogue?.id}`);
    
    this.currentDialogue = undefined;
    this.currentLineIndex = 0;
    
    // Продолжаем обработку очереди
    this.scene.time.delayedCall(300, () => {
      this.processQueue();
    });
  }

  // ========== ТРИГГЕРЫ СОБЫТИЙ МАТЧА ==========

  /**
   * Вызвать при старте матча
   */
  onMatchStart(): void {
    this.matchEvents.matchStarted = true;
    this.checkTrigger('match_start');
    
    // ✅ REMOVED: Pre-match dialogue is handled by DialogueManager in GameScene.onMatchIntroComplete()
    // Do NOT show dialogueBeforeMatch here to avoid duplicate dialogue
  }

  /**
   * Вызвать при голе игрока
   */
  onPlayerGoal(): void {
    this.matchEvents.playerGoals++;
    
    if (this.matchEvents.playerGoals === 1) {
      this.checkTrigger('first_player_goal');
    }
    
    // Проверяем лидерство
    if (this.matchEvents.playerGoals > this.matchEvents.enemyGoals) {
      this.checkTrigger('player_leading');
    }
    
    // Матч-поинт
    if (this.levelConfig?.winCondition.type === 'score_limit') {
      const limit = this.levelConfig.winCondition.scoreLimit ?? 3;
      if (this.matchEvents.playerGoals === limit - 1) {
        this.checkTrigger('match_point_player');
      }
    }
  }

  /**
   * Вызвать при голе противника
   */
  onEnemyGoal(): void {
    this.matchEvents.enemyGoals++;
    
    if (this.matchEvents.enemyGoals === 1) {
      this.checkTrigger('first_enemy_goal');
    }
    
    // Проверяем лидерство противника
    if (this.matchEvents.enemyGoals > this.matchEvents.playerGoals) {
      this.checkTrigger('enemy_leading');
    }
    
    // Матч-поинт противника
    if (this.levelConfig?.winCondition.type === 'score_limit') {
      const limit = this.levelConfig.winCondition.scoreLimit ?? 3;
      if (this.matchEvents.enemyGoals === limit - 1) {
        this.checkTrigger('match_point_enemy');
      }
    }
  }

  /**
   * Вызвать при предупреждении о времени
   */
  onTimeWarning(secondsRemaining: number): void {
    if (secondsRemaining <= 10) {
      this.checkTrigger('time_warning_10s');
    } else if (secondsRemaining <= 30) {
      this.checkTrigger('time_warning_30s');
    }
  }

  /**
   * Вызвать при победе
   */
  onMatchWin(): void {
    if (this.levelConfig?.dialogueAfterWin) {
      this.showDialogue(this.levelConfig.dialogueAfterWin, 90);
    }
  }

  /**
   * Вызвать при поражении
   */
  onMatchLose(): void {
    if (this.levelConfig?.dialogueAfterLose) {
      this.showDialogue(this.levelConfig.dialogueAfterLose, 90);
    }
  }

  private checkTrigger(trigger: DialogueTrigger): void {
    if (!this.levelConfig?.inMatchDialogues) return;
    
    const triggerState = this.triggerStates.get(trigger);
    
    // Если триггер уже сработал и он одноразовый — пропускаем
    if (triggerState?.triggered && triggerState.oncePerMatch) {
      return;
    }
    
    // Ищем диалог для этого триггера
    const inMatchDialogue = this.levelConfig.inMatchDialogues.find(
      imd => imd.trigger === trigger
    );
    
    if (inMatchDialogue) {
      // Помечаем как сработавший
      if (triggerState) {
        triggerState.triggered = true;
      }
      
      this.showDialogue(inMatchDialogue.dialogueId, 40);
    }
  }

  // ========== УТИЛИТЫ ==========

  /**
   * Скрыть текущий диалог
   */
  hideCurrentDialogue(): void {
    this.commsLink.hide(true);
  }

  /**
   * Проверить, показывается ли диалог
   */
  isDialogueActive(): boolean {
    return this.commsLink.isShowing() || this.dialogueQueue.length > 0;
  }

  /**
   * Очистить очередь диалогов
   */
  clearQueue(): void {
    this.dialogueQueue = [];
    this.commsLink.forceHide();
    this.isProcessingQueue = false;
  }

  /**
   * Уничтожить менеджер
   */
  destroy(): void {
    this.clearQueue();
    this.commsLink.destroy();
  }
}