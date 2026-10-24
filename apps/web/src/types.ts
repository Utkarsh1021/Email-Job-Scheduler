export type User = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

export type SlackStatus =
  | { connected: true; teamName: string | null; channelId: string | null }
  | { connected: false };

export type MeResponse = {
  user: User;
  slack: SlackStatus;
};

export type Sender = {
  id: string;
  name: string;
  fromEmail: string;
  fromName: string;
  hourlyLimit: number;
  isDefault: boolean;
};

export type EmailRow = {
  id: string;
  email: string;
  subject: string;
  status: "scheduled" | "processing" | "sent" | "failed";
  scheduledAt: string;
  sentAt: string | null;
  error: string | null;
  previewUrl: string | null;
  attemptCount: number;
  sender: { name: string; fromEmail: string };
};

export type EmailListResponse = {
  emails: EmailRow[];
  total: number;
  page: number;
  pageSize: number;
  source: string;
};
