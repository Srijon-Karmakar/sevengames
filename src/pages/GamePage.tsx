import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft, ExternalLink, Info, Maximize, Minimize, MonitorPlay } from "lucide-react";
import { GamePoster } from "../components/GamePoster";
import { getGame, scoreLabel } from "../catalog";
import { engines } from "../games";
import { useAuthContext } from "../context/AuthContext";
import { useLeaderboard, useSaveScore } from "../lib/scores";
import { useBestForGame } from "../hooks/useBest";
import Leaderboard from "../components/Leaderboard";
import { trackGame } from "../lib/track";
import { pushRecent } from "../lib/recent";
import "./game-page.css";

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
  const stageRef = useRef<HTMLElement>(null);
  // "full" = native Fullscreen API when available, otherwise a fixed overlay (e.g. iPhone Safari).
  const [full, setFull] = useState(false);

  useEffect(() => {
    const sync = () => {
      if (!document.fullscreenElement) setFull(false);
    };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
    };
    document.documentElement.classList.add("no-scroll");
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.classList.remove("no-scroll");
      window.removeEventListener("keydown", onKey);
    };
  }, [full]);

  const enterFull = useCallback(async () => {
    setFull(true);
    const el = stageRef.current;
    try {
      if (el?.requestFullscreen && !document.fullscreenElement) await el.requestFullscreen();
    } catch {
      /* fall back to the CSS overlay */
    }
  }, []);

  const exitFull = useCallback(() => {
    setFull(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    if (id && getGame(id)) {
      trackGame("game_start", id);
      pushRecent(id);
    }
  }, [id]);

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
      if (game) {
        trackGame("game_finish", game.id, score);
        await saveScore(game.id, score, 0);
      }
    },
    [game, saveScore],
  );

  return (
    <div className="page game-page gp" style={{ "--accent": game.accent } as React.CSSProperties}>
      <Link to="/games" className="back-link">
        <ChevronLeft size={18} />
        All games
      </Link>

      <header className="game-header">
        <GamePoster game={game} size="hero" />
        <div className="game-header-text">
          <p className="game-meta">
            {game.category} · {game.difficulty} · ~{game.minutes} min
          </p>
          <h1>{game.title}</h1>
          <p className="hero-sub">{game.description}</p>
        </div>
      </header>

      {!user ? (
        <p className="gp-guest">
          <Info size={15} aria-hidden="true" />
          <span>
            Playing as guest — scores stay on this device.{" "}
            <Link to={`/login?next=/game/${game.id}`}>Sign in</Link> to join the global leaderboard.
          </span>
        </p>
      ) : null}

      <div className="game-layout">
        {/* Glass frame: toolbar on top, the game edge-to-edge underneath */}
        <div className="gp-frame">
          <div className="gp-toolbar">
            <div className="gp-now">
              <span className="gp-dot" aria-hidden="true" />
              <span className="gp-now-title">{game.title}</span>
              <span className="gp-now-meta">{game.kind === "iframe" ? "Web game" : "Senevon original"}</span>
            </div>
            <div className="gp-modes" role="group" aria-label="How to play">
              <button type="button" className={full ? "" : "active"} aria-pressed={!full} onClick={exitFull}>
                <MonitorPlay size={15} />
                <span>Play here</span>
              </button>
              <button type="button" className={full ? "active" : ""} aria-pressed={full} onClick={enterFull}>
                <Maximize size={15} />
                <span>Full screen</span>
              </button>
              {game.kind === "iframe" ? (
                <a href={game.embedUrl} target="_blank" rel="noopener noreferrer" aria-label="Open original site">
                  <ExternalLink size={15} />
                  <span>Original site</span>
                </a>
              ) : null}
            </div>
          </div>

          <section ref={stageRef} className={`game-stage gp-stage${full ? " is-full" : ""}`}>
            {full ? (
              <button type="button" className="exit-full" onClick={exitFull} aria-label="Exit full screen">
                <Minimize size={16} />
                <span>Exit</span>
              </button>
            ) : null}
            {game.kind === "builtin" ? (
              <GameRunner gameId={game.engine} onScore={handleFinish} />
            ) : (
              <div className="iframe-wrap">
                <iframe src={game.embedUrl} title={game.title} allow="gamepad; fullscreen" />
              </div>
            )}
          </section>
        </div>
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
