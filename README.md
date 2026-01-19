# Romanian Rummy Online - A **vibe-coded** project

Online multiplayer Romanian Rummy ("remi pe tablă" variant). 2-4 players with private racks, draw-and-drop gameplay, and jokers. This project was done with Claude Code as an experiment. 

## Game Rules

### How to Play
1. Each player starts with **14 private tiles** (no one sees your tiles)
2. On your turn: **Draw → Rearrange → Drop**
3. **Win** when all 14 tiles in your rack form valid melds

### Turn Structure
1. **Draw** (mandatory): Take one tile from:
   - The pool (face down), OR
   - The last dropped tile from the player on your left (face up)
2. **Rearrange** (optional): Organize tiles in your rack into melds
3. **Drop** (mandatory): Discard one tile face up
4. **Announce** (optional): If all remaining tiles form valid melds, declare win!

### Valid Melds
- **Run**: 3+ consecutive numbers of the same color (e.g., 4-5-6 red)
- **Group**: 3-4 tiles of the same number in different colors (e.g., 7-7-7)
- **Joker**: Can substitute any tile in a meld

### Game End
- **Win**: First player to form all tiles into valid melds
- **Draw**: Pool runs out before anyone wins

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend:** Express + Socket.IO
- **State:** Redis
- **Drag-and-drop:** @dnd-kit

## Project Status

### Phase 1: Foundation ✅
- Game creation/joining with 4-character codes
- Socket.IO room management
- Redis state persistence

### Phase 2: Game Logic ✅
- 106-tile pool (2 sets of 1-13 in 4 colors + 2 jokers)
- Meld validation (runs, groups, joker handling)
- Turn logic and win/draw conditions

### Phase 3: UI Core ✅
- Game board layout with rack at bottom, opponents on top
- Tile components with color-coded display
- Drag-and-drop tile rearrangement
- Draw options (pool or neighbor's tile)
- Announce win button with validation

### Phase 4: Multiplayer Sync ✅
- Player disconnect/reconnect handling
- Session persistence via localStorage
- Skip turn for disconnected players (60s timeout)
- Leave game functionality

### Phase 5: Polish (Next)
- Responsive mobile layout
- Touch-friendly drag-and-drop
- Animations and sound effects
- Error toasts and loading states

## Prerequisites

- Node.js (v18 or higher)
- Redis server (via Docker recommended)

## Setup

### 1. Install Redis (Docker)

```bash
docker run -d --name rummikub-redis -p 6379:6379 redis:latest
```

### 2. Install Dependencies

```bash
# Install server dependencies
cd server
yarn install

# Install client dependencies
cd ../client
yarn install
```

### 3. Configure Environment (Optional)

Default values work for local development. To customize:

```bash
# Server
cd server
cp .env.example .env

# Client
cd ../client
cp .env.example .env
```

## Running the Application

### Development Mode

**Terminal 1 - Server:**
```bash
cd server
yarn dev
```
Server runs on `http://localhost:3000`

**Terminal 2 - Client:**
```bash
cd client
yarn dev
```
Client runs on `http://localhost:5173`

### Testing Multiplayer

1. Open `http://localhost:5173` in your browser
2. Enter your name and click "Create New Game"
3. Note the 4-character game code
4. Open another browser window (or incognito)
5. Enter a different name and the game code, then click "Join Game"
6. Once 2-4 players have joined, the host can start the game

## Project Structure

```
/client
  /src
    /components
      Tile.tsx          # Single tile display
      SortableTile.tsx  # Draggable tile wrapper
      Meld.tsx          # Group of tiles forming a meld
      Rack.tsx          # Player's private rack with DnD
      DrawOptions.tsx   # Pool and neighbor tile options
      TurnIndicator.tsx # Current turn display
      OpponentInfo.tsx  # Opponent status display
      GameActions.tsx   # Drop/announce buttons
      Lobby.tsx         # Game creation/joining
      WaitingRoom.tsx   # Pre-game lobby
      Game.tsx          # Main game UI
    /hooks
      useSocket.ts         # Socket.IO connection
      usePlayerIdentity.ts # localStorage persistence
    /lib
      validation.ts     # Meld validation functions
    /types
      index.ts          # TypeScript types

/server
  /src
    /game
      state.ts          # Game state management (Redis)
      validation.ts     # Server-side validation
      tiles.ts          # Tile generation, shuffle, deal
    /socket
      handlers.ts       # Socket event handlers
    /redis
      client.ts         # Redis connection
    index.ts            # Server entry point
  /types
    index.ts            # TypeScript types
```

## Socket Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `create-game` | - | Creates a new game |
| `join-game` | `{ code, playerName }` | Join existing game |
| `start-game` | `{ code }` | Host starts the game |
| `draw-from-pool` | `{ code }` | Draw tile from pool |
| `draw-from-neighbor` | `{ code }` | Take left neighbor's dropped tile |
| `drop-tile` | `{ code, tileId }` | Drop a tile (ends turn) |
| `announce-win` | `{ code, melds }` | Declare win with meld arrangement |
| `leave-game` | `{ code }` | Leave current game |
| `reconnect-game` | `{ code, playerId }` | Reconnect to existing game |
| `request-skip-turn` | `{ code }` | Skip disconnected player's turn |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `game-created` | `{ code }` | Game created successfully |
| `player-joined` | `{ player, gameState }` | Player joined |
| `game-started` | `{ gameState }` | Game has started |
| `turn-changed` | `{ currentPlayerIndex }` | Turn passed |
| `tile-drawn` | `{ tile, gameState }` | You drew a tile |
| `player-drew-tile` | `{ playerIndex, poolSize }` | Other player drew |
| `tile-dropped` | `{ playerIndex, tile }` | Tile was dropped |
| `game-over` | `{ winnerId, gameState, winningMelds?, isDraw? }` | Game ended |
| `reconnect-success` | `{ player, gameState }` | Reconnection successful |
| `reconnect-failed` | `{ reason }` | Reconnection failed |
| `player-disconnected` | `{ playerId, playerName, gameState }` | Player went offline |
| `player-reconnected` | `{ playerId, gameState }` | Player came back online |
| `player-left` | `{ playerId, playerName, gameState }` | Player left the game |
| `turn-skipped` | `{ skippedPlayerId, skippedPlayerName, gameState }` | Turn was skipped |
| `error` | `{ message }` | Error occurred |

## Redis Commands (Debugging)

```bash
# Connect to Redis CLI
docker exec -it rummikub-redis redis-cli

# View all games
KEYS *

# View specific game
GET game:ABCD

# View socket-game mappings
KEYS socket_game:*

# Clear all data
FLUSHALL
```

## License

ISC
