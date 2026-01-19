import { Server, Socket } from "socket.io";
import { createGame, getGame, saveGame, setSocketGame, getSocketGame, removeSocketGame } from "../game/state.js";
import { Player, Meld } from "../../types/index.js";
import { generateTilePool, dealTiles } from "../game/tiles.js";
import { canAnnounceWin } from "../game/validation.js";

const DISCONNECT_TIMEOUT_MS = 60000; // 1 minute to reconnect

export function registerSocketHandlers(io: Server, socket: Socket) {
  console.log(`Client connected: ${socket.id}`);

  socket.on("create-game", async () => {
    try {
      const game = await createGame();
      socket.emit("game-created", { code: game.code });
      console.log(`Game created: ${game.code}`);
    } catch (error) {
      console.error("Error creating game:", error);
      socket.emit("error", { message: "Failed to create game" });
    }
  });

  socket.on("join-game", async ({ code, playerName }: { code: string; playerName: string }) => {
    try {
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
        name: playerName,
        socketId: socket.id,
        rack: [],
        lastDroppedTile: null,
        connected: true,
        disconnectedAt: null,
      };

      game.players.push(player);
      await saveGame(game);
      await setSocketGame(socket.id, code);

      socket.join(code);
      socket.emit("player-joined", { player, gameState: game });
      socket.to(code).emit("player-joined", { player, gameState: game });

      console.log(`${playerName} joined game ${code} (${game.players.length}/4)`);
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

      // Generate and deal tiles
      const tilePool = generateTilePool();
      const { racks, pool } = dealTiles(tilePool, game.players.length);

      // Assign racks to players
      game.players.forEach((player, index) => {
        player.rack = racks[index];
        player.lastDroppedTile = null;
      });

      game.pool = pool;
      game.status = "playing";
      game.currentPlayerIndex = 0;
      game.hasDrawnThisTurn = false;

      await saveGame(game);

      io.to(code).emit("game-started", { gameState: game });
      io.to(code).emit("turn-changed", { currentPlayerIndex: game.currentPlayerIndex });
      console.log(`Game ${code} started with ${game.players.length} players`);
    } catch (error) {
      console.error("Error starting game:", error);
      socket.emit("error", { message: "Failed to start game" });
    }
  });

  // Draw from pool
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
        // Game ends in a draw
        game.status = "draw";
        await saveGame(game);
        io.to(code).emit("game-over", { winnerId: null, gameState: game, isDraw: true });
        console.log(`Game ${code} ended in a draw - pool empty`);
        return;
      }

      // Draw a tile from the pool
      const drawnTile = game.pool.shift()!;
      currentPlayer.rack.push(drawnTile);
      game.hasDrawnThisTurn = true;

      await saveGame(game);

      // Only send the drawn tile to the current player (rack is private)
      socket.emit("tile-drawn", { tile: drawnTile, gameState: game });
      // Notify others that a tile was drawn (without revealing it)
      socket.to(code).emit("player-drew-tile", { playerIndex: game.currentPlayerIndex, poolSize: game.pool.length });

      console.log(`${currentPlayer.name} drew from pool`);
    } catch (error) {
      console.error("Error drawing tile:", error);
      socket.emit("error", { message: "Failed to draw tile" });
    }
  });

  // Draw from left neighbor's dropped tile
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

      // Get left neighbor (player before current in turn order)
      const leftNeighborIndex = (game.currentPlayerIndex - 1 + game.players.length) % game.players.length;
      const leftNeighbor = game.players[leftNeighborIndex];

      if (!leftNeighbor.lastDroppedTile) {
        socket.emit("error", { message: "No tile available from neighbor" });
        return;
      }

      // Take the dropped tile
      const tile = leftNeighbor.lastDroppedTile;
      currentPlayer.rack.push(tile);
      leftNeighbor.lastDroppedTile = null;
      game.hasDrawnThisTurn = true;

      await saveGame(game);

      socket.emit("tile-drawn", { tile, gameState: game });
      io.to(code).emit("neighbor-tile-taken", {
        takerIndex: game.currentPlayerIndex,
        neighborIndex: leftNeighborIndex
      });

      console.log(`${currentPlayer.name} took ${leftNeighbor.name}'s dropped tile`);
    } catch (error) {
      console.error("Error drawing from neighbor:", error);
      socket.emit("error", { message: "Failed to draw from neighbor" });
    }
  });

  // Drop a tile (ends turn)
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

      // Find and remove the tile from rack
      const tileIndex = currentPlayer.rack.findIndex((t) => t.id === tileId);
      if (tileIndex === -1) {
        socket.emit("error", { message: "Tile not in rack" });
        return;
      }

      const droppedTile = currentPlayer.rack.splice(tileIndex, 1)[0];
      currentPlayer.lastDroppedTile = droppedTile;

      // Move to next player
      game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
      game.hasDrawnThisTurn = false;

      await saveGame(game);

      io.to(code).emit("tile-dropped", {
        playerIndex: (game.currentPlayerIndex - 1 + game.players.length) % game.players.length,
        tile: droppedTile
      });
      io.to(code).emit("turn-changed", { currentPlayerIndex: game.currentPlayerIndex });

      console.log(`${currentPlayer.name} dropped a tile, turn passed`);
    } catch (error) {
      console.error("Error dropping tile:", error);
      socket.emit("error", { message: "Failed to drop tile" });
    }
  });

  // Announce win
  socket.on("announce-win", async ({ code, melds }: { code: string; melds: Meld[] }) => {
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

      // Find the player announcing
      const player = game.players.find((p) => p.socketId === socket.id);
      if (!player) {
        socket.emit("error", { message: "Player not found" });
        return;
      }

      // Validate the win
      const validation = canAnnounceWin(player.rack, melds);
      if (!validation.valid) {
        socket.emit("invalid-announce", { reason: validation.reason });
        return;
      }

      // Player wins!
      game.status = "finished";
      game.winnerId = player.id;

      await saveGame(game);

      io.to(code).emit("game-over", {
        winnerId: player.id,
        gameState: game,
        winningMelds: melds
      });
      console.log(`${player.name} wins game ${code}!`);
    } catch (error) {
      console.error("Error announcing win:", error);
      socket.emit("error", { message: "Failed to announce win" });
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

      // If player was current turn during active game, advance to next player
      if (wasCurrentTurn && game.status === "playing" && game.players.length > 0) {
        game.currentPlayerIndex = game.currentPlayerIndex % game.players.length;
        game.hasDrawnThisTurn = false;
      }

      await saveGame(game);
      await removeSocketGame(socket.id);

      socket.leave(code);
      socket.to(code).emit("player-left", {
        playerId: leavingPlayer?.id,
        playerName: leavingPlayer?.name,
        gameState: game
      });

      console.log(`${leavingPlayer?.name || "Player"} left game ${code}`);
    } catch (error) {
      console.error("Error leaving game:", error);
    }
  });

  // Request to skip a disconnected player's turn
  socket.on("request-skip-turn", async ({ code }: { code: string }) => {
    try {
      const game = await getGame(code);

      if (!game || game.status !== "playing") {
        return;
      }

      const currentPlayer = game.players[game.currentPlayerIndex];
      if (!currentPlayer) return;

      // Only allow skip if current player is disconnected and has been for a while
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

      // Skip to next player
      game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
      game.hasDrawnThisTurn = false;

      await saveGame(game);

      io.to(code).emit("turn-skipped", {
        skippedPlayerId: currentPlayer.id,
        skippedPlayerName: currentPlayer.name,
        gameState: game
      });
      io.to(code).emit("turn-changed", { currentPlayerIndex: game.currentPlayerIndex });

      console.log(`${currentPlayer.name}'s turn skipped due to disconnect`);
    } catch (error) {
      console.error("Error skipping turn:", error);
    }
  });

  // Reconnect to an existing game
  socket.on("reconnect-game", async ({ code, playerId }: { code: string; playerId: string }) => {
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

      // Update player's socket ID and connection status
      player.socketId = socket.id;
      player.connected = true;
      player.disconnectedAt = null;

      await saveGame(game);
      await setSocketGame(socket.id, code);

      socket.join(code);
      socket.emit("reconnect-success", { player, gameState: game });
      socket.to(code).emit("player-reconnected", { playerId: player.id, gameState: game });

      console.log(`${player.name} reconnected to game ${code}`);
    } catch (error) {
      console.error("Error reconnecting:", error);
      socket.emit("reconnect-failed", { reason: "Failed to reconnect" });
    }
  });

  socket.on("disconnect", async () => {
    console.log(`Client disconnected: ${socket.id}`);

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

      // Mark player as disconnected
      player.connected = false;
      player.disconnectedAt = Date.now();

      await saveGame(game);

      // Notify other players
      socket.to(gameCode).emit("player-disconnected", {
        playerId: player.id,
        playerName: player.name,
        gameState: game
      });

      console.log(`${player.name} disconnected from game ${gameCode}`);

      // If game is in progress and it's this player's turn, start a timeout
      if (game.status === "playing" && game.players[game.currentPlayerIndex]?.id === player.id) {
        // Schedule turn skip after timeout (handled by a separate check or timer)
        // For simplicity, we'll let the client request a turn skip if needed
        console.log(`Disconnected player ${player.name}'s turn - waiting for reconnect`);
      }
    } catch (error) {
      console.error("Error handling disconnect:", error);
    }
  });
}
