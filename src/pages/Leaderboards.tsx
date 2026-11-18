import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Crown, Medal, Trophy } from "lucide-react";
import { games, scoreLabel, type Game } from "../catalog";
import { GamePoster } from "../components/GamePoster";
import { useAuthContext } from "../context/AuthContext";
import { isLowerBetter, useLeaderboard, useOverallLeaderboard } from "../lib/scores";
import { formatTokens } from "../lib/currency";
import "./account.css";
import "./leaderboards.css";

// only built-in games report scores
const boardGames = games.filter((g) => g.kind === "builtin");

type Row = { rank: number; userId: string; name: string; value: string; sub?: string };

/** Stable colour per player for their initial badge. */
const hueOf = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
};

function Initial({ id, name, size = 36 }: { id: string; name: string; size?: number }) {
  return (
    <span className="lb-initial" style={{ width: size, height: size, "--h": hueOf(id) } as React.CSSProperties} aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function Board({ rows, loading, error, you, unit }: { rows: Row[]; loading: boolean; error: string | null; you?: string; unit: string }) {
  if (loading) {
    return (
      <div className="lb-list">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="lb-row is-skeleton" />
        ))}
      </div>
    );
  }
  if (error) return <p className="lb-empty">{error}</p>;
  if (!rows.length) {
    return (
      <div className="lb-empty">
        <Trophy size={28} aria-hidden="true" />
        <p>No scores yet. Finish a round while signed in to take the top spot.</p>
        <Link className="ac-btn ac-btn-primary ac-btn-sm" to="/games">
          Play a game
        </Link>
      </div>
    );
  }

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  // podium order on screen: 2nd, 1st, 3rd
  const order = [podium[1], podium[0], podium[2]].filter(Boolean) as Row[];

  return (
    <>
      <ol className="lb-podium" aria-label="Top three">
        {order.map((r) => (
          <li key={r.userId} className={`lb-step place-${r.rank}${r.userId === you ? " is-you" : ""}`}>
            <span className="lb-step-badge" aria-hidden="true">
              {r.rank === 1 ? <Crown size={18} /> : <Medal size={16} />}
            </span>
            <Initial id={r.userId} name={r.name} size={r.rank === 1 ? 64 : 52} />
            <b className="lb-step-name" title={r.name}>
              {r.userId === you ? "You" : r.name}
            </b>
            <span className="lb-step-value">
              {r.value}
              <small> {unit}</small>
            </span>
            <span className="lb-step-base">{r.rank}</span>
          </li>
        ))}
      </ol>

      {rest.length ? (
        <ol className="lb-list" start={4}>
          {rest.map((r) => (
            <li key={r.userId} className={`lb-row${r.userId === you ? " is-you" : ""}`}>
              <span className="lb-rank">{r.rank}</span>
              <Initial id={r.userId} name={r.name} />
              <span className="lb-name">
                <b title={r.name}>{r.userId === you ? "You" : r.name}</b>
                {r.sub ? <small>{r.sub}</small> : null}
              </span>
              <span className="lb-value">
                {r.value}
                <small> {unit}</small>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </>
  );
}

function OverallBoard({ you }: { you?: string }) {
  const { rows, loading, error } = useOverallLeaderboard(50);
  const mapped: Row[] = rows.map((r) => ({
    rank: r.rank,
    userId: r.userId,
    name: r.displayName,
    value: formatTokens(r.points),
    sub: `${r.firsts} first place${r.firsts === 1 ? "" : "s"} · ${r.games} game${r.games === 1 ? "" : "s"} · ${formatTokens(r.rounds)} rounds`,
  }));
  return <Board rows={mapped} loading={loading} error={error} you={you} unit="pts" />;
}

function GameBoard({ game, you }: { game: Game; you?: string }) {
  const { leaders, loading, error } = useLeaderboard(game.id, 25);
  const mapped: Row[] = leaders.map((r) => ({ rank: r.rank, userId: r.userId, name: r.displayName, value: formatTokens(r.score) }));
  return <Board rows={mapped} loading={loading} error={error} you={you} unit={isLowerBetter(game.id) ? "s" : ""} />;
}

export default function Leaderboards() {
  const { user } = useAuthContext();
  const [params, setParams] = useSearchParams();
  const gameId = params.get("game");
  const game = useMemo(() => boardGames.find((g) => g.id === gameId) ?? null, [gameId]);

  useEffect(() => {
    document.title = "Leaderboards — Senevon Game Studio";
  }, []);

  // keep the selected tab in view on narrow screens
  useEffect(() => {
    document.querySelector(".lb-tab.on")?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [gameId]);

  const pick = (id: string | null) => setParams(id ? { game: id } : {}, { replace: true });

  return (
    <div className="acct lb">
      <section className="ac-card lb-hero">
        <span className="lb-hero-icon" aria-hidden="true">
          <Trophy size={26} />
        </span>
        <div>
          <h1 className="lb-title">Leaderboards</h1>
          <p className="ac-sub">
            {game
              ? `Top players in ${game.title} · ${scoreLabel(game)}, one entry per player.`
              : "Overall: points for every top-10 finish in each game (1st = 10 points)."}
          </p>
        </div>
        {!user ? (
          <Link className="ac-btn ac-btn-primary ac-btn-sm lb-hero-cta" to="/login?next=/leaderboards">
            Sign in to compete
          </Link>
        ) : game ? (
          <Link className="ac-btn ac-btn-primary ac-btn-sm lb-hero-cta" to={`/game/${game.id}`}>
            Play {game.title}
          </Link>
        ) : null}
      </section>

      <nav className="lb-tabs" aria-label="Choose a leaderboard">
        <button type="button" className={`lb-tab${!game ? " on" : ""}`} aria-pressed={!game} onClick={() => pick(null)}>
          <span className="lb-tab-icon" aria-hidden="true">
            <Crown size={16} />
          </span>
          Overall
        </button>
        {boardGames.map((g) => (
          <button key={g.id} type="button" className={`lb-tab${game?.id === g.id ? " on" : ""}`} aria-pressed={game?.id === g.id} onClick={() => pick(g.id)}>
            <span className="lb-tab-poster" aria-hidden="true">
              <GamePoster game={g} size="thumb" />
            </span>
            {g.title}
          </button>
        ))}
      </nav>

      <section className="ac-card lb-board" aria-live="polite">
        {game ? <GameBoard key={game.id} game={game} you={user?.id} /> : <OverallBoard you={user?.id} />}
      </section>
    </div>
  );
}
