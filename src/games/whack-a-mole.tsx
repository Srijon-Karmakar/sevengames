import { useEffect, useRef, useState } from "react";
import type { GameProps } from "./index";

const HOLES = 9;
const DURATION_MS = 20000;

export default function WhackAMole({ onFinish }: GameProps) {
  const [activeMole, setActiveMole] = useState<number | null>(null);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [running, setRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DURATION_MS);
  const finishedRef = useRef(false);
  const hideTimerRef = useRef<number | null>(null);

  function popMole() {
    const hole = Math.floor(Math.random() * HOLES);
    setActiveMole(hole);
    const lifetime = Math.max(420, 950 - hits * 30);
    hideTimerRef.current = window.setTimeout(() => {
      setActiveMole(null);
      setMisses((value) => value + 1);
      window.setTimeout(popMole, 180);
    }, lifetime);
  }

  useEffect(() => {
    if (!running) return;

    const countdown = window.setInterval(() => {
      setTimeLeft((value) => {
        if (value <= 100) {
          return 0;
        }
        return value - 100;
      });
    }, 100);

    popMole();

    return () => {
      window.clearInterval(countdown);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      setActiveMole(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => {
    if (running && timeLeft === 0 && !finishedRef.current) {
      finishedRef.current = true;
      setRunning(false);
      onFinish(hits * 20);
    }
  }, [running, timeLeft, hits, onFinish]);

  function start() {
    finishedRef.current = false;
    setHits(0);
    setMisses(0);
    setTimeLeft(DURATION_MS);
    setRunning(true);
  }

  function whack(hole: number) {
    if (!running) return;
    if (hole === activeMole) {
      setHits((value) => value + 1);
      setActiveMole(null);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      window.setTimeout(popMole, 180);
    } else {
      setMisses((value) => value + 1);
    }
  }

  return (
    <div className="game-surface">
      <p className="game-status">
        {running
          ? `Hits ${hits} · Misses ${misses} · ${Math.ceil(timeLeft / 1000)}s left`
          : finishedRef.current
            ? `Time! You hit ${hits} moles.`
            : `Tap the mole the moment it pops up.`}
      </p>
      <div className="mole-grid">
        {Array.from({ length: HOLES }).map((_, index) => (
          <button
            key={index}
            type="button"
            className={`mole-hole${running && activeMole === index ? " active" : ""}`}
            onClick={() => whack(index)}
            disabled={!running}
            aria-label={`Hole ${index + 1}`}
          />
        ))}
      </div>
      {!running ? (
        <button type="button" className="primary-btn" onClick={start}>
          {finishedRef.current ? "Play again" : "Start"}
        </button>
      ) : null}
    </div>
  );
}
