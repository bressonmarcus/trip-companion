// Tracks every trip this device has joined, so the home page can offer a
// "pick a trip" screen instead of only ever remembering one. Purely a
// device-local convenience — not access control.

const KEY = "trip-companion:trips";

export type RememberedTrip = { code: string; name: string };

export function getRememberedTrips(): RememberedTrip[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function rememberTrip(code: string, name: string) {
  if (typeof window === "undefined") return;
  const trips = getRememberedTrips().filter((t) => t.code !== code);
  trips.unshift({ code, name });
  localStorage.setItem(KEY, JSON.stringify(trips));
}

export function forgetTrip(code: string) {
  if (typeof window === "undefined") return;
  const trips = getRememberedTrips().filter((t) => t.code !== code);
  localStorage.setItem(KEY, JSON.stringify(trips));
}
