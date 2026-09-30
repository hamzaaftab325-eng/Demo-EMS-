import { MyDayClient } from "@/components/my-day/my-day-client";\nimport { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { requireCurrentProfile } from "@/lib/auth/current-profile";
import { getMyDayState } from "@/lib/my-day/state";

export default async function MyDayPage() {
  await requireCurrentProfile();
  const state = await getMyDayState();

  return (\n    <>\n      <RealtimeRefresh tables={["workdays", "employee_presence"]} />\n      <MyDayClient state={state} />\n    </>\n  );
}
