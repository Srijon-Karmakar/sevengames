import { useCallback, useEffect, useRef, useState } from "react";
import type { GameProps } from "./index";

const GRID = 12;
const TICK_MS = 160;

type Point = { x: number; y: number };

function randomFood(snake: Point[]): Point {
  let point: Point;
  do {
    point = {
      x: Math.floor(Math.random() * GRID),
      y: Math.floor(Math.random() * GRID),
    };
  } while (snake.some((s) => s.x === point.x && s.y === point.y));
  return point;
}

export default function SnakeGame({ onFinish }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snakeRef = useRef<Point[]>([{ x: 6, y: 6 }]);
  const dirRef = useRef<Point>({ x: 1, y: 0 });
  const queuedDirRef = useRef<Point | null>(null);
  const foodRef = useRef<Point>({ x: 9, y: 6 });
  const scoreRef = useRef(0);
  const runningRef = useRef(false);
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cell = canvas.width / GRID;
    ctx.fillStyle = "#050506";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // subtle grid
    ctx.fillStyle = "#141417";
    for (let r = 0; r < GRID; r += 1) {
      for (let c = 0; c < GRID; c += 1) {
        if ((r + c) % 2 === 0) ctx.fillRect(c * cell, r * cell, cell, cell);
        }
    }

    // food
    ctx.fillStyle = "#ff375f";
    const fx = foodRef.current.x * cell;
    const fy = foodRef.current.y * cell;
    ctx.beginPath();
    ctx.arc(fx + cell / 2, fy + cell / 2, cell * 0.32, 0, Math.PI * 2);
    ctx.fill();

    // snake
    ctx.fillStyle = "#30d158";
    snakeRef.current.forEach((s, index) => {
      ctx.fillStyle = index === 0 ? "#28a745" : "#30d158";
      ctx.fillRect(s.x * cell + 1, s.y * cell + 1, cell - 2, cell - 2);
    });
  }, []);

  const finish = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    setOver(true);
    onFinish(scoreRef.current * 10);
  }, [onFinish]);

  const step = useCallback(() => {
    if (!runningRef.current) return;

    if (queuedDirRef.current) {
      dirRef.current = queuedDirRef.current;
      queuedDirRef.current = null;
    }

    const head = snakeRef.current[0];
    const next = {
      x: (head.x + dirRef.current.x + GRID) % GRID,
      y: (head.y + dirRef.current.y + GRID) % GRID,
    };

    if (snakeRef.current.some((s) => s.x === next.x && s.y === next.y)) {
      finish();
      return;
    }

    const food = foodRef.current;
    const ate = next.x === food.x && next.y === food.y;
    const nextSnake = [next, ...snakeRef.current];
    if (ate) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      foodRef.current = randomFood(nextSnake);
    } else {
      nextSnake.pop();
    }
    snakeRef.current = nextSnake;
    draw();
  }, [draw, finish]);

  useEffect(() => {
    if (!running) return;
    draw();
    const interval = window.setInterval(step, TICK_MS);
    return () => window.clearInterval(interval);
  }, [running, step, draw]);

  const turn = useCallback((x: number, y: number) => {
    const current = dirRef.current;
    if (current.x === -x && current.y === -y) return; // no reversing
    queuedDirRef.current = { x, y };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const map: Record<string, Point> = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
      };
      const dir = map[event.key];
      if (dir) {
        event.preventDefault();
        turn(dir.x, dir.y);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  function onTouchStart(event: React.TouchEvent) {
    const touch = event.touches[0];
    (event.currentTarget as HTMLElement).dataset.sx = String(touch.clientX);
    (event.currentTarget as HTMLElement).dataset.sy = String(touch.clientY);
  }

  function onTouchEnd(event: React.TouchEvent) {
    const el = event.currentTarget as HTMLElement;
    const sx = Number(el.dataset.sx);
    const sy = Number(el.dataset.sy);
    const touch = event.changedTouches[0];
    const dx = touch.clientX - sx;
    const dy = touch.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0);
    else turn(0, dy > 0 ? 1 : -1);
  }

  function start() {
    snakeRef.current = [{ x: 6, y: 6 }];
    dirRef.current = { x: 1, y: 0 };
    queuedDirRef.current = null;
    foodRef.current = randomFood(snakeRef.current);
    scoreRef.current = 0;
    setScore(0);
    setOver(false);
    setRunning(true);
  }

  return (
    <div className="game-surface">
      <p className="game-status">
        {running ? `Score ${score}` : over ? `Game over — score ${score}` : "Swipe or use arrow keys"}
      </p>
      <div
        className="snake-stage"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <canvas ref={canvasRef} width={312} height={312} aria-label="Snake board" />
      </div>
      {!running ? (
        <button type="button" className="primary-btn" onClick={start}>
          {over ? "Play again" : "Start"}
        </button>
      ) : null}
    </div>
  );
}
