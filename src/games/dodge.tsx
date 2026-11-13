import { useEffect, useRef, useState } from "react";
import type { GameProps } from "./index";

const W = 300;
const H = 420;
const P_W = 40;
const P_H = 14;

type Rock = { x: number; y: number; s: number; v: number };

export default function DodgeGame({ onFinish }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [score, setScore] = useState(0);
  const st = useRef({ px: W / 2, left: false, right: false, rocks: [] as Rock[], t: 0, spawn: 0 });
  const finishedRef = useRef(false);

  function start() {
    st.current = { px: W / 2, left: false, right: false, rocks: [], t: 0, spawn: 0 };
    finishedRef.current = false;
    setScore(0);
    setOver(false);
    setRunning(true);
  }

  useEffect(() => {
    const set = (e: KeyboardEvent, value: boolean) => {
      if (e.key === "ArrowLeft" || e.key === "a") st.current.left = value;
      if (e.key === "ArrowRight" || e.key === "d") st.current.right = value;
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
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = st.current;
      if (running) {
        s.t += dt;
        s.spawn -= dt;
        if (s.left) s.px -= 260 * dt;
        if (s.right) s.px += 260 * dt;
        s.px = Math.max(P_W / 2, Math.min(W - P_W / 2, s.px));
        if (s.spawn <= 0) {
          const size = 16 + Math.random() * 22;
          s.rocks.push({
            x: Math.random() * (W - size),
            y: -size,
            s: size,
            v: 120 + s.t * 6 + Math.random() * 60,
          });
          s.spawn = Math.max(0.22, 0.7 - s.t * 0.01);
        }
        for (const r of s.rocks) r.y += r.v * dt;
        s.rocks = s.rocks.filter((r) => r.y < H + 50);
        const py = H - 30;
        const hit = s.rocks.some(
          (r) =>
            r.x < s.px + P_W / 2 && r.x + r.s > s.px - P_W / 2 && r.y < py + P_H && r.y + r.s > py,
        );
        setScore(Math.floor(s.t * 10));
        if (hit && !finishedRef.current) {
          finishedRef.current = true;
          setRunning(false);
          setOver(true);
          onFinish(Math.floor(s.t * 10));
        }
      }
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#ff375f";
      for (const r of s.rocks) ctx.fillRect(r.x, r.y, r.s, r.s);
      ctx.fillStyle = "#0071e3";
      ctx.fillRect(s.px - P_W / 2, H - 30, P_W, P_H);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function drag(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!running) return;
    const rect = e.currentTarget.getBoundingClientRect();
    st.current.px = ((e.clientX - rect.left) / rect.width) * W;
  }

  return (
    <div className="game-surface">
      <p className="game-status">
        {over
          ? `Crashed! Score ${score}.`
          : running
            ? `Score ${score}`
            : "Dodge the falling blocks. Arrow keys or drag to move."}
      </p>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="arcade-canvas"
        onPointerMove={drag}
        onPointerDown={drag}
      />
      {!running ? (
        <button type="button" className="primary-btn" onClick={start}>
          {over ? "Play again" : "Start"}
        </button>
      ) : null}
    </div>
  );
}
