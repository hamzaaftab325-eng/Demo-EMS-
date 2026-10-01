"use client";

import { useEffect } from "react";

const TRANSIENT_QUERY_KEYS = new Set([
  "error",
  "success",
  "created",
  "updated",
  "invite",
  "notice",
  "message",
]);

export function CleanTransientQuery() {
  useEffect(() => {
    const url = new URL(window.location.href);
    let changed = false;

    for (const key of TRANSIENT_QUERY_KEYS) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }

    if (!changed) return;

    const clean =
      url.pathname +
      (url.searchParams.size > 0 ? "?" + url.searchParams.toString() : "") +
      url.hash;

    window.history.replaceState(window.history.state, "", clean);
  }, []);

  return null;
}
