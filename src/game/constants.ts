import type { LevelConfig } from '../types/game';

export const LANE_COUNT = 6;
export const LANE_WIDTH = 2.65;
export const ROAD_WIDTH = LANE_COUNT * LANE_WIDTH; // 15.9 units
export const SHOULDER_WIDTH = 1.6;
export const TOTAL_HIGHWAY_WIDTH = ROAD_WIDTH + SHOULDER_WIDTH * 2;
export const ROAD_LENGTH = 170;

export const PLAYER_Z = 14.5;
export const SPAWN_Z = -96;
export const DESPAWN_Z = 28;

export const NORMAL_DODGE_POINTS = 1;
export const AMBULANCE_HIT_POINTS = 5;
export const SPEEDUP_EVERY_POINTS = 10;
export const SPEEDUP_INCREMENT = 2.15;

export const AMBULANCE_MIN_INTERVAL = 8;
export const AMBULANCE_MAX_INTERVAL = 15;

export function getLaneX(laneIndex: number): number {
  return (laneIndex - (LANE_COUNT - 1) / 2) * LANE_WIDTH;
}

export const LEVELS: LevelConfig[] = [
  {
    level: 1,
    name: 'Noční tah',
    subtitle: 'Rozjezd na dálnici',
    minScore: 0,
    baseSpeed: 29,
    spawnIntervalMin: 0.78,
    spawnIntervalMax: 1.18,
    maxCarsPerWave: 2,
    bpm: 118,
    accentHex: '#00f0ff',
    accentColor: 0x00f0ff,
    secondaryColor: 0x0ea5e9,
    skyColor: 0x060a16,
    fogColor: 0x070d1e,
    gantryColor: 0x00e5ff,
  },
  {
    level: 2,
    name: 'Městský okruh',
    subtitle: 'Hustší provoz',
    minScore: 20,
    baseSpeed: 35,
    spawnIntervalMin: 0.64,
    spawnIntervalMax: 1.0,
    maxCarsPerWave: 3,
    bpm: 128,
    accentHex: '#38bdf8',
    accentColor: 0x38bdf8,
    secondaryColor: 0x6366f1,
    skyColor: 0x07081c,
    fogColor: 0x0b0e29,
    gantryColor: 0x60a5fa,
  },
  {
    level: 3,
    name: 'Zlatý přetlak',
    subtitle: 'Vysoké otáčky',
    minScore: 45,
    baseSpeed: 42,
    spawnIntervalMin: 0.54,
    spawnIntervalMax: 0.86,
    maxCarsPerWave: 3,
    bpm: 138,
    accentHex: '#f59e0b',
    accentColor: 0xf59e0b,
    secondaryColor: 0x06b6d4,
    skyColor: 0x120a14,
    fogColor: 0x1a0f18,
    gantryColor: 0xfbbf24,
  },
  {
    level: 4,
    name: 'Červená zóna',
    subtitle: 'Rychlostní limit pryč',
    minScore: 75,
    baseSpeed: 49,
    spawnIntervalMin: 0.45,
    spawnIntervalMax: 0.72,
    maxCarsPerWave: 4,
    bpm: 150,
    accentHex: '#f43f5e',
    accentColor: 0xf43f5e,
    secondaryColor: 0xf97316,
    skyColor: 0x14070f,
    fogColor: 0x1d0a14,
    gantryColor: 0xfb7185,
  },
  {
    level: 5,
    name: 'Hyper Turek',
    subtitle: 'Maximální overdrive',
    minScore: 110,
    baseSpeed: 57,
    spawnIntervalMin: 0.37,
    spawnIntervalMax: 0.6,
    maxCarsPerWave: 4,
    bpm: 164,
    accentHex: '#22d3ee',
    accentColor: 0x22d3ee,
    secondaryColor: 0xf43f5e,
    skyColor: 0x0a0618,
    fogColor: 0x120b26,
    gantryColor: 0x22d3ee,
  },
];

export function getLevelForScore(score: number): LevelConfig {
  let current = LEVELS[0];
  for (const cfg of LEVELS) {
    if (score >= cfg.minScore) {
      current = cfg;
    }
  }
  return current;
}

export function getSpeedForScore(score: number): number {
  const lvl = getLevelForScore(score);
  const speedSteps = Math.floor(score / SPEEDUP_EVERY_POINTS);
  // Base speed scales smoothly with level AND gives a clear kick every 10 points
  const stepBonus = speedSteps * SPEEDUP_INCREMENT;
  return Math.min(82, LEVELS[0].baseSpeed + stepBonus + (lvl.level - 1) * 2.2);
}
