"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  PANORAMA_SCENE,
  type PanoramaScene,
} from "@/lib/examples/three-sixty-tour";

type AFrameEntityElement = HTMLElement & {
  components?: {
    camera?: {
      camera?: {
        fov: number;
        updateProjectionMatrix: () => void;
      };
    };
  };
};

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

const PAN_STEP = 12;
const ZOOM_STEP = 8;
const MIN_PITCH = -75;
const MAX_PITCH = 75;
const MIN_FOV = 35;
const MAX_FOV = 110;

export function ThreeSixtyTour() {
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [yaw, setYaw] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [fov, setFov] = useState(80);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const titleId = useId();
  const viewerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    ensureAFrame()
      .then(() => {
        if (isMounted) {
          setIsSceneReady(true);
        }
      })
      .catch((error) => {
        console.error("Failed to initialize A-Frame", error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === viewerRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const viewerEl = viewerRef.current;
    if (!viewerEl) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      setFov((value) =>
        clamp(
          value + (event.deltaY > 0 ? ZOOM_STEP : -ZOOM_STEP),
          MIN_FOV,
          MAX_FOV
        )
      );
    };

    viewerEl.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      viewerEl.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const resetView = () => {
    setYaw(0);
    setPitch(0);
    setFov(80);
  };

  const toggleFullscreen = async () => {
    const viewerEl = viewerRef.current;
    if (!viewerEl) {
      return;
    }

    if (document.fullscreenElement === viewerEl) {
      await document.exitFullscreen();
      return;
    }

    await viewerEl.requestFullscreen();
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section
        aria-labelledby={titleId}
        className="relative min-h-screen overflow-hidden"
      >
        <div
          ref={viewerRef}
          className={`absolute inset-0 bg-slate-950 ${isFullscreen ? "h-screen max-h-screen" : ""}`}
        >
          {isSceneReady ? (
            <>
              <PanoramaSceneView
                scene={PANORAMA_SCENE}
                yaw={yaw}
                pitch={pitch}
                fov={fov}
              />

              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.76),rgba(2,6,23,0.1)_26%,rgba(2,6,23,0.08)_68%,rgba(2,6,23,0.8))]" />

              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
                <div className="flex items-start justify-between gap-6">
                  <div className="pointer-events-auto max-w-xl rounded-[1.75rem] border border-white/12 bg-slate-950/62 px-5 py-4 shadow-2xl backdrop-blur">
                    <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-300">
                      Example 1
                    </p>
                    <h1
                      id={titleId}
                      className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl"
                    >
                      Full-screen 360 panorama
                    </h1>
                    <p className="mt-3 text-sm leading-6 text-slate-200 sm:text-base">
                      Drag inside the panorama to look around, use the mouse
                      wheel to zoom, and open the control pad only when you need
                      it.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-300 sm:text-sm">
                      <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5">
                        {PANORAMA_SCENE.title}
                      </span>
                      <a
                        href={PANORAMA_SCENE.creditUrl}
                        className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 underline-offset-4 hover:underline"
                      >
                        {PANORAMA_SCENE.creditLabel}
                      </a>
                    </div>
                  </div>

                  <div className="pointer-events-auto flex items-center gap-3">
                    <Link
                      href="/examples"
                      className="rounded-full border border-white/15 bg-slate-950/72 px-4 py-3 text-sm font-semibold text-white shadow-xl backdrop-blur transition hover:bg-slate-900/90"
                    >
                      Back to examples
                    </Link>
                    <Link
                      href="/"
                      className="rounded-full border border-transparent bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-xl transition hover:bg-slate-100"
                    >
                      Home
                    </Link>
                    <IconButton
                      label={
                        isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                      }
                      onClick={() => {
                        void toggleFullscreen();
                      }}
                      active={isFullscreen}
                    >
                      <FullscreenIcon compressed={isFullscreen} />
                    </IconButton>
                  </div>
                </div>

                <div className="flex items-end justify-between gap-6">
                  <div className="pointer-events-auto max-w-md rounded-[1.4rem] border border-white/12 bg-slate-950/62 px-4 py-3 text-sm leading-6 text-slate-200 shadow-xl backdrop-blur">
                    Current image note: `pana.jpg` is 4948x3040, not a 2:1
                    equirectangular panorama, so the view will still look
                    pinched until we replace it with a proper 360 file.
                  </div>

                  <div className="pointer-events-auto flex flex-col items-end gap-3">
                    {controlsOpen ? (
                      <div className="grid grid-cols-3 gap-3 rounded-[1.6rem] border border-white/15 bg-slate-950/82 p-3 shadow-2xl backdrop-blur">
                        <div />
                        <IconButton
                          label="Move up"
                          onClick={() =>
                            setPitch((value) =>
                              clamp(value + PAN_STEP, MIN_PITCH, MAX_PITCH)
                            )
                          }
                        >
                          <ArrowIcon direction="up" />
                        </IconButton>
                        <div />

                        <IconButton
                          label="Move left"
                          onClick={() => setYaw((value) => value + PAN_STEP)}
                        >
                          <ArrowIcon direction="left" />
                        </IconButton>
                        <IconButton label="Reset view" onClick={resetView}>
                          Reset
                        </IconButton>
                        <IconButton
                          label="Move right"
                          onClick={() => setYaw((value) => value - PAN_STEP)}
                        >
                          <ArrowIcon direction="right" />
                        </IconButton>

                        <IconButton
                          label="Zoom in"
                          onClick={() =>
                            setFov((value) =>
                              clamp(value - ZOOM_STEP, MIN_FOV, MAX_FOV)
                            )
                          }
                        >
                          <ZoomIcon kind="in" />
                        </IconButton>
                        <IconButton
                          label="Move down"
                          onClick={() =>
                            setPitch((value) =>
                              clamp(value - PAN_STEP, MIN_PITCH, MAX_PITCH)
                            )
                          }
                        >
                          <ArrowIcon direction="down" />
                        </IconButton>
                        <IconButton
                          label="Zoom out"
                          onClick={() =>
                            setFov((value) =>
                              clamp(value + ZOOM_STEP, MIN_FOV, MAX_FOV)
                            )
                          }
                        >
                          <ZoomIcon kind="out" />
                        </IconButton>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      aria-expanded={controlsOpen}
                      aria-label={
                        controlsOpen ? "Close controls" : "Open controls"
                      }
                      onClick={() => setControlsOpen((value) => !value)}
                      className="flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/82 px-4 py-3 text-sm font-semibold text-white shadow-xl backdrop-blur transition hover:bg-slate-900/92"
                    >
                      <ControlPadIcon />
                      <span>
                        {controlsOpen ? "Hide controls" : "Open controls"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle,_rgba(34,211,238,0.18),_rgba(15,23,42,1)_68%)] px-6 text-center text-white">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-300">
                  Loading Scene
                </p>
                <p className="mt-3 text-lg text-slate-200">
                  Preparing the A-Frame viewer and panorama asset.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

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

function PanoramaSceneView({
  scene,
  yaw,
  pitch,
  fov,
}: {
  scene: PanoramaScene;
  yaw: number;
  pitch: number;
  fov: number;
}) {
  const rigRef = useRef<AFrameEntityElement | null>(null);
  const cameraRef = useRef<AFrameEntityElement | null>(null);

  useEffect(() => {
    const rigEl = rigRef.current;
    if (!rigEl) {
      return;
    }

    rigEl.setAttribute("rotation", `${pitch} ${yaw} 0`);
  }, [yaw, pitch]);

  useEffect(() => {
    const cameraEl = cameraRef.current;
    if (!cameraEl) {
      return;
    }

    const threeCamera = cameraEl.components?.camera?.camera;
    if (threeCamera) {
      threeCamera.fov = fov;
      threeCamera.updateProjectionMatrix();
    } else {
      cameraEl.setAttribute("camera", `fov: ${fov}`);
    }
  }, [fov]);

  return (
    <a-scene
      embedded
      vr-mode-ui="enabled: false"
      device-orientation-permission-ui="enabled: false"
      renderer="colorManagement: true"
      className="h-full w-full"
    >
      <a-assets timeout="15000">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          id="tour-panorama"
          crossOrigin="anonymous"
          src={scene.imageSrc}
          alt={scene.title}
        />
      </a-assets>

      <a-sky src="#tour-panorama" />

      <a-entity ref={rigRef} rotation={`${pitch} ${yaw} 0`}>
        <a-entity
          ref={cameraRef}
          camera={`fov: ${fov}`}
          look-controls="enabled: true; reverseMouseDrag: false; touchEnabled: true; mouseEnabled: true"
          position="0 0 0"
        />
      </a-entity>
    </a-scene>
  );
}

function IconButton({
  children,
  label,
  onClick,
  active = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex h-14 min-w-14 items-center justify-center rounded-2xl border text-sm font-semibold shadow-sm transition ${
        active
          ? "border-cyan-300 bg-cyan-50 text-slate-950"
          : "border-white/20 bg-white text-slate-950 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function ArrowIcon({
  direction,
}: {
  direction: "up" | "down" | "left" | "right";
}) {
  const rotationClass = {
    up: "rotate-0",
    right: "rotate-90",
    down: "rotate-180",
    left: "-rotate-90",
  }[direction];

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`h-5 w-5 ${rotationClass}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14" />
      <path d="M6 11l6-6 6 6" />
    </svg>
  );
}

function ZoomIcon({ kind }: { kind: "in" | "out" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.2-4.2" />
      <path d="M8.5 11h5" />
      {kind === "in" ? <path d="M11 8.5v5" /> : null}
    </svg>
  );
}

function FullscreenIcon({ compressed }: { compressed: boolean }) {
  return compressed ? (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 4H4v5" />
      <path d="M15 4h5v5" />
      <path d="M20 15v5h-5" />
      <path d="M4 15v5h5" />
      <path d="M9 9 4 4" />
      <path d="m15 9 5-5" />
      <path d="m15 15 5 5" />
      <path d="m9 15-5 5" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 4H4v5" />
      <path d="M15 4h5v5" />
      <path d="M20 15v5h-5" />
      <path d="M4 15v5h5" />
      <path d="M9 4 4 9" />
      <path d="m15 4 5 5" />
      <path d="m15 20 5-5" />
      <path d="m9 20-5-5" />
    </svg>
  );
}

function ControlPadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="4" width="6" height="6" rx="1.5" />
      <rect x="14" y="4" width="6" height="6" rx="1.5" />
      <rect x="4" y="14" width="6" height="6" rx="1.5" />
      <rect x="14" y="14" width="6" height="6" rx="1.5" />
    </svg>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
