"use client";

import { useEffect, useState } from "react";
import type { Session } from "next-auth";
import { Sidebar, type TabKey } from "@/components/dashboard/Sidebar";
import { MainPanel } from "@/components/dashboard/MainPanel";
import { fetchEmails } from "@/lib/emails";

export function DashboardClient({ user }: { user: Session["user"] }) {
  const [activeTab, setActiveTab] = useState<TabKey>("scheduled");
  const [counts, setCounts] = useState<{ scheduled: number | null; sent: number | null }>({
    scheduled: null,
    sent: null,
  });

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchEmails("scheduled", { pageSize: 1 }), fetchEmails("sent", { pageSize: 1 })])
      .then(([scheduledRes, sentRes]) => {
        if (!cancelled) {
          setCounts({ scheduled: scheduledRes.pagination.total, sent: sentRes.pagination.total });
        }
      })
      .catch(() => {
        // Sidebar badges just stay blank if counts can't be loaded; the main
        // panel surfaces the real error for the active tab.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleCountChange(tab: TabKey, total: number) {
    setCounts((prev) => ({ ...prev, [tab]: total }));
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />
      <MainPanel activeTab={activeTab} onCountChange={handleCountChange} />
    </div>
  );
}
