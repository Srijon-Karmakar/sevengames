import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Coins, Gift, Gamepad2, KeyRound, Sparkles, Tv, X } from "lucide-react";
import { useAuthContext } from "../context/AuthContext";
import { tokenErrorText, usePlanPrices, useTokens, type LedgerRow } from "../lib/tokens";
import { formatMoney, formatTokens, pickCurrency } from "../lib/currency";
import { getGame } from "../catalog";
import AdRewardModal from "../components/AdRewardModal";
import "./tokens.css";

const REASON: Record<string, { label: string; Icon: typeof Coins }> = {
  signup: { label: "Welcome bonus", Icon: Gift },
  play: { label: "Played", Icon: Gamepad2 },
  ad: { label: "Watched an ad", Icon: Tv },
  subscription: { label: "Subscription tokens", Icon: CalendarClock },
  admin: { label: "Adjustment", Icon: Sparkles },
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export default function TokensPage() {
  const { user } = useAuthContext();
  const { wallet, loading, subscribe, cancel, history, refresh, redeem } = useTokens();
  const [code, setCode] = useState("");
  const [codeOpen, setCodeOpen] = useState(false);
  const prices = usePlanPrices();
  const [adOpen, setAdOpen] = useState(false);
  const [checkout, setCheckout] = useState<"monthly" | "yearly" | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [rows, setRows] = useState<LedgerRow[]>([]);

  useEffect(() => {
    document.title = "Tokens — Senevon Game Studio";
  }, []);

  // reload history whenever the balance changes
  const balance = wallet?.balance;
  useEffect(() => {
    if (balance === undefined) return;
    void history().then(setRows);
  }, [balance, history]);

  const currencies = useMemo(() => [...new Set(prices.map((p) => p.currency))], [prices]);
  const currency = pickCurrency(currencies);
  const price = (plan: "monthly" | "yearly") => prices.find((p) => p.currency === currency && p.plan === plan)?.amount;
  const monthly = price("monthly");
  const yearly = price("yearly");
  const savePct = monthly && yearly ? Math.round((1 - yearly / (monthly * 12)) * 100) : 0;
  const perMonth = wallet?.sub_tokens ?? 5000;
  const sub = wallet?.subscription ?? null;
  const mock = (wallet?.payments_mode ?? "mock") === "mock";

  async function confirmCheckout() {
    if (!checkout) return;
    setBusy(true);
    setNote(null);
    try {
      await subscribe(checkout, currency);
      setNote(`Subscribed! ${formatTokens(perMonth)} tokens have been added.`);
      setCheckout(null);
    } catch (err) {
      setNote(tokenErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function doRedeem(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setNote(null);
    try {
      await redeem(code.trim());
      setCode("");
      setCodeOpen(false);
      setNote("Code redeemed — you now have unlimited tokens.");
    } catch (err) {
      setNote(tokenErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function doCancel() {
    setBusy(true);
    setNote(null);
    try {
      await cancel();
      setNote("Subscription cancelled. It won't renew; tokens you've paid for still arrive until the period ends.");
    } catch (err) {
      setNote(tokenErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="page narrow tk-page">
        <section className="tk-hero card">
          <span className="tk-hero-coin" aria-hidden="true">
            <Coins size={34} />
          </span>
          <h1>Tokens</h1>
          <p>Premium games cost tokens per play. Sign up and get 1,000 free tokens to start.</p>
          <Link className="tk-btn tk-btn-primary" to="/login?next=/tokens">
            Sign in or create an account
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page narrow tk-page">
      <section className="tk-hero card">
        <span className="tk-hero-coin" aria-hidden="true">
          <Coins size={34} />
        </span>
        <p className="tk-hero-label">Your balance</p>
        <h1 className="tk-balance">
          {wallet ? (wallet.unlimited ? "∞" : formatTokens(wallet.balance)) : loading ? "…" : "—"}
        </h1>
        {wallet?.unlimited ? (
          <span className="tk-unlimited">
            <KeyRound size={14} aria-hidden="true" /> Unlimited — premium games are free for you
          </span>
        ) : (
          <p className="tk-hero-sub">Free games are always free. Premium games use tokens per play.</p>
        )}
        {!wallet && !loading ? (
          <button type="button" className="tk-btn" onClick={() => void refresh()}>
            Retry
          </button>
        ) : null}
      </section>

      {note ? (
        <p className="tk-note" role="status">
          {note}
        </p>
      ) : null}

      {/* ---------- Subscription ---------- */}
      <section className="tk-section">
        <h2>Subscribe</h2>
        {sub ? (
          <div className="tk-sub card">
            <div>
              <b>{sub.plan === "monthly" ? "Monthly" : "Yearly"} plan</b>
              <span className={`tk-status ${sub.status}`}>{sub.status === "active" ? "Active" : "Cancelled"}</span>
              <p>
                {formatTokens(perMonth)} tokens every month · {formatMoney(Number(sub.amount), sub.currency)}/
                {sub.plan === "monthly" ? "month" : "year"}
              </p>
              <p className="tk-muted">
                {sub.status === "active"
                  ? `Next ${formatTokens(perMonth)} tokens on ${fmtDate(sub.next_credit_at)} · renews ${fmtDate(sub.period_end)}`
                  : new Date(sub.next_credit_at) < new Date(sub.period_end)
                    ? `Next ${formatTokens(perMonth)} tokens on ${fmtDate(sub.next_credit_at)} · ends ${fmtDate(sub.period_end)}`
                    : `Ends ${fmtDate(sub.period_end)}`}
              </p>
            </div>
            {sub.status === "active" ? (
              <button type="button" className="tk-btn" disabled={busy} onClick={() => void doCancel()}>
                Cancel
              </button>
            ) : null}
          </div>
        ) : (
          <div className="tk-plans">
            <article className="tk-plan card">
              <h3>Monthly</h3>
              <p className="tk-price">
                {monthly !== undefined ? formatMoney(monthly, currency) : "…"}
                <small>/month</small>
              </p>
              <p className="tk-plan-tokens">
                <Coins size={15} aria-hidden="true" /> {formatTokens(perMonth)} tokens every month
              </p>
              <button type="button" className="tk-btn tk-btn-primary" disabled={monthly === undefined} onClick={() => setCheckout("monthly")}>
                Subscribe monthly
              </button>
            </article>
            <article className="tk-plan card is-best">
              {savePct > 0 ? <span className="tk-plan-flag">Save {savePct}%</span> : null}
              <h3>Yearly</h3>
              <p className="tk-price">
                {yearly !== undefined ? formatMoney(yearly, currency) : "…"}
                <small>/year</small>
              </p>
              <p className="tk-plan-tokens">
                <Coins size={15} aria-hidden="true" /> {formatTokens(perMonth)} tokens every month, all year
              </p>
              <button type="button" className="tk-btn tk-btn-primary" disabled={yearly === undefined} onClick={() => setCheckout("yearly")}>
                Subscribe yearly
              </button>
            </article>
          </div>
        )}
        <p className="tk-muted tk-small">Prices shown in {currency}. Unused tokens never expire.</p>
      </section>

      {/* ---------- Earn ---------- */}
      <section className="tk-section">
        <h2>Earn free tokens</h2>
        <div className="tk-earn card">
          <span className="tk-earn-icon" aria-hidden="true">
            <Tv size={22} />
          </span>
          <div>
            <b>Watch an ad · +{wallet?.ad_reward ?? 50} tokens</b>
            <p className="tk-muted">
              {wallet ? `${wallet.ads_today} of ${wallet.ad_daily_cap} watched today` : "Up to 10 a day"}
            </p>
          </div>
          <button
            type="button"
            className="tk-btn tk-btn-primary"
            disabled={!wallet || wallet.ads_today >= wallet.ad_daily_cap}
            onClick={() => setAdOpen(true)}
          >
            Watch
          </button>
        </div>
      </section>

      {/* ---------- Redeem code (developers / admins) ---------- */}
      {wallet && !wallet.unlimited ? (
        <section className="tk-section">
          {codeOpen ? (
            <form className="tk-redeem card" onSubmit={(e) => void doRedeem(e)}>
              <KeyRound size={18} aria-hidden="true" />
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter redeem code"
                aria-label="Redeem code"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={64}
                autoFocus
              />
              <button type="submit" className="tk-btn tk-btn-primary" disabled={busy || !code.trim()}>
                Redeem
              </button>
            </form>
          ) : (
            <button type="button" className="tk-link" onClick={() => setCodeOpen(true)}>
              Have a code?
            </button>
          )}
        </section>
      ) : null}

      {/* ---------- History ---------- */}
      <section className="tk-section">
        <h2>History</h2>
        {rows.length ? (
          <ul className="tk-history card">
            {rows.map((r) => {
              const meta = REASON[r.reason] ?? REASON.admin;
              const detail =
                r.reason === "play" && r.ref ? (getGame(r.ref)?.title ?? r.ref) : r.reason === "admin" && r.ref ? r.ref : null;
              return (
                <li key={r.id}>
                  <meta.Icon size={16} aria-hidden="true" />
                  <span className="tk-h-what">
                    {meta.label}
                    {detail ? <small> · {detail}</small> : null}
                  </span>
                  <span className="tk-h-when">{fmtDate(r.created_at)}</span>
                  <b className={r.delta >= 0 ? "plus" : "minus"}>
                    {r.delta >= 0 ? "+" : "−"}
                    {formatTokens(Math.abs(r.delta))}
                  </b>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="tk-muted">No activity yet.</p>
        )}
      </section>

      {/* ---------- Test checkout ---------- */}
      {checkout ? (
        <div className="tk-modal" role="dialog" aria-modal="true" aria-label="Checkout">
          <div className="tk-modal-card">
            <button type="button" className="tk-modal-x" onClick={() => setCheckout(null)} aria-label="Close">
              <X size={18} />
            </button>
            <div className="tk-modal-center">
              {mock ? <span className="tk-test-tag">Test checkout · no real payment</span> : null}
              <h3>{checkout === "monthly" ? "Monthly" : "Yearly"} plan</h3>
              <p className="tk-price">
                {formatMoney((checkout === "monthly" ? monthly : yearly) ?? 0, currency)}
                <small>/{checkout === "monthly" ? "month" : "year"}</small>
              </p>
              <p>
                {formatTokens(perMonth)} tokens now, then {formatTokens(perMonth)} every month
                {checkout === "yearly" ? " for the year" : ""}. Cancel any time.
              </p>
              {mock ? (
                <button type="button" className="tk-btn tk-btn-primary" disabled={busy} onClick={() => void confirmCheckout()}>
                  {busy ? "Processing…" : "Confirm test purchase"}
                </button>
              ) : (
                <p className="tk-muted">Payments are coming soon.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <AdRewardModal open={adOpen} onClose={() => setAdOpen(false)} />
    </div>
  );
}
