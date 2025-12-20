// src/config/themes.ts

export type SkinRarity = 'basic' | 'common' | 'rare' | 'epic' | 'legendary';

export interface ThemeColors {
  // Background
  background: number;
  
  // Field
  fieldPrimary: number;
  fieldSecondary: number;
  fieldLines: number;
  fieldBorder: number;
  
  // Goal
  goalPost: number;
  goalNet: number;
  goalGlow: number;
  
  // Ball
  ballPrimary: number;
  ballSecondary: number;
  ballGlow: number;
  
  // UI
  uiBackground: number;
  uiPrimary: number;
  uiSecondary: number;
  uiAccent: number;
  uiText: number;
  uiTextSecondary: number;
  
  // Teams
  team1Primary: number;
  team1Secondary: number;
  team1Glow: number;
  team2Primary: number;
  team2Secondary: number;
  team2Glow: number;
  
  // Rarity
  rarityBasic: number;
  rarityCommon: number;
  rarityRare: number;
  rarityEpic: number;
  rarityLegendary: number;
  
  // Effects
  shadowColor: number;
  shadowAlpha: number;
}

export interface ThemeConfig {
  name: string;
  colors: ThemeColors;
  useGlow: boolean;
  useGradients: boolean;
  useShadows: boolean;
  useParticles: boolean;
  lineWidth: { thin: number; normal: number; thick: number };
  borderRadius: { small: number; medium: number; large: number };
}

export const THEME: ThemeConfig = {
  name: 'Cyberpunk',
  colors: {
    // Background
    background: 0x08080f,
    
    // Field
    fieldPrimary: 0x0a0a12,
    fieldSecondary: 0x151525,
    fieldLines: 0x00fff5,
    fieldBorder: 0x9d4edd,
    
    // Goal
    goalPost: 0xff006e,
    goalNet: 0x00fff5,
    goalGlow: 0xff006e,
    
    // Ball
    ballPrimary: 0xffffff,
    ballSecondary: 0x00fff5,
    ballGlow: 0x00fff5,
    
    // UI
    uiBackground: 0x05050a,
    uiPrimary: 0x9d4edd,
    uiSecondary: 0xc77dff,
    uiAccent: 0x00fff5,
    uiText: 0xffffff,
    uiTextSecondary: 0x6b7280,
    
    // Teams
    team1Primary: 0x00fff5,
    team1Secondary: 0x0891b2,
    team1Glow: 0x00fff5,
    team2Primary: 0xff006e,
    team2Secondary: 0xbe185d,
    team2Glow: 0xff006e,
    
    // Rarity
    rarityBasic: 0x6b7280,
    rarityCommon: 0x3b82f6,
    rarityRare: 0x9d4edd,
    rarityEpic: 0xff006e,
    rarityLegendary: 0xfbbf24,
    
    // Effects
    shadowColor: 0x000000,
    shadowAlpha: 0.6,
  },
  useGlow: true,
  useGradients: true,
  useShadows: true,
  useParticles: true,
  lineWidth: { thin: 1, normal: 2, thick: 3 },
  borderRadius: { small: 2, medium: 4, large: 8 },
};

export function getTheme(): ThemeConfig {
  return THEME;
}

export function getColors(): ThemeColors {
  return THEME.colors;
}

export function hexToString(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

export function getRarityColor(rarity: SkinRarity): number {
  const colors = THEME.colors;
  switch (rarity) {
    case 'basic': return colors.rarityBasic;
    case 'common': return colors.rarityCommon;
    case 'rare': return colors.rarityRare;
    case 'epic': return colors.rarityEpic;
    case 'legendary': return colors.rarityLegendary;
    default: return colors.rarityBasic;
  }
}