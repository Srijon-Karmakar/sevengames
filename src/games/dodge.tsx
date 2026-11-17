import { useEffect, useRef, useState } from "react";
import type { GameProps } from "./index";
import { Particles, Shake, glow, reducedMotion, setupCanvas } from "./fx";

/*
 * Dodge: pilot a ship through a meteor shower. Parallax starfield, glowing ship with an engine
 * trail and banking tilt, tumbling glowing meteors, explosion + shake on impact, and a
 * "near miss" bonus (+5) for skimming past a meteor. Keyboard, or drag/touch to steer.
 * Score = 10 per second survived + near-miss bonuses.
 */

const W = 320;
const H = 460;
const SHIP_Y = H - 56;
const SHIP_W = 30;
const SHIP_H = 34;
const MAX_ROCKS = 40;

type Rock = { x: number; y: number; r: number; v: number; rot: number; spin: number; hue: number; grazed: boolean; alive: boolean; pts: number[] };
type Star = { x: number; y: number; z: number };

function makeRockShape() {
  // irregular polygon radii (8 points), so every meteor looks different
  return Array.from({ length: 8 }, () => 0.72 + Math.random() * 0.32);
}

export default function DodgeGame({ onFinish }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [score, setScore] = useState(0);
  const st = useRef({
    px: W / 2,
    vx: 0,
    target: null as number | null,
    left: false,
    right: false,
    rocks: Array.from({ length: MAX_ROCKS }, () => ({ alive: false }) as Rock),
    t: 0,
    spawn: 0,
    bonus: 0,
    running: false,
    dead: false,
    stars: [] as Star[],
    parts: new Particles(260),
    shake: new Shake(),
    popups: [] as { x: number; y: number; t: number }[],
  });

  function start() {
    const s = st.current;
    s.px = W / 2;
    s.vx = 0;
    s.target = null;
    s.rocks.forEach((r) => (r.alive = false));
    s.t = 0;
    s.spawn = 0.4;
    s.bonus = 0;
    s.dead = false;
    s.popups = [];
    s.parts.clear();
    s.running = true;
    setScore(0);
    setOver(false);
    setRunning(true);
  }

  useEffect(() => {
    const set = (e: KeyboardEvent, v: boolean) => {
      if (e.key === "ArrowLeft" || e.key === "a") st.current.left = v;
      if (e.key === "ArrowRight" || e.key === "d") st.current.right = v;
      if (v && (e.key === "ArrowLeft" || e.key === "ArrowRight") && st.current.running) e.preventDefault();
      if (v) st.current.target = null;
    };
    const down = (e: KeyboardEvent) => set(e, true);
    const up = (e: KeyboardEvent) => set(e, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = setupCanvas(canvas, W, H);
    const s = st.current;
    const calm = reducedMotion();
    if (!s.stars.length) s.stars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.2 + Math.random() * 0.8 }));

    // pre-rendered sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#05060f");
    sky.addColorStop(0.6, "#0b0b22");
    sky.addColorStop(1, "#1a0d2a");

    let raf = 0;
    let last = performance.now();
    let shownScore = -1;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const speedUp = 1 + s.t * 0.035;

      if (s.running) {
        s.t += dt;
        s.spawn -= dt;
        // smooth steering: keys accelerate, drag eases toward the finger
        if (s.target !== null) s.vx = (s.target - s.px) * 12;
        else {
          const want = (s.right ? 1 : 0) - (s.left ? 1 : 0);
          s.vx += (want * 330 - s.vx) * Math.min(1, dt * 12);
        }
        s.px = Math.max(SHIP_W / 2, Math.min(W - SHIP_W / 2, s.px + s.vx * dt));

        if (s.spawn <= 0) {
          const r = s.rocks.find((q) => !q.alive);
          if (r) {
            const rad = 10 + Math.random() * 16;
            Object.assign(r, {
              x: rad + Math.random() * (W - rad * 2),
              y: -rad,
              r: rad,
              v: (130 + Math.random() * 70) * speedUp,
              rot: Math.random() * 6,
              spin: (Math.random() - 0.5) * 3,
              hue: 340 + Math.random() * 40,
              grazed: false,
              alive: true,
              pts: makeRockShape(),
            });
          }
          s.spawn = Math.max(0.2, 0.62 - s.t * 0.012);
        }

        for (const r of s.rocks) {
          if (!r.alive) continue;
          r.y += r.v * dt;
          r.rot += r.spin * dt;
          if (r.y - r.r > H) r.alive = false;
          // collision: circle vs ship body (approximated by a circle)
          const dx = r.x - s.px;
          const dy = r.y - (SHIP_Y + 4);
          const d = Math.hypot(dx, dy);
          if (d < r.r * 0.85 + 12) {
            s.running = false;
            s.dead = true;
            s.parts.burst(s.px, SHIP_Y, 60, "rgba(255,140,60,1)", { speed: 260, life: 1, size: 4 });
            s.parts.burst(s.px, SHIP_Y, 30, "rgba(120,200,255,1)", { speed: 180, life: 0.8, size: 3 });
            s.shake.kick(14);
            const final = Math.floor(s.t * 10) + s.bonus;
            setScore(final);
            setRunning(false);
            setOver(true);
            onFinish(final);
            break;
          }
          if (!r.grazed && d < r.r + 30 && r.y > SHIP_Y) {
            r.grazed = true;
            s.bonus += 5;
            s.popups.push({ x: s.px, y: SHIP_Y - 26, t: 0 });
          }
        }
        // engine trail
        if (!calm) s.parts.burst(s.px, SHIP_Y + SHIP_H / 2, 2, "rgba(90,180,255,1)", { speed: 90, life: 0.35, size: 3, angle: Math.PI / 2, spread: 0.6 });
        const live = Math.floor(s.t * 10) + s.bonus;
        if (live !== shownScore) {
          shownScore = live;
          setScore(live);
        }
      }
      s.parts.update(dt);

      // ---- draw ----
      ctx.save();
      s.shake.apply(ctx, dt);
      ctx.fillStyle = sky;
      ctx.fillRect(-20, -20, W + 40, H + 40);

      // parallax stars (faster when the game speeds up)
      for (const star of s.stars) {
        if (s.running || s.dead) star.y += star.z * 60 * speedUp * dt;
        if (star.y > H) {
          star.y = 0;
          star.x = Math.random() * W;
        }
        ctx.globalAlpha = 0.3 + star.z * 0.7;
        ctx.fillStyle = "#cfd8ff";
        const len = calm ? 1.5 : 1.5 + star.z * speedUp * 2;
        ctx.fillRect(star.x, star.y, 1.4 * star.z + 0.4, len);
      }
      ctx.globalAlpha = 1;

      // meteors
      for (const r of s.rocks) {
        if (!r.alive) continue;
        glow(ctx, r.x, r.y - r.r * 0.6, r.r * 2.4, "rgba(255,90,60,0.8)", 0.35);
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(r.rot);
        ctx.beginPath();
        r.pts.forEach((k, i) => {
          const a = (i / r.pts.length) * Math.PI * 2;
          const x = Math.cos(a) * r.r * k;
          const y = Math.sin(a) * r.r * k;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.closePath();
        const mg = ctx.createRadialGradient(-r.r * 0.3, -r.r * 0.3, 1, 0, 0, r.r);
        mg.addColorStop(0, `hsl(${r.hue % 360} 90% 72%)`);
        mg.addColorStop(1, `hsl(${(r.hue + 10) % 360} 70% 30%)`);
        ctx.fillStyle = mg;
        ctx.fill();
        ctx.restore();
      }

      // ship
      if (!s.dead) {
        const tilt = Math.max(-0.35, Math.min(0.35, s.vx / 900));
        glow(ctx, s.px, SHIP_Y + SHIP_H * 0.55, 26, "rgba(70,170,255,0.9)", 0.7);
        ctx.save();
        ctx.translate(s.px, SHIP_Y);
        ctx.rotate(tilt);
        ctx.beginPath();
        ctx.moveTo(0, -SHIP_H / 2);
        ctx.lineTo(SHIP_W / 2, SHIP_H / 2);
        ctx.lineTo(0, SHIP_H / 2 - 8);
        ctx.lineTo(-SHIP_W / 2, SHIP_H / 2);
        ctx.closePath();
        const sg = ctx.createLinearGradient(-SHIP_W / 2, 0, SHIP_W / 2, 0);
        sg.addColorStop(0, "#5aa8ff");
        sg.addColorStop(0.5, "#e9f4ff");
        sg.addColorStop(1, "#3f7cff");
        ctx.fillStyle = sg;
        ctx.fill();
        ctx.fillStyle = "#0a1a3a";
        ctx.beginPath();
        ctx.ellipse(0, -2, 4, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      s.parts.draw(ctx);

      ctx.font = "700 13px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      s.popups = s.popups.filter((p) => (p.t += dt) < 0.7);
      for (const p of s.popups) {
        ctx.globalAlpha = 1 - p.t / 0.7;
        ctx.fillStyle = "#7df9ff";
        ctx.fillText("NEAR MISS +5", p.x, p.y - p.t * 36);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function drag(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!st.current.running) return;
    const rect = e.currentTarget.getBoundingClientRect();
    st.current.target = ((e.clientX - rect.left) / rect.width) * W;
  }

  return (
    <div className="game-surface">
      <p className="game-status">
        {over ? `Crashed! Score ${score}.` : running ? `Score ${score}` : "Dodge the meteors. Arrow keys / A-D, or drag."}
      </p>
      <canvas
        ref={canvasRef}
        className="arcade-canvas arcade-frame"
        style={{ width: W, maxWidth: "100%", aspectRatio: `${W} / ${H}`, touchAction: "none" }}
        onPointerMove={drag}
        onPointerDown={drag}
        onPointerLeave={() => (st.current.target = null)}
      />
      {!running ? (
        <button type="button" className="primary-btn" onClick={start}>
          {over ? "Play again" : "Start"}
        </button>
      ) : null}
    </div>
  );
}
