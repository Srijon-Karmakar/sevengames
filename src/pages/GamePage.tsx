import { useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { getGame, scoreLabel } from "../catalog";
import { engines } from "../games";
import { useAuthContext } from "../context/AuthContext";
import { useLeaderboard, useSaveScore } from "../lib/scores";
import { useBestForGame } from "../hooks/useBest";
import Leaderboard from "../components/Leaderboard";

function GameRunner({ gameId, onScore }: { gameId: string; onScore: (score: number) => void }) {
  const Engine = engines[gameId as keyof typeof engines];
  if (!Engine) return <p className="empty-note">This game is not available yet.</p>;
  return <Engine onFinish={onScore} />;
}

export default function GamePage() {
  const { id } = useParams();
  const game = getGame(id);
  const auth = useAuthContext();
  const user = auth.user;
  const saveScore = useSaveScore(user);
  const best = useBestForGame(id ?? "");
  const { leaders, loading } = useLeaderboard(id ?? "");

  if (!game) {
    return (
      <div className="page narrow">
        <h1>Game not found</h1>
        <p className="hero-sub">It may have been renamed. Head back to the library.</p>
        <Link className="primary-btn" to="/">
          Back to games
        </Link>
      </div>
    );
  }

  const handleFinish = useCallback(
    async (score: number) => {
      if (game) await saveScore(game.id, score, 0);
    },
    [game, saveScore],
  );

  return (
    <div className="page game-page">
      <Link to="/" className="back-link">
        <ChevronLeft size={18} />
        All games
      </Link>

      <header className="game-header" style={{ "--accent": game.accent } as React.CSSProperties}>
        <p className="game-meta">
          {game.category} · {game.difficulty} · ~{game.minutes} min
        </p>
        <h1>{game.title}</h1>
        <p className="hero-sub">{game.description}</p>
      </header>

      {!user ? (
        <div className="signin-hint">
          <p>
            Playing as guest — scores save to this device only.{" "}
            <Link to={`/login?next=/game/${game.id}`}>Sign in</Link> to save them to your account and
            appear on the global leaderboard.
          </p>
        </div>
      ) : null}

      <div className="game-layout">
        <section className="game-stage card">
          {game.kind === "builtin" ? (
            <GameRunner gameId={game.engine} onScore={handleFinish} />
          ) : (
            <div className="iframe-wrap">
              <iframe src={game.embedUrl} title={game.title} allow="gamepad; fullscreen" />
            </div>
          )}
        </section>
        <Leaderboard
          leaders={leaders}
          loading={loading}
          scoreLabel={scoreLabel(game)}
          userId={user?.id}
          personalBest={best}
        />
      </div>
    </div>
  );
}
