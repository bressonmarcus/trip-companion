"use client";
import { useEffect, useRef, useState } from "react";

export default function CategoryEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!adding || value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/dish-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: label, query: value }),
        });
        const json = await res.json();
        setSuggestions(json.suggestions ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, adding, label]);

  function confirmAdd(text?: string) {
    const trimmed = (text ?? value).trim();
    if (trimmed) onChange([...items, trimmed]);
    setValue("");
    setSuggestions([]);
    setAdding(false);
  }

  function removeAt(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-1 border rounded-full px-3 py-1 text-sm bg-gray-50">
            {item}
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="text-gray-400 hover:text-gray-700 leading-none"
              aria-label={`Remove ${item}`}
            >
              ×
            </button>
          </span>
        ))}
        {adding ? (
          <div className="relative">
            <input
              autoFocus
              className="border rounded-full px-3 py-1 text-sm w-48"
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmAdd();
                }
                if (e.key === "Escape") {
                  setValue("");
                  setSuggestions([]);
                  setAdding(false);
                }
              }}
              onBlur={() => {
                // Give a suggestion click a chance to register before closing.
                setTimeout(() => confirmAdd(), 150);
              }}
            />
            {suggestions.length > 0 && (
              <div className="absolute left-0 top-full mt-1 w-56 border rounded-lg bg-white shadow-md z-20 overflow-hidden">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      confirmAdd(s);
                    }}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="border border-dashed rounded-full w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-50"
            aria-label={`Add to ${label}`}
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}
