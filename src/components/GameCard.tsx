import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import type { Game } from "../catalog";
import { scoreLabel } from "../catalog";

export function GameCard({ game, best }: { game: Game; best: number | null }) {
  return (
    <Link
      to={`/game/${game.id}`}
      className="game-card"
      style={{ "--accent": game.accent } as React.CSSProperties}
    >
      <div className="game-art" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
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
          </span>
        </div>
      </div>
    </Link>
  );
}
