"use client";

import { useEffect } from "react";

/**
 * Replaces the root layout when it fails. Must include its own html/body.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("app/global-error", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#f5f5f5",
          color: "#000",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <main style={{ maxWidth: 480 }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: "#52525b", marginBottom: 16 }}>
            A critical error occurred. Please try again.
          </p>
          {error.digest ? (
            <p style={{ fontSize: 12, color: "#a1a1aa", fontFamily: "monospace" }}>
              Ref: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              background: "#139d4b",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
