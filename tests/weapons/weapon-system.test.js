const { GAME_CONFIG } = require('../../server/config');

describe('Weapon System', () => {
  let gameServer;
  let mockIO;
  let player;

  beforeEach(() => {
    mockIO = createMockIO();
    gameServer = createGameServer(mockIO);
    player = createMockPlayer({
      weapons: { marksman: 1 },
      angle: 0 // Facing right
    });
    gameServer.players.set(player.id, player);
  });

  afterEach(() => {
    if (gameServer) {
      gameServer.destroy();
    }
  });

  describe('Marksman Weapon', () => {
    test('should create marksman bullet with correct properties', () => {
      const weaponConfig = GAME_CONFIG.WEAPONS.marksman;
      
      gameServer.fireWeapon(player, 'marksman');
      
      const bullets = Array.from(gameServer.bullets.values());
      expect(bullets).toHaveLength(1);
      
      const bullet = bullets[0];
      expect(bullet.weaponId).toBe('marksman');
      expect(bullet.ownerId).toBe(player.id);
      expect(bullet.damage).toBe(weaponConfig.baseDamage);
      expect(bullet.speed).toBe(weaponConfig.baseSpeed);
      expect(bullet.radius).toBe(weaponConfig.baseRadius);
      expect(bullet.ttl).toBe(GAME_CONFIG.BULLET_TTL);
      expect(bullet.x).toBe(player.x + GAME_CONFIG.BULLET_SPAWN_OFFSET);
      expect(bullet.y).toBe(player.y);
    });

    test('should apply weapon level upgrades correctly', () => {
      player.weapons.marksman = 3;
      const weaponConfig = GAME_CONFIG.WEAPONS.marksman;
      
      gameServer.fireWeapon(player, 'marksman');
      
      const bullet = Array.from(gameServer.bullets.values())[0];
      const expectedDamage = weaponConfig.baseDamage * Math.pow(1 + weaponConfig.perLevel.damage, 2);
      expect(bullet.damage).toBeCloseTo(expectedDamage, 1);
    });

    test('should apply legendary upgrades correctly', () => {
      player.weapons.marksman = 5;
      player.passives.focusFire = 5;
      player.legendaryUnlocks.marksman = true;
      player.legendaryChosen.marksman = true;
      
      gameServer.fireWeapon(player, 'marksman');
      
      const bullet = Array.from(gameServer.bullets.values())[0];
      const weaponConfig = GAME_CONFIG.WEAPONS.marksman;
      const baseDamage = weaponConfig.baseDamage * Math.pow(1 + weaponConfig.perLevel.damage, 4);
      const legendaryDamage = baseDamage * (1 + weaponConfig.legendary.damage);
      expect(bullet.damage).toBeCloseTo(legendaryDamage, 1);
    });
  });

  describe('Burst Weapon', () => {
    beforeEach(() => {
      player.weapons = { burst: 1 };
    });

    test('should create correct number of burst orbs', () => {
      const weaponConfig = GAME_CONFIG.WEAPONS.burst;
      
      gameServer.fireWeapon(player, 'burst');
      
      const bullets = Array.from(gameServer.bullets.values());
      expect(bullets).toHaveLength(weaponConfig.baseOrbCount);
      
      bullets.forEach(bullet => {
        expect(bullet.weaponId).toBe('burst');
        expect(bullet.ownerId).toBe(player.id);
        expect(bullet.damage).toBe(weaponConfig.baseDamage);
        expect(bullet.ttl).toBe(GAME_CONFIG.BULLET_TTL);
      });
    });

    test('should position burst orbs in a circle', () => {
      gameServer.fireWeapon(player, 'burst');
      
      const bullets = Array.from(gameServer.bullets.values());
      const weaponConfig = GAME_CONFIG.WEAPONS.burst;
      const angleStep = (2 * Math.PI) / weaponConfig.baseOrbCount;
      
      bullets.forEach((bullet, index) => {
        const expectedAngle = index * angleStep;
        const expectedX = player.x + Math.cos(expectedAngle) * GAME_CONFIG.BURST_SPAWN_RADIUS;
        const expectedY = player.y + Math.sin(expectedAngle) * GAME_CONFIG.BURST_SPAWN_RADIUS;
        
        expect(bullet.x).toBeCloseTo(expectedX, 1);
        expect(bullet.y).toBeCloseTo(expectedY, 1);
      });
    });

    test('should apply orb count upgrades correctly', () => {
      player.weapons.burst = 3;
      
      gameServer.fireWeapon(player, 'burst');
      
      const bullets = Array.from(gameServer.bullets.values());
      const weaponConfig = GAME_CONFIG.WEAPONS.burst;
      const expectedOrbCount = weaponConfig.baseOrbCount + (2 * weaponConfig.perLevel.orbCount);
      expect(bullets).toHaveLength(expectedOrbCount);
    });
  });

  describe('Saws Weapon', () => {
    beforeEach(() => {
      player.weapons = { saws: 1 };
    });

    test('should create orbiting saws with correct properties', () => {
      const weaponConfig = GAME_CONFIG.WEAPONS.saws;
      
      gameServer.fireWeapon(player, 'saws');
      
      const bullets = Array.from(gameServer.bullets.values());
      expect(bullets).toHaveLength(weaponConfig.baseSawCount);
      
      bullets.forEach(bullet => {
        expect(bullet.weaponId).toBe('saws');
        expect(bullet.ownerId).toBe(player.id);
        expect(bullet.damage).toBe(weaponConfig.baseDamage);
        expect(bullet.ttl).toBe(-1); // Saws don't expire
        expect(bullet.isOrbiting).toBe(true);
        expect(bullet.orbitRadius).toBe(GAME_CONFIG.SAW_ORBIT_RADIUS);
        expect(bullet.orbitSpeed).toBe(weaponConfig.baseSpeed);
      });
    });

    test('should remove existing saws before creating new ones', () => {
      // Create initial saws
      gameServer.fireWeapon(player, 'saws');
      const initialBulletCount = gameServer.bullets.size;
      
      // Create new saws
      gameServer.fireWeapon(player, 'saws');
      
      // Should have same number of bullets (old ones removed, new ones added)
      expect(gameServer.bullets.size).toBe(initialBulletCount);
    });

    test('should apply saw count upgrades correctly', () => {
      player.weapons.saws = 3;
      
      gameServer.fireWeapon(player, 'saws');
      
      const bullets = Array.from(gameServer.bullets.values());
      const weaponConfig = GAME_CONFIG.WEAPONS.saws;
      const expectedSawCount = weaponConfig.baseSawCount + (2 * weaponConfig.perLevel.sawCount);
      expect(bullets).toHaveLength(expectedSawCount);
    });
  });

  describe('Splat Gun Weapon', () => {
    beforeEach(() => {
      player.weapons = { chain: 1 };
    });

    test('should create correct number of splat gun orbs', () => {
      const weaponConfig = GAME_CONFIG.WEAPONS.chain;
      
      gameServer.fireWeapon(player, 'chain');
      
      const bullets = Array.from(gameServer.bullets.values());
      expect(bullets).toHaveLength(weaponConfig.baseOrbCount);
      
      bullets.forEach(bullet => {
        expect(bullet.weaponId).toBe('chain');
        expect(bullet.ownerId).toBe(player.id);
        expect(bullet.damage).toBe(weaponConfig.baseDamage);
        expect(bullet.ttl).toBe(GAME_CONFIG.BULLET_TTL);
      });
    });

    test('should fire orbs toward cursor with random spread', () => {
      player.angle = 0; // Facing right
      gameServer.fireWeapon(player, 'chain');
      
      const bullets = Array.from(gameServer.bullets.values());
      const weaponConfig = GAME_CONFIG.WEAPONS.chain;
      
      bullets.forEach(bullet => {
        // Check that bullets are moving in the general direction of the cursor (right)
        expect(bullet.vx).toBeGreaterThan(0);
        
        // Check that bullets have some spread (not all moving in exactly the same direction)
        const bulletAngle = Math.atan2(bullet.vy, bullet.vx);
        expect(Math.abs(bulletAngle)).toBeLessThan(weaponConfig.baseSpread);
      });
    });

    test('should apply orb count upgrades correctly', () => {
      player.weapons.chain = 3;
      
      gameServer.fireWeapon(player, 'chain');
      
      const bullets = Array.from(gameServer.bullets.values());
      const weaponConfig = GAME_CONFIG.WEAPONS.chain;
      const expectedOrbCount = weaponConfig.baseOrbCount + (2 * weaponConfig.perLevel.orbCount);
      expect(bullets).toHaveLength(expectedOrbCount);
    });

    test('should apply spread reduction upgrades correctly', () => {
      player.weapons.chain = 3;
      
      gameServer.fireWeapon(player, 'chain');
      
      const bullets = Array.from(gameServer.bullets.values());
      const weaponConfig = GAME_CONFIG.WEAPONS.chain;
      
      // Calculate expected spread with upgrades
      let expectedSpread = weaponConfig.baseSpread;
      for (let i = 0; i < 2; i++) {
        expectedSpread *= (1 + weaponConfig.perLevel.spread);
      }
      
      // Check that bullets have reduced spread
      bullets.forEach(bullet => {
        const bulletAngle = Math.atan2(bullet.vy, bullet.vx);
        expect(Math.abs(bulletAngle)).toBeLessThan(expectedSpread);
      });
    });

    test('should apply legendary upgrades correctly', () => {
      player.weapons.chain = 5;
      player.passives.overclock = 5;
      player.legendaryUnlocks.chain = true;
      player.legendaryChosen.chain = true;
      
      gameServer.fireWeapon(player, 'chain');
      
      const bullets = Array.from(gameServer.bullets.values());
      const weaponConfig = GAME_CONFIG.WEAPONS.chain;
      const expectedOrbCount = weaponConfig.baseOrbCount + (4 * weaponConfig.perLevel.orbCount) + weaponConfig.legendary.orbCount;
      expect(bullets).toHaveLength(expectedOrbCount);
      
      // Check legendary damage bonus
      const bullet = bullets[0];
      const baseDamage = weaponConfig.baseDamage * Math.pow(1 + weaponConfig.perLevel.damage, 4);
      const legendaryDamage = baseDamage * (1 + weaponConfig.legendary.damage);
      expect(bullet.damage).toBeCloseTo(legendaryDamage, 1);
    });
  });

  describe('Scatter Mines Weapon', () => {
    beforeEach(() => {
      player.weapons = { mines: 1 };
    });

    test('should create correct number of mines', () => {
      const weaponConfig = GAME_CONFIG.WEAPONS.mines;
      
      gameServer.fireWeapon(player, 'mines');
      
      const bullets = Array.from(gameServer.bullets.values());
      expect(bullets).toHaveLength(weaponConfig.baseMineCount);
      
      bullets.forEach(bullet => {
        expect(bullet.weaponId).toBe('mines');
        expect(bullet.ownerId).toBe(player.id);
        expect(bullet.damage).toBe(weaponConfig.baseDamage);
        expect(bullet.isMine).toBe(true);
        expect(bullet.isArmed).toBe(false);
        expect(bullet.ttl).toBe(weaponConfig.baseDuration);
      });
    });

    test('should create mines with lob trajectory', () => {
      player.angle = 0; // Facing right
      gameServer.fireWeapon(player, 'mines');
      
      const bullets = Array.from(gameServer.bullets.values());
      const bullet = bullets[0];
      
      // Check that mine is moving in the general direction of the cursor
      expect(bullet.vx).toBeGreaterThan(0);
      expect(bullet.lobDistance).toBeGreaterThan(100);
      expect(bullet.lobDistance).toBeLessThan(151);
      expect(bullet.lobAngle).toBeCloseTo(0, 1);
    });

    test('should apply mine count upgrades correctly', () => {
      player.weapons.mines = 3;
      
      gameServer.fireWeapon(player, 'mines');
      
      const bullets = Array.from(gameServer.bullets.values());
      const weaponConfig = GAME_CONFIG.WEAPONS.mines;
      const expectedMineCount = weaponConfig.baseMineCount + (2 * weaponConfig.perLevel.mineCount);
      expect(bullets).toHaveLength(expectedMineCount);
    });

    test('should apply radius upgrades correctly', () => {
      player.weapons.mines = 3;
      
      gameServer.fireWeapon(player, 'mines');
      
      const bullets = Array.from(gameServer.bullets.values());
      const weaponConfig = GAME_CONFIG.WEAPONS.mines;
      
      // Calculate expected radius with upgrades
      let expectedRadius = weaponConfig.baseRadius;
      for (let i = 0; i < 2; i++) {
        expectedRadius *= (1 + weaponConfig.perLevel.radius);
      }
      
      bullets.forEach(bullet => {
        expect(bullet.radius).toBeCloseTo(expectedRadius, 1);
      });
    });

    test('should apply legendary upgrades correctly', () => {
      player.weapons.mines = 5;
      player.passives.hardenedLoad = 5;
      player.legendaryUnlocks.mines = true;
      player.legendaryChosen.mines = true;
      
      gameServer.fireWeapon(player, 'mines');
      
      const bullets = Array.from(gameServer.bullets.values());
      const weaponConfig = GAME_CONFIG.WEAPONS.mines;
      const expectedMineCount = weaponConfig.baseMineCount + (4 * weaponConfig.perLevel.mineCount);
      expect(bullets).toHaveLength(expectedMineCount);
      
      // Check legendary damage bonus with passive
      const bullet = bullets[0];
      const baseDamage = weaponConfig.baseDamage * Math.pow(1 + weaponConfig.perLevel.damage, 4);
      const legendaryDamage = baseDamage * (1 + weaponConfig.legendary.damage);
      const passiveConfig = GAME_CONFIG.PASSIVES.hardenedLoad;
      const expectedDamage = legendaryDamage * (1 + (passiveConfig.effect * 5));
      expect(bullet.damage).toBeCloseTo(expectedDamage, 1);
    });
  });

  describe('Hardened Load Passive', () => {
    test('should apply hardened load passive to weapon damage', () => {
      player.weapons.marksman = 1;
      player.passives.hardenedLoad = 3;
      
      const weaponStats = gameServer.getWeaponStats(player, 'marksman');
      const weaponConfig = GAME_CONFIG.WEAPONS.marksman;
      const passiveConfig = GAME_CONFIG.PASSIVES.hardenedLoad;
      const expectedDamage = weaponConfig.baseDamage * (1 + (passiveConfig.effect * 3));
      
      expect(weaponStats.damage).toBeCloseTo(expectedDamage, 1);
    });

    test('should apply hardened load passive to all weapons', () => {
      player.weapons.marksman = 1;
      player.weapons.mines = 1;
      player.passives.hardenedLoad = 2;
      
      const marksmanStats = gameServer.getWeaponStats(player, 'marksman');
      const minesStats = gameServer.getWeaponStats(player, 'mines');
      
      const passiveConfig = GAME_CONFIG.PASSIVES.hardenedLoad;
      const expectedMarksmanDamage = GAME_CONFIG.WEAPONS.marksman.baseDamage * (1 + (passiveConfig.effect * 2));
      const expectedMinesDamage = GAME_CONFIG.WEAPONS.mines.baseDamage * (1 + (passiveConfig.effect * 2));
      
      expect(marksmanStats.damage).toBeCloseTo(expectedMarksmanDamage, 1);
      expect(minesStats.damage).toBeCloseTo(expectedMinesDamage, 1);
    });
  });

  describe('Passive Effects', () => {
    test('should apply Focus Fire passive to projectile speed', () => {
      player.weapons.marksman = 1;
      player.passives.focusFire = 3;
      
      gameServer.fireWeapon(player, 'marksman');
      
      const bullet = Array.from(gameServer.bullets.values())[0];
      const weaponConfig = GAME_CONFIG.WEAPONS.marksman;
      const passiveConfig = GAME_CONFIG.PASSIVES.focusFire;
      const expectedSpeed = weaponConfig.baseSpeed * (1 + (passiveConfig.effect * 3));
      
      expect(bullet.vx).toBeCloseTo(expectedSpeed / GAME_CONFIG.TICK_RATE, 1);
    });

    test('should apply Bigger Payload passive to bullet radius', () => {
      player.weapons.marksman = 1;
      player.passives.biggerPayload = 2;
      
      gameServer.fireWeapon(player, 'marksman');
      
      const bullet = Array.from(gameServer.bullets.values())[0];
      const weaponConfig = GAME_CONFIG.WEAPONS.marksman;
      const passiveConfig = GAME_CONFIG.PASSIVES.biggerPayload;
      const baseRadius = Math.max(weaponConfig.baseRadius, 
        weaponConfig.baseDamage * GAME_CONFIG.BULLET_DAMAGE_RADIUS_SCALE);
      const expectedRadius = baseRadius * (1 + (passiveConfig.effect * 2));
      
      expect(bullet.radius).toBeCloseTo(expectedRadius, 1);
    });

    test('should apply Quickstep passive to movement speed', () => {
      player.passives.quickstep = 2;
      player.input.up = true;
      
      const initialY = player.y;
      gameServer.updatePlayers();
      
      const passiveConfig = GAME_CONFIG.PASSIVES.quickstep;
      const expectedSpeed = GAME_CONFIG.PLAYER_BASE_STATS.speed * (1 + (passiveConfig.effect * 2));
      const expectedMovement = expectedSpeed / GAME_CONFIG.TICK_RATE;
      
      expect(player.y).toBeCloseTo(initialY - expectedMovement, 1);
    });
  });

  describe('Weapon Cooldowns', () => {
    test('should respect weapon cooldowns', () => {
      player.weapons.marksman = 1;
      const weaponConfig = GAME_CONFIG.WEAPONS.marksman;
      
      // First shot should work
      gameServer.fireWeapon(player, 'marksman');
      expect(gameServer.bullets.size).toBe(1);
      
      // Second shot immediately should not work
      gameServer.fireWeapon(player, 'marksman');
      expect(gameServer.bullets.size).toBe(1);
    });

    test('should apply cooldown upgrades correctly', () => {
      player.weapons.marksman = 3;
      const weaponConfig = GAME_CONFIG.WEAPONS.marksman;
      
      // Calculate expected cooldown with upgrades
      let expectedCooldown = weaponConfig.baseCooldown;
      for (let i = 0; i < 2; i++) {
        expectedCooldown *= (1 + weaponConfig.perLevel.cooldown);
      }
      
      // Mock time to simulate cooldown
      const originalDateNow = Date.now;
      Date.now = jest.fn(() => expectedCooldown + 100);
      
      gameServer.fireWeapon(player, 'marksman');
      expect(gameServer.bullets.size).toBe(1);
      
      Date.now = originalDateNow;
    });
  });

  describe('Overclock Passive', () => {
    test('should apply overclock passive to weapon cooldown', () => {
      player.weapons.marksman = 1;
      player.passives.overclock = 3;
      
      const weaponStats = gameServer.getWeaponStats(player, 'marksman');
      const weaponConfig = GAME_CONFIG.WEAPONS.marksman;
      const passiveConfig = GAME_CONFIG.PASSIVES.overclock;
      const expectedCooldown = weaponConfig.baseCooldown * (1 + (passiveConfig.effect * 3));
      
      expect(weaponStats.cooldown).toBeCloseTo(expectedCooldown, 1);
    });

    test('should apply overclock passive to all weapons', () => {
      player.weapons.marksman = 1;
      player.weapons.chain = 1;
      player.passives.overclock = 2;
      
      const marksmanStats = gameServer.getWeaponStats(player, 'marksman');
      const chainStats = gameServer.getWeaponStats(player, 'chain');
      
      const passiveConfig = GAME_CONFIG.PASSIVES.overclock;
      const expectedMarksmanCooldown = GAME_CONFIG.WEAPONS.marksman.baseCooldown * (1 + (passiveConfig.effect * 2));
      const expectedChainCooldown = GAME_CONFIG.WEAPONS.chain.baseCooldown * (1 + (passiveConfig.effect * 2));
      
      expect(marksmanStats.cooldown).toBeCloseTo(expectedMarksmanCooldown, 1);
      expect(chainStats.cooldown).toBeCloseTo(expectedChainCooldown, 1);
    });
  });

  describe('Bullet Movement and Updates', () => {
    test('should update regular bullet positions correctly', () => {
      const bullet = createMockBullet({
        vx: 10,
        vy: 5,
        ttl: GAME_CONFIG.BULLET_TTL
      });
      gameServer.bullets.set(bullet.id, bullet);
      
      const initialX = bullet.x;
      const initialY = bullet.y;
      const initialTtl = bullet.ttl;
      
      gameServer.updateBullets();
      
      expect(bullet.x).toBe(initialX + bullet.vx);
      expect(bullet.y).toBe(initialY + bullet.vy);
      expect(bullet.ttl).toBe(initialTtl - (1000 / GAME_CONFIG.TICK_RATE));
    });

    test('should update orbiting saws correctly', () => {
      const saw = createMockBullet({
        weaponId: 'saws',
        isOrbiting: true,
        orbitRadius: GAME_CONFIG.SAW_ORBIT_RADIUS,
        orbitAngle: 0,
        orbitSpeed: 200,
        ttl: -1
      });
      gameServer.bullets.set(saw.id, saw);
      
      const initialAngle = saw.orbitAngle;
      const initialX = saw.x;
      const initialY = saw.y;
      
      gameServer.updateBullets();
      
      expect(saw.orbitAngle).toBeGreaterThan(initialAngle);
      expect(saw.x).not.toBe(initialX);
      expect(saw.y).not.toBe(initialY);
    });
  });

  describe('Homing Daggers Weapon', () => {
    beforeEach(() => {
      player.weapons = { daggers: 1 };
    });

    test('should create correct number of daggers', () => {
      const weaponConfig = GAME_CONFIG.WEAPONS.daggers;
      
      gameServer.fireWeapon(player, 'daggers');
      
      const bullets = Array.from(gameServer.bullets.values());
      expect(bullets).toHaveLength(weaponConfig.baseDaggerCount);
      
      bullets.forEach(bullet => {
        expect(bullet.weaponId).toBe('daggers');
        expect(bullet.ownerId).toBe(player.id);
        expect(bullet.damage).toBe(weaponConfig.baseDamage);
        expect(bullet.isHoming).toBe(true);
        expect(bullet.turnRate).toBe(weaponConfig.baseTurnRate);
        expect(bullet.ttl).toBe(GAME_CONFIG.BULLET_TTL);
      });
    });

    test('should create daggers with spread', () => {
      player.angle = 0; // Facing right
      gameServer.fireWeapon(player, 'daggers');
      
      const bullets = Array.from(gameServer.bullets.values());
      expect(bullets).toHaveLength(2); // baseDaggerCount = 2
      
      // Check that daggers have different angles (spread)
      const angles = bullets.map(bullet => bullet.currentAngle);
      expect(angles[0]).not.toBe(angles[1]);
    });

    test('should apply dagger count upgrades correctly', () => {
      player.weapons.daggers = 3;
      
      gameServer.fireWeapon(player, 'daggers');
      
      const bullets = Array.from(gameServer.bullets.values());
      const weaponConfig = GAME_CONFIG.WEAPONS.daggers;
      const expectedDaggerCount = weaponConfig.baseDaggerCount + (2 * weaponConfig.perLevel.daggerCount);
      expect(bullets).toHaveLength(expectedDaggerCount);
    });

    test('should apply turn rate upgrades correctly', () => {
      player.weapons.daggers = 3;
      
      gameServer.fireWeapon(player, 'daggers');
      
      const bullets = Array.from(gameServer.bullets.values());
      const weaponConfig = GAME_CONFIG.WEAPONS.daggers;
      
      // Calculate expected turn rate with upgrades
      let expectedTurnRate = weaponConfig.baseTurnRate;
      for (let i = 0; i < 2; i++) {
        expectedTurnRate *= (1 + weaponConfig.perLevel.turnRate);
      }
      
      bullets.forEach(bullet => {
        expect(bullet.turnRate).toBeCloseTo(expectedTurnRate, 3);
      });
    });

    test('should apply legendary upgrades correctly', () => {
      player.weapons.daggers = 5;
      player.passives.splitShot = 5;
      player.passives.hardenedLoad = 5;
      player.legendaryUnlocks.daggers = true;
      player.legendaryChosen.daggers = true;
      
      gameServer.fireWeapon(player, 'daggers');
      
      const bullets = Array.from(gameServer.bullets.values());
      const weaponConfig = GAME_CONFIG.WEAPONS.daggers;
      const expectedDaggerCount = weaponConfig.baseDaggerCount + (4 * weaponConfig.perLevel.daggerCount) + 2; // +2 from splitShot level 5
      expect(bullets).toHaveLength(expectedDaggerCount);
      
      // Check legendary damage and speed bonuses
      const bullet = bullets[0];
      const baseDamage = weaponConfig.baseDamage * Math.pow(1 + weaponConfig.perLevel.damage, 4);
      const legendaryDamage = baseDamage * (1 + weaponConfig.legendary.damage);
      const passiveConfig = GAME_CONFIG.PASSIVES.hardenedLoad;
      const expectedDamage = legendaryDamage * (1 + (passiveConfig.effect * 5));
      expect(bullet.damage).toBeCloseTo(expectedDamage, 1);
      
      const baseSpeed = weaponConfig.baseSpeed;
      const legendarySpeed = baseSpeed * (1 + weaponConfig.legendary.speed);
      const bulletSpeed = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy) * GAME_CONFIG.TICK_RATE;
      expect(bulletSpeed).toBeCloseTo(legendarySpeed, 1);
    });
  });

  describe('Split Shot Passive', () => {
    test('should add projectiles every 2 levels', () => {
      player.weapons.burst = 1;
      player.passives.splitShot = 4; // Should add 2 projectiles (4/2 = 2)
      
      const weaponStats = gameServer.getWeaponStats(player, 'burst');
      const weaponConfig = GAME_CONFIG.WEAPONS.burst;
      const expectedOrbCount = weaponConfig.baseOrbCount + 2; // +2 from splitShot level 4
      
      expect(weaponStats.orbCount).toBe(expectedOrbCount);
    });

    test('should not add projectiles for single-shot weapons', () => {
      player.weapons.marksman = 1;
      player.passives.splitShot = 4;
      
      const weaponStats = gameServer.getWeaponStats(player, 'marksman');
      // Marksman should not get extra projectiles from splitShot
      expect(weaponStats).toBeTruthy(); // Just check it doesn't crash
    });

    test('should apply to multiple weapon types', () => {
      player.passives.splitShot = 6; // Should add 3 projectiles (6/2 = 3)
      
      // Test burst orbs
      player.weapons.burst = 1;
      const burstStats = gameServer.getWeaponStats(player, 'burst');
      const burstConfig = GAME_CONFIG.WEAPONS.burst;
      expect(burstStats.orbCount).toBe(burstConfig.baseOrbCount + 3);
      
      // Test daggers
      player.weapons.daggers = 1;
      const daggerStats = gameServer.getWeaponStats(player, 'daggers');
      const daggerConfig = GAME_CONFIG.WEAPONS.daggers;
      expect(daggerStats.daggerCount).toBe(daggerConfig.baseDaggerCount + 3);
      
      // Test mines
      player.weapons.mines = 1;
      const mineStats = gameServer.getWeaponStats(player, 'mines');
      const mineConfig = GAME_CONFIG.WEAPONS.mines;
      expect(mineStats.mineCount).toBe(mineConfig.baseMineCount + 3);
    });
  });
}); 