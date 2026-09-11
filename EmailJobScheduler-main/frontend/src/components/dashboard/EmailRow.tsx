import { StarIcon } from "@/components/icons";
import { TableRow } from "@/components/shared/Table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { ScheduledEmail } from "@/lib/emails";
import { stripHtml } from "@/lib/text";

interface EmailRowProps {
  email: ScheduledEmail;
  onSelect: (email: ScheduledEmail) => void;
}

export function EmailRow({ email, onSelect }: EmailRowProps) {
  return (
    <TableRow onClick={() => onSelect(email)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <span className="truncate text-sm text-gray-500">{email.recipient}</span>
          <StatusBadge status={email.status} scheduledAt={email.scheduledAt} />
        </div>

        <p className="mt-1 truncate text-sm font-bold text-gray-900">{email.subject}</p>
        <p className="mt-0.5 truncate text-sm text-gray-400">{stripHtml(email.body)}</p>
      </div>

      <button
        type="button"
        aria-label="Star"
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 rounded-full p-2 text-gray-300 transition hover:bg-gray-100 hover:text-gray-400"
      >
        <StarIcon className="h-4 w-4" />
      </button>
    </TableRow>
  );
}
