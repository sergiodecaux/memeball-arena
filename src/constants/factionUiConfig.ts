// src/constants/factionUiConfig.ts

import {
  FactionId as GameFactionId,
} from './gameConstants';

export type UIFactionId = 'magma' | 'cyber' | 'void' | 'terran';

export interface FactionUIConfig {
  name: string;
  color: number;
  desc: string;
  heroKey: string;
  bgFarKey: string;
  bgMidKey: string;
  bgFrontKey: string;
  gameFactionId: GameFactionId;
  // Новые поля для расширенного описания
  fullDescription?: string;
  strengths?: string[];
  weaknesses?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  difficultyText?: string;
  isStarterFaction?: boolean;  // Доступна ли для начального выбора
}

export const FACTION_UI: Record<UIFactionId, FactionUIConfig> = {
  magma: {
    name: 'MAGMA',
    color: 0xff4500,
    desc: 'Рождённые в сердце вулкана. Сокрушительная мощь и огненная ярость.',
    heroKey: 'faction_magma_hero',
    bgFarKey: 'faction_magma_bg_far',
    bgMidKey: 'faction_magma_bg_mid',
    bgFrontKey: 'faction_magma_bg_front',
    gameFactionId: 'magma',
    fullDescription: 'Воины Магмы черпают силу из раскалённого ядра планеты. Их удары подобны извержению вулкана — мощные и неудержимые. Каждый юнит этой фракции несёт в себе пламя древних звёзд.',
    strengths: ['Высокая сила ударов', 'Мощные способности урона', 'Устойчивость к контролю'],
    weaknesses: ['Низкая скорость', 'Слабая защита', 'Долгая перезарядка'],
    difficulty: 'easy',
    difficultyText: 'Легко',
    isStarterFaction: true,  // ✅ Доступна для начального выбора
  },
  cyber: {
    name: 'CYBORG',
    color: 0x00e5ff,
    desc: 'Технологическое превосходство. Точность, скорость и энергетические щиты.',
    heroKey: 'faction_cyber_hero',
    bgFarKey: 'faction_cyber_bg_far',
    bgMidKey: 'faction_cyber_bg_mid',
    bgFrontKey: 'faction_cyber_bg_front',
    gameFactionId: 'cyborg',
    fullDescription: 'Киборги — идеальное слияние человека и машины. Их нейросети просчитывают траектории за миллисекунды, а энергетические щиты отражают любые атаки. Точность — их главное оружие.',
    strengths: ['Высокая точность', 'Энергетические щиты', 'Быстрая перезарядка'],
    weaknesses: ['Средняя сила ударов', 'Уязвимость к помехам', 'Сложные комбо'],
    difficulty: 'medium',
    difficultyText: 'Средне',
    isStarterFaction: true,  // ✅ Доступна для начального выбора
  },
  void: {
    name: 'VOID',
    color: 0xbc13fe,
    desc: 'Загадочные сущности из глубин космоса. Телепортация и искажение пространства.',
    heroKey: 'faction_void_hero',
    bgFarKey: 'faction_void_bg_far',
    bgMidKey: 'faction_void_bg_mid',
    bgFrontKey: 'faction_void_bg_front',
    gameFactionId: 'void',
    fullDescription: 'Пустота — это не отсутствие, а бесконечные возможности. Воины Войда манипулируют самой тканью пространства, появляясь там, где их не ждут, и исчезая в момент опасности.',
    strengths: ['Телепортация', 'Непредсказуемость', 'Контроль пространства'],
    weaknesses: ['Низкое здоровье', 'Сложное управление', 'Требует опыта'],
    difficulty: 'hard',
    difficultyText: 'Сложно',
    isStarterFaction: false,  // ❌ Разблокируется позже
  },
  terran: {
    name: 'SWARM',
    color: 0x39ff14,
    desc: 'Коллективный разум роя. Токсины, адаптация и численное превосходство.',
    heroKey: 'faction_terran_hero',
    bgFarKey: 'faction_terran_bg_far',
    bgMidKey: 'faction_terran_bg_mid',
    bgFrontKey: 'faction_terran_bg_front',
    gameFactionId: 'insect',
    fullDescription: 'Рой не знает страха и сомнений. Миллионы существ действуют как единый организм, отравляя врагов токсинами и адаптируясь к любой угрозе. Сопротивление бесполезно.',
    strengths: ['Токсины и яды', 'Быстрая адаптация', 'Контроль территории'],
    weaknesses: ['Слабые по одиночке', 'Уязвимость к AoE', 'Медленный старт'],
    difficulty: 'medium',
    difficultyText: 'Средне',
    isStarterFaction: false,  // ❌ Разблокируется позже
  },
};

// Хелпер для получения стартовых фракций
export const STARTER_FACTIONS: UIFactionId[] = Object.entries(FACTION_UI)
  .filter(([_, config]) => config.isStarterFaction)
  .map(([id]) => id as UIFactionId);

export function getUIFactionByGameFaction(gameFactionId: GameFactionId): UIFactionId {
  switch (gameFactionId) {
    case 'magma': return 'magma';
    case 'cyborg': return 'cyber';
    case 'void': return 'void';
    case 'insect': return 'terran';
    default: return 'cyber';
  }
}

export function getGameFactionByUIFaction(uiFactionId: UIFactionId): GameFactionId {
  return FACTION_UI[uiFactionId].gameFactionId;
}