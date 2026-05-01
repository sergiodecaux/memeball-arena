/**
 * Human-looking opponent nicknames for disguised bots / AI fallbacks (Latin gamer-style).
 */

const FIRST = [
  'alex',
  'misha',
  'dima',
  'ivan',
  'pasha',
  'kolya',
  'max',
  'artem',
  'sergey',
  'oleg',
  'viktor',
  'nikita',
  'andrei',
  'vadim',
  'kirill',
  'roman',
  'egor',
  'danila',
  'rustam',
  'timur',
];

const TAG = [
  'wolf',
  'fox',
  'sky',
  'ice',
  'fire',
  'night',
  'star',
  'moon',
  'pro',
  'top',
  'win',
  'play',
  'king',
  'zero',
  'tm',
];

export function generateHumanLikeOpponentNickname(): string {
  const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
  const r = Math.random();
  const f = pick(FIRST);

  if (r < 0.42) {
    const n = Math.floor(Math.random() * 890) + 10;
    return `${f}_${n}`;
  }
  if (r < 0.78) {
    const t = pick(TAG);
    const n = Math.floor(Math.random() * 89) + 10;
    return `${f}.${t}${n}`;
  }
  const f2 = pick(FIRST);
  const n = Math.floor(Math.random() * 89) + 10;
  return `${f}_${f2}${n}`;
}
