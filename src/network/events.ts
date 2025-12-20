// Типы событий сервер -> клиент
export interface ServerEvents {
  connected: {
    playerId: string;
    state: RoomState;
  };
  player_joined: {
    player: Player;
    playerCount: number;
  };
  player_left: {
    playerId: string;
    playerCount: number;
  };
  game_start: {
    currentTurn: string;
    players: Player[];
  };
  opponent_shoot: {
    capId: string;
    force: { x: number; y: number };
  };
  turn_change: {
    currentTurn: string;
  };
  error: {
    message: string;
  };
}

// Типы событий клиент -> сервер
export interface ClientEvents {
  ready: {};
  shoot: {
    capId: string;
    force: { x: number; y: number };
  };
  turn_end: {};
}

// Общие типы
export interface Player {
  id: string;
  name: string;
  ready: boolean;
}

export interface RoomState {
  players: Player[];
  currentTurn: string | null;
  gameStarted: boolean;
}