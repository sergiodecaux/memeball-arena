// src/scenes/BootScene.ts

import Phaser from 'phaser';
import { ParticleTextures } from '../assets/textures/ParticleTextures';
import { CapTextures } from '../assets/textures/CapTextures';
import { BallTextures } from '../assets/textures/BallTextures';
import { FieldTextures } from '../assets/textures/FieldTextures';
import { AvatarTextures } from '../assets/textures/AvatarTextures';
import { playerData } from '../data/PlayerData';
import { FACTIONS, FACTION_IDS, FactionId, FACTION_ARENAS, FactionArena } from '../constants/gameConstants';
import { UNITS_CATALOG } from '../data/UnitsCatalog';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // === Загрузка Аудио ===
    this.load.setPath('assets/audio');

    this.load.audio('bgm_menu', 'bgm/menu_theme.mp3');
    this.load.audio('bgm_match', 'bgm/stadium_ambience.mp3');

    this.load.audio('sfx_kick', 'sfx/kick.mp3');
    this.load.audio('sfx_clack', 'sfx/collision.mp3');
    this.load.audio('sfx_bounce', 'sfx/wall_hit.mp3');
    this.load.audio('sfx_post', 'sfx/post.mp3');
    this.load.audio('sfx_net', 'sfx/net.mp3');
    this.load.audio('sfx_goal', 'sfx/goal.mp3');
    this.load.audio('sfx_whistle', 'sfx/whistle.mp3');
    this.load.audio('sfx_win', 'sfx/win.mp3');
    this.load.audio('sfx_lose', 'sfx/lose.mp3');

    this.load.audio('sfx_click', 'sfx/ui_click.mp3');
    this.load.audio('sfx_cash', 'sfx/cash.mp3');
    this.load.audio('sfx_swish', 'sfx/swish.mp3');

    this.load.setPath('');

    // === Загрузка Мемов (legacy, для совместимости) ===
    this.load.setPath('assets/skins/memes');

    this.load.image('meme_doge', 'doge.png');
    this.load.image('meme_gigachad', 'gigachad.png');
    this.load.image('meme_cat', 'cat.png');
    this.load.image('meme_trollface', 'trollface.png');
    this.load.image('meme_hamster', 'hamster.png');

    this.load.setPath('');

    // === ЗАГРУЗКА ОБЩИХ АССЕТОВ ДЛЯ ЮНИТОВ ===
    this.load.image('metal_ring', 'assets/sprites/common/metal_ring.png');
    this.load.image('overlay_lighting', 'assets/sprites/common/overlay_lighting.png');

    // === ЗАГРУЗКА UI АССЕТОВ ===
    this.load.image('ui_scoreboard', 'assets/ui/scoreboard.png');

    // === ЗАГРУЗКА ЮНИТОВ ФРАКЦИЙ (16 PNG) ===
    this.loadFactionUnits();

    // === Загрузка токенов фракций ===
    this.loadFactionTokens();

    // === ЗАГРУЗКА ФРАКЦИОННЫХ АРЕН ===
    this.loadFactionArenas();

    // ✅ ЗАГРУЗКА PNG МЯЧЕЙ (3 орба)
    this.loadBallSkins();
  }

  /**
   * Загружает PNG юнитов всех фракций (4×4 = 16 файлов)
   */
  private loadFactionUnits(): void {
    console.log('[BootScene] Loading faction units...');
    
    UNITS_CATALOG.forEach((unit) => {
      this.load.image(unit.assetKey, unit.assetPath);
      console.log(`[BootScene] Queued unit: ${unit.assetKey} → ${unit.assetPath}`);
    });
  }

  /**
   * Загружает токены фракций (256x256 PNG)
   */
  private loadFactionTokens(): void {
    console.log('[BootScene] Loading faction tokens...');
    
    for (const factionId of FACTION_IDS) {
      const faction = FACTIONS[factionId];
      this.load.image(faction.assetKey, faction.assetPath);
      console.log(`[BootScene] Queued token: ${faction.assetKey} → ${faction.assetPath}`);
    }
  }

  /**
   * Загружает фоны арен для каждой фракции
   */
  private loadFactionArenas(): void {
    console.log('[BootScene] Loading faction arenas...');
    
    for (const factionId of FACTION_IDS) {
      const arena = FACTION_ARENAS[factionId];
      this.load.image(arena.assetKey, arena.assetPath);
      console.log(`[BootScene] Queued arena: ${arena.assetKey} → ${arena.assetPath}`);
    }
  }

  /**
   * ✅ НОВОЕ: Загружает PNG мячей (3 шт)
   */
  private loadBallSkins(): void {
    console.log('[BootScene] Loading ball skins...');
    
    this.load.image('ball_plasma', 'assets/sprites/balls/plasma.png');
    this.load.image('ball_core', 'assets/sprites/balls/core.png');
    this.load.image('ball_quantum', 'assets/sprites/balls/quantum.png');
    
    console.log('[BootScene] Queued 3 ball skins');
  }

  create(): void {
    // Проверяем загрузку юнитов
    this.verifyUnitAssets();
    
    // Проверяем загрузку фракций
    this.verifyFactionAssets();

    // Проверяем загрузку общих ассетов
    this.verifyCommonAssets();

    // Проверяем загрузку арен
    this.verifyArenaAssets();

    // ✅ Проверяем загрузку мячей
    this.verifyBallAssets();

    // ✅ ГЕНЕРИРУЕМ МЕТАЛЛИЧЕСКОЕ КОЛЬЦО ЕСЛИ НЕ ЗАГРУЖЕНО
    if (!this.textures.exists('metal_ring')) {
      console.warn('[BootScene] metal_ring.png not found — generating fallback');
      this.generateMetalRingTexture();
    }

    // Генерируем процедурные текстуры
    new ParticleTextures(this).generate();
    new CapTextures(this).generate();
    new BallTextures(this).generate();
    new FieldTextures(this).generate();
    new AvatarTextures(this).generate();

    // Генерация текстуры ауры
    this.generateAuraTexture();

    // Генерируем fallback текстуры для фракций (если PNG не загрузился)
    this.generateFactionFallbacks();

    // Генерируем fallback текстуры для юнитов (если PNG не загрузился)
    this.generateUnitFallbacks();

    // Генерируем текстуры частиц для фракций
    this.generateFactionParticleTextures();

    // Генерируем fallback текстуры для арен (если PNG не загрузились)
    this.generateArenaFallbacks();

    // Генерируем fallback текстуру табло если PNG не загрузился
    this.generateScoreboardFallback();

    // ✅ КРИТИЧНО ВАЖНО: ПРИНУДИТЕЛЬНО ОТКЛЮЧАЕМ СГЛАЖИВАНИЕ ДЛЯ ВСЕХ ТЕКСТУР
    const textureKeys = this.textures.getTextureKeys();
    textureKeys.forEach(key => {
      const texture = this.textures.get(key);
      if (texture) {
        texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    });

    console.log('%c[BootScene] ✨ PIXEL-PERFECT MODE ACTIVATED — все текстуры в NEAREST', 'color: #00ff00; font-weight: bold; font-size: 14px;');

    const data = playerData.get();

    // Проверяем, выбрана ли фракция
    if (!data.selectedFaction) {
      // Новый игрок - показываем выбор фракции
      this.scene.start('FactionSelectScene');
    } else if (!data.isProfileSetupComplete) {
      this.scene.start('ProfileSetupScene');
    } else {
      this.scene.start('MainMenuScene');
    }
  }

  /**
   * ✅ НОВОЕ: Проверка загрузки мячей
   */
  private verifyBallAssets(): void {
    const ballIds = ['ball_plasma', 'ball_core', 'ball_quantum'];
    
    ballIds.forEach(id => {
      const exists = this.textures.exists(id);
      if (exists) {
        console.log(`✅ [BootScene] Ball loaded: ${id}`);
      } else {
        console.warn(`⚠️ [BootScene] Ball MISSING: ${id} (will use fallback)`);
      }
    });
  }

  /**
   * Проверяет, загрузились ли ассеты арен
   */
  private verifyArenaAssets(): void {
    for (const factionId of FACTION_IDS) {
      const arena = FACTION_ARENAS[factionId];
      const exists = this.textures.exists(arena.assetKey);
      
      if (exists) {
        console.log(`✅ [BootScene] Arena loaded: ${arena.name} (${arena.assetKey})`);
      } else {
        console.warn(`⚠️ [BootScene] Arena MISSING: ${arena.name} (will generate fallback)`);
      }
    }
  }

  /**
   * Генерирует fallback текстуры для арен, если PNG не загрузились
   */
  private generateArenaFallbacks(): void {
    for (const factionId of FACTION_IDS) {
      const arena = FACTION_ARENAS[factionId];
      
      if (this.textures.exists(arena.assetKey)) continue;
      
      console.log(`[BootScene] Generating fallback arena: ${arena.name}`);
      
      const width = 1080;
      const height = 1920;
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      
      // Базовый темный градиент
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      const baseColor = this.colorToRgb(arena.ambientColor);
      const lighterColor = this.lightenColor(baseColor, 0.15);
      const darkerColor = this.darkenColorRgb(baseColor, 0.4);
      
      gradient.addColorStop(0, lighterColor);
      gradient.addColorStop(0.5, baseColor);
      gradient.addColorStop(1, darkerColor);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
      // Текстурные линии (сетка) - уникальный паттерн для каждой фракции
      this.drawArenaPattern(ctx, arena, width, height);
      
      // Центральный круг (яркий)
      ctx.strokeStyle = this.colorToRgba(arena.lineColor, 0.4);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, 200, 0, Math.PI * 2);
      ctx.stroke();
      
      // Внешнее свечение центра
      const glowGradient = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, 300
      );
      glowGradient.addColorStop(0, this.colorToRgba(arena.lineColor, 0.15));
      glowGradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, width, height);
      
      // Виньетка по краям
      const vignetteGradient = ctx.createRadialGradient(
        width / 2, height / 2, Math.min(width, height) * 0.3,
        width / 2, height / 2, Math.max(width, height) * 0.8
      );
      vignetteGradient.addColorStop(0, 'rgba(0,0,0,0)');
      vignetteGradient.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = vignetteGradient;
      ctx.fillRect(0, 0, width, height);
      
      this.textures.addCanvas(arena.assetKey, canvas);
    }
  }

  /**
   * Рисует уникальный паттерн для каждой фракции
   */
  private drawArenaPattern(ctx: CanvasRenderingContext2D, arena: FactionArena, width: number, height: number): void {
    const lineColor = this.colorToRgba(arena.lineColor, 0.12);
    const accentColor = this.colorToRgba(arena.lineColor, 0.25);
    
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    
    switch (arena.style) {
      case 'neon':
        // Гексагональная сетка для Cyborg
        this.drawHexGrid(ctx, width, height, 80, lineColor);
        break;
        
      case 'industrial':
        // Квадратная сетка с заклёпками для Magma
        this.drawIndustrialGrid(ctx, width, height, 100, lineColor, accentColor);
        break;
        
      case 'carbon':
        // Диагональные линии для Void
        this.drawDiagonalGrid(ctx, width, height, 60, lineColor);
        break;
        
      case 'organic':
        // Соты/клетки для Insect
        this.drawOrganicPattern(ctx, width, height, 70, lineColor, accentColor);
        break;
        
      default:
        // Простая квадратная сетка
        this.drawSimpleGrid(ctx, width, height, 100, lineColor);
    }
  }

  private drawHexGrid(ctx: CanvasRenderingContext2D, width: number, height: number, size: number, color: string): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    
    const h = size * Math.sqrt(3);
    const cols = Math.ceil(width / (size * 1.5)) + 2;
    const rows = Math.ceil(height / h) + 2;
    
    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const x = col * size * 1.5;
        const y = row * h + (col % 2 ? h / 2 : 0);
        
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i;
          const px = x + size * Math.cos(angle);
          const py = y + size * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  private drawIndustrialGrid(ctx: CanvasRenderingContext2D, width: number, height: number, size: number, lineColor: string, accentColor: string): void {
    // Основная сетка
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    
    for (let y = 0; y < height; y += size) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    for (let x = 0; x < width; x += size) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // "Заклёпки" на пересечениях
    ctx.fillStyle = accentColor;
    for (let y = 0; y < height; y += size) {
      for (let x = 0; x < width; x += size) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawDiagonalGrid(ctx: CanvasRenderingContext2D, width: number, height: number, size: number, color: string): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    
    // Диагонали в одну сторону
    for (let i = -height; i < width + height; i += size) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + height, height);
      ctx.stroke();
    }
    
    // Диагонали в другую сторону
    for (let i = -height; i < width + height; i += size) {
      ctx.beginPath();
      ctx.moveTo(i + height, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
  }

  private drawOrganicPattern(ctx: CanvasRenderingContext2D, width: number, height: number, size: number, lineColor: string, accentColor: string): void {
    // Случайные "клетки" как в улье
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    
    const cells: { x: number; y: number; r: number }[] = [];
    const count = Math.floor((width * height) / (size * size * 4));
    
    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = size * 0.3 + Math.random() * size * 0.4;
      
      // Проверяем пересечение
      let valid = true;
      for (const cell of cells) {
        const dist = Math.sqrt((x - cell.x) ** 2 + (y - cell.y) ** 2);
        if (dist < cell.r + r - 10) {
          valid = false;
          break;
        }
      }
      
      if (valid) {
        cells.push({ x, y, r });
        
        // Рисуем неровный круг
        ctx.beginPath();
        const points = 8 + Math.floor(Math.random() * 4);
        for (let j = 0; j <= points; j++) {
          const angle = (j / points) * Math.PI * 2;
          const variation = 0.8 + Math.random() * 0.4;
          const px = x + r * variation * Math.cos(angle);
          const py = y + r * variation * Math.sin(angle);
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        
        // Внутреннее свечение
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, accentColor);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    }
  }

  private drawSimpleGrid(ctx: CanvasRenderingContext2D, width: number, height: number, size: number, color: string): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    for (let y = 0; y < height; y += size) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    for (let x = 0; x < width; x += size) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }

  /**
   * Генерирует fallback текстуру табло если PNG не загрузился
   */
  private generateScoreboardFallback(): void {
    if (this.textures.exists('ui_scoreboard')) {
      console.log('✅ [BootScene] ui_scoreboard.png loaded');
      return;
    }
    
    console.log('[BootScene] Generating fallback scoreboard texture');
    
    const width = 600;
    const height = 100;
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    // Прозрачный фон
    ctx.clearRect(0, 0, width, height);
    
    // Основная форма - скруглённый прямоугольник
    const cornerRadius = 24;
    
    // Полупрозрачный белый фон (будет tint'иться)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, cornerRadius);
    ctx.fill();
    
    // Внутренняя тёмная область
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(4, 4, width - 8, height - 8, cornerRadius - 2);
    ctx.fill();
    
    // Светлая рамка
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(2, 2, width - 4, height - 4, cornerRadius - 1);
    ctx.stroke();
    
    // Tech-углы
    const cornerSize = 20;
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
    ctx.lineWidth = 3;
    
    // Верхний левый
    ctx.beginPath();
    ctx.moveTo(10, cornerSize + 10);
    ctx.lineTo(10, 10);
    ctx.lineTo(cornerSize + 10, 10);
    ctx.stroke();
    
    // Верхний правый
    ctx.beginPath();
    ctx.moveTo(width - cornerSize - 10, 10);
    ctx.lineTo(width - 10, 10);
    ctx.lineTo(width - 10, cornerSize + 10);
    ctx.stroke();
    
    // Нижний левый
    ctx.beginPath();
    ctx.moveTo(10, height - cornerSize - 10);
    ctx.lineTo(10, height - 10);
    ctx.lineTo(cornerSize + 10, height - 10);
    ctx.stroke();
    
    // Нижний правый
    ctx.beginPath();
    ctx.moveTo(width - cornerSize - 10, height - 10);
    ctx.lineTo(width - 10, height - 10);
    ctx.lineTo(width - 10, height - cornerSize - 10);
    ctx.stroke();
    
    // Центральная разделительная линия
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2, 20);
    ctx.lineTo(width / 2, height - 20);
    ctx.stroke();
    
    // Декоративные точки по бокам
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    [80, 520].forEach(x => {
      ctx.beginPath();
      ctx.arc(x, height / 2, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    
    this.textures.addCanvas('ui_scoreboard', canvas);
    console.log('[BootScene] Scoreboard fallback texture generated');
  }

  private colorToRgb(color: number): string {
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    return `rgb(${r},${g},${b})`;
  }

  private colorToRgba(color: number, alpha: number): string {
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  private lightenColor(rgb: string, factor: number): string {
    const match = rgb.match(/\d+/g);
    if (!match) return rgb;
    
    const r = Math.min(255, parseInt(match[0]) + Math.floor(factor * 100));
    const g = Math.min(255, parseInt(match[1]) + Math.floor(factor * 100));
    const b = Math.min(255, parseInt(match[2]) + Math.floor(factor * 100));
    
    return `rgb(${r},${g},${b})`;
  }

  private darkenColorRgb(rgb: string, factor: number): string {
    const match = rgb.match(/\d+/g);
    if (!match) return rgb;
    
    const r = Math.max(0, parseInt(match[0]) - Math.floor(factor * 100));
    const g = Math.max(0, parseInt(match[1]) - Math.floor(factor * 100));
    const b = Math.max(0, parseInt(match[2]) - Math.floor(factor * 100));
    
    return `rgb(${r},${g},${b})`;
  }

  /**
   * Генерирует МЕТАЛЛИЧЕСКИЙ ОБОДОК с объёмом (fallback если PNG нет)
   */
  private generateMetalRingTexture(): void {
    const size = 256;
    const canvas = this.textures.createCanvas('metal_ring', size, size);
    const ctx = canvas.getContext();
    const cx = size / 2;
    const cy = size / 2;
    
    ctx.clearRect(0, 0, size, size);

    // === ВНЕШНИЙ КРАЙ (тёмная тень) ===
    ctx.beginPath();
    ctx.arc(cx, cy, 124, 0, Math.PI * 2);
    ctx.arc(cx, cy, 108, 0, Math.PI * 2, true);
    const outerGrad = ctx.createRadialGradient(cx, cy, 108, cx, cy, 124);
    outerGrad.addColorStop(0, '#555555');
    outerGrad.addColorStop(0.5, '#888888');
    outerGrad.addColorStop(1, '#333333');
    ctx.fillStyle = outerGrad;
    ctx.fill();

    // === СРЕДНЯЯ ЧАСТЬ (светлый металл) ===
    ctx.beginPath();
    ctx.arc(cx, cy, 118, 0, Math.PI * 2);
    ctx.arc(cx, cy, 112, 0, Math.PI * 2, true);
    const midGrad = ctx.createLinearGradient(cx - 120, cy - 120, cx + 120, cy + 120);
    midGrad.addColorStop(0, '#d0d0d0');
    midGrad.addColorStop(0.3, '#ffffff');
    midGrad.addColorStop(0.5, '#e8e8e8');
    midGrad.addColorStop(0.7, '#c0c0c0');
    midGrad.addColorStop(1, '#a0a0a0');
    ctx.fillStyle = midGrad;
    ctx.fill();

    // === ВНУТРЕННИЙ КРАЙ (серебристый) ===
    ctx.beginPath();
    ctx.arc(cx, cy, 112, 0, Math.PI * 2);
    ctx.arc(cx, cy, 108, 0, Math.PI * 2, true);
    ctx.fillStyle = '#cccccc';
    ctx.fill();

    canvas.refresh();
    console.log('[BootScene] metal_ring fallback texture generated');
  }

  /**
   * Проверяет, загрузились ли общие ассеты для юнитов
   */
  private verifyCommonAssets(): void {
    // Металлическое кольцо
    if (this.textures.exists('metal_ring')) {
      console.log('✅ [BootScene] metal_ring.png loaded');
    } else {
      console.warn('⚠️ [BootScene] metal_ring.png MISSING (will use fallback)');
    }

    // Overlay освещения (опционально)
    if (this.textures.exists('overlay_lighting')) {
      console.log('✅ [BootScene] overlay_lighting.png loaded');
    } else {
      console.warn('⚠️ [BootScene] overlay_lighting.png MISSING (optional, not critical)');
    }
  }

  /**
   * Проверяет, загрузились ли ассеты юнитов
   */
  private verifyUnitAssets(): void {
    UNITS_CATALOG.forEach((unit) => {
      const exists = this.textures.exists(unit.assetKey);
      
      if (exists) {
        console.log(`✅ [BootScene] Unit loaded: ${unit.assetKey}`);
      } else {
        console.warn(`⚠️ [BootScene] Unit MISSING: ${unit.assetKey} (will use fallback)`);
      }
    });
  }

  /**
   * Проверяет, загрузились ли ассеты фракций
   */
  private verifyFactionAssets(): void {
    for (const factionId of FACTION_IDS) {
      const faction = FACTIONS[factionId];
      const exists = this.textures.exists(faction.assetKey);
      
      if (exists) {
        console.log(`✅ [BootScene] Faction token loaded: ${faction.assetKey}`);
      } else {
        console.warn(`⚠️ [BootScene] Faction token MISSING: ${faction.assetKey} (will generate fallback)`);
      }
    }
  }

  /**
   * Генерирует fallback текстуры для юнитов, если PNG не загрузился
   */
  private generateUnitFallbacks(): void {
    const size = 256;

    UNITS_CATALOG.forEach((unit) => {
      // Если текстура уже загружена - пропускаем
      if (this.textures.exists(unit.assetKey)) {
        return;
      }

      console.log(`[BootScene] Generating fallback for unit: ${unit.assetKey}`);

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      const cx = size / 2;
      const cy = size / 2;
      const radius = size / 2 - 8;

      // Очищаем
      ctx.clearRect(0, 0, size, size);

      const faction = FACTIONS[unit.factionId];
      const mainColor = '#' + faction.color.toString(16).padStart(6, '0');
      const secColor = '#' + faction.colorSecondary.toString(16).padStart(6, '0');

      // Основной круг с градиентом
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, secColor);
      gradient.addColorStop(0.7, mainColor);
      gradient.addColorStop(1, this.darkenColor(mainColor, 0.3));

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Толстый контур
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Внутренний контур
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 10, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.stroke();

      // Иконка класса в центре
      ctx.font = 'bold 80px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      
      const classIcons: Record<string, string> = {
        balanced: '⚖️',
        tank: '🛡️',
        sniper: '🎯',
        trickster: '✨',
      };
      
      ctx.fillText(classIcons[unit.capClass] || '?', cx, cy);

      // Блик
      ctx.beginPath();
      ctx.ellipse(cx - radius * 0.3, cy - radius * 0.3, radius * 0.25, radius * 0.15, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();

      this.textures.addCanvas(unit.assetKey, canvas);
    });
  }

  /**
   * Генерирует fallback текстуры для фракций, если PNG не загрузился
   */
  private generateFactionFallbacks(): void {
    const size = 256;

    for (const factionId of FACTION_IDS) {
      const faction = FACTIONS[factionId];

      // Если текстура уже загружена - пропускаем
      if (this.textures.exists(faction.assetKey)) {
        continue;
      }

      console.log(`[BootScene] Generating fallback for faction: ${faction.assetKey}`);

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      const cx = size / 2;
      const cy = size / 2;
      const radius = size / 2 - 8;

      // Очищаем
      ctx.clearRect(0, 0, size, size);

      // Основной круг с градиентом
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      const mainColor = '#' + faction.color.toString(16).padStart(6, '0');
      const secColor = '#' + faction.colorSecondary.toString(16).padStart(6, '0');

      gradient.addColorStop(0, secColor);
      gradient.addColorStop(0.7, mainColor);
      gradient.addColorStop(1, this.darkenColor(mainColor, 0.3));

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Толстый контур
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Внутренний контур
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 10, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.stroke();

      // Символ фракции в центре
      ctx.font = 'bold 80px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      
      const symbols: Record<FactionId, string> = {
        magma: '🔥',
        cyborg: '⚡',
        void: '👁',
        insect: '🦠',
      };
      
      ctx.fillText(symbols[factionId] || '?', cx, cy);

      // Блик
      ctx.beginPath();
      ctx.ellipse(cx - radius * 0.3, cy - radius * 0.3, radius * 0.25, radius * 0.15, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();

      this.textures.addCanvas(faction.assetKey, canvas);
    }
  }

  /**
   * Генерирует текстуры частиц для эффектов каждой фракции
   */
  private generateFactionParticleTextures(): void {
    // p_spark - искры для Magma
    this.generateSparkTexture();
    
    // p_smoke - дым для Void
    this.generateSmokeTexture();
    
    // p_drip - капли для Insect
    this.generateDripTexture();
    
    // p_glitch - глитч для Cyborg
    this.generateGlitchTexture();

    console.log('[BootScene] Faction particle textures generated');
  }

  /**
   * Искры (Magma Brutes)
   */
  private generateSparkTexture(): void {
    if (this.textures.exists('p_spark')) return;

    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const cx = size / 2;
    const cy = size / 2;

    // Яркая точка с лучами
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 200, 100, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // Добавляем лучи
    ctx.strokeStyle = 'rgba(255, 200, 100, 0.6)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * size / 2, cy + Math.sin(angle) * size / 2);
      ctx.stroke();
    }

    this.textures.addCanvas('p_spark', canvas);
  }

  /**
   * Дым (Void Walkers)
   */
  private generateSmokeTexture(): void {
    if (this.textures.exists('p_smoke')) return;

    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const cx = size / 2;
    const cy = size / 2;

    // Мягкое облако
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
    gradient.addColorStop(0, 'rgba(200, 150, 255, 0.8)');
    gradient.addColorStop(0.3, 'rgba(150, 100, 200, 0.5)');
    gradient.addColorStop(0.6, 'rgba(100, 50, 150, 0.3)');
    gradient.addColorStop(1, 'rgba(50, 0, 100, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Добавляем неровности
    for (let i = 0; i < 5; i++) {
      const ox = cx + (Math.random() - 0.5) * size * 0.4;
      const oy = cy + (Math.random() - 0.5) * size * 0.4;
      const r = size * 0.15 + Math.random() * size * 0.1;
      
      const g2 = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
      g2.addColorStop(0, 'rgba(200, 150, 255, 0.4)');
      g2.addColorStop(1, 'rgba(100, 50, 150, 0)');
      
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    this.textures.addCanvas('p_smoke', canvas);
  }

  /**
   * Капли слизи (Xeno Swarm)
   */
  private generateDripTexture(): void {
    if (this.textures.exists('p_drip')) return;

    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const cx = size / 2;
    const cy = size / 2;

    // Капля
    const gradient = ctx.createRadialGradient(cx - 2, cy - 2, 0, cx, cy, size / 2);
    gradient.addColorStop(0, 'rgba(150, 255, 100, 1)');
    gradient.addColorStop(0.3, 'rgba(80, 255, 50, 0.9)');
    gradient.addColorStop(0.7, 'rgba(50, 200, 30, 0.6)');
    gradient.addColorStop(1, 'rgba(30, 150, 20, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    // Блик
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.ellipse(cx - 3, cy - 3, 4, 3, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    this.textures.addCanvas('p_drip', canvas);
  }

  /**
   * Глитч-эффект (Terran Cyborgs)
   */
  private generateGlitchTexture(): void {
    if (this.textures.exists('p_glitch')) return;

    const size = 16;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Пиксельный квадрат
    ctx.fillStyle = 'rgba(0, 242, 255, 0.9)';
    ctx.fillRect(2, 2, size - 4, size - 4);

    // Линии глитча
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(0, size / 2 - 1, size, 2);
    
    ctx.fillStyle = 'rgba(0, 136, 255, 0.6)';
    ctx.fillRect(size / 2 - 1, 0, 2, size);

    this.textures.addCanvas('p_glitch', canvas);
  }

  /**
   * Затемняет цвет
   */
  private darkenColor(hex: string, factor: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    const nr = Math.floor(r * (1 - factor));
    const ng = Math.floor(g * (1 - factor));
    const nb = Math.floor(b * (1 - factor));

    return `rgb(${nr},${ng},${nb})`;
  }

  /**
   * Генерирует ЯРКУЮ текстуру ауры - простое цветное кольцо
   */
  private generateAuraTexture(): void {
    const size = 128;
    const center = size / 2;
    
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    // Очищаем
    ctx.clearRect(0, 0, size, size);
    
    // Рисуем яркое кольцо с градиентом
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    
    // Центр полностью прозрачный
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0)');
    
    // Начало свечения
    gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.3)');
    
    // Яркое кольцо
    gradient.addColorStop(0.55, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.65, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.75, 'rgba(255, 255, 255, 0.9)');
    
    // Внешний fade
    gradient.addColorStop(0.85, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(0.95, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // Удаляем старую если есть
    if (this.textures.exists('aura_glow')) {
      this.textures.remove('aura_glow');
    }
    this.textures.addCanvas('aura_glow', canvas);
    
    console.log('[BootScene] Aura texture generated');
    
    // Текстура для выбранной фишки
    this.generateSelectedRingTexture();
  }

  private generateSelectedRingTexture(): void {
    const size = 128;
    const center = size / 2;
    
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    ctx.clearRect(0, 0, size, size);
    
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.70, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.78, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(0.83, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.88, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(0.95, 'rgba(255, 255, 255, 0.1)');
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    if (this.textures.exists('aura_selected_ring')) {
      this.textures.remove('aura_selected_ring');
    }
    this.textures.addCanvas('aura_selected_ring', canvas);
  }
}