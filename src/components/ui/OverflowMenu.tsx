"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useRef } from "react";

export type OverflowMenuItem = {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

type Props = {
  /** Names the row or card for screen readers, e.g. the asset name. */
  label: string;
  items: OverflowMenuItem[];
  disabled?: boolean;
};

/**
 * Rendered in a portal so table and card wrappers with overflow can't clip it; flips up or left
 * near the viewport edge. Esc closes and returns focus to the trigger.
 */
export function OverflowMenu({ label, items, disabled }: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemChosen = useRef(false);

  /** After an item opens a dialog or panel, leave focus there instead of pulling it back to the trigger. */
  function onCloseAutoFocus(e: Event) {
    if (!itemChosen.current) return;
    itemChosen.current = false;
    e.preventDefault();
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body) triggerRef.current?.focus();
    });
  }

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        ref={triggerRef}
        disabled={disabled}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-black/[0.06] hover:text-ink focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50 data-[state=open]:bg-black/[0.06] data-[state=open]:text-ink"
        aria-label={`More actions for ${label}`}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          side="bottom"
          sideOffset={4}
          collisionPadding={8}
          avoidCollisions
          aria-label={`Actions for ${label}`}
          onClick={(e) => e.stopPropagation()}
          onCloseAutoFocus={onCloseAutoFocus}
          className="z-[55] min-w-[9rem] rounded-lg border border-[#e5e9ec] bg-white py-1 shadow-sm"
        >
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              disabled={item.disabled}
              onSelect={() => {
                itemChosen.current = true;
                item.onSelect();
              }}
              className={`block w-full cursor-pointer px-3 py-2 text-left text-sm outline-none data-[disabled]:cursor-default data-[disabled]:opacity-50 ${
                item.destructive
                  ? "text-red-700 data-[highlighted]:bg-red-50"
                  : "text-ink data-[highlighted]:bg-black/[0.04]"
              }`}
            >
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
