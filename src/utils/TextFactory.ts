import Phaser from 'phaser';
import { getFonts, TYPOGRAPHY, hexToString, THEME } from '../config/themes';

export interface TextConfig {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'hero';
  font?: 'tech' | 'primary';
  color?: string;
  align?: 'left' | 'center' | 'right';
  stroke?: boolean;
  shadow?: boolean;
  maxWidth?: number;
  fontStyle?: 'normal' | 'italic' | 'bold';
}

const SIZE_MAP = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  hero: 44,
};

export function createText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  content: string,
  config: TextConfig = {}
): Phaser.GameObjects.Text {
  const fonts = getFonts();
  const scale = scene.scale.width / 430; // DESIGN_WIDTH
  
  const fontSize = Math.round((SIZE_MAP[config.size || 'md']) * Math.min(scale, 1.2));
  const fontFamily = config.font === 'primary' ? fonts.primary : fonts.tech;
  
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily,
    fontSize: `${fontSize}px`,
    color: config.color || '#ffffff',
    align: config.align || 'left',
  };
  
  if (config.fontStyle) {
    style.fontStyle = config.fontStyle;
  }
  
  if (config.stroke) {
    style.stroke = '#000000';
    style.strokeThickness = Math.max(2, fontSize * 0.1);
  }
  
  if (config.maxWidth) {
    style.wordWrap = { width: config.maxWidth, useAdvancedWrap: true };
  }
  
  // ✅ КРИТИЧНО: Округляем координаты для чёткого рендеринга
  const text = scene.add.text(Math.round(x), Math.round(y), content, style);
  
  if (config.shadow) {
    text.setShadow(0, 2, '#000000', 4, true, true);
  }
  
  return text;
}

// Готовые пресеты
export const TextPresets = {
  title: (scene: Phaser.Scene, x: number, y: number, content: string) =>
    createText(scene, x, y, content, { size: 'xxl', font: 'tech', stroke: true, shadow: true }),
    
  heading: (scene: Phaser.Scene, x: number, y: number, content: string) =>
    createText(scene, x, y, content, { size: 'xl', font: 'tech', stroke: true }),
    
  body: (scene: Phaser.Scene, x: number, y: number, content: string, maxWidth?: number) =>
    createText(scene, x, y, content, { size: 'md', font: 'primary', maxWidth }),
    
  label: (scene: Phaser.Scene, x: number, y: number, content: string) =>
    createText(scene, x, y, content, { size: 'sm', font: 'tech', color: '#888888' }),
    
  button: (scene: Phaser.Scene, x: number, y: number, content: string) =>
    createText(scene, x, y, content, { size: 'lg', font: 'tech', stroke: true }),
    
  accent: (scene: Phaser.Scene, x: number, y: number, content: string) =>
    createText(scene, x, y, content, { size: 'md', font: 'tech', color: '#00f2ff' }),
};
