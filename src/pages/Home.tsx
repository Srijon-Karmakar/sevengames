import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { categories, games, type GameCategory } from "../catalog";
import { GameCard } from "../components/GameCard";
import AdBox from "../components/AdBox";
import { useSiteSettings } from "../lib/siteSettings";

export default function Home() {
  const [params, setParams] = useSearchParams();
  const category = (params.get("category") as GameCategory | null) ?? null;
  const [query, setQuery] = useState("");
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

  function pickCategory(next: GameCategory | "All") {
    if (next === "All") setParams({});
    else setParams({ category: next });
  }

  return (
    <div className="page">
      <section className="hero">
        <p className="eyebrow">One account. Every game.</p>
        <h1>
          Play everything.
          <br />
          <span className="text-secondary">Anywhere.</span>
        </h1>
        <p className="hero-sub">
          A minimal arcade with {games.length} hand-built games, global leaderboards, and progress
          that follows your account to any device.
        </p>
      </section>

      {settings.announcement_enabled && settings.announcement_text ? (
        <div className="announce" role="status">
          {settings.announcement_text}
        </div>
      ) : null}

      <AdBox />

      <section className="library" id="games">
        <div className="library-head">
          <div className="tabs" role="tablist" aria-label="Filter by category">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={(item === "All" && !category) || item === category}
                className={((item === "All" && !category) || item === category) ? "active" : ""}
                onClick={() => pickCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="search-box">
            <Search size={16} />
            <input
              type="search"
              placeholder="Search games"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        <div className="game-grid">
          {filtered.map((game) => (
            <HomeCardWithBest key={game.id} game={game} />
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="empty-note">No games match “{query}”.</p>
        ) : null}
      </section>
    </div>
  );
}

import { useBestForGame } from "../hooks/useBest";
import type { Game } from "../catalog";

function HomeCardWithBest({ game }: { game: Game }) {
  const best = useBestForGame(game.id);
  return <GameCard game={game} best={best} />;
}
