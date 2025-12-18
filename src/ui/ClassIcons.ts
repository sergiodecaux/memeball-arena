// src/ui/ClassIcons.ts

import Phaser from 'phaser';

/**
 * Рисует форму рамки класса
 */
export function drawClassFrame(
  scene: Phaser.Scene,
  x: number,
  y: number,
  capClass: string,
  radius: number,
  color: number,
  alpha: number = 1
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  
  switch (capClass) {
    case 'tank':
      drawTankFrame(g, x, y, radius, color, alpha);
      break;
    case 'sniper':
      drawSniperFrame(g, x, y, radius, color, alpha);
      break;
    case 'trickster':
      drawTricksterFrame(g, x, y, radius, color, alpha);
      break;
    case 'balanced':
    default:
      drawBalancedFrame(g, x, y, radius, color, alpha);
      break;
  }
  
  return g;
}

/**
 * Tank: Толстая шестиугольная рамка (бронированная)
 */
function drawTankFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, color: number, alpha: number): void {
  const outerRadius = radius;
  const innerRadius = radius * 0.85;
  const sides = 6;
  
  // Внешний шестиугольник (толстый)
  g.lineStyle(6, color, alpha);
  g.beginPath();
  for (let i = 0; i <= sides; i++) {
    const angle = (i * Math.PI * 2) / sides - Math.PI / 2;
    const px = x + Math.cos(angle) * outerRadius;
    const py = y + Math.sin(angle) * outerRadius;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.strokePath();
  
  // Внутренние болты/заклёпки
  g.fillStyle(color, alpha * 0.8);
  for (let i = 0; i < sides; i++) {
    const angle = (i * Math.PI * 2) / sides - Math.PI / 2;
    const px = x + Math.cos(angle) * (outerRadius * 0.92);
    const py = y + Math.sin(angle) * (outerRadius * 0.92);
    g.fillCircle(px, py, 3);
  }
  
  // Внутренняя рамка
  g.lineStyle(2, color, alpha * 0.5);
  g.beginPath();
  for (let i = 0; i <= sides; i++) {
    const angle = (i * Math.PI * 2) / sides - Math.PI / 2;
    const px = x + Math.cos(angle) * innerRadius;
    const py = y + Math.sin(angle) * innerRadius;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.strokePath();
}

/**
 * Sniper: Острые углы с прицельными метками
 */
function drawSniperFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, color: number, alpha: number): void {
  const outerRadius = radius;
  
  // Основной ромб с вырезами
  g.lineStyle(3, color, alpha);
  
  // 4 угла ромба
  const points = [
    { x: x, y: y - outerRadius },           // top
    { x: x + outerRadius, y: y },           // right
    { x: x, y: y + outerRadius },           // bottom
    { x: x - outerRadius, y: y },           // left
  ];
  
  // Рисуем ромб с вырезами посередине каждой стороны
  g.beginPath();
  for (let i = 0; i < 4; i++) {
    const curr = points[i];
    const next = points[(i + 1) % 4];
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;
    
    // Отступ к центру для выреза
    const insetX = (x - midX) * 0.15;
    const insetY = (y - midY) * 0.15;
    
    if (i === 0) g.moveTo(curr.x, curr.y);
    g.lineTo(midX + insetX, midY + insetY);
    g.lineTo(next.x, next.y);
  }
  g.closePath();
  g.strokePath();
  
  // Прицельные метки по углам
  const markLength = radius * 0.25;
  const markOffset = radius * 0.7;
  
  g.lineStyle(2, color, alpha);
  
  // Верхняя метка
  g.lineBetween(x - markLength/2, y - markOffset, x + markLength/2, y - markOffset);
  g.lineBetween(x, y - markOffset - markLength/2, x, y - markOffset + markLength/2);
  
  // Нижняя метка  
  g.lineBetween(x - markLength/2, y + markOffset, x + markLength/2, y + markOffset);
  g.lineBetween(x, y + markOffset - markLength/2, x, y + markOffset + markLength/2);
  
  // Боковые метки
  g.lineBetween(x - markOffset, y - markLength/2, x - markOffset, y + markLength/2);
  g.lineBetween(x + markOffset, y - markLength/2, x + markOffset, y + markLength/2);
}

/**
 * Balanced: Чистый круг с элегантным кольцом
 */
function drawBalancedFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, color: number, alpha: number): void {
  // Внешнее кольцо
  g.lineStyle(3, color, alpha);
  g.strokeCircle(x, y, radius);
  
  // Внутреннее тонкое кольцо
  g.lineStyle(1.5, color, alpha * 0.6);
  g.strokeCircle(x, y, radius * 0.88);
  
  // 4 маленькие звезды по кругу
  const starRadius = radius * 0.08;
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI / 2) - Math.PI / 4;
    const sx = x + Math.cos(angle) * (radius * 0.94);
    const sy = y + Math.sin(angle) * (radius * 0.94);
    drawMiniStar(g, sx, sy, starRadius, color, alpha);
  }
}

/**
 * Trickster: Волнистые/спиральные края
 */
function drawTricksterFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, color: number, alpha: number): void {
  const waves = 12;
  const waveDepth = radius * 0.12;
  
  // Волнистый круг
  g.lineStyle(3, color, alpha);
  g.beginPath();
  
  for (let i = 0; i <= 360; i += 2) {
    const angle = (i * Math.PI) / 180;
    const wave = Math.sin(angle * waves) * waveDepth;
    const r = radius + wave;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.strokePath();
  
  // Спиральные линии внутри
  g.lineStyle(1.5, color, alpha * 0.4);
  for (let s = 0; s < 3; s++) {
    g.beginPath();
    const startAngle = (s * 120) * Math.PI / 180;
    for (let i = 0; i <= 90; i += 5) {
      const angle = startAngle + (i * Math.PI) / 180;
      const r = radius * 0.3 + (i / 90) * radius * 0.5;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.strokePath();
  }
}

/**
 * Маленькая звезда для Balanced
 */
function drawMiniStar(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, color: number, alpha: number): void {
  g.fillStyle(color, alpha);
  g.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerAngle = (i * 72 - 90) * Math.PI / 180;
    const innerAngle = ((i * 72) + 36 - 90) * Math.PI / 180;
    
    const ox = x + Math.cos(outerAngle) * size;
    const oy = y + Math.sin(outerAngle) * size;
    const ix = x + Math.cos(innerAngle) * (size * 0.4);
    const iy = y + Math.sin(innerAngle) * (size * 0.4);
    
    if (i === 0) g.moveTo(ox, oy);
    else g.lineTo(ox, oy);
    g.lineTo(ix, iy);
  }
  g.closePath();
  g.fillPath();
}

/**
 * Рисует маленькую иконку класса (для бейджа)
 */
export function drawClassIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  capClass: string,
  size: number,
  color: number
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const g = scene.add.graphics();
  container.add(g);
  
  g.fillStyle(color, 1);
  g.lineStyle(1.5, color, 1);
  
  switch (capClass) {
    case 'tank':
      // Щит
      g.beginPath();
      g.moveTo(0, -size * 0.5);
      g.lineTo(size * 0.45, -size * 0.3);
      g.lineTo(size * 0.45, size * 0.2);
      g.lineTo(0, size * 0.5);
      g.lineTo(-size * 0.45, size * 0.2);
      g.lineTo(-size * 0.45, -size * 0.3);
      g.closePath();
      g.fillPath();
      break;
      
    case 'sniper':
      // Прицел
      g.strokeCircle(0, 0, size * 0.35);
      g.strokeCircle(0, 0, size * 0.15);
      g.lineBetween(-size * 0.5, 0, -size * 0.2, 0);
      g.lineBetween(size * 0.2, 0, size * 0.5, 0);
      g.lineBetween(0, -size * 0.5, 0, -size * 0.2);
      g.lineBetween(0, size * 0.2, 0, size * 0.5);
      break;
      
    case 'trickster':
      // Спираль
      g.beginPath();
      for (let i = 0; i <= 540; i += 10) {
        const angle = (i * Math.PI) / 180;
        const r = (i / 540) * size * 0.45;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
      break;
      
    case 'balanced':
    default:
      // Звезда
      g.beginPath();
      for (let i = 0; i < 5; i++) {
        const outerAngle = (i * 72 - 90) * Math.PI / 180;
        const innerAngle = ((i * 72) + 36 - 90) * Math.PI / 180;
        
        const ox = Math.cos(outerAngle) * size * 0.45;
        const oy = Math.sin(outerAngle) * size * 0.45;
        const ix = Math.cos(innerAngle) * size * 0.2;
        const iy = Math.sin(innerAngle) * size * 0.2;
        
        if (i === 0) g.moveTo(ox, oy);
        else g.lineTo(ox, oy);
        g.lineTo(ix, iy);
      }
      g.closePath();
      g.fillPath();
      break;
  }
  
  return container;
}

/**
 * Цвета классов
 */
export function getClassColor(capClass: string): number {
  switch (capClass) {
    case 'tank': return 0xf97316;      // Оранжевый
    case 'sniper': return 0x3b82f6;    // Синий
    case 'trickster': return 0xa855f7; // Фиолетовый
    case 'balanced': 
    default: return 0x22c55e;          // Зелёный
  }
}

/**
 * Вторичные цвета классов
 */
export function getClassSecondaryColor(capClass: string): number {
  switch (capClass) {
    case 'tank': return 0xc2410c;
    case 'sniper': return 0x1d4ed8;
    case 'trickster': return 0x7c3aed;
    case 'balanced': 
    default: return 0x15803d;
  }
}