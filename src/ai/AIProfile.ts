// Профиль виртуального «аккаунта» бота: бедный / обычный / донатный — влияет на состав, карты и стиль.

export type AIAccountTier = 'budget' | 'standard' | 'whale';

export interface AIOpponentProfile {
  tier: AIAccountTier;
  seed: number;
}

export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

/** Стабильный профиль по ключу (имя бота + сложность и т.д.) */
export function deriveAIProfileFromKey(key: string): AIOpponentProfile {
  const seed = hashString(key);
  const u = (Math.abs(seed) % 1000) / 1000;
  let tier: AIAccountTier;
  if (u < 0.28) tier = 'budget';
  else if (u < 0.74) tier = 'standard';
  else tier = 'whale';
  return { tier, seed };
}

export function getProfileCardModifiers(tier: AIAccountTier): {
  bonusPickCount: number;
  minScoreMultiplier: number;
  cardUsageMultiplier: number;
  rarityWeightShift: number;
} {
  switch (tier) {
    case 'budget':
      return {
        bonusPickCount: 0,
        minScoreMultiplier: 1.22,
        cardUsageMultiplier: 0.58,
        rarityWeightShift: -22,
      };
    case 'standard':
      return {
        bonusPickCount: 1,
        minScoreMultiplier: 1,
        cardUsageMultiplier: 1,
        rarityWeightShift: 0,
      };
    case 'whale':
      return {
        bonusPickCount: 4,
        minScoreMultiplier: 0.68,
        cardUsageMultiplier: 1.42,
        rarityWeightShift: 26,
      };
  }
}

export function getProfilePlaystyleNoise(seed: number): {
  passOffset: number;
  aggressionOffset: number;
  bunkerOffset: number;
} {
  const a = (Math.abs(seed * 1103515245 + 12345) % 1000) / 1000;
  const b = (Math.abs(seed * 7919 + 104729) % 1000) / 1000;
  const c = (Math.abs(seed * 5179 + 9311) % 1000) / 1000;
  return {
    passOffset: (a - 0.5) * 0.26,
    aggressionOffset: (b - 0.5) * 0.16,
    bunkerOffset: (c - 0.5) * 0.14,
  };
}
