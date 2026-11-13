import { useEffect, useRef, useState } from "react";
import type { GameProps } from "./index";

const W = 300;
const H = 420;
const BLOCK_H = 22;

type Block = { x: number; w: number };

export default function StackGame({ onFinish }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [started, setStarted] = useState(false);
  const stateRef = useRef({ tower: [] as Block[], x: 0, w: 140, dir: 1, speed: 2.2, over: false });

  function reset() {
    const s = stateRef.current;
    s.tower = [{ x: (W - 140) / 2, w: 140 }];
    s.x = 0;
    s.w = 140;
    s.dir = 1;
    s.speed = 2.2;
    s.over = false;
    setScore(0);
    setOver(false);
    setStarted(true);
  }

  function drop() {
    const s = stateRef.current;
    if (!started || s.over) return;
    const prev = s.tower[s.tower.length - 1];
    const left = Math.max(s.x, prev.x);
    const right = Math.min(s.x + s.w, prev.x + prev.w);
    const overlap = right - left;
    if (overlap <= 0) {
      s.over = true;
      setOver(true);
      onFinish(s.tower.length - 1);
      return;
    }
    s.tower.push({ x: left, w: overlap });
    s.w = overlap;
    s.speed = Math.min(6, s.speed + 0.12);
    setScore(s.tower.length - 1);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const draw = () => {
      const s = stateRef.current;
      if (started && !s.over) {
        s.x += s.dir * s.speed;
        if (s.x + s.w > W) {
          s.x = W - s.w;
          s.dir = -1;
        }
        if (s.x < 0) {
          s.x = 0;
          s.dir = 1;
        }
      }
      ctx.clearRect(0, 0, W, H);
      const visible = Math.floor(H / BLOCK_H) - 2;
      const offset = Math.max(0, s.tower.length - visible);
      s.tower.forEach((b, i) => {
        const y = H - (i - offset + 1) * BLOCK_H;
        ctx.fillStyle = `hsl(${(i * 24) % 360} 70% 58%)`;
        ctx.fillRect(b.x, y, b.w, BLOCK_H - 2);
      });
      if (started && !s.over) {
        const y = H - (s.tower.length - offset + 1) * BLOCK_H;
        ctx.fillStyle = `hsl(${(s.tower.length * 24) % 360} 70% 58%)`;
        ctx.fillRect(s.x, y, s.w, BLOCK_H - 2);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [started]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
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
            ? `Height ${score} · tap or press Space to drop`
            : "Stack blocks as high as you can."}
      </p>
      <canvas ref={canvasRef} width={W} height={H} className="arcade-canvas" onPointerDown={drop} />
      {!started || over ? (
        <button type="button" className="primary-btn" onClick={reset}>
          {over ? "Play again" : "Start"}
        </button>
      ) : null}
    </div>
  );
}
