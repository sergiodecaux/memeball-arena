// src/core/index.ts
// Централизованные экспорты core модулей

export { eventBus, GameEvents } from './EventBus';
export type {
  EventPayload,
  EventPayloadMap,
  MatchStartedPayload,
  MatchFinishedPayload,
  TurnStartedPayload,
  TurnEndedPayload,
  GoalScoredPayload,
  CollisionBallUnitPayload,
  CollisionBallWallPayload,
  VFXHitEffectPayload,
  VFXTeleportEffectPayload,
  HapticFeedbackPayload,
} from './EventBus';

export { MatchStateMachine, MatchPhase } from './MatchStateMachine';
export type {
  MatchStateContext,
  StateTransition,
  StateEnterHandler,
  StateExitHandler,
} from './MatchStateMachine';