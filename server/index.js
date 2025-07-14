const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const GameServer = require('./gameServer');
const { GAME_CONFIG } = require('./config');

const app = express();
const httpServer = createServer(app);

// Security middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// Basic security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Rate limiting and abuse protection
const connectionLimits = new Map();
const MAX_CONNECTIONS_PER_IP = 20; // Increased for shared networks (families, offices, etc.)
const MAX_MESSAGES_PER_MINUTE = 10000; // 10k messages/minute = ~167/second (very generous)
const MAX_JOIN_ATTEMPTS_PER_MINUTE = 20; // Increased for shared networks
const messageCounts = new Map();
const joinAttempts = new Map();

// Clean up old rate limit data every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of connectionLimits.entries()) {
    if (now - data.lastSeen > 60000) {
      connectionLimits.delete(key);
    }
  }
  for (const [key, data] of messageCounts.entries()) {
    if (now - data.timestamp > 60000) {
      messageCounts.delete(key);
    }
  }
  for (const [key, data] of joinAttempts.entries()) {
    if (now - data.timestamp > 60000) {
      joinAttempts.delete(key);
    }
  }
}, 60000);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? true : ["http://localhost:3001", "http://localhost:5173"],
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  allowEIO3: true,
  transports: ['polling', 'websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e6,
  allowRequest: (req, callback) => {
    // Temporarily disable rate limiting to debug connection issues
    callback(null, true);
  }
});

// Health check endpoint (must come before catch-all route)
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    connections: io.engine.clientsCount || 0,
    rateLimits: {
      activeConnections: connectionLimits.size,
      totalConnections: Array.from(connectionLimits.values()).reduce((sum, data) => sum + data.count, 0)
    }
  };
  res.json(health);
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
  console.log(`New connection: ${socket.id}`);
  
  // Track message rate for this socket
  const socketId = socket.id;
  messageCounts.set(socketId, { count: 0, timestamp: Date.now() });
  
  // Handle player join
  socket.on('join', (playerName) => {
    // Join-specific rate limiting (separate from game messages)
    const clientIP = socket.handshake.address;
    const joinData = joinAttempts.get(clientIP) || { count: 0, timestamp: Date.now() };
    if (joinData.count >= MAX_JOIN_ATTEMPTS_PER_MINUTE) {
      console.log(`Join rate limit exceeded for ${clientIP}`);
      return;
    }
    
    // Input validation and sanitization
    if (!playerName || typeof playerName !== 'string' || playerName.length > 20) {
      console.log(`Invalid player name from ${socketId}: ${playerName}`);
      return;
    }
    
    // Sanitize player name (remove potentially harmful characters)
    const sanitizedName = playerName
      .trim()
      .replace(/[<>\"'&]/g, '') // Remove HTML/script characters
      .substring(0, 20); // Ensure max length
    
    if (sanitizedName.length === 0) {
      console.log(`Empty player name after sanitization from ${socketId}`);
      return;
    }
    
    console.log(`Player ${sanitizedName} (${socket.id}) joining`);
    gameServer.addPlayer(socket.id, sanitizedName);
    socket.emit('yourId', socket.id);
    
    // Update join attempt count
    joinData.count++;
    joinData.timestamp = Date.now();
    joinAttempts.set(clientIP, joinData);
  });
  
  // Handle player input
  socket.on('input', (input) => {
    // Rate limiting check
    const msgData = messageCounts.get(socketId);
    if (msgData && msgData.count > MAX_MESSAGES_PER_MINUTE) {
      return;
    }
    
    // Comprehensive input validation
    if (!input || typeof input !== 'object') {
      return;
    }
    
    // Validate input properties
    const validInput = {
      up: Boolean(input.up),
      down: Boolean(input.down),
      left: Boolean(input.left),
      right: Boolean(input.right),
      mouseX: Number(input.mouseX) || 0,
      mouseY: Number(input.mouseY) || 0,
      shooting: Boolean(input.shooting)
    };
    
    // Sanitize mouse coordinates (prevent extreme values)
    validInput.mouseX = Math.max(-10000, Math.min(10000, validInput.mouseX));
    validInput.mouseY = Math.max(-10000, Math.min(10000, validInput.mouseY));
    
    gameServer.handlePlayerInput(socket.id, validInput);
    
    // Update message count
    if (msgData) {
      msgData.count++;
      msgData.timestamp = Date.now();
    }
  });
  
  // Handle upgrade selection
  socket.on('selectUpgrade', (upgradeIndex) => {
    // Rate limiting check
    const msgData = messageCounts.get(socketId);
    if (msgData && msgData.count > MAX_MESSAGES_PER_MINUTE) {
      return;
    }
    
    // Input validation
    if (typeof upgradeIndex !== 'number' || upgradeIndex < 0 || upgradeIndex > 2) {
      return;
    }
    
    gameServer.handleUpgradeSelection(socket.id, upgradeIndex);
    
    // Update message count
    if (msgData) {
      msgData.count++;
      msgData.timestamp = Date.now();
    }
  });
  
  // Handle dev level up
  socket.on('devLevelUp', () => {
    // Rate limiting check
    const msgData = messageCounts.get(socketId);
    if (msgData && msgData.count > MAX_MESSAGES_PER_MINUTE) {
      return;
    }
    
    // Anti-cheat: Limit dev level ups to prevent abuse
    const devLevelUpData = messageCounts.get(socketId + '_dev') || { count: 0, timestamp: Date.now() };
    if (devLevelUpData.count >= 10) { // Max 10 dev level ups per minute
      console.log(`Dev level up rate limit exceeded for ${socketId}`);
      return;
    }
    
    gameServer.handleDevLevelUp(socket.id);
    
    // Update message count
    if (msgData) {
      msgData.count++;
      msgData.timestamp = Date.now();
    }
    
    // Update dev level up count
    devLevelUpData.count++;
    devLevelUpData.timestamp = Date.now();
    messageCounts.set(socketId + '_dev', devLevelUpData);
  });
  
  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log(`Player ${socket.id} disconnected: ${reason}`);
    gameServer.removePlayer(socket.id);
    
    // Clean up rate limiting data
    messageCounts.delete(socketId);
    
    // Update connection count for IP
    const clientIP = socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                    socket.handshake.headers['x-real-ip'] || 
                    socket.handshake.address;
    
    // Skip cleanup for internal IPs
    if (clientIP && !clientIP.startsWith('127.') && !clientIP.startsWith('::1') && 
        !clientIP.startsWith('10.') && !clientIP.startsWith('172.') && !clientIP.startsWith('192.168.')) {
      const ipData = connectionLimits.get(clientIP);
      if (ipData && ipData.count > 0) {
        ipData.count--;
        console.log(`Disconnect from ${clientIP}: ${ipData.count}/${MAX_CONNECTIONS_PER_IP}`);
        if (ipData.count === 0) {
          connectionLimits.delete(clientIP);
        }
      }
    }
  });
  
  // Handle connection errors
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
  });
  
  // Handle ping (keep-alive)
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
httpServer.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
  console.log(`Game server started with config:`, GAME_CONFIG);
}); 