import { Link } from "react-router-dom";
import { ArrowRight, Trophy, Zap } from "lucide-react";
import { games } from "../catalog";
import { useAuthContext } from "../context/AuthContext";
import AdBox from "./AdBox";

/** Right-hand hero cards: "Play instantly" + live ad (or an account card when no ad runs). */
export default function PromoCards() {
  const { user } = useAuthContext();

  const accountCard = user ? (
    <Link to="/profile" className="promo">
      <span className="promo-icon">
        <Trophy size={20} />
      </span>
      <span className="promo-text">
        <strong>Your bests</strong>
        <small>See every score you've saved.</small>
      </span>
      <span className="promo-go" aria-hidden="true">
        <ArrowRight size={16} />
      </span>
    </Link>
  ) : (
    <Link to="/login" className="promo">
      <span className="promo-icon">
        <Trophy size={20} />
      </span>
      <span className="promo-text">
        <strong>Climb the boards</strong>
        <small>Sign in to save scores on every device.</small>
      </span>
      <span className="promo-go" aria-hidden="true">
        <ArrowRight size={16} />
      </span>
    </Link>
  );

  return (
    <div className="promos">
      <Link to="/#games" className="promo">
        <span className="promo-icon">
          <Zap size={20} fill="currentColor" />
        </span>
        <span className="promo-text">
          <strong>Play instantly</strong>
          <small>No downloads. {games.length} games run right in your browser.</small>
        </span>
        <span className="promo-go" aria-hidden="true">
          <ArrowRight size={16} />
        </span>
      </Link>
      <AdBox variant="card" fallback={accountCard} />
    </div>
  );
}
