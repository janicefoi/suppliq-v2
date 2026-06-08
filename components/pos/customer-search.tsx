"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Search, X, User, Loader2 } from "lucide-react";
import { searchCustomers, type SearchedCustomer } from "@/lib/actions/pos";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

interface CustomerSearchProps {
  selected: { id: string; name: string; phone: string } | null;
  onSelect: (customer: { id: string; name: string; phone: string } | null) => void;
}

export function CustomerSearch({ selected, onSelect }: CustomerSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchedCustomer[]>([]);
  const [isPending, startTransition] = useTransition();
  const debouncedQuery = useDebounce(query, 280);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Search
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    startTransition(async () => {
      const found = await searchCustomers(debouncedQuery);
      setResults(found);
    });
  }, [debouncedQuery]);

  function handleSelect(c: SearchedCustomer) {
    onSelect({ id: c.id, name: c.name, phone: c.phone });
    setOpen(false);
    setQuery("");
    setResults([]);
  }

  function handleClear() {
    onSelect(null);
    setQuery("");
    setResults([]);
  }

  // When selected — show chip
  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
        <User className="h-3.5 w-3.5 text-blue-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-blue-800 truncate">{selected.name}</p>
          <p className="text-[10px] text-blue-500">{selected.phone}</p>
        </div>
        <button onClick={handleClear} className="text-blue-400 hover:text-blue-600 shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // Search input + dropdown
  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        {isPending ? (
          <Loader2 className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400 animate-spin" />
        ) : (
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search customer by name or phone…"
          className={cn(
            "w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-input bg-transparent",
            "focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-slate-400"
          )}
        />
      </div>

      {open && (query.trim() || results.length > 0) && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border border-slate-200 bg-white shadow-md overflow-hidden">
          {results.length === 0 && !isPending ? (
            <div className="px-3 py-4 text-xs text-slate-400 text-center">
              {query.trim() ? `No customers found for "${query}"` : "Type to search…"}
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              {results.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-50 last:border-0"
                >
                  <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate">{c.name}</p>
                    <p className="text-[10px] text-slate-400">{c.phone}</p>
                  </div>
                  {Number(c.creditBalance) > 0 && (
                    <span className="ml-auto text-[10px] text-amber-600 shrink-0">
                      CR {Number(c.creditBalance).toLocaleString("en-KE", { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
