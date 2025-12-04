export type Tile = {
  id: string;
  color: "red" | "blue" | "yellow" | "black";
  number: number; // 1-13
  isJoker: boolean;
};

export type Meld = {
  id: string;
  tiles: Tile[]; // valid run or group
};

export type Player = {
  id: string;
  name: string;
  socketId: string;
  rack: Tile[]; // tiles in hand
  board: Meld[]; // player's meld area
  hasInitialMeld: boolean; // passed 30-point threshold
};

export type Game = {
  id: string;
  code: string; // join code
  players: Player[];
  pool: Tile[]; // draw pile
  currentPlayerIndex: number;
  status: "waiting" | "playing" | "finished";
  winnerId: string | null;
};
