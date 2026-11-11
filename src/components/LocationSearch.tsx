"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, LoaderCircle, MapPin, Search, X } from "lucide-react";
import type { Suggestion } from "@/lib/types";

export default function LocationSearch({ mode, onSelect, disabled = false, purpose = "origin", resetAfterSelect = false, initialSelection }: {
  mode: "demo" | "live";
  onSelect: (place: Suggestion | null, sessionToken: string) => void;
  disabled?: boolean;
  purpose?: "origin" | "venue";
  resetAfterSelect?: boolean;
  initialSelection?: Suggestion;
}) {
  const [query, setQuery] = useState(initialSelection?.name??"");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Suggestion | null>(initialSelection??null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const token = useRef("");
  const id = useId();

  useEffect(() => { token.current = crypto.randomUUID(); }, []);
  useEffect(() => {
    if (query.trim().length < 2 || selected || disabled) { setSuggestions([]); setLoading(false); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError("");
      try {
        const response = await fetch(`/api/places?q=${encodeURIComponent(query)}&sessionToken=${token.current}&mode=${mode}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Location search is unavailable.");
        setSuggestions(data.suggestions); setOpen(true); setActive(-1);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Could not search locations.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, selected, mode, disabled]);

  function choose(place: Suggestion) {
    onSelect(place, token.current);
    setSelected(resetAfterSelect ? null : place); setQuery(resetAfterSelect ? "" : place.name); setOpen(false);
    if (resetAfterSelect) { setSuggestions([]); token.current = crypto.randomUUID(); }
  }

  return <div className="location-search">
    <div className={`search-field ${selected ? "is-verified" : ""}`}>
      <Search size={18} aria-hidden="true" />
      <input id={`${id}-input`} role="combobox" aria-label={purpose === "venue" ? "Search restaurants or meeting places" : "Search for your starting location"} aria-autocomplete="list" aria-expanded={open && suggestions.length > 0} aria-controls={`${id}-list`} aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined} placeholder={purpose === "venue" ? "Search a restaurant or place" : "Street, landmark or neighborhood"} value={query} disabled={disabled} autoComplete="off"
        onChange={event => { setQuery(event.target.value); setSelected(null); onSelect(null, token.current); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={event => {
          if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, suggestions.length - 1)); }
          if (event.key === "ArrowUp") { event.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
          if (event.key === "Enter" && open && suggestions[active]) { event.preventDefault(); choose(suggestions[active]); }
          if (event.key === "Escape") setOpen(false);
        }} />
      {loading ? <LoaderCircle size={17} className="spin" /> : selected ? <Check size={18} /> : query ? <button type="button" className="icon-button" aria-label="Clear location" onClick={() => { setQuery(""); setSelected(null); onSelect(null, token.current); }}><X size={15} /></button> : null}
    </div>
    {open && suggestions.length > 0 && <ul className="search-suggestions" id={`${id}-list`} role="listbox">
      {suggestions.map((place, index) => <li key={place.id} id={`${id}-${index}`} role="option" aria-selected={active === index}>
        <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => choose(place)} className={active === index ? "active" : ""}><MapPin size={17} /><span><strong>{place.name}</strong><small>{place.address}</small></span></button>
      </li>)}
    </ul>}
    {selected && <p className="verified-message"><Check size={13} /> {selected.address || selected.name}</p>}
    {selected?.broadArea && purpose==="origin" && <p className="field-hint">This is a broad area. For a more accurate route, choose a street, landmark or specific neighborhood. Otherwise, the route starts at Google’s mapped area center.</p>}
    {error && <p className="field-error" role="alert">{error}</p>}
    {!selected && !error && purpose === "origin" && <p className="field-hint">Select a specific street, landmark or neighborhood from Google’s results.</p>}
    {mode === "live" && <span className="google-attribution">Google Maps</span>}
  </div>;
}
