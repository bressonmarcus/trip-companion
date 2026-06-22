"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ShoppingList from "./ShoppingList";
import type { Loadout } from "./MealLoadout";

const EMPTY_LOADOUT: Loadout = { protein: [], sides: [], salad: [], sauce: [], other: [] };

export default function ShoppingMealDetail({ mealId }: { mealId: string }) {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const [label, setLabel] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [loadout, setLoadout] = useState<Loadout>(EMPTY_LOADOUT);
  const [headcount, setHeadcount] = useState(1);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealId]);

  async function load() {
    const { data: meal } = await supabase.from("meals").select("label, date, loadout").eq("id", mealId).single();
    if (meal) {
      setLabel(meal.label ?? "Dinner");
      setDate(meal.date);
      setLoadout({ ...EMPTY_LOADOUT, ...(meal.loadout ?? {}) });
    }
    const { data: attendanceRows } = await supabase.from("attendance").select("status").eq("meal_id", mealId);
    const inCount = (attendanceRows ?? []).filter((r) => r.status === "in").length;
    setHeadcount(inCount || 1);
    setLoaded(true);
  }

  if (!loaded) return <p>Loading...</p>;

  return (
    <div className="flex flex-col gap-6">
      <button
        onClick={() => router.push(`/trip/${params.code}/shopping`)}
        className="text-sm underline text-gray-500 self-start"
      >
        ← Back to shopping lists
      </button>

      <div>
        <h1 className="text-lg font-medium">{label}</h1>
        <p className="text-sm text-gray-500">
          {date &&
            new Date(date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })} —{" "}
          {headcount} people
        </p>
      </div>

      <ShoppingList mealId={mealId} loadout={loadout} headcount={headcount} />
    </div>
  );
}
