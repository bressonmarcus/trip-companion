"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Item = { name: string; quantity: string; category: "fresh" | "pantry"; checked: boolean };

export default function ShoppingList({ mealId, headcount }: { mealId: string; headcount: number }) {
  const [dishes, setDishes] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedExisting, setLoadedExisting] = useState(false);

  useEffect(() => {
    loadExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealId]);

  async function loadExisting() {
    const { data } = await supabase
      .from("shopping_lists")
      .select("dishes, generated_ingredients")
      .eq("meal_id", mealId)
      .maybeSingle();
    if (data) {
      const dishNames = Array.isArray(data.dishes) ? data.dishes.map((d: { name: string }) => d.name) : [];
      setDishes(dishNames.join(", "));
      const ingredients = data.generated_ingredients as { items?: Item[] } | null;
      if (ingredients?.items) setItems(ingredients.items);
    }
    setLoadedExisting(true);
  }

  async function generate() {
    const dishList = dishes
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    if (dishList.length === 0) {
      setError("Add at least one dish.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shopping-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealId, dishes: dishList, headcount }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to generate list.");
      setItems(json.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleItem(index: number) {
    if (!items) return;
    const next = items.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item));
    setItems(next);
    await supabase
      .from("shopping_lists")
      .update({ generated_ingredients: { items: next } })
      .eq("meal_id", mealId);
  }

  if (!loadedExisting) return <p>Loading shopping list...</p>;

  const freshItems = items?.filter((i) => i.category === "fresh") ?? [];
  const pantryItems = items?.filter((i) => i.category === "pantry") ?? [];

  return (
    <div className="flex flex-col gap-3 border rounded-lg p-5">
      <h2 className="font-medium">Shopping list</h2>
      <p className="text-sm text-gray-500">
        Dishes for this meal, comma-separated. Scaled for {headcount} {headcount === 1 ? "person" : "people"}.
      </p>
      <input
        className="border rounded px-3 py-2"
        placeholder="e.g. chimichurri skirt steak, grilled corn"
        value={dishes}
        onChange={(e) => setDishes(e.target.value)}
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button onClick={generate} disabled={loading} className="bg-black text-white rounded py-2 disabled:opacity-50">
        {loading ? "Generating..." : items ? "Regenerate list" : "Generate list"}
      </button>

      {items && (
        <div className="flex flex-col gap-4 mt-2">
          {freshItems.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">To buy</p>
              <div className="flex flex-col gap-1">
                {freshItems.map((item) => {
                  const idx = items.indexOf(item);
                  return (
                    <label key={idx} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={item.checked} onChange={() => toggleItem(idx)} />
                      <span className={item.checked ? "line-through text-gray-400" : ""}>
                        {item.name} — {item.quantity}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {pantryItems.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Check you have (pantry)</p>
              <div className="flex flex-col gap-1">
                {pantryItems.map((item) => {
                  const idx = items.indexOf(item);
                  return (
                    <label key={idx} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={item.checked} onChange={() => toggleItem(idx)} />
                      <span className={item.checked ? "line-through text-gray-400" : ""}>
                        {item.name} — {item.quantity}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
