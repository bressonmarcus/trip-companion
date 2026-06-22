"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AddPeople({ tripId, onAdded }: { tripId: string; onAdded: () => void }) {
  const [names, setNames] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const list = names.split("\n").map((n) => n.trim()).filter(Boolean);
    if (list.length === 0) {
      setError("Add at least one name.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("people")
      .insert(list.map((name) => ({ trip_id: tripId, name })))
      .select();
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    // Whoever sets up the trip's first roster becomes the admin — only set
    // once, never overwritten on later additions.
    if (data && data.length > 0) {
      await supabase
        .from("trips")
        .update({ admin_person_id: data[0].id })
        .eq("id", tripId)
        .is("admin_person_id", null);
    }
    setLoading(false);
    onAdded();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border rounded-lg p-5">
      <h2 className="font-medium">Who&apos;s on this trip?</h2>
      <p className="text-sm text-gray-500">One name per line. You can add more later.</p>
      <textarea
        className="border rounded px-3 py-2 h-32"
        value={names}
        onChange={(e) => setNames(e.target.value)}
        placeholder={"Marcus\nFrederik\nLouise"}
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button disabled={loading} className="bg-black text-white rounded py-2 disabled:opacity-50">
        {loading ? "Saving..." : "Save people"}
      </button>
    </form>
  );
}
