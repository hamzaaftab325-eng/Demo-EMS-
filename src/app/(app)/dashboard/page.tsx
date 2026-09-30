import { PageHead, Avatar } from "@/components/shared/prototype";

const stats = [
  ["People", "46", "--fg"],
  ["Active", "24", "--active"],
  ["Idle", "5", "--idle"],
  ["Away", "3", "--away"],
  ["On break", "4", "--break"],
  ["Not signed in", "7", "--offline"],
  ["On leave", "3", "--break"],
] as const;

const departments = [
  ["Web", 7, 9],
  ["Content", 5, 8],
  ["Design", 4, 6],
  ["Digital Ads", 4, 7],
  ["Digital Creative", 3, 5],
];

export default function DashboardPage() {
  return (
    <>
      <PageHead title="Dashboard" subtitle="Monday, September 28 · 2:40 PM Karachi" />

      <div className="grid g7" style={{ marginBottom: 16 }}>
        {stats.map(([label, value, color]) => (
          <button className="stat" key={label}>
            <span className="l">
              <i className="dot" style={{ background: `var(${color})` }} />
              {label}
            </span>
            <div className="n">{value}</div>
          </button>
        ))}
      </div>

      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="hd">
            <h2>Departments</h2>
            <a href="/live-view" className="mut" style={{ fontSize: 13 }}>Live view</a>
          </div>
          <div className="bd">
            {departments.map(([name, working, total]) => (
              <div key={name} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontWeight: 500 }}>{name}</span>
                  <span className="mut">{working} of {total} working</span>
                </div>
                <div className="bar" style={{ height: 10 }}>
                  <i style={{ width: `${(working / total) * 100}%`, background: "var(--active)" }} />
                  <i style={{ flex: 1, background: "var(--offline)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid" style={{ gap: 16 }}>
          <div className="card">
            <div className="hd"><h2>Requests waiting for you</h2><a href="/requests" className="mut" style={{ fontSize: 13 }}>Review</a></div>
            <div className="bd">
              <div style={{ fontFamily: "Archivo,Inter,system-ui,sans-serif", fontSize: 32, fontWeight: 700 }}>2</div>
              <p className="mut" style={{ margin: 0, fontSize: 13 }}>Includes final approvals after the lead approved</p>
            </div>
          </div>
          <div className="card">
            <div className="hd"><h2>Obstacles today</h2><a href="/scrum-board" className="mut" style={{ fontSize: 13 }}>Scrum board</a></div>
            <div className="bd">
              <ul className="list">
                <li style={{ alignItems: "flex-start" }}>
                  <Avatar initials="HA" color="#3B82F6" size={26} />
                  <div><div style={{ fontWeight: 500, fontSize: 13 }}>Hamza Aftab</div><div className="mut" style={{ fontSize: 12.5 }}>Waiting for final hero assets.</div></div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="hd"><h2>Expected but not signed in</h2></div>
          <div className="bd">
            <ul className="list">
              <li style={{ justifyContent: "space-between" }}><span>Sadaf Riaz</span><span className="mut" style={{ fontSize: 12.5 }}>Expected by 9:15 AM</span></li>
              <li style={{ justifyContent: "space-between" }}><span>Farah Waheed</span><span className="mut" style={{ fontSize: 12.5 }}>Expected by 9:15 AM</span></li>
            </ul>
            <p className="mut" style={{ fontSize: 12.5, margin: "10px 0 0" }}>4 on flexible hours have not signed in yet. That is fine, they can start any time.</p>
          </div>
        </div>
        <div className="card">
          <div className="hd"><h2>Hours against target</h2></div>
          <div className="bd">
            {["Hamza Aftab","Iqra Noor","Tayyaba Hafeez","Sadaf Riaz"].map((name, i) => (
              <div key={name} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{name}</span><span className="mut">{(3.8 + i * .6).toFixed(1)}h / 8h</span>
                </div>
                <div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${48 + i * 9}%`, background: "var(--cyan)" }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
