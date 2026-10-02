"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type RealtimeTable =
  | "employee_presence"
  | "workdays"
  | "requests"
  | "request_approvals"
  | "notifications"
  | "scrum_entries"
  | "scrum_items"
  | "scrum_entry_items"
  | "scrum_item_progress"
  | "scrum_obstacles";

export function RealtimeRefresh({
  tables,
}: {
  tables: RealtimeTable[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 250);
    };

    let channel = supabase.channel(
      `ems-live-${tables.join("-")}`,
    );

    for (const table of tables) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
        },
        refresh,
      );
    }

    channel.subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [router, supabase, tables]);

  return null;
}
