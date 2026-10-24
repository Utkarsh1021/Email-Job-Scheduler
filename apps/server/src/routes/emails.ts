import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { ah } from "../middleware/async.js";
import { prisma } from "../lib/prisma.js";
import { searchEmails } from "../lib/elasticsearch.js";

export const emailsRouter = Router();
emailsRouter.use(requireAuth);

const listQuery = z.object({
  tab: z.enum(["scheduled", "sent"]).default("scheduled"),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

emailsRouter.get("/", ah(async (req, res) => {
  const query = listQuery.parse(req.query);
  const skip = (query.page - 1) * query.pageSize;

  if (query.q && query.q.trim()) {
    try {
      const statuses =
        query.tab === "scheduled" ? ["scheduled", "processing"] : ["sent", "failed"];
      const results = await Promise.all(
        statuses.map((status) =>
          searchEmails({
            userId: req.user!.id,
            q: query.q,
            status: status as "scheduled" | "processing" | "sent" | "failed",
            from: 0,
            size: query.pageSize,
          }),
        ),
      );
      const ids = [...new Set(results.flatMap((r) => r.hits.map((h) => h.emailId)))];
      const emails = await prisma.email.findMany({
        where: { id: { in: ids }, campaign: { userId: req.user!.id } },
        include: {
          campaign: { select: { subject: true, sender: { select: { name: true, fromEmail: true } } } },
        },
        orderBy: { scheduledAt: "desc" },
      });
      res.json({
        emails: emails.map(serialize),
        total: results.reduce((sum, r) => sum + r.total, 0),
        page: query.page,
        pageSize: query.pageSize,
        source: "elasticsearch",
      });
      return;
    } catch (err) {
      console.warn("Elasticsearch search failed; falling back to Postgres", err);
    }
  }

  const statusFilter =
    query.tab === "scheduled"
      ? { in: ["scheduled" as const, "processing" as const] }
      : { in: ["sent" as const, "failed" as const] };

  const q = query.q?.trim();
  const where = {
    campaign: { userId: req.user!.id },
    status: statusFilter,
    ...(q
      ? {
          OR: [
            { recipient: { contains: q, mode: "insensitive" as const } },
            { campaign: { subject: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [total, emails] = await Promise.all([
    prisma.email.count({ where }),
    prisma.email.findMany({
      where,
      include: {
        campaign: {
          select: { subject: true, sender: { select: { name: true, fromEmail: true } } },
        },
      },
      orderBy:
        query.tab === "sent" ? { sentAt: "desc" } : { scheduledAt: "asc" },
      skip,
      take: query.pageSize,
    }),
  ]);

  res.json({
    emails: emails.map(serialize),
    total,
    page: query.page,
    pageSize: query.pageSize,
    source: "postgres",
  });
}));

function serialize(email: {
  id: string;
  recipient: string;
  status: string;
  scheduledAt: Date;
  sentAt: Date | null;
  error: string | null;
  previewUrl: string | null;
  attemptCount: number;
  campaign: { subject: string; sender: { name: string; fromEmail: string } };
}) {
  return {
    id: email.id,
    email: email.recipient,
    subject: email.campaign.subject,
    status: email.status,
    scheduledAt: email.scheduledAt,
    sentAt: email.sentAt,
    error: email.error,
    previewUrl: email.previewUrl,
    attemptCount: email.attemptCount,
    sender: email.campaign.sender,
  };
}
