import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Check, Shuffle } from "lucide-react";
import { AVATAR_STYLES, seedsFor, useAvatar, useAvatarUri, type AvatarChoice, type AvatarStyleId } from "../lib/avatar";

function Tile({ choice, selected, onPick }: { choice: AvatarChoice; selected: boolean; onPick: () => void }) {
  const uri = useAvatarUri(choice);
  return (
    <button
      type="button"
      className={`avl-tile${selected ? " selected" : ""}`}
      onClick={onPick}
      aria-pressed={selected}
      aria-label={`Use this ${choice.style} avatar`}
    >
      {uri ? <img src={uri} alt="" width={128} height={128} /> : <span className="avl-skeleton" />}
      {selected ? (
        <span className="avl-check" aria-hidden="true">
          <Check size={13} strokeWidth={3} />
        </span>
      ) : null}
    </button>
  );
}

/**
 * Avatar library: pick a style, browse generated characters, shuffle for more.
 * `compact` shows fewer tiles (nav popover); the full version lives on the profile page.
 */
export default function AvatarLibrary({ user, compact = false }: { user: User | null; compact?: boolean }) {
  const { choice, choose } = useAvatar(user);
  const [style, setStyle] = useState<AvatarStyleId>(choice.style);
  const [page, setPage] = useState(0);
  const count = compact ? 8 : 18;
  const base = user?.id?.slice(0, 8) ?? "guest";
  const seeds = seedsFor(base, page, count);

  return (
    <div className={`avl${compact ? " compact" : ""}`}>
      <div className="avl-head">
        <div className="avl-styles" role="tablist" aria-label="Avatar style">
          {AVATAR_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={style === s.id}
              className={style === s.id ? "active" : ""}
              onClick={() => setStyle(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button type="button" className="avl-shuffle" onClick={() => setPage((p) => p + 1)}>
          <Shuffle size={14} />
          {compact ? null : "Shuffle"}
        </button>
      </div>

      <div className="avl-grid">
        {/* Keep the current avatar first so it is always visible to compare against */}
        {style === choice.style && !seeds.includes(choice.seed) ? (
          <Tile choice={choice} selected onPick={() => void choose(choice)} />
        ) : null}
        {seeds.map((seed) => {
          const c = { style, seed };
          const selected = choice.style === style && choice.seed === seed;
          return <Tile key={`${style}-${seed}`} choice={c} selected={selected} onPick={() => void choose(c)} />;
        })}
      </div>
    </div>
  );
}
