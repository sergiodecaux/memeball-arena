// Система ежедневных заданий в стиле Mobile Legends

import { playerData } from './PlayerData';
import { FactionId } from '../constants/gameConstants';
import { eventBus, GameEvents, GoalScoredPayload, MatchFinishedPayload, LeagueMatchWonPayload, CardUsedPayload } from '../core/EventBus';

export type DailyTaskType = 
  | 'play_matches'
  | 'win_matches'
  | 'score_goals'
  | 'clean_sheets'
  | 'complete_campaign'
  | 'play_league'
  | 'use_abilities';

export type WeeklyTaskType =
  | 'weekly_wins'
  | 'weekly_goals'
  | 'weekly_clean_sheets'
  | 'weekly_league_wins'
  | 'weekly_cards_used';

export interface DailyTask {
  id: string;
  type: DailyTaskType;
  title: string;
  description: string;
  progress: number;
  maxProgress: number;
  reward: {
    coins?: number;
    crystals?: number;
    fragments?: number;
    xp?: number;
  };
  completed: boolean;
  claimed: boolean;
}

export interface WeeklyTask {
  id: string;
  type: WeeklyTaskType;
  title: string;
  description: string;
  progress: number;
  maxProgress: number;
  reward: {
    coins?: number;
    crystals?: number;
    fragments?: number;
    xp?: number;
  };
  completed: boolean;
  claimed: boolean;

  // Optional metadata for localization / UI
  icon?: string;
  titleKey?: string;
  defaultTitle?: string;
}

export interface DailyRewards {
  tasks: DailyTask[];
  loginReward: {
    day: number; // День подряд (1-7)
    claimed: boolean;
    reward: {
      coins?: number;
      crystals?: number;
      fragments?: number;
    };
  };
  lastResetDate: string; // ISO date string
}

export interface WeeklyData {
  tasks: WeeklyTask[];
  weekNumber: number;
  lastReset: number;
}

// ========== ШАБЛОНЫ ЗАДАНИЙ ==========

const DAILY_TASK_TEMPLATES: Omit<DailyTask, 'id' | 'progress' | 'completed' | 'claimed'>[] = [
  {
    type: 'play_matches',
    title: 'Сыграть матчи',
    description: 'Сыграй 3 матча в любом режиме',
    maxProgress: 3,
    reward: { coins: 300, xp: 50 },
  },
  {
    type: 'win_matches',
    title: 'Победить',
    description: 'Одержи 2 победы',
    maxProgress: 2,
    reward: { coins: 500, crystals: 20 },
  },
  {
    type: 'score_goals',
    title: 'Забить голы',
    description: 'Забей 10 голов за матчи',
    maxProgress: 10,
    reward: { coins: 400, xp: 30 },
  },
  {
    type: 'clean_sheets',
    title: 'На ноль',
    description: 'Сыграй 2 матча "на ноль" (не пропусти голы)',
    maxProgress: 2,
    reward: { coins: 600, crystals: 30 },
  },
  {
    type: 'complete_campaign',
    title: 'Пройти кампанию',
    description: 'Пройди 1 уровень кампании',
    maxProgress: 1,
    reward: { coins: 350, crystals: 15 },
  },
  {
    type: 'play_league',
    title: 'Лига',
    description: 'Сыграй 1 матч в Galaxy League',
    maxProgress: 1,
    reward: { coins: 400, crystals: 25 },
  },
  {
    type: 'use_abilities',
    title: 'Использовать способности',
    description: 'Используй 5 способностей юнитов',
    maxProgress: 5,
    reward: { coins: 250, fragments: 5 },
  },
];

// ========== ШАБЛОНЫ НЕДЕЛЬНЫХ ЗАДАНИЙ ==========

export const WEEKLY_TASK_TEMPLATES: Array<
  Omit<WeeklyTask, 'id' | 'progress' | 'completed' | 'claimed' | 'title' | 'description'> & {
    type: WeeklyTaskType;
    maxProgress: number;
    reward: WeeklyTask['reward'];
    icon: string;
    titleKey: string;
    defaultTitle: string;
  }
> = [
  {
    type: 'weekly_wins',
    maxProgress: 15,
    reward: { coins: 500, crystals: 20 },
    icon: '🏆',
    titleKey: 'task_weekly_wins',
    defaultTitle: 'Победи в 15 матчах',
  },
  {
    type: 'weekly_goals',
    maxProgress: 50,
    reward: { coins: 400, crystals: 15 },
    icon: '⚽',
    titleKey: 'task_weekly_goals',
    defaultTitle: 'Забей 50 голов',
  },
  {
    type: 'weekly_clean_sheets',
    maxProgress: 10,
    reward: { coins: 600, crystals: 25 },
    icon: '🛡️',
    titleKey: 'task_weekly_clean_sheets',
    defaultTitle: 'Выиграй 10 матчей без пропущенных голов',
  },
  {
    type: 'weekly_league_wins',
    maxProgress: 10,
    reward: { coins: 700, crystals: 30 },
    icon: '🌟',
    titleKey: 'task_weekly_league',
    defaultTitle: 'Победи в 10 матчах Галактической Лиги',
  },
  {
    type: 'weekly_cards_used',
    maxProgress: 20,
    reward: { coins: 300, crystals: 10 },
    icon: '🎴',
    titleKey: 'task_weekly_cards',
    defaultTitle: 'Используй 20 тактических карт',
  },
];

// ========== НАГРАДЫ ЗА ВХОД ==========

const LOGIN_REWARDS = [
  { day: 1, coins: 100, crystals: 10 },
  { day: 2, coins: 150, crystals: 15 },
  { day: 3, coins: 200, crystals: 20 },
  { day: 4, coins: 300, crystals: 30 },
  { day: 5, coins: 400, crystals: 40 },
  { day: 6, coins: 600, crystals: 60 },
  { day: 7, coins: 1000, crystals: 100, fragments: 50 },
];

// ========== МЕНЕДЖЕР ЗАДАНИЙ ==========

class DailyTasksManager {
  private readonly STORAGE_KEY = 'soccer_caps_daily_tasks';
  private readonly WEEKLY_STORAGE_KEY = 'soccer_caps_weekly_tasks';
  private eventHandlersInitialized = false;
  private weeklyData: WeeklyData | null = null;
  private eventCallbacks: Map<GameEvents, Function> = new Map();

  /**
   * Получить текущие ежедневные задания
   */
  getDailyData(): DailyRewards {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    let data: DailyRewards;

    if (stored) {
      data = JSON.parse(stored) as DailyRewards;
    } else {
      data = this.createNewDailyData();
    }

    // Проверить, нужно ли сбросить задания (новый день)
    if (this.shouldReset(data.lastResetDate)) {
      data = this.resetDailyTasks(data);
    }

    return data;
  }

  /**
   * Сохранить данные
   */
  private save(data: DailyRewards): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  private saveWeeklyData(): void {
    if (!this.weeklyData) return;
    localStorage.setItem(this.WEEKLY_STORAGE_KEY, JSON.stringify(this.weeklyData));
  }

  /**
   * Проверить, нужно ли сбросить задания
   */
  private shouldReset(lastResetDate: string): boolean {
    const now = new Date();
    const lastReset = new Date(lastResetDate);
    
    // Сброс в 00:00 UTC
    const todayReset = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastResetDay = new Date(lastReset.getFullYear(), lastReset.getMonth(), lastReset.getDate());
    
    return todayReset > lastResetDay;
  }

  private shouldResetWeekly(): boolean {
    if (!this.weeklyData) return true;
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    return now - this.weeklyData.lastReset >= weekMs;
  }

  /**
   * Создать новые ежедневные задания
   */
  private createNewDailyData(): DailyRewards {
    const tasks = this.generateDailyTasks();
    
    return {
      tasks,
      loginReward: {
        day: 1,
        claimed: false,
        reward: LOGIN_REWARDS[0],
      },
      lastResetDate: new Date().toISOString(),
    };
  }

  /**
   * Сбросить задания на новый день
   */
  private resetDailyTasks(oldData: DailyRewards): DailyRewards {
    const tasks = this.generateDailyTasks();
    
    // Проверить, был ли пропущен день
    const daysSinceLastReset = this.getDaysBetween(oldData.lastResetDate, new Date().toISOString());
    let newDay = oldData.loginReward.day;
    
    if (daysSinceLastReset === 1 && oldData.loginReward.claimed) {
      // Продолжаем серию
      newDay = (newDay % 7) + 1;
    } else if (daysSinceLastReset > 1) {
      // Серия прервана
      newDay = 1;
    }
    
    const newData: DailyRewards = {
      tasks,
      loginReward: {
        day: newDay,
        claimed: false,
        reward: LOGIN_REWARDS[newDay - 1],
      },
      lastResetDate: new Date().toISOString(),
    };
    
    this.save(newData);
    return newData;
  }

  getWeeklyData(): WeeklyData {
    // Lazy-load from storage
    if (!this.weeklyData) {
      const stored = localStorage.getItem(this.WEEKLY_STORAGE_KEY);
      if (stored) {
        try {
          this.weeklyData = JSON.parse(stored) as WeeklyData;
        } catch {
          this.weeklyData = null;
        }
      }
    }

    if (!this.weeklyData || this.shouldResetWeekly() || this.weeklyData.weekNumber !== this.getCurrentWeekNumber()) {
      this.resetWeeklyTasks();
    }

    return this.weeklyData!;
  }

  private resetWeeklyTasks(): void {
    const weekNumber = this.getCurrentWeekNumber();
    this.weeklyData = {
      tasks: WEEKLY_TASK_TEMPLATES.map((t) => ({
        id: `weekly_${t.type}_${weekNumber}`,
        type: t.type,
        title: t.defaultTitle,
        description: 'Недельное задание',
        progress: 0,
        maxProgress: t.maxProgress,
        reward: t.reward,
        completed: false,
        claimed: false,
        icon: t.icon,
        titleKey: t.titleKey,
        defaultTitle: t.defaultTitle,
      })),
      weekNumber,
      lastReset: Date.now(),
    };
    this.saveWeeklyData();
  }

  private getCurrentWeekNumber(): number {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
  }

  /**
   * Сгенерировать ежедневные задания
   * Всегда включает 3 основных задания: score_goals, win_matches, clean_sheets
   */
  private generateDailyTasks(): DailyTask[] {
    // ✅ ОБНОВЛЕНО: Всегда генерируем 3 конкретных ежедневных задания
    const coreTasks: DailyTaskType[] = ['score_goals', 'win_matches', 'clean_sheets'];
    
    const tasks: DailyTask[] = [];
    
    // Добавляем 3 основных задания
    coreTasks.forEach((taskType, index) => {
      const template = DAILY_TASK_TEMPLATES.find(t => t.type === taskType);
      if (template) {
        tasks.push({
          ...template,
          id: `daily_${Date.now()}_${index}`,
          progress: 0,
          completed: false,
          claimed: false,
        });
      }
    });
    
    return tasks;
  }

  /**
   * Дни между датами
   */
  private getDaysBetween(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Обновить прогресс задания
   */
  updateTaskProgress(taskType: DailyTaskType, amount: number = 1): void {
    const data = this.getDailyData();
    let updated = false;

    data.tasks.forEach(task => {
      if (task.type === taskType && !task.completed) {
        task.progress = Math.min(task.progress + amount, task.maxProgress);
        if (task.progress >= task.maxProgress) {
          task.completed = true;
        }
        updated = true;
      }
    });

    if (updated) {
      this.save(data);
    }
  }

  updateWeeklyProgress(type: string, amount: number = 1): void {
    const data = this.getWeeklyData();
    const weeklyType = (type.startsWith('weekly_') ? type : `weekly_${type}`) as WeeklyTaskType;
    const task = data.tasks.find(t => t.type === weeklyType);
    if (task && !task.completed) {
      task.progress = Math.min(task.progress + amount, task.maxProgress);
      if (task.progress >= task.maxProgress) {
        task.completed = true;
      }
      this.saveWeeklyData();
    }
  }

  /**
   * Забрать награду за задание
   */
  claimTaskReward(taskId: string): boolean {
    const data = this.getDailyData();
    const task = data.tasks.find(t => t.id === taskId);

    if (!task || !task.completed || task.claimed) {
      return false;
    }

    // Выдать награды
    if (task.reward.coins) playerData.addCoins(task.reward.coins);
    if (task.reward.crystals) playerData.addCrystals(task.reward.crystals);
    if (task.reward.xp) playerData.addXP(task.reward.xp);
    
    // ✅ ИСПРАВЛЕНО: Фрагменты выдаются для текущей фракции игрока
    if (task.reward.fragments) {
      const faction = playerData.getFaction();
      if (faction) {
        // Получаем случайного юнита из фракции и выдаём фрагменты
        import('./UnitsCatalog').then(({ getUnitsByFaction }) => {
          const factionUnits = getUnitsByFaction(faction);
          if (factionUnits.length > 0) {
            const randomUnit = factionUnits[Math.floor(Math.random() * factionUnits.length)];
            playerData.addUnitFragments(randomUnit.id, task.reward.fragments!);
          }
        });
      }
    }

    task.claimed = true;
    this.save(data);
    return true;
  }

  claimWeeklyTaskReward(taskId: string): boolean {
    const data = this.getWeeklyData();
    const task = data.tasks.find(t => t.id === taskId);

    if (!task || !task.completed || task.claimed) {
      return false;
    }

    // Выдать награды
    if (task.reward.coins) playerData.addCoins(task.reward.coins);
    if (task.reward.crystals) playerData.addCrystals(task.reward.crystals);
    if (task.reward.xp) playerData.addXP(task.reward.xp);

    if (task.reward.fragments) {
      const faction = playerData.getFaction();
      if (faction) {
        import('./UnitsCatalog').then(({ getUnitsByFaction }) => {
          const factionUnits = getUnitsByFaction(faction);
          if (factionUnits.length > 0) {
            const randomUnit = factionUnits[Math.floor(Math.random() * factionUnits.length)];
            playerData.addUnitFragments(randomUnit.id, task.reward.fragments!);
          }
        });
      }
    }

    task.claimed = true;
    this.saveWeeklyData();
    return true;
  }

  /**
   * Забрать награду за вход
   */
  claimLoginReward(): boolean {
    const data = this.getDailyData();

    if (data.loginReward.claimed) {
      return false;
    }

    // Выдать награды
    const reward = data.loginReward.reward;
    if (reward.coins) playerData.addCoins(reward.coins);
    if (reward.crystals) playerData.addCrystals(reward.crystals);
    if (reward.fragments) {
      // TODO: добавить систему фрагментов
    }

    data.loginReward.claimed = true;
    this.save(data);
    return true;
  }

  /**
   * Получить награду для дня
   */
  getLoginRewardForDay(day: number): { coins?: number; crystals?: number; fragments?: number } {
    const index = ((day - 1) % 7);
    return LOGIN_REWARDS[index] || LOGIN_REWARDS[0];
  }

  /**
   * Инициализировать подписки на события EventBus
   * Должен быть вызван при старте игры (например, в MainMenuScene или GameSceneSetup)
   */
  initialize(): void {
    if (this.eventHandlersInitialized) {
      return;
    }

    // ✅ FIX: Сохраняем ссылки на callbacks для возможности отписки
    
    const goalScoredCallback = (payload: GoalScoredPayload) => {
      if (payload.scoringPlayer === 1) {
        this.updateTaskProgress('score_goals', 1);
        this.updateWeeklyProgress('goals', 1);
      }
    };
    this.eventCallbacks.set(GameEvents.GOAL_SCORED, goalScoredCallback);
    eventBus.subscribe(GameEvents.GOAL_SCORED, goalScoredCallback);

    const matchFinishedCallback = (payload: MatchFinishedPayload) => {
      this.updateTaskProgress('play_matches', 1);
      if (payload.winner === 1) {
        this.updateTaskProgress('win_matches', 1);
        this.updateWeeklyProgress('wins', 1);
      }
      if (payload.scores.player2 === 0) {
        this.updateTaskProgress('clean_sheets', 1);
        if (payload.winner === 1) {
          this.updateWeeklyProgress('clean_sheets', 1);
        }
      }
    };
    this.eventCallbacks.set(GameEvents.MATCH_FINISHED, matchFinishedCallback);
    eventBus.subscribe(GameEvents.MATCH_FINISHED, matchFinishedCallback);

    const leagueMatchWonCallback = (_payload: LeagueMatchWonPayload) => {
      this.updateWeeklyProgress('league_wins', 1);
    };
    this.eventCallbacks.set(GameEvents.LEAGUE_MATCH_WON, leagueMatchWonCallback);
    eventBus.subscribe(GameEvents.LEAGUE_MATCH_WON, leagueMatchWonCallback);

    const cardUsedCallback = (_payload: CardUsedPayload) => {
      this.updateWeeklyProgress('cards_used', 1);
    };
    this.eventCallbacks.set(GameEvents.CARD_USED, cardUsedCallback);
    eventBus.subscribe(GameEvents.CARD_USED, cardUsedCallback);

    this.eventHandlersInitialized = true;
    console.log('[DailyTasksManager] ✅ Event handlers initialized');
  }

  /**
   * Отключить подписки на события (для очистки)
   */
  destroy(): void {
    if (!this.eventHandlersInitialized) {
      return;
    }

    // ✅ FIX: Отписываемся используя сохранённые ссылки
    this.eventCallbacks.forEach((callback, event) => {
      eventBus.unsubscribe(event, callback as any);
    });
    this.eventCallbacks.clear();

    this.eventHandlersInitialized = false;
    console.log('[DailyTasksManager] 🔕 Event handlers destroyed');
  }
}

export const dailyTasksManager = new DailyTasksManager();
