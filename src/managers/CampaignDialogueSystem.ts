// src/managers/CampaignDialogueSystem.ts
// Minimal, reliable campaign dialogue system - no typewriter, no scene pause

import Phaser from 'phaser';
import { LevelConfig, DialogueEntry, DialogueLine, DialogueTrigger } from '../types/CampaignTypes';
import { getDialogue } from '../data/CampaignData';
import { CampaignDialogueOverlay } from '../ui/game/CampaignDialogueOverlay';

interface QueuedDialogue {
  dialogue: DialogueEntry;
  priority: number;
  onComplete?: () => void;
}

interface TriggerState {
  triggered: boolean;
  oncePerMatch: boolean;
}

export class CampaignDialogueSystem {
  private scene: Phaser.Scene;
  private overlay: CampaignDialogueOverlay;
  private levelConfig?: LevelConfig;
  private queue: QueuedDialogue[] = [];
  private currentDialogue?: DialogueEntry;
  private currentLineIndex: number = 0;
  private triggerStates: Map<DialogueTrigger, TriggerState> = new Map();
  private matchEvents = {
    matchStarted: false,
    playerGoals: 0,
    enemyGoals: 0,
    playerLeading: false,
    enemyLeading: false,
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.overlay = new CampaignDialogueOverlay(scene);

    console.log('[CampaignDialogueSystem] Created');
  }

  /**
   * Initialize for a campaign level
   */
  initForLevel(levelConfig: LevelConfig): void {
    this.levelConfig = levelConfig;
    this.clear();

    console.log('[CampaignDialogueSystem] initForLevel:', {
      levelId: levelConfig.id,
      dialogueBeforeMatch: levelConfig.dialogueBeforeMatch,
      inMatchDialogues: levelConfig.inMatchDialogues?.length || 0,
    });

    // Initialize trigger states from inMatchDialogues
    if (levelConfig.inMatchDialogues) {
      for (const imd of levelConfig.inMatchDialogues) {
        if (!this.triggerStates.has(imd.trigger)) {
          this.triggerStates.set(imd.trigger, {
            triggered: false,
            oncePerMatch: imd.oncePerMatch ?? false,
          });
        }
      }
    }
  }

  /**
   * Play a dialogue by ID (queued with priority)
   */
  playDialogueById(
    dialogueId: string,
    priority: number = 50,
    onComplete?: () => void
  ): void {
    const dialogue = getDialogue(dialogueId);
    
    console.log('[CampaignDialogueSystem] playDialogueById:', {
      dialogueId,
      found: !!dialogue,
      priority,
      linesCount: dialogue?.lines?.length || 0,
    });

    if (!dialogue) {
      console.warn(`[CampaignDialogueSystem] Dialogue not found: ${dialogueId}`);
      onComplete?.();
      return;
    }

    if (dialogue.lines.length === 0) {
      console.warn(`[CampaignDialogueSystem] Dialogue has no lines: ${dialogueId}`);
      onComplete?.();
      return;
    }

    // Queue dialogue
    this.queue.push({ dialogue, priority, onComplete });
    this.queue.sort((a, b) => b.priority - a.priority); // Higher priority first

    // Process queue if not currently showing
    if (!this.overlay.isVisible()) {
      this.processQueue();
    }
  }

  /**
   * Clear all dialogues
   */
  clear(): void {
    this.queue = [];
    this.currentDialogue = undefined;
    this.currentLineIndex = 0;
    this.overlay.hide();
    this.triggerStates.clear();
    this.matchEvents = {
      matchStarted: false,
      playerGoals: 0,
      enemyGoals: 0,
      playerLeading: false,
      enemyLeading: false,
    };
    console.log('[CampaignDialogueSystem] clear() called');
  }

  /**
   * Check if dialogue is blocking input
   */
  isBlockingInput(): boolean {
    return this.overlay.isVisible();
  }

  // ========== MATCH EVENT HOOKS ==========

  onMatchStart(): void {
    console.log('[CampaignDialogueSystem] onMatchStart()');
    this.matchEvents.matchStarted = true;
    this.checkTrigger('match_start');
  }

  onPlayerGoal(): void {
    this.matchEvents.playerGoals++;

    if (this.matchEvents.playerGoals === 1) {
      this.checkTrigger('first_player_goal');
    }

    // Check leading state
    if (this.matchEvents.playerGoals > this.matchEvents.enemyGoals) {
      if (!this.matchEvents.playerLeading) {
        this.matchEvents.playerLeading = true;
        this.matchEvents.enemyLeading = false;
        this.checkTrigger('player_leading');
      }
    }

    // Check match point
    if (this.levelConfig?.winCondition.type === 'score_limit') {
      const limit = this.levelConfig.winCondition.scoreLimit ?? 3;
      if (this.matchEvents.playerGoals === limit - 1) {
        this.checkTrigger('match_point_player');
      }
    }
  }

  onEnemyGoal(): void {
    this.matchEvents.enemyGoals++;

    if (this.matchEvents.enemyGoals === 1) {
      this.checkTrigger('first_enemy_goal');
    }

    // Check leading state
    if (this.matchEvents.enemyGoals > this.matchEvents.playerGoals) {
      if (!this.matchEvents.enemyLeading) {
        this.matchEvents.enemyLeading = true;
        this.matchEvents.playerLeading = false;
        this.checkTrigger('enemy_leading');
      }
    }

    // Check match point
    if (this.levelConfig?.winCondition.type === 'score_limit') {
      const limit = this.levelConfig.winCondition.scoreLimit ?? 3;
      if (this.matchEvents.enemyGoals === limit - 1) {
        this.checkTrigger('match_point_enemy');
      }
    }
  }

  onTimeWarning(secondsRemaining: number): void {
    if (secondsRemaining <= 10) {
      this.checkTrigger('time_warning_10s');
    } else if (secondsRemaining <= 30) {
      this.checkTrigger('time_warning_30s');
    }
  }

  onMatchEnd(isWin: boolean): void {
    console.log('[CampaignDialogueSystem] onMatchEnd:', { isWin });

    if (!this.levelConfig) return;

    if (isWin && this.levelConfig.dialogueAfterWin) {
      this.playDialogueById(this.levelConfig.dialogueAfterWin, 90);
    } else if (!isWin && this.levelConfig.dialogueAfterLose) {
      this.playDialogueById(this.levelConfig.dialogueAfterLose, 90);
    }
  }

  // ========== PRIVATE: TRIGGER HANDLING ==========

  private checkTrigger(trigger: DialogueTrigger): void {
    if (!this.levelConfig?.inMatchDialogues) return;

    const triggerState = this.triggerStates.get(trigger);
    
    // If trigger already fired and is oncePerMatch, skip
    if (triggerState?.triggered && triggerState.oncePerMatch) {
      return;
    }

    // Find dialogue for this trigger
    const inMatchDialogue = this.levelConfig.inMatchDialogues.find(
      imd => imd.trigger === trigger
    );

    if (inMatchDialogue) {
      // Mark as triggered
      if (triggerState) {
        triggerState.triggered = true;
      }

      console.log('[CampaignDialogueSystem] Trigger fired:', {
        trigger,
        dialogueId: inMatchDialogue.dialogueId,
      });

      // Queue the dialogue
      this.playDialogueById(inMatchDialogue.dialogueId, 40);
    }
  }

  // ========== PRIVATE: QUEUE PROCESSING ==========

  private processQueue(): void {
    if (this.queue.length === 0) {
      return;
    }

    const queued = this.queue.shift();
    if (!queued) return;

    this.currentDialogue = queued.dialogue;
    this.currentLineIndex = 0;

    console.log('[CampaignDialogueSystem] Starting dialogue:', {
      dialogueId: queued.dialogue.id,
      linesCount: queued.dialogue.lines.length,
    });

    this.showNextLine(queued.onComplete);
  }

  private showNextLine(onComplete?: () => void): void {
    if (!this.currentDialogue) {
      this.processQueue();
      if (onComplete) {
        onComplete();
      }
      return;
    }

    const line = this.currentDialogue.lines[this.currentLineIndex];
    
    if (!line) {
      // Dialogue complete
      console.log('[CampaignDialogueSystem] Dialogue complete:', this.currentDialogue.id);
      
      this.currentDialogue = undefined;
      this.currentLineIndex = 0;
      this.overlay.hide();

      if (onComplete) {
        onComplete();
      }

      // Process next in queue
      this.processQueue();
      return;
    }

    // Show line
    this.overlay.showLine(
      line,
      this.currentDialogue.skippable ?? false,
      () => {
        // On advance: move to next line
        this.currentLineIndex++;
        this.showNextLine(onComplete);
      }
    );
  }

  /**
   * Destroy the system
   */
  destroy(): void {
    this.overlay.destroy();
    this.clear();
    console.log('[CampaignDialogueSystem] destroy() called');
  }
}

