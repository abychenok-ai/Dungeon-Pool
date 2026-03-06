
import { Ball, Pocket, Obstacle, Vector2D, Coin } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, FRICTION, WALL_BOUNCE, MIN_SPEED_THRESHOLD } from '../constants';

function closestPointOnSegment(p: Vector2D, a: Vector2D, b: Vector2D): Vector2D {
  const pax = p.x - a.x;
  const pay = p.y - a.y;
  const bax = b.x - a.x;
  const bay = b.y - a.y;
  const h = Math.min(1, Math.max(0, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return {
    x: a.x + h * bax,
    y: a.y + h * bay
  };
}

export interface CollisionEvent {
  position: Vector2D;
  color: string;
}

// Optimized to mutate balls array in place where possible and return events
export function updatePhysics(
  balls: Ball[], 
  pockets: Pocket[], 
  obstacles: Obstacle[] = [], 
  coins: Coin[] = []
): { 
  pottedScore: number, 
  pottedBalls: { ball: Ball, pocketId: string }[], 
  obstacleCollisions: CollisionEvent[],
  collectedCoins: Coin[]
} {
  let pottedScore = 0;
  const pottedBalls: { ball: Ball, pocketId: string }[] = [];
  const obstacleCollisions: CollisionEvent[] = [];
  const collectedCoins: Coin[] = [];
  
  // We will filter the balls array in place or create a new one only if needed. 
  // Since we need to return potted balls, we might need to splice.
  // Iterating backwards allows splicing without messing up indices.
  
  for (let i = balls.length - 1; i >= 0; i--) {
    const ball = balls[i];
    let pottedPocketId: string | null = null;

    // 1. Check Pockets
    for (const pocket of pockets) {
      const dx = ball.pos.x - pocket.pos.x;
      const dy = ball.pos.y - pocket.pos.y;
      const distSq = dx * dx + dy * dy;
      const pocketRadiusSq = (pocket.radius * 0.8) ** 2; // Pre-calc square approx
      
      if (distSq < pocketRadiusSq) {
        pottedPocketId = pocket.id;
        break;
      }
    }

    if (pottedPocketId) {
      pottedScore += ball.type.points;
      pottedBalls.push({ ball, pocketId: pottedPocketId });
      balls.splice(i, 1); // Remove from active simulation
      continue;
    }

    // 2. Movement
    // Apply velocity
    ball.pos.x += ball.vel.x;
    ball.pos.y += ball.vel.y;

    // Apply friction
    ball.vel.x *= FRICTION;
    ball.vel.y *= FRICTION;

    // Stop completely if very slow (optimization)
    if (Math.abs(ball.vel.x) < MIN_SPEED_THRESHOLD) ball.vel.x = 0;
    if (Math.abs(ball.vel.y) < MIN_SPEED_THRESHOLD) ball.vel.y = 0;

    // 3. Wall Collisions
    const r = ball.type.radius;
    if (ball.pos.x - r < 0) {
      ball.pos.x = r;
      ball.vel.x = Math.abs(ball.vel.x) * WALL_BOUNCE;
    } else if (ball.pos.x + r > CANVAS_WIDTH) {
      ball.pos.x = CANVAS_WIDTH - r;
      ball.vel.x = -Math.abs(ball.vel.x) * WALL_BOUNCE;
    }

    if (ball.pos.y - r < 0) {
      ball.pos.y = r;
      ball.vel.y = Math.abs(ball.vel.y) * WALL_BOUNCE;
    } else if (ball.pos.y + r > CANVAS_HEIGHT) {
      ball.pos.y = CANVAS_HEIGHT - r;
      ball.vel.y = -Math.abs(ball.vel.y) * WALL_BOUNCE;
    }

    // 4. Obstacle Collisions
    for(const obs of obstacles) {
       if (obs.type === 'triangle' && obs.vertices) {
        // Bounding circle check
        const dx = ball.pos.x - obs.center.x;
        const dy = ball.pos.y - obs.center.y;
        const combinedRadius = obs.radius + r;
        if (dx * dx + dy * dy > combinedRadius * combinedRadius) continue;

        let minDistSq = Infinity;
        let closestPoint = { x: 0, y: 0 };

        const len = obs.vertices.length;
        for (let j = 0; j < len; j++) {
          const p1 = obs.vertices[j];
          const p2 = obs.vertices[(j + 1) % len];
          const cp = closestPointOnSegment(ball.pos, p1, p2);
          const dSq = (ball.pos.x - cp.x) ** 2 + (ball.pos.y - cp.y) ** 2;
          
          if (dSq < minDistSq) {
            minDistSq = dSq;
            closestPoint = cp;
          }
        }

        if (minDistSq < r * r) {
          const dist = Math.sqrt(minDistSq);
          let nx = ball.pos.x - closestPoint.x;
          let ny = ball.pos.y - closestPoint.y;

          if (dist === 0) {
             nx = dx; ny = dy;
             const l = Math.sqrt(nx*nx + ny*ny);
             if (l > 0) { nx /= l; ny /= l; } else { nx = 1; ny = 0; }
          } else {
             nx /= dist;
             ny /= dist;
          }

          const overlap = r - dist;
          ball.pos.x += nx * overlap;
          ball.pos.y += ny * overlap;

          const dot = ball.vel.x * nx + ball.vel.y * ny;
          if (dot < 0) {
            const restitution = 0.8; // Increased from 0.6 for more bounce
            ball.vel.x -= (1 + restitution) * dot * nx;
            ball.vel.y -= (1 + restitution) * dot * ny;
            
            // Record collision event
            obstacleCollisions.push({
                position: closestPoint,
                color: ball.type.color
            });
          }
        }
      }
    }
    
    // 4.5 Coin Collisions (Only with Cue Ball for now, but iterating inside ball loop covers all if needed)
    // If we want only Cue Ball to pick up coins:
    if (ball.isCue) {
        for (let j = coins.length - 1; j >= 0; j--) {
            const coin = coins[j];
            const dx = ball.pos.x - coin.pos.x;
            const dy = ball.pos.y - coin.pos.y;
            const combinedRadius = ball.type.radius + coin.radius;
            
            if (dx * dx + dy * dy < combinedRadius * combinedRadius) {
                collectedCoins.push(coin);
                coins.splice(j, 1);
            }
        }
    }
  }

  // 5. Ball-to-Ball Collisions
  // Simple grid or quadtree is overkill for 15 balls, but we can optimize the nested loop slightly
  // Iterations for stability
  const iterations = 4;
  const count = balls.length;
  
  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < count; i++) {
      const b1 = balls[i];
      for (let j = i + 1; j < count; j++) {
        const b2 = balls[j];

        const dx = b2.pos.x - b1.pos.x;
        const dy = b2.pos.y - b1.pos.y;
        const distSq = dx * dx + dy * dy;
        const rSum = b1.type.radius + b2.type.radius;

        if (distSq < rSum * rSum) {
          const dist = Math.sqrt(distSq);
          if (dist === 0) continue; // Avoid div by zero

          const nx = dx / dist;
          const ny = dy / dist;
          
          const overlap = rSum - dist;
          const correctionFactor = 0.8; // Increased for more immediate separation
          const cx = nx * overlap * correctionFactor;
          const cy = ny * overlap * correctionFactor;
          
          b1.pos.x -= cx;
          b1.pos.y -= cy;
          b2.pos.x += cx;
          b2.pos.y += cy;

          const vdx = b1.vel.x - b2.vel.x;
          const vdy = b1.vel.y - b2.vel.y;
          const vn = vdx * nx + vdy * ny;

          if (vn < 0) continue; 

          const restitution = 0.95; // Increased for more energetic collisions
          const impulse = (-(1 + restitution) * vn) / (1 / b1.mass + 1 / b2.mass);
          
          const ix = impulse * nx;
          const iy = impulse * ny;

          b1.vel.x += ix / b1.mass;
          b1.vel.y += iy / b1.mass;
          b2.vel.x -= ix / b2.mass;
          b2.vel.y -= iy / b2.mass;
        }
      }
    }
  }

  return { 
    pottedScore,
    pottedBalls,
    obstacleCollisions,
    collectedCoins
  };
}
