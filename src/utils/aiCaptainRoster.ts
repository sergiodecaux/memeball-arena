import type { FactionId } from '../constants/gameConstants';
import { CAPTAIN_BY_FACTION } from '../constants/captains';

/**
 * Подставляет капитана фракции в один из слотов состава AI.
 * Длина массива всегда ровно teamSize — капитан заменяет фишку в слоте, не добавляет «+1».
 */
export function applyCaptainSlotToAiUnitIds(
  unitIds: string[],
  factionId: FactionId,
  teamSize: number,
  opts: { includeCaptain: boolean; reserveBossSlot: boolean }
): string[] {
  const ts = Math.max(0, Math.floor(Number(teamSize)) || 0);
  if (ts === 0) return [];

  let next = unitIds.slice(0, ts);
  while (next.length < ts && unitIds.length > 0) {
    next.push(unitIds[next.length] ?? unitIds[unitIds.length - 1]);
  }
  next = next.slice(0, ts);

  if (!opts.includeCaptain) return next;

  const capId = CAPTAIN_BY_FACTION[factionId];
  if (!capId) return next;

  const bossSlotIndex = ts >= 3 ? 1 : 0;
  let captainSlot = ts >= 3 ? 1 : 0;
  if (opts.reserveBossSlot) {
    captainSlot = bossSlotIndex === 1 ? 0 : Math.min(1, Math.max(0, ts - 1));
  }

  if (captainSlot >= ts) captainSlot = 0;

  const displaced = next[captainSlot];
  next[captainSlot] = capId;

  const dupIdx = next.findIndex((id, idx) => id === capId && idx !== captainSlot);
  if (dupIdx >= 0) {
    const filler =
      displaced && displaced !== capId ? displaced : next.find((id, i) => i !== captainSlot && id !== capId);
    if (filler) next[dupIdx] = filler;
  }

  return next.slice(0, ts);
}
