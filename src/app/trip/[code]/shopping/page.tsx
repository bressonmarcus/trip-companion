"use client";
import { useSearchParams } from "next/navigation";
import { useTripContext } from "@/lib/trip-context";
import ShoppingMealsList from "@/components/ShoppingMealsList";
import ShoppingMealDetail from "@/components/ShoppingMealDetail";

export default function ShoppingPage() {
  const { trip } = useTripContext();
  const searchParams = useSearchParams();
  const mealId = searchParams.get("meal");

  if (mealId) return <ShoppingMealDetail mealId={mealId} />;
  return <ShoppingMealsList tripId={trip.id} />;
}
