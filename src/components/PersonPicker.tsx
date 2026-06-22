"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Person = { id: string; name: string };

export default function PersonPicker({
  people,
  onChosen,
  onAddPerson,
  tripId,
}: {
  people: Person[];
  onChosen: (id: string) => void;
  onAddPerson: () => void;
  tripId: string;
}) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAddNew(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    const { data } = await supabase
      .from("people")
      .insert({ trip_id: tripId, name: newName.trim() })
      .select()
      .single();
    setAdding(false);
    setNewName("");
    onAddPerson();
    if (data) onChosen(data.id);
  }

  return (
    <div className="flex flex-col gap-3 border rounded-lg p-5">
      <h2 className="font-medium">Who are you?</h2>
      <p className="text-sm text-gray-500">This just remembers you on this device — it&apos;s not a login.</p>
      <div className="flex flex-col gap-2">
        {people.map((p) => (
          <button
            key={p.id}
            onClick={() => onChosen(p.id)}
            className="border rounded py-2 text-left px-3 hover:bg-gray-100"
          >
            {p.name}
          </button>
        ))}
      </div>
      <form onSubmit={handleAddNew} className="flex gap-2 mt-2">
        <input
          className="border rounded px-3 py-2 flex-1"
          placeholder="Not on the list? Add your name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button disabled={adding} className="bg-gray-200 rounded px-3">
          {adding ? "..." : "Add"}
        </button>
      </form>
    </div>
  );
}
