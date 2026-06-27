"use client";
import { useEffect, useState } from "react";
import { useTripContext } from "@/lib/trip-context";
import { supabase } from "@/lib/supabase";
import { computeNetBalances, simplifyDebts, balanceImbalance, SettlePayment } from "@/lib/balances";

type ExpenseRow = { id: string; payer_id: string; total_amount: number };
type ItemRow = { expense_id: string; price: number; shared_by: string[] };
type SettlementRow = { id: string; payments: SettlePayment[]; created_at: string };

export default function ExpensesPage() {
  const { trip, people } = useTripContext();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data: expenseData } = await supabase
      .from("expenses")
      .select("id, payer_id, total_amount")
      .eq("trip_id", trip.id);
    const expenseIds = (expenseData ?? []).map((e) => e.id);
    const { data: itemData } = expenseIds.length
      ? await supabase.from("expense_items").select("expense_id, price, shared_by").in("expense_id", expenseIds)
      : { data: [] };
    const { data: settlementData } = await supabase
      .from("settlements")
      .select("id, payments, created_at")
      .eq("trip_id", trip.id)
      .order("created_at", { ascending: false });
    setExpenses(expenseData ?? []);
    setItems((itemData ?? []) as ItemRow[]);
    setSettlements(settlementData ?? []);
    setLoading(false);
  }

  const balances = computeNetBalances(people, expenses, items, settlements);
  const suggested = simplifyDebts(balances);
  const hasActivity = expenses.length > 0;
  const imbalance = balanceImbalance(balances);

  async function handleSettleUp() {
    setError(null);
    if (suggested.length === 0) {
      setError("Everyone's already even — nothing to settle.");
      return;
    }
    setSettling(true);
    const { error: insertError } = await supabase.from("settlements").insert({
      trip_id: trip.id,
      payments: suggested,
    });
    setSettling(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    load();
  }

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>;

  return (
    <div className="flex flex-col gap-5">
      {hasActivity && Math.abs(imbalance) > 1 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-sm text-amber-800">
          <p className="font-medium">These balances don&apos;t add up ({imbalance > 0 ? "+" : ""}{imbalance.toFixed(2)} kr off).</p>
          <p className="mt-1">
            One or more receipts have items that don&apos;t match their total, so the books can&apos;t balance.
            Open the offending receipt in the <span className="font-medium">Receipts</span> tab and fix the prices
            until the items add up to the total.
          </p>
        </div>
      )}

      <div className="border rounded-lg p-5">
        <h2 className="font-medium mb-3">Balances</h2>
        {!hasActivity && <p className="text-sm text-gray-400">No expenses logged yet.</p>}
        {hasActivity && (
          <ul className="flex flex-col gap-1 text-sm">
            {balances.map((b) => (
              <li key={b.personId} className="flex justify-between">
                <span>{b.name}</span>
                <span className={b.amount > 0.01 ? "text-green-600" : b.amount < -0.01 ? "text-red-600" : "text-gray-400"}>
                  {b.amount > 0.01 ? `is owed ${b.amount.toFixed(2)} kr` : b.amount < -0.01 ? `owes ${(-b.amount).toFixed(2)} kr` : "settled up"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border rounded-lg p-5">
        <h2 className="font-medium mb-3">Suggested payments</h2>
        {suggested.length === 0 && <p className="text-sm text-gray-400">No payments needed right now.</p>}
        {suggested.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm mb-4">
            {suggested.map((p, i) => (
              <li key={i}>
                <span className="font-medium">{p.fromName}</span> pays <span className="font-medium">{p.toName}</span>{" "}
                {p.amount.toFixed(2)} kr
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={handleSettleUp}
          disabled={settling || suggested.length === 0}
          className="bg-black text-white rounded py-2 px-4 text-sm disabled:opacity-50"
        >
          {settling ? "Settling..." : "Settle up"}
        </button>
        <p className="text-xs text-gray-400 mt-2">
          This records today&apos;s suggested payments. Use it once, near the end of the trip, after everyone&apos;s
          expenses are in.
        </p>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </div>

      {settlements.length > 0 && (
        <div className="border rounded-lg p-5">
          <h2 className="font-medium mb-3">Settlement history</h2>
          <div className="flex flex-col gap-3">
            {settlements.map((s) => (
              <div key={s.id} className="text-sm">
                <p className="text-xs text-gray-400 mb-1">{new Date(s.created_at).toLocaleString()}</p>
                <ul className="flex flex-col gap-0.5">
                  {s.payments.map((p, i) => (
                    <li key={i}>
                      {p.fromName} → {p.toName}: {p.amount.toFixed(2)} kr
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
