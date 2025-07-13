const { GAME_CONFIG } = require('../../server/config');

describe('Loot System', () => {
  let gameServer;
  let mockIO;
  let player;

  beforeEach(() => {
    mockIO = createMockIO();
    gameServer = createGameServer(mockIO);
    player = createMockPlayer();
    gameServer.players.set(player.id, player);
  });

  afterEach(() => {
    if (gameServer) {
      gameServer.destroy();
    }
  });

  describe('Loot Spawning', () => {
    test('should spawn loot within arena bounds', () => {
      const initialLootCount = gameServer.loot.size;
      
      // Mock Math.random to control spawn
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.01); // Below spawn rate
      
      gameServer.spawnLoot();
      
      expect(gameServer.loot.size).toBe(initialLootCount + 1);
      
      const loot = Array.from(gameServer.loot.values())[0];
      expect(loot.x).toBeGreaterThanOrEqual(0);
      expect(loot.x).toBeLessThanOrEqual(GAME_CONFIG.ARENA_WIDTH);
      expect(loot.y).toBeGreaterThanOrEqual(0);
      expect(loot.y).toBeLessThanOrEqual(GAME_CONFIG.ARENA_HEIGHT);
      
      Math.random = originalRandom;
    });

    test('should not spawn loot when at max count', () => {
      // Fill up to max loot count
      for (let i = 0; i < GAME_CONFIG.MAX_LOOT_COUNT; i++) {
        const loot = createMockLoot({ id: `loot${i}` });
        gameServer.loot.set(loot.id, loot);
      }
      
      const initialLootCount = gameServer.loot.size;
      
      // Mock Math.random to force spawn attempt
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.01);
      
      gameServer.spawnLoot();
      
      expect(gameServer.loot.size).toBe(initialLootCount);
      
      Math.random = originalRandom;
    });

    test('should spawn loot with correct value range', () => {
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.01);
      
      gameServer.spawnLoot();
      
      const loot = Array.from(gameServer.loot.values())[0];
      expect(loot.value).toBeGreaterThanOrEqual(GAME_CONFIG.LOOT_VALUE_RANGE[0]);
      expect(loot.value).toBeLessThanOrEqual(GAME_CONFIG.LOOT_VALUE_RANGE[1]);
      
      Math.random = originalRandom;
    });

    test('should spawn loot with correct timeout', () => {
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.01);
      
      gameServer.spawnLoot();
      
      const loot = Array.from(gameServer.loot.values())[0];
      expect(loot.timeout).toBe(GAME_CONFIG.LOOT_TIMEOUT);
      expect(loot.createdAt).toBeDefined();
      
      Math.random = originalRandom;
    });
  });

  describe('Loot Collection', () => {
    test('should collect loot and give XP to player', () => {
      const loot = createMockLoot({ value: 25 });
      const initialXp = player.xp;
      
      gameServer.collectLoot(player, loot);
      
      expect(player.xp).toBe(initialXp + loot.value);
    });

    test('should trigger level up when XP threshold is reached', () => {
      const nextLevelXp = gameServer.getXpForLevel(2);
      player.xp = nextLevelXp - 10;
      
      const loot = createMockLoot({ value: 15 });
      
      gameServer.collectLoot(player, loot);
      
      expect(player.level).toBe(2);
      expect(player.xp).toBe(5); // (nextLevelXp - 10) + 15 - nextLevelXp
    });

    test('should not trigger level up when XP is insufficient', () => {
      const nextLevelXp = gameServer.getXpForLevel(2);
      player.xp = nextLevelXp - 10;
      
      const loot = createMockLoot({ value: 5 });
      
      gameServer.collectLoot(player, loot);
      
      expect(player.level).toBe(1);
      expect(player.xp).toBe(nextLevelXp - 5);
    });
  });

  describe('Loot Drop on Death', () => {
    test('should drop loot worth half player XP on death', () => {
      player.xp = 100;
      const expectedLootValue = Math.floor(player.xp * GAME_CONFIG.LOOT_DROP_RATIO);
      
      gameServer.handlePlayerDeath(player);
      
      const loot = Array.from(gameServer.loot.values())[0];
      expect(loot.value).toBe(expectedLootValue);
      expect(loot.x).toBe(player.x);
      expect(loot.y).toBe(player.y);
    });

    test('should not drop loot if player has no XP', () => {
      player.xp = 0;
      const initialLootCount = gameServer.loot.size;
      
      gameServer.handlePlayerDeath(player);
      
      expect(gameServer.loot.size).toBe(initialLootCount);
    });

    test('should reset player stats on death', () => {
      player.xp = 100;
      player.level = 5;
      player.weapons.marksman = 3;
      player.passives.focusFire = 2;
      
      gameServer.handlePlayerDeath(player);
      
      expect(player.hp).toBe(GAME_CONFIG.PLAYER_BASE_STATS.hp);
      expect(player.maxHp).toBe(GAME_CONFIG.PLAYER_BASE_STATS.maxHp);
      expect(player.speed).toBe(GAME_CONFIG.PLAYER_BASE_STATS.speed);
      expect(player.xp).toBe(0);
      expect(player.level).toBe(1);
      expect(player.weapons).toEqual({});
      expect(player.passives).toEqual({});
      expect(player.legendaryUnlocks).toEqual({});
      expect(player.legendaryChosen).toEqual({});
    });

    test('should respawn player at random position', () => {
      const originalX = player.x;
      const originalY = player.y;
      
      gameServer.handlePlayerDeath(player);
      
      expect(player.x).not.toBe(originalX);
      expect(player.y).not.toBe(originalY);
      expect(player.x).toBeGreaterThanOrEqual(0);
      expect(player.x).toBeLessThanOrEqual(GAME_CONFIG.ARENA_WIDTH);
      expect(player.y).toBeGreaterThanOrEqual(0);
      expect(player.y).toBeLessThanOrEqual(GAME_CONFIG.ARENA_HEIGHT);
    });

    test('should emit player death event', () => {
      gameServer.handlePlayerDeath(player);
      
      expect(mockIO.emit).toHaveBeenCalledWith('playerDied', {
        id: player.id,
        killer: 'Unknown'
      });
    });
  });

  describe('Loot Cleanup', () => {
    test('should remove expired loot', () => {
      const loot = createMockLoot({
        createdAt: Date.now() - GAME_CONFIG.LOOT_TIMEOUT - 1000 // Expired
      });
      gameServer.loot.set(loot.id, loot);
      
      const initialLootCount = gameServer.loot.size;
      
      gameServer.cleanup();
      
      expect(gameServer.loot.size).toBe(initialLootCount - 1);
      expect(gameServer.loot.has(loot.id)).toBe(false);
    });

    test('should not remove non-expired loot', () => {
      const loot = createMockLoot({
        createdAt: Date.now() - 1000 // Not expired
      });
      gameServer.loot.set(loot.id, loot);
      
      const initialLootCount = gameServer.loot.size;
      
      gameServer.cleanup();
      
      expect(gameServer.loot.size).toBe(initialLootCount);
      expect(gameServer.loot.has(loot.id)).toBe(true);
    });
  });

  describe('Loot Collision Detection', () => {
    test('should detect loot collection within collection radius', () => {
      const loot = createMockLoot({
        x: player.x + GAME_CONFIG.LOOT_COLLECTION_RADIUS - 5,
        y: player.y
      });
      gameServer.loot.set(loot.id, loot);
      
      const initialXp = player.xp;
      
      gameServer.checkCollisions();
      
      expect(player.xp).toBe(initialXp + loot.value);
      expect(gameServer.loot.has(loot.id)).toBe(false);
    });

    test('should not detect collection outside collection radius', () => {
      const loot = createMockLoot({
        x: player.x + GAME_CONFIG.LOOT_COLLECTION_RADIUS + 10,
        y: player.y
      });
      gameServer.loot.set(loot.id, loot);
      
      const initialXp = player.xp;
      
      gameServer.checkCollisions();
      
      expect(player.xp).toBe(initialXp);
      expect(gameServer.loot.has(loot.id)).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle loot with invalid value', () => {
      const loot = createMockLoot({ value: -5 });
      
      expect(() => gameServer.collectLoot(player, loot)).not.toThrow();
      expect(player.xp).toBe(-5);
    });

    test('should handle loot with very large value', () => {
      const loot = createMockLoot({ value: 999999 });
      
      expect(() => gameServer.collectLoot(player, loot)).not.toThrow();
      // Player will level up multiple times, so XP will be reduced
      expect(player.xp).toBeLessThan(999999);
      expect(player.level).toBeGreaterThan(1);
    });

    test('should handle loot spawning with edge case random values', () => {
      const originalRandom = Math.random;
      
      // Test with random value above spawn rate
      Math.random = jest.fn(() => 0.5);
      const initialCount = gameServer.loot.size;
      gameServer.spawnLoot();
      expect(gameServer.loot.size).toBe(initialCount);
      
      // Test with random value at spawn rate boundary
      Math.random = jest.fn(() => GAME_CONFIG.LOOT_SPAWN_RATE);
      gameServer.spawnLoot();
      expect(gameServer.loot.size).toBe(initialCount);
      
      Math.random = originalRandom;
    });

    test('should handle loot cleanup with missing createdAt', () => {
      const loot = createMockLoot();
      delete loot.createdAt;
      gameServer.loot.set(loot.id, loot);
      
      expect(() => gameServer.cleanup()).not.toThrow();
    });
  });
}); 