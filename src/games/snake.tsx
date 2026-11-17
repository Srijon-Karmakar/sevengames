import { useCallback, useEffect, useRef, useState } from "react";
import type { GameProps } from "./index";
import { Particles, Shake, glow, reducedMotion, rrect, setupCanvas } from "./fx";

/*
 * Snake: grid logic on a fixed tick, rendered every frame with the body gliding smoothly between
 * cells (interpolated), a neon gradient body, a pulsing glowing fruit, particle bursts and
 * floating "+10" on eating, and a shake + flash on game over. Speeds up gently as you grow.
 */

const GRID = 14;
const SIZE = 336; // logical canvas size
const CELL = SIZE / GRID;
const BASE_TICK = 150;
const MIN_TICK = 80;

type Point = { x: number; y: number };
type Popup = { x: number; y: number; t: number };

function randomFood(snake: Point[]): Point {
  let p: Point;
  do {
    p = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
  } while (snake.some((s) => s.x === p.x && s.y === p.y));
  return p;
}

export default function SnakeGame({ onFinish }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const g = useRef({
    snake: [{ x: 6, y: 7 }] as Point[],
    prev: [{ x: 6, y: 7 }] as Point[],
    dir: { x: 1, y: 0 } as Point,
    queue: [] as Point[],
    food: { x: 10, y: 7 } as Point,
    score: 0,
    running: false,
    acc: 0,
    tick: BASE_TICK,
    flash: 0,
    popups: [] as Popup[],
    parts: new Particles(200),
    shake: new Shake(),
  });

  const finish = useCallback(() => {
    const s = g.current;
    s.running = false;
    s.flash = 1;
    s.shake.kick(10);
    const head = s.snake[0];
    s.parts.burst((head.x + 0.5) * CELL, (head.y + 0.5) * CELL, 40, "rgba(255,80,110,1)", { speed: 220, life: 0.9, size: 4 });
    setRunning(false);
    setOver(true);
    onFinish(s.score * 10);
  }, [onFinish]);

  // ---- render + logic loop ----
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = setupCanvas(canvas, SIZE, SIZE);
    const s = g.current;
    const calm = reducedMotion();

    // Pre-render the board background once (checker + vignette).
    const bg = document.createElement("canvas");
    bg.width = canvas.width;
    bg.height = canvas.height;
    const b = bg.getContext("2d")!;
    b.scale(canvas.width / SIZE, canvas.height / SIZE);
    b.fillStyle = "#07090d";
    b.fillRect(0, 0, SIZE, SIZE);
    for (let r = 0; r < GRID; r++)
      for (let c = 0; c < GRID; c++) {
        b.fillStyle = (r + c) % 2 ? "#0b0f15" : "#0d121a";
        b.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    const vg = b.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.2, SIZE / 2, SIZE / 2, SIZE * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.55)");
    b.fillStyle = vg;
    b.fillRect(0, 0, SIZE, SIZE);

    const step = () => {
      if (s.queue.length) {
        const d = s.queue.shift()!;
        if (!(d.x === -s.dir.x && d.y === -s.dir.y)) s.dir = d;
      }
      const head = s.snake[0];
      const next = { x: (head.x + s.dir.x + GRID) % GRID, y: (head.y + s.dir.y + GRID) % GRID };
      const ate = next.x === s.food.x && next.y === s.food.y;
      // the tail moves away this tick unless we eat, so it doesn't count as a collision
      const body = ate ? s.snake : s.snake.slice(0, -1);
      if (body.some((p) => p.x === next.x && p.y === next.y)) {
        finish();
        return;
      }
      s.prev = s.snake.map((p) => ({ ...p }));
      const grown = [next, ...s.snake];
      if (ate) {
        s.score += 1;
        setScore(s.score);
        const fx = (s.food.x + 0.5) * CELL;
        const fy = (s.food.y + 0.5) * CELL;
        s.parts.burst(fx, fy, 26, "rgba(255,90,120,1)", { speed: 170, life: 0.6, size: 3.5 });
        s.parts.burst(fx, fy, 14, "rgba(255,210,120,1)", { speed: 110, life: 0.5, size: 2.5 });
        s.popups.push({ x: fx, y: fy, t: 0 });
        s.shake.kick(3);
        s.food = randomFood(grown);
        s.tick = Math.max(MIN_TICK, BASE_TICK - s.score * 3);
        s.prev.push({ ...s.prev[s.prev.length - 1] }); // new tail segment grows in place
      } else grown.pop();
      s.snake = grown;
    };

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (s.running) {
        s.acc += dt * 1000;
        while (s.acc >= s.tick && s.running) {
          s.acc -= s.tick;
          step();
        }
      }
      const t = s.running ? Math.min(1, s.acc / s.tick) : 1;
      s.parts.update(dt);

      ctx.save();
      s.shake.apply(ctx, dt);
      ctx.drawImage(bg, 0, 0, SIZE, SIZE);

      // fruit: pulsing orb with glow
      const pulse = calm ? 1 : 1 + Math.sin(now / 180) * 0.08;
      const fx = (s.food.x + 0.5) * CELL;
      const fy = (s.food.y + 0.5) * CELL;
      glow(ctx, fx, fy, CELL * 1.6 * pulse, "rgba(255,70,110,0.9)", 0.8);
      const fg = ctx.createRadialGradient(fx - 3, fy - 4, 1, fx, fy, CELL * 0.4);
      fg.addColorStop(0, "#ffd0da");
      fg.addColorStop(0.4, "#ff4d75");
      fg.addColorStop(1, "#c3123c");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(fx, fy, CELL * 0.34 * pulse, 0, Math.PI * 2);
      ctx.fill();

      // snake: interpolated segments, head → tail colour gradient
      const n = s.snake.length;
      const pts: Point[] = s.snake.map((p, i) => {
        const q = s.prev[i] ?? p;
        // no interpolation across the wrap-around edge
        if (Math.abs(q.x - p.x) > 1 || Math.abs(q.y - p.y) > 1) return { x: (p.x + 0.5) * CELL, y: (p.y + 0.5) * CELL };
        return { x: (q.x + (p.x - q.x) * t + 0.5) * CELL, y: (q.y + (p.y - q.y) * t + 0.5) * CELL };
      });
      glow(ctx, pts[0].x, pts[0].y, CELL * 1.5, "rgba(60,255,170,0.8)", 0.55);
      for (let i = n - 1; i >= 0; i--) {
        const k = n === 1 ? 0 : i / (n - 1);
        const size = CELL * (0.86 - k * 0.22);
        ctx.fillStyle = `hsl(${152 - k * 40} 90% ${58 - k * 14}%)`;
        rrect(ctx, pts[i].x - size / 2, pts[i].y - size / 2, size, size, size * 0.38);
        ctx.fill();
      }
      // head highlight + eyes looking where it's going
      const h = pts[0];
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      rrect(ctx, h.x - CELL * 0.3, h.y - CELL * 0.36, CELL * 0.6, CELL * 0.22, 4);
      ctx.fill();
      const ex = s.dir.y !== 0 ? 0.18 : 0;
      const ey = s.dir.x !== 0 ? 0.18 : 0;
      for (const sgn of [-1, 1]) {
        const x = h.x + (s.dir.x * 0.16 + ex * sgn) * CELL;
        const y = h.y + (s.dir.y * 0.16 + ey * sgn) * CELL;
        ctx.fillStyle = "#04140c";
        ctx.beginPath();
        ctx.arc(x, y, CELL * 0.09, 0, Math.PI * 2);
        ctx.fill();
      }

      s.parts.draw(ctx);

      // floating +10
      ctx.font = "700 14px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      s.popups = s.popups.filter((p) => (p.t += dt) < 0.8);
      for (const p of s.popups) {
        ctx.globalAlpha = 1 - p.t / 0.8;
        ctx.fillStyle = "#ffe08a";
        ctx.fillText("+10", p.x, p.y - 10 - p.t * 40);
      }
      ctx.globalAlpha = 1;

      if (s.flash > 0) {
        ctx.fillStyle = `rgba(255,60,90,${s.flash * 0.35})`;
        ctx.fillRect(0, 0, SIZE, SIZE);
        s.flash = Math.max(0, s.flash - dt * 2);
      }
      ctx.restore();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [finish]);

  const turn = useCallback((x: number, y: number) => {
    const s = g.current;
    const last = s.queue[s.queue.length - 1] ?? s.dir;
    if ((last.x === -x && last.y === -y) || (last.x === x && last.y === y)) return;
    if (s.queue.length < 2) s.queue.push({ x, y }); // buffer quick double-turns
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const map: Record<string, Point> = {
        ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 },
      };
      const dir = map[e.key];
      if (dir && g.current.running) {
        e.preventDefault();
        turn(dir.x, dir.y);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  const touch = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchMove(e: React.TouchEvent) {
    // turn as soon as the finger has clearly moved (feels much snappier than waiting for touchend)
    const t0 = touch.current;
    if (!t0) return;
    const dx = e.touches[0].clientX - t0.x;
    const dy = e.touches[0].clientY - t0.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0);
    else turn(0, dy > 0 ? 1 : -1);
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  function start() {
    const s = g.current;
    s.snake = [{ x: 6, y: 7 }, { x: 5, y: 7 }, { x: 4, y: 7 }];
    s.prev = s.snake.map((p) => ({ ...p }));
    s.dir = { x: 1, y: 0 };
    s.queue = [];
    s.food = randomFood(s.snake);
    s.score = 0;
    s.acc = 0;
    s.tick = BASE_TICK;
    s.flash = 0;
    s.popups = [];
    s.parts.clear();
    s.running = true;
    setScore(0);
    setOver(false);
    setRunning(true);
  }

  return (
    <div className="game-surface">
      <p className="game-status">
        {running ? `Score ${score * 10}` : over ? `Game over — score ${score * 10}` : "Swipe, arrow keys or WASD"}
      </p>
      <div className="snake-stage arcade-frame" onTouchStart={onTouchStart} onTouchMove={onTouchMove}>
        <canvas ref={canvasRef} style={{ width: SIZE, maxWidth: "100%", aspectRatio: "1" }} aria-label="Snake board" />
      </div>
      {!running ? (
        <button type="button" className="primary-btn" onClick={start}>
          {over ? "Play again" : "Start"}
        </button>
      ) : null}
    </div>
  );
}
