import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { House, Trophy } from "lucide-react";
import { categories, games, scoreLabel, type Game, type GameCategory } from "../catalog";
import { categoryIcon } from "../lib/categoryIcons";
import { useBestForGame } from "../hooks/useBest";
import NavAccount from "../components/NavAccount";
import "./home3.css";

/*
 * Home page: minimal, flat design (#dbdbdb). Nav, a compact text hero, the game library as solid
 * cards with a category sidebar that slides in after the hero, and the Studio footer.
 */

// Only categories that actually have games, in catalog order.
const usedCategories = categories.filter((c) => c === "All" || games.some((g) => g.category === c));

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ------------------------------------------------------------------ */
/* Game card                                                           */
/* ------------------------------------------------------------------ */

function GlassCard({ game, index }: { game: Game; index: number }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const numRef = useRef<HTMLElement>(null);
  const best = useBestForGame(game.id);

  // Reveal on scroll (lift + un-blur) and count the minutes up once.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let settle = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.add("in");
        settle = window.setTimeout(() => el.classList.add("settled"), 1300 + (index % 4) * 70);
        io.disconnect();
        const t0 = performance.now() + (index % 4) * 70;
        const tick = (now: number) => {
          const t = ease(clamp((now - t0) / 900));
          if (numRef.current) numRef.current.textContent = `${Math.round(game.minutes * t)}`;
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
    };
  }, [game.minutes, index]);

  function tilt(e: React.PointerEvent<HTMLAnchorElement>) {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    e.currentTarget.style.setProperty("--ry", `${x * 8}deg`);
    e.currentTarget.style.setProperty("--rx", `${-y * 8}deg`);
  }
  function untilt(e: React.PointerEvent<HTMLAnchorElement>) {
    e.currentTarget.style.setProperty("--ry", "0deg");
    e.currentTarget.style.setProperty("--rx", "0deg");
  }

  return (
    <Link
      ref={ref}
      to={`/game/${game.id}`}
      className="h3-gcard"
      style={{ "--d": `${(index % 4) * 70}ms` } as React.CSSProperties}
      onPointerMove={tilt}
      onPointerLeave={untilt}
      aria-label={`Play ${game.title}`}
    >
      <h4>{game.title}</h4>
      <p className="h3-card-note">
        {game.category} · {game.difficulty}
      </p>
      <div className="h3-card-num">
        <b ref={numRef}>0</b>
        <small>min</small>
      </div>
      <span className="h3-chip h3-gcard-tag">Play ›</span>
      <div className="h3-gcard-media">
        {game.poster ? (
          <img src={game.poster} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="h3-gcard-fallback" style={{ background: game.accent }}>
            {game.title.charAt(0)}
          </span>
        )}
      </div>
      <p className="h3-card-foot">{best !== null ? `${scoreLabel(game)} · ${best}` : "Not played yet"}</p>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Home3() {
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const location = useLocation();
  // Links from the rest of the site use "/?category=X#games", "/#games" and "/#studio".
  const urlCategory = new URLSearchParams(location.search).get("category");
  const [category, setCategory] = useState<GameCategory | "All">(
    urlCategory && usedCategories.includes(urlCategory as GameCategory) ? (urlCategory as GameCategory) : "All",
  );
  useEffect(() => {
    const c = new URLSearchParams(location.search).get("category");
    if (c && usedCategories.includes(c as GameCategory)) setCategory(c as GameCategory);
    if (c || location.hash === "#games") {
      requestAnimationFrame(() => document.getElementById("h3-library")?.scrollIntoView({ block: "start" }));
    } else if (location.hash === "#studio") {
      requestAnimationFrame(() => document.getElementById("studio")?.scrollIntoView({ block: "start" }));
    }
  }, [location.search, location.hash]);
  const list = useMemo(
    () => (category === "All" ? games : games.filter((g) => g.category === category)),
    [category],
  );

  function pick(c: GameCategory | "All") {
    setCategory(c);
    document.getElementById("h3-library")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Page chrome (title, flat background on html/body) and the scroll-driven classes:
  // h3-scrolled turns the nav band on, h3-past-hero slides the sidebar in.
  useEffect(() => {
    const root = rootRef.current!;
    const prevTitle = document.title;
    const prevHtmlBg = document.documentElement.style.background;
    const prevBodyBg = document.body.style.background;
    document.title = "Senevon Game Studio — A Universe of Games";
    document.documentElement.style.background = "#dbdbdb";
    document.body.style.background = "#dbdbdb";

    const onScroll = () => {
      const heroH = heroRef.current?.offsetHeight ?? 400;
      root.classList.toggle("h3-scrolled", window.scrollY > 24);
      root.classList.toggle("h3-past-hero", window.scrollY > heroH * 0.7);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.title = prevTitle;
      document.documentElement.style.background = prevHtmlBg;
      document.body.style.background = prevBodyBg;
    };
  }, []);

  return (
    <div className="h3 h3-min" ref={rootRef}>
      <nav className="h3-nav">
        <Link className="h3-logo" to="/" aria-label="Senevon Game Studio — home">
          <img src="/logo/logo-h-dark-nav.webp" width={432} height={120} alt="Senevon Game Studio" />
        </Link>
        <div className="h3-menu">
          <a href="#h3-library">
            Games
            <i className="h3-chev" />
          </a>
          <a href="#h3-library" onClick={() => setCategory("Action")}>
            Categories
            <i className="h3-chev" />
          </a>
          <Link to="/profile">
            Leaderboards
            <i className="h3-chev" />
          </Link>
          <a href="#studio">
            Studio
            <i className="h3-chev" />
          </a>
        </div>
        <NavAccount />
      </nav>

      {/* Sidebar: slides in after the hero */}
      <aside className="h3-rail" aria-label="Browse games">
        {/* Neon border glow (a blurred copy of the ring drawn by .h3-rail::before) */}
        <span className="h3-rail-glow" aria-hidden="true">
          <i />
        </span>
        <Link to="/" className="h3-rail-item" data-label="Home">
          <House size={18} />
        </Link>
        <span className="h3-rail-sep" aria-hidden="true" />
        {usedCategories.map((c) => {
          const Icon = categoryIcon[c];
          return (
            <button
              key={c}
              type="button"
              className={`h3-rail-item${category === c ? " active" : ""}`}
              data-label={c === "All" ? "All games" : c}
              aria-pressed={category === c}
              onClick={() => pick(c)}
            >
              <Icon size={18} />
            </button>
          );
        })}
        <span className="h3-rail-sep" aria-hidden="true" />
        <Link to="/profile" className="h3-rail-item" data-label="Leaderboards">
          <Trophy size={18} />
        </Link>
      </aside>

      {/* Compact text hero */}
      <header className="h3-hero" ref={heroRef}>
        <span className="h3-chip">Senevon Game Studio</span>
        <h1>
          <span className="h3-line">
            <span>A Universe of Games</span>
          </span>
        </h1>
        <p className="h3-caption">
          Play instantly,
          <br />
          discover new worlds,
          <br />
          and be part of a global gaming universe.
        </p>
      </header>

      <section className="h3-library" id="h3-library">
        <header className="h3-lib-head">
          <span className="h3-chip">Game library</span>
          <h2>{category === "All" ? "Pick a world. Play instantly." : category}</h2>
          <p>
            {list.length} {list.length === 1 ? "game" : "games"} · free · no downloads
          </p>
        </header>

        <div className="h3-grid" key={category}>
          {list.map((g, i) => (
            <GlassCard key={g.id} game={g} index={i} />
          ))}
        </div>
      </section>

      {/* Studio: about + footer */}
      <footer className="h3-studio" id="studio">
        <span className="h3-chip">The studio</span>
        <h2>Senevon Game Studio</h2>
        <p className="h3-studio-lead">
          We build hand-crafted browser games you can play in a single click — from one-minute reflex
          tests to open-world adventures, all saved to one account and ranked on global leaderboards.
        </p>
        <ul className="h3-studio-stats">
          <li>
            <b>{games.length}</b>
            <span>Games</span>
          </li>
          <li>
            <b>{usedCategories.length - 1}</b>
            <span>Categories</span>
          </li>
          <li>
            <b>100%</b>
            <span>Free to play</span>
          </li>
        </ul>
        <nav className="h3-studio-links" aria-label="Footer">
          <a href="#h3-library">Games</a>
          <Link to="/profile">Leaderboards</Link>
          <Link to="/login">Sign in</Link>
        </nav>
        <p className="h3-studio-copy">© {new Date().getFullYear()} Senevon Game Studio</p>
      </footer>
    </div>
  );
}
