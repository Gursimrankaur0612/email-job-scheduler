"use client";

import { useCallback, useEffect, useState } from "react";
import { FilterIcon, RefreshIcon, SearchIcon } from "@/components/icons";
import { EmailRow } from "@/components/dashboard/EmailRow";
import { EmailListSkeleton } from "@/components/dashboard/EmailListSkeleton";
import { Table } from "@/components/shared/Table";
import { EmptyState } from "@/components/shared/EmptyState";
import { EmailDetailPanel } from "@/components/shared/EmailDetailPanel";
import { fetchEmails, type ScheduledEmail } from "@/lib/emails";
import type { TabKey } from "@/components/dashboard/Sidebar";

interface MainPanelProps {
  activeTab: TabKey;
  onCountChange: (tab: TabKey, total: number) => void;
}

const TAB_COPY: Record<TabKey, { title: string; empty: string }> = {
  scheduled: { title: "Scheduled", empty: "No scheduled emails yet." },
  sent: { title: "Sent", empty: "No sent emails yet." },
};

export function MainPanel({ activeTab, onCountChange }: MainPanelProps) {
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<ScheduledEmail | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    fetchEmails(activeTab, { pageSize: 50 })
      .then((res) => {
        setEmails(res.data);
        onCountChange(activeTab, res.pagination.total);
      })
      .catch(() => {
        setError(`Couldn't load ${activeTab} emails. Is the backend running on localhost:4000?`);
      })
      .finally(() => setLoading(false));
    // onCountChange is a stable setter-derived callback from the parent; omitting it
    // from deps avoids refetching on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    load();
  }, [load]);

  // Switching tabs while a detail view is open should return to the list,
  // not leave a stale selection from the other tab showing.
  useEffect(() => {
    setSelectedEmail(null);
  }, [activeTab]);

  if (selectedEmail) {
    return (
      <main className="flex flex-1 flex-col overflow-y-auto">
        <EmailDetailPanel email={selectedEmail} onBack={() => setSelectedEmail(null)} />
      </main>
    );
  }

  const copy = TAB_COPY[activeTab];

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-200 bg-white px-6 py-4">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Search ${copy.title.toLowerCase()} emails...`}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-100"
          />
        </div>
        <button
          type="button"
          aria-label="Filter"
          className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50"
        >
          <FilterIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Refresh"
          onClick={load}
          className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50"
        >
          <RefreshIcon className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <EmailListSkeleton />
      ) : error ? (
        <EmptyState title={error} />
      ) : emails.length === 0 ? (
        <EmptyState title={copy.empty} />
      ) : (
        <Table>
          {emails.map((email) => (
            <EmailRow key={email.id} email={email} onSelect={setSelectedEmail} />
          ))}
        </Table>
      )}
    </main>
  );
}
