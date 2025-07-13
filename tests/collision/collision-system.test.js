const { GAME_CONFIG } = require('../../server/config');

describe('Collision System', () => {
  let gameServer;
  let mockIO;
  let player1, player2;
  let bullet1, bullet2;

  beforeEach(() => {
    mockIO = createMockIO();
    gameServer = createGameServer(mockIO);
    
    player1 = createMockPlayer({ id: 'player1', x: 100, y: 100 });
    player2 = createMockPlayer({ id: 'player2', x: 200, y: 200 });
    
    gameServer.players.set(player1.id, player1);
    gameServer.players.set(player2.id, player2);
  });

  afterEach(() => {
    if (gameServer) {
      gameServer.destroy();
    }
  });

  describe('Bullet vs Bullet Collisions', () => {
    test('should detect collision between two bullets', () => {
      bullet1 = createMockBullet({
        id: 'bullet1',
        x: 150,
        y: 150,
        radius: 10,
        damage: 25
      });
      
      bullet2 = createMockBullet({
        id: 'bullet2',
        ownerId: 'player2',
        x: 155,
        y: 150,
        radius: 10,
        damage: 30
      });
      
      gameServer.bullets.set(bullet1.id, bullet1);
      gameServer.bullets.set(bullet2.id, bullet2);
      
      const initialBulletCount = gameServer.bullets.size;
      
      gameServer.checkCollisions();
      
      // Both bullets should be destroyed due to collision
      expect(gameServer.bullets.size).toBe(initialBulletCount - 2);
      expect(gameServer.bullets.has(bullet1.id)).toBe(false);
      expect(gameServer.bullets.has(bullet2.id)).toBe(false);
    });

    test('should not detect collision when bullets are far apart', () => {
      bullet1 = createMockBullet({
        id: 'bullet1',
        x: 100,
        y: 100,
        radius: 5
      });
      
      bullet2 = createMockBullet({
        id: 'bullet2',
        ownerId: 'player2',
        x: 200,
        y: 200,
        radius: 5
      });
      
      gameServer.bullets.set(bullet1.id, bullet1);
      gameServer.bullets.set(bullet2.id, bullet2);
      
      const initialBulletCount = gameServer.bullets.size;
      
      gameServer.checkCollisions();
      
      // No bullets should be destroyed
      expect(gameServer.bullets.size).toBe(initialBulletCount);
    });

    test('should not detect collision between bullets from same player', () => {
      bullet1 = createMockBullet({
        id: 'bullet1',
        x: 150,
        y: 150,
        radius: 10
      });
      
      bullet2 = createMockBullet({
        id: 'bullet2',
        x: 155,
        y: 150,
        radius: 10
      });
      
      gameServer.bullets.set(bullet1.id, bullet1);
      gameServer.bullets.set(bullet2.id, bullet2);
      
      const initialBulletCount = gameServer.bullets.size;
      
      gameServer.checkCollisions();
      
      // No bullets should be destroyed (same owner)
      expect(gameServer.bullets.size).toBe(initialBulletCount);
    });

    test('should handle saw blocking other bullets', () => {
      const saw = createMockBullet({
        id: 'saw1',
        weaponId: 'saws',
        x: 150,
        y: 150,
        radius: 10,
        damage: 20
      });
      
      const regularBullet = createMockBullet({
        id: 'bullet1',
        x: 155,
        y: 150,
        radius: 5,
        damage: 25
      });
      
      gameServer.bullets.set(saw.id, saw);
      gameServer.bullets.set(regularBullet.id, regularBullet);
      
      gameServer.checkCollisions();
      
      // Saw should remain, regular bullet should be destroyed
      expect(gameServer.bullets.has(saw.id)).toBe(true);
      expect(gameServer.bullets.has(regularBullet.id)).toBe(false);
    });

    test('should destroy both bullets on collision', () => {
      bullet1 = createMockBullet({
        id: 'bullet1',
        x: 150,
        y: 150,
        radius: 10,
        damage: 25
      });
      
      bullet2 = createMockBullet({
        id: 'bullet2',
        ownerId: 'player2',
        x: 155,
        y: 150,
        radius: 10,
        damage: 30
      });
      
      gameServer.bullets.set(bullet1.id, bullet1);
      gameServer.bullets.set(bullet2.id, bullet2);
      
      const initialBulletCount = gameServer.bullets.size;
      
      gameServer.checkCollisions();
      
      // Both bullets should be destroyed
      expect(gameServer.bullets.size).toBe(initialBulletCount - 2);
      expect(gameServer.bullets.has(bullet1.id)).toBe(false);
      expect(gameServer.bullets.has(bullet2.id)).toBe(false);
    });
  });

  describe('Bullet vs Player Collisions', () => {
    test('should detect bullet hitting player', () => {
      bullet1 = createMockBullet({
        id: 'bullet1',
        x: player2.x + GAME_CONFIG.PLAYER_RADIUS - 5,
        y: player2.y,
        radius: 10,
        damage: 25
      });
      
      gameServer.bullets.set(bullet1.id, bullet1);
      
      const initialHp = player2.hp;
      
      gameServer.checkCollisions();
      
      // Player should take damage
      expect(player2.hp).toBe(initialHp - bullet1.damage);
      // Bullet should be destroyed
      expect(gameServer.bullets.has(bullet1.id)).toBe(false);
    });

    test('should not detect collision when bullet is far from player', () => {
      bullet1 = createMockBullet({
        id: 'bullet1',
        x: player2.x + GAME_CONFIG.PLAYER_RADIUS + 20,
        y: player2.y,
        radius: 5,
        damage: 25
      });
      
      gameServer.bullets.set(bullet1.id, bullet1);
      
      const initialHp = player2.hp;
      
      gameServer.checkCollisions();
      
      // Player should not take damage
      expect(player2.hp).toBe(initialHp);
      // Bullet should remain
      expect(gameServer.bullets.has(bullet1.id)).toBe(true);
    });

    test('should not detect collision with own bullets', () => {
      bullet1 = createMockBullet({
        id: 'bullet1',
        x: player1.x + GAME_CONFIG.PLAYER_RADIUS - 5,
        y: player1.y,
        radius: 10,
        damage: 25
      });
      
      gameServer.bullets.set(bullet1.id, bullet1);
      
      const initialHp = player1.hp;
      
      gameServer.checkCollisions();
      
      // Player should not take damage from own bullet
      expect(player1.hp).toBe(initialHp);
    });

    test('should not destroy saws on player collision', () => {
      const saw = createMockBullet({
        id: 'saw1',
        weaponId: 'saws',
        x: player2.x + GAME_CONFIG.PLAYER_RADIUS - 5,
        y: player2.y,
        radius: 10,
        damage: 20
      });
      
      gameServer.bullets.set(saw.id, saw);
      
      const initialHp = player2.hp;
      
      gameServer.checkCollisions();
      
      // Player should take damage
      expect(player2.hp).toBe(initialHp - saw.damage);
      // Saw should remain
      expect(gameServer.bullets.has(saw.id)).toBe(true);
    });

    test('should handle player death when HP reaches 0', () => {
      bullet1 = createMockBullet({
        id: 'bullet1',
        x: player2.x + GAME_CONFIG.PLAYER_RADIUS - 5,
        y: player2.y,
        radius: 10,
        damage: player2.hp + 10 // More than current HP
      });
      
      gameServer.bullets.set(bullet1.id, bullet1);
      
      const handlePlayerDeathSpy = jest.spyOn(gameServer, 'handlePlayerDeath');
      
      gameServer.checkCollisions();
      
      expect(handlePlayerDeathSpy).toHaveBeenCalledWith(player2);
    });
  });

  describe('Player vs Loot Collisions', () => {
    test('should detect player collecting loot', () => {
      const loot = createMockLoot({
        id: 'loot1',
        x: player1.x + GAME_CONFIG.LOOT_COLLECTION_RADIUS - 5,
        y: player1.y,
        value: 25
      });
      
      gameServer.loot.set(loot.id, loot);
      
      const initialXp = player1.xp;
      
      gameServer.checkCollisions();
      
      // Player should gain XP
      expect(player1.xp).toBe(initialXp + loot.value);
      // Loot should be removed
      expect(gameServer.loot.has(loot.id)).toBe(false);
    });

    test('should not detect collection when player is far from loot', () => {
      const loot = createMockLoot({
        id: 'loot1',
        x: player1.x + GAME_CONFIG.LOOT_COLLECTION_RADIUS + 10,
        y: player1.y,
        value: 25
      });
      
      gameServer.loot.set(loot.id, loot);
      
      const initialXp = player1.xp;
      
      gameServer.checkCollisions();
      
      // Player should not gain XP
      expect(player1.xp).toBe(initialXp);
      // Loot should remain
      expect(gameServer.loot.has(loot.id)).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle missing player in bullet collision', () => {
      bullet1 = createMockBullet({
        id: 'bullet1',
        ownerId: 'nonexistent-player',
        x: 150,
        y: 150,
        radius: 10
      });
      
      gameServer.bullets.set(bullet1.id, bullet1);
      
      expect(() => gameServer.checkCollisions()).not.toThrow();
    });

    test('should handle bullets with zero or negative damage', () => {
      bullet1 = createMockBullet({
        id: 'bullet1',
        x: 150,
        y: 150,
        radius: 10,
        damage: 0
      });
      
      bullet2 = createMockBullet({
        id: 'bullet2',
        ownerId: 'player2',
        x: 155,
        y: 150,
        radius: 10,
        damage: 25
      });
      
      gameServer.bullets.set(bullet1.id, bullet1);
      gameServer.bullets.set(bullet2.id, bullet2);
      
      gameServer.checkCollisions();
      
      // Bullet with 0 damage should be removed
      expect(gameServer.bullets.has(bullet1.id)).toBe(false);
    });

    test('should handle collision detection with large numbers of entities', () => {
      // Create many bullets and players to test performance
      for (let i = 0; i < 50; i++) {
        const bullet = createMockBullet({
          id: `bullet${i}`,
          x: 100 + i * 2,
          y: 100 + i * 2,
          radius: 5
        });
        gameServer.bullets.set(bullet.id, bullet);
      }
      
      expect(() => gameServer.checkCollisions()).not.toThrow();
    });
  });
}); 