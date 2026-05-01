/**
 * Идентификатор уникальной физической механики фишки (Matter.js / геймплей).
 * Полная таблица: `src/data/unitPhysicsModifiers.ts`.
 * Этап капитанов: отдельный класс Captain — позже.
 */
export type PhysicsModifierId = string;

export interface WithPhysicsModifier {
  physicsModifier?: PhysicsModifierId;
}
