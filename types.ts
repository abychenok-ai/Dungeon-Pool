export interface Vector2D {
  x: number;
  y: number;
}

export interface BallTier {
  id: number;
  name: string;
  label: string;
  radius: number;
  color: string;
  points: number;
  isStripe: boolean;
}

export interface Ball {
  id: string;
  type: BallTier;
  pos: Vector2D;
  vel: Vector2D;
  mass: number;
  isMerging?: boolean;
  isCue?: boolean;
}

export interface Pocket {
  id: string;
  pos: Vector2D;
  radius: number;
}

export interface Obstacle {
  id: string;
  type: 'triangle' | 'bumper';
  vertices?: Vector2D[]; // Required for 'triangle'
  center: Vector2D;
  radius: number; // Radius for bumpers, bounding radius for triangles
}

export interface Coin {
  id: string;
  pos: Vector2D;
  radius: number;
}

export interface Particle {
  id: string;
  pos: Vector2D;
  vel: Vector2D;
  color: string;
  life: number; // 1.0 to 0.0
  size: number;
  behavior?: 'GRAVITY' | 'BULLET';
}

export interface GameState {
  score: number;
  balls: Ball[];
  pockets: Pocket[];
  obstacles: Obstacle[];
  coinsOnTable: Coin[];
  highScore: number;
  isGameOver: boolean;
  isWon: boolean;
  lives: number;
  coins: number;
  timeLeft?: number; // Optional timer field
  difficulty: Difficulty;
}

export type Difficulty = 'SIMPLE' | 'MEDIUM' | 'HARD' | 'TIMER' | 'SORT' | 'PRECISION';

export type BallStyle = 'CLASSIC' | 'MINIMAL' | 'PACMAN' | 'DUNGEON';