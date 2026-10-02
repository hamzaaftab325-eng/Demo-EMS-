"use client";

import type { MouseEvent, ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function ManagementSubmitButton({
  children,
  pendingLabel,
  className = "btn",
  confirmMessage,
}: {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
  confirmMessage?: string;
}) {
  const { pending } = useFormStatus();

  function confirmAction(event: MouseEvent<HTMLButtonElement>) {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      event.preventDefault();
    }
  }

  return (
    <button
      className={className}
      type="submit"
      disabled={pending}
      aria-busy={pending}
      onClick={confirmAction}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
