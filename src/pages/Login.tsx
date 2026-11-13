import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { useAuthContext } from "../context/AuthContext";
import AuthForm from "../components/AuthForm";

export default function Login() {
  const auth = useAuthContext();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") ?? "/";

  useEffect(() => {
    if (auth.user) navigate(next, { replace: true });
  }, [auth.user, next, navigate]);

  return (
    <div className="page narrow login-page">
      <p className="eyebrow">7games account</p>
      <h1>Sign in once. Play everywhere.</h1>
      <p className="hero-sub">
        Your scores and leaderboard ranks follow your account to every device.
      </p>
      <AuthForm auth={auth} redirectTo={next} />
      <p className="auth-message muted">
        Just browsing? <Link to="/">Continue as guest</Link> — you can still play every game.
      </p>
    </div>
  );
}
