import { Link } from "react-router-dom";
import { useAuthContext } from "../context/AuthContext";
import { useAvatar } from "../lib/avatar";

/** Right-hand nav slot of the new UI: the player's avatar (→ profile) or a "Sign in" link. */
export default function NavAccount() {
  const { user } = useAuthContext();
  const { uri } = useAvatar(user);
  if (!user) {
    return (
      <Link className="h3-account h3-account-signin" to="/login">
        Sign in
      </Link>
    );
  }
  const meta = user.user_metadata ?? {};
  const name = (meta.full_name as string | undefined) || (meta.name as string | undefined) || user.email || "Player";
  return (
    <Link className="h3-account" to="/profile" aria-label={`Your profile (${name})`}>
      {uri ? <img src={uri} alt="" width={34} height={34} /> : <span>{name.charAt(0).toUpperCase()}</span>}
    </Link>
  );
}
