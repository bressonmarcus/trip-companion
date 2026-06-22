"use client";
import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/meals", label: "Meals" },
  { href: "/shopping", label: "Shopping" },
  { href: "/receipts", label: "Receipts" },
  { href: "/expenses", label: "Expenses" },
];

export default function TripNav({
  tripName,
  meName,
  onSwitchPerson,
  onSwitchTrip,
}: {
  tripName: string;
  meName: string;
  onSwitchPerson: () => void;
  onSwitchTrip: () => void;
}) {
  const pathname = usePathname();
  const params = useParams<{ code: string }>();
  const base = `/trip/${params.code}`;

  return (
    <header className="border-b bg-white text-gray-900 sticky top-0 z-10">
      <div className="max-w-lg mx-auto w-full px-6 pt-4 flex items-center justify-between">
        <span className="font-semibold text-sm truncate">{tripName}</span>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{meName}</span>
          <button onClick={onSwitchPerson} className="underline">
            switch
          </button>
          <button onClick={onSwitchTrip} className="underline">
            leave
          </button>
        </div>
      </div>
      <nav className="max-w-lg mx-auto w-full px-6 flex gap-4 mt-3 text-sm overflow-x-auto">
        {TABS.map((tab) => {
          const href = `${base}${tab.href}`;
          const active = pathname === href;
          return (
            <Link
              key={tab.href}
              href={href}
              className={`pb-2 border-b-2 whitespace-nowrap ${
                active ? "border-black font-medium text-black" : "border-transparent text-gray-500"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
