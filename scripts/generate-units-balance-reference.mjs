/**
 * Строит docs/UNITS_FULL_STATS_AND_BALANCE_REFERENCE.md без импорта TS (обходит enums в gameConstants).
 * Запуск: node scripts/generate-units-balance-reference.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const REPO_TS = path.join(ROOT, 'src', 'data', 'UnitsRepository.ts');
const OUT = path.join(ROOT, 'docs', 'UNITS_FULL_STATS_AND_BALANCE_REFERENCE.md');

/** Сверяйте с FACTION_IDS / FACTIONS / BASE_ACCURACY / FACTION_ACCURACY_MODIFIER / ABILITY_DEFINITIONS в gameConstants */
const FACTION_IDS = ['magma', 'cyborg', 'void', 'insect'];

const FACTIONS = {
  magma: {
    name: 'Magma Brutes',
    description: 'Heavy Defense. Hard to move, devastating impact.',
    stats: { mass: 1.38, bounce: 0.3, speed: 0.85 },
  },
  cyborg: {
    name: 'Terran Cyborgs',
    description: 'Balanced Tech. Precision engineering for any situation.',
    stats: { mass: 1.0, bounce: 0.7, speed: 1.0 },
  },
  void: {
    name: 'Void Walkers',
    description: 'Phase Control. Light and elusive with powerful curve shots.',
    stats: { mass: 0.75, bounce: 0.85, speed: 1.0, control: 1.55 },
  },
  insect: {
    name: 'Xeno Swarm',
    description: 'Speed Assault. Lightning fast strikes, fragile but deadly.',
    stats: { mass: 0.82, bounce: 0.5, speed: 1.22 },
  },
};

const BASE_ACCURACY = {
  sniper: 0.96,
  balanced: 0.92,
  trickster: 0.88,
  tank: 0.84,
};

const FACTION_ACCURACY_MODIFIER = {
  cyborg: 0.05,
  void: 0.02,
  insect: 0,
  magma: -0.03,
};

const ABILITY_DEFINITIONS = {
  magma: {
    icon: '🔥',
    name: 'Lava Pool',
    description: 'Place a lava pool that slows enemies',
    chargeCost: 1,
  },
  cyborg: {
    icon: '⚡',
    name: 'Energy Shield',
    description: 'Protect a unit with a deflecting shield',
    chargeCost: 1,
  },
  void: {
    icon: '🌀',
    name: 'Phase Swap',
    description: 'Swap positions of two allied units',
    chargeCost: 1,
  },
  insect: {
    icon: '☣️',
    name: 'Neurotoxin',
    description: 'Charge a unit to stun enemies on impact',
    chargeCost: 1,
  },
};

const FRAGMENTS_BY_RARITY = { common: 3, rare: 6, epic: 10, legendary: 15 };

const RARITY_RU = {
  common: 'Обычный',
  rare: 'Редкий',
  epic: 'Эпический',
  legendary: 'Легендарный',
};

const ROLE_RU = {
  balanced: 'Универсал (balanced)',
  tank: 'Танк (tank)',
  sniper: 'Снайпер (sniper)',
  trickster: 'Трикстер (trickster)',
};

const RARITY_ORDER = ['legendary', 'epic', 'rare', 'common'];
const ROLE_ORDER = ['tank', 'sniper', 'balanced', 'trickster'];

function findClosingBracket(text, openIndex) {
  let depth = 1;
  let q = null;
  let escaped = false;
  /** Вне строк: пропуск // и /*-блоков, иначе `// --- TANK` ломает подсчёт [] */
  let i = openIndex;

  while (i + 1 < text.length) {
    i += 1;
    const c = text[i];

    if (q) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (c === '\\') {
        escaped = true;
        continue;
      }
      if (c === q) q = null;
      continue;
    }

    if (c === "'" || c === '"' || c === '`') {
      q = c;
      continue;
    }

    if (c === '/' && text[i + 1] === '/') {
      i += 1;
      while (i < text.length && text[i] !== '\n' && text[i] !== '\r') i += 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      i += 2;
      while (i + 1 < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i += 1;
      continue;
    }

    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error('Не найдена закрывающая ] для UNITS_REPOSITORY');
}

function extractUnitsArraySource(body) {
  const marker = 'export const UNITS_REPOSITORY';
  const i = body.indexOf(marker);
  if (i < 0) throw new Error('UNITS_REPOSITORY не найден');
  /** Не путать с типом UnitData[] — берём [ после знака = */
  const eq = body.indexOf('=', i);
  const lb = body.indexOf('[', eq);
  if (lb < 0) throw new Error('Не найдена открывающая [ массива данных');
  const rb = findClosingBracket(body, lb);
  return body.slice(lb, rb + 1);
}

function loadUnitsRepositoryRuntime() {
  let body = fs.readFileSync(REPO_TS, 'utf8');
  body = body.replace(/\$\{ASSETS_VERSION\}/g, '4');

  const arrayLiteral = extractUnitsArraySource(body);
  const snippet = `'use strict'; const UNITS_REPOSITORY = ${arrayLiteral};`;
  const js = ts.transpile(snippet, {
    target: ts.ScriptTarget.ES2020,
  });
  const UNITS_REPOSITORY = new Function(`${js}; return UNITS_REPOSITORY;`)();
  if (!Array.isArray(UNITS_REPOSITORY)) {
    throw new Error('UNITS_REPOSITORY не массив');
  }
  return UNITS_REPOSITORY;
}

function calculateUnitRating(unit) {
  const { power, defense, speed, technique } = unit.stats;
  const baseRating = power + defense + speed + technique;
  const rarityBonus =
    unit.rarity === 'common' ? 0 : unit.rarity === 'rare' ? 2 : unit.rarity === 'epic' ? 4 : 6;
  return baseRating + rarityBonus;
}

function sortUnits(units) {
  return [...units].sort((a, b) => {
    const r = RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
    if (r !== 0) return r;
    const rl = ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role);
    if (rl !== 0) return rl;
    return (a.nameRu || a.name).localeCompare(b.nameRu || b.name, 'ru');
  });
}

function fmtParams(params) {
  if (!params || Object.keys(params).length === 0) return 'нет';
  return JSON.stringify(params);
}

function econFlags(u) {
  const parts = [];
  if (u.isCaptain) parts.push('капитан (награда за 10 ур. аккаунта, выбор 1 из 4)');
  if (u.isStarter) parts.push('стартовая фишка при выборе фракции');
  if (u.isShopItem && u.shopPrice != null) parts.push(`магазин: ${u.shopPrice} монет`);
  if (u.isPremium && u.premiumPrice != null) parts.push(`премиум: ${u.premiumPrice} кристаллов`);
  if (u.isBattlePass) {
    parts.push(`Battle Pass: сезон ${u.battlePassSeason ?? '?'}, тир ${u.battlePassTier ?? '?'}`);
  }
  return parts.length ? parts : ['коллекция / дроп / иные источники'];
}

function unitBlock(u) {
  const { power, defense, speed, technique } = u.stats;
  const sum = power + defense + speed + technique;
  const fr = u.fragmentsRequired ?? FRAGMENTS_BY_RARITY[u.rarity];

  return [
    `#### ${u.nameRu} — *${u.name}*  \`id: ${u.id}\``,
    '',
    '| Поле | Значение |',
    '|------|----------|',
    `| Роль | ${ROLE_RU[u.role]} |`,
    `| Редкость | ${RARITY_RU[u.rarity]} (${u.rarity}) |`,
    `| Рейтинг (репозиторий) | **${calculateUnitRating(u)}** (сумма P+D+Sp+T = ${sum}; бонус редкости: common +0 · rare +2 · epic +4 · legendary +6) |`,
    `| Сила (power) | ${power} |`,
    `| Защита (defense) | ${defense} |`,
    `| Скорость (speed) | ${speed} |`,
    `| Техника (technique) | ${technique} |`,
    `| Точность \`accuracy\` | **${u.accuracy}** |`,
    `| Способность (UI) | ${u.specialAbility} |`,
    `| Титул | ${u.title} |`,
    `| Фрагментов для сборки | ${fr} |`,
    `| Источник | ${econFlags(u).join('; ')} |`,
    '',
    '**Описание (текст из репозитория):**',
    '',
    String(u.description).trim(),
    '',
    '**Пассивка:**',
    '',
    `- Тип: \`${u.passive.type}\``,
    `- Название: ${u.passive.name}`,
    `- Описание: ${u.passive.description}`,
    `- Параметры: \`${fmtParams(u.passive.params)}\``,
    '',
    '---',
    '',
  ].join('\n');
}

function factionPhysicsBlock(fid) {
  const cfg = FACTIONS[fid];
  let t = `**Физика фракции (\`FACTIONS.${fid}.stats\`):**\n\n`;
  t += '| Параметр | Значение |\n|----------|----------|\n';
  for (const k of Object.keys(cfg.stats)) {
    t += `| ${k} | ${cfg.stats[k]} |\n`;
  }
  t += '\n*(В связке с классом Cap влияет на физику на поле.)*\n\n';
  return t;
}

function main() {
  const UNITS_REPOSITORY = loadUnitsRepositoryRuntime();

  const now = new Date().toISOString().slice(0, 10);
  const statsCount = {};
  for (const f of FACTION_IDS) statsCount[f] = UNITS_REPOSITORY.filter((u) => u.factionId === f).length;

  let md = `# Полный справочник фишек: статы, описания и пассивки\n\n`;
  md += `> Данные карточек из **\`src/data/UnitsRepository.ts\`** (${UNITS_REPOSITORY.length} записей).\n`;
  md += `> Блок FACTIONS / BASE_ACCURACY и т.д. в этом файле синхронизируйте с **\`src/constants/gameConstants.ts\`** при правках баланса.\n`;
  md += `> Дата сборки: **${now}** · команда: \`node scripts/generate-units-balance-reference.mjs\`\n\n`;

  md += `## Шкала и модификаторы\n\n`;
  md += `### Поля статов карточки (\`UnitStats\`)\n\n`;
  md += `- **power**, **defense**, **speed**, **technique** — числа из репозитория; у части юнитов (премиум / босс) значения выше условной шкалы 1–10.\n\n`;

  md += `### BASE_ACCURACY по классу\n\n| Класс | Значение |\n|--------|----------|\n`;
  for (const c of ['sniper', 'balanced', 'trickster', 'tank']) {
    md += `| ${c} | ${BASE_ACCURACY[c]} |\n`;
  }

  md += `\n### FACTION_ACCURACY_MODIFIER\n\n| Фракция | Δ |\n|---------|---|\n`;
  for (const f of FACTION_IDS) md += `| ${f} | ${FACTION_ACCURACY_MODIFIER[f]} |\n`;

  md += `\n### Актив на поле (карты фракций)\n\n`;
  for (const f of FACTION_IDS) {
    const a = ABILITY_DEFINITIONS[f];
    md += `- **${f}** — ${a.icon} **${a.name}**: ${a.description} · заряд ${a.chargeCost}\n`;
  }

  md += `\n### Фрагменты по редкости\n\n| Редкость | Штук |\n|----------|------|\n`;
  for (const r of [...RARITY_ORDER].reverse()) {
    md += `| ${r} | ${FRAGMENTS_BY_RARITY[r]} |\n`;
  }

  md += `\nТипы пассивок: \`src/types/passives.ts\`\n\n---\n\n`;

  for (const factionId of FACTION_IDS) {
    const cfg = FACTIONS[factionId];
    const units = sortUnits(UNITS_REPOSITORY.filter((u) => u.factionId === factionId));
    md += `## Фракция: ${cfg.name} (\`${factionId}\`) — **${statsCount[factionId]}** фишек\n\n`;
    md += `*${cfg.description}*\n\n`;
    md += factionPhysicsBlock(factionId);
    for (const u of units) md += unitBlock(u);
  }

  md += `\n## Сводная таблица (все юниты)\n\n`;
  md += `| id | Фракция | RU | Роль | Редкость | P | D | Sp | T | Σ | Рейтинг* | accuracy |\n`;
  md += `|----|---------|-----|------|----------|---|--|----|---|----|----------|----------|\n`;
  for (const u of sortUnits([...UNITS_REPOSITORY])) {
    const { power, defense, speed, technique } = u.stats;
    const sum = power + defense + speed + technique;
    md += `| ${u.id} | ${u.factionId} | ${u.nameRu} | ${u.role} | ${u.rarity} | ${power} | ${defense} | ${speed} | ${technique} | ${sum} | ${calculateUnitRating(u)} | ${u.accuracy} |\n`;
  }
  md += `\n\\* Рейтинг = сумма четырёх статов + бонус редкости (как в \`calculateUnitRating()\`).\n`;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, md, 'utf8');
  console.log('Written:', OUT);
}

main();
