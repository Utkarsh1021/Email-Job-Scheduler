import { env } from "../config/env.js";
import { redis } from "./redis.js";

const RESERVE_QUOTA = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(ARGV[1])
if current >= limit then
  return {0, current, 0}
end
local new = redis.call('INCR', KEYS[1])
if new == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
local firstHit = 0
if new == limit then
  firstHit = 1
end
return {1, new, firstHit}
`;

const RELEASE_QUOTA = `
local n = tonumber(redis.call('GET', KEYS[1]) or '0')
if n > 0 then
  redis.call('DECR', KEYS[1])
end
return 1
`;

const RESERVE_INTERVAL = `
local last = tonumber(redis.call('GET', KEYS[1]) or '0')
local now = tonumber(ARGV[1])
local minInterval = tonumber(ARGV[2])
if last > 0 and (now - last) < minInterval then
  return {0, last + minInterval}
end
redis.call('SET', KEYS[1], now, 'PX', ARGV[3])
return {1, now}
`;

export function hourWindowKey(at = new Date()): string {
  const y = at.getUTCFullYear();
  const m = String(at.getUTCMonth() + 1).padStart(2, "0");
  const d = String(at.getUTCDate()).padStart(2, "0");
  const h = String(at.getUTCHours()).padStart(2, "0");
  return `${y}${m}${d}${h}`;
}

export function nextHourStart(at = new Date()): Date {
  const next = new Date(at);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return next;
}

export function secondsUntilTwoHours(): number {
  return 2 * 60 * 60;
}

export async function tryReserveQuota(senderId: string, limit: number) {
  const window = hourWindowKey();
  const key = `quota:${senderId}:${window}`;
  const result = (await redis.eval(
    RESERVE_QUOTA,
    1,
    key,
    String(limit),
    String(secondsUntilTwoHours()),
  )) as [number, number, number];
  return {
    allowed: result[0] === 1,
    count: Number(result[1]),
    firstHit: result[2] === 1,
    window,
    key,
  };
}

export async function releaseQuota(senderId: string, window = hourWindowKey()) {
  await redis.eval(RELEASE_QUOTA, 1, `quota:${senderId}:${window}`);
}

export async function tryReserveSendSlot(senderId: string, minIntervalMs: number) {
  const now = Date.now();
  const result = (await redis.eval(
    RESERVE_INTERVAL,
    1,
    `sender:${senderId}:lastSentAt`,
    String(now),
    String(minIntervalMs),
    String(Math.max(minIntervalMs * 4, 60_000)),
  )) as [number, number];
  return {
    allowed: result[0] === 1,
    nextAt: Number(result[1]),
  };
}

export function effectiveHourlyLimit(campaignLimit: number, senderLimit: number) {
  return Math.min(campaignLimit, senderLimit, env.MAX_EMAILS_PER_HOUR_PER_SENDER);
}

export function delayForOverflow(sequence: number, delayMs: number) {
  const start = nextHourStart();
  const spacing = Math.max(delayMs, env.MIN_SEND_INTERVAL_MS);
  return new Date(start.getTime() + sequence * spacing);
}
