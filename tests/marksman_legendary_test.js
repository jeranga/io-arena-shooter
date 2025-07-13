const { GAME_CONFIG } = require('../server/config');

// Test marksman cooldown calculation
function testMarksmanCooldown() {
  const weapon = GAME_CONFIG.WEAPONS.marksman;
  let cooldown = weapon.baseCooldown;
  
  console.log(`Base cooldown: ${cooldown}ms`);
  
  // Apply level 5 upgrades
  for (let i = 0; i < 5; i++) {
    const oldCooldown = cooldown;
    cooldown *= (1 + weapon.perLevel.cooldown);
    console.log(`Level ${i + 1}: ${oldCooldown.toFixed(1)} → ${cooldown.toFixed(1)}ms`);
  }
  
  // Apply legendary
  const oldCooldown = cooldown;
  cooldown *= (1 + weapon.legendary.cooldown);
  console.log(`Legendary: ${oldCooldown.toFixed(1)} → ${cooldown.toFixed(1)}ms`);
  
  console.log(`Final cooldown: ${cooldown.toFixed(1)}ms`);
  console.log(`Is positive: ${cooldown > 0}`);
  
  return cooldown;
}

// Test the calculation
const finalCooldown = testMarksmanCooldown();

// Verify the calculation is correct
const expectedCooldown = 750 * Math.pow(0.92, 5) * 0.60;
console.log(`Expected: ${expectedCooldown.toFixed(1)}ms`);
console.log(`Match: ${Math.abs(finalCooldown - expectedCooldown) < 0.1}`); 