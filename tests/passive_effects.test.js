const { GAME_CONFIG } = require('../server/config');

// Mock player object for testing
function createMockPlayer() {
  return {
    weapons: {},
    passives: {},
    legendaryUnlocks: {},
    legendaryChosen: {},
    sawsState: {
      isActive: false,
      lastStateChange: 0,
      currentDuration: 0,
      currentCooldown: 0
    }
  };
}

// Mock GameServer class for testing passive calculations
class MockGameServer {
  constructor() {
    this.config = GAME_CONFIG;
  }

  calculateWeaponStats(player, weaponId, weaponLevel) {
    const weapon = this.config.WEAPONS[weaponId];
    if (!weapon) return null;
    
    // Calculate weapon stats with upgrades
    let damage = weapon.baseDamage;
    let speed = weapon.baseSpeed;
    let radius = weapon.baseRadius;
    let sawCount = weapon.baseSawCount || 0;
    let duration = weapon.baseDuration || 0;
    
    // Apply per-level upgrades
    for (let i = 0; i < weaponLevel; i++) {
      damage *= (1 + weapon.perLevel.damage);
      speed *= (1 + weapon.perLevel.speed);
      radius *= (1 + weapon.perLevel.radius);
      sawCount += weapon.perLevel.sawCount || 0;
      duration *= (1 + weapon.perLevel.duration || 0);
    }
    
    // Apply ALL passive bonuses globally
    let passiveEffects = [];
    for (const [passiveId, passiveLevel] of Object.entries(player.passives)) {
      const passive = this.config.PASSIVES[passiveId];
      if (passive) {
        if (passiveId === 'focusFire') {
          const oldSpeed = speed;
          speed *= (1 + (passive.effect * passiveLevel));
          passiveEffects.push(`${passiveId} Lv.${passiveLevel}: ${oldSpeed.toFixed(1)} → ${speed.toFixed(1)} speed`);
        }
      }
    }
    
    // Apply legendary bonuses if unlocked and chosen
    if (player.legendaryUnlocks[weaponId] && player.legendaryChosen && player.legendaryChosen[weaponId]) {
      damage *= (1 + weapon.legendary.damage);
      speed *= (1 + weapon.legendary.speed);
      sawCount += weapon.legendary.sawCount || 0;
      duration *= (1 + weapon.legendary.duration || 0);
    }
    
    return {
      damage,
      speed,
      radius,
      sawCount,
      duration,
      passiveEffects
    };
  }

  calculateMovementSpeed(player, baseSpeed) {
    let effectiveSpeed = baseSpeed;
    
    // Apply quickstep passive if player has it
    if (player.passives.quickstep) {
      const quickstepLevel = player.passives.quickstep;
      const quickstepPassive = this.config.PASSIVES.quickstep;
      const oldSpeed = effectiveSpeed;
      effectiveSpeed *= (1 + (quickstepPassive.effect * quickstepLevel));
      return {
        oldSpeed,
        newSpeed: effectiveSpeed,
        passiveEffect: `quickstep Lv.${quickstepLevel}: ${oldSpeed.toFixed(1)} → ${effectiveSpeed.toFixed(1)}`
      };
    }
    
    return {
      oldSpeed: baseSpeed,
      newSpeed: effectiveSpeed,
      passiveEffect: null
    };
  }
}

describe('Passive Effects Tests', () => {
  let gameServer;

  beforeEach(() => {
    gameServer = new MockGameServer();
  });

  test('Focus Fire should increase marksman bullet speed', () => {
    const player = createMockPlayer();
    player.weapons.marksman = 1;
    player.passives.focusFire = 1;
    
    const stats = gameServer.calculateWeaponStats(player, 'marksman', 1);
    
    expect(stats.speed).toBeGreaterThan(GAME_CONFIG.WEAPONS.marksman.baseSpeed);
    expect(stats.passiveEffects).toContain('focusFire Lv.1: 400.0 → 424.0 speed');
  });

  test('Focus Fire should increase saws orbit speed', () => {
    const player = createMockPlayer();
    player.weapons.saws = 1;
    player.passives.focusFire = 1;
    
    const stats = gameServer.calculateWeaponStats(player, 'saws', 1);
    
    expect(stats.speed).toBeGreaterThan(GAME_CONFIG.WEAPONS.saws.baseSpeed);
    // Saws get +7% speed per level, so level 1: 200 * 1.07 = 214
    // Then Focus Fire adds +6%: 214 * 1.06 = 226.8
    expect(stats.passiveEffects).toContain('focusFire Lv.1: 214.0 → 226.8 speed');
  });

  test('Focus Fire level 5 should provide significant speed boost', () => {
    const player = createMockPlayer();
    player.weapons.marksman = 1;
    player.passives.focusFire = 5;
    
    const stats = gameServer.calculateWeaponStats(player, 'marksman', 1);
    
    // 5 levels of Focus Fire: 1 + (0.06 * 5) = 1.3x speed
    const expectedSpeed = GAME_CONFIG.WEAPONS.marksman.baseSpeed * 1.3;
    expect(stats.speed).toBeCloseTo(expectedSpeed, 1);
  });

  test('Quickstep should increase movement speed', () => {
    const player = createMockPlayer();
    player.passives.quickstep = 1;
    const baseSpeed = 200;
    
    const result = gameServer.calculateMovementSpeed(player, baseSpeed);
    
    expect(result.newSpeed).toBeGreaterThan(baseSpeed);
    expect(result.passiveEffect).toContain('quickstep Lv.1: 200.0 → 208.0');
  });

  test('Quickstep level 5 should provide significant movement boost', () => {
    const player = createMockPlayer();
    player.passives.quickstep = 5;
    const baseSpeed = 200;
    
    const result = gameServer.calculateMovementSpeed(player, baseSpeed);
    
    // 5 levels of Quickstep: 1 + (0.04 * 5) = 1.2x speed
    const expectedSpeed = baseSpeed * 1.2;
    expect(result.newSpeed).toBeCloseTo(expectedSpeed, 1);
  });

  test('Multiple passives should stack', () => {
    const player = createMockPlayer();
    player.weapons.marksman = 1;
    player.passives.focusFire = 2;
    player.passives.quickstep = 3;
    
    const weaponStats = gameServer.calculateWeaponStats(player, 'marksman', 1);
    const movementResult = gameServer.calculateMovementSpeed(player, 200);
    
    // Focus Fire Lv.2: 1 + (0.06 * 2) = 1.12x projectile speed
    const expectedWeaponSpeed = GAME_CONFIG.WEAPONS.marksman.baseSpeed * 1.12;
    expect(weaponStats.speed).toBeCloseTo(expectedWeaponSpeed, 1);
    
    // Quickstep Lv.3: 1 + (0.04 * 3) = 1.12x movement speed
    const expectedMovementSpeed = 200 * 1.12;
    expect(movementResult.newSpeed).toBeCloseTo(expectedMovementSpeed, 1);
  });

  test('Passives should apply to all weapons', () => {
    const player = createMockPlayer();
    player.weapons.marksman = 1;
    player.weapons.saws = 1;
    player.passives.focusFire = 1;
    
    const marksmanStats = gameServer.calculateWeaponStats(player, 'marksman', 1);
    const sawsStats = gameServer.calculateWeaponStats(player, 'saws', 1);
    
    // Both weapons should have Focus Fire applied
    expect(marksmanStats.passiveEffects).toContain('focusFire Lv.1: 400.0 → 424.0 speed');
    // Saws get +7% speed per level, so level 1: 200 * 1.07 = 214
    // Then Focus Fire adds +6%: 214 * 1.06 = 226.8
    expect(sawsStats.passiveEffects).toContain('focusFire Lv.1: 214.0 → 226.8 speed');
  });

  test('No passives should mean no speed changes', () => {
    const player = createMockPlayer();
    player.weapons.marksman = 1;
    
    const stats = gameServer.calculateWeaponStats(player, 'marksman', 1);
    const movementResult = gameServer.calculateMovementSpeed(player, 200);
    
    expect(stats.speed).toBe(GAME_CONFIG.WEAPONS.marksman.baseSpeed);
    expect(stats.passiveEffects).toHaveLength(0);
    expect(movementResult.newSpeed).toBe(200);
    expect(movementResult.passiveEffect).toBeNull();
  });
}); 