"use client";

import { ArchiveIcon, ArrowLeftIcon, ChevronDownIcon, StarIcon, TrashIcon } from "@/components/icons";
import type { ScheduledEmail } from "@/lib/emails";

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

interface EmailDetailPanelProps {
  email: ScheduledEmail;
  onBack: () => void;
}

export function EmailDetailPanel({ email, onBack }: EmailDetailPanelProps) {
  const isSent = email.status === "sent";
  const timeValue = isSent ? email.sentAt : email.scheduledAt;
  const senderName = email.sender?.displayName ?? "Unknown sender";
  const senderEmail = email.sender?.email ?? "";
  const initial = senderName.charAt(0).toUpperCase();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-100 px-6 py-5">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Back"
              onClick={onBack}
              className="shrink-0 rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <p className="truncate text-lg font-bold text-gray-900">{email.subject}</p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label="Star"
              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            >
              <StarIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Archive"
              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            >
              <ArchiveIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Delete"
              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
            <span className="mx-1 h-5 w-px bg-gray-200" />
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700">
              {initial}
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl">
          {isSent && email.previewUrl && (
            <a
              href={email.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-medium text-green-600 underline decoration-green-200 underline-offset-2 transition hover:text-green-700"
            >
              View in Ethereal
            </a>
          )}

          <div className="mt-4 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm">
                  <span className="font-bold text-gray-900">{senderName}</span>{" "}
                  <span className="text-gray-400">&lt;{senderEmail}&gt;</span>
                </p>
                <button
                  type="button"
                  className="mt-0.5 flex items-center gap-1 text-xs text-gray-400 transition hover:text-gray-600"
                >
                  to me
                  <ChevronDownIcon className="h-3 w-3" />
                </button>
              </div>
            </div>
            {timeValue && (
              <span className="shrink-0 text-xs text-gray-400">{dateTimeFormatter.format(new Date(timeValue))}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="rendered-email-body mx-auto w-full max-w-3xl text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: email.body }} />
      </div>
    </div>
  );
}
