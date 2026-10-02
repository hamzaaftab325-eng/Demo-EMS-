"use client";

import type { MouseEvent, ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function RequestSubmitButton({
  children,
  pendingLabel,
  className = "btn",
  name,
  value,
  confirmMessage,
}: {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
  name?: string;
  value?: string;
  confirmMessage?: string;
}) {
  const { pending, data } = useFormStatus();
  const submittedValue = name && data ? data.get(name) : null;
  const showPending =
    pending && (!name || value == null || submittedValue === value);

  function confirmAction(event: MouseEvent<HTMLButtonElement>) {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      event.preventDefault();
    }
  }

  return (
    <button
      className={className}
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={showPending}
      onClick={confirmAction}
    >
      {showPending ? pendingLabel : children}
    </button>
  );
}
