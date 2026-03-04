import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../game/state.js", () => ({
  createGame: vi.fn(),
  getGame: vi.fn(),
  saveGame: vi.fn(),
  setSocketGame: vi.fn(),
  getSocketGame: vi.fn(),
  removeSocketGame: vi.fn(),
  // Pass-through so handler tests focus on handler logic, not sanitization
  sanitizeGameState: vi.fn((game: Game) => game),
}));

import {
  createGame,
  getGame,
  saveGame,
  setSocketGame,
  getSocketGame,
  removeSocketGame,
  sanitizeGameState,
} from "../game/state.js";

import { registerSocketHandlers } from "./handlers.js";
import type { Game, Player, Tile } from "../../types/index.js";

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function makeTile(id: string, color: Tile["color"] = "red", number = 1): Tile {
  return { id, color, number, isJoker: false };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "player-1",
    name: "Alice",
    socketId: "socket-1",
    reconnectToken: "token-abc",
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
    id: "game-id",
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

type MockEmit = ReturnType<typeof vi.fn>;

function createMockSocket(id = "socket-1") {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};
  const middlewares: Array<(data: unknown, next: () => void) => void> = [];
  const emit: MockEmit = vi.fn();
  const toEmit: MockEmit = vi.fn();

  return {
    id,
    on: vi.fn((event: string, handler: (...args: unknown[]) => unknown) => {
      handlers[event] = handler;
    }),
    // socket.use registers per-socket middleware; we capture but don't invoke it
    use: vi.fn((mw: (data: unknown, next: () => void) => void) => {
      middlewares.push(mw);
    }),
    emit,
    to: vi.fn(() => ({ emit: toEmit })),
    _toEmit: toEmit,
    join: vi.fn(),
    leave: vi.fn(),
    trigger(event: string, ...args: unknown[]) {
      return handlers[event]?.(...args);
    },
  };
}

function createMockIo() {
  const roomEmit: MockEmit = vi.fn();
  return {
    to: vi.fn(() => ({ emit: roomEmit })),
    _roomEmit: roomEmit,
  };
}

const mocks = {
  createGame: createGame as ReturnType<typeof vi.fn>,
  getGame: getGame as ReturnType<typeof vi.fn>,
  saveGame: saveGame as ReturnType<typeof vi.fn>,
  setSocketGame: setSocketGame as ReturnType<typeof vi.fn>,
  getSocketGame: getSocketGame as ReturnType<typeof vi.fn>,
  removeSocketGame: removeSocketGame as ReturnType<typeof vi.fn>,
  sanitizeGameState: sanitizeGameState as ReturnType<typeof vi.fn>,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.saveGame.mockResolvedValue(undefined);
  mocks.setSocketGame.mockResolvedValue(undefined);
  mocks.removeSocketGame.mockResolvedValue(undefined);
  mocks.getSocketGame.mockResolvedValue(null);
  // Default pass-through; override in individual tests if needed
  mocks.sanitizeGameState.mockImplementation((game: Game) => game);
});

// ------------------------------------------------------------------
// create-game
// ------------------------------------------------------------------

describe("create-game", () => {
  it("emits game-created with the new game code", async () => {
    const socket = createMockSocket();
    const io = createMockIo();
    mocks.createGame.mockResolvedValue(makeGame({ code: "ABCDEF" }));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("create-game");

    expect(socket.emit).toHaveBeenCalledWith("game-created", { code: "ABCDEF" });
  });

  it("emits error when createGame throws", async () => {
    const socket = createMockSocket();
    const io = createMockIo();
    mocks.createGame.mockRejectedValue(new Error("Redis down"));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("create-game");

    expect(socket.emit).toHaveBeenCalledWith("error", { message: "Failed to create game" });
  });
});

// ------------------------------------------------------------------
// join-game
// ------------------------------------------------------------------

describe("join-game", () => {
  it("adds the player, calls socket.join, and emits player-joined to joining socket", async () => {
    const socket = createMockSocket("socket-alice");
    const io = createMockIo();
    const game = makeGame({ code: "ROOM12" });
    mocks.getGame.mockResolvedValue(game);

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("join-game", { code: "ROOM12", playerName: "Alice" });

    expect(socket.emit).toHaveBeenCalledWith(
      "player-joined",
      expect.objectContaining({ player: expect.objectContaining({ name: "Alice" }) })
    );
    expect(socket.join).toHaveBeenCalledWith("ROOM12");
    expect(mocks.saveGame).toHaveBeenCalled();
  });

  it("notifies existing players via io when a new player joins", async () => {
    const existing = makePlayer({ id: "p1", socketId: "socket-existing" });
    const game = makeGame({ code: "ROOM12", players: [existing] });
    mocks.getGame.mockResolvedValue(game);

    const socket = createMockSocket("socket-alice");
    const io = createMockIo();

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("join-game", { code: "ROOM12", playerName: "Alice" });

    // Existing player gets notified via io.to(socketId).emit
    expect(io._roomEmit).toHaveBeenCalledWith(
      "player-joined",
      expect.objectContaining({ player: expect.objectContaining({ name: "Alice" }) })
    );
  });

  it("includes a reconnectToken in the player returned to the joining socket", async () => {
    const socket = createMockSocket("socket-alice");
    const io = createMockIo();
    mocks.getGame.mockResolvedValue(makeGame({ code: "ROOM12" }));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("join-game", { code: "ROOM12", playerName: "Alice" });

    const [, { player }] = socket.emit.mock.calls.find(([ev]) => ev === "player-joined")!;
    expect(player.reconnectToken).toBeDefined();
    expect(typeof player.reconnectToken).toBe("string");
  });

  it("emits error when game not found", async () => {
    const socket = createMockSocket();
    const io = createMockIo();
    mocks.getGame.mockResolvedValue(null);

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("join-game", { code: "XXXXXX", playerName: "Bob" });

    expect(socket.emit).toHaveBeenCalledWith("error", { message: "Game not found" });
  });

  it("emits error when game already started", async () => {
    const socket = createMockSocket();
    const io = createMockIo();
    mocks.getGame.mockResolvedValue(makeGame({ status: "playing" }));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("join-game", { code: "TEST12", playerName: "Bob" });

    expect(socket.emit).toHaveBeenCalledWith("error", { message: "Game already started" });
  });

  it("emits error when game is full (4 players)", async () => {
    const socket = createMockSocket();
    const io = createMockIo();
    const players = [1, 2, 3, 4].map((i) =>
      makePlayer({ id: `p${i}`, name: `P${i}`, socketId: `s${i}` })
    );
    mocks.getGame.mockResolvedValue(makeGame({ players }));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("join-game", { code: "TEST12", playerName: "Eve" });

    expect(socket.emit).toHaveBeenCalledWith("error", { message: "Game is full" });
  });

  // -- Name validation --

  it("emits error when player name is empty", async () => {
    const socket = createMockSocket();
    const io = createMockIo();
    mocks.getGame.mockResolvedValue(makeGame());

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("join-game", { code: "TEST12", playerName: "  " });

    expect(socket.emit).toHaveBeenCalledWith("error", expect.objectContaining({ message: expect.stringContaining("Invalid") }));
    expect(mocks.saveGame).not.toHaveBeenCalled();
  });

  it("emits error when player name exceeds 20 characters", async () => {
    const socket = createMockSocket();
    const io = createMockIo();
    mocks.getGame.mockResolvedValue(makeGame());

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("join-game", { code: "TEST12", playerName: "A".repeat(21) });

    expect(socket.emit).toHaveBeenCalledWith("error", expect.objectContaining({ message: expect.stringContaining("Invalid") }));
    expect(mocks.saveGame).not.toHaveBeenCalled();
  });

  it("emits error when player name is not a string", async () => {
    const socket = createMockSocket();
    const io = createMockIo();
    mocks.getGame.mockResolvedValue(makeGame());

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("join-game", { code: "TEST12", playerName: 42 });

    expect(socket.emit).toHaveBeenCalledWith("error", expect.objectContaining({ message: expect.stringContaining("Invalid") }));
    expect(mocks.saveGame).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------
// start-game
// ------------------------------------------------------------------

describe("start-game", () => {
  it("deals tiles, saves, and broadcasts game-started + turn-changed", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    const players = [
      makePlayer({ id: "p1", socketId: "socket-1" }),
      makePlayer({ id: "p2", socketId: "socket-2" }),
    ];
    mocks.getGame.mockResolvedValue(makeGame({ players, status: "waiting" }));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("start-game", { code: "TEST12" });

    const savedGame: Game = mocks.saveGame.mock.calls[0][0];
    expect(savedGame.status).toBe("playing");
    expect(savedGame.players[0].rack).toHaveLength(14);
    expect(savedGame.players[1].rack).toHaveLength(14);

    expect(io._roomEmit).toHaveBeenCalledWith("game-started", expect.objectContaining({ gameState: expect.any(Object) }));
    expect(io._roomEmit).toHaveBeenCalledWith("turn-changed", { currentPlayerIndex: 0 });
  });

  it("emits error with fewer than 2 players", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    mocks.getGame.mockResolvedValue(makeGame({ players: [makePlayer()] }));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("start-game", { code: "TEST12" });

    expect(socket.emit).toHaveBeenCalledWith("error", {
      message: "Need at least 2 players to start",
    });
  });

  it("emits error when a non-host socket tries to start", async () => {
    const socket = createMockSocket("socket-nonhost");
    const io = createMockIo();
    const players = [
      makePlayer({ id: "p1", socketId: "socket-host" }),
      makePlayer({ id: "p2", socketId: "socket-nonhost" }),
    ];
    mocks.getGame.mockResolvedValue(makeGame({ players, status: "waiting" }));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("start-game", { code: "TEST12" });

    expect(socket.emit).toHaveBeenCalledWith("error", {
      message: "Only the host can start the game",
    });
    expect(mocks.saveGame).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------
// draw-from-pool
// ------------------------------------------------------------------

describe("draw-from-pool", () => {
  it("gives the current player a tile and notifies others", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    const tile = makeTile("t1");
    const player = makePlayer({ socketId: "socket-1", rack: [] });
    const game = makeGame({
      players: [player],
      pool: [tile],
      status: "playing",
      hasDrawnThisTurn: false,
    });
    mocks.getGame.mockResolvedValue(game);

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("draw-from-pool", { code: "TEST12" });

    const savedGame: Game = mocks.saveGame.mock.calls[0][0];
    expect(savedGame.players[0].rack).toContainEqual(tile);
    expect(savedGame.pool).toHaveLength(0);
    expect(savedGame.hasDrawnThisTurn).toBe(true);
    expect(socket.emit).toHaveBeenCalledWith("tile-drawn", expect.objectContaining({ tile }));
    expect(socket._toEmit).toHaveBeenCalledWith("player-drew-tile", {
      playerIndex: 0,
      poolSize: 0,
    });
  });

  it("ends in a draw and broadcasts game-over when the pool is empty", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    const player = makePlayer({ socketId: "socket-1" });
    const game = makeGame({ players: [player], pool: [], status: "playing" });
    mocks.getGame.mockResolvedValue(game);

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("draw-from-pool", { code: "TEST12" });

    const savedGame: Game = mocks.saveGame.mock.calls[0][0];
    expect(savedGame.status).toBe("draw");
    expect(io._roomEmit).toHaveBeenCalledWith(
      "game-over",
      expect.objectContaining({ isDraw: true, winnerId: null })
    );
  });

  it("emits error when not the player's turn", async () => {
    const socket = createMockSocket("socket-2");
    const io = createMockIo();
    const player = makePlayer({ socketId: "socket-1" });
    const game = makeGame({ players: [player], pool: [makeTile("t1")], status: "playing" });
    mocks.getGame.mockResolvedValue(game);

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("draw-from-pool", { code: "TEST12" });

    expect(socket.emit).toHaveBeenCalledWith("error", { message: "Not your turn" });
  });

  it("emits error when already drew this turn", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    const player = makePlayer({ socketId: "socket-1" });
    const game = makeGame({
      players: [player],
      pool: [makeTile("t1")],
      status: "playing",
      hasDrawnThisTurn: true,
    });
    mocks.getGame.mockResolvedValue(game);

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("draw-from-pool", { code: "TEST12" });

    expect(socket.emit).toHaveBeenCalledWith("error", { message: "Already drew this turn" });
  });
});

// ------------------------------------------------------------------
// draw-from-neighbor
// ------------------------------------------------------------------

describe("draw-from-neighbor", () => {
  it("takes left neighbor's dropped tile and notifies the room", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    const droppedTile = makeTile("t1");
    const player0 = makePlayer({ id: "p0", socketId: "socket-1", rack: [] });
    const player1 = makePlayer({
      id: "p1",
      socketId: "socket-2",
      rack: [],
      lastDroppedTile: droppedTile,
    });
    const game = makeGame({
      players: [player0, player1],
      status: "playing",
      currentPlayerIndex: 0,
      hasDrawnThisTurn: false,
    });
    mocks.getGame.mockResolvedValue(game);

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("draw-from-neighbor", { code: "TEST12" });

    const savedGame: Game = mocks.saveGame.mock.calls[0][0];
    expect(savedGame.players[0].rack).toContainEqual(droppedTile);
    expect(savedGame.players[1].lastDroppedTile).toBeNull();
    expect(savedGame.hasDrawnThisTurn).toBe(true);
    expect(socket.emit).toHaveBeenCalledWith("tile-drawn", expect.objectContaining({ tile: droppedTile }));
    expect(io._roomEmit).toHaveBeenCalledWith("neighbor-tile-taken", {
      takerIndex: 0,
      neighborIndex: 1,
    });
  });

  it("emits error when neighbor has no dropped tile", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    const player0 = makePlayer({ id: "p0", socketId: "socket-1" });
    const player1 = makePlayer({ id: "p1", socketId: "socket-2", lastDroppedTile: null });
    const game = makeGame({
      players: [player0, player1],
      status: "playing",
      currentPlayerIndex: 0,
      hasDrawnThisTurn: false,
    });
    mocks.getGame.mockResolvedValue(game);

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("draw-from-neighbor", { code: "TEST12" });

    expect(socket.emit).toHaveBeenCalledWith("error", { message: "No tile available from neighbor" });
  });

  it("emits error when already drew this turn", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    const player = makePlayer({ socketId: "socket-1" });
    const game = makeGame({
      players: [player],
      status: "playing",
      hasDrawnThisTurn: true,
    });
    mocks.getGame.mockResolvedValue(game);

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("draw-from-neighbor", { code: "TEST12" });

    expect(socket.emit).toHaveBeenCalledWith("error", { message: "Already drew this turn" });
  });
});

// ------------------------------------------------------------------
// drop-tile
// ------------------------------------------------------------------

describe("drop-tile", () => {
  it("removes the tile, advances the turn, and broadcasts events", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    const tile = makeTile("t1");
    const player1 = makePlayer({ id: "p1", socketId: "socket-1", rack: [tile] });
    const player2 = makePlayer({ id: "p2", socketId: "socket-2", rack: [] });
    const game = makeGame({
      players: [player1, player2],
      status: "playing",
      hasDrawnThisTurn: true,
      currentPlayerIndex: 0,
    });
    mocks.getGame.mockResolvedValue(game);

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("drop-tile", { code: "TEST12", tileId: "t1" });

    const savedGame: Game = mocks.saveGame.mock.calls[0][0];
    expect(savedGame.players[0].rack).not.toContainEqual(tile);
    expect(savedGame.players[0].lastDroppedTile).toEqual(tile);
    expect(savedGame.currentPlayerIndex).toBe(1);
    expect(savedGame.hasDrawnThisTurn).toBe(false);

    expect(io._roomEmit).toHaveBeenCalledWith("tile-dropped", expect.objectContaining({ tile }));
    expect(io._roomEmit).toHaveBeenCalledWith("turn-changed", { currentPlayerIndex: 1 });
  });

  it("emits error when must draw first", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    const player = makePlayer({ socketId: "socket-1", rack: [makeTile("t1")] });
    const game = makeGame({ players: [player], status: "playing", hasDrawnThisTurn: false });
    mocks.getGame.mockResolvedValue(game);

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("drop-tile", { code: "TEST12", tileId: "t1" });

    expect(socket.emit).toHaveBeenCalledWith("error", { message: "Must draw before dropping" });
  });

  it("emits error when tile not in rack", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    const player = makePlayer({ socketId: "socket-1", rack: [makeTile("t1")] });
    const game = makeGame({ players: [player], status: "playing", hasDrawnThisTurn: true });
    mocks.getGame.mockResolvedValue(game);

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("drop-tile", { code: "TEST12", tileId: "t-nonexistent" });

    expect(socket.emit).toHaveBeenCalledWith("error", { message: "Tile not in rack" });
  });
});

// ------------------------------------------------------------------
// announce-win
// ------------------------------------------------------------------

describe("announce-win", () => {
  it("sets the game to finished and broadcasts game-over", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();

    const winningTile = makeTile("r7", "red", 7);
    const rack: Tile[] = [
      makeTile("r1", "red", 1),
      makeTile("r2", "red", 2),
      makeTile("r3", "red", 3),
      makeTile("b5", "blue", 5),
      makeTile("y5", "yellow", 5),
      makeTile("k5", "black", 5),
      winningTile,
    ];
    const melds = [
      { id: "m1", tiles: [rack[0], rack[1], rack[2]] },
      { id: "m2", tiles: [rack[3], rack[4], rack[5]] },
    ];
    const player = makePlayer({ id: "p1", socketId: "socket-1", rack });
    mocks.getGame.mockResolvedValue(
      makeGame({ players: [player], status: "playing", currentPlayerIndex: 0 })
    );

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("announce-win", { code: "TEST12", melds, winningTileId: winningTile.id });

    const savedGame: Game = mocks.saveGame.mock.calls[0][0];
    expect(savedGame.status).toBe("finished");
    expect(savedGame.winnerId).toBe("p1");
    expect(io._roomEmit).toHaveBeenCalledWith(
      "game-over",
      expect.objectContaining({ winnerId: "p1" })
    );
  });

  it("emits error when it is not the announcing player's turn", async () => {
    const socket = createMockSocket("socket-2");
    const io = createMockIo();

    const rack: Tile[] = [
      makeTile("r1", "red", 1), makeTile("r2", "red", 2), makeTile("r3", "red", 3),
    ];
    const p1 = makePlayer({ id: "p1", socketId: "socket-1", rack: [] });
    const p2 = makePlayer({ id: "p2", socketId: "socket-2", rack });
    mocks.getGame.mockResolvedValue(
      makeGame({ players: [p1, p2], status: "playing", currentPlayerIndex: 0 }) // p1's turn
    );

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("announce-win", {
      code: "TEST12",
      melds: [{ id: "m1", tiles: rack }],
    });

    expect(socket.emit).toHaveBeenCalledWith("error", { message: "Not your turn" });
    expect(mocks.saveGame).not.toHaveBeenCalled();
  });

  it("emits invalid-announce and does not save when melds are invalid", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();

    const rack: Tile[] = [makeTile("r1", "red", 1), makeTile("b7", "blue", 7)];
    const melds = [{ id: "m1", tiles: rack }];
    const player = makePlayer({ id: "p1", socketId: "socket-1", rack });
    mocks.getGame.mockResolvedValue(makeGame({ players: [player], status: "playing" }));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("announce-win", { code: "TEST12", melds });

    expect(socket.emit).toHaveBeenCalledWith(
      "invalid-announce",
      expect.objectContaining({ reason: expect.any(String) })
    );
    expect(mocks.saveGame).not.toHaveBeenCalled();
  });

  it("emits invalid-announce when melds do not cover all rack tiles", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();

    const rack: Tile[] = [
      makeTile("r1", "red", 1),
      makeTile("r2", "red", 2),
      makeTile("r3", "red", 3),
      makeTile("b5", "blue", 5),
    ];
    const melds = [{ id: "m1", tiles: [rack[0], rack[1], rack[2]] }];
    const player = makePlayer({ id: "p1", socketId: "socket-1", rack });
    mocks.getGame.mockResolvedValue(makeGame({ players: [player], status: "playing" }));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("announce-win", { code: "TEST12", melds });

    expect(socket.emit).toHaveBeenCalledWith(
      "invalid-announce",
      expect.objectContaining({ reason: expect.any(String) })
    );
    expect(mocks.saveGame).not.toHaveBeenCalled();
  });

  it("emits error when game is not in playing state", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    const player = makePlayer({ id: "p1", socketId: "socket-1" });
    mocks.getGame.mockResolvedValue(makeGame({ players: [player], status: "finished" }));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("announce-win", { code: "TEST12", melds: [] });

    expect(socket.emit).toHaveBeenCalledWith("error", { message: "Game not in progress" });
    expect(mocks.saveGame).not.toHaveBeenCalled();
  });

  it("emits error when the announcing socket is not a player in the game", async () => {
    const socket = createMockSocket("socket-unknown");
    const io = createMockIo();
    const player = makePlayer({ id: "p1", socketId: "socket-1" });
    mocks.getGame.mockResolvedValue(makeGame({ players: [player], status: "playing" }));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("announce-win", { code: "TEST12", melds: [] });

    expect(socket.emit).toHaveBeenCalledWith("error", { message: "Player not found" });
    expect(mocks.saveGame).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------
// leave-game
// ------------------------------------------------------------------

describe("leave-game", () => {
  it("removes the player, saves, and notifies others via io", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    const leavingPlayer = makePlayer({ id: "p1", socketId: "socket-1" });
    const otherPlayer = makePlayer({ id: "p2", socketId: "socket-2" });
    const game = makeGame({ players: [leavingPlayer, otherPlayer], status: "waiting" });
    mocks.getGame.mockResolvedValue(game);

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("leave-game", { code: "TEST12" });

    const savedGame: Game = mocks.saveGame.mock.calls[0][0];
    expect(savedGame.players).toHaveLength(1);
    expect(savedGame.players[0].id).toBe("p2");
    expect(socket.leave).toHaveBeenCalledWith("TEST12");
    expect(mocks.removeSocketGame).toHaveBeenCalledWith("socket-1");
    // Remaining player notified via io.to(socketId)
    expect(io._roomEmit).toHaveBeenCalledWith(
      "player-left",
      expect.objectContaining({ playerId: "p1" })
    );
  });

  it("advances the turn when the leaving player was the current player", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    const current = makePlayer({ id: "p1", socketId: "socket-1" });
    const next = makePlayer({ id: "p2", socketId: "socket-2" });
    const game = makeGame({
      players: [current, next],
      status: "playing",
      currentPlayerIndex: 0,
      hasDrawnThisTurn: true,
    });
    mocks.getGame.mockResolvedValue(game);

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("leave-game", { code: "TEST12" });

    const savedGame: Game = mocks.saveGame.mock.calls[0][0];
    expect(savedGame.currentPlayerIndex).toBe(0); // only 1 player remains
    expect(savedGame.hasDrawnThisTurn).toBe(false);
  });

  it("handles gracefully when game not found", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    mocks.getGame.mockResolvedValue(null);

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("leave-game", { code: "TEST12" });

    expect(mocks.removeSocketGame).toHaveBeenCalledWith("socket-1");
    expect(mocks.saveGame).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------
// reconnect-game
// ------------------------------------------------------------------

describe("reconnect-game", () => {
  it("accepts reconnect with valid token, updates socket ID, emits reconnect-success", async () => {
    const socket = createMockSocket("socket-new");
    const io = createMockIo();
    const player = makePlayer({
      id: "p1",
      socketId: "socket-old",
      reconnectToken: "valid-token",
      connected: false,
      disconnectedAt: 999,
    });
    const watcher = makePlayer({ id: "p2", socketId: "socket-watcher" });
    const game = makeGame({ players: [player, watcher], status: "playing", code: "ROOM12" });
    mocks.getGame.mockResolvedValue(game);

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("reconnect-game", {
      code: "ROOM12",
      playerId: "p1",
      reconnectToken: "valid-token",
    });

    const savedGame: Game = mocks.saveGame.mock.calls[0][0];
    expect(savedGame.players[0].socketId).toBe("socket-new");
    expect(savedGame.players[0].connected).toBe(true);
    expect(savedGame.players[0].disconnectedAt).toBeNull();

    expect(socket.join).toHaveBeenCalledWith("ROOM12");
    expect(mocks.setSocketGame).toHaveBeenCalledWith("socket-new", "ROOM12");
    expect(socket.emit).toHaveBeenCalledWith(
      "reconnect-success",
      expect.objectContaining({ player: expect.objectContaining({ id: "p1" }) })
    );
    // Other players notified via io.to(socketId)
    expect(io._roomEmit).toHaveBeenCalledWith(
      "player-reconnected",
      expect.objectContaining({ playerId: "p1" })
    );
  });

  it("emits reconnect-failed when reconnectToken does not match", async () => {
    const socket = createMockSocket("socket-attacker");
    const io = createMockIo();
    const player = makePlayer({
      id: "p1",
      socketId: "socket-old",
      reconnectToken: "real-secret-token",
    });
    mocks.getGame.mockResolvedValue(makeGame({ players: [player] }));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("reconnect-game", {
      code: "TEST12",
      playerId: "p1",
      reconnectToken: "wrong-token",
    });

    expect(socket.emit).toHaveBeenCalledWith("reconnect-failed", {
      reason: "Invalid reconnect token",
    });
    expect(mocks.saveGame).not.toHaveBeenCalled();
  });

  it("emits reconnect-failed when reconnectToken is missing", async () => {
    const socket = createMockSocket("socket-new");
    const io = createMockIo();
    const player = makePlayer({ id: "p1", reconnectToken: "real-token" });
    mocks.getGame.mockResolvedValue(makeGame({ players: [player] }));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("reconnect-game", {
      code: "TEST12",
      playerId: "p1",
      reconnectToken: undefined,
    });

    expect(socket.emit).toHaveBeenCalledWith("reconnect-failed", {
      reason: "Invalid reconnect token",
    });
    expect(mocks.saveGame).not.toHaveBeenCalled();
  });

  it("emits reconnect-failed when game not found", async () => {
    const socket = createMockSocket("socket-new");
    const io = createMockIo();
    mocks.getGame.mockResolvedValue(null);

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("reconnect-game", {
      code: "GONE12",
      playerId: "p1",
      reconnectToken: "any",
    });

    expect(socket.emit).toHaveBeenCalledWith("reconnect-failed", { reason: "Game not found" });
  });

  it("emits reconnect-failed when player not in game", async () => {
    const socket = createMockSocket("socket-new");
    const io = createMockIo();
    mocks.getGame.mockResolvedValue(makeGame({ players: [] }));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("reconnect-game", {
      code: "TEST12",
      playerId: "unknown",
      reconnectToken: "any",
    });

    expect(socket.emit).toHaveBeenCalledWith("reconnect-failed", {
      reason: "Player not found in game",
    });
  });
});

// ------------------------------------------------------------------
// request-skip-turn
// ------------------------------------------------------------------

describe("request-skip-turn", () => {
  it("skips the disconnected player's turn after timeout has elapsed", async () => {
    const now = 1_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    const socket = createMockSocket("socket-2");
    const io = createMockIo();
    const disconnected = makePlayer({
      id: "p1",
      socketId: "socket-1",
      connected: false,
      disconnectedAt: now - 61_000,
    });
    const active = makePlayer({ id: "p2", socketId: "socket-2" });
    const game = makeGame({
      players: [disconnected, active],
      status: "playing",
      currentPlayerIndex: 0,
    });
    mocks.getGame.mockResolvedValue(game);

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("request-skip-turn", { code: "TEST12" });

    const savedGame: Game = mocks.saveGame.mock.calls[0][0];
    expect(savedGame.currentPlayerIndex).toBe(1);
    expect(savedGame.hasDrawnThisTurn).toBe(false);
    expect(io._roomEmit).toHaveBeenCalledWith(
      "turn-skipped",
      expect.objectContaining({ skippedPlayerId: "p1" })
    );
    expect(io._roomEmit).toHaveBeenCalledWith("turn-changed", { currentPlayerIndex: 1 });

    vi.restoreAllMocks();
  });

  it("emits error when a non-player socket requests the skip", async () => {
    const now = 1_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    const socket = createMockSocket("socket-outsider");
    const io = createMockIo();
    const disconnected = makePlayer({
      id: "p1",
      socketId: "socket-1",
      connected: false,
      disconnectedAt: now - 61_000,
    });
    mocks.getGame.mockResolvedValue(
      makeGame({ players: [disconnected], status: "playing", currentPlayerIndex: 0 })
    );

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("request-skip-turn", { code: "TEST12" });

    // Non-player: silently ignored (handler returns early without acting)
    expect(mocks.saveGame).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it("emits error when current player is still connected", async () => {
    const socket = createMockSocket("socket-2");
    const io = createMockIo();
    const player = makePlayer({ id: "p1", socketId: "socket-1", connected: true });
    const requester = makePlayer({ id: "p2", socketId: "socket-2" });
    mocks.getGame.mockResolvedValue(
      makeGame({ players: [player, requester], status: "playing", currentPlayerIndex: 0 })
    );

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("request-skip-turn", { code: "TEST12" });

    expect(socket.emit).toHaveBeenCalledWith("error", {
      message: "Current player is still connected",
    });
  });

  it("emits error when timeout has not yet elapsed", async () => {
    const now = 1_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    const socket = createMockSocket("socket-2");
    const io = createMockIo();
    const disconnected = makePlayer({
      id: "p1",
      socketId: "socket-1",
      connected: false,
      disconnectedAt: now - 10_000,
    });
    const requester = makePlayer({ id: "p2", socketId: "socket-2" });
    mocks.getGame.mockResolvedValue(
      makeGame({ players: [disconnected, requester], status: "playing", currentPlayerIndex: 0 })
    );

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("request-skip-turn", { code: "TEST12" });

    expect(socket.emit).toHaveBeenCalledWith(
      "error",
      expect.objectContaining({ message: expect.stringMatching(/Wait \d+s before skipping/) })
    );

    vi.restoreAllMocks();
  });
});

// ------------------------------------------------------------------
// disconnect
// ------------------------------------------------------------------

describe("disconnect", () => {
  it("marks the player as disconnected and notifies remaining players via io", async () => {
    const now = 1_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    const player = makePlayer({ id: "p1", socketId: "socket-1", connected: true });
    const other = makePlayer({ id: "p2", socketId: "socket-2", connected: true });
    const game = makeGame({ players: [player, other], status: "playing", code: "TEST12" });

    mocks.getSocketGame.mockResolvedValue("TEST12");
    mocks.getGame.mockResolvedValue(game);

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("disconnect");

    const savedGame: Game = mocks.saveGame.mock.calls[0][0];
    expect(savedGame.players[0].connected).toBe(false);
    expect(savedGame.players[0].disconnectedAt).toBe(now);
    expect(io._roomEmit).toHaveBeenCalledWith(
      "player-disconnected",
      expect.objectContaining({ playerId: "p1" })
    );

    vi.restoreAllMocks();
  });

  it("does nothing when socket is not mapped to a game", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    mocks.getSocketGame.mockResolvedValue(null);

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("disconnect");

    expect(mocks.saveGame).not.toHaveBeenCalled();
  });

  it("cleans up socket mapping and does nothing when game is missing", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    mocks.getSocketGame.mockResolvedValue("GONE12");
    mocks.getGame.mockResolvedValue(null);

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("disconnect");

    expect(mocks.removeSocketGame).toHaveBeenCalledWith("socket-1");
    expect(mocks.saveGame).not.toHaveBeenCalled();
  });
});

// ------------------------------------------------------------------
// rematch
// ------------------------------------------------------------------

describe("rematch", () => {
  function makeFinishedGame(status: "finished" | "draw" = "finished") {
    const tile = makeTile("old-t1");
    const p1 = makePlayer({
      id: "p1",
      socketId: "socket-1",
      rack: [tile],
      lastDroppedTile: tile,
      droppedTiles: [tile],
    });
    const p2 = makePlayer({
      id: "p2",
      socketId: "socket-2",
      rack: [makeTile("old-t2")],
      lastDroppedTile: null,
      droppedTiles: [makeTile("old-t3")],
    });
    return makeGame({
      players: [p1, p2],
      pool: [],
      status,
      currentPlayerIndex: 1,
      hasDrawnThisTurn: true,
      winnerId: status === "finished" ? "p1" : null,
    });
  }

  it("deals 14 new tiles to each player and resets game state", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    mocks.getGame.mockResolvedValue(makeFinishedGame("finished"));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("rematch", { code: "TEST12" });

    const savedGame: Game = mocks.saveGame.mock.calls[0][0];
    expect(savedGame.status).toBe("playing");
    expect(savedGame.currentPlayerIndex).toBe(0);
    expect(savedGame.hasDrawnThisTurn).toBe(false);
    expect(savedGame.winnerId).toBeNull();
    expect(savedGame.players[0].rack).toHaveLength(14);
    expect(savedGame.players[1].rack).toHaveLength(14);
    expect(savedGame.pool.length).toBeGreaterThan(0);
  });

  it("resets lastDroppedTile and droppedTiles for every player", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    mocks.getGame.mockResolvedValue(makeFinishedGame("finished"));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("rematch", { code: "TEST12" });

    const savedGame: Game = mocks.saveGame.mock.calls[0][0];
    for (const player of savedGame.players) {
      expect(player.lastDroppedTile).toBeNull();
      expect(player.droppedTiles).toEqual([]);
    }
  });

  it("deals fresh tiles (not the old ones)", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    mocks.getGame.mockResolvedValue(makeFinishedGame("finished"));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("rematch", { code: "TEST12" });

    const savedGame: Game = mocks.saveGame.mock.calls[0][0];
    const allNewIds = new Set([
      ...savedGame.players.flatMap((p) => p.rack.map((t) => t.id)),
      ...savedGame.pool.map((t) => t.id),
    ]);
    expect(allNewIds.has("old-t1")).toBe(false);
    expect(allNewIds.has("old-t2")).toBe(false);
  });

  it("broadcasts rematch-started and turn-changed to the room", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    mocks.getGame.mockResolvedValue(makeFinishedGame("finished"));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("rematch", { code: "TEST12" });

    expect(io._roomEmit).toHaveBeenCalledWith(
      "rematch-started",
      expect.objectContaining({ gameState: expect.objectContaining({ status: "playing" }) })
    );
    expect(io._roomEmit).toHaveBeenCalledWith("turn-changed", { currentPlayerIndex: 0 });
  });

  it("also works when the previous game ended in a draw", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    mocks.getGame.mockResolvedValue(makeFinishedGame("draw"));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("rematch", { code: "TEST12" });

    const savedGame: Game = mocks.saveGame.mock.calls[0][0];
    expect(savedGame.status).toBe("playing");
    expect(savedGame.winnerId).toBeNull();
  });

  it("emits error when a non-player socket requests rematch", async () => {
    const socket = createMockSocket("socket-outsider");
    const io = createMockIo();
    mocks.getGame.mockResolvedValue(makeFinishedGame("finished"));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("rematch", { code: "TEST12" });

    expect(socket.emit).toHaveBeenCalledWith("error", {
      message: "Not a player in this game",
    });
    expect(mocks.saveGame).not.toHaveBeenCalled();
  });

  it("emits error when game is not found", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    mocks.getGame.mockResolvedValue(null);

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("rematch", { code: "TEST12" });

    expect(socket.emit).toHaveBeenCalledWith("error", { message: "Game not found" });
    expect(mocks.saveGame).not.toHaveBeenCalled();
  });

  it("emits error when game is still in progress", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    mocks.getGame.mockResolvedValue(makeGame({ players: [makePlayer(), makePlayer()], status: "playing" }));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("rematch", { code: "TEST12" });

    expect(socket.emit).toHaveBeenCalledWith("error", { message: "Game is not over yet" });
    expect(mocks.saveGame).not.toHaveBeenCalled();
  });

  it("emits error when game is still in waiting state", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    mocks.getGame.mockResolvedValue(makeGame({ players: [makePlayer()], status: "waiting" }));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("rematch", { code: "TEST12" });

    expect(socket.emit).toHaveBeenCalledWith("error", { message: "Game is not over yet" });
  });

  it("emits error when fewer than 2 players remain", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    mocks.getGame.mockResolvedValue(
      makeGame({ players: [makePlayer()], status: "finished", winnerId: "player-1" })
    );

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("rematch", { code: "TEST12" });

    expect(socket.emit).toHaveBeenCalledWith("error", { message: "Not enough players for rematch" });
    expect(mocks.saveGame).not.toHaveBeenCalled();
  });

  it("all tiles are accounted for across racks and pool after rematch", async () => {
    const socket = createMockSocket("socket-1");
    const io = createMockIo();
    mocks.getGame.mockResolvedValue(makeFinishedGame("finished"));

    registerSocketHandlers(io as never, socket as never);
    await socket.trigger("rematch", { code: "TEST12" });

    const savedGame: Game = mocks.saveGame.mock.calls[0][0];
    const total =
      savedGame.players.reduce((sum, p) => sum + p.rack.length, 0) + savedGame.pool.length;
    expect(total).toBe(106);
  });
});
