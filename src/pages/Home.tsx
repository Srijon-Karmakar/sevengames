import { useEffect, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowDown, Shuffle } from "lucide-react";
import { categories, games, getGame, type Game, type GameCategory } from "../catalog";
import { GameCard } from "../components/GameCard";
import HeroRing from "../components/HeroRing";
import PromoCards from "../components/PromoCards";
import ContinuePlaying from "../components/ContinuePlaying";
import { SearchBox } from "../components/Nav";
import { useSiteSettings } from "../lib/siteSettings";
import { useBestForGame } from "../hooks/useBest";
import { categoryIcon } from "../lib/categoryIcons";

// Posters shown on the hero ring (order = order around the ring).
const FEATURED = [
  "infitunnel",
  "carrom",
  "yat-c",
  "merge",
  "pov-cricket",
  "serpent",
  "publicport",
  "connect-four",
  "stack",
  "minefield",
  "echo",
  "lights-out",
];
const featured = FEATURED.map((id) => getGame(id)).filter((g): g is Game => Boolean(g));

export default function Home() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const category = (params.get("category") as GameCategory | null) ?? null;
  const query = params.get("q") ?? "";
  const settings = useSiteSettings();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games.filter((game) => {
      const inCategory = !category || game.category === category;
      const matches =
        !q ||
        game.title.toLowerCase().includes(q) ||
        game.description.toLowerCase().includes(q) ||
        game.category.toLowerCase().includes(q);
      return inCategory && matches;
    });
  }, [category, query]);

  // "/#games" links (nav, sidebar, promo cards) scroll to the library.
  useEffect(() => {
    if (location.hash !== "#games") return;
    const id = requestAnimationFrame(() =>
      document.getElementById("games")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
    return () => cancelAnimationFrame(id);
  }, [location.key, location.hash]);

  function pickCategory(next: GameCategory | "All") {
    const p = new URLSearchParams(params);
    if (next === "All") p.delete("category");
    else p.set("category", next);
    setParams(p, { replace: true });
  }

  function surprise() {
    const game = games[Math.floor(Math.random() * games.length)];
    navigate(`/game/${game.id}`);
  }

  return (
    <div className="page home">
      <section className="hero">
        <div className="hero-copy">
          <p className="hero-kicker">
            Play <i /> Compete <i /> Repeat
          </p>
          <h1>
            Play everything. <span className="hero-accent">Anywhere.</span>
          </h1>
          <p className="hero-sub">
            {games.length} hand-built games, global leaderboards, and progress that follows your account to any
            device.
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={() => document.getElementById("games")?.scrollIntoView({ behavior: "smooth" })}
            >
              <ArrowDown size={17} />
              Explore games
            </button>
            <button type="button" className="ghost-cta" onClick={surprise}>
              <span className="ghost-cta-icon">
                <Shuffle size={16} />
              </span>
              Surprise me
            </button>
          </div>
        </div>

        <HeroRing games={featured} />

        <PromoCards />
      </section>

      {settings.announcement_enabled && settings.announcement_text ? (
        <div className="announce" role="status">
          {settings.announcement_text}
        </div>
      ) : null}

      <section className="library" id="games">
        <div className="library-head">
          <div className="tabs" role="tablist" aria-label="Filter by category">
            {categories.map((item) => {
              const Icon = categoryIcon[item];
              const active = (item === "All" && !category) || item === category;
              return (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={active ? "active" : ""}
                  onClick={() => pickCategory(item)}
                >
                  <Icon size={15} />
                  {item === "All" ? "All games" : item}
                </button>
              );
            })}
          </div>
          <SearchBox className="library-search" />
        </div>

        <div className="library-body">
          <div className="library-main">
            <div className="game-grid">
              {filtered.map((game, i) => (
                <HomeCardWithBest key={game.id} game={game} index={i} />
              ))}
            </div>
            {filtered.length === 0 ? <p className="empty-note">No games match “{query}”.</p> : null}
          </div>
          <aside className="library-side">
            <ContinuePlaying />
          </aside>
        </div>
      </section>
    </div>
  );
}

function HomeCardWithBest({ game, index }: { game: Game; index: number }) {
  const best = useBestForGame(game.id);
  return <GameCard game={game} best={best} index={index} />;
}
