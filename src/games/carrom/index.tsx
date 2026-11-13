/* Carrom game component — mode menu (1vCPU, 2P, 4P, online), lobby,
   and the shared game table with host-authoritative online sync. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { GameProps } from "../index";
import {
  SIZE,
  SUB,
  applyLive,
  applySnapshot,
  baselineFor,
  clamp,
  dist,
  makeWorld,
  minDirFor,
  placeStriker,
  resetStriker,
  resolveShot,
  scoreForSeat,
  settled,
  shootStriker,
  snapshotOf,
  stepPhysics,
  type LivePos,
  type Player,
  type Seats,
  type Snap,
  type World,
} from "./engine";
import { planCpuShot, type CpuPlan } from "./cpu";
import {
  drawAim,
  drawBaselineGlow,
  drawBoard,
  drawCoin,
  drawSeatLabels,
  drawSinks,
  drawStriker,
  seatRingColor,
} from "./render";
import { CarromNet, type NetStatus, type RosterEntry } from "./online";

type Mode = "cpu" | "local2" | "local4" | "host2" | "host4" | "join";

type Phase =
  | "menu"
  | "join-form"
  | "net-lobby"
  | "place"
  | "shooting"
  | "cpu"
  | "cpu-aim"
  | "over";

const LOCAL_MODES: Mode[] = ["cpu", "local2", "local4"];

export default function CarromGame({ onFinish }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<World | null>(null);
  const phaseRef = useRef<Phase>("menu");
  const aimRef = useRef<{ dir: { x: number; y: number }; power: number }>({
    dir: { x: 0, y: -1 },
    power: 0.65,
  });
  const dragRef = useRef<{ mode: "aim" | "place"; ax: number; ay: number } | null>(null);
  const cpuPlanRef = useRef<CpuPlan | null>(null);
  const shotStartRef = useRef(0);
  const finishedRef = useRef(false);
  const modeRef = useRef<Mode>("cpu");
  const mySeatRef = useRef(0);
  const netRef = useRef<CarromNet | null>(null);
  const lastPlaceRef = useRef(0);
  const finishShotRef = useRef<() => void>(() => {});
  const fireRef = useRef<(dir: { x: number; y: number }, power: number) => void>(() => {});
  const drawRef = useRef<() => void>(() => {});

  const [screen, setScreen] = useState<Phase>("menu");
  const [message, setMessage] = useState("Pick a mode to play.");
  const [potted, setPotted] = useState({ white: 0, black: 0 });
  const [queenText, setQueenText] = useState("in play");
  const [powerN, setPowerN] = useState(0.65);
  const [turnName, setTurnName] = useState("—");
  const [joinCode, setJoinCode] = useState("");
  const [netStatus, setNetStatus] = useState<NetStatus>("idle");
  const [netNote, setNetNote] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [roomSeats, setRoomSeats] = useState<Seats>(2);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setScreen(p);
  }, []);

  const queenTextOf = useCallback((world: World) => {
    const q = world.queen;
    return q.state === "board"
      ? "in play"
      : q.state === "pending"
        ? `${world.players[q.seat].name} must cover`
        : `${world.players.find((p) => p.color === q.color)?.name ?? "team"}'s queen`;
  }, []);

  /* ============ shooting + shot resolution ============ */

  const fire = useCallback(
    (dir: { x: number; y: number }, power: number) => {
      const world = worldRef.current;
      if (!world || phaseRef.current !== "place") return;
      if (world.players[world.turn].kind === "remote") return;
      if (modeRef.current.startsWith("host") && world.turn !== mySeatRef.current) return;
      if (!shootStriker(world, dir, power)) return;
      shotStartRef.current = performance.now();
      setPhase("shooting");
      if (netRef.current && modeRef.current.startsWith("host")) {
        netRef.current.broadcastSnapshot(snapshotOf(world));
      }
    },
    [setPhase],
  );

  const finishShot = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    const res = resolveShot(world);
    setPotted({ white: world.potted.white.length, black: world.potted.black.length });
    setQueenText(queenTextOf(world));

    if (res.over) {
      const winSeat = world.players.find((p) => p.color === world.result?.winner);
      const score = scoreForSeat(world, mySeatRef.current);
      setMessage(
        `${res.msg} ${winSeat ? `${winSeat.name} win${winSeat.name === "You" ? "" : "s"}!` : ""}`,
      );
      setPhase("over");
      if (!finishedRef.current) {
        finishedRef.current = true;
        onFinish(score);
      }
      if (netRef.current && modeRef.current.startsWith("host")) {
        netRef.current.broadcastSnapshot(snapshotOf(world));
      }
      return;
    }

    setMessage(res.msg + (res.extra ? " Shoot again." : ""));
    if (netRef.current && modeRef.current.startsWith("host")) {
      netRef.current.broadcastSnapshot(snapshotOf(world));
    }
    const turn = world.turn;
    setTurnName(world.players[turn].name);
    setPhase(world.players[turn].kind === "cpu" ? "cpu" : "place");
  }, [onFinish, queenTextOf, setPhase]);

  useEffect(() => {
    finishShotRef.current = finishShot;
    fireRef.current = fire;
  }, [finishShot, fire]);

  /* ============ main loop ============ */

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const world = worldRef.current;

      if (world && phaseRef.current === "shooting") {
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
        if (netRef.current && modeRef.current.startsWith("host")) {
          netRef.current.broadcastLive(
            world.discs
              .filter((d) => d.alive && (d.vx !== 0 || d.vy !== 0))
              .map((d) => [d.id, Math.round(d.x), Math.round(d.y)] as LivePos),
          );
        }
        if (settled(world)) {
          acc = 0;
          finishShotRef.current();
        }
      } else {
        acc = 0;
      }
      drawRef.current();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ============ CPU sequencing ============ */

  useEffect(() => {
    if (screen === "cpu") {
      const t1 = window.setTimeout(() => {
        const world = worldRef.current;
        if (!world || phaseRef.current !== "cpu") return;
        const plan = planCpuShot(world);
        cpuPlanRef.current = plan;
        world.strikerT[world.turn] = plan.t;
        resetStriker(world, world.turn);
        setMessage(`${world.players[world.turn].name} is lining up a shot…`);
        setPhase("cpu-aim");
      }, 700);
      return () => window.clearTimeout(t1);
    }
    if (screen === "cpu-aim") {
      const t2 = window.setTimeout(() => {
        const world = worldRef.current;
        const plan = cpuPlanRef.current;
        cpuPlanRef.current = null;
        if (!world || !plan) return;
        placeStriker(world, world.turn, plan.t);
        if (shootStriker(world, plan.dir, plan.power)) {
          shotStartRef.current = performance.now();
          setPhase("shooting");
        }
      }, 800);
      return () => window.clearTimeout(t2);
    }
    return undefined;
  }, [screen, setPhase]);

  /* ============ local games ============ */

  function startLocal(mode: "cpu" | "local2" | "local4") {
    modeRef.current = mode;
    finishedRef.current = false;
    netRef.current?.leave();
    netRef.current = null;
    const players: Array<{ name: string; kind: "human" | "cpu" }> =
      mode === "cpu"
        ? [
            { name: "You", kind: "human" },
            { name: "CPU", kind: "cpu" },
          ]
        : mode === "local2"
          ? [
              { name: "Player 1", kind: "human" },
              { name: "Player 2", kind: "human" },
            ]
          : [
              { name: "P1", kind: "human" },
              { name: "P2", kind: "human" },
              { name: "P3", kind: "human" },
              { name: "P4", kind: "human" },
            ];
    const world = makeWorld({ seats: mode === "local4" ? 4 : 2, players });
    worldRef.current = world;
    setPotted({ white: 0, black: 0 });
    setQueenText("in play");
    setPowerN(0.65);
    setTurnName(world.players[0].name);
    aimRef.current = {
      dir: { ...minDirFor(0, world.seats) },
      power: 0.65,
    };
    setMessage(
      mode === "local4"
        ? "Teams: P1+P3 (white) vs P2+P4 (black). P1 breaks!"
        : mode === "local2"
          ? "Pass the device — Player 1 (white) breaks!"
          : "Break! Pull back from the striker to aim, release to shoot.",
    );
    setPhase("place");
  }

  /* ============ online wiring ============ */

  const netEvents = useCallback(
    () => ({
      onStatus: (status: NetStatus, note?: string) => {
        setNetStatus(status);
        setNetNote(note ?? null);
      },
      onRoster: (list: RosterEntry[], seats: Seats) => {
        setRoster(list);
        setRoomSeats(seats);
        if (netRef.current?.isHostClient) {
          netRef.current.broadcastRoster(false);
        }
      },
      onStart: (cfg: { seats: Seats; players: Array<{ name: string; kind: "human" | "cpu" }> }) => {
        finishedRef.current = false;
        const players: Player[] = cfg.players.map((p, i) => ({
          seat: i,
          name: p.name,
          kind: mySeatRef.current === i ? "human" : p.kind === "cpu" ? "cpu" : "remote",
        }));
        const world = makeWorld({ seats: cfg.seats, players });
        worldRef.current = world;
        setPotted({ white: 0, black: 0 });
        setQueenText("in play");
        setPowerN(0.65);
        setTurnName(world.players[0].name);
        aimRef.current = {
          dir: { ...minDirFor(0, world.seats) },
          power: 0.65,
        };
        setMessage("Game on — good luck!");
        setPhase("place");
      },
      onSnapshot: (snap: Snap) => {
        const world = worldRef.current;
        if (!world) return;
        applySnapshot(world, snap);
        setPotted({ white: world.potted.white.length, black: world.potted.black.length });
        setQueenText(queenTextOf(world));
        if (snap.winner) {
          const score = scoreForSeat(world, mySeatRef.current);
          setMessage("Match over.");
          setPhase("over");
          if (!finishedRef.current) {
            finishedRef.current = true;
            onFinish(score);
          }
          return;
        }
        setTurnName(world.players[world.turn]?.name ?? "—");
        const kind = world.players[world.turn]?.kind;
        setPhase(kind === "human" ? "place" : "shooting");
      },
      onLive: (positions: LivePos[]) => {
        const world = worldRef.current;
        if (!world || phaseRef.current !== "shooting") return;
        applyLive(world, positions);
      },
      onMessage: (text: string) => setMessage(text),
    }),
    [onFinish, queenTextOf, setPhase],
  );

  function hostRoom(seats: Seats) {
    netRef.current?.leave();
    finishedRef.current = false;
    setIsHost(true);
    modeRef.current = seats === 4 ? "host4" : "host2";
    mySeatRef.current = 0;
    setPhase("net-lobby");
    setNetStatus("connecting");
    setNetNote(null);
    const net = CarromNet.createHost("You", seats, netEvents());
    netRef.current = net;
    setRoomCode(net.roomCode);
  }

  function joinRoom() {
    netRef.current?.leave();
    finishedRef.current = false;
    setIsHost(false);
    modeRef.current = "join";
    setPhase("net-lobby");
    setNetStatus("connecting");
    setNetNote(null);
    const net = CarromNet.createGuest("You", joinCode, netEvents());
    netRef.current = net;
    setRoomCode(net.roomCode);
  }

  function startNetGame() {
    const net = netRef.current;
    if (!net || !net.isHostClient) return;
    const players = net.rosterList.map((entry) => ({ name: entry.name, kind: "human" as const }));
    while (players.length < roomSeats) players.push({ name: "CPU", kind: "cpu" as const });
    const cfg = { seats: roomSeats, players };
    net.broadcastStart(cfg);
    netEvents().onStart(cfg);
  }

  function leaveNet() {
    netRef.current?.leave();
    netRef.current = null;
    setRoomCode(null);
    setRoster([]);
    setNetStatus("idle");
    setNetNote(null);
    setPhase("menu");
    setMessage("Pick a mode to play.");
  }

  /* guest place/shot commands applied by the host */
  useEffect(() => {
    const net = netRef.current;
    if (!net || !net.isHostClient) return;
    net.onHostCommand({
      onPlace: (seat, t) => {
        const world = worldRef.current;
        if (!world || phaseRef.current !== "place" || world.turn !== seat) return;
        world.strikerT[seat] = t;
        resetStriker(world, seat);
      },
      onShot: (seat, t, dir, power) => {
        const world = worldRef.current;
        if (!world || phaseRef.current !== "place" || world.turn !== seat) return;
        world.strikerT[seat] = t;
        resetStriker(world, seat);
        if (shootStriker(world, dir, power)) {
          shotStartRef.current = performance.now();
          setPhase("shooting");
        }
      },
    });
    return () => net.onHostCommand({});
  }, [screen, setPhase]);

  /* ============ input ============ */

  const canControl = useCallback(() => {
    const world = worldRef.current;
    if (!world || phaseRef.current !== "place") return false;
    const kind = world.players[world.turn].kind;
    if (kind === "cpu" || kind === "remote") return false;
    if (modeRef.current.startsWith("host") && world.turn !== mySeatRef.current) return false;
    return true;
  }, []);

  const toWorld = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * SIZE,
      y: ((e.clientY - rect.top) / rect.height) * SIZE,
    };
  };

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!canControl()) return;
    const world = worldRef.current!;
    const bl = baselineFor(world.turn, world.seats);
    const p = toWorld(e);
    const s = world.striker;
    const nearStriker = dist(p, s) < 60;
    const nearBaseline =
      bl.axis === "h"
        ? Math.abs(p.y - bl.at) < 70 && p.x > bl.min - 40 && p.x < bl.max + 40
        : Math.abs(p.x - bl.at) < 70 && p.y > bl.min - 40 && p.y < bl.max + 40;
    if (nearStriker) {
      dragRef.current = { mode: "aim", ax: s.x, ay: s.y };
      aimRef.current.power = 0;
    } else if (nearBaseline) {
      dragRef.current = { mode: "place", ax: p.x, ay: p.y };
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
      const world = worldRef.current!;
      const bl = baselineFor(world.turn, world.seats);
      const t = bl.axis === "h" ? p.x : p.y;
      placeStriker(world, world.turn, t);
      if (netRef.current && modeRef.current === "join") {
        const now = performance.now();
        if (now - lastPlaceRef.current > 120) {
          lastPlaceRef.current = now;
          netRef.current.sendPlace(world.turn, t);
        }
      }
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
    } else if (netRef.current && modeRef.current === "join") {
      const world = worldRef.current;
      if (world) netRef.current.sendPlace(world.turn, world.strikerT[world.turn] ?? 500);
    }
  }

  /* keyboard aiming */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phaseRef.current !== "place" || !canControl()) return;
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
        const world = worldRef.current;
        if (!world) return;
        const inward = minDirFor(world.turn, world.seats);
        if (aim.dir.x * inward.x + aim.dir.y * inward.y < 0) {
          aim.dir = { x: -aim.dir.x, y: -aim.dir.y };
        }
        fireRef.current(aim.dir, aim.power);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canControl]);

  /* flip aim inward whenever the turn changes to a controllable seat */
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    const inward = minDirFor(world.turn, world.seats);
    if (aimRef.current.dir.x * inward.x + aimRef.current.dir.y * inward.y < 0) {
      aimRef.current.dir = { x: -aimRef.current.dir.x, y: -aimRef.current.dir.y };
    }
  }, [screen]);

  /* ============ drawing ============ */

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const world = worldRef.current;
    if (!canvas || !world) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = canvas.width / SIZE;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    drawBoard(ctx);
    const ph = phaseRef.current;
    if (ph === "place" && canControl()) {
      drawBaselineGlow(ctx, world, world.turn);
    }

    drawSinks(ctx, world);
    for (const d of world.discs) {
      if (!d.alive || d.kind === "striker") continue;
      drawCoin(ctx, d);
    }

    const aim = aimRef.current;
    if (ph === "place" && canControl() && aim.power > 0.03) {
      drawAim(ctx, world.striker, aim.dir, aim.power, "rgba(31,92,180,0.85)");
    }
    if (ph === "cpu-aim" && cpuPlanRef.current) {
      drawAim(ctx, world.striker, cpuPlanRef.current.dir, cpuPlanRef.current.power, "rgba(180,50,40,0.85)");
    }

    if (world.striker.alive) {
      const pulse = ph === "place" && canControl() ? 0.5 + 0.5 * Math.sin(performance.now() / 280) : 0;
      drawStriker(ctx, world.striker, seatRingColor(world.turn), pulse, ph === "place");
    }
    const mySeat =
      modeRef.current === "join" || modeRef.current.startsWith("host") ? mySeatRef.current : null;
    drawSeatLabels(ctx, world, mySeat);
  }, [canControl]);

  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  useEffect(() => () => netRef.current?.leave(), []);

  /* ============ UI ============ */

  if (screen === "menu" || screen === "join-form") {
    return (
      <div className="game-surface carrom-surface">
        <p className="game-status">
          {screen === "join-form" ? "Join with a 4-character room code" : "Carrom — pick a mode"}
        </p>
        {screen === "menu" ? (
          <div className="carrom-menu">
            <button type="button" className="primary-btn" onClick={() => startLocal("cpu")}>
              Single player vs CPU
            </button>
            <button type="button" className="primary-btn" onClick={() => startLocal("local2")}>
              2 players · same device
            </button>
            <button type="button" className="primary-btn" onClick={() => startLocal("local4")}>
              4 players · teams
            </button>
            <div className="carrom-menu-sep" />
            <button type="button" className="ghost-btn" disabled={!CarromNet.configured} onClick={() => hostRoom(2)}>
              Host online · 2 players
            </button>
            <button type="button" className="ghost-btn" disabled={!CarromNet.configured} onClick={() => hostRoom(4)}>
              Host online · 4 players
            </button>
            <button
              type="button"
              className="ghost-btn"
              disabled={!CarromNet.configured}
              onClick={() => setPhase("join-form")}
            >
              Join a room
            </button>
            {!CarromNet.configured ? (
              <p className="carrom-hint">
                Online play needs Supabase — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
              </p>
            ) : null}
          </div>
        ) : (
          <form
            className="carrom-join"
            onSubmit={(e) => {
              e.preventDefault();
              joinRoom();
            }}
          >
            <input
              className="carrom-code-input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="CODE"
              maxLength={4}
              autoCapitalize="characters"
              autoComplete="off"
            />
            <button type="submit" className="primary-btn" disabled={joinCode.length !== 4}>
              Join
            </button>
            <button type="button" className="ghost-btn" onClick={() => setPhase("menu")}>
              Back
            </button>
          </form>
        )}
      </div>
    );
  }

  if (screen === "net-lobby") {
    return (
      <div className="game-surface carrom-surface">
        <p className="game-status">
          {netStatus === "connecting"
            ? "Connecting…"
            : netStatus === "error"
              ? (netNote ?? "Connection error")
              : "Room lobby"}
        </p>
        {netStatus === "lobby" ? (
          <div className="carrom-lobby">
            <div className="carrom-code-box">
              <span className="carrom-code">{roomCode}</span>
              <span className="carrom-code-hint">share this code</span>
            </div>
            <ul className="carrom-roster">
              {roster.map((entry) => (
                <li key={entry.clientId}>
                  <span className="dot" style={{ background: seatRingColor(entry.seat) }} />
                  Seat {entry.seat + 1} · {entry.name}
                  {entry.isHost ? " (host)" : ""}
                </li>
              ))}
              {Array.from({ length: Math.max(0, roomSeats - roster.length) }).map((_, i) => (
                <li key={`empty-${i}`} className="empty">
                  Seat {roster.length + i + 1} · waiting…
                </li>
              ))}
            </ul>
            {isHost ? (
              <button type="button" className="primary-btn" onClick={startNetGame}>
                Start game
                {roomSeats - roster.length > 0
                  ? ` (${roomSeats - roster.length} CPU fill${roomSeats - roster.length > 1 ? "s" : ""})`
                  : ""}
              </button>
            ) : (
              <p className="carrom-hint">Waiting for the host to start…</p>
            )}
          </div>
        ) : null}
        <button type="button" className="ghost-btn" onClick={leaveNet}>
          {netStatus === "error" ? "Back to menu" : "Leave room"}
        </button>
      </div>
    );
  }

  const world = worldRef.current;
  if (!world) {
    return (
      <div className="game-surface carrom-surface">
        <p className="game-status">Loading…</p>
      </div>
    );
  }

  const isOnline = modeRef.current.startsWith("host") || modeRef.current === "join";

  return (
    <div className="game-surface carrom-surface">
      <div className="carrom-hud">
        <div className={`carrom-chip${world.turn % 2 === 0 ? " active" : ""}`}>
          <span className="dot" style={{ background: seatRingColor(0) }} />
          White <b>{potted.white}</b>
          <small>/9</small>
        </div>
        <div className="carrom-chip queen-chip" title="The queen must be covered by a coin">
          <span className="qdot">Q</span>
          {queenText}
        </div>
        <div className={`carrom-chip${world.turn % 2 === 1 ? " active" : ""}`}>
          <span className="dot" style={{ background: seatRingColor(1) }} />
          Black <b>{potted.black}</b>
          <small>/9</small>
        </div>
      </div>

      <p className="game-status">
        {screen === "over" ? message : `${turnName}'s turn — ${message}`}
      </p>

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

      {screen === "over" ? (
        <button
          type="button"
          className="primary-btn"
          onClick={() => {
            if (isOnline) {
              leaveNet();
            } else {
              startLocal(modeRef.current as "cpu" | "local2" | "local4");
            }
          }}
        >
          {isOnline ? "Back to menu" : "Play again"}
        </button>
      ) : (
        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            if (isOnline) leaveNet();
            else startLocal(modeRef.current as "cpu" | "local2" | "local4");
          }}
        >
          {isOnline ? "Leave match" : "Restart"}
        </button>
      )}

      <p className="carrom-hint">
        Drag the striker to move it · pull back to aim · release to shoot · arrow keys fine-tune,
        space shoots
      </p>
    </div>
  );
}
