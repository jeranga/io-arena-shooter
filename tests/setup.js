// Test setup and utilities
const { GAME_CONFIG } = require('../server/config');

// Global test utilities
global.createMockPlayer = (overrides = {}) => ({
  id: 'test-player-1',
  name: 'TestPlayer',
  x: 100,
  y: 100,
  vx: 0,
  vy: 0,
  angle: 0,
  hp: GAME_CONFIG.PLAYER_BASE_STATS.hp,
  maxHp: GAME_CONFIG.PLAYER_BASE_STATS.maxHp,
  speed: GAME_CONFIG.PLAYER_BASE_STATS.speed,
  xp: 0,
  level: 1,
  lastShot: 0,
  pendingUpgrades: null,
  weapons: {},
  passives: {},
  legendaryUnlocks: {},
  legendaryChosen: {},
  sawsState: {
    isActive: false,
    lastStateChange: 0,
    currentDuration: 0,
    currentCooldown: 0
  },
  input: { up: false, down: false, left: false, right: false, mouseX: 0, mouseY: 0, shooting: false },
  ...overrides
});

global.createMockBullet = (overrides = {}) => ({
  id: 'test-bullet-1',
  ownerId: 'test-player-1',
  weaponId: 'marksman',
  x: 100,
  y: 100,
  vx: 10,
  vy: 0,
  radius: 5,
  damage: 25,
  ttl: GAME_CONFIG.BULLET_TTL,
  createdAt: Date.now(),
  ...overrides
});

global.createMockLoot = (overrides = {}) => ({
  id: 'test-loot-1',
  x: 200,
  y: 200,
  value: 25,
  timeout: GAME_CONFIG.LOOT_TIMEOUT,
  createdAt: Date.now(),
  ...overrides
});

// Mock Socket.IO
global.createMockSocket = () => ({
  id: 'test-socket-1',
  emit: jest.fn(),
  to: jest.fn().mockReturnThis(),
  broadcast: {
    emit: jest.fn()
  }
});

global.createMockIO = () => ({
  emit: jest.fn(),
  to: jest.fn().mockReturnThis(),
  on: jest.fn(),
  sockets: {
    get: jest.fn()
  }
});

// Test helpers
global.wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

global.createGameServer = (io = null) => {
  const GameServer = require('../server/gameServer');
  const mockIO = io || createMockIO();
  return new GameServer(mockIO, GAME_CONFIG);
};

// Console mock to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}; 