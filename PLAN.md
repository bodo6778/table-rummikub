# Rummikub Online - Project Plan

## Overview

Online multiplayer Rummikub (Romanian "remi pe tablă" variant) where each player melds on their own board, not a shared table. 4 players, full manipulation rules, jokers included.

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Backend:** Express + Socket.IO
- **State:** Redis
- **Styling:** Tailwind
- **Drag-and-drop:** @dnd-kit or react-dnd

## Data Models

### Tile

```ts
type Tile = {
  id: string;
  color: "red" | "blue" | "yellow" | "black";
  number: number; // 1-13
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
  rack: Tile[]; // tiles in hand
  board: Meld[]; // player's meld area
  hasInitialMeld: boolean; // passed 30-point threshold
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
  status: "waiting" | "playing" | "finished";
  winnerId: string | null;
};
```

## Socket Events

### Client → Server

- `create-game` → creates game, returns code
- `join-game` { code, playerName }
- `start-game`
- `draw-tile`
- `end-turn` { board: Meld[] } → server validates
- `leave-game`

### Server → Client

- `game-created` { code }
- `player-joined` { player }
- `game-started` { gameState }
- `turn-changed` { currentPlayerIndex }
- `game-state-update` { gameState }
- `invalid-turn` { reason }
- `game-over` { winnerId }

## Phases

### Phase 1: Foundation (2-3 days)

- [ ] Initialize Vite + React + TypeScript project
- [ ] Set up Express server with Socket.IO
- [ ] Set up Redis connection (use redis or ioredis package)
- [ ] Implement socket room management
- [ ] Create/join game flow with 4-character codes
- [ ] Basic lobby UI: enter name, create or join game
- [ ] Store game state in Redis

### Phase 2: Game Logic (5-6 days)

- [ ] Tile pool generator (106 tiles: 2 sets of 1-13 in 4 colors + 2 jokers)
- [ ] Shuffle and deal 14 tiles per player
- [ ] Meld validation functions:
  - [ ] isValidRun(tiles) - same color, consecutive numbers, 3+ tiles
  - [ ] isValidGroup(tiles) - same number, different colors, 3-4 tiles
  - [ ] isValidMeld(tiles) - run or group
  - [ ] calculateMeldPoints(meld) - for initial 30-point check
  - [ ] isValidBoard(melds) - all melds valid
- [ ] Joker handling in validation (joker can substitute any tile)
- [ ] Initial meld check (first meld must total 30+ points, no jokers counting)
- [ ] Turn logic: must draw if no valid meld made
- [ ] Win condition: player empties their rack

### Phase 3: UI Core (5-6 days)

- [ ] Game layout: rack at bottom, personal board above, opponents on sides/top
- [ ] Tile component (handle colors, numbers, joker display)
- [ ] Rack component (horizontal tile row)
- [ ] Board component (grid/flex area for melds)
- [ ] Meld component (group of tiles)
- [ ] Drag-and-drop setup:
  - [ ] Drag tiles from rack to board
  - [ ] Drag tiles within board to rearrange
  - [ ] Drag tiles between melds
  - [ ] Create new meld by dropping tiles in empty area
- [ ] Opponents display (show their boards or just tile/meld counts)
- [ ] Draw pile (click to draw)
- [ ] Turn indicator
- [ ] End turn button (disabled if board invalid)

### Phase 4: Multiplayer Sync (3-4 days)

- [ ] Broadcast state on turn end
- [ ] Server-side validation before accepting turn
- [ ] Reject invalid turns and revert client state
- [ ] Handle player disconnect/reconnect (store socketId, allow rejoin)
- [ ] Game over broadcast and UI

### Phase 5: Polish (3-4 days)

- [ ] Responsive layout for mobile
- [ ] Touch-friendly drag-and-drop
- [ ] Tile animations (draw, place, invalid shake)
- [ ] Sound effects (optional)
- [ ] Error toasts
- [ ] LocalStorage player ID for future leaderboard linking
- [ ] Loading states

## File Structure (suggested)

```
/client
  /src
    /components
      Tile.tsx
      Rack.tsx
      Board.tsx
      Meld.tsx
      Lobby.tsx
      Game.tsx
      OpponentView.tsx
    /hooks
      useSocket.ts
      useGame.ts
    /lib
      validation.ts  # pure meld validation functions
      tiles.ts       # tile generation, shuffle
    /types
      index.ts
    App.tsx
    main.tsx
/server
  /src
    index.ts         # Express + Socket.IO setup
    /game
      state.ts       # game state management
      validation.ts  # server-side validation (can share with client)
      tiles.ts
    /socket
      handlers.ts    # socket event handlers
    /redis
      client.ts
  /types
    index.ts
```

## Notes

- Validation logic should be shared or mirrored between client and server
- Client validates optimistically, server is source of truth
- Redis key structure: `game:{code}` → JSON stringified game state
- Future: add persistent player IDs and leaderboard table in PostgreSQL
