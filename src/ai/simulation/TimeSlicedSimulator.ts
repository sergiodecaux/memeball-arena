// src/ai/simulation/TimeSlicedSimulator.ts
// Симулятор с разбиением на кадры для плавной работы без Web Worker

import { PhysicsSimulator } from './PhysicsSimulator';
import { 
  GameSnapshot, 
  SimulationResult, 
  ShotCandidate,
  SimulationConfig 
} from '../candidates/CandidateTypes';

interface SimulationTask {
  candidate: ShotCandidate;
  resolve: (result: SimulationResult) => void;
  reject: (error: Error) => void;
}

/**
 * Time-sliced симулятор для основного потока
 * Разбивает симуляции на несколько кадров чтобы не блокировать UI
 */
export class TimeSlicedSimulator {
  private simulator: PhysicsSimulator;
  private taskQueue: SimulationTask[] = [];
  private isProcessing = false;
  private snapshot: GameSnapshot | null = null;
  private config: Partial<SimulationConfig> = {};
  
  // Настройки time slicing
  private maxTimePerFrame = 8; // ms - максимум времени на кадр
  private simulationsPerFrame = 2; // Сколько симуляций за раз

  constructor() {
    this.simulator = new PhysicsSimulator();
  }

  /**
   * Устанавливает снимок для всех симуляций
   */
  setSnapshot(snapshot: GameSnapshot): void {
    this.snapshot = snapshot;
  }

  /**
   * Устанавливает конфиг симуляций
   */
  setConfig(config: Partial<SimulationConfig>): void {
    this.config = config;
  }

  /**
   * Добавляет кандидата в очередь на симуляцию
   */
  enqueue(candidate: ShotCandidate): Promise<SimulationResult> {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ candidate, resolve, reject });
      
      if (!this.isProcessing) {
        this.processNextFrame();
      }
    });
  }

  /**
   * Добавляет пакет кандидатов
   */
  enqueueBatch(candidates: ShotCandidate[]): Promise<SimulationResult[]> {
    const promises = candidates.map(c => this.enqueue(c));
    return Promise.all(promises);
  }

  /**
   * Обрабатывает следующий кадр
   */
  private processNextFrame(): void {
    if (this.taskQueue.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const startTime = performance.now();
    let processed = 0;

    while (
      this.taskQueue.length > 0 &&
      processed < this.simulationsPerFrame &&
      (performance.now() - startTime) < this.maxTimePerFrame
    ) {
      const task = this.taskQueue.shift()!;
      this.processTask(task);
      processed++;
    }

    // Планируем следующий кадр
    if (this.taskQueue.length > 0) {
      requestAnimationFrame(() => this.processNextFrame());
    } else {
      this.isProcessing = false;
    }
  }

  /**
   * Обрабатывает одну задачу
   */
  private processTask(task: SimulationTask): void {
    if (!this.snapshot) {
      task.reject(new Error('No snapshot set'));
      return;
    }

    try {
      this.simulator.loadSnapshot(this.snapshot);
      const result = this.simulator.simulate(
        task.candidate.unitId,
        task.candidate.force,
        this.config
      );
      task.resolve(result);
    } catch (error) {
      task.reject(error as Error);
    }
  }

  /**
   * Очищает очередь
   */
  clear(): void {
    for (const task of this.taskQueue) {
      task.reject(new Error('Queue cleared'));
    }
    this.taskQueue = [];
    this.isProcessing = false;
  }

  /**
   * Возвращает размер очереди
   */
  getQueueSize(): number {
    return this.taskQueue.length;
  }

  /**
   * Проверяет, идёт ли обработка
   */
  isRunning(): boolean {
    return this.isProcessing;
  }

  /**
   * Уничтожает симулятор
   */
  destroy(): void {
    this.clear();
    this.simulator.destroy();
  }
}