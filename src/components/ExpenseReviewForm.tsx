"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ScanResult } from "@/components/ReceiptCapture";

type Person = { id: string; name: string };
type Item = { name: string; price: string; sharedBy: string[] };

// An existing expense being re-opened for editing (from the Receipts list).
export type EditExpense = {
  id: string;
  merchant: string | null;
  date: string | null;
  total: number;
  payerId: string;
  imageUrl: string | null;
  items: { name: string; price: number; sharedBy: string[] }[];
};

const TOLERANCE = 0.05;

export default function ExpenseReviewForm({
  tripId,
  people,
  personId,
  initial,
  edit,
  onSaved,
  onCancel,
}: {
  tripId: string;
  people: Person[];
  personId: string;
  initial: ScanResult | null;
  edit?: EditExpense | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const allIds = people.map((p) => p.id);
  const [merchant, setMerchant] = useState(edit?.merchant ?? initial?.merchant ?? "");
  const [date, setDate] = useState(edit?.date ?? initial?.date ?? "");
  const [total, setTotal] = useState(
    edit ? String(edit.total) : initial?.total != null ? String(initial.total) : ""
  );
  const [items, setItems] = useState<Item[]>(
    edit
      ? edit.items.map((it) => ({ name: it.name, price: String(it.price), sharedBy: [...it.sharedBy] }))
      : initial?.items.map((it) => ({ name: it.name, price: String(it.price), sharedBy: [...allIds] })) ?? []
  );
  const [payerId, setPayerId] = useState(edit?.payerId ?? personId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imageUrl = edit?.imageUrl ?? initial?.imageUrl ?? null;

  const itemsSum = Math.round(items.reduce((sum, it) => sum + (Number(it.price) || 0), 0) * 100) / 100;
  const totalNum = total.trim() ? Number(total) : itemsSum;
  // Signed gap: positive => items add up to MORE than the total (a price is too
  // high); negative => items add up to LESS (a price is too low, or something
  // wasn't itemised).
  const overshoot = Math.round((itemsSum - totalNum) * 100) / 100;
  const mismatch = total.trim() !== "" && Math.abs(overshoot) > TOLERANCE && items.length > 0;

  // Likely-misread line. When items overshoot the total, the culprit is an item
  // priced too high — flag any single item that alone exceeds the whole total
  // (a sure sign of a misread digit), otherwise the most expensive line. This is
  // general: it catches any digit confusion (1↔7, 3↔8, a stray decimal, …), not
  // one hardcoded pair.
  let culpritIndex = -1;
  if (mismatch && overshoot > 0) {
    let bestPrice = -Infinity;
    items.forEach((it, i) => {
      const p = Number(it.price) || 0;
      if (p > bestPrice) {
        bestPrice = p;
        culpritIndex = i;
      }
    });
  }

  function updateItem(index: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }
  function addItem() {
    setItems((prev) => [...prev, { name: "", price: "", sharedBy: [...allIds] }]);
  }
  function addDifferenceAsItem() {
    const diff = Math.round((totalNum - itemsSum) * 100) / 100; // positive: the missing amount
    setItems((prev) => [...prev, { name: "Other (unlisted)", price: diff.toFixed(2), sharedBy: [...allIds] }]);
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
    const cleanSum = Math.round(cleanItems.reduce((s, it) => s + Number(it.price), 0) * 100) / 100;
    const finalTotal = total.trim() ? Number(total) : cleanSum;
    if (!finalTotal || finalTotal <= 0) {
      setError("Enter a total amount, or add at least one item.");
      return;
    }
    // Hard block: if the receipt is itemised and a total is given, the items
    // MUST add up to the total. Saving a mismatch is what corrupts the balances.
    if (cleanItems.length > 0 && total.trim() && Math.abs(cleanSum - Number(total)) > TOLERANCE) {
      const gap = Math.round((cleanSum - Number(total)) * 100) / 100;
      setError(
        `The items add up to ${cleanSum.toFixed(2)} kr but the total is ${Number(total).toFixed(2)} kr — ` +
          `${Math.abs(gap).toFixed(2)} kr ${gap > 0 ? "too much" : "short"}. ` +
          `Fix the highlighted line (or clear the Total field to use the item sum).`
      );
      return;
    }
    if (cleanItems.some((it) => it.sharedBy.length === 0)) {
      setError("Every item needs at least one person assigned to it.");
      return;
    }
    setSaving(true);

    let expenseId = edit?.id ?? null;
    const expenseFields = {
      payer_id: payerId,
      description: merchant.trim() || (initial ? "Scanned receipt" : "Manual expense"),
      merchant: merchant.trim() || null,
      expense_date: date.trim() || null,
      total_amount: finalTotal,
    };

    if (edit) {
      const { error: updateError } = await supabase.from("expenses").update(expenseFields).eq("id", edit.id);
      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
      // Replace this expense's items wholesale. Snapshot rule: only this
      // expense's shares are touched — nothing else in the trip changes.
      await supabase.from("expense_items").delete().eq("expense_id", edit.id);
    } else {
      const { data: expense, error: expenseError } = await supabase
        .from("expenses")
        .insert({ trip_id: tripId, ...expenseFields, source: initial ? "scan" : "manual", receipt_image_url: initial?.imageUrl ?? null })
        .select()
        .single();
      if (expenseError || !expense) {
        setError(expenseError?.message ?? "Could not save this expense.");
        setSaving(false);
        return;
      }
      expenseId = expense.id;
    }

    if (cleanItems.length > 0) {
      const { error: itemsError } = await supabase.from("expense_items").insert(
        cleanItems.map((it) => ({
          expense_id: expenseId,
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
      // No itemisation — treat as one item shared by everyone.
      await supabase.from("expense_items").insert({
        expense_id: expenseId,
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
      <h2 className="font-medium">{edit ? "Edit expense" : initial ? "Review scanned receipt" : "Add expense manually"}</h2>

      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="Receipt" className="rounded border max-h-64 object-contain self-start" />
      )}

      {mismatch && (
        <div className="bg-red-50 border border-red-300 rounded p-3 text-sm text-red-800 flex flex-col gap-2">
          <p>
            The items add up to <span className="font-semibold">{itemsSum.toFixed(2)} kr</span> but the total is{" "}
            <span className="font-semibold">{totalNum.toFixed(2)} kr</span> — a gap of{" "}
            <span className="font-semibold">{Math.abs(overshoot).toFixed(2)} kr</span>. You can&apos;t save until they match.
          </p>
          {overshoot > 0 && culpritIndex >= 0 && (
            <p>
              The <span className="font-semibold">highlighted line</span> is the most likely misread — its price looks too
              high (a digit probably got read wrong). Double-check it against the receipt.
            </p>
          )}
          {overshoot < 0 && (
            <button type="button" onClick={addDifferenceAsItem} className="self-start underline font-medium">
              Add the missing {Math.abs(overshoot).toFixed(2)} kr as its own shared item
            </button>
          )}
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
                className={`border rounded px-2 py-1 w-24 text-sm ${
                  culpritIndex === i ? "ring-2 ring-red-400 border-red-400" : ""
                }`}
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
        <button onClick={handleSave} disabled={saving || mismatch} className="bg-black text-white rounded py-2 px-4 disabled:opacity-50">
          {saving ? "Saving..." : "Save expense"}
        </button>
        <button onClick={onCancel} className="text-gray-500 underline text-sm">Cancel</button>
      </div>
    </div>
  );
}
