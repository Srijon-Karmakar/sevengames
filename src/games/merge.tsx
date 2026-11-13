import { useCallback, useEffect, useRef, useState } from "react";
import type { GameProps } from "./index";

const SIZE = 4;

type Board = number[][];

function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(0));
}

function spawn(board: Board): Board {
  const open: Array<[number, number]> = [];
  board.forEach((row, r) =>
    row.forEach((value, c) => {
      if (value === 0) open.push([r, c]);
    }),
  );
  if (!open.length) return board;
  const [r, c] = open[Math.floor(Math.random() * open.length)];
  const next = board.map((row) => [...row]);
  next[r][c] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function slideRowLeft(row: number[]): { row: number[]; gained: number } {
  const tiles = row.filter((value) => value !== 0);
  const output: number[] = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i += 1) {
    if (tiles[i] === tiles[i + 1]) {
      output.push(tiles[i] * 2);
      gained += tiles[i] * 2;
      i += 1;
    } else {
      output.push(tiles[i]);
    }
  }
  while (output.length < SIZE) output.push(0);
  return { row: output, gained };
}

function move(board: Board, direction: "left" | "right" | "up" | "down"): { board: Board; gained: number; moved: boolean } {
  let gained = 0;
  let moved = false;
  const rotated = rotateForDirection(board, direction);
  const processed = rotated.map((row) => {
    const result = slideRowLeft(row);
    gained += result.gained;
    return result.row;
  });
  const restored = rotateForDirection(processed, reverseDirection(direction));
  moved = JSON.stringify(restored) !== JSON.stringify(board);
  return { board: restored, gained, moved };
}

function rotateForDirection(board: Board, direction: "left" | "right" | "up" | "down"): Board {
  if (direction === "left") return board;
  if (direction === "right") return board.map((row) => [...row].reverse());
  // transpose for vertical moves
  const transposed: Board = board[0].map((_, c) => board.map((row) => row[c]));
  return direction === "up" ? transposed : transposed.map((row) => [...row].reverse());
}

function reverseDirection(direction: "left" | "right" | "up" | "down") {
  return direction === "left" ? "right" : direction === "right" ? "left" : direction === "up" ? "down" : "up";
}

function hasMoves(board: Board) {
  return (["left", "right", "up", "down"] as const).some((direction) => move(board, direction).moved);
}

const TILE_STYLES: Record<number, { background: string; color: string }> = {
  2: { background: "#f5f5f7", color: "#1d1d1f" },
  4: { background: "#ede9e3", color: "#1d1d1f" },
  8: { background: "#f5d9b0", color: "#1d1d1f" },
  16: { background: "#f2b26b", color: "#fff" },
  32: { background: "#f28d5b", color: "#fff" },
  64: { background: "#f26b3a", color: "#fff" },
  128: { background: "#ead79b", color: "#1d1d1f" },
  256: { background: "#e3c96b", color: "#1d1d1f" },
  512: { background: "#dfb43f", color: "#fff" },
  1024: { background: "#d69e2e", color: "#fff" },
  2048: { background: "#0071e3", color: "#fff" },
};

export default function MergeGame({ onFinish }: GameProps) {
  const [board, setBoard] = useState<Board>(() => spawn(spawn(emptyBoard())));
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const finishedRef = useRef(false);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const push = useCallback(
    (direction: "left" | "right" | "up" | "down") => {
      if (over) return;
      setBoard((current) => {
        const result = move(current, direction);
        if (!result.moved) return current;
        const next = spawn(result.board);
        setScore((value) => value + result.gained);
        if (!hasMoves(next)) setOver(true);
        return next;
      });
    },
    [over],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const map: Record<string, "left" | "right" | "up" | "down"> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
      };
      const direction = map[event.key];
      if (direction) {
        event.preventDefault();
        push(direction);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [push]);

  useEffect(() => {
    if (over && !finishedRef.current) {
      finishedRef.current = true;
      onFinish(score);
    }
  }, [over, score, onFinish]);

  function onTouchStart(event: React.TouchEvent) {
    const touch = event.touches[0];
    touchRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(event: React.TouchEvent) {
    if (!touchRef.current) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchRef.current.x;
    const dy = touch.clientY - touchRef.current.y;
    touchRef.current = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) push(dx > 0 ? "right" : "left");
    else push(dy > 0 ? "down" : "up");
  }

  function reset() {
    finishedRef.current = false;
    setBoard(spawn(spawn(emptyBoard())));
    setScore(0);
    setOver(false);
  }

  return (
    <div className="game-surface">
      <p className="game-status">
        Score {score}
        {over ? " — no moves left" : ""}
      </p>
      <div
        className="merge-board"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {board.flat().map((value, index) => (
          <div
            key={index}
            className={`merge-tile${value ? " filled" : ""}`}
            style={
              value
                ? {
                    background: TILE_STYLES[value]?.background ?? "#0071e3",
                    color: TILE_STYLES[value]?.color ?? "#fff",
                  }
                : undefined
            }
          >
            {value || ""}
          </div>
        ))}
      </div>
      <p className="game-hint">Arrow keys or swipe to move.</p>
      <button type="button" className="ghost-btn" onClick={reset}>
        New game
      </button>
    </div>
  );
}
