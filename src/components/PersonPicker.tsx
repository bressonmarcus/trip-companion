"use client";

type Person = { id: string; name: string; claimed: boolean };

export default function PersonPicker({
  people,
  onChosen,
}: {
  people: Person[];
  onChosen: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border rounded-lg p-5">
      <h2 className="font-medium">Who are you?</h2>
      <p className="text-sm text-gray-500">This just remembers you on this device — it&apos;s not a login.</p>
      <div className="flex flex-col gap-2">
        {people.map((p) => (
          <button
            key={p.id}
            onClick={() => onChosen(p.id)}
            className={`border rounded py-2 text-left px-3 hover:bg-gray-100 ${p.claimed ? "bg-gray-50" : ""}`}
          >
            <span className={p.claimed ? "text-gray-400" : ""}>{p.name}</span>
            {p.claimed && <span className="block text-xs text-gray-400">Already picked — tap again if this is you</span>}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-1">Don&apos;t see your name? Ask whoever set up the trip to add you.</p>
    </div>
  );
}
