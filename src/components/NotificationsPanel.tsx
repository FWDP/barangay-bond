import React, { useState, useEffect } from "react";
import { Bell, Inbox, Check } from "lucide-react";
import { db } from "../services/firebase";
import { collection, query, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { LoadingSpinner } from "./LoadingSpinner";

interface NotificationsPanelProps {
  profile: any;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ profile }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.uid) return;

    const q = query(collection(db, "notifications"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const matchesUser = data.targetUid === profile.uid;
          const matchesBarangay = !!data.barangayId && data.barangayId !== "N/A" && data.barangayId === profile.barangayId;
          const isBroadcast = !data.targetUid || data.targetUid === "all";

          if (matchesUser || matchesBarangay || isBroadcast) {
            list.push({ id: docSnap.id, ...data });
          }
        });

        list.sort((a, b) => {
          const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
          const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
          return timeB - timeA;
        });

        setNotifications(list);
        setLoading(false);
      },
      (err) => {
        console.error("Notifications subscription error:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profile]);

  const handleMarkAsRead = async (id: string) => {
    // Optimistic local state update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      const docRef = doc(db, "notifications", id);
      await updateDoc(docRef, { read: true });
    } catch (err: any) {
      console.warn("[Notifications] Firestore sync notice:", err?.message || err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="bank-card">
      <div className="bank-card-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--role-accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--role-accent)" }}>
            <Bell size={18} />
          </div>
          <div>
            <h2 className="bank-card-title">Activity Notifications</h2>
            <div className="bank-card-subtitle">Live alerts on voting milestones and project proposals</div>
          </div>
        </div>
        <span className="badge badge-success">
          {unreadCount} Unread
        </span>
      </div>

      <div className="bank-card-body">
        {loading ? (
          <div style={{ padding: "2rem 0", display: "flex", justifyContent: "center" }}>
            <LoadingSpinner size="md" label="Retrieving notifications..." />
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-muted)" }}>
            <Inbox size={40} style={{ opacity: 0.35, margin: "0 auto 0.75rem auto" }} />
            <p style={{ fontSize: "0.88rem", margin: 0 }}>No notifications found for your account.</p>
          </div>
        ) : (
          <div className="bank-ledger-list">
            {notifications.map((n) => {
              const timeVal = n.createdAt || n.timestamp;
              return (
                <div
                  key={n.id}
                  className="bank-ledger-row"
                  style={{
                    background: n.read ? "var(--bg-elevated)" : "var(--bg-hover)",
                    borderColor: n.read ? "var(--border-subtle)" : "var(--role-accent-border)",
                  }}
                >
                  <div className="bank-ledger-left">
                    {!n.read && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--role-accent)", flexShrink: 0 }} />}
                    <div className="bank-ledger-details">
                      <span className="bank-ledger-title">{n.title}</span>
                      <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                        {n.message}
                      </p>
                      <span className="bank-ledger-sub" style={{ marginTop: "0.2rem" }}>
                        {timeVal ? new Date(timeVal).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                    </div>
                  </div>
                  {!n.read && (
                    <div className="bank-ledger-right">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm tap-scale"
                        onClick={() => handleMarkAsRead(n.id)}
                        style={{ height: "30px", fontSize: "0.72rem" }}
                      >
                        <Check size={12} /> Mark Read
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPanel;
