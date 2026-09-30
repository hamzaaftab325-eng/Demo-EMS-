"use client";

import { useMemo, useState } from "react";
import { PageHead, StatusPill } from "@/components/shared/prototype";

type DayState = "offline" | "active" | "on_break" | "in_meeting" | "workday_ended";

const initialCycle = [
  { project: "NZF", title: "Winter Campaign Landing Page", percent: 75, note: "Carried over" },
  { project: "EMS", title: "Employee Management System planning", percent: 25, note: "Carried over" },
];

const previous = [
  { project: "BEING ME", title: "Website performance fixes", percent: 100 },
  { project: "NZF", title: "Winter page feedback", percent: 100 },
];

const myRequests = [
  { type: "Annual Leave", dates: "Oct 6 to Oct 8", status: "With lead" },
  { type: "Hour change", dates: "Sep 25", status: "Rejected" },
];

export default function MyDayPage() {
  const [started, setStarted] = useState(false);
  const [state, setState] = useState<DayState>("offline");
  const [signedOff, setSignedOff] = useState(false);
  const [cycle, setCycle] = useState(initialCycle);

  const worked = useMemo(() => (started ? "5h 01m / 8h" : "0h 00m / 8h"), [started]);

  function signIn() {
    setStarted(true);
    setSignedOff(false);
    setState("active");
  }

  function signOff() {
    setSignedOff(true);
    setState("workday_ended");
  }

  return (
    <>
      <PageHead
        title="Hi Ghulam"
        subtitle="Monday, September 28 in Asia/Karachi"
      />

      <div className="grid g3">
        <div>
          <div className="card">
            <div className="bd" style={{ padding: 20 }}>
              {!started ? (
                <>
                  <div
                    style={{
                      fontFamily: "Archivo,Inter,system-ui,sans-serif",
                      fontSize: 18,
                      fontWeight: 700,
                    }}
                  >
                    Sign in with your scrum
                  </div>
                  <p className="mut" style={{ margin: "4px 0 18px" }}>
                    Your lead sees this the moment you sign in. You can also copy it
                    for Teams.
                  </p>

                  <ScrumSection
                    title="What I completed in the previous scrum cycle?"
                    items={previous}
                  />

                  <label className="f">
                    <span style={{ fontSize: 12, fontWeight: 600 }}>
                      Any obstacle(s)?
                    </span>
                    <textarea rows={2} placeholder="N/A" />
                  </label>

                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      marginBottom: 6,
                    }}
                  >
                    What I add to this scrum cycle?
                  </div>

                  <div className="card" style={{ borderRadius: 8 }}>
                    <ul className="list" style={{ padding: "0 12px" }}>
                      {cycle.map((item, index) => (
                        <li key={`${item.project}-${item.title}`}>
                          <label className="scrum-item" style={{ cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              defaultChecked
                              style={{ marginTop: 4, accentColor: "var(--cyan)" }}
                            />
                            <span className="scrum-item-main">
                              {item.project} — {item.title}
                              <small
                                className="mut"
                                style={{ display: "block", fontSize: 12 }}
                              >
                                {item.note}
                              </small>
                            </span>
                            <span className="pill" style={{ background: "var(--muted)" }}>
                              {item.percent}%
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <div className="prototype-row">
                      <input type="text" placeholder="NF" />
                      <input type="text" placeholder="BLOG - 12 Months of Hope" />
                      <input type="text" defaultValue="0" aria-label="Starting percent" />
                      <button className="btn ghost sm" aria-label="Remove">
                        ×
                      </button>
                    </div>
                  </div>

                  <button className="btn ghost sm">+ Add item</button>

                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      margin: "16px 0 6px",
                    }}
                  >
                    What I add to this scrum backlog?
                  </div>

                  <div className="prototype-row" style={{ gridTemplateColumns: "80px 1fr 32px" }}>
                    <input type="text" placeholder="NF" />
                    <input type="text" placeholder="Something for later" />
                    <button className="btn ghost sm" aria-label="Remove">
                      ×
                    </button>
                  </div>

                  <button className="btn ghost sm">+ Add item</button>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      flexWrap: "wrap",
                      marginTop: 18,
                    }}
                  >
                    <button
                      className="btn brand"
                      style={{ height: 40, padding: "0 20px" }}
                      onClick={signIn}
                    >
                      Sign in
                    </button>
                    <button className="btn ghost sm">Copy for Teams</button>
                  </div>
                </>
              ) : signedOff ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "Archivo,Inter,system-ui,sans-serif",
                        fontSize: 18,
                        fontWeight: 700,
                      }}
                    >
                      Signed off
                    </div>
                    <button className="btn sm">Copy</button>
                  </div>
                  <ScrumSection title="What I worked on in this scrum cycle?" items={cycle} />
                  <button
                    className="btn"
                    onClick={() => {
                      setSignedOff(false);
                      setState("active");
                    }}
                  >
                    Sign back in
                  </button>
                </>
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "Archivo,Inter,system-ui,sans-serif",
                        fontSize: 18,
                        fontWeight: 700,
                      }}
                    >
                      Signed in{" "}
                      <span className="mut" style={{ fontWeight: 400, fontSize: 14 }}>
                        9:04 AM
                      </span>
                    </div>
                    <button className="btn sm">Copy</button>
                  </div>

                  <ScrumSection title="This scrum cycle" items={cycle} />

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      borderTop: "1px solid var(--border)",
                      paddingTop: 14,
                    }}
                  >
                    {state === "on_break" || state === "in_meeting" ? (
                      <button className="btn brand" onClick={() => setState("active")}>
                        {state === "on_break" ? "Back from break" : "Back from meeting"}
                      </button>
                    ) : (
                      <>
                        <button className="btn" onClick={() => setState("on_break")}>
                          Break
                        </button>
                        <button className="btn" onClick={() => setState("in_meeting")}>
                          Meeting
                        </button>
                      </>
                    )}
                    <button
                      className="btn brand"
                      style={{ marginLeft: "auto" }}
                      onClick={signOff}
                    >
                      Sign off
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="hd">
              <h2>Today&apos;s timeline</h2>
            </div>
            <div className="bd">
              <Timeline started={started} state={state} />
            </div>
          </div>
        </div>

        <div>
          <div className="summary-grid">
            <Summary label="Status">
              {started ? (
                <StatusPill
                  label={
                    state === "active"
                      ? "Active"
                      : state === "on_break"
                        ? "On break"
                        : state === "in_meeting"
                          ? "In meeting"
                          : "Signed off"
                  }
                  tone={
                    state === "active"
                      ? "active"
                      : state === "on_break"
                        ? "break"
                        : state === "in_meeting"
                          ? "meeting"
                          : "ended"
                  }
                />
              ) : (
                <StatusPill label="Not signed in" tone="offline" />
              )}
            </Summary>
            <Summary label="Signed in">{started ? "9:04 AM" : "–"}</Summary>
            <Summary label="Worked today">{worked}</Summary>
            <Summary label="Schedule">Flexible · 8h target · core 12–4</Summary>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="hd">
              <h2>My requests</h2>
              <a href="/requests" className="mut" style={{ fontSize: 13 }}>
                New request
              </a>
            </div>
            <div className="bd">
              <ul className="list">
                {myRequests.map((request) => (
                  <li
                    key={request.type}
                    style={{ justifyContent: "space-between", fontSize: 13 }}
                  >
                    <span>
                      {request.type}
                      <small className="mut" style={{ display: "block" }}>
                        {request.dates}
                      </small>
                    </span>
                    <span className="mut" style={{ fontSize: 12 }}>
                      {request.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <p className="preview-note">
        Phase 1 preview only. This page currently uses local sample state; Phase 4
        connects the same approved UI to the production scrum/workday tables.
      </p>
    </>
  );
}

function ScrumSection({
  title,
  items,
}: {
  title: string;
  items: Array<{ project: string; title: string; percent: number }>;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <ul className="list">
        {items.map((item) => (
          <li key={`${title}-${item.project}-${item.title}`}>
            <span style={{ flex: 1 }}>
              {item.project} — {item.title}
            </span>
            <span className="pill" style={{ background: "var(--muted)" }}>
              {item.percent}%
            </span>
          </li>
        ))}
      </ul>
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
    <div className="card" style={{ padding: "10px 12px" }}>
      <div className="mut" style={{ fontSize: 12 }}>
        {label}
      </div>
      <div style={{ fontWeight: 600, marginTop: 3 }}>{children}</div>
    </div>
  );
}

function Timeline({ started, state }: { started: boolean; state: DayState }) {
  return (
    <>
      <div className="strip big">
        {started ? (
          <>
            <i style={{ left: "8.9%", width: "16%", background: "var(--active)" }} />
            <i style={{ left: "25%", width: "6%", background: "var(--meeting)" }} />
            <i style={{ left: "31%", width: "17%", background: "var(--active)" }} />
            <i style={{ left: "48%", width: "5%", background: "var(--break)" }} />
            <i
              style={{
                left: "53%",
                width: state === "workday_ended" ? "17%" : "28%",
                background:
                  state === "on_break"
                    ? "var(--break)"
                    : state === "in_meeting"
                      ? "var(--meeting)"
                      : "var(--active)",
              }}
            />
            <i className="now" style={{ left: "58%" }} />
          </>
        ) : null}
      </div>
      <div className="hours">
        <span>8 AM</span>
        <span>10 AM</span>
        <span>12 PM</span>
        <span>2 PM</span>
        <span>4 PM</span>
        <span>6 PM</span>
        <span>8 PM</span>
      </div>
      <div className="legend">
        <span><i className="dot" style={{ background: "var(--active)" }} />Active</span>
        <span><i className="dot" style={{ background: "var(--break)" }} />Break</span>
        <span><i className="dot" style={{ background: "var(--meeting)" }} />Meeting</span>
      </div>
    </>
  );
}
