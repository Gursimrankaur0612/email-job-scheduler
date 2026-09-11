export interface Sender {
  id: string;
  displayName: string;
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedSenders {
  data: Sender[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function fetchSenders(): Promise<Sender[]> {
  const res = await fetch(`${API_BASE_URL}/senders?pageSize=100`);
  if (!res.ok) {
    throw new Error(`Failed to fetch senders (${res.status})`);
  }
  const json: PaginatedSenders = await res.json();
  return json.data;
}
