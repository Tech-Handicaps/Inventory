"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { GlobalSearchHit } from "@/app/api/search/route";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** Top-bar search across assets (serial, name, club, model). Press `/` to focus. */
export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GlobalSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : { hits: [] }))
        .then((data: { hits?: GlobalSearchHit[] }) => {
          setHits(data.hits ?? []);
          setActive(0);
          setOpen(true);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  function openHit(hit: GlobalSearchHit) {
    setOpen(false);
    setQuery("");
    setHits([]);
    inputRef.current?.blur();
    router.push(`/assets?asset=${encodeURIComponent(hit.id)}`);
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      openHit(hits[active]);
    }
  }

  const showList = open && query.trim().length >= 2;

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label="Search assets by serial, name, club or model"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && hits[active] ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        placeholder="Search serial, name, club, model"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (e.target.value.trim().length < 2) setOpen(false);
        }}
        onFocus={() => {
          if (hits.length > 0) setOpen(true);
        }}
        onKeyDown={onInputKey}
        className="input-field h-10 py-2 pl-10 pr-10 text-sm text-ink placeholder:text-muted"
      />
      <kbd
        className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 text-xs text-muted sm:block"
        aria-hidden
      >
        /
      </kbd>
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-lg border border-line bg-white py-1"
        >
          {hits.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">
              {loading ? "Searching…" : "No assets match."}
            </li>
          ) : (
            hits.map((hit, i) => (
              <li
                key={hit.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => openHit(hit)}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-3 py-2 ${i === active ? "bg-brand-muted" : ""}`}
              >
                <p className="truncate text-sm font-medium text-ink">{hit.assetName}</p>
                <p className="truncate text-xs text-muted">
                  {[
                    hit.serialNumber ? `S/N ${hit.serialNumber}` : null,
                    [hit.manufacturer, hit.model].filter(Boolean).join(" ") || null,
                    hit.clubName,
                    hit.statusLabel,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
