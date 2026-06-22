"use client";
import { createContext, useContext } from "react";

export type Trip = { id: string; name: string; code: string; start_date: string; end_date: string; admin_person_id: string | null };
export type Person = { id: string; name: string; claimed: boolean };

export type TripContextValue = {
  trip: Trip;
  people: Person[];
  personId: string;
  refreshPeople: () => Promise<void>;
  switchPerson: () => void;
  isAdmin: boolean;
};

export const TripContext = createContext<TripContextValue | null>(null);

export function useTripContext() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTripContext must be used within a trip layout.");
  return ctx;
}
