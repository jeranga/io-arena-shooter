const { v4: uuidv4 } = require('uuid');
const { GAME_CONFIG } = require('./config');

class GameServer {
  constructor(io, config) {
    this.io = io;
    this.config = config;
    this.players = new Map();
    this.bullets = new Map();
    this.loot = new Map();
    this.lastLootSpawn = 0;
    
    // Weapon stats cache - stores pre-calculated weapon parameters for each player
    this.weaponStatsCache = new Map(); // playerId -> weaponId -> stats
    this.playerStatsVersion = new Map(); // playerId -> version number for cache invalidation
    this.tickCount = 0;
    this.lastSnapshot = 0;
    
    // Start game loop
    this.gameLoop = setInterval(() => {
      this.tick();
    }, 1000 / config.TICK_RATE);
  }
  
  addPlayer(socketId, playerName) {
    const player = {
      id: socketId,
      name: playerName || `Player${Math.floor(Math.random() * this.config.PLAYER_NAME_RANDOM_RANGE)}`,
      x: Math.random() * this.config.ARENA_WIDTH,
      y: Math.random() * this.config.ARENA_HEIGHT,
      vx: 0,
      vy: 0,
      angle: 0,
      hp: this.config.PLAYER_BASE_STATS.hp,
      maxHp: this.config.PLAYER_BASE_STATS.maxHp,
      speed: this.config.PLAYER_BASE_STATS.speed,
      xp: 0,
      level: 1,
      lastShot: 0,
      pendingUpgrades: null,
      
      // New weapon system
      weapons: {}, // Track weapon levels: { weaponId: level }
      passives: {}, // Track passive levels: { passiveId: level }
      legendaryUnlocks: {}, // Track legendary unlocks: { weaponId: true }
      legendaryChosen: {}, // Track which legendaries have been chosen: { weaponId: true }
      
      // Level up state
      isLevelingUp: false,
      levelUpStartTime: 0,
      levelUpTimeout: 10000, // 10 seconds
      
      // Saws state tracking
      sawsState: {
        isActive: false,
        lastStateChange: 0,
        currentDuration: 0,
        currentCooldown: 0
      },
      
      input: { up: false, down: false, left: false, right: false, mouseX: 0, mouseY: 0, shooting: false }
    };
    
    this.players.set(socketId, player);
    this.io.emit('playerJoined', { id: socketId, name: player.name });
    
    // Trigger initial weapon selection
    this.triggerInitialUpgrade(player);
  }
  
  removePlayer(socketId) {
    // Clean up weapon stats cache for this player
    this.playerStatsVersion.delete(socketId);
    
    this.players.delete(socketId);
    this.io.emit('playerLeft', { id: socketId });
  }
  
  triggerInitialUpgrade(player) {
    // Generate initial weapon choices
    const availableUpgrades = this.getAvailableUpgrades(player);
    
    if (availableUpgrades.length > 0) {
      player.pendingUpgrades = availableUpgrades;
      player.isLevelingUp = true;
      player.levelUpStartTime = Date.now();
      
      // Remove any existing saws when leveling up
      for (const [bulletId, bullet] of this.bullets) {
        if (bullet.ownerId === player.id && bullet.weaponId === 'saws') {
          this.bullets.delete(bulletId);
        }
      }
      
      this.io.to(player.id).emit('levelUp', { 
        level: player.level, 
        upgrades: availableUpgrades,
        startTime: player.levelUpStartTime,
        timeout: player.levelUpTimeout
      });
    }
  }
  
  handlePlayerInput(socketId, input) {
    const player = this.players.get(socketId);
    if (player) {
      player.input = { ...player.input, ...input };
    }
  }
  
  handleUpgradeSelection(socketId, upgradeIndex) {
    const player = this.players.get(socketId);
    if (player && player.pendingUpgrades && player.pendingUpgrades[upgradeIndex]) {
      const upgrade = player.pendingUpgrades[upgradeIndex];
      this.applyUpgrade(player, upgrade);
      player.pendingUpgrades = null;
      player.isLevelingUp = false;
      player.levelUpStartTime = 0;
      this.io.to(socketId).emit('upgradeSelected', { upgrade });
    }
  }
  
  handleDevLevelUp(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      
      // Force level up by setting XP to next level requirement
      const nextLevelXp = this.getXpForLevel(player.level + 1);
      player.xp = nextLevelXp;
      
      
      // Trigger level up logic
      this.collectLoot(player, { value: 0 }); // This will trigger level up
    }
  }
  
  applyUpgrade(player, upgrade) {
    // Add null check for player
    if (!player) {
      return false;
    }
    
    let upgradeApplied = false;
    
    switch (upgrade.type) {
      case 'weapon':
        // Add new weapon at level 1
        player.weapons[upgrade.weaponId] = 1;
        upgradeApplied = true;
        break;
        
      case 'weapon_level':
        // Upgrade existing weapon
        if (player.weapons[upgrade.weaponId] < this.config.MAX_WEAPON_LEVEL) {
          player.weapons[upgrade.weaponId]++;
          upgradeApplied = true;
        }
        break;
        
      case 'passive':
        // Add new passive at level 1
        player.passives[upgrade.passiveId] = 1;
        upgradeApplied = true;
        break;
        
      case 'passive_level':
        // Upgrade existing passive
        if (player.passives[upgrade.passiveId] < this.config.MAX_PASSIVE_LEVEL) {
          player.passives[upgrade.passiveId]++;
          upgradeApplied = true;
        }
        break;
        
      case 'legendary':
        // Apply legendary upgrade for specific weapon
        player.legendaryChosen = player.legendaryChosen || {};
        player.legendaryChosen[upgrade.weaponId] = true;
        upgradeApplied = true;
        break;
        
      default:
        return false;
    }
    
    // Invalidate weapon stats cache when upgrades change
    if (upgradeApplied) {
      this.invalidateWeaponStatsCache(player.id);
    }
    
    return upgradeApplied;
  }

  /**
   * Calculate weapon stats with all upgrades and passives applied
   * This is the core calculation that was previously done multiple times
   */
  calculateWeaponStats(player, weaponId) {
    const weapon = this.config.WEAPONS[weaponId];
    if (!weapon) return null;
    
    const weaponLevel = player.weapons[weaponId] || 0;
    if (weaponLevel === 0) return null;
    
    // Start with base stats
    let damage = weapon.baseDamage;
    let speed = weapon.baseSpeed;
    let radius = weapon.baseRadius || this.config.WEAPONS.marksman.baseRadius;
    let cooldown = weapon.baseCooldown;
    let sawCount = weapon.baseSawCount || 0;
    let duration = weapon.baseDuration || 0;
    let orbCount = weapon.baseOrbCount || 0;
    let spread = weapon.baseSpread || 0;
    let mineCount = weapon.baseMineCount || 0;
    let daggerCount = weapon.baseDaggerCount || 0;
    let turnRate = weapon.baseTurnRate || 0;
    
    // Apply per-level upgrades (level 1 = no upgrades, level 2 = 1 upgrade, etc.)
    for (let i = 0; i < weaponLevel - 1; i++) {
      damage *= (1 + weapon.perLevel.damage);
      speed *= (1 + weapon.perLevel.speed);
      radius *= (1 + weapon.perLevel.radius || 0);
      cooldown *= (1 + weapon.perLevel.cooldown);
      sawCount += weapon.perLevel.sawCount || 0;
      duration *= (1 + weapon.perLevel.duration || 0);
      orbCount += weapon.perLevel.orbCount || 0;
      spread *= (1 + weapon.perLevel.spread || 0);
      mineCount += weapon.perLevel.mineCount || 0;
      daggerCount += weapon.perLevel.daggerCount || 0;
      turnRate *= (1 + weapon.perLevel.turnRate || 0);
    }
    
    // Apply ALL passive bonuses globally
    for (const [passiveId, passiveLevel] of Object.entries(player.passives)) {
      const passive = this.config.PASSIVES[passiveId];
      if (passive) {
        if (passiveId === 'focusFire') {
          speed *= (1 + (passive.effect * passiveLevel));
        } else if (passiveId === 'biggerPayload') {
          radius *= (1 + (passive.effect * passiveLevel));
        } else if (passiveId === 'overclock') {
          cooldown *= (1 + (passive.effect * passiveLevel));
        } else if (passiveId === 'hardenedLoad') {
          damage *= (1 + (passive.effect * passiveLevel));
        }
        // quickstep does not affect bullets
      }
    }
    
    // Apply splitShot passive (adds projectiles every 2 levels)
    const splitShotLevel = player.passives.splitShot || 0;
    if (splitShotLevel > 0) {
      const extraProjectiles = Math.floor(splitShotLevel / 2);
      if (weaponId === 'marksman') {
        // For single-shot weapons, splitShot doesn't apply
      } else if (weaponId === 'burst') {
        orbCount += extraProjectiles;
      } else if (weaponId === 'chain') {
        orbCount += extraProjectiles;
      } else if (weaponId === 'mines') {
        mineCount += extraProjectiles;
      } else if (weaponId === 'daggers') {
        daggerCount += extraProjectiles;
      }
      // saws don't get extra projectiles from splitShot
    }
    
    // Apply legendary bonuses if unlocked and chosen
    if (player.legendaryUnlocks && player.legendaryUnlocks[weaponId] && 
        player.legendaryChosen && player.legendaryChosen[weaponId]) {
      if (weapon.legendary.damage) damage *= (1 + weapon.legendary.damage);
      if (weapon.legendary.speed) speed *= (1 + weapon.legendary.speed);
      if (weapon.legendary.radius) radius *= (1 + weapon.legendary.radius);
      if (weapon.legendary.cooldown) cooldown *= (1 + weapon.legendary.cooldown);
      if (weapon.legendary.sawCount) sawCount += weapon.legendary.sawCount;
      if (weapon.legendary.duration) duration *= (1 + weapon.legendary.duration);
      if (weapon.legendary.orbCount) orbCount += weapon.legendary.orbCount;
    }
    
    return {
      damage,
      speed,
      radius,
      cooldown,
      sawCount,
      duration,
      orbCount,
      spread,
      mineCount,
      daggerCount,
      turnRate
    };
  }

  /**
   * Get cached weapon stats, calculating if not cached or invalid
   */
  getWeaponStats(player, weaponId) {
    // Check if we have a valid cache for this player
    const playerVersion = this.playerStatsVersion.get(player.id) || 0;
    const cacheKey = `${player.id}_${playerVersion}`;
    
    if (!this.weaponStatsCache.has(cacheKey)) {
      this.weaponStatsCache.set(cacheKey, new Map());
    }
    
    const playerCache = this.weaponStatsCache.get(cacheKey);
    
    // Check if weapon stats are cached
    if (playerCache.has(weaponId)) {
      return playerCache.get(weaponId);
    }
    
    // Calculate and cache weapon stats
    const stats = this.calculateWeaponStats(player, weaponId);
    if (stats) {
      playerCache.set(weaponId, stats);
    }
    
    return stats;
  }

  /**
   * Invalidate weapon stats cache for a player (called when upgrades change)
   */
  invalidateWeaponStatsCache(playerId) {
    const currentVersion = this.playerStatsVersion.get(playerId) || 0;
    this.playerStatsVersion.set(playerId, currentVersion + 1);
    
    // Clean up old cache entries to prevent memory leaks
    this.cleanupWeaponStatsCache();
  }

  /**
   * Clean up old weapon stats cache entries
   */
  cleanupWeaponStatsCache() {
    const activePlayerIds = new Set(Array.from(this.players.keys()));
    const cacheKeysToDelete = [];
    
    for (const [cacheKey] of this.weaponStatsCache) {
      const playerId = cacheKey.split('_')[0];
      if (!activePlayerIds.has(playerId)) {
        cacheKeysToDelete.push(cacheKey);
      }
    }
    
    for (const key of cacheKeysToDelete) {
      this.weaponStatsCache.delete(key);
    }
  }
  
  tick() {
    this.tickCount++;
    
    // Check for level up timeouts
    this.checkLevelUpTimeouts();
    
    // Update player positions and handle input
    this.updatePlayers();
    
    // Update bullets
    this.updateBullets();
    
    // Check collisions
    this.checkCollisions();
    
    // Spawn loot
    this.spawnLoot();
    
    // Clean up expired entities
    this.cleanup();
    
    // Send snapshots
    if (this.tickCount % this.config.SNAPSHOT_RATE === 0) {
      this.broadcastSnapshot();
    }
  }
  
  updatePlayers() {
    for (const [socketId, player] of this.players) {
      // Skip movement if player is leveling up
      if (player.isLevelingUp) {
        // Still allow aiming but not movement
        if (player.input.mouseX !== 0 || player.input.mouseY !== 0) {
          player.angle = Math.atan2(player.input.mouseY, player.input.mouseX);
        }
        continue;
      }
      
      // Calculate movement based on input
      let vx = 0;
      let vy = 0;
      
      if (player.input.up) vy -= player.speed / this.config.TICK_RATE;
      if (player.input.down) vy += player.speed / this.config.TICK_RATE;
      if (player.input.left) vx -= player.speed / this.config.TICK_RATE;
      if (player.input.right) vx += player.speed / this.config.TICK_RATE;
      
      // Apply passive speed bonuses
      const quickstepLevel = player.passives.quickstep || 0;
      if (quickstepLevel > 0) {
        const speedBonus = 1 + (this.config.PASSIVES.quickstep.effect * quickstepLevel);
        vx *= speedBonus;
        vy *= speedBonus;
      }
      
      // Update velocity and position
      player.vx = vx;
      player.vy = vy;
      player.x += vx;
      player.y += vy;
      
      // Keep player in bounds
      player.x = Math.max(0, Math.min(this.config.ARENA_WIDTH, player.x));
      player.y = Math.max(0, Math.min(this.config.ARENA_HEIGHT, player.y));
      
      // Handle aiming
      if (player.input.mouseX !== 0 || player.input.mouseY !== 0) {
        player.angle = Math.atan2(player.input.mouseY, player.input.mouseX);
      }
      
      // Handle shooting - only if player has weapons and is not leveling up
      if (Object.keys(player.weapons).length > 0 && !player.isLevelingUp) {
        const now = Date.now();
        
        // Check each weapon's cooldown using cached stats
        for (const [weaponId, weaponLevel] of Object.entries(player.weapons)) {
          const weaponStats = this.getWeaponStats(player, weaponId);
          if (!weaponStats) continue;
          
          const cooldownKey = `lastShot_${weaponId}`;
          const timeSinceLastShot = now - (player[cooldownKey] || 0);
          
          // Use cached cooldown value
          const cooldown = weaponStats.cooldown;
          
          // Handle different weapon types
          if (weaponId === 'saws') {
            // Handle cyclical saws: active duration -> cooldown -> active duration
            this.updateSawsState(player, weaponId, now);
          } else if (weaponId === 'marksman' || weaponId === 'burst' || weaponId === 'chain' || weaponId === 'mines' || weaponId === 'daggers') {
            // Auto-firing weapons that fire toward mouse on cooldown
            if (timeSinceLastShot >= cooldown) {
              this.fireWeapon(player, weaponId);
              player[cooldownKey] = now;
            }
          } else {
            // Regular weapons need shooting input
            if (player.input.shooting && timeSinceLastShot >= cooldown) {
              this.fireWeapon(player, weaponId);
              player[cooldownKey] = now;
            }
          }
        }
      }
    }
  }
  
  updateSawsState(player, weaponId, now) {
    // Don't update saws if player is leveling up
    if (player.isLevelingUp) return;
    
    const weaponStats = this.getWeaponStats(player, weaponId);
    if (!weaponStats) return;
    
    // Use cached saws stats
    const duration = weaponStats.duration;
    const cooldown = weaponStats.cooldown;
    
    // Note: Passives don't affect duration/cooldown, only speed (which is handled in fireWeapon)
    
    // Initialize saws state if not set
    if (player.sawsState.lastStateChange === 0) {
      player.sawsState.lastStateChange = now;
      player.sawsState.currentDuration = duration;
      player.sawsState.currentCooldown = cooldown;
      player.sawsState.isActive = true;
      this.fireWeapon(player, weaponId); // Start with active saws
      return;
    }
    
    const timeSinceLastChange = now - player.sawsState.lastStateChange;
    
    if (player.sawsState.isActive) {
      // Currently active, check if duration has expired
      if (timeSinceLastChange >= player.sawsState.currentDuration) {
        // Duration expired, switch to cooldown
        player.sawsState.isActive = false;
        player.sawsState.lastStateChange = now;
        
        // Remove all saws for this player
        for (const [bulletId, bullet] of this.bullets) {
          if (bullet.ownerId === player.id && bullet.weaponId === 'saws') {
            this.bullets.delete(bulletId);
          }
        }
      }
    } else {
      // Currently in cooldown, check if cooldown has expired
      if (timeSinceLastChange >= player.sawsState.currentCooldown) {
        // Cooldown expired, switch to active
        player.sawsState.isActive = true;
        player.sawsState.lastStateChange = now;
        this.fireWeapon(player, weaponId); // Create new saws
      }
    }
  }

  fireWeapon(player, weaponId) {
    const weaponStats = this.getWeaponStats(player, weaponId);
    if (!weaponStats) return;
    
    // Check cooldown if this is not a saw weapon (saws are handled differently)
    if (weaponId !== 'saws') {
      const cooldownKey = `lastShot_${weaponId}`;
      const now = Date.now();
      const timeSinceLastShot = now - (player[cooldownKey] || 0);
      
      // Use cached cooldown value
      const cooldown = weaponStats.cooldown;
      
      // If not enough time has passed, don't fire
      if (timeSinceLastShot < cooldown) {
        return;
      }
      
      // Update last shot time
      player[cooldownKey] = now;
    }
    
    // Use cached weapon stats
    const { damage, speed, radius, sawCount, orbCount, spread, mineCount, duration, daggerCount, turnRate } = weaponStats;
    
    // Create bullet based on weapon type
    if (weaponId === 'marksman') {
      const bullet = {
        id: uuidv4(),
        ownerId: player.id,
        weaponId: weaponId,
        x: player.x + Math.cos(player.angle) * this.config.BULLET_SPAWN_OFFSET,
        y: player.y + Math.sin(player.angle) * this.config.BULLET_SPAWN_OFFSET,
        vx: Math.cos(player.angle) * speed / this.config.TICK_RATE,
        vy: Math.sin(player.angle) * speed / this.config.TICK_RATE,
        speed: speed,
        radius: Math.max(radius, damage * this.config.BULLET_DAMAGE_RADIUS_SCALE * (1 + (player.passives.biggerPayload || 0) * this.config.PASSIVES.biggerPayload.effect)), // Use calculated radius with damage scaling and biggerPayload
        damage: damage,
        ttl: this.config.BULLET_TTL,
        createdAt: Date.now()
      };
      
      this.bullets.set(bullet.id, bullet);
    } else if (weaponId === 'burst') {
      // Create burst orbs in a circle around the player
      const burstRadius = this.config.BURST_SPAWN_RADIUS; // Distance from player center
      const angleStep = (2 * Math.PI) / orbCount;
      
      for (let i = 0; i < orbCount; i++) {
        const angle = i * angleStep;
        const bullet = {
          id: uuidv4(),
          ownerId: player.id,
          weaponId: weaponId,
          x: player.x + Math.cos(angle) * burstRadius,
          y: player.y + Math.sin(angle) * burstRadius,
          vx: Math.cos(angle) * speed / this.config.TICK_RATE,
          vy: Math.sin(angle) * speed / this.config.TICK_RATE,
          radius: Math.max(radius, damage * this.config.BULLET_DAMAGE_RADIUS_SCALE * (1 + (player.passives.biggerPayload || 0) * this.config.PASSIVES.biggerPayload.effect)), // Use calculated radius with damage scaling and biggerPayload
          damage: damage,
          ttl: this.config.BULLET_TTL,
          createdAt: Date.now()
        };
        
        this.bullets.set(bullet.id, bullet);
      }
    } else if (weaponId === 'chain') {
      // Create splat gun orbs with random spread toward cursor
      const burstRadius = this.config.BURST_SPAWN_RADIUS; // Distance from player center
      
      for (let i = 0; i < orbCount; i++) {
        // Calculate random spread angle around the player's aim direction
        const randomSpread = (Math.random() - 0.5) * 2 * spread; // Random spread within the spread range
        const angle = player.angle + randomSpread;
        
        const bullet = {
          id: uuidv4(),
          ownerId: player.id,
          weaponId: weaponId,
          x: player.x + Math.cos(angle) * burstRadius,
          y: player.y + Math.sin(angle) * burstRadius,
          vx: Math.cos(angle) * speed / this.config.TICK_RATE,
          vy: Math.sin(angle) * speed / this.config.TICK_RATE,
          radius: Math.max(radius, damage * this.config.BULLET_DAMAGE_RADIUS_SCALE * (1 + (player.passives.biggerPayload || 0) * this.config.PASSIVES.biggerPayload.effect)),
          damage: damage,
          ttl: this.config.BULLET_TTL,
          createdAt: Date.now()
        };
        
        this.bullets.set(bullet.id, bullet);
      }
    } else if (weaponId === 'mines') {
      // Create lobbed mines that land and arm
      for (let i = 0; i < mineCount; i++) {
        // Calculate lob trajectory (slight arc toward cursor)
        const lobAngle = player.angle + (Math.random() - 0.5) * 0.3; // Small random spread
        const lobDistance = 100 + Math.random() * 50; // Random distance 100-150 pixels
        
        const bullet = {
          id: uuidv4(),
          ownerId: player.id,
          weaponId: weaponId,
          x: player.x + Math.cos(lobAngle) * this.config.BULLET_SPAWN_OFFSET,
          y: player.y + Math.sin(lobAngle) * this.config.BULLET_SPAWN_OFFSET,
          vx: Math.cos(lobAngle) * speed / this.config.TICK_RATE,
          vy: Math.sin(lobAngle) * speed / this.config.TICK_RATE,
          radius: Math.max(radius, damage * this.config.BULLET_DAMAGE_RADIUS_SCALE * (1 + (player.passives.biggerPayload || 0) * this.config.PASSIVES.biggerPayload.effect)),
          damage: damage,
          ttl: duration, // Mines last for their duration
          createdAt: Date.now(),
          isMine: true,
          isArmed: false,
          landTime: null,
          lobDistance: lobDistance,
          lobAngle: lobAngle
        };
        
        this.bullets.set(bullet.id, bullet);
      }
    } else if (weaponId === 'daggers') {
      // Create homing daggers
      for (let i = 0; i < daggerCount; i++) {
        // Calculate spread angle for multiple daggers
        const spreadAngle = (i - (daggerCount - 1) / 2) * 0.2; // Small spread between daggers
        const angle = player.angle + spreadAngle;
        
        const bullet = {
          id: uuidv4(),
          ownerId: player.id,
          weaponId: weaponId,
          x: player.x + Math.cos(angle) * this.config.BULLET_SPAWN_OFFSET,
          y: player.y + Math.sin(angle) * this.config.BULLET_SPAWN_OFFSET,
          vx: Math.cos(angle) * speed / this.config.TICK_RATE,
          vy: Math.sin(angle) * speed / this.config.TICK_RATE,
          radius: Math.max(radius, damage * this.config.BULLET_DAMAGE_RADIUS_SCALE * (1 + (player.passives.biggerPayload || 0) * this.config.PASSIVES.biggerPayload.effect)),
          damage: damage,
          ttl: this.config.BULLET_TTL,
          createdAt: Date.now(),
          isHoming: true,
          turnRate: turnRate,
          currentAngle: angle
        };
        
        this.bullets.set(bullet.id, bullet);
      }
    } else if (weaponId === 'saws') {
      // Remove existing saws for this player
      for (const [bulletId, bullet] of this.bullets) {
        if (bullet.ownerId === player.id && bullet.weaponId === 'saws') {
          this.bullets.delete(bulletId);
        }
      }
      
      // Create orbiting saws
      const orbitRadius = this.config.SAW_ORBIT_RADIUS; // Distance from player
      const angleStep = (2 * Math.PI) / sawCount;
      
      for (let i = 0; i < sawCount; i++) {
        const angle = i * angleStep;
        const bullet = {
          id: uuidv4(),
          ownerId: player.id,
          weaponId: weaponId,
          x: player.x + Math.cos(angle) * orbitRadius,
          y: player.y + Math.sin(angle) * orbitRadius,
          vx: 0, // Will be calculated in updateBullets
          vy: 0, // Will be calculated in updateBullets
          radius: Math.max(radius, damage * this.config.BULLET_DAMAGE_RADIUS_SCALE * (1 + (player.passives.biggerPayload || 0) * this.config.PASSIVES.biggerPayload.effect)), // Use calculated radius with damage scaling and biggerPayload
          damage: damage,
          ttl: -1, // Saws don't expire, they're managed by state
          createdAt: Date.now(),
          orbitRadius: orbitRadius,
          orbitAngle: angle,
          orbitSpeed: speed,
          isOrbiting: true
        };
        
        this.bullets.set(bullet.id, bullet);
      }
    }
  }
  
  updateBullets() {
    for (const [id, bullet] of this.bullets) {
      if (bullet.isOrbiting) {
        const player = this.players.get(bullet.ownerId);
        if (player) {
          bullet.orbitAngle += (bullet.orbitSpeed / this.config.TICK_RATE) / bullet.orbitRadius;
          bullet.x = player.x + Math.cos(bullet.orbitAngle) * bullet.orbitRadius;
          bullet.y = player.y + Math.sin(bullet.orbitAngle) * bullet.orbitRadius;
          bullet.vx = -Math.sin(bullet.orbitAngle) * bullet.orbitSpeed / this.config.TICK_RATE;
          bullet.vy = Math.cos(bullet.orbitAngle) * bullet.orbitSpeed / this.config.TICK_RATE;
        } else {
          this.bullets.delete(id);
        }
              } else if (bullet.isMine && !bullet.isArmed) {
          // Handle mine lobbing and landing
          const player = this.players.get(bullet.ownerId);
          if (!player) {
            this.bullets.delete(id);
            continue;
          }
          
          // Move mine in lob trajectory
          bullet.x += bullet.vx;
          bullet.y += bullet.vy;
          
          // Check if mine has reached its landing distance
          const distanceTraveled = Math.sqrt(
            Math.pow(bullet.x - (player.x + Math.cos(bullet.lobAngle) * this.config.BULLET_SPAWN_OFFSET), 2) +
            Math.pow(bullet.y - (player.y + Math.sin(bullet.lobAngle) * this.config.BULLET_SPAWN_OFFSET), 2)
          );
          
          if (distanceTraveled >= bullet.lobDistance) {
            // Mine has landed, arm it
            bullet.isArmed = true;
            bullet.landTime = Date.now();
            bullet.vx = 0;
            bullet.vy = 0;
          }
        } else if (bullet.isHoming) {
          // Handle homing daggers
          const player = this.players.get(bullet.ownerId);
          if (!player) {
            this.bullets.delete(id);
            continue;
          }
          
          // Find nearest enemy
          let nearestEnemy = null;
          let nearestDistance = Infinity;
          
          for (const [enemyId, enemy] of this.players) {
            if (enemyId === bullet.ownerId) continue;
            
            const dx = enemy.x - bullet.x;
            const dy = enemy.y - bullet.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < nearestDistance) {
              nearestDistance = distance;
              nearestEnemy = enemy;
            }
          }
          
          if (nearestEnemy) {
            // Calculate angle to target
            const targetAngle = Math.atan2(nearestEnemy.y - bullet.y, nearestEnemy.x - bullet.x);
            
            // Calculate current bullet angle
            const currentAngle = Math.atan2(bullet.vy, bullet.vx);
            
            // Calculate angle difference
            let angleDiff = targetAngle - currentAngle;
            
            // Normalize angle difference to [-π, π]
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            
            // Apply turn rate (limited by turn rate)
            const maxTurn = bullet.turnRate;
            const actualTurn = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxTurn);
            
            // Update bullet angle
            const newAngle = currentAngle + actualTurn;
            
            // Update velocity
            const bulletSpeed = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);
            bullet.vx = Math.cos(newAngle) * bulletSpeed;
            bullet.vy = Math.sin(newAngle) * bulletSpeed;
            bullet.currentAngle = newAngle;
          }
          
          // Move bullet
          bullet.x += bullet.vx;
          bullet.y += bullet.vy;
      } else {
        // Remove bullet if owner no longer exists
        if (!this.players.has(bullet.ownerId)) {
          this.bullets.delete(id);
          continue;
        }
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
      }
      bullet.ttl -= 1000 / this.config.TICK_RATE;
    }
  }
  
  checkCollisions() {
    const bulletsToDelete = new Set();
    outer: for (const [bulletId1, bullet1] of this.bullets) {
      if (!this.bullets.has(bulletId1)) continue;
      for (const [bulletId2, bullet2] of this.bullets) {
        if (bulletId1 === bulletId2) continue;
        if (!this.bullets.has(bulletId2)) continue;
        if (bullet1.ownerId === bullet2.ownerId) continue;
        const dx = bullet1.x - bullet2.x;
        const dy = bullet1.y - bullet2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const combinedRadius = bullet1.radius + bullet2.radius;
        if (distance < combinedRadius) {
          // Bullets collide!
          if (bullet1.weaponId === 'saws' && bullet2.weaponId !== 'saws') {
            bulletsToDelete.add(bulletId2);
          } else if (bullet2.weaponId === 'saws' && bullet1.weaponId !== 'saws') {
            bulletsToDelete.add(bulletId1);
          } else if (bullet1.weaponId === 'saws' && bullet2.weaponId === 'saws') {
            // Both are saws, do nothing
          } else {
            bulletsToDelete.add(bulletId1);
            bulletsToDelete.add(bulletId2);
          }
          break outer;
        }
      }
    }
    for (const bulletId of bulletsToDelete) {
      this.bullets.delete(bulletId);
    }
    // Bullet vs Player collisions
    for (const [bulletId, bullet] of this.bullets) {
      for (const [playerId, player] of this.players) {
        if (bullet.ownerId === playerId) continue;
        if (bullet.ownerId === player.id) continue;
        
        // Skip damage if player is leveling up
        if (player.isLevelingUp) continue;
        
        const dx = bullet.x - player.x;
        const dy = bullet.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < bullet.radius + this.config.PLAYER_RADIUS) {
          // Only armed mines can damage players
          if (bullet.isMine && !bullet.isArmed) {
            continue; // Skip unarmed mines
          }
          
          player.hp -= bullet.damage;
          if (bullet.weaponId !== 'saws') {
            bulletsToDelete.add(bulletId);
          }
          if (player.hp <= 0) {
            this.handlePlayerDeath(player);
          }
          break;
        }
      }
    }
    for (const bulletId of bulletsToDelete) {
      this.bullets.delete(bulletId);
    }
    // Player vs Loot collisions
    for (const [playerId, player] of this.players) {
      for (const [lootId, lootItem] of this.loot) {
        const dx = lootItem.x - player.x;
        const dy = lootItem.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < this.config.LOOT_COLLECTION_RADIUS) {
          this.collectLoot(player, lootItem);
          this.loot.delete(lootId);
        }
      }
    }
  }
  
  handlePlayerDeath(player) {
    const originalXp = player.xp;
    const originalX = player.x;
    const originalY = player.y;
    const lootValue = Math.floor(originalXp * this.config.LOOT_DROP_RATIO);
    if (lootValue > 0) {
      const lootItem = {
        id: uuidv4(),
        x: originalX,
        y: originalY,
        value: lootValue,
        timeout: this.config.LOOT_TIMEOUT,
        createdAt: Date.now()
      };
      this.loot.set(lootItem.id, lootItem);
    }
    Object.assign(player, {
      hp: this.config.PLAYER_BASE_STATS.hp,
      maxHp: this.config.PLAYER_BASE_STATS.maxHp,
      speed: this.config.PLAYER_BASE_STATS.speed,
      xp: 0,
      level: 1,
      pendingUpgrades: null,
      weapons: {},
      passives: {},
      legendaryUnlocks: {},
      legendaryChosen: {}
    });
    player.x = Math.random() * this.config.ARENA_WIDTH;
    player.y = Math.random() * this.config.ARENA_HEIGHT;
    
    // Invalidate weapon stats cache since player lost all upgrades
    this.invalidateWeaponStatsCache(player.id);
    
    this.io.emit('playerDied', { id: player.id, killer: 'Unknown' });
  }
  
  collectLoot(player, lootItem) {
    player.xp += lootItem.value;
    
    // Check for level up with infinite curve
    const nextLevelXp = this.getXpForLevel(player.level + 1);
    if (player.xp >= nextLevelXp) {
      player.level++;
      player.xp = player.xp - nextLevelXp; // Keep remainder XP
      
      // Check for legendary unlocks
      this.checkForLegendaryUnlocks(player);
      
      // Generate upgrade choices
      const availableUpgrades = this.getAvailableUpgrades(player);
      
      const upgradeChoices = [];
      for (let i = 0; i < this.config.UPGRADE_CHOICES_PER_LEVEL && availableUpgrades.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * availableUpgrades.length);
        upgradeChoices.push(availableUpgrades.splice(randomIndex, 1)[0]);
      }
      
      if (upgradeChoices.length > 0) {
        player.pendingUpgrades = upgradeChoices;
        player.isLevelingUp = true;
        player.levelUpStartTime = Date.now();
        
        // Remove any existing saws when leveling up
        for (const [bulletId, bullet] of this.bullets) {
          if (bullet.ownerId === player.id && bullet.weaponId === 'saws') {
            this.bullets.delete(bulletId);
          }
        }
        
        this.io.to(player.id).emit('levelUp', { 
          level: player.level, 
          upgrades: upgradeChoices,
          startTime: player.levelUpStartTime,
          timeout: player.levelUpTimeout
        });
      }
    }
  }
  
  checkForLegendaryUnlocks(player) {
    let legendaryUnlocked = false;
    
    // Check each weapon for legendary unlock
    for (const [weaponId, weaponLevel] of Object.entries(player.weapons)) {
      if (weaponLevel >= this.config.MAX_WEAPON_LEVEL && !player.legendaryUnlocks[weaponId]) {
        const weapon = this.config.WEAPONS[weaponId];
        if (weapon && weapon.pairedPassive) {
          const passiveLevel = player.passives[weapon.pairedPassive] || 0;
          if (passiveLevel >= this.config.MAX_PASSIVE_LEVEL) {
            // Unlock legendary!
            player.legendaryUnlocks[weaponId] = true;
            legendaryUnlocked = true;
            
            this.io.to(player.id).emit('legendaryUnlocked', {
              weaponId: weaponId,
              weaponName: weapon.name,
              passiveId: weapon.pairedPassive,
              passiveName: this.config.PASSIVES[weapon.pairedPassive].name
            });
          }
        }
      }
    }
    
    // Invalidate weapon stats cache if legendary was unlocked
    if (legendaryUnlocked) {
      this.invalidateWeaponStatsCache(player.id);
    }
  }
  
  getAvailableUpgrades(player) {
    const available = [];
    
    // If player has no weapons, offer first weapon choice (configurable number of random weapons)
    if (Object.keys(player.weapons).length === 0) {
      // Get all available weapons
      const allWeapons = Object.entries(this.config.WEAPONS).map(([weaponId, weapon]) => ({
        id: weaponId,
        name: weapon.name,
        description: weapon.description,
        type: 'weapon',
        weaponId: weaponId
      }));
      
      // Shuffle and take first N
      for (let i = allWeapons.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allWeapons[i], allWeapons[j]] = [allWeapons[j], allWeapons[i]];
      }
      
      return allWeapons.slice(0, this.config.INITIAL_WEAPON_CHOICES);
    }
    
    // Add weapon upgrades (max weapons and levels from config)
    if (Object.keys(player.weapons).length < this.config.MAX_WEAPONS) {
      // Offer new weapons
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
    
    // Add weapon level upgrades (max level from config)
    for (const [weaponId, weaponLevel] of Object.entries(player.weapons)) {
      if (weaponLevel < this.config.MAX_WEAPON_LEVEL) {
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
    
    // Add passive upgrades (max passives and levels from config)
    if (Object.keys(player.passives).length < this.config.MAX_PASSIVES) {
      // Offer new passives
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
    
    // Add passive level upgrades (max level from config)
    for (const [passiveId, passiveLevel] of Object.entries(player.passives)) {
      if (passiveLevel < this.config.MAX_PASSIVE_LEVEL) {
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
  
  getXpForLevel(level) {
    // XP needed for a specific level (not cumulative)
    // Level 1: 100 XP, Level 2: 150 XP, Level 3: 225 XP, etc.
    return Math.floor(this.config.XP_BASE * Math.pow(this.config.XP_SCALING, level - 1));
  }
  
  spawnLoot() {
    // Only spawn if under the limit
    if (this.loot.size >= this.config.MAX_LOOT_COUNT) {
      return;
    }
    
    if (Math.random() < this.config.LOOT_SPAWN_RATE) {
      const lootItem = {
        id: uuidv4(),
        x: Math.random() * this.config.ARENA_WIDTH,
        y: Math.random() * this.config.ARENA_HEIGHT,
        value: Math.floor(Math.random() * 
          (this.config.LOOT_VALUE_RANGE[1] - this.config.LOOT_VALUE_RANGE[0]) + 
          this.config.LOOT_VALUE_RANGE[0]),
        timeout: this.config.LOOT_TIMEOUT,
        createdAt: Date.now()
      };
      
      this.loot.set(lootItem.id, lootItem);
    }
  }
  
  cleanup() {
    const now = Date.now();
    
    // Remove expired bullets (but not saws, they're managed by state)
    for (const [id, bullet] of this.bullets) {
      if (bullet.ttl <= 0 && bullet.weaponId !== 'saws') {
        this.bullets.delete(id);
      }
    }
    
    // Remove expired loot
    for (const [id, lootItem] of this.loot) {
      if (now - lootItem.createdAt > lootItem.timeout) {
        this.loot.delete(id);
      }
    }
  }
  
  broadcastSnapshot() {
    const snapshot = {
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        x: p.x,
        y: p.y,
        angle: p.angle,
        hp: p.hp,
        maxHp: p.maxHp,
        speed: p.speed,
        level: p.level,
        xp: p.xp,
        weapons: p.weapons,
        passives: p.passives,
        legendaryUnlocks: p.legendaryUnlocks,
        legendaryChosen: p.legendaryChosen,
        isLevelingUp: p.isLevelingUp,
        levelUpStartTime: p.levelUpStartTime,
        levelUpTimeout: p.levelUpTimeout
      })),
      bullets: Array.from(this.bullets.values()).map(b => ({
        id: b.id,
        x: b.x,
        y: b.y,
        radius: b.radius,
        weaponId: b.weaponId,
        isOrbiting: b.isOrbiting || false
      })),
      loot: Array.from(this.loot.values()).map(l => ({
        id: l.id,
        x: l.x,
        y: l.y,
        value: l.value
      }))
    };
    
    this.io.emit('gameState', snapshot);
  }
  
  destroy() {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
    }
  }

  checkLevelUpTimeouts() {
    const now = Date.now();
    
    for (const [playerId, player] of this.players) {
      if (player.isLevelingUp && player.pendingUpgrades && player.pendingUpgrades.length > 0) {
        const timeElapsed = now - player.levelUpStartTime;
        
        if (timeElapsed >= player.levelUpTimeout) {
          // Auto-select the first upgrade
          console.log(`Auto-selecting upgrade for player ${player.name} due to timeout`);
          this.handleUpgradeSelection(playerId, 0);
        }
      }
    }
  }
}

module.exports = GameServer; 