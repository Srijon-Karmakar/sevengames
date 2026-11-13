/* Carrom rendering — pure canvas drawing, no game logic. */
import {
  BASE_MAX,
  BASE_MIN,
  PF_MAX,
  POCKETS,
  POCKET_R,
  SIZE,
  STRIKER_R,
  WALL,
  baselineFor,
  type Disc,
  type Vec,
  type World,
} from "./engine";

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

export function drawBoard(ctx: CanvasRenderingContext2D) {
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

  // centre circles
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

  // diagonal arrows
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
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x2, y2, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  // four rotated baselines
  for (let i = 0; i < 4; i += 1) {
    ctx.save();
    ctx.translate(500, 500);
    ctx.rotate((i * Math.PI) / 2);
    ctx.translate(-500, -500);
    const y = PF_MAX - 44;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(BASE_MIN, y - 10);
    ctx.lineTo(BASE_MAX, y - 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(BASE_MIN, y + 10);
    ctx.lineTo(BASE_MAX, y + 10);
    ctx.stroke();
    for (const cx of [BASE_MIN, BASE_MAX]) {
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

/** Soft highlight strip behind the acting seat's baseline. */
export function drawBaselineGlow(ctx: CanvasRenderingContext2D, world: World, seat: number) {
  const bl = baselineFor(seat, world.seats);
  ctx.save();
  ctx.fillStyle = "rgba(47,111,208,0.08)";
  const pad = 44;
  if (bl.axis === "h") {
    ctx.fillRect(bl.min - pad, bl.at - pad, bl.max - bl.min + pad * 2, pad * 2);
  } else {
    ctx.fillRect(bl.at - pad, bl.min - pad, pad * 2, bl.max - bl.min + pad * 2);
  }
  ctx.restore();
}

export function drawShadow(ctx: CanvasRenderingContext2D, d: Disc) {
  ctx.beginPath();
  ctx.arc(d.x + 2, d.y + 4, d.r * 1.02, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(60,35,8,0.22)";
  ctx.fill();
}

export function drawCoin(ctx: CanvasRenderingContext2D, d: Disc) {
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
  ctx.strokeStyle = d.kind === "white" ? "#b3a685" : d.kind === "black" ? "#000000" : "#6e1b16";
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

export function drawStriker(
  ctx: CanvasRenderingContext2D,
  d: Disc,
  ring: string,
  pulse: number,
  glow: boolean,
) {
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

export function drawAim(
  ctx: CanvasRenderingContext2D,
  s: Vec,
  dir: Vec,
  power: number,
  color: string,
) {
  const L = 130 + power * 560;
  const ex = s.x + dir.x * L;
  const ey = s.y + dir.y * L;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3.5;
  ctx.setLineDash([16, 13]);
  ctx.beginPath();
  ctx.moveTo(s.x + dir.x * (STRIKER_R + 6), s.y + dir.y * (STRIKER_R + 6));
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
  ctx.arc(s.x, s.y, STRIKER_R + 10, -Math.PI / 2, -Math.PI / 2 + power * Math.PI * 2);
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

export function drawSinks(ctx: CanvasRenderingContext2D, world: World) {
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
}

const SEAT_COLORS = ["#2f6fd0", "#c2392f", "#1f9d55", "#b8860b"];

export function seatRingColor(seat: number): string {
  return SEAT_COLORS[seat % 4];
}

/** Small seat labels around the board showing who sits where. */
export function drawSeatLabels(ctx: CanvasRenderingContext2D, world: World, mySeat: number | null) {
  ctx.save();
  ctx.font = "600 26px -apple-system, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const p of world.players) {
    const bl = baselineFor(p.seat, world.seats);
    const mx = (bl.min + bl.max) / 2;
    const off = 66;
    let lx: number;
    let ly: number;
    let rot = 0;
    if (bl.axis === "h") {
      lx = mx;
      ly = bl.at + (bl.at > 500 ? off : -off);
      rot = bl.at > 500 ? 0 : Math.PI;
    } else {
      lx = bl.at + (bl.at > 500 ? off : -off);
      ly = mx;
      rot = bl.at > 500 ? Math.PI / 2 : -Math.PI / 2;
    }
    const isTurn = world.turn === p.seat;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(rot);
    const label = `${p.name}${p.seat === mySeat ? " (you)" : ""}`;
    ctx.fillStyle = isTurn ? seatRingColor(p.seat) : "rgba(60,35,10,0.45)";
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}
