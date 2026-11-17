import { useEffect, useState } from "react";
import { adminCall } from "../../lib/adminApi";
import { games } from "../../catalog";
import { loadGamePrices } from "../../lib/tokens";

type Config = {
  game_prices: { game_id: string; cost: number }[];
  plan_prices: { currency: string; plan: "monthly" | "yearly"; amount: number }[];
  payments_mode: "mock" | "live";
};

const errText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** Admin → Tokens: payments mode, per-game prices, subscription prices per currency, grants. */
export default function TokensTab() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [msg, setMsg] = useState("");
  const [costs, setCosts] = useState<Record<string, string>>({});
  const [newCur, setNewCur] = useState({ currency: "", monthly: "", yearly: "" });
  const [grant, setGrant] = useState({ email: "", amount: "", note: "" });
  const [lookup, setLookup] = useState<string>("");

  const load = () =>
    adminCall<Config>("tokens_config").then(
      (c) => {
        setCfg(c);
        setCosts(Object.fromEntries(games.map((g) => [g.id, String(c.game_prices.find((p) => p.game_id === g.id)?.cost ?? 0)])));
      },
      (e) => setMsg(errText(e, "Failed to load (did you run supabase/tokens.sql and redeploy the admin function?)")),
    );
  useEffect(() => {
    void load();
  }, []);

  async function run(action: string, payload: Record<string, unknown>, done: string) {
    setMsg("");
    try {
      await adminCall(action, payload);
      setMsg(done);
      await load();
      void loadGamePrices(true);
    } catch (e) {
      setMsg(errText(e, "Failed"));
    }
  }

  const currencies = [...new Set((cfg?.plan_prices ?? []).map((p) => p.currency))];
  const priceOf = (cur: string, plan: "monthly" | "yearly") => cfg?.plan_prices.find((p) => p.currency === cur && p.plan === plan)?.amount;

  return (
    <div className="adm-stack">
      {msg ? <p className="adm-note adm-msg">{msg}</p> : null}

      {/* ---------- Payments mode ---------- */}
      <div className="card adm-card adm-settings">
        <h3>Payments</h3>
        <p className="adm-note">
          No payment provider is connected yet. In <b>mock</b> mode the Tokens page shows a test checkout and
          anyone signed in can subscribe for free — for testing only. Switch to <b>live</b> before launch: test
          checkout is then refused, and subscriptions will come from the payment provider once it's connected.
        </p>
        <div className="adm-actions">
          <span className="adm-note">
            Current mode: <b>{cfg?.payments_mode ?? "…"}</b>
          </span>
          {cfg ? (
            <button
              type="button"
              className={cfg.payments_mode === "mock" ? "primary-btn" : "ghost-btn"}
              onClick={() =>
                void run(
                  "payments_mode_set",
                  { mode: cfg.payments_mode === "mock" ? "live" : "mock" },
                  `Payments mode set to ${cfg.payments_mode === "mock" ? "live" : "mock"}.`,
                )
              }
            >
              Switch to {cfg.payments_mode === "mock" ? "live" : "mock"}
            </button>
          ) : null}
        </div>
      </div>

      {/* ---------- Game prices ---------- */}
      <div className="card adm-card adm-settings">
        <h3>Game prices</h3>
        <p className="adm-note">Tokens per play. 0 = free game. Premium games ask players to pay before each new play.</p>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Game</th>
                <th>Tokens / play</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {games.map((g) => {
                const saved = String(cfg?.game_prices.find((p) => p.game_id === g.id)?.cost ?? 0);
                const val = costs[g.id] ?? saved;
                return (
                  <tr key={g.id}>
                    <td>
                      {g.title} <span className="adm-note">· {g.category}</span>
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={5}
                        value={val}
                        style={{ width: 110 }}
                        aria-label={`${g.title} tokens per play`}
                        onChange={(e) => setCosts((c) => ({ ...c, [g.id]: e.target.value }))}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ghost-btn"
                        disabled={val === saved}
                        onClick={() => void run("game_price_set", { game_id: g.id, cost: Number(val) }, `${g.title}: ${Number(val) || "free"}${Number(val) ? " tokens per play" : ""}.`)}
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- Subscription prices ---------- */}
      <div className="card adm-card adm-settings">
        <h3>Subscription prices</h3>
        <p className="adm-note">
          Both plans give 5,000 tokens every month. Visitors see the price for their country's currency; any
          currency not listed falls back to USD.
        </p>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Currency</th>
                <th>Monthly</th>
                <th>Yearly</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {currencies.map((cur) => (
                <PlanRow
                  key={cur}
                  currency={cur}
                  monthly={priceOf(cur, "monthly")}
                  yearly={priceOf(cur, "yearly")}
                  onSave={async (plan, amount) => run("plan_price_set", { currency: cur, plan, amount }, `${cur} ${plan} price saved.`)}
                  onDelete={cur === "USD" ? undefined : () => void run("plan_price_delete", { currency: cur }, `${cur} removed.`)}
                />
              ))}
              <tr>
                <td>
                  <input
                    value={newCur.currency}
                    maxLength={3}
                    placeholder="AED"
                    style={{ width: 80 }}
                    aria-label="New currency code"
                    onChange={(e) => setNewCur((n) => ({ ...n, currency: e.target.value.toUpperCase() }))}
                  />
                </td>
                <td>
                  <input type="number" min={0} step="0.01" value={newCur.monthly} placeholder="monthly" style={{ width: 110 }} aria-label="New monthly price" onChange={(e) => setNewCur((n) => ({ ...n, monthly: e.target.value }))} />
                </td>
                <td>
                  <input type="number" min={0} step="0.01" value={newCur.yearly} placeholder="yearly" style={{ width: 110 }} aria-label="New yearly price" onChange={(e) => setNewCur((n) => ({ ...n, yearly: e.target.value }))} />
                </td>
                <td>
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={newCur.currency.length !== 3 || !(Number(newCur.monthly) > 0) || !(Number(newCur.yearly) > 0)}
                    onClick={async () => {
                      await run("plan_price_set", { currency: newCur.currency, plan: "monthly", amount: Number(newCur.monthly) }, "");
                      await run("plan_price_set", { currency: newCur.currency, plan: "yearly", amount: Number(newCur.yearly) }, `${newCur.currency} added.`);
                      setNewCur({ currency: "", monthly: "", yearly: "" });
                    }}
                  >
                    Add
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- Grant / look up ---------- */}
      <div className="card adm-card adm-settings">
        <h3>Player tokens</h3>
        <p className="adm-note">Look up a player's balance, or add tokens (use a negative amount to deduct).</p>
        <div className="adm-field">
          <label>Player email</label>
          <input value={grant.email} onChange={(e) => setGrant((g) => ({ ...g, email: e.target.value }))} placeholder="player@example.com" />
        </div>
        <div className="adm-field">
          <label>Amount</label>
          <input type="number" value={grant.amount} onChange={(e) => setGrant((g) => ({ ...g, amount: e.target.value }))} placeholder="e.g. 500" />
        </div>
        <div className="adm-field">
          <label>Note (shown in the player's history)</label>
          <input value={grant.note} maxLength={200} onChange={(e) => setGrant((g) => ({ ...g, note: e.target.value }))} placeholder="e.g. Tournament prize" />
        </div>
        <div className="adm-actions">
          <button
            type="button"
            className="ghost-btn"
            disabled={!grant.email.includes("@")}
            onClick={async () => {
              setLookup("");
              try {
                const r = await adminCall<{ balance: number; subscription: { plan: string; status: string } | null }>("tokens_lookup", { email: grant.email.trim() });
                setLookup(`${r.balance.toLocaleString()} tokens${r.subscription ? ` · ${r.subscription.plan} plan (${r.subscription.status})` : " · no subscription"}`);
              } catch (e) {
                setLookup(errText(e, "Lookup failed"));
              }
            }}
          >
            Look up
          </button>
          <button
            type="button"
            className="primary-btn"
            disabled={!grant.email.includes("@") || !Number(grant.amount)}
            onClick={() =>
              void run(
                "tokens_grant",
                { email: grant.email.trim(), amount: Number(grant.amount), note: grant.note },
                `${Number(grant.amount) > 0 ? "Added" : "Deducted"} ${Math.abs(Number(grant.amount)).toLocaleString()} tokens for ${grant.email.trim()}.`,
              ).then(() => setGrant((g) => ({ ...g, amount: "", note: "" })))
            }
          >
            Apply
          </button>
          {lookup ? <span className="adm-note">{lookup}</span> : null}
        </div>
      </div>
    </div>
  );
}

function PlanRow({
  currency,
  monthly,
  yearly,
  onSave,
  onDelete,
}: {
  currency: string;
  monthly?: number;
  yearly?: number;
  onSave: (plan: "monthly" | "yearly", amount: number) => Promise<void>;
  onDelete?: () => void;
}) {
  const [m, setM] = useState(String(monthly ?? ""));
  const [y, setY] = useState(String(yearly ?? ""));
  useEffect(() => setM(String(monthly ?? "")), [monthly]);
  useEffect(() => setY(String(yearly ?? "")), [yearly]);
  const dirty = m !== String(monthly ?? "") || y !== String(yearly ?? "");
  return (
    <tr>
      <td>
        <b>{currency}</b>
      </td>
      <td>
        <input type="number" min={0} step="0.01" value={m} style={{ width: 110 }} aria-label={`${currency} monthly`} onChange={(e) => setM(e.target.value)} />
      </td>
      <td>
        <input type="number" min={0} step="0.01" value={y} style={{ width: 110 }} aria-label={`${currency} yearly`} onChange={(e) => setY(e.target.value)} />
      </td>
      <td>
        <button
          type="button"
          className="ghost-btn"
          disabled={!dirty || !(Number(m) > 0) || !(Number(y) > 0)}
          onClick={async () => {
            if (m !== String(monthly ?? "")) await onSave("monthly", Number(m));
            if (y !== String(yearly ?? "")) await onSave("yearly", Number(y));
          }}
        >
          Save
        </button>{" "}
        {onDelete ? (
          <button type="button" className="ghost-btn" onClick={onDelete}>
            Remove
          </button>
        ) : null}
      </td>
    </tr>
  );
}
