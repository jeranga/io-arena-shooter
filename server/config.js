const GAME_CONFIG = {
  // Server settings
  TICK_RATE: 60, // 60 Hz = 16.67ms per tick (high performance for single player)
  SNAPSHOT_RATE: 2, // Every 100ms (60 ticks / 6)
  
  // Arena settings
  ARENA_WIDTH: 2000,
  ARENA_HEIGHT: 2000,
  
  // Player settings
  PLAYER_BASE_STATS: {
    hp: 100,
    maxHp: 100,
    speed: 200, // pixels per second
    xp: 0,
    level: 1
  },
  
  // Player collision and visual settings
  PLAYER_RADIUS: 20, // Player collision radius
  PLAYER_SPRITE_SIZE: 32, // Player sprite size in pixels
  BULLET_SPRITE_SIZE: 8, // Bullet sprite size in pixels
  LOOT_SPRITE_SIZE: 16, // Loot sprite size in pixels
  LOOT_COLLECTION_RADIUS: 40, // Distance to collect loot
  
  // Bullet settings
  BULLET_TTL: 2000, // 2 seconds in milliseconds
  BULLET_SPAWN_OFFSET: 30, // Distance from player center to spawn bullets
  BULLET_DAMAGE_RADIUS_SCALE: 0.2, // Scale factor for bullet radius based on damage
  
  // Weapon-specific settings
  BURST_SPAWN_RADIUS: 30, // Distance from player center for burst orbs
  SAW_ORBIT_RADIUS: 100, // Distance from player for orbiting saws
  
  // Upgrade system settings
  MAX_WEAPONS: 2, // Maximum number of weapons a player can have
  MAX_PASSIVES: 3, // Maximum number of passives a player can have
  MAX_WEAPON_LEVEL: 5, // Maximum level for weapons
  MAX_PASSIVE_LEVEL: 5, // Maximum level for passives
  INITIAL_WEAPON_CHOICES: 3, // Number of weapon choices for new players
  UPGRADE_CHOICES_PER_LEVEL: 3, // Number of upgrade choices per level up
  
  // Loot settings
  LOOT_TIMEOUT: 60000, // 60 seconds in milliseconds
  LOOT_SPAWN_RATE: 0.02, // probability per tick (reduced from 0.1)
  LOOT_VALUE_RANGE: [100, 150],
  MAX_LOOT_COUNT: 20, // maximum number of loot items in the arena
  LOOT_DROP_RATIO: 0.5, // Fraction of XP dropped as loot on death
  
  // XP progression - infinite curve
  XP_BASE: 100, // Base XP for level 1
  XP_SCALING: 1.3, // Multiplier for each level
  
  // Weapon System - Aggressive Upgrades (Weapons)
  WEAPONS: {
    marksman: {
      id: 'marksman',
      name: 'Marksman Shots',
      description: 'Single high-speed bullet toward cursor',
      baseCooldown: 750, // 0.75s in milliseconds
      baseDamage: 25,
      baseSpeed: 400,
      baseRadius: 5,
      perLevel: {
        cooldown: -0.08, // -8% per level
        damage: 0.06, // +6% per level
        speed: 0, // No speed increase
        radius: 0 // No radius increase
      },
      pairedPassive: 'focusFire',
      legendary: {
        cooldown: -0.40, // -40%
        damage: 0.30, // +30%
      }
    },
    saws: {
      id: 'saws',
      name: 'Whirling Saws',
      description: '2 rotating blades orbit player for 2 seconds',
      baseCooldown: 3000, // 3s in milliseconds
      baseDamage: 20,
      baseSpeed: 200, // Orbit speed in pixels per second
      baseRadius: 8,
      baseSawCount: 1, // Number of saws
      baseDuration: 2000, // 2 seconds duration
      perLevel: {
        cooldown: -0.08, // -8% cooldown per level (from design doc)
        damage: 0, // No damage increase
        speed: 0.07, // +7% orbit speed per level
        radius: 0, // No radius increase
        sawCount: 1, // +1 saw per level
        duration: 0.1 // +10% duration per level
      },
      pairedPassive: 'quickstep',
      legendary: {
        cooldown: 0, // No cooldown change
        damage: 0, // No damage change
        speed: 1.0, // +100% orbit speed (doubled)
        sawCount: 2, // +2 extra saws
        duration: 0.5 // +50% duration
      }
    },
    burst: {
      id: 'burst',
      name: 'Burst Orbs',
      description: '5 short-range orbs burst around cursor',
      baseCooldown: 1200, // 1.2s in milliseconds
      baseDamage: 25,
      baseSpeed: 300,
      baseRadius: 6,
      baseOrbCount: 2, // Number of orbs
      perLevel: {
        cooldown: -0.08, // -8% cooldown per level
        damage: 0.06, // +6% damage per level
        speed: 0, // No speed increase
        radius: 0.07, // +7% radius per level
        orbCount: 1 // +1 orb per level
      },
      pairedPassive: 'biggerPayload',
      legendary: {
        cooldown: 0, // No cooldown change
        damage: 0.50, // +50% damage
        radius: 0.50, // +50% radius
        orbCount: 0 // No extra orbs (fires twice instead)
      }
    },
    chain: {
      id: 'chain',
      name: 'Splat Gun',
      description: '5 short-range orbs burst toward cursor with random spread',
      baseCooldown: 1200, // 1.2s in milliseconds
      baseDamage: 25,
      baseSpeed: 300,
      baseRadius: 6,
      baseOrbCount: 5, // Number of orbs
      baseSpread: 0.5, // Base spread in radians (about 28.6 degrees)
      perLevel: {
        cooldown: -0.08, // -8% cooldown per level
        damage: 0.06, // +6% damage per level
        speed: 0, // No speed increase
        radius: 0, // No radius increase
        orbCount: 1, // +1 orb per level
        spread: -0.10 // -10% spread per level
      },
      pairedPassive: 'overclock',
      legendary: {
        cooldown: -0.30, // -30% cooldown
        damage: 0.25, // +25% damage
        orbCount: 3 // +3 extra orbs
      }
    },
    mines: {
      id: 'mines',
      name: 'Scatter Mines',
      description: '1 lobbed mine that arms on landing and explodes on contact',
      baseCooldown: 2500, // 2.5s in milliseconds
      baseDamage: 30,
      baseSpeed: 200, // Initial lob speed
      baseRadius: 8,
      baseMineCount: 1, // Number of mines
      baseDuration: 10000, // 10 seconds duration
      perLevel: {
        cooldown: -0.08, // -8% cooldown per level
        damage: 0.06, // +6% damage per level
        speed: 0, // No speed increase
        radius: 0.10, // +10% radius per level
        mineCount: 1, // +1 mine per level
        duration: 0.20 // +2s duration per level (20% of 10s base)
      },
      pairedPassive: 'hardenedLoad',
      legendary: {
        cooldown: 0, // No cooldown change
        damage: 0.35, // +35% damage
        radius: 0.40 // +40% radius
      }
    },
    daggers: {
      id: 'daggers',
      name: 'Homing Daggers',
      description: '2 daggers with slow homing toward nearest enemy',
      baseCooldown: 800, // 0.8s in milliseconds
      baseDamage: 20,
      baseSpeed: 250,
      baseRadius: 4,
      baseDaggerCount: 2, // Number of daggers
      baseTurnRate: 0.02, // Base turn rate in radians per tick
      perLevel: {
        cooldown: -0.08, // -8% cooldown per level
        damage: 0.06, // +6% damage per level
        speed: 0, // No speed increase
        radius: 0, // No radius increase
        daggerCount: 1, // +1 dagger per level
        turnRate: 0.06 // +6% turn rate per level
      },
      pairedPassive: 'splitShot',
      legendary: {
        cooldown: 0, // No cooldown change
        damage: 0.40, // +40% damage
        speed: 0.50, // +50% speed
        turnRate: 1.0 // +100% turn rate (instant turn)
      }
    }
  },
  
  // Passive Upgrades (Global Modifiers)
  PASSIVES: {
    focusFire: {
      id: 'focusFire',
      name: 'Focus Fire',
      description: 'Increases projectile speed for all weapons',
      effect: 0.06, // +6% projectile speed per level
      legendaryPair: 'marksman'
    },
    quickstep: {
      id: 'quickstep',
      name: 'Quickstep',
      description: 'Increases movement speed',
      effect: 0.04, // +4% movement speed per level
      legendaryPair: 'saws'
    },
    biggerPayload: {
      id: 'biggerPayload',
      name: 'Bigger Payload',
      description: 'Increases projectile size / AoE radius',
      effect: 0.2, // +20% projectile size per level
      legendaryPair: 'burst'
    },
    overclock: {
      id: 'overclock',
      name: 'Overclock',
      description: 'Reduces weapon cooldown for all weapons',
      effect: -0.05, // -5% weapon cooldown per level
      legendaryPair: 'chain'
    },
    hardenedLoad: {
      id: 'hardenedLoad',
      name: 'Hardened Load',
      description: 'Increases damage for all weapons',
      effect: 0.05, // +5% damage per level
      legendaryPair: 'mines'
    },
    splitShot: {
      id: 'splitShot',
      name: 'Split Shot',
      description: 'Adds +1 projectile every 2 levels (levels 2 and 4)',
      effect: 1, // +1 projectile every 2 levels
      legendaryPair: 'daggers'
    }
  },
  
  // Respawn settings
  RESPAWN_DELAY: 1000, // 1 second
  
  // Network settings
  MAX_PLAYERS: 32,
  INTERPOLATION_DELAY: 100, // ms
  
  // Client settings
  CLIENT_PORT: 3000, // Default client connection port
  PLAYER_NAME_RANDOM_RANGE: 1000 // Range for random player name generation
};

module.exports = { GAME_CONFIG }; 