"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, PaperclipIcon } from "@/components/icons";
import { SenderDropdown } from "@/components/compose/SenderDropdown";
import { RecipientsField } from "@/components/compose/RecipientsField";
import { SchedulePopover } from "@/components/compose/SchedulePopover";
import { RichTextEditor } from "@/components/compose/RichTextEditor";
import { Toast, type ToastState } from "@/components/shared/Toast";
import { fetchSenders, type Sender } from "@/lib/senders";
import { scheduleEmail } from "@/lib/emails";
import { stripHtml } from "@/lib/text";

export function ComposeView() {
  const router = useRouter();

  const [senders, setSenders] = useState<Sender[]>([]);
  const [sendersLoading, setSendersLoading] = useState(true);
  const [senderId, setSenderId] = useState<string | null>(null);

  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [delaySeconds, setDelaySeconds] = useState("");
  const [hourlyLimit, setHourlyLimit] = useState("");
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);

  // Attachments are visual-only for now — the backend has no attachment
  // storage yet, so these are counted on the badge but not sent.
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    fetchSenders()
      .then((list) => {
        setSenders(list);
        setSenderId((current) => current ?? list[0]?.id ?? null);
      })
      .catch(() => setToast({ type: "error", message: "Couldn't load senders. Is the backend running?" }))
      .finally(() => setSendersLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  function handleAttachmentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length > 0) {
      setAttachments((prev) => [...prev, ...files]);
    }
  }

  async function handleSubmit() {
    if (!senderId) {
      setToast({ type: "error", message: "Select a sender before sending." });
      return;
    }
    if (recipients.length === 0) {
      setToast({ type: "error", message: "Add at least one recipient." });
      return;
    }
    if (!subject.trim()) {
      setToast({ type: "error", message: "Add a subject." });
      return;
    }
    if (!stripHtml(bodyHtml)) {
      setToast({ type: "error", message: "Write a message body." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await scheduleEmail({
        senderId,
        subject,
        body: bodyHtml,
        recipients,
        scheduledAt: (scheduledAt ?? new Date()).toISOString(),
        delayBetweenEmailsMs: delaySeconds ? Number(delaySeconds) * 1000 : undefined,
        hourlyLimit: hourlyLimit ? Number(hourlyLimit) : undefined,
      });

      setToast({
        type: "success",
        message: `${scheduledAt ? "Scheduled" : "Sent"} ${res.count} email${res.count === 1 ? "" : "s"}.`,
      });
      setTimeout(() => router.push("/dashboard"), 1200);
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to schedule emails." });
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="flex items-center gap-4 border-b border-gray-200 bg-white px-6 py-4">
        <button
          type="button"
          aria-label="Back"
          onClick={() => router.back()}
          className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Compose New Email</h1>

        <div className="ml-auto flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              aria-label="Attach files"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50"
            >
              <PaperclipIcon className="h-5 w-5" />
            </button>
            {attachments.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-green-600 px-1 text-[10px] font-semibold text-white">
                {attachments.length}
              </span>
            )}
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleAttachmentChange} />
          </div>

          <SchedulePopover scheduledAt={scheduledAt} onSchedule={setScheduledAt} />

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Sending…" : scheduledAt ? "Send Later" : "Send"}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-6 py-8">
        <div className="flex items-center gap-3">
          <label className="w-14 shrink-0 text-xs font-medium text-gray-500">From</label>
          <SenderDropdown senders={senders} loading={sendersLoading} value={senderId} onChange={setSenderId} />
        </div>

        <RecipientsField recipients={recipients} onChange={setRecipients} />

        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="w-full border-b border-gray-300 bg-transparent pb-2 text-lg text-gray-900 placeholder:text-gray-400 focus:border-green-500 focus:outline-none"
        />

        <div className="flex gap-6">
          <div>
            <label className="block text-xs font-medium text-gray-500">Delay between 2 emails (sec)</label>
            <input
              type="number"
              min="0"
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(e.target.value)}
              placeholder="00"
              className="mt-1 w-20 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">Hourly Limit</label>
            <input
              type="number"
              min="0"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(e.target.value)}
              placeholder="00"
              className="mt-1 w-20 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-100"
            />
          </div>
        </div>

        <RichTextEditor value={bodyHtml} onChange={setBodyHtml} />
      </main>

      {toast && <Toast toast={toast} />}
    </div>
  );
}
