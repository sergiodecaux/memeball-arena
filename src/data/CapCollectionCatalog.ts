// ✅ СОЗДАНО: Каталог коллекционных фишек (Mystic Caps)

import { FactionId } from '../constants/gameConstants';

export interface MysticCapData {
  id: string;

  /**
   * ✅ NEW: Regular unit id from UnitsCatalog that becomes owned after crafting this cap.
   * This is what will appear in Team -> RESERVES and can be equipped into the squad.
   */
  unitId: string;

  name: string;
  description: string;
  factionId: FactionId;
  requiredFragments: number;
  assetKey128: string;
  assetKey512: string;
  assetPath128: string;
  assetPath512: string;
}

// ⚠️ DISABLED: Mystic caps removed - textures not loading properly
export const MYSTIC_CAPS: MysticCapData[] = [];

/**
 * Получить данные фишки по ID
 */
export function getMysticCapById(id: string): MysticCapData | undefined {
  return MYSTIC_CAPS.find(cap => cap.id === id);
}

/**
 * Получить все фишки для фракции
 */
export function getMysticCapsByFaction(factionId: FactionId): MysticCapData[] {
  return MYSTIC_CAPS.filter(cap => cap.factionId === factionId);
}

