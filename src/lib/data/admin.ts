import { createClient } from "@/lib/supabase/server";
import type { CurrentProfile } from "@/lib/auth/current-profile";
import type { Database, Json } from "@/types/database";

type CompanySettingsRow =
  Database["public"]["Tables"]["company_settings"]["Row"];
type WorkScheduleRow =
  Database["public"]["Tables"]["work_schedules"]["Row"];
type HolidayRow = Database["public"]["Tables"]["holidays"]["Row"];
type LeaveTypeRow = Database["public"]["Tables"]["leave_types"]["Row"];

export type AdminSchedule = WorkScheduleRow & {
  requestGenerated: boolean;
};

export type AdminHoliday = HolidayRow & {
  departmentName: string | null;
};

export type AdminSettingsData = {
  settings: CompanySettingsRow;
  schedules: AdminSchedule[];
  holidays: AdminHoliday[];
  leaveTypes: LeaveTypeRow[];
  departments: Array<{
    id: string;
    name: string;
    code: string;
    isActive: boolean;
  }>;
};

export type AuditRow = {
  id: number;
  actorId: string | null;
  actorName: string | null;
  actorCode: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeData: Json | null;
  afterData: Json | null;
  reason: string | null;
  createdAt: string;
};

export type AuditActor = {
  id: string;
  fullName: string;
  employeeCode: string;
};

export type AuditSearchResult = {
  total: number;
  rows: AuditRow[];
  actors: AuditActor[];
};

type Obj = Record<string, unknown>;

function object(value: unknown): Obj {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Obj)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function getAdminSettingsData(): Promise<AdminSettingsData> {
  const supabase = await createClient();

  const [
    settingsResult,
    schedulesResult,
    holidaysResult,
    leaveTypesResult,
    departmentsResult,
    requestSchedulesResult,
  ] = await Promise.all([
    supabase.from("company_settings").select("*").eq("id", 1).single(),
    supabase
      .from("work_schedules")
      .select("*")
      .order("is_active", { ascending: false })
      .order("name"),
    supabase
      .from("holidays")
      .select("*")
      .order("holiday_date", { ascending: true })
      .order("name"),
    supabase
      .from("leave_types")
      .select("*")
      .order("is_active", { ascending: false })
      .order("name"),
    supabase
      .from("departments")
      .select("id, name, code, is_active")
      .order("sort_order")
      .order("name"),
    supabase
      .from("schedule_change_details")
      .select("applied_schedule_id")
      .not("applied_schedule_id", "is", null),
  ]);

  if (
    settingsResult.error ||
    schedulesResult.error ||
    holidaysResult.error ||
    leaveTypesResult.error ||
    departmentsResult.error ||
    requestSchedulesResult.error
  ) {
    throw new Error("Could not load Phase 8 admin settings.");
  }

  const requestScheduleIds = new Set(
    (requestSchedulesResult.data ?? [])
      .map((row) => row.applied_schedule_id)
      .filter((id): id is string => Boolean(id)),
  );
  const departments = (departmentsResult.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    isActive: row.is_active,
  }));
  const departmentMap = new Map(
    departments.map((department) => [department.id, department.name]),
  );

  return {
    settings: settingsResult.data,
    schedules: (schedulesResult.data ?? []).map((row) => ({
      ...row,
      requestGenerated: requestScheduleIds.has(row.id),
    })),
    holidays: (holidaysResult.data ?? []).map((row) => ({
      ...row,
      departmentName: row.department_id
        ? departmentMap.get(row.department_id) ?? "Unknown department"
        : null,
    })),
    leaveTypes: leaveTypesResult.data ?? [],
    departments,
  };
}

export async function getAuditSearch(
  profile: CurrentProfile,
  filters: {
    query?: string;
    action?: string;
    entityType?: string;
    actorId?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<AuditSearchResult> {
  const supabase = await createClient();
  const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 1), 100);
  const page = Math.max(filters.page ?? 1, 1);
  const offset = (page - 1) * pageSize;

  const [auditResult, actorsResult] = await Promise.all([
    supabase.rpc("phase8_audit_search", {
      p_query: filters.query || undefined,
      p_action: filters.action || undefined,
      p_entity_type: filters.entityType || undefined,
      p_actor_id: filters.actorId || undefined,
      p_from_date: filters.fromDate || undefined,
      p_to_date: filters.toDate || undefined,
      p_limit: pageSize,
      p_offset: offset,
    }),
    supabase
      .from("profiles")
      .select("id, full_name, employee_code, is_test_account")
      .eq("is_test_account", profile.is_test_account)
      .order("full_name"),
  ]);

  if (auditResult.error) {
    throw new Error("Could not load the audit log.");
  }

  if (actorsResult.error) {
    throw new Error("Could not load audit actors.");
  }

  const root = object(auditResult.data);
  const rawRows = Array.isArray(root.rows) ? root.rows : [];

  return {
    total: numberValue(root.total),
    rows: rawRows.map((value) => {
      const row = object(value);

      return {
        id: numberValue(row.id),
        actorId: stringValue(row.actor_id),
        actorName: stringValue(row.actor_name),
        actorCode: stringValue(row.actor_code),
        action: stringValue(row.action) ?? "unknown",
        entityType: stringValue(row.entity_type) ?? "unknown",
        entityId: stringValue(row.entity_id),
        beforeData: (row.before_data ?? null) as Json | null,
        afterData: (row.after_data ?? null) as Json | null,
        reason: stringValue(row.reason),
        createdAt: stringValue(row.created_at) ?? new Date(0).toISOString(),
      };
    }),
    actors: (actorsResult.data ?? []).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      employeeCode: row.employee_code,
    })),
  };
}
