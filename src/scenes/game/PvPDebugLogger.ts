// src/scenes/game/PvPDebugLogger.ts

import { GameUnit } from './types';

export class PvPDebugLogger {
  private isHost = false;
  private playerRole = 'UNKNOWN';
  private logHistory: string[] = [];
  private maxHistorySize = 100;
  private frameCount = 0;

  init(isHost: boolean, myPlayerIndex: number, myId: string): void {
    this.isHost = isHost;
    this.playerRole = isHost ? '🟢HOST' : '🔵GUEST';
    this.logHistory = [];
    this.frameCount = 0;
    console.log(
      `%c PvP DEBUG - ${this.playerRole}`,
      `color: ${isHost ? '#00ff00' : '#00aaff'}; font-weight: bold;`
    );
    console.log(` Player ID: ${myId}, Index: ${myPlayerIndex}`);
  }

  log(category: string, message: string, data?: any): void {
    const prefix = `[${this.playerRole}][${category}]`;
    this.logHistory.push(`${Date.now()} ${prefix} ${message}`);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }
    if (data !== undefined) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  warn(category: string, message: string, data?: any): void {
    console.warn(`[${this.playerRole}][${category}] ${message}`, data ?? '');
  }

  error(category: string, message: string, data?: any): void {
    console.error(`[${this.playerRole}][${category}] ${message}`, data ?? '');
  }

  logCapsState(caps: GameUnit[]): void {
    console.table(
      caps.map((cap, i) => ({
        idx: i,
        id: cap.id,
        owner: cap.owner,
        x: cap.body.position.x.toFixed(0),
        y: cap.body.position.y.toFixed(0),
      }))
    );
  }

  incrementFrame(): void {
    this.frameCount++;
  }

  getFrameCount(): number {
    return this.frameCount;
  }

  dumpHistory(): void {
    this.logHistory.slice(-30).forEach((e) => console.log(e));
  }

  getIsHost(): boolean {
    return this.isHost;
  }

  getPlayerRole(): string {
    return this.playerRole;
  }
}