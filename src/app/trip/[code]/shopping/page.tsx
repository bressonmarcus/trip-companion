"use client";
import { useSearchParams } from "next/navigation";
import { useTripContext } from "@/lib/trip-context";
import ShoppingMealsList from "@/components/ShoppingMealsList";
import ShoppingMealDetail from "@/components/ShoppingMealDetail";
import ManualShoppingList from "@/components/ManualShoppingList";

export default function ShoppingPage() {
  const { trip } = useTripContext();
  const searchParams = useSearchParams();
  const mealId = searchParams.get("meal");
  const listId = searchParams.get("list");

  if (mealId) return <ShoppingMealDetail mealId={mealId} />;
  if (listId) return <ManualShoppingList listId={listId} />;
  return <ShoppingMealsList tripId={trip.id} />;
}
