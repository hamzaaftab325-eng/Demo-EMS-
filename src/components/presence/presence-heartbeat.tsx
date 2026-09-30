"use client";

import { useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export function PresenceHeartbeat() {
  const supabase = useMemo(() => createClient(), []);
  const lastActivityAt = useRef(new Date().toISOString());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const markActivity = () => {
      lastActivityAt.current = new Date().toISOString();
    };

    const sendHeartbeat = async () => {
      if (cancelled) return;

      await supabase.rpc("presence_heartbeat", {
        p_last_activity_at: lastActivityAt.current,
      });
    };

    const start = async () => {
      await sendHeartbeat();

      const { data } = await supabase
        .from("company_settings")
        .select("heartbeat_interval_seconds")
        .eq("id", 1)
        .maybeSingle();

      if (cancelled) return;

      const seconds = Math.max(
        30,
        Math.min(300, data?.heartbeat_interval_seconds ?? 60),
      );

      timer = setInterval(() => {
        void sendHeartbeat();
      }, seconds * 1000);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        markActivity();
        void sendHeartbeat();
      }
    };

    document.addEventListener("click", markActivity, { passive: true });
    document.addEventListener("keydown", markActivity);
    document.addEventListener("visibilitychange", onVisibility);

    void start();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("click", markActivity);
      document.removeEventListener("keydown", markActivity);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [supabase]);

  return null;
}
