// src/ai/simulation/SimulationManager.ts
// Менеджер симуляций - автоматически выбирает лучший способ

import { PhysicsSimulator } from './PhysicsSimulator';
import { SimulationWorkerManager } from './SimulationWorker';
import { TimeSlicedSimulator } from './TimeSlicedSimulator';
import { 
  GameSnapshot, 
  SimulationResult, 
  ShotCandidate,
  SimulationConfig 
} from '../candidates/CandidateTypes';

export type SimulationMode = 'worker' | 'time-sliced' | 'sync';

/**
 * Менеджер симуляций
 * Автоматически выбирает оптимальный способ симуляции
 */
export class SimulationManager {
  private workerManager: SimulationWorkerManager;
  private timeSlicedSimulator: TimeSlicedSimulator;
  private syncSimulator: PhysicsSimulator;
  
  private mode: SimulationMode = 'sync';
  private isInitialized = false;

  constructor() {
    this.workerManager = new SimulationWorkerManager();
    this.timeSlicedSimulator = new TimeSlicedSimulator();
    this.syncSimulator = new PhysicsSimulator();
  }

  /**
   * Инициализация - пробует включить Web Worker
   */
  async init(): Promise<SimulationMode> {
    if (this.isInitialized) {
      return this.mode;
    }

    // Пробуем Web Worker
    const workerReady = await this.workerManager.init();
    
    if (workerReady) {
      this.mode = 'worker';
      console.log('[SimulationManager] Using Web Worker mode');
    } else {
      // Fallback на time-sliced
      this.mode = 'time-sliced';
      console.log('[SimulationManager] Using Time-Sliced mode (Worker unavailable)');
    }

    this.isInitialized = true;
    return this.mode;
  }

  /**
   * Принудительно устанавливает режим
   */
  setMode(mode: SimulationMode): void {
    this.mode = mode;
    console.log(`[SimulationManager] Mode set to: ${mode}`);
  }

  /**
   * Возвращает текущий режим
   */
  getMode(): SimulationMode {
    return this.mode;
  }

  /**
   * Симулирует один удар
   */
  async simulate(
    snapshot: GameSnapshot,
    unitId: string,
    force: { x: number; y: number; magnitude: number; angle: number },
    config?: Partial<SimulationConfig>
  ): Promise<SimulationResult> {
    switch (this.mode) {
      case 'worker':
        return this.workerManager.simulate(snapshot, unitId, force, config);
      
      case 'time-sliced':
        this.timeSlicedSimulator.setSnapshot(snapshot);
        this.timeSlicedSimulator.setConfig(config || {});
        return this.timeSlicedSimulator.enqueue({
          id: 'single',
          type: 'direct_goal',
          unitId,
          force,
          heuristicScore: 0,
        });
      
      case 'sync':
      default:
        this.syncSimulator.loadSnapshot(snapshot);
        return this.syncSimulator.simulate(unitId, force, config);
    }
  }

  /**
   * Симулирует пакет кандидатов
   */
  async simulateBatch(
    snapshot: GameSnapshot,
    candidates: ShotCandidate[],
    config?: Partial<SimulationConfig>
  ): Promise<Map<string, SimulationResult>> {
    const results = new Map<string, SimulationResult>();

    switch (this.mode) {
      case 'worker': {
        const workerCandidates = candidates.map(c => ({
          id: c.id,
          unitId: c.unitId,
          force: c.force,
        }));
        
        const batchResults = await this.workerManager.batchSimulate(
          snapshot,
          workerCandidates,
          config
        );
        
        for (const result of batchResults) {
          results.set(result.candidateId, result);
        }
        break;
      }
      
      case 'time-sliced': {
        this.timeSlicedSimulator.setSnapshot(snapshot);
        this.timeSlicedSimulator.setConfig(config || {});
        
        const promises = candidates.map(async (c) => {
          const result = await this.timeSlicedSimulator.enqueue(c);
          return { id: c.id, result };
        });
        
        const resolved = await Promise.all(promises);
        for (const { id, result } of resolved) {
          results.set(id, result);
        }
        break;
      }
      
      case 'sync':
      default: {
        for (const candidate of candidates) {
          this.syncSimulator.loadSnapshot(snapshot);
          const result = this.syncSimulator.simulate(
            candidate.unitId,
            candidate.force,
            config
          );
          results.set(candidate.id, result);
        }
        break;
      }
    }

    return results;
  }

  /**
   * Уничтожает менеджер
   */
  destroy(): void {
    this.workerManager.destroy();
    this.timeSlicedSimulator.destroy();
    this.syncSimulator.destroy();
  }
}