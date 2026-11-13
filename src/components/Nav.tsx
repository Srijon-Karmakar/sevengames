import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, UserRound, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { Avatar } from "../lib/auth";

export default function Nav({ user, onSignOut }: { user: User | null; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { to: "/?category=Strategy", label: "Strategy" },
    { to: "/?category=Puzzle", label: "Puzzle" },
    { to: "/?category=Action", label: "Action" },
    { to: "/?category=Words", label: "Words" },
    { to: "/?category=Numbers", label: "Numbers" },
    { to: "/?category=Classic", label: "Classic" },
  ];

  return (
    <header className={`nav${scrolled ? " scrolled" : ""}${open ? " open" : ""}`}>
      <div className="nav-inner">
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark">7</span>
          7games
        </Link>

        <nav className="nav-links" aria-label="Categories">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className="nav-link">
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-actions">
          {user ? (
            <>
              <Link to="/profile" className="nav-avatar" aria-label="Your profile">
                <Avatar user={user} />
              </Link>
              <button
                type="button"
                className="nav-text-btn signout-btn"
                onClick={() => {
                  onSignOut();
                  navigate("/");
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login" className="nav-text-btn">
              <UserRound size={16} />
              Sign in
            </Link>
          )}
          <button
            type="button"
            className="nav-burger"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <nav className="nav-mobile" aria-label="Mobile categories" aria-hidden={!open}>
          {links.map((link) => (
            <Link key={link.to} to={link.to} tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
      </nav>
    </header>
  );
}
