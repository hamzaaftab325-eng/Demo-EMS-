"use client";

import { useState } from "react";

type ScheduleType = "fixed" | "flexible" | "flexible_core";

export function AdminScheduleFields({
  initialType,
  startTime,
  endTime,
  coreStartTime,
  coreEndTime,
}: {
  initialType: ScheduleType;
  startTime?: string | null;
  endTime?: string | null;
  coreStartTime?: string | null;
  coreEndTime?: string | null;
}) {
  const [type, setType] = useState<ScheduleType>(initialType);

  return (
    <>
      <label className="f">
        <span>Schedule type *</span>
        <select
          name="schedule_type"
          value={type}
          onChange={(event) => setType(event.target.value as ScheduleType)}
          required
        >
          <option value="fixed">Fixed</option>
          <option value="flexible">Flexible</option>
          <option value="flexible_core">Flexible with core hours</option>
        </select>
      </label>

      {type === "fixed" ? (
        <div className="admin-inline-pair">
          <label className="f">
            <span>Start time *</span>
            <input
              type="time"
              name="start_time"
              defaultValue={startTime?.slice(0, 5) ?? ""}
              required
            />
          </label>
          <label className="f">
            <span>End time *</span>
            <input
              type="time"
              name="end_time"
              defaultValue={endTime?.slice(0, 5) ?? ""}
              required
            />
          </label>
        </div>
      ) : null}

      {type === "flexible_core" ? (
        <div className="admin-inline-pair">
          <label className="f">
            <span>Core start *</span>
            <input
              type="time"
              name="core_start_time"
              defaultValue={coreStartTime?.slice(0, 5) ?? ""}
              required
            />
          </label>
          <label className="f">
            <span>Core end *</span>
            <input
              type="time"
              name="core_end_time"
              defaultValue={coreEndTime?.slice(0, 5) ?? ""}
              required
            />
          </label>
        </div>
      ) : null}
    </>
  );
}
