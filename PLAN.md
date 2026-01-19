# Rummikub Online - Project Plan

## Overview

Online multiplayer Romanian Rummy ("remi pe tablă" variant). 2-4 players, private racks, draw-and-drop gameplay, jokers included.

## Game Rules (Romanian Rummy)

### Core Mechanics
- Each player has a **private rack** of 14 tiles (no one sees your tiles)
- On your turn: **Draw → Rearrange → Drop**
- **Win condition**: All 14 tiles in your rack form valid melds → announce and win
- **Draw game**: If pool runs out before anyone wins, game ends in a draw

### Turn Structure
1. **Draw** (mandatory): Take one tile from:
   - The pool (face down), OR
   - The last dropped tile from the player on your left (face up)
2. **Rearrange** (optional): Organize tiles in your rack into melds (private)
3. **Drop** (mandatory): Discard one tile face up (player on your right can take it)
4. **Announce** (optional): If all remaining tiles form valid melds, declare win

### Valid Melds
- **Run**: 3+ consecutive numbers of the same color (e.g., 4-5-6 red)
- **Group**: 3-4 tiles of the same number in different colors (e.g., 7-7-7)
- **Joker**: Can substitute any tile in a meld

### Tile Pool
- 106 tiles total: 2 sets of 1-13 in 4 colors (104 tiles) + 2 jokers

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Backend:** Express + Socket.IO
- **State:** Redis
- **Styling:** Tailwind
- **Drag-and-drop:** @dnd-kit

## Data Models

### Tile

```ts
type Tile = {
  id: string;
  color: "red" | "blue" | "yellow" | "black";
  number: number; // 1-13, 0 for jokers
  isJoker: boolean;
};
```

### Meld

```ts
type Meld = {
  id: string;
  tiles: Tile[]; // valid run or group
};
```

### Player

```ts
type Player = {
  id: string;
  name: string;
  socketId: string;
  rack: Tile[]; // 14 tiles (15 during turn after drawing)
  lastDroppedTile: Tile | null; // face up, player on right can take it
};
```

### Game

```ts
type Game = {
  id: string;
  code: string; // join code
  players: Player[];
  pool: Tile[]; // draw pile
  currentPlayerIndex: number;
  status: "waiting" | "playing" | "finished" | "draw";
  winnerId: string | null;
  hasDrawnThisTurn: boolean;
};
```

## Socket Events

### Client → Server

- `create-game` → creates game, returns code
- `join-game` { code, playerName }
- `start-game` { code }
- `draw-from-pool` { code } → draw from pool
- `draw-from-neighbor` { code } → take left neighbor's dropped tile
- `drop-tile` { code, tileId } → drop a tile, ends turn
- `announce-win` { code, melds } → declare win with meld arrangement
- `leave-game` { code }

### Server → Client

- `game-created` { code }
- `player-joined` { player, gameState }
- `game-started` { gameState }
- `turn-changed` { currentPlayerIndex }
- `tile-drawn` { tile, gameState } → sent only to drawer
- `player-drew-tile` { playerIndex, poolSize } → sent to others
- `tile-dropped` { playerIndex, tile }
- `neighbor-tile-taken` { takerIndex, neighborIndex }
- `game-state-update` { gameState }
- `invalid-announce` { reason }
- `game-over` { winnerId, gameState, winningMelds?, isDraw? }
- `error` { message }

## Phases

### Phase 1: Foundation ✅ COMPLETED

- [x] Initialize Vite + React + TypeScript project
- [x] Set up Express server with Socket.IO
- [x] Set up Redis connection (ioredis)
- [x] Implement socket room management
- [x] Create/join game flow with 4-character codes
- [x] Basic lobby UI: enter name, create or join game
- [x] Store game state in Redis

### Phase 2: Game Logic ✅ COMPLETED

- [x] Tile pool generator (106 tiles)
- [x] Shuffle and deal 14 tiles per player
- [x] Meld validation functions:
  - [x] isValidRun(tiles)
  - [x] isValidGroup(tiles)
  - [x] isValidMeld(tiles)
  - [x] areAllMeldsValid(melds)
  - [x] canAnnounceWin(rack, melds)
- [x] Joker handling in validation
- [x] Turn logic: draw → drop
- [x] Win condition: all tiles form valid melds
- [x] Draw condition: pool empty

### Phase 3: UI Core ✅ COMPLETED

- [x] Game layout: rack at bottom, opponents info on top
- [x] Tile component (colors, numbers, joker display)
- [x] Rack component (private tile arrangement)
- [x] Meld component (group of tiles for organizing)
- [x] Drag-and-drop within rack to rearrange and form melds
- [x] Draw options (pool button, neighbor's tile button)
- [x] Drop tile interaction
- [x] Left neighbor's dropped tile display
- [x] Turn indicator
- [x] Announce win button (enabled when all tiles form valid melds)

### Phase 4: Multiplayer Sync ✅ COMPLETED

- [x] Handle player disconnect/reconnect (store socketId, allow rejoin)
- [x] Sync rack state on reconnect
- [x] Handle edge cases (player leaves mid-game, etc.)
- [x] Game over broadcast and UI

### Phase 5: Polish

- [ ] Responsive layout for mobile
- [ ] Touch-friendly drag-and-drop
- [ ] Tile animations (draw, drop, win celebration)
- [ ] Sound effects (optional)
- [ ] Error toasts
- [ ] Loading states
- [ ] LocalStorage player ID for persistence

## File Structure

```
/client
  /src
    /components
      Tile.tsx          # Single tile display
      Rack.tsx          # Player's private rack with melds
      Meld.tsx          # Group of tiles forming a meld
      Lobby.tsx         # Create/join game
      WaitingRoom.tsx   # Pre-game lobby
      Game.tsx          # Main game UI
      DrawOptions.tsx   # Pool and neighbor tile options
    /hooks
      useSocket.ts      # Socket.IO connection
      useGame.ts        # Game state management
    /lib
      validation.ts     # Meld validation functions
    /types
      index.ts
    App.tsx
    main.tsx
/server
  /src
    index.ts            # Express + Socket.IO setup
    /game
      state.ts          # Game state management (Redis)
      validation.ts     # Server-side validation
      tiles.ts          # Tile generation, shuffle, deal
    /socket
      handlers.ts       # Socket event handlers
    /redis
      client.ts         # Redis connection
  /types
    index.ts
```

## Notes

- Validation logic is mirrored between client and server
- Client validates optimistically, server is source of truth
- Redis key structure: `game:{code}` → JSON stringified game state
- Racks are private: server only sends your own rack, not opponents'
- Dropped tiles are public: everyone sees last dropped tile per player
