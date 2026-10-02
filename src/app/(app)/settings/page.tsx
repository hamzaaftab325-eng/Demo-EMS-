import Link from "next/link";
import { PageHead, StatusPill } from "@/components/shared/prototype";
import { RequestSubmitButton } from "@/components/requests/request-submit-button";
import { AdminScheduleFields } from "@/components/admin/admin-schedule-fields";
import { AdminHolidayScopeFields } from "@/components/admin/admin-holiday-scope-fields";
import { requireRole } from "@/lib/auth/current-profile";
import { getAdminSettingsData } from "@/lib/data/admin";
import { ADMIN_ROLES } from "@/lib/navigation";
import {
  deleteHoliday,
  saveHoliday,
  saveLeaveType,
  saveSchedule,
  setLeaveTypeActive,
  setScheduleActive,
  updateCompanySettings,
} from "./actions";

type Tab = "general" | "schedules" | "holidays" | "leave-types";

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function tabValue(value: string | undefined): Tab {
  return value === "schedules" ||
    value === "holidays" ||
    value === "leave-types"
    ? value
    : "general";
}

function settingsHref(tab: Tab, key?: string, value?: string) {
  const params = new URLSearchParams({ tab });
  if (key && value) params.set(key, value);
  return "/settings?" + params.toString();
}

function minutesLabel(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (!hours) return value + "m";
  if (!minutes) return hours + "h";
  return hours + "h " + minutes + "m";
}

function scheduleDetail(schedule: {
  schedule_type: "fixed" | "flexible" | "flexible_core";
  start_time: string | null;
  end_time: string | null;
  core_start_time: string | null;
  core_end_time: string | null;
  daily_target_minutes: number;
}) {
  if (schedule.schedule_type === "fixed") {
    return `${schedule.start_time?.slice(0, 5) ?? "—"}–${schedule.end_time?.slice(0, 5) ?? "—"} · ${minutesLabel(schedule.daily_target_minutes)}`;
  }

  if (schedule.schedule_type === "flexible_core") {
    return `Core ${schedule.core_start_time?.slice(0, 5) ?? "—"}–${schedule.core_end_time?.slice(0, 5) ?? "—"} · ${minutesLabel(schedule.daily_target_minutes)}`;
  }

  return "Flexible · " + minutesLabel(schedule.daily_target_minutes);
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(ADMIN_ROLES);
  const params = await searchParams;
  const tab = tabValue(single(params.tab));
  const success = single(params.success);
  const error = single(params.error);
  const data = await getAdminSettingsData();

  const editSchedule = data.schedules.find(
    (schedule) =>
      schedule.id === single(params.schedule) && !schedule.requestGenerated,
  );
  const editHoliday = data.holidays.find(
    (holiday) => holiday.id === single(params.holiday),
  );
  const editLeaveType = data.leaveTypes.find(
    (leaveType) => leaveType.id === single(params.leave),
  );

  return (
    <>
      <PageHead
        title="Settings"
        subtitle="Company-wide EMS defaults and policy configuration"
        actions={
          <Link className="btn" href="/audit">
            Audit log
          </Link>
        }
      />

      {success ? (
        <div
          className="request-notice request-notice-success"
          role="status"
          aria-live="polite"
        >
          {success}
        </div>
      ) : null}

      {error ? (
        <div
          className="request-notice request-notice-error"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </div>
      ) : null}

      <nav className="admin-tabs" aria-label="Settings sections">
        {[
          ["general", "Company"],
          ["schedules", "Work schedules"],
          ["holidays", "Holidays"],
          ["leave-types", "Leave types"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={settingsHref(value as Tab)}
            className={tab === value ? "on" : undefined}
            aria-current={tab === value ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "general" ? (
        <section className="card admin-settings-card">
          <div className="hd">
            <div>
              <h2>Company settings</h2>
              <p className="mut">
                These values drive presence, attendance, Scrum and request
                behavior across EMS.
              </p>
            </div>
          </div>
          <form action={updateCompanySettings} className="bd admin-settings-form">
            <div className="admin-form-grid">
              <label className="f">
                <span>Company name *</span>
                <input
                  name="company_name"
                  defaultValue={data.settings.company_name}
                  required
                />
              </label>
              <label className="f">
                <span>Company timezone *</span>
                <input
                  name="timezone"
                  defaultValue={data.settings.timezone}
                  placeholder="Asia/Karachi"
                  required
                />
              </label>
              <label className="f">
                <span>Default schedule</span>
                <select
                  name="default_schedule_id"
                  defaultValue={data.settings.default_schedule_id ?? ""}
                >
                  <option value="">No default schedule</option>
                  {data.schedules
                    .filter(
                      (schedule) =>
                        schedule.is_active && !schedule.requestGenerated,
                    )
                    .map((schedule) => (
                      <option value={schedule.id} key={schedule.id}>
                        {schedule.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="f">
                <span>Default target minutes *</span>
                <input
                  type="number"
                  name="default_daily_target_minutes"
                  min={1}
                  max={1440}
                  defaultValue={data.settings.default_daily_target_minutes}
                  required
                />
              </label>
              <label className="f">
                <span>Grace period (minutes) *</span>
                <input
                  type="number"
                  name="grace_period_minutes"
                  min={0}
                  max={240}
                  defaultValue={data.settings.grace_period_minutes}
                  required
                />
              </label>
              <label className="f">
                <span>Heartbeat interval (seconds) *</span>
                <input
                  type="number"
                  name="heartbeat_interval_seconds"
                  min={30}
                  max={300}
                  defaultValue={data.settings.heartbeat_interval_seconds}
                  required
                />
              </label>
              <label className="f">
                <span>Idle after (minutes) *</span>
                <input
                  type="number"
                  name="presence_idle_minutes"
                  min={1}
                  max={120}
                  defaultValue={data.settings.presence_idle_minutes}
                  required
                />
              </label>
              <label className="f">
                <span>Away after (minutes) *</span>
                <input
                  type="number"
                  name="presence_away_minutes"
                  min={2}
                  max={480}
                  defaultValue={data.settings.presence_away_minutes}
                  required
                />
              </label>
              <label className="f">
                <span>Heartbeat stale after (minutes) *</span>
                <input
                  type="number"
                  name="heartbeat_stale_minutes"
                  min={2}
                  max={30}
                  defaultValue={data.settings.heartbeat_stale_minutes}
                  required
                />
              </label>
              <label className="f">
                <span>Auto sign-off after (minutes) *</span>
                <input
                  type="number"
                  name="auto_signoff_idle_minutes"
                  min={15}
                  max={1440}
                  defaultValue={data.settings.auto_signoff_idle_minutes}
                  required
                />
              </label>
            </div>

            <div className="admin-policy-grid">
              <label className="request-check admin-check">
                <input
                  type="checkbox"
                  name="require_scrum_for_signin"
                  defaultChecked={data.settings.require_scrum_for_signin}
                />
                <span>Require Scrum items before sign-in</span>
              </label>
              <label className="request-check admin-check">
                <input
                  type="checkbox"
                  name="require_scrum_for_signoff"
                  defaultChecked={data.settings.require_scrum_for_signoff}
                />
                <span>Require Scrum completion before sign-off</span>
              </label>
              <label className="request-check admin-check">
                <input
                  type="checkbox"
                  name="require_final_request_approval"
                  defaultChecked={
                    data.settings.require_final_request_approval
                  }
                />
                <span>Require final request approval</span>
              </label>
            </div>

            <label className="f">
              <span>Audit note</span>
              <input
                name="reason"
                placeholder="Optional reason for this settings change"
              />
            </label>

            <RequestSubmitButton
              className="btn pri"
              pendingLabel="Saving settings…"
              confirmMessage="Apply these company-wide EMS settings?"
            >
              Save company settings
            </RequestSubmitButton>
          </form>
        </section>
      ) : null}

      {tab === "schedules" ? (
        <div className="admin-settings-layout">
          <section className="card">
            <div className="hd">
              <div>
                <h2>{editSchedule ? "Edit schedule" : "New schedule"}</h2>
                <p className="mut">
                  Fixed, fully flexible and flexible-core schedules use the
                  same calculations as Attendance.
                </p>
              </div>
              {editSchedule ? (
                <Link className="btn ghost" href={settingsHref("schedules")}>
                  Cancel edit
                </Link>
              ) : null}
            </div>

            <form action={saveSchedule} className="bd admin-stack-form">
              <input
                type="hidden"
                name="schedule_id"
                value={editSchedule?.id ?? ""}
              />
              <label className="f">
                <span>Name *</span>
                <input
                  name="name"
                  defaultValue={editSchedule?.name ?? ""}
                  required
                />
              </label>

              <AdminScheduleFields
                initialType={editSchedule?.schedule_type ?? "fixed"}
                startTime={editSchedule?.start_time}
                endTime={editSchedule?.end_time}
                coreStartTime={editSchedule?.core_start_time}
                coreEndTime={editSchedule?.core_end_time}
              />

              <div className="admin-inline-pair">
                <label className="f">
                  <span>Daily target minutes *</span>
                  <input
                    type="number"
                    name="daily_target_minutes"
                    min={1}
                    max={1440}
                    defaultValue={editSchedule?.daily_target_minutes ?? 480}
                    required
                  />
                </label>
                <label className="f">
                  <span>Grace minutes *</span>
                  <input
                    type="number"
                    name="grace_minutes"
                    min={0}
                    max={240}
                    defaultValue={editSchedule?.grace_minutes ?? 15}
                    required
                  />
                </label>
              </div>

              <label className="f">
                <span>Timezone *</span>
                <input
                  name="timezone"
                  defaultValue={editSchedule?.timezone ?? data.settings.timezone}
                  required
                />
              </label>

              <label className="f">
                <span>Audit note</span>
                <input
                  name="reason"
                  placeholder="Optional reason for this schedule change"
                />
              </label>

              <RequestSubmitButton
                className="btn pri"
                pendingLabel={editSchedule ? "Updating…" : "Creating…"}
              >
                {editSchedule ? "Update schedule" : "Create schedule"}
              </RequestSubmitButton>
            </form>
          </section>

          <section className="card">
            <div className="hd">
              <div>
                <h2>Schedules</h2>
                <p className="mut">
                  Request-generated schedules are preserved as workflow history.
                </p>
              </div>
              <span className="request-count">{data.schedules.length}</span>
            </div>
            <div className="bd admin-record-list">
              {data.schedules.map((schedule) => (
                <article className="admin-record" key={schedule.id}>
                  <div>
                    <div className="admin-record-title">
                      <strong>{schedule.name}</strong>
                      {schedule.requestGenerated ? (
                        <StatusPill label="Workflow" tone="meeting" />
                      ) : schedule.is_active ? (
                        <StatusPill label="Active" tone="active" />
                      ) : (
                        <StatusPill label="Inactive" tone="offline" />
                      )}
                    </div>
                    <span className="mut">
                      {scheduleDetail(schedule)} · {schedule.timezone}
                    </span>
                  </div>

                  <div className="admin-record-actions">
                    {!schedule.requestGenerated ? (
                      <Link
                        className="btn ghost"
                        href={settingsHref(
                          "schedules",
                          "schedule",
                          schedule.id,
                        )}
                      >
                        Edit
                      </Link>
                    ) : null}

                    {!schedule.requestGenerated ? (
                      <form action={setScheduleActive}>
                        <input
                          type="hidden"
                          name="schedule_id"
                          value={schedule.id}
                        />
                        <input
                          type="hidden"
                          name="is_active"
                          value={schedule.is_active ? "false" : "true"}
                        />
                        <RequestSubmitButton
                          className="btn ghost"
                          pendingLabel="Updating…"
                          confirmMessage={
                            schedule.is_active
                              ? "Deactivate this schedule? It will no longer be offered for new assignments."
                              : "Activate this schedule?"
                          }
                        >
                          {schedule.is_active ? "Deactivate" : "Activate"}
                        </RequestSubmitButton>
                      </form>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "holidays" ? (
        <div className="admin-settings-layout">
          <section className="card">
            <div className="hd">
              <div>
                <h2>{editHoliday ? "Edit holiday" : "New holiday"}</h2>
                <p className="mut">
                  Holidays are consumed by both Attendance and leave working-day
                  calculations.
                </p>
              </div>
              {editHoliday ? (
                <Link className="btn ghost" href={settingsHref("holidays")}>
                  Cancel edit
                </Link>
              ) : null}
            </div>

            <form action={saveHoliday} className="bd admin-stack-form">
              <input
                type="hidden"
                name="holiday_id"
                value={editHoliday?.id ?? ""}
              />
              <label className="f">
                <span>Name *</span>
                <input
                  name="name"
                  defaultValue={editHoliday?.name ?? ""}
                  required
                />
              </label>
              <div className="admin-inline-pair">
                <label className="f">
                  <span>Date *</span>
                  <input
                    type="date"
                    name="holiday_date"
                    defaultValue={editHoliday?.holiday_date ?? ""}
                    required
                  />
                </label>
                <label className="f">
                  <span>Country code</span>
                  <input
                    name="country_code"
                    maxLength={2}
                    defaultValue={editHoliday?.country_code ?? ""}
                    placeholder="PK"
                  />
                </label>
              </div>

              <AdminHolidayScopeFields
                departments={data.departments}
                initialCompanyWide={
                  editHoliday?.is_company_wide ?? true
                }
                initialDepartmentId={editHoliday?.department_id}
              />

              <label className="f">
                <span>Audit note</span>
                <input
                  name="reason"
                  placeholder="Optional reason for this holiday change"
                />
              </label>

              <RequestSubmitButton
                className="btn pri"
                pendingLabel={editHoliday ? "Updating…" : "Creating…"}
              >
                {editHoliday ? "Update holiday" : "Add holiday"}
              </RequestSubmitButton>
            </form>
          </section>

          <section className="card">
            <div className="hd">
              <div>
                <h2>Holiday calendar</h2>
                <p className="mut">
                  Past holidays remain protected so attendance history does not
                  drift.
                </p>
              </div>
              <span className="request-count">{data.holidays.length}</span>
            </div>
            <div className="bd admin-record-list">
              {data.holidays.map((holiday) => (
                <article className="admin-record" key={holiday.id}>
                  <div>
                    <div className="admin-record-title">
                      <strong>{holiday.name}</strong>
                      <StatusPill
                        label={
                          holiday.is_company_wide
                            ? "Company-wide"
                            : holiday.departmentName ?? "Department"
                        }
                        tone={holiday.is_company_wide ? "active" : "meeting"}
                      />
                    </div>
                    <span className="mut">
                      {holiday.holiday_date}
                      {holiday.country_code
                        ? " · " + holiday.country_code
                        : ""}
                    </span>
                  </div>
                  <div className="admin-record-actions">
                    <Link
                      className="btn ghost"
                      href={settingsHref("holidays", "holiday", holiday.id)}
                    >
                      Edit
                    </Link>
                    <form action={deleteHoliday}>
                      <input
                        type="hidden"
                        name="holiday_id"
                        value={holiday.id}
                      />
                      <RequestSubmitButton
                        className="btn danger"
                        pendingLabel="Deleting…"
                        confirmMessage="Delete this holiday? Past holidays are protected and cannot be removed."
                      >
                        Delete
                      </RequestSubmitButton>
                    </form>
                  </div>
                </article>
              ))}

              {data.holidays.length === 0 ? (
                <div className="request-empty">
                  <strong>No holidays configured.</strong>
                  <span className="mut">
                    Add company-wide or department holidays here.
                  </span>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {tab === "leave-types" ? (
        <div className="admin-settings-layout">
          <section className="card">
            <div className="hd">
              <div>
                <h2>{editLeaveType ? "Edit leave type" : "New leave type"}</h2>
                <p className="mut">
                  Inactive leave types remain available to historical requests
                  and ledger records.
                </p>
              </div>
              {editLeaveType ? (
                <Link className="btn ghost" href={settingsHref("leave-types")}>
                  Cancel edit
                </Link>
              ) : null}
            </div>

            <form action={saveLeaveType} className="bd admin-stack-form">
              <input
                type="hidden"
                name="leave_type_id"
                value={editLeaveType?.id ?? ""}
              />
              <div className="admin-inline-pair">
                <label className="f">
                  <span>Code *</span>
                  <input
                    name="code"
                    defaultValue={editLeaveType?.code ?? ""}
                    pattern="[a-z0-9][a-z0-9_-]{1,31}"
                    placeholder="annual"
                    required
                  />
                </label>
                <label className="f">
                  <span>Name *</span>
                  <input
                    name="name"
                    defaultValue={editLeaveType?.name ?? ""}
                    required
                  />
                </label>
              </div>

              <label className="f">
                <span>Default annual entitlement</span>
                <input
                  type="number"
                  name="default_annual_days"
                  min={0}
                  max={366}
                  step="0.5"
                  defaultValue={editLeaveType?.default_annual_days ?? ""}
                  placeholder="Blank = no default quota"
                />
              </label>

              <div className="admin-policy-grid">
                <label className="request-check admin-check">
                  <input
                    type="checkbox"
                    name="is_paid"
                    defaultChecked={editLeaveType?.is_paid ?? true}
                  />
                  <span>Paid leave</span>
                </label>
                <label className="request-check admin-check">
                  <input
                    type="checkbox"
                    name="requires_reason"
                    defaultChecked={editLeaveType?.requires_reason ?? false}
                  />
                  <span>Reason is required</span>
                </label>
              </div>

              {editLeaveType?.requires_attachment ? (
                <div className="request-notice">
                  This historical leave type already requires an attachment.
                  Phase 8 preserves that flag but does not alter document
                  requirements.
                </div>
              ) : null}

              <label className="f">
                <span>Audit note</span>
                <input
                  name="reason"
                  placeholder="Optional reason for this leave policy change"
                />
              </label>

              <RequestSubmitButton
                className="btn pri"
                pendingLabel={editLeaveType ? "Updating…" : "Creating…"}
              >
                {editLeaveType ? "Update leave type" : "Create leave type"}
              </RequestSubmitButton>
            </form>
          </section>

          <section className="card">
            <div className="hd">
              <div>
                <h2>Leave types</h2>
                <p className="mut">
                  Deactivation stops new requests without deleting history.
                </p>
              </div>
              <span className="request-count">{data.leaveTypes.length}</span>
            </div>

            <div className="bd admin-record-list">
              {data.leaveTypes.map((leaveType) => (
                <article className="admin-record" key={leaveType.id}>
                  <div>
                    <div className="admin-record-title">
                      <strong>{leaveType.name}</strong>
                      <StatusPill
                        label={leaveType.is_active ? "Active" : "Inactive"}
                        tone={leaveType.is_active ? "active" : "offline"}
                      />
                    </div>
                    <span className="mut">
                      {leaveType.code} ·{" "}
                      {leaveType.is_paid ? "Paid" : "Unpaid"} ·{" "}
                      {leaveType.default_annual_days == null
                        ? "No default quota"
                        : leaveType.default_annual_days + " days/year"}
                      {leaveType.requires_reason ? " · Reason required" : ""}
                    </span>
                  </div>

                  <div className="admin-record-actions">
                    <Link
                      className="btn ghost"
                      href={settingsHref(
                        "leave-types",
                        "leave",
                        leaveType.id,
                      )}
                    >
                      Edit
                    </Link>
                    <form action={setLeaveTypeActive}>
                      <input
                        type="hidden"
                        name="leave_type_id"
                        value={leaveType.id}
                      />
                      <input
                        type="hidden"
                        name="is_active"
                        value={leaveType.is_active ? "false" : "true"}
                      />
                      <RequestSubmitButton
                        className="btn ghost"
                        pendingLabel="Updating…"
                        confirmMessage={
                          leaveType.is_active
                            ? "Deactivate this leave type for new requests?"
                            : "Activate this leave type?"
                        }
                      >
                        {leaveType.is_active ? "Deactivate" : "Activate"}
                      </RequestSubmitButton>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      <p className="preview-note">
        Every Phase 8 configuration change is recorded in the immutable Audit
        Log. Schedules and leave types are deactivated instead of deleted so
        historical workdays, requests and leave-ledger records remain valid.
      </p>
    </>
  );
}
