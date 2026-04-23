/**
 * ROOKIE PATH - Путь Новичка
 * Специальные задания для новых игроков
 * Награда за завершение: бесплатная вторая фракция
 */

import { FactionId } from '../constants/gameConstants';
import { playerData } from './PlayerData';
import { eventBus, GameEvents } from '../core/EventBus';

// ═══════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════

export interface RookieTask {
  id: string;
  title: string;
  description: string;
  icon: string;
  progress: number;
  maxProgress: number;
  reward: {
    coins: number;
    crystals: number;
  };
  completed: boolean;
  claimed: boolean;
  checkCondition: () => number; // Возвращает текущий прогресс
}

export interface RookiePathProgress {
  tasks: Record<string, { progress: number; completed: boolean; claimed: boolean }>;
  pathCompleted: boolean;
  rewardClaimed: boolean;
  chosenFactionReward?: FactionId;
  startedAt: number;
  completedAt?: number;
}

// ═══════════════════════════════════════════════════════════════
// КОНФИГУРАЦИЯ ЗАДАНИЙ
// ═══════════════════════════════════════════════════════════════

const ROOKIE_TASKS_CONFIG: Omit<RookieTask, 'progress' | 'completed' | 'claimed' | 'checkCondition'>[] = [
  {
    id: 'rookie_first_win',
    title: 'Первая победа',
    description: 'Одержи свою первую победу в любом режиме',
    icon: '🏆',
    maxProgress: 1,
    reward: { coins: 300, crystals: 30 },
  },
  {
    id: 'rookie_score_goals',
    title: 'Начинающий бомбардир',
    description: 'Забей 10 голов в любых матчах',
    icon: '⚽',
    maxProgress: 10,
    reward: { coins: 400, crystals: 20 },
  },
  {
    id: 'rookie_win_3',
    title: 'Серия побед',
    description: 'Одержи 3 победы',
    icon: '🔥',
    maxProgress: 3,
    reward: { coins: 500, crystals: 30 },
  },
  {
    id: 'rookie_chapter1',
    title: 'Покоритель Вулкана',
    description: 'Пройди все уровни главы 1 кампании',
    icon: '🌋',
    maxProgress: 4,
    reward: { coins: 600, crystals: 50 },
  },
  {
    id: 'rookie_boss_krag',
    title: 'Победитель Крага',
    description: 'Победи босса Крага (уровень 1-4)',
    icon: '👹',
    maxProgress: 1,
    reward: { coins: 500, crystals: 40 },
  },
  {
    id: 'rookie_level_5',
    title: 'Растущая звезда',
    description: 'Достигни 5 уровня игрока',
    icon: '⭐',
    maxProgress: 5,
    reward: { coins: 700, crystals: 50 },
  },
  {
    id: 'rookie_perfect_game',
    title: 'Железная оборона',
    description: 'Выиграй матч, не пропустив голов',
    icon: '🛡️',
    maxProgress: 1,
    reward: { coins: 500, crystals: 30 },
  },
];

// Главная награда за завершение пути
export const ROOKIE_PATH_FINAL_REWARD = {
  coins: 1500,
  crystals: 100,
  // + бесплатная фракция на выбор
};

// ═══════════════════════════════════════════════════════════════
// КЛАСС МЕНЕДЖЕРА
// ═══════════════════════════════════════════════════════════════

class RookiePathManager {
  private static instance: RookiePathManager;
  private initialized = false;

  private constructor() {}

  static getInstance(): RookiePathManager {
    if (!RookiePathManager.instance) {
      RookiePathManager.instance = new RookiePathManager();
    }
    return RookiePathManager.instance;
  }

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    // Подписываемся на события для обновления прогресса
    eventBus.on(GameEvents.MATCH_FINISHED, this.onMatchFinished.bind(this));
    eventBus.on(GameEvents.GOAL_SCORED, this.onGoalScored.bind(this));
    
    console.log('[RookiePath] 🎓 Initialized');
  }

  // ═══════════════════════════════════════════════════════════════
  // ПОЛУЧЕНИЕ ДАННЫХ
  // ═══════════════════════════════════════════════════════════════

  getProgress(): RookiePathProgress {
    const data = playerData.get();
    
    // Инициализация если нет данных
    if (!data.rookiePath) {
      data.rookiePath = this.createDefaultProgress();
      playerData.save();
    }
    
    return data.rookiePath;
  }

  private createDefaultProgress(): RookiePathProgress {
    const tasks: Record<string, { progress: number; completed: boolean; claimed: boolean }> = {};
    
    ROOKIE_TASKS_CONFIG.forEach(task => {
      tasks[task.id] = { progress: 0, completed: false, claimed: false };
    });

    return {
      tasks,
      pathCompleted: false,
      rewardClaimed: false,
      startedAt: Date.now(),
    };
  }

  getTasks(): RookieTask[] {
    const progress = this.getProgress();
    
    return ROOKIE_TASKS_CONFIG.map(config => {
      const taskProgress = progress.tasks[config.id] || { progress: 0, completed: false, claimed: false };
      
      return {
        ...config,
        progress: taskProgress.progress,
        completed: taskProgress.completed,
        claimed: taskProgress.claimed,
        checkCondition: () => this.getTaskProgress(config.id),
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // ПРОВЕРКА ПРОГРЕССА ЗАДАНИЙ
  // ═══════════════════════════════════════════════════════════════

  private getTaskProgress(taskId: string): number {
    const data = playerData.get();
    const stats = data.stats;
    const campaign = data.campaignProgress;

    switch (taskId) {
      case 'rookie_first_win':
        return Math.min(stats.wins, 1);

      case 'rookie_score_goals':
        return Math.min(stats.goalsScored, 10);

      case 'rookie_win_3':
        return Math.min(stats.wins, 3);

      case 'rookie_chapter1': {
        const chapter1 = campaign?.chapters?.['chapter_1'];
        if (!chapter1) return 0;
        return Object.values(chapter1.levels).filter(l => l.completed).length;
      }

      case 'rookie_boss_krag': {
        const chapter1 = campaign?.chapters?.['chapter_1'];
        return chapter1?.bossDefeated ? 1 : 0;
      }

      case 'rookie_level_5':
        return Math.min(data.level, 5);

      case 'rookie_perfect_game':
        return Math.min(stats.perfectGames, 1);

      default:
        return 0;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ОБНОВЛЕНИЕ ПРОГРЕССА
  // ═══════════════════════════════════════════════════════════════

  updateAllProgress(): void {
    if (this.isPathCompleted()) return;

    const progress = this.getProgress();
    let changed = false;

    ROOKIE_TASKS_CONFIG.forEach(config => {
      const taskProgress = progress.tasks[config.id];
      if (taskProgress.claimed) return; // Уже забрано

      const newProgress = this.getTaskProgress(config.id);
      
      if (newProgress !== taskProgress.progress) {
        taskProgress.progress = newProgress;
        changed = true;
      }

      if (newProgress >= config.maxProgress && !taskProgress.completed) {
        taskProgress.completed = true;
        changed = true;
        console.log(`[RookiePath] ✅ Task completed: ${config.id}`);
      }
    });

    // Проверяем завершение всего пути
    const allCompleted = Object.values(progress.tasks).every(t => t.completed);
    if (allCompleted && !progress.pathCompleted) {
      progress.pathCompleted = true;
      progress.completedAt = Date.now();
      changed = true;
      console.log('[RookiePath] 🎉 ROOKIE PATH COMPLETED!');
      eventBus.emit('ROOKIE_PATH_COMPLETED', {});
    }

    if (changed) {
      playerData.save();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ОБРАБОТЧИКИ СОБЫТИЙ
  // ═══════════════════════════════════════════════════════════════

  private onMatchFinished(data: any): void {
    this.updateAllProgress();
  }

  private onGoalScored(data: any): void {
    // Обновляем только если это гол игрока (player 1)
    if (data?.scoringPlayer === 1) {
      this.updateAllProgress();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ПОЛУЧЕНИЕ НАГРАД
  // ═══════════════════════════════════════════════════════════════

  claimTaskReward(taskId: string): boolean {
    const progress = this.getProgress();
    const taskProgress = progress.tasks[taskId];
    const config = ROOKIE_TASKS_CONFIG.find(t => t.id === taskId);

    if (!config || !taskProgress) return false;
    if (!taskProgress.completed || taskProgress.claimed) return false;

    // Выдаём награду
    playerData.addCoins(config.reward.coins);
    playerData.addCrystals(config.reward.crystals);
    
    taskProgress.claimed = true;
    playerData.save();

    console.log(`[RookiePath] 🎁 Claimed reward for ${taskId}: ${config.reward.coins} coins, ${config.reward.crystals} crystals`);
    
    return true;
  }

  canClaimFinalReward(): boolean {
    const progress = this.getProgress();
    return progress.pathCompleted && !progress.rewardClaimed;
  }

  claimFinalReward(chosenFaction: FactionId): boolean {
    if (!this.canClaimFinalReward()) return false;

    const progress = this.getProgress();
    const currentFaction = playerData.getFaction();

    // Нельзя выбрать текущую фракцию
    if (chosenFaction === currentFaction) {
      console.warn('[RookiePath] Cannot choose current faction as reward');
      return false;
    }

    // Выдаём бонусные монеты и кристаллы
    playerData.addCoins(ROOKIE_PATH_FINAL_REWARD.coins);
    playerData.addCrystals(ROOKIE_PATH_FINAL_REWARD.crystals);

    // Выдаём фракцию бесплатно (все 4 стартовых юнита)
    playerData.grantFactionFree(chosenFaction);

    progress.rewardClaimed = true;
    progress.chosenFactionReward = chosenFaction;
    playerData.save();

    console.log(`[RookiePath] 🎉 Final reward claimed! Faction: ${chosenFaction}`);
    
    return true;
  }


  // ═══════════════════════════════════════════════════════════════
  // УТИЛИТЫ
  // ═══════════════════════════════════════════════════════════════

  isPathCompleted(): boolean {
    return this.getProgress().pathCompleted;
  }

  isRewardClaimed(): boolean {
    return this.getProgress().rewardClaimed;
  }

  getCompletedCount(): number {
    const progress = this.getProgress();
    return Object.values(progress.tasks).filter(t => t.completed).length;
  }

  getTotalCount(): number {
    return ROOKIE_TASKS_CONFIG.length;
  }

  getClaimableCount(): number {
    const progress = this.getProgress();
    return Object.values(progress.tasks).filter(t => t.completed && !t.claimed).length;
  }

  /**
   * Проверяет, нужно ли показывать путь новичка
   * Скрываем если путь завершен и награда получена
   */
  shouldShowRookiePath(): boolean {
    const progress = this.getProgress();
    return !progress.rewardClaimed;
  }

  /**
   * Сбросить путь новичка (для тестирования)
   */
  reset(): void {
    const data = playerData.get();
    data.rookiePath = this.createDefaultProgress();
    playerData.save();
    console.log('[RookiePath] 🔄 Reset');
  }
}

// Экспорт singleton
export const rookiePathManager = RookiePathManager.getInstance();
