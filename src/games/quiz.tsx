import { useState } from "react";
import type { GameProps } from "./index";

const QUESTIONS: Array<{ q: string; options: string[]; answer: string }> = [
  { q: "Which number is prime?", options: ["21", "29", "39"], answer: "29" },
  { q: "What comes next: 2, 4, 8, 16, …?", options: ["24", "30", "32"], answer: "32" },
  { q: "Which planet is closest to the Sun?", options: ["Venus", "Mercury", "Mars"], answer: "Mercury" },
  { q: "How many continents are there?", options: ["5", "6", "7"], answer: "7" },
  { q: "What is 12 × 12?", options: ["124", "144", "156"], answer: "144" },
  { q: "Which is the largest ocean?", options: ["Atlantic", "Indian", "Pacific"], answer: "Pacific" },
  { q: "What is the square root of 81?", options: ["7", "8", "9"], answer: "9" },
  { q: "Water freezes at…", options: ["0°C", "10°C", "32°C"], answer: "0°C" },
  { q: "Which shape has three sides?", options: ["Square", "Triangle", "Circle"], answer: "Triangle" },
  { q: "How many minutes in 1.5 hours?", options: ["75", "90", "105"], answer: "90" },
];

export default function QuizGame({ onFinish }: GameProps) {
  const [deck] = useState(() => [...QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 5));
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  const current = deck[index];
  const finished = index >= deck.length;

  function pick(option: string) {
    if (picked) return;
    setPicked(option);
    const correct = option === current.answer;
    const nextScore = score + (correct ? 60 : 0);
    setScore(nextScore);
    window.setTimeout(() => {
      setPicked(null);
      setIndex((value) => value + 1);
      if (index === deck.length - 1) onFinish(nextScore);
    }, 750);
  }

  if (finished) {
    return (
      <div className="game-surface">
        <p className="game-status">Score {score}</p>
        <button
          type="button"
          className="primary-btn"
          onClick={() => {
            setIndex(0);
            setScore(0);
          }}
        >
          Play again
        </button>
      </div>
    );
  }

  return (
    <div className="game-surface">
      <p className="game-status">
        Question {index + 1}/{deck.length}
      </p>
      <h3 className="game-prompt">{current.q}</h3>
      <div className="answer-grid">
        {current.options.map((option) => (
          <button
            key={option}
            type="button"
            className={`answer-btn${picked === option ? (option === current.answer ? " correct" : " wrong") : picked ? (option === current.answer ? " correct" : "") : ""}`}
            onClick={() => pick(option)}
            disabled={Boolean(picked)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
