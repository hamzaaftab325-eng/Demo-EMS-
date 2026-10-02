import Link from "next/link";
import { PageHead, StatusPill } from "@/components/shared/prototype";
import { requireRole } from "@/lib/auth/current-profile";
import {
  getAuditSearch,
  type AuditRow,
} from "@/lib/data/admin";
import { ADMIN_ROLES } from "@/lib/navigation";
import type { Json } from "@/types/database";

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function validDate(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function positivePage(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function pretty(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toneForAction(action: string) {
  const normalized = action.toLowerCase();

  if (
    normalized.includes("delete") ||
    normalized.includes("deactivat") ||
    normalized.includes("reject") ||
    normalized.includes("fail")
  ) {
    return "red" as const;
  }

  if (
    normalized.includes("create") ||
    normalized.includes("activate") ||
    normalized.includes("approved") ||
    normalized.includes("sent")
  ) {
    return "active" as const;
  }

  if (
    normalized.includes("update") ||
    normalized.includes("assign") ||
    normalized.includes("reassign") ||
    normalized.includes("correct")
  ) {
    return "meeting" as const;
  }

  return "offline" as const;
}

function formatDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function jsonObject(value: Json | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, Json | undefined>;
}

function sameValue(left: Json | undefined, right: Json | undefined) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function displayValue(value: Json | undefined) {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return JSON.stringify(value);
}

function changedFields(row: AuditRow) {
  const before = jsonObject(row.beforeData);
  const after = jsonObject(row.afterData);
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);

  return Array.from(keys)
    .filter((key) => !sameValue(before?.[key], after?.[key]))
    .sort()
    .map((key) => ({
      key,
      before: before?.[key],
      after: after?.[key],
    }));
}

function auditHref(
  params: Record<string, string>,
  page: number,
) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) next.set(key, value);
  }
  next.set("page", String(page));
  return "/audit?" + next.toString();
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const current = await requireRole(ADMIN_ROLES);
  const params = await searchParams;

  const query = (single(params.q) ?? "").trim();
  const action = (single(params.action) ?? "").trim();
  const entityType = (single(params.entity) ?? "").trim();
  const actorId = (single(params.actor) ?? "").trim();
  const fromDate = validDate(single(params.from));
  const toDate = validDate(single(params.to));
  const page = positivePage(single(params.page));
  const pageSize = 25;

  let result = await getAuditSearch(current, {
    query,
    action,
    entityType,
    actorId,
    fromDate,
    toDate,
    page,
    pageSize,
  });

  const totalPages = Math.max(1, Math.ceil(result.total / pageSize));
  const safePage = Math.min(page, totalPages);

  if (result.total > 0 && safePage !== page) {
    result = await getAuditSearch(current, {
      query,
      action,
      entityType,
      actorId,
      fromDate,
      toDate,
      page: safePage,
      pageSize,
    });
  }
  const preserved = {
    q: query,
    action,
    entity: entityType,
    actor: actorId,
    from: fromDate,
    to: toDate,
  };
  const start = result.total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, result.total);

  return (
    <>
      <PageHead
        title="Audit log"
        subtitle="Immutable administrative and workflow history"
        actions={
          <Link className="btn" href="/settings">
            Settings
          </Link>
        }
      />

      <div className="phase7-stats admin-audit-stats">
        <div className="stat">
          <span className="l">Matching events</span>
          <div className="n">{result.total}</div>
        </div>
        <div className="stat">
          <span className="l">Showing</span>
          <div className="n">
            {start}–{end}
          </div>
        </div>
        <div className="stat">
          <span className="l">Page</span>
          <div className="n">
            {safePage}/{totalPages}
          </div>
        </div>
      </div>

      <form className="admin-audit-filters" action="/audit">
        <label className="f admin-audit-search">
          <span>Search</span>
          <input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Action, reason, entity or actor"
          />
        </label>

        <label className="f">
          <span>Action</span>
          <input
            name="action"
            defaultValue={action}
            placeholder="employee_created"
          />
        </label>

        <label className="f">
          <span>Entity</span>
          <input
            name="entity"
            defaultValue={entityType}
            placeholder="profile"
          />
        </label>

        <label className="f">
          <span>Actor</span>
          <select name="actor" defaultValue={actorId}>
            <option value="">All actors</option>
            {result.actors.map((actor) => (
              <option value={actor.id} key={actor.id}>
                {actor.fullName} · {actor.employeeCode}
              </option>
            ))}
          </select>
        </label>

        <label className="f">
          <span>From</span>
          <input type="date" name="from" defaultValue={fromDate} />
        </label>

        <label className="f">
          <span>To</span>
          <input type="date" name="to" defaultValue={toDate} />
        </label>

        <button className="btn" type="submit">
          Apply
        </button>

        {Object.values(preserved).some(Boolean) ? (
          <Link className="btn ghost" href="/audit">
            Clear
          </Link>
        ) : null}
      </form>

      <div className="admin-audit-list">
        {result.rows.map((row) => {
          const changes = changedFields(row);

          return (
            <article className="card admin-audit-row" key={row.id}>
              <div className="bd">
                <div className="admin-audit-head">
                  <div className="admin-audit-title">
                    <StatusPill
                      label={pretty(row.action)}
                      tone={toneForAction(row.action)}
                    />
                    <span className="mut">
                      {pretty(row.entityType)}
                      {row.entityId ? " · " + row.entityId : ""}
                    </span>
                  </div>

                  <time dateTime={row.createdAt}>
                    {formatDateTime(row.createdAt, current.timezone)}
                  </time>
                </div>

                <div className="admin-audit-meta">
                  <span>
                    <b>Actor</b>{" "}
                    {row.actorName
                      ? row.actorName +
                        (row.actorCode ? " · " + row.actorCode : "")
                      : "System"}
                  </span>
                  <span>
                    <b>Reason</b> {row.reason ?? "No reason recorded"}
                  </span>
                </div>

                {changes.length > 0 ? (
                  <details className="admin-audit-details">
                    <summary>
                      View {changes.length} changed{" "}
                      {changes.length === 1 ? "field" : "fields"}
                    </summary>
                    <div className="admin-audit-diff">
                      <div className="admin-audit-diff-head">
                        <span>Field</span>
                        <span>Before</span>
                        <span>After</span>
                      </div>
                      {changes.map((change) => (
                        <div className="admin-audit-diff-row" key={change.key}>
                          <strong>{pretty(change.key)}</strong>
                          <code>{displayValue(change.before)}</code>
                          <code>{displayValue(change.after)}</code>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : row.beforeData || row.afterData ? (
                  <details className="admin-audit-details">
                    <summary>View recorded data</summary>
                    <div className="admin-audit-raw">
                      {row.beforeData ? (
                        <div>
                          <strong>Before</strong>
                          <pre>{JSON.stringify(row.beforeData, null, 2)}</pre>
                        </div>
                      ) : null}
                      {row.afterData ? (
                        <div>
                          <strong>After</strong>
                          <pre>{JSON.stringify(row.afterData, null, 2)}</pre>
                        </div>
                      ) : null}
                    </div>
                  </details>
                ) : null}
              </div>
            </article>
          );
        })}

        {result.rows.length === 0 ? (
          <div className="card">
            <div className="bd request-empty">
              <strong>No audit events match these filters.</strong>
              <span className="mut">
                Change the action, entity, actor, dates or search text.
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {totalPages > 1 ? (
        <nav className="admin-audit-pager" aria-label="Audit pages">
          {safePage > 1 ? (
            <Link
              className="btn ghost"
              href={auditHref(preserved, safePage - 1)}
            >
              Previous
            </Link>
          ) : (
            <span />
          )}

          <span className="mut">
            Page {safePage} of {totalPages}
          </span>

          {safePage < totalPages ? (
            <Link
              className="btn ghost"
              href={auditHref(preserved, safePage + 1)}
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}

      <p className="preview-note">
        Audit records are immutable and isolated to the current EMS
        environment. Super Admins can review them but cannot edit or delete
        them.
      </p>
    </>
  );
}
