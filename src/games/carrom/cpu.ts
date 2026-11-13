/* Carrom CPU — pocket-shot search over striker placements, ghost-ball targeting,
   occlusion checks, plus a safety nudge fallback and human-like aim error. */
import {
  BASE_MAX,
  BASE_MIN,
  POCKETS,
  STRIKER_R,
  clamp,
  dist,
  freeAlong,
  norm,
  segDist,
  strikerPos,
  type Disc,
  type Vec,
  type World,
} from "./engine";

export type CpuPlan = { t: number; dir: Vec; power: number };

export function planCpuShot(world: World): CpuPlan {
  const seat = world.turn;
  const own = world.players[seat].color;
  const targets: Disc[] = world.discs.filter((d) => d.alive && d.kind === own);
  if (world.queen.state === "board" && world.queenDisc.alive) targets.push(world.queenDisc);

  let best: (CpuPlan & { score: number }) | null = null;

  for (let i = 0; i <= 24; i += 1) {
    const t = BASE_MIN + ((BASE_MAX - BASE_MIN) * i) / 24;
    const s = strikerPos(seat, world.seats, t);
    const placed = world.discs.some(
      (d) => d.alive && d.kind !== "striker" && dist(d, s) < d.r + STRIKER_R + 2,
    );
    if (placed) continue;

    for (const coin of targets) {
      for (const p of POCKETS) {
        const dp = norm({ x: p.x - coin.x, y: p.y - coin.y });
        const ghost = {
          x: coin.x - dp.x * (coin.r + STRIKER_R),
          y: coin.y - dp.y * (coin.r + STRIKER_R),
        };
        const toGhost = { x: ghost.x - s.x, y: ghost.y - s.y };
        const L = Math.hypot(toGhost.x, toGhost.y);
        if (L < STRIKER_R + 6) continue;
        const dir = { x: toGhost.x / L, y: toGhost.y / L };
        const cosCut = dir.x * dp.x + dir.y * dp.y;
        if (cosCut < 0.3) continue;

        let blocked = false;
        for (const o of world.discs) {
          if (!o.alive || o === coin || o.kind === "striker") continue;
          if (segDist(o, s, ghost) < o.r + STRIKER_R - 2) {
            blocked = true;
            break;
          }
        }
        if (!blocked) {
          for (const o of world.discs) {
            if (!o.alive || o === coin || o.kind === "striker") continue;
            if (segDist(o, coin, p) < o.r + coin.r - 2) {
              blocked = true;
              break;
            }
          }
        }
        if (blocked) continue;

        const td = dist(coin, p);
        const score = cosCut * 2.2 - L / 1400 - td / 1500 + (coin.kind === "queen" ? 0.25 : 0);
        if (!best || score > best.score) {
          best = {
            t: freeAlong(world, seat, t),
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
    plan = { t: best.t, dir: best.dir, power: best.power };
  } else {
    const s0 = strikerPos(seat, world.seats, 500);
    const nearest = world.discs
      .filter((d) => d.alive && d.kind === own)
      .sort((a, b) => dist(a, s0) - dist(b, s0))[0];
    const target = nearest ?? world.queenDisc;
    const t = freeAlong(world, seat, clamp(target.x, BASE_MIN, BASE_MAX));
    const s = strikerPos(seat, world.seats, t);
    plan = { t, dir: norm({ x: target.x - s.x, y: target.y - s.y }), power: 0.7 };
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
