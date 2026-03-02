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
} from "./state.js";
import type { Game } from "../../types/index.js";

const mockRedis = redis as {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
};

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: "test-id",
    code: "TEST",
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

describe("generateGameCode", () => {
  it("returns a 4-character string", () => {
    const code = generateGameCode();
    expect(code).toHaveLength(4);
  });

  it("only contains uppercase letters and digits", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateGameCode();
      expect(code).toMatch(/^[A-Z0-9]{4}$/);
    }
  });
});

describe("saveGame", () => {
  it("stores the game as JSON under game:{code}", async () => {
    mockRedis.set.mockResolvedValue("OK");
    const game = makeGame({ code: "ABCD" });
    await saveGame(game);
    expect(mockRedis.set).toHaveBeenCalledWith("game:ABCD", JSON.stringify(game));
  });
});

describe("getGame", () => {
  it("returns parsed game when key exists", async () => {
    const game = makeGame({ code: "ABCD" });
    mockRedis.get.mockResolvedValue(JSON.stringify(game));
    const result = await getGame("ABCD");
    expect(result).toEqual(game);
    expect(mockRedis.get).toHaveBeenCalledWith("game:ABCD");
  });

  it("returns null when key does not exist", async () => {
    mockRedis.get.mockResolvedValue(null);
    const result = await getGame("ZZZZ");
    expect(result).toBeNull();
  });
});

describe("deleteGame", () => {
  it("deletes the game key from Redis", async () => {
    mockRedis.del.mockResolvedValue(1);
    await deleteGame("ABCD");
    expect(mockRedis.del).toHaveBeenCalledWith("game:ABCD");
  });
});

describe("createGame", () => {
  it("creates a game with waiting status and empty players/pool", async () => {
    // getGame returns null (code is available), saveGame succeeds
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");

    const game = await createGame();

    expect(game.status).toBe("waiting");
    expect(game.players).toEqual([]);
    expect(game.pool).toEqual([]);
    expect(game.code).toMatch(/^[A-Z0-9]{4}$/);
    expect(game.winnerId).toBeNull();
    expect(game.hasDrawnThisTurn).toBe(false);
  });

  it("saves the newly created game to Redis with full JSON", async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");

    const game = await createGame();

    expect(mockRedis.set).toHaveBeenCalledWith(
      `game:${game.code}`,
      JSON.stringify(game)
    );
  });

  it("has a unique id (crypto.randomUUID)", async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");
    const a = await createGame();
    const b = await createGame();
    expect(a.id).not.toBe(b.id);
  });

  it("retries code generation if code is already taken", async () => {
    const existingGame = makeGame({ code: "AAAA" });
    // First call returns existing game, second returns null (code available)
    mockRedis.get
      .mockResolvedValueOnce(JSON.stringify(existingGame))
      .mockResolvedValueOnce(null);
    mockRedis.set.mockResolvedValue("OK");

    const game = await createGame();

    expect(game.code).toMatch(/^[A-Z0-9]{4}$/);
    expect(mockRedis.get).toHaveBeenCalledTimes(2);
  });
});

describe("setSocketGame", () => {
  it("stores the game code under socket:{socketId}", async () => {
    mockRedis.set.mockResolvedValue("OK");
    await setSocketGame("socket-abc", "XYZW");
    expect(mockRedis.set).toHaveBeenCalledWith("socket_game:socket-abc", "XYZW");
  });
});

describe("getSocketGame", () => {
  it("returns the game code when mapping exists", async () => {
    mockRedis.get.mockResolvedValue("XYZW");
    const code = await getSocketGame("socket-abc");
    expect(code).toBe("XYZW");
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
