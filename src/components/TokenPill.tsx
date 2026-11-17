import { Link } from "react-router-dom";
import { Coins } from "lucide-react";
import { useAuthContext } from "../context/AuthContext";
import { useTokens } from "../lib/tokens";
import { formatTokens } from "../lib/currency";
import "../pages/tokens.css";

/** Token balance in the nav (signed-in players only); opens the Tokens page. */
export default function TokenPill() {
  const { user } = useAuthContext();
  const { wallet, loading } = useTokens();
  // hidden for guests, and if the wallet can't load (e.g. tokens.sql not run yet)
  if (!user || (!wallet && !loading)) return null;
  return (
    <Link to="/tokens" className="tk-pill" aria-label={`${wallet ? formatTokens(wallet.balance) : "Your"} tokens — get more`}>
      <Coins size={15} aria-hidden="true" />
      <b>{wallet ? formatTokens(wallet.balance) : "…"}</b>
    </Link>
  );
}
