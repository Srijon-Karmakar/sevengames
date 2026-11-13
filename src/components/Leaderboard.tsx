import { Trophy } from "lucide-react";
import type { LeaderRow } from "../lib/scores";

export default function Leaderboard({
  leaders,
  loading,
  scoreLabel,
  userId,
  personalBest,
}: {
  leaders: LeaderRow[];
  loading: boolean;
  scoreLabel: string;
  userId: string | undefined;
  personalBest: number | null;
}) {
  return (
    <aside className="leaderboard">
      <h2>
        <Trophy size={16} />
        {scoreLabel} — Top 10
      </h2>

      {loading ? (
        <p className="leaderboard-empty">Loading…</p>
      ) : leaders.length === 0 ? (
        <p className="leaderboard-empty">No scores yet — be the first on the board.</p>
      ) : (
        <ol className="leaderboard-list">
          {leaders.map((row) => {
            const isYou = row.userId === userId;
            return (
              <li key={`${row.rank}-${row.userId}`} className={isYou ? "you" : ""}>
                <span className="rank">{row.rank}</span>
                <span className="name">{isYou ? "You" : row.displayName}</span>
                <span className="value">{row.score}</span>
              </li>
            );
          })}
        </ol>
      )}

      {userId && personalBest !== null ? (
        <p className="leaderboard-personal">Your best: {personalBest}</p>
      ) : null}
      {!userId ? <p className="leaderboard-personal">Sign in to compete globally.</p> : null}
    </aside>
  );
}
