import React from "react";
import {
  RiCarLine,
  RiCrownLine,
  RiFootballLine,
  RiGridFill,
  RiMagicLine,
  RiMountainLine,
  RiSparklesLine,
  RiSwordsLine,
} from "./ReIcons";

export type FilterCategory =
  | "All"
  | "Action"
  | "Adventure"
  | "RPG"
  | "Racing"
  | "Strategy"
  | "Sports"
  | "Indie";

type CategoryItem = {
  id: FilterCategory;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const CATEGORIES: CategoryItem[] = [
  { id: "All", label: "All Games", icon: RiGridFill },
  { id: "Action", label: "Action", icon: RiSwordsLine },
  { id: "Adventure", label: "Adventure", icon: RiMountainLine },
  { id: "RPG", label: "RPG", icon: RiMagicLine },
  { id: "Racing", label: "Racing", icon: RiCarLine },
  { id: "Strategy", label: "Strategy", icon: RiCrownLine },
  { id: "Sports", label: "Sports", icon: RiFootballLine },
  { id: "Indie", label: "Indie", icon: RiSparklesLine },
];

export default function CategoryFilterBar({
  selected,
  onSelect,
}: {
  selected: FilterCategory;
  onSelect: (category: FilterCategory) => void;
}) {
  return (
    <div className="category-filter-bar" role="tablist" aria-label="Game categories">
      <div className="category-filter-track">
        {CATEGORIES.map(({ id, label, icon: Icon }) => {
          const active = selected === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`cat-pill ${active ? "active" : ""}`}
              onClick={() => onSelect(id)}
            >
              <Icon size={16} className="cat-pill-icon" />
              <span className="cat-pill-label">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
