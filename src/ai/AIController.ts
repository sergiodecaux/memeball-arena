// ✅ ИЗМЕНЕНО: Добавлены формации для 4 и 5 юнитов (Faction Mastery v9)

import Phaser from 'phaser';
import { Ball } from '../entities/Ball';
import { AIDifficulty, normalizeGameAIDifficulty, AIDifficultyInput } from '../types';
import { FIELD, GOAL, FactionId, LASSO_CONFIG } from '../constants/gameConstants';
import {
  AIMatchContext,
  getContextDifficultyModifier,
  getContextReactionModifier,
} from './MatchContext';
import { Formation } from '../data/PlayerData';
import { AudioManager } from '../managers/AudioManager';
import { AbilityScorer, AIUnit, CardScore, GameState } from './scoring/AbilityScorer';
import { CardDefinition, getCardsByFaction } from '../data/CardsCatalog';
import { getAIFormationsForTeamSize, getDefaultAIFormation } from './AIFormations';
import { AIUtils } from './AIUtils';
import type { AIOpponentProfile } from './AIProfile';
import { getProfileCardModifiers, getProfilePlaystyleNoise } from './AIProfile';
import type {
  AISkillLevel,
  ComebackState,
  CounterStrategy,
  OpponentAnalysis,
  PassChainPlan,
  PlayerPattern,
  UnitSynergy,
} from './types/AITypes';
import { PreMatchAnalyzer } from './analysis/PreMatchAnalyzer';
import { PatternRecognizer } from './patterns/PatternRecognizer';
import { ComebackPlanner } from './comeback/ComebackPlanner';
import { SynergyAnalyzer } from './synergy/SynergyAnalyzer';
import { PassChainPlanner } from './passes/PassChainPlanner';
import { MatchAdapter } from './adaptation/MatchAdapter';

// === ТИПЫ ===

interface ShotCandidate {
  unit: AIUnit;
  target: { x: number; y: number };
  score: number;
  type: 'goal' | 'pass' | 'defend' | 'clear' | 'pressure' | 'lasso' | 'pass_chain';
  force: { x: number; y: number };
  description: string;
  passChain?: PassChainPlan;
}

interface AIState {
  playerScore: number;
  aiScore: number;
  lastGoalBy: 'player' | 'ai' | null;
  consecutiveGoalsAgainst: number;
  turnsSinceLastGoal: number;
  currentFormation: Formation;
  aggression: number;
  /** Номер завершённого хода AI (инкремент в startTurn). */
  turnNumber: number;
  /** Оценка оставшихся ходов до конца матча (если неизвестно — большое число). */
  turnsRemaining: number;
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
  usePassChains: boolean;
  useSynergyAnalysis: boolean;
  usePatternRecognition: boolean;
  adaptDuringMatch: boolean;
  comebackAggression: number;
  usePreMatchAnalysis: boolean;
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

const DEFAULT_FORCE_MULTIPLIER = 0.0045;
const DEFAULT_MAX_FORCE = 0.08;

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
    usePassChains: false,
    useSynergyAnalysis: false,
    usePatternRecognition: false,
    adaptDuringMatch: false,
    comebackAggression: 0.35,
    usePreMatchAnalysis: false,
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
    usePassChains: true,
    useSynergyAnalysis: true,
    usePatternRecognition: false,
    adaptDuringMatch: true,
    comebackAggression: 0.55,
    usePreMatchAnalysis: true,
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
    usePassChains: true,
    useSynergyAnalysis: true,
    usePatternRecognition: true,
    adaptDuringMatch: true,
    comebackAggression: 0.75,
    usePreMatchAnalysis: true,
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
    usePassChains: true,
    useSynergyAnalysis: true,
    usePatternRecognition: true,
    adaptDuringMatch: true,
    comebackAggression: 1.0,
    usePreMatchAnalysis: true,
  },
};

// === ОСНОВНОЙ КЛАСС ===

export class AIController {
  private scene: Phaser.Scene;
  private difficulty: AIDifficulty;
  private skillLevel: AISkillLevel;
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
    turnNumber: 0,
    turnsRemaining: 999,
  };

  // ⭐ NEW: Карточная система AI
  private factionId: FactionId = 'magma';
  private availableCards: CardDefinition[] = [];
  private cardsUsedThisMatch: number = 0;
  private onCardUsed?: (cardId: string, targetData: any) => boolean;
  
  // ✅ ADDED: Boss tracking
  private bossId?: string;

  private profile: AIOpponentProfile;
  private profileCardMods: ReturnType<typeof getProfileCardModifiers>;
  private profileNoise: ReturnType<typeof getProfilePlaystyleNoise>;

  private moveCompleteCallback?: (skipDirectorShot?: boolean) => void;
  private thinkingTimer?: Phaser.Time.TimerEvent;

  /** Запуск сценария лассо (трикстер); при успехе ход уже завершён через handleLassoReleased → onShot(capId). */
  private tricksterLassoRunner?: (
    unit: AIUnit,
    aimX: number,
    aimY: number,
    onFinished: (usedLasso: boolean) => void,
  ) => boolean;

  /** Ограничение выбора фишки (цепочка SUPER Xerxa и др.) */
  private captainShotGate?: (unit: AIUnit) => boolean;

  /** Режим матча (лига / турнир / PvP-бот и т.д.) — задаётся после init через setMatchContext */
  private aiMatchContext: AIMatchContext = { mode: 'friendly' };

  private opponentAnalysis?: OpponentAnalysis;
  private counterStrategy?: CounterStrategy;
  private patternRecognizer!: PatternRecognizer;
  private passChainPlanner!: PassChainPlanner;
  private matchAdapter = new MatchAdapter();
  private teamSynergies: UnitSynergy[] = [];
  private comebackState?: ComebackState;
  private hasAppliedInitialCounterFormation = false;

  // ЗАЩИТА ОТ ДВОЙНОГО ХОДА
  public isThinking = false;
  private lastMoveTime = 0;
  private readonly MOVE_COOLDOWN = 800;

  constructor(scene: Phaser.Scene, difficulty: AIDifficultyInput = 'medium', profile?: AIOpponentProfile) {
    this.scene = scene;
    this.difficulty = normalizeGameAIDifficulty(difficulty);
    this.skillLevel = this.mapDifficultyToSkillLevel(this.difficulty);
    this.settings = { ...DIFFICULTY_SETTINGS[this.difficulty] };

    this.profile = profile ?? { tier: 'standard', seed: 0 };
    this.profileCardMods = getProfileCardModifiers(this.profile.tier);
    this.profileNoise = getProfilePlaystyleNoise(this.profile.seed);

    this.calculateFieldBounds();
    this.patternRecognizer = new PatternRecognizer(this.fieldBounds);
    this.passChainPlanner = new PassChainPlanner(this.fieldBounds);

    console.log(`[AI] 🤖 Created: ${this.difficulty} (${this.skillLevel}), profile=${this.profile.tier}`);
  }

  private mapDifficultyToSkillLevel(d: AIDifficulty): AISkillLevel {
    switch (d) {
      case 'easy':
        return 'easy';
      case 'medium':
        return 'medium';
      case 'hard':
        return 'hard';
      case 'impossible':
        return 'expert';
      default:
        return 'medium';
    }
  }

  setCaptainShotGate(fn: ((unit: AIUnit) => boolean) | undefined): void {
    this.captainShotGate = fn;
  }

  private allowedByCaptainGate(unit: AIUnit): boolean {
    return !this.captainShotGate || this.captainShotGate(unit);
  }

  public setMatchContext(ctx: AIMatchContext): void {
    this.aiMatchContext = ctx;
    this.applyContextToSettings();
    this.updateAggression();
    console.log(`[AI] 🎮 Match context: ${ctx.mode}`, ctx);
  }

  private applyContextToSettings(): void {
    if (this.bossId) return;

    const base = DIFFICULTY_SETTINGS[this.difficulty];
    const diffMod = getContextDifficultyModifier(this.aiMatchContext);
    const reactMod = getContextReactionModifier(this.aiMatchContext);

    this.settings = { ...base };
    this.settings.accuracy = Math.min(0.99, base.accuracy * diffMod);
    this.settings.reactionTime = {
      min: Math.round(base.reactionTime.min * reactMod),
      max: Math.round(base.reactionTime.max * reactMod),
    };

    if (
      this.aiMatchContext.mode === 'tournament' &&
      (this.aiMatchContext.tournamentRound === '2' || this.aiMatchContext.tournamentRound === '4')
    ) {
      this.settings.formationAdaptation = true;
      this.settings.cardUsageChance = Math.min(0.9, base.cardUsageChance * 1.3);
    }

    if (this.aiMatchContext.mode === 'league') {
      if (this.aiMatchContext.leagueTier === 'nebula' || this.aiMatchContext.leagueTier === 'core') {
        this.settings.passChance = Math.min(0.6, base.passChance * 1.4);
      }
    }

    if (this.aiMatchContext.mode === 'pvp') {
      this.settings.formationAdaptation = true;
    }

    console.log(
      `[AI] ⚙️ Settings after context: acc=${this.settings.accuracy.toFixed(2)}, react=${this.settings.reactionTime.min}-${this.settings.reactionTime.max}ms`,
    );
    this.updateComebackState();
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
        this.settings.usePassChains = true;
        this.settings.useSynergyAnalysis = true;
        this.settings.usePatternRecognition = true;
        this.settings.adaptDuringMatch = true;
        this.settings.usePreMatchAnalysis = false;
        this.settings.comebackAggression = 0.85;
      }
    }
    
    this.hasAppliedInitialCounterFormation = false;

    // Генерируем виртуальную руку карт
    this.generateCardHand();

    if (!this.bossId) {
      this.performPreMatchAnalysis();
    }
    this.updateComebackState();

    // ✅ ИЗМЕНЕНО: Выбираем формацию с учётом размера команды
    this.selectFormation();

    console.log(`[AI] Initialized: ${aiUnits.length} AI (${this.factionId}), ${playerUnits.length} player units, teamSize: ${this.teamSize}`);
    console.log(`[AI] Card hand: ${this.availableCards.map(c => c.id).join(', ')}`);
    if (this.opponentAnalysis) {
      console.log(`[AI] 🔍 Opponent strategy hint: ${this.opponentAnalysis.likelyStrategy}`);
    }
  }

  private performPreMatchAnalysis(): void {
    if (!this.settings.usePreMatchAnalysis || this.playerUnits.length === 0) return;

    let playerFaction: FactionId = 'magma';
    if (typeof this.playerUnits[0].getFactionId === 'function') {
      playerFaction = this.playerUnits[0].getFactionId!() || 'magma';
    }

    this.opponentAnalysis = PreMatchAnalyzer.analyzeOpponent(this.playerUnits, playerFaction);
    this.counterStrategy = PreMatchAnalyzer.createCounterStrategy(
      this.opponentAnalysis,
      this.aiUnits,
      this.skillLevel,
    );

    if (this.counterStrategy) {
      this.settings.passChance = Math.min(
        0.8,
        this.settings.passChance * (0.8 + this.counterStrategy.playStyle.passFrequency * 0.4),
      );
      this.settings.cardUsageChance = Math.min(
        0.95,
        this.settings.cardUsageChance * (0.8 + this.counterStrategy.playStyle.cardUsage * 0.35),
      );
    }

    if (this.settings.useSynergyAnalysis) {
      this.teamSynergies = SynergyAnalyzer.findTeamSynergies(this.aiUnits);
    }
  }

  private updateComebackState(): void {
    this.comebackState = ComebackPlanner.createComebackPlan(
      this.state.aiScore,
      this.state.playerScore,
      this.state.turnsRemaining,
      this.teamSize,
      this.skillLevel,
    );
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
  setCardUsedCallback(callback: (cardId: string, targetData: any) => boolean): void {
    this.onCardUsed = callback;
  }

  onMoveComplete(callback: (skipDirectorShot?: boolean) => void): void {
    this.moveCompleteCallback = callback;
  }

  setTricksterLassoRunner(
    fn:
      | ((
          unit: AIUnit,
          aimX: number,
          aimY: number,
          onFinished: (usedLasso: boolean) => void,
        ) => boolean)
      | undefined,
  ): void {
    this.tricksterLassoRunner = fn;
  }

  // === УПРАВЛЕНИЕ СЧЁТОМ ===

  updateScore(playerScore: number, aiScore: number): void {
    this.state.playerScore = playerScore;
    this.state.aiScore = aiScore;
    this.updateAggression();
    this.updateComebackState();
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

    if (this.settings.adaptDuringMatch) {
      const trigger = scoredBy === 'player' ? 'goal_conceded' : 'goal_scored';
      const action = this.settings.formationAdaptation ? 'changed_formation' : 'maintained_strategy';
      const result = scoredBy === 'ai' ? 'positive' : 'negative';
      this.matchAdapter.recordAdaptation(trigger, action, result);
    }
  }

  private updateAggression(): void {
    const diff = this.state.aiScore - this.state.playerScore;

    let baseAggr: number;
    if (diff >= 2) {
      baseAggr = 0.28;
    } else if (diff === 1) {
      baseAggr = 0.48;
    } else if (diff === 0) {
      baseAggr = 0.60;
    } else if (diff === -1) {
      baseAggr = 0.75;
    } else {
      baseAggr = 0.90;
    }

    if (this.state.consecutiveGoalsAgainst >= 2) {
      baseAggr = Math.max(0.20, baseAggr - 0.20);
    }

    if (this.comebackState && this.comebackState.desperationLevel !== 'none') {
      baseAggr = Math.min(1, baseAggr * (1 + this.settings.comebackAggression * 0.28));
    }

    this.state.aggression = Phaser.Math.Clamp(baseAggr, 0.15, 0.97);
  }

  // === ВЫБОР СХЕМЫ ===
  // ✅ ИЗМЕНЕНО: Выбор формации с учётом размера команды

  private getFormationsForTeamSize(): Record<string, Formation> {
    return getAIFormationsForTeamSize(this.teamSize);
  }

  private selectFormation(): void {
    const formations = this.getFormationsForTeamSize();

    if (this.counterStrategy && !this.hasAppliedInitialCounterFormation && !this.bossId) {
      this.state.currentFormation = this.counterStrategy.recommendedFormation;
      this.hasAppliedInitialCounterFormation = true;
      console.log(`[AI] 📐 Initial formation (counter-setup): ${this.counterStrategy.recommendedFormation.name}`);
      return;
    }

    if (this.comebackState && this.comebackState.desperationLevel !== 'none') {
      const comebackFormation = ComebackPlanner.getComebackFormation(this.comebackState, this.teamSize);
      if (comebackFormation.id !== this.state.currentFormation.id) {
        console.log(`[AI] 🔥 Comeback formation → ${comebackFormation.name}`);
        this.state.currentFormation = comebackFormation;
        return;
      }
    }

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
    this.state.turnNumber++;

    if (this.settings.adaptDuringMatch) {
      this.matchAdapter.updateTurn(this.state.turnNumber);
      this.checkAndApplyAdaptation();
    }

    const delay = Phaser.Math.Between(
      this.settings.reactionTime.min,
      this.settings.reactionTime.max
    );
    
    console.log(`[AI] 🧠 Thinking... (${delay}ms, aiTurn ${this.state.turnNumber})`);
    
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

  private checkAndApplyAdaptation(): void {
    if (!this.settings.adaptDuringMatch) return;

    const playerPattern = this.settings.usePatternRecognition
      ? this.patternRecognizer.analyzePatterns()
      : this.patternRecognizer.getDefaultPattern();

    const adaptation = this.matchAdapter.shouldAdapt(
      this.state.aiScore,
      this.state.playerScore,
      playerPattern,
      this.state.turnsRemaining,
      this.skillLevel,
    );

    if (adaptation.actions.changeFormation) {
      const newFormation = this.matchAdapter.getAdaptiveFormation(
        this.state.currentFormation,
        adaptation,
        this.teamSize,
        this.state.aiScore,
        this.state.playerScore,
      );
      if (newFormation.id !== this.state.currentFormation.id) {
        console.log(`[AI] 🔄 Adaptive formation → ${newFormation.name}`);
        this.state.currentFormation = newFormation;
      }
    }

    if (adaptation.actions.switchPlayStyle) {
      if (playerPattern.detected.positioning === 'offensive') {
        this.settings.defenseZone = Math.min(600, this.settings.defenseZone * 1.15);
      } else if (playerPattern.detected.positioning === 'defensive') {
        this.settings.passChance = Math.min(0.85, this.settings.passChance * 1.12);
      }
    }
  }

  // === ЛОГИКА ХОДА ===

  private executeMove(): void {
    if (!this.isThinking) {
      console.log('[AI] ⚠️ Not thinking anymore, aborting move');
      return;
    }

    if (this.shouldUseCard()) {
      this.tryUseCard();
    }

    const candidates = this.generateAllCandidates();

    if (candidates.length === 0) {
      console.log('[AI] ❌ No valid moves!');
      this.finishMove();
      return;
    }

    candidates.sort((a, b) => b.score - a.score);

    let selected: ShotCandidate;

    const isPvPBot = this.aiMatchContext.mode === 'pvp';
    const isTournamentFinal =
      this.aiMatchContext.mode === 'tournament' && this.aiMatchContext.tournamentRound === '2';
    const isHighLeague =
      this.aiMatchContext.mode === 'league' &&
      (this.aiMatchContext.leagueTier === 'nebula' || this.aiMatchContext.leagueTier === 'core');

    if (this.difficulty === 'impossible' || isTournamentFinal || isHighLeague) {
      const topN = Math.min(2, candidates.length);
      selected = candidates[0];
      if (topN > 1 && Math.random() < 0.1) {
        selected = candidates[1];
      }
    } else if (this.difficulty === 'hard') {
      selected = candidates[0];
    } else if (this.difficulty === 'medium' || isPvPBot) {
      const topN = Math.min(3, candidates.length);
      const errorChance = isPvPBot ? 0.18 : 0.08;
      if (Math.random() < errorChance && topN > 1) {
        selected = candidates[Math.floor(Math.random() * topN)];
      } else {
        selected = Phaser.Math.RND.pick(candidates.slice(0, Math.min(2, topN)));
      }
    } else {
      const topN = Math.min(4, candidates.length);
      const midStart = Math.max(1, Math.floor(topN / 2));
      const pool = candidates.slice(midStart, topN);
      selected =
        pool.length > 0 ? Phaser.Math.RND.pick(pool) : candidates[candidates.length - 1];
    }

    console.log(
      `[AI] 🎯 ${selected.description} (score:${selected.score.toFixed(1)}, mode:${this.aiMatchContext.mode})`,
    );
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

    if (this.comebackState && ComebackPlanner.shouldUseCardForComeback(this.comebackState)) {
      return true;
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
    let preferred = Math.max(
      6,
      Math.floor(this.settings.minCardScore * this.profileCardMods.minScoreMultiplier * (bunker > 0.55 ? 0.85 : 1)),
    );

    const prio = this.counterStrategy?.abilityPriority ?? [];
    if (prio.length > 0 && Math.random() < 0.35) {
      preferred = Math.max(5, Math.floor(preferred * 0.88));
    }

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

    const applied = this.onCardUsed?.(bestCard.cardId, bestCard.targetData) ?? false;
    if (!applied) {
      console.warn(`[AI] 🃏 Card apply failed: ${bestCard.card.name} — keeping in hand`);
      return false;
    }

    this.availableCards = this.availableCards.filter(c => c.id !== bestCard.cardId);
    this.cardsUsedThisMatch++;
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
    const goalOpenness = this.evaluateGoalOpenness();
    const bunkerAttackBoost = (1 + bunker * 0.62) * (1 + this.profileNoise.bunkerOffset * 0.35);

    const pushPassChainCandidate = (chain: PassChainPlan, scoreBoost: number, description: string) => {
      const pass = chain.passes[0];
      const force = this.calculatePassChainForce(chain.initiator, pass);
      candidates.push({
        unit: chain.initiator,
        target: { x: pass.targetX, y: pass.targetY },
        score: chain.totalScore + scoreBoost,
        type: 'pass_chain',
        force,
        description,
        passChain: chain,
      });
    };

    if (this.settings.usePassChains && this.aiUnits.length >= 2) {
      const passChain = this.passChainPlanner.planBestPassChain(
        this.aiUnits,
        this.ball,
        this.fieldBounds.bottom,
        58,
      );
      if (passChain) {
        pushPassChainCandidate(
          passChain,
          0,
          `Pass chain ${passChain.passes.length + 1}-step (${passChain.expectedOutcome})`,
        );
      }

      if (this.skillLevel === 'hard' || this.skillLevel === 'expert') {
        const tiki = this.passChainPlanner.planSpecialCombo(this.aiUnits, this.ball, this.fieldBounds.bottom, 'tiki-taka');
        if (tiki && tiki.totalScore >= 68) {
          pushPassChainCandidate(tiki, 14, '⚡ Tiki-taka setup');
        }
        const dribSnipe = this.passChainPlanner.planSpecialCombo(
          this.aiUnits,
          this.ball,
          this.fieldBounds.bottom,
          'dribble-snipe',
        );
        if (dribSnipe && dribSnipe.totalScore >= 62) {
          pushPassChainCandidate(dribSnipe, 11, '🎯 Dribble → sniper lane');
        }
        if (this.state.aiScore < this.state.playerScore) {
          const outlet = this.passChainPlanner.planSpecialCombo(
            this.aiUnits,
            this.ball,
            this.fieldBounds.bottom,
            'tank-outlet',
          );
          if (outlet && outlet.totalScore >= 52) {
            pushPassChainCandidate(outlet, 9, '🛡️ Outlet pass');
          }
        }
        if (this.skillLevel === 'expert' && this.state.aiScore < this.state.playerScore) {
          const chaos = this.passChainPlanner.planSpecialCombo(this.aiUnits, this.ball, this.fieldBounds.bottom, 'chaos');
          if (chaos && chaos.totalScore >= 58) {
            pushPassChainCandidate(chaos, 16, '🌀 Chaos link-up');
          }
        }
      }
    }

    for (const unit of this.aiUnits) {
      if (unit.isStunned?.()) continue;
      if (!this.allowedByCaptainGate(unit)) continue;

      const synergyBonus = this.calculateSynergyBonus(unit);

      const goal = this.evaluateGoalShot(unit);
      if (goal) {
        goal.score += synergyBonus;
        if (attackOpportunity > 0.6) {
          goal.score *= 1.2;
        }
        if (bunker > 0.52) {
          goal.score *= bunkerAttackBoost;
        }
        if (goalOpenness > 0.6) {
          goal.score *= 1.0 + goalOpenness * 0.3;
        }
        if (this.comebackState?.tactics.allowLongShots) {
          goal.score *= 1.12;
        }
        candidates.push(goal);
      }

      const lassoShot = this.evaluateTricksterLassoShot(unit);
      if (lassoShot) {
        candidates.push(lassoShot);
      }

      const defend = this.evaluateDefenseShot(unit);
      if (defend) {
        if (danger > 0.7) {
          defend.score *= 1.35;
        }
        if (danger < 0.25) {
          defend.score *= 0.65;
        }
        if (bunker > 0.55 && danger < 0.68) {
          defend.score *= 1 - bunker * 0.22;
        }
        candidates.push(defend);
      }

      let effectivePassChance = Phaser.Math.Clamp(this.settings.passChance + this.profileNoise.passOffset, 0, 0.92);
      if (this.comebackState?.tactics.allowRiskyPasses) {
        effectivePassChance = Math.min(0.92, effectivePassChance * 1.22);
      }

      if (Math.random() < effectivePassChance) {
        const pass = this.evaluatePass(unit);
        if (pass) {
          pass.score += synergyBonus * 0.55;
          if (danger > 0.8) {
            pass.score *= 0.45;
          }
          if (bunker > 0.48) {
            pass.score *= 1.15;
          }
          candidates.push(pass);
        }
      }

      const pressure = this.evaluatePressure(unit);
      if (pressure) {
        if (danger > 0.7 && bunker < 0.38) {
          pressure.score *= 0.55;
        }
        if (bunker > 0.45) {
          pressure.score *= 1 + bunker * 0.45;
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

    // AI (player 2) атакует НИЖНИЕ ворота (fieldBounds.bottom)
    const goalCenter = {
      x: this.fieldBounds.centerX,
      y: this.fieldBounds.bottom,
    };

    const distToBall = Phaser.Math.Distance.Between(uPos.x, uPos.y, bPos.x, bPos.y);

    const maxHitDist: Record<string, number> = {
      sniper: 380,
      balanced: 320,
      trickster: 300,
      tank: 250,
      playmaker: 340,
      maestro: 310,
      enforcer: 260,
    };
    let effectiveMax = maxHitDist[unit.getCapClass()] ?? 320;
    if (this.comebackState?.tactics.allowLongShots) {
      effectiveMax *= 1.35;
    }
    if (distToBall > effectiveMax) return null;

    const toBall = new Phaser.Math.Vector2(bPos.x - uPos.x, bPos.y - uPos.y);
    const toGoal = new Phaser.Math.Vector2(goalCenter.x - bPos.x, goalCenter.y - bPos.y);

    const angle = Math.abs(Phaser.Math.RadToDeg(toBall.angle() - toGoal.angle()));
    const normAngle = Math.abs(((angle + 180) % 360) - 180);

    if (normAngle > 100) return null;

    const power = this.calculatePower(unit, distToBall);
    const dir = toBall.normalize();
    const force = this.applyError(dir, power, unit);

    let score = 45;
    score += Math.max(0, 35 - distToBall / 8);
    score += (100 - normAngle) / 3;

    const goalBlocked = this.playerUnits.some((p) => {
      const pPos = p.body.position;
      return Math.abs(pPos.x - goalCenter.x) < 70 && Math.abs(pPos.y - goalCenter.y) < 90;
    });
    if (!goalBlocked) score += 18;

    const unitClass = unit.getCapClass();
    if (unitClass === 'sniper' && distToBall > 130) score += 22;
    if (unitClass === 'tank' && distToBall > 180) score -= 15;
    if (
      unitClass === 'trickster' &&
      distToBall > 90 &&
      distToBall < 200 &&
      normAngle < 45
    ) {
      score += 12;
    }

    score *= 0.45 + this.state.aggression * 0.55;
    score *= 1 + this.profileNoise.aggressionOffset * 0.25;

    if (this.bossId === 'boss_krag') score *= 1.5;
    if (this.bossId === 'boss_unit734' && score < 65) return null;

    return {
      unit,
      target: goalCenter,
      score,
      type: 'goal',
      force,
      description: `Goal by ${unit.getCapClass()} angle:${normAngle.toFixed(0)}° dist:${distToBall.toFixed(0)}`,
    };
  }

  /** Лассо-трикстер к воротам игрока, только если мяч в кольце захвата и базовый голевой ход валиден. */
  private evaluateTricksterLassoShot(unit: AIUnit): ShotCandidate | null {
    if (unit.getCapClass() !== 'trickster') return null;
    if (!this.settings.useClassAbilities || !this.tricksterLassoRunner) return null;

    const baseGoal = this.evaluateGoalShot(unit);
    if (!baseGoal) return null;

    const uPos = unit.body.position;
    const bPos = this.ball.body.position;
    const distToBall = Phaser.Math.Distance.Between(uPos.x, uPos.y, bPos.x, bPos.y);
    const minDist = unit.getRadius() * LASSO_CONFIG.MIN_DISTANCE_RADII;
    if (distToBall < minDist || distToBall > LASSO_CONFIG.MAX_CAPTURE_DISTANCE) return null;

    const jitter = (1 - this.settings.accuracy) * 52;
    const target = {
      x: baseGoal.target.x + (Math.random() - 0.5) * jitter,
      y: baseGoal.target.y + (Math.random() - 0.5) * jitter * 0.35,
    };

    return {
      unit,
      target,
      score: baseGoal.score + 32,
      type: 'lasso',
      force: { x: 0, y: 0 },
      description: `Trickster lasso → goal dist:${distToBall.toFixed(0)}`,
    };
  }

  private evaluateDefenseShot(unit: AIUnit): ShotCandidate | null {
    const uPos = unit.body.position;
    const bPos = this.ball.body.position;
    const bVel = this.ball.body.velocity ?? { x: 0, y: 0 };

    // AI защищает ВЕРХНИЕ ворота (fieldBounds.top)
    const ourGoal = {
      x: this.fieldBounds.centerX,
      y: this.fieldBounds.top,
    };
    const ballToGoal = Phaser.Math.Distance.Between(bPos.x, bPos.y, ourGoal.x, ourGoal.y);

    const ballMovingToOurGoal = bVel.y < -1.5;
    const ballSpeed = Math.sqrt(bVel.x ** 2 + bVel.y ** 2);
    const dynamicZone =
      this.settings.defenseZone + (ballMovingToOurGoal ? ballSpeed * 20 : 0);

    if (ballToGoal > dynamicZone) return null;

    const distToBall = Phaser.Math.Distance.Between(uPos.x, uPos.y, bPos.x, bPos.y);

    const toBall = new Phaser.Math.Vector2(bPos.x - uPos.x, bPos.y - uPos.y).normalize();

    const sideDir = bPos.x < this.fieldBounds.centerX ? -0.3 : 0.3;
    const clearDir = new Phaser.Math.Vector2(
      toBall.x * 0.65 + sideDir * 0.35,
      toBall.y * 0.65 + 0.35,
    ).normalize();

    const power = this.calculatePower(unit, distToBall) * 1.3;
    const force = this.applyError(clearDir, power, unit);

    let score = 40;
    score += (dynamicZone - ballToGoal) / 4;
    if (ballMovingToOurGoal) score += ballSpeed * 5;
    score -= distToBall / 15;

    const unitClass = unit.getCapClass();
    if (unitClass === 'tank') score += 30;
    if (unitClass === 'sniper') score -= 8;

    if (ballToGoal < 120) {
      score += 50;
      if (unitClass === 'tank') score += 30;
    }

    if (this.state.consecutiveGoalsAgainst >= 2) score *= 1.4;
    if (this.state.aiScore < this.state.playerScore) score *= 1.2;

    if (this.bossId === 'boss_unit734' || this.bossId === 'boss_oracle') {
      score *= 1.3;
    }

    return {
      unit,
      target: bPos,
      score,
      type: 'defend',
      force,
      description: `Defense by ${unitClass} ballSpeed:${ballSpeed.toFixed(1)}`,
    };
  }

  /** Насколько открыты ворота игрока (0..1). */
  private evaluateGoalOpenness(): number {
    const goalCenter = {
      x: this.fieldBounds.centerX,
      y: this.fieldBounds.bottom,
    };
    const ballPos = this.ball.body.position;
    const goalHalfWidth = GOAL.WIDTH / 2;

    let openScore = 1.0;

    for (const p of this.playerUnits) {
      const pPos = p.body.position;
      const inGoalZone = Math.abs(pPos.x - goalCenter.x) < goalHalfWidth + 30;
      const nearGoalLine = pPos.y > this.fieldBounds.bottom - 120;
      if (inGoalZone && nearGoalLine) {
        openScore -= 0.35;
      }
      if (this.isOnShotLine(pPos, ballPos, goalCenter)) {
        openScore -= 0.25;
      }
    }

    return Math.max(0, openScore);
  }

  private isOnShotLine(
    point: { x: number; y: number },
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): boolean {
    const lineLen = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    if (lineLen === 0) return false;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const t = ((point.x - from.x) * dx + (point.y - from.y) * dy) / (lineLen * lineLen);

    if (t < 0 || t > 1) return false;

    const projX = from.x + t * dx;
    const projY = from.y + t * dy;
    const perpDist = Phaser.Math.Distance.Between(point.x, point.y, projX, projY);

    return perpDist < 35;
  }

  private evaluatePass(unit: AIUnit): ShotCandidate | null {
    const uPos = unit.body.position;
    const bPos = this.ball.body.position;

    let bestTeammate: AIUnit | null = null;
    let bestScore = 0;

    for (const tm of this.aiUnits) {
      if (tm === unit) continue;

      const tmPos = tm.body.position;
      const tmClass = tm.getCapClass();
      const unitClass = unit.getCapClass();

      const distToGoal = Phaser.Math.Distance.Between(
        tmPos.x,
        tmPos.y,
        this.fieldBounds.centerX,
        this.fieldBounds.bottom,
      );

      let posScore = ((this.fieldBounds.height - distToGoal) / this.fieldBounds.height) * 50;

      if (tmClass === 'sniper') {
        posScore += 28;
        if (distToGoal < this.fieldBounds.height * 0.6) posScore += 18;
      }
      if (tmClass === 'maestro') {
        posScore += 22;
        const centerDist = Math.abs(tmPos.x - this.fieldBounds.centerX);
        if (centerDist < this.fieldBounds.width * 0.25) posScore += 14;
      }
      if (tmClass === 'playmaker') {
        posScore += 20;
        if (distToGoal < this.fieldBounds.height * 0.5) posScore += 11;
      }
      if (tmClass === 'trickster') {
        posScore += 16;
        const angleFromCenter = Math.abs(tmPos.x - this.fieldBounds.centerX);
        if (angleFromCenter > this.fieldBounds.width * 0.2) posScore += 9;
      }
      if (tmClass === 'balanced') posScore += 10;
      if (tmClass === 'tank' || tmClass === 'enforcer') posScore -= 18;

      if (unitClass === 'maestro') posScore *= 1.28;
      else if (unitClass === 'playmaker') posScore *= 1.14;
      else if (unitClass === 'sniper') posScore *= 0.72;
      else if (unitClass === 'tank' || unitClass === 'enforcer') posScore *= 0.52;

      if (this.settings.useSynergyAnalysis) {
        posScore += SynergyAnalyzer.evaluatePairSynergy(unit, tm) * 0.26;
      }

      if (unitClass === 'maestro' && tmClass === 'sniper') posScore += 32;
      if (unitClass === 'playmaker' && tmClass === 'maestro') posScore += 26;
      if (
        (unitClass === 'playmaker' || unitClass === 'trickster') &&
        tmClass === 'sniper'
      ) {
        posScore += 23;
      }
      if (
        (unitClass === 'tank' || unitClass === 'enforcer') &&
        (tmClass === 'sniper' || tmClass === 'playmaker' || tmClass === 'maestro')
      ) {
        posScore += 28;
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
      description: `Pass: ${unit.getCapClass()} → ${bestTeammate.getCapClass()}`,
    };
  }

  private evaluatePressure(unit: AIUnit): ShotCandidate | null {
    const uPos = unit.body.position;
    const bPos = this.ball.body.position;
    const distToBall = Phaser.Math.Distance.Between(uPos.x, uPos.y, bPos.x, bPos.y);

    if (distToBall > 90) return null;

    const toBall = new Phaser.Math.Vector2(bPos.x - uPos.x, bPos.y - uPos.y).normalize();

    const power = this.calculatePower(unit, distToBall) * 0.5;
    const force = this.applyError(toBall, power, unit);

    const score = 6 + Math.max(0, 10 - distToBall / 5);

    return {
      unit,
      target: bPos,
      score,
      type: 'pressure',
      force,
      description: `Micro-press by ${unit.getCapClass()} dist:${distToBall.toFixed(0)}`,
    };
  }

  private calculateSynergyBonus(unit: AIUnit): number {
    if (!this.settings.useSynergyAnalysis || this.teamSynergies.length === 0) return 0;
    let bonus = 0;
    for (const synergy of this.teamSynergies) {
      if (synergy.units.includes(unit.id)) bonus += synergy.strength * 0.14;
    }
    return Math.min(18, bonus);
  }

  private calculatePassChainForce(
    initiator: AIUnit,
    pass: PassChainPlan['passes'][0],
  ): { x: number; y: number } {
    const from = initiator.body.position;
    const dx = pass.targetX - from.x;
    const dy = pass.targetY - from.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const dir = new Phaser.Math.Vector2(dx / len, dy / len);
    const distToBall = Phaser.Math.Distance.Between(
      from.x,
      from.y,
      this.ball.body.position.x,
      this.ball.body.position.y,
    );
    const power = this.calculatePower(initiator, distToBall) * 0.72;
    return this.applyError(dir, power, initiator);
  }

  private executePassChain(chain: PassChainPlan): void {
    const firstPass = chain.passes[0];
    const initiator = this.aiUnits.find((u) => u.id === firstPass.from);
    if (!initiator) {
      console.warn('[AI] Pass chain initiator not found');
      this.finishMove();
      return;
    }

    const force = this.calculatePassChainForce(initiator, firstPass);

    this.scene.matter.body.applyForce(initiator.body, initiator.body.position, force);

    if (typeof (initiator as unknown as { playHitEffect?: () => void }).playHitEffect === 'function') {
      (initiator as unknown as { playHitEffect: () => void }).playHitEffect();
    }

    AudioManager.getInstance().playSFX('sfx_kick');
    this.finishMove();
  }

  // === ВСПОМОГАТЕЛЬНЫЕ ===

  private calculatePower(unit: AIUnit, distance: number): number {
    const { min, max } = this.settings.shotPower;

    const MAX_EFFECTIVE_DIST = 320;
    let power = Phaser.Math.Linear(
      min,
      max,
      Math.min(distance / MAX_EFFECTIVE_DIST, 1),
    );

    switch (unit.getCapClass()) {
      case 'sniper':
        power *= distance > 160 ? 1.15 : 1.0;
        break;
      case 'tank':
        power *= distance < 110 ? 1.08 : 0.85;
        break;
      case 'trickster':
        power *= 0.95;
        break;
      case 'balanced':
      default:
        break;
    }

    return Phaser.Math.Clamp(power, 0.35, 1.0);
  }

  private applyError(
    dir: Phaser.Math.Vector2,
    power: number,
    unit: AIUnit,
  ): { x: number; y: number } {
    let errorRange = (1 - this.settings.accuracy) * 0.4;

    if (unit.getCapClass() === 'sniper') errorRange *= 0.45;
    if (unit.getCapClass() === 'trickster' && this.settings.useClassAbilities) {
      dir.rotate((Math.random() - 0.5) * 0.25);
    }

    dir.rotate((Math.random() - 0.5) * errorRange);

    const unitWithStats = unit as AIUnitWithStats;
    const forceMultiplier =
      unitWithStats.stats?.forceMultiplier ?? DEFAULT_FORCE_MULTIPLIER;
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

    if (candidate.type === 'pass_chain' && candidate.passChain) {
      this.executePassChain(candidate.passChain);
      return;
    }

    if (candidate.type === 'lasso') {
      this.executeTricksterLasso(candidate);
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

  private executeTricksterLasso(candidate: ShotCandidate): void {
    const runner = this.tricksterLassoRunner;
    if (!runner) {
      const fb = this.evaluateGoalShot(candidate.unit);
      if (fb) this.executeShot(fb);
      else this.finishMove();
      return;
    }

    const finishOrFallback = (usedLasso: boolean) => {
      if (usedLasso) {
        this.finishMove({ skipDirectorShot: true });
        return;
      }
      const fb = this.evaluateGoalShot(candidate.unit);
      if (fb) {
        this.executeShot(fb);
        return;
      }
      console.warn('[AI] Lasso failed and no fallback goal for trickster');
      this.finishMove();
    };

    const started = runner(
      candidate.unit,
      candidate.target.x,
      candidate.target.y,
      finishOrFallback,
    );

    if (!started) {
      finishOrFallback(false);
    }
  }

  private finishMove(opts?: { skipDirectorShot?: boolean }): void {
    this.isThinking = false;
    this.lastMoveTime = Date.now();
    this.moveCompleteCallback?.(opts?.skipDirectorShot === true);
  }

  // ⭐ NEW: Получить доступные карты AI
  getAvailableCards(): CardDefinition[] {
    return [...this.availableCards];
  }

  /** ID карт в виртуальной руке (для синхронизации колоды AbilityManager P2). */
  getHandCardIds(): string[] {
    return this.availableCards.map(c => c.id);
  }

  // ⭐ NEW: Получить количество использованных карт
  getCardsUsedCount(): number {
    return this.cardsUsedThisMatch;
  }

  public recordPlayerMove(
    unitId: string,
    targetX: number,
    targetY: number,
    wasPass: boolean = false,
    usedAbility: boolean = false,
  ): void {
    if (!this.settings.usePatternRecognition) return;
    this.patternRecognizer.recordMove(unitId, targetX, targetY, wasPass, usedAbility);
  }

  public getPlayerPattern(): PlayerPattern | null {
    if (!this.settings.usePatternRecognition) return null;
    return this.patternRecognizer.analyzePatterns();
  }

  public setTurnsRemaining(turns: number): void {
    this.state.turnsRemaining = Math.max(0, turns);
    this.updateComebackState();
  }

  destroy(): void {
    this.stop();
    this.moveCompleteCallback = undefined;
    this.tricksterLassoRunner = undefined;
    this.onCardUsed = undefined;
    this.availableCards = [];
    this.patternRecognizer.reset();
    this.matchAdapter.reset();
  }
}