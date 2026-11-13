import { useEffect, useRef, useState } from "react";
import type { GameProps } from "./index";

function makeProblem(level: number) {
  const ceiling = 10 + level * 6;
  const left = Math.floor(2 + Math.random() * ceiling);
  const right = Math.floor(2 + Math.random() * ceiling);
  const ops = level > 3 ? ["+", "−", "×"] : level > 1 ? ["+", "−"] : ["+"];
  const op = ops[Math.floor(Math.random() * ops.length)];
  const answer = op === "+" ? left + right : op === "−" ? left - right : left * right;
  return { label: `${left} ${op} ${right}`, answer };
}

const ROUND_TIME_MS = 12000;
const ROUNDS = 8;

export default function MathGame({ onFinish }: GameProps) {
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [value, setValue] = useState("");
  const [problem, setProblem] = useState(() => makeProblem(1));
  const [deadline, setDeadline] = useState(() => Date.now() + ROUND_TIME_MS);
  const [remaining, setRemaining] = useState(ROUND_TIME_MS);
  const finishedRef = useRef(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const left = deadline - Date.now();
      setRemaining(Math.max(0, left));
      if (left <= 0) {
        // Timeout counts as a miss
        advance(false);
      }
    }, 200);
    return () => window.clearInterval(interval);
  });

  function advance(correct: boolean) {
    const nextScore = score + (correct ? 50 + Math.max(0, Math.round((deadline - Date.now()) / 200)) : 0);
    setScore(nextScore);
    setValue("");
    if (round >= ROUNDS) {
      if (!finishedRef.current) {
        finishedRef.current = true;
        onFinish(nextScore);
      }
    } else {
      setRound(round + 1);
      setProblem(makeProblem(round));
      setDeadline(Date.now() + ROUND_TIME_MS);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (finishedRef.current) return;
    advance(Number(value) === problem.answer);
  }

  function reset() {
    finishedRef.current = false;
    setRound(1);
    setScore(0);
    setValue("");
    setProblem(makeProblem(1));
    setDeadline(Date.now() + ROUND_TIME_MS);
  }

  return (
    <div className="game-surface">
      <p className="game-status">
        Round {Math.min(round, ROUNDS)}/{ROUNDS} · Score {score}
      </p>
      <h3 className="game-prompt big">{finishedRef.current ? "Done" : problem.label}</h3>
      <div className="timer-bar">
        <div
          className="timer-fill"
          style={{ width: `${Math.min(100, (remaining / ROUND_TIME_MS) * 100)}%` }}
        />
      </div>
      {!finishedRef.current ? (
        <form className="answer-form" onSubmit={submit}>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            inputMode="numeric"
            autoFocus
            aria-label="Your answer"
          />
          <button className="primary-btn" type="submit">
            Enter
          </button>
        </form>
      ) : (
        <button type="button" className="primary-btn" onClick={reset}>
          Play again
        </button>
      )}
    </div>
  );
}
