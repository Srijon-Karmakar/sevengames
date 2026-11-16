import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes as RouterRoutes, useLocation } from "react-router-dom";
import { AuthProvider, useAuthContext } from "./context/AuthContext";
import SiteChrome from "./components/SiteChrome";
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

/** Every page except the home page, framed in the new UI (nav, glass sidebar, island backdrop). */
function Shell() {
  const location = useLocation();
  useEffect(() => {
    trackPageview(location.pathname);
  }, [location.pathname]);

  return (
    <SiteChrome>
      <RouterRoutes location={location}>
        <Route path="/game/:id" element={<GamePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        {/* The old home page is retired; old links land on the new one */}
        <Route path="/classic" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </RouterRoutes>
    </SiteChrome>
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
