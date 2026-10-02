"use client";

import { useState } from "react";

export function ShiftDateFields({ today }: { today: string }) {
  const [isPermanent, setIsPermanent] = useState(false);

  return (
    <>
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

        {isPermanent ? (
          <div className="request-permanent-note" role="status">
            <strong>Ongoing schedule</strong>
            <span>No end date is needed. The new shift starts on this date.</span>
          </div>
        ) : (
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
        )}
      </div>

      <label className="request-check">
        <input
          type="checkbox"
          name="is_permanent"
          checked={isPermanent}
          onChange={(event) => setIsPermanent(event.target.checked)}
        />
        <span>Make this the ongoing schedule from the start date</span>
      </label>
    </>
  );
}
