const { GAME_CONFIG } = require('../../server/config');

describe('GameServer Core Functionality', () => {
  let gameServer;
  let mockIO;

  beforeEach(() => {
    mockIO = createMockIO();
    gameServer = createGameServer(mockIO);
  });

  afterEach(() => {
    if (gameServer) {
      gameServer.destroy();
    }
  });

  describe('Constructor and Initialization', () => {
    test('should initialize with correct properties', () => {
      expect(gameServer.io).toBe(mockIO);
      expect(gameServer.config).toBe(GAME_CONFIG);
      expect(gameServer.players).toBeInstanceOf(Map);
      expect(gameServer.bullets).toBeInstanceOf(Map);
      expect(gameServer.loot).toBeInstanceOf(Map);
      expect(gameServer.tickCount).toBe(0);
      expect(gameServer.lastSnapshot).toBe(0);
      expect(gameServer.gameLoop).toBeDefined();
    });

    test('should start game loop with correct tick rate', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      const newGameServer = createGameServer();
      
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        1000 / GAME_CONFIG.TICK_RATE
      );
      
      newGameServer.destroy();
      setIntervalSpy.mockRestore();
    });
  });

  describe('Player Management', () => {
    test('should add player correctly', () => {
      const socketId = 'test-socket';
      const playerName = 'TestPlayer';
      
      gameServer.addPlayer(socketId, playerName);
      
      expect(gameServer.players.has(socketId)).toBe(true);
      const player = gameServer.players.get(socketId);
      expect(player.id).toBe(socketId);
      expect(player.name).toBe(playerName);
      expect(player.hp).toBe(GAME_CONFIG.PLAYER_BASE_STATS.hp);
      expect(player.maxHp).toBe(GAME_CONFIG.PLAYER_BASE_STATS.maxHp);
      expect(player.speed).toBe(GAME_CONFIG.PLAYER_BASE_STATS.speed);
      expect(player.level).toBe(1);
      expect(player.xp).toBe(0);
      expect(player.weapons).toEqual({});
      expect(player.passives).toEqual({});
    });

    test('should generate random player name if none provided', () => {
      const socketId = 'test-socket';
      
      gameServer.addPlayer(socketId);
      
      const player = gameServer.players.get(socketId);
      expect(player.name).toMatch(/^Player\d+$/);
    });

    test('should emit playerJoined event when adding player', () => {
      const socketId = 'test-socket';
      const playerName = 'TestPlayer';
      
      gameServer.addPlayer(socketId, playerName);
      
      expect(mockIO.emit).toHaveBeenCalledWith('playerJoined', {
        id: socketId,
        name: playerName
      });
    });

    test('should remove player correctly', () => {
      const socketId = 'test-socket';
      gameServer.addPlayer(socketId, 'TestPlayer');
      
      gameServer.removePlayer(socketId);
      
      expect(gameServer.players.has(socketId)).toBe(false);
      expect(mockIO.emit).toHaveBeenCalledWith('playerLeft', { id: socketId });
    });

    test('should handle player input correctly', () => {
      const socketId = 'test-socket';
      gameServer.addPlayer(socketId, 'TestPlayer');
      
      const input = { up: true, mouseX: 10, mouseY: 20 };
      gameServer.handlePlayerInput(socketId, input);
      
      const player = gameServer.players.get(socketId);
      expect(player.input.up).toBe(true);
      expect(player.input.mouseX).toBe(10);
      expect(player.input.mouseY).toBe(20);
    });
  });

  describe('Game Loop and Ticking', () => {
    test('should increment tick count on each tick', () => {
      const initialTickCount = gameServer.tickCount;
      
      gameServer.tick();
      
      expect(gameServer.tickCount).toBe(initialTickCount + 1);
    });

    test('should call all update methods during tick', () => {
      const updatePlayersSpy = jest.spyOn(gameServer, 'updatePlayers');
      const updateBulletsSpy = jest.spyOn(gameServer, 'updateBullets');
      const checkCollisionsSpy = jest.spyOn(gameServer, 'checkCollisions');
      const spawnLootSpy = jest.spyOn(gameServer, 'spawnLoot');
      const cleanupSpy = jest.spyOn(gameServer, 'cleanup');
      const broadcastSnapshotSpy = jest.spyOn(gameServer, 'broadcastSnapshot');
      
      gameServer.tick();
      
      expect(updatePlayersSpy).toHaveBeenCalled();
      expect(updateBulletsSpy).toHaveBeenCalled();
      expect(checkCollisionsSpy).toHaveBeenCalled();
      expect(spawnLootSpy).toHaveBeenCalled();
      expect(cleanupSpy).toHaveBeenCalled();
      
      // broadcastSnapshot is called conditionally based on SNAPSHOT_RATE
      if (gameServer.tickCount % GAME_CONFIG.SNAPSHOT_RATE === 0) {
        expect(broadcastSnapshotSpy).toHaveBeenCalled();
      }
    });
  });

  describe('Cleanup and Destruction', () => {
    test('should destroy game loop on destroy', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      gameServer.destroy();
      
      expect(clearIntervalSpy).toHaveBeenCalledWith(gameServer.gameLoop);
    });

    test('should handle destroy when game loop is null', () => {
      gameServer.gameLoop = null;
      
      expect(() => gameServer.destroy()).not.toThrow();
    });
  });

  describe('Snapshot Broadcasting', () => {
    test('should broadcast correct snapshot format', () => {
      const player = createMockPlayer();
      const bullet = createMockBullet();
      const loot = createMockLoot();
      
      gameServer.players.set(player.id, player);
      gameServer.bullets.set(bullet.id, bullet);
      gameServer.loot.set(loot.id, loot);
      
      gameServer.broadcastSnapshot();
      
      expect(mockIO.emit).toHaveBeenCalledWith('gameState', {
        players: expect.arrayContaining([
          expect.objectContaining({
            id: player.id,
            name: player.name,
            x: player.x,
            y: player.y,
            hp: player.hp,
            maxHp: player.maxHp,
            level: player.level,
            xp: player.xp,
            weapons: player.weapons,
            passives: player.passives,
            legendaryUnlocks: player.legendaryUnlocks,
            legendaryChosen: player.legendaryChosen
          })
        ]),
        bullets: expect.arrayContaining([
          expect.objectContaining({
            id: bullet.id,
            x: bullet.x,
            y: bullet.y,
            radius: bullet.radius,
            weaponId: bullet.weaponId,
            isOrbiting: bullet.isOrbiting || false
          })
        ]),
        loot: expect.arrayContaining([
          expect.objectContaining({
            id: loot.id,
            x: loot.x,
            y: loot.y,
            value: loot.value
          })
        ])
      });
    });
  });
}); 