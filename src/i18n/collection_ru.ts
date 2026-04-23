// Русская локализация для Collection Scene

export const COLLECTION_RU = {
  // Заголовки
  title: 'РЕПОЗИТОРИЙ',
  collection: 'КОЛЛЕКЦИЯ',
  
  // Фракции (оригинальные названия остаются)
  factions: {
    magma: 'MAGMA',
    cyborg: 'CYBORG',
    void: 'VOID',
    insect: 'INSECT',
  },
  
  // Редкость
  rarity: {
    common: 'ОБЫЧНЫЙ',
    rare: 'РЕДКИЙ',
    epic: 'ЭПИЧЕСКИЙ',
    legendary: 'ЛЕГЕНДАРНЫЙ',
  },
  
  // Статы
  stats: {
    title: 'ХАРАКТЕРИСТИКИ',
    power: 'Мощь',
    defense: 'Защита',
    speed: 'Скорость',
    technique: 'Техника',
  },
  
  // UI элементы
  ui: {
    ability: 'СПОСОБНОСТЬ',
    description: 'ОПИСАНИЕ',
    fragments: 'ФРАГМЕНТЫ',
    craft: 'СОБРАТЬ',
    crafted: 'Собрано!',
    locked: 'ЗАБЛОКИРОВАН',
    unlocked: 'РАЗБЛОКИРОВАН',
    close: 'ЗАКРЫТЬ',
    back: 'НАЗАД',
    collected: 'Собрано',
    required: 'Требуется',
    progress: 'Прогресс',
    readyToCraft: '✅ Готов к сборке!',
    needFragments: 'Нужно ещё фрагментов',
  },
  
  // Подсказки
  hints: {
    clickToView: 'Нажмите для просмотра',
    lockedUnit: 'Соберите фрагменты для разблокировки',
    selectFaction: 'Выберите фракцию',
  },
};

export type CollectionLocale = typeof COLLECTION_RU;

