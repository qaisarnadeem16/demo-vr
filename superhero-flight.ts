export type RunStatus = "idle" | "playing" | "crashed";

export type HeroState = {
  x: number;
  y: number;
  z: number;
  targetX: number;
  velocityX: number;
};

export type GameStats = {
  distance: number;
  score: number;
  nearMissBonus: number;
};

export type ObstacleKind = "tower" | "split" | "narrow";

export type ObstacleSegment = {
  x: number;
  width: number;
  height: number;
  color: string;
};

export type ObstacleState = {
  id: number;
  kind: ObstacleKind;
  z: number;
  depth: number;
  segments: ObstacleSegment[];
  nearMissAwarded: boolean;
};

export const GAME_CONFIG = {
  heroY: 1.6,
  heroZ: -1.1,
  heroRadiusX: 0.62,
  heroRadiusZ: 0.8,
  lateralLimit: 6.4,
  baseSpeed: 18,
  maxSpeed: 34,
  difficultyRampSeconds: 70,
  steeringResponsiveness: 8.5,
  steeringVelocityDamping: 0.86,
  dragSensitivity: 0.015,
  obstaclePoolSize: 14,
  spawnStartZ: -34,
  recycleZ: 11,
  spawnGapMin: 11,
  spawnGapMax: 17,
  obstacleDepthMin: 3.8,
  obstacleDepthMax: 6.2,
  nearMissThreshold: 0.34,
  nearMissWindow: 2.8,
  nearMissPoints: 125,
  distanceScoreFactor: 10,
} as const;

export const SKY_CLOUDS = [
  {
    x: -11.5,
    y: 8.6,
    z: -16,
    scale: 1.1,
    puffs: [
      { x: -0.9, y: 0, z: 0, radius: 1.2 },
      { x: 0, y: 0.35, z: 0.2, radius: 1.45 },
      { x: 1.15, y: 0.05, z: -0.1, radius: 1.05 },
    ],
  },
  {
    x: 12.4,
    y: 10.3,
    z: -24,
    scale: 0.95,
    puffs: [
      { x: -1.1, y: -0.1, z: 0, radius: 1.05 },
      { x: 0, y: 0.25, z: 0.15, radius: 1.3 },
      { x: 1.05, y: 0.05, z: -0.1, radius: 0.95 },
    ],
  },
  {
    x: -13.2,
    y: 11.2,
    z: -36,
    scale: 1.25,
    puffs: [
      { x: -1.2, y: 0.05, z: 0.05, radius: 1.1 },
      { x: -0.1, y: 0.45, z: 0.2, radius: 1.55 },
      { x: 1.25, y: 0.1, z: -0.1, radius: 1.15 },
    ],
  },
  {
    x: 10.8,
    y: 8.9,
    z: -48,
    scale: 1,
    puffs: [
      { x: -0.95, y: 0, z: 0, radius: 1.05 },
      { x: 0, y: 0.4, z: 0.15, radius: 1.35 },
      { x: 1, y: 0.08, z: -0.1, radius: 1 },
    ],
  },
  {
    x: -12.8,
    y: 9.7,
    z: -62,
    scale: 0.9,
    puffs: [
      { x: -0.8, y: 0, z: 0, radius: 0.95 },
      { x: 0, y: 0.28, z: 0.12, radius: 1.2 },
      { x: 0.9, y: 0.02, z: -0.12, radius: 0.9 },
    ],
  },
  {
    x: 13.4,
    y: 10.8,
    z: -74,
    scale: 1.18,
    puffs: [
      { x: -1.05, y: -0.05, z: 0.02, radius: 1.12 },
      { x: 0, y: 0.38, z: 0.18, radius: 1.4 },
      { x: 1.15, y: 0.08, z: -0.08, radius: 1.02 },
    ],
  },
] as const;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

export function createInitialHeroState(): HeroState {
  return {
    x: 0,
    y: GAME_CONFIG.heroY,
    z: GAME_CONFIG.heroZ,
    targetX: 0,
    velocityX: 0,
  };
}

export function createInitialStats(): GameStats {
  return {
    distance: 0,
    score: 0,
    nearMissBonus: 0,
  };
}

export function getDifficulty(runTime: number) {
  return clamp(runTime / GAME_CONFIG.difficultyRampSeconds, 0, 1);
}

export function getSpeed(runTime: number) {
  return lerp(
    GAME_CONFIG.baseSpeed,
    GAME_CONFIG.maxSpeed,
    getDifficulty(runTime)
  );
}

export function getSpawnGap(difficulty: number) {
  return lerp(GAME_CONFIG.spawnGapMax, GAME_CONFIG.spawnGapMin, difficulty);
}

export function createObstacle(id: number, z: number, difficulty: number) {
  const laneHalfWidth = GAME_CONFIG.lateralLimit;
  const gapWidth = lerp(4.4, 2.35, difficulty);
  const patternRoll = Math.random();
  const depth = randomBetween(
    GAME_CONFIG.obstacleDepthMin,
    GAME_CONFIG.obstacleDepthMax
  );

  if (patternRoll < 0.34) {
    const width = randomBetween(1.8, 3.1);
    const x = randomBetween(-laneHalfWidth + width, laneHalfWidth - width);
    return {
      id,
      kind: "tower" as const,
      z,
      depth,
      nearMissAwarded: false,
      segments: [
        {
          x,
          width,
          height: randomBetween(5.2, 10.8),
          color: pickColor(),
        },
      ],
    };
  }

  const gapCenter = randomBetween(-1.8, 1.8);
  const leftEdge = -laneHalfWidth;
  const gapLeft = gapCenter - gapWidth / 2;
  const gapRight = gapCenter + gapWidth / 2;
  const rightEdge = laneHalfWidth;
  const leftWidth = Math.max(1.4, gapLeft - leftEdge);
  const rightWidth = Math.max(1.4, rightEdge - gapRight);
  const heightRange =
    patternRoll < 0.72
      ? { min: 7.2, max: 12.8, kind: "split" as const }
      : { min: 9.8, max: 15.5, kind: "narrow" as const };

  return {
    id,
    kind: heightRange.kind,
    z,
    depth,
    nearMissAwarded: false,
    segments: [
      {
        x: leftEdge + leftWidth / 2,
        width: leftWidth,
        height: randomBetween(heightRange.min, heightRange.max),
        color: pickColor(),
      },
      {
        x: gapRight + rightWidth / 2,
        width: rightWidth,
        height: randomBetween(heightRange.min, heightRange.max),
        color: pickColor(),
      },
    ],
  };
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function pickColor() {
  const palette = ["#91b7d8", "#adc8df", "#bfd7ea", "#ccdff0", "#d9e7f4"];
  return palette[Math.floor(Math.random() * palette.length)]!;
}
