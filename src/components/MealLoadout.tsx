"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Person = { id: string; name: string };
export type Loadout = {
  protein: string[];
  sides: string[];
  salad: string[];
  sauce: string[];
  other: string[];
};

const EMPTY_LOADOUT: Loadout = { protein: [], sides: [], salad: [], sauce: [], other: [] };

const CATEGORIES: { key: keyof Loadout; label: string; placeholder: string }[] = [
  { key: "protein", label: "Protein", placeholder: "Ribeye steak\nSoy-ginger marinade" },
  { key: "sides", label: "Sides", placeholder: "Roasted potatoes\nGrilled corn" },
  { key: "salad", label: "Salad", placeholder: "Greek salad" },
  { key: "sauce", label: "Sauce", placeholder: "Garlic aioli" },
  { key: "other", label: "Other", placeholder: "Crusty bread" },
];

function loadoutToText(items: string[]) {
  return items.join("\n");
}
function textToLoadout(text: string) {
  return text.split("\n").map((s) => s.trim()).filter(Boolean);
}

export default function MealLoadout({
  mealId,
  people,
  onBack,
}: {
  mealId: string;
  people: Person[];
  onBack: () => void;
}) {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [statuses, setStatuses] = useState<Record<string, boolean>>({});
  const [loadout, setLoadout] = useState<Loadout>(EMPTY_LOADOUT);
  const [loaded, setLoaded] = useState(false);
  const [proceeding, setProceeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealId]);

  async function load() {
    const { data: meal } = await supabase.from("meals").select("label, date, loadout").eq("id", mealId).single();
    if (meal) {
      setLabel(meal.label ?? "");
      setDate(meal.date);
      setLoadout({ ...EMPTY_LOADOUT, ...(meal.loadout ?? {}) });
    }
    const { data: attendanceRows } = await supabase
      .from("attendance")
      .select("person_id, status")
      .eq("meal_id", mealId);
    const next: Record<string, boolean> = Object.fromEntries(people.map((p) => [p.id, true]));
    for (const row of attendanceRows ?? []) next[row.person_id] = row.status === "in";
    setStatuses(next);
    setLoaded(true);
  }

  async function saveMealDetails() {
    await supabase.from("meals").update({ label: label || null, date }).eq("id", mealId);
  }

  async function saveLoadout(next: Loadout) {
    setLoadout(next);
    await supabase.from("meals").update({ loadout: next }).eq("id", mealId);
  }

  async function toggle(personId: string) {
    const next = !statuses[personId];
    setStatuses((prev) => ({ ...prev, [personId]: next }));
    await supabase
      .from("attendance")
      .upsert({ meal_id: mealId, person_id: personId, status: next ? "in" : "out" }, { onConflict: "meal_id,person_id" });
  }

  const headcount = Object.values(statuses).filter(Boolean).length;
  const hasAnyItems = Object.values(loadout).some((items) => items.length > 0);

  async function handleProceed() {
    if (!hasAnyItems) {
      setError("Add at least one item to the loadout first.");
      return;
    }
    setError(null);
    setProceeding(true);
    try {
      const res = await fetch("/api/shopping-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealId, loadout, headcount: headcount || 1 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to generate the shopping list.");
      router.push(`/trip/${params.code}/shopping?meal=${mealId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setProceeding(false);
    }
  }

  if (!loaded) return <p>Loading...</p>;

  return (
    <div className="flex flex-col gap-6">
      <button onClick={onBack} className="text-sm underline text-gray-500 self-start">
        ← Back to list
      </button>

      <div className="flex flex-col gap-3 border rounded-lg p-5">
        <h2 className="font-medium">Details</h2>
        <input
          className="border rounded px-3 py-2"
          placeholder="Label (e.g. Day 3 dinner)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={saveMealDetails}
        />
        <input
          type="date"
          className="border rounded px-3 py-2"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onBlur={saveMealDetails}
        />

        <p className="text-sm text-gray-600 mt-1">
          Who&apos;s in for this one? ({headcount}/{people.length})
        </p>
        <div className="flex flex-col gap-2">
          {people.map((p) => (
            <label key={p.id} className="flex items-center gap-2">
              <input type="checkbox" checked={statuses[p.id] ?? true} onChange={() => toggle(p.id)} />
              {p.name}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 border rounded-lg p-5">
        <h2 className="font-medium">Loadout</h2>
        <p className="text-sm text-gray-500">
          Add what you&apos;re making, one item per line. A protein box can have more than just the protein itself —
          add the marinade as its own line too.
        </p>
        {CATEGORIES.map(({ key, label: catLabel, placeholder }) => (
          <div key={key} className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{catLabel}</label>
            <textarea
              className="border rounded px-3 py-2 h-20"
              placeholder={placeholder}
              defaultValue={loadoutToText(loadout[key])}
              onBlur={(e) => saveLoadout({ ...loadout, [key]: textToLoadout(e.target.value) })}
            />
          </div>
        ))}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        onClick={handleProceed}
        disabled={proceeding}
        className="bg-black text-white rounded py-3 disabled:opacity-50"
      >
        {proceeding ? "Building shopping list..." : "Proceed to shopping list →"}
      </button>
    </div>
  );
}
