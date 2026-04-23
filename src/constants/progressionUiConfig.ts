// src/constants/progressionUiConfig.ts
// Конфигурация стилей для UI прогрессии

import { FACTIONS, FactionId } from './gameConstants';

/**
 * Цвета состояний карточек
 */
export const PROGRESSION_COLORS = {
  // Border colors
  borderDefault: 0x94a3ff,      // rgba(148, 163, 255, 0.4)
  borderLocked: 0x4b5563,       // rgba(75, 85, 99, 0.9)
  borderClaimable: 0xfacc15,    // #facc15
  borderClaimed: 0x38bdf8,      // rgba(56, 189, 248, 0.6)
  
  // Accent colors
  accentGold: 0xfacc15,
  accentBlue: 0x38bdf8,
  accentGreen: 0x22c55e,
  accentPurple: 0xa855f7,
  
  // Text colors
  textMain: 0xe5e7eb,
  textMuted: 0x9ca3af,
  textSoft: 0x6b7280,
  
  // Background colors
  bgCard: 0x0f172a,
  bgCardLocked: 0x1a1a2e,
  
  // Progress bar colors
  progressBarBg: 0x020617,
  progressBarFill: 0x38bdf8,
  progressBarFillClaimed: 0x22c55e,
  progressBarFillLocked: 0x4b5563,
  
  // Status chip colors
  statusInProgress: 0x6b7280,
  statusClaimable: 0xfacc15,
  statusLocked: 0x4b5563,
  statusClaimed: 0x2dd4bf,      // #a5f3fc in original but we use cyan
  
  // Button colors
  buttonPrimary: 0x22c55e,
  buttonGhost: 0x0f172a,
} as const;

/**
 * Цвета по фракциям (для рамок и прогресс-баров)
 */
export const FACTION_PROGRESSION_COLORS: Record<FactionId, {
  border: number;
  borderGlow: number;
  progressStart: number;
  progressEnd: number;
}> = {
  void: {
    border: 0xa855f7,           // purple
    borderGlow: 0x818cf8,
    progressStart: 0x38bdf8,    // cyan
    progressEnd: 0xa855f7,      // purple
  },
  magma: {
    border: 0xf87171,           // red
    borderGlow: 0xf87171,
    progressStart: 0xf97316,    // orange
    progressEnd: 0xef4444,      // red
  },
  cyborg: {
    border: 0x3b82f6,           // blue
    borderGlow: 0x3b82f6,
    progressStart: 0x22d3ee,    // cyan
    progressEnd: 0x3b82f6,      // blue
  },
  insect: {
    border: 0x22c55e,           // green
    borderGlow: 0x22c55e,
    progressStart: 0x22c55e,    // green
    progressEnd: 0xa3e635,      // lime
  },
};

/**
 * Размеры и отступы
 */
export const PROGRESSION_SIZES = {
  // Card
  cardPadding: 10,
  cardBorderRadius: 18,
  cardGap: 14,
  
  // Progress bar
  progressBarHeight: 8,
  progressBarBorderRadius: 999,
  
  // XP bar (player summary)
  xpBarHeight: 10,
  
  // Level badge
  levelBadgeSize: 56,
  
  // Buttons
  buttonHeight: 28,
  buttonPaddingX: 14,
  buttonBorderRadius: 999,
  
  // Status chip
  statusChipHeight: 22,
  statusChipPaddingX: 8,
  
  // Icon button
  iconButtonSize: 26,
  
  // Tab
  tabHeight: 32,
  tabPaddingX: 8,
} as const;

/**
 * Альфа-каналы
 */
export const PROGRESSION_ALPHAS = {
  borderDefault: 0.4,
  borderLocked: 0.9,
  borderClaimable: 1.0,
  borderClaimed: 0.6,
  cardLocked: 0.82,
  buttonGhost: 0.96,
  buttonGhostDisabled: 0.7,
} as const;

/**
 * Тени и эффекты
 */
export const PROGRESSION_EFFECTS = {
  cardShadow: { offsetX: 0, offsetY: 16, blur: 28, alpha: 0.9 },
  cardGlowClaimable: { offsetX: 0, offsetY: 0, blur: 32, alpha: 0.5, color: 0xfacc15 },
  cardGlowClaimed: { offsetX: 0, offsetY: 0, blur: 26, alpha: 0.6, color: 0x22c55e },
  levelBadgeGlow: { offsetX: 0, offsetY: 0, blur: 18, alpha: 0.7, color: 0xfbbf24 },
} as const;

/**
 * Анимации
 */
export const PROGRESSION_ANIMATIONS = {
  transitionFast: 150,
  transitionMedium: 200,
  cardHoverScale: 1.02,
  buttonHoverTranslateY: -1,
} as const;
