"use client";

import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent,
  type RefObject,
} from "react";
import Link from "next/link";
import {
  clamp,
  createInitialHeroState,
  createInitialStats,
  createObstacle,
  GAME_CONFIG,
  getDifficulty,
  getSpawnGap,
  getSpeed,
  SKY_CLOUDS,
  type GameStats,
  type HeroState,
  type ObstacleState,
  type RunStatus,
} from "@/superhero-flight";

type DragState = {
  active: boolean;
  pointerId: number | null;
  startClientX: number;
  startTargetX: number;
};

type GameModel = {
  hero: HeroState;
  obstacles: ObstacleState[];
  stats: GameStats;
  runTime: number;
  nextSpawnZ: number;
  lastHudCommit: number;
};

type AFrameEl = HTMLElement;

const MARKER_COUNT = 8;

let aframeBootPromise: Promise<void> | null = null;

function ensureAFrame() {
  if (!aframeBootPromise) {
    aframeBootPromise = (async () => {
      await import("aframe");
      await import("aframe-extras");
    })();
  }

  return aframeBootPromise;
}

export function SuperheroFlightGame() {
  const [sceneReady, setSceneReady] = useState(false);
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [stats, setStats] = useState(createInitialStats());
  const [nearMissText, setNearMissText] = useState<string | null>(null);
  const [bestScore, setBestScore] = useState(0);
  const gameRef = useRef<GameModel>(createGameModel());
  const dragRef = useRef<DragState>({
    active: false,
    pointerId: null,
    startClientX: 0,
    startTargetX: 0,
  });
  const heroRef = useRef<AFrameEl | null>(null);
  const heroBodyRef = useRef<AFrameEl | null>(null);
  const capeMainRef = useRef<AFrameEl | null>(null);
  const capeLeftRef = useRef<AFrameEl | null>(null);
  const capeRightRef = useRef<AFrameEl | null>(null);
  const cameraRigRef = useRef<AFrameEl | null>(null);
  const markerRefs = useRef<Array<AFrameEl | null>>([]);
  const cloudRefs = useRef<Array<AFrameEl | null>>([]);
  const obstacleRefs = useRef<Array<AFrameEl | null>>([]);
  const obstacleSegmentRefs = useRef<Array<Array<AFrameEl | null>>>([]);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);
  const nearMissTimeoutRef = useRef<number | null>(null);

  const markerPositions = useMemo(
    () => Array.from({ length: MARKER_COUNT }, (_, index) => -8 - index * 12),
    []
  );

  function showNearMiss() {
    setNearMissText(`Near miss +${GAME_CONFIG.nearMissPoints}`);

    if (nearMissTimeoutRef.current) {
      window.clearTimeout(nearMissTimeoutRef.current);
    }

    nearMissTimeoutRef.current = window.setTimeout(() => {
      setNearMissText(null);
    }, 700);
  }

  function syncHero(hero: HeroState) {
    if (!heroRef.current) {
      return;
    }

    heroRef.current.setAttribute(
      "position",
      `${hero.x.toFixed(3)} ${hero.y.toFixed(3)} ${hero.z.toFixed(3)}`
    );
    heroRef.current.setAttribute(
      "rotation",
      `${(-hero.velocityX * 0.45).toFixed(2)} 0 ${(-hero.velocityX * 0.65).toFixed(2)}`
    );

    if (heroBodyRef.current) {
      heroBodyRef.current.setAttribute(
        "rotation",
        `${(-90 + hero.velocityX * 0.55).toFixed(2)} 0 0`
      );
    }

    const runTime = gameRef.current.runTime;
    const flutter = Math.sin(runTime * 11) * 7;
    const flutterSide = Math.cos(runTime * 8.5) * 6;
    const windLift = 10 + Math.abs(Math.sin(runTime * 6.5)) * 8;
    const capeWave = clamp(hero.velocityX * -0.9, -7, 7);

    if (capeMainRef.current) {
      capeMainRef.current.setAttribute(
        "rotation",
        `${132 + windLift + flutter * 0.5} ${capeWave * 0.2} ${flutterSide * 0.12}`
      );
    }

    if (capeLeftRef.current) {
      capeLeftRef.current.setAttribute(
        "rotation",
        `${126 + windLift * 0.9 + flutter * 0.7} ${16 + capeWave * 0.45 + flutterSide * 0.4} 8`
      );
    }

    if (capeRightRef.current) {
      capeRightRef.current.setAttribute(
        "rotation",
        `${126 + windLift * 0.9 + flutter * 0.7} ${-16 + capeWave * 0.45 - flutterSide * 0.4} -8`
      );
    }
  }

  function syncCamera(hero: HeroState) {
    if (!cameraRigRef.current) {
      return;
    }

    const cameraX = hero.x * 0.42;
    const yaw = clamp(hero.velocityX * -0.32, -8.5, 8.5);

    cameraRigRef.current.setAttribute(
      "position",
      `${cameraX.toFixed(3)} 2.75 7.1`
    );
    cameraRigRef.current.setAttribute("rotation", `-6.5 ${yaw.toFixed(2)} 0`);
  }

  function syncMarkers(speed: number) {
    for (let index = 0; index < markerRefs.current.length; index += 1) {
      const markerRef = markerRefs.current[index];
      if (!markerRef) {
        continue;
      }

      const zBase = markerPositions[index] ?? -8;
      const scrollOffset =
        ((gameRef.current.stats.distance * 1.7 + index * 3) % 12) - 12;

      markerRef.setAttribute(
        "position",
        `0 0.03 ${(zBase + scrollOffset).toFixed(3)}`
      );
      markerRef.setAttribute(
        "material",
        `color: #f8fafc; opacity: ${Math.min(0.52, 0.18 + speed * 0.008).toFixed(2)}; transparent: true`
      );
    }
  }

  function syncObstacles(obstacles: ObstacleState[]) {
    for (let index = 0; index < obstacles.length; index += 1) {
      const obstacle = obstacles[index];
      const obstacleRef = obstacleRefs.current[index];
      const segmentRefs = obstacleSegmentRefs.current[index] ?? [];

      if (!obstacleRef) {
        continue;
      }

      obstacleRef.setAttribute("position", `0 0 ${obstacle.z.toFixed(3)}`);

      for (let segmentIndex = 0; segmentIndex < 2; segmentIndex += 1) {
        const segmentRef = segmentRefs[segmentIndex];
        const segment = obstacle.segments[segmentIndex];

        if (!segmentRef) {
          continue;
        }

        if (!segment) {
          segmentRef.setAttribute("visible", "false");
          continue;
        }

        segmentRef.setAttribute("visible", "true");
        segmentRef.setAttribute(
          "position",
          `${segment.x.toFixed(3)} ${(segment.height / 2).toFixed(3)} 0`
        );
        segmentRef.setAttribute(
          "geometry",
          `primitive: box; width: ${segment.width.toFixed(3)}; height: ${segment.height.toFixed(3)}; depth: ${obstacle.depth.toFixed(3)}`
        );
        segmentRef.setAttribute(
          "material",
          `color: ${segment.color}; metalness: 0.05; roughness: 0.88`
        );
      }
    }
  }

  function syncWorld(game: GameModel, speed: number) {
    syncHero(game.hero);
    syncCamera(game.hero);
    syncMarkers(speed);
    syncClouds(game.stats.distance);
    syncObstacles(game.obstacles);
  }

  function syncClouds(distance: number) {
    for (let index = 0; index < cloudRefs.current.length; index += 1) {
      const cloudRef = cloudRefs.current[index];
      const cloud = SKY_CLOUDS[index];
      if (!cloudRef || !cloud) {
        continue;
      }

      const drift = Math.sin(distance * 0.018 + index * 0.9) * 0.55;
      const bob = Math.cos(distance * 0.012 + index * 0.7) * 0.22;

      cloudRef.setAttribute(
        "position",
        `${(cloud.x + drift).toFixed(3)} ${(cloud.y + bob).toFixed(3)} ${cloud.z}`
      );
    }
  }

  const syncWorldEvent = useEffectEvent((game: GameModel, speed: number) => {
    syncWorld(game, speed);
  });

  function resetGame(status: RunStatus) {
    const nextGame = createGameModel();
    gameRef.current = nextGame;
    dragRef.current = {
      active: false,
      pointerId: null,
      startClientX: 0,
      startTargetX: 0,
    };

    setStats(createInitialStats());
    setNearMissText(null);
    setRunStatus(status);
    syncWorld(nextGame, GAME_CONFIG.baseSpeed);
  }

  const advanceGame = useEffectEvent(
    (deltaSeconds: number, timestamp: number) => {
      const game = gameRef.current;
      const runTime = game.runTime + deltaSeconds;
      const difficulty = getDifficulty(runTime);
      const speed = getSpeed(runTime);
      const hero = { ...game.hero };
      const stats = { ...game.stats };
      let nextSpawnZ = game.nextSpawnZ;
      let crashed = false;

      const previousHeroX = hero.x;

      hero.x =
        hero.x +
        (hero.targetX - hero.x) *
          Math.min(1, deltaSeconds * GAME_CONFIG.steeringResponsiveness);
      hero.velocityX = (hero.x - previousHeroX) / Math.max(deltaSeconds, 0.001);
      hero.velocityX *= GAME_CONFIG.steeringVelocityDamping;

      stats.distance += speed * deltaSeconds;
      stats.score =
        Math.round(stats.distance * GAME_CONFIG.distanceScoreFactor) +
        stats.nearMissBonus;

      const obstacles = game.obstacles.map((obstacle) => {
        let nextObstacle = {
          ...obstacle,
          z: obstacle.z + speed * deltaSeconds,
        };

        const overlap =
          Math.abs(nextObstacle.z - GAME_CONFIG.heroZ) <
          nextObstacle.depth / 2 + GAME_CONFIG.heroRadiusZ;

        if (overlap) {
          if (checkCollision(hero.x, nextObstacle)) {
            crashed = true;
            return nextObstacle;
          }

          if (!nextObstacle.nearMissAwarded) {
            const clearance = getNearMissClearance(hero.x, nextObstacle);
            if (
              clearance !== null &&
              clearance < GAME_CONFIG.nearMissThreshold &&
              Math.abs(nextObstacle.z - GAME_CONFIG.heroZ) <
                GAME_CONFIG.nearMissWindow
            ) {
              nextObstacle = {
                ...nextObstacle,
                nearMissAwarded: true,
              };
              stats.nearMissBonus += GAME_CONFIG.nearMissPoints;
              stats.score += GAME_CONFIG.nearMissPoints;
              showNearMiss();
            }
          }
        }

        if (nextObstacle.z > GAME_CONFIG.recycleZ) {
          nextSpawnZ -= getSpawnGap(difficulty);
          return createObstacle(nextObstacle.id, nextSpawnZ, difficulty);
        }

        return nextObstacle;
      });

      const nextGame: GameModel = {
        hero,
        obstacles,
        stats,
        runTime,
        nextSpawnZ,
        lastHudCommit: game.lastHudCommit,
      };

      gameRef.current = nextGame;

      if (crashed) {
        syncWorld(nextGame, speed);
        setStats({
          distance: Math.round(stats.distance),
          score: stats.score,
          nearMissBonus: stats.nearMissBonus,
        });
        setBestScore((current) => Math.max(current, stats.score));
        setRunStatus("crashed");
        return;
      }

      syncWorld(nextGame, speed);

      if (timestamp - nextGame.lastHudCommit > 60) {
        gameRef.current = {
          ...nextGame,
          lastHudCommit: timestamp,
        };
        setStats({
          distance: Math.round(stats.distance),
          score: stats.score,
          nearMissBonus: stats.nearMissBonus,
        });
      }
    }
  );

  useEffect(() => {
    let mounted = true;

    ensureAFrame()
      .then(() => {
        if (mounted) {
          setSceneReady(true);
        }
      })
      .catch((error) => {
        console.error("Failed to initialize A-Frame", error);
      });

    return () => {
      mounted = false;
      if (nearMissTimeoutRef.current) {
        window.clearTimeout(nearMissTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!sceneReady) {
      return;
    }

    const nextGame = createGameModel();
    gameRef.current = nextGame;
    dragRef.current = {
      active: false,
      pointerId: null,
      startClientX: 0,
      startTargetX: 0,
    };
    syncWorldEvent(nextGame, GAME_CONFIG.baseSpeed);
  }, [sceneReady]);

  useEffect(() => {
    if (!sceneReady || runStatus !== "playing") {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastFrameRef.current = null;
      return;
    }

    const tick = (timestamp: number) => {
      const previous = lastFrameRef.current ?? timestamp;
      lastFrameRef.current = timestamp;
      const deltaSeconds = Math.min((timestamp - previous) / 1000, 0.032);

      advanceGame(deltaSeconds, timestamp);
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastFrameRef.current = null;
    };
  }, [runStatus, sceneReady]);

  function startRun() {
    resetGame("playing");
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (runStatus !== "playing") {
      return;
    }

    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startTargetX: gameRef.current.hero.targetX,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active || runStatus !== "playing") {
      return;
    }

    const deltaX = event.clientX - dragRef.current.startClientX;
    gameRef.current.hero.targetX = clamp(
      dragRef.current.startTargetX + deltaX * GAME_CONFIG.dragSensitivity,
      -GAME_CONFIG.lateralLimit,
      GAME_CONFIG.lateralLimit
    );
  }

  function stopDrag(pointerId: number) {
    if (dragRef.current.pointerId !== pointerId) {
      return;
    }

    dragRef.current.active = false;
    dragRef.current.pointerId = null;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-950">
      <div className="relative h-screen w-full overflow-hidden bg-[linear-gradient(180deg,_#c9f2ff_0%,_#dbebff_48%,_#edf6ff_100%)]">
        {sceneReady ? (
          <>
            <div
              className="absolute inset-0 z-10 touch-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={(event) => stopDrag(event.pointerId)}
              onPointerCancel={(event) => stopDrag(event.pointerId)}
            />

            <AFrameScene
              heroRef={heroRef}
              heroBodyRef={heroBodyRef}
              capeMainRef={capeMainRef}
              capeLeftRef={capeLeftRef}
              capeRightRef={capeRightRef}
              cameraRigRef={cameraRigRef}
              markerRefs={markerRefs}
              cloudRefs={cloudRefs}
              obstacleRefs={obstacleRefs}
              obstacleSegmentRefs={obstacleSegmentRefs}
              markerPositions={markerPositions}
            />

            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 sm:p-5">
              <div className="mx-auto flex w-full max-w-7xl items-start justify-between gap-3">
                <div className="pointer-events-auto max-w-xl rounded-[1.5rem] border border-white/45 bg-slate-950/58 px-4 py-3 text-white shadow-xl backdrop-blur-md sm:px-5">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-sky-300">
                    Example 2
                  </p>
                  <h1 className="mt-2 text-xl font-semibold sm:text-2xl">
                    Superhero Flight
                  </h1>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-slate-200 sm:text-base">
                    Drag left and right to steer, dodge buildings, and earn
                    bonus points for close near-miss passes.
                  </p>
                </div>

                <div className="pointer-events-auto flex flex-col items-end gap-3">
                  <div className="rounded-[1.5rem] border border-white/45 bg-slate-950/58 px-4 py-3 text-white shadow-xl backdrop-blur-md sm:px-5">
                    <div className="flex flex-wrap items-center gap-5">
                      <HudStat
                        label="Score"
                        value={stats.score.toLocaleString()}
                      />
                      <HudStat label="Distance" value={`${stats.distance} m`} />
                      <HudStat
                        label="Best"
                        value={bestScore.toLocaleString()}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Link
                      href="/examples"
                      className="rounded-full border border-white/45 bg-white/85 px-4 py-2 text-slate-800 shadow-lg transition hover:bg-white"
                    >
                      Examples
                    </Link>
                    <Link
                      href="/"
                      className="rounded-full bg-slate-950/80 px-4 py-2 text-white shadow-lg transition hover:bg-slate-900"
                    >
                      Home
                    </Link>
                  </div>

                  <p className="rounded-full border border-white/35 bg-slate-950/52 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-sky-300 shadow-lg backdrop-blur-md">
                    {runStatus === "playing"
                      ? "Run live"
                      : runStatus === "crashed"
                        ? "Crash detected"
                        : "Ready to launch"}
                  </p>
                </div>
              </div>
            </div>

            {nearMissText ? (
              <div className="pointer-events-none absolute right-4 top-36 z-20 rounded-full border border-amber-200 bg-amber-50/95 px-4 py-2 text-sm font-semibold text-amber-700 shadow-lg backdrop-blur sm:right-6 sm:top-40">
                {nearMissText}
              </div>
            ) : null}

            {runStatus !== "playing" ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/28 px-4">
                <div className="w-full max-w-md rounded-[1.75rem] border border-white/30 bg-white/88 p-6 text-center shadow-2xl backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
                    {runStatus === "crashed" ? "Run over" : "Endless runner"}
                  </p>
                  <h2 className="mt-4 text-3xl font-semibold text-slate-950">
                    {runStatus === "crashed"
                      ? "Thread the next gap."
                      : "Launch the hero into the skyline."}
                  </h2>
                  <p className="mt-4 text-base leading-7 text-slate-700">
                    {runStatus === "crashed"
                      ? `You reached ${stats.distance} meters with ${stats.score.toLocaleString()} points.`
                      : "The canvas is now full-screen. Drag anywhere on the scene to steer and stay alive as the city speeds up."}
                  </p>
                  <button
                    type="button"
                    onClick={startRun}
                    className="mt-6 rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    {runStatus === "crashed" ? "Restart run" : "Start flying"}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-4 sm:p-5">
              <div className="mx-auto flex w-full max-w-7xl items-end justify-between gap-3">
                <div className="rounded-full border border-white/45 bg-white/75 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-700 backdrop-blur-md">
                  Drag left and right to steer
                </div>
                <div className="hidden rounded-full border border-white/35 bg-slate-950/55 px-4 py-2 text-xs font-medium text-slate-100 backdrop-blur-md sm:block">
                  Endless runner mode with near-miss bonuses
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle,_rgba(186,230,253,0.9),_rgba(15,23,42,0.94)_74%)] px-6 text-center text-white">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-300">
                Loading Scene
              </p>
              <p className="mt-3 text-lg text-slate-100">
                Building the hero, skyline, and obstacle stream.
              </p>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .a-enter-vr,
        .a-enter-ar,
        .a-orientation-modal {
          display: none !important;
        }
      `}</style>
    </main>
  );
}

function AFrameScene({
  heroRef,
  heroBodyRef,
  capeMainRef,
  capeLeftRef,
  capeRightRef,
  cameraRigRef,
  markerRefs,
  cloudRefs,
  obstacleRefs,
  obstacleSegmentRefs,
  markerPositions,
}: {
  heroRef: RefObject<AFrameEl | null>;
  heroBodyRef: RefObject<AFrameEl | null>;
  capeMainRef: RefObject<AFrameEl | null>;
  capeLeftRef: RefObject<AFrameEl | null>;
  capeRightRef: RefObject<AFrameEl | null>;
  cameraRigRef: RefObject<AFrameEl | null>;
  markerRefs: MutableRefObject<Array<AFrameEl | null>>;
  cloudRefs: MutableRefObject<Array<AFrameEl | null>>;
  obstacleRefs: MutableRefObject<Array<AFrameEl | null>>;
  obstacleSegmentRefs: MutableRefObject<Array<Array<AFrameEl | null>>>;
  markerPositions: number[];
}) {
  return (
    <a-scene
      embedded
      vr-mode-ui="enabled: false"
      device-orientation-permission-ui="enabled: false"
      renderer="colorManagement: true; antialias: true"
      className="h-full w-full"
    >
      <a-entity light="type: ambient; intensity: 0.9; color: #ffffff" />
      <a-entity
        light="type: directional; intensity: 1.1; color: #fff8ef"
        position="-3 11 6"
      />

      <a-entity
        geometry="primitive: plane; width: 64; height: 160"
        material="color: #d8f0ff"
        rotation="-90 0 0"
        position="0 0 -48"
      />
      <a-entity
        geometry="primitive: plane; width: 15; height: 160"
        material="color: #91d4e5"
        rotation="-90 0 0"
        position="0 0.01 -48"
      />

      {markerPositions.map((z, index) => (
        <a-entity
          key={`marker-${index}`}
          ref={(element) => {
            markerRefs.current[index] = element;
          }}
          geometry="primitive: plane; width: 0.5; height: 4.8"
          material="color: #f8fafc; opacity: 0.25; transparent: true"
          rotation="-90 0 0"
          position={`0 0.03 ${z}`}
        />
      ))}

      {SKY_CLOUDS.map((cloud, index) => (
        <a-entity
          key={`cloud-${index}`}
          ref={(element) => {
            cloudRefs.current[index] = element;
          }}
          position={`${cloud.x} ${cloud.y} ${cloud.z}`}
          scale={`${cloud.scale} ${cloud.scale} ${cloud.scale}`}
        >
          {cloud.puffs.map((puff, puffIndex) => (
            <a-entity
              key={`puff-${index}-${puffIndex}`}
              geometry={`primitive: sphere; radius: ${puff.radius}`}
              material="color: #ffffff; opacity: 0.82; transparent: true; roughness: 1"
              position={`${puff.x} ${puff.y} ${puff.z}`}
              scale="1 0.68 0.84"
            />
          ))}
        </a-entity>
      ))}

      <a-entity
        ref={heroRef}
        position={`0 ${GAME_CONFIG.heroY} ${GAME_CONFIG.heroZ}`}
        scale="1.12 1.12 1.12"
      >
        <a-entity ref={heroBodyRef} rotation="-90 0 0">
          <a-entity
            geometry="primitive: sphere; radius: 0.21"
            material="color: #f8c9a7"
            position="0 1.2 -0.04"
            scale="0.94 1 0.98"
          />
          <a-entity
            geometry="primitive: sphere; radius: 0.24"
            material="color: #2c59a8"
            position="0 1.18 -0.2"
            scale="0.96 1.08 0.92"
          />
          <a-entity
            geometry="primitive: cone; radiusBottom: 0.17; radiusTop: 0.04; height: 0.22"
            material="color: #171717"
            position="0 1.34 -0.13"
            rotation="0 0 180"
          />
          <a-entity
            geometry="primitive: box; width: 0.38; height: 0.92; depth: 1.14"
            material="color: #2c69c8"
            position="0 0.18 0"
          />
          <a-entity
            geometry="primitive: box; width: 0.68; height: 0.2; depth: 0.42"
            material="color: #2c69c8"
            position="0 0.5 -0.02"
          />
          <a-entity
            geometry="primitive: sphere; radius: 0.15"
            material="color: #2c69c8"
            position="0 -0.26 -0.03"
            scale="1.1 0.9 0.94"
          />
          <a-entity
            geometry="primitive: box; width: 0.11; height: 0.74; depth: 0.14"
            material="color: #f7c84d"
            position="0 0.15 0.58"
          />
          <a-entity
            geometry="primitive: plane; width: 0.16; height: 0.2"
            material="color: #ffdd57; side: double"
            position="0 0.3 0.6"
          />
          <a-entity
            geometry="primitive: box; width: 0.14; height: 0.18; depth: 0.18"
            material="color: #2c69c8"
            position="-0.18 -0.3 -0.02"
            rotation="0 0 20"
          />
          <a-entity
            geometry="primitive: box; width: 0.14; height: 0.18; depth: 0.18"
            material="color: #2c69c8"
            position="0.18 -0.3 -0.02"
            rotation="0 0 -20"
          />
          <a-entity
            geometry="primitive: box; width: 0.14; height: 1.18; depth: 0.16"
            material="color: #ff745f"
            position="-0.34 0.46 -0.02"
            rotation="-62 0 92"
          />
          <a-entity
            geometry="primitive: sphere; radius: 0.085"
            material="color: #f8c9a7"
            position="-0.74 0.93 0.02"
            scale="0.95 1.1 0.82"
          />
          <a-entity
            geometry="primitive: box; width: 0.14; height: 1.18; depth: 0.16"
            material="color: #ff745f"
            position="0.34 0.46 -0.02"
            rotation="-62 0 -92"
          />
          <a-entity
            geometry="primitive: sphere; radius: 0.085"
            material="color: #f8c9a7"
            position="0.74 0.93 0.02"
            scale="0.95 1.1 0.82"
          />
          <a-entity
            geometry="primitive: box; width: 0.16; height: 0.92; depth: 0.18"
            material="color: #2c69c8"
            position="-0.1 -0.82 -0.18"
            rotation="6 0 2"
          />
          <a-entity
            geometry="primitive: box; width: 0.16; height: 0.92; depth: 0.18"
            material="color: #2c69c8"
            position="0.1 -0.82 -0.18"
            rotation="6 0 -2"
          />
          <a-entity
            geometry="primitive: box; width: 0.16; height: 0.22; depth: 0.36"
            material="color: #c2312d"
            position="-0.1 -1.34 -0.36"
          />
          <a-entity
            geometry="primitive: box; width: 0.16; height: 0.22; depth: 0.36"
            material="color: #c2312d"
            position="0.1 -1.34 -0.36"
          />
          <a-entity
            ref={capeMainRef}
            geometry="primitive: plane; width: 0.72; height: 1.44"
            material="color: #cf2f3f; side: double; opacity: 0.96; transparent: true"
            position="0 -0.54 0.34"
            rotation="140 0 0"
          />
          <a-entity
            ref={capeLeftRef}
            geometry="primitive: plane; width: 0.54; height: 1.16"
            material="color: #e04351; side: double; opacity: 0.9; transparent: true"
            position="0.18 -0.58 0.28"
            rotation="134 16 8"
          />
          <a-entity
            ref={capeRightRef}
            geometry="primitive: plane; width: 0.54; height: 1.16"
            material="color: #e04351; side: double; opacity: 0.9; transparent: true"
            position="-0.18 -0.58 0.28"
            rotation="134 -16 -8"
          />
        </a-entity>
      </a-entity>

      {Array.from({ length: GAME_CONFIG.obstaclePoolSize }, (_, index) => (
        <a-entity
          key={`obstacle-${index}`}
          ref={(element) => {
            obstacleRefs.current[index] = element;
          }}
          position={`0 0 ${GAME_CONFIG.spawnStartZ - index * 12}`}
        >
          {Array.from({ length: 2 }, (_, segmentIndex) => (
            <a-entity
              key={`segment-${index}-${segmentIndex}`}
              ref={(element) => {
                obstacleSegmentRefs.current[index] ??= [];
                obstacleSegmentRefs.current[index]![segmentIndex] = element;
              }}
            />
          ))}
        </a-entity>
      ))}

      <a-entity ref={cameraRigRef} position="0 2.75 7.1" rotation="-6.5 0 0">
        <a-entity camera="active: true" />
      </a-entity>
    </a-scene>
  );
}

function HudStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-sky-300">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function createGameModel(): GameModel {
  const obstacles: ObstacleState[] = [];
  let nextSpawnZ = GAME_CONFIG.spawnStartZ;

  for (let index = 0; index < GAME_CONFIG.obstaclePoolSize; index += 1) {
    obstacles.push(createObstacle(index, nextSpawnZ, 0));
    nextSpawnZ -= getSpawnGap(0);
  }

  return {
    hero: createInitialHeroState(),
    obstacles,
    stats: createInitialStats(),
    runTime: 0,
    nextSpawnZ,
    lastHudCommit: 0,
  };
}

function checkCollision(heroX: number, obstacle: ObstacleState) {
  const heroLeft = heroX - GAME_CONFIG.heroRadiusX;
  const heroRight = heroX + GAME_CONFIG.heroRadiusX;

  return obstacle.segments.some((segment) => {
    const left = segment.x - segment.width / 2;
    const right = segment.x + segment.width / 2;

    return heroRight > left && heroLeft < right;
  });
}

function getNearMissClearance(heroX: number, obstacle: ObstacleState) {
  const heroLeft = heroX - GAME_CONFIG.heroRadiusX;
  const heroRight = heroX + GAME_CONFIG.heroRadiusX;
  let closest: number | null = null;

  for (const segment of obstacle.segments) {
    const left = segment.x - segment.width / 2;
    const right = segment.x + segment.width / 2;

    if (heroRight > left && heroLeft < right) {
      return null;
    }

    const clearance =
      heroRight <= left
        ? left - heroRight
        : heroLeft >= right
          ? heroLeft - right
          : null;

    if (clearance !== null) {
      closest = closest === null ? clearance : Math.min(closest, clearance);
    }
  }

  return closest;
}
