import redis from "../redis/client.js";
import { Game } from "../../types/index.js";

const GAME_KEY_PREFIX = "game:";
const SOCKET_GAME_PREFIX = "socket_game:";

export async function saveGame(game: Game): Promise<void> {
  await redis.set(`${GAME_KEY_PREFIX}${game.code}`, JSON.stringify(game));
}

export async function getGame(code: string): Promise<Game | null> {
  const data = await redis.get(`${GAME_KEY_PREFIX}${code}`);
  return data ? JSON.parse(data) : null;
}

export async function deleteGame(code: string): Promise<void> {
  await redis.del(`${GAME_KEY_PREFIX}${code}`);
}

export function generateGameCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createGame(): Promise<Game> {
  let code = generateGameCode();

  // Ensure code is unique
  while (await getGame(code)) {
    code = generateGameCode();
  }

  const game: Game = {
    id: crypto.randomUUID(),
    code,
    players: [],
    pool: [],
    currentPlayerIndex: 0,
    status: "waiting",
    winnerId: null,
    hasDrawnThisTurn: false,
  };

  await saveGame(game);
  return game;
}

// Socket to game mapping functions
export async function setSocketGame(socketId: string, gameCode: string): Promise<void> {
  await redis.set(`${SOCKET_GAME_PREFIX}${socketId}`, gameCode);
}

export async function getSocketGame(socketId: string): Promise<string | null> {
  return await redis.get(`${SOCKET_GAME_PREFIX}${socketId}`);
}

export async function removeSocketGame(socketId: string): Promise<void> {
  await redis.del(`${SOCKET_GAME_PREFIX}${socketId}`);
}
