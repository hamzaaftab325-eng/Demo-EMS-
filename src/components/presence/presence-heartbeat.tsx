"use client";

import { useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export function PresenceHeartbeat() {
  const supabase = useMemo(() => createClient(), []);
  const lastActivityAt = useRef(new Date().toISOString());

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let activityTimer: ReturnType<typeof setTimeout> | null = null;

    const sendHeartbeat = async () => {
      if (cancelled) return;

      await supabase.rpc("presence_heartbeat", {
        p_last_activity_at: lastActivityAt.current,
      });
    };

    const scheduleActivityHeartbeat = () => {
      if (cancelled) return;
      if (activityTimer) clearTimeout(activityTimer);

      activityTimer = setTimeout(() => {
        activityTimer = null;
        void sendHeartbeat();
      }, 750);
    };

    const markActivity = () => {
      lastActivityAt.current = new Date().toISOString();
      scheduleActivityHeartbeat();
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
      }
    };

    document.addEventListener("pointerdown", markActivity, { passive: true });
    document.addEventListener("keydown", markActivity);
    document.addEventListener("input", markActivity);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("scroll", markActivity, {
      passive: true,
      capture: true,
    });
    window.addEventListener("focus", markActivity);

    void start();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (activityTimer) clearTimeout(activityTimer);
      document.removeEventListener("pointerdown", markActivity);
      document.removeEventListener("keydown", markActivity);
      document.removeEventListener("input", markActivity);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("scroll", markActivity, true);
      window.removeEventListener("focus", markActivity);
    };
  }, [supabase]);

  return null;
}
