"use client";
import { useEffect, useState } from "react";
import { useTripContext } from "@/lib/trip-context";
import { supabase } from "@/lib/supabase";
import ReceiptCapture, { ScanResult } from "@/components/ReceiptCapture";
import ExpenseReviewForm from "@/components/ExpenseReviewForm";

type ExpenseRow = {
  id: string;
  description: string;
  merchant: string | null;
  expense_date: string | null;
  total_amount: number;
  payer_id: string;
  source: string;
  created_at: string;
  receipt_image_url: string | null;
};

export default function ReceiptsPage() {
  const { trip, people, personId } = useTripContext();
  const [mode, setMode] = useState<"list" | "scanning" | "manual" | "review">("list");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadExpenses() {
    setLoading(true);
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .eq("trip_id", trip.id)
      .order("created_at", { ascending: false });
    setExpenses(data ?? []);
    setLoading(false);
  }

  function personName(id: string) {
    return people.find((p) => p.id === id)?.name ?? "Someone";
  }

  if (mode === "review" || (mode === "scanning" && scanResult)) {
    return (
      <ExpenseReviewForm
        tripId={trip.id}
        people={people}
        personId={personId}
        initial={scanResult}
        onSaved={() => {
          setMode("list");
          setScanResult(null);
          loadExpenses();
        }}
        onCancel={() => {
          setMode("list");
          setScanResult(null);
        }}
      />
    );
  }

  if (mode === "manual") {
    return (
      <ExpenseReviewForm
        tripId={trip.id}
        people={people}
        personId={personId}
        initial={null}
        onSaved={() => {
          setMode("list");
          loadExpenses();
        }}
        onCancel={() => setMode("list")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <div className="flex-1">
          <ReceiptCapture
            tripId={trip.id}
            onScanned={(result) => {
              setScanResult(result);
              setMode("review");
            }}
          />
        </div>
        <button onClick={() => setMode("manual")} className="border rounded px-4 text-sm">
          Add manually
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium text-sm text-gray-600">Past expenses</h2>
        {loading && <p className="text-sm text-gray-400">Loading...</p>}
        {!loading && expenses.length === 0 && (
          <p className="text-sm text-gray-400">No expenses logged yet — scan a receipt or add one manually.</p>
        )}
        {expenses.map((e) => (
          <div key={e.id} className="border rounded-lg p-4 flex items-center gap-3">
            {e.receipt_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={e.receipt_image_url}
                alt="Receipt"
                className="w-12 h-12 object-cover rounded border flex-shrink-0"
              />
            )}
            <div className="flex-1 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{e.merchant || e.description}</p>
                <p className="text-xs text-gray-500">
                  Paid by {personName(e.payer_id)}
                  {e.expense_date ? ` · ${e.expense_date}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-medium text-sm">{Number(e.total_amount).toFixed(2)} kr</p>
                {e.receipt_image_url && (
                  <a href={e.receipt_image_url} target="_blank" rel="noreferrer" className="text-xs underline text-gray-500">
                    View photo
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
