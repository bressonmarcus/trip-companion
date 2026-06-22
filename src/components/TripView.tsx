"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AddPeople from "./AddPeople";
import PersonPicker from "./PersonPicker";
import MealsList from "./MealsList";

type Trip = { id: string; name: string; code: string; start_date: string; end_date: string };
type Person = { id: string; name: string };

export default function TripView({ trip }: { trip: Trip }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);

  useEffect(() => {
    loadPeople();
    const stored = localStorage.getItem(`trip-companion:${trip.code}:personId`);
    if (stored) setPersonId(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id]);

  async function loadPeople() {
    const { data } = await supabase.from("people").select("id, name").eq("trip_id", trip.id).order("name");
    setPeople(data ?? []);
  }

  function handlePersonChosen(id: string) {
    localStorage.setItem(`trip-companion:${trip.code}:personId`, id);
    setPersonId(id);
  }

  if (people === null) return <main className="p-6">Loading...</main>;

  const me = people.find((p) => p.id === personId);

  return (
    <main className="min-h-screen p-6 max-w-lg mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{trip.name}</h1>
        <p className="text-sm text-gray-500">
          Code: <span className="font-mono">{trip.code}</span> — share this with the group
        </p>
      </div>

      {people.length === 0 ? (
        <AddPeople tripId={trip.id} onAdded={loadPeople} />
      ) : !personId || !me ? (
        <PersonPicker people={people} onChosen={handlePersonChosen} onAddPerson={loadPeople} tripId={trip.id} />
      ) : (
        <>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              You&apos;re <span className="font-medium text-gray-700">{me.name}</span>
            </span>
            <button onClick={() => setPersonId(null)} className="underline">
              Not you?
            </button>
          </div>
          <MealsList tripId={trip.id} people={people} />
        </>
      )}
    </main>
  );
}
