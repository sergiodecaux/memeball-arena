// src/config/themes.ts

export type SkinRarity = 'basic' | 'common' | 'rare' | 'epic' | 'legendary';

export interface ThemeColors {
  // Background
  background: number;
  backgroundGradientTop: number;
  backgroundGradientBottom: number;
  
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
  
  // UI - New Cyberpunk Palette
  uiBackground: number;
  uiPrimary: number;      // Main purple
  uiSecondary: number;    // Light purple
  uiAccent: number;       // Cyan
  uiAccentPink: number;   // Pink/Magenta - NEW
  uiGold: number;         // Gold - NEW
  uiText: number;
  uiTextSecondary: number;
  
  // Glass effect
  glassBackground: number;
  glassBorder: number;
  
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
  useGlassMorphism: boolean;
  lineWidth: { thin: number; normal: number; thick: number };
  borderRadius: { small: number; medium: number; large: number; xlarge: number };
  fonts: {
    tech: string;
    primary: string;
  };
}

export const THEME: ThemeConfig = {
  name: 'Cyberpunk Premium',
  colors: {
    // Background - Deep purple gradient
    background: 0x050505,
    backgroundGradientTop: 0x3a0d5e,
    backgroundGradientBottom: 0x050505,
    
    // Field
    fieldPrimary: 0x0a0a12,
    fieldSecondary: 0x151525,
    fieldLines: 0x00f2ff,
    fieldBorder: 0xff00de,
    
    // Goal
    goalPost: 0xff00de,
    goalNet: 0x00f2ff,
    goalGlow: 0xff00de,
    
    // Ball
    ballPrimary: 0xffffff,
    ballSecondary: 0x00f2ff,
    ballGlow: 0x00f2ff,
    
    // UI - Cyberpunk Palette
    uiBackground: 0x050505,
    uiPrimary: 0x9d4edd,      // Purple
    uiSecondary: 0xc77dff,    // Light purple
    uiAccent: 0x00f2ff,       // Cyan (primary accent)
    uiAccentPink: 0xff00de,   // Pink/Magenta
    uiGold: 0xffd700,         // Gold
    uiText: 0xffffff,
    uiTextSecondary: 0x888899,
    
    // Glass effect
    glassBackground: 0xffffff,  // Will use with low alpha
    glassBorder: 0xffffff,
    
    // Teams
    team1Primary: 0x00f2ff,
    team1Secondary: 0x0891b2,
    team1Glow: 0x00f2ff,
    team2Primary: 0xff00de,
    team2Secondary: 0xbe185d,
    team2Glow: 0xff00de,
    
    // Rarity
    rarityBasic: 0x6b7280,
    rarityCommon: 0x3b82f6,
    rarityRare: 0x00f2ff,     // Cyan for rare
    rarityEpic: 0xff00de,     // Pink for epic
    rarityLegendary: 0xffd700, // Gold for legendary
    
    // Effects
    shadowColor: 0x000000,
    shadowAlpha: 0.6,
  },
  useGlow: true,
  useGradients: true,
  useShadows: true,
  useParticles: true,
  useGlassMorphism: true,
  lineWidth: { thin: 1, normal: 2, thick: 3 },
  borderRadius: { small: 4, medium: 8, large: 16, xlarge: 30 },
  fonts: {
    tech: 'Orbitron',
    primary: 'Arial',
  },
};

export function getTheme(): ThemeConfig {
  return THEME;
}

export function getColors(): ThemeColors {
  return THEME.colors;
}

export function getFonts() {
  return THEME.fonts;
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

// Helper for glass effect
export function getGlassStyle() {
  return {
    bgAlpha: 0.05,
    borderAlpha: 0.15,
    blur: 10,
  };
}