const { io } = require('socket.io-client');

console.log('🧪 Testing live deployment connection...');
console.log('📍 URL: https://io-arena-shooter.fly.dev');
console.log('');

const socket = io('https://io-arena-shooter.fly.dev', {
  transports: ['polling', 'websocket'],
  timeout: 20000,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  maxReconnectionAttempts: 5,
  forceNew: true,
  withCredentials: false
});

let hasConnected = false;
let hasJoined = false;

socket.on('connect', () => {
  console.log('✅ Connected to live server');
  hasConnected = true;
  
  // Try to join the game
  console.log('🎮 Attempting to join game...');
  socket.emit('join', 'TestPlayer');
});

socket.on('disconnect', (reason) => {
  console.log(`❌ Disconnected: ${reason}`);
});

socket.on('connect_error', (error) => {
  console.log(`🚨 Connection error: ${error.message}`);
  console.log('Error details:', error);
});

socket.on('reconnect', (attemptNumber) => {
  console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
});

socket.on('reconnect_error', (error) => {
  console.log(`🚨 Reconnection error: ${error.message}`);
});

socket.on('reconnect_failed', () => {
  console.log('💥 Reconnection failed');
});

socket.on('yourId', (id) => {
  console.log(`🆔 Received player ID: ${id}`);
});

socket.on('gameConfig', (config) => {
  console.log('⚙️  Received game config');
  console.log(`   - Max weapons: ${config.MAX_WEAPONS}`);
  console.log(`   - Max passives: ${config.MAX_PASSIVES}`);
});

socket.on('gameState', (state) => {
  if (!hasJoined) {
    console.log('🎮 Received first game state');
    console.log(`   - Players: ${state.players?.length || 0}`);
    console.log(`   - Bullets: ${state.bullets?.length || 0}`);
    console.log(`   - Loot: ${state.loot?.length || 0}`);
    hasJoined = true;
  }
});

// Test for 10 seconds
setTimeout(() => {
  console.log('\n📊 Test Results:');
  console.log(`✅ Connected: ${hasConnected}`);
  console.log(`🎮 Joined game: ${hasJoined}`);
  
  if (hasConnected && hasJoined) {
    console.log('🎉 SUCCESS: Live deployment is working correctly!');
  } else if (hasConnected && !hasJoined) {
    console.log('⚠️  PARTIAL: Connected but failed to join game');
  } else {
    console.log('❌ FAILURE: Could not connect to live deployment');
  }
  
  socket.disconnect();
  process.exit(0);
}, 10000);

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted');
  socket.disconnect();
  process.exit(0);
}); 