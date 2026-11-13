import { useEffect, useRef, useState } from "react";
import type { GameProps } from "./index";

const TOTAL_TARGETS = 12;
const TARGET_LIFETIME_MS = 1100;

function randomPosition() {
  return {
    x: 10 + Math.random() * 76,
    y: 12 + Math.random() * 72,
  };
}

export default function ReflexGame({ onFinish }: GameProps) {
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [target, setTarget] = useState(randomPosition);
  const [done, setDone] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (done) return;
    const timer = window.setTimeout(() => {
      setMisses((value) => value + 1);
      setTarget(randomPosition());
    }, TARGET_LIFETIME_MS);
    return () => window.clearTimeout(timer);
  }, [target, done]);

  useEffect(() => {
    if (hits + misses >= TOTAL_TARGETS && !finishedRef.current) {
      finishedRef.current = true;
      setDone(true);
      onFinish(hits * 15);
    }
  }, [hits, misses, onFinish]);

  function hit() {
    if (done) return;
    setHits((value) => value + 1);
    setTarget(randomPosition());
  }

  return (
    <div className="game-surface">
      <p className="game-status">
        {done ? `Done — ${hits}/${TOTAL_TARGETS} targets` : `Tap ${hits}/${TOTAL_TARGETS}`}
      </p>
      <div className="reflex-stage">
        {!done ? (
          <button
            type="button"
            className="reflex-target"
            style={{ left: `${target.x}%`, top: `${target.y}%` }}
            onClick={hit}
            aria-label="Tap the target"
          />
        ) : null}
      </div>
      <button
        type="button"
        className="ghost-btn"
        onClick={() => {
          finishedRef.current = false;
          setHits(0);
          setMisses(0);
          setDone(false);
          setTarget(randomPosition());
        }}
      >
        Restart
      </button>
    </div>
  );
}
