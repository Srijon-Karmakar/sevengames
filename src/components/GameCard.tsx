import { Link } from "react-router-dom";
import { ArrowUpRight, Play } from "lucide-react";
import type { Game } from "../catalog";
import { scoreLabel } from "../catalog";
import { GamePoster } from "./GamePoster";

export function GameCard({ game, best, index = 0 }: { game: Game; best: number | null; index?: number }) {
  // Pointer position drives the spotlight + subtle 3D tilt (see ui.css).
  function onMove(e: React.PointerEvent<HTMLAnchorElement>) {
    if (e.pointerType !== "mouse") return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
    el.style.setProperty("--rx", `${((0.5 - y) * 6).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${((x - 0.5) * 8).toFixed(2)}deg`);
  }
  function onLeave(e: React.PointerEvent<HTMLAnchorElement>) {
    const el = e.currentTarget;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  return (
    <Link
      to={`/game/${game.id}`}
      className="game-card"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ "--accent": game.accent, "--i": Math.min(index, 14) } as React.CSSProperties}
    >
      <GamePoster game={game} />
      <div className="game-card-body">
        <p className="game-meta">
          {game.category} · {game.difficulty} · {game.minutes} min
        </p>
        <h3>{game.title}</h3>
        <p className="game-desc">{game.description}</p>
        <div className="game-card-footer">
          <span>{best !== null ? `${scoreLabel(game)}: ${best}` : scoreLabel(game)}</span>
          <span className="play-chip">
            <Play size={14} />
            Play
            <ArrowUpRight size={14} className="play-arrow" />
          </span>
        </div>
      </div>
    </Link>
  );
}
