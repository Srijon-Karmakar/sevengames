import { useEffect, useRef, useState } from "react";

/*
 * Layered parallax background. Images live in public/images/bg-layers/.
 * Listed back → front: `depth` 0 = farthest (barely moves), 1 = nearest (moves most).
 * All layers share one 16:9 canvas, so they stay aligned when cropped identically.
 *
 *  - minWidth: skip downloading the layer on narrow screens where it is cropped out anyway.
 *  - float:    adds a slow idle drift (particles).
 */
type Layer = { src: string; depth: number; minWidth?: number; float?: boolean };

const BASE = "/images/bg-layers";
const LAYERS: Layer[] = [
  { src: `${BASE}/l1-sky.webp`, depth: 0 },
  { src: `${BASE}/l2-mountain-terrain.webp`, depth: 0.2 },
  { src: `${BASE}/l3-terrain.webp`, depth: 0.45 },
  { src: `${BASE}/l4-particles.webp`, depth: 0.6, float: true },
  { src: `${BASE}/l5-boy.webp`, depth: 0.75, minWidth: 600 },
  { src: `${BASE}/l6-grass.webp`, depth: 1 },
];

// Max travel in px for the nearest layer. Must stay inside the CSS overscan (.scene-layer inset)
// so layer edges never show. No scroll movement: the art keeps its exact composition.
const MOUSE_X = 22;
const MOUSE_Y = 10;

function useWide(min: number) {
  const query = `(min-width: ${min}px)`;
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

export default function ParallaxBackground() {
  const rootRef = useRef<HTMLDivElement>(null);
  const wide = useWide(600);
  const layers = LAYERS.filter((l) => !l.minWidth || wide);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // The sky (depth 0) never moves, so it is never transformed or promoted to its own GPU layer.
    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-depth]")).filter(
      (el) => Number(el.dataset.depth) > 0,
    );
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    // Only mouse devices get parallax; touch devices keep static, uncomposited layers (less GPU memory).
    const live = finePointer && !reduced;
    root.classList.toggle("live", live);

    let tx = 0; // target pointer offset, -1..1
    let ty = 0;
    let x = 0; // eased pointer offset
    let y = 0;
    let raf = 0;

    const apply = () => {
      raf = 0;
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      const scroll = window.scrollY;
      if (live) {
        for (const el of els) {
          const d = Number(el.dataset.depth);
          el.style.transform = `translate3d(${(-x * MOUSE_X * d).toFixed(1)}px, ${(-y * MOUSE_Y * d).toFixed(1)}px, 0)`;
        }
      }
      // Darken the scene as the user scrolls into content.
      const dim = Math.min(1, scroll / (window.innerHeight * 0.9));
      root.style.setProperty("--bg-dim", dim.toFixed(3));
      if (Math.abs(tx - x) > 0.001 || Math.abs(ty - y) > 0.001) raf = requestAnimationFrame(apply);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
      kick();
    };

    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick, { passive: true });
    if (live) window.addEventListener("pointermove", onMove, { passive: true });
    kick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
      window.removeEventListener("pointermove", onMove);
    };
  }, [layers.length]);

  return (
    <div className="scene" ref={rootRef} aria-hidden="true">
      <div className="scene-fallback" />
      {layers.map((layer, i) => (
        <div
          key={layer.src}
          className={`scene-layer${layer.float ? " float" : ""}`}
          data-depth={layer.depth}
        >
          <img
            src={layer.src}
            alt=""
            decoding="async"
            fetchPriority={i === 0 ? "high" : "auto"}
            draggable={false}
          />
        </div>
      ))}
      <div className="scene-shade" />
    </div>
  );
}
