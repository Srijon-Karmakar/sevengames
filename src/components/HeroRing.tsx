import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import type { Game } from "../catalog";
import { GamePoster } from "./GamePoster";
import { RiPlayFill } from "./ReIcons";

const SPEED = 0; // Stays on front card by default; drag to spin
const DRAG = 0.28; // degrees per pixel dragged

/**
 * Rotating 3D ring of game posters. One rAF loop writes transform/opacity only;
 * it stops when the ring is off-screen, the tab is hidden, or nothing is moving.
 * Drag (mouse or touch) to spin; vertical page scroll still works on touch.
 */
export default function HeroRing({ games }: { games: Game[] }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const cards = cardRefs.current.filter(Boolean) as HTMLAnchorElement[];
    const n = cards.length;
    const step = 360 / n;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let angle = 0;
    let velocity = 0; // deg/s from drag release
    let radius = 300;
    let cardW = 200;
    let hovering = false;
    let dragging = false;
    let dragMoved = 0;
    let lastX = 0;
    let lastT = 0;
    let visible = true;
    let raf = 0;
    let prev = 0;

    const layout = () => {
      const w = stage.clientWidth;
      // Radius fills ~96% of the stage width; card size follows from the gap between neighbours.
      radius = w * 0.48;
      cardW = Math.max(96, Math.min(240, (2 * radius * Math.tan(Math.PI / n)) / 1.14));
      stage.style.setProperty("--card-w", `${cardW.toFixed(0)}px`);
      stage.style.setProperty("--ring-r", `${radius.toFixed(0)}px`);
    };

    const draw = () => {
      let front = 0;
      let best = -2;
      for (let i = 0; i < n; i++) {
        const theta = angle + i * step;
        const c = Math.cos((theta * Math.PI) / 180);
        const card = cards[i];
        const f = Math.max(0, c);
        // Front card moves *forward* (not just scales) so neighbours' inner edges never overlap it.
        const pop = f ** 6;
        const scale = 0.86 + 0.14 * pop;
        const lift = cardW * 0.8 * pop;
        card.style.transform = `rotateY(${theta.toFixed(2)}deg) translateZ(${(radius + lift).toFixed(1)}px) scale(${scale.toFixed(3)})`;
        // Cards in the back fade out cleanly so there is no black overlap over the sky
        const opacity = c >= 0.05 ? 1 : Math.max(0, (c + 0.12) / 0.18);
        card.style.opacity = opacity.toFixed(3);
        card.style.visibility = opacity <= 0.02 ? "hidden" : "visible";
        card.style.pointerEvents = c > 0.35 ? "auto" : "none";
        card.tabIndex = c > 0.35 ? 0 : -1;
        if (c > best) {
          best = c;
          front = i;
        }
      }
      cards.forEach((card, i) => card.classList.toggle("front", i === front));
    };

    const tick = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = Math.min(0.05, (now - prev) / 1000 || 0);
      prev = now;
      if (!dragging) {
        if (Math.abs(velocity) > 0.5) {
          angle += velocity * dt;
          velocity *= Math.exp(-dt * 2.4);
        } else {
          velocity = 0;
          if (!hovering && !reduced) angle -= SPEED * dt;
        }
      }
      draw();
      const moving = dragging || velocity !== 0 || (!hovering && !reduced);
      if (moving) raf = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (raf || !visible || document.hidden) return;
      prev = performance.now();
      raf = requestAnimationFrame(tick);
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      dragMoved = 0;
      lastX = e.clientX;
      lastT = e.timeStamp;
      velocity = 0;
      wake();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      dragMoved += Math.abs(dx);
      angle += dx * DRAG;
      const dt = Math.max(1, e.timeStamp - lastT) / 1000;
      velocity = (dx * DRAG) / dt;
      lastX = e.clientX;
      lastT = e.timeStamp;
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      velocity = Math.max(-400, Math.min(400, velocity));
      wake();
    };
    // A drag should not count as a click on the poster under the pointer.
    const onClickCapture = (e: MouseEvent) => {
      if (dragMoved > 6) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === "mouse") hovering = true;
    };
    const onLeave = () => {
      hovering = false;
      wake();
    };

    stage.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    stage.addEventListener("click", onClickCapture, true);
    stage.addEventListener("pointerenter", onEnter);
    stage.addEventListener("pointerleave", onLeave);

    const ro = new ResizeObserver(() => {
      layout();
      draw();
    });
    ro.observe(stage);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      // Also pauses the platform's CSS animations while off-screen.
      stage.classList.toggle("paused", !visible);
      if (visible) wake();
    });
    io.observe(stage);
    const onVisibility = () => !document.hidden && wake();
    document.addEventListener("visibilitychange", onVisibility);

    layout();
    draw();
    wake();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      stage.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      stage.removeEventListener("click", onClickCapture, true);
      stage.removeEventListener("pointerenter", onEnter);
      stage.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [games]);

  return (
    <div className="ring-stage" ref={stageRef}>
      <div className="ring-fx" aria-hidden="true">
        <span className="fx-bloom" />
        <span className="fx-beam" />
        <span className="fx-beams-fan" />
        <div className="fx-plane">
          <span className="fx-ring fx-outer" />
          <span className="fx-ring fx-ticks" />
          <span className="fx-ring fx-inner" />
          <span className="fx-comet fx-c1" />
          <span className="fx-comet fx-c2" />
          <span className="fx-orbit">
            <i />
            <i />
            <i />
          </span>
          <span className="fx-core saucer-emblem">
            <img src="/logo/mark-256.webp" width={256} height={256} alt="" className="saucer-mark" decoding="async" />
          </span>
        </div>
        <span className="fx-flare" />
      </div>
      <div className="ring">
        {games.map((game, i) => {
          const categoryTag =
            game.id === "skyrealm"
              ? "OPEN WORLD RPG"
              : game.id === "drift-nexus"
              ? "DRIFT RACING"
              : game.id === "pixel-craft"
              ? "VOXEL SANDBOX"
              : game.id === "shadow-tactics"
              ? "TACTICAL STEALTH"
              : game.id === "void-arena"
              ? "SCI-FI ARENA"
              : game.category.toUpperCase();

          return (
            <Link
              key={game.id}
              to={`/game/${game.id}`}
              className="ring-card"
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              draggable={false}
              aria-label={`Play ${game.title}`}
              style={{ "--accent": game.accent } as React.CSSProperties}
            >
              <GamePoster game={game} size="portrait" hideBadge />
              {/* Light ray effects overlay */}
              <div className="card-light-rays" aria-hidden="true">
                <span className="light-ray-diagonal" />
                <span className="light-ray-flare" />
                <span className="light-ray-underglow" />
              </div>
              <span className="ring-card-text">
                <strong>{game.title}</strong>
                <small>{categoryTag}</small>
              </span>
              <span className="ring-card-play" aria-hidden="true">
                <RiPlayFill size={15} />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
