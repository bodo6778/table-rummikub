import redis from "../redis/client.js";
import { Game } from "../../types/index.js";

const GAME_KEY_PREFIX = "game:";

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
  };

  await saveGame(game);
  return game;
}
