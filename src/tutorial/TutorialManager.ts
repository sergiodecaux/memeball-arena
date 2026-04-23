// src/tutorial/TutorialManager.ts

import Phaser from 'phaser';
import { eventBus, GameEvents } from '../core/EventBus';
import { TutorialVisuals } from './TutorialVisuals';
import { TutorialOverlay } from '../ui/game/TutorialOverlay';
import { 
  TutorialStep, 
  TUTORIAL_STEP_ORDER,
  TUTORIAL_SITUATIONS,
  TUTORIAL_DIALOGUES,
  getNextStep,
  getDialoguesForStep,
  getHintForStep,
  TutorialSituationConfig
} from './TutorialSteps';
import { playerData } from '../data/PlayerData';
import { FactionId } from '../types';
import { Unit } from '../entities/Unit';
import { Ball } from '../entities/Ball';
import { EntityFactory } from '../scenes/game/EntityFactory';

/**
 * Конфигурация TutorialManager
 */
export interface TutorialManagerConfig {
  scene: Phaser.Scene;
  playerFaction: FactionId;
  fieldBounds: { left: number; right: number; top: number; bottom: number; centerX: number; centerY: number };
  shootingController: any;  // ShootingController
  onComplete: () => void;
  onSkip: () => void;
}

/**
 * TutorialManager — управляет заскриптованным обучением
 * 
 * Последовательность для каждого класса:
 * 1. INTRO — диалог с объяснением класса
 * 2. SITUATION — диалог с объяснением ситуации
 * 3. SELECT — игрок выбирает юнита (подсветка + ограничение)
 * 4. AIM — игрок делает удар (целевая зона + подсказка)
 * 5. RESULT — диалог с результатом
 */
export class TutorialManager {
  private scene: Phaser.Scene;
  private playerFaction: FactionId;
  private fieldBounds: { left: number; right: number; top: number; bottom: number; centerX: number; centerY: number };
  private shootingController: any;
  private onCompleteCallback: () => void;
  private onSkipCallback: () => void;
  
  // === Компоненты ===
  private visuals: TutorialVisuals;
  private overlay: TutorialOverlay;
  
  // === Состояние ===
  private currentStep: TutorialStep = TutorialStep.INTRO;
  private isActive: boolean = false;
  private isWaitingForAction: boolean = false;
  private isDialogueActive: boolean = false;
  
  // === Игровые объекты ===
  private playerUnits: any[] = [];
  private aiUnits: any[] = [];
  private ball: any = null;
  
  // === UI ===
  private skipButton: Phaser.GameObjects.Container | null = null;
  
  // === Таймеры ===
  private practiceTimer: Phaser.Time.TimerEvent | null = null;
  private practiceTimeLeft: number = 120;
  private timerText: Phaser.GameObjects.Text | null = null;
  
  // === Event listeners для очистки ===
  private eventListeners: Array<{ event: string; callback: Function }> = [];
  
  constructor(config: TutorialManagerConfig) {
    this.scene = config.scene;
    this.playerFaction = config.playerFaction;
    this.fieldBounds = config.fieldBounds;
    this.shootingController = config.shootingController;
    this.onCompleteCallback = config.onComplete;
    this.onSkipCallback = config.onSkip;
    
    // Создаём компоненты
    this.visuals = new TutorialVisuals(this.scene);
    this.overlay = new TutorialOverlay(this.scene, true);
    
    // Создаём кнопку пропуска
    this.createSkipButton();
    
    console.log('[TutorialManager] Created');
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Установить игровые объекты
   */
  public setGameObjects(playerUnits: any[], aiUnits: any[], ball: any): void {
    this.playerUnits = playerUnits;
    this.aiUnits = aiUnits;
    this.ball = ball;
    console.log(`[TutorialManager] Game objects set: ${playerUnits.length} player units, ${aiUnits.length} AI units`);
  }
  
  /**
   * Запустить обучение
   */
  public start(): void {
    console.log('[TutorialManager] Starting tutorial');
    this.isActive = true;
    this.currentStep = TutorialStep.INTRO;
    
    // Включаем режим обучения в контроллере
    this.shootingController?.enableTutorialMode?.();
    
    // Запускаем первый шаг
    this.processStep();
  }
  
  /**
   * Разрешён ли ввод игрока
   */
  public isInputAllowed(): boolean {
    // Ввод разрешён только когда ждём действия игрока
    return this.isWaitingForAction && !this.isDialogueActive;
  }
  
  /**
   * Получить текущий шаг
   */
  public getCurrentStep(): TutorialStep {
    return this.currentStep;
  }
  
  /**
   * Активно ли обучение
   */
  public getIsActive(): boolean {
    return this.isActive;
  }
  
  /**
   * Уничтожить менеджер
   */
  public destroy(): void {
    console.log('[TutorialManager] Destroying');
    
    this.isActive = false;
    
    // Очищаем визуалы
    this.visuals.destroy();
    this.overlay.destroy();
    
    // Очищаем таймеры
    if (this.practiceTimer) {
      this.practiceTimer.remove();
      this.practiceTimer = null;
    }
    
    // Очищаем UI
    if (this.skipButton) {
      this.skipButton.destroy();
      this.skipButton = null;
    }
    if (this.timerText) {
      this.timerText.destroy();
      this.timerText = null;
    }
    
    // Отписываемся от событий
    this.eventListeners.forEach(({ event, callback }) => {
      eventBus.off(event, callback as any);
    });
    this.eventListeners = [];
    
    // Выключаем режим обучения
    this.shootingController?.disableTutorialMode?.();
    
    console.log('[TutorialManager] Destroyed');
  }
  
  // ═══════════════════════════════════════════════════════════════
  // ОБРАБОТКА ШАГОВ
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Обработать текущий шаг
   */
  private processStep(): void {
    const step = this.currentStep;
    console.log(`[TutorialManager] Processing step: ${step}`);
    
    // Очищаем предыдущие визуалы и ограничения
    this.visuals.clearAll();
    this.shootingController?.clearTutorialRestrictions?.();
    this.isWaitingForAction = false;
    
    switch (step) {
      // ═══════════════════════════════════════════════════════════
      // ВВЕДЕНИЕ
      // ═══════════════════════════════════════════════════════════
      case TutorialStep.INTRO:
        this.showDialogueSequence(getDialoguesForStep(step), () => {
          this.advanceToNextStep();
        });
        break;
      
      // ═══════════════════════════════════════════════════════════
      // ТАНК
      // ═══════════════════════════════════════════════════════════
      case TutorialStep.TANK_INTRO:
        this.setupSituation('tank');
        this.showDialogueSequence(getDialoguesForStep(step), () => {
          this.advanceToNextStep();
        });
        break;
        
      case TutorialStep.TANK_SITUATION:
        this.highlightTargetUnit('tank');
        this.showDialogueSequence(getDialoguesForStep(step), () => {
          this.advanceToNextStep();
        });
        break;
        
      case TutorialStep.TANK_SELECT:
        this.setupSelectStep('tank');
        break;
        
      case TutorialStep.TANK_AIM:
        this.setupAimStep('tank');
        break;
        
      case TutorialStep.TANK_AI_SHOT:
        this.executeAIShot('tank');
        break;
        
      case TutorialStep.TANK_RESULT:
        this.showDialogueSequence(getDialoguesForStep(step), () => {
          this.advanceToNextStep();
        });
        break;
      
      // ═══════════════════════════════════════════════════════════
      // СНАЙПЕР
      // ═══════════════════════════════════════════════════════════
      case TutorialStep.SNIPER_INTRO:
        this.setupSituation('sniper');
        this.showDialogueSequence(getDialoguesForStep(step), () => {
          this.advanceToNextStep();
        });
        break;
        
      case TutorialStep.SNIPER_SITUATION:
        this.highlightTargetUnit('sniper');
        this.showDialogueSequence(getDialoguesForStep(step), () => {
          this.advanceToNextStep();
        });
        break;
        
      case TutorialStep.SNIPER_SELECT:
        this.setupSelectStep('sniper');
        break;
        
      case TutorialStep.SNIPER_AIM:
        this.setupAimStep('sniper');
        break;
        
      case TutorialStep.SNIPER_RESULT:
        this.showDialogueSequence(getDialoguesForStep(step), () => {
          this.advanceToNextStep();
        });
        break;
      
      // ═══════════════════════════════════════════════════════════
      // BALANCED
      // ═══════════════════════════════════════════════════════════
      case TutorialStep.BALANCED_INTRO:
        this.setupSituation('balanced');
        this.showDialogueSequence(getDialoguesForStep(step), () => {
          this.advanceToNextStep();
        });
        break;
        
      case TutorialStep.BALANCED_SITUATION:
        this.highlightTargetUnit('balanced');
        this.showDialogueSequence(getDialoguesForStep(step), () => {
          this.advanceToNextStep();
        });
        break;
        
      case TutorialStep.BALANCED_SELECT:
        this.setupSelectStep('balanced');
        break;
        
      case TutorialStep.BALANCED_AIM:
        this.setupAimStep('balanced');
        break;
        
      case TutorialStep.BALANCED_RESULT:
        this.showDialogueSequence(getDialoguesForStep(step), () => {
          this.advanceToNextStep();
        });
        break;
      
      // ═══════════════════════════════════════════════════════════
      // ЗАВЕРШЕНИЕ
      // ═══════════════════════════════════════════════════════════
      case TutorialStep.OUTRO:
        this.showDialogueSequence(getDialoguesForStep(step), () => {
          this.advanceToNextStep();
        });
        break;
        
      case TutorialStep.FREE_PRACTICE:
        this.startFreePractice();
        break;
        
      case TutorialStep.COMPLETED:
        this.completeTutorial();
        break;
        
      default:
        console.warn(`[TutorialManager] Unknown step: ${step}`);
        this.advanceToNextStep();
    }
  }
  
  /**
   * Перейти к следующему шагу
   */
  private advanceToNextStep(): void {
    const nextStep = getNextStep(this.currentStep);
    console.log(`[TutorialManager] Advancing: ${this.currentStep} → ${nextStep}`);
    
    this.currentStep = nextStep;
    
    // Небольшая задержка перед следующим шагом
    this.scene.time.delayedCall(300, () => {
      this.processStep();
    });
  }
  
  // ═══════════════════════════════════════════════════════════════
  // НАСТРОЙКА СИТУАЦИЙ
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Настроить ситуацию для класса (пересоздаёт юнитов и мяч)
   */
  private setupSituation(type: 'tank' | 'sniper' | 'balanced'): void {
    const config = TUTORIAL_SITUATIONS[type];
    if (!config) {
      console.error(`[TutorialManager] No situation config for: ${type}`);
      return;
    }
    
    console.log(`[TutorialManager] Setting up situation for: ${type}`);
    
    // Уничтожаем все старые юниты и мяч
    this.playerUnits.forEach(u => {
      if (u.destroy) u.destroy();
      if (u.body && this.scene.matter.world) {
        this.scene.matter.world.remove(u.body);
      }
    });
    this.aiUnits.forEach(u => {
      if (u.destroy) u.destroy();
      if (u.body && this.scene.matter.world) {
        this.scene.matter.world.remove(u.body);
      }
    });
    if (this.ball) {
      if (this.ball.destroy) this.ball.destroy();
      if (this.ball.body && this.scene.matter.world) {
        this.scene.matter.world.remove(this.ball.body);
      }
    }
    
    // Получаем fieldScale из scene (вычисляем как в GameScene)
    const gameScene = this.scene as any;
    const fieldScale = gameScene.fieldBounds ? (gameScene.fieldBounds.width / 600) : 1;
    
    // Создаём factory для получения unitId
    const factory = new EntityFactory({
      scene: this.scene,
      fieldBounds: {
        ...this.fieldBounds,
        width: this.fieldBounds.right - this.fieldBounds.left,
        height: this.fieldBounds.bottom - this.fieldBounds.top
      },
      fieldScale: fieldScale,
      isPvPMode: false,
      isHost: true,
      useFactions: true,
      playerFaction: this.playerFaction,
      opponentFaction: 'magma',
      formation: { 
        id: 'tutorial',
        name: 'tutorial',
        teamSize: 1,
        slots: [],
        isCustom: false
      }
    });
    
    // Вспомогательная функция для получения unitId (копируем логику из EntityFactory)
    const getUnitIdByFactionAndClass = (faction: FactionId, unitClass: 'tank' | 'sniper' | 'balanced'): string => {
      const factionUnits: Record<FactionId, Record<string, string>> = {
        magma: { tank: 'magma_basalt_guard', sniper: 'magma_inferno_shooter', balanced: 'magma_ember_striker' },
        cyborg: { tank: 'cyborg_heavy_mech', sniper: 'cyborg_railgunner', balanced: 'cyborg_soldier' },
        void: { tank: 'void_abyssal_guardian', sniper: 'void_shadow_sniper', balanced: 'void_phantom' },
        insect: { tank: 'insect_beetle_tank', sniper: 'insect_mantis_striker', balanced: 'insect_worker' }
      };
      const factionMap = factionUnits[faction] || factionUnits.magma;
      return factionMap[unitClass] || factionMap.balanced;
    };
    
    // Создаём только нужные юниты игрока
    const playerUnits: any[] = [];
    config.playerUnits.forEach(def => {
      const pos = this.relativeToAbsolute(def.position.x, def.position.y);
      const unitId = getUnitIdByFactionAndClass(this.playerFaction, def.class);
      
      const unit = new Unit(
        this.scene,
        pos.x,
        pos.y,
        1 as any, // owner = 1 (player)
        unitId,
        fieldScale,
        {
          factionId: this.playerFaction,
          capClass: def.class,
          applyFactionStats: true,
          unitId: unitId
        }
      );
      
      playerUnits.push(unit);
    });
    
    // Создаём только нужные юниты ИИ
    const aiUnits: any[] = [];
    config.aiUnits.forEach(def => {
      const pos = this.relativeToAbsolute(def.position.x, def.position.y);
      const unitId = getUnitIdByFactionAndClass('magma', def.class);
      
      const unit = new Unit(
        this.scene,
        pos.x,
        pos.y,
        2 as any, // owner = 2 (AI)
        unitId,
        fieldScale,
        {
          factionId: 'magma',
          capClass: def.class,
          applyFactionStats: true,
          unitId: unitId
        }
      );
      
      aiUnits.push(unit);
    });
    
    // Создаём мяч
    const ballPos = this.relativeToAbsolute(config.ballPosition.x, config.ballPosition.y);
    this.ball = new Ball(this.scene, ballPos.x, ballPos.y, fieldScale);
    
    // Обновляем ссылки
    this.playerUnits = playerUnits;
    this.aiUnits = aiUnits;
    
    // Обновляем ссылки в scene
    if (gameScene.caps) {
      gameScene.caps = [...playerUnits, ...aiUnits];
    }
    if (gameScene.ball) {
      gameScene.ball = this.ball;
    }
    
    // Регистрируем юнитов в shootingController
    if (this.shootingController) {
      playerUnits.forEach((unit, index) => {
        this.shootingController?.registerCap?.(unit, index);
      });
      aiUnits.forEach((unit, index) => {
        this.shootingController?.registerCap?.(unit, playerUnits.length + index);
      });
    }
    
    console.log(`[TutorialManager] Situation "${type}" set up successfully`);
  }
  
  /**
   * Подсветить целевого юнита
   */
  private highlightTargetUnit(unitClass: 'tank' | 'sniper' | 'balanced'): void {
    const unit = this.findPlayerUnitByClass(unitClass);
    if (unit) {
      this.visuals.highlightUnit(unit);
      this.visuals.showArrowToUnit(unit, this.getClassDisplayName(unitClass));
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // ШАГ: ВЫБОР ЮНИТА
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Настроить шаг выбора юнита
   */
  private setupSelectStep(unitClass: 'tank' | 'sniper' | 'balanced'): void {
    const unit = this.findPlayerUnitByClass(unitClass);
    if (!unit) {
      console.error(`[TutorialManager] Cannot find ${unitClass} unit for selection`);
      this.advanceToNextStep();
      return;
    }
    
    console.log(`[TutorialManager] Setup SELECT step for: ${unitClass}`);
    
    // Подсветить юнита
    this.visuals.highlightUnit(unit);
    this.visuals.showArrowToUnit(unit, this.getClassDisplayName(unitClass));
    
    // Показать подсказку
    const hint = getHintForStep(this.currentStep);
    this.visuals.showHint(hint);
    
    // Ограничить выбор только этим юнитом
    this.shootingController?.setTutorialAllowedUnit?.(unit.id);
    
    // Ждём выбор
    this.isWaitingForAction = true;
    
    this.shootingController?.setTutorialOnUnitSelected?.((selectedId: string) => {
      if (selectedId === unit.id) {
        console.log(`[TutorialManager] Correct unit selected: ${unitClass}`);
        this.visuals.clearArrow();
        this.visuals.clearHint();
        this.advanceToNextStep();
      }
    });
  }
  
  // ═══════════════════════════════════════════════════════════════
  // ШАГ: ПРИЦЕЛИВАНИЕ И УДАР
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Настроить шаг прицеливания
   */
  private setupAimStep(unitClass: 'tank' | 'sniper' | 'balanced'): void {
    const config = TUTORIAL_SITUATIONS[unitClass];
    if (!config) {
      this.advanceToNextStep();
      return;
    }
    
    const unit = this.findPlayerUnitByClass(unitClass);
    if (!unit) {
      this.advanceToNextStep();
      return;
    }
    
    console.log(`[TutorialManager] Setup AIM step for: ${unitClass}`);
    
    // Подсветить юнита (он уже выбран)
    this.visuals.highlightUnit(unit);
    
    // Показать целевую зону
    const targetPos = this.relativeToAbsolute(config.targetZone.x, config.targetZone.y);
    this.visuals.showTargetZone(targetPos.x, targetPos.y, config.targetZoneRadius, 'ЦЕЛЬ');
    
    // Показать стрелку направления
    this.visuals.showDirectionArrow(unit.sprite.x, unit.sprite.y, targetPos.x, targetPos.y);
    
    // Показать подсказку
    const hint = getHintForStep(this.currentStep);
    this.visuals.showHint(hint);
    
    // Установить целевую зону в контроллере
    this.shootingController?.setTutorialTargetZone?.(targetPos.x, targetPos.y, config.targetZoneRadius);
    
    // Ждём удар
    this.isWaitingForAction = true;
    
    this.shootingController?.setTutorialOnShotExecuted?.(() => {
      console.log(`[TutorialManager] Shot executed for: ${unitClass}`);
      
      // Очищаем визуалы
      this.visuals.clearAll();
      
      // Ждём пока объекты остановятся
      this.waitForObjectsToStop(() => {
        this.advanceToNextStep();
      });
    });
  }
  
  /**
   * Ждать пока все объекты остановятся
   */
  private waitForObjectsToStop(callback: () => void): void {
    const checkStopped = () => {
      const allStopped = this.areAllObjectsStopped();
      
      if (allStopped) {
        console.log('[TutorialManager] All objects stopped');
        this.scene.time.delayedCall(500, callback);
      } else {
        this.scene.time.delayedCall(100, checkStopped);
      }
    };
    
    // Начинаем проверку через небольшую задержку
    this.scene.time.delayedCall(500, checkStopped);
  }
  
  /**
   * Проверить остановились ли все объекты
   */
  private areAllObjectsStopped(): boolean {
    const threshold = 0.5;
    
    // Проверяем мяч
    if (this.ball && !this.ball.isStopped?.(threshold)) {
      return false;
    }
    
    // Проверяем юнитов игрока
    for (const unit of this.playerUnits) {
      if (!unit.isStopped?.(threshold)) {
        return false;
      }
    }
    
    // Проверяем юнитов ИИ
    for (const unit of this.aiUnits) {
      if (!unit.isStopped?.(threshold)) {
        return false;
      }
    }
    
    return true;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // СКРИПТОВАННЫЙ УДАР ИИ
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Выполнить скриптованный удар ИИ
   */
  private executeAIShot(unitClass: 'tank' | 'sniper' | 'balanced'): void {
    const config = TUTORIAL_SITUATIONS[unitClass];
    if (!config || !config.aiShot) {
      console.log(`[TutorialManager] No AI shot configured for: ${unitClass}`);
      this.advanceToNextStep();
      return;
    }
    
    const { unitIndex, targetPosition, force, delay } = config.aiShot;
    const aiUnit = this.aiUnits[unitIndex];
    
    if (!aiUnit) {
      console.error(`[TutorialManager] AI unit not found at index: ${unitIndex}`);
      this.advanceToNextStep();
      return;
    }
    
    console.log(`[TutorialManager] Executing AI shot in ${delay}ms`);
    
    // Показать предупреждение
    this.visuals.showHint('⚠️ Противник атакует!');
    
    this.scene.time.delayedCall(delay, () => {
      // Рассчитываем направление удара
      const targetPos = this.relativeToAbsolute(targetPosition.x, targetPosition.y);
      const unitX = aiUnit.sprite?.x || aiUnit.body?.position?.x || 0;
      const unitY = aiUnit.sprite?.y || aiUnit.body?.position?.y || 0;
      
      const angle = Math.atan2(targetPos.y - unitY, targetPos.x - unitX);
      const shotForce = force * 0.015; // Нормализуем силу
      
      const forceX = Math.cos(angle) * shotForce;
      const forceY = Math.sin(angle) * shotForce;
      
      // Применяем силу к мячу через Matter.js API
      if (this.ball?.body) {
        const Matter = (window as any).Matter;
        if (Matter && Matter.Body) {
          Matter.Body.applyForce(
            this.ball.body as MatterJS.BodyType,
            this.ball.body.position,
            { x: forceX, y: forceY }
          );
          console.log(`[TutorialManager] AI shot applied: force=(${forceX.toFixed(3)}, ${forceY.toFixed(3)})`);
        }
      }
      
      // Ждём пока мяч остановится
      this.waitForObjectsToStop(() => {
        this.visuals.clearHint();
        this.advanceToNextStep();
      });
    });
  }
  
  // ═══════════════════════════════════════════════════════════════
  // ДИАЛОГИ
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Показать последовательность диалогов
   */
  private showDialogueSequence(dialogueKeys: string[], onComplete: () => void): void {
    if (!dialogueKeys || dialogueKeys.length === 0) {
      onComplete();
      return;
    }
    
    this.isDialogueActive = true;
    let currentIndex = 0;
    
    const showNext = () => {
      if (currentIndex >= dialogueKeys.length) {
        this.isDialogueActive = false;
        onComplete();
        return;
      }
      
      const key = dialogueKeys[currentIndex];
      const text = TUTORIAL_DIALOGUES[key] || `[Missing: ${key}]`;
      
      this.overlay.showMessage(text, () => {
        currentIndex++;
        showNext();
      });
    };
    
    showNext();
  }
  
  // ═══════════════════════════════════════════════════════════════
  // СВОБОДНАЯ ПРАКТИКА
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Запустить свободную практику
   */
  private startFreePractice(): void {
    console.log('[TutorialManager] Starting free practice (120 seconds)');
    
    // Показать диалог
    this.overlay.showMessage(TUTORIAL_DIALOGUES['practice_start'], () => {
      // Снимаем все ограничения
      this.shootingController?.clearTutorialRestrictions?.();
      this.isWaitingForAction = true;
      
      // Создаём таймер
      this.practiceTimeLeft = 120;
      this.createPracticeTimer();
      
      // Запускаем обратный отсчёт
      this.practiceTimer = this.scene.time.addEvent({
        delay: 1000,
        callback: () => {
          this.practiceTimeLeft--;
          this.updateTimerDisplay();
          
          if (this.practiceTimeLeft <= 0) {
            this.onFreePracticeEnd();
          }
        },
        repeat: this.practiceTimeLeft - 1
      });
    });
  }
  
  /**
   * Создать таймер практики
   */
  private createPracticeTimer(): void {
    const { width } = this.scene.scale;
    
    this.timerText = this.scene.add.text(width / 2, 50, '', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '28px',
      color: '#00ff00',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(100);
    
    this.updateTimerDisplay();
  }
  
  /**
   * Обновить отображение таймера
   */
  private updateTimerDisplay(): void {
    if (!this.timerText) return;
    
    const minutes = Math.floor(this.practiceTimeLeft / 60);
    const seconds = this.practiceTimeLeft % 60;
    this.timerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    
    // Меняем цвет при малом времени
    if (this.practiceTimeLeft <= 10) {
      this.timerText.setColor('#ff0000');
    } else if (this.practiceTimeLeft <= 30) {
      this.timerText.setColor('#ffff00');
    }
  }
  
  /**
   * Завершение свободной практики
   */
  private onFreePracticeEnd(): void {
    console.log('[TutorialManager] Free practice ended');
    
    if (this.practiceTimer) {
      this.practiceTimer.remove();
      this.practiceTimer = null;
    }
    
    if (this.timerText) {
      this.timerText.destroy();
      this.timerText = null;
    }
    
    this.advanceToNextStep();
  }
  
  // ═══════════════════════════════════════════════════════════════
  // ЗАВЕРШЕНИЕ
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Завершить обучение
   */
  private completeTutorial(): void {
    console.log('[TutorialManager] Tutorial completed!');
    
    // Очищаем таймер практики если активен
    if (this.practiceTimer) {
      this.practiceTimer.remove();
      this.practiceTimer = null;
    }
    if (this.timerText) {
      this.timerText.destroy();
      this.timerText = null;
    }
    
    // Показать финальные диалоги
    this.showDialogueSequence(['complete_1', 'complete_2'], () => {
      // Сохраняем прогресс
      playerData.completeTutorial();
      
      // Вызываем callback
      this.onCompleteCallback();
    });
  }
  
  // ═══════════════════════════════════════════════════════════════
  // ПРОПУСК
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Создать кнопку пропуска
   */
  private createSkipButton(): void {
    const { width } = this.scene.scale;
    
    this.skipButton = this.scene.add.container(width - 80, 40);
    this.skipButton.setDepth(150);
    
    // Фон кнопки
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRoundedRect(-50, -18, 100, 36, 8);
    bg.lineStyle(1, 0xffffff, 0.3);
    bg.strokeRoundedRect(-50, -18, 100, 36, 8);
    
    // Текст
    const text = this.scene.add.text(0, 0, 'ПРОПУСТИТЬ', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '12px',
      color: '#aaaaaa'
    }).setOrigin(0.5);
    
    this.skipButton.add([bg, text]);
    
    // Интерактивность
    this.skipButton.setInteractive(
      new Phaser.Geom.Rectangle(-50, -18, 100, 36),
      Phaser.Geom.Rectangle.Contains
    );
    
    this.skipButton.on('pointerdown', () => this.onSkipPressed());
    this.skipButton.on('pointerover', () => text.setColor('#ffffff'));
    this.skipButton.on('pointerout', () => text.setColor('#aaaaaa'));
  }
  
  /**
   * Обработка нажатия на пропуск
   */
  private onSkipPressed(): void {
    console.log('[TutorialManager] Skip pressed');
    
    // Очищаем таймер практики если активен
    if (this.practiceTimer) {
      this.practiceTimer.remove();
      this.practiceTimer = null;
    }
    if (this.timerText) {
      this.timerText.destroy();
      this.timerText = null;
    }
    
    this.overlay.showMessage('Пропустить обучение?', () => {
      // Сохраняем как завершённое
      playerData.completeTutorial();
      
      // Вызываем callback
      this.onSkipCallback();
    });
  }
  
  // ═══════════════════════════════════════════════════════════════
  // УТИЛИТЫ
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Найти юнита игрока по классу
   */
  private findPlayerUnitByClass(unitClass: string): any {
    return this.playerUnits.find(u => u.capClass === unitClass);
  }
  
  /**
   * Преобразовать относительные координаты в абсолютные
   */
  private relativeToAbsolute(relX: number, relY: number): { x: number; y: number } {
    const { left, right, top, bottom } = this.fieldBounds;
    const fieldWidth = right - left;
    const fieldHeight = bottom - top;
    
    return {
      x: left + fieldWidth * relX,
      y: top + fieldHeight * relY
    };
  }
  
  /**
   * Телепортировать юнита
   */
  private teleportUnit(unit: any, x: number, y: number): void {
    if (!unit) return;
    
    // Устанавливаем позицию физического тела
    if (unit.body) {
      unit.body.position.x = x;
      unit.body.position.y = y;
      unit.body.velocity.x = 0;
      unit.body.velocity.y = 0;
    }
    
    // Устанавливаем позицию спрайта
    if (unit.sprite) {
      unit.sprite.setPosition(x, y);
    }
    
    // Если есть метод setPosition
    if (unit.setPosition) {
      unit.setPosition(x, y);
    }
  }
  
  /**
   * Телепортировать мяч
   */
  private teleportBall(x: number, y: number): void {
    if (!this.ball) return;
    
    // Устанавливаем позицию физического тела
    if (this.ball.body) {
      this.ball.body.position.x = x;
      this.ball.body.position.y = y;
      this.ball.body.velocity.x = 0;
      this.ball.body.velocity.y = 0;
    }
    
    // Устанавливаем позицию спрайта
    if (this.ball.sprite) {
      this.ball.sprite.setPosition(x, y);
    }
    
    // Если есть метод setPosition
    if (this.ball.setPosition) {
      this.ball.setPosition(x, y);
    }
  }
  
  /**
   * Получить отображаемое название класса
   */
  private getClassDisplayName(unitClass: string): string {
    switch (unitClass) {
      case 'tank': return 'ТАНК';
      case 'sniper': return 'СНАЙПЕР';
      case 'balanced': return 'УНИВЕРСАЛ';
      default: return unitClass.toUpperCase();
    }
  }
}
