import { useEffect, useRef, useState } from "react";
import type { GameProps } from "./index";
import { Particles, Shake, glow, lerp, reducedMotion, setupCanvas } from "./fx";

/*
 * Stack: drop sliding slabs onto the tower. Slabs are drawn with a lit top face and a shaded
 * front, the overhang breaks off and tumbles away under gravity, a near-perfect drop snaps into
 * place with a ring flash and grows a combo (3 perfects in a row widen the slab again), the
 * camera glides up the tower and the sky shifts colour as you climb. Score = tower height.
 */

const W = 320;
const H = 460;
const SLAB = 24; // slab height
const DEPTH = 10; // visible top-face depth
const START_W = 150;
const PERFECT = 5; // px tolerance for a perfect drop

type Block = { x: number; w: number; hue: number };
type Shard = { x: number; y: number; w: number; vy: number; vx: number; rot: number; spin: number; hue: number; alive: boolean };

const hueFor = (i: number) => (200 + i * 9) % 360;

function drawSlab(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, hue: number, alpha = 1) {
  ctx.globalAlpha = alpha;
  // top face (lit)
  ctx.fillStyle = `hsl(${hue} 85% 70%)`;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + DEPTH, y - DEPTH);
  ctx.lineTo(x + w + DEPTH, y - DEPTH);
  ctx.lineTo(x + w, y);
  ctx.closePath();
  ctx.fill();
  // right side (dark)
  ctx.fillStyle = `hsl(${hue} 60% 34%)`;
  ctx.beginPath();
  ctx.moveTo(x + w, y);
  ctx.lineTo(x + w + DEPTH, y - DEPTH);
  ctx.lineTo(x + w + DEPTH, y - DEPTH + SLAB);
  ctx.lineTo(x + w, y + SLAB);
  ctx.closePath();
  ctx.fill();
  // front face (gradient)
  const g = ctx.createLinearGradient(0, y, 0, y + SLAB);
  g.addColorStop(0, `hsl(${hue} 80% 56%)`);
  g.addColorStop(1, `hsl(${hue} 75% 44%)`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, SLAB);
  ctx.globalAlpha = 1;
}

export default function StackGame({ onFinish }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [over, setOver] = useState(false);
  const [started, setStarted] = useState(false);
  const st = useRef({
    tower: [] as Block[],
    x: 0,
    w: START_W,
    dir: 1,
    speed: 150, // px/s
    over: false,
    started: false,
    cam: 0,
    combo: 0,
    ring: { t: 1, x: 0, y: 0, w: 0 },
    shards: Array.from({ length: 12 }, () => ({ alive: false }) as Shard),
    parts: new Particles(180),
    shake: new Shake(),
    label: { text: "", t: 1 },
  });

  function reset() {
    const s = st.current;
    s.tower = [{ x: (W - START_W) / 2 - DEPTH / 2, w: START_W, hue: hueFor(0) }];
    s.x = 0;
    s.w = START_W;
    s.dir = 1;
    s.speed = 150;
    s.over = false;
    s.started = true;
    s.combo = 0;
    s.shards.forEach((q) => (q.alive = false));
    s.parts.clear();
    setScore(0);
    setCombo(0);
    setOver(false);
    setStarted(true);
  }

  // screen y of tower level i (0 = base), before the camera offset
  const levelY = (i: number) => H - 40 - (i + 1) * SLAB;

  function drop() {
    const s = st.current;
    if (!s.started || s.over) return;
    const prev = s.tower[s.tower.length - 1];
    const level = s.tower.length;
    const hue = hueFor(level);
    let left = Math.max(s.x, prev.x);
    let right = Math.min(s.x + s.w, prev.x + prev.w);
    const overlap = right - left;
    const y = levelY(level);

    if (overlap <= 0) {
      // missed completely: the whole slab falls
      const q = s.shards.find((z) => !z.alive);
      if (q) Object.assign(q, { x: s.x, y, w: s.w, vy: 0, vx: s.dir * 40, rot: 0, spin: s.dir * 1.5, hue, alive: true });
      s.over = true;
      s.shake.kick(10);
      setOver(true);
      onFinish(s.tower.length - 1);
      return;
    }

    if (Math.abs(s.x - prev.x) <= PERFECT) {
      // perfect: snap onto the slab below, combo, flash ring
      left = prev.x;
      right = prev.x + prev.w;
      s.combo += 1;
      s.ring = { t: 0, x: left, y, w: right - left };
      s.label = { text: s.combo > 1 ? `PERFECT ×${s.combo}` : "PERFECT", t: 0 };
      s.parts.burst(left + (right - left) / 2, y, 24, `hsla(${hue},100%,75%,1)`, { speed: 160, life: 0.6, size: 3, spread: Math.PI, angle: -Math.PI / 2 });
      if (s.combo >= 3) {
        // reward: widen the slab a little (capped at the starting width)
        const grow = Math.min(12, START_W - (right - left));
        left -= grow / 2;
        right += grow / 2;
      }
    } else {
      s.combo = 0;
      // the overhang breaks off and tumbles
      const cutLeft = s.x < prev.x;
      const q = s.shards.find((z) => !z.alive);
      if (q) {
        const cx = cutLeft ? s.x : right;
        const cw = s.w - overlap;
        Object.assign(q, { x: cx, y, w: cw, vy: -40, vx: (cutLeft ? -1 : 1) * 60, rot: 0, spin: (cutLeft ? -1 : 1) * (1 + Math.random()), hue, alive: true });
      }
      s.shake.kick(2.5);
    }
    s.tower.push({ x: left, w: right - left, hue });
    s.w = right - left;
    s.speed = Math.min(380, s.speed + 8);
    // next slab enters from alternating sides
    s.dir = level % 2 ? 1 : -1;
    s.x = s.dir === 1 ? -s.w : W;
    setScore(s.tower.length - 1);
    setCombo(s.combo);
  }

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = setupCanvas(canvas, W, H);
    const s = st.current;
    const calm = reducedMotion();
    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (s.started && !s.over) {
        s.x += s.dir * s.speed * dt;
        if (s.x + s.w > W - DEPTH) {
          s.x = W - DEPTH - s.w;
          s.dir = -1;
        }
        if (s.x < 0) {
          s.x = 0;
          s.dir = 1;
        }
      }
      // camera keeps the top of the tower ~40% down the screen
      const targetCam = Math.max(0, s.tower.length * SLAB - H * 0.45);
      s.cam = calm ? targetCam : lerp(s.cam, targetCam, Math.min(1, dt * 6));

      for (const q of s.shards) {
        if (!q.alive) continue;
        q.vy += 900 * dt;
        q.y += q.vy * dt;
        q.x += q.vx * dt;
        q.rot += q.spin * dt;
        if (q.y - s.cam > H + 80) q.alive = false;
      }
      s.parts.update(dt);

      // ---- draw ----
      ctx.save();
      s.shake.apply(ctx, dt);
      // sky shifts hue as the tower grows
      const skyHue = (230 + s.tower.length * 4) % 360;
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, `hsl(${skyHue} 45% 14%)`);
      sky.addColorStop(1, `hsl(${(skyHue + 40) % 360} 50% 26%)`);
      ctx.fillStyle = sky;
      ctx.fillRect(-20, -20, W + 40, H + 40);

      ctx.save();
      ctx.translate(0, s.cam);
      // only draw slabs that are on screen
      const firstVisible = Math.max(0, Math.floor((s.cam - 40) / SLAB) - 2);
      for (let i = firstVisible; i < s.tower.length; i++) {
        const b = s.tower[i];
        const y = levelY(i);
        if (y + s.cam > H + SLAB) continue;
        drawSlab(ctx, b.x, y, b.w, b.hue);
      }
      // moving slab
      if (s.started && !s.over) {
        const y = levelY(s.tower.length);
        glow(ctx, s.x + s.w / 2, y + SLAB / 2, s.w * 0.7, `hsla(${hueFor(s.tower.length)},100%,65%,0.6)`, 0.35);
        drawSlab(ctx, s.x, y, s.w, hueFor(s.tower.length));
      }
      // falling shards
      for (const q of s.shards) {
        if (!q.alive) continue;
        ctx.save();
        ctx.translate(q.x + q.w / 2, q.y + SLAB / 2);
        ctx.rotate(q.rot);
        drawSlab(ctx, -q.w / 2, -SLAB / 2, q.w, q.hue, 0.95);
        ctx.restore();
      }
      // perfect ring
      if (s.ring.t < 1) {
        s.ring.t += dt * 2.2;
        const k = s.ring.t;
        ctx.strokeStyle = `rgba(255,255,255,${1 - k})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(s.ring.x - k * 14, s.ring.y - DEPTH - k * 10, s.ring.w + DEPTH + k * 28, SLAB + DEPTH + k * 20);
      }
      s.parts.draw(ctx);
      ctx.restore();

      // big height number in the background
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.font = "800 72px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(Math.max(0, s.tower.length - 1)), W / 2, 92);

      if (s.label.t < 1) {
        s.label.t += dt * 1.3;
        ctx.globalAlpha = 1 - s.label.t;
        ctx.fillStyle = "#fff";
        ctx.font = "800 18px Inter, system-ui, sans-serif";
        ctx.fillText(s.label.text, W / 2, 130 - s.label.t * 20);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && st.current.started && !st.current.over) {
        e.preventDefault();
        drop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="game-surface">
      <p className="game-status">
        {over
          ? `Toppled at height ${score}.`
          : started
            ? `Height ${score}${combo > 1 ? ` · combo ×${combo}` : ""} · tap or Space`
            : "Stack slabs as high as you can. Perfect drops build combos."}
      </p>
      <canvas
        ref={canvasRef}
        className="arcade-canvas arcade-frame"
        style={{ width: W, maxWidth: "100%", aspectRatio: `${W} / ${H}`, touchAction: "manipulation" }}
        onPointerDown={drop}
      />
      {!started || over ? (
        <button type="button" className="primary-btn" onClick={reset}>
          {over ? "Play again" : "Start"}
        </button>
      ) : null}
    </div>
  );
}
