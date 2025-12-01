export interface MathProblem {
  id: string;
  equation: string; // e.g. "5 + 3 = 9"
  isCorrect: boolean;
  difficulty: number;
}

export enum GameState {
  MENU = 'MENU',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export enum SwipeDirection {
  LEFT = 'LEFT', // User thinks it's False
  RIGHT = 'RIGHT', // User thinks it's True
  NONE = 'NONE' // Timeout
}

export enum FocusState {
  HIGH = 'HIGH',   // Green
  MEDIUM = 'MEDIUM', // Yellow
  LOW = 'LOW'      // Orange
}