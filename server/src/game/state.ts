import redis from "../redis/client.js";
import { Game, Player, Tile } from "../../types/index.js";

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
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => chars[b % chars.length]).join("");
}

export async function createGame(): Promise<Game> {
  const game: Game = {
    id: crypto.randomUUID(),
    code: generateGameCode(),
    players: [],
    pool: [],
    currentPlayerIndex: 0,
    status: "waiting",
    winnerId: null,
    hasDrawnThisTurn: false,
  };

  // Atomic creation with SET NX — retry on code collision
  let created = false;
  while (!created) {
    const result = await redis.set(
      `${GAME_KEY_PREFIX}${game.code}`,
      JSON.stringify(game),
      "NX"
    );
    if (result === "OK") {
      created = true;
    } else {
      game.code = generateGameCode();
    }
  }

  return game;
}

const HIDDEN_TILE_BASE: Omit<Tile, "id"> = { color: "black", number: 0, isJoker: false };

/**
 * Returns a copy of the game state safe to send to the given viewer socket.
 * - Strips reconnectToken from all players
 * - Replaces opponent rack contents with opaque placeholder tiles (same length)
 */
export function sanitizeGameState(game: Game, viewerSocketId: string): Game {
  return {
    ...game,
    players: game.players.map((p): Player => {
      // Always strip the secret token before sending to any client
      const { reconnectToken: _token, ...safePlayer } = p;

      if (p.socketId === viewerSocketId) {
        return safePlayer as Player;
      }

      // For opponents: replace rack contents with same-length placeholder tiles
      return {
        ...(safePlayer as Player),
        rack: p.rack.map((_, i) => ({ ...HIDDEN_TILE_BASE, id: `hidden-${i}` })),
      };
    }),
  };
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
