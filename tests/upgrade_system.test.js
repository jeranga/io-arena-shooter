const { GAME_CONFIG } = require('../server/config');

// Mock player object for testing
function createMockPlayer() {
  return {
    weapons: {},
    passives: {},
    legendaryUnlocks: {},
    legendaryChosen: {}
  };
}

// Mock GameServer class for testing upgrade logic
class MockGameServer {
  constructor() {
    this.config = GAME_CONFIG;
  }

  getAvailableUpgrades(player) {
    const available = [];
    
    // If player has no weapons, offer first weapon choice (3 random weapons)
    if (Object.keys(player.weapons).length === 0) {
      const allWeapons = Object.entries(this.config.WEAPONS).map(([weaponId, weapon]) => ({
        id: weaponId,
        name: weapon.name,
        description: weapon.description,
        type: 'weapon',
        weaponId: weaponId
      }));
      
      // Shuffle and take first 3
      for (let i = allWeapons.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allWeapons[i], allWeapons[j]] = [allWeapons[j], allWeapons[i]];
      }
      
      return allWeapons.slice(0, 3);
    }
    
    // Add weapon upgrades (max 3 weapons, max level 5 each)
    if (Object.keys(player.weapons).length < 3) {
      for (const [weaponId, weapon] of Object.entries(this.config.WEAPONS)) {
        if (!player.weapons[weaponId]) {
          available.push({
            id: weaponId,
            name: weapon.name,
            description: weapon.description,
            type: 'weapon',
            weaponId: weaponId
          });
        }
      }
    }
    
    // Add weapon level upgrades (max level 5)
    for (const [weaponId, weaponLevel] of Object.entries(player.weapons)) {
      if (weaponLevel < 5) {
        const weapon = this.config.WEAPONS[weaponId];
        available.push({
          id: `${weaponId}_level`,
          name: `${weapon.name} Level ${weaponLevel + 1}`,
          description: `Upgrade ${weapon.name} to level ${weaponLevel + 1}`,
          type: 'weapon_level',
          weaponId: weaponId,
          currentLevel: weaponLevel
        });
      }
    }
    
    // Add passive upgrades (max 3 passives, max level 5 each)
    if (Object.keys(player.passives).length < 3) {
      for (const [passiveId, passive] of Object.entries(this.config.PASSIVES)) {
        if (!player.passives[passiveId]) {
          available.push({
            id: passiveId,
            name: passive.name,
            description: passive.description,
            type: 'passive',
            passiveId: passiveId
          });
        }
      }
    }
    
    // Add passive level upgrades (max level 5)
    for (const [passiveId, passiveLevel] of Object.entries(player.passives)) {
      if (passiveLevel < 5) {
        const passive = this.config.PASSIVES[passiveId];
        available.push({
          id: `${passiveId}_level`,
          name: `${passive.name} Level ${passiveLevel + 1}`,
          description: `Upgrade ${passive.name} to level ${passiveLevel + 1}`,
          type: 'passive_level',
          passiveId: passiveId,
          currentLevel: passiveLevel
        });
      }
    }
    
    // Add legendary upgrades (if unlocked but not yet chosen)
    for (const [weaponId, isUnlocked] of Object.entries(player.legendaryUnlocks)) {
      if (isUnlocked && (!player.legendaryChosen || !player.legendaryChosen[weaponId])) {
        const weapon = this.config.WEAPONS[weaponId];
        if (weapon) {
          available.push({
            id: `${weaponId}_legendary`,
            name: `${weapon.name} - LEGENDARY!`,
            description: `Unlock legendary ${weapon.name} with enhanced abilities`,
            type: 'legendary',
            weaponId: weaponId
          });
        }
      }
    }
    
    return available;
  }

  checkForLegendaryUnlocks(player) {
    const unlocks = {};
    for (const [weaponId, weaponLevel] of Object.entries(player.weapons)) {
      if (weaponLevel >= 5 && !player.legendaryUnlocks[weaponId]) {
        const weapon = this.config.WEAPONS[weaponId];
        if (weapon && weapon.pairedPassive) {
          const passiveLevel = player.passives[weapon.pairedPassive] || 0;
          if (passiveLevel >= 5) {
            unlocks[weaponId] = true;
          }
        }
      }
    }
    return unlocks;
  }
}

describe('Upgrade System Tests', () => {
  let gameServer;

  beforeEach(() => {
    gameServer = new MockGameServer();
  });

  test('Initial player should get weapon choices (up to 3)', () => {
    const player = createMockPlayer();
    const upgrades = gameServer.getAvailableUpgrades(player);
    
    const availableWeapons = Object.keys(GAME_CONFIG.WEAPONS).length;
    const expectedChoices = Math.min(3, availableWeapons);
    
    expect(upgrades.length).toBe(expectedChoices);
    expect(upgrades.every(u => u.type === 'weapon')).toBe(true);
    expect(upgrades.every(u => u.weaponId in GAME_CONFIG.WEAPONS)).toBe(true);
  });

  test('Player with 1 weapon should be able to get more weapons', () => {
    const player = createMockPlayer();
    player.weapons.marksman = 1;
    
    const upgrades = gameServer.getAvailableUpgrades(player);
    const weaponUpgrades = upgrades.filter(u => u.type === 'weapon');
    
    expect(weaponUpgrades.length).toBeGreaterThan(0);
    expect(weaponUpgrades.every(u => !(u.weaponId in player.weapons))).toBe(true);
  });

  test('Player with all weapons should not get more weapon choices', () => {
    const player = createMockPlayer();
    // Add all available weapons
    Object.keys(GAME_CONFIG.WEAPONS).forEach(weaponId => {
      player.weapons[weaponId] = 1;
    });
    
    const upgrades = gameServer.getAvailableUpgrades(player);
    const weaponUpgrades = upgrades.filter(u => u.type === 'weapon');
    
    expect(weaponUpgrades.length).toBe(0);
  });

  test('Weapon level upgrades should be available up to level 5', () => {
    const player = createMockPlayer();
    player.weapons.marksman = 3;
    
    const upgrades = gameServer.getAvailableUpgrades(player);
    const marksmanUpgrades = upgrades.filter(u => u.weaponId === 'marksman' && u.type === 'weapon_level');
    
    expect(marksmanUpgrades.length).toBe(1);
    expect(marksmanUpgrades[0].currentLevel).toBe(3);
  });

  test('Weapon at level 5 should not offer level upgrades', () => {
    const player = createMockPlayer();
    player.weapons.marksman = 5;
    
    const upgrades = gameServer.getAvailableUpgrades(player);
    const marksmanUpgrades = upgrades.filter(u => u.weaponId === 'marksman' && u.type === 'weapon_level');
    
    expect(marksmanUpgrades.length).toBe(0);
  });

  test('Passive upgrades should be available', () => {
    const player = createMockPlayer();
    player.weapons.marksman = 1;
    
    const upgrades = gameServer.getAvailableUpgrades(player);
    const passiveUpgrades = upgrades.filter(u => u.type === 'passive');
    
    expect(passiveUpgrades.length).toBeGreaterThan(0);
    expect(passiveUpgrades.every(u => u.passiveId in GAME_CONFIG.PASSIVES)).toBe(true);
  });

  test('Passive level upgrades should be available up to level 5', () => {
    const player = createMockPlayer();
    player.weapons.marksman = 1;
    player.passives.focusFire = 3;
    
    const upgrades = gameServer.getAvailableUpgrades(player);
    const focusFireUpgrades = upgrades.filter(u => u.passiveId === 'focusFire' && u.type === 'passive_level');
    
    expect(focusFireUpgrades.length).toBe(1);
    expect(focusFireUpgrades[0].currentLevel).toBe(3);
  });

  test('Passive at level 5 should not offer level upgrades', () => {
    const player = createMockPlayer();
    player.weapons.marksman = 1;
    player.passives.focusFire = 5;
    
    const upgrades = gameServer.getAvailableUpgrades(player);
    const focusFireUpgrades = upgrades.filter(u => u.passiveId === 'focusFire' && u.type === 'passive_level');
    
    expect(focusFireUpgrades.length).toBe(0);
  });

  test('Legendary should unlock when weapon and paired passive both reach level 5', () => {
    const player = createMockPlayer();
    player.weapons.marksman = 5;
    player.passives.focusFire = 5;
    
    const unlocks = gameServer.checkForLegendaryUnlocks(player);
    
    expect(unlocks.marksman).toBe(true);
  });

  test('Legendary should not unlock if only weapon is level 5', () => {
    const player = createMockPlayer();
    player.weapons.marksman = 5;
    player.passives.focusFire = 3;
    
    const unlocks = gameServer.checkForLegendaryUnlocks(player);
    
    expect(unlocks.marksman).toBeUndefined();
  });

  test('Legendary should not unlock if only passive is level 5', () => {
    const player = createMockPlayer();
    player.weapons.marksman = 3;
    player.passives.focusFire = 5;
    
    const unlocks = gameServer.checkForLegendaryUnlocks(player);
    
    expect(unlocks.marksman).toBeUndefined();
  });

  test('Legendary upgrade should be available when unlocked', () => {
    const player = createMockPlayer();
    player.weapons.marksman = 5;
    player.passives.focusFire = 5;
    player.legendaryUnlocks.marksman = true;
    
    const upgrades = gameServer.getAvailableUpgrades(player);
    const legendaryUpgrades = upgrades.filter(u => u.type === 'legendary');
    
    expect(legendaryUpgrades.length).toBe(1);
    expect(legendaryUpgrades[0].weaponId).toBe('marksman');
  });

  test('Legendary upgrade should not be available after chosen', () => {
    const player = createMockPlayer();
    player.weapons.marksman = 5;
    player.passives.focusFire = 5;
    player.legendaryUnlocks.marksman = true;
    player.legendaryChosen.marksman = true;
    
    const upgrades = gameServer.getAvailableUpgrades(player);
    const legendaryUpgrades = upgrades.filter(u => u.type === 'legendary');
    
    expect(legendaryUpgrades.length).toBe(0);
  });
});

describe('Weapon Configuration Tests', () => {
  test('All weapons should have valid configurations', () => {
    Object.entries(GAME_CONFIG.WEAPONS).forEach(([weaponId, weapon]) => {
      expect(weapon.id).toBe(weaponId);
      expect(weapon.name).toBeDefined();
      expect(weapon.description).toBeDefined();
      expect(weapon.baseCooldown).toBeGreaterThan(0);
      expect(weapon.baseDamage).toBeGreaterThan(0);
      expect(weapon.baseSpeed).toBeGreaterThan(0);
      expect(weapon.perLevel).toBeDefined();
      expect(weapon.pairedPassive).toBeDefined();
      expect(weapon.legendary).toBeDefined();
    });
  });

  test('All passives should have valid configurations', () => {
    Object.entries(GAME_CONFIG.PASSIVES).forEach(([passiveId, passive]) => {
      expect(passive.id).toBe(passiveId);
      expect(passive.name).toBeDefined();
      expect(passive.description).toBeDefined();
      expect(passive.effect).toBeDefined();
      expect(passive.legendaryPair).toBeDefined();
    });
  });

  test('Weapon paired passives should exist', () => {
    Object.entries(GAME_CONFIG.WEAPONS).forEach(([weaponId, weapon]) => {
      expect(GAME_CONFIG.PASSIVES[weapon.pairedPassive]).toBeDefined();
    });
  });

  test('Passive legendary pairs should exist', () => {
    Object.entries(GAME_CONFIG.PASSIVES).forEach(([passiveId, passive]) => {
      expect(GAME_CONFIG.WEAPONS[passive.legendaryPair]).toBeDefined();
    });
  });
}); 