// src/managers/PvPIntegrationHelper.ts
// Упрощённый помощник для интеграции PVP в GameScene

import { PvPManager } from './PvPManager';
import { PvPSyncManager } from '../scenes/game/PvPSyncManager';
import { EventBus } from '../core/EventBus';
import { PvPConfig } from '../types/pvp';

export interface PvPIntegrationConfig {
  serverUrl: string;
  isEnabled: boolean;
}

/**
 * Помощник для интеграции PVP в GameScene
 * Упрощает подключение и синхронизацию
 */
export class PvPIntegrationHelper {
  private scene: Phaser.Scene;
  private pvpManager: PvPManager;
  private syncManager: PvPSyncManager;
  private config: PvPIntegrationConfig;
  
  private registeredBall: any | null = null;
  private registeredUnits: Map<string, any> = new Map();
  
  private isConnected: boolean = false;
  private isPvPActive: boolean = false;
  private myTeam: number = 0;
  
  constructor(scene: Phaser.Scene, config: PvPIntegrationConfig) {
    this.scene = scene;
    this.config = config;
    
    // Создаём менеджеры
    this.pvpManager = PvPManager.getInstance({
      serverUrl: config.serverUrl,
    });
    
    this.syncManager = new PvPSyncManager({
      interpolationFactor: 0.25,
      desyncThreshold: 50,
    });
    
    // Подписываемся на события
    this.subscribeToEvents();
  }
  
  /**
   * Подписаться на PVP события
   */
  private subscribeToEvents(): void {
    // Connection events
    this.pvpManager.on('match_found', (data: any) => {
      console.log('[PvPIntegrationHelper] Match found!', data);
      this.myTeam = data.yourTeam;
      this.isPvPActive = true;
    });
    
    this.pvpManager.on('match_start', (data: any) => {
      console.log('[PvPIntegrationHelper] Match starting...', data);
      this.isPvPActive = true;
    });
    
    this.pvpManager.on('state_update', (data: any) => {
      // Добавляем снапшот в sync manager
      this.syncManager.addSnapshot(data.state, data.frame, data.timestamp);
    });
    
    this.pvpManager.on('match_end', (data: any) => {
      console.log('[PvPIntegrationHelper] Match ended:', data);
      this.isPvPActive = false;
    });
  }
  
  /**
   * Подключиться к серверу
   */
  public async connect(): Promise<boolean> {
    const connected = await this.pvpManager.connect();
    this.isConnected = connected;
    return connected;
  }
  
  /**
   * Отправить готовность
   */
  public sendReady(): void {
    this.pvpManager.sendReady();
  }
  
  /**
   * Зарегистрировать мяч
   */
  public registerBall(ball: any): void {
    this.registeredBall = ball;
    console.log('[PvPIntegrationHelper] Ball registered');
  }
  
  /**
   * Зарегистрировать юнит
   */
  public registerUnit(unitId: string, unit: any): void {
    this.registeredUnits.set(unitId, unit);
    console.log(`[PvPIntegrationHelper] Unit registered: ${unitId}`);
  }
  
  /**
   * Отправить удар на сервер
   */
  public sendShot(unitId: string, velocity: { x: number; y: number }): void {
    if (!this.isPvPActive) {
      console.warn('[PvPIntegrationHelper] PVP not active, cannot send shot');
      return;
    }
    
    console.log(`[PvPIntegrationHelper] 🎯 Sending shot: ${unitId}`, velocity);
    this.pvpManager.sendShot(unitId, velocity);
  }
  
  /**
   * Использовать карту
   */
  public sendUseCard(cardId: string, targetData?: any): void {
    if (!this.isPvPActive) return;
    
    this.pvpManager.sendUseCard(cardId, targetData);
  }
  
  /**
   * Обновить синхронизацию (вызывать в update)
   */
  public update(delta: number): void {
    if (!this.isPvPActive || !this.isConnected) return;
    
    // Применяем интерполированное состояние
    const units = Array.from(this.registeredUnits.values());
    
    if (this.registeredBall || units.length > 0) {
      this.syncManager.interpolateAndApply(
        this.registeredBall,
        units,
        { minX: 0, maxX: 800, minY: 0, maxY: 600 } // Примерные границы
      );
    }
  }
  
  /**
   * Очистить ресурсы
   */
  public destroy(): void {
    this.pvpManager.disconnect();
    this.syncManager.clear();
    this.registeredBall = null;
    this.registeredUnits.clear();
    this.isConnected = false;
    this.isPvPActive = false;
  }
  
  /**
   * Проверить подключение
   */
  public isConnectedToServer(): boolean {
    return this.isConnected;
  }
  
  /**
   * Проверить активность PVP
   */
  public isPvPActiveNow(): boolean {
    return this.isPvPActive;
  }
  
  /**
   * Получить мою команду
   */
  public getMyTeam(): number {
    return this.myTeam;
  }
  
  /**
   * Получить ID текущей комнаты
   */
  public getCurrentRoomId(): string | null {
    return this.pvpManager.getCurrentRoomId();
  }
}
