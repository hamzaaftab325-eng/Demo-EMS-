"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addMyDayCycleItem,
  addMyDayObstacle,
  endMyDayInterval,
  signBackInMyDay,
  signInMyDay,
  signOffMyDay,
  startMyDayInterval,
  updateMyDayProgress,
  type BacklogDraftItem,
  type MyDayActionResult,
  type SignInDraftItem,
  type SignOffDraftItem,
} from "@/app/(app)/my-day/actions";
import { PageHead, StatusPill } from "@/components/shared/prototype";
import type {
  MyDayCycleItem,
  MyDayState,
} from "@/lib/my-day/state";

type TimelineSegment = {
  kind: "active" | "break" | "meeting";
  start: number;
  end: number;
};

function formatTime(iso: string | null, timeZone: string) {
  if (!iso) return "—";

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatDuration(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

function formatDate(date: string, timeZone: string) {
  const instant = new Date(`${date}T12:00:00Z`);

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(instant);
}

function buildTimeline(state: MyDayState): TimelineSegment[] {
  const now = new Date(state.snapshotAt).getTime();
  const sessions: Array<{ start: number; end: number }> = [];
  let sessionStart: number | null = null;

  for (const event of state.attendanceEvents) {
    const timestamp = new Date(event.occurredAt).getTime();

    if (
      (event.eventType === "sign_in" ||
        event.eventType === "sign_back_in") &&
      sessionStart == null
    ) {
      sessionStart = timestamp;
    }

    if (
      (event.eventType === "sign_off" ||
        event.eventType === "auto_sign_off") &&
      sessionStart != null
    ) {
      sessions.push({
        start: sessionStart,
        end: Math.max(sessionStart, timestamp),
      });
      sessionStart = null;
    }
  }

  if (sessionStart != null) {
    sessions.push({
      start: sessionStart,
      end: Math.max(sessionStart, now),
    });
  }

  const intervals = state.intervals
    .map((interval) => ({
      kind: interval.intervalType,
      start: new Date(interval.startedAt).getTime(),
      end: interval.endedAt
        ? new Date(interval.endedAt).getTime()
        : now,
    }))
    .sort((a, b) => a.start - b.start);

  const result: TimelineSegment[] = [];

  for (const session of sessions) {
    let cursor = session.start;

    for (const interval of intervals) {
      const start = Math.max(session.start, interval.start);
      const end = Math.min(session.end, interval.end);

      if (end <= session.start || start >= session.end || end <= start) {
        continue;
      }

      if (start > cursor) {
        result.push({ kind: "active", start: cursor, end: start });
      }

      result.push({
        kind: interval.kind,
        start,
        end,
      });

      cursor = Math.max(cursor, end);
    }

    if (cursor < session.end) {
      result.push({ kind: "active", start: cursor, end: session.end });
    }
  }

  return result.filter((segment) => segment.end > segment.start);
}

function scheduleLabel(state: MyDayState) {
  const schedule = state.schedule;
  if (!schedule) return "Not assigned";

  if (schedule.scheduleType === "fixed") {
    return `${schedule.name}`;
  }

  if (
    schedule.scheduleType === "flexible_core" &&
    schedule.coreStartTime &&
    schedule.coreEndTime
  ) {
    return `${schedule.name}`;
  }

  return schedule.name;
}

function itemLabel(item: {
  projectCode: string | null;
  title: string;
}) {
  return item.projectCode
    ? `${item.projectCode} — ${item.title}`
    : item.title;
}

function currentStatus(state: MyDayState) {
  if (!state.workday || state.workday.status === "not_started") {
    return { label: "Not signed in", tone: "offline" as const };
  }

  if (state.workday.status === "signed_off") {
    return { label: "Signed off", tone: "ended" as const };
  }

  if (state.workday.status === "on_break") {
    return { label: "On break", tone: "break" as const };
  }

  if (state.workday.status === "in_meeting") {
    return { label: "In meeting", tone: "meeting" as const };
  }

  switch (state.presence?.status) {
    case "idle":
      return { label: "Idle", tone: "idle" as const };
    case "away":
      return { label: "Away", tone: "away" as const };
    case "offline":
      return { label: "Offline", tone: "offline" as const };
    case "workday_ended":
      return { label: "Signed off", tone: "ended" as const };
    case "on_break":
      return { label: "On break", tone: "break" as const };
    case "in_meeting":
      return { label: "In meeting", tone: "meeting" as const };
    default:
      return { label: "Active", tone: "active" as const };
  }
}

function firstSignIn(state: MyDayState) {
  return (
    state.attendanceEvents.find((event) => event.eventType === "sign_in")
      ?.occurredAt ?? state.scrumEntry?.signedInAt ?? null
  );
}

function copyText(state: MyDayState) {
  const lines = state.currentItems.map(
    (item) => `• ${itemLabel(item)} — ${item.currentPercent}%`,
  );

  const obstacle = state.obstacles
    .filter((item) => item.status === "open")
    .map((item) => item.description)
    .join("; ");

  return [
    `Scrum — ${state.profile.fullName}`,
    ...lines,
    obstacle ? `Obstacles: ${obstacle}` : "Obstacles: N/A",
  ].join("\n");
}

function DraftRow({
  item,
  onChange,
  onRemove,
  withPercent,
}: {
  item: SignInDraftItem | BacklogDraftItem;
  onChange: (next: SignInDraftItem | BacklogDraftItem) => void;
  onRemove: () => void;
  withPercent: boolean;
}) {
  return (
    <div className={withPercent ? "myday-draft-row" : "myday-draft-row backlog"}>
      <input
        type="text"
        placeholder="EMS"
        value={item.projectCode}
        onChange={(event) =>
          onChange({ ...item, projectCode: event.target.value })
        }
        aria-label="Project code"
      />
      <input
        type="text"
        placeholder={withPercent ? "Task title" : "Backlog item"}
        value={item.title}
        onChange={(event) => onChange({ ...item, title: event.target.value })}
        aria-label="Task title"
      />
      {withPercent ? (
        <input
          type="number"
          min={0}
          max={99}
          value={(item as SignInDraftItem).percent}
          onChange={(event) =>
            onChange({
              ...item,
              percent: Number(event.target.value),
            } as SignInDraftItem)
          }
          aria-label="Starting percent"
        />
      ) : null}
      <button className="btn ghost sm" type="button" onClick={onRemove}>
        ×
      </button>
    </div>
  );
}

function ProgressItem({
  item,
  pending,
  run,
}: {
  item: MyDayCycleItem;
  pending: boolean;
  run: (task: () => Promise<MyDayActionResult>) => void;
}) {
  const [percent, setPercent] = useState(item.currentPercent);
  const [note, setNote] = useState("");

  function save(value = percent) {
    run(() =>
      updateMyDayProgress({
        entryItemId: item.entryItemId,
        percent: value,
        note,
      }),
    );
  }

  return (
    <li className="myday-progress-item">
      <div className="myday-progress-copy">
        <strong>{itemLabel(item)}</strong>
        <span>
          Started at {item.startingPercent}%
          {item.carriedFromEntryItemId ? " · Carried over" : ""}
          {item.source === "manager" ? " · Added by manager" : ""}
        </span>
      </div>

      <div className="myday-progress-controls">
        <div className="myday-quick-pct">
          {[0, 25, 50, 75, 100].map((value) => (
            <button
              className={percent === value ? "on" : ""}
              type="button"
              key={value}
              disabled={pending}
              onClick={() => {
                setPercent(value);
                save(value);
              }}
            >
              {value}%
            </button>
          ))}
        </div>

        <input
          type="number"
          min={0}
          max={100}
          value={percent}
          onChange={(event) => setPercent(Number(event.target.value))}
          aria-label={`Progress for ${item.title}`}
        />

        <input
          type="text"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Progress note"
          aria-label={`Progress note for ${item.title}`}
        />

        <button
          className="btn sm"
          type="button"
          disabled={pending}
          onClick={() => save()}
        >
          Save
        </button>
      </div>
    </li>
  );
}

function Timeline({ state }: { state: MyDayState }) {
  const segments = useMemo(() => buildTimeline(state), [state]);
  const now = new Date(state.snapshotAt).getTime();
  const hour = 60 * 60 * 1000;

  const values = segments.flatMap((segment) => [segment.start, segment.end]);
  const earliest = values.length ? Math.min(...values) : now;
  const latest = values.length ? Math.max(...values, now) : now;
  const targetMinutes = Math.max(
    60,
    state.workday?.scheduledMinutes ??
      state.schedule?.dailyTargetMinutes ??
      480,
  );

  const start = Math.floor(earliest / hour) * hour;
  const expectedEnd = earliest + targetMinutes * 60 * 1000;
  let end = Math.ceil(Math.max(latest, expectedEnd) / hour) * hour;

  if (end <= start) end = start + hour;

  const spanHours = (end - start) / hour;
  const stepHours = spanHours <= 12 ? 1 : spanHours <= 20 ? 2 : 3;
  const ticks: number[] = [];

  for (let tick = start; tick <= end; tick += stepHours * hour) {
    ticks.push(tick);
  }

  if (ticks[ticks.length - 1] !== end) {
    ticks.push(end);
  }

  const span = Math.max(hour, end - start);

  function clock(timestamp: number, includeMinutes = false) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: state.timezone,
      hour: "numeric",
      minute: includeMinutes ? "2-digit" : undefined,
    }).format(new Date(timestamp));
  }

  return (
    <>
      <div className="strip big" role="img" aria-label="Today timeline">
        {segments.map((segment, index) => (
          <i
            key={`${segment.kind}-${segment.start}-${index}`}
            style={{
              left: `${((segment.start - start) / span) * 100}%`,
              width: `${Math.max(
                0.35,
                ((segment.end - segment.start) / span) * 100,
              )}%`,
              background:
                segment.kind === "break"
                  ? "var(--break)"
                  : segment.kind === "meeting"
                    ? "var(--meeting)"
                    : "var(--active)",
            }}
            title={`${segment.kind} · ${clock(segment.start, true)}–${clock(
              segment.end,
              true,
            )}`}
          />
        ))}

        {state.workday && state.workday.status !== "signed_off" ? (
          <span
            className="now"
            style={{
              left: `${Math.max(
                0,
                Math.min(100, ((now - start) / span) * 100),
              )}%`,
            }}
          />
        ) : null}
      </div>

      <div className="hours myday-hours">
        {ticks.map((tick) => (
          <span key={tick}>{clock(tick)}</span>
        ))}
      </div>

      <div className="legend">
        <span>
          <i className="dot" style={{ background: "var(--active)" }} />
          Active
        </span>
        <span>
          <i className="dot" style={{ background: "var(--break)" }} />
          Break
        </span>
        <span>
          <i className="dot" style={{ background: "var(--meeting)" }} />
          Meeting
        </span>
      </div>
    </>
  );
}

export function MyDayClient({ state }: { state: MyDayState }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState(
    () =>
      new Set(
        state.candidateItems
          .filter((item) => item.origin !== "backlog")
          .map((item) => item.itemId),
      ),
  );
  const [cycleRows, setCycleRows] = useState<SignInDraftItem[]>([
    { projectCode: "", title: "", percent: 0 },
  ]);
  const [backlogRows, setBacklogRows] = useState<BacklogDraftItem[]>([
    { projectCode: "", title: "" },
  ]);
  const [signInObstacle, setSignInObstacle] = useState("");
  const [duringObstacle, setDuringObstacle] = useState("");
  const [newTask, setNewTask] = useState<SignInDraftItem>({
    projectCode: "",
    title: "",
    percent: 0,
  });
  const [showSignOff, setShowSignOff] = useState(false);
  const [signOffObstacle, setSignOffObstacle] = useState("");
  const [signOffRows, setSignOffRows] = useState<SignOffDraftItem[]>(
    state.currentItems.map((item) => ({
      entryItemId: item.entryItemId,
      percent: item.currentPercent,
      note: "",
    })),
  );

  const signedOff = state.workday?.status === "signed_off";
  const started =
    state.workday != null && state.workday.status !== "not_started";
  const openObstacles = state.obstacles.filter(
    (obstacle) => obstacle.status === "open",
  );

  function run(task: () => Promise<MyDayActionResult>) {
    setMessage(null);

    startTransition(() => {
      void (async () => {
        const result = await task();

        if (!result.ok) {
          setMessage(result.message ?? "The action could not be completed.");
          return;
        }

        router.refresh();
      })();
    });
  }

  function updateCycleRow(index: number, next: SignInDraftItem) {
    setCycleRows((rows) =>
      rows.map((row, current) => (current === index ? next : row)),
    );
  }

  function updateBacklogRow(index: number, next: BacklogDraftItem) {
    setBacklogRows((rows) =>
      rows.map((row, current) => (current === index ? next : row)),
    );
  }

  async function copyForTeams() {
    await navigator.clipboard.writeText(copyText(state));
    setMessage("Copied for Teams.");
  }

  function startSignOff() {
    setSignOffRows(
      state.currentItems.map((item) => ({
        entryItemId: item.entryItemId,
        percent: item.currentPercent,
        note: "",
      })),
    );
    setShowSignOff(true);
  }

  return (
    <>
      <PageHead
        title={`Hi ${state.profile.fullName.split(" ")[0] || state.profile.fullName}`}
        subtitle={`${formatDate(state.workDate, state.timezone)} · ${state.timezone}`}
      />

      {message ? (
        <div
          className={
            message === "Copied for Teams" ? "form-success" : "form-error"
          }
        >
          {message}
        </div>
      ) : null}

      <div className="grid g3">
        <div>
          <div className="card">
            <div className="bd myday-main-card">
              {!started ? (
                <>
                  <div className="myday-section-title">
                    Sign in with your scrum
                  </div>
                  <p className="mut myday-intro">
                    Your reporting chain can see this scrum after you sign in.
                  </p>

                  <SectionTitle title="What I completed in the previous scrum cycle?" />
                  {state.previousItems.length ? (
                    <ul className="list myday-previous-list">
                      {state.previousItems.map((item, index) => (
                        <li key={`${item.title}-${index}`}>
                          <span>{itemLabel(item)}</span>
                          <span className="pill myday-percent-pill">
                            {item.finalPercent}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mut myday-empty">
                      No previous signed-off scrum yet.
                    </p>
                  )}

                  <label className="f">
                    <span>Any obstacle(s)?</span>
                    <textarea
                      rows={2}
                      value={signInObstacle}
                      onChange={(event) => setSignInObstacle(event.target.value)}
                      placeholder="N/A"
                    />
                  </label>

                  <SectionTitle title="What I add to this scrum cycle?" />

                  {state.candidateItems.length ? (
                    <div className="card myday-candidate-card">
                      <ul className="list">
                        {state.candidateItems.map((item) => (
                          <li key={item.itemId}>
                            <label className="myday-pick">
                              <input
                                type="checkbox"
                                checked={selected.has(item.itemId)}
                                onChange={(event) => {
                                  setSelected((current) => {
                                    const next = new Set(current);
                                    if (event.target.checked) next.add(item.itemId);
                                    else next.delete(item.itemId);
                                    return next;
                                  });
                                }}
                              />
                              <span className="myday-pick-copy">
                                {itemLabel(item)}
                                <small>
                                  {item.origin === "backlog"
                                    ? "From backlog"
                                    : item.origin === "manager"
                                      ? "Added by manager"
                                      : item.origin === "carried_over"
                                        ? "Carried over"
                                        : "Active task"}
                                </small>
                              </span>
                              <span className="pill myday-percent-pill">
                                {item.currentPercent}%
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mut myday-empty">
                      No carried-over, manager-added, or backlog items yet.
                    </p>
                  )}

                  <div className="myday-draft-list">
                    {cycleRows.map((row, index) => (
                      <DraftRow
                        key={index}
                        item={row}
                        withPercent
                        onChange={(next) =>
                          updateCycleRow(index, next as SignInDraftItem)
                        }
                        onRemove={() =>
                          setCycleRows((rows) =>
                            rows.filter((_, current) => current !== index),
                          )
                        }
                      />
                    ))}
                  </div>

                  <button
                    className="btn ghost sm"
                    type="button"
                    onClick={() =>
                      setCycleRows((rows) => [
                        ...rows,
                        { projectCode: "", title: "", percent: 0 },
                      ])
                    }
                  >
                    + Add item
                  </button>

                  <SectionTitle title="What I add to this scrum backlog?" />

                  <div className="myday-draft-list">
                    {backlogRows.map((row, index) => (
                      <DraftRow
                        key={index}
                        item={row}
                        withPercent={false}
                        onChange={(next) =>
                          updateBacklogRow(index, next as BacklogDraftItem)
                        }
                        onRemove={() =>
                          setBacklogRows((rows) =>
                            rows.filter((_, current) => current !== index),
                          )
                        }
                      />
                    ))}
                  </div>

                  <button
                    className="btn ghost sm"
                    type="button"
                    onClick={() =>
                      setBacklogRows((rows) => [
                        ...rows,
                        { projectCode: "", title: "" },
                      ])
                    }
                  >
                    + Add item
                  </button>

                  <div className="myday-primary-actions">
                    <button
                      className="btn brand myday-signin-btn"
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          signInMyDay({
                            existingItemIds: Array.from(selected),
                            newCycleItems: cycleRows,
                            newBacklogItems: backlogRows,
                            obstacle: signInObstacle,
                          }),
                        )
                      }
                    >
                      {pending ? "Saving…" : "Sign in"}
                    </button>
                  </div>
                </>
              ) : signedOff ? (
                <>
                  <div className="myday-active-head">
                    <div>
                      <div className="myday-section-title">Signed off</div>
                      <span className="mut">
                        {formatTime(state.scrumEntry?.signedOffAt ?? null, state.timezone)}
                      </span>
                    </div>

                    <button
                      className="btn sm"
                      type="button"
                      onClick={() => void copyForTeams()}
                    >
                      Copy
                    </button>
                  </div>

                  <SectionTitle title="What I worked on in this scrum cycle?" />
                  <ul className="list">
                    {state.currentItems.map((item) => (
                      <li key={item.entryItemId}>
                        <span className="myday-pick-copy">
                          {itemLabel(item)}
                          {item.signOffNote ? (
                            <small>{item.signOffNote}</small>
                          ) : null}
                        </span>
                        <span className="pill myday-percent-pill">
                          {item.finalPercent ?? item.currentPercent}%
                        </span>
                      </li>
                    ))}
                  </ul>

                  {openObstacles.length ? (
                    <ObstacleList obstacles={openObstacles} />
                  ) : null}

                  <button
                    className="btn"
                    type="button"
                    disabled={pending}
                    onClick={() => run(signBackInMyDay)}
                  >
                    Sign back in
                  </button>
                </>
              ) : (
                <>
                  <div className="myday-active-head">
                    <div>
                      <div className="myday-section-title">
                        Signed in{" "}
                        <span className="mut myday-inline-time">
                          {formatTime(firstSignIn(state), state.timezone)}
                        </span>
                      </div>
                    </div>

                    <button
                      className="btn sm"
                      type="button"
                      onClick={() => void copyForTeams()}
                    >
                      Copy
                    </button>
                  </div>

                  <SectionTitle title="This scrum cycle" />

                  {state.currentItems.length ? (
                    <ul className="list myday-progress-list">
                      {state.currentItems.map((item) => (
                        <ProgressItem
                          item={item}
                          key={item.entryItemId}
                          pending={pending}
                          run={run}
                        />
                      ))}
                    </ul>
                  ) : (
                    <p className="mut myday-empty">
                      No items in this scrum cycle.
                    </p>
                  )}

                  <div className="myday-add-task">
                    <input
                      type="text"
                      placeholder="Project"
                      value={newTask.projectCode}
                      onChange={(event) =>
                        setNewTask((task) => ({
                          ...task,
                          projectCode: event.target.value,
                        }))
                      }
                    />
                    <input
                      type="text"
                      placeholder="Add task to this cycle"
                      value={newTask.title}
                      onChange={(event) =>
                        setNewTask((task) => ({
                          ...task,
                          title: event.target.value,
                        }))
                      }
                    />
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={newTask.percent}
                      onChange={(event) =>
                        setNewTask((task) => ({
                          ...task,
                          percent: Number(event.target.value),
                        }))
                      }
                    />
                    <button
                      className="btn sm"
                      type="button"
                      disabled={pending || !newTask.title.trim()}
                      onClick={() => {
                        run(async () => {
                          const result = await addMyDayCycleItem({
                            projectCode: newTask.projectCode,
                            title: newTask.title,
                            startingPercent: newTask.percent,
                          });
                          if (result.ok) {
                            setNewTask({
                              projectCode: "",
                              title: "",
                              percent: 0,
                            });
                          }
                          return result;
                        });
                      }}
                    >
                      Add
                    </button>
                  </div>

                  {openObstacles.length ? (
                    <ObstacleList obstacles={openObstacles} />
                  ) : null}

                  <div className="myday-obstacle-add">
                    <input
                      type="text"
                      value={duringObstacle}
                      onChange={(event) => setDuringObstacle(event.target.value)}
                      placeholder="Add an obstacle"
                    />
                    <button
                      className="btn sm"
                      type="button"
                      disabled={pending || !duringObstacle.trim()}
                      onClick={() => {
                        run(async () => {
                          const result =
                            await addMyDayObstacle(duringObstacle);
                          if (result.ok) setDuringObstacle("");
                          return result;
                        });
                      }}
                    >
                      Add obstacle
                    </button>
                  </div>

                  <div className="myday-controls">
                    {state.workday?.status === "on_break" ||
                    state.workday?.status === "in_meeting" ? (
                      <button
                        className="btn brand"
                        type="button"
                        disabled={pending}
                        onClick={() => run(endMyDayInterval)}
                      >
                        {state.workday.status === "on_break"
                          ? "Back from break"
                          : "Back from meeting"}
                      </button>
                    ) : (
                      <>
                        <button
                          className="btn"
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run(() => startMyDayInterval("break"))
                          }
                        >
                          Break
                        </button>
                        <button
                          className="btn"
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            run(() => startMyDayInterval("meeting"))
                          }
                        >
                          Meeting
                        </button>
                      </>
                    )}

                    <button
                      className="btn brand myday-signoff-btn"
                      type="button"
                      disabled={pending}
                      onClick={startSignOff}
                    >
                      Sign off
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card myday-timeline-card">
            <div className="hd">
              <h2>Today&apos;s timeline</h2>
            </div>
            <div className="bd">
              {state.attendanceEvents.length ? (
                <Timeline state={state} />
              ) : (
                <p className="mut myday-empty">
                  Your real timeline starts when you sign in.
                </p>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="summary-grid">
            <Summary label="Status">
              <StatusPill
                label={currentStatus(state).label}
                tone={currentStatus(state).tone}
              />
            </Summary>

            <Summary label="Signed in">
              {formatTime(firstSignIn(state), state.timezone)}
            </Summary>

            <Summary label="Worked today">
              {state.workday
                ? `${formatDuration(state.workday.netWorkMinutes)} of ${formatDuration(
                    state.workday.scheduledMinutes,
                  )}`
                : "—"}
            </Summary>

            <Summary label="Schedule">{scheduleLabel(state)}</Summary>
          </div>

          <div className="card myday-side-card">
            <div className="hd">
              <h2>My requests</h2>
            </div>
            <div className="bd">
              <p className="mut myday-empty">
                Requests become live in Phase 6. No sample request data is shown.
              </p>
            </div>
          </div>

          <div className="card myday-side-card">
            <div className="hd">
              <h2>Workday settings</h2>
            </div>
            <div className="bd">
              <dl className="kv employee-kv">
                <dt>Work date</dt>
                <dd>{state.workDate}</dd>
                <dt>Timezone</dt>
                <dd>{state.timezone}</dd>
                <dt>Scrum required</dt>
                <dd>{state.settings.requireScrumForSignin ? "Yes" : "No"}</dd>
                <dt>Sign-off scrum</dt>
                <dd>{state.settings.requireScrumForSignoff ? "Required" : "Optional"}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <p className="preview-note">
        Attendance, presence and worked-time totals are live. Active, idle and
        away reflect activity inside this EMS tab only.
      </p>

      {showSignOff ? (
        <div
          className="myday-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setShowSignOff(false);
          }}
        >
          <div
            className="myday-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="signoff-title"
          >
            <div className="myday-modal-head">
              <div>
                <h2 id="signoff-title">Sign off with your scrum</h2>
                <p className="mut">
                  Finalize every item. Anything below 100% stays active and is
                  available to carry into the next scrum cycle.
                </p>
              </div>
              <button
                className="btn ghost"
                type="button"
                onClick={() => setShowSignOff(false)}
              >
                ×
              </button>
            </div>

            <div className="myday-signoff-items">
              {state.currentItems.map((item, index) => {
                const draft = signOffRows[index] ?? {
                  entryItemId: item.entryItemId,
                  percent: item.currentPercent,
                  note: "",
                };

                return (
                  <div className="myday-signoff-row" key={item.entryItemId}>
                    <div>
                      <strong>{itemLabel(item)}</strong>
                      <span>Current {item.currentPercent}%</span>
                    </div>

                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={draft.percent}
                      onChange={(event) =>
                        setSignOffRows((rows) =>
                          rows.map((row, current) =>
                            current === index
                              ? {
                                  ...row,
                                  percent: Number(event.target.value),
                                }
                              : row,
                          ),
                        )
                      }
                      aria-label={`Final percentage for ${item.title}`}
                    />

                    <input
                      type="text"
                      value={draft.note ?? ""}
                      onChange={(event) =>
                        setSignOffRows((rows) =>
                          rows.map((row, current) =>
                            current === index
                              ? { ...row, note: event.target.value }
                              : row,
                          ),
                        )
                      }
                      placeholder="Sign-off note"
                    />
                  </div>
                );
              })}
            </div>

            <label className="f">
              <span>Any obstacle(s)?</span>
              <textarea
                rows={2}
                value={signOffObstacle}
                onChange={(event) => setSignOffObstacle(event.target.value)}
                placeholder="N/A"
              />
            </label>

            <div className="myday-modal-actions">
              <button
                className="btn"
                type="button"
                disabled={pending}
                onClick={() => setShowSignOff(false)}
              >
                Cancel
              </button>
              <button
                className="btn brand"
                type="button"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const result = await signOffMyDay({
                      items: signOffRows,
                      obstacle: signOffObstacle,
                    });
                    if (result.ok) setShowSignOff(false);
                    return result;
                  })
                }
              >
                {pending ? "Signing off…" : "Sign off"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <div className="myday-list-title">{title}</div>;
}

function ObstacleList({
  obstacles,
}: {
  obstacles: MyDayState["obstacles"];
}) {
  return (
    <div className="myday-obstacles">
      <div className="myday-list-title">Obstacles</div>
      {obstacles.map((obstacle) => (
        <div className="myday-obstacle" key={obstacle.id}>
          <span>{obstacle.description}</span>
          <small>
            {obstacle.reportedStage === "sign_in"
              ? "Sign in"
              : obstacle.reportedStage === "sign_off"
                ? "Sign off"
                : "During day"}
          </small>
        </div>
      ))}
    </div>
  );
}

function Summary({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card myday-summary">
      <div className="mut">{label}</div>
      <div>{children}</div>
    </div>
  );
}
