import Link from "next/link";
import { PageHead, StatusPill } from "@/components/shared/prototype";
import { RequestSubmitButton } from "@/components/requests/request-submit-button";
import { requireCurrentProfile } from "@/lib/auth/current-profile";
import { getNotifications } from "@/lib/data/notifications";
import {
  markAllNotificationsRead,
  markNotificationRead,
  openRequestNotification,
} from "./actions";

export default async function NotificationsPage() {
  const current = await requireCurrentProfile();
  const notifications = await getNotifications(current);
  const unread = notifications.filter((item) => !item.isRead).length;

  return (
    <>
      <PageHead
        title="Notifications"
        subtitle="Request approvals, decisions and workflow updates"
        actions={
          unread > 0 ? (
            <form action={markAllNotificationsRead}>
              <RequestSubmitButton pendingLabel="Marking…">
                Mark all read
              </RequestSubmitButton>
            </form>
          ) : null
        }
      />

      <div className="notification-list">
        {notifications.map((item) => (
          <article
            className={
              item.isRead
                ? "card notification-item"
                : "card notification-item notification-item-unread"
            }
            key={item.id}
          >
            <div className="bd">
              <div className="notification-item-head">
                <div>
                  <h2>{item.title}</h2>
                  <p className="mut">
                    {new Intl.DateTimeFormat("en-US", {
                      timeZone: current.timezone,
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(item.createdAt))}
                  </p>
                </div>
                <StatusPill
                  label={item.isRead ? "Read" : "New"}
                  tone={item.isRead ? "offline" : "meeting"}
                />
              </div>

              <p className="notification-message">{item.message}</p>

              <div className="notification-actions">
                {item.entityType === "request" && item.entityId ? (
                  <form action={openRequestNotification}>
                    <input type="hidden" name="notification_id" value={item.id} />
                    <input type="hidden" name="request_id" value={item.entityId} />
                    <RequestSubmitButton
                      className="btn ghost"
                      pendingLabel="Opening…"
                    >
                      Open request
                    </RequestSubmitButton>
                  </form>
                ) : null}

                {!item.isRead ? (
                  <form action={markNotificationRead}>
                    <input
                      type="hidden"
                      name="notification_id"
                      value={item.id}
                    />
                    <RequestSubmitButton pendingLabel="Marking…">
                      Mark read
                    </RequestSubmitButton>
                  </form>
                ) : null}
              </div>
            </div>
          </article>
        ))}

        {notifications.length === 0 ? (
          <div className="card">
            <div className="bd request-empty">
              <strong>No notifications yet.</strong>
              <span className="mut">
                Request submissions, approvals, rejections and reassignments
                will appear here.
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
