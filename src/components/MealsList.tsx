"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import MealForm from "./MealForm";

type Person = { id: string; name: string };
type Meal = { id: string; date: string; label: string | null };

export default function MealsList({ tripId, people }: { tripId: string; people: Person[] }) {
  const [meals, setMeals] = useState<(Meal & { inCount: number })[] | null>(null);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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

  if (meals === null) return <p>Loading meals...</p>;

  if (creating) {
    return (
      <MealForm
        tripId={tripId}
        people={people}
        existingMeal={null}
        onDone={() => {
          setCreating(false);
          loadMeals();
        }}
      />
    );
  }

  if (editingMealId !== null) {
    const meal = meals.find((m) => m.id === editingMealId) ?? null;
    return (
      <MealForm
        tripId={tripId}
        people={people}
        existingMeal={meal}
        onDone={() => {
          setEditingMealId(null);
          loadMeals();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Shopping / meals</h2>
        <button onClick={() => setCreating(true)} className="bg-black text-white rounded px-3 py-1 text-sm">
          + New
        </button>
      </div>

      {meals.length === 0 && (
        <p className="text-sm text-gray-500">No meals planned yet — add one to set who&apos;s in.</p>
      )}

      <div className="flex flex-col gap-2">
        {meals.map((meal) => (
          <button
            key={meal.id}
            onClick={() => setEditingMealId(meal.id)}
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
