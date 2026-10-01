import type { TeamAttendanceRow } from "@/lib/data/attendance";

function shortTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

type SegmentKind =
  | "active"
  | "idle"
  | "away"
  | "break"
  | "meeting"
  | "offline"
  | "ended";

function segmentKind(
  status: TeamAttendanceRow["presenceEvents"][number]["status"],
): SegmentKind {
  if (status === "on_break") return "break";
  if (status === "in_meeting") return "meeting";
  if (status === "workday_ended") return "ended";
  return status;
}

function segmentColor(kind: SegmentKind) {
  switch (kind) {
    case "idle":
      return "var(--idle)";
    case "away":
      return "var(--away)";
    case "break":
      return "var(--break)";
    case "meeting":
      return "var(--meeting)";
    case "offline":
      return "var(--offline)";
    case "ended":
      return "var(--ended)";
    default:
      return "var(--active)";
  }
}

function segmentLabel(kind: SegmentKind) {
  switch (kind) {
    case "idle":
      return "Idle";
    case "away":
      return "Away";
    case "break":
      return "Break";
    case "meeting":
      return "Meeting";
    case "offline":
      return "Offline";
    case "ended":
      return "Signed off";
    default:
      return "Active";
  }
}

export function AttendanceTimeline({
  row,
}: {
  row: TeamAttendanceRow;
}) {
  if (!row.firstSignInAt) {
    return <div className="strip attendance-strip" />;
  }

  const start = new Date(row.firstSignInAt).getTime();
  const end = row.finalSignOffAt
    ? Math.max(
        new Date(row.finalSignOffAt).getTime(),
        ...row.presenceEvents.map((event) =>
          new Date(event.endedAt ?? row.snapshotAt).getTime(),
        ),
      )
    : new Date(row.snapshotAt).getTime();
  const safeEnd = Math.max(end, start + 60_000);
  const span = safeEnd - start;

  const presenceSegments = row.presenceEvents
    .map((event) => ({
      kind: segmentKind(event.status),
      from: Math.max(start, new Date(event.startedAt).getTime()),
      to: Math.min(
        safeEnd,
        new Date(event.endedAt ?? row.snapshotAt).getTime(),
      ),
    }))
    .filter((segment) => segment.to > segment.from)
    .sort((a, b) => a.from - b.from);

  const fallbackIntervals = row.intervals
    .map((interval) => ({
      ...interval,
      from: Math.max(start, new Date(interval.startedAt).getTime()),
      to: Math.min(
        safeEnd,
        interval.endedAt ? new Date(interval.endedAt).getTime() : safeEnd,
      ),
    }))
    .filter((interval) => interval.to > interval.from)
    .sort((a, b) => a.from - b.from);

  const segments: Array<{
    kind: SegmentKind;
    from: number;
    to: number;
  }> = [];

  if (presenceSegments.length > 0) {
    segments.push(...presenceSegments);
  } else {
    let cursor = start;

    for (const interval of fallbackIntervals) {
      if (interval.from > cursor) {
        segments.push({ kind: "active", from: cursor, to: interval.from });
      }

      segments.push({
        kind: interval.intervalType,
        from: interval.from,
        to: interval.to,
      });

      cursor = Math.max(cursor, interval.to);
    }

    if (cursor < safeEnd) {
      segments.push({ kind: "active", from: cursor, to: safeEnd });
    }
  }

  return (
    <div
      className="strip attendance-strip"
      title={`${shortTime(row.firstSignInAt, row.timezone)} – ${
        row.finalSignOffAt
          ? shortTime(row.finalSignOffAt, row.timezone)
          : "now"
      }`}
    >
      {segments.map((segment, index) => (
        <i
          key={`${segment.kind}-${segment.from}-${index}`}
          style={{
            left: `${((segment.from - start) / span) * 100}%`,
            width: `${Math.max(
              0.6,
              ((segment.to - segment.from) / span) * 100,
            )}%`,
            background: segmentColor(segment.kind),
          }}
          title={`${segmentLabel(segment.kind)} · ${
            shortTime(new Date(segment.from).toISOString(), row.timezone)
          }–${shortTime(new Date(segment.to).toISOString(), row.timezone)}`}
        />
      ))}
    </div>
  );
}
