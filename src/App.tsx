import { useEffect } from "react";
import { Route, Routes as RouterRoutes, useLocation } from "react-router-dom";
import { AuthProvider, useAuthContext } from "./context/AuthContext";
import Nav from "./components/Nav";
import Home from "./pages/Home";
import GamePage from "./pages/GamePage";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import AuthCallback from "./pages/AuthCallback";
import Admin from "./pages/admin/Admin";
import { trackPageview } from "./lib/track";

function Shell() {
  const auth = useAuthContext();

  const location = useLocation();
  useEffect(() => {
    trackPageview(location.pathname);
  }, [location.pathname]);

  function handleSignOut() {
    void auth.signOut();
  }

  return (
    <div className="app">
      <Nav user={auth.user} onSignOut={handleSignOut} />
      <RouterRoutes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:id" element={<GamePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<Home />} />
      </RouterRoutes>
      <footer className="footer">
        <p>7games — one account, every game.</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RouterRoutes>
        <Route path="/admin/*" element={<Admin />} />
        <Route path="*" element={<Shell />} />
      </RouterRoutes>
    </AuthProvider>
  );
}
