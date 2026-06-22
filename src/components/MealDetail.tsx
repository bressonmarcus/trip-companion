"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ShoppingList from "./ShoppingList";

type Person = { id: string; name: string };

export default function MealDetail({
  mealId,
  people,
  onBack,
}: {
  mealId: string;
  people: Person[];
  onBack: () => void;
}) {
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [statuses, setStatuses] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealId]);

  async function load() {
    const { data: meal } = await supabase.from("meals").select("label, date").eq("id", mealId).single();
    if (meal) {
      setLabel(meal.label ?? "");
      setDate(meal.date);
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

  async function toggle(personId: string) {
    const next = !statuses[personId];
    setStatuses((prev) => ({ ...prev, [personId]: next }));
    await supabase
      .from("attendance")
      .upsert({ meal_id: mealId, person_id: personId, status: next ? "in" : "out" }, { onConflict: "meal_id,person_id" });
  }

  const headcount = Object.values(statuses).filter(Boolean).length;

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

      <ShoppingList mealId={mealId} headcount={headcount || 1} />
    </div>
  );
}
