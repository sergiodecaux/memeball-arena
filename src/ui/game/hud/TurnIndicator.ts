// src/ui/game/hud/TurnIndicator.ts
// Компонент индикатора хода

import Phaser from 'phaser';
import { getFonts, getColors, hexToString } from '../../../config/themes';
import { PlayerNumber } from '../../../types';
import { TurnPhase } from '../../../types/match';
import { FactionId, FACTIONS } from '../../../constants/gameConstants';
import { i18n } from '../../../localization/i18n';

export interface TurnIndicatorConfig {
  isPvP?: boolean;
  isAIMode?: boolean;
  opponentName?: string;
  playerFaction?: FactionId;
  opponentFaction?: FactionId;
}

export class TurnIndicator {
  private scene: Phaser.Scene;
  private config: TurnIndicatorConfig;
  
  private turnText: Phaser.GameObjects.Text;
  private stateText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, config: TurnIndicatorConfig) {
    this.scene = scene;
    this.config = config;
    
    const fonts = getFonts();
    const colors = getColors();

    this.turnText = scene.add
      .text(x, y, '', {
        fontSize: '17px',
        fontFamily: fonts.tech,
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setDepth(100);

    this.stateText = scene.add
      .text(x, y + 22, '', {
        fontSize: '12px',
        fontFamily: fonts.primary,
        color: hexToString(colors.uiTextSecondary),
        stroke: '#000000',
        strokeThickness: 1,
      })
      .setOrigin(0.5, 0)
      .setDepth(100);
  }

  // ========== PUBLIC API ==========

  update(player: PlayerNumber, phase: TurnPhase): void {
    const teamColor = this.getTeamColor(player);
    const playerName = this.getPlayerName(player);
    const stateMessage = this.getStateMessage(player, phase);

    this.turnText.setText(playerName).setColor(hexToString(teamColor));
    this.stateText.setText(stateMessage);
  }

  private getTeamColor(player: PlayerNumber): number {
    const colors = getColors();
    const { playerFaction, opponentFaction } = this.config;

    if (playerFaction && opponentFaction) {
      return player === 1
        ? FACTIONS[playerFaction].color
        : FACTIONS[opponentFaction].color;
    }

    return player === 1 ? colors.uiAccent : colors.uiAccentPink;
  }

  private getPlayerName(player: PlayerNumber): string {
    const { isPvP, isAIMode, opponentName } = this.config;

    if (isPvP) {
      return player === 1
        ? '🎯 Your turn'
        : `⏳ ${opponentName || 'Opponent'}'s turn`;
    }

    return player === 1
      ? i18n.t('yourTurn')
      : isAIMode
      ? i18n.t('enemyTurn') + ' 🤖'
      : i18n.t('player2') + "'s Turn";
  }

  private getStateMessage(player: PlayerNumber, phase: TurnPhase): string {
    const { isPvP, isAIMode } = this.config;

    switch (phase) {
      case 'waiting':
        if (isPvP) {
          return player === 1 ? '👆 ' + i18n.t('dragToShoot') : '⏳ Waiting...';
        }
        return player === 1
          ? '👆 ' + i18n.t('dragToShoot')
          : isAIMode
          ? '🤔 ' + i18n.t('aiThinking')
          : '👆 ' + i18n.t('dragToShoot');

      case 'aiming':
        return '🎯 Прицеливание...';

      case 'moving':
        return '⏳ ' + i18n.t('waitingForStop');

      case 'goal':
        return '⚽ ' + i18n.t('goal');

      case 'paused':
        return '⏸️ ' + i18n.t('pause');

      case 'finished':
        return '🏁 Матч завершён';

      default:
        return '';
    }
  }

  setPosition(x: number, y: number): void {
    this.turnText.setPosition(x, y);
    this.stateText.setPosition(x, y + 22);
  }

  destroy(): void {
    this.turnText.destroy();
    this.stateText.destroy();
  }
}