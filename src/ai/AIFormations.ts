// src/ai/AIFormations.ts
// AI tactical formations for 3, 4, and 5 unit teams

import { Formation } from '../data/PlayerData';

// === AI FORMATIONS FOR 3 UNITS ===

export const AI_FORMATIONS_3: Record<string, Formation> = {
  defensive: {
    id: 'ai_defensive_3',
    name: '1-2 Defense',
    teamSize: 3,
    slots: [
      { id: 's0', x: 0.5, y: 0.15 },
      { id: 's1', x: 0.3, y: 0.35 },
      { id: 's2', x: 0.7, y: 0.35 },
    ],
    isCustom: true,
  },
  balanced: {
    id: 'ai_balanced_3',
    name: '1-2 Press',
    teamSize: 3,
    slots: [
      { id: 's0', x: 0.5, y: 0.2 },
      { id: 's1', x: 0.3, y: 0.42 },
      { id: 's2', x: 0.7, y: 0.42 },
    ],
    isCustom: true,
  },
  aggressive: {
    id: 'ai_aggressive_3',
    name: '3-0 Attack Press',
    teamSize: 3,
    slots: [
      { id: 's0', x: 0.5, y: 0.55 },
      { id: 's1', x: 0.25, y: 0.48 },
      { id: 's2', x: 0.75, y: 0.48 },
    ],
    isCustom: true,
  },
  counter: {
    id: 'ai_counter_3',
    name: '1-1-1 Counter',
    teamSize: 3,
    slots: [
      { id: 's0', x: 0.5, y: 0.12 },
      { id: 's1', x: 0.5, y: 0.3 },
      { id: 's2', x: 0.5, y: 0.48 },
    ],
    isCustom: true,
  },
};

// === AI FORMATIONS FOR 4 UNITS ===

export const AI_FORMATIONS_4: Record<string, Formation> = {
  defensive: {
    id: 'ai_defensive_4',
    name: 'Box Defense 2-2',
    teamSize: 4,
    slots: [
      { id: 's0', x: 0.35, y: 0.15 },
      { id: 's1', x: 0.65, y: 0.15 },
      { id: 's2', x: 0.3, y: 0.35 },
      { id: 's3', x: 0.7, y: 0.35 },
    ],
    isCustom: true,
  },
  balanced: {
    id: 'ai_balanced_4',
    name: 'Diamond 1-2-1',
    teamSize: 4,
    slots: [
      { id: 's0', x: 0.5, y: 0.12 },
      { id: 's1', x: 0.3, y: 0.28 },
      { id: 's2', x: 0.7, y: 0.28 },
      { id: 's3', x: 0.5, y: 0.45 },
    ],
    isCustom: true,
  },
  aggressive: {
    id: 'ai_aggressive_4',
    name: 'Wide Press 1-3',
    teamSize: 4,
    slots: [
      { id: 's0', x: 0.5, y: 0.18 },
      { id: 's1', x: 0.2, y: 0.5 },
      { id: 's2', x: 0.5, y: 0.55 },
      { id: 's3', x: 0.8, y: 0.5 },
    ],
    isCustom: true,
  },
  counter: {
    id: 'ai_counter_4',
    name: 'Y-Formation',
    teamSize: 4,
    slots: [
      { id: 's0', x: 0.5, y: 0.1 },
      { id: 's1', x: 0.5, y: 0.28 },
      { id: 's2', x: 0.3, y: 0.45 },
      { id: 's3', x: 0.7, y: 0.45 },
    ],
    isCustom: true,
  },
};

// === AI FORMATIONS FOR 5 UNITS ===

export const AI_FORMATIONS_5: Record<string, Formation> = {
  defensive: {
    id: 'ai_defensive_5',
    name: 'Wall 3-2',
    teamSize: 5,
    slots: [
      { id: 's0', x: 0.25, y: 0.12 },
      { id: 's1', x: 0.5, y: 0.12 },
      { id: 's2', x: 0.75, y: 0.12 },
      { id: 's3', x: 0.35, y: 0.32 },
      { id: 's4', x: 0.65, y: 0.32 },
    ],
    isCustom: true,
  },
  balanced: {
    id: 'ai_balanced_5',
    name: 'Pentagon 2-1-2',
    teamSize: 5,
    slots: [
      { id: 's0', x: 0.35, y: 0.12 },
      { id: 's1', x: 0.65, y: 0.12 },
      { id: 's2', x: 0.5, y: 0.28 },
      { id: 's3', x: 0.3, y: 0.45 },
      { id: 's4', x: 0.7, y: 0.45 },
    ],
    isCustom: true,
  },
  aggressive: {
    id: 'ai_aggressive_5',
    name: 'V-Attack 2-3',
    teamSize: 5,
    slots: [
      { id: 's0', x: 0.3, y: 0.18 },
      { id: 's1', x: 0.7, y: 0.18 },
      { id: 's2', x: 0.2, y: 0.52 },
      { id: 's3', x: 0.5, y: 0.58 },
      { id: 's4', x: 0.8, y: 0.52 },
    ],
    isCustom: true,
  },
  counter: {
    id: 'ai_counter_5',
    name: 'Arrow 1-2-2',
    teamSize: 5,
    slots: [
      { id: 's0', x: 0.5, y: 0.1 },
      { id: 's1', x: 0.35, y: 0.25 },
      { id: 's2', x: 0.65, y: 0.25 },
      { id: 's3', x: 0.3, y: 0.45 },
      { id: 's4', x: 0.7, y: 0.45 },
    ],
    isCustom: true,
  },
};

/**
 * Returns the AI formations dictionary for a given team size
 */
export function getAIFormationsForTeamSize(teamSize: number): Record<string, Formation> {
  switch (teamSize) {
    case 5:
      return AI_FORMATIONS_5;
    case 4:
      return AI_FORMATIONS_4;
    case 3:
    default:
      return AI_FORMATIONS_3;
  }
}

/**
 * Returns the default balanced AI formation for a team size
 */
export function getDefaultAIFormation(teamSize: number): Formation {
  const formations = getAIFormationsForTeamSize(teamSize);
  return formations.balanced || Object.values(formations)[0];
}

