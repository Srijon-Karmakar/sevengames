import { useEffect, useRef } from "react";

/*
 * Full-screen background image (public/images/bg/).
 *  - bg-web.webp    (2048×1042, landscape)  desktops, laptops, landscape tablets
 *  - bg-mobile.webp (1152×2048, portrait)   phones and portrait tablets
 * A <picture> element means each device downloads only the one image it shows.
 * On mouse devices the image drifts slightly with the pointer for a touch of depth.
 */
const WEB = "/images/bg/bg-web.webp";
const MOBILE = "/images/bg/bg-mobile.webp";
const MOBILE_MEDIA = "(max-width: 1024px) and (orientation: portrait)";

// Max travel in px. Must stay inside the CSS overscan (.scene-layer inset) so edges never show.
const MOUSE_X = 14;
const MOUSE_Y = 8;

export default function ParallaxBackground() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const layer = root.querySelector<HTMLElement>(".scene-layer");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    // Only mouse devices get the drift; touch devices keep a static, uncomposited image.
    const live = finePointer && !reduced;
    root.classList.toggle("live", live);

    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    let raf = 0;

    const apply = () => {
      raf = 0;
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      if (live && layer) {
        layer.style.transform = `translate3d(${(-x * MOUSE_X).toFixed(1)}px, ${(-y * MOUSE_Y).toFixed(1)}px, 0)`;
      }
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

    window.addEventListener("resize", kick, { passive: true });
    if (live) window.addEventListener("pointermove", onMove, { passive: true });
    kick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", kick);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div className="scene" ref={rootRef} aria-hidden="true">
      <div className="scene-fallback" />
      <div className="scene-layer">
        <picture>
          <source media={MOBILE_MEDIA} srcSet={MOBILE} type="image/webp" width={1152} height={2048} />
          <img src={WEB} alt="" width={2048} height={1042} decoding="async" fetchPriority="high" draggable={false} />
        </picture>
      </div>
    </div>
  );
}
