"use client";
import { useState } from "react";
import { useTripContext } from "@/lib/trip-context";
import { supabase } from "@/lib/supabase";
import { rememberTrip } from "@/lib/recent-trips";

export default function TripOverviewPage() {
  const { trip, people, isAdmin, refreshPeople } = useTripContext();
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(trip.name);
  const [savingName, setSavingName] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [addingPerson, setAddingPerson] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === trip.name) {
      setEditingName(false);
      setNameDraft(trip.name);
      return;
    }
    setSavingName(true);
    const { error: updateError } = await supabase.from("trips").update({ name: trimmed }).eq("id", trip.id);
    setSavingName(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    rememberTrip(trip.code, trimmed);
    setEditingName(false);
    // Reflects immediately in this tab's title via a full reload of the trip;
    // simplest is just to let the next navigation pick it up, but we can also
    // patch it in place by reloading the page data the layout already holds.
    window.location.reload();
  }

  async function handleAddPerson(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = newPersonName.trim();
    if (!trimmed) return;
    setAddingPerson(true);
    const { error: insertError } = await supabase.from("people").insert({ trip_id: trip.id, name: trimmed });
    setAddingPerson(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewPersonName("");
    refreshPeople();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border rounded-lg p-5 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          {editingName ? (
            <div className="flex gap-2 flex-1">
              <input
                className="border rounded px-2 py-1 text-sm flex-1"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                autoFocus
              />
              <button onClick={saveName} disabled={savingName} className="text-sm underline">
                {savingName ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditingName(false);
                  setNameDraft(trip.name);
                }}
                className="text-sm text-gray-400 underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <h2 className="font-medium">Trip details</h2>
              {isAdmin && (
                <button onClick={() => setEditingName(true)} className="text-xs underline text-gray-500">
                  Rename trip
                </button>
              )}
            </>
          )}
        </div>
        <p className="text-sm text-gray-600">
          {new Date(trip.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} –{" "}
          {new Date(trip.end_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </p>
        <p className="text-sm text-gray-500">
          Code: <span className="font-mono">{trip.code}</span>
        </p>
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>

      <div className="border rounded-lg p-5">
        <h2 className="font-medium mb-2">People ({people.length})</h2>
        <ul className="flex flex-col gap-1 text-sm text-gray-700 mb-3">
          {people.map((p) => (
            <li key={p.id}>
              {p.name}
              {trip.admin_person_id === p.id && <span className="text-xs text-gray-400"> · admin</span>}
            </li>
          ))}
        </ul>
        {isAdmin ? (
          <form onSubmit={handleAddPerson} className="flex gap-2">
            <input
              className="border rounded px-3 py-2 flex-1 text-sm"
              placeholder="Add a name"
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
            />
            <button disabled={addingPerson} className="bg-gray-200 rounded px-3 text-sm disabled:opacity-50">
              {addingPerson ? "Adding..." : "Add"}
            </button>
          </form>
        ) : (
          <p className="text-xs text-gray-400">Only the trip admin can add people.</p>
        )}
      </div>
    </div>
  );
}
