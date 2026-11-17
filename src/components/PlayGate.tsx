import { useState } from "react";
import { Link } from "react-router-dom";
import { Coins, Lock, Play, Tv } from "lucide-react";
import { useAuthContext } from "../context/AuthContext";
import { useTokens } from "../lib/tokens";
import { formatTokens } from "../lib/currency";
import AdRewardModal from "./AdRewardModal";
import "../pages/tokens.css";

/*
 * Covers a premium game until the player pays for a play.
 *  - guests: pay from the browser guest wallet; once it runs out, sign in
 *  - enough tokens: "Play · N tokens"
 *  - not enough: watch an ad or get tokens
 * `again` = shown after a finished match ("Play again").
 */
export default function PlayGate({
  gameId,
  gameTitle,
  cost,
  again,
  onPaid,
}: {
  gameId: string;
  gameTitle: string;
  cost: number;
  again: boolean;
  onPaid: () => void;
}) {
  const { user } = useAuthContext();
  const { wallet, guestBalance, spendForPlay } = useTokens();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adOpen, setAdOpen] = useState(false);

  const balance = wallet?.balance ?? 0;
  const short = Boolean(wallet) && balance < cost;
  const guestShort = guestBalance !== null && guestBalance < cost;

  async function pay() {
    setBusy(true);
    setError(null);
    const res = await spendForPlay(gameId);
    setBusy(false);
    if (res.ok) onPaid();
    else if (res.reason === "insufficient") setError("Not enough tokens for this play.");
    else if (res.reason === "signin") setError("Sign in to play.");
    else setError(res.message ?? "Something went wrong.");
  }

  return (
    <div className={`tk-gate${again ? " is-again" : ""}`}>
      <div className="tk-gate-card">
        <span className="tk-gate-badge">
          <Coins size={14} aria-hidden="true" />
          Premium · {formatTokens(cost)} tokens per play
        </span>
        <h3>{again ? "Play again?" : gameTitle}</h3>

        {!user ? (
          <>
            <p className="tk-gate-balance">
              Guest tokens: <b>{guestBalance === null ? "…" : formatTokens(guestBalance)}</b>
            </p>
            {guestBalance !== null && !guestShort ? (
              <>
                <button type="button" className="tk-btn tk-btn-primary" disabled={busy} onClick={() => void pay()}>
                  <Play size={16} aria-hidden="true" />
                  {busy ? "Starting…" : `${again ? "Play again" : "Play"} · ${formatTokens(cost)} tokens`}
                </button>
                <p className="tk-gate-note">
                  <Link to={`/login?next=/game/${gameId}`}>Sign in</Link> for 1,000 free tokens. Unspent guest tokens come with you.
                </p>
              </>
            ) : guestBalance !== null ? (
              <>
                <p>You're out of guest tokens. Sign in to get 1,000 free tokens and earn more by watching ads. Unspent guest tokens come with you.</p>
                <Link className="tk-btn tk-btn-primary" to={`/login?next=/game/${gameId}`}>
                  <Lock size={16} aria-hidden="true" />
                  Sign in to keep playing
                </Link>
              </>
            ) : null}
          </>
        ) : (
          <>
            <p className="tk-gate-balance">
              You have <b>{wallet ? formatTokens(balance) : "…"}</b> tokens
            </p>
            {!short ? (
              <button type="button" className="tk-btn tk-btn-primary" disabled={busy || !wallet} onClick={() => void pay()}>
                <Play size={16} aria-hidden="true" />
                {busy ? "Starting…" : `${again ? "Play again" : "Play"} · ${formatTokens(cost)} tokens`}
              </button>
            ) : (
              <p className="tk-gate-short">You need {formatTokens(cost - balance)} more tokens.</p>
            )}
            <div className="tk-gate-earn">
              <button type="button" className="tk-btn" onClick={() => setAdOpen(true)}>
                <Tv size={16} aria-hidden="true" />
                Watch ad · +{wallet?.ad_reward ?? 50}
              </button>
              <Link className="tk-btn" to="/tokens">
                <Coins size={16} aria-hidden="true" />
                Get tokens
              </Link>
            </div>
          </>
        )}
        {error ? <p className="tk-gate-error">{error}</p> : null}
      </div>
      <AdRewardModal open={adOpen} onClose={() => setAdOpen(false)} />
    </div>
  );
}
