import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { LogOut, Search, UserRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { Avatar } from "../lib/auth";

/** Search box bound to the home page's `?q=` param, usable from any page. */
export function SearchBox({ className = "" }: { className?: string }) {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const q = pathname === "/" ? params.get("q") ?? "" : "";

  function update(value: string) {
    if (pathname !== "/") {
      navigate(value ? `/?q=${encodeURIComponent(value)}#games` : "/");
      return;
    }
    const next = new URLSearchParams(params);
    if (value) next.set("q", value);
    else next.delete("q");
    setParams(next, { replace: true });
  }

  return (
    <label className={`search-box ${className}`.trim()}>
      <Search size={16} />
      <input
        type="search"
        placeholder="Search games…"
        aria-label="Search games"
        value={q}
        onChange={(event) => update(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") document.getElementById("games")?.scrollIntoView({ behavior: "smooth" });
        }}
      />
    </label>
  );
}

export default function Nav({ user, onSignOut }: { user: User | null; onSignOut: () => void }) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`nav${scrolled ? " scrolled" : ""}`}>
      <div className="nav-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">7</span>
          7games
        </Link>

        <nav className="nav-links" aria-label="Sections">
          <NavLink to="/" end className="nav-link">
            Discover
          </NavLink>
          <Link to="/#games" className="nav-link">
            Library
          </Link>
          <NavLink to="/profile" className="nav-link">
            Your stats
          </NavLink>
        </nav>

        <SearchBox className="nav-search" />

        <div className="nav-actions">
          {user ? (
            <>
              <Link to="/profile" className="nav-avatar" aria-label="Your profile">
                <Avatar user={user} />
              </Link>
              <button
                type="button"
                className="nav-icon-btn"
                aria-label="Sign out"
                title="Sign out"
                onClick={() => {
                  onSignOut();
                  navigate("/");
                }}
              >
                <LogOut size={17} />
              </button>
            </>
          ) : (
            <Link to="/login" className="nav-signin">
              <UserRound size={16} />
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
