import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";

export type MyDayWorkdayStatus =
  Database["public"]["Enums"]["workday_status"];
export type MyDayIntervalType =
  Database["public"]["Enums"]["interval_type"];
export type MyDayIntervalStatus =
  Database["public"]["Enums"]["interval_status"];
export type MyDayItemSource =
  Database["public"]["Enums"]["scrum_item_source"];
export type MyDayTaskStatus =
  Database["public"]["Enums"]["scrum_task_status"];
export type MyDayObstacleStage =
  Database["public"]["Enums"]["obstacle_stage"];
export type MyDayObstacleStatus =
  Database["public"]["Enums"]["obstacle_status"];
export type MyDayAttendanceEvent =
  Database["public"]["Enums"]["attendance_event_type"];
export type MyDayPresenceStatus =
  Database["public"]["Enums"]["presence_status"];

export type MyDayCycleItem = {
  entryItemId: string;
  itemId: string;
  projectCode: string | null;
  title: string;
  description: string | null;
  source: MyDayItemSource;
  status: MyDayTaskStatus;
  startingPercent: number;
  currentPercent: number;
  finalPercent: number | null;
  signOffNote: string | null;
  carriedFromEntryItemId: string | null;
  addedAt: string;
};

export type MyDayCandidateItem = {
  itemId: string;
  projectCode: string | null;
  title: string;
  description: string | null;
  source: MyDayItemSource;
  status: MyDayTaskStatus;
  currentPercent: number;
  lastEntryItemId: string | null;
  origin: "backlog" | "carried_over" | "manager" | "active";
};

export type MyDayPreviousItem = {
  projectCode: string | null;
  title: string;
  finalPercent: number;
};

export type MyDayObstacle = {
  id: string;
  description: string;
  reportedStage: MyDayObstacleStage;
  status: MyDayObstacleStatus;
  reportedAt: string;
  resolutionNote: string | null;
};

export type MyDayInterval = {
  id: string;
  intervalType: MyDayIntervalType;
  status: MyDayIntervalStatus;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
};

export type MyDayEvent = {
  id: string;
  eventType: MyDayAttendanceEvent;
  occurredAt: string;
  source: string;
};

export type MyDayPresenceEvent = {
  id: string;
  status: MyDayPresenceStatus;
  startedAt: string;
  endedAt: string | null;
};

export type MyDayState = {
  workDate: string;
  timezone: string;
  snapshotAt: string;
  profile: {
    id: string;
    fullName: string;
    employeeCode: string;
    jobTitle: string | null;
    role: string;
  };
  settings: {
    requireScrumForSignin: boolean;
    requireScrumForSignoff: boolean;
  };
  schedule: {
    id: string;
    name: string;
    scheduleType: string;
    dailyTargetMinutes: number;
    startTime: string | null;
    endTime: string | null;
    coreStartTime: string | null;
    coreEndTime: string | null;
    timezone: string;
  } | null;
  workday: {
    id: string;
    status: MyDayWorkdayStatus;
    attendanceStatus: string | null;
    closedAt: string | null;
    createdAt: string;
    updatedAt: string;
    firstSignInAt: string | null;
    finalSignOffAt: string | null;
    scheduledMinutes: number;
    grossMinutes: number;
    breakMinutes: number;
    meetingMinutes: number;
    netWorkMinutes: number;
    lateMinutes: number;
    overtimeMinutes: number;
  } | null;
  scrumEntry: {
    id: string;
    status: "draft" | "signed_in" | "signed_off" | "reopened";
    signedInAt: string | null;
    signedOffAt: string | null;
  } | null;
  currentItems: MyDayCycleItem[];
  candidateItems: MyDayCandidateItem[];
  previousItems: MyDayPreviousItem[];
  obstacles: MyDayObstacle[];
  intervals: MyDayInterval[];
  attendanceEvents: MyDayEvent[];
  presenceEvents: MyDayPresenceEvent[];
  presence: {
    status: MyDayPresenceStatus;
    lastHeartbeatAt: string | null;
    lastActivityAt: string | null;
    tabConnected: boolean;
  } | null;
};

type Obj = Record<string, unknown>;

function obj(value: unknown): Obj {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Obj)
    : {};
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableStr(value: unknown) {
  return typeof value === "string" ? value : null;
}

function num(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function parseState(value: Json): MyDayState {
  const root = obj(value);
  const profile = obj(root.profile);
  const settings = obj(root.settings);
  const scheduleRaw = root.schedule == null ? null : obj(root.schedule);
  const workdayRaw = root.workday == null ? null : obj(root.workday);
  const scrumRaw = root.scrum_entry == null ? null : obj(root.scrum_entry);

  return {
    workDate: str(root.work_date),
    timezone: str(root.timezone, "Asia/Karachi"),
    snapshotAt: new Date().toISOString(),
    profile: {
      id: str(profile.id),
      fullName: str(profile.full_name),
      employeeCode: str(profile.employee_code),
      jobTitle: nullableStr(profile.job_title),
      role: str(profile.role),
    },
    settings: {
      requireScrumForSignin: bool(settings.require_scrum_for_signin, true),
      requireScrumForSignoff: bool(settings.require_scrum_for_signoff, true),
    },
    schedule: scheduleRaw
      ? {
          id: str(scheduleRaw.id),
          name: str(scheduleRaw.name),
          scheduleType: str(scheduleRaw.schedule_type),
          dailyTargetMinutes: num(scheduleRaw.daily_target_minutes, 480),
          startTime: nullableStr(scheduleRaw.start_time),
          endTime: nullableStr(scheduleRaw.end_time),
          coreStartTime: nullableStr(scheduleRaw.core_start_time),
          coreEndTime: nullableStr(scheduleRaw.core_end_time),
          timezone: str(scheduleRaw.timezone, "Asia/Karachi"),
        }
      : null,
    workday: workdayRaw
      ? {
          id: str(workdayRaw.id),
          status: str(workdayRaw.status, "not_started") as MyDayWorkdayStatus,
          attendanceStatus: nullableStr(workdayRaw.attendance_status),
          closedAt: nullableStr(workdayRaw.closed_at),
          createdAt: str(workdayRaw.created_at),
          updatedAt: str(workdayRaw.updated_at),
          firstSignInAt: nullableStr(workdayRaw.first_sign_in_at),
          finalSignOffAt: nullableStr(workdayRaw.final_sign_off_at),
          scheduledMinutes: num(workdayRaw.scheduled_minutes),
          grossMinutes: num(workdayRaw.gross_minutes),
          breakMinutes: num(workdayRaw.break_minutes),
          meetingMinutes: num(workdayRaw.meeting_minutes),
          netWorkMinutes: num(workdayRaw.net_work_minutes),
          lateMinutes: num(workdayRaw.late_minutes),
          overtimeMinutes: num(workdayRaw.overtime_minutes),
        }
      : null,
    scrumEntry: scrumRaw
      ? {
          id: str(scrumRaw.id),
          status: str(scrumRaw.status, "draft") as MyDayState["scrumEntry"] extends infer T
            ? T extends { status: infer S }
              ? S
              : never
            : never,
          signedInAt: nullableStr(scrumRaw.signed_in_at),
          signedOffAt: nullableStr(scrumRaw.signed_off_at),
        }
      : null,
    currentItems: list(root.current_items).map((value) => {
      const row = obj(value);
      return {
        entryItemId: str(row.entry_item_id),
        itemId: str(row.item_id),
        projectCode: nullableStr(row.project_code),
        title: str(row.title),
        description: nullableStr(row.description),
        source: str(row.source, "employee") as MyDayItemSource,
        status: str(row.status, "active") as MyDayTaskStatus,
        startingPercent: num(row.starting_percent),
        currentPercent: num(row.current_percent),
        finalPercent:
          row.final_percent == null ? null : num(row.final_percent),
        signOffNote: nullableStr(row.sign_off_note),
        carriedFromEntryItemId: nullableStr(row.carried_from_entry_item_id),
        addedAt: str(row.added_at),
      };
    }),
    candidateItems: list(root.candidate_items).map((value) => {
      const row = obj(value);
      return {
        itemId: str(row.item_id),
        projectCode: nullableStr(row.project_code),
        title: str(row.title),
        description: nullableStr(row.description),
        source: str(row.source, "employee") as MyDayItemSource,
        status: str(row.status, "backlog") as MyDayTaskStatus,
        currentPercent: num(row.current_percent),
        lastEntryItemId: nullableStr(row.last_entry_item_id),
        origin: str(row.origin, "active") as MyDayCandidateItem["origin"],
      };
    }),
    previousItems: list(root.previous_items).map((value) => {
      const row = obj(value);
      return {
        projectCode: nullableStr(row.project_code),
        title: str(row.title),
        finalPercent: num(row.final_percent),
      };
    }),
    obstacles: list(root.obstacles).map((value) => {
      const row = obj(value);
      return {
        id: str(row.id),
        description: str(row.description),
        reportedStage: str(row.reported_stage, "during_day") as MyDayObstacleStage,
        status: str(row.status, "open") as MyDayObstacleStatus,
        reportedAt: str(row.reported_at),
        resolutionNote: nullableStr(row.resolution_note),
      };
    }),
    intervals: list(root.intervals).map((value) => {
      const row = obj(value);
      return {
        id: str(row.id),
        intervalType: str(row.interval_type, "break") as MyDayIntervalType,
        status: str(row.status, "completed") as MyDayIntervalStatus,
        startedAt: str(row.started_at),
        endedAt: nullableStr(row.ended_at),
        notes: nullableStr(row.notes),
      };
    }),
    attendanceEvents: list(root.attendance_events).map((value) => {
      const row = obj(value);
      return {
        id: str(row.id),
        eventType: str(row.event_type, "sign_in") as MyDayAttendanceEvent,
        occurredAt: str(row.occurred_at),
        source: str(row.source, "ems"),
      };
    }),
    presenceEvents: [],
    presence: null,
  };
}

export async function getMyDayState() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_day_get_state");

  if (error || !data) {
    throw new Error(error?.message ?? "Could not load My Day.");
  }

  const state = parseState(data);

  const [
    { data: attendance, error: attendanceError },
    { data: presence, error: presenceError },
    { data: presenceEvents, error: presenceEventsError },
  ] = await Promise.all([
    state.workday?.id
      ? supabase
          .from("workdays")
          .select(
            "first_sign_in_at, final_sign_off_at, scheduled_minutes, gross_minutes, break_minutes, meeting_minutes, net_work_minutes, late_minutes, overtime_minutes",
          )
          .eq("id", state.workday.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("employee_presence")
      .select(
        "status, last_heartbeat_at, last_activity_at, tab_connected",
      )
      .eq("employee_id", state.profile.id)
      .maybeSingle(),
    state.workday?.id
      ? supabase
          .from("presence_events")
          .select("id, status, started_at, ended_at")
          .eq("workday_id", state.workday.id)
          .order("started_at")
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (attendanceError) {
    throw new Error("Could not load today's attendance totals.");
  }

  if (presenceError) {
    throw new Error("Could not load your current presence.");
  }

  if (presenceEventsError) {
    throw new Error("Could not load your presence timeline.");
  }

  if (state.workday && attendance) {
    state.workday.firstSignInAt = attendance.first_sign_in_at;
    state.workday.finalSignOffAt = attendance.final_sign_off_at;
    state.workday.scheduledMinutes = attendance.scheduled_minutes;
    state.workday.grossMinutes = attendance.gross_minutes;
    state.workday.breakMinutes = attendance.break_minutes;
    state.workday.meetingMinutes = attendance.meeting_minutes;
    state.workday.netWorkMinutes = attendance.net_work_minutes;
    state.workday.lateMinutes = attendance.late_minutes;
    state.workday.overtimeMinutes = attendance.overtime_minutes;
  }

  state.presenceEvents = (presenceEvents ?? []).map((event) => ({
    id: event.id,
    status: event.status,
    startedAt: event.started_at,
    endedAt: event.ended_at,
  }));

  state.presence = presence
    ? {
        status: presence.status,
        lastHeartbeatAt: presence.last_heartbeat_at,
        lastActivityAt: presence.last_activity_at,
        tabConnected: presence.tab_connected,
      }
    : null;

  return state;
}
