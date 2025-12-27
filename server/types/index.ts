export type Tile = {
  id: string;
  color: "red" | "blue" | "yellow" | "black";
  number: number; // 1-13, 0 for jokers
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
  rack: Tile[]; // 14 tiles (15 during turn after drawing)
  lastDroppedTile: Tile | null; // face up, player on right can take it
};

export type Game = {
  id: string;
  code: string; // join code
  players: Player[];
  pool: Tile[]; // draw pile
  currentPlayerIndex: number;
  status: "waiting" | "playing" | "finished" | "draw"; // draw = pool empty, no winner
  winnerId: string | null;
  hasDrawnThisTurn: boolean; // track if current player has drawn
};
