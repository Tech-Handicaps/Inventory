"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { HardwareCaptureForm } from "@/components/HardwareCaptureForm";
import { useToast } from "@/components/ToastProvider";
import { ADD_HARDWARE_EVENT, HARDWARE_CREATED_EVENT } from "@/lib/client/add-hardware";

/**
 * Global Add hardware dialog, mounted once in the app shell. Opens on ADD_HARDWARE_EVENT and
 * locks page scroll while open so the shell never moves underneath it.
 */
export function AddHardwareModal() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    returnFocusRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onOpen = () => {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      setFormKey((k) => k + 1);
      setOpen(true);
    };
    window.addEventListener(ADD_HARDWARE_EVENT, onOpen);
    return () => window.removeEventListener(ADD_HARDWARE_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="add-hardware-title"
    >
      <button
        type="button"
        tabIndex={-1}
        className="absolute inset-0 bg-black/40"
        aria-label="Close Add hardware"
        onClick={close}
      />
      <div className="relative flex max-h-[100dvh] w-full max-w-4xl flex-col overflow-hidden border border-line bg-white sm:max-h-[min(90dvh,860px)] sm:rounded-lg">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-6 py-4">
          <h2 id="add-hardware-title" className="font-heading text-lg font-semibold text-ink">
            Add hardware
          </h2>
          <button
            type="button"
            onClick={close}
            className="rounded-md p-1.5 text-ink hover:bg-black/[0.05]"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <HardwareCaptureForm
          key={formKey}
          statuses={[]}
          onCancel={close}
          onCreated={() => {
            toast.showSuccess("Hardware added to the board.");
            window.dispatchEvent(new Event(HARDWARE_CREATED_EVENT));
            close();
          }}
        />
      </div>
    </div>
  );
}
