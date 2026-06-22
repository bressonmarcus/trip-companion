"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ScanResult } from "@/components/ReceiptCapture";

type Person = { id: string; name: string };
type Item = { name: string; price: string; sharedBy: string[] };

export default function ExpenseReviewForm({
  tripId,
  people,
  personId,
  initial,
  onSaved,
  onCancel,
}: {
  tripId: string;
  people: Person[];
  personId: string;
  initial: ScanResult | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const allIds = people.map((p) => p.id);
  const [merchant, setMerchant] = useState(initial?.merchant ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [total, setTotal] = useState(
    initial?.total != null ? String(initial.total) : ""
  );
  const [items, setItems] = useState<Item[]>(
    initial?.items.map((it) => ({ name: it.name, price: String(it.price), sharedBy: [...allIds] })) ?? []
  );
  const [payerId, setPayerId] = useState(personId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemsSum = Math.round(items.reduce((sum, it) => sum + (Number(it.price) || 0), 0) * 100) / 100;
  const totalNum = total.trim() ? Number(total) : itemsSum;
  const mismatch = total.trim() !== "" && Math.abs(itemsSum - totalNum) > 0.05 && items.length > 0;

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }
  function addItem() {
    setItems((prev) => [...prev, { name: "", price: "", sharedBy: [...allIds] }]);
  }
  function toggleShared(index: number, personIdToToggle: string) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const has = it.sharedBy.includes(personIdToToggle);
        return { ...it, sharedBy: has ? it.sharedBy.filter((id) => id !== personIdToToggle) : [...it.sharedBy, personIdToToggle] };
      })
    );
  }

  async function handleSave() {
    setError(null);
    const cleanItems = items.filter((it) => it.name.trim() && it.price.trim());
    const finalTotal = total.trim() ? Number(total) : Math.round(cleanItems.reduce((s, it) => s + Number(it.price), 0) * 100) / 100;
    if (!finalTotal || finalTotal <= 0) {
      setError("Enter a total amount, or add at least one item.");
      return;
    }
    if (cleanItems.some((it) => it.sharedBy.length === 0)) {
      setError("Every item needs at least one person assigned to it.");
      return;
    }
    setSaving(true);
    const { data: expense, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        trip_id: tripId,
        payer_id: payerId,
        description: merchant.trim() || (initial ? "Scanned receipt" : "Manual expense"),
        merchant: merchant.trim() || null,
        expense_date: date.trim() || null,
        total_amount: finalTotal,
        source: initial ? "scan" : "manual",
      })
      .select()
      .single();
    if (expenseError || !expense) {
      setError(expenseError?.message ?? "Could not save this expense.");
      setSaving(false);
      return;
    }
    if (cleanItems.length > 0) {
      const { error: itemsError } = await supabase.from("expense_items").insert(
        cleanItems.map((it) => ({
          expense_id: expense.id,
          name: it.name.trim(),
          price: Number(it.price),
          shared_by: it.sharedBy,
        }))
      );
      if (itemsError) {
        setError(itemsError.message);
        setSaving(false);
        return;
      }
    } else {
      // No itemization — treat as one item shared by everyone.
      await supabase.from("expense_items").insert({
        expense_id: expense.id,
        name: merchant.trim() || "Expense",
        price: finalTotal,
        shared_by: allIds,
      });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="flex flex-col gap-4 border rounded-lg p-5">
      <h2 className="font-medium">{initial ? "Review scanned receipt" : "Add expense manually"}</h2>

      {mismatch && (
        <div className="bg-amber-50 border border-amber-300 rounded p-3 text-sm text-amber-800">
          Items add up to {itemsSum.toFixed(2)} kr but the receipt total is {totalNum.toFixed(2)} kr.
          That usually means a digit got misread (e.g. a 1 seen as a 7) — double-check the prices below.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Merchant
          <input className="border rounded px-2 py-1" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="e.g. REMA 1000" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Date
          <input type="date" className="border rounded px-2 py-1" value={date ?? ""} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Total (DKK)
        <input
          type="number"
          step="0.01"
          className="border rounded px-2 py-1"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          placeholder={itemsSum > 0 ? itemsSum.toFixed(2) : "0.00"}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Paid by
        <select className="border rounded px-2 py-1" value={payerId} onChange={(e) => setPayerId(e.target.value)}>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Items</h3>
          <button onClick={addItem} className="text-sm underline text-gray-600">+ Add item</button>
        </div>
        {items.length === 0 && <p className="text-xs text-gray-400">No items — this will be split evenly between everyone.</p>}
        {items.map((item, i) => (
          <div key={i} className="border rounded p-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                className="border rounded px-2 py-1 flex-1 text-sm"
                value={item.name}
                onChange={(e) => updateItem(i, { name: e.target.value })}
                placeholder="Item name"
              />
              <input
                type="number"
                step="0.01"
                className="border rounded px-2 py-1 w-24 text-sm"
                value={item.price}
                onChange={(e) => updateItem(i, { price: e.target.value })}
                placeholder="0.00"
              />
              <button onClick={() => removeItem(i)} className="text-gray-400 px-1">×</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {people.map((p) => {
                const active = item.sharedBy.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleShared(i, p.id)}
                    className={`text-xs rounded-full px-2 py-1 border ${
                      active ? "bg-black text-white border-black" : "text-gray-500 border-gray-300"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="bg-black text-white rounded py-2 px-4 disabled:opacity-50">
          {saving ? "Saving..." : "Save expense"}
        </button>
        <button onClick={onCancel} className="text-gray-500 underline text-sm">Cancel</button>
      </div>
    </div>
  );
}
