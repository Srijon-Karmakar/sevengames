import { Link, useLocation } from "react-router-dom";
import { Crown, Gamepad2, House, Puzzle, Trophy, Zap, type LucideIcon } from "lucide-react";

type Item = { to: string; label: string; icon: LucideIcon; match: (path: string, search: URLSearchParams, hash: string) => boolean };

const items: Item[] = [
  { to: "/", label: "Home", icon: House, match: (p, s, h) => p === "/" && !s.get("category") && h !== "#games" },
  { to: "/#games", label: "Library", icon: Gamepad2, match: (p, s, h) => p === "/" && !s.get("category") && h === "#games" },
  { to: "/?category=Action#games", label: "Action", icon: Zap, match: (_p, s) => s.get("category") === "Action" },
  { to: "/?category=Puzzle#games", label: "Puzzle", icon: Puzzle, match: (_p, s) => s.get("category") === "Puzzle" },
  { to: "/?category=Strategy#games", label: "Strategy", icon: Crown, match: (_p, s) => s.get("category") === "Strategy" },
  { to: "/profile", label: "Your stats", icon: Trophy, match: (p) => p === "/profile" || p === "/login" },
];

/** Icon rail on desktop; the same items become a bottom tab bar on phones/tablets (CSS). */
export default function Sidebar() {
  const { pathname, search, hash } = useLocation();
  const params = new URLSearchParams(search);

  return (
    <nav className="rail" aria-label="Main">
      {items.map(({ to, label, icon: Icon, match }) => {
        const active = match(pathname, params, hash);
        return (
          <Link
            key={label}
            to={to}
            className={`rail-item${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
            data-label={label}
          >
            <Icon size={20} strokeWidth={2} />
            <span className="rail-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
