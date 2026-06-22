"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import MealLoadout from "./MealLoadout";

type Person = { id: string; name: string };
type Meal = { id: string; date: string; label: string | null };

export default function MealsList({ tripId, people }: { tripId: string; people: Person[] }) {
  const [meals, setMeals] = useState<(Meal & { inCount: number })[] | null>(null);
  const [openMealId, setOpenMealId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    loadMeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  async function loadMeals() {
    const { data: mealRows } = await supabase
      .from("meals")
      .select("id, date, label")
      .eq("trip_id", tripId)
      .order("date", { ascending: false });

    const mealIds = (mealRows ?? []).map((m) => m.id);
    const { data: attendanceRows } = mealIds.length
      ? await supabase.from("attendance").select("meal_id, status").in("meal_id", mealIds)
      : { data: [] };

    const inCounts = new Map<string, number>();
    for (const row of attendanceRows ?? []) {
      if (row.status === "in") inCounts.set(row.meal_id, (inCounts.get(row.meal_id) ?? 0) + 1);
    }

    setMeals((mealRows ?? []).map((m) => ({ ...m, inCount: inCounts.get(m.id) ?? people.length })));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    const { data, error } = await supabase
      .from("meals")
      .insert({ trip_id: tripId, date: newDate, type: "dinner", label: newLabel || null })
      .select()
      .single();
    if (error || !data) {
      setCreateError(error?.message ?? "Could not create meal.");
      return;
    }
    await supabase
      .from("attendance")
      .upsert(people.map((p) => ({ meal_id: data.id, person_id: p.id, status: "in" })), {
        onConflict: "meal_id,person_id",
      });
    setCreating(false);
    setNewLabel("");
    await loadMeals();
    setOpenMealId(data.id);
  }

  if (meals === null) return <p>Loading meals...</p>;

  if (openMealId !== null) {
    return (
      <MealLoadout
        mealId={openMealId}
        people={people}
        onBack={() => {
          setOpenMealId(null);
          loadMeals();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Meals</h2>
        {!creating && (
          <button onClick={() => setCreating(true)} className="bg-black text-white rounded px-3 py-1 text-sm">
            + New
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="flex flex-col gap-3 border rounded-lg p-5">
          <input
            className="border rounded px-3 py-2"
            placeholder="Label (e.g. Day 3 dinner)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
          {createError && <p className="text-red-600 text-sm">{createError}</p>}
          <div className="flex gap-2">
            <button className="bg-black text-white rounded py-2 px-4">Create</button>
            <button type="button" onClick={() => setCreating(false)} className="bg-gray-200 rounded py-2 px-4">
              Cancel
            </button>
          </div>
        </form>
      )}

      {meals.length === 0 && !creating && (
        <p className="text-sm text-gray-500">No meals planned yet — add one to set who&apos;s in.</p>
      )}

      <div className="flex flex-col gap-2">
        {meals.map((meal) => (
          <button
            key={meal.id}
            onClick={() => setOpenMealId(meal.id)}
            className="flex items-center justify-between border rounded-lg px-4 py-3 text-left hover:bg-gray-50"
          >
            <div>
              <p className="font-medium">{meal.label || "Dinner"}</p>
              <p className="text-xs text-gray-500">
                {new Date(meal.date).toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </p>
            </div>
            <span className="text-sm text-gray-500">
              {meal.inCount}/{people.length} in
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
