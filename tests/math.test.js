// Math utility tests
describe('Math Utilities', () => {
  test('should normalize vector correctly', () => {
    function normalizeVector(x, y) {
      const magnitude = Math.sqrt(x * x + y * y);
      if (magnitude === 0) return { x: 0, y: 0 };
      return { x: x / magnitude, y: y / magnitude };
    }
    
    const result = normalizeVector(3, 4);
    expect(result.x).toBeCloseTo(0.6);
    expect(result.y).toBeCloseTo(0.8);
  });
  
  test('should calculate angle correctly', () => {
    function calculateAngle(x, y) {
      return Math.atan2(y, x);
    }
    
    expect(calculateAngle(1, 0)).toBe(0);
    expect(calculateAngle(0, 1)).toBeCloseTo(Math.PI / 2);
    expect(calculateAngle(-1, 0)).toBeCloseTo(Math.PI);
    expect(calculateAngle(0, -1)).toBeCloseTo(-Math.PI / 2);
  });
  
  test('should clamp values correctly', () => {
    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }
    
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });
}); 