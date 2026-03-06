
import { BallTier } from './types';

export const CUE_BALL_TIER: BallTier = {
  id: 99,
  name: 'Cue Ball',
  label: '',
  radius: 18,
  color: '#FFFFFF',
  points: 0,
  isStripe: false
};

export const BALL_TIERS: BallTier[] = [
  { id: 0, name: '1-Ball', label: '1', radius: 18, color: '#EAB308', points: 100, isStripe: false }, // Yellow
  { id: 1, name: '2-Ball', label: '2', radius: 18, color: '#2563EB', points: 100, isStripe: false }, // Blue
  { id: 2, name: '3-Ball', label: '3', radius: 18, color: '#DC2626', points: 100, isStripe: false }, // Red
  { id: 3, name: '4-Ball', label: '4', radius: 18, color: '#7E22CE', points: 100, isStripe: false }, // Purple
  { id: 4, name: '5-Ball', label: '5', radius: 18, color: '#F97316', points: 100, isStripe: false }, // Orange
  { id: 5, name: '6-Ball', label: '6', radius: 18, color: '#16A34A', points: 100, isStripe: false }, // Green
  { id: 6, name: '7-Ball', label: '7', radius: 18, color: '#991B1B', points: 100, isStripe: false }, // Maroon
  { id: 7, name: '8-Ball', label: '8', radius: 18, color: '#171717', points: 500, isStripe: false }, // Black
  { id: 8, name: '9-Ball', label: '9', radius: 18, color: '#EAB308', points: 200, isStripe: true }, // Yellow Stripe
  { id: 9, name: '10-Ball', label: '10', radius: 18, color: '#2563EB', points: 200, isStripe: true }, // Blue Stripe
  { id: 10, name: '11-Ball', label: '11', radius: 18, color: '#DC2626', points: 200, isStripe: true }, // Red Stripe
  { id: 11, name: '12-Ball', label: '12', radius: 18, color: '#7E22CE', points: 200, isStripe: true }, // Purple Stripe
  { id: 12, name: '13-Ball', label: '13', radius: 18, color: '#F97316', points: 200, isStripe: true }, // Orange Stripe
  { id: 13, name: '14-Ball', label: '14', radius: 18, color: '#16A34A', points: 200, isStripe: true }, // Green Stripe
  { id: 14, name: '15-Ball', label: '15', radius: 18, color: '#991B1B', points: 200, isStripe: true }, // Maroon Stripe
  { id: 15, name: 'Neutral', label: 'N', radius: 18, color: '#94a3b8', points: 0, isStripe: false }, // Slate/Grey Neutral
];

export const CANVAS_WIDTH = 500;
export const CANVAS_HEIGHT = 500;
export const FRICTION = 0.99; // Re-balanced for 2x sub-stepping
export const WALL_BOUNCE = 0.92; // Slightly reduced to prevent "bouncy castle" effect with 2x steps
export const SHOOT_POWER_MULTIPLIER = 0.22; // Re-balanced for 2x sub-stepping (effective 0.44)
export const MIN_SPEED_THRESHOLD = 0.08; // Increased threshold for cleaner stops
export const DEFAULT_POCKET_RADIUS = 35;
export const COIN_RADIUS = 15;
