"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AddPeople from "@/components/AddPeople";
import PersonPicker from "@/components/PersonPicker";
import TripNav from "@/components/TripNav";
import { TripContext } from "@/lib/trip-context";
import type { Trip, Person } from "@/lib/trip-context";

export default function TripLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTrip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code]);

  async function loadTrip() {
    const { data, error: loadError } = await supabase
      .from("trips")
      .select("*")
      .eq("code", params.code.toUpperCase())
      .maybeSingle();
    if (loadError) {
      setError(loadError.message);
      return;
    }
    if (!data) {
      setError("No trip found with that code.");
      return;
    }
    setTrip(data);
    localStorage.setItem("trip-companion:lastTripCode", data.code);
    const stored = localStorage.getItem(`trip-companion:${data.code}:personId`);
    if (stored) setPersonId(stored);
    await loadPeople(data.id);
  }

  async function loadPeople(tripId: string) {
    const { data } = await supabase.from("people").select("id, name").eq("trip_id", tripId).order("name");
    setPeople(data ?? []);
  }

  function handlePersonChosen(id: string) {
    if (!trip) return;
    localStorage.setItem(`trip-companion:${trip.code}:personId`, id);
    setPersonId(id);
  }

  function switchTrip() {
    localStorage.removeItem("trip-companion:lastTripCode");
    router.push("/");
  }

  function switchPerson() {
    setPersonId(null);
  }

  if (error) {
    return (
      <main className="p-6 max-w-lg mx-auto flex flex-col gap-3">
        <p className="text-red-600">{error}</p>
        <button onClick={switchTrip} className="text-sm underline text-gray-500 self-start">
          Start over
        </button>
      </main>
    );
  }

  if (!trip || people === null) return <main className="p-6">Loading...</main>;

  if (people.length === 0) {
    return (
      <main className="min-h-screen p-6 max-w-lg mx-auto flex flex-col gap-6">
        <TripHeader trip={trip} />
        <AddPeople tripId={trip.id} onAdded={() => loadPeople(trip.id)} />
      </main>
    );
  }

  const me = people.find((p) => p.id === personId);
  if (!personId || !me) {
    return (
      <main className="min-h-screen p-6 max-w-lg mx-auto flex flex-col gap-6">
        <TripHeader trip={trip} />
        <PersonPicker people={people} onChosen={handlePersonChosen} onAddPerson={() => loadPeople(trip.id)} tripId={trip.id} />
      </main>
    );
  }

  return (
    <TripContext.Provider value={{ trip, people, personId, refreshPeople: () => loadPeople(trip.id), switchPerson }}>
      <div className="min-h-screen flex flex-col">
        <TripNav tripName={trip.name} meName={me.name} onSwitchPerson={switchPerson} onSwitchTrip={switchTrip} />
        <div className="max-w-lg mx-auto w-full p-6 flex-1">{children}</div>
      </div>
    </TripContext.Provider>
  );
}

function TripHeader({ trip }: { trip: Trip }) {
  return (
    <div>
      <h1 className="text-xl font-semibold">{trip.name}</h1>
      <p className="text-sm text-gray-500">
        Code: <span className="font-mono">{trip.code}</span> — share this with the group
      </p>
    </div>
  );
}
