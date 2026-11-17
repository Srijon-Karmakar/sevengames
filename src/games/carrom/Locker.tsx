/* Carrom locker: pick a striker and a coin set. Items unlock by level, or all at once with Pro. */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { COIN_SETS, STRIKERS, coinSprite, isUnlocked, lightingSprite, strikerSprite, unlockLabel, type CoinSet, type StrikerSkin } from "./skins";
import { MAX_LEVEL, xpForLevel, type useCarromProgress } from "./progress";

type Prog = ReturnType<typeof useCarromProgress>;

export function LevelBar({ level, xp, pro, compact = false }: { level: number; xp: number; pro: boolean; compact?: boolean }) {
  const cur = xpForLevel(level);
  const next = xpForLevel(Math.min(MAX_LEVEL, level + 1));
  const pct = level >= MAX_LEVEL ? 100 : Math.round(((xp - cur) / Math.max(1, next - cur)) * 100);
  return (
    <div className={`carrom-level${compact ? " compact" : ""}`}>
      <span className="carrom-level-badge">{level}</span>
      <div className="carrom-level-main">
        <div className="carrom-level-top">
          <b>Level {level}</b>
          {pro ? <span className="carrom-pro-tag">PRO</span> : null}
          <small>{level >= MAX_LEVEL ? "Max level" : `${xp - cur} / ${next - cur} XP`}</small>
        </div>
        <div className="carrom-level-track">
          <i style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

/** Small live preview of a disc sprite (drawn on a canvas, so it matches the game exactly). */
function DiscPreview({ draw, size = 64, spin = false }: { draw: (px: number) => HTMLCanvasElement; size?: number; spin?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = Math.round(size * dpr);
    c.width = c.height = px;
    const g = c.getContext("2d")!;
    const face = draw(px);
    const light = lightingSprite(px);
    let raf = 0;
    let a = 0;
    const paint = () => {
      g.clearRect(0, 0, px, px);
      g.save();
      g.translate(px / 2, px / 2);
      g.rotate(a);
      g.drawImage(face, -px / 2, -px / 2, px, px);
      g.restore();
      g.drawImage(light, 0, 0, px, px);
      if (spin) {
        a += 0.012;
        raf = requestAnimationFrame(paint);
      }
    };
    paint();
    return () => cancelAnimationFrame(raf);
  }, [draw, size, spin]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden="true" />;
}

export default function CarromLocker({ prog, signedIn, onBack }: { prog: Prog; signedIn: boolean; onBack: () => void }) {
  const [tab, setTab] = useState<"striker" | "coins">("striker");
  const { level, pro } = prog;

  const item = (unlocked: boolean, selected: boolean, label: string, lock: string, preview: React.ReactNode, onPick: () => void, key: string) => (
    <button
      key={key}
      type="button"
      className={`carrom-item${selected ? " is-on" : ""}${unlocked ? "" : " is-locked"}`}
      onClick={unlocked ? onPick : undefined}
      aria-pressed={selected}
      aria-disabled={!unlocked}
      title={unlocked ? label : `${label} — unlocks at ${lock}`}
    >
      <span className="carrom-item-art">{preview}</span>
      <span className="carrom-item-name">{label}</span>
      {selected ? <span className="carrom-item-tag on">Equipped</span> : unlocked ? <span className="carrom-item-tag">Use</span> : <span className={`carrom-item-tag lock${lock === "PRO" ? " pro" : ""}`}>🔒 {lock}</span>}
    </button>
  );

  return (
    <div className="carrom-locker">
      <div className="carrom-locker-head">
        <button type="button" className="ghost-btn" onClick={onBack}>
          ‹ Back
        </button>
        <h3>Customize</h3>
      </div>

      <LevelBar level={level} xp={prog.progress.xp} pro={pro} />
      <p className="carrom-hint">Earn XP every match: +10 per coin, +25 for the queen, +100 for a win (+40 if you lose).</p>

      <div className="carrom-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "striker"} className={tab === "striker" ? "on" : ""} onClick={() => setTab("striker")}>
          Strikers
        </button>
        <button type="button" role="tab" aria-selected={tab === "coins"} className={tab === "coins" ? "on" : ""} onClick={() => setTab("coins")}>
          Coin sets
        </button>
      </div>

      <div className="carrom-items">
        {tab === "striker"
          ? STRIKERS.map((s: StrikerSkin) =>
              item(
                isUnlocked(s.unlock, level, pro),
                prog.striker.id === s.id,
                s.name,
                unlockLabel(s.unlock),
                <DiscPreview draw={(px) => strikerSprite(s, px)} size={62} spin={prog.striker.id === s.id} />,
                () => prog.select({ striker: s.id }),
                s.id,
              ),
            )
          : COIN_SETS.map((c: CoinSet) =>
              item(
                isUnlocked(c.unlock, level, pro),
                prog.coinSet.id === c.id,
                c.name,
                unlockLabel(c.unlock),
                <span className="carrom-coin-trio">
                  <DiscPreview draw={(px) => coinSprite(c, "white", px)} size={34} />
                  <DiscPreview draw={(px) => coinSprite(c, "queen", px)} size={34} />
                  <DiscPreview draw={(px) => coinSprite(c, "black", px)} size={34} />
                </span>,
                () => prog.select({ coins: c.id }),
                c.id,
              ),
            )}
      </div>

      {!pro ? (
        <div className="carrom-pro-card">
          <div>
            <b>Senevon Pro</b>
            <p>Unlock every striker and coin set instantly, including Pro-only designs like Galaxy, Lava Core and Crystal.</p>
          </div>
          {signedIn ? (
            <button type="button" className="primary-btn" disabled title="Payments are coming soon">
              Upgrade — coming soon
            </button>
          ) : (
            <Link className="primary-btn" to="/login?next=/game/carrom">
              Sign in to go Pro
            </Link>
          )}
        </div>
      ) : (
        <p className="carrom-hint">You're Pro — everything is unlocked. Thanks for supporting Senevon!</p>
      )}
      {!signedIn ? <p className="carrom-hint">Playing as guest: your level is saved on this device only. Sign in to keep it everywhere.</p> : null}
    </div>
  );
}
