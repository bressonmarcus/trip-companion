"use client";
import { useTripContext } from "@/lib/trip-context";
import MealsList from "@/components/MealsList";

export default function MealsPage() {
  const { trip, people } = useTripContext();
  return <MealsList tripId={trip.id} people={people} />;
}
