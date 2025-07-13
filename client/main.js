import { io } from 'socket.io-client';

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
    
    // Weapon system elements
    this.weaponSlots = document.getElementById('weaponSlots');
    this.weaponSlot1 = document.getElementById('weaponSlot1');
    this.weaponSlot2 = document.getElementById('weaponSlot2');
    this.weaponSlot3 = document.getElementById('weaponSlot3');
    this.passiveSlots = document.getElementById('passiveSlots');
    this.passiveSlot1 = document.getElementById('passiveSlot1');
    this.passiveSlot2 = document.getElementById('passiveSlot2');
    this.passiveSlot3 = document.getElementById('passiveSlot3');
    this.legendaryList = document.getElementById('legendaryList');
    
    // Dev mode elements
    this.devModeDiv = document.getElementById('devMode');
    this.devLevelUpBtn = document.getElementById('devLevelUp');
    this.devToggleBtn = document.getElementById('devToggle');
    
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
    this.socket = io('http://localhost:3000');
    
    this.socket.on('connect', () => {
      this.socket.emit('join', playerName);
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
      this.showUpgradeModal(data.upgrades);
    });
    
    this.socket.on('upgradeSelected', (data) => {
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
    
    this.socket.on('disconnect', () => {
      // console.log('Disconnected from server');
    });
    
    this.joinScreen.style.display = 'none';
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
    const scaling = 1.5;
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
  
  updateWeaponSlots(weapons) {
    const weaponArray = Object.entries(weapons);
    this.weaponSlots.querySelector('h4').textContent = `Weapons (${weaponArray.length}/3)`;
    
    // Clear all slots
    this.weaponSlot1.textContent = 'Empty';
    this.weaponSlot1.className = 'weapon-slot';
    this.weaponSlot2.textContent = 'Empty';
    this.weaponSlot2.className = 'weapon-slot';
    this.weaponSlot3.textContent = 'Empty';
    this.weaponSlot3.className = 'weapon-slot';
    
    // Fill slots with weapons
    weaponArray.forEach(([weaponId, level], index) => {
      const slot = [this.weaponSlot1, this.weaponSlot2, this.weaponSlot3][index];
      if (slot) {
        // Use proper weapon names if available, fallback to ID
        const weaponName = this.getWeaponDisplayName(weaponId);
        slot.textContent = `${weaponName} Lv.${level}`;
        slot.className = 'weapon-slot filled';
      }
    });
  }
  
  updatePassiveSlots(passives) {
    const passiveArray = Object.entries(passives);
    this.passiveSlots.querySelector('h4').textContent = `Passives (${passiveArray.length}/3)`;
    
    // Clear all slots
    this.passiveSlot1.textContent = 'Empty';
    this.passiveSlot1.className = 'passive-slot';
    this.passiveSlot2.textContent = 'Empty';
    this.passiveSlot2.className = 'passive-slot';
    this.passiveSlot3.textContent = 'Empty';
    this.passiveSlot3.className = 'passive-slot';
    
    // Fill slots with passives
    passiveArray.forEach(([passiveId, level], index) => {
      const slot = [this.passiveSlot1, this.passiveSlot2, this.passiveSlot3][index];
      if (slot) {
        // Use proper passive names if available, fallback to ID
        const passiveName = this.getPassiveDisplayName(passiveId);
        slot.textContent = `${passiveName} Lv.${level}`;
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
        legendaryDiv.textContent = `${weaponName} - LEGENDARY ACTIVE!`;
      } else {
        legendaryDiv.textContent = `${weaponName} - LEGENDARY UNLOCKED (Choose to activate)`;
      }
      this.legendaryList.appendChild(legendaryDiv);
    });
    
    if (Object.keys(legendaryUnlocks).length === 0) {
      this.legendaryList.textContent = 'No legendaries unlocked';
    }
  }
  
  showUpgradeModal(upgrades) {
    // console.log('Showing upgrade modal with options:', upgrades);
    this.upgradeOptions.innerHTML = '';
    
    upgrades.forEach((upgrade, index) => {
      const option = document.createElement('div');
      option.className = 'upgrade-option';
      
      // Special styling for legendary upgrades
      if (upgrade.type === 'legendary') {
        option.style.color = '#FFD700';
        option.style.fontWeight = 'bold';
        option.style.borderColor = '#FFD700';
        option.style.background = '#444';
      }
      
      let displayText = `${index + 1}. ${upgrade.name}`;
      if (upgrade.description) {
        displayText += ` - ${upgrade.description}`;
      }
      if (upgrade.type === 'weapon_level' || upgrade.type === 'passive_level') {
        displayText += ` (Level ${upgrade.currentLevel + 1}/5)`;
      }
      
      option.textContent = displayText;
      option.onclick = () => this.selectUpgrade(index);
      this.upgradeOptions.appendChild(option);
    });
    
    this.upgradeModal.style.display = 'block';
  }
  
  hideUpgradeModal() {
    this.upgradeModal.style.display = 'none';
  }
  

  
  selectUpgrade(index) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('selectUpgrade', index);
    }
  }
  
  startGameLoop() {
    const gameLoop = () => {
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
      
      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.rotate(player.angle);
      
      // Draw player body
      this.ctx.drawImage(this.sprites.player, -16, -16, 32, 32);
      
      // Draw player name
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(player.name, 0, -25);
      
      // Draw health bar
      const healthPercent = player.hp / player.maxHp;
      const barWidth = 40;
      const barHeight = 4;
      
      this.ctx.fillStyle = '#333';
      this.ctx.fillRect(-barWidth/2, -30, barWidth, barHeight);
      
      this.ctx.fillStyle = healthPercent > 0.5 ? '#4CAF50' : healthPercent > 0.25 ? '#FF9800' : '#F44336';
      this.ctx.fillRect(-barWidth/2, -30, barWidth * healthPercent, barHeight);
      
      this.ctx.restore();
    });
  }
}

// Start the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new GameClient();
}); 