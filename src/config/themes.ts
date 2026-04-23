// ✅ ИЗМЕНЕНО: Добавлены TYPOGRAPHY, TEXT_STYLES и хелперы для типографики

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

// ========== TYPOGRAPHY SYSTEM ==========

export const TYPOGRAPHY = {
  // Размеры шрифтов (базовые, будут масштабироваться)
  sizes: {
    xs: 11,      // Минимальный читаемый (было 8-9, увеличено)
    sm: 13,      // Мелкий текст
    md: 15,      // Основной текст
    lg: 18,      // Подзаголовки
    xl: 22,      // Заголовки секций
    xxl: 28,     // Крупные заголовки
    hero: 40,    // Главные заголовки
  },
  
  // Межстрочные интервалы
  lineHeight: {
    tight: 1.1,
    normal: 1.4,
    relaxed: 1.6,
  },
  
  // Межбуквенные интервалы
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 1,
    extraWide: 2,
  },
  
  // Тени текста для читаемости
  shadows: {
    none: undefined,
    subtle: { 
      offsetX: 0, 
      offsetY: 1, 
      color: '#000000', 
      blur: 2, 
      stroke: false,
      fill: true 
    },
    medium: { 
      offsetX: 0, 
      offsetY: 2, 
      color: '#000000', 
      blur: 4, 
      stroke: false,
      fill: true 
    },
    strong: { 
      offsetX: 0, 
      offsetY: 2, 
      color: '#000000', 
      blur: 8, 
      stroke: false,
      fill: true 
    },
    glow: { 
      offsetX: 0, 
      offsetY: 0, 
      color: '#00f2ff', 
      blur: 12, 
      stroke: false,
      fill: true 
    },
    glowPink: { 
      offsetX: 0, 
      offsetY: 0, 
      color: '#ff00de', 
      blur: 12, 
      stroke: false,
      fill: true 
    },
    glowGold: { 
      offsetX: 0, 
      offsetY: 0, 
      color: '#ffd700', 
      blur: 10, 
      stroke: false,
      fill: true 
    },
  },
} as const;

// Готовые стили текста
export const TEXT_STYLES = {
  // Заголовки
  h1: {
    fontSize: TYPOGRAPHY.sizes.hero,
    fontFamily: THEME.fonts.tech,
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 2,
  },
  h2: {
    fontSize: TYPOGRAPHY.sizes.xxl,
    fontFamily: THEME.fonts.tech,
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 1,
  },
  h3: {
    fontSize: TYPOGRAPHY.sizes.xl,
    fontFamily: THEME.fonts.tech,
    color: '#ffffff',
  },
  
  // Основной текст
  body: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontFamily: THEME.fonts.primary,
    color: '#cccccc',
    lineSpacing: 4,
  },
  bodyLarge: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontFamily: THEME.fonts.primary,
    color: '#cccccc',
    lineSpacing: 6,
  },
  bodySmall: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: THEME.fonts.primary,
    color: '#999999',
  },
  
  // Акцентный текст (Cyan)
  accent: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontFamily: THEME.fonts.tech,
    color: hexToString(THEME.colors.uiAccent),
  },
  accentLarge: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontFamily: THEME.fonts.tech,
    color: hexToString(THEME.colors.uiAccent),
  },
  
  // Акцент Pink
  accentPink: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontFamily: THEME.fonts.tech,
    color: hexToString(THEME.colors.uiAccentPink),
  },
  
  // Акцент Gold
  accentGold: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontFamily: THEME.fonts.tech,
    color: hexToString(THEME.colors.uiGold),
  },
  
  // Кнопки
  button: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontFamily: THEME.fonts.tech,
    color: '#ffffff',
    fontStyle: 'bold',
  },
  buttonLarge: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontFamily: THEME.fonts.tech,
    color: '#ffffff',
    fontStyle: 'bold',
  },
  buttonSmall: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: THEME.fonts.tech,
    color: '#ffffff',
  },
  
  // Метки/бейджи
  label: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontFamily: THEME.fonts.tech,
    color: '#888888',
  },
  labelAccent: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontFamily: THEME.fonts.tech,
    color: hexToString(THEME.colors.uiAccent),
  },
  
  // Валюта
  currency: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontFamily: THEME.fonts.tech,
    fontStyle: 'bold',
    color: '#ffffff',
  },
  currencyLarge: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontFamily: THEME.fonts.tech,
    fontStyle: 'bold',
    color: '#ffffff',
  },
  currencyGold: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontFamily: THEME.fonts.tech,
    fontStyle: 'bold',
    color: hexToString(THEME.colors.uiGold),
  },
  
  // Числа/статистика
  stat: {
    fontSize: TYPOGRAPHY.sizes.xl,
    fontFamily: THEME.fonts.tech,
    color: '#ffffff',
    fontStyle: 'bold',
  },
  statSmall: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontFamily: THEME.fonts.tech,
    color: '#ffffff',
  },
  
  // Уведомления
  notification: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: THEME.fonts.primary,
    color: '#ffffff',
  },
  
  // Ошибки/предупреждения
  error: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: THEME.fonts.primary,
    color: '#ff4444',
  },
  success: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: THEME.fonts.primary,
    color: '#44ff44',
  },
  warning: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontFamily: THEME.fonts.primary,
    color: '#ffaa00',
  },
} as const;

// Тип для ключей стилей
export type TextStyleName = keyof typeof TEXT_STYLES;

// Хелпер для применения стиля с масштабированием
export function getTextStyle(
  styleName: TextStyleName, 
  scale: number = 1,
  overrides?: Partial<Phaser.Types.GameObjects.Text.TextStyle>
): Phaser.Types.GameObjects.Text.TextStyle {
  const baseStyle = TEXT_STYLES[styleName];
  const scaledFontSize = Math.round((baseStyle.fontSize as number) * scale);
  
  return {
    ...baseStyle,
    fontSize: `${scaledFontSize}px`,
    ...overrides,
  } as Phaser.Types.GameObjects.Text.TextStyle;
}

// Хелпер для применения тени к тексту
export function applyTextShadow(
  text: Phaser.GameObjects.Text,
  shadowType: keyof typeof TYPOGRAPHY.shadows
): void {
  const shadow = TYPOGRAPHY.shadows[shadowType];
  if (shadow) {
    text.setShadow(
      shadow.offsetX,
      shadow.offsetY,
      shadow.color,
      shadow.blur,
      shadow.stroke,
      shadow.fill
    );
  }
}

// Хелпер для создания текста с готовым стилем
export function createStyledText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  styleName: TextStyleName,
  scale: number = 1,
  shadowType?: keyof typeof TYPOGRAPHY.shadows
): Phaser.GameObjects.Text {
  const text = scene.add.text(x, y, content, getTextStyle(styleName, scale));
  
  if (shadowType) {
    applyTextShadow(text, shadowType);
  }
  
  return text;
}

// ========== CARD STYLES ==========

export const CARD_STYLES = {
  // Стандартная карточка
  default: {
    backgroundColor: 0x12121f,
    backgroundAlpha: 0.98,
    borderColor: 0xffffff,
    borderAlpha: 0.1,
    borderWidth: 1.5,
    borderRadius: 16,
    shadowLayers: [
      { offsetX: 4, offsetY: 4, alpha: 0.3 },
      { offsetX: 2, offsetY: 2, alpha: 0.2 },
    ],
    glassEffect: true,
    glassAlpha: 0.05,
    glassHeight: 0.4,
  },
  
  // Акцентная карточка
  accent: {
    backgroundColor: 0x0a1520,
    backgroundAlpha: 0.95,
    borderColor: THEME.colors.uiAccent,
    borderAlpha: 0.5,
    borderWidth: 2,
    borderRadius: 16,
    shadowLayers: [
      { offsetX: 0, offsetY: 0, alpha: 0.3, color: THEME.colors.uiAccent, blur: 10 },
    ],
    glassEffect: true,
    glassAlpha: 0.08,
    glassHeight: 0.35,
  },
  
  // Карточка с градиентом
  gradient: {
    backgroundColor: 0x15152a,
    backgroundAlpha: 0.95,
    borderColor: 0xffffff,
    borderAlpha: 0.15,
    borderWidth: 1,
    borderRadius: 20,
    shadowLayers: [
      { offsetX: 3, offsetY: 3, alpha: 0.25 },
    ],
    glassEffect: true,
    glassAlpha: 0.06,
    glassHeight: 0.5,
  },
  
  // Компактная карточка
  compact: {
    backgroundColor: 0x0f0f1a,
    backgroundAlpha: 0.9,
    borderColor: 0xffffff,
    borderAlpha: 0.08,
    borderWidth: 1,
    borderRadius: 12,
    shadowLayers: [],
    glassEffect: false,
    glassAlpha: 0,
    glassHeight: 0,
  },
} as const;

export type CardStyleName = keyof typeof CARD_STYLES;

// Хелпер для отрисовки карточки
export function drawCard(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  styleName: CardStyleName = 'default'
): void {
  const style = CARD_STYLES[styleName];
  
  // Тени
  for (const shadow of style.shadowLayers) {
    const shadowColor = (shadow as any).color || 0x000000;
    graphics.fillStyle(shadowColor, shadow.alpha);
    graphics.fillRoundedRect(
      x + shadow.offsetX,
      y + shadow.offsetY,
      width,
      height,
      style.borderRadius
    );
  }
  
  // Основной фон
  graphics.fillStyle(style.backgroundColor, style.backgroundAlpha);
  graphics.fillRoundedRect(x, y, width, height, style.borderRadius);
  
  // Glass эффект (блик сверху)
  if (style.glassEffect) {
    graphics.fillStyle(0xffffff, style.glassAlpha);
    graphics.fillRoundedRect(
      x + 2,
      y + 2,
      width - 4,
      height * style.glassHeight,
      { tl: style.borderRadius - 2, tr: style.borderRadius - 2, bl: 0, br: 0 }
    );
  }
  
  // Рамка
  graphics.lineStyle(style.borderWidth, style.borderColor, style.borderAlpha);
  graphics.strokeRoundedRect(x, y, width, height, style.borderRadius);
}

// ========== ORIGINAL EXPORTS ==========

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

// ========== BUTTON STYLES ==========

export const BUTTON_STYLES = {
  primary: {
    backgroundColor: THEME.colors.uiAccent,
    backgroundAlpha: 1,
    hoverColor: 0x33f5ff,
    pressedColor: 0x00c4cc,
    textColor: '#000000',
    borderRadius: 12,
  },
  secondary: {
    backgroundColor: 0x2a2a3a,
    backgroundAlpha: 0.9,
    hoverColor: 0x3a3a4a,
    pressedColor: 0x1a1a2a,
    textColor: '#ffffff',
    borderRadius: 12,
  },
  outline: {
    backgroundColor: 0x000000,
    backgroundAlpha: 0.3,
    hoverColor: THEME.colors.uiAccent,
    hoverAlpha: 0.2,
    pressedColor: THEME.colors.uiAccent,
    pressedAlpha: 0.3,
    textColor: hexToString(THEME.colors.uiAccent),
    borderColor: THEME.colors.uiAccent,
    borderWidth: 2,
    borderRadius: 12,
  },
  danger: {
    backgroundColor: 0xff4444,
    backgroundAlpha: 1,
    hoverColor: 0xff6666,
    pressedColor: 0xcc3333,
    textColor: '#ffffff',
    borderRadius: 12,
  },
  gold: {
    backgroundColor: THEME.colors.uiGold,
    backgroundAlpha: 1,
    hoverColor: 0xffdd33,
    pressedColor: 0xccaa00,
    textColor: '#000000',
    borderRadius: 12,
  },
} as const;

export type ButtonStyleName = keyof typeof BUTTON_STYLES;