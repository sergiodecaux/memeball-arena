// src/constants/aiDifficultyConfig.ts
import type { AISkillLevel } from '../ai/types/AITypes';

export interface AIDifficultyUIConfig {
  id: AISkillLevel;
  name: string;
  description: string;
  color: number;
  features: string[];
  recommendedFor: string;
}

/** Справочник для UI / подсказок (англ.). Игровой {@link AIDifficulty} — easy | medium | hard | impossible. */
export const AI_DIFFICULTY_CONFIGS: AIDifficultyUIConfig[] = [
  {
    id: 'beginner',
    name: 'Beginner',
    description: 'Learning the game',
    color: 0x90ee90,
    features: [
      'Very low accuracy',
      'No cards / minimal tactics',
      'Slow reactions',
      'Good for first matches',
    ],
    recommendedFor: 'Absolute newcomers',
  },
  {
    id: 'easy',
    name: 'Easy',
    description: 'Casual practice',
    color: 0x87ceeb,
    features: ['Low accuracy', 'No cards on easy AI', 'Simple shots'],
    recommendedFor: 'Getting familiar with mechanics',
  },
  {
    id: 'medium',
    name: 'Medium',
    description: 'Balanced challenge',
    color: 0xffd700,
    features: ['Solid accuracy', 'Uses cards', 'Passes', 'Formation shifts after goals', 'Synergy hints'],
    recommendedFor: 'Players who know the basics',
  },
  {
    id: 'hard',
    name: 'Hard',
    description: 'Serious competition',
    color: 0xff8c00,
    features: [
      'High accuracy',
      'Pass chains & combos',
      'Pattern-aware adaptation',
      'Comeback pressure',
      'Pre-match counter-setup',
    ],
    recommendedFor: 'Experienced players',
  },
  {
    id: 'expert',
    name: 'Expert',
    description: 'Maximum challenge',
    color: 0xff0000,
    features: ['Near-perfect shots', 'Aggressive cards', 'Full tactical toolkit'],
    recommendedFor: 'Masters',
  },
];
