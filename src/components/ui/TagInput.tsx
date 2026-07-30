"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type Props = {
  id?: string;
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
  placeholder?: string;
  required?: boolean;
  hint?: string;
  disabled?: boolean;
};

function dedupe(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const trimmed = t.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function TagInput({
  id: idProp,
  label,
  value,
  onChange,
  suggestions,
  placeholder = "Type to search tags…",
  required,
  hint,
  disabled,
}: Props) {
  const autoId = useId();
  const inputId = idProp ?? autoId;
  const listId = `${inputId}-suggestions`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selectedKeys = useMemo(
    () => new Set(value.map((t) => t.toLowerCase())),
    [value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suggestions
      .filter((s) => !selectedKeys.has(s.toLowerCase()))
      .filter((s) => !q || s.toLowerCase().includes(q))
      .slice(0, 12);
  }, [query, selectedKeys, suggestions]);

  const canAddCustom =
    query.trim().length > 0 &&
    !selectedKeys.has(query.trim().toLowerCase()) &&
    !suggestions.some((s) => s.toLowerCase() === query.trim().toLowerCase());

  function addTag(tag: string) {
    const next = dedupe([...value, tag.trim()]);
    onChange(next);
    setQuery("");
    setOpen(false);
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t.toLowerCase() !== tag.toLowerCase()));
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <label htmlFor={inputId} className="text-xs font-medium text-black/70">
        {label}
        {required ? " (required)" : ""}
      </label>
      <div
        className={`mt-1 flex min-h-[2.75rem] flex-wrap items-center gap-1.5 rounded-lg border border-black/15 bg-white px-2 py-2 ${
          disabled ? "opacity-60" : ""
        }`}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-brand-muted/80 px-2.5 py-0.5 text-xs font-medium text-brand-deep ring-1 ring-brand/20"
          >
            {tag}
            {!disabled ? (
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="rounded-full text-brand-hover hover:bg-brand/10"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            ) : null}
          </span>
        ))}
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open && (filtered.length > 0 || canAddCustom)}
          aria-controls={listId}
          aria-autocomplete="list"
          disabled={disabled}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              const t = query.trim().replace(/,$/, "");
              if (t) addTag(t);
            }
            if (e.key === "Backspace" && !query && value.length > 0) {
              removeTag(value[value.length - 1]!);
            }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={value.length === 0 ? placeholder : "Add another…"}
          className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none"
          autoComplete="off"
        />
      </div>
      {hint ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-black/50">{hint}</p>
      ) : null}
      {open && !disabled && (filtered.length > 0 || canAddCustom) ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto rounded-lg border border-black/15 bg-white py-1 shadow-lg"
        >
          {filtered.map((s) => (
            <li key={s}>
              <button
                type="button"
                role="option"
                onClick={() => addTag(s)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-muted/50"
              >
                {s}
              </button>
            </li>
          ))}
          {canAddCustom ? (
            <li>
              <button
                type="button"
                role="option"
                onClick={() => addTag(query.trim())}
                className="block w-full px-3 py-2 text-left text-sm text-brand hover:bg-brand-muted/50"
              >
                Add &ldquo;{query.trim()}&rdquo;
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
