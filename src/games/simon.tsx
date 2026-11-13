import { useCallback, useEffect, useRef, useState } from "react";
import type { GameProps } from "./index";

const PADS = [
  { color: "#ff375f", light: "#ffb3c0" },
  { color: "#0a84ff", light: "#a8d4ff" },
  { color: "#30d158", light: "#b3f0c2" },
  { color: "#ff9f0a", light: "#ffe0b0" },
];

type Phase = "watch" | "repeat" | "over";

export default function SimonGame({ onFinish }: GameProps) {
  const [sequence, setSequence] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>("watch");
  const [active, setActive] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const playSequence = useCallback(
    (seq: number[]) => {
      clearTimers();
      setPhase("watch");
      seq.forEach((pad, index) => {
        timersRef.current.push(
          window.setTimeout(() => {
            setActive(pad);
            timersRef.current.push(window.setTimeout(() => setActive(null), 320));
          }, 600 + index * 620),
        );
      });
      timersRef.current.push(
        window.setTimeout(() => {
          setPhase("repeat");
          setStep(0);
        }, 600 + seq.length * 620),
      );
    },
    [clearTimers],
  );

  useEffect(() => clearTimers, [clearTimers]);

  function start() {
    const seq = [Math.floor(Math.random() * 4)];
    setSequence(seq);
    playSequence(seq);
  }

  function press(pad: number) {
    if (phase !== "repeat") return;

    setActive(pad);
    window.setTimeout(() => setActive(null), 160);

    if (sequence[step] === pad) {
      if (step + 1 === sequence.length) {
        // Round complete — extend the sequence
        const next = [...sequence, Math.floor(Math.random() * 4)];
        setSequence(next);
        playSequence(next);
      } else {
        setStep(step + 1);
      }
    } else {
      setPhase("over");
      onFinish(Math.max(0, (sequence.length - 1) * 25));
    }
  }

  return (
    <div className="game-surface">
      <p className="game-status">
        {phase === "watch"
          ? "Watch the sequence…"
          : phase === "repeat"
            ? "Your turn"
            : `Over — you reached ${Math.max(0, sequence.length - 1)} rounds`}
      </p>
      <div className="simon-grid">
        {PADS.map((pad, index) => (
          <button
            key={index}
            type="button"
            className="simon-pad"
            style={{ background: active === index ? pad.light : pad.color }}
            onClick={() => press(index)}
            disabled={phase === "watch" || phase === "over"}
            aria-label={`Pad ${index + 1}`}
          />
        ))}
      </div>
      {phase === "over" || sequence.length === 0 ? (
        <button type="button" className="primary-btn" onClick={start}>
          {sequence.length === 0 ? "Start" : "Play again"}
        </button>
      ) : null}
    </div>
  );
}
