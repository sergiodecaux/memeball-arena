// src/ai/patterns/PatternRecognizer.ts
import type { PlayerPattern } from '../types/AITypes';

interface MoveRecord {
  unitId: string;
  targetX: number;
  targetY: number;
  wasPass: boolean;
  usedAbility: boolean;
  timestamp: number;
}

export class PatternRecognizer {
  private moveHistory: MoveRecord[] = [];
  private maxHistorySize = 20;

  constructor(
    private readonly fieldBounds: {
      left: number;
      right: number;
      top: number;
      bottom: number;
      width: number;
      height: number;
      centerX: number;
      centerY: number;
    },
  ) {}

  public recordMove(
    unitId: string,
    targetX: number,
    targetY: number,
    wasPass: boolean = false,
    usedAbility: boolean = false,
  ): void {
    this.moveHistory.push({
      unitId,
      targetX,
      targetY,
      wasPass,
      usedAbility,
      timestamp: Date.now(),
    });
    if (this.moveHistory.length > this.maxHistorySize) {
      this.moveHistory.shift();
    }
  }

  public analyzePatterns(): PlayerPattern {
    if (this.moveHistory.length < 3) {
      return this.getDefaultPattern();
    }

    const recentMoves = this.moveHistory.slice(-10);

    const detected = {
      favoredSide: this.detectFavoredSide(recentMoves),
      shotPreference: this.detectShotPreference(recentMoves),
      abilityUsage: this.detectAbilityUsage(recentMoves),
      positioning: this.detectPositioning(recentMoves),
      adaptability: this.detectAdaptability(),
    };

    const predictions = this.makePredictions(recentMoves, detected);
    const stats = this.calculateStats(recentMoves);

    return {
      recentMoves,
      detected,
      predictions,
      stats,
    };
  }

  public predictNextMove(): PlayerPattern['predictions'] {
    return this.analyzePatterns().predictions;
  }

  public getDefaultPattern(): PlayerPattern {
    return {
      recentMoves: [],
      detected: {
        favoredSide: 'balanced',
        shotPreference: 'mixed',
        abilityUsage: 'tactical',
        positioning: 'balanced',
        adaptability: 0.5,
      },
      predictions: {
        nextMoveType: 'goal_shot',
        likelyTargetArea: {
          x: this.fieldBounds.centerX,
          y: this.fieldBounds.centerY,
          radius: 100,
        },
        confidence: 0,
      },
      stats: {
        avgShotDistance: 0,
        passRate: 0,
        accuracyRate: 0.5,
        cardUsageRate: 0,
      },
    };
  }

  public reset(): void {
    this.moveHistory = [];
  }

  private detectFavoredSide(moves: MoveRecord[]): PlayerPattern['detected']['favoredSide'] {
    const centerX = this.fieldBounds.centerX;
    let leftCount = 0;
    let rightCount = 0;
    let centerCount = 0;

    for (const move of moves) {
      const dist = Math.abs(move.targetX - centerX);
      if (dist < this.fieldBounds.width * 0.15) centerCount++;
      else if (move.targetX < centerX) leftCount++;
      else rightCount++;
    }

    const total = leftCount + rightCount + centerCount;
    if (total === 0) return 'balanced';

    const leftRatio = leftCount / total;
    const rightRatio = rightCount / total;
    const centerRatio = centerCount / total;

    if (centerRatio > 0.5) return 'center';
    if (leftRatio > 0.6) return 'left';
    if (rightRatio > 0.6) return 'right';
    return 'balanced';
  }

  private detectShotPreference(moves: MoveRecord[]): PlayerPattern['detected']['shotPreference'] {
    let passCount = 0;
    for (const move of moves) {
      if (move.wasPass) passCount++;
    }
    const total = moves.length;
    if (total === 0) return 'mixed';
    const passRatio = passCount / total;
    if (passRatio > 0.5) return 'pass';
    if (passRatio < 0.2) return 'direct';
    return 'mixed';
  }

  private detectAbilityUsage(moves: MoveRecord[]): PlayerPattern['detected']['abilityUsage'] {
    const abilityCount = moves.filter((m) => m.usedAbility).length;
    const ratio = abilityCount / moves.length;
    if (ratio > 0.6) return 'aggressive';
    if (ratio < 0.3) return 'conservative';
    return 'tactical';
  }

  private detectPositioning(moves: MoveRecord[]): PlayerPattern['detected']['positioning'] {
    const centerY = this.fieldBounds.centerY;
    let offensiveCount = 0;
    let defensiveCount = 0;

    for (const move of moves) {
      if (move.targetY < centerY - this.fieldBounds.height * 0.1) offensiveCount++;
      else if (move.targetY > centerY + this.fieldBounds.height * 0.1) defensiveCount++;
    }

    const total = offensiveCount + defensiveCount;
    if (total === 0) return 'balanced';

    const offensiveRatio = offensiveCount / total;
    if (offensiveRatio > 0.65) return 'offensive';
    if (offensiveRatio < 0.35) return 'defensive';
    return 'balanced';
  }

  private detectAdaptability(): number {
    if (this.moveHistory.length < 10) return 0.5;

    const half = Math.floor(this.moveHistory.length / 2);
    const firstHalf = this.moveHistory.slice(0, half);
    const secondHalf = this.moveHistory.slice(half);

    const firstPattern = {
      side: this.detectFavoredSide(firstHalf),
      shot: this.detectShotPreference(firstHalf),
    };

    const secondPattern = {
      side: this.detectFavoredSide(secondHalf),
      shot: this.detectShotPreference(secondHalf),
    };

    let changeCount = 0;
    if (firstPattern.side !== secondPattern.side) changeCount++;
    if (firstPattern.shot !== secondPattern.shot) changeCount++;

    return changeCount / 2;
  }

  private makePredictions(
    moves: MoveRecord[],
    detected: PlayerPattern['detected'],
  ): PlayerPattern['predictions'] {
    if (moves.length === 0) {
      return this.getDefaultPattern().predictions;
    }

    let nextMoveType: PlayerPattern['predictions']['nextMoveType'] = 'goal_shot';
    if (detected.shotPreference === 'pass') nextMoveType = 'pass';
    else if (detected.positioning === 'defensive') nextMoveType = 'defense';

    const recentTargets = moves.slice(-5);
    let avgX = 0;
    let avgY = 0;
    for (const move of recentTargets) {
      avgX += move.targetX;
      avgY += move.targetY;
    }
    avgX /= recentTargets.length;
    avgY /= recentTargets.length;

    const consistency = 1 - detected.adaptability;
    const confidence = Math.min(0.9, consistency * 0.7 + (moves.length / this.maxHistorySize) * 0.3);

    return {
      nextMoveType,
      likelyTargetArea: {
        x: avgX,
        y: avgY,
        radius: 80,
      },
      confidence,
    };
  }

  private calculateStats(moves: MoveRecord[]): PlayerPattern['stats'] {
    if (moves.length === 0) {
      return this.getDefaultPattern().stats;
    }

    let totalDistance = 0;
    let passCount = 0;
    let abilityCount = 0;

    for (const move of moves) {
      const dist = Math.sqrt(
        Math.pow(move.targetX - this.fieldBounds.centerX, 2) +
          Math.pow(move.targetY - this.fieldBounds.centerY, 2),
      );
      totalDistance += dist;
      if (move.wasPass) passCount++;
      if (move.usedAbility) abilityCount++;
    }

    return {
      avgShotDistance: totalDistance / moves.length,
      passRate: passCount / moves.length,
      accuracyRate: 0.5,
      cardUsageRate: abilityCount / moves.length,
    };
  }
}
