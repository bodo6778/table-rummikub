import { Server, Socket } from "socket.io";
import {
  createGame,
  getGame,
  saveGame,
  setSocketGame,
  getSocketGame,
  removeSocketGame,
  sanitizeGameState,
} from "../game/state.js";
import { Game, Player, Meld } from "../../types/index.js";
import { generateTilePool, dealTiles } from "../game/tiles.js";
import { canAnnounceWin } from "../game/validation.js";

const DISCONNECT_TIMEOUT_MS = 60000; // 1 minute to reconnect
const MAX_PLAYER_NAME_LENGTH = 20;
const RATE_LIMIT_WINDOW_MS = 10000;
const RATE_LIMIT_MAX_EVENTS = 60;

function validatePlayerName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0 || trimmed.length > MAX_PLAYER_NAME_LENGTH) return null;
  return trimmed;
}

/** Send a personalized sanitized game state event to every player in the game. */
function broadcastToRoom(
  io: Server,
  game: Game,
  event: string,
  dataFn: (sanitized: Game) => object
): void {
  for (const player of game.players) {
    const sanitized = sanitizeGameState(game, player.socketId);
    io.to(player.socketId).emit(event, dataFn(sanitized));
  }
}

export function registerSocketHandlers(io: Server, socket: Socket) {
  // Per-socket rate limiting
  let eventCount = 0;
  let windowStart = Date.now();

  socket.use(([_event], next) => {
    const now = Date.now();
    if (now - windowStart > RATE_LIMIT_WINDOW_MS) {
      eventCount = 0;
      windowStart = now;
    }
    eventCount++;
    if (eventCount > RATE_LIMIT_MAX_EVENTS) {
      socket.emit("error", { message: "Rate limit exceeded" });
      return; // drop event without calling next()
    }
    next();
  });

  socket.on("create-game", async () => {
    try {
      const game = await createGame();
      socket.emit("game-created", { code: game.code });
    } catch (error) {
      console.error("Error creating game:", error);
      socket.emit("error", { message: "Failed to create game" });
    }
  });

  socket.on("join-game", async ({ code, playerName }: { code: string; playerName: unknown }) => {
    try {
      const validName = validatePlayerName(playerName);
      if (!validName) {
        socket.emit("error", { message: "Invalid player name (1–20 characters)" });
        return;
      }

      const game = await getGame(code);

      if (!game) {
        socket.emit("error", { message: "Game not found" });
        return;
      }

      if (game.status !== "waiting") {
        socket.emit("error", { message: "Game already started" });
        return;
      }

      if (game.players.length >= 4) {
        socket.emit("error", { message: "Game is full" });
        return;
      }

      const player: Player = {
        id: crypto.randomUUID(),
        reconnectToken: crypto.randomUUID(),
        name: validName,
        socketId: socket.id,
        rack: [],
        lastDroppedTile: null,
        droppedTiles: [],
        connected: true,
        disconnectedAt: null,
      };

      game.players.push(player);
      await saveGame(game);
      await setSocketGame(socket.id, code);
      socket.join(code);

      // Send own player (includes reconnectToken) + sanitized game state
      socket.emit("player-joined", {
        player,
        gameState: sanitizeGameState(game, socket.id),
      });

      // Broadcast sanitized state to others (no rack/token for anyone)
      for (const p of game.players.filter((p) => p.socketId !== socket.id)) {
        io.to(p.socketId).emit("player-joined", {
          player: { ...player, reconnectToken: undefined },
          gameState: sanitizeGameState(game, p.socketId),
        });
      }
    } catch (error) {
      console.error("Error joining game:", error);
      socket.emit("error", { message: "Failed to join game" });
    }
  });

  socket.on("start-game", async ({ code }: { code: string }) => {
    try {
      const game = await getGame(code);

      if (!game) {
        socket.emit("error", { message: "Game not found" });
        return;
      }

      if (game.players.length < 2) {
        socket.emit("error", { message: "Need at least 2 players to start" });
        return;
      }

      if (game.status !== "waiting") {
        socket.emit("error", { message: "Game already started" });
        return;
      }

      // Only the host (first player to join) can start the game
      if (game.players[0]?.socketId !== socket.id) {
        socket.emit("error", { message: "Only the host can start the game" });
        return;
      }

      const tilePool = generateTilePool();
      const { racks, pool } = dealTiles(tilePool, game.players.length);

      game.players.forEach((player, index) => {
        player.rack = racks[index];
        player.lastDroppedTile = null;
        player.droppedTiles = [];
      });

      game.pool = pool;
      game.status = "playing";
      game.currentPlayerIndex = 0;
      game.hasDrawnThisTurn = false;

      await saveGame(game);

      broadcastToRoom(io, game, "game-started", (sanitized) => ({ gameState: sanitized }));
      io.to(code).emit("turn-changed", { currentPlayerIndex: game.currentPlayerIndex });
    } catch (error) {
      console.error("Error starting game:", error);
      socket.emit("error", { message: "Failed to start game" });
    }
  });

  socket.on("draw-from-pool", async ({ code }: { code: string }) => {
    try {
      const game = await getGame(code);

      if (!game) {
        socket.emit("error", { message: "Game not found" });
        return;
      }

      if (game.status !== "playing") {
        socket.emit("error", { message: "Game not in progress" });
        return;
      }

      const currentPlayer = game.players[game.currentPlayerIndex];
      if (currentPlayer.socketId !== socket.id) {
        socket.emit("error", { message: "Not your turn" });
        return;
      }

      if (game.hasDrawnThisTurn) {
        socket.emit("error", { message: "Already drew this turn" });
        return;
      }

      if (game.pool.length === 0) {
        game.status = "draw";
        await saveGame(game);
        broadcastToRoom(io, game, "game-over", (sanitized) => ({
          winnerId: null,
          gameState: sanitized,
          isDraw: true,
        }));
        return;
      }

      const drawnTile = game.pool.shift()!;
      currentPlayer.rack.push(drawnTile);
      game.hasDrawnThisTurn = true;

      await saveGame(game);

      // Only send drawn tile to the current player (rack is private)
      socket.emit("tile-drawn", {
        tile: drawnTile,
        gameState: sanitizeGameState(game, socket.id),
      });
      socket.to(code).emit("player-drew-tile", {
        playerIndex: game.currentPlayerIndex,
        poolSize: game.pool.length,
      });
    } catch (error) {
      console.error("Error drawing tile:", error);
      socket.emit("error", { message: "Failed to draw tile" });
    }
  });

  socket.on("draw-from-neighbor", async ({ code }: { code: string }) => {
    try {
      const game = await getGame(code);

      if (!game) {
        socket.emit("error", { message: "Game not found" });
        return;
      }

      if (game.status !== "playing") {
        socket.emit("error", { message: "Game not in progress" });
        return;
      }

      const currentPlayer = game.players[game.currentPlayerIndex];
      if (currentPlayer.socketId !== socket.id) {
        socket.emit("error", { message: "Not your turn" });
        return;
      }

      if (game.hasDrawnThisTurn) {
        socket.emit("error", { message: "Already drew this turn" });
        return;
      }

      const leftNeighborIndex =
        (game.currentPlayerIndex - 1 + game.players.length) % game.players.length;
      const leftNeighbor = game.players[leftNeighborIndex];

      if (!leftNeighbor.lastDroppedTile) {
        socket.emit("error", { message: "No tile available from neighbor" });
        return;
      }

      const tile = leftNeighbor.lastDroppedTile;
      currentPlayer.rack.push(tile);
      leftNeighbor.lastDroppedTile = null;
      game.hasDrawnThisTurn = true;

      await saveGame(game);

      socket.emit("tile-drawn", {
        tile,
        gameState: sanitizeGameState(game, socket.id),
      });
      io.to(code).emit("neighbor-tile-taken", {
        takerIndex: game.currentPlayerIndex,
        neighborIndex: leftNeighborIndex,
      });
    } catch (error) {
      console.error("Error drawing from neighbor:", error);
      socket.emit("error", { message: "Failed to draw from neighbor" });
    }
  });

  socket.on("drop-tile", async ({ code, tileId }: { code: string; tileId: string }) => {
    try {
      const game = await getGame(code);

      if (!game) {
        socket.emit("error", { message: "Game not found" });
        return;
      }

      if (game.status !== "playing") {
        socket.emit("error", { message: "Game not in progress" });
        return;
      }

      const currentPlayer = game.players[game.currentPlayerIndex];
      if (currentPlayer.socketId !== socket.id) {
        socket.emit("error", { message: "Not your turn" });
        return;
      }

      if (!game.hasDrawnThisTurn) {
        socket.emit("error", { message: "Must draw before dropping" });
        return;
      }

      const tileIndex = currentPlayer.rack.findIndex((t) => t.id === tileId);
      if (tileIndex === -1) {
        socket.emit("error", { message: "Tile not in rack" });
        return;
      }

      const droppedTile = currentPlayer.rack.splice(tileIndex, 1)[0];
      currentPlayer.lastDroppedTile = droppedTile;
      currentPlayer.droppedTiles = [...currentPlayer.droppedTiles, droppedTile];

      game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
      game.hasDrawnThisTurn = false;

      await saveGame(game);

      io.to(code).emit("tile-dropped", {
        playerIndex: (game.currentPlayerIndex - 1 + game.players.length) % game.players.length,
        tile: droppedTile,
      });
      io.to(code).emit("turn-changed", { currentPlayerIndex: game.currentPlayerIndex });
    } catch (error) {
      console.error("Error dropping tile:", error);
      socket.emit("error", { message: "Failed to drop tile" });
    }
  });

  socket.on("announce-win", async ({ code, melds, winningTileId }: { code: string; melds: Meld[]; winningTileId: string }) => {
    try {
      const game = await getGame(code);

      if (!game) {
        socket.emit("error", { message: "Game not found" });
        return;
      }

      if (game.status !== "playing") {
        socket.emit("error", { message: "Game not in progress" });
        return;
      }

      const player = game.players.find((p) => p.socketId === socket.id);
      if (!player) {
        socket.emit("error", { message: "Player not found" });
        return;
      }

      // Can only announce win on your own turn
      if (game.players[game.currentPlayerIndex]?.id !== player.id) {
        socket.emit("error", { message: "Not your turn" });
        return;
      }

      const validation = canAnnounceWin(player.rack, melds, winningTileId);
      if (!validation.valid) {
        socket.emit("invalid-announce", { reason: validation.reason });
        return;
      }

      game.status = "finished";
      game.winnerId = player.id;

      await saveGame(game);

      broadcastToRoom(io, game, "game-over", (sanitized) => ({
        winnerId: player.id,
        gameState: sanitized,
        winningMelds: melds,
      }));
    } catch (error) {
      console.error("Error announcing win:", error);
      socket.emit("error", { message: "Failed to announce win" });
    }
  });

  socket.on("rematch", async ({ code }: { code: string }) => {
    try {
      const game = await getGame(code);

      if (!game) {
        socket.emit("error", { message: "Game not found" });
        return;
      }

      if (game.status !== "finished" && game.status !== "draw") {
        socket.emit("error", { message: "Game is not over yet" });
        return;
      }

      // Only a player in this game can request a rematch
      const requester = game.players.find((p) => p.socketId === socket.id);
      if (!requester) {
        socket.emit("error", { message: "Not a player in this game" });
        return;
      }

      if (game.players.length < 2) {
        socket.emit("error", { message: "Not enough players for rematch" });
        return;
      }

      const tilePool = generateTilePool();
      const { racks, pool } = dealTiles(tilePool, game.players.length);

      game.players.forEach((player, index) => {
        player.rack = racks[index];
        player.lastDroppedTile = null;
        player.droppedTiles = [];
      });

      game.pool = pool;
      game.status = "playing";
      game.currentPlayerIndex = 0;
      game.hasDrawnThisTurn = false;
      game.winnerId = null;

      await saveGame(game);

      broadcastToRoom(io, game, "rematch-started", (sanitized) => ({ gameState: sanitized }));
      io.to(code).emit("turn-changed", { currentPlayerIndex: 0 });
    } catch (error) {
      console.error("Error starting rematch:", error);
      socket.emit("error", { message: "Failed to start rematch" });
    }
  });

  socket.on("leave-game", async ({ code }: { code: string }) => {
    try {
      const game = await getGame(code);

      if (!game) {
        await removeSocketGame(socket.id);
        return;
      }

      const leavingPlayer = game.players.find((p) => p.socketId === socket.id);
      const wasCurrentTurn = game.players[game.currentPlayerIndex]?.socketId === socket.id;

      game.players = game.players.filter((p) => p.socketId !== socket.id);

      if (wasCurrentTurn && game.status === "playing" && game.players.length > 0) {
        game.currentPlayerIndex = game.currentPlayerIndex % game.players.length;
        game.hasDrawnThisTurn = false;
      }

      await saveGame(game);
      await removeSocketGame(socket.id);

      socket.leave(code);

      for (const p of game.players) {
        io.to(p.socketId).emit("player-left", {
          playerId: leavingPlayer?.id,
          playerName: leavingPlayer?.name,
          gameState: sanitizeGameState(game, p.socketId),
        });
      }
    } catch (error) {
      console.error("Error leaving game:", error);
    }
  });

  socket.on("request-skip-turn", async ({ code }: { code: string }) => {
    try {
      const game = await getGame(code);

      if (!game || game.status !== "playing") return;

      // Must be a player in the game to request a skip
      const requester = game.players.find((p) => p.socketId === socket.id);
      if (!requester) return;

      const currentPlayer = game.players[game.currentPlayerIndex];
      if (!currentPlayer) return;

      if (currentPlayer.connected) {
        socket.emit("error", { message: "Current player is still connected" });
        return;
      }

      const disconnectTime = currentPlayer.disconnectedAt || 0;
      const timeSinceDisconnect = Date.now() - disconnectTime;

      if (timeSinceDisconnect < DISCONNECT_TIMEOUT_MS) {
        const remainingSeconds = Math.ceil((DISCONNECT_TIMEOUT_MS - timeSinceDisconnect) / 1000);
        socket.emit("error", { message: `Wait ${remainingSeconds}s before skipping` });
        return;
      }

      game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
      game.hasDrawnThisTurn = false;

      await saveGame(game);

      for (const p of game.players) {
        io.to(p.socketId).emit("turn-skipped", {
          skippedPlayerId: currentPlayer.id,
          skippedPlayerName: currentPlayer.name,
          gameState: sanitizeGameState(game, p.socketId),
        });
      }
      io.to(code).emit("turn-changed", { currentPlayerIndex: game.currentPlayerIndex });
    } catch (error) {
      console.error("Error skipping turn:", error);
    }
  });

  socket.on(
    "reconnect-game",
    async ({ code, playerId, reconnectToken }: { code: string; playerId: string; reconnectToken: string }) => {
      try {
        const game = await getGame(code);

        if (!game) {
          socket.emit("reconnect-failed", { reason: "Game not found" });
          return;
        }

        const player = game.players.find((p) => p.id === playerId);
        if (!player) {
          socket.emit("reconnect-failed", { reason: "Player not found in game" });
          return;
        }

        // Verify the secret token — rejects session hijacking attempts
        if (!reconnectToken || player.reconnectToken !== reconnectToken) {
          socket.emit("reconnect-failed", { reason: "Invalid reconnect token" });
          return;
        }

        player.socketId = socket.id;
        player.connected = true;
        player.disconnectedAt = null;

        await saveGame(game);
        await setSocketGame(socket.id, code);
        socket.join(code);

        // Send own player (with token) + sanitized state
        socket.emit("reconnect-success", {
          player,
          gameState: sanitizeGameState(game, socket.id),
        });

        for (const p of game.players.filter((p) => p.socketId !== socket.id)) {
          io.to(p.socketId).emit("player-reconnected", {
            playerId: player.id,
            gameState: sanitizeGameState(game, p.socketId),
          });
        }
      } catch (error) {
        console.error("Error reconnecting:", error);
        socket.emit("reconnect-failed", { reason: "Failed to reconnect" });
      }
    }
  );

  socket.on("disconnect", async () => {
    try {
      const gameCode = await getSocketGame(socket.id);
      if (!gameCode) return;

      const game = await getGame(gameCode);
      if (!game) {
        await removeSocketGame(socket.id);
        return;
      }

      const player = game.players.find((p) => p.socketId === socket.id);
      if (!player) {
        await removeSocketGame(socket.id);
        return;
      }

      player.connected = false;
      player.disconnectedAt = Date.now();

      await saveGame(game);

      for (const p of game.players.filter((p) => p.socketId !== socket.id)) {
        io.to(p.socketId).emit("player-disconnected", {
          playerId: player.id,
          playerName: player.name,
          gameState: sanitizeGameState(game, p.socketId),
        });
      }
    } catch (error) {
      console.error("Error handling disconnect:", error);
    }
  });
}
