import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Ball, Vector2D, GameState, Particle, BallStyle, Coin } from '../types';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  SHOOT_POWER_MULTIPLIER,
  CUE_BALL_TIER,
  MIN_SPEED_THRESHOLD
} from '../constants';
import { updatePhysics } from './Physics';

interface GameCanvasProps {
  onScoreUpdate: (points: number) => void;
  onGameOver: () => void;
  onScratch: () => void;
  onWin: () => void;
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  ballStyle: BallStyle;
}

// Simple seeded RNG helper for static textures
const createRng = (seedStr: string) => {
    let seed = 0;
    for(let i=0; i<seedStr.length; i++) seed = (seed << 5) - seed + seedStr.charCodeAt(i);
    return () => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    };
};

const STAR_PATH = new Path2D("M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z");

// --- Physics Helpers for Raycasting ---

const getRaySegmentIntersection = (
    ox: number, oy: number, dx: number, dy: number, 
    ax: number, ay: number, bx: number, by: number
): { t: number } | null => {
    const v1x = ox - ax;
    const v1y = oy - ay;
    const v2x = bx - ax;
    const v2y = by - ay;
    const v3x = -dy; 
    const v3y = dx;

    const dot = v2x * v3x + v2y * v3y;
    if (Math.abs(dot) < 0.000001) return null;

    const t = (v2x * v1y - v2y * v1x) / dot;
    const u = (v1x * v3y - v1y * v3x) / dot;

    if (t >= 0 && (u >= 0 && u <= 1)) {
        return { t };
    }
    return null;
};

const getRayCircleIntersection = (
    ox: number, oy: number, dx: number, dy: number, 
    cx: number, cy: number, r: number
): { t: number, nx: number, ny: number } | null => {
    const fx = ox - cx;
    const fy = oy - cy;
    const a = dx * dx + dy * dy; 
    const b = 2 * (fx * dx + fy * dy);
    const c = (fx * fx + fy * fy) - r * r;
    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) return null;

    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    if (t >= 0) {
        const hitX = ox + dx * t;
        const hitY = oy + dy * t;
        const nx = hitX - cx;
        const ny = hitY - cy;
        const nLen = Math.sqrt(nx * nx + ny * ny);
        return { t, nx: nx / nLen, ny: ny / nLen };
    }
    
    return null; 
};

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  onScoreUpdate, 
  onGameOver,
  onScratch,
  onWin,
  gameState, 
  setGameState,
  ballStyle
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Mutable state for the game loop (avoids React re-renders on every frame)
  const physicsState = useRef<{
    balls: Ball[];
    particles: Particle[];
    coins: Coin[];
  }>({
    balls: [],
    particles: [],
    coins: []
  });

  // Track if we need to sync props to ref (e.g. on reset)
  const lastBallsLength = useRef(0);

  // Pre-calculate static noise for Dungeon theme using an offscreen canvas for performance
  const dungeonBackground = useMemo(() => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_WIDTH;
      canvas.height = CANVAS_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Tile Grid
      const tileSize = 60;
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= CANVAS_WIDTH; x += tileSize) {
          ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT);
      }
      for (let y = 0; y <= CANVAS_HEIGHT; y += tileSize) {
          ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y);
      }
      ctx.stroke();

      // Noise
      for(let i=0; i<1200; i++) {
          ctx.fillStyle = Math.random() > 0.6 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.08)';
          ctx.fillRect(
              Math.random() * CANVAS_WIDTH,
              Math.random() * CANVAS_HEIGHT,
              Math.random() * 3 + 1,
              Math.random() * 3 + 1
          );
      }
      return canvas;
  }, []);

  useEffect(() => {
    // Initial sync or reset
    if (gameState.balls.length > physicsState.current.balls.length || gameState.balls.length === 0 || gameState.coinsOnTable.length > physicsState.current.coins.length) {
       physicsState.current.balls = JSON.parse(JSON.stringify(gameState.balls));
       physicsState.current.coins = JSON.parse(JSON.stringify(gameState.coinsOnTable));
       physicsState.current.particles = [];
       lastBallsLength.current = gameState.balls.length;
    }
  }, [gameState.balls, gameState.coinsOnTable]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Vector2D | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Vector2D | null>(null);
  const [isCueMoving, setIsCueMoving] = useState(false);
  const isCueMovingRef = useRef(false);

  const dragStartRef = useRef<Vector2D | null>(null);
  const interactionRef = useRef<{start: Vector2D | null, current: Vector2D | null, isDragging: boolean}>({
     start: null, current: null, isDragging: false
  });

  useEffect(() => {
     interactionRef.current = { start: dragStart, current: dragCurrent, isDragging };
  }, [dragStart, dragCurrent, isDragging]);

  const createSplash = useCallback((pos: Vector2D, color: string) => {
    const newParticles: Particle[] = [];
    const count = 12 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      newParticles.push({
        id: Math.random().toString(36).substr(2, 9),
        pos: { ...pos },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        color,
        life: 1.0,
        size: 3 + Math.random() * 5,
        behavior: 'GRAVITY'
      });
    }
    physicsState.current.particles.push(...newParticles);
  }, []);

  const createCoinEffect = useCallback((pos: Vector2D) => {
      const newParticles: Particle[] = [];
      const count = 20;
      for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count;
          const speed = 2 + Math.random() * 3;
          newParticles.push({
              id: `coin-spark-${Date.now()}-${i}`,
              pos: { ...pos },
              vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
              color: '#FACC15', // Yellow
              life: 0.8,
              size: 2 + Math.random() * 3,
              behavior: 'BULLET'
          });
      }
      physicsState.current.particles.push(...newParticles);
  }, []);

  const createBulletHellExplosion = useCallback((pos: Vector2D, color: string) => {
    const newParticles: Particle[] = [];
    const count = 40;
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const speed = 12 + Math.random() * 8; 
        newParticles.push({
            id: `bh-1-${Date.now()}-${i}`,
            pos: { ...pos },
            vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            color: color,
            life: 1.5, 
            size: 5 + Math.random() * 4,
            behavior: 'BULLET'
        });
    }
    const innerCount = 20;
    for (let i = 0; i < innerCount; i++) {
        const angle = (Math.PI * 2 * i) / innerCount;
        const speed = 6;
        newParticles.push({
            id: `bh-2-${Date.now()}-${i}`,
            pos: { ...pos },
            vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            color: '#ffffff',
            life: 1.0,
            size: 3,
            behavior: 'BULLET'
        });
    }
    physicsState.current.particles.push(...newParticles);
  }, []);

  const createObstacleHitEffect = useCallback((pos: Vector2D, color: string) => {
    const newParticles: Particle[] = [];
    const count = 16;
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        // Reduced speed range (2-5) vs (12-20) for contained effect
        const speed = 2 + Math.random() * 3; 
        newParticles.push({
            id: `obs-hit-${Date.now()}-${i}`,
            pos: { ...pos },
            vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            color: color,
            life: 0.6 + Math.random() * 0.2, // Shorter life
            size: 2 + Math.random() * 3, // Smaller particles
            behavior: 'BULLET'
        });
    }
    // Add small white sparks
    for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 2;
        newParticles.push({
            id: `obs-spark-${Date.now()}-${i}`,
            pos: { ...pos },
            vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            color: '#ffffff',
            life: 0.4,
            size: 1.5,
            behavior: 'BULLET'
        });
    }
    physicsState.current.particles.push(...newParticles);
  }, []);

  // Theme Logic
  const getTheme = (style: BallStyle) => {
    switch (style) {
      case 'CLASSIC':
        return {
          tableBg: '#0f5132', // Classic Green
          railColor: '#45271a', // Dark Wood
          railBorder: '#2b1810',
          obstacleFill: '#5D4037', // Wood
          obstacleStroke: '#2b1810',
          isNeon: false,
          useTexture: false
        };
      case 'DUNGEON':
         return {
          tableBg: '#57534e', // Stone 600 - Brighter
          railColor: '#44403c', // Stone 700 - Contrast
          railBorder: '#292524',
          obstacleFill: '#38bdf8', // Blue Stone Base
          obstacleStroke: '#7dd3fc', // Lighter Blue Stroke
          isNeon: false,
          useTexture: true // Stone texture
         };
      case 'MINIMAL':
         return {
           tableBg: '#1f2937', // Dark Gray
           railColor: '#374151',
           railBorder: '#ffffff',
           obstacleFill: 'rgba(0,0,0,0.5)',
           obstacleStroke: '#ffffff',
           isNeon: true,
           useTexture: false
         };
      case 'PACMAN':
      default:
        return {
          tableBg: '#581c87', // Purple
          railColor: '#c084fc', // Neon Purple
          railBorder: '#d8b4fe',
          obstacleFill: 'rgba(8, 51, 68, 0.6)',
          obstacleStroke: '#22d3ee', // Neon Cyan
          isNeon: true,
          useTexture: false
        };
    }
  };

  useEffect(() => {
    let animationFrameId: number;
    
    const loop = () => {
      // 1. Update Particles
      const activeParticles: Particle[] = [];
      for (const p of physicsState.current.particles) {
          p.pos.x += p.vel.x;
          p.pos.y += p.vel.y;
          
          if (p.behavior === 'BULLET') {
              p.vel.x *= 0.99;
              p.vel.y *= 0.99;
              p.life -= 0.015; 
          } else {
              p.vel.x *= 0.95;
              p.vel.y = p.vel.y * 0.95 + 0.1;
              p.life -= 0.02;
          }

          if (p.life > 0) activeParticles.push(p);
      }
      physicsState.current.particles = activeParticles;

      // 2. Physics Step
      if (!gameState.isGameOver && !gameState.isWon) {
          // Run physics twice per frame for snappiness and better collision detection
          for (let step = 0; step < 2; step++) {
              const { pottedScore, pottedBalls, obstacleCollisions, collectedCoins } = updatePhysics(
                  physicsState.current.balls, 
                  gameState.pockets, 
                  gameState.obstacles,
                  physicsState.current.coins
              );

              // Handle Obstacle Collisions
              if (obstacleCollisions && obstacleCollisions.length > 0) {
                  obstacleCollisions.forEach(col => {
                      createObstacleHitEffect(col.position, col.color);
                  });
              }

              // Handle Coin Collection
              if (collectedCoins && collectedCoins.length > 0) {
                  collectedCoins.forEach(coin => {
                      createCoinEffect(coin.pos);
                  });
                  // Update state
                  setGameState(prev => ({
                      ...prev,
                      coins: prev.coins + (collectedCoins.length * 20),
                      coinsOnTable: physicsState.current.coins // Sync remaining coins
                  }));
              }

              if (pottedBalls.length > 0) {
                  let scratch = false;
                  let wrongPocket = false;
                  let neutralPotted = false;

                  pottedBalls.forEach(({ ball, pocketId }) => {
                      if (ball.isCue) {
                          scratch = true;
                          createBulletHellExplosion(ball.pos, '#ffaaaa');
                      } else {
                          createBulletHellExplosion(ball.pos, ball.type.color);
                          
                          if (gameState.difficulty === 'SORT') {
                              if (ballStyle === 'DUNGEON') {
                                  const isZombie = ball.type.id === 0;
                                  const isDevil = ball.type.id === 7;
                                  if ((isZombie && pocketId !== "0") || (isDevil && pocketId !== "1")) {
                                      wrongPocket = true;
                                  }
                              } else {
                                  const isBlue = ball.type.id === 1;
                                  const isRed = ball.type.id === 2;
                                  if ((isBlue && pocketId !== "0") || (isRed && pocketId !== "1")) {
                                      wrongPocket = true;
                                  }
                              }
                          }

                          if (gameState.difficulty === 'PRECISION') {
                              if (ball.type.id === 15) {
                                  neutralPotted = true;
                              }
                          }
                      }
                  });

                  if (scratch || wrongPocket || neutralPotted) {
                      const isSortMode = gameState.difficulty === 'SORT';
                      const isTimerMode = gameState.difficulty === 'TIMER';
                      
                      if (wrongPocket || neutralPotted || (scratch && !isSortMode && !isTimerMode)) {
                          onScratch();
                      }
                      
                      const activeCueTier = { ...CUE_BALL_TIER };
                      if (ballStyle === 'DUNGEON') {
                          activeCueTier.radius = 26;
                      }

                      const newCueBall: Ball = {
                          id: 'cue',
                          type: activeCueTier,
                          pos: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 100 },
                          vel: { x: 0, y: 0 },
                          mass: activeCueTier.radius * 2,
                          isCue: true
                      };
                      
                      const cuePotted = pottedBalls.some(p => p.ball.isCue);
                      if (cuePotted) {
                          physicsState.current.balls.push(newCueBall);
                      }

                      const remainingIds = new Set(physicsState.current.balls.map(b => b.id));
                      setGameState(prev => ({
                          ...prev,
                          balls: prev.balls.filter(b => remainingIds.has(b.id))
                      }));
                  } else {
                      const remainingIds = new Set(physicsState.current.balls.map(b => b.id));
                      setGameState(prev => ({
                          ...prev,
                          score: prev.score + pottedScore,
                          coins: (prev.coins || 0) + (pottedBalls.length * 10), 
                          balls: prev.balls.filter(b => remainingIds.has(b.id))
                      }));
                  }
                  const targetBallsLeft = physicsState.current.balls.filter(b => {
                      if (b.isCue) return false;
                      if (gameState.difficulty === 'PRECISION') {
                          return b.type.id !== 15;
                      }
                      return true;
                  }).length;

                  if (targetBallsLeft === 0 && !scratch && !neutralPotted && physicsState.current.balls.length > 0) {
                      onWin();
                  }
              }
          }
      }

      // 3. Cue Movement check
      const cueBall = physicsState.current.balls.find(b => b.isCue);
      if (cueBall) {
          const speed = Math.sqrt(cueBall.vel.x ** 2 + cueBall.vel.y ** 2);
          const moving = speed > MIN_SPEED_THRESHOLD;
          // Use a ref to avoid re-triggering the effect if we only need it for UI
          if (moving !== isCueMovingRef.current) {
               isCueMovingRef.current = moving;
               setIsCueMoving(moving); 
          }
      }

      // 4. Render
      render();
      animationFrameId = requestAnimationFrame(loop);
    };

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const theme = getTheme(ballStyle);

      // Clear
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // --- Draw Field ---
      ctx.fillStyle = theme.tableBg;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Field Texture / Effects
      if (theme.useTexture) {
         // Stone Pattern for Dungeon
         if (dungeonBackground) {
             ctx.drawImage(dungeonBackground, 0, 0);
         }
      } else {
         // Standard Vignette for others
         const grad = ctx.createRadialGradient(
            CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0,
            CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH
         );
         grad.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
         grad.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
         ctx.fillStyle = grad;
         ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      // --- Draw Rails ---
      ctx.save();
      if (theme.isNeon) {
          ctx.shadowBlur = 25;
          ctx.shadowColor = theme.railBorder;
          ctx.strokeStyle = theme.railColor;
          ctx.lineWidth = 12;
          ctx.strokeRect(6, 6, CANVAS_WIDTH - 12, CANVAS_HEIGHT - 12);
          
          // Inner tube highlight
          ctx.shadowBlur = 5;
          ctx.shadowColor = '#ffffff';
          ctx.strokeStyle = 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 2;
          ctx.strokeRect(6, 6, CANVAS_WIDTH - 12, CANVAS_HEIGHT - 12);
      } else {
          // Classic / Dungeon Wood Rail
          ctx.lineWidth = 20;
          ctx.strokeStyle = theme.railColor;
          ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          
          // Inner Edge
          ctx.lineWidth = 2;
          ctx.strokeStyle = theme.railBorder;
          ctx.strokeRect(10, 10, CANVAS_WIDTH - 20, CANVAS_HEIGHT - 20);

          // Corner decoration
          ctx.fillStyle = '#b45309'; // Bronze
          const boltOffset = 5;
          ctx.fillRect(boltOffset, boltOffset, 10, 10);
          ctx.fillRect(CANVAS_WIDTH - 15, boltOffset, 10, 10);
          ctx.fillRect(boltOffset, CANVAS_HEIGHT - 15, 10, 10);
          ctx.fillRect(CANVAS_WIDTH - 15, CANVAS_HEIGHT - 15, 10, 10);
      }
      ctx.restore();

      // --- Draw Obstacles ---
      gameState.obstacles.forEach(obs => {
        if (obs.type === 'triangle' && obs.vertices) {
          const cornerRadius = 8;
          ctx.save();
          
          if (ballStyle === 'DUNGEON') {
              // STONE EFFECT (Bluish)
              const rng = createRng(obs.id);

              ctx.shadowBlur = 10;
              ctx.shadowColor = 'rgba(0,0,0,0.5)';
              ctx.shadowOffsetY = 4;
              ctx.fillStyle = '#38bdf8';
              ctx.strokeStyle = '#0c4a6e';
              ctx.lineWidth = 3;

              ctx.beginPath();
              drawRoundedPoly(ctx, obs.vertices, 6);
              ctx.fill();
              
              ctx.shadowBlur = 0;
              ctx.shadowOffsetY = 0;
              
              ctx.save();
              ctx.clip(); 

              ctx.fillStyle = 'rgba(12, 74, 110, 0.2)'; 
              for(let i=0; i<8; i++) {
                 const rx = rng();
                 const ry = rng();
                 const rs = rng();
                 const x = obs.center.x + (rx - 0.5) * obs.radius * 1.8;
                 const y = obs.center.y + (ry - 0.5) * obs.radius * 1.8;
                 const s = obs.radius * (0.2 + rs * 0.3);
                 ctx.beginPath();
                 ctx.arc(x, y, s, 0, Math.PI*2);
                 ctx.fill();
              }

              ctx.strokeStyle = 'rgba(12, 74, 110, 0.4)'; 
              ctx.lineWidth = 2;
              obs.vertices.forEach((v, i) => {
                  if (rng() > 0.3) {
                     ctx.beginPath();
                     ctx.moveTo(v.x, v.y);
                     const cx = obs.center.x + (rng()-0.5) * 10;
                     const cy = obs.center.y + (rng()-0.5) * 10;
                     const midX = (v.x + cx) / 2 + (rng()-0.5) * 10;
                     const midY = (v.y + cy) / 2 + (rng()-0.5) * 10;
                     ctx.lineTo(midX, midY);
                     ctx.lineTo(cx, cy);
                     ctx.stroke();
                  }
              });

              ctx.restore();
              ctx.beginPath();
              drawRoundedPoly(ctx, obs.vertices, 6);
              ctx.stroke();

          } else if (theme.isNeon) {
              ctx.shadowBlur = 20;
              ctx.shadowColor = theme.obstacleStroke; 
              ctx.strokeStyle = theme.obstacleStroke; 
              ctx.lineWidth = 4;
              ctx.fillStyle = theme.obstacleFill; 
              
              ctx.beginPath();
              drawRoundedPoly(ctx, obs.vertices, cornerRadius);
              ctx.fill();
              ctx.stroke();

              ctx.beginPath();
              drawInnerPoly(ctx, obs.center, obs.vertices, cornerRadius, 0.65);
              ctx.lineWidth = 1;
              ctx.strokeStyle = 'rgba(255,255,255,0.5)';
              ctx.stroke();
          } else {
              ctx.fillStyle = theme.obstacleFill;
              ctx.strokeStyle = theme.obstacleStroke;
              ctx.lineWidth = 3;
              
              ctx.beginPath();
              drawRoundedPoly(ctx, obs.vertices, cornerRadius);
              ctx.fill();
              ctx.stroke();
              
              ctx.clip();
              ctx.strokeStyle = 'rgba(0,0,0,0.2)';
              ctx.lineWidth = 1;
              for(let i=0; i<10; i++) {
                  ctx.beginPath();
                  ctx.moveTo(obs.center.x - 20 + i*5, obs.center.y - 20);
                  ctx.lineTo(obs.center.x - 20 + i*5, obs.center.y + 20);
                  ctx.stroke();
              }
          }
          ctx.restore();
        }
      });

      // --- Draw Pockets ---
      gameState.pockets.forEach((pocket, idx) => {
        if (theme.isNeon) {
           ctx.beginPath();
           ctx.arc(pocket.pos.x, pocket.pos.y, pocket.radius, 0, Math.PI * 2);
           ctx.fillStyle = '#000000';
           ctx.fill();
           ctx.strokeStyle = theme.railColor;
           ctx.shadowColor = theme.railBorder;
           ctx.shadowBlur = 10;
           ctx.lineWidth = 2;
           ctx.stroke();
           ctx.shadowBlur = 0; 
        } else {
           ctx.beginPath();
           ctx.arc(pocket.pos.x, pocket.pos.y, pocket.radius, 0, Math.PI * 2);
           ctx.fillStyle = '#111';
           ctx.fill();
           ctx.strokeStyle = '#333';
           ctx.lineWidth = 2;
           ctx.stroke();
        }

        // SORT Level UI
        if (gameState.difficulty === 'SORT') {
            ctx.save();
            const isFirstPocket = idx === 0;
            let label = "";
            let color = "";

            if (ballStyle === 'DUNGEON') {
                label = isFirstPocket ? "ZOMBIE" : "DEVIL";
                color = isFirstPocket ? "#65a30d" : "#ef4444";
            } else {
                label = isFirstPocket ? "BLUE" : "RED";
                color = isFirstPocket ? "#2563eb" : "#dc2626";
            }
            
            ctx.font = "bold 11px 'Inter', sans-serif";
            ctx.fillStyle = color;
            ctx.textAlign = "center";
            ctx.shadowBlur = 5;
            ctx.shadowColor = "rgba(0,0,0,0.5)";
            ctx.fillText(label, pocket.pos.x, pocket.pos.y - pocket.radius - 12);
            
            if (ballStyle === 'DUNGEON') {
                // Draw a small monster icon instead of a circle
                const r = 8;
                const px = pocket.pos.x;
                const py = pocket.pos.y - pocket.radius - 28;
                if (isFirstPocket) {
                    // Simplified Zombie icon
                    ctx.fillStyle = '#65a30d'; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#fef3c7'; ctx.beginPath(); ctx.arc(px - r * 0.3, py - r * 0.1, r * 0.25, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(px + r * 0.3, py - r * 0.1, r * 0.18, 0, Math.PI * 2); ctx.fill();
                } else {
                    // Simplified Devil icon
                    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#7f1d1d'; ctx.beginPath(); ctx.moveTo(px - r*0.4, py - r*0.5); ctx.lineTo(px - r*0.6, py - r*0.9); ctx.lineTo(px - r*0.8, py - r*0.4); ctx.fill();
                    ctx.beginPath(); ctx.moveTo(px + r*0.4, py - r*0.5); ctx.lineTo(px + r*0.6, py - r*0.9); ctx.lineTo(px + r*0.8, py - r*0.4); ctx.fill();
                }
            } else {
                // Draw a small representative circle
                ctx.beginPath();
                ctx.arc(pocket.pos.x, pocket.pos.y - pocket.radius - 28, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = "white";
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            ctx.restore();
        }
      });
      
      // Draw Coins
      physicsState.current.coins.forEach(coin => {
          ctx.save();
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#FACC15';
          ctx.beginPath();
          ctx.arc(coin.pos.x, coin.pos.y, coin.radius, 0, Math.PI * 2);
          const grad = ctx.createRadialGradient(
              coin.pos.x - 4, coin.pos.y - 4, 1,
              coin.pos.x, coin.pos.y, coin.radius
          );
          grad.addColorStop(0, '#FEF08A'); 
          grad.addColorStop(1, '#EAB308'); 
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#CA8A04';
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#713F12';
          ctx.save();
          ctx.translate(coin.pos.x, coin.pos.y);
          const scale = 0.8;
          ctx.scale(scale, scale);
          ctx.translate(-12, -12); 
          ctx.fill(STAR_PATH, "evenodd"); 
          ctx.restore();
          ctx.restore();
      });

      // Draw Particles
      physicsState.current.particles.forEach(p => {
        ctx.globalAlpha = p.life;
        if (p.behavior === 'BULLET') {
            ctx.save();
            ctx.shadowBlur = 15;
            ctx.shadowColor = p.color;
            ctx.fillStyle = '#ffffff'; 
            ctx.beginPath();
            ctx.arc(p.pos.x, p.pos.y, p.size * 0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else {
            if (ballStyle === 'PACMAN') {
                ctx.fillStyle = p.color;
                ctx.fillRect(p.pos.x, p.pos.y, p.size * p.life, p.size * p.life);
            } else {
                ctx.beginPath();
                ctx.arc(p.pos.x, p.pos.y, p.size * p.life, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1.0;
      });

      // Draw Balls
      physicsState.current.balls.forEach(ball => drawBall(ctx, ball));

      // Draw Aiming Line (Trajectory) & Power Circle
      const { start, current, isDragging: dragging } = interactionRef.current;
      const cueBall = physicsState.current.balls.find(b => b.isCue);

      if (cueBall && dragging && start && current) {
          const dx = start.x - current.x;
          const dy = start.y - current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 200;
          const power = Math.min(dist / maxDist, 1);
          
          let aimX = dx;
          let aimY = dy;
          const aimLen = Math.sqrt(aimX*aimX + aimY*aimY);
          
          if (aimLen > 0) {
              aimX /= aimLen;
              aimY /= aimLen;
              
              // --- ROBUST TRAJECTORY CALCULATION ---
              let closestT = 10000; // Max Ray Distance
              let hitType: 'wall' | 'ball' | 'obstacle' | null = null;
              let hitNormal: Vector2D | null = null;
              
              const cueR = cueBall.type.radius;
              const ox = cueBall.pos.x;
              const oy = cueBall.pos.y;

              // 1. Check Walls (Offset by Radius)
              // We check intersection with the "inner boundary" lines: 
              // x=r, x=width-r, y=r, y=height-r
              
              // Right Inner Wall (x = width - r)
              if (aimX > 0) {
                  const t = (CANVAS_WIDTH - cueR - ox) / aimX;
                  if (t < closestT && t >= 0) { 
                      closestT = t; hitType = 'wall'; 
                      hitNormal = { x: -1, y: 0 };
                  }
              }
              // Left Inner Wall (x = r)
              else if (aimX < 0) {
                  const t = (cueR - ox) / aimX;
                  if (t < closestT && t >= 0) { 
                      closestT = t; hitType = 'wall'; 
                      hitNormal = { x: 1, y: 0 };
                  }
              }
              // Bottom Inner Wall (y = height - r)
              if (aimY > 0) {
                  const t = (CANVAS_HEIGHT - cueR - oy) / aimY;
                  if (t < closestT && t >= 0) { 
                      closestT = t; hitType = 'wall'; 
                      hitNormal = { x: 0, y: -1 };
                  }
              }
              // Top Inner Wall (y = r)
              else if (aimY < 0) {
                  const t = (cueR - oy) / aimY;
                  if (t < closestT && t >= 0) { 
                      closestT = t; hitType = 'wall'; 
                      hitNormal = { x: 0, y: 1 };
                  }
              }

              // 2. Check Balls (Ray vs Sphere with sum of radii)
              const targetBalls = physicsState.current.balls.filter(b => !b.isCue);
              for (const ball of targetBalls) {
                  const sumR = cueR + ball.type.radius;
                  const hit = getRayCircleIntersection(ox, oy, aimX, aimY, ball.pos.x, ball.pos.y, sumR);
                  
                  if (hit && hit.t < closestT) {
                      closestT = hit.t;
                      hitType = 'ball';
                      hitNormal = { x: hit.nx, y: hit.ny }; 
                  }
              }

              // 3. Check Obstacles (Ray vs Capsule around segments)
              // Treat obstacle segments as capsules with radius = cueR
              gameState.obstacles.forEach(obs => {
                  if (obs.type === 'triangle' && obs.vertices) {
                      const len = obs.vertices.length;
                      for (let i = 0; i < len; i++) {
                          const p1 = obs.vertices[i];
                          const p2 = obs.vertices[(i + 1) % len];
                          
                          // Calculate Edge Vector and Normal
                          const ex = p2.x - p1.x;
                          const ey = p2.y - p1.y;
                          const eLen = Math.sqrt(ex*ex + ey*ey);
                          const nx = -ey / eLen;
                          const ny = ex / eLen;

                          // The "Capsule" around the segment is defined by:
                          // - Two offset lines parallel to segment at distance cueR
                          // - Two circles at endpoints p1, p2 with radius cueR

                          // 3.1 Check Offset Segments (Flat face collision)
                          const r = cueR;
                          const off1 = getRaySegmentIntersection(
                              ox, oy, aimX, aimY,
                              p1.x + nx * r, p1.y + ny * r,
                              p2.x + nx * r, p2.y + ny * r
                          );
                          const off2 = getRaySegmentIntersection(
                              ox, oy, aimX, aimY,
                              p1.x - nx * r, p1.y - ny * r,
                              p2.x - nx * r, p2.y - ny * r
                          );

                          if (off1 && off1.t < closestT) {
                              closestT = off1.t;
                              hitType = 'obstacle';
                              hitNormal = { x: nx, y: ny };
                          }
                          if (off2 && off2.t < closestT) {
                              closestT = off2.t;
                              hitType = 'obstacle';
                              hitNormal = { x: -nx, y: -ny };
                          }

                          // 3.2 Check Corner Circles (Corner collision)
                          const c1 = getRayCircleIntersection(ox, oy, aimX, aimY, p1.x, p1.y, r);
                          if (c1 && c1.t < closestT) {
                              closestT = c1.t;
                              hitType = 'obstacle';
                              hitNormal = { x: c1.nx, y: c1.ny };
                          }
                      }
                  }
              });

              const maxLength = 90;
              const lineDist = Math.min(closestT - 15, maxLength);
              const endX = ox + aimX * Math.max(0, lineDist);
              const endY = oy + aimY * Math.max(0, lineDist);

              // Draw Main Trajectory Line (Short and dashed)
              ctx.beginPath();
              ctx.setLineDash([4, 4]);
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
              ctx.lineWidth = 3;
              ctx.moveTo(ox, oy);
              ctx.lineTo(endX, endY);
              ctx.stroke();
              
              ctx.setLineDash([]); 
          }

          // 2. Circular Power Bar around Cue Ball
          const ringRadius = cueBall.type.radius + 12;
          
          let powerColor = '#22c55e'; 
          if (power > 0.66) powerColor = '#ef4444'; 
          else if (power > 0.33) powerColor = '#f97316'; 

          ctx.beginPath();
          ctx.arc(cueBall.pos.x, cueBall.pos.y, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
          ctx.lineWidth = 6;
          ctx.stroke();

          ctx.save();
          ctx.beginPath();
          const endAngle = -Math.PI / 2 + (power * Math.PI * 2);
          ctx.arc(cueBall.pos.x, cueBall.pos.y, ringRadius, -Math.PI / 2, endAngle, false);
          
          ctx.strokeStyle = powerColor;
          ctx.lineWidth = 6;
          ctx.lineCap = 'round';
          
          ctx.shadowBlur = 10;
          ctx.shadowColor = powerColor;
          ctx.stroke();
          ctx.restore();
      }
    };

    const drawRoundedPoly = (ctx: CanvasRenderingContext2D, vertices: Vector2D[], radius: number) => {
        const len = vertices.length;
        const p0 = vertices[0];
        const pLast = vertices[len - 1];
        const midX = (p0.x + pLast.x) / 2;
        const midY = (p0.y + pLast.y) / 2;
        ctx.moveTo(midX, midY);
        for (let i = 0; i < len; i++) {
            const v = vertices[i];
            const nextV = vertices[(i + 1) % len];
            ctx.arcTo(v.x, v.y, nextV.x, nextV.y, radius);
        }
        ctx.closePath();
    };

    const drawInnerPoly = (ctx: CanvasRenderingContext2D, center: Vector2D, vertices: Vector2D[], radius: number, scale: number) => {
        const len = vertices.length;
        const innerVertices = vertices.map(v => ({
             x: center.x + (v.x - center.x) * scale,
             y: center.y + (v.y - center.y) * scale
        }));
        const p0 = innerVertices[0];
        const pLast = innerVertices[len - 1];
        const midX = (p0.x + pLast.x) / 2;
        const midY = (p0.y + pLast.y) / 2;
        ctx.moveTo(midX, midY);
        for (let i = 0; i < len; i++) {
             const v = innerVertices[i];
             const nextV = innerVertices[(i+1)%len];
             ctx.arcTo(v.x, v.y, nextV.x, nextV.y, radius * scale);
        }
        ctx.closePath();
    };

    const drawBall = (ctx: CanvasRenderingContext2D, ball: Ball) => {
      // Shadow
      ctx.beginPath();
      ctx.ellipse(ball.pos.x + 4, ball.pos.y + 4, ball.type.radius, ball.type.radius * 0.8, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fill();

      // DUNGEON STYLE
      if (ballStyle === 'DUNGEON') {
         const r = ball.type.radius;
         if (ball.isCue) {
             // Rambo Head (Cue Ball)
             ctx.fillStyle = '#ffdbac'; 
             ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y, r, 0, Math.PI * 2); ctx.fill();
             // Red Headband
             ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y, r, Math.PI * 1.2, Math.PI * 1.8, false); ctx.fill();
             ctx.fillRect(ball.pos.x - r * 0.9, ball.pos.y - r * 0.6, r * 1.8, r * 0.4);
             // Bandana Tails
             ctx.beginPath(); ctx.moveTo(ball.pos.x - r * 0.8, ball.pos.y - r * 0.4); ctx.lineTo(ball.pos.x - r * 1.5, ball.pos.y - r * 0.2); ctx.lineTo(ball.pos.x - r * 1.5, ball.pos.y - r * 0.6); ctx.fill();
             // Eyes
             ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(ball.pos.x - r * 0.3, ball.pos.y, r * 0.15, 0, Math.PI * 2); ctx.fill();
             ctx.beginPath(); ctx.arc(ball.pos.x + r * 0.3, ball.pos.y, r * 0.15, 0, Math.PI * 2); ctx.fill();
             // Angry Eyebrows
             ctx.lineWidth = 2; ctx.strokeStyle = 'black'; ctx.beginPath(); ctx.moveTo(ball.pos.x - r * 0.6, ball.pos.y - r * 0.2); ctx.lineTo(ball.pos.x - r * 0.1, ball.pos.y + r * 0.1); ctx.stroke();
             ctx.beginPath(); ctx.moveTo(ball.pos.x + r * 0.6, ball.pos.y - r * 0.2); ctx.lineTo(ball.pos.x + r * 0.1, ball.pos.y + r * 0.1); ctx.stroke();
             // Mouth
             ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y + r * 0.4, r * 0.2, Math.PI, 0); ctx.stroke();
         } else {
             // Monster Variety based on Ball ID
             const monsterType = ball.type.id === 15 ? 15 : (ball.type.id % 8); // Cycle through 8 designs, but 15 is special
             
             switch (monsterType) {
                 case 0: // Zombie (Green)
                     ctx.fillStyle = '#65a30d'; ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y, r, 0, Math.PI * 2); ctx.fill();
                     // Eyes (Mismatched)
                     ctx.fillStyle = '#fef3c7'; ctx.beginPath(); ctx.arc(ball.pos.x - r * 0.3, ball.pos.y - r * 0.1, r * 0.25, 0, Math.PI * 2); ctx.fill();
                     ctx.beginPath(); ctx.arc(ball.pos.x + r * 0.3, ball.pos.y - r * 0.1, r * 0.18, 0, Math.PI * 2); ctx.fill();
                     ctx.fillStyle = '#b91c1c'; ctx.beginPath(); ctx.arc(ball.pos.x - r * 0.3, ball.pos.y - r * 0.1, r * 0.08, 0, Math.PI * 2); ctx.fill();
                     ctx.beginPath(); ctx.arc(ball.pos.x + r * 0.3, ball.pos.y - r * 0.1, r * 0.05, 0, Math.PI * 2); ctx.fill();
                     // Mouth
                     ctx.fillStyle = '#365314'; ctx.beginPath(); ctx.ellipse(ball.pos.x, ball.pos.y + r * 0.4, r * 0.2, r * 0.15, 0, 0, Math.PI * 2); ctx.fill();
                     ctx.fillStyle = '#fffff0'; ctx.fillRect(ball.pos.x - r * 0.05, ball.pos.y + r * 0.25, r * 0.06, r * 0.08); // Tooth
                     // Scar
                     ctx.strokeStyle = '#365314'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ball.pos.x - r * 0.45, ball.pos.y - r * 0.65); ctx.lineTo(ball.pos.x - r * 0.4, ball.pos.y - r * 0.45); ctx.stroke();
                     break;

                 case 1: // Blue Skeleton (Blue)
                     ctx.fillStyle = '#3b82f6'; 
                     ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y, r, 0, Math.PI * 2); ctx.fill();
                     // Eyes (Sockets)
                     ctx.fillStyle = '#1e293b'; 
                     ctx.beginPath(); ctx.arc(ball.pos.x - r * 0.35, ball.pos.y - r * 0.1, r * 0.25, 0, Math.PI * 2); ctx.fill();
                     ctx.beginPath(); ctx.arc(ball.pos.x + r * 0.35, ball.pos.y - r * 0.1, r * 0.25, 0, Math.PI * 2); ctx.fill();
                     // Nose
                     ctx.beginPath(); ctx.moveTo(ball.pos.x, ball.pos.y + r * 0.2); ctx.lineTo(ball.pos.x - r*0.1, ball.pos.y + r * 0.35); ctx.lineTo(ball.pos.x + r*0.1, ball.pos.y + r * 0.35); ctx.fill();
                     // Mouth (Stitched)
                     ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2;
                     ctx.beginPath(); ctx.moveTo(ball.pos.x - r * 0.5, ball.pos.y + r * 0.5); ctx.quadraticCurveTo(ball.pos.x, ball.pos.y + r*0.6, ball.pos.x + r * 0.5, ball.pos.y + r * 0.5); ctx.stroke();
                     ctx.lineWidth = 1;
                     for(let i=0; i<5; i++) {
                         const mx = (ball.pos.x - r * 0.3) + (i * r * 0.15);
                         ctx.beginPath(); ctx.moveTo(mx, ball.pos.y + r * 0.45); ctx.lineTo(mx, ball.pos.y + r * 0.65); ctx.stroke();
                     }
                     break;

                 case 2: // Red Vampire (Red)
                     ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y, r, 0, Math.PI * 2); ctx.fill();
                     // Hair (Widow's peak)
                     ctx.fillStyle = '#020617'; 
                     ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y, r, Math.PI, 0); 
                     ctx.lineTo(ball.pos.x, ball.pos.y - r * 0.4); 
                     ctx.lineTo(ball.pos.x - r, ball.pos.y); ctx.fill();
                     // Eyes (Yellow)
                     ctx.fillStyle = '#facc15';
                     ctx.beginPath(); ctx.arc(ball.pos.x - r * 0.3, ball.pos.y, r * 0.15, 0, Math.PI * 2); ctx.fill();
                     ctx.beginPath(); ctx.arc(ball.pos.x + r * 0.3, ball.pos.y, r * 0.15, 0, Math.PI * 2); ctx.fill();
                     // Mouth & Fangs
                     ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
                     ctx.beginPath(); ctx.moveTo(ball.pos.x - r*0.3, ball.pos.y + r*0.4); ctx.quadraticCurveTo(ball.pos.x, ball.pos.y + r*0.5, ball.pos.x + r*0.3, ball.pos.y + r*0.4); ctx.stroke();
                     ctx.fillStyle = '#fff';
                     ctx.beginPath(); ctx.moveTo(ball.pos.x - r*0.25, ball.pos.y + r*0.42); ctx.lineTo(ball.pos.x - r*0.15, ball.pos.y + r*0.65); ctx.lineTo(ball.pos.x - r*0.05, ball.pos.y + r*0.45); ctx.fill();
                     ctx.beginPath(); ctx.moveTo(ball.pos.x + r*0.25, ball.pos.y + r*0.42); ctx.lineTo(ball.pos.x + r*0.15, ball.pos.y + r*0.65); ctx.lineTo(ball.pos.x + r*0.05, ball.pos.y + r*0.45); ctx.fill();
                     break;

                 case 3: // Pumpkin (Orange)
                     ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y, r, 0, Math.PI * 2); ctx.fill();
                     // Vertical Lines
                     ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 1;
                     ctx.beginPath(); ctx.ellipse(ball.pos.x, ball.pos.y, r * 0.5, r, 0, 0, Math.PI * 2); ctx.stroke();
                     // Eyes (Triangles)
                     ctx.fillStyle = '#451a03';
                     ctx.beginPath(); ctx.moveTo(ball.pos.x - r * 0.5, ball.pos.y - r * 0.2); ctx.lineTo(ball.pos.x - r * 0.2, ball.pos.y - r * 0.2); ctx.lineTo(ball.pos.x - r * 0.35, ball.pos.y - r * 0.5); ctx.fill();
                     ctx.beginPath(); ctx.moveTo(ball.pos.x + r * 0.5, ball.pos.y - r * 0.2); ctx.lineTo(ball.pos.x + r * 0.2, ball.pos.y - r * 0.2); ctx.lineTo(ball.pos.x + r * 0.35, ball.pos.y - r * 0.5); ctx.fill();
                     // Mouth (Jagged)
                     ctx.beginPath(); 
                     ctx.moveTo(ball.pos.x - r * 0.5, ball.pos.y + r * 0.2);
                     ctx.lineTo(ball.pos.x - r * 0.3, ball.pos.y + r * 0.4);
                     ctx.lineTo(ball.pos.x - r * 0.1, ball.pos.y + r * 0.2);
                     ctx.lineTo(ball.pos.x + r * 0.1, ball.pos.y + r * 0.4);
                     ctx.lineTo(ball.pos.x + r * 0.3, ball.pos.y + r * 0.2);
                     ctx.lineTo(ball.pos.x + r * 0.5, ball.pos.y + r * 0.3);
                     ctx.lineTo(ball.pos.x, ball.pos.y + r * 0.6);
                     ctx.fill();
                     break;

                 case 4: // Frankenstein (Square Head Green)
                     ctx.fillStyle = '#4ade80'; ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y, r, 0, Math.PI * 2); ctx.fill();
                     // Hair (Flat top)
                     ctx.fillStyle = '#0f172a';
                     ctx.beginPath(); ctx.moveTo(ball.pos.x - r, ball.pos.y - r*0.2); ctx.lineTo(ball.pos.x - r, ball.pos.y - r); ctx.lineTo(ball.pos.x + r, ball.pos.y - r); ctx.lineTo(ball.pos.x + r, ball.pos.y - r*0.2); 
                     // Jagged bangs
                     for(let i=0; i<6; i++) { ctx.lineTo(ball.pos.x + r - (i*r/2.5), ball.pos.y - r*0.1 + (i%2)*5); }
                     ctx.fill();
                     // Bolts
                     ctx.fillStyle = '#94a3b8'; ctx.fillRect(ball.pos.x - r - 4, ball.pos.y + r*0.2, 6, 8); ctx.fillRect(ball.pos.x + r - 2, ball.pos.y + r*0.2, 6, 8);
                     // Face
                     ctx.fillStyle = '#000'; ctx.fillRect(ball.pos.x - r*0.4, ball.pos.y + r*0.1, r*0.2, 2); ctx.fillRect(ball.pos.x + r*0.2, ball.pos.y + r*0.1, r*0.2, 2);
                     ctx.fillRect(ball.pos.x - r*0.3, ball.pos.y + r*0.5, r*0.6, 2);
                     break;

                 case 5: // Mummy (Beige)
                     ctx.fillStyle = '#ded0b6'; ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y, r, 0, Math.PI * 2); ctx.fill();
                     // Bandages
                     ctx.strokeStyle = '#a89f91'; ctx.lineWidth = 2;
                     ctx.beginPath(); ctx.moveTo(ball.pos.x - r, ball.pos.y - r*0.5); ctx.lineTo(ball.pos.x + r, ball.pos.y - r*0.3); ctx.stroke();
                     ctx.beginPath(); ctx.moveTo(ball.pos.x - r, ball.pos.y + r*0.1); ctx.lineTo(ball.pos.x + r, ball.pos.y - r*0.1); ctx.stroke();
                     ctx.beginPath(); ctx.moveTo(ball.pos.x - r, ball.pos.y + r*0.4); ctx.lineTo(ball.pos.x + r, ball.pos.y + r*0.6); ctx.stroke();
                     // Eyes (Glowing Yellow in darkness)
                     ctx.fillStyle = '#1c1917'; ctx.beginPath(); ctx.fillRect(ball.pos.x - r*0.6, ball.pos.y - r*0.2, r*1.2, r*0.3); // Eye slit
                     ctx.fillStyle = '#facc15';
                     ctx.beginPath(); ctx.arc(ball.pos.x - r * 0.25, ball.pos.y - r * 0.05, r * 0.1, 0, Math.PI * 2); ctx.fill();
                     ctx.beginPath(); ctx.arc(ball.pos.x + r * 0.25, ball.pos.y - r * 0.05, r * 0.1, 0, Math.PI * 2); ctx.fill();
                     break;
                 
                 case 6: // Ghost (White/Blue Transparent)
                     ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y, r, 0, Math.PI * 2); ctx.fill();
                     // Eyes
                     ctx.fillStyle = '#000'; 
                     ctx.beginPath(); ctx.ellipse(ball.pos.x - r*0.3, ball.pos.y - r*0.1, r*0.15, r*0.2, 0, 0, Math.PI*2); ctx.fill();
                     ctx.beginPath(); ctx.ellipse(ball.pos.x + r*0.3, ball.pos.y - r*0.1, r*0.15, r*0.2, 0, 0, Math.PI*2); ctx.fill();
                     // Mouth (O shape)
                     ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y + r*0.3, r*0.15, 0, Math.PI*2); ctx.fill();
                     // Blush
                     ctx.fillStyle = 'rgba(255, 100, 100, 0.3)';
                     ctx.beginPath(); ctx.arc(ball.pos.x - r*0.6, ball.pos.y + r*0.1, r*0.15, 0, Math.PI*2); ctx.fill();
                     ctx.beginPath(); ctx.arc(ball.pos.x + r*0.6, ball.pos.y + r*0.1, r*0.15, 0, Math.PI*2); ctx.fill();
                     break;
                     
                 case 7: // Devil (Red)
                     ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y, r, 0, Math.PI * 2); ctx.fill();
                     // Horns
                     ctx.fillStyle = '#7f1d1d';
                     ctx.beginPath(); ctx.moveTo(ball.pos.x - r*0.4, ball.pos.y - r*0.5); ctx.lineTo(ball.pos.x - r*0.6, ball.pos.y - r*0.9); ctx.lineTo(ball.pos.x - r*0.8, ball.pos.y - r*0.4); ctx.fill();
                     ctx.beginPath(); ctx.moveTo(ball.pos.x + r*0.4, ball.pos.y - r*0.5); ctx.lineTo(ball.pos.x + r*0.6, ball.pos.y - r*0.9); ctx.lineTo(ball.pos.x + r*0.8, ball.pos.y - r*0.4); ctx.fill();
                     // Eyes (Angled)
                     ctx.fillStyle = '#000';
                     ctx.beginPath(); ctx.moveTo(ball.pos.x - r*0.5, ball.pos.y - r*0.2); ctx.lineTo(ball.pos.x - r*0.1, ball.pos.y - r*0.05); ctx.lineTo(ball.pos.x - r*0.5, ball.pos.y + r*0.05); ctx.fill();
                     ctx.beginPath(); ctx.moveTo(ball.pos.x + r*0.5, ball.pos.y - r*0.2); ctx.lineTo(ball.pos.x + r*0.1, ball.pos.y - r*0.05); ctx.lineTo(ball.pos.x + r*0.5, ball.pos.y + r*0.05); ctx.fill();
                     // Grin
                     ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
                     ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y + r*0.1, r*0.5, 0.2, Math.PI - 0.2); ctx.stroke();
                     break;

                  case 15: // Villager (Neutral)
                      // Use ball id to create stable variations
                      const variant = parseInt(ball.id.replace('ball-', '')) || 0;
                      const vType = variant % 3;

                      ctx.fillStyle = vType === 0 ? '#94a3b8' : vType === 1 ? '#cbd5e1' : '#64748b'; 
                      ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y, r, 0, Math.PI * 2); ctx.fill();
                      
                      // Face
                      ctx.fillStyle = '#1e293b';
                      ctx.beginPath(); ctx.arc(ball.pos.x - r*0.3, ball.pos.y - r*0.1, r*0.1, 0, Math.PI*2); ctx.fill();
                      ctx.beginPath(); ctx.arc(ball.pos.x + r*0.3, ball.pos.y - r*0.1, r*0.1, 0, Math.PI*2); ctx.fill();
                      
                      ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.5;
                      ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y + r*0.3, r*0.2, 0, Math.PI); ctx.stroke();

                      if (vType === 1) {
                          // Hat
                          ctx.fillStyle = '#451a03';
                          ctx.beginPath(); ctx.moveTo(ball.pos.x - r, ball.pos.y - r*0.3); ctx.lineTo(ball.pos.x + r, ball.pos.y - r*0.3); ctx.lineTo(ball.pos.x, ball.pos.y - r*0.9); ctx.fill();
                      } else if (vType === 2) {
                          // Beard
                          ctx.fillStyle = '#451a03';
                          ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y + r*0.5, r*0.4, 0, Math.PI); ctx.fill();
                      }

                      // Halo (to show it's "good")
                      ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2;
                      ctx.beginPath(); ctx.ellipse(ball.pos.x, ball.pos.y - r*1.1, r*0.6, r*0.2, 0, 0, Math.PI*2); ctx.stroke();
                      break;
             }
         }
         // Universal Shadow overlay for depth
         const highlight = ctx.createRadialGradient(ball.pos.x - r*0.3, ball.pos.y - r*0.3, r*0.1, ball.pos.x, ball.pos.y, r);
         highlight.addColorStop(0, 'rgba(255, 255, 255, 0.15)'); highlight.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
         ctx.fillStyle = highlight; ctx.fill();
         return;
      }

      // PACMAN STYLE
      if (ballStyle === 'PACMAN') {
          const r = ball.type.radius;
          if (ball.isCue) {
              ctx.fillStyle = '#FFFF00'; ctx.beginPath();
              let angle = 0; let moving = false;
              if (Math.abs(ball.vel.x) > 0.1 || Math.abs(ball.vel.y) > 0.1) { angle = Math.atan2(ball.vel.y, ball.vel.x); moving = true; }
              let mouthSize = 0.2 * Math.PI; 
              if (moving) { const time = performance.now(); mouthSize = (Math.abs(Math.sin(time / 100)) * 0.2 + 0.05) * Math.PI; }
              ctx.arc(ball.pos.x, ball.pos.y, r, angle + mouthSize, angle + 2 * Math.PI - mouthSize); ctx.lineTo(ball.pos.x, ball.pos.y); ctx.fill();
              return;
          } else {
              const isNeutral = ball.type.id === 15;
              const color = isNeutral ? '#000000' : ball.type.color; 
              ctx.fillStyle = color;
              const headRadius = r * 0.9; const feetY = ball.pos.y + r * 0.7;
              ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y - r * 0.2, headRadius, Math.PI, 0); ctx.lineTo(ball.pos.x + headRadius, feetY);
              const footWidth = (headRadius * 2) / 3; const bottomY = feetY; const midY = feetY - 5;
              ctx.lineTo(ball.pos.x + headRadius - footWidth/2, midY); ctx.lineTo(ball.pos.x + headRadius - footWidth, bottomY);
              ctx.lineTo(ball.pos.x + headRadius - footWidth * 1.5, midY); ctx.lineTo(ball.pos.x + headRadius - footWidth * 2, bottomY);
              ctx.lineTo(ball.pos.x + headRadius - footWidth * 2.5, midY); ctx.lineTo(ball.pos.x - headRadius, bottomY);
              ctx.lineTo(ball.pos.x - headRadius, ball.pos.y - r * 0.2); ctx.fill();
              
              if (isNeutral) {
                  // Black ghost eyes (inverted or glowing)
                  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                  const eyeOffsetX = headRadius * 0.35; const eyeOffsetY = -r * 0.2; const eyeRadius = headRadius * 0.3;
                  ctx.beginPath(); ctx.arc(ball.pos.x - eyeOffsetX, ball.pos.y + eyeOffsetY, eyeRadius, 0, Math.PI * 2); ctx.arc(ball.pos.x + eyeOffsetX, ball.pos.y + eyeOffsetY, eyeRadius, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#FFFFFF'; const pupilRadius = eyeRadius * 0.4;
                  ctx.beginPath(); ctx.arc(ball.pos.x - eyeOffsetX, ball.pos.y + eyeOffsetY, pupilRadius, 0, Math.PI * 2); ctx.arc(ball.pos.x + eyeOffsetX, ball.pos.y + eyeOffsetY, pupilRadius, 0, Math.PI * 2); ctx.fill();
              } else {
                  ctx.fillStyle = 'white'; const eyeOffsetX = headRadius * 0.35; const eyeOffsetY = -r * 0.2; const eyeRadius = headRadius * 0.3;
                  ctx.beginPath(); ctx.arc(ball.pos.x - eyeOffsetX, ball.pos.y + eyeOffsetY, eyeRadius, 0, Math.PI * 2); ctx.arc(ball.pos.x + eyeOffsetX, ball.pos.y + eyeOffsetY, eyeRadius, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#2563EB'; const pupilRadius = eyeRadius * 0.5; let pupilDx = 2; let pupilDy = 0;
                  if (Math.abs(ball.vel.x) > 0.1 || Math.abs(ball.vel.y) > 0.1) { const angle = Math.atan2(ball.vel.y, ball.vel.x); pupilDx = Math.cos(angle) * 2; pupilDy = Math.sin(angle) * 2; }
                  ctx.beginPath(); ctx.arc(ball.pos.x - eyeOffsetX + pupilDx, ball.pos.y + eyeOffsetY + pupilDy, pupilRadius, 0, Math.PI * 2); ctx.arc(ball.pos.x + eyeOffsetX + pupilDx, ball.pos.y + eyeOffsetY + pupilDy, pupilRadius, 0, Math.PI * 2); ctx.fill();
              }
              return;
          }
      }

      if (ballStyle === 'MINIMAL') {
         ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y, ball.type.radius, 0, Math.PI * 2);
         ctx.fillStyle = ball.type.id === 15 ? '#000000' : ball.type.color; ctx.fill();
         ctx.strokeStyle = ball.type.id === 15 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = 2; ctx.stroke();
         return; 
      }

      // Classic
      ctx.save(); ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y, ball.type.radius, 0, Math.PI * 2); ctx.clip();
      const isNeutral = ball.type.id === 15;
      ctx.fillStyle = isNeutral ? '#000000' : (ball.type.isStripe ? '#f8fafc' : ball.type.color); ctx.fill();
      if (!isNeutral && ball.type.isStripe) { ctx.fillStyle = ball.type.color; ctx.fillRect(ball.pos.x - ball.type.radius, ball.pos.y - ball.type.radius * 0.6, ball.type.radius * 2, ball.type.radius * 1.2); }
      ctx.restore();
      const highlight = ctx.createRadialGradient(ball.pos.x - ball.type.radius*0.3, ball.pos.y - ball.type.radius*0.3, ball.type.radius*0.1, ball.pos.x, ball.pos.y, ball.type.radius);
      highlight.addColorStop(0, 'rgba(255, 255, 255, 0.6)'); highlight.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)'); highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y, ball.type.radius, 0, Math.PI * 2); ctx.fillStyle = highlight; ctx.fill();
      if (ball.type.label || isNeutral) {
        const label = isNeutral ? '8' : ball.type.label;
        ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y, ball.type.radius * 0.45, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; ctx.fill();
        ctx.font = `bold ${ball.type.radius * 0.5}px 'Inter', sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#111827'; ctx.fillText(label, ball.pos.x, ball.pos.y + (ball.type.radius * 0.05));
      }
      ctx.beginPath(); ctx.arc(ball.pos.x, ball.pos.y, ball.type.radius, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'; ctx.stroke();
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [ballStyle, onGameOver, onWin, createBulletHellExplosion, createObstacleHitEffect, createSplash, setGameState, dungeonBackground]); 

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isCueMoving) return;
    const cueBall = physicsState.current.balls.find(b => b.isCue);
    if (!cueBall) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsDragging(true);
    dragStartRef.current = pos;
    setDragStart(pos);
    setDragCurrent(pos);
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleWindowMouseMove = (e: MouseEvent) => {
       const rect = canvasRef.current?.getBoundingClientRect();
       if (!rect) return;
       const x = e.clientX - rect.left;
       const y = e.clientY - rect.top;
       setDragCurrent({ x, y });
    };
    const handleWindowMouseUp = (e: MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect || !dragStartRef.current) { setIsDragging(false); setDragStart(null); setDragCurrent(null); return; }
        const currentPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const startPos = dragStartRef.current;
        const cueBall = physicsState.current.balls.find(b => b.isCue);
        if (cueBall) {
            const dx = startPos.x - currentPos.x;
            const dy = startPos.y - currentPos.y;
            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                cueBall.vel.x = dx * SHOOT_POWER_MULTIPLIER;
                cueBall.vel.y = dy * SHOOT_POWER_MULTIPLIER;
            }
        }
        setIsDragging(false); setDragStart(null); setDragCurrent(null); dragStartRef.current = null;
    };
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
        window.removeEventListener('mousemove', handleWindowMouseMove);
        window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDragging]);

  return (
    <div className={`relative rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border-[16px] ${
        ballStyle === 'PACMAN' ? 'border-slate-950 shadow-purple-500/50' :
        ballStyle === 'DUNGEON' ? 'border-stone-700 shadow-stone-800/50' :
        ballStyle === 'CLASSIC' ? 'border-[#2b1810] shadow-black/50' :
        'border-gray-900 shadow-white/10'
    }`} style={{ backgroundColor: '#000' }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onMouseDown={handleMouseDown}
        className={`block ${isCueMoving ? 'cursor-wait' : 'cursor-crosshair'}`}
      />
      {isCueMoving && (
          <div className="absolute top-4 right-4 bg-black/40 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-white/80 border border-white/10">
            Wait...
          </div>
      )}
      {!isCueMoving && (
         <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur px-4 py-1 rounded-full text-xs text-white pointer-events-none">
             Drag to Shoot
         </div>
      )}
    </div>
  );
};

export default GameCanvas;