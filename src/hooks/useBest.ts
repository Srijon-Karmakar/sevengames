import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { isLowerBetter, readLocalScores, type ScoreRow } from "../lib/scores";
import { supabase } from "../supabase";

function bestOf(rows: ScoreRow[], lowerBetter: boolean) {
  if (!rows.length) return null;
  return rows.reduce((best, row) =>
    lowerBetter ? (row.score < best.score ? row : best) : row.score > best.score ? row : best,
  ).score;
}

export function useBest(user: User | null, gameId: string) {
  const [best, setBest] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      setBest(null);
      return;
    }

    // Instant local value, then refine from Supabase
    setBest(bestOf(readLocalScores(user.id).filter((row) => row.gameId === gameId), isLowerBetter(gameId)));

    if (!supabase) return;

    supabase
      .from("game_scores")
      .select("score")
      .eq("user_id", user.id)
      .eq("game_id", gameId)
      .then(({ data }) => {
        if (!data) return;
        setBest(
          bestOf(
            data.map((row) => ({
              gameId,
              score: row.score,
              seconds: 0,
              createdAt: "",
            })),
            isLowerBetter(gameId),
          ),
        );
      });
  }, [user, gameId]);

  return best;
}

// Convenience wrapper for places where user comes from context
import { useAuthContext } from "../context/AuthContext";

export function useBestForGame(gameId: string) {
  return useBest(useAuthContext().user, gameId);
}
