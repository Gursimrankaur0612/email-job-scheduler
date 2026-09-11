export type EmailStatus = "scheduled" | "sent" | "failed";

export interface EmailSender {
  id: string;
  displayName: string;
  email: string;
}

export interface ScheduledEmail {
  id: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  status: EmailStatus;
  bullmqJobId: string | null;
  createdAt: string;
  sentAt: string | null;
  errorMessage: string | null;
  previewUrl: string | null;
  // Only present on GET /emails/scheduled|sent (POST /emails/schedule's
  // response doesn't include the relation, since it's newly-created rows).
  sender?: EmailSender;
}

export interface PaginatedEmails {
  data: ScheduledEmail[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function fetchEmails(
  status: "scheduled" | "sent",
  params: { page?: number; pageSize?: number } = {},
): Promise<PaginatedEmails> {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));

  const res = await fetch(`${API_BASE_URL}/emails/${status}?${search.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${status} emails (${res.status})`);
  }
  return res.json();
}

export interface ScheduleEmailPayload {
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  scheduledAt: string;
  delayBetweenEmailsMs?: number;
  hourlyLimit?: number;
}

export interface ScheduleEmailResponse {
  count: number;
  scheduledEmails: ScheduledEmail[];
}

export async function scheduleEmail(payload: ScheduleEmailPayload): Promise<ScheduleEmailResponse> {
  const res = await fetch(`${API_BASE_URL}/emails/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    const detailMessage = Array.isArray(errorBody?.details)
      ? errorBody.details.map((d: { path: string; message: string }) => `${d.path}: ${d.message}`).join(", ")
      : null;
    throw new Error(detailMessage ?? errorBody?.error ?? `Failed to schedule email (${res.status})`);
  }

  return res.json();
}
