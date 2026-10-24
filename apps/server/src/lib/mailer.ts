import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "../config/env.js";
import { prisma } from "./prisma.js";
import type { Sender } from "@prisma/client";

const transporters = new Map<string, Transporter>();

export async function ensureDefaultSender(userId: string): Promise<Sender> {
  const existing = await prisma.sender.findFirst({
    where: { userId, isDefault: true },
  });
  if (existing) return existing;

  let user = env.ETHEREAL_USER;
  let pass = env.ETHEREAL_PASS;
  if (!user || !pass) {
    const account = await nodemailer.createTestAccount();
    user = account.user;
    pass = account.pass;
  }

  return prisma.sender.create({
    data: {
      userId,
      name: "Ethereal default",
      fromName: "Outbox Scheduler",
      fromEmail: user,
      smtpHost: env.ETHEREAL_HOST,
      smtpPort: env.ETHEREAL_PORT,
      smtpUser: user,
      smtpPass: pass,
      hourlyLimit: env.MAX_EMAILS_PER_HOUR_PER_SENDER,
      isDefault: true,
    },
  });
}

export function getTransporter(sender: Sender): Transporter {
  const cached = transporters.get(sender.id);
  if (cached) return cached;
  const transporter = nodemailer.createTransport({
    host: sender.smtpHost,
    port: sender.smtpPort,
    secure: sender.smtpPort === 465,
    auth: { user: sender.smtpUser, pass: sender.smtpPass },
  });
  transporters.set(sender.id, transporter);
  return transporter;
}

export async function sendEmail(opts: {
  sender: Sender;
  to: string;
  subject: string;
  body: string;
}) {
  const transporter = getTransporter(opts.sender);
  const info = await transporter.sendMail({
    from: `"${opts.sender.fromName}" <${opts.sender.fromEmail}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.body,
    html: `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(opts.body)}</pre>`,
  });
  const previewUrl = nodemailer.getTestMessageUrl(info);
  return {
    messageId: info.messageId,
    previewUrl: typeof previewUrl === "string" ? previewUrl : null,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
