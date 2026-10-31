"use client";

type Props = {
  open: boolean;
  onToggle: () => void;
};

export function HandicaperMascot({ open, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border bg-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
        open ? "border-brand" : "border-line hover:border-brand"
      }`}
      title={open ? "Close Handicaper" : "Open Handicaper"}
      aria-label={open ? "Close Handicaper assistant" : "Open Handicaper assistant"}
      aria-expanded={open}
    >
      <span
        className="h-full w-full"
        style={{
          backgroundImage: "url(/brand/handicaper-idle.png)",
          backgroundRepeat: "no-repeat",
          backgroundSize: "160%",
          backgroundPosition: "48% 4%",
        }}
        aria-hidden
      />
    </button>
  );
}
