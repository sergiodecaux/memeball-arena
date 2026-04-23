import { playerData } from '../data/PlayerData';
import { eventBus, GameEvents } from '../core/EventBus';
import { AchievementUnlockOverlay } from '../ui/AchievementUnlockOverlay';

/**
 * Определение достижения
 */
export interface AchievementDefinition {
  id: string;
  iconKey: string;
  icon: string;
  name: string;
  desc: string;
  color: number;
  checkUnlock: (stats: any, data: any) => boolean;
}

/**
 * Менеджер достижений - отслеживает прогресс и показывает уведомления
 */
export class AchievementManager {
  private scene: Phaser.Scene;
  private queue: AchievementDefinition[] = [];
  private isShowing = false;

  // ========== ВСЕ ДОСТИЖЕНИЯ ==========
  private static ACHIEVEMENTS: AchievementDefinition[] = [
    // БАЗОВЫЕ
    {
      id: 'first_win',
      iconKey: 'achievement_first_victory',
      icon: '🏆',
      name: 'Первый вкус победы',
      desc: 'Одержи свою первую победу',
      color: 0x10b981,
      checkUnlock: (stats) => stats.wins >= 1,
    },
    {
      id: 'games_50',
      iconKey: 'achievement_loyal_player',
      icon: '🎮',
      name: 'Верный игрок',
      desc: 'Сыграй 50 матчей',
      color: 0x3b82f6,
      checkUnlock: (stats) => stats.gamesPlayed >= 50,
    },
    {
      id: 'games_100',
      iconKey: 'achievement_centurion',
      icon: '💯',
      name: 'Центурион',
      desc: 'Сыграй 100 матчей',
      color: 0xa855f7,
      checkUnlock: (stats) => stats.gamesPlayed >= 100,
    },
    {
      id: 'level_10',
      iconKey: 'achievement_rising_star',
      icon: '⭐',
      name: 'Rising Star',
      desc: 'Достигни 10 уровня',
      color: 0xfbbf24,
      checkUnlock: (_, data) => data.level >= 10,
    },
    {
      id: 'level_25',
      iconKey: 'achievement_veteran',
      icon: '👑',
      name: 'Veteran',
      desc: 'Достигни 25 уровня',
      color: 0xa855f7,
      checkUnlock: (_, data) => data.level >= 25,
    },
    {
      id: 'level_50',
      iconKey: 'achievement_master',
      icon: '🌟',
      name: 'Мастер',
      desc: 'Достигни 50 уровня',
      color: 0xe11d48,
      checkUnlock: (_, data) => data.level >= 50,
    },

    // ГОЛЫ
    {
      id: 'first_goal',
      iconKey: 'achievement_first_goal',
      icon: '⚽',
      name: 'Первый гол',
      desc: 'Забей свой первый гол',
      color: 0x10b981,
      checkUnlock: (stats) => stats.goalsScored >= 1,
    },
    {
      id: 'goals_50',
      iconKey: 'achievement_goal_scorer',
      icon: '🏅',
      name: 'Бомбардир',
      desc: 'Забей 50 голов (всего)',
      color: 0x3b82f6,
      checkUnlock: (stats) => stats.goalsScored >= 50,
    },
    {
      id: 'goals_200',
      iconKey: 'achievement_goal_machine',
      icon: '💥',
      name: 'Машина голов',
      desc: 'Забей 200 голов (всего)',
      color: 0xa855f7,
      checkUnlock: (stats) => stats.goalsScored >= 200,
    },

    // ЗАЩИТА
    {
      id: 'clean_sheet',
      iconKey: 'achievement_clean_sheet',
      icon: '🛡️',
      name: 'Стальная стена',
      desc: 'Победи, не пропустив голов',
      color: 0x06b6d4,
      checkUnlock: (stats) => stats.perfectGames >= 1,
    },
    {
      id: 'perfect_5',
      iconKey: 'achievement_perfect_defender',
      icon: '🏰',
      name: 'Идеальная защита',
      desc: 'Выиграй 5 матчей "на ноль"',
      color: 0xa855f7,
      checkUnlock: (stats) => stats.perfectGames >= 5,
    },

    // СЕРИИ ПОБЕД
    {
      id: 'win_streak_3',
      iconKey: 'achievement_win_streak',
      icon: '🔥',
      name: 'Серия побед',
      desc: 'Выиграй 3 матча подряд',
      color: 0xfbbf24,
      checkUnlock: (stats) => stats.longestWinStreak >= 3,
    },
    {
      id: 'win_streak_5',
      iconKey: 'achievement_win_streak_epic',
      icon: '⚡',
      name: 'Непобедимый',
      desc: 'Выиграй 5 матчей подряд',
      color: 0xef4444,
      checkUnlock: (stats) => stats.longestWinStreak >= 5,
    },
    {
      id: 'win_streak_10',
      iconKey: 'achievement_win_streak_legendary',
      icon: '👑',
      name: 'Легенда',
      desc: 'Выиграй 10 матчей подряд',
      color: 0xe11d48,
      checkUnlock: (stats) => stats.longestWinStreak >= 10,
    },

    // КОЛЛЕКЦИЯ
    {
      id: 'collector_20',
      iconKey: 'achievement_collector',
      icon: '🃏',
      name: 'Коллекционер',
      desc: 'Собери 20 уникальных юнитов',
      color: 0x3b82f6,
      checkUnlock: (_, data) => (data.ownedUniqueUnits?.length || 0) >= 20,
    },
    {
      id: 'collector_50',
      iconKey: 'achievement_master_collector',
      icon: '🎴',
      name: 'Мастер коллекции',
      desc: 'Собери 50 уникальных юнитов',
      color: 0xa855f7,
      checkUnlock: (_, data) => (data.ownedUniqueUnits?.length || 0) >= 50,
    },
    {
      id: 'collector_80',
      iconKey: 'achievement_complete_collection',
      icon: '💎',
      name: 'Полная коллекция',
      desc: 'Собери все 80 юнитов',
      color: 0xe11d48,
      checkUnlock: (_, data) => (data.ownedUniqueUnits?.length || 0) >= 80,
    },
  ];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Проверяем достижения после обновления статистики
    eventBus.on(GameEvents.MATCH_FINISHED, () => this.checkAllAchievements());
  }

  /**
   * Проверить все достижения и разблокировать новые
   */
  public checkAllAchievements(): void {
    const data = playerData.get();
    const stats = data.stats;
    const unlockedIds = data.achievements.map((a) => a.id);

    AchievementManager.ACHIEVEMENTS.forEach((achievement) => {
      // Если уже разблокировано — пропускаем
      if (unlockedIds.includes(achievement.id)) return;

      // Проверяем условие разблокировки
      if (achievement.checkUnlock(stats, data)) {
        this.unlockAchievement(achievement);
      }
    });
  }

  /**
   * Разблокировать достижение
   */
  private unlockAchievement(achievement: AchievementDefinition): void {
    // Сохраняем в PlayerData
    if (playerData.unlockAchievement(achievement.id)) {
      console.log(`🏆 Achievement unlocked: ${achievement.name}`);
      
      // Добавляем в очередь показа
      this.queue.push(achievement);
      
      // Показываем, если не показывается другое
      if (!this.isShowing) {
        this.showNext();
      }
    }
  }

  /**
   * Показать следующее достижение из очереди
   */
  private showNext(): void {
    if (this.queue.length === 0) {
      this.isShowing = false;
      return;
    }

    this.isShowing = true;
    const achievement = this.queue.shift()!;

    new AchievementUnlockOverlay(this.scene, achievement, () => {
      // После закрытия показываем следующее через небольшую задержку
      this.scene.time.delayedCall(300, () => {
        this.showNext();
      });
    });
  }

  /**
   * Принудительная проверка конкретного достижения (для особых событий)
   */
  public checkSpecificAchievement(achievementId: string): void {
    const achievement = AchievementManager.ACHIEVEMENTS.find((a) => a.id === achievementId);
    if (!achievement) return;

    const data = playerData.get();
    const stats = data.stats;
    const unlockedIds = data.achievements.map((a) => a.id);

    if (!unlockedIds.includes(achievement.id) && achievement.checkUnlock(stats, data)) {
      this.unlockAchievement(achievement);
    }
  }

  /**
   * Очистка (при смене сцены)
   */
  public destroy(): void {
    eventBus.off(GameEvents.MATCH_FINISHED);
    this.queue = [];
    this.isShowing = false;
  }
}
