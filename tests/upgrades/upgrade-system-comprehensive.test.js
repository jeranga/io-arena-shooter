const { GAME_CONFIG } = require('../../server/config');

describe('Upgrade System - Comprehensive', () => {
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

  describe('Upgrade Application', () => {
    test('should apply weapon upgrade correctly', () => {
      const upgrade = {
        type: 'weapon',
        weaponId: 'marksman'
      };
      
      const result = gameServer.applyUpgrade(player, upgrade);
      
      expect(result).toBe(true);
      expect(player.weapons.marksman).toBe(1);
    });

    test('should apply weapon level upgrade correctly', () => {
      player.weapons.marksman = 2;
      
      const upgrade = {
        type: 'weapon_level',
        weaponId: 'marksman'
      };
      
      const result = gameServer.applyUpgrade(player, upgrade);
      
      expect(result).toBe(true);
      expect(player.weapons.marksman).toBe(3);
    });

    test('should not apply weapon level upgrade beyond max level', () => {
      player.weapons.marksman = GAME_CONFIG.MAX_WEAPON_LEVEL;
      
      const upgrade = {
        type: 'weapon_level',
        weaponId: 'marksman'
      };
      
      const result = gameServer.applyUpgrade(player, upgrade);
      
      expect(result).toBe(false);
      expect(player.weapons.marksman).toBe(GAME_CONFIG.MAX_WEAPON_LEVEL);
    });

    test('should apply passive upgrade correctly', () => {
      const upgrade = {
        type: 'passive',
        passiveId: 'focusFire'
      };
      
      const result = gameServer.applyUpgrade(player, upgrade);
      
      expect(result).toBe(true);
      expect(player.passives.focusFire).toBe(1);
    });

    test('should apply passive level upgrade correctly', () => {
      player.passives.focusFire = 2;
      
      const upgrade = {
        type: 'passive_level',
        passiveId: 'focusFire'
      };
      
      const result = gameServer.applyUpgrade(player, upgrade);
      
      expect(result).toBe(true);
      expect(player.passives.focusFire).toBe(3);
    });

    test('should not apply passive level upgrade beyond max level', () => {
      player.passives.focusFire = GAME_CONFIG.MAX_PASSIVE_LEVEL;
      
      const upgrade = {
        type: 'passive_level',
        passiveId: 'focusFire'
      };
      
      const result = gameServer.applyUpgrade(player, upgrade);
      
      expect(result).toBe(false);
      expect(player.passives.focusFire).toBe(GAME_CONFIG.MAX_PASSIVE_LEVEL);
    });

    test('should apply legendary upgrade correctly', () => {
      player.legendaryUnlocks.marksman = true;
      
      const upgrade = {
        type: 'legendary',
        weaponId: 'marksman'
      };
      
      const result = gameServer.applyUpgrade(player, upgrade);
      
      expect(result).toBe(true);
      expect(player.legendaryChosen.marksman).toBe(true);
    });

    test('should handle unknown upgrade type', () => {
      const upgrade = {
        type: 'unknown',
        weaponId: 'marksman'
      };
      
      const result = gameServer.applyUpgrade(player, upgrade);
      
      expect(result).toBe(false);
    });
  });

  describe('Available Upgrades Generation', () => {
    test('should offer initial weapon choices for new player', () => {
      const upgrades = gameServer.getAvailableUpgrades(player);
      
      expect(upgrades.length).toBe(GAME_CONFIG.INITIAL_WEAPON_CHOICES);
      upgrades.forEach(upgrade => {
        expect(upgrade.type).toBe('weapon');
        expect(upgrade.weaponId).toBeDefined();
        expect(upgrade.name).toBeDefined();
        expect(upgrade.description).toBeDefined();
      });
    });

    test('should offer new weapons when under max weapons', () => {
      player.weapons.marksman = 1;
      
      const upgrades = gameServer.getAvailableUpgrades(player);
      
      const weaponUpgrades = upgrades.filter(u => u.type === 'weapon');
      expect(weaponUpgrades.length).toBeGreaterThan(0);
      expect(weaponUpgrades.every(u => u.weaponId !== 'marksman')).toBe(true);
    });

    test('should not offer new weapons when at max weapons', () => {
      player.weapons.marksman = 1;
      player.weapons.burst = 1;
      player.weapons.saws = 1;
      
      const upgrades = gameServer.getAvailableUpgrades(player);
      
      const weaponUpgrades = upgrades.filter(u => u.type === 'weapon');
      expect(weaponUpgrades.length).toBe(0);
    });

    test('should offer weapon level upgrades for owned weapons', () => {
      player.weapons.marksman = 2;
      
      const upgrades = gameServer.getAvailableUpgrades(player);
      
      const levelUpgrades = upgrades.filter(u => u.type === 'weapon_level' && u.weaponId === 'marksman');
      expect(levelUpgrades.length).toBe(1);
      expect(levelUpgrades[0].currentLevel).toBe(2);
    });

    test('should not offer weapon level upgrades at max level', () => {
      player.weapons.marksman = GAME_CONFIG.MAX_WEAPON_LEVEL;
      
      const upgrades = gameServer.getAvailableUpgrades(player);
      
      const levelUpgrades = upgrades.filter(u => u.type === 'weapon_level' && u.weaponId === 'marksman');
      expect(levelUpgrades.length).toBe(0);
    });

    test('should offer new passives when under max passives', () => {
      player.weapons.marksman = 1;
      
      const upgrades = gameServer.getAvailableUpgrades(player);
      
      const passiveUpgrades = upgrades.filter(u => u.type === 'passive');
      expect(passiveUpgrades.length).toBeGreaterThan(0);
    });

    test('should not offer new passives when at max passives', () => {
      player.weapons.marksman = 1;
      player.passives.focusFire = 1;
      player.passives.quickstep = 1;
      player.passives.biggerPayload = 1;
      
      const upgrades = gameServer.getAvailableUpgrades(player);
      
      const passiveUpgrades = upgrades.filter(u => u.type === 'passive');
      expect(passiveUpgrades.length).toBe(0);
    });

    test('should offer passive level upgrades for owned passives', () => {
      player.weapons.marksman = 1;
      player.passives.focusFire = 2;
      
      const upgrades = gameServer.getAvailableUpgrades(player);
      
      const levelUpgrades = upgrades.filter(u => u.type === 'passive_level' && u.passiveId === 'focusFire');
      expect(levelUpgrades.length).toBe(1);
      expect(levelUpgrades[0].currentLevel).toBe(2);
    });

    test('should not offer passive level upgrades at max level', () => {
      player.weapons.marksman = 1;
      player.passives.focusFire = GAME_CONFIG.MAX_PASSIVE_LEVEL;
      
      const upgrades = gameServer.getAvailableUpgrades(player);
      
      const levelUpgrades = upgrades.filter(u => u.type === 'passive_level' && u.passiveId === 'focusFire');
      expect(levelUpgrades.length).toBe(0);
    });
  });

  describe('Legendary Unlock System', () => {
    test('should unlock legendary when weapon and paired passive reach max level', () => {
      player.weapons.marksman = GAME_CONFIG.MAX_WEAPON_LEVEL;
      player.passives.focusFire = GAME_CONFIG.MAX_PASSIVE_LEVEL;
      
      gameServer.checkForLegendaryUnlocks(player);
      
      expect(player.legendaryUnlocks.marksman).toBe(true);
    });

    test('should not unlock legendary if only weapon is max level', () => {
      player.weapons.marksman = GAME_CONFIG.MAX_WEAPON_LEVEL;
      player.passives.focusFire = 3;
      
      gameServer.checkForLegendaryUnlocks(player);
      
      expect(player.legendaryUnlocks.marksman).toBeUndefined();
    });

    test('should not unlock legendary if only passive is max level', () => {
      player.weapons.marksman = 3;
      player.passives.focusFire = GAME_CONFIG.MAX_PASSIVE_LEVEL;
      
      gameServer.checkForLegendaryUnlocks(player);
      
      expect(player.legendaryUnlocks.marksman).toBeUndefined();
    });

    test('should not unlock legendary if already unlocked', () => {
      player.weapons.marksman = GAME_CONFIG.MAX_WEAPON_LEVEL;
      player.passives.focusFire = GAME_CONFIG.MAX_PASSIVE_LEVEL;
      player.legendaryUnlocks.marksman = true;
      
      gameServer.checkForLegendaryUnlocks(player);
      
      expect(player.legendaryUnlocks.marksman).toBe(true);
    });

    test('should offer legendary upgrade when unlocked but not chosen', () => {
      player.weapons.marksman = GAME_CONFIG.MAX_WEAPON_LEVEL;
      player.passives.focusFire = GAME_CONFIG.MAX_PASSIVE_LEVEL;
      player.legendaryUnlocks.marksman = true;
      
      const upgrades = gameServer.getAvailableUpgrades(player);
      
      const legendaryUpgrades = upgrades.filter(u => u.type === 'legendary' && u.weaponId === 'marksman');
      expect(legendaryUpgrades.length).toBe(1);
    });

    test('should not offer legendary upgrade when already chosen', () => {
      player.weapons.marksman = GAME_CONFIG.MAX_WEAPON_LEVEL;
      player.passives.focusFire = GAME_CONFIG.MAX_PASSIVE_LEVEL;
      player.legendaryUnlocks.marksman = true;
      player.legendaryChosen.marksman = true;
      
      const upgrades = gameServer.getAvailableUpgrades(player);
      
      const legendaryUpgrades = upgrades.filter(u => u.type === 'legendary' && u.weaponId === 'marksman');
      expect(legendaryUpgrades.length).toBe(0);
    });

    test('should emit legendary unlocked event', () => {
      player.weapons.marksman = GAME_CONFIG.MAX_WEAPON_LEVEL;
      player.passives.focusFire = GAME_CONFIG.MAX_PASSIVE_LEVEL;
      
      gameServer.checkForLegendaryUnlocks(player);
      
      expect(mockIO.to).toHaveBeenCalledWith(player.id);
      expect(mockIO.emit).toHaveBeenCalledWith('legendaryUnlocked', {
        weaponId: 'marksman',
        weaponName: GAME_CONFIG.WEAPONS.marksman.name,
        passiveId: 'focusFire',
        passiveName: GAME_CONFIG.PASSIVES.focusFire.name
      });
    });
  });

  describe('Level Up System', () => {
    test('should trigger level up when XP threshold is reached', () => {
      const nextLevelXp = gameServer.getXpForLevel(2);
      player.xp = nextLevelXp;
      
      const loot = createMockLoot({ value: 0 });
      gameServer.collectLoot(player, loot);
      
      expect(player.level).toBe(2);
      expect(player.xp).toBe(0);
    });

    test('should not trigger level up when XP is insufficient', () => {
      const nextLevelXp = gameServer.getXpForLevel(2);
      player.xp = nextLevelXp - 1;
      
      const loot = createMockLoot({ value: 0 });
      gameServer.collectLoot(player, loot);
      
      expect(player.level).toBe(1);
      expect(player.xp).toBe(nextLevelXp - 1);
    });

    test('should emit level up event with upgrade choices', () => {
      const nextLevelXp = gameServer.getXpForLevel(2);
      player.xp = nextLevelXp;
      
      const loot = createMockLoot({ value: 0 });
      gameServer.collectLoot(player, loot);
      
      expect(mockIO.to).toHaveBeenCalledWith(player.id);
      expect(mockIO.emit).toHaveBeenCalledWith('levelUp', {
        level: 2,
        upgrades: expect.any(Array)
      });
    });

    test('should not emit level up when no upgrades are available', () => {
      // Set up player with all maxed out
      player.weapons.marksman = GAME_CONFIG.MAX_WEAPON_LEVEL;
      player.weapons.burst = GAME_CONFIG.MAX_WEAPON_LEVEL;
      player.weapons.saws = GAME_CONFIG.MAX_WEAPON_LEVEL;
      player.passives.focusFire = GAME_CONFIG.MAX_PASSIVE_LEVEL;
      player.passives.quickstep = GAME_CONFIG.MAX_PASSIVE_LEVEL;
      player.passives.biggerPayload = GAME_CONFIG.MAX_PASSIVE_LEVEL;
      player.legendaryChosen.marksman = true;
      player.legendaryChosen.burst = true;
      player.legendaryChosen.saws = true;
      
      const nextLevelXp = gameServer.getXpForLevel(2);
      player.xp = nextLevelXp;
      
      const loot = createMockLoot({ value: 0 });
      gameServer.collectLoot(player, loot);
      
      expect(mockIO.emit).not.toHaveBeenCalledWith('levelUp', expect.any(Object));
    });
  });

  describe('XP System', () => {
    test('should calculate XP requirements correctly', () => {
      expect(gameServer.getXpForLevel(1)).toBe(GAME_CONFIG.XP_BASE);
      expect(gameServer.getXpForLevel(2)).toBe(Math.floor(GAME_CONFIG.XP_BASE * GAME_CONFIG.XP_SCALING));
      expect(gameServer.getXpForLevel(3)).toBe(Math.floor(GAME_CONFIG.XP_BASE * Math.pow(GAME_CONFIG.XP_SCALING, 2)));
    });

    test('should handle infinite XP progression', () => {
      for (let level = 1; level <= 10; level++) {
        const xpRequired = gameServer.getXpForLevel(level);
        expect(xpRequired).toBeGreaterThan(0);
        expect(xpRequired).toBe(Math.floor(xpRequired)); // Should be integer
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle upgrade selection with invalid index', () => {
      player.pendingUpgrades = [
        { type: 'weapon', weaponId: 'marksman' }
      ];
      
      gameServer.handleUpgradeSelection(player.id, 5); // Invalid index
      
      expect(player.pendingUpgrades).not.toBeNull(); // Should not be cleared
    });

    test('should handle upgrade selection with no pending upgrades', () => {
      player.pendingUpgrades = null;
      
      expect(() => gameServer.handleUpgradeSelection(player.id, 0)).not.toThrow();
    });

    test('should handle missing player in upgrade selection', () => {
      const upgrade = { type: 'weapon', weaponId: 'marksman' };
      
      expect(() => gameServer.applyUpgrade(null, upgrade)).not.toThrow();
    });

    test('should handle invalid weapon ID in upgrade', () => {
      const upgrade = {
        type: 'weapon_level',
        weaponId: 'nonexistent'
      };
      
      const result = gameServer.applyUpgrade(player, upgrade);
      
      expect(result).toBe(false);
    });

    test('should handle invalid passive ID in upgrade', () => {
      const upgrade = {
        type: 'passive_level',
        passiveId: 'nonexistent'
      };
      
      const result = gameServer.applyUpgrade(player, upgrade);
      
      expect(result).toBe(false);
    });
  });
}); 