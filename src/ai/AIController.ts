// src/ai/AIController.ts

import Phaser from 'phaser';
import { Cap } from '../entities/Cap';
import { Ball } from '../entities/Ball';
import { 
  AIDifficulty, 
  AIDifficultySettings, 
  AIStrategy, 
  AIMoveEvaluation,
  FieldBounds,
  PlayerNumber 
} from '../types';
import { AIUtils } from './AIUtils';
import { SHOOTING, BALL } from '../constants/gameConstants';

/**
 * Настройки для каждого уровня сложности
 */
const DIFFICULTY_SETTINGS: Record<AIDifficulty, AIDifficultySettings> = {
  easy: {
    accuracy: 0.6,
    reactionDelay: 1500,
    mistakeChance: 0.3,
    forceVariation: 0.3,
    strategicDepth: 1,
  },
  medium: {
    accuracy: 0.8,
    reactionDelay: 800,
    mistakeChance: 0.15,
    forceVariation: 0.15,
    strategicDepth: 2,
  },
  hard: {
    accuracy: 0.95,
    reactionDelay: 400,
    mistakeChance: 0.05,
    forceVariation: 0.05,
    strategicDepth: 3,
  },
};

/**
 * AI контроллер для управления ботом
 */
export class AIController {
  private scene: Phaser.Scene;
  private difficulty: AIDifficulty;
  private settings: AIDifficultySettings;
  private playerNumber: PlayerNumber;
  private fieldBounds: FieldBounds;
  private isThinking: boolean = false;
  
  // Callback для выполнения хода
  private onMoveCallback: ((cap: Cap, forceX: number, forceY: number) => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    playerNumber: PlayerNumber,
    fieldBounds: FieldBounds,
    difficulty: AIDifficulty = 'medium'
  ) {
    this.scene = scene;
    this.playerNumber = playerNumber;
    this.fieldBounds = fieldBounds;
    this.difficulty = difficulty;
    this.settings = DIFFICULTY_SETTINGS[difficulty];
    
    console.log(`🤖 AI initialized: Player ${playerNumber}, Difficulty: ${difficulty}`);
  }

  /**
   * Устанавливает callback для выполнения хода
   */
  onMove(callback: (cap: Cap, forceX: number, forceY: number) => void): void {
    this.onMoveCallback = callback;
  }

  /**
   * Меняет сложность
   */
  setDifficulty(difficulty: AIDifficulty): void {
    this.difficulty = difficulty;
    this.settings = DIFFICULTY_SETTINGS[difficulty];
    console.log(`🤖 AI difficulty changed to: ${difficulty}`);
  }

  /**
   * Проверяет, думает ли AI сейчас
   */
  isProcessing(): boolean {
    return this.isThinking;
  }

  /**
   * AI делает ход
   */
  makeMove(caps: Cap[], ball: Ball, enemyCaps: Cap[]): void {
    if (this.isThinking) {
      console.log('🤖 AI is already thinking...');
      return;
    }

    this.isThinking = true;
    console.log(`🤖 AI (Player ${this.playerNumber}) is thinking...`);

    // Задержка перед ходом (имитация "размышления")
    this.scene.time.delayedCall(this.settings.reactionDelay, () => {
      this.executeMove(caps, ball, enemyCaps);
    });
  }

  /**
   * Выполняет ход после "размышления"
   */
  private executeMove(caps: Cap[], ball: Ball, enemyCaps: Cap[]): void {
    // Фильтруем только свои фишки
    const myCaps = caps.filter(cap => cap.owner === this.playerNumber);
    
    if (myCaps.length === 0) {
      console.log('🤖 No caps available!');
      this.isThinking = false;
      return;
    }

    // Выбираем лучший ход
    const bestMove = this.evaluateBestMove(myCaps, ball, enemyCaps);
    
    if (!bestMove) {
      console.log('🤖 Could not find a good move, making random move');
      this.makeRandomMove(myCaps, ball);
      return;
    }

    console.log(`🤖 AI chose strategy: ${bestMove.strategy}, score: ${bestMove.score.toFixed(2)}`);

    // Применяем ошибку точности
    let { angle, force } = this.applyAccuracyError(bestMove.angle, bestMove.force);

    // Проверяем шанс на грубую ошибку
    if (Math.random() < this.settings.mistakeChance) {
      console.log('🤖 AI made a mistake!');
      angle += (Math.random() - 0.5) * Math.PI * 0.5; // Большая ошибка угла
      force *= 0.5 + Math.random() * 0.5; // Ошибка силы
    }

    // Вычисляем силу удара
    const forceX = Math.cos(angle) * force;
    const forceY = Math.sin(angle) * force;

    // Выполняем удар
    if (this.onMoveCallback) {
      this.onMoveCallback(bestMove.cap, forceX, forceY);
    }

    this.isThinking = false;
  }

  /**
   * Оценивает все возможные ходы и выбирает лучший
   */
  private evaluateBestMove(
    myCaps: Cap[],
    ball: Ball,
    enemyCaps: Cap[]
  ): AIMoveEvaluation | null {
    const ballPos = AIUtils.getBallPosition(ball);
    const isPlayer2 = this.playerNumber === 2;
    const enemyGoal = AIUtils.getEnemyGoalCenter(this.fieldBounds, isPlayer2);
    const ownGoal = AIUtils.getOwnGoalCenter(this.fieldBounds, isPlayer2);

    // Определяем стратегию на основе позиции мяча
    const dangerLevel = AIUtils.evaluateDangerLevel(ball, this.fieldBounds, isPlayer2);
    const attackOpportunity = AIUtils.evaluateAttackOpportunity(ball, this.fieldBounds, isPlayer2);

    let strategy: AIStrategy;
    if (dangerLevel > 0.6) {
      strategy = 'defend';
    } else if (attackOpportunity > 0.5) {
      strategy = 'attack';
    } else {
      strategy = 'intercept';
    }

    console.log(`🤖 Danger: ${dangerLevel.toFixed(2)}, Attack: ${attackOpportunity.toFixed(2)}, Strategy: ${strategy}`);

    const evaluations: AIMoveEvaluation[] = [];

    for (const cap of myCaps) {
      const capPos = AIUtils.getCapPosition(cap);
      const distToBall = AIUtils.distance(capPos, ballPos);

      let score = 0;
      let targetX: number;
      let targetY: number;
      let angle: number;
      let force: number;

      switch (strategy) {
        case 'attack':
          // Бьём по мячу в сторону ворот противника
          const hitPoint = AIUtils.calculateHitPoint(
            ballPos, 
            enemyGoal, 
            BALL.RADIUS, 
            cap.getRadius()
          );
          
          targetX = hitPoint.x;
          targetY = hitPoint.y;
          angle = AIUtils.angleTo(capPos, hitPoint);
          
          // Оценка: ближе к мячу = лучше, sniper получает бонус за дальние удары
          score = 100 - distToBall * 0.5;
          if (cap.capClass === 'sniper') score += 20;
          if (distToBall < 150) score += 30;
          
          // Сила зависит от расстояния до точки удара
          force = this.calculateOptimalForce(cap, capPos, hitPoint);
          break;

        case 'defend':
          // Встаём между мячом и своими воротами
          const blockPoint = this.calculateBlockPoint(ballPos, ownGoal, capPos);
          
          targetX = blockPoint.x;
          targetY = blockPoint.y;
          angle = AIUtils.angleTo(capPos, blockPoint);
          
          // Оценка: tank лучше для защиты
          score = 80 - distToBall * 0.3;
          if (cap.capClass === 'tank') score += 30;
          if (distToBall < 200) score += 20;
          
          force = this.calculateOptimalForce(cap, capPos, blockPoint) * 0.7;
          break;

        case 'intercept':
        default:
          // Двигаемся к мячу
          targetX = ballPos.x;
          targetY = ballPos.y;
          angle = AIUtils.angleTo(capPos, ballPos);
          
          score = 60 - distToBall * 0.4;
          if (cap.capClass === 'balanced') score += 15;
          
          force = this.calculateOptimalForce(cap, capPos, ballPos) * 0.8;
          break;
      }

      evaluations.push({
        cap,
        score,
        strategy,
        targetX,
        targetY,
        angle,
        force,
      });
    }

    // Сортируем по оценке и возвращаем лучший ход
    evaluations.sort((a, b) => b.score - a.score);
    
    return evaluations[0] || null;
  }

  /**
   * Вычисляет точку для блокировки (между мячом и воротами)
   */
  private calculateBlockPoint(
    ballPos: { x: number; y: number },
    goalPos: { x: number; y: number },
    capPos: { x: number; y: number }
  ): { x: number; y: number } {
    // Точка на линии между мячом и воротами, ближе к мячу
    const t = 0.3; // 30% от мяча к воротам
    return {
      x: ballPos.x + (goalPos.x - ballPos.x) * t,
      y: ballPos.y + (goalPos.y - ballPos.y) * t,
    };
  }

  /**
   * Вычисляет оптимальную силу удара
   */
  private calculateOptimalForce(
    cap: Cap,
    from: { x: number; y: number },
    to: { x: number; y: number }
  ): number {
    const distance = AIUtils.distance(from, to);
    
    // Нормализуем расстояние к силе
    const normalizedDist = Math.min(distance / SHOOTING.MAX_DRAG_DISTANCE, 1);
    
    // Базовая сила с учётом класса фишки
    let force = normalizedDist * cap.stats.maxForce;
    
    // Sniper бьёт сильнее на дальние расстояния
    if (cap.capClass === 'sniper' && distance > 200) {
      force *= 1.2;
    }
    
    // Tank бьёт слабее
    if (cap.capClass === 'tank') {
      force *= 0.8;
    }
    
    return Math.min(force, cap.stats.maxForce);
  }

  /**
   * Применяет ошибку точности на основе сложности
   */
  private applyAccuracyError(
    angle: number,
    force: number
  ): { angle: number; force: number } {
    const accuracyError = (1 - this.settings.accuracy) * Math.PI * 0.3;
    const forceError = this.settings.forceVariation;

    return {
      angle: AIUtils.addAngleError(angle, accuracyError),
      force: AIUtils.addForceError(force, forceError),
    };
  }

  /**
   * Делает случайный ход (fallback)
   */
  private makeRandomMove(myCaps: Cap[], ball: Ball): void {
    const randomCap = myCaps[Math.floor(Math.random() * myCaps.length)];
    const ballPos = AIUtils.getBallPosition(ball);
    const capPos = AIUtils.getCapPosition(randomCap);
    
    const angle = AIUtils.angleTo(capPos, ballPos);
    const force = randomCap.stats.maxForce * (0.3 + Math.random() * 0.5);
    
    const forceX = Math.cos(angle) * force;
    const forceY = Math.sin(angle) * force;

    if (this.onMoveCallback) {
      this.onMoveCallback(randomCap, forceX, forceY);
    }

    this.isThinking = false;
  }

  /**
   * Уничтожает контроллер
   */
  destroy(): void {
    this.onMoveCallback = null;
  }
}