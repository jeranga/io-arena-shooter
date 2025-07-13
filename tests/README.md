# Testing Suite Documentation

This comprehensive testing suite ensures the reliability and stability of the IO Arena Shooter game. The tests are organized by system and provide both unit and integration coverage.

## Test Structure

```
tests/
├── setup.js                           # Global test setup and utilities
├── core/
│   └── game-server.test.js           # Core GameServer functionality
├── weapons/
│   └── weapon-system.test.js         # Weapon system and mechanics
├── collision/
│   └── collision-system.test.js      # Collision detection and handling
├── upgrades/
│   └── upgrade-system-comprehensive.test.js  # Upgrade and progression system
├── loot/
│   └── loot-system.test.js           # Loot spawning, collection, and cleanup
├── integration/
│   └── game-flow.test.js             # End-to-end game flow scenarios
└── README.md                         # This file
```

## Running Tests

### Quick Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with verbose output
npm run test:verbose
```

### Targeted Testing

```bash
# Test specific systems
npm run test:core          # Core game server functionality
npm run test:weapons       # Weapon system only
npm run test:collision     # Collision system only
npm run test:upgrades      # Upgrade system only
npm run test:loot          # Loot system only
npm run test:integration   # Integration tests only

# Test categories
npm run test:unit          # All unit tests (excludes integration)
npm run test:quick         # Quick tests with shorter timeouts
```

## Test Categories

### 1. Core Tests (`tests/core/`)
Tests the fundamental GameServer functionality:
- Constructor and initialization
- Player management (add/remove/handle input)
- Game loop and ticking
- Cleanup and destruction
- Snapshot broadcasting

### 2. Weapon Tests (`tests/weapons/`)
Tests all weapon types and mechanics:
- **Marksman**: Single bullet firing, damage scaling, legendary effects
- **Burst**: Multi-orb spawning, positioning, count upgrades
- **Saws**: Orbiting mechanics, state management, count upgrades
- **Passives**: Focus Fire, Quickstep, Bigger Payload effects
- **Cooldowns**: Weapon timing and upgrade effects
- **Bullet Movement**: Regular and orbiting bullet updates

### 3. Collision Tests (`tests/collision/`)
Tests collision detection and handling:
- **Bullet vs Bullet**: Collision detection, damage subtraction, saw blocking
- **Bullet vs Player**: Hit detection, damage application, death handling
- **Player vs Loot**: Collection detection, XP gain
- **Edge Cases**: Missing entities, invalid data, performance stress

### 4. Upgrade Tests (`tests/upgrades/`)
Tests the progression system:
- **Upgrade Application**: Weapon, passive, and legendary upgrades
- **Available Upgrades**: Generation of upgrade choices
- **Legendary System**: Unlock conditions, application, events
- **Level Up System**: XP thresholds, progression, events
- **Edge Cases**: Invalid upgrades, missing data, error handling

### 5. Loot Tests (`tests/loot/`)
Tests the loot system:
- **Loot Spawning**: Random generation, bounds checking, limits
- **Loot Collection**: XP gain, level up triggering
- **Death Drops**: XP-based loot drops, player reset
- **Cleanup**: Expired loot removal
- **Collision Detection**: Collection radius, positioning

### 6. Integration Tests (`tests/integration/`)
Tests complete game scenarios:
- **Player Lifecycle**: Join → Play → Level Up → Die → Respawn
- **Multiplayer Interactions**: Multiple players, weapon interactions
- **Complex Scenarios**: Legendary progression, multiple weapons/passives
- **Game State Management**: Consistency across multiple ticks
- **Performance Testing**: Many players, bullets, rapid input
- **Error Recovery**: Disconnections, invalid data, graceful failures

## Test Utilities

### Global Test Functions

The `tests/setup.js` file provides global utilities:

```javascript
// Create mock entities
createMockPlayer(overrides)     // Mock player with configurable properties
createMockBullet(overrides)     // Mock bullet with configurable properties
createMockLoot(overrides)       // Mock loot with configurable properties

// Create mock Socket.IO
createMockSocket()              // Mock socket instance
createMockIO()                  // Mock IO instance

// Test helpers
createGameServer(io)           // Create GameServer instance with optional mock IO
wait(ms)                       // Promise-based delay for async tests
```

### Example Usage

```javascript
describe('My Test', () => {
  let gameServer;
  let player;

  beforeEach(() => {
    gameServer = createGameServer();
    player = createMockPlayer({
      weapons: { marksman: 2 },
      passives: { focusFire: 1 }
    });
    gameServer.players.set(player.id, player);
  });

  test('should work correctly', () => {
    // Test implementation
    expect(player.weapons.marksman).toBe(2);
  });
});
```

## Coverage Goals

The test suite aims for:
- **80%+ coverage** across all metrics (branches, functions, lines, statements)
- **100% coverage** of critical game logic
- **Comprehensive edge case testing**
- **Performance and stress testing**

## Best Practices

### Writing Tests

1. **Use descriptive test names** that explain the expected behavior
2. **Test one thing per test** - keep tests focused and simple
3. **Use beforeEach/afterEach** for setup and cleanup
4. **Mock external dependencies** (Socket.IO, timers, random numbers)
5. **Test both success and failure cases**
6. **Include edge cases and error conditions**

### Test Organization

1. **Group related tests** using `describe` blocks
2. **Use nested describes** for better organization
3. **Order tests logically** (setup → happy path → edge cases → cleanup)
4. **Keep test files focused** on a single system or feature

### Performance Considerations

1. **Clean up resources** in `afterEach` blocks
2. **Mock time-dependent operations** when possible
3. **Use appropriate timeouts** for async operations
4. **Limit the scope** of integration tests to prevent slow execution

## Debugging Tests

### Common Issues

1. **Timing Issues**: Use `wait()` for async operations
2. **Mock Problems**: Ensure mocks are properly restored
3. **State Pollution**: Clean up in `afterEach` blocks
4. **Random Failures**: Mock `Math.random()` for deterministic tests

### Debug Commands

```bash
# Run specific test file
npm test -- tests/weapons/weapon-system.test.js

# Run specific test
npm test -- -t "should create marksman bullet"

# Debug with console output
npm run test:verbose -- tests/weapons/

# Run with coverage for specific file
npm run test:coverage -- tests/weapons/
```

## Continuous Integration

The test suite is designed to run in CI environments:
- **Fast execution** - Most tests complete in under 5 seconds
- **Deterministic results** - No flaky tests
- **Comprehensive coverage** - Catches regressions early
- **Clear failure messages** - Easy to debug issues

## Contributing

When adding new features:
1. **Write tests first** (TDD approach)
2. **Update this documentation** if adding new test categories
3. **Maintain coverage** above 80%
4. **Run full test suite** before submitting changes
5. **Add integration tests** for complex features 