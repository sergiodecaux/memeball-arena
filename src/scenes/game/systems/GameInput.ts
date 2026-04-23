// src/scenes/game/systems/GameInput.ts
// Система обработки ввода для GameScene

import Phaser from 'phaser';
import { GameUnit } from '../types';
import { eventBus, GameEvents } from '../../../core/EventBus';
import { PlayerNumber } from '../../../types';

export interface GameInputConfig {
  scene: Phaser.Scene;
  onCapSelected?: (cap: GameUnit | null) => void;
  onShoot?: (cap: GameUnit, force: Phaser.Math.Vector2) => void;
  isAbilityActive?: () => boolean;
  getCurrentPlayer?: () => PlayerNumber;
  getMyOwner?: () => PlayerNumber;
}

/**
 * Система обработки ввода для игровой сцены
 * Отвечает за обработку тапов, drag, выбор юнитов
 */
export class GameInput {
  private scene: Phaser.Scene;
  private config: GameInputConfig;
  
  // Состояние
  private selectedCap: GameUnit | null = null;
  private selectedCapId?: string;
  private isAbilityInputActive: boolean = false;
  private isCardTooltipOpen: boolean = false;
  
  constructor(config: GameInputConfig) {
    this.scene = config.scene;
    this.config = config;
  }
  
  /**
   * Настройка глобального ввода
   */
  setup(): void {
    this.scene.input.on('gameobjectdown', this.onGameObjectDown, this);
    
    // Подписка на события способностей (используем существующие события)
    eventBus.on(GameEvents.ABILITY_ACTIVATION_STARTED, this.onAbilityTargetingStart, this);
    eventBus.on(GameEvents.ABILITY_ACTIVATION_CANCELLED, this.onAbilityTargetingEnd, this);
    eventBus.on(GameEvents.CARD_ACTIVATION_STARTED, this.onAbilityTargetingStart, this);
    eventBus.on(GameEvents.CARD_ACTIVATION_CANCELLED, this.onAbilityTargetingEnd, this);
  }
  
  /**
   * Очистка
   */
  cleanup(): void {
    this.scene.input.off('gameobjectdown', this.onGameObjectDown, this);
    
    eventBus.off(GameEvents.ABILITY_ACTIVATION_STARTED, this.onAbilityTargetingStart, this);
    eventBus.off(GameEvents.ABILITY_ACTIVATION_CANCELLED, this.onAbilityTargetingEnd, this);
    eventBus.off(GameEvents.CARD_ACTIVATION_STARTED, this.onAbilityTargetingStart, this);
    eventBus.off(GameEvents.CARD_ACTIVATION_CANCELLED, this.onAbilityTargetingEnd, this);
  }
  
  /**
   * Обработка нажатия на игровой объект
   */
  private onGameObjectDown(pointer: Phaser.Input.Pointer, gameObject: any): void {
    // Проверяем, активен ли ввод способности
    if (this.shouldAbilityHandleInput()) {
      console.log('[GameInput] Ability is handling input, skip tap');
      return;
    }
    
    // Проверяем, открыт ли тултип карточки
    if (this.isCardTooltipOpen) {
      console.log('[GameInput] Card tooltip is open, skip tap');
      return;
    }
    
    // Ищем юнит
    const tappedUnit = this.findTappedUnit(gameObject);
    
    if (tappedUnit) {
      this.handleCapSelection(tappedUnit);
    } else {
      // Нажатие вне юнитов - снимаем выделение
      this.handleCapSelection(null);
    }
  }
  
  /**
   * Проверка, должна ли способность обрабатывать ввод
   */
  private shouldAbilityHandleInput(): boolean {
    if (this.config.isAbilityActive) {
      return this.config.isAbilityActive();
    }
    return this.isAbilityInputActive;
  }
  
  /**
   * Поиск нажатого юнита
   */
  private findTappedUnit(gameObject: any): GameUnit | undefined {
    // Проверяем, является ли объект юнитом или его частью
    if (gameObject?.getData) {
      const unitId = gameObject.getData('unitId');
      if (unitId) {
        // Получаем юнит через callback или поиск
        // TODO: Нужен доступ к списку юнитов
        return gameObject as GameUnit;
      }
    }
    
    // Проверяем родительский контейнер
    if (gameObject?.parentContainer) {
      return this.findTappedUnit(gameObject.parentContainer);
    }
    
    return undefined;
  }
  
  /**
   * Обработка выбора юнита
   */
  private handleCapSelection(cap: GameUnit | null): void {
    // Проверяем, принадлежит ли юнит текущему игроку
    if (cap) {
      const currentPlayer = this.config.getCurrentPlayer?.() || 1;
      const myOwner = this.config.getMyOwner?.() || 1;
      
      if (cap.owner !== currentPlayer || cap.owner !== myOwner) {
        console.log('[GameInput] Cap does not belong to current player');
        return;
      }
    }
    
    this.selectedCap = cap;
    this.selectedCapId = cap?.id;
    
    // Вызываем callback
    if (this.config.onCapSelected) {
      this.config.onCapSelected(cap);
    }
    
    // Эмитим событие (используем SHOT_STARTED как аналог)
    if (cap) {
      eventBus.emit(GameEvents.SHOT_STARTED, { unitId: cap.id });
    }
  }
  
  /**
   * Начало таргетирования способности
   */
  private onAbilityTargetingStart(): void {
    this.isAbilityInputActive = true;
    console.log('[GameInput] Ability targeting started, input locked');
  }
  
  /**
   * Конец таргетирования способности
   */
  private onAbilityTargetingEnd(): void {
    this.isAbilityInputActive = false;
    console.log('[GameInput] Ability targeting ended, input unlocked');
  }
  
  /**
   * Установка состояния тултипа карточки
   */
  setCardTooltipOpen(isOpen: boolean): void {
    this.isCardTooltipOpen = isOpen;
  }
  
  /**
   * Получение выбранного юнита
   */
  getSelectedCap(): GameUnit | null {
    return this.selectedCap;
  }
  
  /**
   * Получение ID выбранного юнита
   */
  getSelectedCapId(): string | undefined {
    return this.selectedCapId;
  }
  
  /**
   * Сброс выбора
   */
  clearSelection(): void {
    this.selectedCap = null;
    this.selectedCapId = undefined;
    
    if (this.config.onCapSelected) {
      this.config.onCapSelected(null);
    }
  }
  
  /**
   * Проверка активности ввода способности
   */
  isAbilityInputLocked(): boolean {
    return this.isAbilityInputActive;
  }
}
