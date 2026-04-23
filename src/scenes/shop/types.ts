// src/scenes/shop/types.ts
// Общие типы для Shop системы

import Phaser from 'phaser';
import { FactionId } from '../../constants/gameConstants';
import { CardDefinition } from '../../data/CardsCatalog';
import { RewardItem } from '../../data/ChestLoot';

export type ShopTab = 'teams' | 'units' | 'balls' | 'avatars' | 'cards' | 'keys';

export interface Card {
  container: Phaser.GameObjects.Container;
  y: number;
  height: number;
}

export interface ShopSceneCallbacks {
  onPurchaseComplete?: () => void;
  onTabChange?: (tab: ShopTab) => void;
  onBack?: () => void;
}

export interface BoosterResult {
  cards: CardDefinition[];
  factionId?: FactionId;
}

export interface ChestResult {
  rewards: RewardItem[];
  summary: any;
  chestId: string;
}

export interface ScrollState {
  scrollY: number;
  maxScrollY: number;
  isDragging: boolean;
  dragDistance: number;
  scrollVelocity: number;
  lastPointerY: number;
  pointerStartY: number;
}
