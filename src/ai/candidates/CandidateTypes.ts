// src/ai/candidates/CandidateTypes.ts
// Типы для системы кандидатов ударов

import { CapClass, FactionId } from '../../constants/gameConstants';

/**
 * Тип удара-кандидата
 */
export type CandidateType = 
  | 'direct_goal'      // Прямой удар по воротам
  | 'ricochet_wall'    // Удар с отскоком от стены
  | 'pass'             // Пас партнёру
  | 'block_position'   // Занять оборонительную позицию
  | 'push_enemy'       // Вытолкнуть вражескую фишку
  | 'ball_control';    // Контроль мяча (подвод ближе)

/**
 * Вектор силы удара
 */
export interface ForceVector {
  x: number;
  y: number;
  magnitude: number;
  angle: number;
}

/**
 * Кандидат на удар
 */
export interface ShotCandidate {
  id: string;
  type: CandidateType;
  unitId: string;
  force: ForceVector;
  
  // Метаданные для оценки
  targetPosition?: { x: number; y: number };
  expectedBallPosition?: { x: number; y: number };
  ricochetPoints?: { x: number; y: number }[];
  
  // Предварительная оценка (до симуляции)
  heuristicScore: number;
  
  // Оценка после симуляции
  simulatedScore?: number;
  simulationResult?: SimulationResult;
}

/**
 * Результат симуляции одного кандидата
 */
export interface SimulationResult {
  // Финальные позиции
  ballPosition: { x: number; y: number };
  ballVelocity: { x: number; y: number };
  unitPositions: Map<string, { x: number; y: number }>;
  
  // Что произошло
  goalScored: 'player' | 'opponent' | null;
  wallBounces: number;
  unitCollisions: string[];  // ID юнитов, с которыми столкнулся мяч
  
  // Метрики для скоринга
  ballDistanceToOpponentGoal: number;
  ballDistanceToOwnGoal: number;
  ownUnitsInDefenseZone: number;
  enemyUnitsPushedDistance: number;
  
  // Время симуляции (для отладки)
  simulationTicks: number;
  executionTimeMs: number;
}

/**
 * Снимок состояния игры для симуляции
 */
export interface GameSnapshot {
  timestamp: number;
  
  ball: BodySnapshot;
  
  units: {
    player: UnitSnapshot[];
    opponent: UnitSnapshot[];
  };
  
  field: {
    width: number;
    height: number;
    goalWidth: number;
    goalDepth: number;
  };
  
  // Текущий счёт (для адаптивной игры)
  score: {
    player: number;
    opponent: number;
  };
}

/**
 * Снимок физического тела
 */
export interface BodySnapshot {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  radius: number;
  mass: number;
  restitution: number;
  friction: number;
  frictionAir: number;
}

/**
 * Снимок юнита с дополнительными данными
 */
export interface UnitSnapshot extends BodySnapshot {
  owner: 1 | 2;
  capClass: CapClass;
  factionId: FactionId;
  canCurve: boolean;
  curveStrength: number;
}

/**
 * Конфигурация симуляции
 */
export interface SimulationConfig {
  // Сколько тиков симулировать (60 тиков = 1 секунда при 60 FPS)
  maxTicks: number;
  
  // Порог остановки (если все объекты медленнее - останавливаем)
  stopThreshold: number;
  
  // Прерывать симуляцию при голе
  stopOnGoal: boolean;
  
  // Точность физики (iterations)
  positionIterations: number;
  velocityIterations: number;
}

/**
 * Контекст для генерации кандидатов
 */
export interface CandidateGenerationContext {
  snapshot: GameSnapshot;
  aiPlayer: 1 | 2;
  difficulty: 'easy' | 'medium' | 'hard';
  
  // Тактическая ситуация
  isDefending: boolean;
  isAttacking: boolean;
  scoreDifference: number;  // + если AI впереди
  
  // Настройки генерации
  maxCandidates: number;
  includeRicochet: boolean;
  includePass: boolean;
}

/**
 * Веса для функции оценки
 */
export interface ScoringWeights {
  goalScored: number;           // +100 за гол в ворота противника
  ownGoal: number;              // -100 за автогол
  ballNearOpponentGoal: number; // +50 за приближение к воротам
  ballNearOwnGoal: number;      // -30 за приближение к своим воротам
  enemyPushed: number;          // +20 за выталкивание врага
  defensePosition: number;      // +20 за блокирующую позицию
  openedOwnGoal: number;        // -30 за открытие своих ворот
  ballControl: number;          // +10 за контроль мяча
  ricochetBonus: number;        // +5 за успешный рикошет (для trickster)
}