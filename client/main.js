class GameClient {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.socket = null;
    
    // Game state
    this.gameState = {
      players: new Map(),
      bullets: new Map(),
      loot: new Map(),
      myId: null,
      myPlayer: null
    };
    
    // Level up state
    this.levelUpState = {
      isLevelingUp: false,
      startTime: 0,
      timeout: 10000,
      remainingTime: 0
    };
    
    // Game config (received from server)
    this.gameConfig = {
      WEAPONS: {},
      PASSIVES: {},
      MAX_WEAPONS: 3,
      MAX_PASSIVES: 3,
      MAX_WEAPON_LEVEL: 5,
      MAX_PASSIVE_LEVEL: 5
    };
    
    // Simple state tracking
    this.lastServerUpdate = 0;
    
    // Input state
    this.input = {
      up: false,
      down: false,
      left: false,
      right: false,
      mouseX: 0,
      mouseY: 0,
      shooting: false
    };
    
    // Simple input tracking
    
    // Camera
    this.camera = {
      x: 0,
      y: 0
    };
    
    // Assets
    this.sprites = {
      player: null,
      bullet: null,
      gem: null
    };
    
    // UI elements
    this.joinScreen = document.getElementById('joinScreen');
    this.joinButton = document.getElementById('joinButton');
    this.playerNameInput = document.getElementById('playerName');
    this.xpFill = document.getElementById('xpFill');
    this.xpText = document.getElementById('xpText');
    this.healthFill = document.getElementById('healthFill');
    this.levelSpan = document.getElementById('level');
    this.xpSpan = document.getElementById('xp');
    this.upgradeModal = document.getElementById('upgradeModal');
    this.upgradeOptions = document.getElementById('upgradeOptions');
    
    // Leaderboard and online count elements
    this.leaderboardList = document.getElementById('leaderboardList');
    this.onlineCountValue = document.getElementById('onlineCountValue');
    
    // Weapon system elements - will be populated dynamically
    this.weaponSlots = document.getElementById('weaponSlots');
    this.weaponSlotElements = []; // Will store dynamic slot elements
    this.passiveSlots = document.getElementById('passiveSlots');
    this.passiveSlotElements = []; // Will store dynamic slot elements
    
    // Legendary status
    this.legendaryStatus = document.getElementById('legendaryStatus');
    this.legendaryList = document.getElementById('legendaryList');
    
    // Dev mode elements
    this.devModeDiv = document.getElementById('devMode');
    this.devLevelUpBtn = document.getElementById('devLevelUp');
    this.devToggleBtn = document.getElementById('devToggle');
    
    // Keep-alive interval
    this.keepAliveInterval = null;
    
    // Current player name for reconnection
    this.currentPlayerName = '';
    
    this.init();
  }
  
  async init() {
    await this.loadAssets();
    this.setupEventListeners();
    this.setupJoinScreen();
    this.setupDevMode();
    this.startGameLoop();
  }
  
  async loadAssets() {
    // Create placeholder sprites
    this.sprites.player = this.createSprite('#4CAF50', 32);
    this.sprites.bullet = this.createSprite('#FFD700', 8);
    this.sprites.gem = this.createSprite('#FF69B4', 16);
  }
  
  createSprite(color, size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
    ctx.fill();
    
    return canvas;
  }
  
  setupEventListeners() {
    // Keyboard input
    document.addEventListener('keydown', (e) => {
      switch(e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.input.up = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.input.down = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.input.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.input.right = true;
          break;
        case 'Digit1':
          this.selectUpgrade(0);
          break;
        case 'Digit2':
          this.selectUpgrade(1);
          break;
        case 'Digit3':
          this.selectUpgrade(2);
          break;
      }
    });
    
    document.addEventListener('keyup', (e) => {
      switch(e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.input.up = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.input.down = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.input.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.input.right = false;
          break;
      }
    });
    
    // Mouse input
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Convert to world coordinates
      this.input.mouseX = x - this.canvas.width / 2;
      this.input.mouseY = y - this.canvas.height / 2;
    });
    
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { // Left click
        this.input.shooting = true;
      }
    });
    
    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) { // Left click
        this.input.shooting = false;
      }
    });
  }
  
  setupJoinScreen() {
    this.joinButton.addEventListener('click', () => {
      const playerName = this.playerNameInput.value.trim() || 'Player';
      this.joinGame(playerName);
    });
    
    this.playerNameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.joinButton.click();
      }
    });
  }
  
  setupDevMode() {
    // Toggle dev mode with button
    this.devToggleBtn.addEventListener('click', () => {
      this.devModeDiv.style.display = this.devModeDiv.style.display === 'none' ? 'block' : 'none';
    });
    
    // Level up button
    this.devLevelUpBtn.addEventListener('click', () => {
      if (this.socket && this.socket.connected) {
        this.socket.emit('devLevelUp');
      }
    });
    
    // Keyboard shortcut: Ctrl+L to level up
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        if (this.socket && this.socket.connected) {
          this.socket.emit('devLevelUp');
        }
      }
    });
  }
  
  joinGame(playerName) {
    // Store player name for reconnection
    this.currentPlayerName = playerName;
    
    // Disconnect any existing socket
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    // Create new connection
    this.socket = io({
      transports: ['polling', 'websocket'],
      timeout: 20000,
      reconnection: false // Disable auto-reconnection for now
    });
    
    this.setupSocketEvents();
  }
  
  setupSocketEvents() {
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.socket.emit('join', this.currentPlayerName);
    });
    
    this.socket.on('gameState', (state) => {
      this.updateGameState(state);
      // Debug: log weapon system data
      if (state.players && state.players.length > 0) {
        const myPlayer = state.players.find(p => p.id === this.gameState.myId);
        if (myPlayer) {
          // console.log('My player weapons:', myPlayer.weapons);
          // console.log('My player passives:', myPlayer.passives);
          // console.log('My player legendary unlocks:', myPlayer.legendaryUnlocks);
        }
      }
    });
    
    this.socket.on('levelUp', (data) => {
      this.levelUpState.isLevelingUp = true;
      this.levelUpState.startTime = data.startTime || Date.now();
      this.levelUpState.timeout = data.timeout || 10000;
      this.levelUpState.remainingTime = this.levelUpState.timeout;
      
      this.showUpgradeModal(data.upgrades);
    });
    
    this.socket.on('upgradeSelected', (data) => {
      this.levelUpState.isLevelingUp = false;
      this.levelUpState.remainingTime = 0;
      this.hideUpgradeModal();
    });
    
    this.socket.on('legendaryUnlocked', (data) => {
      // You could add a notification here
    });
    
    this.socket.on('playerJoined', (data) => {
      // console.log(`${data.name} joined the game`);
    });
    
    this.socket.on('playerLeft', (data) => {
      // console.log('Player left the game');
    });
    
    this.socket.on('playerDied', (data) => {
      // console.log('Player died');
    });
    
    this.socket.on('yourId', (id) => {
      this.gameState.myId = id;
    });
    
    this.socket.on('gameConfig', (config) => {
      this.gameConfig = config;
      console.log('Received game config:', config);
      this.setupDynamicSlots(); // Setup slots after config is received
    });
    
    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      // Clear keep-alive interval
      if (this.keepAliveInterval) {
        clearInterval(this.keepAliveInterval);
        this.keepAliveInterval = null;
      }
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });
    
    // Remove reconnect handler since reconnection is disabled
    
    // Keep-alive ping to prevent server from stopping
    this.keepAliveInterval = setInterval(() => {
      if (this.socket && this.socket.connected) {
        // Send a ping to keep the connection alive
        this.socket.emit('ping');
      }
    }, 30000); // Every 30 seconds
    
    this.joinScreen.style.display = 'none';
  }
  
  setupDynamicSlots() {
    // Clear existing slots
    this.weaponSlotElements.forEach(slot => slot.remove());
    this.passiveSlotElements.forEach(slot => slot.remove());
    this.weaponSlotElements = [];
    this.passiveSlotElements = [];

    // Create weapon slots
    for (let i = 0; i < this.gameConfig.MAX_WEAPONS; i++) {
      const slot = document.createElement('div');
      slot.className = 'weapon-slot';
      this.weaponSlots.appendChild(slot);
      this.weaponSlotElements.push(slot);
    }

    // Create passive slots
    for (let i = 0; i < this.gameConfig.MAX_PASSIVES; i++) {
      const slot = document.createElement('div');
      slot.className = 'passive-slot';
      this.passiveSlots.appendChild(slot);
      this.passiveSlotElements.push(slot);
    }
  }

  updateGameState(state) {
    // Update players
    this.gameState.players.clear();
    state.players.forEach(player => {
      this.gameState.players.set(player.id, player);
      if (player.id === this.gameState.myId) {
        this.gameState.myPlayer = player;
        this.updateCamera(player);
        this.updateHUD(player);
        
        // Debug: log player data
        // console.log('My player data:', player);
      }
    });
    
    // Update bullets
    this.gameState.bullets.clear();
    state.bullets.forEach(bullet => {
      this.gameState.bullets.set(bullet.id, bullet);
    });
    
    // Update loot
    this.gameState.loot.clear();
    state.loot.forEach(loot => {
      this.gameState.loot.set(loot.id, loot);
    });
    
    // Update leaderboard and online count
    if (state.leaderboard) {
      this.updateLeaderboard(state.leaderboard);
    }
    if (state.onlineCount !== undefined) {
      this.updateOnlineCount(state.onlineCount);
    }
    
    // Send input to server
    if (this.socket && this.socket.connected) {
      this.socket.emit('input', this.input);
    }
  }
  
  updateCamera(player) {
    this.camera.x = player.x - this.canvas.width / 2;
    this.camera.y = player.y - this.canvas.height / 2;
  }
  
  updateHUD(player) {
    const healthPercent = (player.hp / player.maxHp) * 100;
    this.healthFill.style.width = `${healthPercent}%`;
    this.levelSpan.textContent = player.level;
    this.xpSpan.textContent = player.xp;
    
    // Update XP progress bar
    this.updateXPProgress(player);
    
    // Update weapon slots
    this.updateWeaponSlots(player.weapons || {});
    
    // Update passive slots
    this.updatePassiveSlots(player.passives || {});
    
    // Update legendary status
    this.updateLegendaryStatus(player.legendaryUnlocks || {}, player.legendaryChosen || {});
  }
  
    updateXPProgress(player) {
    // Calculate XP progress for current level
    const xpNeededForThisLevel = this.getXpForLevel(player.level + 1);
    const xpInCurrentLevel = player.xp;
    
    const xpPercent = (xpInCurrentLevel / xpNeededForThisLevel) * 100;
    this.xpFill.style.width = `${Math.max(0, Math.min(100, xpPercent))}%`;
    this.xpText.textContent = `${xpInCurrentLevel} / ${xpNeededForThisLevel} XP`;
  }
  
  getXpForLevel(level) {
    // Same formula as server: base * (scaling ^ (level - 1))
    const base = 100;
    const scaling = 1.3;
    return Math.floor(base * Math.pow(scaling, level - 1));
  }
  
  getWeaponDisplayName(weaponId) {
    const weaponNames = {
      marksman: 'Marksman',
      saws: 'Whirling Saws',
      burst: 'Burst Orbs',
      chain: 'Splat Gun',
      mines: 'Scatter Mines',
      daggers: 'Homing Daggers'
    };
    return weaponNames[weaponId] || weaponId;
  }
  
  getPassiveDisplayName(passiveId) {
    const passiveNames = {
      focusFire: 'Focus Fire',
      quickstep: 'Quickstep',
      biggerPayload: 'Bigger Payload',
      overclock: 'Overclock',
      hardenedLoad: 'Hardened Load',
      splitShot: 'Split Shot'
    };
    return passiveNames[passiveId] || passiveId;
  }
  
  getWeaponUpgradeBenefits(weaponId, level) {
    const weapon = this.gameConfig.WEAPONS[weaponId];
    if (!weapon || !weapon.perLevel) {
      return 'Improved stats';
    }
    
    const benefits = [];
    const perLevel = weapon.perLevel;
    
    if (perLevel.cooldown !== undefined && perLevel.cooldown !== 0) {
      const percentage = Math.round(Math.abs(perLevel.cooldown * 100));
      benefits.push(perLevel.cooldown < 0 ? `-${percentage}% cooldown` : `+${percentage}% cooldown`);
    }
    
    if (perLevel.damage !== undefined && perLevel.damage !== 0) {
      const percentage = Math.round(Math.abs(perLevel.damage * 100));
      benefits.push(perLevel.damage > 0 ? `+${percentage}% damage` : `-${percentage}% damage`);
    }
    
    if (perLevel.speed !== undefined && perLevel.speed !== 0) {
      const percentage = Math.round(Math.abs(perLevel.speed * 100));
      benefits.push(perLevel.speed > 0 ? `+${percentage}% speed` : `-${percentage}% speed`);
    }
    
    if (perLevel.radius !== undefined && perLevel.radius !== 0) {
      const percentage = Math.round(Math.abs(perLevel.radius * 100));
      benefits.push(perLevel.radius > 0 ? `+${percentage}% radius` : `-${percentage}% radius`);
    }
    
    if (perLevel.sawCount !== undefined && perLevel.sawCount !== 0) {
      benefits.push(`+${perLevel.sawCount} saw`);
    }
    
    if (perLevel.orbCount !== undefined && perLevel.orbCount !== 0) {
      benefits.push(`+${perLevel.orbCount} orb`);
    }
    
    if (perLevel.mineCount !== undefined && perLevel.mineCount !== 0) {
      benefits.push(`+${perLevel.mineCount} mine`);
    }
    
    if (perLevel.daggerCount !== undefined && perLevel.daggerCount !== 0) {
      benefits.push(`+${perLevel.daggerCount} dagger`);
    }
    
    if (perLevel.duration !== undefined && perLevel.duration !== 0) {
      const percentage = Math.round(Math.abs(perLevel.duration * 100));
      benefits.push(perLevel.duration > 0 ? `+${percentage}% duration` : `-${percentage}% duration`);
    }
    
    if (perLevel.spread !== undefined && perLevel.spread !== 0) {
      const percentage = Math.round(Math.abs(perLevel.spread * 100));
      benefits.push(perLevel.spread < 0 ? `-${percentage}% spread` : `+${percentage}% spread`);
    }
    
    if (perLevel.turnRate !== undefined && perLevel.turnRate !== 0) {
      const percentage = Math.round(Math.abs(perLevel.turnRate * 100));
      benefits.push(perLevel.turnRate > 0 ? `+${percentage}% turn rate` : `-${percentage}% turn rate`);
    }
    
    return benefits.length > 0 ? benefits.join(', ') : 'Improved stats';
  }
  
  getPassiveUpgradeBenefits(passiveId, level) {
    const passive = this.gameConfig.PASSIVES[passiveId];
    if (!passive || passive.effect === undefined) {
      return 'Improved effect';
    }
    
    const effect = passive.effect;
    const percentage = Math.round(Math.abs(effect * 100));
    
    if (passiveId === 'splitShot') {
      return '+1 projectile (every 2 levels)';
    }
    
    if (effect > 0) {
      return `+${percentage}% ${this.getPassiveEffectDescription(passiveId)}`;
    } else {
      return `-${percentage}% ${this.getPassiveEffectDescription(passiveId)}`;
    }
  }
  
  getPassiveEffectDescription(passiveId) {
    const descriptions = {
      focusFire: 'projectile speed',
      quickstep: 'movement speed',
      biggerPayload: 'projectile size',
      overclock: 'weapon cooldown',
      hardenedLoad: 'damage'
    };
    
    return descriptions[passiveId] || 'effect';
  }
  
  updateWeaponSlots(weapons) {
    const weaponArray = Object.entries(weapons);
    this.weaponSlots.querySelector('h4').textContent = `Weapons (${weaponArray.length}/${this.gameConfig.MAX_WEAPONS})`;
    
    // Clear all slots
    this.weaponSlotElements.forEach(slot => slot.innerHTML = '<span class="slot-empty">Empty</span>');
    this.weaponSlotElements.forEach(slot => slot.className = 'weapon-slot');
    
    // Fill slots with weapons
    weaponArray.forEach(([weaponId, level], index) => {
      const slot = this.weaponSlotElements[index];
      if (slot) {
        // Use proper weapon names if available, fallback to ID
        const weaponName = this.getWeaponDisplayName(weaponId);
        slot.innerHTML = `
          <div class="slot-content">
            <div class="slot-name">${weaponName}</div>
            <div class="slot-level">Level ${level}/${this.gameConfig.MAX_WEAPON_LEVEL}</div>
          </div>
        `;
        slot.className = 'weapon-slot filled';
      }
    });
  }
  
  updatePassiveSlots(passives) {
    const passiveArray = Object.entries(passives);
    this.passiveSlots.querySelector('h4').textContent = `Passives (${passiveArray.length}/${this.gameConfig.MAX_PASSIVES})`;
    
    // Clear all slots
    this.passiveSlotElements.forEach(slot => slot.innerHTML = '<span class="slot-empty">Empty</span>');
    this.passiveSlotElements.forEach(slot => slot.className = 'passive-slot');
    
    // Fill slots with passives
    passiveArray.forEach(([passiveId, level], index) => {
      const slot = this.passiveSlotElements[index];
      if (slot) {
        // Use proper passive names if available, fallback to ID
        const passiveName = this.getPassiveDisplayName(passiveId);
        slot.innerHTML = `
          <div class="slot-content">
            <div class="slot-name">${passiveName}</div>
            <div class="slot-level">Level ${level}/${this.gameConfig.MAX_PASSIVE_LEVEL}</div>
          </div>
        `;
        slot.className = 'passive-slot filled';
      }
    });
  }
  
  updateLegendaryStatus(legendaryUnlocks, legendaryChosen = {}) {
    this.legendaryList.innerHTML = '';
    
    Object.keys(legendaryUnlocks).forEach(weaponId => {
      const legendaryDiv = document.createElement('div');
      legendaryDiv.className = 'legendary';
      const weaponName = this.getWeaponDisplayName(weaponId);
      
      if (legendaryChosen[weaponId]) {
        legendaryDiv.innerHTML = `
          <div class="legendary-active">
            <span class="legendary-name">${weaponName}</span>
            <span class="legendary-status">ACTIVE</span>
          </div>
        `;
      } else {
        legendaryDiv.innerHTML = `
          <div class="legendary-unlocked">
            <span class="legendary-name">${weaponName}</span>
            <span class="legendary-status">UNLOCKED</span>
          </div>
        `;
      }
      
      this.legendaryList.appendChild(legendaryDiv);
    });
    
    if (Object.keys(legendaryUnlocks).length === 0) {
      this.legendaryList.innerHTML = '<div class="no-legendaries">No legendaries unlocked</div>';
    }
  }
  
  updateLeaderboard(leaderboard) {
    this.leaderboardList.innerHTML = '';
    
    if (leaderboard.length === 0) {
      this.leaderboardList.innerHTML = '<div class="leaderboard-entry">No players online</div>';
      return;
    }
    
    leaderboard.forEach((player, index) => {
      const entry = document.createElement('div');
      entry.className = 'leaderboard-entry';
      
      // Highlight current player
      if (this.gameState.myPlayer && player.name === this.gameState.myPlayer.name) {
        entry.classList.add('self');
      }
      
      entry.innerHTML = `
        <div class="leaderboard-rank">${index + 1}</div>
        <div class="leaderboard-name">${player.name}</div>
        <div class="leaderboard-level">L${player.level}</div>
      `;
      
      this.leaderboardList.appendChild(entry);
    });
  }
  
  updateOnlineCount(count) {
    this.onlineCountValue.textContent = count;
  }
  
  showUpgradeModal(upgrades) {
    // console.log('Showing upgrade modal with options:', upgrades);
    this.upgradeOptions.innerHTML = '';
    
    upgrades.forEach((upgrade, index) => {
      const option = document.createElement('div');
      option.className = 'upgrade-option';
      
      // Create structured content instead of plain text
      const titleDiv = document.createElement('div');
      titleDiv.className = 'upgrade-title';
      
      const descriptionDiv = document.createElement('div');
      descriptionDiv.className = 'upgrade-description';
      
      const statsDiv = document.createElement('div');
      statsDiv.className = 'upgrade-stats';
      
      // Determine upgrade type and styling
      let upgradeType = 'weapon';
      let typeColor = '#FF6B6B';
      
      if (upgrade.type === 'passive' || upgrade.type === 'passive_level') {
        upgradeType = 'passive';
        typeColor = '#4ECDC4';
      } else if (upgrade.type === 'legendary') {
        upgradeType = 'legendary';
        typeColor = '#FFD700';
      }
      
      // Apply styling based on type
      option.style.borderLeft = `4px solid ${typeColor}`;
      option.className = `upgrade-option upgrade-${upgradeType}`;
      
      // Special styling for legendary upgrades
      if (upgrade.type === 'legendary') {
        option.style.background = 'linear-gradient(135deg, #2a2a2a, #444)';
        option.style.borderColor = '#FFD700';
        option.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.3)';
      }
      
      // Build title with name
      titleDiv.innerHTML = `<strong>${upgrade.name}</strong>`;
      
      // Build description - more specific about what gets upgraded
      let description = '';
      if (upgrade.type === 'weapon') {
        description = upgrade.description;
      } else if (upgrade.type === 'weapon_level') {
        const upgradeBenefits = this.getWeaponUpgradeBenefits(upgrade.weaponId, upgrade.currentLevel + 1);
        description = upgradeBenefits;
      } else if (upgrade.type === 'passive') {
        description = upgrade.description;
      } else if (upgrade.type === 'passive_level') {
        const upgradeBenefits = this.getPassiveUpgradeBenefits(upgrade.passiveId, upgrade.currentLevel + 1);
        description = upgradeBenefits;
      } else if (upgrade.type === 'legendary') {
        const weapon = this.getWeaponDisplayName(upgrade.weaponId);
        description = `Unlock legendary ${weapon} with enhanced abilities`;
      }
      
      descriptionDiv.textContent = description;
      
      // Build stats info
      let stats = '';
      if (upgrade.type === 'weapon') {
        stats = 'NEW';
      } else if (upgrade.type === 'passive') {
        stats = 'NEW';
      } else if (upgrade.type === 'weapon_level' || upgrade.type === 'passive_level') {
        const maxLevel = upgrade.type === 'weapon_level' ? this.gameConfig.MAX_WEAPON_LEVEL : this.gameConfig.MAX_PASSIVE_LEVEL;
        stats = `Level ${upgrade.currentLevel + 1}/${maxLevel}`;
      } else if (upgrade.type === 'legendary') {
        stats = 'LEGENDARY';
      }
      
      if (stats) {
        statsDiv.textContent = stats;
        statsDiv.style.color = typeColor;
        statsDiv.style.fontWeight = 'bold';
      }
      
      // Assemble the option
      option.appendChild(titleDiv);
      option.appendChild(descriptionDiv);
      if (stats) {
        option.appendChild(statsDiv);
      }
      
      option.onclick = () => this.selectUpgrade(index);
      this.upgradeOptions.appendChild(option);
    });
    
    this.upgradeModal.style.display = 'block';
  }
  
  hideUpgradeModal() {
    this.upgradeModal.style.display = 'none';
  }
  
  updateLevelUpTimer() {
    if (this.levelUpState.isLevelingUp) {
      const elapsed = Date.now() - this.levelUpState.startTime;
      this.levelUpState.remainingTime = Math.max(0, this.levelUpState.timeout - elapsed);
      
      // Update timer bar if it exists
      const timerBar = document.getElementById('levelUpTimer');
      if (timerBar) {
        const progress = (this.levelUpState.remainingTime / this.levelUpState.timeout) * 100;
        timerBar.style.width = `${progress}%`;
      }
      
      // Auto-hide modal if time runs out (server will auto-select)
      if (this.levelUpState.remainingTime <= 0) {
        this.levelUpState.isLevelingUp = false;
        this.hideUpgradeModal();
      }
    }
  }
  

  
  selectUpgrade(index) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('selectUpgrade', index);
    }
  }
  
  startGameLoop() {
    const gameLoop = () => {
      this.updateLevelUpTimer();
      this.render();
      requestAnimationFrame(gameLoop);
    };
    gameLoop();
  }
  
  render() {
    // Clear canvas
    this.ctx.fillStyle = '#0a0a0a';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw background grid
    this.drawGrid();
    
    // Draw game entities
    this.drawLoot();
    this.drawBullets();
    this.drawPlayers();
    
    // Debug: Draw connection status (commented out for performance)
    // this.ctx.fillStyle = '#fff';
    // this.ctx.font = '16px Arial';
    // this.ctx.fillText(`Players: ${this.gameState.players.size}`, 10, 50);
    // this.ctx.fillText(`My ID: ${this.gameState.myId || 'None'}`, 10, 70);
    // this.ctx.fillText(`Connected: ${this.socket?.connected || false}`, 10, 90);
  }
  
  drawGrid() {
    const gridSize = 50;
    const offsetX = this.camera.x % gridSize;
    const offsetY = this.camera.y % gridSize;
    
    this.ctx.strokeStyle = '#1a1a1a';
    this.ctx.lineWidth = 1;
    
    // Vertical lines
    for (let x = -offsetX; x < this.canvas.width + gridSize; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = -offsetY; y < this.canvas.height + gridSize; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }
  
  drawLoot() {
    const viewportLeft = this.camera.x - 100;
    const viewportRight = this.camera.x + this.canvas.width + 100;
    const viewportTop = this.camera.y - 100;
    const viewportBottom = this.camera.y + this.canvas.height + 100;
    
    this.gameState.loot.forEach(loot => {
      // Viewport culling for performance
      if (loot.x < viewportLeft || loot.x > viewportRight || 
          loot.y < viewportTop || loot.y > viewportBottom) {
        return;
      }
      
      const x = loot.x - this.camera.x;
      const y = loot.y - this.camera.y;
      
      // Calculate size based on XP value (10-50 XP = 8-20 pixels)
      const minSize = 8;
      const maxSize = 20;
      const size = minSize + (loot.value - 10) * (maxSize - minSize) / 40;
      
      this.ctx.save();
      this.ctx.translate(x, y);
      
      // Draw gem with size based on XP value
      this.ctx.drawImage(this.sprites.gem, -size/2, -size/2, size, size);
      
      this.ctx.restore();
    });
  }
  
  drawBullets() {
    const viewportLeft = this.camera.x - 50;
    const viewportRight = this.camera.x + this.canvas.width + 50;
    const viewportTop = this.camera.y - 50;
    const viewportBottom = this.camera.y + this.canvas.height + 50;
    
    this.gameState.bullets.forEach(bullet => {
      // Viewport culling for performance
      if (bullet.x < viewportLeft || bullet.x > viewportRight || 
          bullet.y < viewportTop || bullet.y > viewportBottom) {
        return;
      }
      
      const x = bullet.x - this.camera.x;
      const y = bullet.y - this.camera.y;
      
      this.ctx.save();
      this.ctx.translate(x, y);
      
      // Draw different bullet types
      if (bullet.weaponId === 'saws') {
        // Draw saw blade
        this.ctx.fillStyle = '#FF4444';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, bullet.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw saw teeth
        this.ctx.strokeStyle = '#FF0000';
        this.ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI * 2) / 8;
          const x1 = Math.cos(angle) * (bullet.radius - 2);
          const y1 = Math.sin(angle) * (bullet.radius - 2);
          const x2 = Math.cos(angle) * bullet.radius;
          const y2 = Math.sin(angle) * bullet.radius;
          this.ctx.beginPath();
          this.ctx.moveTo(x1, y1);
          this.ctx.lineTo(x2, y2);
          this.ctx.stroke();
        }
      } else {
        // Draw regular bullet
        this.ctx.drawImage(this.sprites.bullet, -bullet.radius, -bullet.radius, bullet.radius * 2, bullet.radius * 2);
      }
      
      this.ctx.restore();
    });
  }
  
  drawPlayers() {
    const viewportLeft = this.camera.x - 100;
    const viewportRight = this.camera.x + this.canvas.width + 100;
    const viewportTop = this.camera.y - 100;
    const viewportBottom = this.camera.y + this.canvas.height + 100;
    
    this.gameState.players.forEach(player => {
      // Viewport culling for performance
      if (player.x < viewportLeft || player.x > viewportRight || 
          player.y < viewportTop || player.y > viewportBottom) {
        return;
      }
      
      const x = player.x - this.camera.x;
      const y = player.y - this.camera.y;
      
      // Draw player body (rotated)
      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.rotate(player.angle);
      
      // Draw player body with different color if leveling up
      if (player.isLevelingUp) {
        // Create a pulsing effect for leveling up players
        const pulseIntensity = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;
        this.ctx.globalAlpha = pulseIntensity;
        this.ctx.fillStyle = '#FFD700'; // Gold color for leveling up
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 20, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1;
      } else {
        // Normal player drawing
        this.ctx.drawImage(this.sprites.player, -16, -16, 32, 32);
      }
      
      this.ctx.restore();
      
      // Draw name and healthbar (not rotated - always upright)
      this.drawPlayerUI(player, x, y);
    });
  }
  
  drawPlayerUI(player, x, y) {
    const nameY = y - 45; // Position above player
    const healthbarY = y - 30; // Position below name
    const healthbarWidth = 60;
    const healthbarHeight = 6;
    
    // Draw player name
    this.ctx.save();
    this.ctx.textAlign = 'center';
    this.ctx.font = '12px Arial';
    this.ctx.fillStyle = '#FFFFFF';
    
    // Add shadow for better readability
    this.ctx.shadowColor = '#000000';
    this.ctx.shadowBlur = 2;
    this.ctx.shadowOffsetX = 1;
    this.ctx.shadowOffsetY = 1;
    
    this.ctx.fillText(player.name, x, nameY);
    this.ctx.restore();
    
    // Draw healthbar background
    this.ctx.save();
    this.ctx.fillStyle = '#333333';
    this.ctx.fillRect(x - healthbarWidth/2, healthbarY - healthbarHeight/2, healthbarWidth, healthbarHeight);
    
    // Draw healthbar fill
    const healthPercent = player.hp / player.maxHp;
    const fillWidth = healthbarWidth * healthPercent;
    
    // Color based on health percentage
    let healthColor = '#00FF00'; // Green
    if (healthPercent < 0.5) {
      healthColor = '#FFFF00'; // Yellow
    }
    if (healthPercent < 0.25) {
      healthColor = '#FF0000'; // Red
    }
    
    this.ctx.fillStyle = healthColor;
    this.ctx.fillRect(x - healthbarWidth/2, healthbarY - healthbarHeight/2, fillWidth, healthbarHeight);
    
    // Draw healthbar border
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x - healthbarWidth/2, healthbarY - healthbarHeight/2, healthbarWidth, healthbarHeight);
    
    this.ctx.restore();
  }
}

// Start the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new GameClient();
});

// Suggestions box functionality
function copySuggestion() {
  const textarea = document.getElementById('suggestionsTextarea');
  const button = document.getElementById('suggestionsSendBtn');
  
  if (textarea.value.trim() === '') {
    alert('Please enter your suggestion first!');
    return;
  }
  
  // Copy to clipboard
  navigator.clipboard.writeText(textarea.value).then(() => {
    // Success feedback
    const originalText = button.innerHTML;
    button.innerHTML = '✅ Copied!';
    button.disabled = true;
    
    setTimeout(() => {
      button.innerHTML = originalText;
      button.disabled = false;
      textarea.value = ''; // Clear the textarea
    }, 2000);
  }).catch(() => {
    // Fallback for older browsers
    textarea.select();
    document.execCommand('copy');
    
    const originalText = button.innerHTML;
    button.innerHTML = '✅ Copied!';
    button.disabled = true;
    
    setTimeout(() => {
      button.innerHTML = originalText;
      button.disabled = false;
      textarea.value = ''; // Clear the textarea
    }, 2000);
  });
} 