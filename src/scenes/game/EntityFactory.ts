// src/scenes/game/EntityFactory.ts

import Phaser from 'phaser';
import { Ball } from '../../entities/Ball';
import { Cap } from '../../entities/Cap';
import { Unit } from '../../entities/Unit';
import { GameUnit, StartPositions } from './types';
import { PlayerNumber, FieldBounds } from '../../types';
import { 
  STARTING_POSITIONS, 
  BALL, 
  CapClass, 
  FactionId 
} from '../../constants/gameConstants';
import { Formation, playerData } from '../../data/PlayerData';
import { GameStartData, PvPPlayer } from '../../managers/MultiplayerManager';

export interface EntityFactoryConfig {
  scene: Phaser.Scene;
  fieldBounds: FieldBounds;
  fieldScale: number;
  isPvPMode: boolean;
  pvpData?: GameStartData;
  isHost: boolean;
  useFactions: boolean;
  playerFaction: FactionId;
  opponentFaction: FactionId;
  formation: Formation;
}

export class EntityFactory {
  private config: EntityFactoryConfig;

  constructor(config: EntityFactoryConfig) {
    this.config = config;
  }

  createBall(): { ball: Ball; startPosition: { x: number; y: number } } {
    const pos = this.relativeToAbsolute(
      STARTING_POSITIONS.BALL.x,
      STARTING_POSITIONS.BALL.y
    );
    
    const ballSkinId = this.config.isPvPMode
      ? this.config.pvpData?.ballSkin
      : undefined;

    const ball = new Ball(
      this.config.scene,
      pos.x,
      pos.y,
      BALL.RADIUS * this.config.fieldScale,
      ballSkinId
    );

    return { ball, startPosition: pos };
  }

  createCaps(): { caps: GameUnit[]; startPositions: { x: number; y: number }[] } {
    Cap.resetCounters();
    Unit.resetCounters();

    if (this.config.isPvPMode) {
      return this.createPvPCaps();
    } else if (this.config.useFactions) {
      return this.createFactionCaps();
    } else {
      return this.createOfflineCaps();
    }
  }

  private createFactionCaps(): { caps: GameUnit[]; startPositions: { x: number; y: number }[] } {
    const caps: GameUnit[] = [];
    const startPositions: { x: number; y: number }[] = [];
    const unitClasses: CapClass[] = ['sniper', 'balanced', 'tank'];
    const formation = this.config.formation;

    // Player units
    formation.slots.forEach((slot, i) => {
      const absPos = this.relativeToAbsolute(slot.x, slot.y);
      const unitClass = unitClasses[i] || 'balanced';

      const unit = new Unit(
        this.config.scene,
        absPos.x,
        absPos.y,
        1 as PlayerNumber,
        `p1_unit_${i}`,
        this.config.fieldScale,
        {
          factionId: this.config.playerFaction,
          capClass: unitClass,
          applyFactionStats: true,
          applyUpgrades: true,
        }
      );

      caps.push(unit as any);
      startPositions.push(absPos);
    });

    // Opponent units
    formation.slots.forEach((slot, i) => {
      const absPos = this.relativeToAbsolute(slot.x, 1 - slot.y);
      const unitClass = unitClasses[i] || 'balanced';

      const unit = new Unit(
        this.config.scene,
        absPos.x,
        absPos.y,
        2 as PlayerNumber,
        `p2_unit_${i}`,
        this.config.fieldScale,
        {
          factionId: this.config.opponentFaction,
          capClass: unitClass,
          applyFactionStats: true,
          applyUpgrades: false,
        }
      );

      caps.push(unit as any);
      startPositions.push(absPos);
    });

    console.log(`[EntityFactory] Created ${caps.length} faction units`);
    return { caps, startPositions };
  }

  private createPvPCaps(): { caps: GameUnit[]; startPositions: { x: number; y: number }[] } {
    const players = this.config.pvpData!.players;
    const hostPlayer = players.find((p) => p.playerIndex === 0)!;
    const guestPlayer = players.find((p) => p.playerIndex === 1)!;

    const hostFormation = hostPlayer.formation || playerData.getSelectedFormation();
    const guestFormation = guestPlayer.formation || hostFormation;

    const hostFaction = (hostPlayer as any).factionId as FactionId | undefined;
    const guestFaction = (guestPlayer as any).factionId as FactionId | undefined;
    const pvpUseFactions = !!(hostFaction && guestFaction);

    if (pvpUseFactions) {
      return this.createPvPFactionCaps(
        hostFormation,
        guestFormation,
        hostFaction!,
        guestFaction!
      );
    } else {
      return this.createPvPMemeCaps(
        hostPlayer,
        guestPlayer,
        hostFormation,
        guestFormation
      );
    }
  }

  private createPvPFactionCaps(
    hostFormation: Formation,
    guestFormation: Formation,
    hostFaction: FactionId,
    guestFaction: FactionId
  ): { caps: GameUnit[]; startPositions: { x: number; y: number }[] } {
    const caps: GameUnit[] = [];
    const startPositions: { x: number; y: number }[] = [];
    const unitClasses: CapClass[] = ['sniper', 'balanced', 'tank'];

    // Host units
    const hostSlots = hostFormation?.slots || [];
    for (let i = 0; i < 3; i++) {
      const slot = hostSlots[i] || { x: 0.25 + i * 0.25, y: 0.8 };
      const absPos = this.relativeToAbsolute(slot.x, slot.y);
      const unitClass = unitClasses[i] || 'balanced';

      const unit = new Unit(
        this.config.scene,
        absPos.x,
        absPos.y,
        1 as PlayerNumber,
        `host_unit_${i}`,
        this.config.fieldScale,
        {
          factionId: hostFaction,
          capClass: unitClass,
          applyFactionStats: true,
          applyUpgrades: this.config.isHost,
        }
      );
      caps.push(unit as any);
      startPositions.push(absPos);
    }

    // Guest units
    const guestSlots = guestFormation?.slots || hostSlots;
    for (let i = 0; i < 3; i++) {
      const slot = guestSlots[i] || { x: 0.25 + i * 0.25, y: 0.8 };
      const absPos = this.relativeToAbsolute(slot.x, 1 - slot.y);
      const unitClass = unitClasses[i] || 'balanced';

      const unit = new Unit(
        this.config.scene,
        absPos.x,
        absPos.y,
        2 as PlayerNumber,
        `guest_unit_${i}`,
        this.config.fieldScale,
        {
          factionId: guestFaction,
          capClass: unitClass,
          applyFactionStats: true,
          applyUpgrades: !this.config.isHost,
        }
      );
      caps.push(unit as any);
      startPositions.push(absPos);
    }

    return { caps, startPositions };
  }

  private createPvPMemeCaps(
    hostPlayer: PvPPlayer,
    guestPlayer: PvPPlayer,
    hostFormation: Formation,
    guestFormation: Formation
  ): { caps: GameUnit[]; startPositions: { x: number; y: number }[] } {
    const caps: GameUnit[] = [];
    const startPositions: { x: number; y: number }[] = [];

    const hostCapIds = (hostPlayer as any).teamCapIds || [
      'meme_doge',
      'meme_gigachad',
      'meme_doge',
    ];
    const guestCapIds = (guestPlayer as any).teamCapIds || [
      'meme_doge',
      'meme_gigachad',
      'meme_doge',
    ];
    const hostCapUpgrades = (hostPlayer as any).capUpgrades || {};
    const guestCapUpgrades = (guestPlayer as any).capUpgrades || {};

    // Host caps
    const hostSlots = hostFormation?.slots || [];
    for (let i = 0; i < 3; i++) {
      const slot = hostSlots[i] || { x: 0.25 + i * 0.25, y: 0.8 };
      const absPos = this.relativeToAbsolute(slot.x, slot.y);
      const capId = hostCapIds[i] || 'meme_doge';
      const isMyTeam = this.config.isHost;
      const customUpgrades = isMyTeam ? undefined : hostCapUpgrades[capId];

      const cap = new Cap(
        this.config.scene,
        absPos.x,
        absPos.y,
        1 as PlayerNumber,
        `host_${i}`,
        capId,
        this.config.fieldScale,
        { applyUpgrades: isMyTeam, customUpgrades }
      );
      caps.push(cap as any);
      startPositions.push(absPos);
    }

    // Guest caps
    const guestSlots = guestFormation?.slots || hostSlots;
    for (let i = 0; i < 3; i++) {
      const slot = guestSlots[i] || { x: 0.25 + i * 0.25, y: 0.8 };
      const absPos = this.relativeToAbsolute(slot.x, 1 - slot.y);
      const capId = guestCapIds[i] || 'meme_doge';
      const isMyTeam = !this.config.isHost;
      const customUpgrades = isMyTeam ? undefined : guestCapUpgrades[capId];

      const cap = new Cap(
        this.config.scene,
        absPos.x,
        absPos.y,
        2 as PlayerNumber,
        `guest_${i}`,
        capId,
        this.config.fieldScale,
        { applyUpgrades: isMyTeam, customUpgrades }
      );
      caps.push(cap as any);
      startPositions.push(absPos);
    }

    return { caps, startPositions };
  }

  private createOfflineCaps(): { caps: GameUnit[]; startPositions: { x: number; y: number }[] } {
    const caps: GameUnit[] = [];
    const startPositions: { x: number; y: number }[] = [];
    const formation = this.config.formation;
    const teamCapIds = playerData.getTeamCapIds();

    // Player caps
    formation.slots.forEach((slot, i) => {
      const absPos = this.relativeToAbsolute(slot.x, slot.y);
      const capId = teamCapIds[i] || 'meme_doge';

      const cap = new Cap(
        this.config.scene,
        absPos.x,
        absPos.y,
        1 as PlayerNumber,
        `p1_${i}`,
        capId,
        this.config.fieldScale,
        { applyUpgrades: true }
      );
      caps.push(cap as any);
      startPositions.push(absPos);
    });

    // AI caps
    const aiCapIds = ['meme_doge', 'meme_gigachad', 'meme_doge'];
    formation.slots.forEach((slot, i) => {
      const absPos = this.relativeToAbsolute(slot.x, 1 - slot.y);
      const capId = aiCapIds[i] || 'meme_doge';

      const cap = new Cap(
        this.config.scene,
        absPos.x,
        absPos.y,
        2 as PlayerNumber,
        `p2_${i}`,
        capId,
        this.config.fieldScale,
        { applyUpgrades: false }
      );
      caps.push(cap as any);
      startPositions.push(absPos);
    });

    return { caps, startPositions };
  }

  private relativeToAbsolute(relX: number, relY: number): { x: number; y: number } {
    return {
      x: this.config.fieldBounds.left + this.config.fieldBounds.width * relX,
      y: this.config.fieldBounds.top + this.config.fieldBounds.height * relY,
    };
  }
}