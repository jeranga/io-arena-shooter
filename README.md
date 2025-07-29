# 🎮 IO Arena Shooter

A browser-based multiplayer arena shooter game built with Node.js, Socket.IO, and vanilla JavaScript. Players battle in real-time with various weapons and upgrades in a dynamic arena environment.

## ✨ Features

- **Real-time Multiplayer**: Up to 32 players in a single arena
- **Multiple Weapons**: 6 unique weapon types with different playstyles
- **Progression System**: Level up and choose upgrades to become stronger
- **Passive Abilities**: 6 passive upgrades that enhance your combat abilities
- **Dynamic Combat**: Fast-paced action with projectiles, AoE effects, and strategic positioning
- **Cross-platform**: Works on desktop and mobile browsers

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: Vanilla JavaScript, HTML5 Canvas
- **Build Tool**: Vite
- **Deployment**: Fly.io
- **Real-time Communication**: WebSocket via Socket.IO

## 🚀 Quick Start

### Prerequisites

- Node.js 20.0.0 or higher
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd io-arena-shooter
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

### Development Commands

- `npm run dev` - Start both client and server in development mode
- `npm run dev:server` - Start only the server with hot reload
- `npm run dev:client` - Start only the client with hot reload
- `npm run build` - Build the client for production
- `npm start` - Start the production server

## 🎯 Game Mechanics

### Weapons

1. **Marksman Shots** - High-speed single bullets
2. **Whirling Saws** - Orbiting blades that deal continuous damage
3. **Burst Orbs** - Short-range explosive projectiles
4. **Splat Gun** - Multiple projectiles with random spread
5. **Scatter Mines** - Lobbed explosives that arm on landing
6. **Homing Daggers** - Guided projectiles that track enemies

### Passive Abilities

- **Focus Fire** - Increases projectile speed
- **Quickstep** - Increases movement speed
- **Bigger Payload** - Increases projectile size/AoE radius
- **Overclock** - Reduces weapon cooldowns
- **Hardened Load** - Increases damage
- **Split Shot** - Adds extra projectiles

### Progression

- Collect XP from defeated players and loot drops
- Level up to gain health and choose upgrades
- Legendary upgrades available when combining weapons with their paired passives
- Infinite progression with scaling difficulty

## 🏗️ Architecture

### Server Structure

```
server/
├── index.js          # Main server entry point
├── gameServer.js     # Game logic and state management
└── config.js         # Game configuration and balance
```

### Client Structure

```
client/
├── index.html        # Main HTML file
└── main.js          # Game client logic and rendering
```

### Key Components

- **Game Loop**: 60 FPS server-side game loop with client interpolation
- **State Management**: Centralized game state with player, bullet, and loot tracking
- **Network Protocol**: Optimized Socket.IO communication with rate limiting
- **Collision Detection**: Efficient bullet-player and bullet-bullet collision handling

## 🔧 Configuration

Game balance and settings can be adjusted in `server/config.js`:

- Arena dimensions and player limits
- Weapon damage, cooldowns, and scaling
- XP progression curves
- Loot spawn rates and values
- Network and performance settings

## 🚀 Deployment

### Fly.io Deployment

The project is configured for deployment on Fly.io:

1. **Install Fly CLI**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login to Fly**
   ```bash
   fly auth login
   ```

3. **Deploy**
   ```bash
   ./deploy.sh "Your commit message"
   ```

### Manual Deployment

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Set environment variables**
   ```bash
   export NODE_ENV=production
   export PORT=8080
   ```

3. **Start the server**
   ```bash
   npm start
   ```

## 🔒 Security Features

- **Rate Limiting**: Prevents abuse with connection and message limits
- **Input Validation**: Comprehensive sanitization of all client inputs
- **CORS Protection**: Configured for production and development environments
- **Security Headers**: XSS protection, content type validation, and frame options

## 🎮 Controls

- **WASD** or **Arrow Keys** - Move
- **Mouse** - Aim
- **Left Click** - Shoot
- **Number Keys (1-3)** - Select upgrades when leveling up

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


## 🙏 Acknowledgments

- Built with [Socket.IO](https://socket.io/) for real-time communication
- Deployed on [Fly.io](https://fly.io/) for global performance
- Inspired by classic .io games like Agar.io and Diep.io

## 📞 Support

Have questions or feedback? Reach out on [Twitter](https://twitter.com/jerangutan) or open an issue on GitHub.

---

**Happy gaming! 🎯** 
