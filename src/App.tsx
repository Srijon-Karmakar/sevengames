import { useEffect } from "react";
import { Route, Routes as RouterRoutes, useLocation } from "react-router-dom";
import { AuthProvider, useAuthContext } from "./context/AuthContext";
import Nav from "./components/Nav";
import DotGrid from "./components/DotGrid";
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
      <div className="bg-dots" aria-hidden="true">
        <DotGrid
          baseColor="#afff00"
          activeColor="#ffffff"
          shape="circle"
          dotSize={6}
          gap={15}
          proximity={150}
          strength={1.7}
          bounce={0.3}
          tension={0.45}
          returnDuration={0.9}
          shockRadius={550}
          shockStrength={9}
          swell={0.5}
          stretch={0.35}
          glow={1.05}
          fade={0.4}
          intro
          mouseInteraction
          // No click ripples while playing a game — every tap would trigger one.
          clickShock={!location.pathname.startsWith("/game/")}
        />
      </div>
      <Nav user={auth.user} onSignOut={handleSignOut} />
      <main className="route" key={location.pathname}>
      <RouterRoutes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/game/:id" element={<GamePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<Home />} />
      </RouterRoutes>
      </main>
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
