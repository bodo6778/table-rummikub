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

### Phase 5: Polish logic ✅ COMPLETED

- [x] Error toasts
- [x] Loading states
- [x] LocalStorage player ID for persistence (done in Phase 4)

### Phase 6: Polish UI

#### 6.1 — Visual Redesign & Theme
- [ ] Define a cohesive color palette and extend Tailwind theme (custom colors, shadows, fonts)
- [ ] Redesign Lobby screen (card layout, branding, visual hierarchy)
- [ ] Redesign WaitingRoom screen (player avatars, ready states, better layout)
- [ ] Redesign Game screen overall layout (spacing, sections, visual flow)
- [ ] Polish Tile component (realistic tile look — rounded corners, embossed feel, better color contrast)
- [ ] Polish Rack area (felt/table texture, clear meld grouping visuals)
- [ ] Polish Opponent cards (cleaner info display, avatar colors, status badges)
- [ ] Polish DrawOptions & GameActions (icon buttons, clearer affordances)
- [ ] Game over / win screen redesign (modal with results, winner highlight)
- [ ] Add proper icons (replace Unicode with SVG icons or icon library)

#### 6.2 — Responsive Layout
- [x] Make Game layout stack vertically on mobile (opponents → draw → rack)
- [x] Tile size scaling for small screens (smaller tiles on mobile)
- [x] Rack horizontal scroll or wrap for narrow viewports
- [x] Lobby & WaitingRoom responsive tweaks (full-width on mobile)
- [ ] Test and fix at common breakpoints (375px, 768px, 1024px, 1440px)

#### 6.3 — Touch & Mobile UX
- [x] Touch-friendly drag-and-drop (larger hit targets, touch delay handling)
- [x] Tap-to-select + tap-to-place alternative to drag (for small screens)
- [x] Prevent page scroll during drag operations
- [x] Mobile-friendly button sizes (min 44px touch targets)

#### 6.4 — Animations & Transitions
- [x] Tile draw animation (flash glow when tile enters rack)
- [x] Tile drop animation (scale-down + fade-out before emit)
- [x] Meld validation feedback animation (green glow on valid, shake on invalid)
- [x] Turn change transition (smooth border/shadow shift on opponent cards)
- [x] Win celebration animation (confetti particles + bounce-in title)
- [x] Page/screen transitions (fade-in on lobby → waiting → game)
- [x] Smooth rack rearrangement (dnd-kit layout animation with 200ms ease)

#### 6.5 — Sound Effects
- [x] Tile place/drop sound
- [x] Draw from pool sound
- [x] Turn notification sound
- [x] Win fanfare
- [x] Error/invalid action sound

### Phase 7: Testing ✅ COMPLETED

- [x] Setup Vitest in server/ and client/
- [x] `server/src/game/tiles.test.ts` — tile generation (106 tiles, 2 jokers, correct distribution)
- [x] `server/src/game/validation.test.ts` — meld validation (runs, groups, jokers, edge cases)
- [x] `client/src/lib/validation.test.ts` — client-side validation mirror
- [x] `server/src/game/state.test.ts` — game state with mocked Redis
- [x] `server/src/socket/handlers.test.ts` — game flow integration (create, join, draw, drop, announce)

## Future Phases

### Gameplay
- ~~**Dropped tile history per player**~~ ✅ — show all tiles each player has discarded via a hover/tap popup on the opponent card. Both `lastDroppedTile` (for draw-from-neighbor) and `droppedTiles: Tile[]` (for history) are tracked.
- ~~**Rematch**~~ ✅ — restart a new game with the same players after one ends, without going back to lobby
- **Turn timer** — configurable per-turn countdown; auto-drop or auto-skip when time runs out (foundation already exists in `request-skip-turn`)
- ~~**Tile sorting**~~ ✅ — sort unassigned rack tiles by color or number (buttons in rack header)

### Social
- **In-game chat** — text chat scoped to the current game room
- **Leaderboard** — standings page showing win/loss/draw counts across the friend group

### Auth & Profiles
- **Invite-only registration** — host controls who can sign up via a one-time invite link; no random public signups
- **Simple auth** — username + password, no email required
- **Player profiles** — persistent stats: games played, wins, losses, draws

### Infrastructure
- **Rate limiting** — protect socket events from spam (e.g. `express-rate-limit` + per-socket event throttling)
- **Local server deployment** — nginx reverse proxy config, environment setup for self-hosted LAN/DNS use
- **Dedicated server migration** — production deployment guide (nginx, process manager, Redis persistence)

### UX
- **Dark mode** — toggle between light and dark themes
- **PWA / installable** — web app manifest so friends can install to mobile home screen
- **Background turn notifications** — browser notification or tab title update when it's your turn

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
- Dropped tiles are public: everyone sees last dropped tile per player (future: full drop history per player)
