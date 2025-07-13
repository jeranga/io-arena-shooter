const { GAME_CONFIG } = require('../server/config');

// Mock player object for testing
function createMockPlayer() {
  return {
    id: 'test-player',
    name: 'TestPlayer',
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

// Mock GameServer class for testing
class MockGameServer {
  constructor() {
    this.config = GAME_CONFIG;
  }

  calculateMarksmanCooldown(player, weaponLevel, now) {
    const weapon = this.config.WEAPONS.marksman;
    let cooldown = weapon.baseCooldown;
    
    console.log(`\n=== Marksman Cooldown Calculation ===`);
    console.log(`Base cooldown: ${cooldown}ms`);
    
    // Apply per-level upgrades
    for (let i = 0; i < weaponLevel; i++) {
      const oldCooldown = cooldown;
      cooldown *= (1 + weapon.perLevel.cooldown);
      console.log(`Level ${i + 1}: ${oldCooldown.toFixed(1)} → ${cooldown.toFixed(1)}ms (${weapon.perLevel.cooldown * 100}%)`);
    }
    
    // Apply legendary bonus if unlocked and chosen
    if (player.legendaryUnlocks.marksman && player.legendaryChosen && player.legendaryChosen.marksman) {
      const oldCooldown = cooldown;
      cooldown *= (1 + weapon.legendary.cooldown);
      console.log(`Legendary: ${oldCooldown.toFixed(1)} → ${cooldown.toFixed(1)}ms (${weapon.legendary.cooldown * 100}%)`);
    }
    
    console.log(`Final cooldown: ${cooldown.toFixed(1)}ms`);
    return cooldown;
  }

  checkMarksmanFiring(player, weaponLevel, now) {
    const weapon = this.config.WEAPONS.marksman;
    const cooldownKey = `lastShot_marksman`;
    const timeSinceLastShot = now - (player[cooldownKey] || 0);
    const cooldown = this.calculateMarksmanCooldown(player, weaponLevel, now);
    
    console.log(`\n=== Marksman Firing Check ===`);
    console.log(`Now: ${now}`);
    console.log(`Last shot: ${player[cooldownKey] || 0}`);
    console.log(`Time since last shot: ${timeSinceLastShot.toFixed(1)}ms`);
    console.log(`Cooldown: ${cooldown.toFixed(1)}ms`);
    console.log(`Legendary unlocked: ${player.legendaryUnlocks.marksman}`);
    console.log(`Legendary chosen: ${player.legendaryChosen && player.legendaryChosen.marksman}`);
    console.log(`Should fire: ${timeSinceLastShot >= cooldown}`);
    
    return {
      shouldFire: timeSinceLastShot >= cooldown,
      cooldown,
      timeSinceLastShot,
      remaining: Math.max(0, cooldown - timeSinceLastShot)
    };
  }

  simulateLegendaryUnlock(player) {
    console.log(`\n=== Simulating Legendary Unlock ===`);
    player.weapons.marksman = 5;
    player.passives.focusFire = 5;
    player.legendaryUnlocks.marksman = true;
    console.log(`Marksman level: ${player.weapons.marksman}`);
    console.log(`Focus Fire level: ${player.passives.focusFire}`);
    console.log(`Legendary unlocked: ${player.legendaryUnlocks.marksman}`);
  }

  simulateLegendaryChoice(player) {
    console.log(`\n=== Simulating Legendary Choice ===`);
    player.legendaryChosen = player.legendaryChosen || {};
    player.legendaryChosen.marksman = true;
    console.log(`Legendary chosen: ${player.legendaryChosen.marksman}`);
  }

  simulateFiring(player, now) {
    console.log(`\n=== Simulating Firing ===`);
    const cooldownKey = `lastShot_marksman`;
    player[cooldownKey] = now;
    console.log(`Set lastShot to: ${now}`);
  }
}

// Run the tests
console.log('Running Marksman Legendary Firing Tests...\n');

const testGameServer = new MockGameServer();
const testPlayer = createMockPlayer();

console.log('=== Test 1: Level 1 Marksman ===');
testGameServer.checkMarksmanFiring(testPlayer, 1, Date.now());

console.log('\n=== Test 2: Level 5 Marksman ===');
testPlayer.weapons.marksman = 5;
testGameServer.checkMarksmanFiring(testPlayer, 5, Date.now());

console.log('\n=== Test 3: Legendary Unlocked and Chosen ===');
testGameServer.simulateLegendaryUnlock(testPlayer);
testGameServer.simulateLegendaryChoice(testPlayer);
testGameServer.checkMarksmanFiring(testPlayer, 5, Date.now());

console.log('\n=== Test 4: After Firing ===');
testGameServer.simulateFiring(testPlayer, Date.now());
testGameServer.checkMarksmanFiring(testPlayer, 5, Date.now());

console.log('\n=== Test 5: After Cooldown ===');
const cooldown = testGameServer.calculateMarksmanCooldown(testPlayer, 5, Date.now());
const futureTime = Date.now() + cooldown + 10;
testGameServer.checkMarksmanFiring(testPlayer, 5, futureTime);

console.log('\n=== Test 6: Legendary Unlocked but NOT Chosen ===');
const testPlayer2 = createMockPlayer();
testPlayer2.weapons.marksman = 5;
testPlayer2.passives.focusFire = 5;
testPlayer2.legendaryUnlocks.marksman = true;
// Don't choose legendary
testGameServer.checkMarksmanFiring(testPlayer2, 5, Date.now()); 