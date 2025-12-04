# Rummikub Online

Online multiplayer Rummikub (Romanian "remi pe tabl" variant) where each player melds on their own board. Supports 2-4 players with full manipulation rules and jokers.

## Tech Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend:** Express + Socket.IO
- **State:** Redis
- **Drag-and-drop:** @dnd-kit

## Project Status

### Phase 1: Foundation  COMPLETED

-  Vite + React + TypeScript project initialized
-  Express server with Socket.IO
-  Redis connection setup
-  Socket room management
-  Create/join game flow with 4-character codes
-  Basic lobby UI
-  Game state storage in Redis

### Phase 2: Game Logic (Next)

- [ ] Tile pool generator (106 tiles)
- [ ] Meld validation functions
- [ ] Joker handling
- [ ] Initial meld check (30-point threshold)
- [ ] Turn logic
- [ ] Win condition

## Prerequisites

- Node.js (v18 or higher)
- Redis server running locally or accessible remotely

## Setup

### 1. Install Redis

**Windows:**
```bash
# Using WSL2
wsl --install
# Then install Redis in WSL
sudo apt-get update
sudo apt-get install redis-server
sudo service redis-server start
```

**macOS:**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

### 2. Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 3. Configure Environment

```bash
# Server
cd server
cp .env.example .env
# Edit .env if needed (default values work for local development)

# Client
cd ../client
cp .env.example .env
# Edit .env if needed (default values work for local development)
```

## Running the Application

### Development Mode

Open two terminal windows:

**Terminal 1 - Server:**
```bash
cd server
npm run dev
```

Server will start on `http://localhost:3000`

**Terminal 2 - Client:**
```bash
cd client
npm run dev
```

Client will start on `http://localhost:5173`

### Testing the Multiplayer

1. Open `http://localhost:5173` in your browser
2. Enter your name and click "Create New Game"
3. You'll receive a 4-character game code
4. Open another browser window (or incognito)
5. Enter a different name and the game code, then click "Join Game"
6. Once 2-4 players have joined, the host can start the game

## Project Structure

```
/client                  # React frontend
  /src
    /components          # React components
      Lobby.tsx         # Game creation/joining
      WaitingRoom.tsx   # Pre-game lobby
      Game.tsx          # Main game UI (Phase 3)
    /hooks
      useSocket.ts      # Socket.IO hook
    /lib               # Utility functions
    /types             # TypeScript types
    App.tsx
    main.tsx

/server                 # Express backend
  /src
    /game
      state.ts         # Game state management
      validation.ts    # Server-side validation (Phase 2)
      tiles.ts         # Tile generation (Phase 2)
    /socket
      handlers.ts      # Socket event handlers
    /redis
      client.ts        # Redis connection
    index.ts          # Server entry point
  /types
    index.ts          # Shared TypeScript types
```

## Socket Events

### Client ’ Server

- `create-game` - Creates a new game, returns code
- `join-game` { code, playerName } - Join existing game
- `start-game` { code } - Host starts the game
- `leave-game` { code } - Leave current game

### Server ’ Client

- `game-created` { code } - Game created successfully
- `player-joined` { player, gameState } - Player joined
- `game-started` { gameState } - Game has started
- `game-state-update` { gameState } - State changed
- `error` { message } - Error occurred

## Next Steps (Phase 2)

See [PLAN.md](PLAN.md) for detailed implementation plan.

The next phase involves implementing:
- Tile pool generation and shuffling
- Meld validation (runs and groups)
- Initial meld 30-point threshold
- Turn management and drawing tiles
- Win condition detection

## License

ISC
