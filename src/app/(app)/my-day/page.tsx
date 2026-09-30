import { MyDayClient } from "@/components/my-day/my-day-client";
import { requireCurrentProfile } from "@/lib/auth/current-profile";
import { getMyDayState } from "@/lib/my-day/state";

export default async function MyDayPage() {
  await requireCurrentProfile();
  const state = await getMyDayState();

  return <MyDayClient state={state} />;
}
