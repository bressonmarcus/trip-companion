"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Person = { id: string; name: string };
type Meal = { id: string; date: string; label: string | null };

export default function MealForm({
  tripId,
  people,
  existingMeal,
  onDone,
}: {
  tripId: string;
  people: Person[];
  existingMeal: Meal | null;
  onDone: () => void;
}) {
  const [label, setLabel] = useState(existingMeal?.label ?? "");
  const [date, setDate] = useState(existingMeal?.date ?? new Date().toISOString().slice(0, 10));
  const [statuses, setStatuses] = useState<Record<string, boolean>>(
    Object.fromEntries(people.map((p) => [p.id, true]))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existingMeal) loadExistingAttendance(existingMeal.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingMeal?.id]);

  async function loadExistingAttendance(mealId: string) {
    const { data } = await supabase.from("attendance").select("person_id, status").eq("meal_id", mealId);
    const next: Record<string, boolean> = Object.fromEntries(people.map((p) => [p.id, true]));
    for (const row of data ?? []) {
      next[row.person_id] = row.status === "in";
    }
    setStatuses(next);
  }

  function toggle(personId: string) {
    setStatuses((prev) => ({ ...prev, [personId]: !prev[personId] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let mealId = existingMeal?.id;
    if (!mealId) {
      const { data, error: insertError } = await supabase
        .from("meals")
        .insert({ trip_id: tripId, date, type: "dinner", label: label || null })
        .select()
        .single();
      if (insertError || !data) {
        setError(insertError?.message ?? "Could not create meal.");
        setLoading(false);
        return;
      }
      mealId = data.id;
    } else {
      await supabase.from("meals").update({ date, label: label || null }).eq("id", mealId);
    }

    const { error: attendanceError } = await supabase.from("attendance").upsert(
      people.map((p) => ({ meal_id: mealId, person_id: p.id, status: statuses[p.id] ? "in" : "out" })),
      { onConflict: "meal_id,person_id" }
    );
    setLoading(false);
    if (attendanceError) {
      setError(attendanceError.message);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border rounded-lg p-5">
      <h2 className="font-medium">{existingMeal ? "Edit attendance" : "New shopping / meal"}</h2>
      <input
        className="border rounded px-3 py-2"
        placeholder="Label (e.g. Day 3 dinner)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <input type="date" className="border rounded px-3 py-2" value={date} onChange={(e) => setDate(e.target.value)} />

      <p className="text-sm text-gray-600 mt-1">Who&apos;s in for this one?</p>
      <div className="flex flex-col gap-2">
        {people.map((p) => (
          <label key={p.id} className="flex items-center gap-2">
            <input type="checkbox" checked={statuses[p.id] ?? true} onChange={() => toggle(p.id)} />
            {p.name}
          </label>
        ))}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <div className="flex gap-2 mt-2">
        <button disabled={loading} className="bg-black text-white rounded py-2 px-4 disabled:opacity-50">
          {loading ? "Saving..." : "Save"}
        </button>
        <button type="button" onClick={onDone} className="bg-gray-200 rounded py-2 px-4">
          Cancel
        </button>
      </div>
    </form>
  );
}
