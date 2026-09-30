"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-2xl border border-red-200 bg-white p-6">
      <p className="text-sm font-semibold text-red-700">
        Something went wrong
      </p>
      <p className="mt-2 text-sm text-slate-600">
        The EMS could not render this page. Try again before reporting the
        issue.
      </p>
      <Button className="mt-5" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
