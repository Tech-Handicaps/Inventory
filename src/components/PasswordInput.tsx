"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordInputProps = Omit<
  React.ComponentPropsWithoutRef<"input">,
  "type"
>;

export function PasswordInput({
  className = "",
  id: idProp,
  ...props
}: PasswordInputProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative w-full">
      <input
        {...props}
        id={id}
        type={visible ? "text" : "password"}
        className={`${className} pr-10`.trim()}
      />
      <button
        type="button"
        onClick={() => setVisible((show) => !show)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-black/45 transition hover:bg-black/[0.04] hover:text-black/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        aria-controls={id}
        tabIndex={0}
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden />
        ) : (
          <Eye className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
