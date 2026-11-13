import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { GameProps } from "./index";

/* ================= world constants (virtual board units, 1000 x 1000) ================= */

const SIZE = 1000;
const WALL = 28;
const PF_MIN = WALL;
const PF_MAX = SIZE - WALL;
const COIN_R = 19;
const STRIKER_R = 26;
const STRIKER_M = 1.7;
const COIN_M = 1;
const POCKET_R = 34;
const POCKET_CAPTURE = 40; // centre within this distance of pocket centre -> potted
const POCKET_SKIP = 36; // walls are open inside this radius (safe: < POCKET_CAPTURE)
const POCKET_PULL = 52; // gentle rim pull zone
const PULL_F = 300;
const POCKETS = [
  { x: WALL + 26, y: WALL + 26 },
  { x: PF_MAX - 26, y: WALL + 26 },
  { x: WALL + 26, y: PF_MAX - 26 },
  { x: PF_MAX - 26, y: PF_MAX - 26 },
];
const BASE_X_MIN = 218;
const BASE_X_MAX = 782;
const BASE_Y_PLAYER = PF_MAX - 44;
const BASE_Y_CPU = PF_MIN + 44;
const FRICTION_K = 1.35; // exponential drag per second
const FRICTION_LIN = 26; // constant deceleration
const STOP_SPEED = 7;
const WALL_E = 0.72;
const DISC_E = 0.94;
const SUB = 1 / 240;
const MIN_POWER_SPEED = 420;
const MAX_POWER_SPEED = 2040;

/* ================= types ================= */

type Kind = "white" | "black" | "queen" | "striker";
type Vec = { x: number; y: number };
type Side = "player" | "cpu";
type QueenState = "board" | "pending-player" | "pending-cpu" | "player" | "cpu";
type Phase = "idle" | "place" | "shooting" | "cpu" | "cpu-aim" | "over";

type Disc = {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  m: number;
  alive: boolean;
};

type Sink = { x: number; y: number; kind: Kind; t: number };
type Shot = { potted: Disc[]; strikerPotted: boolean; contact: boolean };

type World = {
  discs: Disc[];
  striker: Disc;
  queenDisc: Disc;
  potted: { white: Disc[]; black: Disc[] };
  queen: QueenState;
  turn: Side;
  strikerX: { player: number; cpu: number };
  shot: Shot;
  sinks: Sink[];
};

type CpuPlan = { x: number; dir: Vec; power: number };

/* ================= small helpers ================= */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const norm = (v: Vec): Vec => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};

function segDist(p: Vec, a: Vec, b: Vec) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2;
  t = clamp(t, 0, 1);
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

const other = (side: Side): Side => (side === "player" ? "cpu" : "player");
const colorOf = (side: Side) => (side === "player" ? "white" : "black") as "white" | "black";

/* ================= world setup ================= */

let nextId = 1;

function makeCoin(kind: Kind, x: number, y: number): Disc {
  return { id: nextId++, kind, x, y, vx: 0, vy: 0, r: COIN_R, m: COIN_M, alive: true };
}

function makeWorld(): World {
  const discs: Disc[] = [];
  const striker: Disc = {
    id: nextId++,
    kind: "striker",
    x: 500,
    y: BASE_Y_PLAYER,
    vx: 0,
    vy: 0,
    r: STRIKER_R,
    m: STRIKER_M,
    alive: true,
  };
  discs.push(striker);

  const queen = makeCoin("queen", 500, 500);
  discs.push(queen);

  // first ring: 6 coins alternating, second ring: 12 coins alternating
  for (let i = 0; i < 6; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    discs.push(makeCoin(i % 2 === 0 ? "white" : "black", 500 + Math.cos(a) * (COIN_R * 2 + 1), 500 + Math.sin(a) * (COIN_R * 2 + 1)));
  }
  for (let i = 0; i < 12; i += 1) {
    const a = -Math.PI / 2 + Math.PI / 12 + (i * Math.PI) / 6;
    discs.push(makeCoin(i % 2 === 0 ? "white" : "black", 500 + Math.cos(a) * (COIN_R * 4 + 2), 500 + Math.sin(a) * (COIN_R * 4 + 2)));
  }

  return {
    discs,
    striker,
    queenDisc: queen,
    potted: { white: [], black: [] },
    queen: "board",
    turn: "player",
    strikerX: { player: 500, cpu: 500 },
    shot: { potted: [], strikerPotted: false, contact: false },
    sinks: [],
  };
}

function freeSpotNearCenter(world: World, r: number): Vec {
  for (let ring = 0; ring < 26; ring += 1) {
    const rad = ring * 30;
    const steps = ring === 0 ? 1 : ring * 6;
    for (let k = 0; k < steps; k += 1) {
      const a = (k / steps) * Math.PI * 2;
      const p = { x: 500 + Math.cos(a) * rad, y: 500 + Math.sin(a) * rad };
      if (p.x - r < PF_MIN || p.x + r > PF_MAX || p.y - r < PF_MIN || p.y + r > PF_MAX) continue;
      const clear = world.discs.every(
        (o) => !o.alive || o === world.striker || dist(o, p) > o.r + r + 2,
      );
      if (clear) return p;
    }
  }
  return { x: 500, y: 500 };
}

function reviveAt(world: World, d: Disc) {
  const p = freeSpotNearCenter(world, d.r);
  d.x = p.x;
  d.y = p.y;
  d.vx = 0;
  d.vy = 0;
  d.alive = true;
}

function reviveQueen(world: World) {
  if (!world.queenDisc.alive) reviveAt(world, world.queenDisc);
  world.queen = "board";
}

function freeStrikerX(world: World, x: number, y: number, r: number) {
  const blocked = (cx: number) =>
    world.discs.some((d) => d.alive && d.kind !== "striker" && Math.hypot(d.x - cx, d.y - y) < d.r + r + 1);
  if (!blocked(x)) return x;
  for (let off = 4; off <= 440; off += 4) {
    if (x - off >= BASE_X_MIN && !blocked(x - off)) return x - off;
    if (x + off <= BASE_X_MAX && !blocked(x + off)) return x + off;
  }
  return x;
}

function resetStriker(world: World, side: Side) {
  const s = world.striker;
  s.alive = true;
  s.vx = 0;
  s.vy = 0;
  const y = side === "player" ? BASE_Y_PLAYER : BASE_Y_CPU;
  s.y = y;
  s.x = freeStrikerX(world, clamp(world.strikerX[side], BASE_X_MIN, BASE_X_MAX), y, s.r);
}

/* ================= physics ================= */

function pot(world: World, d: Disc) {
  d.alive = false;
  d.vx = 0;
  d.vy = 0;
  world.sinks.push({ x: d.x, y: d.y, kind: d.kind, t: 0.4 });
  if (d.kind === "striker") {
    world.shot.strikerPotted = true;
  } else {
    world.shot.potted.push(d);
    if (d.kind === "white") world.potted.white.push(d);
    else if (d.kind === "black") world.potted.black.push(d);
  }
}

function collide(world: World, a: Disc, b: Disc) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = a.r + b.r;
  if (d === 0 || d >= min) return;
  const nx = dx / d;
  const ny = dy / d;
  const invA = 1 / a.m;
  const invB = 1 / b.m;
  const invSum = invA + invB;

  // positional separation
  const overlap = min - d;
  a.x -= nx * overlap * (invA / invSum);
  a.y -= ny * overlap * (invA / invSum);
  b.x += nx * overlap * (invB / invSum);
  b.y += ny * overlap * (invB / invSum);

  // impulse
  const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vn >= 0) return;
  world.shot.contact = true;
  const j = (-(1 + DISC_E) * vn) / invSum;
  a.vx -= j * nx * invA;
  a.vy -= j * ny * invA;
  b.vx += j * nx * invB;
  b.vy += j * ny * invB;
}

function wallAndPocket(world: World, d: Disc, dt: number) {
  for (const p of POCKETS) {
    const dx = p.x - d.x;
    const dy = p.y - d.y;
    const pd = Math.hypot(dx, dy);
    if (pd < POCKET_CAPTURE) {
      pot(world, d);
      return;
    }
    if (pd < POCKET_PULL && pd > 0.001) {
      d.vx += (dx / pd) * PULL_F * dt;
      d.vy += (dy / pd) * PULL_F * dt;
    }
  }

  const nearPocket = POCKETS.some((p) => dist(p, d) < POCKET_SKIP);
  if (nearPocket) return;

  if (d.x - d.r < PF_MIN && d.vx < 0) {
    d.x = PF_MIN + d.r;
    d.vx *= -WALL_E;
  } else if (d.x + d.r > PF_MAX && d.vx > 0) {
    d.x = PF_MAX - d.r;
    d.vx *= -WALL_E;
  }
  if (d.y - d.r < PF_MIN && d.vy < 0) {
    d.y = PF_MIN + d.r;
    d.vy *= -WALL_E;
  } else if (d.y + d.r > PF_MAX && d.vy > 0) {
    d.y = PF_MAX - d.r;
    d.vy *= -WALL_E;
  }
}

function stepPhysics(world: World, dt: number) {
  for (const d of world.discs) {
    if (!d.alive) continue;
    const oldSp = Math.hypot(d.vx, d.vy);
    if (oldSp <= 0) continue;
    let sp = oldSp * Math.exp(-FRICTION_K * dt) - FRICTION_LIN * dt;
    if (sp < STOP_SPEED) sp = 0;
    const k = sp / oldSp;
    d.vx *= k;
    d.vy *= k;
    if (sp > 0) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
    }
  }

  for (let i = 0; i < world.discs.length; i += 1) {
    for (let j = i + 1; j < world.discs.length; j += 1) {
      const a = world.discs[i];
      const b = world.discs[j];
      if (a.alive && b.alive) collide(world, a, b);
    }
  }

  for (const d of world.discs) {
    if (!d.alive) continue;
    wallAndPocket(world, d, dt);
  }

  for (const s of world.sinks) s.t -= dt;
  world.sinks = world.sinks.filter((s) => s.t > 0);
}

function settled(world: World) {
  return world.discs.every((d) => !d.alive || (d.vx === 0 && d.vy === 0));
}

/* ================= rules resolution ================= */

function resolveShot(world: World): { extra: boolean; msg: string; over: boolean; winner: Side | null } {
  const shooter = world.turn;
  const own = colorOf(shooter);
  const opp = colorOf(other(shooter));
  const who = shooter === "player" ? "You" : "CPU";
  const shot = world.shot;
  const ownPots = shot.potted.filter((d) => d.kind === own);
  const oppPots = shot.potted.filter((d) => d.kind === opp);
  const queenPot = shot.potted.some((d) => d.kind === "queen");
  let extra = false;
  let msg = "";

  if (shot.strikerPotted) {
    msg = `${who} pocketed the striker — foul!`;
    const back = world.potted[own].pop();
    if (back) reviveAt(world, back);
    if (queenPot || world.queen === `pending-${shooter}`) {
      reviveQueen(world);
      msg += " Queen returned.";
    }
  } else {
    if (!shot.contact) msg = `${who} hit nothing — due! Turn passes.`;
    else if (ownPots.length) msg = ownPots.length > 1 ? `${who} pocketed ${ownPots.length} coins!` : `${who} pocketed a coin!`;
    else if (oppPots.length)
      msg =
        shooter === "player"
          ? "You sank a CPU coin — it counts for the CPU."
          : "CPU sank one of your coins — it counts for you.";
    else msg = shooter === "player" ? "No pot — CPU's turn." : "CPU missed — your turn.";

    if (ownPots.length) extra = true;
    if (oppPots.length && !ownPots.length) extra = false;

    const aliveOwn = world.discs.filter((d) => d.alive && d.kind === own).length;
    if (world.queen === `pending-${shooter}`) {
      if (ownPots.length) {
        world.queen = shooter;
        msg += " Queen covered!";
      } else if (aliveOwn === 0) {
        world.queen = shooter;
        msg += " Queen claimed.";
      } else {
        reviveQueen(world);
        extra = false;
        msg += " Queen not covered — back to the centre.";
      }
    } else if (queenPot) {
      if (ownPots.length) {
        world.queen = shooter;
        msg += " Queen covered!";
      } else {
        world.queen = `pending-${shooter}`;
        extra = true;
        msg += " Cover the queen next shot!";
      }
    }
  }

  let over = false;
  let winner: Side | null = null;
  const remOwn = world.discs.filter((d) => d.alive && d.kind === own).length;
  const remOpp = world.discs.filter((d) => d.alive && d.kind === opp).length;

  if (remOwn === 0 && remOpp === 0) {
    winner = shooter;
    over = true;
  } else if (remOpp === 0) {
    winner = other(shooter);
    over = true;
  } else if (remOwn === 0) {
    if (world.queen === "board") {
      const back = world.potted[own].pop();
      if (back) reviveAt(world, back);
      msg += " The queen must be covered first — coin returned.";
    } else {
      winner = shooter;
      over = true;
    }
  }

  return { extra, msg, over, winner };
}

/* ================= CPU opponent ================= */

function planCpuShot(world: World): CpuPlan {
  const targets: Disc[] = world.discs.filter((d) => d.alive && d.kind === "black");
  if (world.queen === "board" && world.queenDisc.alive) targets.push(world.queenDisc);

  let best: (CpuPlan & { score: number }) | null = null;

  for (let i = 0; i <= 24; i += 1) {
    const x = BASE_X_MIN + ((BASE_X_MAX - BASE_X_MIN) * i) / 24;
    const s = { x, y: BASE_Y_CPU };
    const placed = world.discs.some(
      (d) => d.alive && d.kind !== "striker" && dist(d, s) < d.r + STRIKER_R + 2,
    );
    if (placed) continue;

    for (const t of targets) {
      for (const p of POCKETS) {
        const dp = norm({ x: p.x - t.x, y: p.y - t.y });
        const ghost = { x: t.x - dp.x * (t.r + STRIKER_R), y: t.y - dp.y * (t.r + STRIKER_R) };
        const toGhost = { x: ghost.x - s.x, y: ghost.y - s.y };
        const L = Math.hypot(toGhost.x, toGhost.y);
        if (L < STRIKER_R + 6) continue;
        const dir = { x: toGhost.x / L, y: toGhost.y / L };
        const cosCut = dir.x * dp.x + dir.y * dp.y;
        if (cosCut < 0.3) continue;

        let blocked = false;
        for (const o of world.discs) {
          if (!o.alive || o === t || o.kind === "striker") continue;
          if (segDist(o, s, ghost) < o.r + STRIKER_R - 2) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          for (const o of world.discs) {
            if (!o.alive || o === t || o.kind === "striker") continue;
            if (segDist(o, t, p) < o.r + t.r - 2) {
              blocked = true;
              break;
            }
          }
        }
        if (blocked) continue;

        const td = dist(t, p);
        const score = cosCut * 2.2 - L / 1400 - td / 1500 + (t.kind === "queen" ? 0.25 : 0);
        if (!best || score > best.score) {
          best = {
            x,
            dir,
            score,
            power: clamp(0.34 + L / 2600 + td / 3400, 0.35, 0.95),
          };
        }
      }
    }
  }

  let plan: CpuPlan;
  if (best) {
    plan = { x: best.x, dir: best.dir, power: best.power };
  } else {
    // no clean pocket shot: nudge the nearest own coin
    const s0 = { x: 500, y: BASE_Y_CPU };
    const own = world.discs
      .filter((d) => d.alive && d.kind === "black")
      .sort((a, b) => dist(a, s0) - dist(b, s0))[0];
    const target = own ?? world.queenDisc;
    const x = freeStrikerX(world, clamp(target.x, BASE_X_MIN, BASE_X_MAX), BASE_Y_CPU, STRIKER_R);
    const s = { x, y: BASE_Y_CPU };
    plan = { x, dir: norm({ x: target.x - s.x, y: target.y - s.y }), power: 0.7 };
  }

  // human-like error
  const gauss = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  const err = gauss * (Math.random() < 0.16 ? 0.055 : 0.02);
  const ca = Math.cos(err);
  const sa = Math.sin(err);
  plan.dir = { x: plan.dir.x * ca - plan.dir.y * sa, y: plan.dir.x * sa + plan.dir.y * ca };
  plan.power = clamp(plan.power * (1 + gauss * 0.06), 0.3, 1);
  return plan;
}

/* ================= rendering ================= */

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBoard(ctx: CanvasRenderingContext2D) {
  const wood = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  wood.addColorStop(0, "#c99a63");
  wood.addColorStop(0.5, "#b3814c");
  wood.addColorStop(1, "#96683a");
  rr(ctx, 0, 0, SIZE, SIZE, 30);
  ctx.fillStyle = wood;
  ctx.fill();
  rr(ctx, 9, 9, SIZE - 18, SIZE - 18, 24);
  ctx.strokeStyle = "rgba(60,35,10,0.35)";
  ctx.lineWidth = 3;
  ctx.stroke();

  const felt = ctx.createLinearGradient(0, WALL, 0, PF_MAX);
  felt.addColorStop(0, "#f8edcb");
  felt.addColorStop(1, "#eedaa6");
  ctx.fillStyle = felt;
  ctx.fillRect(WALL, WALL, PF_MAX - WALL, PF_MAX - WALL);

  const vg = ctx.createRadialGradient(500, 500, 220, 500, 500, 730);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(80,50,15,0.15)");
  ctx.fillStyle = vg;
  ctx.fillRect(WALL, WALL, PF_MAX - WALL, PF_MAX - WALL);

  ctx.strokeStyle = "rgba(90,55,20,0.55)";
  ctx.lineWidth = 4;
  ctx.strokeRect(WALL, WALL, PF_MAX - WALL, PF_MAX - WALL);

  // markings
  ctx.save();
  ctx.strokeStyle = "#b0413e";
  ctx.fillStyle = "#b0413e";

  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(500, 500, 118, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.arc(500, 500, 58, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(500, 500, 13, 0, Math.PI * 2);
  ctx.fill();

  // diagonal arrows pointing to the centre
  const corners = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const;
  for (const [sx, sy] of corners) {
    const ux = sx * Math.SQRT1_2;
    const uy = sy * Math.SQRT1_2;
    const x1 = 500 + ux * 185;
    const y1 = 500 + uy * 185;
    const x2 = 500 + ux * 430;
    const y2 = 500 + uy * 430;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const a = Math.atan2(-uy, -ux);
    ctx.beginPath();
    ctx.moveTo(x1 + ux * 4, y1 + uy * 4);
    ctx.lineTo(x1 - Math.cos(a - 0.45) * 26 + ux * 4, y1 - Math.sin(a - 0.45) * 26 + uy * 4);
    ctx.lineTo(x1 - Math.cos(a + 0.45) * 26 + ux * 4, y1 - Math.sin(a + 0.45) * 26 + uy * 4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x2, y2, 24, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x2, y2, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  // baselines on all four sides
  for (let i = 0; i < 4; i += 1) {
    ctx.save();
    ctx.translate(500, 500);
    ctx.rotate((i * Math.PI) / 2);
    ctx.translate(-500, -500);
    const y = BASE_Y_PLAYER;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(BASE_X_MIN, y - 10);
    ctx.lineTo(BASE_X_MAX, y - 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(BASE_X_MIN, y + 10);
    ctx.lineTo(BASE_X_MAX, y + 10);
    ctx.stroke();
    for (const cx of [BASE_X_MIN, BASE_X_MAX]) {
      ctx.beginPath();
      ctx.arc(cx, y, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f8edcb";
      ctx.beginPath();
      ctx.arc(cx, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#b0413e";
    }
    ctx.restore();
  }
  ctx.restore();

  // pockets
  for (const p of POCKETS) {
    const g = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, POCKET_R);
    g.addColorStop(0, "#0c0b0a");
    g.addColorStop(1, "#33261a");
    ctx.beginPath();
    ctx.arc(p.x, p.y, POCKET_R, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(50,30,10,0.8)";
    ctx.stroke();
  }
}

function drawShadow(ctx: CanvasRenderingContext2D, d: Disc) {
  ctx.beginPath();
  ctx.arc(d.x + 2, d.y + 4, d.r * 1.02, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(60,35,8,0.22)";
  ctx.fill();
}

function drawCoin(ctx: CanvasRenderingContext2D, d: Disc) {
  drawShadow(ctx, d);
  const g = ctx.createRadialGradient(d.x - d.r * 0.35, d.y - d.r * 0.4, d.r * 0.15, d.x, d.y, d.r);
  if (d.kind === "white") {
    g.addColorStop(0, "#fbf7ec");
    g.addColorStop(1, "#d6cab0");
  } else if (d.kind === "black") {
    g.addColorStop(0, "#4a4a4f");
    g.addColorStop(1, "#17171a");
  } else {
    g.addColorStop(0, "#e05a51");
    g.addColorStop(1, "#8e241e");
  }
  ctx.beginPath();
  ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle =
    d.kind === "white" ? "#b3a685" : d.kind === "black" ? "#000000" : "#6e1b16";
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(d.x, d.y, d.r * 0.62, 0, Math.PI * 2);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.stroke();
  if (d.kind === "queen") {
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,235,230,0.5)";
    ctx.fill();
  }
}

function drawStriker(ctx: CanvasRenderingContext2D, d: Disc, ring: string, pulse: number, glow: boolean) {
  drawShadow(ctx, d);
  if (glow && pulse > 0) {
    ctx.save();
    ctx.shadowColor = ring;
    ctx.shadowBlur = 10 + pulse * 16;
  }
  const g = ctx.createRadialGradient(d.x - d.r * 0.35, d.y - d.r * 0.4, d.r * 0.15, d.x, d.y, d.r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#c6ced8");
  ctx.beginPath();
  ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = ring;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(d.x, d.y, d.r * 0.42, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.7;
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (glow) ctx.restore();
}

function drawAim(ctx: CanvasRenderingContext2D, s: Disc, dir: Vec, power: number, color: string) {
  const L = 130 + power * 560;
  const ex = s.x + dir.x * L;
  const ey = s.y + dir.y * L;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3.5;
  ctx.setLineDash([16, 13]);
  ctx.beginPath();
  ctx.moveTo(s.x + dir.x * (s.r + 6), s.y + dir.y * (s.r + 6));
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.setLineDash([]);
  const a = Math.atan2(dir.y, dir.x);
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - Math.cos(a - 0.42) * 22, ey - Math.sin(a - 0.42) * 22);
  ctx.lineTo(ex - Math.cos(a + 0.42) * 22, ey - Math.sin(a + 0.42) * 22);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.r + 10, -Math.PI / 2, -Math.PI / 2 + power * Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(ex, ey, STRIKER_R, 0, Math.PI * 2);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ================= component ================= */

export default function CarromGame({ onFinish }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<World | null>(null);
  if (!worldRef.current) worldRef.current = makeWorld();

  const phaseRef = useRef<Phase>("idle");
  const aimRef = useRef<{ dir: Vec; power: number }>({ dir: { x: 0, y: -1 }, power: 0.65 });
  const dragRef = useRef<{ mode: "aim" | "place"; ax: number; ay: number } | null>(null);
  const cpuPlanRef = useRef<CpuPlan | null>(null);
  const shotStartRef = useRef(0);
  const finishedRef = useRef(false);
  const fireRef = useRef<(dir: Vec, power: number) => void>(() => {});
  const finishRef = useRef<() => void>(() => {});
  const drawRef = useRef<() => void>(() => {});

  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("Break! Pull back from the striker to aim, release to shoot.");
  const [pottedN, setPottedN] = useState({ white: 0, black: 0 });
  const [queenS, setQueenS] = useState<QueenState>("board");
  const [powerN, setPowerN] = useState(0.65);

  const setPhaseS = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const fire = useCallback(
    (dir: Vec, power: number) => {
      const world = worldRef.current;
      if (!world || !world.striker.alive || phaseRef.current !== "place") return;
      const sp = MIN_POWER_SPEED + clamp(power, 0.05, 1) * (MAX_POWER_SPEED - MIN_POWER_SPEED);
      world.striker.vx = dir.x * sp;
      world.striker.vy = dir.y * sp;
      world.shot = { potted: [], strikerPotted: false, contact: false };
      shotStartRef.current = performance.now();
      setPhaseS("shooting");
    },
    [setPhaseS],
  );

  const finishShot = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    const res = resolveShot(world);
    let nextTurn = world.turn;
    if (!res.over && !res.extra) nextTurn = other(world.turn);
    world.turn = nextTurn;
    resetStriker(world, nextTurn);
    setPottedN({ white: world.potted.white.length, black: world.potted.black.length });
    setQueenS(world.queen);

    if (res.over) {
      const winner = res.winner ?? world.turn;
      const score =
        world.potted.white.length * 10 + (world.queen === "player" ? 25 : 0) + (winner === "player" ? 50 : 0);
      setMessage(
        winner === "player"
          ? `You win! Score ${score} (${world.potted.white.length * 10} coins${world.queen === "player" ? " +25 queen" : ""} +50 win).`
          : "CPU wins — run it back?",
      );
      setPhaseS("over");
      if (!finishedRef.current) {
        finishedRef.current = true;
        onFinish(score);
      }
      return;
    }

    setMessage(res.extra ? `${res.msg} Shoot again.` : res.msg);
    setPhaseS(nextTurn === "player" ? "place" : "cpu");
  }, [onFinish, setPhaseS]);

  const placeAt = useCallback((x: number) => {
    const world = worldRef.current;
    if (!world) return;
    const cx = clamp(x, BASE_X_MIN, BASE_X_MAX);
    world.strikerX.player = cx;
    world.striker.x = freeStrikerX(world, cx, BASE_Y_PLAYER, STRIKER_R);
    world.striker.y = BASE_Y_PLAYER;
    world.striker.alive = true;
    world.striker.vx = 0;
    world.striker.vy = 0;
  }, []);

  const restart = useCallback(() => {
    worldRef.current = makeWorld();
    finishedRef.current = false;
    cpuPlanRef.current = null;
    dragRef.current = null;
    aimRef.current = { dir: { x: 0, y: -1 }, power: 0.65 };
    setPottedN({ white: 0, black: 0 });
    setQueenS("board");
    setPowerN(0.65);
    setMessage("Break! Pull back from the striker to aim, release to shoot.");
    setPhaseS("place");
  }, [setPhaseS]);

  /* main loop: physics while shooting, always draw */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const world = worldRef.current;
      if (!world) return;
      if (phaseRef.current === "shooting") {
        acc += dt;
        let guard = 0;
        while (acc >= SUB && guard < 40) {
          stepPhysics(world, SUB);
          acc -= SUB;
          guard += 1;
        }
        if (acc > SUB) acc = 0;
        if (now - shotStartRef.current > 12000) {
          for (const d of world.discs) {
            d.vx = 0;
            d.vy = 0;
          }
        }
        if (settled(world)) {
          acc = 0;
          finishRef.current();
        }
      } else {
        acc = 0;
      }
      drawRef.current();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    fireRef.current = fire;
    finishRef.current = finishShot;
  }, [fire, finishShot]);

  /* CPU turn sequencing */
  useEffect(() => {
    if (phase === "cpu") {
      const t1 = window.setTimeout(() => {
        const world = worldRef.current;
        if (!world || phaseRef.current !== "cpu") return;
        const plan = planCpuShot(world);
        cpuPlanRef.current = plan;
        world.strikerX.cpu = plan.x;
        resetStriker(world, "cpu");
        setMessage("CPU is lining up a shot…");
        setPhaseS("cpu-aim");
      }, 700);
      return () => window.clearTimeout(t1);
    }
    if (phase === "cpu-aim") {
      const t2 = window.setTimeout(() => {
        const world = worldRef.current;
        const plan = cpuPlanRef.current;
        cpuPlanRef.current = null;
        if (!world || !plan) return;
        const sp = MIN_POWER_SPEED + plan.power * (MAX_POWER_SPEED - MIN_POWER_SPEED);
        world.striker.vx = plan.dir.x * sp;
        world.striker.vy = plan.dir.y * sp;
        world.shot = { potted: [], strikerPotted: false, contact: false };
        shotStartRef.current = performance.now();
        setPhaseS("shooting");
      }, 800);
      return () => window.clearTimeout(t2);
    }
    return undefined;
  }, [phase, setPhaseS]);

  /* keyboard aiming */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phaseRef.current !== "place") return;
      const aim = aimRef.current;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const a = Math.atan2(aim.dir.y, aim.dir.x) + (e.key === "ArrowLeft" ? -0.035 : 0.035);
        aim.dir = { x: Math.cos(a), y: Math.sin(a) };
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        aim.power = clamp(aim.power + (e.key === "ArrowUp" ? 0.06 : -0.06), 0.05, 1);
        setPowerN(aim.power);
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        fireRef.current(aim.dir, aim.power);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* pointer controls */
  const toWorld = (e: ReactPointerEvent<HTMLCanvasElement>): Vec => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * SIZE,
      y: ((e.clientY - rect.top) / rect.height) * SIZE,
    };
  };

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (phaseRef.current !== "place") return;
    const p = toWorld(e);
    const s = worldRef.current!.striker;
    if (dist(p, s) < STRIKER_R * 2.4) {
      dragRef.current = { mode: "aim", ax: s.x, ay: s.y };
      aimRef.current.power = 0;
    } else if (p.y > SIZE - 190) {
      dragRef.current = { mode: "place", ax: p.x, ay: p.y };
      placeAt(p.x);
    } else {
      dragRef.current = { mode: "aim", ax: p.x, ay: p.y };
      aimRef.current.power = 0;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag || phaseRef.current !== "place") return;
    const p = toWorld(e);
    if (drag.mode === "place") {
      placeAt(p.x);
      return;
    }
    const dx = drag.ax - p.x;
    const dy = drag.ay - p.y;
    const pull = Math.hypot(dx, dy);
    if (pull > 20) {
      aimRef.current.dir = { x: dx / pull, y: dy / pull };
      aimRef.current.power = clamp((pull - 30) / 380, 0.05, 1);
      setPowerN(aimRef.current.power);
    }
  }

  function onPointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || phaseRef.current !== "place") return;
    if (drag.mode === "aim") {
      const { dir, power } = aimRef.current;
      if (power >= 0.05) fireRef.current(dir, power);
    }
  }

  /* draw */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const world = worldRef.current;
    if (!canvas || !world) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = canvas.width / SIZE;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    drawBoard(ctx);

    for (const s of world.sinks) {
      const a = Math.max(0, s.t / 0.4);
      ctx.globalAlpha = a * 0.8;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 10 + (1 - a) * 26, 0, Math.PI * 2);
      ctx.strokeStyle = s.kind === "white" ? "#e8e0c8" : s.kind === "black" ? "#3a3a3d" : "#c0463f";
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const ph = phaseRef.current;
    if (ph === "place") {
      ctx.fillStyle = "rgba(47,111,208,0.08)";
      ctx.fillRect(BASE_X_MIN - 30, BASE_Y_PLAYER - 44, BASE_X_MAX - BASE_X_MIN + 60, 88);
    }

    for (const d of world.discs) {
      if (!d.alive || d.kind === "striker") continue;
      drawCoin(ctx, d);
    }

    const aim = aimRef.current;
    if (ph === "place" && world.striker.alive && aim.power > 0.03) {
      drawAim(ctx, world.striker, aim.dir, aim.power, "rgba(31,92,180,0.85)");
    }
    if (ph === "cpu-aim" && cpuPlanRef.current) {
      drawAim(ctx, world.striker, cpuPlanRef.current.dir, cpuPlanRef.current.power, "rgba(180,50,40,0.85)");
    }

    if (world.striker.alive) {
      const pulse = ph === "place" ? 0.5 + 0.5 * Math.sin(performance.now() / 280) : 0;
      drawStriker(ctx, world.striker, world.turn === "player" ? "#2f6fd0" : "#c2392f", pulse, ph === "place");
    }
  }, []);

  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  const queenLabel =
    queenS === "board"
      ? "in play"
      : queenS === "player"
        ? "yours"
        : queenS === "cpu"
          ? "CPU's"
          : queenS === "pending-player"
            ? "cover it!"
            : "CPU covering";

  const status =
    phase === "idle"
      ? "Pocket all nine white coins before the CPU — and cover the queen."
      : phase === "cpu"
        ? "CPU is thinking…"
        : message;

  return (
    <div className="game-surface carrom-surface">
      <div className="carrom-hud">
        <div className={`carrom-chip${phase !== "idle" && phase !== "over" && worldRef.current!.turn === "player" ? " active" : ""}`}>
          <span className="dot white" />
          You <b>{pottedN.white}</b>
          <small>/9</small>
        </div>
        <div className="carrom-chip queen-chip" title="The queen must be covered by one of your coins">
          <span className="qdot">Q</span>
          {queenLabel}
        </div>
        <div className={`carrom-chip${phase === "cpu" || phase === "cpu-aim" || (phase === "shooting" && worldRef.current!.turn === "cpu") ? " active" : ""}`}>
          <span className="dot black" />
          CPU <b>{pottedN.black}</b>
          <small>/9</small>
        </div>
      </div>

      <p className="game-status">{status}</p>

      <div className="carrom-stage">
        <canvas
          ref={canvasRef}
          width={720}
          height={720}
          aria-label="Carrom board"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      <div className="carrom-power">
        <div className="carrom-power-fill" style={{ width: `${Math.round(powerN * 100)}%` }} />
      </div>

      {phase === "idle" ? (
        <button type="button" className="primary-btn" onClick={restart}>
          Start game
        </button>
      ) : null}
      {phase === "over" ? (
        <button type="button" className="primary-btn" onClick={restart}>
          Play again
        </button>
      ) : null}
      {phase !== "idle" && phase !== "over" ? (
        <button type="button" className="ghost-btn" onClick={restart}>
          Restart
        </button>
      ) : null}

      <p className="carrom-hint">
        Drag the striker to move it · pull back from anywhere to aim · release to shoot ·
        arrow keys fine-tune, space shoots
      </p>
    </div>
  );
}
