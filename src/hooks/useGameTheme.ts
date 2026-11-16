import { useCallback, useEffect, useState } from "react";

/*
 * Light/dark mode for the game pages. First visit follows the device setting; once the player
 * picks a mode with the toggle it's remembered in this browser (localStorage, best effort).
 */
export type GameTheme = "light" | "dark";

const KEY = "senevon:game-theme";
const query = "(prefers-color-scheme: light)";

function stored(): GameTheme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function system(): GameTheme {
  return typeof window !== "undefined" && window.matchMedia?.(query).matches ? "light" : "dark";
}

export function useGameTheme() {
  const [theme, setTheme] = useState<GameTheme>(() => stored() ?? system());

  // Follow the device setting live until the player makes their own choice.
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const onChange = () => {
      if (!stored()) setTheme(mq.matches ? "light" : "dark");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: GameTheme = t === "light" ? "dark" : "light";
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* private mode etc.: the choice just won't persist */
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
