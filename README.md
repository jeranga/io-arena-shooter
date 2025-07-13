# .io Arena Shooter

A browser-based multiplayer arena shooter where players collect loot, level up, and choose upgrades to become stronger. Built with Node.js, Socket.IO, and HTML5 Canvas.

## Features

- **Real-time multiplayer gameplay** with up to 32 concurrent players
- **Progression system** with XP, levels, and upgrades
- **6 different upgrade types** (Speed, Fire Rate, Damage, Bullet Size, Bullet Speed, Health)
- **Loot collection** and player death drops
- **Instant respawn** with base stats reset
- **Smooth 60 FPS gameplay** with client-side prediction
- **Responsive controls** (WASD/Arrow keys + mouse)

## Tech Stack

### Client-side
- Vanilla JavaScript (ES 2023)
- HTML5 Canvas 2D API
- Vite (dev server + bundler)
- Socket.IO-client v4

### Server-side
- Node.js 20 LTS
- Express 4 (static hosting + health check)
- Socket.IO v4 (real-time messaging)
- uuid (unique IDs)

### Tooling & Ops
- ESLint + Prettier (linting & formatting)
- Jest (unit tests)
- Docker (containerization)
- Fly.io (deployment)

## Quick Start

### Prerequisites
- Node.js 20+ 
- npm or yarn

### Development Setup

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd io-arena-shooter
   npm install
   ```

2. **Start development servers**
   ```bash
   npm run dev
   ```
   This starts both the server (port 3000) and client dev server (port 3001)

3. **Open your browser**
   Navigate to `http://localhost:3001`

### Production Build

1. **Build the client**
   ```bash
   npm run build
   ```

2. **Start the server**
   ```bash
   npm start
   ```

## Game Controls

- **WASD** or **Arrow Keys** - Movement
- **Mouse** - Aim
- **Left Click** - Shoot (continuous, rate-limited)
- **1-3** - Choose upgrade when leveling up

## Game Mechanics

### Progression
- **XP Curve**: 0, 100, 250, 450, 700, 1000
- **Level Up**: Choose 1 of 3 random upgrades
- **Upgrades**: Speed +15%, Fire Rate -15%, Damage +1, Bullet Radius +10%, Bullet Speed +10%, Max HP +20%

### Combat
- **Bullet TTL**: 2 seconds
- **Loot Timeout**: 60 seconds
- **Death**: Drop 50% of XP as loot, respawn after 1 second
- **Health**: 100 base HP

### Arena
- **Size**: 2000x2000 pixels
- **Grid**: 50px background grid
- **Camera**: Follows player with smooth movement

## Development

### Project Structure
```
├── client/                 # Client-side code
│   ├── index.html         # Main HTML file
│   └── main.js            # Game client logic
├── server/                # Server-side code
│   ├── index.js           # Express + Socket.IO server
│   ├── gameServer.js      # Game logic and state management
│   ├── config.js          # Game configuration
│   └── public/            # Built client files (generated)
├── tests/                 # Unit tests
├── package.json           # Dependencies and scripts
├── vite.config.js         # Vite configuration
├── Dockerfile             # Container configuration
└── fly.toml              # Fly.io deployment config
```

### Available Scripts

- `npm run dev` - Start development servers
- `npm run dev:server` - Start server only
- `npm run dev:client` - Start client dev server
- `npm run build` - Build client for production
- `npm start` - Start production server
- `npm test` - Run unit tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Testing

Run the test suite:
```bash
npm test
```

Run tests with coverage:
```bash
npm test -- --coverage
```

## Deployment

### Docker

1. **Build the image**
   ```bash
   docker build -t io-arena-shooter .
   ```

2. **Run the container**
   ```bash
   docker run -p 3000:3000 io-arena-shooter
   ```

### Fly.io

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Deploy**
   ```bash
   fly deploy
   ```

The app will be available at `https://io-arena-shooter.fly.dev`

## Performance Targets

- **60 FPS** on desktop Chrome (4 GHz CPU)
- **<5 KB/s** per client average network usage
- **Up to 32** concurrent players per room
- **50 Hz** server tick rate (20ms intervals)
- **100ms** snapshot broadcast interval

## Configuration

Environment variables:
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port (default: 3000)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run `npm test` and `npm run lint`
6. Submit a pull request

## License

MIT License - see LICENSE file for details 