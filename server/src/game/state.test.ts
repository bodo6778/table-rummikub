import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the redis client before importing state functions
vi.mock("../redis/client.js", () => ({
  default: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

import redis from "../redis/client.js";
import {
  saveGame,
  getGame,
  deleteGame,
  generateGameCode,
  createGame,
  setSocketGame,
  getSocketGame,
  removeSocketGame,
  sanitizeGameState,
} from "./state.js";
import type { Game, Player, Tile } from "../../types/index.js";

const mockRedis = redis as unknown as {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
};

function makeTile(id: string): Tile {
  return { id, color: "red", number: 1, isJoker: false };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "player-1",
    name: "Alice",
    socketId: "socket-1",
    reconnectToken: "token-1",
    rack: [],
    lastDroppedTile: null,
    droppedTiles: [],
    connected: true,
    disconnectedAt: null,
    ...overrides,
  };
}

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: "test-id",
    code: "TEST12",
    players: [],
    pool: [],
    currentPlayerIndex: 0,
    status: "waiting",
    winnerId: null,
    hasDrawnThisTurn: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ------------------------------------------------------------------
// generateGameCode
// ------------------------------------------------------------------

describe("generateGameCode", () => {
  it("returns a 6-character string", () => {
    const code = generateGameCode();
    expect(code).toHaveLength(6);
  });

  it("only contains uppercase letters and digits", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateGameCode();
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
    }
  });

  it("produces different codes on successive calls", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateGameCode()));
    // With 2.2B possibilities a collision in 50 draws is essentially impossible
    expect(codes.size).toBeGreaterThan(40);
  });
});

// ------------------------------------------------------------------
// saveGame
// ------------------------------------------------------------------

describe("saveGame", () => {
  it("stores the game as JSON under game:{code}", async () => {
    mockRedis.set.mockResolvedValue("OK");
    const game = makeGame({ code: "ABCDEF" });
    await saveGame(game);
    expect(mockRedis.set).toHaveBeenCalledWith("game:ABCDEF", JSON.stringify(game));
  });
});

// ------------------------------------------------------------------
// getGame
// ------------------------------------------------------------------

describe("getGame", () => {
  it("returns parsed game when key exists", async () => {
    const game = makeGame({ code: "ABCDEF" });
    mockRedis.get.mockResolvedValue(JSON.stringify(game));
    const result = await getGame("ABCDEF");
    expect(result).toEqual(game);
    expect(mockRedis.get).toHaveBeenCalledWith("game:ABCDEF");
  });

  it("returns null when key does not exist", async () => {
    mockRedis.get.mockResolvedValue(null);
    const result = await getGame("ZZZZZZ");
    expect(result).toBeNull();
  });
});

// ------------------------------------------------------------------
// deleteGame
// ------------------------------------------------------------------

describe("deleteGame", () => {
  it("deletes the game key from Redis", async () => {
    mockRedis.del.mockResolvedValue(1);
    await deleteGame("ABCDEF");
    expect(mockRedis.del).toHaveBeenCalledWith("game:ABCDEF");
  });
});

// ------------------------------------------------------------------
// createGame
// ------------------------------------------------------------------

describe("createGame", () => {
  it("creates a game with waiting status and empty players/pool", async () => {
    // SET NX returns "OK" — code is available
    mockRedis.set.mockResolvedValue("OK");

    const game = await createGame();

    expect(game.status).toBe("waiting");
    expect(game.players).toEqual([]);
    expect(game.pool).toEqual([]);
    expect(game.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(game.winnerId).toBeNull();
    expect(game.hasDrawnThisTurn).toBe(false);
  });

  it("uses atomic SET NX to create the game", async () => {
    mockRedis.set.mockResolvedValue("OK");

    const game = await createGame();

    // The first argument is the key, second is JSON, third must be "NX"
    const [key, json, nx] = mockRedis.set.mock.calls[0];
    expect(key).toBe(`game:${game.code}`);
    expect(JSON.parse(json)).toMatchObject({ code: game.code, status: "waiting" });
    expect(nx).toBe("NX");
  });

  it("has a unique id (crypto.randomUUID)", async () => {
    mockRedis.set.mockResolvedValue("OK");
    const a = await createGame();
    const b = await createGame();
    expect(a.id).not.toBe(b.id);
  });

  it("retries with a new code when SET NX returns null (collision)", async () => {
    // First attempt: key already taken → null; second attempt: success → "OK"
    mockRedis.set
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("OK");

    const game = await createGame();

    expect(game.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(mockRedis.set).toHaveBeenCalledTimes(2);
    // Both calls must have used NX
    expect(mockRedis.set.mock.calls[0][2]).toBe("NX");
    expect(mockRedis.set.mock.calls[1][2]).toBe("NX");
    // The two calls must have used different codes (retry generated a new one)
    expect(mockRedis.set.mock.calls[0][0]).not.toBe(mockRedis.set.mock.calls[1][0]);
  });
});

// ------------------------------------------------------------------
// setSocketGame / getSocketGame / removeSocketGame
// ------------------------------------------------------------------

describe("setSocketGame", () => {
  it("stores the game code under socket_game:{socketId}", async () => {
    mockRedis.set.mockResolvedValue("OK");
    await setSocketGame("socket-abc", "XYZWQR");
    expect(mockRedis.set).toHaveBeenCalledWith("socket_game:socket-abc", "XYZWQR");
  });
});

describe("getSocketGame", () => {
  it("returns the game code when mapping exists", async () => {
    mockRedis.get.mockResolvedValue("XYZWQR");
    const code = await getSocketGame("socket-abc");
    expect(code).toBe("XYZWQR");
    expect(mockRedis.get).toHaveBeenCalledWith("socket_game:socket-abc");
  });

  it("returns null when no mapping exists", async () => {
    mockRedis.get.mockResolvedValue(null);
    const code = await getSocketGame("socket-abc");
    expect(code).toBeNull();
  });
});

describe("removeSocketGame", () => {
  it("deletes the socket-to-game mapping", async () => {
    mockRedis.del.mockResolvedValue(1);
    await removeSocketGame("socket-abc");
    expect(mockRedis.del).toHaveBeenCalledWith("socket_game:socket-abc");
  });
});

// ------------------------------------------------------------------
// sanitizeGameState
// ------------------------------------------------------------------

describe("sanitizeGameState", () => {
  it("preserves the viewer's own rack intact", () => {
    const myTile = makeTile("my-tile");
    const me = makePlayer({ id: "p1", socketId: "socket-1", rack: [myTile] });
    const game = makeGame({ players: [me] });

    const result = sanitizeGameState(game, "socket-1");

    expect(result.players[0].rack).toEqual([myTile]);
  });

  it("replaces opponent rack contents with placeholder tiles of the same length", () => {
    const me = makePlayer({ id: "p1", socketId: "socket-1", rack: [] });
    const opponent = makePlayer({
      id: "p2",
      socketId: "socket-2",
      rack: [makeTile("t1"), makeTile("t2"), makeTile("t3")],
    });
    const game = makeGame({ players: [me, opponent] });

    const result = sanitizeGameState(game, "socket-1");

    // Length preserved so the UI can display tile count
    expect(result.players[1].rack).toHaveLength(3);
    // No real tile ids leak through
    for (const tile of result.players[1].rack) {
      expect(tile.id).not.toBe("t1");
      expect(tile.id).not.toBe("t2");
      expect(tile.id).not.toBe("t3");
    }
  });

  it("strips reconnectToken from the viewer's own player object", () => {
    const me = makePlayer({ id: "p1", socketId: "socket-1", reconnectToken: "secret" });
    const game = makeGame({ players: [me] });

    const result = sanitizeGameState(game, "socket-1");

    expect(result.players[0].reconnectToken).toBeUndefined();
  });

  it("strips reconnectToken from opponent player objects", () => {
    const me = makePlayer({ id: "p1", socketId: "socket-1" });
    const opponent = makePlayer({
      id: "p2",
      socketId: "socket-2",
      reconnectToken: "opponent-secret",
    });
    const game = makeGame({ players: [me, opponent] });

    const result = sanitizeGameState(game, "socket-1");

    expect(result.players[1].reconnectToken).toBeUndefined();
  });

  it("does not modify the original game object", () => {
    const myTile = makeTile("real-tile");
    const player = makePlayer({
      id: "p1",
      socketId: "socket-1",
      rack: [myTile],
      reconnectToken: "secret",
    });
    const game = makeGame({ players: [player] });

    sanitizeGameState(game, "socket-2"); // viewer is someone else

    // Original player still has their rack and token
    expect(game.players[0].rack).toEqual([myTile]);
    expect(game.players[0].reconnectToken).toBe("secret");
  });

  it("preserves all non-sensitive game fields unchanged", () => {
    const me = makePlayer({ id: "p1", socketId: "socket-1" });
    const game = makeGame({
      players: [me],
      currentPlayerIndex: 1,
      status: "playing",
      winnerId: "p1",
      hasDrawnThisTurn: true,
    });

    const result = sanitizeGameState(game, "socket-1");

    expect(result.currentPlayerIndex).toBe(1);
    expect(result.status).toBe("playing");
    expect(result.winnerId).toBe("p1");
    expect(result.hasDrawnThisTurn).toBe(true);
  });

  it("preserves opponent's public fields (name, connected, droppedTiles, lastDroppedTile)", () => {
    const droppedTile = makeTile("dt1");
    const me = makePlayer({ id: "p1", socketId: "socket-1" });
    const opponent = makePlayer({
      id: "p2",
      socketId: "socket-2",
      name: "Bob",
      connected: false,
      disconnectedAt: 12345,
      lastDroppedTile: droppedTile,
      droppedTiles: [droppedTile],
    });
    const game = makeGame({ players: [me, opponent] });

    const result = sanitizeGameState(game, "socket-1");
    const sanitizedOpponent = result.players[1];

    expect(sanitizedOpponent.name).toBe("Bob");
    expect(sanitizedOpponent.connected).toBe(false);
    expect(sanitizedOpponent.disconnectedAt).toBe(12345);
    expect(sanitizedOpponent.lastDroppedTile).toEqual(droppedTile);
    expect(sanitizedOpponent.droppedTiles).toEqual([droppedTile]);
  });
});
