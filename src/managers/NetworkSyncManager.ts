// src/managers/NetworkSyncManager.ts

/**
 * Менеджер сетевой синхронизации для PvP
 * 
 * Реализует:
 * 1. Client-Side Prediction - локальная физика работает сразу
 * 2. Server Reconciliation - сервер корректирует позиции
 * 3. Entity Interpolation - плавное отображение объектов
 * 4. Snapshot Buffer - буфер состояний для интерполяции
 */

export interface Snapshot {
  tick: number;
  timestamp: number;
  ball: { x: number; y: number; vx: number; vy: number };
  caps: { x: number; y: number; vx: number; vy: number }[];
}

export interface PendingShot {
  tick: number;
  timestamp: number;
  capId: number;
  velocity: { x: number; y: number };
  startPosition: { x: number; y: number };
}

export class NetworkSyncManager {
  private scene: Phaser.Scene;
  private isHost: boolean;
  
  // Буфер снапшотов для интерполяции (храним последние 1 секунду)
  private snapshotBuffer: Snapshot[] = [];
  private readonly MAX_SNAPSHOTS = 20;
  
  // Текущий тик (синхронизирован с сервером)
  private currentTick = 0;
  private tickRate = 20; // 20 тиков в секунду (50мс между тиками)
  private msPerTick = 50;
  
  // Время интерполяции (насколько "в прошлом" мы показываем объекты)
  private interpolationDelay = 100; // мс
  
  // Время сервера (синхронизируем через ping)
  private serverTimeOffset = 0;
  private lastPingTime = 0;
  private rtt = 0; // Round Trip Time
  
  // Pending shots для reconciliation
  private pendingShots: PendingShot[] = [];
  
  // Callbacks
  private onInterpolatedState?: (state: Snapshot) => void;
  
  constructor(scene: Phaser.Scene, isHost: boolean) {
    this.scene = scene;
    this.isHost = isHost;
  }

  /**
   * Инициализация с данными сервера
   */
  init(serverTime: number): void {
    const clientTime = performance.now();
    this.serverTimeOffset = serverTime - clientTime;
    this.currentTick = Math.floor(serverTime / this.msPerTick);
    
    console.log(`[NetworkSync] Initialized. Server offset: ${this.serverTimeOffset.toFixed(0)}ms`);
  }

  /**
   * Получить текущее время сервера
   */
  getServerTime(): number {
    return performance.now() + this.serverTimeOffset;
  }

  /**
   * Получить текущий тик
   */
  getCurrentTick(): number {
    return Math.floor(this.getServerTime() / this.msPerTick);
  }

  /**
   * Обработка пинга для синхронизации времени
   */
  onPong(serverTime: number): void {
    const now = performance.now();
    this.rtt = now - this.lastPingTime;
    
    // Корректируем offset с учётом RTT/2
    const estimatedServerTime = serverTime + this.rtt / 2;
    this.serverTimeOffset = estimatedServerTime - now;
    
    console.log(`[NetworkSync] RTT: ${this.rtt.toFixed(0)}ms, Offset: ${this.serverTimeOffset.toFixed(0)}ms`);
  }

  sendPing(sendFunc: (time: number) => void): void {
    this.lastPingTime = performance.now();
    sendFunc(this.lastPingTime);
  }

  /**
   * Добавить снапшот от сервера в буфер
   */
  addSnapshot(snapshot: Snapshot): void {
    // Добавляем в буфер
    this.snapshotBuffer.push(snapshot);
    
    // Ограничиваем размер буфера
    while (this.snapshotBuffer.length > this.MAX_SNAPSHOTS) {
      this.snapshotBuffer.shift();
    }
    
    // Сортируем по тику (на случай если пришли не по порядку)
    this.snapshotBuffer.sort((a, b) => a.tick - b.tick);
  }

  /**
   * Получить интерполированное состояние для рендеринга
   * Возвращает состояние "в прошлом" на interpolationDelay мс
   */
  getInterpolatedState(): Snapshot | null {
    if (this.snapshotBuffer.length < 2) return null;
    
    // Время рендеринга (в прошлом)
    const renderTime = this.getServerTime() - this.interpolationDelay;
    const renderTick = renderTime / this.msPerTick;
    
    // Ищем два снапшота для интерполяции
    let older: Snapshot | null = null;
    let newer: Snapshot | null = null;
    
    for (let i = 0; i < this.snapshotBuffer.length - 1; i++) {
      if (this.snapshotBuffer[i].tick <= renderTick && 
          this.snapshotBuffer[i + 1].tick >= renderTick) {
        older = this.snapshotBuffer[i];
        newer = this.snapshotBuffer[i + 1];
        break;
      }
    }
    
    if (!older || !newer) {
      // Нет подходящих снапшотов - используем последний
      return this.snapshotBuffer[this.snapshotBuffer.length - 1];
    }
    
    // Интерполяция
    const tickDiff = newer.tick - older.tick;
    const t = tickDiff > 0 ? (renderTick - older.tick) / tickDiff : 0;
    const clampedT = Math.max(0, Math.min(1, t));
    
    return this.lerpSnapshot(older, newer, clampedT);
  }

  /**
   * Линейная интерполяция между двумя снапшотами
   */
  private lerpSnapshot(a: Snapshot, b: Snapshot, t: number): Snapshot {
    const lerp = (v1: number, v2: number) => v1 + (v2 - v1) * t;
    
    return {
      tick: Math.floor(lerp(a.tick, b.tick)),
      timestamp: lerp(a.timestamp, b.timestamp),
      ball: {
        x: lerp(a.ball.x, b.ball.x),
        y: lerp(a.ball.y, b.ball.y),
        vx: lerp(a.ball.vx, b.ball.vx),
        vy: lerp(a.ball.vy, b.ball.vy),
      },
      caps: a.caps.map((cap, i) => ({
        x: lerp(cap.x, b.caps[i].x),
        y: lerp(cap.y, b.caps[i].y),
        vx: lerp(cap.vx, b.caps[i].vx),
        vy: lerp(cap.vy, b.caps[i].vy),
      })),
    };
  }

  /**
   * Регистрация локального удара (для reconciliation)
   */
  registerLocalShot(capId: number, velocity: { x: number; y: number }, startPosition: { x: number; y: number }): void {
    this.pendingShots.push({
      tick: this.getCurrentTick(),
      timestamp: this.getServerTime(),
      capId,
      velocity,
      startPosition,
    });
  }

  /**
   * Reconciliation: сравнение серверного состояния с локальным prediction
   */
  reconcile(serverSnapshot: Snapshot, localSnapshot: Snapshot): {
    needsCorrection: boolean;
    ballDelta: number;
    capDeltas: number[];
  } {
    const ballDelta = Math.hypot(
      serverSnapshot.ball.x - localSnapshot.ball.x,
      serverSnapshot.ball.y - localSnapshot.ball.y
    );
    
    const capDeltas = serverSnapshot.caps.map((serverCap, i) => {
      const localCap = localSnapshot.caps[i];
      return Math.hypot(serverCap.x - localCap.x, serverCap.y - localCap.y);
    });
    
    const maxCapDelta = Math.max(...capDeltas);
    const needsCorrection = ballDelta > 50 || maxCapDelta > 50;
    
    return { needsCorrection, ballDelta, capDeltas };
  }

  /**
   * Очистка pending shots старше определённого тика
   */
  cleanupPendingShots(acknowledgedTick: number): void {
    this.pendingShots = this.pendingShots.filter(shot => shot.tick > acknowledgedTick);
  }

  /**
   * Очистка буфера
   */
  clear(): void {
    this.snapshotBuffer = [];
    this.pendingShots = [];
  }

  getRTT(): number {
    return this.rtt;
  }

  getBufferSize(): number {
    return this.snapshotBuffer.length;
  }
}