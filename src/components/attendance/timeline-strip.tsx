import type { TeamAttendanceRow } from "@/lib/data/attendance";

function shortTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
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
    ? new Date(row.finalSignOffAt).getTime()
    : Date.now();
  const safeEnd = Math.max(end, start + 60_000);
  const span = safeEnd - start;

  const intervals = row.intervals
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
    kind: "active" | "break" | "meeting";
    from: number;
    to: number;
  }> = [];

  let cursor = start;

  for (const interval of intervals) {
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
          key={`${segment.kind}-${index}`}
          style={{
            left: `${((segment.from - start) / span) * 100}%`,
            width: `${Math.max(
              0.6,
              ((segment.to - segment.from) / span) * 100,
            )}%`,
            background:
              segment.kind === "break"
                ? "var(--break)"
                : segment.kind === "meeting"
                  ? "var(--meeting)"
                  : "var(--active)",
          }}
        />
      ))}
    </div>
  );
}
