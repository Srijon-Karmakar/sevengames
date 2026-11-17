/* Carrom progression: XP → level, selected striker / coin set, and Pro status.
   Guests keep progress on this device; signed-in players also save it to their account
   (Supabase auth metadata) so it follows them. Pro status comes from the `pro_members` table,
   which only the admin panel can write (see supabase/pro.sql). */
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../supabase";
import { COIN_SETS, STRIKERS, isUnlocked, type CoinSet, type StrikerSkin } from "./skins";

export const MAX_LEVEL = 30;
/** Total XP needed to reach `level` (level 1 = 0 XP): 100, 300, 600, 1000 … */
export const xpForLevel = (level: number) => 50 * level * (level - 1);
export function levelForXp(xp: number) {
  let lv = 1;
  while (lv < MAX_LEVEL && xp >= xpForLevel(lv + 1)) lv++;
  return lv;
}

export const XP = { coin: 10, queen: 25, win: 100, loss: 40 } as const;

export type CarromProgress = { xp: number; striker: string; coins: string };
const DEFAULT: CarromProgress = { xp: 0, striker: "classic", coins: "classic" };
const LOCAL_KEY = "senevon:carrom";

function readLocal(): CarromProgress {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return { ...DEFAULT, ...(JSON.parse(raw) as Partial<CarromProgress>) };
  } catch {
    /* private mode */
  }
  return { ...DEFAULT };
}
function writeLocal(p: CarromProgress) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

/** XP for one finished match, from the local player's point of view. */
export function matchXp(coins: number, queen: boolean, won: boolean) {
  return coins * XP.coin + (queen ? XP.queen : 0) + (won ? XP.win : XP.loss);
}

export function useCarromProgress(user: User | null) {
  const [progress, setProgress] = useState<CarromProgress>(readLocal);
  const [pro, setPro] = useState(false);

  // Merge account progress (keep the higher XP; account choices win) once signed in.
  useEffect(() => {
    if (!user) return;
    const remote = (user.user_metadata?.carrom ?? null) as Partial<CarromProgress> | null;
    if (!remote) return;
    setProgress((local) => {
      const merged = { ...local, ...remote, xp: Math.max(local.xp, remote.xp ?? 0) };
      writeLocal(merged);
      return merged;
    });
  }, [user]);

  // Pro status (read-only for players; RLS lets each user read only their own row).
  useEffect(() => {
    let cancelled = false;
    if (!user || !supabase) {
      setPro(false);
      return;
    }
    void supabase
      .from("pro_members")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!cancelled) setPro(!error && Boolean(data));
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const save = useCallback(
    (next: CarromProgress) => {
      setProgress(next);
      writeLocal(next);
      if (user && supabase) void supabase.auth.updateUser({ data: { carrom: next } });
    },
    [user],
  );

  const level = levelForXp(progress.xp);
  const striker: StrikerSkin =
    STRIKERS.find((s) => s.id === progress.striker && isUnlocked(s.unlock, level, pro)) ?? STRIKERS[0];
  const coinSet: CoinSet =
    COIN_SETS.find((c) => c.id === progress.coins && isUnlocked(c.unlock, level, pro)) ?? COIN_SETS[0];

  /** Adds XP; returns the levels gained and any items newly unlocked by them. */
  const addXp = useCallback(
    (amount: number) => {
      const before = levelForXp(progress.xp);
      const next = { ...progress, xp: progress.xp + Math.max(0, Math.round(amount)) };
      save(next);
      const after = levelForXp(next.xp);
      const unlocked = [
        ...STRIKERS.filter((s) => "level" in s.unlock && s.unlock.level > before && s.unlock.level <= after).map((s) => s.name + " striker"),
        ...COIN_SETS.filter((c) => "level" in c.unlock && c.unlock.level > before && c.unlock.level <= after).map((c) => c.name + " coins"),
      ];
      return { before, after, unlocked };
    },
    [progress, save],
  );

  const select = useCallback((patch: Partial<Pick<CarromProgress, "striker" | "coins">>) => save({ ...progress, ...patch }), [progress, save]);

  return { progress, level, pro, striker, coinSet, addXp, select };
}
