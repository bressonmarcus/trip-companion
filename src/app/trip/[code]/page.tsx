"use client";
import { useTripContext } from "@/lib/trip-context";

export default function TripOverviewPage() {
  const { trip, people } = useTripContext();

  return (
    <div className="flex flex-col gap-4">
      <div className="border rounded-lg p-5 flex flex-col gap-2">
        <h2 className="font-medium">Trip details</h2>
        <p className="text-sm text-gray-600">
          {new Date(trip.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} –{" "}
          {new Date(trip.end_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </p>
        <p className="text-sm text-gray-500">
          Code: <span className="font-mono">{trip.code}</span>
        </p>
      </div>

      <div className="border rounded-lg p-5">
        <h2 className="font-medium mb-2">People ({people.length})</h2>
        <ul className="flex flex-col gap-1 text-sm text-gray-700">
          {people.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
