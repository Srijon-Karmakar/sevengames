import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes as RouterRoutes, useLocation } from "react-router-dom";
import { AuthProvider, useAuthContext } from "./context/AuthContext";
import Nav from "./components/Nav";
import Sidebar from "./components/Sidebar";
import ParallaxBackground from "./components/ParallaxBackground";
import Home from "./pages/Home";
import GamePage from "./pages/GamePage";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import AuthCallback from "./pages/AuthCallback";
import Admin from "./pages/admin/Admin";

import { trackPageview } from "./lib/track";

// Home page (the floating-island fly-in) and the /home2 test page: code-split.
const Home3 = lazy(() => import("./pages/Home3"));
const Home2 = lazy(() => import("./pages/Home2"));

/** The landing page lives outside the Shell (it has its own nav, sidebar and background). */
function Landing() {
  const location = useLocation();
  useEffect(() => {
    trackPageview(location.pathname);
  }, [location.pathname]);
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#e7ebe8" }} />}>
      <Home3 />
    </Suspense>
  );
}

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
      <ParallaxBackground />
      <Nav user={auth.user} onSignOut={handleSignOut} />
      <Sidebar />
      <main className="route" key={location.pathname}>
      <RouterRoutes location={location}>
        {/* Previous home page, kept reachable */}
        <Route path="/classic" element={<Home />} />
        <Route path="/game/:id" element={<GamePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </RouterRoutes>
      </main>
      <footer className="footer">
        <img
          className="footer-logo"
          src="/logo/logo-h-light-nav.webp"
          width={432}
          height={120}
          alt="Senevon Game Studio"
          loading="lazy"
          decoding="async"
        />
        <p>Play instantly, discover new worlds, and be part of a global gaming universe.</p>
        <p className="footer-copy">© {new Date().getFullYear()} Senevon Game Studio</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RouterRoutes>
        <Route path="/admin/*" element={<Admin />} />
        <Route path="/" element={<Landing />} />
        <Route path="/home3" element={<Navigate to="/" replace />} />
        <Route
          path="/home2"
          element={
            <Suspense fallback={<div style={{ minHeight: "100vh", background: "#e7ebe8" }} />}>
              <Home2 />
            </Suspense>
          }
        />
        <Route path="*" element={<Shell />} />
      </RouterRoutes>
    </AuthProvider>
  );
}
