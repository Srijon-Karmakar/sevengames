import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../supabase";

export type ScoreRow = {
  gameId: string;
  score: number;
  seconds: number;
  createdAt: string;
};

export type LeaderRow = {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  isYou: boolean;
};

export function isLowerBetter(gameId: string) {
  return gameId === "minefield" || gameId === "slide";
}

export function personalKey(userId: string) {
  return `7games:scores:${userId}`;
}

export function readLocalScores(userId: string): ScoreRow[] {
  try {
    const raw = window.localStorage.getItem(personalKey(userId));
    return raw ? (JSON.parse(raw) as ScoreRow[]) : [];
  } catch {
    return [];
  }
}

export function writeLocalScores(userId: string, scores: ScoreRow[]) {
  try {
    window.localStorage.setItem(personalKey(userId), JSON.stringify(scores.slice(0, 80)));
  } catch {
    // storage unavailable — ignore
  }
}

function bestOf(rows: ScoreRow[], lowerBetter: boolean) {
  if (!rows.length) return null;
  return rows.reduce((best, row) =>
    lowerBetter ? row.score < best.score ? row : best : row.score > best.score ? row : best,
  );
}

export function usePersonalScores(user: User | null) {
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setScores([]);
      setLoading(false);
      return;
    }

    const local = readLocalScores(user.id);
    setScores(local);
    setLoading(false);

    if (!supabase) return;

    supabase
      .from("game_scores")
      .select("game_id, score, seconds, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(80)
      .then(({ data }) => {
        if (!data) return;
        const rows: ScoreRow[] = data.map((row) => ({
          gameId: row.game_id,
          score: row.score,
          seconds: row.seconds,
          createdAt: row.created_at,
        }));
        const merged = mergeScores(local, rows);
        setScores(merged);
        writeLocalScores(user.id, merged);
      });
  }, [user]);

  const bestFor = useCallback(
    (gameId: string) => {
      const best = bestOf(
        scores.filter((score) => score.gameId === gameId),
        isLowerBetter(gameId),
      );
      return best ? best.score : null;
    },
    [scores],
  );

  return { scores, bestFor, loading };
}

export function useLeaderboard(gameId: string) {
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    if (!supabase) {
      setLeaders([]);
      setLoading(false);
      return;
    }

    supabase
      .from(isLowerBetter(gameId) ? "leaderboard_fastest" : "leaderboard")
      .select("user_id, display_name, best_score")
      .eq("game_id", gameId)
      .order("best_score", { ascending: isLowerBetter(gameId) })
      .limit(10)
      .then(({ data }) => {
        if (!active) return;
        setLeaders(
          (data ?? []).map((row, index) => ({
            rank: index + 1,
            userId: row.user_id,
            displayName: row.display_name || "Player",
            score: row.best_score,
            isYou: false,
          })),
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [gameId]);

  return { leaders, loading };
}

export function useSaveScore(user: User | null) {
  return useCallback(
    async (gameId: string, score: number, seconds: number) => {
      const row: ScoreRow = {
        gameId,
        score,
        seconds,
        createdAt: new Date().toISOString(),
      };

      if (user) {
        const local = readLocalScores(user.id);
        const next = [row, ...local].slice(0, 80);
        writeLocalScores(user.id, next);
      }

      if (!supabase || !user) return;

      await supabase.from("game_scores").insert({
        user_id: user.id,
        game_id: gameId,
        score,
        seconds,
      });
    },
    [user],
  );
}

export function mergeScores(local: ScoreRow[], remote: ScoreRow[]) {
  const seen = new Set<string>();
  const merged: ScoreRow[] = [];
  for (const row of [...local, ...remote]) {
    const key = `${row.gameId}|${row.score}|${row.seconds}|${row.createdAt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }
  return merged.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 80);
}
