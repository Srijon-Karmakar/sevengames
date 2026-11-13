import { useState } from "react";
import type { GameProps } from "./index";

const N = 5;

function toggle(g: boolean[], i: number): boolean[] {
  const next = [...g];
  const r = Math.floor(i / N);
  const c = i % N;
  for (const [dr, dc] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const rr = r + dr;
    const cc = c + dc;
    if (rr >= 0 && rr < N && cc >= 0 && cc < N) next[rr * N + cc] = !next[rr * N + cc];
  }
  return next;
}

// Scramble by pressing random cells from a solved board, so it is always solvable.
function fresh(): boolean[] {
  let g = Array<boolean>(N * N).fill(false);
  for (let k = 0; k < 12; k += 1) g = toggle(g, Math.floor(Math.random() * N * N));
  return g.some(Boolean) ? g : fresh();
}

export default function LightsOut({ onFinish }: GameProps) {
  const [grid, setGrid] = useState<boolean[]>(fresh);
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState(false);

  function press(i: number) {
    if (done) return;
    const next = toggle(grid, i);
    const m = moves + 1;
    setGrid(next);
    setMoves(m);
    if (!next.some(Boolean)) {
      setDone(true);
      onFinish(Math.max(10, 200 - m * 5));
    }
  }

  function reset() {
    setGrid(fresh());
    setMoves(0);
    setDone(false);
  }

  return (
    <div className="game-surface">
      <p className="game-status">
        {done ? `Lights out in ${moves} moves!` : `Turn every light off. Moves: ${moves}`}
      </p>
      <div className="lights-grid">
        {grid.map((on, i) => (
          <button
            key={i}
            type="button"
            className={`light${on ? " on" : ""}`}
            onClick={() => press(i)}
            aria-label={`Light ${i + 1}`}
          />
        ))}
      </div>
      <button type="button" className="primary-btn" onClick={reset}>
        {done ? "Play again" : "New puzzle"}
      </button>
    </div>
  );
}
