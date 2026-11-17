/* Carrom cosmetics: striker skins and coin sets, how they unlock, and how they're drawn.
   Every disc is pre-rendered once into a small sprite (per skin, per size), then drawn rotated
   each frame — cheap enough for 20 spinning discs at 60 fps on a phone. */

export type Unlock = { level: number } | { pro: true };

export type StrikerSkin = {
  id: string;
  name: string;
  unlock: Unlock;
  /** face gradient (centre → edge), rim colour, engraved ring colour, optional emblem */
  face: [string, string];
  rim: string;
  ring: string;
  emblem?: "star" | "bolt" | "crown" | "swirl" | "flame";
  /** optional glow colour (neon / lava skins) */
  glow?: string;
};

export type CoinSet = {
  id: string;
  name: string;
  unlock: Unlock;
  light: { face: [string, string]; rim: string; mark: string };
  dark: { face: [string, string]; rim: string; mark: string };
  queen: { face: [string, string]; rim: string; mark: string };
  pattern?: "marble" | "rings" | "facets";
  glow?: boolean;
};

export const STRIKERS: StrikerSkin[] = [
  { id: "classic", name: "Classic Ivory", unlock: { level: 1 }, face: ["#ffffff", "#cfd6de"], rim: "#8d98a6", ring: "#9aa6b4" },
  { id: "maple", name: "Maple Wood", unlock: { level: 3 }, face: ["#f1c98d", "#b07a3f"], rim: "#7a4a1d", ring: "#8a5a2b", emblem: "swirl" },
  { id: "ocean", name: "Ocean Blue", unlock: { level: 5 }, face: ["#9fd8ff", "#2a73d8"], rim: "#163f86", ring: "#d9f0ff", emblem: "star" },
  { id: "carbon", name: "Carbon Fibre", unlock: { level: 8 }, face: ["#4b4f57", "#15171b"], rim: "#000000", ring: "#9aa3b0", emblem: "bolt" },
  { id: "neon", name: "Neon Pulse", unlock: { level: 12 }, face: ["#1b1030", "#090511"], rim: "#ff3fd8", ring: "#3ff7ff", emblem: "bolt", glow: "rgba(255,63,216,1)" },
  { id: "gold", name: "Royal Gold", unlock: { level: 16 }, face: ["#fff2b8", "#c99a1d"], rim: "#8a6408", ring: "#fff6d2", emblem: "crown" },
  { id: "galaxy", name: "Galaxy", unlock: { pro: true }, face: ["#7c5cff", "#120a3a"], rim: "#c6b8ff", ring: "#ffffff", emblem: "star", glow: "rgba(140,110,255,1)" },
  { id: "lava", name: "Lava Core", unlock: { pro: true }, face: ["#ffd36b", "#c2260d"], rim: "#3a0c04", ring: "#ffb347", emblem: "flame", glow: "rgba(255,90,20,1)" },
];

export const COIN_SETS: CoinSet[] = [
  {
    id: "classic",
    name: "Classic Wood",
    unlock: { level: 1 },
    light: { face: ["#fbf7ec", "#d6cab0"], rim: "#b3a685", mark: "rgba(0,0,0,0.16)" },
    dark: { face: ["#4a4a4f", "#17171a"], rim: "#000000", mark: "rgba(255,255,255,0.1)" },
    queen: { face: ["#e05a51", "#8e241e"], rim: "#6e1b16", mark: "rgba(255,235,230,0.45)" },
    pattern: "rings",
  },
  {
    id: "marble",
    name: "Marble",
    unlock: { level: 4 },
    light: { face: ["#ffffff", "#dfe3e8"], rim: "#a9b1bb", mark: "rgba(120,130,145,0.35)" },
    dark: { face: ["#3a3f46", "#101215"], rim: "#000000", mark: "rgba(200,210,225,0.25)" },
    queen: { face: ["#ff7aa0", "#b81d4c"], rim: "#7a0f30", mark: "rgba(255,230,240,0.4)" },
    pattern: "marble",
  },
  {
    id: "pearl",
    name: "Pearl & Onyx",
    unlock: { level: 7 },
    light: { face: ["#fffaf3", "#e8dccb"], rim: "#cbb89f", mark: "rgba(255,190,220,0.35)" },
    dark: { face: ["#2b2b30", "#050506"], rim: "#000000", mark: "rgba(120,140,255,0.3)" },
    queen: { face: ["#ffe08a", "#c9901a"], rim: "#8a5f08", mark: "rgba(255,255,255,0.45)" },
    pattern: "rings",
  },
  {
    id: "jade",
    name: "Jade & Ruby",
    unlock: { level: 10 },
    light: { face: ["#b9f5d0", "#2fa36a"], rim: "#16653d", mark: "rgba(255,255,255,0.3)" },
    dark: { face: ["#ff8a8a", "#a3121f"], rim: "#5c050c", mark: "rgba(255,255,255,0.25)" },
    queen: { face: ["#fff1a8", "#d6a417"], rim: "#8a6408", mark: "rgba(255,255,255,0.5)" },
    pattern: "facets",
  },
  {
    id: "neon",
    name: "Neon Night",
    unlock: { level: 14 },
    light: { face: ["#c7fbff", "#21c6e8"], rim: "#0b6e85", mark: "rgba(255,255,255,0.5)" },
    dark: { face: ["#ffb3f2", "#c219a8"], rim: "#5e0752", mark: "rgba(255,255,255,0.45)" },
    queen: { face: ["#fff36b", "#e0a800"], rim: "#7a5a00", mark: "rgba(255,255,255,0.55)" },
    pattern: "rings",
    glow: true,
  },
  {
    id: "royal",
    name: "Gold & Silver",
    unlock: { pro: true },
    light: { face: ["#ffffff", "#aeb6c1"], rim: "#6c7682", mark: "rgba(255,255,255,0.6)" },
    dark: { face: ["#fff0b0", "#b98a12"], rim: "#6e4f05", mark: "rgba(255,255,255,0.55)" },
    queen: { face: ["#ff7a7a", "#b3001b"], rim: "#5c0010", mark: "rgba(255,230,230,0.55)" },
    pattern: "facets",
  },
  {
    id: "crystal",
    name: "Crystal",
    unlock: { pro: true },
    light: { face: ["#f2fbff", "#9fd6ff"], rim: "#5aa2d6", mark: "rgba(255,255,255,0.7)" },
    dark: { face: ["#c9b8ff", "#5a2ec2"], rim: "#2c1170", mark: "rgba(255,255,255,0.6)" },
    queen: { face: ["#ffd1e6", "#ff3d8b"], rim: "#8a0b45", mark: "rgba(255,255,255,0.65)" },
    pattern: "facets",
    glow: true,
  },
];

export const strikerById = (id: string) => STRIKERS.find((s) => s.id === id) ?? STRIKERS[0];
export const coinSetById = (id: string) => COIN_SETS.find((c) => c.id === id) ?? COIN_SETS[0];

export function isUnlocked(u: Unlock, level: number, pro: boolean) {
  return "pro" in u ? pro : pro || level >= u.level;
}

export const unlockLabel = (u: Unlock) => ("pro" in u ? "PRO" : `Level ${u.level}`);

/* ---------------- sprite rendering ---------------- */

const spriteCache = new Map<string, HTMLCanvasElement>();

/** Deterministic pseudo-random from a string (so marble veins look the same every time). */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}

function emblemPath(g: CanvasRenderingContext2D, e: NonNullable<StrikerSkin["emblem"]>, r: number) {
  g.beginPath();
  if (e === "star") {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.42 : r;
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
  } else if (e === "bolt") {
    g.moveTo(r * 0.15, -r);
    g.lineTo(-r * 0.55, r * 0.12);
    g.lineTo(-r * 0.02, r * 0.12);
    g.lineTo(-r * 0.2, r);
    g.lineTo(r * 0.55, -r * 0.15);
    g.lineTo(r * 0.02, -r * 0.15);
    g.closePath();
  } else if (e === "crown") {
    g.moveTo(-r, r * 0.55);
    g.lineTo(-r, -r * 0.35);
    g.lineTo(-r * 0.5, r * 0.1);
    g.lineTo(0, -r * 0.7);
    g.lineTo(r * 0.5, r * 0.1);
    g.lineTo(r, -r * 0.35);
    g.lineTo(r, r * 0.55);
    g.closePath();
  } else if (e === "flame") {
    g.moveTo(0, -r);
    g.bezierCurveTo(r * 0.9, -r * 0.2, r * 0.6, r, 0, r);
    g.bezierCurveTo(-r * 0.6, r, -r * 0.9, -r * 0.2, 0, -r);
    g.closePath();
  } else {
    // swirl
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const a = t * Math.PI * 3.2;
      g.lineTo(Math.cos(a) * r * t, Math.sin(a) * r * t);
    }
  }
}

/**
 * A disc face with bevel, lighting and engraving, drawn into a square sprite of `px` pixels.
 * The light comes from the top-left; the sprite is rotated by the disc angle when drawn, so the
 * engraving visibly turns while the lighting is re-applied on top (see drawDisc in render.ts).
 */
function paintFace(
  px: number,
  face: [string, string],
  rim: string,
  mark: string,
  opts: { pattern?: CoinSet["pattern"]; emblem?: StrikerSkin["emblem"]; ring?: string; seed: string; striker?: boolean },
) {
  const c = document.createElement("canvas");
  c.width = c.height = px;
  const g = c.getContext("2d")!;
  const r = px / 2;
  g.translate(r, r);

  // body
  const body = g.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.1, 0, 0, r);
  body.addColorStop(0, face[0]);
  body.addColorStop(1, face[1]);
  g.beginPath();
  g.arc(0, 0, r * 0.97, 0, Math.PI * 2);
  g.fillStyle = body;
  g.fill();

  // pattern / engraving (this is what visibly spins)
  g.save();
  g.beginPath();
  g.arc(0, 0, r * 0.9, 0, Math.PI * 2);
  g.clip();
  const rnd = seeded(opts.seed);
  if (opts.pattern === "marble") {
    g.strokeStyle = mark;
    for (let k = 0; k < 4; k++) {
      g.lineWidth = r * (0.03 + rnd() * 0.05);
      g.beginPath();
      let x = -r + rnd() * r * 0.4;
      let y = -r + rnd() * 2 * r;
      g.moveTo(x, y);
      for (let i = 0; i < 6; i++) {
        x += r * 0.35;
        y += (rnd() - 0.5) * r * 0.7;
        g.quadraticCurveTo(x - r * 0.15, y + (rnd() - 0.5) * r * 0.5, x, y);
      }
      g.stroke();
    }
  } else if (opts.pattern === "facets") {
    g.strokeStyle = mark;
    g.lineWidth = Math.max(1, r * 0.035);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.beginPath();
      g.moveTo(Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.32);
      g.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
      g.stroke();
    }
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.lineTo(Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.32);
    }
    g.closePath();
    g.stroke();
  } else if (!opts.striker) {
    // classic turned-wood rings + a small grain mark so rotation reads
    g.strokeStyle = mark;
    for (const k of [0.78, 0.62, 0.44]) {
      g.lineWidth = Math.max(1, r * 0.04);
      g.beginPath();
      g.arc(0, 0, r * k, 0, Math.PI * 2);
      g.stroke();
    }
    g.lineWidth = Math.max(1, r * 0.05);
    g.beginPath();
    g.arc(0, 0, r * 0.7, -0.5, 0.2);
    g.stroke();
  }
  g.restore();

  // striker: engraved ring + emblem
  if (opts.striker) {
    g.strokeStyle = opts.ring ?? mark;
    g.lineWidth = r * 0.06;
    g.beginPath();
    g.arc(0, 0, r * 0.62, 0, Math.PI * 2);
    g.stroke();
    if (opts.emblem) {
      g.fillStyle = opts.ring ?? mark;
      g.strokeStyle = opts.ring ?? mark;
      g.globalAlpha = 0.85;
      emblemPath(g, opts.emblem, r * 0.34);
      if (opts.emblem === "swirl") {
        g.lineWidth = r * 0.06;
        g.stroke();
      } else g.fill();
      g.globalAlpha = 1;
    } else {
      // index notch so the classic striker's spin is visible
      g.fillStyle = opts.ring ?? mark;
      g.beginPath();
      g.arc(0, -r * 0.62, r * 0.09, 0, Math.PI * 2);
      g.fill();
    }
  }

  // bevelled rim
  g.lineWidth = r * (opts.striker ? 0.1 : 0.08);
  g.strokeStyle = rim;
  g.beginPath();
  g.arc(0, 0, r * 0.92, 0, Math.PI * 2);
  g.stroke();
  return c;
}

/** Lighting overlay (specular highlight + edge shade). Drawn un-rotated over the face. */
export function lightingSprite(px: number) {
  const key = `light:${px}`;
  let c = spriteCache.get(key);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = c.height = px;
  const g = c.getContext("2d")!;
  const r = px / 2;
  g.translate(r, r);
  // edge shade (bevel)
  const shade = g.createRadialGradient(0, 0, r * 0.7, 0, 0, r);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.32)");
  g.fillStyle = shade;
  g.beginPath();
  g.arc(0, 0, r * 0.97, 0, Math.PI * 2);
  g.fill();
  // lacquer highlight (top-left)
  const hi = g.createRadialGradient(-r * 0.38, -r * 0.42, 0, -r * 0.38, -r * 0.42, r * 0.7);
  hi.addColorStop(0, "rgba(255,255,255,0.55)");
  hi.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = hi;
  g.beginPath();
  g.arc(0, 0, r * 0.95, 0, Math.PI * 2);
  g.fill();
  // thin bright rim catch-light
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.lineWidth = r * 0.04;
  g.beginPath();
  g.arc(0, 0, r * 0.94, Math.PI * 1.05, Math.PI * 1.55);
  g.stroke();
  spriteCache.set(key, c);
  return c;
}

export function strikerSprite(skin: StrikerSkin, px: number) {
  const key = `s:${skin.id}:${px}`;
  let c = spriteCache.get(key);
  if (!c) {
    c = paintFace(px, skin.face, skin.rim, skin.ring, { emblem: skin.emblem, ring: skin.ring, seed: skin.id, striker: true });
    spriteCache.set(key, c);
  }
  return c;
}

export function coinSprite(set: CoinSet, kind: "white" | "black" | "queen", px: number) {
  const key = `c:${set.id}:${kind}:${px}`;
  let c = spriteCache.get(key);
  if (!c) {
    const look = kind === "white" ? set.light : kind === "black" ? set.dark : set.queen;
    c = paintFace(px, look.face, look.rim, look.mark, { pattern: set.pattern, seed: set.id + kind });
    spriteCache.set(key, c);
  }
  return c;
}
