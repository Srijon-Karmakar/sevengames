import { Link, useLocation } from "react-router-dom";
import {
  RiBook2Line,
  RiFlashlightLine,
  RiGamepadLine,
  RiGroupLine,
  RiHomeFill,
  RiSettings4Line,
  RiTrophyLine,
} from "./ReIcons";

type RailItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  match: (path: string, search: URLSearchParams, hash: string) => boolean;
};

const items: RailItem[] = [
  { to: "/", label: "Home", icon: RiHomeFill, match: (p, _s, h) => p === "/" && (!h || h === "#top") },
  { to: "/#console", label: "Play", icon: RiGamepadLine, match: (_p, _s, h) => h === "#console" },
  { to: "/#instant", label: "Instant Play", icon: RiFlashlightLine, match: (_p, _s, h) => h === "#instant" },
  { to: "/#community", label: "Community", icon: RiGroupLine, match: (_p, _s, h) => h === "#community" || h === "#friends-panel" },
  { to: "/#games", label: "Library", icon: RiBook2Line, match: (_p, s, h) => h === "#games" || Boolean(s.get("category")) },
  { to: "/profile", label: "Trophy", icon: RiTrophyLine, match: (p) => p === "/profile" },
  { to: "/#settings", label: "Settings", icon: RiSettings4Line, match: (_p, _s, h) => h === "#settings" },
];

/** Dynamic floating glassmorphism sidebar dock with animated blooming border */
export default function Sidebar() {
  const { pathname, search, hash } = useLocation();
  const params = new URLSearchParams(search);

  return (
    <nav className="rail" aria-label="Main Navigation">
      <div className="rail-dock">
        <div className="rail-glow-bloom" aria-hidden="true" />
        {items.map(({ to, label, icon: Icon, match }) => {
          const active = match(pathname, params, hash);
          return (
            <Link
              key={label}
              to={to}
              className={`rail-item${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
              data-label={label}
              onClick={() => {
                if (to.includes("#")) {
                  const targetId = to.split("#")[1];
                  document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" });
                }
              }}
            >
              <span className="rail-icon-box">
                <Icon size={21} className="rail-svg-icon" />
              </span>
              <span className="rail-label">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
