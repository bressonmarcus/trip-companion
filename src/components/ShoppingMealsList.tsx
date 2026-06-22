"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type MealRow = { id: string; date: string; label: string | null; hasList: boolean };

export default function ShoppingMealsList({ tripId }: { tripId: string }) {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const [meals, setMeals] = useState<MealRow[] | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  async function load() {
    const { data: mealRows } = await supabase
      .from("meals")
      .select("id, date, label")
      .eq("trip_id", tripId)
      .order("date", { ascending: false });

    const mealIds = (mealRows ?? []).map((m) => m.id);
    const { data: listRows } = mealIds.length
      ? await supabase.from("shopping_lists").select("meal_id, generated_ingredients").in("meal_id", mealIds)
      : { data: [] };

    const readyIds = new Set(
      (listRows ?? [])
        .filter((r) => {
          const ingredients = r.generated_ingredients as { items?: unknown[] } | null;
          return ingredients?.items && ingredients.items.length > 0;
        })
        .map((r) => r.meal_id)
    );

    setMeals((mealRows ?? []).map((m) => ({ ...m, hasList: readyIds.has(m.id) })));
  }

  if (meals === null) return <p>Loading...</p>;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-medium">Shopping lists</h2>
      {meals.length === 0 && (
        <p className="text-sm text-gray-500">No meals planned yet — add one under the Meals tab first.</p>
      )}
      <div className="flex flex-col gap-2">
        {meals.map((meal) => (
          <button
            key={meal.id}
            onClick={() => router.push(`/trip/${params.code}/shopping?meal=${meal.id}`)}
            className="flex items-center justify-between border rounded-lg px-4 py-3 text-left hover:bg-gray-50"
          >
            <div>
              <p className="font-medium">{meal.label || "Dinner"}</p>
              <p className="text-xs text-gray-500">
                {new Date(meal.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
              </p>
            </div>
            <span className={`text-xs px-2 py-1 rounded ${meal.hasList ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {meal.hasList ? "Ready" : "Not started"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
