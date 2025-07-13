const { GAME_CONFIG } = require('../../server/config');

describe('Game Flow Integration', () => {
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

  describe('Complete Player Lifecycle', () => {
    test('should handle complete player lifecycle: join, play, level up, die, respawn', () => {
      // 1. Player joins
      const socketId = 'test-socket';
      const playerName = 'TestPlayer';
      gameServer.addPlayer(socketId, playerName);
      
      const player = gameServer.players.get(socketId);
      expect(player.name).toBe(playerName);
      expect(player.level).toBe(1);
      expect(player.xp).toBe(0);
      
      // 2. Player gets initial weapon choice
      expect(mockIO.emit).toHaveBeenCalledWith('levelUp', {
        level: 1,
        upgrades: expect.any(Array)
      });
      
      // 3. Player selects weapon
      const upgradeIndex = 0;
      gameServer.handleUpgradeSelection(socketId, upgradeIndex);
      
      expect(player.weapons).not.toEqual({});
      
      // 4. Player collects loot and levels up
      const loot = createMockLoot({ value: GAME_CONFIG.XP_BASE });
      console.log(`Player XP before loot: ${player.xp}`);
      console.log(`Loot value: ${loot.value}`);
      console.log(`XP needed for level 2: ${gameServer.getXpForLevel(2)}`);
      
      gameServer.collectLoot(player, loot);
      
      console.log(`Player XP after loot: ${player.xp}`);
      console.log(`Player level after loot: ${player.level}`);
      
      expect(player.level).toBe(2);
      expect(player.xp).toBe(0);
      
      // 5. Player dies
      player.hp = 0;
      gameServer.handlePlayerDeath(player);
      
      expect(player.hp).toBe(GAME_CONFIG.PLAYER_BASE_STATS.hp);
      expect(player.level).toBe(1);
      expect(player.xp).toBe(0);
      expect(player.weapons).toEqual({});
      
      // 6. Player respawns at new position
      const originalX = player.x;
      const originalY = player.y;
      expect(player.x).not.toBe(originalX);
      expect(player.y).not.toBe(originalY);
    });
  });

  describe('Multiplayer Interactions', () => {
    test('should handle multiple players with weapon interactions', () => {
      // Add two players
      const player1 = createMockPlayer({ id: 'player1', x: 100, y: 100 });
      const player2 = createMockPlayer({ id: 'player2', x: 200, y: 200 });
      
      gameServer.players.set(player1.id, player1);
      gameServer.players.set(player2.id, player2);
      
      // Give them weapons
      player1.weapons.marksman = 1;
      player2.weapons.burst = 1;
      
      // Player 1 shoots at player 2
      gameServer.fireWeapon(player1, 'marksman');
      const bullet = Array.from(gameServer.bullets.values())[0];
      
      // Move bullet to hit player 2
      bullet.x = player2.x + GAME_CONFIG.PLAYER_RADIUS - 5;
      bullet.y = player2.y;
      
      const initialHp = player2.hp;
      gameServer.checkCollisions();
      
      expect(player2.hp).toBe(initialHp - bullet.damage);
      expect(gameServer.bullets.has(bullet.id)).toBe(false);
    });

    test('should handle bullet collision between players', () => {
      const player1 = createMockPlayer({ id: 'player1', x: 100, y: 100 });
      const player2 = createMockPlayer({ id: 'player2', x: 200, y: 200 });
      
      gameServer.players.set(player1.id, player1);
      gameServer.players.set(player2.id, player2);
      
      // Create bullets that will collide
      const bullet1 = createMockBullet({
        id: 'bullet1',
        x: 150,
        y: 150,
        radius: 10,
        damage: 25
      });
      
      const bullet2 = createMockBullet({
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
      
      expect(gameServer.bullets.size).toBe(initialBulletCount - 2);
    });
  });

  describe('Complex Upgrade Scenarios', () => {
    test('should handle legendary unlock progression', () => {
      const player = createMockPlayer();
      gameServer.players.set(player.id, player);
      
      // Give player marksman weapon and focus fire passive
      player.weapons.marksman = 1;
      player.passives.focusFire = 1;
      
      // Level up weapon and passive to max
      for (let i = 1; i < GAME_CONFIG.MAX_WEAPON_LEVEL; i++) {
        player.weapons.marksman = i + 1;
        player.passives.focusFire = i + 1;
      }
      
      // Check for legendary unlock
      gameServer.checkForLegendaryUnlocks(player);
      
      expect(player.legendaryUnlocks.marksman).toBe(true);
      expect(mockIO.to).toHaveBeenCalledWith(player.id);
      expect(mockIO.emit).toHaveBeenCalledWith('legendaryUnlocked', {
        weaponId: 'marksman',
        weaponName: GAME_CONFIG.WEAPONS.marksman.name,
        passiveId: 'focusFire',
        passiveName: GAME_CONFIG.PASSIVES.focusFire.name
      });
      
      // Apply legendary upgrade
      const legendaryUpgrade = {
        type: 'legendary',
        weaponId: 'marksman'
      };
      
      gameServer.applyUpgrade(player, legendaryUpgrade);
      expect(player.legendaryChosen.marksman).toBe(true);
    });

    test('should handle multiple weapon types with passives', () => {
      const player = createMockPlayer();
      gameServer.players.set(player.id, player);
      
      // Give player multiple weapons and passives
      player.weapons.marksman = 2;
      player.weapons.burst = 1;
      player.passives.focusFire = 2;
      player.passives.biggerPayload = 1;
      
      // Fire weapons and check passive effects
      gameServer.fireWeapon(player, 'marksman');
      gameServer.fireWeapon(player, 'burst');
      
      const bullets = Array.from(gameServer.bullets.values());
      expect(bullets.length).toBeGreaterThan(1);
      
      // Check that focus fire affects all bullets
      bullets.forEach(bullet => {
        const weaponConfig = GAME_CONFIG.WEAPONS[bullet.weaponId];
        const passiveConfig = GAME_CONFIG.PASSIVES.focusFire;
        const expectedSpeed = weaponConfig.baseSpeed * (1 + (passiveConfig.effect * 2));
        
        // Calculate the magnitude of the bullet's velocity
        const bulletSpeed = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy) * GAME_CONFIG.TICK_RATE;
        expect(bulletSpeed).toBeCloseTo(expectedSpeed, 1);
      });
    });
  });

  describe('Game State Management', () => {
    test('should maintain consistent game state through multiple ticks', () => {
      const player = createMockPlayer();
      gameServer.players.set(player.id, player);
      
      // Add some bullets and loot
      const bullet = createMockBullet();
      const loot = createMockLoot();
      gameServer.bullets.set(bullet.id, bullet);
      gameServer.loot.set(loot.id, loot);
      
      const initialPlayerCount = gameServer.players.size;
      const initialBulletCount = gameServer.bullets.size;
      const initialLootCount = gameServer.loot.size;
      
      // Run multiple ticks
      for (let i = 0; i < 10; i++) {
        gameServer.tick();
      }
      
      // State should be maintained
      expect(gameServer.players.size).toBe(initialPlayerCount);
      expect(gameServer.bullets.size).toBeLessThanOrEqual(initialBulletCount);
      expect(gameServer.loot.size).toBeLessThanOrEqual(initialLootCount);
    });

    test('should broadcast snapshots at correct intervals', () => {
      const player = createMockPlayer();
      gameServer.players.set(player.id, player);
      
      const broadcastSnapshotSpy = jest.spyOn(gameServer, 'broadcastSnapshot');
      
      // Run ticks up to snapshot rate
      for (let i = 0; i < GAME_CONFIG.SNAPSHOT_RATE; i++) {
        gameServer.tick();
      }
      
      expect(broadcastSnapshotSpy).toHaveBeenCalled();
    });
  });

  describe('Performance and Stress Testing', () => {
    test('should handle many players efficiently', () => {
      // Add many players
      for (let i = 0; i < 20; i++) {
        const player = createMockPlayer({ id: `player${i}` });
        gameServer.players.set(player.id, player);
      }
      
      expect(gameServer.players.size).toBe(20);
      
      // Run multiple ticks
      for (let i = 0; i < 5; i++) {
        gameServer.tick();
      }
      
      // Should not crash or have performance issues
      expect(gameServer.players.size).toBe(20);
    });

    test('should handle many bullets efficiently', () => {
      const player = createMockPlayer();
      gameServer.players.set(player.id, player);
      
      // Add many bullets
      for (let i = 0; i < 100; i++) {
        const bullet = createMockBullet({ id: `bullet${i}` });
        gameServer.bullets.set(bullet.id, bullet);
      }
      
      expect(gameServer.bullets.size).toBe(100);
      
      // Run collision detection
      gameServer.checkCollisions();
      
      // Should complete without errors
      expect(gameServer.bullets.size).toBeLessThanOrEqual(100);
    });

    test('should handle rapid input changes', () => {
      const player = createMockPlayer();
      gameServer.players.set(player.id, player);
      
      // Rapidly change input
      for (let i = 0; i < 50; i++) {
        const input = {
          up: i % 2 === 0,
          down: i % 3 === 0,
          left: i % 4 === 0,
          right: i % 5 === 0,
          mouseX: i * 10,
          mouseY: i * 5
        };
        
        gameServer.handlePlayerInput(player.id, input);
        gameServer.updatePlayers();
      }
      
      // Player should still be valid
      expect(gameServer.players.has(player.id)).toBe(true);
      expect(player.x).toBeGreaterThanOrEqual(0);
      expect(player.y).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Recovery', () => {
    test('should handle player disconnection gracefully', () => {
      const player = createMockPlayer();
      gameServer.players.set(player.id, player);
      
      // Add bullets owned by the player
      const bullet = createMockBullet({ ownerId: player.id });
      gameServer.bullets.set(bullet.id, bullet);
      
      // Remove player
      gameServer.removePlayer(player.id);
      
      expect(gameServer.players.has(player.id)).toBe(false);
      // Bullets should be cleaned up in next update
      gameServer.updateBullets();
      expect(gameServer.bullets.has(bullet.id)).toBe(false);
    });

    test('should handle invalid upgrade selections', () => {
      const player = createMockPlayer();
      gameServer.players.set(player.id, player);
      
      // Try to select upgrade without pending upgrades
      expect(() => gameServer.handleUpgradeSelection(player.id, 0)).not.toThrow();
      
      // Try to select invalid upgrade index
      player.pendingUpgrades = [{ type: 'weapon', weaponId: 'marksman' }];
      expect(() => gameServer.handleUpgradeSelection(player.id, 5)).not.toThrow();
    });

    test('should handle missing config values gracefully', () => {
      const player = createMockPlayer();
      gameServer.players.set(player.id, player);
      
      // Try to fire weapon that doesn't exist
      expect(() => gameServer.fireWeapon(player, 'nonexistent')).not.toThrow();
      
      // Try to apply upgrade for non-existent weapon
      const upgrade = { type: 'weapon_level', weaponId: 'nonexistent' };
      expect(() => gameServer.applyUpgrade(player, upgrade)).not.toThrow();
    });
  });
}); 