"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type React from "react";
import Link from "next/link";

type PaletteOption = {
  id: string;
  name: string;
  jerseyColor: string;
  accentColor: string;
  description: string;
};

type ColorChannel = {
  set: (value: string) => void;
};

type GLTFMaterial = {
  clone?: () => GLTFMaterial;
  color?: ColorChannel;
  emissive?: ColorChannel;
  metalness?: number;
  roughness?: number;
  needsUpdate?: boolean;
};

type GLTFNode = {
  isMesh?: boolean;
  material?: GLTFMaterial | GLTFMaterial[];
  traverse?: (callback: (child: GLTFNode) => void) => void;
};

type AFrameModelElement = HTMLElement & {
  getObject3D?: (name: string) => GLTFNode | undefined;
};

type AFrameCameraElement = HTMLElement & {
  components?: {
    camera?: {
      camera?: {
        fov: number;
        updateProjectionMatrix: () => void;
      };
    };
  };
};

const MODEL_SRC = "/examples/models/Jersey.glb";
const CUSTOM_PALETTE_ID = "custom";
const PAN_STEP = 12;
const ZOOM_STEP = 4;
const MIN_PITCH = -28;
const MAX_PITCH = 22;
const MIN_FOV = 36;
const MAX_FOV = 82;

const PALETTE_OPTIONS: PaletteOption[] = [
  {
    id: "obsidian",
    name: "Black",
    jerseyColor: "#151922",
    accentColor: "#7dd3fc",
    description: "Cool cyan glow.",
  },
  {
    id: "crimson",
    name: "Crimson",
    jerseyColor: "#9f1239",
    accentColor: "#fda4af",
    description: "Warm campaign red.",
  },
  {
    id: "royal",
    name: "Royal",
    jerseyColor: "#1d4ed8",
    accentColor: "#93c5fd",
    description: "Sport-tech blue.",
  },
  {
    id: "emerald",
    name: "Emerald",
    jerseyColor: "#047857",
    accentColor: "#6ee7b7",
    description: "Deep green glow.",
  },
];

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

export function JerseySpotlight() {
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const [selectedPaletteId, setSelectedPaletteId] = useState(
    PALETTE_OPTIONS[0].id
  );
  const [customColor, setCustomColor] = useState("#7a90ff");
  const [spinEnabled, setSpinEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [yaw, setYaw] = useState(0);
  const [pitch, setPitch] = useState(-4);
  const [fov, setFov] = useState(56);
  const [controlsOpen, setControlsOpen] = useState(true);
  const titleId = useId();
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const dragActiveRef = useRef(false);
  const dragPointerRef = useRef<{ x: number; y: number } | null>(null);
  const modelRef = useRef<AFrameModelElement | null>(null);
  const materialRefs = useRef<GLTFMaterial[]>([]);
  const hasPreparedMaterialsRef = useRef(false);

  const selectedPalette = useMemo(() => {
    const presetPalette =
      PALETTE_OPTIONS.find((option) => option.id === selectedPaletteId) ??
      PALETTE_OPTIONS[0];

    if (selectedPaletteId === CUSTOM_PALETTE_ID) {
      return {
        id: CUSTOM_PALETTE_ID,
        name: "Custom",
        jerseyColor: customColor,
        accentColor: customColor,
        description: "Manual color.",
      };
    }

    return presetPalette;
  }, [customColor, selectedPaletteId]);

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

    const isInteractiveTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return Boolean(target.closest("button, input, a, label"));
    };

    const handleWheel = (event: WheelEvent) => {
      if (isInteractiveTarget(event.target)) {
        return;
      }

      event.preventDefault();
      setFov((value) =>
        clamp(
          value + (event.deltaY > 0 ? ZOOM_STEP : -ZOOM_STEP),
          MIN_FOV,
          MAX_FOV
        )
      );
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || isInteractiveTarget(event.target)) {
        return;
      }

      dragActiveRef.current = true;
      dragPointerRef.current = { x: event.clientX, y: event.clientY };
      viewerEl.setPointerCapture?.(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragActiveRef.current || !dragPointerRef.current) {
        return;
      }

      const deltaX = event.clientX - dragPointerRef.current.x;
      const deltaY = event.clientY - dragPointerRef.current.y;
      dragPointerRef.current = { x: event.clientX, y: event.clientY };

      setYaw((value) => value + deltaX * 0.18);
      setPitch((value) => clamp(value - deltaY * 0.12, MIN_PITCH, MAX_PITCH));
    };

    const releaseDrag = (event?: PointerEvent) => {
      dragActiveRef.current = false;
      dragPointerRef.current = null;

      if (event) {
        viewerEl.releasePointerCapture?.(event.pointerId);
      }
    };

    viewerEl.addEventListener("wheel", handleWheel, { passive: false });
    viewerEl.addEventListener("pointerdown", handlePointerDown);
    viewerEl.addEventListener("pointermove", handlePointerMove);
    viewerEl.addEventListener("pointerup", releaseDrag);
    viewerEl.addEventListener("pointercancel", releaseDrag);
    viewerEl.addEventListener("pointerleave", releaseDrag);

    return () => {
      viewerEl.removeEventListener("wheel", handleWheel);
      viewerEl.removeEventListener("pointerdown", handlePointerDown);
      viewerEl.removeEventListener("pointermove", handlePointerMove);
      viewerEl.removeEventListener("pointerup", releaseDrag);
      viewerEl.removeEventListener("pointercancel", releaseDrag);
      viewerEl.removeEventListener("pointerleave", releaseDrag);
    };
  }, []);

  useEffect(() => {
    if (!isSceneReady) {
      return;
    }

    const modelEl = modelRef.current;
    if (!modelEl) {
      return;
    }

    const syncModel = () => {
      const materials = prepareMaterials(modelEl, hasPreparedMaterialsRef);
      if (materials.length > 0) {
        materialRefs.current = materials;
        setIsModelReady(true);
        applyPalette(materials, selectedPalette);
      }
    };

    modelEl.addEventListener("model-loaded", syncModel as EventListener);
    modelEl.addEventListener("object3dset", syncModel as EventListener);
    syncModel();

    return () => {
      modelEl.removeEventListener("model-loaded", syncModel as EventListener);
      modelEl.removeEventListener("object3dset", syncModel as EventListener);
    };
  }, [isSceneReady, selectedPalette]);

  useEffect(() => {
    if (materialRefs.current.length === 0) {
      return;
    }

    applyPalette(materialRefs.current, selectedPalette);
  }, [selectedPalette]);

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

  const resetView = () => {
    setYaw(0);
    setPitch(-4);
    setFov(56);
  };

  return (
    <main className="bg-[radial-gradient(circle_at_top,_#0f172a_0%,_#020617_48%,_#000000_100%)] p-0 text-white">
      <section
        aria-labelledby={titleId}
        className="relative h-screen w-screen overflow-hidden"
      >
        <div
          ref={viewerRef}
          className={`relative h-full w-full bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_rgba(2,6,23,0.82)_38%,_rgba(0,0,0,1))] ${
            isFullscreen ? "h-screen max-h-screen" : ""
          }`}
        >
          {isSceneReady ? (
            <>
              <ShowroomScene
                modelRef={modelRef}
                palette={selectedPalette}
                spinEnabled={spinEnabled}
                yaw={yaw}
                pitch={pitch}
                fov={fov}
              />

              <div className="pointer-events-none absolute inset-0">
                <div className="pointer-events-auto absolute left-4 top-4 flex max-w-[calc(100vw-8rem)] items-start gap-3">
                  <div className="rounded-[1.35rem] border border-white/10 bg-slate-950/42 px-4 py-3 shadow-2xl backdrop-blur">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-sky-300">
                      Example 3
                    </p>
                    <h1
                      id={titleId}
                      className="mt-1 text-2xl font-semibold text-white sm:text-3xl"
                    >
                      Jersey Spotlight
                    </h1>
                    <p className="mt-2 text-sm text-slate-200">
                      Drag to orbit. Scroll to zoom.
                    </p>
                  </div>
                </div>

                <div className="pointer-events-auto absolute right-4 top-4 flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/42 px-2 py-2 shadow-xl backdrop-blur">
                  <Link
                    href="/examples"
                    className="rounded-full border border-white/10 bg-white/6 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
                  >
                    Examples
                  </Link>
                  <Link
                    href="/"
                    className="rounded-full border border-white/10 bg-white px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-slate-200"
                  >
                    Home
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      void toggleFullscreen();
                    }}
                    className="rounded-full border border-white/10 bg-white/6 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10"
                  >
                    {isFullscreen ? "Exit" : "Full"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpinEnabled((value) => !value)}
                    className="rounded-full border border-sky-300/35 bg-sky-300/10 px-3 py-2 text-xs font-semibold text-sky-100 transition hover:bg-sky-300/16"
                  >
                    {spinEnabled ? "Pause" : "Spin"}
                  </button>
                </div>

                <div className="pointer-events-auto absolute bottom-4 left-4 rounded-[1.2rem] border border-white/10 bg-slate-950/42 px-4 py-3 text-sm text-slate-200 shadow-xl backdrop-blur">
                  {isModelReady ? "Model ready" : "Loading model..."}
                </div>

                <div className="pointer-events-auto absolute bottom-4 right-4 flex flex-col items-end gap-3">
                  {controlsOpen ? (
                    <div className="grid grid-cols-3 gap-3 rounded-[1.45rem] border border-white/12 bg-slate-950/72 p-3 shadow-2xl backdrop-blur">
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
                        onClick={() => setYaw((value) => value - PAN_STEP)}
                      >
                        <ArrowIcon direction="left" />
                      </IconButton>
                      <IconButton label="Reset view" onClick={resetView}>
                        Reset
                      </IconButton>
                      <IconButton
                        label="Move right"
                        onClick={() => setYaw((value) => value + PAN_STEP)}
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
                    onClick={() => setControlsOpen((value) => !value)}
                    className="rounded-full border border-white/12 bg-slate-950/72 px-4 py-3 text-sm font-semibold text-white shadow-xl backdrop-blur transition hover:bg-slate-900/82"
                  >
                    {controlsOpen ? "Hide" : "Controls"}
                  </button>
                </div>

                <div className="pointer-events-auto absolute right-4 top-20 w-[280px] rounded-[1.45rem] border border-white/10 bg-slate-950/46 p-4 shadow-2xl backdrop-blur sm:w-[300px]">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-300">
                      Color
                    </p>
                    <div
                      aria-hidden="true"
                      className="h-8 w-8 rounded-full border border-white/20"
                      style={{ backgroundColor: selectedPalette.jerseyColor }}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {PALETTE_OPTIONS.map((option) => {
                      const isActive = option.id === selectedPalette.id;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setSelectedPaletteId(option.id)}
                          className={`rounded-2xl border px-3 py-3 text-left transition ${
                            isActive
                              ? "border-sky-300/60 bg-sky-300/12"
                              : "border-white/10 bg-white/5 hover:bg-white/8"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-white">
                              {option.name}
                            </span>
                            <span
                              aria-hidden="true"
                              className="h-4 w-4 rounded-full border border-white/20"
                              style={{ backgroundColor: option.jerseyColor }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
                    <input
                      type="color"
                      aria-label="Pick custom jersey color"
                      value={customColor}
                      onChange={(event) => {
                        const nextColor = event.target.value;
                        setCustomColor(nextColor);
                        setSelectedPaletteId(CUSTOM_PALETTE_ID);
                      }}
                      className="h-11 w-12 cursor-pointer rounded-xl border border-white/15 bg-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedPaletteId(CUSTOM_PALETTE_ID)}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                        selectedPalette.id === CUSTOM_PALETTE_ID
                          ? "border-sky-300/60 bg-sky-300/12 text-sky-100"
                          : "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                      }`}
                    >
                      Custom
                    </button>
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {customColor}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-sky-300">
                  Loading Scene
                </p>
                <p className="mt-3 text-lg text-slate-200">
                  Preparing the A-Frame canvas and jersey model.
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

function ShowroomScene({
  modelRef,
  palette,
  spinEnabled,
  yaw,
  pitch,
  fov,
}: {
  modelRef: React.RefObject<AFrameModelElement | null>;
  palette: PaletteOption;
  spinEnabled: boolean;
  yaw: number;
  pitch: number;
  fov: number;
}) {
  const rigRef = useRef<HTMLElement | null>(null);
  const cameraRef = useRef<AFrameCameraElement | null>(null);

  useEffect(() => {
    const rigEl = rigRef.current;
    if (!rigEl) {
      return;
    }

    rigEl.setAttribute("rotation", `${pitch} ${yaw} 0`);
  }, [pitch, yaw]);

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
      renderer="colorManagement: true; physicallyCorrectLights: true; antialias: true"
      background="color: #020617"
      fog="type: exponential; color: #020617; density: 0.05"
      className="h-full w-full"
    >
      <a-entity light="type: ambient; intensity: 1.18; color: #e2e8f0" />
      <a-entity
        light="type: directional; intensity: 1.9; color: #ffffff"
        position="0 4.4 3"
      />
      <a-entity
        light="type: spot; intensity: 5.2; color: #fff4d6; angle: 36; penumbra: 0.72; castShadow: true"
        position="-2.4 4.1 3.4"
        rotation="-64 -18 0"
      />
      <a-entity
        light="type: spot; intensity: 4.9; color: #dbeafe; angle: 34; penumbra: 0.66"
        position="2.3 3.9 3.2"
        rotation="-61 20 0"
      />
      <a-entity
        light={`type: point; intensity: 2.8; color: ${palette.accentColor}; distance: 9; decay: 1.5`}
        position="0 2.5 0.8"
      />
      <a-entity
        light={`type: point; intensity: 2; color: ${palette.accentColor}; distance: 7; decay: 2`}
        position="-1.8 2.1 1.8"
      />
      <a-entity
        light={`type: point; intensity: 2; color: ${palette.accentColor}; distance: 7; decay: 2`}
        position="1.8 2.1 1.8"
      />

      <a-entity
        geometry="primitive: plane; width: 18; height: 18"
        rotation="-90 0 0"
        material="color: #050816; roughness: 0.92; metalness: 0.24"
        shadow="receive: true"
      />
      <a-entity
        geometry="primitive: circle; radius: 1.95"
        position="0 0.01 0"
        rotation="-90 0 0"
        material="color: #0f172a; roughness: 0.38; metalness: 0.52"
        shadow="receive: true"
      />
      <a-entity
        geometry="primitive: ring; radiusInner: 1.98; radiusOuter: 2.18"
        position="0 0.018 0"
        rotation="-90 0 0"
        material={`color: ${palette.accentColor}; emissive: ${palette.accentColor}; emissiveIntensity: 1; opacity: 0.94`}
      />

      <a-entity ref={rigRef} rotation={`${pitch} ${yaw} 0`}>
        <a-entity position="0 1.85 7.4">
          <a-entity
            ref={cameraRef}
            camera={`fov: ${fov}`}
            look-controls="enabled: false"
          />
        </a-entity>
      </a-entity>

      <a-entity
        position="0 0.02 0"
        animation={
          spinEnabled
            ? "property: rotation; to: 0 360 0; loop: true; dur: 18000; easing: linear"
            : undefined
        }
        rotation="0 12 0"
      >
        <a-entity
          ref={modelRef}
          gltf-model={MODEL_SRC}
          position="0 -3.25 0"
          rotation="0 180 0"
          scale="4.15 4.15 4.15"
          shadow="cast: true; receive: true"
        />
      </a-entity>
    </a-scene>
  );
}

function prepareMaterials(
  modelEl: AFrameModelElement,
  hasPreparedMaterialsRef: React.RefObject<boolean>
) {
  if (hasPreparedMaterialsRef.current) {
    return collectMaterials(modelEl);
  }

  const root = modelEl.getObject3D?.("mesh");
  if (!root?.traverse) {
    return [];
  }

  const materials: GLTFMaterial[] = [];

  root.traverse((child) => {
    if (!child.isMesh || !child.material) {
      return;
    }

    if (Array.isArray(child.material)) {
      child.material = child.material.map((material) => {
        const clonedMaterial = cloneMaterial(material);
        materials.push(clonedMaterial);
        return clonedMaterial;
      });
      return;
    }

    const clonedMaterial = cloneMaterial(child.material);
    child.material = clonedMaterial;
    materials.push(clonedMaterial);
  });

  hasPreparedMaterialsRef.current = materials.length > 0;
  return materials;
}

function collectMaterials(modelEl: AFrameModelElement) {
  const root = modelEl.getObject3D?.("mesh");
  if (!root?.traverse) {
    return [];
  }

  const materials: GLTFMaterial[] = [];

  root.traverse((child) => {
    if (!child.isMesh || !child.material) {
      return;
    }

    if (Array.isArray(child.material)) {
      materials.push(...child.material);
      return;
    }

    materials.push(child.material);
  });

  return materials;
}

function cloneMaterial(material: GLTFMaterial) {
  return typeof material.clone === "function" ? material.clone() : material;
}

function applyPalette(materials: GLTFMaterial[], palette: PaletteOption) {
  for (const material of materials) {
    material.color?.set(palette.jerseyColor);
    material.emissive?.set("#050816");

    if (typeof material.metalness === "number") {
      material.metalness = 0.18;
    }

    if (typeof material.roughness === "number") {
      material.roughness = 0.72;
    }

    material.needsUpdate = true;
  }
}

function IconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-14 min-w-14 items-center justify-center rounded-2xl border border-white/20 bg-white text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-100"
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
