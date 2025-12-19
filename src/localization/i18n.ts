// src/localization/i18n.ts

export type Language = 'en' | 'ru';

interface Translations {
  [key: string]: string;
}

const translations: Record<Language, Translations> = {
  en: {
    // Меню
    play: 'Play',
    shop: 'Shop',
    tactics: 'Tactics',
    settings: 'Settings',
    profile: 'Profile',
    
    // Модальное окно режимов
    selectMode: 'Select Mode',
    vsAI: 'VS AI',
    vsAIDesc: 'Play against computer',
    pvp: 'PVP',
    pvpDesc: 'Play with a friend',
    quickPlay: 'Quick Play',
    quickPlayDesc: 'Jump into a match',
    
    // Сложность
    selectDifficulty: 'Select Difficulty',
    easy: 'Easy',
    easyDesc: 'For beginners',
    medium: 'Medium',
    mediumDesc: 'Balanced challenge',
    hard: 'Hard',
    hardDesc: 'For experts',
    
    // Профиль
    stats: 'Stats',
    collection: 'Collection',
    achievements: 'Achievements',
    
    // Статистика
    totalGames: 'Total Games',
    wins: 'Wins',
    losses: 'Losses',
    draws: 'Draws',
    winRate: 'Win Rate',
    goalsScored: 'Goals Scored',
    goalsConceded: 'Goals Conceded',
    goalDifference: 'Goal Diff',
    currentStreak: 'Current Streak',
    bestStreak: 'Best Streak',
    perfectGames: 'Perfect Games',
    playTime: 'Play Time',
    
    // Коллекция
    caps: 'Caps',
    balls: 'Balls',
    fields: 'Fields',
    
    // Достижения
    firstVictory: 'First Victory',
    firstVictoryDesc: 'Win your first match',
    hotStreak: 'Hot Streak',
    hotStreakDesc: 'Win 3 matches in a row',
    unstoppable: 'Unstoppable',
    unstoppableDesc: 'Win 5 matches in a row',
    sharpshooter: 'Sharpshooter',
    sharpshooterDesc: 'Score 10 goals',
    goalMachine: 'Goal Machine',
    goalMachineDesc: 'Score 50 goals',
    cleanSheet: 'Clean Sheet',
    cleanSheetDesc: 'Win without conceding',
    regularPlayer: 'Regular Player',
    regularPlayerDesc: 'Play 10 matches',
    dedicated: 'Dedicated',
    dedicatedDesc: 'Play 50 matches',
    risingStar: 'Rising Star',
    risingStarDesc: 'Reach level 10',
    veteran: 'Veteran',
    veteranDesc: 'Reach level 25',
    
    // Настройки
    language: 'Language',
    sound: 'Sound Effects',
    music: 'Music',
    vibration: 'Vibration',
    resetProgress: 'Reset Progress',
    confirmReset: 'Are you sure? All progress will be lost!',
    yes: 'Yes',
    no: 'No',
    
    // Тактика
    upgrades: 'Upgrades',
    formation: 'Formation',
    yourCaps: 'Your Caps',
    selectFormation: 'Select Formation',
    createFormation: 'Create Formation',
    editFormation: 'Edit Formation',
    deleteFormation: 'Delete Formation',
    enemyGoal: 'Enemy Goal',
    yourGoal: 'Your Goal',
    dragCaps: 'Drag caps to position',
    save: 'Save',
    cancel: 'Cancel',
    custom: 'Custom',
    
    // Статы фишек
    power: 'Power',
    speed: 'Speed',
    control: 'Control',
    weight: 'Weight',
    
    // Игра
    player1: 'Player 1',
    player2: 'Player 2',
    yourTurn: 'Your Turn',
    enemyTurn: 'Enemy Turn',
    goal: 'GOAL!',
    victory: 'Victory!',
    defeat: 'Defeat',
    draw: 'Draw',
    
    // Игровое меню
    pause: 'Pause',
    resume: 'Resume',
    surrender: 'Surrender',
    changeFormation: 'Change Formation',
    confirmSurrender: 'Are you sure you want to surrender?',
    matchResult: 'Match Result',
    youWon: 'You Won!',
    youLost: 'You Lost',
    aiWins: 'AI Wins',
    player2Wins: 'Player 2 Wins',
    continueBtn: 'Continue',
    rematch: 'Rematch',
    toMenu: 'Main Menu',
    goalsFor: 'Goals For',
    goalsAgainst: 'Goals Against',
    xpEarned: 'XP Earned',
    coinsEarned: 'Coins Earned',
    newFormation: 'New Formation',
    formationChanged: 'Formation Changed!',
    formationAppliedAfterGoal: 'Will be applied after next goal',
    waitingForStop: 'Wait for objects to stop...',
    dragToShoot: 'Drag a cap to shoot!',
    aiThinking: 'AI is thinking...',
    
    // Выбор языка
    selectLanguage: 'Select Language',
    languageChanged: 'Language Changed',
    restartToApply: 'Some changes will apply after restart',
    
    // Общее
    back: 'Back',
    level: 'Level',
    max: 'MAX',
    equipped: 'Equipped',
    equip: 'Equip',
    buy: 'Buy',
    upgrade: 'Upgrade',
    free: 'Free',
    locked: 'Locked',
    unlocked: 'Unlocked',
    comingSoon: 'Coming Soon',
  },
  
  ru: {
    // Меню
    play: 'Играть',
    shop: 'Магазин',
    tactics: 'Тактика',
    settings: 'Настройки',
    profile: 'Профиль',
    
    // Модальное окно режимов
    selectMode: 'Выбор режима',
    vsAI: 'Против ИИ',
    vsAIDesc: 'Играть с компьютером',
    pvp: 'PVP',
    pvpDesc: 'Играть с другом',
    quickPlay: 'Быстрая игра',
    quickPlayDesc: 'Сразу в бой',
    
    // Сложность
    selectDifficulty: 'Выбор сложности',
    easy: 'Лёгкий',
    easyDesc: 'Для новичков',
    medium: 'Средний',
    mediumDesc: 'Сбалансированный',
    hard: 'Сложный',
    hardDesc: 'Для экспертов',
    
    // Профиль
    stats: 'Статистика',
    collection: 'Коллекция',
    achievements: 'Достижения',
    
    // Статистика
    totalGames: 'Всего игр',
    wins: 'Победы',
    losses: 'Поражения',
    draws: 'Ничьи',
    winRate: 'Винрейт',
    goalsScored: 'Забито голов',
    goalsConceded: 'Пропущено',
    goalDifference: 'Разница',
    currentStreak: 'Текущая серия',
    bestStreak: 'Лучшая серия',
    perfectGames: 'Без пропущенных',
    playTime: 'Время игры',
    
    // Коллекция
    caps: 'Фишки',
    balls: 'Мячи',
    fields: 'Поля',
    
    // Достижения
    firstVictory: 'Первая победа',
    firstVictoryDesc: 'Выиграй первый матч',
    hotStreak: 'Горячая серия',
    hotStreakDesc: 'Выиграй 3 матча подряд',
    unstoppable: 'Неудержимый',
    unstoppableDesc: 'Выиграй 5 матчей подряд',
    sharpshooter: 'Снайпер',
    sharpshooterDesc: 'Забей 10 голов',
    goalMachine: 'Голевая машина',
    goalMachineDesc: 'Забей 50 голов',
    cleanSheet: 'Сухарь',
    cleanSheetDesc: 'Победи без пропущенных',
    regularPlayer: 'Постоянный игрок',
    regularPlayerDesc: 'Сыграй 10 матчей',
    dedicated: 'Преданный',
    dedicatedDesc: 'Сыграй 50 матчей',
    risingStar: 'Восходящая звезда',
    risingStarDesc: 'Достигни 10 уровня',
    veteran: 'Ветеран',
    veteranDesc: 'Достигни 25 уровня',
    
    // Настройки
    language: 'Язык',
    sound: 'Звуковые эффекты',
    music: 'Музыка',
    vibration: 'Вибрация',
    resetProgress: 'Сбросить прогресс',
    confirmReset: 'Уверены? Весь прогресс будет потерян!',
    yes: 'Да',
    no: 'Нет',
    
    // Тактика
    upgrades: 'Улучшения',
    formation: 'Расстановка',
    yourCaps: 'Ваши фишки',
    selectFormation: 'Выбор расстановки',
    createFormation: 'Создать расстановку',
    editFormation: 'Редактировать',
    deleteFormation: 'Удалить расстановку',
    enemyGoal: 'Ворота врага',
    yourGoal: 'Ваши ворота',
    dragCaps: 'Перетащите фишки',
    save: 'Сохранить',
    cancel: 'Отмена',
    custom: 'Своя',
    
    // Статы фишек
    power: 'Сила',
    speed: 'Скорость',
    control: 'Контроль',
    weight: 'Вес',
    
    // Игра
    player1: 'Игрок 1',
    player2: 'Игрок 2',
    yourTurn: 'Ваш ход',
    enemyTurn: 'Ход врага',
    goal: 'ГОЛ!',
    victory: 'Победа!',
    defeat: 'Поражение',
    draw: 'Ничья',
    
    // Игровое меню
    pause: 'Пауза',
    resume: 'Продолжить',
    surrender: 'Сдаться',
    changeFormation: 'Сменить схему',
    confirmSurrender: 'Вы уверены, что хотите сдаться?',
    matchResult: 'Результат матча',
    youWon: 'Вы победили!',
    youLost: 'Вы проиграли',
    aiWins: 'ИИ победил',
    player2Wins: 'Игрок 2 победил',
    continueBtn: 'Продолжить',
    rematch: 'Реванш',
    toMenu: 'В меню',
    goalsFor: 'Забито',
    goalsAgainst: 'Пропущено',
    xpEarned: 'Получено XP',
    coinsEarned: 'Получено монет',
    newFormation: 'Новая схема',
    formationChanged: 'Схема изменена!',
    formationAppliedAfterGoal: 'Применится после следующего гола',
    waitingForStop: 'Ждём остановки...',
    dragToShoot: 'Тяните фишку для удара!',
    aiThinking: 'ИИ думает...',
    
    // Выбор языка
    selectLanguage: 'Выберите язык',
    languageChanged: 'Язык изменён',
    restartToApply: 'Некоторые изменения применятся после перезапуска',
    
    // Общее
    back: 'Назад',
    level: 'Уровень',
    max: 'МАКС',
    equipped: 'Надето',
    equip: 'Надеть',
    buy: 'Купить',
    upgrade: 'Улучшить',
    free: 'Бесплатно',
    locked: 'Закрыто',
    unlocked: 'Открыто',
    comingSoon: 'Скоро',
  },
};

// Ключ для хранения флага первого запуска
const FIRST_LAUNCH_KEY = 'memeball_first_launch_complete';

class I18n {
  private currentLanguage: Language = 'en';

  constructor() {
    this.loadLanguage();
  }

  private loadLanguage(): void {
    try {
      const saved = localStorage.getItem('memeball_language');
      if (saved && (saved === 'en' || saved === 'ru')) {
        this.currentLanguage = saved;
      }
    } catch (e) {
      console.warn('Could not load language preference');
    }
  }

  setLanguage(lang: Language): void {
    this.currentLanguage = lang;
    try {
      localStorage.setItem('memeball_language', lang);
    } catch (e) {
      console.warn('Could not save language preference');
    }
  }

  getLanguage(): Language {
    return this.currentLanguage;
  }

  t(key: string): string {
    return translations[this.currentLanguage][key] || translations['en'][key] || key;
  }

  getLanguageName(lang: Language): string {
    switch (lang) {
      case 'en': return 'English';
      case 'ru': return 'Русский';
    }
  }

  getLanguageFlag(lang: Language): string {
    switch (lang) {
      case 'en': return '🇬🇧';
      case 'ru': return '🇷🇺';
    }
  }

  // Получить все доступные языки
  getAvailableLanguages(): Language[] {
    return ['en', 'ru'];
  }

  // Проверка первого запуска
  isFirstLaunch(): boolean {
    try {
      const completed = localStorage.getItem(FIRST_LAUNCH_KEY);
      return completed !== 'true';
    } catch (e) {
      return true;
    }
  }

  // Отметить первый запуск как завершённый
  setFirstLaunchComplete(): void {
    try {
      localStorage.setItem(FIRST_LAUNCH_KEY, 'true');
    } catch (e) {
      console.warn('Could not save first launch state');
    }
  }
}

export const i18n = new I18n();