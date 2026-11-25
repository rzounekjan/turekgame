export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export interface LevelConfig {
  level: number;
  name: string;
  subtitle: string;
  minScore: number;
  baseSpeed: number;
  spawnIntervalMin: number;
  spawnIntervalMax: number;
  maxCarsPerWave: number;
  bpm: number;
  accentHex: string;
  accentColor: number;
  secondaryColor: number;
  skyColor: number;
  fogColor: number;
  gantryColor: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  score: number;
  bestLocalScore: number;
  level: number;
  levelName: string;
  levelAccent: string;
  speedKmh: number;
  speedStep: number;
  dodgedCars: number;
  ambulancesHit: number;
  nextLevelScore: number | null;
  levelProgress: number;
  ambulanceNearby: boolean;
}

export interface ScorePopupEvent {
  id: number;
  text: string;
  subtext?: string;
  xPercent: number;
  yPercent: number;
  kind: 'dodge' | 'ambulance' | 'speed' | 'level';
}

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  score: number;
  level: number;
  ambulancesHit: number;
  createdAt: string;
}
