"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Loadout } from "./MealLoadout";

type Item = { name: string; quantity: string; category: "fresh" | "pantry"; checked: boolean };

const CATEGORY_LABELS: { key: keyof Loadout; label: string }[] = [
  { key: "protein", label: "Protein" },
  { key: "sides", label: "Sides" },
  { key: "salad", label: "Salad" },
  { key: "sauce", label: "Sauce" },
  { key: "other", label: "Other" },
];

export default function ShoppingList({
  mealId,
  loadout,
  headcount,
}: {
  mealId: string;
  loadout: Loadout;
  headcount: number;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealId]);

  async function loadExisting() {
    const { data } = await supabase
      .from("shopping_lists")
      .select("generated_ingredients")
      .eq("meal_id", mealId)
      .maybeSingle();
    const ingredients = data?.generated_ingredients as { items?: Item[] } | null;
    if (ingredients?.items) setItems(ingredients.items);
  }

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shopping-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mealId, loadout, headcount }),
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
    await supabase.from("shopping_lists").update({ generated_ingredients: { items: next } }).eq("meal_id", mealId);
  }

  const freshItems = items?.filter((i) => i.category === "fresh") ?? [];
  const pantryItems = items?.filter((i) => i.category === "pantry") ?? [];
  const hasLoadout = CATEGORY_LABELS.some(({ key }) => (loadout[key] ?? []).length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="border rounded-lg p-5 flex flex-col gap-2">
        <h2 className="font-medium">Loadout</h2>
        {hasLoadout ? (
          <ul className="text-sm text-gray-600 flex flex-col gap-1">
            {CATEGORY_LABELS.map(({ key, label }) =>
              (loadout[key] ?? []).length > 0 ? (
                <li key={key}>
                  <span className="font-medium text-gray-700">{label}:</span> {loadout[key].join(", ")}
                </li>
              ) : null
            )}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No loadout set for this meal yet.</p>
        )}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          onClick={generate}
          disabled={loading || !hasLoadout}
          className="bg-black text-white rounded py-2 mt-2 disabled:opacity-50"
        >
          {loading ? "Generating..." : items ? "Regenerate list" : "Generate list"}
        </button>
      </div>

      {items && (
        <>
          <div className="border rounded-lg p-5">
            <h2 className="font-medium mb-2">To buy</h2>
            {freshItems.length === 0 && <p className="text-sm text-gray-500">Nothing here.</p>}
            <div className="flex flex-col gap-1">
              {freshItems.map((item) => {
                const index = items.indexOf(item);
                return (
                  <label key={index} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={item.checked} onChange={() => toggleItem(index)} />
                    <span className={item.checked ? "line-through text-gray-400" : ""}>
                      {item.name} <span className="text-gray-500">— {item.quantity}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="border rounded-lg p-5">
            <h2 className="font-medium mb-2">Check you have (pantry)</h2>
            {pantryItems.length === 0 && <p className="text-sm text-gray-500">Nothing here.</p>}
            <div className="flex flex-col gap-1">
              {pantryItems.map((item) => {
                const index = items.indexOf(item);
                return (
                  <label key={index} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={item.checked} onChange={() => toggleItem(index)} />
                    <span className={item.checked ? "line-through text-gray-400" : ""}>
                      {item.name} <span className="text-gray-500">— {item.quantity}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
