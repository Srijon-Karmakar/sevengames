import { useEffect, useRef, useState } from "react";
import type { GameProps } from "./index";

function randomColor() {
  const h = Math.floor(Math.random() * 360);
  const s = 55 + Math.floor(Math.random() * 20);
  const l = 50 + Math.floor(Math.random() * 8);
  return { h, s, l };
}

export default function ColorMatch({ onFinish }: GameProps) {
  const [level, setLevel] = useState(1);
  const [base, setBase] = useState(() => randomColor());
  const [oddIndex, setOddIndex] = useState(() => Math.floor(Math.random() * 9));
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [timeLeft, setTimeLeft] = useState(3000);
  const finishedRef = useRef(false);

  const difference = Math.max(2, 36 - level * 3);
  const oddColor = {
    ...base,
    l: Math.min(96, base.l + difference),
  };
  const grid = 3;

  function nextLevel() {
    setLevel((value) => value + 1);
    setBase(randomColor());
    setOddIndex(Math.floor(Math.random() * 9));
    setTimeLeft(Math.max(1200, 3000 - level * 120));
  }

  useEffect(() => {
    if (over) return;
    const interval = window.setInterval(() => {
      setTimeLeft((value) => {
        if (value <= 100) {
          setOver(true);
          return 0;
        }
        return value - 100;
      });
    }, 100);
    return () => window.clearInterval(interval);
  }, [over]);

  useEffect(() => {
    if (over && !finishedRef.current) {
      finishedRef.current = true;
      onFinish((level - 1) * 30);
    }
  }, [over, level, onFinish]);

  function tap(index: number) {
    if (over) return;
    if (index === oddIndex) {
      setScore(level * 30);
      nextLevel();
    } else {
      setOver(true);
    }
  }

  function reset() {
    finishedRef.current = false;
    setLevel(1);
    setBase(randomColor());
    setOddIndex(Math.floor(Math.random() * 9));
    setScore(0);
    setOver(false);
    setTimeLeft(3000);
  }

  return (
    <div className="game-surface">
      <p className="game-status">
        {over ? `Over — you reached level ${level}` : `Level ${level} · Score ${score}`}
      </p>
      <div className="timer-bar">
        <div className="timer-fill" style={{ width: `${(timeLeft / Math.max(1200, 3000 - level * 120)) * 100}%` }} />
      </div>
      <div className="color-grid">
        {Array.from({ length: grid * grid }).map((_, index) => {
          const color = index === oddIndex ? oddColor : base;
          return (
            <button
              key={index}
              type="button"
              className="color-tile"
              style={{ background: `hsl(${color.h} ${color.s}% ${color.l}%)` }}
              onClick={() => tap(index)}
              aria-label={`Tile ${index + 1}`}
            />
          );
        })}
      </div>
      {over ? (
        <button type="button" className="primary-btn" onClick={reset}>
          Play again
        </button>
      ) : null}
    </div>
  );
}
