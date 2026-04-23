// src/data/CampaignData.ts
// Статические данные кампании: главы, уровни, диалоги

import {
  ChapterConfig,
  LevelConfig,
  DialogueEntry,
  WinCondition,
  StarCriteria,
  LevelReward,
} from '../types/CampaignTypes';

// ========== ДИАЛОГИ ==========

export const CAMPAIGN_DIALOGUES: Record<string, DialogueEntry> = {
  // === ПРОЛОГ / ОБУЧЕНИЕ ===
  'tutorial_welcome': {
    id: 'tutorial_welcome',
    lines: [
      {
        characterId: 'nova',
        text: 'Добро пожаловать в Галактическую Лигу, кадет! Я Командор Нова, и я буду твоим наставником.',
        emotion: 'happy',
        position: 'left',
        pauseGame: true,
      },
      {
        characterId: 'nova',
        text: 'Здесь лучшие пилоты галактики сражаются за славу. Готов показать, на что ты способен?',
        emotion: 'determined',
        position: 'left',
        pauseGame: true,
      },
    ],
    skippable: false,
    priority: 100,
  },
  
  'tutorial_first_goal': {
    id: 'tutorial_first_goal',
    lines: [
      {
        characterId: 'nova',
        text: 'Отличный удар! Ты быстро учишься. Продолжай в том же духе!',
        emotion: 'happy',
        position: 'left',
        autoHide: 3000,
      },
    ],
    skippable: true,
    priority: 50,
  },

  // === LIVE TUTORIAL DIALOGUES (Level 1-1) ===
  'tut_start': {
    id: 'tut_start',
    lines: [
      {
        characterId: 'nova',
        text: 'Приветствую, кадет! Я Командор Нова. Добро пожаловать на тренировку.',
        emotion: 'happy',
        pauseGame: true,
      },
      {
        characterId: 'nova',
        text: 'Правила просты: Матч длится 3 минуты. Побеждает тот, кто забьет больше голов.',
        emotion: 'neutral',
        pauseGame: true,
      },
      {
        characterId: 'nova',
        text: 'Тяни фишку назад, целься и отпускай, чтобы ударить. Забей 2 гола, чтобы пройти тест!',
        emotion: 'determined',
        pauseGame: true,
      },
    ],
    priority: 100,
  },
  'tut_goal': {
    id: 'tut_goal',
    lines: [
      {
        characterId: 'nova',
        text: 'Отличный удар! Ты схватываешь на лету.',
        emotion: 'happy',
        autoHide: 3000,
      },
    ],
    priority: 80,
  },
  'tut_end_win': {
    id: 'tut_end_win',
    lines: [
      {
        characterId: 'nova',
        text: 'Тест сдан! Ты готов к настоящим битвам в Галактической Лиге.',
        emotion: 'happy',
        pauseGame: true,
      },
    ],
    priority: 100,
  },
  'tut_abilities': {
    id: 'tut_abilities',
    lines: [
      {
        characterId: 'nova',
        text: 'Внимание! Внизу экрана есть Карты Способностей.',
        emotion: 'neutral',
        pauseGame: true,
      },
      {
        characterId: 'nova',
        text: 'Они могут менять ход матча. Попробуй использовать одну, когда будет возможность!',
        emotion: 'determined',
        pauseGame: true,
      },
    ],
    priority: 90,
  },

  // === ГЛАВА 1: MAGMA ===
  'ch1_intro': {
    id: 'ch1_intro',
    lines: [
      {
        characterId: 'nova',
        text: 'Первое задание — планета Вулкан. Здесь правят Магма Бруты.',
        emotion: 'neutral',
        position: 'left',
        pauseGame: false, // ✅ Pre-match: no scene pause needed
      },
      {
        characterId: 'nova',
        text: 'Они тяжёлые и медленные, но удар у них сокрушительный. Будь осторожен!',
        emotion: 'determined',
        position: 'left',
        pauseGame: false, // ✅ Pre-match: no scene pause needed
      },
    ],
    skippable: true,
    priority: 90,
  },

  'ch1_level1_start': {
    id: 'ch1_level1_start',
    lines: [
      {
        characterId: 'nova',
        text: 'Это тренировочный бой. Покажи, что усвоил основы!',
        emotion: 'neutral',
        position: 'left',
        autoHide: 3000,
      },
    ],
    skippable: true,
    priority: 80,
  },

  'ch1_level1_win': {
    id: 'ch1_level1_win',
    lines: [
      {
        characterId: 'nova',
        text: 'Превосходно! Ты готов к более серьёзным испытаниям.',
        emotion: 'happy',
        position: 'left',
        pauseGame: true,
      },
    ],
    skippable: true,
    priority: 70,
  },

  'ch1_boss_intro': {
    id: 'ch1_boss_intro',
    lines: [
      {
        characterId: 'krag',
        text: 'Ха! Ещё один выскочка думает, что может бросить мне вызов?',
        emotion: 'angry',
        position: 'right',
        pauseGame: false, // ✅ Pre-match: no scene pause needed
      },
      {
        characterId: 'nova',
        text: 'Это Краг, лидер Магма Брутов. Не дай ему запугать тебя!',
        emotion: 'determined',
        position: 'left',
        pauseGame: false, // ✅ Pre-match: no scene pause needed
      },
      {
        characterId: 'krag',
        text: 'Посмотрим, насколько ты горяч, когда я раздавлю тебя!',
        emotion: 'angry',
        position: 'right',
        pauseGame: false, // ✅ Pre-match: no scene pause needed
      },
    ],
    skippable: true,
    priority: 95,
  },

  'ch1_boss_win': {
    id: 'ch1_boss_win',
    lines: [
      {
        characterId: 'krag',
        text: 'Невозможно... Меня... победили?',
        emotion: 'surprised',
        position: 'right',
        pauseGame: true,
      },
      {
        characterId: 'nova',
        text: 'Отличная работа! Ты доказал своё мастерство. Путь к следующей планете открыт!',
        emotion: 'happy',
        position: 'left',
        pauseGame: true,
      },
    ],
    skippable: true,
    priority: 95,
  },

  // === ГЛАВА 2: CYBORG ===
  'ch2_intro': {
    id: 'ch2_intro',
    lines: [
      {
        characterId: 'nova',
        text: 'Станция "Нексус" — дом Терранских Киборгов. Они сбалансированы и точны.',
        emotion: 'neutral',
        position: 'left',
        pauseGame: false, // ✅ Pre-match: no scene pause needed
      },
      {
        characterId: 'nova',
        text: 'Их щиты могут отразить мяч. Учитывай это в своей стратегии!',
        emotion: 'determined',
        position: 'left',
        pauseGame: false, // ✅ Pre-match: no scene pause needed
      },
    ],
    skippable: true,
    priority: 90,
  },

  'ch2_boss_intro': {
    id: 'ch2_boss_intro',
    lines: [
      {
        characterId: 'unit_734',
        text: 'Анализ завершён. Вероятность твоей победы: 12.7%. Нелогично продолжать.',
        emotion: 'neutral',
        position: 'right',
        pauseGame: false, // ✅ Pre-match: no scene pause needed
      },
      {
        characterId: 'nova',
        text: 'Юнит 734 — их лучший тактик. Но статистика не учитывает твою решимость!',
        emotion: 'determined',
        position: 'left',
        pauseGame: false, // ✅ Pre-match: no scene pause needed
      },
    ],
    skippable: true,
    priority: 95,
  },

  // === ГЛАВА 3: VOID ===
  'ch3_intro': {
    id: 'ch3_intro',
    lines: [
      {
        characterId: 'nova',
        text: 'Пустоши Бездны. Здесь обитают Ходоки Пустоты — мастера телепортации.',
        emotion: 'neutral',
        position: 'left',
        pauseGame: false, // ✅ Pre-match: no scene pause needed
      },
      {
        characterId: 'nova',
        text: 'Они могут менять позиции юнитов. Следи за их перемещениями!',
        emotion: 'determined',
        position: 'left',
        pauseGame: false, // ✅ Pre-match: no scene pause needed
      },
    ],
    skippable: true,
    priority: 90,
  },

  'ch3_boss_intro': {
    id: 'ch3_boss_intro',
    lines: [
      {
        characterId: 'zra',
        text: 'Интересно... Я вижу множество вариантов будущего. В большинстве из них ты проигрываешь.',
        emotion: 'neutral',
        position: 'right',
        pauseGame: false, // ✅ Pre-match: no scene pause needed
      },
      {
        characterId: 'nova',
        text: 'Зра — провидица Бездны. Не дай её словам сбить тебя с толку!',
        emotion: 'determined',
        position: 'left',
        pauseGame: false, // ✅ Pre-match: no scene pause needed
      },
    ],
    skippable: true,
    priority: 95,
  },

  // === ГЛАВА 4: INSECT ===
  'ch4_intro': {
    id: 'ch4_intro',
    lines: [
      {
        characterId: 'nova',
        text: 'Улей Ксено. Последний рубеж. Рой Ксено — самые быстрые существа в галактике.',
        emotion: 'neutral',
        position: 'left',
        pauseGame: false, // ✅ Pre-match: no scene pause needed
      },
      {
        characterId: 'nova',
        text: 'Их токсин может парализовать твоих юнитов. Действуй быстро!',
        emotion: 'determined',
        position: 'left',
        pauseGame: false, // ✅ Pre-match: no scene pause needed
      },
    ],
    skippable: true,
    priority: 90,
  },

  'ch4_boss_intro': {
    id: 'ch4_boss_intro',
    lines: [
      {
        characterId: 'oracle',
        text: '*щелчки и шипение* Ты пришёл в наш улей... Ты станешь частью роя...',
        emotion: 'neutral',
        position: 'right',
        pauseGame: false, // ✅ Pre-match: no scene pause needed
      },
      {
        characterId: 'nova',
        text: 'Оракул — разум Роя. Это финальное испытание. Я верю в тебя!',
        emotion: 'determined',
        position: 'left',
        pauseGame: false, // ✅ Pre-match: no scene pause needed
      },
    ],
    skippable: true,
    priority: 95,
  },

  // === ФИНАЛ ===
  'finale_win': {
    id: 'finale_win',
    lines: [
      {
        characterId: 'nova',
        text: 'Ты сделал это! Ты победил всех чемпионов Галактической Лиги!',
        emotion: 'happy',
        position: 'left',
        pauseGame: true,
      },
      {
        characterId: 'nova',
        text: 'Отныне ты — легенда! Галактика будет помнить твоё имя!',
        emotion: 'happy',
        position: 'left',
        pauseGame: true,
      },
    ],
    skippable: true,
    priority: 100,
  },

  // === ОБЩИЕ РЕАКЦИИ ===
  'generic_player_goal': {
    id: 'generic_player_goal',
    lines: [
      {
        characterId: 'announcer',
        text: 'Отличный удар!',
        emotion: 'happy',
        position: 'left',
        autoHide: 2000,
      },
    ],
    skippable: true,
    priority: 20,
  },

  'generic_enemy_goal': {
    id: 'generic_enemy_goal',
    lines: [
      {
        characterId: 'nova',
        text: 'Не сдавайся! Ещё можно отыграться!',
        emotion: 'determined',
        position: 'left',
        autoHide: 2500,
      },
    ],
    skippable: true,
    priority: 20,
  },

  'generic_close_match': {
    id: 'generic_close_match',
    lines: [
      {
        characterId: 'announcer',
        text: 'Напряжённый матч! Кто победит?',
        emotion: 'neutral',
        position: 'left',
        autoHide: 2000,
      },
    ],
    skippable: true,
    priority: 30,
  },
};

// ========== УРОВНИ ==========

const DEFAULT_STAR_CRITERIA: StarCriteria = {
  oneStar: 'Победить',
  twoStars: 'Победить, не пропустив больше 1 гола',
  threeStars: 'Победить с сухим счётом',
  twoStarsValue: 1,
  threeStarsValue: 0,
};

const DEFAULT_REWARD: LevelReward = {
  firstClearCoins: 150,
  firstClearXP: 75,
  replayCoins: 40,
  replayXP: 20,
  perfectBonus: 75,
};

export const CAMPAIGN_LEVELS: Record<string, LevelConfig> = {
  // === ГЛАВА 1: MAGMA (Обучение + Первые бои) ===
  '1-1': {
    id: '1-1',
    chapterId: 'chapter_1',
    orderInChapter: 1,
    name: 'Базовая подготовка',
    description: 'Основы управления',
    enemyFaction: 'cyborg', // Will be overridden dynamically in GameScene
    aiDifficulty: 'easy',
    winCondition: { type: 'score_limit', scoreLimit: 2 },
    matchDuration: 180,
    reward: { 
      firstClearCoins: 200,
      firstClearXP: 100,
      replayCoins: 50,
      replayXP: 25,
      perfectBonus: 100,
    },
    starCriteria: DEFAULT_STAR_CRITERIA,
    
    // 🔥 LIVE TUTORIAL TRIGGERS
    // Removing dialogueBeforeMatch to allow match to start immediately
    inMatchDialogues: [
      { trigger: 'match_start', dialogueId: 'tut_start' },
      { trigger: 'first_player_goal', dialogueId: 'tut_goal' },
      // Trigger ability hint after first turn or randomly
      { trigger: 'enemy_leading', dialogueId: 'tut_abilities', oncePerMatch: true },
    ],
    
    dialogueAfterWin: 'ch1_level1_win',
    isTutorial: true,
    requiresPreviousLevel: false,
    previewImageKey: 'campaign_ch1_l1_preview',
    shortObjective: 'Score 2 goals to pass training.',
  },
  '1-2': {
    id: '1-2',
    chapterId: 'chapter_1',
    orderInChapter: 2,
    name: 'Жар битвы',
    description: 'Адаптируйся к агрессивному стилю',
    enemyFaction: 'magma',
    aiDifficulty: 'easy',
    winCondition: { type: 'score_limit', scoreLimit: 3 },
    matchDuration: 240,
    reward: {
      firstClearCoins: 200,
      firstClearXP: 100,
      replayCoins: 50,
      replayXP: 25,
      perfectBonus: 100,
    },
    starCriteria: DEFAULT_STAR_CRITERIA,
    inMatchDialogues: [
      { trigger: 'first_player_goal', dialogueId: 'generic_player_goal', oncePerMatch: true },
    ],
    previewImageKey: 'campaign_ch1_l2_preview',
    shortObjective: 'Win against aggressive Magma Brutes in a match to 3 goals.',
  },
  '1-3': {
    id: '1-3',
    chapterId: 'chapter_1',
    orderInChapter: 3,
    name: 'Испытание огнём',
    description: 'Победи на лавовом поле',
    enemyFaction: 'magma',
    aiDifficulty: 'medium',
    winCondition: { type: 'score_limit', scoreLimit: 3 },
    fieldModifiers: [{ type: 'lava_floor', intensity: 0.05 }],
    matchDuration: 300,
    reward: {
      firstClearCoins: 250,
      firstClearXP: 100,
      replayCoins: 60,
      replayXP: 25,
      perfectBonus: 125,
    },
    starCriteria: DEFAULT_STAR_CRITERIA,
    previewImageKey: 'campaign_ch1_l3_preview',
    shortObjective: 'Win on the lava field in a match to 3 goals.',
  },
  '1-4': {
    id: '1-4',
    chapterId: 'chapter_1',
    orderInChapter: 4,
    name: 'Краг, Повелитель Магмы',
    description: 'Финальный бой главы',
    enemyFaction: 'magma',
    aiDifficulty: 'medium',
    winCondition: { type: 'score_limit', scoreLimit: 3 },
    fieldModifiers: [{ type: 'lava_floor', intensity: 0.03 }],
    matchDuration: 300,
    reward: {
      firstClearCoins: 500,
      firstClearXP: 150,
      replayCoins: 100,
      replayXP: 40,
      perfectBonus: 200,
    },
    starCriteria: {
      oneStar: 'Победить Крага',
      twoStars: 'Победить с разницей в 2 гола',
      threeStars: 'Победить с сухим счётом',
      twoStarsValue: 2,
      threeStarsValue: 0,
    },
    dialogueBeforeMatch: 'ch1_boss_intro',
    dialogueAfterWin: 'ch1_boss_win',
    isBoss: true,
    previewImageKey: 'campaign_ch1_l4_preview',
    shortObjective: 'Defeat Krag in a 3-goal showdown on the magma arena.',
  },

  // === ГЛАВА 2: CYBORG ===
  '2-1': {
    id: '2-1',
    chapterId: 'chapter_2',
    orderInChapter: 1,
    name: 'Цифровая арена',
    description: 'Первый бой с киборгами',
    enemyFaction: 'cyborg',
    aiDifficulty: 'easy',
    winCondition: { type: 'score_limit', scoreLimit: 3 },
    matchDuration: 240,
    reward: DEFAULT_REWARD,
    starCriteria: DEFAULT_STAR_CRITERIA,
    dialogueBeforeMatch: 'ch2_intro',
    previewImageKey: 'campaign_ch2_l1_preview',
    shortObjective: 'Face cyborgs in a classic match to 3 goals.',
  },
  '2-2': {
    id: '2-2',
    chapterId: 'chapter_2',
    orderInChapter: 2,
    name: 'Точность машины',
    description: 'Противник использует щиты',
    enemyFaction: 'cyborg',
    aiDifficulty: 'medium',
    winCondition: { type: 'score_limit', scoreLimit: 3 },
    matchDuration: 300,
    reward: { ...DEFAULT_REWARD, firstClearCoins: 125 },
    starCriteria: DEFAULT_STAR_CRITERIA,
    previewImageKey: 'campaign_ch2_l2_preview',
    shortObjective: 'Play around enemy shields and score 3 goals.',
  },
  '2-3': {
    id: '2-3',
    chapterId: 'chapter_2',
    orderInChapter: 3,
    name: 'Выживание',
    description: 'Продержись 2 минуты, не проигрывая',
    enemyFaction: 'cyborg',
    aiDifficulty: 'medium',
    winCondition: { type: 'time_survival', timeLimit: 120 },
    matchDuration: 120,
    reward: { ...DEFAULT_REWARD, firstClearCoins: 150 },
    starCriteria: {
      oneStar: 'Продержаться 2 минуты',
      twoStars: 'Забить хотя бы 1 гол',
      threeStars: 'Не пропустить ни одного гола',
      twoStarsValue: 1,
      threeStarsValue: 0,
    },
    previewImageKey: 'campaign_ch2_l3_preview',
    shortObjective: 'Survive 2 minutes without losing the match.',
  },
  '2-4': {
    id: '2-4',
    chapterId: 'chapter_2',
    orderInChapter: 4,
    name: 'Юнит 734',
    description: 'Победи главного тактика',
    enemyFaction: 'cyborg',
    aiDifficulty: 'hard',
    winCondition: { type: 'score_limit', scoreLimit: 3 },
    matchDuration: 300,
    reward: {
      firstClearCoins: 300,
      firstClearXP: 120,
      replayCoins: 60,
      replayXP: 30,
      perfectBonus: 125,
    },
    starCriteria: {
      oneStar: 'Победить Юнита 734',
      twoStars: 'Победить за 4 минуты',
      threeStars: 'Победить с сухим счётом',
      twoStarsValue: 240,
      threeStarsValue: 0,
    },
    dialogueBeforeMatch: 'ch2_boss_intro',
    isBoss: true,
    previewImageKey: 'campaign_ch2_l4_preview',
    shortObjective: 'Defeat Unit 734 in a 3-goal duel.',
  },

  // === ГЛАВА 3: VOID ===
  '3-1': {
    id: '3-1',
    chapterId: 'chapter_3',
    orderInChapter: 1,
    name: 'Тени Бездны',
    description: 'Первый контакт с Пустотой',
    enemyFaction: 'void',
    aiDifficulty: 'medium',
    winCondition: { type: 'score_limit', scoreLimit: 3 },
    matchDuration: 300,
    reward: DEFAULT_REWARD,
    starCriteria: DEFAULT_STAR_CRITERIA,
    dialogueBeforeMatch: 'ch3_intro',
    previewImageKey: 'campaign_ch3_l1_preview',
    shortObjective: 'Meet the Void Walkers and score 3 goals.',
  },
  '3-2': {
    id: '3-2',
    chapterId: 'chapter_3',
    orderInChapter: 2,
    name: 'Телепортация',
    description: 'Враг активно меняет позиции',
    enemyFaction: 'void',
    aiDifficulty: 'medium',
    winCondition: { type: 'score_limit', scoreLimit: 3 },
    matchDuration: 300,
    reward: { ...DEFAULT_REWARD, firstClearCoins: 150 },
    starCriteria: DEFAULT_STAR_CRITERIA,
    previewImageKey: 'campaign_ch3_l2_preview',
    shortObjective: 'Track enemy teleports and win to 3 goals.',
  },
  '3-3': {
    id: '3-3',
    chapterId: 'chapter_3',
    orderInChapter: 3,
    name: 'Золотой гол',
    description: 'Один шанс решить всё',
    enemyFaction: 'void',
    aiDifficulty: 'medium',
    winCondition: { type: 'sudden_death' },
    matchDuration: 180,
    reward: { ...DEFAULT_REWARD, firstClearCoins: 175 },
    starCriteria: {
      oneStar: 'Забить золотой гол',
      twoStars: 'Победить за 3 попытки',
      threeStars: 'Победить с первой попытки',
      twoStarsValue: 3,
      threeStarsValue: 1,
    },
    previewImageKey: 'campaign_ch3_l3_preview',
    shortObjective: 'Score the golden goal before your opponent.',
  },
  '3-4': {
    id: '3-4',
    chapterId: 'chapter_3',
    orderInChapter: 4,
    name: 'Зра, Провидица',
    description: 'Бой с предсказательницей',
    enemyFaction: 'void',
    aiDifficulty: 'hard',
    winCondition: { type: 'score_limit', scoreLimit: 3 },
    matchDuration: 300,
    reward: {
      firstClearCoins: 350,
      firstClearXP: 140,
      replayCoins: 70,
      replayXP: 35,
      perfectBonus: 150,
    },
    starCriteria: {
      oneStar: 'Победить Зру',
      twoStars: 'Победить с разницей в 2 гола',
      threeStars: 'Победить с сухим счётом',
      twoStarsValue: 2,
      threeStarsValue: 0,
    },
    dialogueBeforeMatch: 'ch3_boss_intro',
    isBoss: true,
    previewImageKey: 'campaign_ch3_l4_preview',
    shortObjective: 'Defeat Zra in a 3-goal match.',
  },

  // === ГЛАВА 4: INSECT ===
  '4-1': {
    id: '4-1',
    chapterId: 'chapter_4',
    orderInChapter: 1,
    name: 'Вторжение в Улей',
    description: 'Начало финальной главы',
    enemyFaction: 'insect',
    aiDifficulty: 'medium',
    winCondition: { type: 'score_limit', scoreLimit: 3 },
    matchDuration: 300,
    reward: DEFAULT_REWARD,
    starCriteria: DEFAULT_STAR_CRITERIA,
    dialogueBeforeMatch: 'ch4_intro',
    previewImageKey: 'campaign_ch4_l1_preview',
    shortObjective: 'Begin the hive assault and score 3 goals.',
  },
  '4-2': {
    id: '4-2',
    chapterId: 'chapter_4',
    orderInChapter: 2,
    name: 'Скорость Роя',
    description: 'Противник невероятно быстр',
    enemyFaction: 'insect',
    aiDifficulty: 'hard',
    winCondition: { type: 'score_limit', scoreLimit: 3 },
    matchDuration: 300,
    reward: { ...DEFAULT_REWARD, firstClearCoins: 175 },
    starCriteria: DEFAULT_STAR_CRITERIA,
    previewImageKey: 'campaign_ch4_l2_preview',
    shortObjective: 'Handle the Swarm speed and win to 3 goals.',
  },
  '4-3': {
    id: '4-3',
    chapterId: 'chapter_4',
    orderInChapter: 3,
    name: 'Токсичная угроза',
    description: 'Избегай оглушения!',
    enemyFaction: 'insect',
    aiDifficulty: 'hard',
    winCondition: { type: 'no_goals_against' },
    matchDuration: 180,
    reward: { ...DEFAULT_REWARD, firstClearCoins: 200 },
    starCriteria: {
      oneStar: 'Не пропустить гол за 3 минуты',
      twoStars: 'Забить хотя бы 2 гола',
      threeStars: 'Забить 3+ гола',
      twoStarsValue: 2,
      threeStarsValue: 3,
    },
    previewImageKey: 'campaign_ch4_l3_preview',
    shortObjective: 'Do not concede any goals for 3 minutes.',
  },
  '4-4': {
    id: '4-4',
    chapterId: 'chapter_4',
    orderInChapter: 4,
    name: 'Оракул Роя',
    description: 'Финальный босс кампании',
    enemyFaction: 'insect',
    aiDifficulty: 'hard',
    winCondition: { type: 'score_limit', scoreLimit: 3 },
    fieldModifiers: [{ type: 'sticky_walls' }],
    matchDuration: 360,
    reward: {
      firstClearCoins: 500,
      firstClearXP: 200,
      replayCoins: 100,
      replayXP: 50,
      perfectBonus: 200,
    },
    starCriteria: {
      oneStar: 'Победить Оракула',
      twoStars: 'Победить с разницей в 2 гола',
      threeStars: 'Победить с сухим счётом',
      twoStarsValue: 2,
      threeStarsValue: 0,
    },
    dialogueBeforeMatch: 'ch4_boss_intro',
    dialogueAfterWin: 'finale_win',
    isBoss: true,
    previewImageKey: 'campaign_ch4_l4_preview',
    shortObjective: 'Defeat the Hive Oracle in the final 3-goal match.',
  },
};

// ========== ГЛАВЫ ==========

export const CAMPAIGN_CHAPTERS: Record<string, ChapterConfig> = {
  'chapter_1': {
    id: 'chapter_1',
    order: 1,
    name: 'Вулкан',
    description: 'Планета Магма Брутов. Научись основам и победи Крага!',
    factionId: 'magma',
    levelIds: ['1-1', '1-2', '1-3', '1-4'],
    bossLevelId: '1-4',
    accentColor: 0xff4500,
    icon: '🔥',
    unlockRequirement: {
      // Первая глава открыта после обучения
    },
  },
  'chapter_2': {
    id: 'chapter_2',
    order: 2,
    name: 'Станция Нексус',
    description: 'Дом Терранских Киборгов. Точность и расчёт!',
    factionId: 'cyborg',
    levelIds: ['2-1', '2-2', '2-3', '2-4'],
    bossLevelId: '2-4',
    accentColor: 0x00f2ff,
    icon: '⚡',
    unlockRequirement: {
      previousChapterId: 'chapter_1',
      requireBossDefeat: true,
    },
  },
  'chapter_3': {
    id: 'chapter_3',
    order: 3,
    name: 'Пустоши Бездны',
    description: 'Территория Ходоков Пустоты. Мастера телепортации.',
    factionId: 'void',
    levelIds: ['3-1', '3-2', '3-3', '3-4'],
    bossLevelId: '3-4',
    accentColor: 0x9d00ff,
    icon: '🌀',
    unlockRequirement: {
      previousChapterId: 'chapter_2',
      requireBossDefeat: true,
    },
  },
  'chapter_4': {
    id: 'chapter_4',
    order: 4,
    name: 'Улей Ксено',
    description: 'Финальная глава. Победи Рой и стань легендой!',
    factionId: 'insect',
    levelIds: ['4-1', '4-2', '4-3', '4-4'],
    bossLevelId: '4-4',
    accentColor: 0x39ff14,
    icon: '🦗',
    unlockRequirement: {
      previousChapterId: 'chapter_3',
      requireBossDefeat: true,
    },
  },
};

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

export function getChapter(chapterId: string): ChapterConfig | undefined {
  return CAMPAIGN_CHAPTERS[chapterId];
}

export function getLevel(levelId: string): LevelConfig | undefined {
  return CAMPAIGN_LEVELS[levelId];
}

export function getDialogue(dialogueId: string): DialogueEntry | undefined {
  return CAMPAIGN_DIALOGUES[dialogueId];
}

export function getChapterLevels(chapterId: string): LevelConfig[] {
  const chapter = CAMPAIGN_CHAPTERS[chapterId];
  if (!chapter) return [];
  return chapter.levelIds.map(id => CAMPAIGN_LEVELS[id]).filter(Boolean);
}

export function getAllChaptersOrdered(): ChapterConfig[] {
  return Object.values(CAMPAIGN_CHAPTERS).sort((a, b) => a.order - b.order);
}

export function getNextLevel(currentLevelId: string): LevelConfig | undefined {
  const currentLevel = CAMPAIGN_LEVELS[currentLevelId];
  if (!currentLevel) return undefined;
  
  const chapter = CAMPAIGN_CHAPTERS[currentLevel.chapterId];
  if (!chapter) return undefined;
  
  const currentIndex = chapter.levelIds.indexOf(currentLevelId);
  if (currentIndex === -1 || currentIndex >= chapter.levelIds.length - 1) {
    // Это последний уровень главы — ищем первый уровень следующей главы
    const allChapters = getAllChaptersOrdered();
    const currentChapterIndex = allChapters.findIndex(c => c.id === chapter.id);
    
    if (currentChapterIndex < allChapters.length - 1) {
      const nextChapter = allChapters[currentChapterIndex + 1];
      return CAMPAIGN_LEVELS[nextChapter.levelIds[0]];
    }
    return undefined;
  }
  
  return CAMPAIGN_LEVELS[chapter.levelIds[currentIndex + 1]];
}

export function getTotalCampaignStars(): number {
  return Object.keys(CAMPAIGN_LEVELS).length * 3;
}