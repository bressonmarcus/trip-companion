"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generateTripCode } from "@/lib/tripcode";
import { getRememberedTrips, RememberedTrip } from "@/lib/recent-trips";

export default function Home() {
  const router = useRouter();
  const [trips, setTrips] = useState<RememberedTrip[] | null>(null);
  const [showForms, setShowForms] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const remembered = getRememberedTrips();
    setTrips(remembered);
    setShowForms(remembered.length === 0);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name || !startDate || !endDate) {
      setError("Fill in trip name and both dates.");
      return;
    }
    setLoading(true);
    const code = generateTripCode();
    const { error: insertError } = await supabase.from("trips").insert({
      name,
      code,
      start_date: startDate,
      end_date: endDate,
    });
    setLoading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.push(`/trip/${code}`);
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode) return;
    router.push(`/trip/${joinCode.trim().toUpperCase()}`);
  }

  if (trips === null) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-6">
      <h1 className="text-2xl font-semibold">Trip Companion</h1>

      {trips.length > 0 && (
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <h2 className="font-medium text-sm text-gray-600">Your trips</h2>
          {trips.map((t) => (
            <button
              key={t.code}
              onClick={() => router.push(`/trip/${t.code}`)}
              className="border rounded-lg p-4 text-left hover:bg-gray-50 flex items-center justify-between"
            >
              <span className="font-medium">{t.name}</span>
              <span className="text-xs text-gray-400 font-mono">{t.code}</span>
            </button>
          ))}
          {!showForms && (
            <button onClick={() => setShowForms(true)} className="text-sm underline text-gray-500 self-start mt-1">
              Start or join another trip
            </button>
          )}
        </div>
      )}

      {showForms && (
        <>
          <form onSubmit={handleCreate} className="flex flex-col gap-3 w-full max-w-sm border rounded-lg p-5">
            <h2 className="font-medium">Start a new trip</h2>
            <input
              className="border rounded px-3 py-2"
              placeholder="Trip name (e.g. Summerhouse 2026)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <label className="text-sm text-gray-600">Start date</label>
            <input type="date" className="border rounded px-3 py-2" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <label className="text-sm text-gray-600">End date</label>
            <input type="date" className="border rounded px-3 py-2" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button disabled={loading} className="bg-black text-white rounded py-2 mt-2 disabled:opacity-50">
              {loading ? "Creating..." : "Create trip"}
            </button>
          </form>

          <form onSubmit={handleJoin} className="flex flex-col gap-3 w-full max-w-sm border rounded-lg p-5">
            <h2 className="font-medium">Join an existing trip</h2>
            <input
              className="border rounded px-3 py-2 uppercase"
              placeholder="Trip code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <button className="bg-gray-200 rounded py-2">Join</button>
          </form>
        </>
      )}
    </main>
  );
}
