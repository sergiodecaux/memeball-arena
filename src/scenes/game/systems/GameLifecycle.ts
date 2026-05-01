// src/scenes/game/systems/GameLifecycle.ts
// Система жизненного цикла матча

import Phaser from 'phaser';
import { MatchIntroOverlay } from '../../../ui/game/MatchIntroOverlay';
import { PauseMenu } from '../../../ui/game/PauseMenu';
import { FormationMenu } from '../../../ui/game/FormationMenu';
import { InGameSettings } from '../../../ui/game/InGameSettings';
import { ResultScreen } from '../../../ui/game/ResultScreen';
import { TutorialOverlay } from '../../../ui/game/TutorialOverlay';
import { CampaignDialogueSystem } from '../../../managers/CampaignDialogueSystem';
import { AudioManager } from '../../../managers/AudioManager';
import { playerData } from '../../../data/PlayerData';
import { MatchResult } from '../../../types/MatchResult';
import { generateHumanLikeOpponentNickname } from '../../../utils/humanLikeNickname';
import { FactionId } from '../../../constants/gameConstants';
import { MatchPhase } from '../../../core/MatchStateMachine';
import { logInfo } from '../../../utils/ProductionLogger';

export interface GameLifecycleConfig {
  scene: Phaser.Scene;
  isCampaignMode: boolean;
  campaignLevelConfig?: any;
  matchContext: string;
  isAIEnabled: boolean;
  /** When false (default), ranked/casual AI fallback hides BOT/AI on results HUD */
  isRealtimePvP?: boolean;
  opponentName?: string;
  opponentAvatarId?: string;
  getState: () => any;
  onMatchStart: () => void;
  onMatchEnd: (result: MatchResult) => void;
  onRestart: () => void;
  getMatchDirector: () => any;
  getShootingController: () => any;
  getGameHUD: () => any;
  getCardPanel: () => Phaser.GameObjects.Container | undefined;
  getAbilityManager: () => any;
  getTutorialOverlay: () => TutorialOverlay;
  getCampaignDialogue: () => CampaignDialogueSystem | undefined;
}

/**
 * Система жизненного цикла матча
 * Отвечает за интро, старт, паузу, рестарт, результаты
 */
export class GameLifecycle {
  private scene: Phaser.Scene;
  private config: GameLifecycleConfig;
  
  // UI элементы
  private matchIntroOverlay?: MatchIntroOverlay;
  private pauseMenu?: PauseMenu;
  private formationMenu?: FormationMenu;
  private inGameSettings?: InGameSettings;
  private resultScreen?: ResultScreen;
  
  // Флаги
  private isResultShown: boolean = false;
  
  constructor(config: GameLifecycleConfig) {
    this.scene = config.scene;
    this.config = config;
  }
  
  /**
   * Показ интро матча
   */
  showMatchIntro(): void {
    console.log('[GameLifecycle] showMatchIntro() called');
    
    const matchDirector = this.config.getMatchDirector();
    const shootingController = this.config.getShootingController();
    const gameHUD = this.config.getGameHUD();
    const cardPanel = this.config.getCardPanel();
    
    // Пауза физики
    (this.scene as any).matter.world.pause();
    shootingController.setEnabled(false);
    gameHUD.setPauseEnabled(false);
    cardPanel?.setVisible(false);

    const state = this.config.getState();
    const playerName = playerData.getNickname() || 'You';

    let opponentName: string;
    const trimmed = this.config.opponentName?.trim();
    if (trimmed) {
      opponentName = trimmed;
    } else if (!this.config.isAIEnabled) {
      opponentName = 'Player 2';
    } else {
      opponentName = generateHumanLikeOpponentNickname();
    }

    // Получаем аватарки
    const playerAvatarId = playerData.get().avatarId || 'avatar_recruit';
    let opponentAvatarId = this.config.opponentAvatarId;
    
    if (!opponentAvatarId) {
      const botAvatars = [
        'avatar_recruit', 'avatar_explorer', 'avatar_magma_warrior',
        'avatar_cyborg_elite', 'avatar_void_mystic', 'avatar_insect_hive',
        'avatar_champion', 'avatar_legend'
      ];
      opponentAvatarId = botAvatars[Math.floor(Math.random() * botAvatars.length)];
    }
    
    // Проверяем существование текстуры
    if (!this.scene.textures.exists(opponentAvatarId)) {
      console.warn(`[GameLifecycle] Avatar texture missing: ${opponentAvatarId}, using fallback`);
      opponentAvatarId = 'avatar_recruit';
      
      if (!this.scene.textures.exists(opponentAvatarId)) {
        console.error(`[GameLifecycle] Even fallback avatar missing! Using emoji`);
        opponentAvatarId = undefined as any;
      }
    }

    console.log(`[GameLifecycle] Creating MatchIntroOverlay: player="${playerName}" (${state.playerFaction}), opponent="${opponentName}" (${state.opponentFaction})`);
    
    this.matchIntroOverlay = new MatchIntroOverlay(
      this.scene, 
      state.playerFaction || 'cyborg', 
      state.opponentFaction || 'magma', 
      playerName, 
      opponentName,
      playerAvatarId,
      opponentAvatarId
    );
    
    this.matchIntroOverlay.play(() => {
      console.log('[GameLifecycle] MatchIntroOverlay completed');
      this.onMatchIntroComplete();
    });
  }
  
  /**
   * Завершение интро
   */
  private onMatchIntroComplete(): void {
    console.log('[GameLifecycle] onMatchIntroComplete() called');
    
    this.matchIntroOverlay?.destroy();
    this.matchIntroOverlay = undefined;

    // Safety flag to prevent double-start
    let isStarted = false;
    const safeStart = () => {
      if (isStarted) {
        console.warn('[GameLifecycle] safeStart() already called, preventing double-start');
        return;
      }
      isStarted = true;
      console.log('[GameLifecycle] safeStart() calling startGame()');
      this.startGame();
    };

    if (this.config.isCampaignMode && this.config.campaignLevelConfig?.dialogueBeforeMatch) {
      const dialogueId = this.config.campaignLevelConfig.dialogueBeforeMatch;
      
      // Safety Timer
      const watchdog = this.scene.time.delayedCall(2000, () => {
        console.warn('[GameLifecycle] Dialogue watchdog triggered. Forcing start.');
        safeStart();
      });

      const campaignDialogue = this.config.getCampaignDialogue();
      campaignDialogue?.playDialogueById(dialogueId, 100, () => {
        watchdog.remove();
        safeStart();
      });
    } else {
      safeStart();
    }
  }
  
  /**
   * Старт игры
   */
  private startGame(): void {
    console.log('[GameLifecycle] startGame() called - resuming physics and starting match');
    logInfo('GameLifecycle', 'startGame called - match beginning');
    
    const matchDirector = this.config.getMatchDirector();
    const shootingController = this.config.getShootingController();
    const gameHUD = this.config.getGameHUD();
    const cardPanel = this.config.getCardPanel();
    const abilityManager = this.config.getAbilityManager();
    const tutorialOverlay = this.config.getTutorialOverlay();
    const campaignDialogue = this.config.getCampaignDialogue();
    
    // Возобновляем физику
    console.log('[GameLifecycle] Resuming physics world');
    (this.scene as any).matter.world.resume();
    
    // Показываем HUD и карточки
    gameHUD.setPauseEnabled(true);
    cardPanel?.setVisible(true);
    
    // Включаем контроллер стрельбы
    shootingController.setEnabled(true);
    
    AudioManager.getInstance().playSFX('sfx_whistle');
    console.log('[GameLifecycle] Starting match director...');
    matchDirector.startMatch();
    
    // Проверяем, что матч запустился
    const phase = matchDirector.getPhase();
    console.log(`[GameLifecycle] Match phase after start: ${phase}`);
    
    if (phase !== MatchPhase.WAITING && phase !== MatchPhase.AIMING) {
      console.error(`[GameLifecycle] ❌ Match did not start properly. Current phase: ${phase}`);
      
      if (phase === MatchPhase.INTRO) {
        console.warn('[GameLifecycle] ⚠️ Match is still in INTRO phase, attempting to fix...');
        // ✅ FIX: Используем Phaser time.delayedCall который автоматически очищается при уничтожении сцены
        this.scene.time.delayedCall(100, () => {
          if (this.scene.scene.isActive()) {
            matchDirector.startMatch();
            const newPhase = matchDirector.getPhase();
            console.log(`[GameLifecycle] Retry: Match phase after second start: ${newPhase}`);
          }
        });
      }
    }
    
    // Campaign dialogue
    if (this.config.isCampaignMode) {
      campaignDialogue?.onMatchStart();
      
      // Tutorial
      const isFirstTutorialMatch = this.config.isCampaignMode &&
        this.config.campaignLevelConfig?.id === '1-1' &&
        !playerData.hasCompletedFirstMatchTutorial();
      
      if (isFirstTutorialMatch && !playerData.hasAbilitiesHintShown() && tutorialOverlay?.isActive()) {
        this.waitForDialogueComplete(() => {
          shootingController.setEnabled(false);
          cardPanel?.setVisible(false);
          
          tutorialOverlay.showMessage(
            'Карты — это способности! Нажми на карту, затем выбери цель. Использование способностей — часть тактики.',
            () => {
              const blocked = campaignDialogue?.isBlockingInput() ?? false;
              const currentPlayer = matchDirector.getCurrentPlayer();
              if (currentPlayer === 1 && !blocked) {
                shootingController.setEnabled(true);
                cardPanel?.setVisible(abilityManager.getAvailableCards().length > 0);
              }
              playerData.markAbilitiesHintShown();
            }
          );
        });
      }
    }

    const currentPlayer = matchDirector.getCurrentPlayer();
    console.log(`[GameLifecycle] Match started. Current player: ${currentPlayer}, Phase: ${phase}`);
    
    if (currentPlayer === 1) {
      const blocked = campaignDialogue?.isBlockingInput() ?? false;
      const showingTutorial = tutorialOverlay?.isActive() && tutorialOverlay.visible;
      if (!blocked && !showingTutorial) {
        shootingController.setEnabled(true);
      }
    }
    
    this.config.onMatchStart();
  }
  
  /**
   * Ожидание завершения диалога
   */
  private waitForDialogueComplete(callback: () => void): void {
    const campaignDialogue = this.config.getCampaignDialogue();
    
    if (!campaignDialogue) {
      callback();
      return;
    }
    
    const checkInterval = 100;
    const maxWait = 5000;
    let elapsed = 0;
    
    const checkComplete = () => {
      if (!campaignDialogue.isBlockingInput() || elapsed >= maxWait) {
        callback();
      } else {
        elapsed += checkInterval;
        this.scene.time.delayedCall(checkInterval, checkComplete);
      }
    };
    
    this.scene.time.delayedCall(checkInterval, checkComplete);
  }
  
  /**
   * Показ меню паузы
   */
  showPauseMenu(): void {
    if (this.pauseMenu) {
      console.warn('[GameLifecycle] Pause menu already exists');
      return;
    }
    
    const matchDirector = this.config.getMatchDirector();
    matchDirector.pause();
    
    this.pauseMenu = new PauseMenu(this.scene, {
      onResume: () => {
        matchDirector.resume();
        this.pauseMenu?.destroy();
        this.pauseMenu = undefined;
      },
      onSettings: () => {
        this.showInGameSettings();
      },
      onSurrender: () => {
        this.pauseMenu?.destroy();
        this.pauseMenu = undefined;
        this.scene.scene.start('MenuScene');
      },
    });
  }
  
  /**
   * Показ меню формации
   */
  showFormationMenu(): void {
    if (this.formationMenu) {
      console.warn('[GameLifecycle] Formation menu already exists');
      return;
    }
    
    const matchDirector = this.config.getMatchDirector();
    matchDirector.pause();
    
    const currentFormationId = playerData.getSelectedFormation().id;
    const playerFaction = this.config.getState().playerFaction || playerData.getFaction();
    
    this.formationMenu = new FormationMenu(
      this.scene,
      currentFormationId,
      {
        onSelect: (formation: any) => {
          console.log('[GameLifecycle] Formation selected:', formation);
          matchDirector.resume();
          this.formationMenu?.destroy();
          this.formationMenu = undefined;
        },
        onCancel: () => {
          matchDirector.resume();
          this.formationMenu?.destroy();
          this.formationMenu = undefined;
        },
      },
      playerFaction
    );
  }
  
  /**
   * Показ настроек в игре
   */
  private showInGameSettings(): void {
    if (this.inGameSettings) {
      return;
    }
    
    this.inGameSettings = new InGameSettings(this.scene, {
      onClose: () => {
        this.inGameSettings?.destroy();
        this.inGameSettings = undefined;
      },
    });
  }
  
  /**
   * Показ экрана результатов
   */
  showResultScreen(result: MatchResult): void {
    if (this.isResultShown) {
      console.warn('[GameLifecycle] Result screen already shown');
      return;
    }
    
    this.isResultShown = true;
    
    const matchDirector = this.config.getMatchDirector();
    matchDirector.pause();

    const realtime = this.config.isRealtimePvP === true;
    const disguisePvPBot =
      (this.config.matchContext === 'ranked' || this.config.matchContext === 'casual') &&
      this.config.isAIEnabled &&
      !realtime;
    const isAIMode = this.config.isAIEnabled && !disguisePvPBot;
    const opponentName = this.config.opponentName?.trim() || 'Opponent';
    const opponentAvatarId = this.config.opponentAvatarId || 'avatar_recruit';
    
    this.resultScreen = new ResultScreen(
      this.scene,
      result,
      isAIMode,
      {
        opponentName: opponentName,
        opponentAvatarId: opponentAvatarId,
      },
      {
        onRematch: () => {
          this.resultScreen?.destroy();
          this.resultScreen = undefined;
          this.isResultShown = false;
          this.restartGame();
        },
        onMainMenu: () => {
          this.resultScreen?.destroy();
          this.resultScreen = undefined;
          this.isResultShown = false;
          this.config.onMatchEnd(result);
        },
        onNextLevel: result.unlockedNextLevel ? () => {
          this.resultScreen?.destroy();
          this.resultScreen = undefined;
          this.isResultShown = false;
          this.config.onMatchEnd(result);
        } : undefined,
      }
    );
  }
  
  /**
   * Рестарт игры
   */
  private restartGame(): void {
    console.log('[GameLifecycle] Restarting game');
    this.cleanup();
    this.config.onRestart();
  }
  
  /**
   * Проверка, показан ли результат
   */
  isResultScreenShown(): boolean {
    return this.isResultShown;
  }
  
  /**
   * Очистка
   */
  cleanup(): void {
    this.matchIntroOverlay?.destroy();
    this.matchIntroOverlay = undefined;
    
    this.pauseMenu?.destroy();
    this.pauseMenu = undefined;
    
    this.formationMenu?.destroy();
    this.formationMenu = undefined;
    
    this.inGameSettings?.destroy();
    this.inGameSettings = undefined;
    
    this.resultScreen?.destroy();
    this.resultScreen = undefined;
    
    this.isResultShown = false;
  }
}
