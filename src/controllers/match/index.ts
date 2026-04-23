// src/controllers/match/index.ts
// Экспорты модуля match

export { MatchDirector } from './MatchDirector';
export type { MatchDirectorConfig, MatchDirectorEvents } from './MatchDirector';

export { ScoreKeeper } from './ScoreKeeper';
export type { ScoreState, GoalRecord } from './ScoreKeeper';

export { RewardCalculator } from './RewardCalculator';
export type { MatchStats, RewardResult, CampaignRewardResult } from './RewardCalculator';

// Legacy экспорт для обратной совместимости
export { MatchController } from './MatchController';
export type { MatchResult, MatchState } from './MatchController';