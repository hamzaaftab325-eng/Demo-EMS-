import {
  PageHead,
  StatusPill,
} from "@/components/shared/prototype";
import { requireCurrentProfile } from "@/lib/auth/current-profile";
import {
  getRequestCenter,
  type ApproverCandidate,
  type RequestView,
} from "@/lib/data/requests";
import type { Database } from "@/types/database";
import {
  cancelRequest,
  createLeaveRequest,
  createScheduleRequest,
  decideRequest,
  reassignRequestApprover,
} from "./actions";

type RequestStatus = Database["public"]["Enums"]["request_status"];
type RequestType = Database["public"]["Enums"]["request_type"];

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function dateInZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return value("year") + "-" + value("month") + "-" + value("day");
}

function typeLabel(type: RequestType) {
  if (type === "leave") return "Leave";
  if (type === "shift_change") return "Shift change";
  return "Hour change";
}

function statusLabel(status: RequestStatus) {
  switch (status) {
    case "draft":
      return "Draft";
    case "pending_manager":
      return "Manager review";
    case "pending_final":
      return "Final review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
  }
}

function statusTone(
  status: RequestStatus,
): "active" | "idle" | "meeting" | "red" | "ended" | "offline" {
  switch (status) {
    case "pending_manager":
      return "idle";
    case "pending_final":
      return "meeting";
    case "approved":
      return "active";
    case "rejected":
      return "red";
    case "cancelled":
      return "ended";
    default:
      return "offline";
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value + "T00:00:00Z"));
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function requestDetail(request: RequestView) {
  if (request.leave) {
    return (
      request.leave.leaveTypeName +
      " · " +
      request.leave.daysRequested +
      (request.leave.daysRequested === 1 ? " working day" : " working days")
    );
  }

  if (request.schedule) {
    return (
      formatTime(request.schedule.newStartTime) +
      "–" +
      formatTime(request.schedule.newEndTime) +
      (request.schedule.isPermanent ? " · permanent" : " · temporary")
    );
  }

  return "Request details";
}

function dateRange(request: RequestView) {
  if (request.startDate === request.endDate) {
    return formatDate(request.startDate);
  }

  return (
    formatDate(request.startDate) +
    " – " +
    formatDate(request.endDate)
  );
}

function validReassignmentCandidates(
  request: RequestView,
  candidates: ApproverCandidate[],
) {
  const current = request.approvals.find(
    (approval) =>
      approval.stage === request.currentStage &&
      approval.decision === "pending",
  );

  return candidates.filter((candidate) => {
    if (candidate.id === current?.approverId) return false;

    if (request.currentStage === "final") {
      return candidate.role === "super_admin";
    }

    return (
      candidate.role === "super_admin" ||
      candidate.manageableEmployeeIds.includes(request.employeeId)
    );
  });
}

function RequestTrail({ request }: { request: RequestView }) {
  if (request.approvals.length === 0) return null;

  return (
    <div className="request-trail">
      {request.approvals.map((approval) => {
        const cancelled =
          request.status === "cancelled" && approval.decision === "pending";
        const decision = cancelled
          ? "Cancelled"
          : approval.decision === "pending"
            ? "Pending"
            : approval.decision === "approved"
              ? "Approved"
              : "Rejected";

        return (
          <div className="request-trail-row" key={approval.id}>
            <span>
              {approval.stage === "manager" ? "Manager" : "Final"} ·{" "}
              {approval.approverName}
            </span>
            <strong>{decision}</strong>
            {approval.comment ? <small>{approval.comment}</small> : null}
          </div>
        );
      })}
    </div>
  );
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const current = await requireCurrentProfile();
  const params = await searchParams;
  const success = single(params.success);
  const error = single(params.error);
  const center = await getRequestCenter(current);
  const today = dateInZone(current.timezone);
  const trackedBalances = center.leaveBalances;

  return (
    <>
      <PageHead
        title="Requests"
        subtitle="Leave, shift changes and hour changes with audited approvals"
      />

      {success ? (
        <div className="request-notice request-notice-success">{success}</div>
      ) : null}

      {error ? (
        <div className="request-notice request-notice-error">{error}</div>
      ) : null}

      {center.canSubmit ? (
        <section className="request-create-grid" aria-label="Create a request">
          <div className="card request-create-card">
            <div className="hd">
              <div>
                <h2>Leave request</h2>
                <p className="mut">
                  Working days exclude weekends and configured holidays.
                </p>
              </div>
            </div>
            <form action={createLeaveRequest} className="bd request-form">
              <label className="f">
                <span>Leave type *</span>
                <select name="leave_type_id" required defaultValue="">
                  <option value="" disabled>
                    Select leave type
                  </option>
                  {center.leaveTypes.map((leaveType) => (
                    <option value={leaveType.id} key={leaveType.id}>
                      {leaveType.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="request-two-col">
                <label className="f">
                  <span>Start date *</span>
                  <input
                    type="date"
                    name="start_date"
                    min={today}
                    defaultValue={today}
                    required
                  />
                </label>
                <label className="f">
                  <span>End date *</span>
                  <input
                    type="date"
                    name="end_date"
                    min={today}
                    defaultValue={today}
                    required
                  />
                </label>
              </div>

              <label className="f">
                <span>Reason / note</span>
                <textarea
                  name="reason"
                  rows={3}
                  placeholder="Add context for your approver"
                />
              </label>

              <button className="btn pri" type="submit">
                Submit leave request
              </button>
            </form>
          </div>

          <div className="card request-create-card">
            <div className="hd">
              <div>
                <h2>Shift change</h2>
                <p className="mut">
                  Request temporary dates or a permanent new shift.
                </p>
              </div>
            </div>
            <form action={createScheduleRequest} className="bd request-form">
              <input type="hidden" name="request_type" value="shift_change" />

              <div className="request-two-col">
                <label className="f">
                  <span>Start date *</span>
                  <input
                    type="date"
                    name="start_date"
                    min={today}
                    defaultValue={today}
                    required
                  />
                </label>
                <label className="f">
                  <span>End date *</span>
                  <input
                    type="date"
                    name="end_date"
                    min={today}
                    defaultValue={today}
                    required
                  />
                </label>
              </div>

              <div className="request-two-col">
                <label className="f">
                  <span>New start *</span>
                  <input type="time" name="new_start_time" required />
                </label>
                <label className="f">
                  <span>New end *</span>
                  <input type="time" name="new_end_time" required />
                </label>
              </div>

              <label className="request-check">
                <input type="checkbox" name="is_permanent" />
                <span>Make this the ongoing schedule from the start date</span>
              </label>

              <label className="f">
                <span>Reason *</span>
                <textarea name="reason" rows={3} required />
              </label>

              <button className="btn pri" type="submit">
                Submit shift change
              </button>
            </form>
          </div>

          <div className="card request-create-card">
            <div className="hd">
              <div>
                <h2>Hour change</h2>
                <p className="mut">
                  Temporary working-hour change for one specific date.
                </p>
              </div>
            </div>
            <form action={createScheduleRequest} className="bd request-form">
              <input type="hidden" name="request_type" value="hour_change" />

              <label className="f">
                <span>Date *</span>
                <input
                  type="date"
                  name="start_date"
                  min={today}
                  defaultValue={today}
                  required
                />
              </label>

              <div className="request-two-col">
                <label className="f">
                  <span>New start *</span>
                  <input type="time" name="new_start_time" required />
                </label>
                <label className="f">
                  <span>New end *</span>
                  <input type="time" name="new_end_time" required />
                </label>
              </div>

              <label className="f">
                <span>Reason *</span>
                <textarea name="reason" rows={3} required />
              </label>

              <button className="btn pri" type="submit">
                Submit hour change
              </button>
            </form>
          </div>
        </section>
      ) : (
        <div className="card request-no-approver">
          <div className="bd">
            <strong>No approver is configured above this profile.</strong>
            <p className="mut">
              Top-level accounts cannot self-approve requests. Add a reporting
              approver before using employee request submission.
            </p>
          </div>
        </div>
      )}

      {trackedBalances.length > 0 ? (
        <section className="request-balance-grid" aria-label="Leave balance">
          {trackedBalances.map((balance) => (
            <div className="card request-balance-card" key={balance.id}>
              <div className="bd">
                <span className="mut">{balance.name}</span>
                <strong>
                  {balance.remainingDays == null
                    ? "No quota configured"
                    : balance.remainingDays + " remaining"}
                </strong>
                <small className="mut">
                  {balance.usedDays} used this year
                  {balance.entitlementSource === "allocation"
                    ? " · ledger allocation"
                    : balance.entitlementSource === "default"
                      ? " · annual default"
                      : " · balance not enforced"}
                </small>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <section id="approvals" className="request-section">
        <div className="request-section-head">
          <div>
            <h2>Requests waiting for you</h2>
            <p className="mut">
              Only requests assigned to your current approval stage appear here.
            </p>
          </div>
          <span className="request-count">{center.pendingApprovals.length}</span>
        </div>

        <div className="request-list">
          {center.pendingApprovals.map((request) => (
            <article className="card request-item request-approval" key={request.id}>
              <div className="bd">
                <div className="request-item-head">
                  <div>
                    <span className="request-kicker">
                      Request #{request.requestNumber} · {typeLabel(request.requestType)}
                    </span>
                    <h3>{request.employeeName}</h3>
                    <p className="mut">
                      {request.employeeCode ? request.employeeCode + " · " : ""}
                      {dateRange(request)}
                    </p>
                  </div>
                  <StatusPill
                    label={statusLabel(request.status)}
                    tone={statusTone(request.status)}
                  />
                </div>

                <div className="request-detail-row">
                  <strong>{requestDetail(request)}</strong>
                  {request.reason ? <span>{request.reason}</span> : null}
                </div>

                <RequestTrail request={request} />

                <form action={decideRequest} className="request-decision-form">
                  <input type="hidden" name="request_id" value={request.id} />
                  <label className="f">
                    <span>Approval comment</span>
                    <textarea
                      name="comment"
                      rows={2}
                      placeholder="Required when rejecting"
                    />
                  </label>
                  <div className="request-decision-actions">
                    <button
                      className="btn pri"
                      type="submit"
                      name="decision"
                      value="approved"
                    >
                      Approve
                    </button>
                    <button
                      className="btn danger"
                      type="submit"
                      name="decision"
                      value="rejected"
                    >
                      Reject
                    </button>
                  </div>
                </form>
              </div>
            </article>
          ))}

          {center.pendingApprovals.length === 0 ? (
            <div className="card">
              <div className="bd request-empty">
                <strong>No requests are waiting for you.</strong>
                <span className="mut">
                  New manager or final approvals will appear here.
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {current.role === "super_admin" ? (
        <section className="request-section">
          <div className="request-section-head">
            <div>
              <h2>Organization approval queue</h2>
              <p className="mut">
                Reassign pending approvals when a manager changes or becomes unavailable.
              </p>
            </div>
            <span className="request-count">
              {center.adminPendingRequests.length}
            </span>
          </div>

          <div className="request-list">
            {center.adminPendingRequests.map((request) => {
              const pending = request.approvals.find(
                (approval) =>
                  approval.stage === request.currentStage &&
                  approval.decision === "pending",
              );
              const candidates = validReassignmentCandidates(
                request,
                center.approverCandidates,
              );

              return (
                <article
                  className="card request-item"
                  key={"admin-" + request.id}
                >
                  <div className="bd">
                    <div className="request-item-head">
                      <div>
                        <span className="request-kicker">
                          Request #{request.requestNumber} ·{" "}
                          {typeLabel(request.requestType)}
                        </span>
                        <h3>{request.employeeName}</h3>
                        <p className="mut">
                          {dateRange(request)} · Current approver:{" "}
                          {pending?.approverName ?? "Not assigned"}
                        </p>
                      </div>
                      <StatusPill
                        label={statusLabel(request.status)}
                        tone={statusTone(request.status)}
                      />
                    </div>

                    <div className="request-detail-row">
                      <strong>{requestDetail(request)}</strong>
                      {request.reason ? <span>{request.reason}</span> : null}
                    </div>

                    {candidates.length > 0 ? (
                      <form
                        action={reassignRequestApprover}
                        className="request-reassign-form"
                      >
                        <input
                          type="hidden"
                          name="request_id"
                          value={request.id}
                        />
                        <label className="f">
                          <span>
                            Reassign{" "}
                            {request.currentStage === "final"
                              ? "final"
                              : "manager"}{" "}
                            approval
                          </span>
                          <select name="approver_id" defaultValue="" required>
                            <option value="" disabled>
                              Select approver
                            </option>
                            {candidates.map((candidate) => (
                              <option value={candidate.id} key={candidate.id}>
                                {candidate.fullName} ·{" "}
                                {candidate.role.replace("_", " ")}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="f">
                          <span>Reason</span>
                          <input
                            name="comment"
                            type="text"
                            placeholder="Manager unavailable, reporting change, escalation…"
                          />
                        </label>
                        <button className="btn" type="submit">
                          Reassign
                        </button>
                      </form>
                    ) : (
                      <p className="mut">
                        No alternate valid approver is currently available.
                      </p>
                    )}
                  </div>
                </article>
              );
            })}

            {center.adminPendingRequests.length === 0 ? (
              <div className="card">
                <div className="bd request-empty">
                  <strong>No organization requests are pending.</strong>
                  <span className="mut">
                    Escalation and reassignment controls appear here when needed.
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="request-section">
        <div className="request-section-head">
          <div>
            <h2>My request history</h2>
            <p className="mut">
              Approval history and final side effects are persisted in Supabase.
            </p>
          </div>
          <span className="request-count">{center.myRequests.length}</span>
        </div>

        <div className="request-list">
          {center.myRequests.map((request) => {
            const canCancel =
              request.status === "draft" ||
              request.status === "pending_manager" ||
              request.status === "pending_final";

            return (
              <article className="card request-item" key={request.id}>
                <div className="bd">
                  <div className="request-item-head">
                    <div>
                      <span className="request-kicker">
                        Request #{request.requestNumber} · {typeLabel(request.requestType)}
                      </span>
                      <h3>{dateRange(request)}</h3>
                      <p className="mut">{requestDetail(request)}</p>
                    </div>
                    <StatusPill
                      label={statusLabel(request.status)}
                      tone={statusTone(request.status)}
                    />
                  </div>

                  {request.reason ? (
                    <p className="request-reason">{request.reason}</p>
                  ) : null}

                  {request.cancellationReason ? (
                    <p className="request-cancel-reason">
                      Cancellation: {request.cancellationReason}
                    </p>
                  ) : null}

                  <RequestTrail request={request} />

                  {canCancel ? (
                    <form action={cancelRequest} className="request-cancel-form">
                      <input type="hidden" name="request_id" value={request.id} />
                      <input
                        type="text"
                        name="reason"
                        placeholder="Cancellation reason (optional)"
                      />
                      <button className="btn ghost" type="submit">
                        Cancel request
                      </button>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })}

          {center.myRequests.length === 0 ? (
            <div className="card">
              <div className="bd request-empty">
                <strong>No requests submitted yet.</strong>
                <span className="mut">
                  Your leave and schedule requests will appear here.
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <p className="preview-note">
        Approved requests are immutable. Pending requests may be cancelled.
        Approved leave becomes the canonical attendance record and blocks
        sign-in for those working dates. Schedule changes cannot overwrite a
        workday after work has started.
      </p>
    </>
  );
}
