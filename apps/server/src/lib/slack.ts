import { prisma } from "./prisma.js";
import { decrypt, encrypt } from "./crypto.js";
import { env } from "../config/env.js";

export function slackAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: "chat:write,incoming-webhook",
    user_scope: "",
    redirect_uri: env.SLACK_CALLBACK_URL,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

type SlackOauthResponse = {
  ok: boolean;
  error?: string;
  access_token?: string;
  team?: { id: string; name: string };
  incoming_webhook?: { url: string; channel_id: string; channel: string };
};

export async function exchangeSlackCode(code: string): Promise<SlackOauthResponse> {
  const body = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    client_secret: env.SLACK_CLIENT_SECRET,
    code,
    redirect_uri: env.SLACK_CALLBACK_URL,
  });
  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return (await res.json()) as SlackOauthResponse;
}

export async function upsertSlackConnection(userId: string, data: SlackOauthResponse) {
  if (!data.ok || !data.access_token) {
    throw new Error(data.error || "Slack OAuth failed");
  }
  const payload = {
    teamId: data.team?.id,
    teamName: data.team?.name,
    botToken: encrypt(data.access_token),
    webhookUrl: data.incoming_webhook?.url ? encrypt(data.incoming_webhook.url) : null,
    channelId: data.incoming_webhook?.channel_id ?? null,
  };
  await prisma.slackConnection.upsert({
    where: { userId },
    create: { userId, ...payload },
    update: payload,
  });
}

export async function notifyQuotaHit(opts: {
  userId: string;
  senderName: string;
  senderId: string;
  window: string;
  limit: number;
}) {
  const conn = await prisma.slackConnection.findUnique({ where: { userId: opts.userId } });
  if (!conn) return false;

  const text =
    `Hourly email limit reached for sender *${opts.senderName}* (\`${opts.senderId}\`).\n` +
    `Window \`${opts.window}\` UTC is at ${opts.limit} emails. Remaining jobs are delayed into the next hour — nothing was dropped.`;

  try {
    if (conn.webhookUrl) {
      const url = decrypt(conn.webhookUrl);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) return true;
      console.error("Slack webhook failed", res.status, await res.text());
    }

    const token = decrypt(conn.botToken);
    if (!conn.channelId) {
      console.warn("Slack connected but no channel/webhook; skipping notify");
      return false;
    }
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: conn.channelId, text }),
    });
    const json = (await res.json()) as { ok: boolean; error?: string };
    if (!json.ok) {
      console.error("Slack chat.postMessage failed", json.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Slack notify failed", err);
    return false;
  }
}
