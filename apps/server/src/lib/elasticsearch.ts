import { Client } from "@elastic/elasticsearch";
import { env, EMAILS_INDEX } from "../config/env.js";

export const es = new Client({ node: env.ELASTICSEARCH_URL });

export type EmailDocument = {
  emailId: string;
  userId: string;
  campaignId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
  error: string | null;
};

export async function ensureEmailIndex() {
  const exists = await es.indices.exists({ index: EMAILS_INDEX });
  if (exists) return;
  await es.indices.create({
    index: EMAILS_INDEX,
    mappings: {
      properties: {
        emailId: { type: "keyword" },
        userId: { type: "keyword" },
        campaignId: { type: "keyword" },
        senderId: { type: "keyword" },
        recipient: { type: "text", fields: { raw: { type: "keyword" } } },
        subject: { type: "text" },
        body: { type: "text" },
        status: { type: "keyword" },
        scheduledAt: { type: "date" },
        sentAt: { type: "date" },
        error: { type: "text" },
      },
    },
  });
}

export async function indexEmail(doc: EmailDocument) {
  await es.index({
    index: EMAILS_INDEX,
    id: doc.emailId,
    document: doc,
    refresh: false,
  });
}

export async function bulkIndexEmails(docs: EmailDocument[]) {
  if (docs.length === 0) return;
  const operations = docs.flatMap((doc) => [
    { index: { _index: EMAILS_INDEX, _id: doc.emailId } },
    doc,
  ]);
  await es.bulk({ operations, refresh: false });
}

export async function searchEmails(opts: {
  userId: string;
  q?: string;
  status?: "scheduled" | "sent" | "failed" | "processing";
  from?: number;
  size?: number;
}) {
  const must: object[] = [{ term: { userId: opts.userId } }];
  if (opts.status) {
    must.push({ term: { status: opts.status } });
  } else if (!opts.q) {
    // default: nothing extra
  }
  const query = opts.q
    ? {
        bool: {
          must,
          should: [
            { match: { recipient: opts.q } },
            { match: { subject: opts.q } },
            { match: { body: opts.q } },
            { prefix: { "recipient.raw": opts.q } },
          ],
          minimum_should_match: 1,
        },
      }
    : { bool: { must } };

  const result = await es.search({
    index: EMAILS_INDEX,
    from: opts.from ?? 0,
    size: opts.size ?? 50,
    query,
    sort: [{ scheduledAt: { order: "desc" } }],
  });

  return {
    total:
      typeof result.hits.total === "number"
        ? result.hits.total
        : result.hits.total?.value ?? 0,
    hits: result.hits.hits.map((h) => h._source as EmailDocument),
  };
}
