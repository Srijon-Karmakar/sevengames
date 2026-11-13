import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuthContext } from "../context/AuthContext";
import { Avatar } from "../lib/auth";
import { games, scoreLabel } from "../catalog";
import { isLowerBetter, usePersonalScores } from "../lib/scores";

export default function Profile() {
  const auth = useAuthContext();
  const user = auth.user;
  const navigate = useNavigate();
  const { scores } = usePersonalScores(user);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/login?next=/profile", { replace: true });
      return;
    }
    const meta = user.user_metadata ?? {};
    setDisplayName(
      (meta.full_name as string | undefined) || (meta.name as string | undefined) || (user.email ?? "Player"),
    );
  }, [user, navigate]);

  if (!user) return null;

  const totalPlays = scores.length;
  const playedGameIds = [...new Set(scores.map((score) => score.gameId))];
  const favorite = playedGameIds[0] ? games.find((game) => game.id === playedGameIds[0]) : null;

  function bestFor(gameId: string) {
    const lowerBetter = isLowerBetter(gameId);
    const rows = scores.filter((score) => score.gameId === gameId);
    if (!rows.length) return null;
    return rows.reduce(
      (best, row) => (lowerBetter ? (row.score < best ? row.score : best) : row.score > best ? row.score : best),
      rows[0].score,
    );
  }

  return (
    <div className="page narrow profile-page">
      <div className="profile-head card">
        <Avatar user={user} />
        <div>
          <p className="eyebrow">Global account</p>
          <h1>{displayName}</h1>
          <p className="hero-sub">{user.email}</p>
        </div>
        <button
          type="button"
          className="ghost-btn"
          onClick={async () => {
            await auth.signOut();
            navigate("/");
          }}
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>

      <div className="stats-row">
        <div className="metric card">
          <strong>{totalPlays}</strong>
          <span>Rounds played</span>
        </div>
        <div className="metric card">
          <strong>{playedGameIds.length}</strong>
          <span>Games tried</span>
        </div>
        <div className="metric card">
          <strong>{favorite ? favorite.title : "—"}</strong>
          <span>Latest game</span>
        </div>
      </div>

      <section className="profile-scores">
        <h2>Your bests</h2>
        {playedGameIds.length === 0 ? (
          <p className="empty-note">
            No rounds yet. <Link to="/">Pick a game</Link> and set your first record.
          </p>
        ) : (
          <ul className="profile-score-list">
            {playedGameIds.map((gameId) => {
              const game = games.find((item) => item.id === gameId);
              if (!game) return null;
              return (
                <li key={gameId}>
                  <Link to={`/game/${game.id}`}>{game.title}</Link>
                  <span>
                    {scoreLabel(game)}: {bestFor(gameId)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
