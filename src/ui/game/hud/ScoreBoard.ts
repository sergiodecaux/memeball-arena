// src/ui/game/hud/ScoreBoard.ts
// Компонент отображения счёта с поддержкой разных стилей

import Phaser from 'phaser';
import { getFonts, getColors, hexToString } from '../../../config/themes';
import { FactionId, FactionArena, FACTIONS } from '../../../constants/gameConstants';
import { getUIFactionByGameFaction } from '../../../constants/factionUiConfig';

// ========== ТИПЫ ==========

export type ScoreBoardStyle = 'faction' | 'neon' | 'industrial' | 'carbon' | 'generic';

export interface ScoreBoardConfig {
  /** Стиль отображения */
  style: ScoreBoardStyle;
  
  /** Для PvP режима */
  isPvP?: boolean;
  
  /** Имя оппонента (для PvP) */
  opponentName?: string;
  
  /** Режим против AI */
  isAIMode?: boolean;
  
  /** Фракция игрока (для faction стиля) */
  playerFaction?: FactionId;
  
  /** Фракция оппонента (для faction стиля) */
  opponentFaction?: FactionId;
  
  /** Арена (для faction стиля) */
  arena?: FactionArena;
}

// ========== КОМПОНЕНТ ==========

export class ScoreBoard {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private config: ScoreBoardConfig;
  
  private scoreText!: Phaser.GameObjects.Text;
  private currentScore = { player1: 0, player2: 0 };

  constructor(scene: Phaser.Scene, x: number, y: number, config: ScoreBoardConfig) {
    this.scene = scene;
    this.config = config;
    
    this.container = scene.add.container(x, y).setDepth(99);
    this.render();
  }

  // ========== РЕНДЕРИНГ ==========

  private render(): void {
    const fonts = getFonts();
    
    switch (this.config.style) {
      case 'faction':
        this.renderFactionStyle(fonts);
        break;
      case 'neon':
        this.renderNeonStyle(fonts);
        break;
      case 'industrial':
        this.renderIndustrialStyle(fonts);
        break;
      case 'carbon':
        this.renderCarbonStyle(fonts);
        break;
      default:
        this.renderGenericStyle(fonts);
    }
  }

  private renderFactionStyle(fonts: ReturnType<typeof getFonts>): void {
    const { arena, playerFaction, opponentFaction, isAIMode } = this.config;
    
    if (!arena || !playerFaction || !opponentFaction) {
      this.renderGenericStyle(fonts);
      return;
    }

    const playerCfg = FACTIONS[playerFaction];
    const opponentCfg = FACTIONS[opponentFaction];
    const arenaAccent = arena.lineColor;

    // Фон табло
    this.renderScoreboardBackground(arenaAccent);

    // Левая сторона (игрок)
    this.renderPlayerSide(-100, playerFaction, playerCfg.color, 'YOU', 'left');

    // Правая сторона (оппонент)
    const rightLabel = isAIMode ? 'BOT' : 'OPP';
    this.renderPlayerSide(100, opponentFaction, opponentCfg.color, rightLabel, 'right');

    // Разделитель
    this.renderDivider(arenaAccent);

    // Счёт
    this.scoreText = this.scene.add
      .text(0, 0, '0 : 0', {
        fontSize: '32px',
        fontFamily: fonts.tech,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.container.add(this.scoreText);

    // Название арены
    this.scene.add
      .text(0, 38, arena.name.toUpperCase(), {
        fontSize: '9px',
        fontFamily: fonts.tech,
        color: Phaser.Display.Color.IntegerToColor(arenaAccent).rgba,
      })
      .setOrigin(0.5)
      .setAlpha(0.7);
  }

  private renderScoreboardBackground(accentColor: number): void {
    if (this.scene.textures.exists('ui_scoreboard')) {
      const scoreboard = this.scene.add.image(0, 0, 'ui_scoreboard');
      scoreboard.setTint(accentColor);
      scoreboard.setScale(0.5);
      this.container.add(scoreboard);
    } else {
      const bg = this.scene.add.graphics();
      bg.fillStyle(0x000000, 0.85);
      bg.fillRoundedRect(-150, -30, 300, 60, 20);
      bg.lineStyle(3, accentColor, 0.9);
      bg.strokeRoundedRect(-150, -30, 300, 60, 20);
      this.container.add(bg);
    }
  }

  private renderPlayerSide(
    x: number,
    factionId: FactionId,
    color: number,
    label: string,
    align: 'left' | 'right'
  ): void {
    const fonts = getFonts();
    
    // Свечение
    const glow = this.scene.add.circle(x, 0, 18, color, 0.35);
    this.container.add(glow);

    // Круг с рамкой
    const circle = this.scene.add.circle(x, 0, 14, 0x000000, 0.85);
    circle.setStrokeStyle(2, color, 1);
    this.container.add(circle);

    // Иконка фракции
    this.renderFactionIcon(x, factionId);

    // Лейбл
    const labelX = align === 'left' ? x + 30 : x - 30;
    const labelText = this.scene.add
      .text(labelX, 0, label, {
        fontSize: '11px',
        fontFamily: fonts.tech,
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
      })
      .setOrigin(align === 'left' ? 0 : 1, 0.5);
    this.container.add(labelText);
  }

  private renderFactionIcon(x: number, factionId: FactionId): void {
    const uiId = getUIFactionByGameFaction(factionId);
    const iconKey = `icon_faction_${uiId}`;

    if (this.scene.textures.exists(iconKey)) {
      const icon = this.scene.add
        .image(x, 0, iconKey)
        .setDisplaySize(22, 22);
      this.container.add(icon);
    } else {
      const fallbackIcons: Record<FactionId, string> = {
        magma: '🔥',
        cyborg: '🤖',
        void: '🌀',
        insect: '🐛',
      };
      const fallback = this.scene.add
        .text(x, 0, fallbackIcons[factionId], { fontSize: '16px' })
        .setOrigin(0.5);
      this.container.add(fallback);
    }
  }

  private renderDivider(color: number): void {
    const divider = this.scene.add.graphics();
    divider.lineStyle(1, color, 0.6);
    divider.lineBetween(0, -18, 0, 18);
    this.container.add(divider);
  }

  private renderNeonStyle(fonts: ReturnType<typeof getFonts>): void {
    const accent = 0x00f3ff;
    const { leftLabel, rightLabel } = this.getLabels();

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRoundedRect(-160, -24, 320, 48, 18);
    bg.lineStyle(2, accent, 1);
    bg.strokeRoundedRect(-160, -24, 320, 48, 18);
    this.container.add(bg);

    this.container.add(
      this.scene.add
        .text(-140, 0, leftLabel, {
          fontSize: '14px',
          fontFamily: fonts.tech,
          color: '#00f3ff',
        })
        .setOrigin(0, 0.5)
    );

    this.container.add(
      this.scene.add
        .text(140, 0, rightLabel, {
          fontSize: '14px',
          fontFamily: fonts.tech,
          color: '#00f3ff',
        })
        .setOrigin(1, 0.5)
    );

    this.scoreText = this.scene.add
      .text(0, 0, '0 : 0', {
        fontSize: '32px',
        fontFamily: fonts.tech,
        color: '#ffffff',
        stroke: '#00f3ff',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.container.add(this.scoreText);
  }

  private renderIndustrialStyle(fonts: ReturnType<typeof getFonts>): void {
    const accent = 0xffcc00;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x111111, 0.95);
    bg.fillRoundedRect(-140, -24, 280, 48, 10);
    bg.lineStyle(3, accent, 1);
    bg.strokeRoundedRect(-140, -24, 280, 48, 10);
    this.container.add(bg);

    this.container.add(
      this.scene.add.text(-105, 0, '⚡', { fontSize: '20px' }).setOrigin(0.5)
    );
    this.container.add(
      this.scene.add.text(105, 0, '☢️', { fontSize: '20px' }).setOrigin(0.5)
    );

    this.scoreText = this.scene.add
      .text(0, 0, '0 - 0', {
        fontSize: '30px',
        fontFamily: fonts.tech,
        color: '#ffcc00',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.container.add(this.scoreText);
  }

  private renderCarbonStyle(fonts: ReturnType<typeof getFonts>): void {
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRoundedRect(-150, -22, 300, 44, 22);
    bg.lineStyle(1, 0xffffff, 0.25);
    bg.strokeRoundedRect(-150, -22, 300, 44, 22);
    this.container.add(bg);

    // Левая сторона
    this.container.add(this.scene.add.circle(-112, 0, 10, 0x00c6ff, 1));
    this.container.add(
      this.scene.add
        .text(-95, 0, 'PLAYER', {
          fontSize: '12px',
          fontFamily: fonts.tech,
          color: '#00c6ff',
        })
        .setOrigin(0, 0.5)
    );

    // Правая сторона
    this.container.add(this.scene.add.circle(112, 0, 10, 0xff416c, 1));
    this.container.add(
      this.scene.add
        .text(95, 0, 'ENEMY', {
          fontSize: '12px',
          fontFamily: fonts.tech,
          color: '#ff416c',
        })
        .setOrigin(1, 0.5)
    );

    this.scoreText = this.scene.add
      .text(0, 0, '0 - 0', {
        fontSize: '28px',
        fontFamily: fonts.tech,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.container.add(this.scoreText);
  }

  private renderGenericStyle(fonts: ReturnType<typeof getFonts>): void {
    const colors = getColors();

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.5);
    bg.fillRoundedRect(-60, -22, 120, 44, 22);
    bg.lineStyle(1, colors.glassBorder, 0.2);
    bg.strokeRoundedRect(-60, -22, 120, 44, 22);
    this.container.add(bg);

    this.scoreText = this.scene.add
      .text(0, 0, '0 : 0', {
        fontSize: '28px',
        fontFamily: fonts.tech,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.container.add(this.scoreText);
  }

  // ========== ХЕЛПЕРЫ ==========

  private getLabels(): { leftLabel: string; rightLabel: string } {
    const leftLabel = 'YOU';
    let rightLabel: string;

    if (this.config.isPvP) {
      rightLabel = this.config.opponentName || 'OPP';
    } else {
      rightLabel = this.config.isAIMode ? 'BOT' : 'P2';
    }

    return { leftLabel, rightLabel };
  }

  // ========== PUBLIC API ==========

  updateScore(player1: number, player2: number): void {
    this.currentScore = { player1, player2 };
    
    const separator = this.config.style === 'industrial' || this.config.style === 'carbon' 
      ? ' - ' 
      : ' : ';
    
    this.scoreText.setText(`${player1}${separator}${player2}`);
    
    // Анимация
    this.scene.tweens.add({
      targets: this.scoreText,
      scale: { from: 1.3, to: 1 },
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  getScore(): { player1: number; player2: number } {
    return { ...this.currentScore };
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  destroy(): void {
    this.container.destroy();
  }
}