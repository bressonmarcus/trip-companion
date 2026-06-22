"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import TripView from "@/components/TripView";

type Trip = {
  id: string;
  name: string;
  code: string;
  start_date: string;
  end_date: string;
};

export default function TripPage() {
  const params = useParams<{ code: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTrip() {
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("code", params.code.toUpperCase())
        .maybeSingle();
      if (error) {
        setError(error.message);
      } else if (!data) {
        setError("No trip found with that code.");
      } else {
        setTrip(data);
      }
      setLoading(false);
    }
    loadTrip();
  }, [params.code]);

  if (loading) return <main className="p-6">Loading...</main>;
  if (error) return <main className="p-6 text-red-600">{error}</main>;
  if (!trip) return null;

  return <TripView trip={trip} />;
}
