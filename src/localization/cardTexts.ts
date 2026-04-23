// src/localization/cardTexts.ts
// Russian localization for card descriptions (lightweight, no full i18n framework)

import { CardTargetType } from '../data/CardsCatalog';

export interface CardText {
  name: string;
  desc: string;
  target?: string;
}

export const CARD_TEXT_RU: Record<string, CardText> = {
  // ===== MAGMA FACTION =====
  magma_lava: {
    name: 'Лужа лавы',
    desc: 'Размещает лужу лавы, замедляющую всех, кто в неё попадёт.',
    target: 'Тап по полю',
  },
  magma_molten: {
    name: 'Раскалённый мяч',
    desc: 'Мяч оглушает врагов при контакте на короткое время.',
    target: 'Автоматически',
  },
  magma_meteor: {
    name: 'Удар метеора',
    desc: 'Взрывное воздействие в указанной точке, создаёт кратер-препятствие.',
    target: 'Тап по полю',
  },

  // ===== CYBORG FACTION =====
  cyborg_shield: {
    name: 'Энергощит',
    desc: 'Создаёт щит вокруг союзного юнита. Мяч отскакивает при контакте.',
    target: 'Выбери своего юнита',
  },
  cyborg_tether: {
    name: 'Магнитная привязь',
    desc: 'Связывает мяч с юнитом магнитной силой.',
    target: 'Выбери своего юнита',
  },
  cyborg_barrier: {
    name: 'Фотонный барьер',
    desc: 'Создаёт отскакивающую стену в указанном месте.',
    target: 'Тап по полю',
  },

  // ===== VOID FACTION =====
  void_swap: {
    name: 'Фазовый свап',
    desc: 'Мгновенно меняет местами двух союзных юнитов. Использование считается ходом.',
    target: 'Выбери двух союзников',
  },
  void_ghost: {
    name: 'Фаза призрака',
    desc: 'Юнит становится эфирным, игнорируя препятствия, но всё ещё бьёт по мячу.',
    target: 'Выбери своего юнита',
  },
  void_wormhole: {
    name: 'Кротовая нора',
    desc: 'Создаёт два портала для телепортации на поле.',
    target: 'Тап по полю',
  },

  // ===== INSECT FACTION =====
  insect_toxin: {
    name: 'Нейротоксин',
    desc: 'Заряжает юнита токсином: при столкновении оглушает врага.',
    target: 'Выбери своего юнита',
  },
  insect_mimic: {
    name: 'Биомимикрия',
    desc: 'Создаёт ложный мяч-приманку в указанном месте.',
    target: 'Тап по полю',
  },
  insect_parasite: {
    name: 'Нейральный паразит',
    desc: 'Временно берёт под контроль вражеский юнит.',
    target: 'Выбери вражеского юнита',
  },
};

export const UI_RU = {
  cooldown: (s: number) => `Кулдаун: ${s}с`,
  onCooldown: 'На перезарядке',
  tapToUse: 'Нажми, чтобы применить',
  tapToCancel: 'Нажми ещё раз, чтобы отменить',
};

/**
 * Get target hint text in Russian based on target type
 */
export function getTargetHintRU(targetType: CardTargetType): string {
  switch (targetType) {
    case 'point':
      return 'Тап по полю';
    case 'unit_self':
      return 'Выбери своего юнита';
    case 'unit_enemy':
      return 'Выбери вражеского юнита';
    case 'unit_ally_pair':
      return 'Выбери двух союзников';
    case 'none':
      return 'Автоматически';
    default:
      return '';
  }
}

