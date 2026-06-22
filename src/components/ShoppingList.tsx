"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTripContext } from "@/lib/trip-context";
import type { Loadout } from "./MealLoadout";

type Item = {
  name: string;
  quantity: string;
  category: "fresh" | "pantry" | "personal";
  checked: boolean;
  sharedBy?: string[];
};

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
  const { personId, people } = useTripContext();
  const [items, setItems] = useState<Item[]>([]);
  const [rowExists, setRowExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personalName, setPersonalName] = useState("");
  const [personalQty, setPersonalQty] = useState("");
  const [personalSharers, setPersonalSharers] = useState<string[]>([personId]);

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
    if (data) {
      setRowExists(true);
      const ingredients = data.generated_ingredients as { items?: Item[] } | null;
      if (ingredients?.items) setItems(ingredients.items);
    }
  }

  async function persistItems(next: Item[]) {
    setItems(next);
    if (rowExists) {
      await supabase.from("shopping_lists").update({ generated_ingredients: { items: next } }).eq("meal_id", mealId);
    } else {
      await supabase
        .from("shopping_lists")
        .upsert({ meal_id: mealId, dishes: [], generated_ingredients: { items: next } }, { onConflict: "meal_id" });
      setRowExists(true);
    }
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
      setRowExists(true);
      setItems(json.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleItem(index: number) {
    const next = items.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item));
    await persistItems(next);
  }

  function addPersonalItem(e: React.FormEvent) {
    e.preventDefault();
    const name = personalName.trim();
    if (!name) return;
    const sharedBy = personalSharers.length > 0 ? personalSharers : [personId];
    const next: Item[] = [
      ...items,
      { name, quantity: personalQty.trim() || "1", category: "personal", checked: false, sharedBy },
    ];
    setPersonalName("");
    setPersonalQty("");
    setPersonalSharers([personId]);
    persistItems(next);
  }

  function toggleSharer(id: string) {
    setPersonalSharers((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  function removeItem(index: number) {
    const next = items.filter((_, i) => i !== index);
    persistItems(next);
  }

  const freshItems = items.filter((i) => i.category === "fresh");
  const pantryItems = items.filter((i) => i.category === "pantry");
  const personalItems = items.filter((i) => i.category === "personal");
  const hasGenerated = freshItems.length > 0 || pantryItems.length > 0;
  const hasLoadout = CATEGORY_LABELS.some(({ key }) => (loadout[key] ?? []).length > 0);

  function nameFor(personIdValue?: string) {
    return people.find((p) => p.id === personIdValue)?.name ?? "Someone";
  }

  function namesFor(ids?: string[]) {
    if (!ids || ids.length === 0) return "Someone";
    return ids.map((id) => nameFor(id)).join(" & ");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border rounded-lg p-5 flex flex-col gap-2">
        <h2 className="font-medium">Meal</h2>
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
          <p className="text-sm text-gray-500">Nothing added to this meal yet.</p>
        )}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          onClick={generate}
          disabled={loading || !hasLoadout}
          className="bg-black text-white rounded py-2 mt-2 disabled:opacity-50"
        >
          {loading ? "Generating..." : hasGenerated ? "Regenerate list" : "Generate list"}
        </button>
      </div>

      {hasGenerated && (
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

      <div className="border rounded-lg p-5">
        <h2 className="font-medium mb-1">Personal items</h2>
        <p className="text-sm text-gray-500 mb-3">
          Just for you — these won&apos;t be split between everyone when we get to expenses.
        </p>

        {personalItems.length === 0 && <p className="text-sm text-gray-500 mb-3">Nothing added yet.</p>}
        <div className="flex flex-col gap-1 mb-3">
          {personalItems.map((item) => {
            const index = items.indexOf(item);
            return (
              <div key={index} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={item.checked} onChange={() => toggleItem(index)} />
                <span className={`flex-1 ${item.checked ? "line-through text-gray-400" : ""}`}>
                  {item.name} <span className="text-gray-500">— {item.quantity}</span>{" "}
                  <span className="text-gray-400">({namesFor(item.sharedBy)})</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="text-gray-400 hover:text-gray-700"
                  aria-label={`Remove ${item.name}`}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        <form onSubmit={addPersonalItem} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              className="border rounded px-3 py-2 flex-1 text-sm"
              placeholder="e.g. Monster energy drinks"
              value={personalName}
              onChange={(e) => setPersonalName(e.target.value)}
            />
            <input
              className="border rounded px-3 py-2 w-20 text-sm"
              placeholder="qty"
              value={personalQty}
              onChange={(e) => setPersonalQty(e.target.value)}
            />
            <button className="bg-gray-200 rounded px-3 text-sm">Add</button>
          </div>
          <div className="flex flex-wrap gap-1">
            <span className="text-xs text-gray-400 mr-1 self-center">Splitting between:</span>
            {people.map((p) => {
              const active = personalSharers.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleSharer(p.id)}
                  className={`text-xs rounded-full px-2 py-1 border ${
                    active ? "bg-black text-white border-black" : "text-gray-500 border-gray-300"
                  }`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </form>
      </div>
    </div>
  );
}
