/* Tokens: wallet state for the signed-in player, per-game prices and subscription prices.
   Every change goes through Supabase RPC functions (supabase/tokens.sql) that enforce the
   rules on the server; this file only calls them and shares the result across the app. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../supabase";
import { useAuthContext } from "../context/AuthContext";

export type Subscription = {
  id: string;
  plan: "monthly" | "yearly";
  status: "active" | "cancelled";
  provider: string;
  currency: string;
  amount: number;
  started_at: string;
  period_end: string;
  next_credit_at: string;
};

export type Wallet = {
  balance: number;
  /** redeemed the developer / admin code: premium games are free */
  unlimited: boolean;
  subscription: Subscription | null;
  ads_today: number;
  ad_daily_cap: number;
  ad_reward: number;
  ad_min_seconds: number;
  sub_tokens: number;
  payments_mode: "mock" | "live";
};

export type LedgerRow = { id: number; delta: number; balance_after: number; reason: string; ref: string | null; created_at: string };

export type SpendResult = { ok: true; cost: number } | { ok: false; reason: "insufficient" | "signin" | "error"; cost: number; message?: string };

type Ctx = {
  wallet: Wallet | null;
  loading: boolean;
  refresh: () => Promise<void>;
  spendForPlay: (gameId: string) => Promise<SpendResult>;
  startAdView: (source: "network" | "house", adId?: string | null) => Promise<string>;
  claimAd: (viewId: string) => Promise<void>;
  subscribe: (plan: "monthly" | "yearly", currency: string) => Promise<void>;
  cancel: () => Promise<void>;
  history: () => Promise<LedgerRow[]>;
  redeem: (code: string) => Promise<void>;
};

const TokensContext = createContext<Ctx | null>(null);

/** Friendly text for the server's error codes. */
export function tokenErrorText(err: unknown) {
  const msg = (err as { message?: string })?.message ?? String(err);
  if (msg.includes("ad_cap_reached")) return "You've reached today's ad limit — come back tomorrow.";
  if (msg.includes("ad_not_finished")) return "Watch the whole ad to earn tokens.";
  if (msg.includes("too_many_open_ads")) return "Finish the ad you already started first.";
  if (msg.includes("bad_code")) return "That code isn't valid.";
  if (msg.includes("too_many_attempts")) return "Too many wrong codes — try again in an hour.";
  if (msg.includes("no_code_set")) return "That code isn't valid.";
  if (msg.includes("already_subscribed")) return "You already have a subscription.";
  if (msg.includes("mock_payments_disabled")) return "Payments aren't available yet.";
  if (msg.includes("not_signed_in")) return "Sign in first.";
  if (msg.includes("Could not find the function")) return "Tokens aren't set up on the server yet (run supabase/tokens.sql).";
  return "Something went wrong. Please try again.";
}

export function TokensProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(false);

  const rpc = useCallback(async <T,>(fn: string, args?: Record<string, unknown>): Promise<T> => {
    if (!supabase) throw new Error("not_configured");
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw new Error(error.message);
    return data as T;
  }, []);

  const refresh = useCallback(async () => {
    if (!user || !supabase) {
      setWallet(null);
      return;
    }
    setLoading(true);
    try {
      setWallet(await rpc<Wallet>("token_wallet"));
    } catch {
      setWallet(null);
    } finally {
      setLoading(false);
    }
  }, [user, rpc]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const spendForPlay = useCallback(
    async (gameId: string): Promise<SpendResult> => {
      if (!user) return { ok: false, reason: "signin", cost: 0 };
      try {
        const res = await rpc<Wallet & { ok: boolean; cost: number; reason?: string }>("spend_for_play", { p_game: gameId });
        const { ok, cost, reason: _r, ...w } = res;
        setWallet(w as Wallet);
        return ok ? { ok: true, cost } : { ok: false, reason: "insufficient", cost };
      } catch (err) {
        return { ok: false, reason: "error", cost: 0, message: tokenErrorText(err) };
      }
    },
    [user, rpc],
  );

  const startAdView = useCallback(
    (source: "network" | "house", adId?: string | null) => rpc<string>("start_ad_view", { p_source: source, p_ad: adId ?? null }),
    [rpc],
  );

  const claimAd = useCallback(async (viewId: string) => {
    setWallet(await rpc<Wallet>("claim_ad_reward", { p_view: viewId }));
  }, [rpc]);

  const subscribe = useCallback(async (plan: "monthly" | "yearly", currency: string) => {
    setWallet(await rpc<Wallet>("mock_subscribe", { p_plan: plan, p_currency: currency }));
  }, [rpc]);

  const cancel = useCallback(async () => {
    setWallet(await rpc<Wallet>("cancel_subscription"));
  }, [rpc]);

  const redeem = useCallback(async (code: string) => {
    const res = await rpc<Wallet & { ok: boolean; reason?: string }>("redeem_code", { p_code: code });
    if (!res.ok) throw new Error(res.reason ?? "bad_code");
    const { ok: _ok, reason: _r, ...w } = res;
    setWallet(w as Wallet);
  }, [rpc]);

  const history = useCallback(async () => {
    if (!supabase || !user) return [];
    const { data } = await supabase
      .from("token_ledger")
      .select("id, delta, balance_after, reason, ref, created_at")
      .order("created_at", { ascending: false })
      .limit(25);
    return (data ?? []) as LedgerRow[];
  }, [user]);

  const value = useMemo(
    () => ({ wallet, loading, refresh, spendForPlay, startAdView, claimAd, subscribe, cancel, history, redeem }),
    [wallet, loading, refresh, spendForPlay, startAdView, claimAd, subscribe, cancel, history, redeem],
  );
  return <TokensContext.Provider value={value}>{children}</TokensContext.Provider>;
}

export function useTokens() {
  const ctx = useContext(TokensContext);
  if (!ctx) throw new Error("useTokens must be used inside <TokensProvider>");
  return ctx;
}

/* ---------- prices (public, cached for the session) ---------- */

let gamePriceCache: Record<string, number> | null = null;
let gamePriceInflight: Promise<Record<string, number>> | null = null;

export function loadGamePrices(force = false): Promise<Record<string, number>> {
  if (gamePriceCache && !force) return Promise.resolve(gamePriceCache);
  if (!supabase) return Promise.resolve({});
  if (force) gamePriceInflight = null;
  gamePriceInflight ??= Promise.resolve(supabase.from("game_prices").select("game_id, cost")).then(
    ({ data }) => {
      gamePriceCache = Object.fromEntries((data ?? []).map((r) => [r.game_id as string, Number(r.cost) || 0]));
      return gamePriceCache;
    },
    () => ({}),
  );
  return gamePriceInflight;
}

/** Tokens per play for a game (0 = free). `null` while loading. */
export function useGameCost(gameId: string | undefined): number | null {
  const [prices, setPrices] = useState<Record<string, number> | null>(gamePriceCache);
  useEffect(() => {
    let alive = true;
    void loadGamePrices().then((p) => alive && setPrices(p));
    return () => {
      alive = false;
    };
  }, []);
  if (!gameId) return 0;
  return prices ? (prices[gameId] ?? 0) : null;
}

export type PlanPrice = { currency: string; plan: "monthly" | "yearly"; amount: number };

export function usePlanPrices() {
  const [rows, setRows] = useState<PlanPrice[]>([]);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    void Promise.resolve(supabase.from("plan_prices").select("currency, plan, amount")).then(({ data }) => {
      if (alive) setRows(((data ?? []) as PlanPrice[]).map((r) => ({ ...r, amount: Number(r.amount) })));
    });
    return () => {
      alive = false;
    };
  }, []);
  return rows;
}
