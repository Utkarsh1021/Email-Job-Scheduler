import type { EmailListResponse, MeResponse, Sender } from "../types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  me: () => request<MeResponse>("/auth/me"),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  senders: () => request<{ senders: Sender[]; envHourlyLimit: number }>("/api/senders"),
  emails: (params: {
    tab: "scheduled" | "sent";
    q?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const qs = new URLSearchParams({
      tab: params.tab,
      page: String(params.page ?? 1),
    });
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.q) qs.set("q", params.q);
    return request<EmailListResponse>(`/api/emails?${qs.toString()}`);
  },
  createCampaign: (body: {
    subject: string;
    body: string;
    recipients: string[];
    startTime: string;
    delayMs: number;
    hourlyLimit: number;
    senderId?: string;
  }) =>
    request<{ campaign: { id: string; recipientCount: number } }>("/api/campaigns", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  disconnectSlack: () => request<{ ok: boolean }>("/auth/slack", { method: "DELETE" }),
  createEtherealSender: () =>
    request<{ sender: Sender }>("/api/senders/ethereal", { method: "POST" }),
};
