// ✅ ИЗМЕНЕНО: Добавлены формации для 4 и 5 юнитов (Faction Mastery v9)

import Phaser from 'phaser';
import { Ball } from '../entities/Ball';
import { AIDifficulty, PlayerNumber, normalizeGameAIDifficulty, AIDifficultyInput } from '../types';
import { FIELD, GOAL, CapClass, FactionId } from '../constants/gameConstants';
import { Formation, playerData } from '../data/PlayerData';
import { AudioManager } from '../managers/AudioManager';
import { AbilityScorer, AIUnit, CardScore, GameState } from './scoring/AbilityScorer';
import { CardDefinition, getCardsByFaction } from '../data/CardsCatalog';
import { getAIFormationsForTeamSize, getDefaultAIFormation } from './AIFormations';
import { AIUtils } from './AIUtils';
import type { AIOpponentProfile } from './AIProfile';
import { getProfileCardModifiers, getProfilePlaystyleNoise } from './AIProfile';

// === ТИПЫ ===

interface ShotCandidate {
  unit: AIUnit;
  target: { x: number; y: number };
  score: number;
  type: 'goal' | 'pass' | 'defend' | 'clear' | 'pressure';
  force: { x: number; y: number };
  description: string;
}

interface AIState {
  playerScore: number;
  aiScore: number;
  lastGoalBy: 'player' | 'ai' | null;
  consecutiveGoalsAgainst: number;
  turnsSinceLastGoal: number;
  currentFormation: Formation;
  aggression: number;
}

interface DifficultySettings {
  reactionTime: { min: number; max: number };
  accuracy: number;
  passChance: number;
  defenseZone: number;
  shotPower: { min: number; max: number };
  formationAdaptation: boolean;
  useClassAbilities: boolean;
  // ⭐ NEW: Настройки карт
  cardUsageChance: number;      // Шанс попытаться использовать карту
  minCardScore: number;         // Минимальный score для использования карты
  maxCardsPerMatch: number;     // Макс. карт за матч
}

// ✅ ДОБАВЛЕНО: Локальный интерфейс для юнитов со stats
interface AIUnitWithStats extends AIUnit {
  stats?: {
    forceMultiplier?: number;
    maxForce?: number;
    mass?: number;
    restitution?: number;
    frictionAir?: number;
    curveStrength?: number;
  };
}

// === НАСТРОЙКИ ===

const DIFFICULTY_SETTINGS: Record<AIDifficulty, DifficultySettings> = {
  easy: {
    reactionTime: { min: 1200, max: 1800 },
    accuracy: 0.35,        // ✅ Reduced from 0.4
    passChance: 0,         // No passes on easy
    defenseZone: 0,        // No anticipatory defense
    shotPower: { min: 0.5, max: 0.75 },
    formationAdaptation: false,
    useClassAbilities: false,
    cardUsageChance: 0,    // ✅ No cards on easy
    minCardScore: 80,
    maxCardsPerMatch: 0,   // ✅ No cards per match
  },
  medium: {
    reactionTime: { min: 700, max: 1000 },
    accuracy: 0.75,        // Balanced
    passChance: 0.2,
    defenseZone: 250,      // Moderate defense zone
    shotPower: { min: 0.65, max: 0.9 },
    formationAdaptation: true,
    useClassAbilities: true,
    cardUsageChance: 0.42,
    minCardScore: 38,
    maxCardsPerMatch: 3,
  },
  hard: {
    reactionTime: { min: 300, max: 500 },
    accuracy: 0.92,        // Very high accuracy
    passChance: 0.45,      // ✅ Increased from 0.4
    defenseZone: 425,      // ✅ Increased from 400 for stronger defense
    shotPower: { min: 0.8, max: 1.0 },
    formationAdaptation: true,
    useClassAbilities: true,
    cardUsageChance: 0.58,
    minCardScore: 26,
    maxCardsPerMatch: 4,
  },
  impossible: {
    reactionTime: { min: 100, max: 300 },
    accuracy: 0.98,        // Almost perfect
    passChance: 0.6,       // Very high pass chance
    defenseZone: 500,      // Maximum defense zone
    shotPower: { min: 0.9, max: 1.0 },
    formationAdaptation: true,
    useClassAbilities: true,
    cardUsageChance: 0.82,
    minCardScore: 12,
    maxCardsPerMatch: 8,
  },
};

// === КОНСТАНТЫ ПО УМОЛЧАНИЮ ===

const DEFAULT_FORCE_MULTIPLIER = 0.0045;
const DEFAULT_MAX_FORCE = 0.08;

// === ОСНОВНОЙ КЛАСС ===

export class AIController {
  private scene: Phaser.Scene;
  private difficulty: AIDifficulty;
  private settings: DifficultySettings;
  
  private aiUnits: AIUnit[] = [];
  private playerUnits: AIUnit[] = [];
  private ball!: Ball;
  
  // ✅ ДОБАВЛЕНО: Размер команды AI
  private teamSize: number = 3;
  
  private fieldBounds!: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
  };
  
  private state: AIState = {
    playerScore: 0,
    aiScore: 0,
    lastGoalBy: null,
    consecutiveGoalsAgainst: 0,
    turnsSinceLastGoal: 0,
    currentFormation: getDefaultAIFormation(3),
    aggression: 0.5,
  };

  // ⭐ NEW: Карточная система AI
  private factionId: FactionId = 'magma';
  private availableCards: CardDefinition[] = [];
  private cardsUsedThisMatch: number = 0;
  private onCardUsed?: (cardId: string, targetData: any) => void;
  
  // ✅ ADDED: Boss tracking
  private bossId?: string;

  private profile: AIOpponentProfile;
  private profileCardMods: ReturnType<typeof getProfileCardModifiers>;
  private profileNoise: ReturnType<typeof getProfilePlaystyleNoise>;

  private moveCompleteCallback?: () => void;
  private thinkingTimer?: Phaser.Time.TimerEvent;
  
  // ЗАЩИТА ОТ ДВОЙНОГО ХОДА
  public isThinking = false;
  private lastMoveTime = 0;
  private readonly MOVE_COOLDOWN = 800;

  constructor(scene: Phaser.Scene, difficulty: AIDifficultyInput = 'medium', profile?: AIOpponentProfile) {
    this.scene = scene;
    this.difficulty = normalizeGameAIDifficulty(difficulty);
    this.settings = { ...DIFFICULTY_SETTINGS[this.difficulty] };

    this.profile = profile ?? { tier: 'standard', seed: 0 };
    this.profileCardMods = getProfileCardModifiers(this.profile.tier);
    this.profileNoise = getProfilePlaystyleNoise(this.profile.seed);

    this.calculateFieldBounds();

    console.log(`[AI] 🤖 Created: ${this.difficulty}, profile=${this.profile.tier}`);
  }

  private calculateFieldBounds(): void {
    const { centerX, centerY, width, height } = this.scene.cameras.main;
    const scale = Math.min(
      (width - 40) / FIELD.WIDTH,
      (height - 40) / FIELD.HEIGHT
    );
    
    const w = FIELD.WIDTH * scale;
    const h = FIELD.HEIGHT * scale;
    
    this.fieldBounds = {
      left: centerX - w / 2,
      right: centerX + w / 2,
      top: centerY - h / 2,
      bottom: centerY + h / 2,
      width: w,
      height: h,
      centerX,
      centerY,
    };
  }

  init(aiUnits: AIUnit[], ball: Ball, playerUnits: AIUnit[] = []): void {
    this.aiUnits = aiUnits;
    this.playerUnits = playerUnits;
    this.ball = ball;
    
    // ✅ ДОБАВЛЕНО: Определяем размер команды
    this.teamSize = aiUnits.length;
    
    // Определяем фракцию AI
    if (aiUnits.length > 0 && typeof aiUnits[0].getFactionId === 'function') {
      this.factionId = aiUnits[0].getFactionId!() || 'magma';
    }
    
    // ✅ ADDED: Check for boss
    const bossUnit = aiUnits.find(u => {
      // Try multiple ways to get unitId
      let unitId: string | undefined;
      if ((u as any).getUnitId && typeof (u as any).getUnitId === 'function') {
        unitId = (u as any).getUnitId();
      } else if ((u as any).unitId) {
        unitId = (u as any).unitId;
      } else if (u.id && typeof u.id === 'string' && u.id.startsWith('boss_')) {
        // Fallback: check if id itself is a boss ID
        unitId = u.id;
      }
      return unitId && typeof unitId === 'string' && unitId.startsWith('boss_');
    });
    if (bossUnit) {
      // Get boss ID using the same method
      let unitId: string | undefined;
      if ((bossUnit as any).getUnitId && typeof (bossUnit as any).getUnitId === 'function') {
        unitId = (bossUnit as any).getUnitId();
      } else if ((bossUnit as any).unitId) {
        unitId = (bossUnit as any).unitId;
      } else if (bossUnit.id && typeof bossUnit.id === 'string' && bossUnit.id.startsWith('boss_')) {
        unitId = bossUnit.id;
      }
      if (unitId) {
        this.bossId = unitId;
        console.log(`[AI] 👹 Boss Mode Activated: ${this.bossId}`);
        // Bosses are always Hard+
        this.settings = { ...DIFFICULTY_SETTINGS['hard'] };
        this.settings.reactionTime = { min: 200, max: 400 }; // Super fast
        // ✅ CHEAT: Infinite cards for boss
        this.settings.maxCardsPerMatch = 9999;
        this.settings.cardUsageChance = 0.85; // 85% chance to try using a card every turn
        this.settings.minCardScore = 10; // Use cards even if they are only slightly useful
      }
    }
    
    // Генерируем виртуальную руку карт
    this.generateCardHand();
    
    // ✅ ИЗМЕНЕНО: Выбираем формацию с учётом размера команды
    this.selectFormation();
    
    console.log(`[AI] Initialized: ${aiUnits.length} AI (${this.factionId}), ${playerUnits.length} player units, teamSize: ${this.teamSize}`);
    console.log(`[AI] Card hand: ${this.availableCards.map(c => c.id).join(', ')}`);
  }

  // ⭐ NEW: Генерация карт для AI
  private generateCardHand(): void {
    // ✅ BOSS OVERRIDE: Bosses get a full hand of Epic/Rare cards
    if (this.bossId) {
      const factionCards = getCardsByFaction(this.factionId);
      this.availableCards = factionCards; // Give them ALL cards
      this.cardsUsedThisMatch = 0;
      return;
    }
    
    const factionCards = getCardsByFaction(this.factionId);
    this.availableCards = [];

    switch (this.difficulty) {
      case 'easy':
        // 1 common карта
        {
        const commonCards = factionCards.filter(c => c.rarity === 'common');
        if (commonCards.length > 0) {
          this.availableCards = [commonCards[0]];
        }
        }
        break;
        
      case 'medium':
        // 2 карты (1 common + 1 rare если есть)
        {
        const commons = factionCards.filter(c => c.rarity === 'common');
        const rares = factionCards.filter(c => c.rarity === 'rare');
        this.availableCards = [];
        if (commons.length > 0) this.availableCards.push(commons[0]);
        if (rares.length > 0) this.availableCards.push(rares[0]);
        }
        break;
        
      case 'hard':
        // 3 карты (все типы)
        this.availableCards = factionCards.slice(0, 3);
        break;

      case 'impossible': {
        const rarityRank: Record<string, number> = {
          common: 0,
          rare: 1,
          epic: 2,
          legendary: 3,
        };
        const ranked = [...factionCards].sort(
          (a, b) => (rarityRank[b.rarity] ?? 0) - (rarityRank[a.rarity] ?? 0)
        );
        this.availableCards = ranked.slice(0, Math.min(6, ranked.length));
        break;
      }

      default:
        this.availableCards = [];
        break;
    }

    if (this.settings.maxCardsPerMatch > 0 && !this.bossId) {
      this.appendBonusCardsFromFaction(this.profileCardMods.bonusPickCount);
    }

    this.cardsUsedThisMatch = 0;
  }

  /** Дополнительные карты «донатного» профиля и разнообразие колоды */
  private appendBonusCardsFromFaction(count: number): void {
    if (count <= 0) return;
    const have = new Set(this.availableCards.map(c => c.id));
    const pool = getCardsByFaction(this.factionId).filter(c => !have.has(c.id));
    const shuffled = Phaser.Utils.Array.Shuffle([...pool]);
    for (let i = 0; i < count && i < shuffled.length; i++) {
      this.availableCards.push(shuffled[i]);
      have.add(shuffled[i].id);
    }
  }

  // ⭐ NEW: Коллбэк для использования карты
  setCardUsedCallback(callback: (cardId: string, targetData: any) => void): void {
    this.onCardUsed = callback;
  }

  onMoveComplete(callback: () => void): void {
    this.moveCompleteCallback = callback;
  }

  // === УПРАВЛЕНИЕ СЧЁТОМ ===

  updateScore(playerScore: number, aiScore: number): void {
    this.state.playerScore = playerScore;
    this.state.aiScore = aiScore;
    this.updateAggression();
    // Формация меняется только после гола (recordGoal), не между ходами
  }

  recordGoal(scoredBy: 'player' | 'ai'): void {
    this.state.lastGoalBy = scoredBy;
    this.state.turnsSinceLastGoal = 0;

    if (scoredBy === 'player') {
      this.state.consecutiveGoalsAgainst++;
    } else {
      this.state.consecutiveGoalsAgainst = 0;
    }

    if (this.settings.formationAdaptation) {
      this.selectFormation();
    }
  }

  private updateAggression(): void {
    const diff = this.state.aiScore - this.state.playerScore;
    
    if (diff >= 2) {
      this.state.aggression = 0.3;
    } else if (diff === 1) {
      this.state.aggression = 0.5;
    } else if (diff === 0) {
      this.state.aggression = 0.6;
    } else if (diff === -1) {
      this.state.aggression = 0.75;
    } else {
      this.state.aggression = 0.9;
    }
    
    if (this.state.consecutiveGoalsAgainst >= 2) {
      this.state.aggression = Math.max(0.2, this.state.aggression - 0.2);
    }
  }

  // === ВЫБОР СХЕМЫ ===
  // ✅ ИЗМЕНЕНО: Выбор формации с учётом размера команды

  private getFormationsForTeamSize(): Record<string, Formation> {
    return getAIFormationsForTeamSize(this.teamSize);
  }

  private selectFormation(): void {
    const formations = this.getFormationsForTeamSize();
    const diff = this.state.aiScore - this.state.playerScore;
    const bunker = AIUtils.evaluatePlayerBunkerLevel(this.playerUnits, this.ball, this.fieldBounds);

    let formationType: string;

    if (diff >= 2) {
      formationType = 'defensive';
    } else if (bunker > 0.62 && diff <= 1) {
      formationType = diff <= -1 ? 'aggressive' : 'counter';
    } else if (diff <= -2) {
      formationType = 'aggressive';
    } else if (this.state.consecutiveGoalsAgainst >= 2) {
      formationType = 'defensive';
    } else if (diff === -1 && this.state.turnsSinceLastGoal > 5) {
      formationType = 'counter';
    } else {
      const roll = (Math.abs(this.profile.seed) + this.state.turnsSinceLastGoal * 11) % 100;
      if (roll < 24 && formations.counter) {
        formationType = 'counter';
      } else if (roll < 40 && formations.aggressive && diff >= -1) {
        formationType = 'aggressive';
      } else {
        formationType = 'balanced';
      }
    }

    const newFormation = formations[formationType] || formations.balanced;
    
    if (newFormation.id !== this.state.currentFormation.id) {
      console.log(`[AI] 📐 Formation: ${this.state.currentFormation.name} → ${newFormation.name} (teamSize: ${this.teamSize})`);
      this.state.currentFormation = newFormation;
    }
  }

  getCurrentFormation(): Formation {
    return this.state.currentFormation;
  }

  // ✅ ДОБАВЛЕНО: Получить размер команды AI
  getTeamSize(): number {
    return this.teamSize;
  }

  // === НАЧАЛО ХОДА ===

  startTurn(): void {
    // ЗАЩИТА ОТ ДВОЙНОГО ВЫЗОВА
    const now = Date.now();
    
    if (this.isThinking) {
      console.log('[AI] ⚠️ Already thinking, ignoring startTurn');
      return;
    }
    
    if (now - this.lastMoveTime < this.MOVE_COOLDOWN) {
      console.log('[AI] ⚠️ Move on cooldown, ignoring startTurn');
      return;
    }
    
    this.isThinking = true;
    this.state.turnsSinceLastGoal++;

    // Схема не пересчитывается во время хода — только после забитого гола (recordGoal)

    const delay = Phaser.Math.Between(
      this.settings.reactionTime.min,
      this.settings.reactionTime.max
    );
    
    console.log(`[AI] 🧠 Thinking... (${delay}ms)`);
    
    this.thinkingTimer = this.scene.time.delayedCall(delay, () => {
      this.executeMove();
    });
  }

  stop(): void {
    if (this.thinkingTimer) {
      this.thinkingTimer.destroy();
      this.thinkingTimer = undefined;
    }
    this.isThinking = false;
  }

  // === ЛОГИКА ХОДА ===

  private executeMove(): void {
    if (!this.isThinking) {
      console.log('[AI] ⚠️ Not thinking anymore, aborting move');
      return;
    }

    // ⭐ NEW: Сначала проверяем, стоит ли использовать карту
    if (this.shouldUseCard()) {
      const cardUsed = this.tryUseCard();
      if (cardUsed) {
        // Карта использована — ход всё равно продолжается обычным ударом
        // (или можно завершить ход здесь)
      }
    }
    
    const candidates = this.generateAllCandidates();
    
    if (candidates.length === 0) {
      console.log('[AI] ❌ No valid moves!');
      this.finishMove();
      return;
    }
    
    candidates.sort((a, b) => b.score - a.score);

    let selected: ShotCandidate;
    if (this.difficulty === 'impossible') {
      const topN = Math.min(2, candidates.length);
      selected = candidates[0];
      if (topN > 1 && Math.random() < 0.14) {
        selected = Phaser.Math.RND.pick(candidates.slice(0, topN));
      }
    } else if (this.difficulty === 'hard') {
      selected = candidates[0];
    } else if (this.difficulty === 'medium') {
      // Medium: random among top 2-3 candidates
      const topN = Math.min(3, candidates.length);
      selected = Phaser.Math.RND.pick(candidates.slice(0, topN));
    } else {
      // Easy: random among mid-tier candidates (more mistakes)
      const topN = Math.min(3, candidates.length);
      const midStart = Math.max(1, Math.floor(topN / 2));
      const selectionPool = candidates.slice(midStart, topN);
      selected = selectionPool.length > 0 
        ? Phaser.Math.RND.pick(selectionPool)
        : Phaser.Math.RND.pick(candidates.slice(0, Math.max(1, topN - 1)));
    }
    
    console.log(`[AI] 🎯 ${selected.description} (score: ${selected.score.toFixed(1)})`);
    
    this.executeShot(selected);
  }

  // ⭐ NEW: Проверка, стоит ли использовать карту
  private shouldUseCard(): boolean {
    if (this.availableCards.length === 0) return false;
    if (this.cardsUsedThisMatch >= this.settings.maxCardsPerMatch) return false;
    
    // ✅ BOSS OVERRIDE: Bosses use cards much more frequently
    if (this.bossId) {
      return Math.random() < 0.7;
    }

    let chance = this.settings.cardUsageChance * this.profileCardMods.cardUsageMultiplier;
    const bunker = AIUtils.evaluatePlayerBunkerLevel(this.playerUnits, this.ball, this.fieldBounds);
    if (bunker > 0.58) {
      chance = Math.min(0.95, chance + 0.22);
    }

    return Math.random() < chance;
  }

  // ⭐ NEW: Попытка использовать карту
  private tryUseCard(): boolean {
    const gameState = this.buildGameState();

    const bunker = AIUtils.evaluatePlayerBunkerLevel(this.playerUnits, this.ball, this.fieldBounds);
    const preferred = Math.max(
      6,
      Math.floor(this.settings.minCardScore * this.profileCardMods.minScoreMultiplier * (bunker > 0.55 ? 0.85 : 1))
    );

    const bestCard = AbilityScorer.pickBestExecutableCardForAI(
      this.availableCards,
      gameState,
      this.factionId,
      preferred,
      5
    );
    
    if (!bestCard) {
      console.log('[AI] 🃏 No good card to use');
      return false;
    }
    
    console.log(`[AI] 🃏 Using card: ${bestCard.card.name} (score: ${bestCard.score}) - ${bestCard.reason}`);
    
    // Убираем карту из доступных
    this.availableCards = this.availableCards.filter(c => c.id !== bestCard.cardId);
    this.cardsUsedThisMatch++;
    
    // Вызываем коллбэк
    if (this.onCardUsed) {
      this.onCardUsed(bestCard.cardId, bestCard.targetData);
    }
    
    return true;
  }

  // ⭐ NEW: Построение состояния игры для AbilityScorer
  private buildGameState(): GameState {
    return {
      ball: this.ball,
      aiUnits: this.aiUnits,
      playerUnits: this.playerUnits,
      aiScore: this.state.aiScore,
      playerScore: this.state.playerScore,
      fieldBounds: this.fieldBounds,
      aiGoalY: this.fieldBounds.top, // AI защищает верхние ворота
      playerGoalY: this.fieldBounds.bottom, // AI атакует нижние ворота
    };
  }

  private generateAllCandidates(): ShotCandidate[] {
    const candidates: ShotCandidate[] = [];

    const danger = AIUtils.evaluateDangerLevel(this.ball, this.fieldBounds, true);
    const attackOpportunity = AIUtils.evaluateAttackOpportunity(this.ball, this.fieldBounds, true);
    const bunker = AIUtils.evaluatePlayerBunkerLevel(this.playerUnits, this.ball, this.fieldBounds);
    const bunkerAttackBoost = (1 + bunker * 0.62) * (1 + this.profileNoise.bunkerOffset * 0.35);

    for (const unit of this.aiUnits) {
      const goal = this.evaluateGoalShot(unit);
      if (goal) {
        if (attackOpportunity > 0.6) {
          goal.score *= 1.2;
        }
        if (bunker > 0.52) {
          goal.score *= bunkerAttackBoost;
        }
        candidates.push(goal);
      }

      const defend = this.evaluateDefenseShot(unit);
      if (defend) {
        if (danger > 0.7) {
          defend.score *= 1.3;
        }
        if (danger < 0.3) {
          defend.score *= 0.7;
        }
        if (bunker > 0.55 && danger < 0.68) {
          defend.score *= 1 - bunker * 0.24;
        }
        candidates.push(defend);
      }

      if (Math.random() < Phaser.Math.Clamp(this.settings.passChance + this.profileNoise.passOffset, 0, 0.92)) {
        const pass = this.evaluatePass(unit);
        if (pass) {
          if (danger > 0.8) {
            pass.score *= 0.5;
          }
          if (bunker > 0.48) {
            pass.score *= 1.12;
          }
          candidates.push(pass);
        }
      }

      const pressure = this.evaluatePressure(unit);
      if (pressure) {
        if (danger > 0.7 && bunker < 0.38) {
          pressure.score *= 0.6;
        }
        if (bunker > 0.45) {
          pressure.score *= 1 + bunker * 0.48;
        }
        candidates.push(pressure);
      }
    }

    return candidates;
  }

  // === ОЦЕНКА УДАРОВ ===

  private evaluateGoalShot(unit: AIUnit): ShotCandidate | null {
    const uPos = unit.body.position;
    const bPos = this.ball.body.position;
    
    const goalCenter = {
      x: this.fieldBounds.centerX,
      y: this.fieldBounds.bottom,
    };
    
    const distToBall = Phaser.Math.Distance.Between(uPos.x, uPos.y, bPos.x, bPos.y);
    
    const toBall = new Phaser.Math.Vector2(bPos.x - uPos.x, bPos.y - uPos.y);
    const toGoal = new Phaser.Math.Vector2(goalCenter.x - bPos.x, goalCenter.y - bPos.y);
    
    const angle = Math.abs(Phaser.Math.RadToDeg(toBall.angle() - toGoal.angle()));
    const normAngle = Math.abs(((angle + 180) % 360) - 180);
    
    if (normAngle > 90) return null;
    
    const power = this.calculatePower(unit, distToBall);
    const dir = toBall.normalize();
    const force = this.applyError(dir, power, unit);
    
    let score = 50;
    score += Math.max(0, 30 - distToBall / 10);
    score += (90 - normAngle) / 3;
    
    const unitClass = unit.getCapClass();
    
    // ✅ IMPROVED: Enhanced role-aware bonuses
    // Sniper: bonus for long-range shots with clear path to goal
    if (unitClass === 'sniper') {
      if (distToBall > 150) {
        score += 25; // Long-range bonus
      }
      // Additional bonus if path to goal is relatively clear
      score += 10;
    }
    
    // Tank: penalty for very long shots (reduce random long bombs)
    if (unitClass === 'tank' && distToBall > 200) {
      score -= 15;
    }
    
    // Trickster: bonus for medium-range shots with good angle
    if (unitClass === 'trickster' && distToBall > 100 && distToBall < 180 && normAngle < 45) {
      score += 15;
    }
    
    score *= (0.5 + this.state.aggression * 0.5);
    score *= 1 + this.profileNoise.aggressionOffset * 0.28;

    // ✅ BOSS OVERRIDES
    if (this.bossId === 'boss_krag') {
      score *= 1.5; // Krag always wants to shoot
    }
    if (this.bossId === 'boss_unit734') {
      // Unit 734 only takes high percentage shots
      if (score < 60) score = 0;
      else score *= 1.2;
    }
    
    return {
      unit,
      target: goalCenter,
      score,
      type: 'goal',
      force,
      description: `Goal by ${unit.getCapClass()} (dist:${distToBall.toFixed(0)})`,
    };
  }

  private evaluateDefenseShot(unit: AIUnit): ShotCandidate | null {
    const uPos = unit.body.position;
    const bPos = this.ball.body.position;
    
    const ourGoal = { x: this.fieldBounds.centerX, y: this.fieldBounds.top };
    const ballToGoal = Phaser.Math.Distance.Between(bPos.x, bPos.y, ourGoal.x, ourGoal.y);
    
    if (ballToGoal > this.settings.defenseZone) return null;
    
    const distToBall = Phaser.Math.Distance.Between(uPos.x, uPos.y, bPos.x, bPos.y);
    const toBall = new Phaser.Math.Vector2(bPos.x - uPos.x, bPos.y - uPos.y).normalize();
    
    const power = this.calculatePower(unit, distToBall) * 1.2;
    const force = this.applyError(toBall, power, unit);
    
    let score = 40;
    score += (this.settings.defenseZone - ballToGoal) / 5;
    
    const unitClass = unit.getCapClass();
    
    // ✅ IMPROVED: Enhanced role-aware defense bonuses
    // Tank: significant bonus for defense (prioritize blocking shots)
    if (unitClass === 'tank') {
      score += 25; // Increased from 15
    }
    
    // Sniper: small penalty to avoid wasting snipers on pure defense if others are closer
    if (unitClass === 'sniper') {
      score -= 10;
    }
    
    // Goal-line blocking: extra heavy bonus for tanks when ball is very close to goal
    if (ballToGoal < 100) {
      if (unitClass === 'tank') {
        score += 30; // Heavy boost for goal-line clearing
      }
      // Boost all units for emergency defense
      score += 20;
    }
    
    score -= distToBall / 20;
    
    if (this.state.aiScore < this.state.playerScore) {
      score *= 1.3;
    }
    
    // ✅ BOSS OVERRIDES
    if (this.bossId === 'boss_unit734' || this.bossId === 'boss_oracle') {
      // These bosses defend aggressively
      score *= 1.3;
    }
    
    return {
      unit,
      target: bPos,
      score,
      type: 'defend',
      force,
      description: `Defense by ${unit.getCapClass()}`,
    };
  }

  private evaluatePass(unit: AIUnit): ShotCandidate | null {
    const uPos = unit.body.position;
    const bPos = this.ball.body.position;
    
    let bestTeammate: AIUnit | null = null;
    let bestScore = 0;
    
    // ✅ Универсальный цикл для любого количества тиммейтов
    for (const tm of this.aiUnits) {
      if (tm === unit) continue;
      
      const tmPos = tm.body.position;
      const distToGoal = Phaser.Math.Distance.Between(
        tmPos.x, tmPos.y,
        this.fieldBounds.centerX, this.fieldBounds.bottom
      );
      
      let posScore = (this.fieldBounds.height - distToGoal) / this.fieldBounds.height * 50;
      
      // ✅ IMPROVED: Extra weight if teammate is a sniper (especially when closer to opponent goal)
      const tmClass = tm.getCapClass();
      if (tmClass === 'sniper') {
        posScore += 20; // Prefer passing to snipers
        // Additional bonus if sniper is in good position
        if (distToGoal < this.fieldBounds.height * 0.6) {
          posScore += 15;
        }
      }
      
      if (posScore > bestScore) {
        bestScore = posScore;
        bestTeammate = tm;
      }
    }
    
    if (!bestTeammate) return null;
    
    const distToBall = Phaser.Math.Distance.Between(uPos.x, uPos.y, bPos.x, bPos.y);
    const toBall = new Phaser.Math.Vector2(bPos.x - uPos.x, bPos.y - uPos.y).normalize();
    
    const power = this.calculatePower(unit, distToBall) * 0.7;
    const force = this.applyError(toBall, power, unit);
    
    return {
      unit,
      target: bestTeammate.body.position,
      score: bestScore * 0.6,
      type: 'pass',
      force,
      description: `Pass by ${unit.getCapClass()} to ${bestTeammate.getCapClass()}`,
    };
  }

  private evaluatePressure(unit: AIUnit): ShotCandidate | null {
    const uPos = unit.body.position;
    const bPos = this.ball.body.position;
    
    const distToBall = Phaser.Math.Distance.Between(uPos.x, uPos.y, bPos.x, bPos.y);
    
    if (distToBall > 250) return null;
    
    const toBall = new Phaser.Math.Vector2(bPos.x - uPos.x, bPos.y - uPos.y).normalize();
    const power = this.calculatePower(unit, distToBall) * 0.5;
    const force = this.applyError(toBall, power, unit);
    
    let score = 20 + Math.max(0, 20 - distToBall / 10);
    
    if (unit.getCapClass() === 'trickster') {
      score += 10;
    }
    
    return {
      unit,
      target: bPos,
      score: score * this.state.aggression,
      type: 'pressure',
      force,
      description: `Pressure by ${unit.getCapClass()}`,
    };
  }

  // === ВСПОМОГАТЕЛЬНЫЕ ===

  private calculatePower(unit: AIUnit, distance: number): number {
    const { min, max } = this.settings.shotPower;
    let power = Phaser.Math.Linear(min, max, Math.min(distance / 300, 1));
    
    // Учитываем класс юнита
    switch (unit.getCapClass()) {
      case 'sniper':
        power *= 1.25;
        break;
      case 'tank':
        power *= 0.85;
        break;
      case 'trickster':
        power *= 1.0;
        break;
    }
    
    return power;
  }

  private applyError(
    dir: Phaser.Math.Vector2,
    power: number,
    unit: AIUnit
  ): { x: number; y: number } {
    let errorRange = (1 - this.settings.accuracy) * 0.5;
    
    // Снайпер точнее
    if (unit.getCapClass() === 'sniper') {
      errorRange *= 0.5;
    }
    
    // Трикстер добавляет кривизну
    if (unit.getCapClass() === 'trickster' && this.settings.useClassAbilities) {
      dir.rotate((Math.random() - 0.5) * 0.3);
    }
    
    dir.rotate((Math.random() - 0.5) * errorRange);
    
    // ✅ ИСПРАВЛЕНО: Безопасный доступ к stats через приведение типа
    const unitWithStats = unit as AIUnitWithStats;
    const forceMultiplier = unitWithStats.stats?.forceMultiplier ?? DEFAULT_FORCE_MULTIPLIER;
    const maxForce = unitWithStats.stats?.maxForce ?? DEFAULT_MAX_FORCE;
    const finalPower = Math.min(power * forceMultiplier * 200, maxForce);
    
    return { x: dir.x * finalPower, y: dir.y * finalPower };
  }

  private executeShot(candidate: ShotCandidate): void {
    // 🔥 FIX: Safety check for paused physics
    if (!this.scene.matter.world.enabled) {
      console.warn('[AI] ⚠️ Physics paused, aborting shot execution. Will retry next frame.');
      this.finishMove(); // Reset flags so GameScene can retry
      return;
    }
    
    const { unit, force } = candidate;
    
    this.scene.matter.body.applyForce(
      unit.body,
      unit.body.position,
      force
    );
    
    if (typeof (unit as any).playHitEffect === 'function') {
      (unit as any).playHitEffect();
    }
    
    AudioManager.getInstance().playSFX('sfx_kick');
    
    this.finishMove();
  }

  private finishMove(): void {
    this.isThinking = false;
    this.lastMoveTime = Date.now();
    this.moveCompleteCallback?.();
  }

  // ⭐ NEW: Получить доступные карты AI
  getAvailableCards(): CardDefinition[] {
    return [...this.availableCards];
  }

  // ⭐ NEW: Получить количество использованных карт
  getCardsUsedCount(): number {
    return this.cardsUsedThisMatch;
  }

  destroy(): void {
    this.stop();
    this.moveCompleteCallback = undefined;
    this.onCardUsed = undefined;
    this.availableCards = [];
  }
}