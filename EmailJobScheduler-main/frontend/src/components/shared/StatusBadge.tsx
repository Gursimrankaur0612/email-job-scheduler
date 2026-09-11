import { ClockIcon } from "@/components/icons";
import type { EmailStatus } from "@/lib/emails";

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

interface StatusBadgeProps {
  status: EmailStatus;
  scheduledAt?: string;
}

export function StatusBadge({ status, scheduledAt }: StatusBadgeProps) {
  if (status === "sent") {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
        Sent
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
      <ClockIcon className="h-3 w-3" />
      {scheduledAt ? timeFormatter.format(new Date(scheduledAt)) : status}
    </span>
  );
}
