import Link from "next/link";
import {
  PageHead,
  StatusPill,
} from "@/components/shared/prototype";
import { RealtimeRefresh } from "@/components/realtime/realtime-refresh";
import { RequestSubmitButton } from "@/components/requests/request-submit-button";
import { ShiftDateFields } from "@/components/requests/shift-date-fields";
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

function formatDateTime(value: string | null, timeZone: string) {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

function RequestTrail({
  request,
  timeZone,
}: {
  request: RequestView;
  timeZone: string;
}) {
  return (
    <div className="request-trail" aria-label="Approval progress">
      <div className="request-trail-row request-trail-approved">
        <i className="request-trail-dot" aria-hidden="true" />
        <div>
          <span>Submitted</span>
          <small>
            {formatDateTime(request.submittedAt ?? request.createdAt, timeZone)}
          </small>
        </div>
        <strong>Submitted</strong>
      </div>

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
        const state =
          cancelled || approval.decision === "rejected"
            ? "rejected"
            : approval.decision === "approved"
              ? "approved"
              : "pending";

        return (
          <div
            className={"request-trail-row request-trail-" + state}
            key={approval.id}
          >
            <i className="request-trail-dot" aria-hidden="true" />
            <div>
              <span>
                {approval.stage === "manager"
                  ? "Manager review"
                  : "Final review"}{" "}
                · {approval.approverName}
              </span>
              <small>
                {approval.decidedAt
                  ? formatDateTime(approval.decidedAt, timeZone)
                  : cancelled
                    ? "Request cancelled before decision"
                    : "Awaiting decision"}
              </small>
            </div>
            <strong>{decision}</strong>
            {approval.comment ? (
              <small className="request-trail-comment">
                {approval.comment}
              </small>
            ) : null}
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
  const focusRequestId = single(params.request) ?? "";
  const createModeValue = single(params.new);
  const createMode =
    createModeValue === "shift" || createModeValue === "hour"
      ? createModeValue
      : "leave";
  const historyType = single(params.history_type) ?? "";
  const historyStatus = single(params.history_status) ?? "";
  const historyQuery = (single(params.q) ?? "").trim().toLowerCase();
  const center = await getRequestCenter(current, focusRequestId || undefined);
  const today = dateInZone(current.timezone);
  const trackedBalances = center.leaveBalances;
  const filteredHistory = center.myRequests.filter((request) => {
    if (historyType && request.requestType !== historyType) return false;
    if (historyStatus && request.status !== historyStatus) return false;
    if (!historyQuery) return true;

    const haystack = [
      String(request.requestNumber),
      typeLabel(request.requestType),
      statusLabel(request.status),
      request.startDate,
      request.endDate,
      request.reason ?? "",
      request.leave?.leaveTypeName ?? "",
      request.employeeName,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(historyQuery);
  });
  const focusSection = center.pendingApprovals.some(
    (request) => request.id === focusRequestId,
  )
    ? "pending"
    : center.myRequests.some((request) => request.id === focusRequestId)
      ? "history"
      : center.adminPendingRequests.some(
            (request) => request.id === focusRequestId,
          )
        ? "admin"
        : center.focusedRequest
          ? "linked"
          : null;
  const historyHasFilters = Boolean(
    historyType || historyStatus || historyQuery,
  );

  return (
    <>
      <RealtimeRefresh tables={["requests", "request_approvals"]} />

      <PageHead
        title="Requests"
        subtitle="Leave, shift changes and hour changes with audited approvals"
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

      {center.canSubmit ? (
        <section
          id="new-request"
          className="request-create-shell"
          aria-label="Create a request"
        >
          <div className="request-create-toolbar">
            <div>
              <h2>New request</h2>
              <p className="mut">
                Choose one request type. All submissions follow the audited
                approval workflow.
              </p>
            </div>
            <nav className="request-type-tabs" aria-label="Request type">
              <Link
                href="/requests?new=leave#new-request"
                className={createMode === "leave" ? "on" : undefined}
                aria-current={createMode === "leave" ? "page" : undefined}
              >
                Leave
              </Link>
              <Link
                href="/requests?new=shift#new-request"
                className={createMode === "shift" ? "on" : undefined}
                aria-current={createMode === "shift" ? "page" : undefined}
              >
                Shift change
              </Link>
              <Link
                href="/requests?new=hour#new-request"
                className={createMode === "hour" ? "on" : undefined}
                aria-current={createMode === "hour" ? "page" : undefined}
              >
                Hour change
              </Link>
            </nav>
          </div>

          {createMode === "leave" ? (
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

                <RequestSubmitButton
                  className="btn pri request-primary-submit"
                  pendingLabel="Submitting leave…"
                >
                  Submit leave request
                </RequestSubmitButton>
              </form>
            </div>
          ) : null}

          {createMode === "shift" ? (
            <div className="card request-create-card">
              <div className="hd">
                <div>
                  <h2>Shift change</h2>
                  <p className="mut">
                    Request a temporary date range or an ongoing new shift.
                  </p>
                </div>
              </div>
              <form action={createScheduleRequest} className="bd request-form">
                <input type="hidden" name="request_type" value="shift_change" />
                <ShiftDateFields today={today} />

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

                <RequestSubmitButton
                  className="btn pri request-primary-submit"
                  pendingLabel="Submitting shift change…"
                >
                  Submit shift change
                </RequestSubmitButton>
              </form>
            </div>
          ) : null}

          {createMode === "hour" ? (
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

                <RequestSubmitButton
                  className="btn pri request-primary-submit"
                  pendingLabel="Submitting hour change…"
                >
                  Submit hour change
                </RequestSubmitButton>
              </form>
            </div>
          ) : null}
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

      {focusRequestId && !center.focusedRequest ? (
        <div className="request-notice" role="status">
          This linked request is no longer available in your current access
          scope.
        </div>
      ) : null}

      {center.focusedRequest && focusSection === "linked" ? (
        <section className="request-section" aria-label="Linked request">
          <div className="request-section-head">
            <div>
              <h2>Linked request</h2>
              <p className="mut">Opened from a workflow notification.</p>
            </div>
          </div>
          <article
            id="focused-request"
            className="card request-item request-item-focus"
          >
            <div className="bd">
              <div className="request-item-head">
                <div>
                  <span className="request-kicker">
                    Request #{center.focusedRequest.requestNumber} ·{" "}
                    {typeLabel(center.focusedRequest.requestType)}
                  </span>
                  <h3>{center.focusedRequest.employeeName}</h3>
                  <p className="mut">{dateRange(center.focusedRequest)}</p>
                </div>
                <StatusPill
                  label={statusLabel(center.focusedRequest.status)}
                  tone={statusTone(center.focusedRequest.status)}
                />
              </div>
              <div className="request-detail-row">
                <strong>{requestDetail(center.focusedRequest)}</strong>
                {center.focusedRequest.reason ? (
                  <span>{center.focusedRequest.reason}</span>
                ) : null}
              </div>
              <RequestTrail
                request={center.focusedRequest}
                timeZone={current.timezone}
              />
            </div>
          </article>
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
            <article
              id={
                focusSection === "pending" && request.id === focusRequestId
                  ? "focused-request"
                  : undefined
              }
              className={
                "card request-item request-approval" +
                (focusSection === "pending" && request.id === focusRequestId
                  ? " request-item-focus"
                  : "")
              }
              key={request.id}
            >
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
                    <small className="request-timestamp">
                      Submitted{" "}
                      {formatDateTime(request.submittedAt, current.timezone)}
                    </small>
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

                <RequestTrail request={request} timeZone={current.timezone} />

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
                    <RequestSubmitButton
                      className="btn pri"
                      name="decision"
                      value="approved"
                      pendingLabel="Approving…"
                      confirmMessage="Approve this request? It may move to final review or apply immediately if this is the final approval."
                    >
                      Approve
                    </RequestSubmitButton>
                    <RequestSubmitButton
                      className="btn danger"
                      name="decision"
                      value="rejected"
                      pendingLabel="Rejecting…"
                      confirmMessage="Reject this request? The request will be closed."
                    >
                      Reject
                    </RequestSubmitButton>
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
                  id={
                    focusSection === "admin" && request.id === focusRequestId
                      ? "focused-request"
                      : undefined
                  }
                  className={
                    "card request-item" +
                    (focusSection === "admin" && request.id === focusRequestId
                      ? " request-item-focus"
                      : "")
                  }
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

                    <RequestTrail
                      request={request}
                      timeZone={current.timezone}
                    />

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
                        <RequestSubmitButton
                          pendingLabel="Reassigning…"
                          confirmMessage="Reassign this approval to the selected approver?"
                        >
                          Reassign
                        </RequestSubmitButton>
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

      <section id="history" className="request-section">
        <div className="request-section-head">
          <div>
            <h2>My request history</h2>
            <p className="mut">
              Approval history and final side effects are persisted in Supabase.
            </p>
          </div>
          <span className="request-count">
            {filteredHistory.length}/{center.myRequests.length}
          </span>
        </div>

        <form className="request-history-filters" method="get">
          <input type="hidden" name="new" value={createMode} />
          <label className="f">
            <span>Type</span>
            <select name="history_type" defaultValue={historyType}>
              <option value="">All types</option>
              <option value="leave">Leave</option>
              <option value="shift_change">Shift change</option>
              <option value="hour_change">Hour change</option>
            </select>
          </label>
          <label className="f">
            <span>Status</span>
            <select name="history_status" defaultValue={historyStatus}>
              <option value="">All statuses</option>
              <option value="pending_manager">Manager review</option>
              <option value="pending_final">Final review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="f request-history-search">
            <span>Search</span>
            <input
              name="q"
              type="search"
              defaultValue={single(params.q) ?? ""}
              placeholder="Request #, leave type, reason…"
            />
          </label>
          <button className="btn" type="submit">
            Apply filters
          </button>
          {historyHasFilters ? (
            <Link
              className="btn ghost"
              href={"/requests?new=" + createMode + "#history"}
            >
              Clear
            </Link>
          ) : null}
        </form>

        <div className="request-list">
          {filteredHistory.map((request) => {
            const canCancel =
              request.status === "draft" ||
              request.status === "pending_manager" ||
              request.status === "pending_final";

            return (
              <article
                id={
                  focusSection === "history" && request.id === focusRequestId
                    ? "focused-request"
                    : undefined
                }
                className={
                  "card request-item" +
                  (focusSection === "history" && request.id === focusRequestId
                    ? " request-item-focus"
                    : "")
                }
                key={request.id}
              >
                <div className="bd">
                  <div className="request-item-head">
                    <div>
                      <span className="request-kicker">
                        Request #{request.requestNumber} · {typeLabel(request.requestType)}
                      </span>
                      <h3>{dateRange(request)}</h3>
                      <p className="mut">{requestDetail(request)}</p>
                      <small className="request-timestamp">
                        Submitted{" "}
                        {formatDateTime(request.submittedAt, current.timezone)}
                        {request.completedAt
                          ? " · Completed " +
                            formatDateTime(
                              request.completedAt,
                              current.timezone,
                            )
                          : ""}
                      </small>
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

                  <RequestTrail
                    request={request}
                    timeZone={current.timezone}
                  />

                  {canCancel ? (
                    <form action={cancelRequest} className="request-cancel-form">
                      <input type="hidden" name="request_id" value={request.id} />
                      <input
                        type="text"
                        name="reason"
                        placeholder="Cancellation reason (optional)"
                      />
                      <RequestSubmitButton
                        className="btn ghost"
                        pendingLabel="Cancelling…"
                        confirmMessage="Cancel this request? It will be removed from the approval queue."
                      >
                        Cancel request
                      </RequestSubmitButton>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })}

          {filteredHistory.length === 0 ? (
            <div className="card">
              <div className="bd request-empty">
                <strong>
                  {center.myRequests.length === 0
                    ? "No requests submitted yet."
                    : "No requests match these filters."}
                </strong>
                <span className="mut">
                  {center.myRequests.length === 0
                    ? "Your leave and schedule requests will appear here."
                    : "Change or clear the history filters to see more requests."}
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
