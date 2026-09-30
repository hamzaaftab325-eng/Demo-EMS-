"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  correctAttendance,
  type AttendanceCorrectionResult,
} from "@/app/(app)/attendance/actions";

export function AttendanceCorrectionButton({
  employeeId,
  employeeName,
  workDate,
  timezone,
  defaultFirstTime,
  defaultFinalTime,
  defaultBreakMinutes,
}: {
  employeeId: string;
  employeeName: string;
  workDate: string;
  timezone: string;
  defaultFirstTime: string;
  defaultFinalTime: string;
  defaultBreakMinutes: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [first, setFirst] = useState(defaultFirstTime);
  const [final, setFinal] = useState(defaultFinalTime);
  const [breakMinutes, setBreakMinutes] = useState(
    String(defaultBreakMinutes),
  );
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function submit() {
    setMessage(null);

    const changedFirst =
      first !== defaultFirstTime ? first || undefined : undefined;
    const changedFinal =
      final !== defaultFinalTime ? final || undefined : undefined;
    const parsedBreak = Number(breakMinutes);
    const changedBreak =
      parsedBreak !== defaultBreakMinutes ? parsedBreak : undefined;

    startTransition(() => {
      void (async () => {
        const result: AttendanceCorrectionResult =
          await correctAttendance({
            employeeId,
            workDate,
            timezone,
            firstSignInTime: changedFirst,
            finalSignOffTime: changedFinal,
            breakMinutes: changedBreak,
            reason,
          });

        if (!result.ok) {
          setMessage(result.message ?? "Attendance correction failed.");
          return;
        }

        setOpen(false);
        router.refresh();
      })();
    });
  }

  return (
    <>
      <button
        className="btn sm ghost"
        type="button"
        onClick={() => setOpen(true)}
      >
        Edit
      </button>

      {open ? (
        <div
          className="attendance-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <div
            className="attendance-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="attendance-correction-title"
          >
            <div className="attendance-modal-head">
              <div>
                <h2 id="attendance-correction-title">
                  Correct attendance
                </h2>
                <p className="mut">
                  {employeeName} · {workDate} · {timezone}
                </p>
              </div>
              <button
                className="btn ghost"
                type="button"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="attendance-correction-grid">
              <label className="f">
                <span>First sign in</span>
                <input
                  type="time"
                  value={first}
                  onChange={(event) => setFirst(event.target.value)}
                />
              </label>

              <label className="f">
                <span>Final sign off</span>
                <input
                  type="time"
                  value={final}
                  onChange={(event) => setFinal(event.target.value)}
                />
              </label>

              <label className="f">
                <span>Break minutes</span>
                <input
                  type="number"
                  min={0}
                  value={breakMinutes}
                  onChange={(event) => setBreakMinutes(event.target.value)}
                />
              </label>
            </div>

            <label className="f">
              <span>Reason</span>
              <textarea
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Required. Explain why this attendance record is being corrected."
              />
            </label>

            {message ? <div className="form-error">{message}</div> : null}

            <div className="attendance-modal-actions">
              <button
                className="btn"
                type="button"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn brand"
                type="button"
                disabled={pending}
                onClick={submit}
              >
                {pending ? "Saving…" : "Save correction"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
