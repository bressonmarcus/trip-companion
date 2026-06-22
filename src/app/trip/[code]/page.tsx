"use client";
import { useState } from "react";
import { useTripContext } from "@/lib/trip-context";
import { supabase } from "@/lib/supabase";
import { rememberTrip } from "@/lib/recent-trips";
import Avatar from "@/components/Avatar";
import AvatarUpload from "@/components/AvatarUpload";

export default function TripOverviewPage() {
  const { trip, people, personId, isAdmin, refreshPeople, refreshTrip } = useTripContext();
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
    await refreshTrip();
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

  async function handlePersonAvatar(url: string) {
    await supabase.from("people").update({ avatar_url: url }).eq("id", personId);
    refreshPeople();
  }

  async function handleTripPhoto(url: string) {
    await supabase.from("trips").update({ photo_url: url }).eq("id", trip.id);
    await refreshTrip();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border rounded-lg p-5 flex flex-col gap-3">
        {trip.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={trip.photo_url} alt={trip.name} className="w-full h-32 rounded-lg object-cover" />
        )}

        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold">{trip.name}</h1>
          {isAdmin && !editingName && (
            <button onClick={() => setEditingName(true)} className="text-xs underline text-gray-500">
              Rename
            </button>
          )}
        </div>

        {editingName && (
          <div className="flex gap-2">
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
        )}

        <p className="text-sm text-gray-600">
          {new Date(trip.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} –{" "}
          {new Date(trip.end_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </p>
        <p className="text-sm text-gray-500">
          Code: <span className="font-mono">{trip.code}</span>
        </p>

        {isAdmin && (
          <AvatarUpload
            bucketPath={`trips/${trip.id}`}
            currentUrl={null}
            onUploaded={handleTripPhoto}
            previewClassName="hidden"
            buttonLabel={trip.photo_url ? "Change trip photo" : "Add a trip photo"}
          />
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>

      <div className="border rounded-lg p-5">
        <h2 className="font-medium mb-2">People ({people.length})</h2>
        <ul className="flex flex-col gap-2 text-sm text-gray-700 mb-3">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <Avatar url={p.avatar_url} name={p.name} size={28} />
              <span>
                {p.name}
                {trip.admin_person_id === p.id && <span className="text-xs text-gray-400"> · admin</span>}
              </span>
              {p.id === personId && (
                <span className="ml-auto">
                  <AvatarUpload
                    bucketPath={`people/${p.id}`}
                    currentUrl={null}
                    onUploaded={handlePersonAvatar}
                    previewClassName="hidden"
                    buttonLabel="Set your photo"
                  />
                </span>
              )}
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
