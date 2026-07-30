"use client";

import { useEffect, useState } from "react";
import { DEFAULT_TAG_SUGGESTIONS } from "@/lib/inventory/asset-tags";

export function useAssetTagSuggestions(): {
  suggestions: string[];
  loading: boolean;
} {
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_TAG_SUGGESTIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/asset-tags")
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const list = data?.suggestions;
        if (Array.isArray(list) && list.length > 0) {
          setSuggestions(list.filter((t): t is string => typeof t === "string"));
        }
      })
      .catch(() => {
        /* keep defaults */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { suggestions, loading };
}
