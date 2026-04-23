// src/scenes/game/systems/GameState.ts
// Система управления состоянием игры

import Phaser from 'phaser';
import { GameUnit, StartPositions } from '../types';
import { FieldBounds, PlayerNumber } from '../../../types';
import { Formation, playerData } from '../../../data/PlayerData';
import { GAME, FactionId } from '../../../constants/gameConstants';

export interface GameStateData {
  playerScore: number;
  opponentScore: number;
  currentPlayer: PlayerNumber;
  turnNumber: number;
  remainingTime: number;
  matchDuration: number;
  caps: Array<{
    id: string;
    x: number;
    y: number;
    owner: PlayerNumber;
    factionId: FactionId;
  }>;
  ball: {
    x: number;
    y: number;
  };
  playerFaction: FactionId;
  opponentFaction: FactionId;
}

export interface GameStateConfig {
  scene: Phaser.Scene;
  fieldBounds: FieldBounds;
  startPositions: StartPositions;
}

/**
 * Система управления состоянием игры
 * Отвечает за сохранение, загрузку, позиционирование
 */
export class GameState {
  private scene: Phaser.Scene;
  private fieldBounds: FieldBounds;
  private startPositions: StartPositions;
  
  // Сохранённые данные
  private storedPlayerFaction?: FactionId;
  private storedOpponentFaction?: FactionId;
  private matchDuration: number = GAME.DEFAULT_MATCH_DURATION;
  
  constructor(config: GameStateConfig) {
    this.scene = config.scene;
    this.fieldBounds = config.fieldBounds;
    this.startPositions = config.startPositions;
  }
  
  /**
   * Получение текущего состояния игры
   */
  getState(
    caps: GameUnit[],
    ball: any,
    scores: { player1: number; player2: number },
    currentPlayer: PlayerNumber,
    turnNumber: number,
    remainingTime: number
  ): GameStateData {
    return {
      playerScore: scores.player1,
      opponentScore: scores.player2,
      currentPlayer,
      turnNumber,
      remainingTime,
      matchDuration: this.matchDuration,
      caps: caps.map((cap) => ({
        id: cap.id,
        x: cap.sprite.x,
        y: cap.sprite.y,
        owner: cap.owner,
        factionId: cap.factionId,
      })),
      ball: {
        x: ball.sprite.x,
        y: ball.sprite.y,
      },
      playerFaction: this.storedPlayerFaction || 'magma',
      opponentFaction: this.storedOpponentFaction || 'cyborg',
    };
  }
  
  /**
   * Сохранение прогресса матча
   */
  saveMatchProgress(state: GameStateData): void {
    const saveKey = 'match_progress';
    const saveData = {
      state,
      timestamp: Date.now(),
    };
    
    try {
      localStorage.setItem(saveKey, JSON.stringify(saveData));
      console.log('[GameState] Match progress saved');
    } catch (error) {
      console.error('[GameState] Failed to save match progress:', error);
    }
  }
  
  /**
   * Загрузка прогресса матча
   */
  loadMatchProgress(): GameStateData | null {
    const saveKey = 'match_progress';
    
    try {
      const saveData = localStorage.getItem(saveKey);
      if (saveData) {
        const parsed = JSON.parse(saveData);
        const age = Date.now() - parsed.timestamp;
        
        // Проверяем, не устарело ли сохранение (например, 24 часа)
        if (age < 24 * 60 * 60 * 1000) {
          console.log('[GameState] Match progress loaded');
          return parsed.state;
        } else {
          console.log('[GameState] Match progress expired');
          this.clearMatchProgress();
        }
      }
    } catch (error) {
      console.error('[GameState] Failed to load match progress:', error);
    }
    
    return null;
  }
  
  /**
   * Очистка сохранённого прогресса
   */
  clearMatchProgress(): void {
    const saveKey = 'match_progress';
    localStorage.removeItem(saveKey);
    console.log('[GameState] Match progress cleared');
  }
  
  /**
   * Сброс позиций юнитов и мяча
   */
  resetPositions(caps: GameUnit[], ball: any): void {
    console.log('[GameState] Resetting positions');
    
    // Сбрасываем позиции всех юнитов из стартовых позиций
    caps.forEach((cap, index) => {
      const startPos = this.startPositions.caps[index];
      if (startPos) {
        cap.sprite.setPosition(startPos.x, startPos.y);
        // Сбрасываем физику через body
        if (cap.body) {
          (this.scene.matter as any).body.setVelocity(cap.body, { x: 0, y: 0 });
          (this.scene.matter as any).body.setAngularVelocity(cap.body, 0);
        }
      }
    });
    
    // Сбрасываем мяч
    const ballStartPos = this.startPositions.ball;
    ball.sprite.setPosition(ballStartPos.x, ballStartPos.y);
    if (ball.body) {
      (this.scene.matter as any).body.setVelocity(ball.body, { x: 0, y: 0 });
      (this.scene.matter as any).body.setAngularVelocity(ball.body, 0);
    }
  }
  
  /**
   * Обновление позиций игрока из формации
   */
  updatePlayerPositionsFromFormation(caps: GameUnit[], formation: Formation): void {
    const player1Caps = caps.filter((c) => c.owner === 1);
    
    if (formation.slots.length !== player1Caps.length) {
      console.warn('[GameState] Formation size mismatch');
      return;
    }
    
    formation.slots.forEach((slot, index) => {
      const cap = player1Caps[index];
      if (cap) {
        const absPos = this.relativeToAbsolute(slot.x, slot.y);
        cap.sprite.setPosition(absPos.x, absPos.y);
        // Сбрасываем скорость через body
        if (cap.body) {
          (this.scene.matter as any).body.setVelocity(cap.body, { x: 0, y: 0 });
        }
      }
    });
    
    console.log('[GameState] Player positions updated from formation');
  }
  
  /**
   * Конвертация относительных координат в абсолютные
   */
  relativeToAbsolute(relX: number, relY: number): { x: number; y: number } {
    const fieldWidth = this.fieldBounds.right - this.fieldBounds.left;
    const fieldHeight = this.fieldBounds.bottom - this.fieldBounds.top;
    
    const x = this.fieldBounds.left + relX * fieldWidth;
    const y = this.fieldBounds.top + relY * fieldHeight;
    
    return { x, y };
  }
  
  /**
   * Конвертация абсолютных координат в относительные
   */
  absoluteToRelative(absX: number, absY: number): { x: number; y: number } {
    const fieldWidth = this.fieldBounds.right - this.fieldBounds.left;
    const fieldHeight = this.fieldBounds.bottom - this.fieldBounds.top;
    
    const x = (absX - this.fieldBounds.left) / fieldWidth;
    const y = (absY - this.fieldBounds.top) / fieldHeight;
    
    return { x, y };
  }
  
  /**
   * Установка фракций
   */
  setFactions(playerFaction: FactionId, opponentFaction: FactionId): void {
    this.storedPlayerFaction = playerFaction;
    this.storedOpponentFaction = opponentFaction;
  }
  
  /**
   * Установка длительности матча
   */
  setMatchDuration(duration: number): void {
    this.matchDuration = duration;
  }
  
  /**
   * Получение длительности матча
   */
  getMatchDuration(): number {
    return this.matchDuration;
  }
  
  /**
   * Получение фракций
   */
  getFactions(): { player: FactionId; opponent: FactionId } {
    return {
      player: this.storedPlayerFaction || 'magma',
      opponent: this.storedOpponentFaction || 'cyborg',
    };
  }
  
  /**
   * Получение стартовых позиций
   */
  getStartPositions(): StartPositions {
    return this.startPositions;
  }
  
  /**
   * Получение границ поля
   */
  getFieldBounds(): FieldBounds {
    return this.fieldBounds;
  }
}
