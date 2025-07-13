const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const GameServer = require('./gameServer');
const { GAME_CONFIG } = require('./config');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? true : ["http://localhost:3001", "http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Health check endpoint (must come before catch-all route)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Serve static files from client directory
app.use(express.static('client'));

// Serve index.html for all routes (SPA)
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: 'client' });
});

// Initialize game server
const gameServer = new GameServer(io, GAME_CONFIG);

// Socket.IO connection handling
io.on('connection', (socket) => {
  
  // Handle player join
  socket.on('join', (playerName) => {
    gameServer.addPlayer(socket.id, playerName);
    socket.emit('yourId', socket.id);
  });
  
  // Handle player input
  socket.on('input', (input) => {
    gameServer.handlePlayerInput(socket.id, input);
  });
  
  // Handle upgrade selection
  socket.on('selectUpgrade', (upgradeIndex) => {
    gameServer.handleUpgradeSelection(socket.id, upgradeIndex);
  });
  
  // Handle dev level up
  socket.on('devLevelUp', () => {
    gameServer.handleDevLevelUp(socket.id);
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    gameServer.removePlayer(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
httpServer.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log(`Game server started with config:`, GAME_CONFIG);
}); 