// src/types/leagueRewards.ts
// Система наград Galaxy League

import { LeagueTier } from './league';

export interface LeagueReward {
  tier: LeagueTier;
  division: 1 | 2 | 3;
  rewards: {
    coins?: number;
    crystals?: number;
    cardPack?: 'common' | 'rare' | 'epic';
    skinId?: string;
    unitId?: string;
  };
  title: string;
  description: string;
}

/**
 * Награды за достижение каждого дивизиона каждой лиги
 */
export const LEAGUE_TIER_REWARDS: Record<LeagueTier, {
  name: string;
  nameRu: string;
  description: string;
  color: number;
  particleColor: number;
  rewards: {
    division1: LeagueReward;
    division2: LeagueReward;
    division3: LeagueReward;
  };
}> = {
  [LeagueTier.METEORITE]: {
    name: 'Meteorite',
    nameRu: 'Метеорит',
    description: 'Новички космической арены',
    color: 0x888888,
    particleColor: 0xaaaaaa,
    rewards: {
      division3: {
        tier: LeagueTier.METEORITE,
        division: 3,
        title: 'Начало пути',
        description: 'Добро пожаловать в Галактическую Лигу!',
        rewards: {
          coins: 500,
        },
      },
      division2: {
        tier: LeagueTier.METEORITE,
        division: 2,
        title: 'Восходящая звезда',
        description: 'Вы показываете потенциал',
        rewards: {
          coins: 1000,
          cardPack: 'common',
        },
      },
      division1: {
        tier: LeagueTier.METEORITE,
        division: 1,
        title: 'Готов к вызову',
        description: 'Пора переходить в высшую лигу',
        rewards: {
          coins: 2000,
          crystals: 5,
        },
      },
    },
  },
  
  [LeagueTier.COMET]: {
    name: 'Comet',
    nameRu: 'Комета',
    description: 'Стремительные бойцы',
    color: 0x00f2ff,
    particleColor: 0x00d4ff,
    rewards: {
      division3: {
        tier: LeagueTier.COMET,
        division: 3,
        title: 'Пылающий хвост',
        description: 'Вы оставляете след',
        rewards: {
          coins: 3000,
          crystals: 10,
        },
      },
      division2: {
        tier: LeagueTier.COMET,
        division: 2,
        title: 'Небесный странник',
        description: 'Движение сквозь звёзды',
        rewards: {
          coins: 5000,
          crystals: 15,
          cardPack: 'rare',
        },
      },
      division1: {
        tier: LeagueTier.COMET,
        division: 1,
        title: 'Разрушитель орбит',
        description: 'Ваша сила растёт',
        rewards: {
          coins: 8000,
          crystals: 25,
        },
      },
    },
  },
  
  [LeagueTier.PLANET]: {
    name: 'Planet',
    nameRu: 'Планета',
    description: 'Властители систем',
    color: 0x00ff88,
    particleColor: 0x00dd77,
    rewards: {
      division3: {
        tier: LeagueTier.PLANET,
        division: 3,
        title: 'Гравитационный центр',
        description: 'Всё вращается вокруг вас',
        rewards: {
          coins: 10000,
          crystals: 30,
          cardPack: 'rare',
        },
      },
      division2: {
        tier: LeagueTier.PLANET,
        division: 2,
        title: 'Хранитель жизни',
        description: 'Сила планетарного масштаба',
        rewards: {
          coins: 15000,
          crystals: 50,
        },
      },
      division1: {
        tier: LeagueTier.PLANET,
        division: 1,
        title: 'Планетарный чемпион',
        description: 'Готовы к звёздам',
        rewards: {
          coins: 20000,
          crystals: 75,
          cardPack: 'epic',
        },
      },
    },
  },
  
  [LeagueTier.STAR]: {
    name: 'Star',
    nameRu: 'Звезда',
    description: 'Сияющие легенды',
    color: 0xffd700,
    particleColor: 0xffcc00,
    rewards: {
      division3: {
        tier: LeagueTier.STAR,
        division: 3,
        title: 'Звёздное сияние',
        description: 'Ваш свет виден издалека',
        rewards: {
          coins: 25000,
          crystals: 100,
          cardPack: 'epic',
        },
      },
      division2: {
        tier: LeagueTier.STAR,
        division: 2,
        title: 'Солнечная вспышка',
        description: 'Невероятная энергия',
        rewards: {
          coins: 35000,
          crystals: 150,
        },
      },
      division1: {
        tier: LeagueTier.STAR,
        division: 1,
        title: 'Сверхновая',
        description: 'Взрыв силы и мастерства',
        rewards: {
          coins: 50000,
          crystals: 200,
          cardPack: 'epic',
        },
      },
    },
  },
  
  [LeagueTier.NEBULA]: {
    name: 'Nebula',
    nameRu: 'Туманность',
    description: 'Космические титаны',
    color: 0xff00ff,
    particleColor: 0xdd00dd,
    rewards: {
      division3: {
        tier: LeagueTier.NEBULA,
        division: 3,
        title: 'Космическая завеса',
        description: 'Окутаны мистикой',
        rewards: {
          coins: 60000,
          crystals: 250,
          cardPack: 'epic',
        },
      },
      division2: {
        tier: LeagueTier.NEBULA,
        division: 2,
        title: 'Творец миров',
        description: 'Рождение новых звёзд',
        rewards: {
          coins: 80000,
          crystals: 350,
        },
      },
      division1: {
        tier: LeagueTier.NEBULA,
        division: 1,
        title: 'Властелин туманности',
        description: 'Непревзойдённое мастерство',
        rewards: {
          coins: 100000,
          crystals: 500,
          cardPack: 'epic',
        },
      },
    },
  },
  
  [LeagueTier.CORE]: {
    name: 'Core',
    nameRu: 'Ядро',
    description: 'Абсолютная элита',
    color: 0xff4444,
    particleColor: 0xff2222,
    rewards: {
      division3: {
        tier: LeagueTier.CORE,
        division: 3,
        title: 'Сердце галактики',
        description: 'Вы достигли элиты',
        rewards: {
          coins: 120000,
          crystals: 600,
          cardPack: 'epic',
        },
      },
      division2: {
        tier: LeagueTier.CORE,
        division: 2,
        title: 'Гравитационный коллапс',
        description: 'Непобедимая сила',
        rewards: {
          coins: 150000,
          crystals: 800,
        },
      },
      division1: {
        tier: LeagueTier.CORE,
        division: 1,
        title: 'Галактический Император',
        description: 'Абсолютный чемпион вселенной',
        rewards: {
          coins: 200000,
          crystals: 1000,
          cardPack: 'epic',
        },
      },
    },
  },
};

/**
 * Получить награду за достижение определённого ранга
 */
export function getLeagueReward(tier: LeagueTier, division: 1 | 2 | 3): LeagueReward {
  const tierData = LEAGUE_TIER_REWARDS[tier];
  return tierData.rewards[`division${division}` as 'division1' | 'division2' | 'division3'];
}

/**
 * Получить информацию о лиге
 */
export function getLeagueTierInfo(tier: LeagueTier) {
  return LEAGUE_TIER_REWARDS[tier];
}
