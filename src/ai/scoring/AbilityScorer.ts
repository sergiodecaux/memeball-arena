// ✅ СОЗДАНО: Утилита для оценки полезности карт AI

import Phaser from 'phaser';
import { Ball } from '../../entities/Ball';
import { FactionId, FACTIONS } from '../../constants/gameConstants';
import { CardDefinition, getCardsByFaction } from '../../data/CardsCatalog';
import { PlayerNumber } from '../../types';

// ============================================================
// ТИПЫ
// ============================================================

export interface AIUnit {
  body: MatterJS.BodyType;
  owner: PlayerNumber;
  id: string;
  x: number;
  y: number;
  getRadius(): number;
  getCapClass(): string;
  getFactionId?(): FactionId;
  getSpeed(): number;
  isStopped(threshold?: number): boolean;
  isStunned?(): boolean;
  hasActiveShield?(): boolean;
}

export interface CardScore {
  cardId: string;
  card: CardDefinition;
  score: number;
  reason: string;
  targetData?: {
    position?: { x: number; y: number };
    unitIds?: string[];
  };
}

export interface GameState {
  ball: Ball;
  aiUnits: AIUnit[];
  playerUnits: AIUnit[];
  aiScore: number;
  playerScore: number;
  fieldBounds: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  };
  aiGoalY: number; // Y координата ворот AI (защищаем)
  playerGoalY: number; // Y координата ворот игрока (атакуем)
}

// ============================================================
// КОНСТАНТЫ
// ============================================================

const SCORE_THRESHOLDS = {
  HIGH: 80,    // Использовать обязательно
  MEDIUM: 50,  // Использовать если есть возможность
  LOW: 25,     // Использовать только если нет лучших вариантов
};

// ============================================================
// ABILITY SCORER
// ============================================================

export class AbilityScorer {
  
  /**
   * Оценить все доступные карты и выбрать лучшую
   */
  public static evaluateCards(
    availableCards: CardDefinition[],
    state: GameState,
    factionId: FactionId
  ): CardScore[] {
    const scores: CardScore[] = [];

    availableCards.forEach(card => {
      const score = this.evaluateCard(card, state, factionId);
      if (score) {
        scores.push(score);
      }
    });

    // Сортируем по убыванию очков
    scores.sort((a, b) => b.score - a.score);

    return scores;
  }

  /**
   * Получить лучшую карту для использования
   */
  public static getBestCard(
    availableCards: CardDefinition[],
    state: GameState,
    factionId: FactionId,
    minScore: number = SCORE_THRESHOLDS.MEDIUM
  ): CardScore | null {
    const scores = this.evaluateCards(availableCards, state, factionId);
    
    if (scores.length === 0) return null;
    
    const best = scores[0];
    
    if (best.score >= minScore) {
      return best;
    }
    
    return null;
  }

  /**
   * Оценить конкретную карту
   */
  private static evaluateCard(
    card: CardDefinition,
    state: GameState,
    factionId: FactionId
  ): CardScore | null {
    switch (card.id) {
      // ===== MAGMA =====
      case 'magma_lava':
        return this.scoreLavaPool(card, state);
      case 'magma_molten':
        return this.scoreMoltenBall(card, state);
      case 'magma_meteor':
        return this.scoreMeteorStrike(card, state);

      // ===== CYBORG =====
      case 'cyborg_shield':
        return this.scoreEnergyShield(card, state);
      case 'cyborg_tether':
        return this.scoreMagneticTether(card, state);
      case 'cyborg_barrier':
        return this.scorePhotonBarrier(card, state);

      // ===== VOID =====
      case 'void_swap':
        return this.scorePhaseSwap(card, state);
      case 'void_ghost':
        return this.scoreGhostPhase(card, state);
      case 'void_wormhole':
        return this.scoreWormhole(card, state);

      // ===== INSECT =====
      case 'insect_toxin':
        return this.scoreNeurotoxin(card, state);
      case 'insect_mimic':
        return this.scoreBiomimicry(card, state);
      case 'insect_parasite':
        return this.scoreNeuralParasite(card, state);

      default:
        return null;
    }
  }

  // ============================================================
  // MAGMA CARDS
  // ============================================================

  private static scoreLavaPool(card: CardDefinition, state: GameState): CardScore {
    const ballPos = state.ball.getPosition();
    let score = 20;
    let reason = 'Base lava pool';
    let targetPosition: { x: number; y: number } | undefined;

    // Лава эффективна на пути мяча к нашим воротам
    const ballToGoalDist = Math.abs(ballPos.y - state.aiGoalY);
    
    if (ballToGoalDist < state.fieldBounds.height * 0.4) {
      // Мяч близко к нашим воротам — ставим лаву на пути
      score += 40;
      reason = 'Defensive lava - ball approaching our goal';
      
      // Целимся между мячом и воротами
      targetPosition = {
        x: ballPos.x,
        y: (ballPos.y + state.aiGoalY) / 2,
      };
    } else {
      // Ставим лаву рядом с вражескими юнитами
      const clusteredEnemies = this.findClusteredUnits(state.playerUnits, 80);
      if (clusteredEnemies.length > 0) {
        score += 25;
        reason = 'Lava near enemy cluster';
        targetPosition = clusteredEnemies[0];
      }
    }

    return { cardId: card.id, card, score, reason, targetData: { position: targetPosition } };
  }

  private static scoreMoltenBall(card: CardDefinition, state: GameState): CardScore {
    const ballPos = state.ball.getPosition();
    let score = 30;
    let reason = 'Molten ball activation';

    // Эффективно когда мяч движется к врагу
    const ballVel = state.ball.body.velocity;
    const ballSpeed = Math.sqrt(ballVel.x * ballVel.x + ballVel.y * ballVel.y);

    if (ballSpeed > 5) {
      // Мяч уже летит — проверяем направление
      const movingToEnemy = ballVel.y > 0; // К воротам игрока
      if (movingToEnemy) {
        score += 35;
        reason = 'Molten ball while attacking';
      }
    }

    // Бонус если рядом много врагов
    const enemiesNearBall = state.playerUnits.filter(u => 
      Phaser.Math.Distance.Between(u.x, u.y, ballPos.x, ballPos.y) < 100
    );
    
    if (enemiesNearBall.length >= 2) {
      score += 20;
      reason = 'Molten ball - multiple enemies near ball';
    }

    return { cardId: card.id, card, score, reason };
  }

  private static scoreMeteorStrike(card: CardDefinition, state: GameState): CardScore {
    let score = 15;
    let reason = 'Meteor strike consideration';
    let targetPosition: { x: number; y: number } | undefined;

    // ⭐ КЛЮЧЕВОЕ: Используй если distance(enemy1, enemy2) < 80
    const clusteredEnemies = this.findClusteredUnits(state.playerUnits, 80);
    
    if (clusteredEnemies.length > 0) {
      const clusterCenter = clusteredEnemies[0];
      const unitsInCluster = state.playerUnits.filter(u =>
        Phaser.Math.Distance.Between(u.x, u.y, clusterCenter.x, clusterCenter.y) < 80
      ).length;

      if (unitsInCluster >= 2) {
        score = 90; // Очень высокий приоритет!
        reason = `Meteor - ${unitsInCluster} enemies clustered!`;
        targetPosition = clusterCenter;
      }
    }

    // Бонус если проигрываем
    if (state.playerScore > state.aiScore) {
      score += 15;
      reason += ' (losing bonus)';
    }

    return { cardId: card.id, card, score, reason, targetData: { position: targetPosition } };
  }

  // ============================================================
  // CYBORG CARDS
  // ============================================================

  private static scoreEnergyShield(card: CardDefinition, state: GameState): CardScore {
    let score = 20;
    let reason = 'Shield consideration';
    let targetUnitId: string | undefined;

    // Щит на юнита ближайшего к нашим воротам
    const goalDefender = this.getClosestUnitToPoint(
      state.aiUnits,
      { x: state.fieldBounds.centerX, y: state.aiGoalY }
    );

    if (goalDefender) {
      const distToGoal = Math.abs(goalDefender.y - state.aiGoalY);
      
      if (distToGoal < 100) {
        score = 60;
        reason = 'Shield on goal defender';
        targetUnitId = goalDefender.id;
      }
    }

    // Проверяем летит ли мяч в ворота
    const ballPos = state.ball.getPosition();
    const ballVel = state.ball.body.velocity;
    
    if (ballVel.y < -5 && ballPos.y < state.fieldBounds.centerY) {
      // Мяч летит к нашим воротам!
      score = 85;
      reason = 'Shield - ball flying to our goal!';
      
      // Ищем юнита на пути
      const interceptor = this.findBestInterceptor(state.aiUnits, ballPos, ballVel);
      if (interceptor) {
        targetUnitId = interceptor.id;
      }
    }

    return { 
      cardId: card.id, 
      card, 
      score, 
      reason, 
      targetData: { unitIds: targetUnitId ? [targetUnitId] : undefined } 
    };
  }

  private static scoreMagneticTether(card: CardDefinition, state: GameState): CardScore {
    let score = 25;
    let reason = 'Tether consideration';
    let targetUnitId: string | undefined;

    const ballPos = state.ball.getPosition();
    
    // Тетер эффективен когда наш юнит близко к мячу
    const closestToball = this.getClosestUnitToPoint(state.aiUnits, ballPos);
    
    if (closestToball) {
      const dist = Phaser.Math.Distance.Between(
        closestToball.x, closestToball.y, 
        ballPos.x, ballPos.y
      );
      
      if (dist < 80) {
        score = 55;
        reason = 'Tether - unit very close to ball';
        targetUnitId = closestToball.id;
      } else if (dist < 150) {
        score = 35;
        reason = 'Tether - unit near ball';
        targetUnitId = closestToball.id;
      }
    }

    return { 
      cardId: card.id, 
      card, 
      score, 
      reason, 
      targetData: { unitIds: targetUnitId ? [targetUnitId] : undefined } 
    };
  }

  private static scorePhotonBarrier(card: CardDefinition, state: GameState): CardScore {
    let score = 20;
    let reason = 'Barrier consideration';
    let targetPosition: { x: number; y: number } | undefined;

    const ballPos = state.ball.getPosition();
    const ballVel = state.ball.body.velocity;
    const ballSpeed = Math.sqrt(ballVel.x * ballVel.x + ballVel.y * ballVel.y);

    // ⭐ КЛЮЧЕВОЕ: Если мяч летит в пустые ворота — приоритет 100!
    if (ballVel.y < -8 && ballPos.y < state.fieldBounds.centerY) {
      // Проверяем, есть ли наши юниты между мячом и воротами
      const defenders = state.aiUnits.filter(u => 
        u.y < ballPos.y && 
        Math.abs(u.x - ballPos.x) < 100
      );

      if (defenders.length === 0) {
        score = 100; // Максимальный приоритет!
        reason = 'BARRIER - ball flying to EMPTY goal!';
        
        // Ставим барьер перед воротами
        targetPosition = {
          x: state.fieldBounds.centerX,
          y: state.aiGoalY + 50,
        };
      }
    }

    // Также хорошо для блокировки атаки
    if (score < 50 && ballSpeed > 10 && ballVel.y < 0) {
      score = 45;
      reason = 'Barrier - defensive positioning';
      targetPosition = {
        x: ballPos.x,
        y: ballPos.y - 80,
      };
    }

    return { cardId: card.id, card, score, reason, targetData: { position: targetPosition } };
  }

  // ============================================================
  // VOID CARDS
  // ============================================================

  private static scorePhaseSwap(card: CardDefinition, state: GameState): CardScore {
    let score = 15;
    let reason = 'Swap consideration';
    let targetUnitIds: string[] = [];

    // Своп эффективен для перестановки позиций
    const ballPos = state.ball.getPosition();
    
    // Ищем юнита далеко от мяча и юнита близко к воротам противника
    const nearBall = this.getClosestUnitToPoint(state.aiUnits, ballPos);
    const nearEnemyGoal = this.getClosestUnitToPoint(
      state.aiUnits,
      { x: state.fieldBounds.centerX, y: state.playerGoalY }
    );

    if (nearBall && nearEnemyGoal && nearBall.id !== nearEnemyGoal.id) {
      const nearBallDist = Phaser.Math.Distance.Between(
        nearBall.x, nearBall.y, ballPos.x, ballPos.y
      );
      
      // Если юнит у ворот далеко от мяча — свопаем
      if (nearBallDist > 200) {
        score = 45;
        reason = 'Swap to reposition for attack';
        targetUnitIds = [nearBall.id, nearEnemyGoal.id];
      }
    }

    return { 
      cardId: card.id, 
      card, 
      score, 
      reason, 
      targetData: { unitIds: targetUnitIds.length === 2 ? targetUnitIds : undefined } 
    };
  }

  private static scoreGhostPhase(card: CardDefinition, state: GameState): CardScore {
    let score = 20;
    let reason = 'Ghost consideration';
    let targetUnitId: string | undefined;

    const ballPos = state.ball.getPosition();

    // ⭐ КЛЮЧЕВОЕ: Ghost если путь к мячу заблокирован препятствиями/врагами
    for (const unit of state.aiUnits) {
      const pathToball = this.isPathBlocked(
        { x: unit.x, y: unit.y },
        ballPos,
        state.playerUnits
      );

      if (pathToball) {
        score = 65;
        reason = 'Ghost - path to ball is blocked';
        targetUnitId = unit.id;
        break;
      }
    }

    // Также хорошо для атаки через защиту
    if (score < 50) {
      const attacker = this.getClosestUnitToPoint(
        state.aiUnits,
        { x: state.fieldBounds.centerX, y: state.playerGoalY }
      );
      
      if (attacker) {
        const enemiesBlocking = state.playerUnits.filter(e =>
          e.y > attacker.y && e.y < state.playerGoalY
        );
        
        if (enemiesBlocking.length >= 2) {
          score = 50;
          reason = 'Ghost to bypass defense';
          targetUnitId = attacker.id;
        }
      }
    }

    return { 
      cardId: card.id, 
      card, 
      score, 
      reason, 
      targetData: { unitIds: targetUnitId ? [targetUnitId] : undefined } 
    };
  }

  private static scoreWormhole(card: CardDefinition, state: GameState): CardScore {
    let score = 25;
    let reason = 'Wormhole consideration';
    let targetPosition: { x: number; y: number } | undefined;

    const ballPos = state.ball.getPosition();

    // Вормхол хорош для быстрого перемещения мяча
    // Одну точку ставим у мяча, вторая появится симметрично
    
    if (ballPos.y > state.fieldBounds.centerY) {
      // Мяч в нашей половине — можем телепортнуть к чужим воротам
      score = 55;
      reason = 'Wormhole for fast attack';
      targetPosition = { x: ballPos.x, y: ballPos.y };
    }

    return { cardId: card.id, card, score, reason, targetData: { position: targetPosition } };
  }

  // ============================================================
  // INSECT CARDS
  // ============================================================

  private static scoreNeurotoxin(card: CardDefinition, state: GameState): CardScore {
    let score = 25;
    let reason = 'Toxin consideration';
    let targetUnitId: string | undefined;

    // Токсин на юнита который будет контактировать с врагом
    const ballPos = state.ball.getPosition();
    
    // Ищем нашего юнита ближайшего к вражескому
    let bestPair: { our: AIUnit; enemy: AIUnit; dist: number } | null = null;
    
    for (const our of state.aiUnits) {
      for (const enemy of state.playerUnits) {
        const dist = Phaser.Math.Distance.Between(our.x, our.y, enemy.x, enemy.y);
        if (!bestPair || dist < bestPair.dist) {
          bestPair = { our, enemy, dist };
        }
      }
    }

    if (bestPair && bestPair.dist < 120) {
      score = 55;
      reason = 'Toxin - units about to collide';
      targetUnitId = bestPair.our.id;
    }

    return { 
      cardId: card.id, 
      card, 
      score, 
      reason, 
      targetData: { unitIds: targetUnitId ? [targetUnitId] : undefined } 
    };
  }

  private static scoreBiomimicry(card: CardDefinition, state: GameState): CardScore {
    let score = 30;
    let reason = 'Mimic ball consideration';
    let targetPosition: { x: number; y: number } | undefined;

    // Фейковый мяч для отвлечения
    // Хорошо ставить в направлении ворот противника
    
    score = 35;
    reason = 'Mimic for distraction';
    targetPosition = {
      x: state.fieldBounds.centerX + (Math.random() - 0.5) * 100,
      y: state.fieldBounds.centerY,
    };

    return { cardId: card.id, card, score, reason, targetData: { position: targetPosition } };
  }

  private static scoreNeuralParasite(card: CardDefinition, state: GameState): CardScore {
    let score = 20;
    let reason = 'Parasite consideration';
    let targetUnitId: string | undefined;

    // ⭐ КЛЮЧЕВОЕ: Используй если враг стоит у своих ворот (для автогола!)
    for (const enemy of state.playerUnits) {
      const distToEnemyGoal = Math.abs(enemy.y - state.playerGoalY);
      
      if (distToEnemyGoal < 80) {
        score = 85; // Очень высокий приоритет!
        reason = 'PARASITE - enemy near their goal (own goal potential)!';
        targetUnitId = enemy.id;
        break;
      }
    }

    // Также хорошо для контроля защитника
    if (score < 50) {
      const ballPos = state.ball.getPosition();
      const closestEnemy = this.getClosestUnitToPoint(state.playerUnits, ballPos);
      
      if (closestEnemy) {
        score = 45;
        reason = 'Parasite on closest enemy to ball';
        targetUnitId = closestEnemy.id;
      }
    }

    return { 
      cardId: card.id, 
      card, 
      score, 
      reason, 
      targetData: { unitIds: targetUnitId ? [targetUnitId] : undefined } 
    };
  }

  // ============================================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ============================================================

  private static findClusteredUnits(
    units: AIUnit[], 
    maxDistance: number
  ): Array<{ x: number; y: number }> {
    const clusters: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        const dist = Phaser.Math.Distance.Between(
          units[i].x, units[i].y,
          units[j].x, units[j].y
        );

        if (dist < maxDistance) {
          clusters.push({
            x: (units[i].x + units[j].x) / 2,
            y: (units[i].y + units[j].y) / 2,
          });
        }
      }
    }

    return clusters;
  }

  private static getClosestUnitToPoint(
    units: AIUnit[],
    point: { x: number; y: number }
  ): AIUnit | null {
    let closest: AIUnit | null = null;
    let minDist = Infinity;

    for (const unit of units) {
      const dist = Phaser.Math.Distance.Between(unit.x, unit.y, point.x, point.y);
      if (dist < minDist) {
        minDist = dist;
        closest = unit;
      }
    }

    return closest;
  }

  private static findBestInterceptor(
    units: AIUnit[],
    ballPos: { x: number; y: number },
    ballVel: { x: number; y: number }
  ): AIUnit | null {
    // Простая эвристика: юнит на пути мяча
    let best: AIUnit | null = null;
    let bestScore = -Infinity;

    for (const unit of units) {
      // Проверяем находится ли юнит "на пути"
      const toBall = new Phaser.Math.Vector2(ballPos.x - unit.x, ballPos.y - unit.y);
      const ballDir = new Phaser.Math.Vector2(ballVel.x, ballVel.y).normalize();
      
      const dot = toBall.dot(ballDir);
      
      if (dot > 0) {
        const score = dot / toBall.length();
        if (score > bestScore) {
          bestScore = score;
          best = unit;
        }
      }
    }

    return best;
  }

  private static isPathBlocked(
    from: { x: number; y: number },
    to: { x: number; y: number },
    obstacles: AIUnit[]
  ): boolean {
    const pathLength = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    
    for (const obstacle of obstacles) {
      // Проверяем пересечение пути с препятствием
      const toObstacle = new Phaser.Math.Vector2(obstacle.x - from.x, obstacle.y - from.y);
      const pathDir = new Phaser.Math.Vector2(to.x - from.x, to.y - from.y).normalize();
      
      const projection = toObstacle.dot(pathDir);
      
      if (projection > 0 && projection < pathLength) {
        const perpDist = Math.abs(toObstacle.cross(pathDir));
        
        if (perpDist < obstacle.getRadius() + 20) {
          return true;
        }
      }
    }

    return false;
  }

  /** Цели для AI: всегда валидны для AbilityManager.applyCard */
  private static finalizeAITargetData(card: CardDefinition, score: CardScore, state: GameState): CardScore | null {
    const ballPos = state.ball.getPosition();
    const td = { ...(score.targetData || {}) };

    switch (card.targetType) {
      case 'none':
        return { ...score, targetData: Object.keys(td).length ? td : undefined };

      case 'point': {
        let pos = td.position;
        if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') {
          pos = {
            x: Phaser.Math.Clamp(ballPos.x, state.fieldBounds.left + 48, state.fieldBounds.right - 48),
            y: Phaser.Math.Clamp(
              (ballPos.y + state.playerGoalY) / 2,
              state.fieldBounds.top + 40,
              state.fieldBounds.bottom - 40
            ),
          };
        }
        return { ...score, targetData: { ...td, position: pos } };
      }

      case 'unit_self': {
        let ids = td.unitIds;
        if (!ids?.length && state.aiUnits.length) {
          const pick = this.getClosestUnitToPoint(state.aiUnits, ballPos) ?? state.aiUnits[0];
          ids = [pick.id];
        }
        if (!ids?.length) return null;
        return { ...score, targetData: { ...td, unitIds: ids } };
      }

      case 'unit_enemy': {
        let ids = td.unitIds;
        if (!ids?.length && state.playerUnits.length) {
          const pick = this.getClosestUnitToPoint(state.playerUnits, ballPos) ?? state.playerUnits[0];
          ids = [pick.id];
        }
        if (!ids?.length) return null;
        return { ...score, targetData: { ...td, unitIds: ids } };
      }

      case 'unit_ally_pair': {
        let ids = td.unitIds?.filter(Boolean);
        if (!ids || ids.length < 2) {
          if (state.aiUnits.length < 2) return null;
          ids = [state.aiUnits[0].id, state.aiUnits[1].id];
        }
        return { ...score, targetData: { ...td, unitIds: ids } };
      }

      default:
        return null;
    }
  }

  /** Лучшая карта с гарантированно заполненными целями под applyCard. */
  public static pickBestExecutableCardForAI(
    availableCards: CardDefinition[],
    state: GameState,
    factionId: FactionId,
    preferredMinScore: number,
    absoluteFloor: number = 8
  ): CardScore | null {
    const scored = this.evaluateCards(availableCards, state, factionId);
    const ready: CardScore[] = [];

    for (const s of scored) {
      const fixed = this.finalizeAITargetData(s.card, s, state);
      if (fixed) ready.push(fixed);
    }

    if (!ready.length) return null;

    ready.sort((a, b) => b.score - a.score);
    const best = ready[0];

    if (best.score >= preferredMinScore) return best;
    if (best.score >= absoluteFloor) return best;

    return null;
  }
}