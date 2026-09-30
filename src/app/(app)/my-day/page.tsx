import { MyDayClient } from "@/components/my-day/my-day-client";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { requireCurrentProfile } from "@/lib/auth/current-profile";
import { getMyDayState } from "@/lib/my-day/state";

export default async function MyDayPage() {
  await requireCurrentProfile();
  const state = await getMyDayState();

  return (
    <>
      <RealtimeRefresh tables={["workdays", "employee_presence"]} />
      <MyDayClient state={state} />
    </>
  );
}
