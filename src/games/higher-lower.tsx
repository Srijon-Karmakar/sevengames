import { useRef, useState } from "react";
import type { GameProps } from "./index";

function draw(exclude: number[]) {
  let value = Math.floor(1 + Math.random() * 100);
  while (exclude.includes(value)) {
    value = Math.floor(1 + Math.random() * 100);
  }
  return value;
}

export default function HigherLower({ onFinish }: GameProps) {
  const [current, setCurrent] = useState(() => draw([]));
  const [next, setNext] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState("Will the next number be higher or lower?");
  const [locked, setLocked] = useState(false);
  const finishedRef = useRef(false);

  function guess(direction: "higher" | "lower") {
    if (locked) return;
    setLocked(true);

    const value = draw([current]);
    setNext(value);

    const correct = direction === "higher" ? value > current : value < current;
    window.setTimeout(() => {
      if (correct) {
        const nextStreak = streak + 1;
        setStreak(nextStreak);
        setScore(nextStreak * 30);
        setMessage(`Correct — it was ${value}. Keep going.`);
        setCurrent(value);
        setNext(null);
        setLocked(false);
      } else {
        setMessage(`It was ${value}. Streak broken at ${streak}.`);
        if (!finishedRef.current) {
          finishedRef.current = true;
          onFinish(streak * 30);
        }
      }
    }, 850);
  }

  function reset() {
    finishedRef.current = false;
    setCurrent(draw([]));
    setNext(null);
    setStreak(0);
    setScore(0);
    setLocked(false);
    setMessage("Will the next number be higher or lower?");
  }

  return (
    <div className="game-surface">
      <p className="game-status">
        Streak {streak} · Score {score}
      </p>
      <h3 className="game-prompt big">
        {next !== null ? next : current}
      </h3>
      <p className="game-hint">{message}</p>
      <div className="answer-grid two">
        <button
          type="button"
          className="answer-btn"
          onClick={() => guess("higher")}
          disabled={locked || next !== null}
        >
          ▲ Higher
        </button>
        <button
          type="button"
          className="answer-btn"
          onClick={() => guess("lower")}
          disabled={locked || next !== null}
        >
          ▼ Lower
        </button>
      </div>
      {finishedRef.current ? (
        <button type="button" className="primary-btn" onClick={reset}>
          Play again
        </button>
      ) : null}
    </div>
  );
}
