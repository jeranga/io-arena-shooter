// Collision detection utility tests
describe('Collision Detection', () => {
  test('should detect circle collision', () => {
    const circle1 = { x: 0, y: 0, radius: 10 };
    const circle2 = { x: 15, y: 0, radius: 10 };
    const circle3 = { x: 25, y: 0, radius: 10 };
    
    function checkCollision(c1, c2) {
      const dx = c1.x - c2.x;
      const dy = c1.y - c2.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < c1.radius + c2.radius;
    }
    
    expect(checkCollision(circle1, circle2)).toBe(true);
    expect(checkCollision(circle1, circle3)).toBe(false);
  });
  
  test('should calculate distance correctly', () => {
    const point1 = { x: 0, y: 0 };
    const point2 = { x: 3, y: 4 };
    
    function calculateDistance(p1, p2) {
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
    
    expect(calculateDistance(point1, point2)).toBe(5);
  });
}); 