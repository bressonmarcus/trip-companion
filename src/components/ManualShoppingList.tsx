"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTripContext } from "@/lib/trip-context";

type Item = {
  name: string;
  quantity: string;
  category: "shared" | "personal";
  checked: boolean;
  sharedBy?: string[];
};

export default function ManualShoppingList({ listId }: { listId: string }) {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const { personId, people } = useTripContext();
  const [label, setLabel] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sharedName, setSharedName] = useState("");
  const [sharedQty, setSharedQty] = useState("");
  const [personalName, setPersonalName] = useState("");
  const [personalQty, setPersonalQty] = useState("");
  const [personalSharers, setPersonalSharers] = useState<string[]>([personId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  async function load() {
    const { data } = await supabase
      .from("shopping_lists")
      .select("label, generated_ingredients")
      .eq("id", listId)
      .maybeSingle();
    if (data) {
      setLabel(data.label ?? "Manual list");
      const ingredients = data.generated_ingredients as { items?: Item[] } | null;
      setItems(ingredients?.items ?? []);
    }
    setLoaded(true);
  }

  async function persistItems(next: Item[]) {
    setItems(next);
    await supabase.from("shopping_lists").update({ generated_ingredients: { items: next } }).eq("id", listId);
  }

  function toggleItem(index: number) {
    persistItems(items.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item)));
  }

  function removeItem(index: number) {
    persistItems(items.filter((_, i) => i !== index));
  }

  function addSharedItem(e: React.FormEvent) {
    e.preventDefault();
    const name = sharedName.trim();
    if (!name) return;
    persistItems([...items, { name, quantity: sharedQty.trim() || "1", category: "shared", checked: false }]);
    setSharedName("");
    setSharedQty("");
  }

  function addPersonalItem(e: React.FormEvent) {
    e.preventDefault();
    const name = personalName.trim();
    if (!name) return;
    const sharedBy = personalSharers.length > 0 ? personalSharers : [personId];
    persistItems([
      ...items,
      { name, quantity: personalQty.trim() || "1", category: "personal", checked: false, sharedBy },
    ]);
    setPersonalName("");
    setPersonalQty("");
    setPersonalSharers([personId]);
  }

  function toggleSharer(id: string) {
    setPersonalSharers((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  function namesFor(ids?: string[]) {
    if (!ids || ids.length === 0) return "Someone";
    return ids.map((id) => people.find((p) => p.id === id)?.name ?? "Someone").join(" & ");
  }

  if (!loaded) return <p>Loading...</p>;

  const sharedItems = items.filter((i) => i.category === "shared");
  const personalItems = items.filter((i) => i.category === "personal");

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => router.push(`/trip/${params.code}/shopping`)}
        className="text-sm underline text-gray-500 self-start"
      >
        ← Back to shopping lists
      </button>

      <h1 className="text-lg font-medium">{label}</h1>

      <div className="border rounded-lg p-5">
        <h2 className="font-medium mb-1">Items to buy</h2>
        <p className="text-sm text-gray-500 mb-3">Shared between everyone.</p>
        {sharedItems.length === 0 && <p className="text-sm text-gray-500 mb-3">Nothing added yet.</p>}
        <div className="flex flex-col gap-1 mb-3">
          {sharedItems.map((item) => {
            const index = items.indexOf(item);
            return (
              <div key={index} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={item.checked} onChange={() => toggleItem(index)} />
                <span className={`flex-1 ${item.checked ? "line-through text-gray-400" : ""}`}>
                  {item.name} <span className="text-gray-500">— {item.quantity}</span>
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
        <form onSubmit={addSharedItem} className="flex gap-2">
          <input
            className="border rounded px-3 py-2 flex-1 text-sm"
            placeholder="e.g. Bin bags"
            value={sharedName}
            onChange={(e) => setSharedName(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2 w-20 text-sm"
            placeholder="qty"
            value={sharedQty}
            onChange={(e) => setSharedQty(e.target.value)}
          />
          <button className="bg-gray-200 rounded px-3 text-sm">Add</button>
        </form>
      </div>

      <div className="border rounded-lg p-5">
        <h2 className="font-medium mb-1">Personal items</h2>
        <p className="text-sm text-gray-500 mb-3">
          Just for the people picked — these won&apos;t be split between everyone when we get to expenses.
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
