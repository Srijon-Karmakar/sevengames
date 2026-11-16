import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { House, Trophy } from "lucide-react";
import { categories, games, getGame, scoreLabel, type Game, type GameCategory } from "../catalog";
import { categoryIcon } from "../lib/categoryIcons";
import { useBestForGame } from "../hooks/useBest";
import "./home3.css";

/*
 * /home3 — copy of /home2 (asset-replacement workbench) — floating-island scroll fly-in (test page) with Senevon content.
 *
 * Structure: hero, then the whole game library as glass cards. The fly-in stage stays pinned
 * behind everything and keeps scrubbing as you scroll; a glass sidebar slides in once you pass
 * the hero. Visuals and motion logic come from the "Mossline" mock; content is Senevon's.
 * One requestAnimationFrame controller drives the stage; cards reveal via IntersectionObserver.
 */

// Senevon orange-light assets, hosted in public/images/home3/.
// All layers share the still's framing (16:9), so they line up exactly.
const BASE = "/images/home3";
const VIDEO = `${BASE}/fly-in.mp4`; // 121 frames (5.04 s): stone pushes in, reveals controller, light beam rises; 1600×900, no audio
const STILL = `${BASE}/hero-still.webp`; // identical to the video's first frame
const CUTOUT = `${BASE}/hero-cutout.webp`; // main rock only; its glowing tips overlap the headline
// Small rocks as positioned full-frame layers (same framing as the still).
const ROCK_LAYERS = [
  { src: `${BASE}/rock-left.webp`, origin: "13% 63%", depth: 1.3, behind: false },
  // Sits behind the oversized headline so it never hides the last letters.
  { src: `${BASE}/rock-right.webp`, origin: "79.5% 34%", depth: 1.8, behind: true },
];
// Foreground rocks (as in the mock): sprites cut from the still and mirrored, sitting nearer the
// camera. They drift with the pointer and fly off-screen past the camera as you scroll.
const FLY_ROCKS = [
  { src: `${BASE}/rock-fly2.webp`, cls: "h3-rk1", x: -0.3, y: -0.6, d: 1.3 }, // top left, small
  { src: `${BASE}/rock-fly1.webp`, cls: "h3-rk3", x: 1, y: 0.55, d: 1.8 }, // bottom right, large
];
const FONTS = "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";

/** Crop a rock out of the 1200×678 sprite sheet. */

const featured = getGame("skyrealm") ?? games[0];
// Only categories that actually have games, in catalog order.
const usedCategories = categories.filter((c) => c === "All" || games.some((g) => g.category === c));

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ------------------------------------------------------------------ */
/* Glass game card (styled after the station card)                     */
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
  const location = useLocation();
  // Links from the rest of the site use "/?category=X#games" and "/#games".
  const urlCategory = new URLSearchParams(location.search).get("category");
  const [category, setCategory] = useState<GameCategory | "All">(
    urlCategory && usedCategories.includes(urlCategory as GameCategory) ? (urlCategory as GameCategory) : "All",
  );
  useEffect(() => {
    const c = new URLSearchParams(location.search).get("category");
    if (c && usedCategories.includes(c as GameCategory)) setCategory(c as GameCategory);
    if (c || location.hash === "#games") {
      requestAnimationFrame(() => document.getElementById("h3-library")?.scrollIntoView({ block: "start" }));
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

  useEffect(() => {
    const root = rootRef.current!;
    const q = <T extends Element = HTMLElement>(s: string) => root.querySelector(s) as T;
    const qa = <T extends Element = HTMLElement>(s: string) => Array.from(root.querySelectorAll(s)) as T[];

    // ---- page chrome: title, fonts, mist background on html/body ----
    const prevTitle = document.title;
    document.title = "Senevon Game Studio — A Universe of Games";
    const links = [
      Object.assign(document.createElement("link"), { rel: "preconnect", href: "https://fonts.googleapis.com" }),
      Object.assign(document.createElement("link"), { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" }),
      Object.assign(document.createElement("link"), { rel: "stylesheet", href: FONTS }),
    ];
    links.forEach((l) => document.head.appendChild(l));
    const prevHtmlBg = document.documentElement.style.background;
    const prevBodyBg = document.body.style.background;
    document.documentElement.style.background = "#e7ebe8";
    document.body.style.background = "#e7ebe8";

    const story = q("#h3-story");
    const cams = qa(".h3-cam");
    const plate = q<HTMLImageElement>(".h3-plate");
    const camF = q(".h3-camF");
    const cv = q<HTMLCanvasElement>(".h3-cv");
    const ctx = cv.getContext("2d")!;
    const video = q<HTMLVideoElement>(".h3-push");
    const L0 = q(".h3-L0");
    const L1 = q(".h3-L1");
    const heroCopy = q(".h3-hero-copy");
    const heroLine = q(".h3-line");
    const heroH1 = q("h1");
    const caption = q(".h3-caption");
    const hint = q(".h3-hint");
    const libHead = q(".h3-lib-head");
    const rocks = qa(".h3-rocklayer").map((el) => ({ el, d: Number(el.dataset.d) }));
    const flyRocks = qa(".h3-rock").map((el) => ({
      el,
      x: Number(el.dataset.x),
      y: Number(el.dataset.y),
      d: Number(el.dataset.d),
    }));
    const prog = q(".h3-prog i");

    // ---- video frame cache + canvas scrubbing ----
    const FPS = 24;
    let NF = 2;
    let frames: (Blob | undefined)[] = [];
    let want = 0;
    let shown = -1;
    let busy = false;
    let tainted = false; // CDN without CORS → canvas can't be read; fall back to live seeking
    let disposed = false;
    const grab = document.createElement("canvas");
    grab.width = 1600;
    grab.height = 900;
    const gctx = grab.getContext("2d")!;

    const nearest = (t: number) => {
      for (let k = 0; k < NF; k++) {
        if (frames[t - k]) return t - k;
        if (frames[t + k]) return t + k;
      }
      return -1;
    };

    const drawCover = (src: CanvasImageSource, bw: number, bh: number) => {
      const s = Math.max(cv.width / bw, cv.height / bh);
      const w = bw * s;
      const h = bh * s;
      ctx.drawImage(src, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
    };

    const drawWant = async () => {
      if (busy || disposed) return;
      if (tainted) {
        if (shown === want || video.seeking) return;
        busy = true;
        video.currentTime = Math.min(want / FPS, Math.max(0, video.duration - 0.01));
        return; // finished in onSeekedLive
      }
      const n = nearest(want);
      if (n < 0 || n === shown) return;
      busy = true;
      try {
        const bmp = await createImageBitmap(frames[n]!);
        if (!disposed) drawCover(bmp, bmp.width, bmp.height);
        shown = n;
        bmp.close();
      } finally {
        busy = false;
      }
      if (nearest(want) !== shown) void drawWant();
    };

    const enterTainted = () => {
      if (tainted) return;
      tainted = true;
      video.pause();
      busy = false;
      void drawWant();
    };

    const store = (i: number, quality: number) => {
      if (tainted || frames[i]) return;
      try {
        gctx.drawImage(video, 0, 0, 1600, 900);
        grab.toBlob(
          (b) => {
            if (!b || frames[i]) return;
            frames[i] = b;
            if (i === want || shown < 0) void drawWant();
          },
          "image/jpeg",
          quality,
        );
      } catch {
        enterTainted();
      }
    };

    const onSeekedLive = () => {
      if (!tainted) return;
      drawCover(video, video.videoWidth, video.videoHeight);
      shown = Math.round(video.currentTime * FPS);
      busy = false;
      if (shown !== want) void drawWant();
    };
    video.addEventListener("seeked", onSeekedLive);

    let stepping = false;
    const stepFallback = () => {
      if (stepping) return;
      stepping = true;
      let i = 0;
      const next = () => {
        if (disposed || tainted || i >= NF) {
          video.removeEventListener("seeked", onStep);
          return;
        }
        video.currentTime = Math.min(i / FPS, video.duration - 0.01);
      };
      const onStep = () => {
        store(i, i === 0 ? 0.9 : 0.86);
        i++;
        next();
      };
      video.addEventListener("seeked", onStep);
      next();
    };

    const startCache = () => {
      NF = Math.max(2, Math.round(video.duration * FPS));
      frames = new Array(NF);
      store(0, 0.9); // frame 0 first: the hero hand-off depends on it
      if (tainted) return;
      const v = video as HTMLVideoElement & {
        requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
      };
      if (v.requestVideoFrameCallback) {
        const onFrame = (_now: number, meta: { mediaTime: number }) => {
          if (disposed || tainted) return;
          const i = Math.min(NF - 1, Math.round(meta.mediaTime * FPS));
          if (i > 0) store(i, 0.86);
          if (!video.ended) v.requestVideoFrameCallback!(onFrame);
        };
        v.requestVideoFrameCallback(onFrame);
        video.play().catch(() => stepFallback());
      } else {
        stepFallback();
      }
    };
    if (video.readyState >= 2) startCache();
    else video.addEventListener("loadeddata", startCache, { once: true });

    const sizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      cv.width = Math.round(cv.clientWidth * dpr);
      cv.height = Math.round(cv.clientHeight * dpr);
      shown = -1;
      void drawWant();
    };
    sizeCanvas();

    // ---- hero placement (the island's fern tips sit on the lower half of the letters) ----
    const layoutHero = () => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      if (W < 821) {
        heroCopy.style.top = "";
        heroH1.style.fontSize = "";
        // Phones: keep the oversized headline on one line, shrunk just enough to fit.
        const w = (heroLine.firstElementChild as HTMLElement).getBoundingClientRect().width;
        if (w > W * 0.92) heroH1.style.fontSize = `${(parseFloat(getComputedStyle(heroH1).fontSize) * W * 0.92) / w}px`;
        return;
      }
      const bw = W * 1.06;
      const bh = H * 1.12;
      const k = Math.max(bw / 1600, bh / 900);
      const fernTop = -0.09 * H + (bh - 900 * k) / 2 + 248 * k + 0.06 * H;
      // Oversized headline: ~1.75× the mock's size, capped to nearly the full width.
      let fs = Math.min(200, 126 * k);
      heroH1.style.fontSize = `${fs}px`;
      const lineW = (heroLine.firstElementChild as HTMLElement).getBoundingClientRect().width;
      if (lineW > W * 0.96) {
        fs *= (W * 0.96) / lineW;
        heroH1.style.fontSize = `${fs}px`;
      }
      heroCopy.style.top = `${fernTop + 0.5 * fs - heroCopy.offsetHeight}px`;
    };
    layoutHero();
    void document.fonts?.ready.then(() => !disposed && layoutHero());

    const onResize = () => {
      sizeCanvas();
      layoutHero();
    };
    window.addEventListener("resize", onResize);

    let mx = 0;
    let my = 0;
    let sx = 0;
    let sy = 0;
    const onPointer = (e: PointerEvent) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    const vis = (el: HTMLElement, on: boolean) => {
      el.style.visibility = on ? "visible" : "hidden";
    };

    // ---- per-frame controller ----
    // hp: hero progress (0 → 1 over the first screen). sp: progress through the whole page.
    let hp = 0;
    let sp = 0;
    let last = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(64, now - last);
      last = now;
      const H = window.innerHeight;
      const k = 1 - Math.pow(0.86, dt / 16.7);

      const scrolled = Math.max(0, -story.getBoundingClientRect().top);
      const total = Math.max(1, story.offsetHeight - H);
      const rawHp = clamp(scrolled / H);
      const rawSp = clamp(scrolled / total);
      hp += (rawHp - hp) * k;
      sp += (rawSp - sp) * k;
      if (Math.abs(rawHp - hp) < 0.0002) hp = rawHp;
      if (Math.abs(rawSp - sp) < 0.0002) sp = rawSp;
      sx += (mx - sx) * 0.06;
      sy += (my - sy) * 0.06;

      // The fly-in plays across the library: parked on frame 0 until the hero has gone,
      // then it scrubs to the last frame by the end of the page.
      const startAt = Math.min(0.6, H * 0.6 / total);
      const vp = ease(seg(sp, startAt, 0.98));
      want = Math.round(vp * (NF - 1));
      void drawWant();

      const camT = `translate3d(${-sx * 18}px, ${-sy * 12 + (1 - vp) * H * 0.06}px, 0) scale(${1 + 0.02 * (1 - vp)})`;
      cams.forEach((c) => (c.style.transform = camT));

      // Hand-off: the high-res still dissolves into the identical cached frame 0.
      const ho = shown < 0 ? 0 : shown === 0 ? seg(hp, 0.3, 0.55) : 1;
      plate.style.opacity = `${1 - ho}`;
      plate.style.visibility = ho >= 1 ? "hidden" : "visible";
      camF.style.opacity = `${1 - ho}`;
      vis(camF, ho < 1);

      // Hero copy blurs out and lifts away.
      const h = seg(hp, 0.1, 0.6);
      heroCopy.style.transform = `translate3d(${-sx * 10}px, ${-h * 80 - sy * 6}px, 0) scale(${1 + h * 0.12})`;
      heroCopy.style.filter = `blur(${h * 14}px)`;
      heroCopy.style.opacity = `${1 - h}`;
      const ch = 1 - seg(hp, 0.05, 0.3);
      caption.style.opacity = `${ch}`;
      hint.style.opacity = `${ch}`;
      vis(L0, h < 1);
      vis(L1, h < 1);

      // Small rocks: aligned depth layers over the still. They drift with the pointer for
      // parallax, then dissolve with the still (the video's own stones do the flying).
      rocks.forEach(({ el, d }) => {
        el.style.transform = `translate3d(${-sx * 24 * d}px, ${-sy * 14 * d}px, 0)`;
        el.style.opacity = `${1 - ho}`;
        vis(el, ho < 1);
      });

      // Foreground rocks fly past the camera (same motion as the mock).
      const fp = seg(hp, 0.1, 1);
      const fe = fp * fp;
      flyRocks.forEach(({ el, x, y, d }) => {
        el.style.transform = `translate3d(${x * fp * 70 + sx * -24 * d}vw, ${y * fp * 60 + sy * -16 * d}vh, 0) scale(${1 + fe * 1.6 * d})`;
        el.style.filter = `blur(${fe * 5 * d}px)`;
        vis(el, fp < 1);
      });

      // Sidebar slides in once the hero is mostly gone; the library heading follows.
      root.classList.toggle("h3-past-hero", hp > 0.7);
      // Header scrim once the page has scrolled (keeps the logo and menu readable).
      root.classList.toggle("h3-scrolled", window.scrollY > 24);
      const lh = seg(hp, 0.55, 0.95);
      libHead.style.opacity = `${lh}`;
      libHead.style.transform = `translateY(${(1 - lh) * 30}px)`;
      libHead.style.filter = `blur(${(1 - lh) * 8}px)`;

      prog.style.transform = `scaleX(${sp})`;
    };
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      video.removeEventListener("seeked", onSeekedLive);
      video.pause();
      links.forEach((l) => l.remove());
      document.title = prevTitle;
      document.documentElement.style.background = prevHtmlBg;
      document.body.style.background = prevBodyBg;
    };
  }, []);

  return (
    <div className="h3" ref={rootRef}>
      <nav className="h3-nav">
        <Link className="h3-logo" to="/" aria-label="Senevon Game Studio — home">
          {/* Dark-text logo variant: this page has a light mist background */}
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
          <Link to="/classic">
            Studio
            <i className="h3-chev" />
          </Link>
        </div>
      </nav>

      {/* Sidebar: slides in after the hero */}
      <aside className="h3-rail" aria-label="Browse games">
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

      <section className="h3-story" id="h3-story">
        {/* Pinned stage: stays behind the hero and the whole library */}
        <div className="h3-stage">
          <div className="h3-cam">
            <canvas className="h3-cv" />
            <img className="h3-plate" src={STILL} alt="" fetchPriority="high" />
            <div className="h3-mist" />
          </div>

          <video className="h3-push" src={VIDEO} muted playsInline preload="auto" crossOrigin="anonymous" />

          {/* Rocks that sit behind the headline */}
          {ROCK_LAYERS.filter((r) => r.behind).map((r) => (
            <div key={r.src} className="h3-cam h3-rockcam" aria-hidden="true">
              <div className="h3-rocklayer" data-d={r.depth}>
                <div className="h3-bob" style={{ transformOrigin: r.origin }}>
                  <img src={r.src} alt="" />
                </div>
              </div>
            </div>
          ))}

          <div className="h3-layer h3-L0">
            <div className="h3-hero-copy">
              <span className="h3-chip">Senevon Game Studio</span>
              <h1>
                <span className="h3-line">
                  <span>A Universe of Games</span>
                </span>
              </h1>
            </div>
          </div>

          <div className="h3-cam h3-camF" aria-hidden="true">
            <img src={CUTOUT} alt="" />
          </div>

          {ROCK_LAYERS.filter((r) => !r.behind).map((r) => (
            <div key={r.src} className="h3-cam h3-rockcam" aria-hidden="true">
              <div className="h3-rocklayer" data-d={r.depth}>
                <div className="h3-bob" style={{ transformOrigin: r.origin }}>
                  <img src={r.src} alt="" />
                </div>
              </div>
            </div>
          ))}

          {FLY_ROCKS.map((r) => (
            <div
              key={r.src}
              className={`h3-rock ${r.cls}`}
              data-x={r.x}
              data-y={r.y}
              data-d={r.d}
              aria-hidden="true"
            >
              <div className="h3-bob">
                <img src={r.src} alt="" />
              </div>
            </div>
          ))}

          <div className="h3-layer h3-L1">
            <p className="h3-caption">
              Play instantly,
              <br />
              discover new worlds,
              <br />
              and be part of a global gaming universe.
            </p>
            <div className="h3-hint">
              <span className="h3-hint-c">
                <i />
              </span>
              SCROLL TO EXPLORE
            </div>
          </div>

          <div className="h3-prog">
            <i />
          </div>
        </div>

        {/* Scrolling content over the pinned stage */}
        <div className="h3-flow">
          <div className="h3-hero-space" aria-hidden="true" />

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
        </div>
      </section>
    </div>
  );
}
