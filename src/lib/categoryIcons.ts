import { Crown, Hash, Joystick, LayoutGrid, Puzzle, Type, Zap, type LucideIcon } from "lucide-react";
import type { GameCategory } from "../catalog";

export const categoryIcon: Record<GameCategory | "All", LucideIcon> = {
  All: LayoutGrid,
  Strategy: Crown,
  Puzzle: Puzzle,
  Action: Zap,
  Words: Type,
  Numbers: Hash,
  Classic: Joystick,
};
