import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Petrol Pump Daily Reading" },
      { name: "description", content: "Simple daily petrol pump reading and collection calculator." },
      { property: "og:title", content: "Petrol Pump Daily Reading" },
      { property: "og:description", content: "Simple daily petrol pump reading and collection calculator." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Fuel = "petrol" | "diesel";
const KEYS: Record<Fuel, string> = { petrol: "petrol-pump-petrol-v2", diesel: "petrol-pump-diesel-v2" };
const FIELDS = [
  ["prev", "Previous Reading"],
  ["today", "Today Reading"],
  ["price", "Today Oil/Petrol Price (Rs.)"],
  ["collection", "Today Amount Collection (Rs.)"],
  ["udhaar", "Previous Udhaar Collection (Rs.)"],
  ["given", "Today Udhaar Given (Rs.)"],
  ["otherCollection", "Other Collection (Rs.)"],
  ["expense", "Today Expense (Rs.)"],
] as const;
type Key = (typeof FIELDS)[number][0];
type Rec = { id: string; date: string } & Record<Key, number>;
type LegacyRec = Pick<Rec, "id" | "date"> & Partial<Record<Key, number>>;

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export function calc(v: Record<Key, number>) {
  const diff = r2(v.today - v.prev);
  const readingAmount = r2(diff * v.price);
  const total = r2(v.collection + v.udhaar + v.otherCollection);
  return { diff, readingAmount, total, net: r2(total - v.expense - v.given) };
}
const rs = (n: number) => "Rs. " + n.toLocaleString("en-PK", { maximumFractionDigits: 2 });
const todayStr = () => new Date().toLocaleDateString("en-CA");
const empty = () => Object.fromEntries(FIELDS.map(([k]) => [k, ""])) as Record<Key, string>;
const latest = (list: Rec[]) => [...list].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))[0];
function load(f: Fuel): Rec[] {
  try {
    const raw = localStorage.getItem(KEYS[f]);
    if (raw) {
      const records = JSON.parse(raw) as Rec[];
      return records.map((r) => ({ ...r, given: r.given ?? 0, otherCollection: r.otherCollection ?? 0 }));
    }
    if (f === "petrol") {
      const old = JSON.parse(localStorage.getItem("petrol-pump-records-v1") || "[]") as LegacyRec[];
      return old.map((r) => ({ id: r.id, date: r.date, prev: r.prev || 0, today: r.today || 0, price: r.price || 0,
        collection: r.collection || 0, udhaar: r.udhaar || 0, given: 0, otherCollection: 0, expense: r.expense || 0 }));
    }
  } catch { /* ignore */ }
  return [];
}

function Index() {
  const [loaded, setLoaded] = useState(false);
  const [date, setDate] = useState("");
  const [form, setForm] = useState(empty());
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [fuel, setFuel] = useState<Fuel>("petrol");
  const [tab, setTab] = useState<Fuel>("petrol");
  const [store, setStore] = useState<Record<Fuel, Rec[]>>({ petrol: [], diesel: [] });
  const records = store[fuel];

  useEffect(() => {
    const s = { petrol: load("petrol"), diesel: load("diesel") };
    setStore(s);
    setDate(todayStr());
    const last = latest(s.petrol);
    if (last) setForm((f) => ({ ...f, prev: String(last.today) }));
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(KEYS.petrol, JSON.stringify(store.petrol));
    localStorage.setItem(KEYS.diesel, JSON.stringify(store.diesel));
  }, [store, loaded]);

  function switchFuel(f: Fuel) {
    if (editId) return;
    setFuel(f);
    setTab(f);
    const last = latest(store[f]);
    setForm((x) => ({ ...x, prev: last ? String(last.today) : "" }));
    setMsg(null);
  }

  const nums = useMemo(
    () => Object.fromEntries(FIELDS.map(([k]) => [k, parseFloat(form[k]) || 0])) as Record<Key, number>,
    [form],
  );
  const c = calc(nums);
  const sorted = [...store[tab]].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const fuelName = (f: Fuel) => (f === "petrol" ? "Petrol" : "Diesel");

  function save() {
    if (!date) return setMsg({ ok: false, text: "Please select a date." });
    if (form.prev === "" || form.today === "") return setMsg({ ok: false, text: "Enter previous and today reading." });
    if (Object.values(nums).some((n) => n < 0 || !isFinite(n))) return setMsg({ ok: false, text: "Values cannot be negative." });
    if (nums.today < nums.prev) return setMsg({ ok: false, text: "Today reading cannot be less than previous reading." });
    if (!editId && records.some((r) => r.date === date) &&
      !confirm(`A ${fuelName(fuel)} record for this date already exists. Save another separate record?`)) return;
    const f = fuel;
    let next: Rec[];
    if (editId) {
      next = store[f].map((r) => (r.id === editId ? { ...r, date, ...nums } : r));
      setMsg({ ok: true, text: `${fuelName(f)} record updated successfully.` });
    } else {
      next = [...store[f], { id: Date.now().toString(), date, ...nums }];
      setMsg({ ok: true, text: `${fuelName(f)} record saved successfully.` });
    }
    setStore((s) => ({ ...s, [f]: next }));
    setEditId(null);
    setTab(f);
    setForm({ ...empty(), prev: String(latest(next)!.today) });
    setDate(todayStr());
  }

  function edit(r: Rec, f: Fuel) {
    if (!confirm(`Edit the ${fuelName(f)} record of ${r.date}?`)) return;
    setFuel(f);
    setEditId(r.id);
    setDate(r.date);
    setForm(Object.fromEntries(FIELDS.map(([k]) => [k, String(r[k] ?? 0)])) as Record<Key, string>);
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const input = "w-full rounded-lg border-2 border-input bg-card px-4 py-3 text-lg focus:border-primary focus:outline-none";

  return (
    <div className="min-h-screen">
      <header className="bg-accent text-accent-foreground">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5">
          <span className="text-3xl">⛽</span>
          <h1 className="text-xl font-bold sm:text-2xl">Petrol Pump Daily Reading</h1>
        </div>
        <div className="h-1.5 bg-primary" />
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6">
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-bold">{editId ? `Editing ${fuelName(fuel)} Record` : "Today's Entry"}</h2>
          <div className="mb-5">
            <span className="mb-1 block font-medium">Fuel Type</span>
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              {(["petrol", "diesel"] as Fuel[]).map((f) => (
                <button key={f} onClick={() => switchFuel(f)} disabled={!!editId && fuel !== f}
                  className={`rounded-lg px-4 py-3 text-lg font-bold disabled:opacity-40 ${fuel === f ? "bg-primary text-primary-foreground" : "border-2"}`}>
                  {fuelName(f)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="mb-1 block font-medium">Date</span>
              <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            {FIELDS.map(([k, label]) => (
              <label key={k} className="block">
                <span className="mb-1 block font-medium">{label}</span>
                <input
                  type="number" inputMode="decimal" min={0} step="any" className={input}
                  value={form[k]} placeholder="0"
                  onChange={(e) => { if (!e.target.value.startsWith("-")) setForm({ ...form, [k]: e.target.value }); }}
                />
              </label>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Reading Difference", c.diff.toLocaleString("en-PK", { maximumFractionDigits: 2 })],
              ["Reading Amount", rs(c.readingAmount)],
              ["Total Collection", rs(c.total)],
              ["Net Amount", rs(c.net)],
            ].map(([l, v], i) => (
              <div key={l} className={`rounded-lg p-4 ${i === 3 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <div className="text-sm opacity-80">{l}</div>
                <div className="break-words text-xl font-bold sm:text-2xl">{v}</div>
              </div>
            ))}
          </div>
          {c.diff < 0 && <p className="mt-3 text-destructive">Today reading is less than previous reading.</p>}

          {msg && (
            <p className={`mt-4 rounded-lg p-3 font-medium ${msg.ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
              {msg.text}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={save} className="flex-1 rounded-lg bg-primary px-6 py-4 text-lg font-bold text-primary-foreground hover:opacity-90 sm:flex-none">
              {editId ? "Update Record" : "Save Record"}
            </button>
            {editId && (
              <button onClick={() => { setEditId(null); setForm(empty()); setDate(todayStr()); }}
                className="rounded-lg border-2 px-6 py-4 text-lg font-medium">Cancel Edit</button>
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap gap-2">
            {(["petrol", "diesel"] as Fuel[]).map((f) => (
              <button key={f} onClick={() => setTab(f)}
                className={`rounded-lg px-5 py-3 font-bold ${tab === f ? "bg-primary text-primary-foreground" : "border-2"}`}>
                {fuelName(f)} History ({store[f].length})
              </button>
            ))}
          </div>
          {sorted.length === 0 ? (
            <p className="text-muted-foreground">No {fuelName(tab)} records saved yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-sm">
                <thead className="bg-accent text-accent-foreground">
                  <tr>
                    {["Date", "Prev", "Today", "Diff", "Price", "Reading Amt", "Collection", "Prev Udhaar Coll.", "Udhaar Given", "Other Collection", "Expense", "Total Coll.", "Net", ""].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => {
                    const x = calc({ ...r, given: r.given ?? 0 });
                    return (
                      <tr key={r.id} className={`border-b ${r.id === editId ? "bg-primary/10" : ""}`}>
                        <td className="px-3 py-2 font-medium">{r.date}</td>
                        <td className="px-3 py-2">{r.prev}</td>
                        <td className="px-3 py-2">{r.today}</td>
                        <td className="px-3 py-2">{x.diff}</td>
                        <td className="px-3 py-2">{rs(r.price)}</td>
                        <td className="px-3 py-2">{rs(x.readingAmount)}</td>
                        <td className="px-3 py-2">{rs(r.collection)}</td>
                        <td className="px-3 py-2">{rs(r.udhaar)}</td>
                        <td className="px-3 py-2">{rs(r.given ?? 0)}</td>
                        <td className="px-3 py-2">{rs(r.otherCollection ?? 0)}</td>
                        <td className="px-3 py-2">{rs(r.expense)}</td>
                        <td className="px-3 py-2 font-semibold">{rs(x.total)}</td>
                        <td className="px-3 py-2 font-bold text-primary">{rs(x.net)}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => edit(r, tab)} className="rounded border-2 px-3 py-1 font-medium hover:border-primary">Edit</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
