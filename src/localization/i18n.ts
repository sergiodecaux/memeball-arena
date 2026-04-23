// src/localization/i18n.ts

export type Language = 'en' | 'ru';

interface Translations {
  [key: string]: string;
}

const translations: Record<Language, Translations> = {
  en: {
    // ========== МЕНЮ ==========
    play: 'Play',
    battle: 'Battle',
    shop: 'Shop',
    tactics: 'Tactics',
    settings: 'Settings',
    profile: 'Profile',
    team: 'Team',
    factions: 'Factions',
    home: 'Home',
    
    // ========== МОДАЛЬНОЕ ОКНО РЕЖИМОВ ==========
    selectMode: 'Select Mode',
    vsAI: 'VS AI',
    vsAIDesc: 'Play against computer',
    pvp: 'PVP',
    pvpDesc: 'Play with a friend',
    pvpOnline: 'PVP Online',
    pvpOnlineDesc: 'Fight real players',
    quickPlay: 'Quick Play',
    quickPlayDesc: 'Jump into a match',
    localGame: 'Local Game',
    localGameDesc: 'Two players on one device',
    
    // ========== СЛОЖНОСТЬ ==========
    selectDifficulty: 'Select Difficulty',
    easy: 'Easy',
    easyDesc: 'For beginners',
    medium: 'Medium',
    mediumDesc: 'Balanced challenge',
    hard: 'Hard',
    hardDesc: 'For experts',
    
    // ========== ПРОФИЛЬ ==========
    stats: 'Stats',
    collection: 'Collection',
    achievements: 'Achievements',
    
    // ========== СТАТИСТИКА ==========
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
    experience: 'Experience',
    nextLevel: 'Next Level',
    
    // ========== КОЛЛЕКЦИЯ ==========
    caps: 'Caps',
    balls: 'Balls',
    fields: 'Fields',
    units: 'Units',
    skins: 'Skins',
    bundles: 'Bundles',
    
    // ========== ДОСТИЖЕНИЯ ==========
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
    
    // ========== НАСТРОЙКИ ==========
    language: 'Language',
    sound: 'Sound Effects',
    music: 'Music',
    vibration: 'Vibration',
    resetProgress: 'Reset Progress',
    confirmReset: 'Are you sure? All progress will be lost!',
    yes: 'Yes',
    no: 'No',
    graphics: 'Graphics',
    quality: 'Quality',
    particles: 'Particles',
    shadows: 'Shadows',
    qualityLow: 'Low',
    qualityMedium: 'Medium',
    qualityHigh: 'High',
    gameplay: 'Gameplay',
    aimAssist: 'Aim Assist',
    showTrajectory: 'Show Trajectory',
    cameraShake: 'Camera Shake',
    
    // ========== ТАКТИКА ==========
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
    slot: 'Slot',
    empty: 'Empty',
    confirmTeam: 'Confirm Team',
    
    // ========== СТАТЫ ЮНИТОВ ==========
    power: 'Power',
    speed: 'Speed',
    control: 'Control',
    weight: 'Weight',
    defense: 'Defense',
    technique: 'Technique',
    mass: 'Mass',
    aim: 'Aim',
    
    // ========== КЛАССЫ ЮНИТОВ ==========
    balanced: 'Balanced',
    balancedDesc: 'Balanced stats. Good in any situation.',
    tank: 'Tank',
    tankDesc: 'Heavy defender. High mass but low speed.',
    sniper: 'Sniper',
    sniperDesc: 'Precise shooter. Long aim line.',
    trickster: 'Trickster',
    tricksterDesc: 'Can curve the ball.',
    
    // ========== ФРАКЦИИ ==========
    selectFaction: 'Select Faction',
    switchFaction: 'Switch Faction',
    factionSelected: 'Selected',
    factionLocked: 'Locked',
    factionOwned: 'Owned',
    unlockFaction: 'Unlock',
    
    magma: 'Magma Brutes',
    magmaDesc: 'Heavy defense. Hard to move.',
    cyborg: 'Terran Cyborgs',
    cyborgDesc: 'Universal style. Balanced stats.',
    void: 'Void Walkers',
    voidDesc: 'Control and curve. Tricky shots.',
    insect: 'Xeno Swarm',
    insectDesc: 'Speed attack. Fast and aggressive.',
    
    // ========== ИГРА ==========
    player1: 'Player 1',
    player2: 'Player 2',
    yourTurn: 'Your Turn',
    enemyTurn: 'Enemy Turn',
    opponentTurn: "Opponent's Turn",
    goal: 'GOAL!',
    ownGoal: 'OWN GOAL!',
    victory: 'Victory!',
    defeat: 'Defeat',
    draw: 'Draw',
    score: 'Score',
    time: 'Time',
    turn: 'Turn',
    
    // ========== ПАУЗА ==========
    pause: 'Pause',
    paused: 'Paused',
    resume: 'Resume',
    restart: 'Restart',
    surrender: 'Surrender',
    quit: 'Quit',
    changeFormation: 'Change Formation',
    confirmSurrender: 'Are you sure you want to surrender?',
    confirmQuit: 'Are you sure you want to quit? Match progress will be lost.',
    
    // ========== РЕЗУЛЬТАТЫ МАТЧА ==========
    matchResult: 'Match Result',
    youWon: 'You Won!',
    youLost: 'You Lost',
    aiWins: 'AI Wins',
    player2Wins: 'Player 2 Wins',
    finalScore: 'Final Score',
    rewards: 'Rewards',
    bonus: 'Bonus',
    perfectGame: 'Perfect Game!',
    newRecord: 'New Record!',
    levelUp: 'Level Up!',
    continueBtn: 'Continue',
    rematch: 'Rematch',
    playAgain: 'Play Again',
    toMenu: 'Main Menu',
    backToMenu: 'Back to Menu',
    goalsFor: 'Goals For',
    goalsAgainst: 'Goals Against',
    xpEarned: 'XP Earned',
    coinsEarned: 'Coins Earned',
    
    // ========== ФОРМАЦИИ ==========
    newFormation: 'New Formation',
    formationChanged: 'Formation Changed!',
    formationAppliedAfterGoal: 'Will be applied after next goal',
    
    // ========== ПОДСКАЗКИ ==========
    waitingForStop: 'Wait for objects to stop...',
    dragToShoot: 'Drag a cap to shoot!',
    aiThinking: 'AI is thinking...',
    tapToSelect: 'Tap a unit to select',
    dragToAim: 'Drag to aim',
    releaseToShoot: 'Release to shoot',
    curveShot: 'Move sideways to curve',
    wallAssist: 'Drag to the open side',
    powerIndicator: 'Shot power',
    
    // ========== МАТЧМЕЙКИНГ ==========
    searching: 'Searching for opponent...',
    opponentFound: 'Opponent found!',
    connecting: 'Connecting...',
    waiting: 'Waiting...',
    opponent: 'Opponent',
    vs: 'VS',
    disconnected: 'Disconnected',
    reconnecting: 'Reconnecting...',
    connectionLost: 'Opponent disconnected',
    
    // ========== МАГАЗИН ==========
    buyConfirm: 'Confirm purchase?',
    purchaseSuccess: 'Purchase successful!',
    notEnoughCoins: 'Not enough coins',
    notEnoughCrystals: 'Not enough crystals',
    alreadyOwned: 'Already owned',
    
    rarity: 'Rarity',
    common: 'Common',
    rare: 'Rare',
    epic: 'Epic',
    legendary: 'Legendary',
    
    // ========== ОФФЕРЫ / СПЕЦИАЛЬНЫЕ ПРЕДЛОЖЕНИЯ ==========
    limitedOffer: 'Limited Offer',
    hotDeal: '🔥 DEAL',
    powerPack: 'Power Pack',
    premiumUnitsUnlock: '{count} Premium Units — Unlock Now!',
    freeStarterUnit: 'Free Starter Unit Included!',
    endsIn: 'Ends in',
    claimNow: 'Claim Now!',
    maybeLater: 'Maybe Later',
    unlocked: 'Unlocked!',
    
    // ========== СЕЗОН ==========
    season: 'Season',
    
    // ========== ВЫБОР ЯЗЫКА ==========
    selectLanguage: 'Select Language',
    languageChanged: 'Language Changed',
    restartToApply: 'Some changes will apply after restart',
    
    // ========== ТУТОРИАЛ ==========
    tutorialWelcome: 'Welcome to Galaxy League!',
    tutorialWelcomeMsg: 'Cosmic soccer with unique factions. Score goals, defeat opponents!',
    tutorialSelectUnit: 'Select Unit',
    tutorialSelectUnitMsg: 'Tap one of your units to select it.',
    tutorialAim: 'Aiming',
    tutorialAimMsg: 'Drag your finger opposite to the target direction.',
    tutorialPower: 'Shot Power',
    tutorialPowerMsg: 'The further you drag, the stronger the shot.',
    tutorialGoal: 'Game Goal',
    tutorialGoalMsg: 'Score into opponent\'s goal. First to 3 wins!',
    tutorialCurve: 'Curve Shot',
    tutorialCurveMsg: 'Trickster units can curve the ball sideways.',
    tutorialSkip: 'Skip',
    tutorialNext: 'Next',
    tutorialGotIt: 'Got it!',
    
    // ========== КАМПАНИЯ ==========
    campaign: 'CAMPAIGN',
    chapter: 'Chapter',
    level: 'Level',
    locked: 'Locked',
    completed: 'Completed',
    stars: 'Stars',
    startAdventure: 'Start your adventure!',
    
    // ========== ОШИБКИ ==========
    errorConnection: 'Failed to connect to server',
    errorServer: 'Server error. Try again later',
    errorTimeout: 'Connection timed out',
    errorInvalidData: 'Invalid data',
    errorSessionExpired: 'Session expired. Please restart',
    
    // ========== ОБЩЕЕ ==========
    ok: 'OK',
    confirm: 'Confirm',
    back: 'Back',
    next: 'Next',
    close: 'Close',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    on: 'On',
    off: 'Off',
    max: 'MAX',
    equipped: 'Equipped',
    equip: 'Equip',
    buy: 'Buy',
    upgrade: 'Upgrade',
    price: 'Price',
    free: 'Free',
    comingSoon: 'Coming Soon',
    coins: 'coins',
    crystals: 'crystals',
    player: 'Player',
    ai: 'AI',
  },
  
  ru: {
    // ========== МЕНЮ ==========
    play: 'Играть',
    battle: 'Матч',
    shop: 'Магазин',
    tactics: 'Тактика',
    settings: 'Настройки',
    profile: 'Профиль',
    team: 'Команда',
    factions: 'Фракции',
    home: 'Главная',
    
    // ========== МОДАЛЬНОЕ ОКНО РЕЖИМОВ ==========
    selectMode: 'Выбор режима',
    vsAI: 'Против ИИ',
    vsAIDesc: 'Играть с компьютером',
    pvp: 'PVP',
    pvpDesc: 'Играть с другом',
    pvpOnline: 'Онлайн PVP',
    pvpOnlineDesc: 'Сражайся с реальными игроками',
    quickPlay: 'Быстрая игра',
    quickPlayDesc: 'Сразу в бой',
    localGame: 'Локальная игра',
    localGameDesc: 'Два игрока на одном устройстве',
    
    // ========== СЛОЖНОСТЬ ==========
    selectDifficulty: 'Выбор сложности',
    easy: 'Лёгкий',
    easyDesc: 'Для новичков',
    medium: 'Средний',
    mediumDesc: 'Сбалансированный',
    hard: 'Сложный',
    hardDesc: 'Для экспертов',
    
    // ========== ПРОФИЛЬ ==========
    stats: 'Статистика',
    collection: 'Коллекция',
    achievements: 'Достижения',
    
    // ========== СТАТИСТИКА ==========
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
    experience: 'Опыт',
    nextLevel: 'До следующего уровня',
    
    // ========== КОЛЛЕКЦИЯ ==========
    caps: 'Фишки',
    balls: 'Мячи',
    fields: 'Поля',
    units: 'Юниты',
    skins: 'Скины',
    bundles: 'Наборы',
    
    // ========== ДОСТИЖЕНИЯ ==========
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
    
    // ========== НАСТРОЙКИ ==========
    language: 'Язык',
    sound: 'Звуковые эффекты',
    music: 'Музыка',
    vibration: 'Вибрация',
    resetProgress: 'Сбросить прогресс',
    confirmReset: 'Уверены? Весь прогресс будет потерян!',
    yes: 'Да',
    no: 'Нет',
    graphics: 'Графика',
    quality: 'Качество',
    particles: 'Частицы',
    shadows: 'Тени',
    qualityLow: 'Низкое',
    qualityMedium: 'Среднее',
    qualityHigh: 'Высокое',
    gameplay: 'Геймплей',
    aimAssist: 'Помощь прицеливания',
    showTrajectory: 'Показывать траекторию',
    cameraShake: 'Тряска камеры',
    
    // ========== ТАКТИКА ==========
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
    slot: 'Слот',
    empty: 'Пусто',
    confirmTeam: 'Подтвердить состав',
    
    // ========== СТАТЫ ЮНИТОВ ==========
    power: 'Сила',
    speed: 'Скорость',
    control: 'Контроль',
    weight: 'Вес',
    defense: 'Защита',
    technique: 'Техника',
    mass: 'Масса',
    aim: 'Прицел',
    
    // ========== КЛАССЫ ЮНИТОВ ==========
    balanced: 'Универсал',
    balancedDesc: 'Сбалансированные характеристики. Хорош везде.',
    tank: 'Танк',
    tankDesc: 'Тяжёлый защитник. Высокая масса, низкая скорость.',
    sniper: 'Снайпер',
    sniperDesc: 'Точный стрелок. Длинная линия прицела.',
    trickster: 'Трикстер',
    tricksterDesc: 'Может закручивать мяч.',
    
    // ========== ФРАКЦИИ ==========
    selectFaction: 'Выбор фракции',
    switchFaction: 'Сменить фракцию',
    factionSelected: 'Выбрано',
    factionLocked: 'Закрыто',
    factionOwned: 'В наличии',
    unlockFaction: 'Разблокировать',
    
    magma: 'Магма',
    magmaDesc: 'Тяжёлая оборона. Сложно сдвинуть.',
    cyborg: 'Киборги',
    cyborgDesc: 'Универсальный стиль. Баланс характеристик.',
    void: 'Пустота',
    voidDesc: 'Контроль и подкрутка. Хитрые удары.',
    insect: 'Рой',
    insectDesc: 'Скоростная атака. Быстрые и агрессивные.',
    
    // ========== ИГРА ==========
    player1: 'Игрок 1',
    player2: 'Игрок 2',
    yourTurn: 'Ваш ход',
    enemyTurn: 'Ход врага',
    opponentTurn: 'Ход соперника',
    goal: 'ГОЛ!',
    ownGoal: 'АВТОГОЛ!',
    victory: 'Победа!',
    defeat: 'Поражение',
    draw: 'Ничья',
    score: 'Счёт',
    time: 'Время',
    turn: 'Ход',
    
    // ========== ПАУЗА ==========
    pause: 'Пауза',
    paused: 'Пауза',
    resume: 'Продолжить',
    restart: 'Заново',
    surrender: 'Сдаться',
    quit: 'Выйти',
    changeFormation: 'Сменить схему',
    confirmSurrender: 'Вы уверены, что хотите сдаться?',
    confirmQuit: 'Вы уверены? Прогресс матча будет потерян.',
    
    // ========== РЕЗУЛЬТАТЫ МАТЧА ==========
    matchResult: 'Результат матча',
    youWon: 'Вы победили!',
    youLost: 'Вы проиграли',
    aiWins: 'ИИ победил',
    player2Wins: 'Игрок 2 победил',
    finalScore: 'Итоговый счёт',
    rewards: 'Награды',
    bonus: 'Бонус',
    perfectGame: 'Идеальная игра!',
    newRecord: 'Новый рекорд!',
    levelUp: 'Новый уровень!',
    continueBtn: 'Продолжить',
    rematch: 'Реванш',
    playAgain: 'Играть снова',
    toMenu: 'В меню',
    backToMenu: 'В меню',
    goalsFor: 'Забито',
    goalsAgainst: 'Пропущено',
    xpEarned: 'Получено XP',
    coinsEarned: 'Получено монет',
    
    // ========== ФОРМАЦИИ ==========
    newFormation: 'Новая схема',
    formationChanged: 'Схема изменена!',
    formationAppliedAfterGoal: 'Применится после следующего гола',
    
    // ========== ПОДСКАЗКИ ==========
    waitingForStop: 'Ждём остановки...',
    dragToShoot: 'Тяните фишку для удара!',
    aiThinking: 'ИИ думает...',
    tapToSelect: 'Нажмите на юнита',
    dragToAim: 'Тяните для прицеливания',
    releaseToShoot: 'Отпустите для удара',
    curveShot: 'Сместите вбок для подкрутки',
    wallAssist: 'Тяните в свободную сторону',
    powerIndicator: 'Сила удара',
    
    // ========== МАТЧМЕЙКИНГ ==========
    searching: 'Поиск соперника...',
    opponentFound: 'Соперник найден!',
    connecting: 'Подключение...',
    waiting: 'Ожидание...',
    opponent: 'Соперник',
    vs: 'ПРОТИВ',
    disconnected: 'Соединение потеряно',
    reconnecting: 'Переподключение...',
    connectionLost: 'Соперник отключился',
    
    // ========== МАГАЗИН ==========
    buyConfirm: 'Подтвердить покупку?',
    purchaseSuccess: 'Покупка успешна!',
    notEnoughCoins: 'Недостаточно монет',
    notEnoughCrystals: 'Недостаточно кристаллов',
    alreadyOwned: 'Уже куплено',
    
    rarity: 'Редкость',
    common: 'Обычный',
    rare: 'Редкий',
    epic: 'Эпический',
    legendary: 'Легендарный',
    
    // ========== ОФФЕРЫ / СПЕЦИАЛЬНЫЕ ПРЕДЛОЖЕНИЯ ==========
    limitedOffer: 'Ограниченное предложение',
    hotDeal: '🔥 АКЦИЯ',
    powerPack: 'Набор силы',
    premiumUnitsUnlock: '{count} премиум юнита — Открой сейчас!',
    freeStarterUnit: 'Стартовый юнит в подарок!',
    endsIn: 'Осталось',
    claimNow: 'Забрать!',
    maybeLater: 'Позже',
    unlocked: 'Разблокировано!',
    
    // ========== СЕЗОН ==========
    season: 'Сезон',
    
    // ========== ВЫБОР ЯЗЫКА ==========
    selectLanguage: 'Выберите язык',
    languageChanged: 'Язык изменён',
    restartToApply: 'Некоторые изменения применятся после перезапуска',
    
    // ========== ТУТОРИАЛ ==========
    tutorialWelcome: 'Добро пожаловать в Galaxy League!',
    tutorialWelcomeMsg: 'Космический футбол с уникальными фракциями. Забивайте голы, побеждайте!',
    tutorialSelectUnit: 'Выбор юнита',
    tutorialSelectUnitMsg: 'Нажмите на одного из своих юнитов.',
    tutorialAim: 'Прицеливание',
    tutorialAimMsg: 'Тяните палец в противоположную от цели сторону.',
    tutorialPower: 'Сила удара',
    tutorialPowerMsg: 'Чем дальше тянете — тем сильнее удар.',
    tutorialGoal: 'Цель игры',
    tutorialGoalMsg: 'Забейте мяч в ворота соперника. Первый до 3 голов — победитель!',
    tutorialCurve: 'Подкрутка',
    tutorialCurveMsg: 'Трикстеры могут закручивать мяч. Сместите палец вбок!',
    tutorialSkip: 'Пропустить',
    tutorialNext: 'Далее',
    tutorialGotIt: 'Понятно!',
    
    // ========== КАМПАНИЯ ==========
    campaign: 'КАМПАНИЯ',
    chapter: 'Глава',
    level: 'Уровень',
    locked: 'Заблокировано',
    completed: 'Пройдено',
    stars: 'Звёзды',
    startAdventure: 'Начни приключение!',
    
    // ========== ОШИБКИ ==========
    errorConnection: 'Не удалось подключиться к серверу',
    errorServer: 'Ошибка сервера. Попробуйте позже',
    errorTimeout: 'Время ожидания истекло',
    errorInvalidData: 'Неверные данные',
    errorSessionExpired: 'Сессия истекла. Перезайдите в игру',
    
    // ========== ОБЩЕЕ ==========
    ok: 'ОК',
    confirm: 'Подтвердить',
    back: 'Назад',
    next: 'Далее',
    close: 'Закрыть',
    loading: 'Загрузка...',
    error: 'Ошибка',
    success: 'Успешно',
    warning: 'Внимание',
    on: 'Вкл',
    off: 'Выкл',
    max: 'МАКС',
    equipped: 'Надето',
    equip: 'Надеть',
    buy: 'Купить',
    upgrade: 'Улучшить',
    price: 'Цена',
    free: 'Бесплатно',
    comingSoon: 'Скоро',
    coins: 'монет',
    crystals: 'кристаллов',
    player: 'Игрок',
    ai: 'ИИ',
  },
};

// Ключ для хранения флага первого запуска
const FIRST_LAUNCH_KEY = 'memeball_first_launch_complete';

class I18n {
  private currentLanguage: Language = 'ru';

  constructor() {
    this.loadLanguage();
  }

  private loadLanguage(): void {
    try {
      const saved = localStorage.getItem('memeball_language');
      if (saved && (saved === 'en' || saved === 'ru')) {
        this.currentLanguage = saved;
      } else {
        // Определяем язык из Telegram или браузера
        const tgLang = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
        const browserLang = navigator.language?.split('-')[0];
        
        if (tgLang === 'en' || browserLang === 'en') {
          this.currentLanguage = 'en';
        } else {
          this.currentLanguage = 'ru'; // По умолчанию русский
        }
      }
    } catch (e) {
      console.warn('Could not load language preference');
      this.currentLanguage = 'ru';
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

  getAvailableLanguages(): Language[] {
    return ['en', 'ru'];
  }

  isFirstLaunch(): boolean {
    try {
      const completed = localStorage.getItem(FIRST_LAUNCH_KEY);
      return completed !== 'true';
    } catch (e) {
      return true;
    }
  }

  setFirstLaunchComplete(): void {
    try {
      localStorage.setItem(FIRST_LAUNCH_KEY, 'true');
    } catch (e) {
      console.warn('Could not save first launch state');
    }
  }

  formatNumber(num: number): string {
    if (this.currentLanguage === 'ru') {
      return num.toLocaleString('ru-RU');
    }
    return num.toLocaleString('en-US');
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  pluralize(count: number, one: string, few: string, many: string): string {
    if (this.currentLanguage !== 'ru') {
      return count === 1 ? one : many;
    }

    const n = Math.abs(count) % 100;
    const n1 = n % 10;

    if (n > 10 && n < 20) return many;
    if (n1 > 1 && n1 < 5) return few;
    if (n1 === 1) return one;
    return many;
  }
}

export const i18n = new I18n();