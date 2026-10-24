import { Clock, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import type { EmailRow } from "../types";

export function EmailTable({
  rows,
  loading,
  empty,
  mode,
  onSelectRow,
}: {
  rows: EmailRow[];
  loading: boolean;
  empty: string;
  mode: "scheduled" | "sent";
  onSelectRow?: (row: EmailRow) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3 p-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-50 border border-gray-100" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 mb-3">
          <Clock className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold text-gray-700">{empty}</p>
        <p className="mt-1 text-xs text-gray-400">Schedule a campaign to view it here.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {rows.map((row) => (
        <div
          key={row.id}
          onClick={() => onSelectRow?.(row)}
          className="group flex flex-wrap items-center justify-between gap-4 px-6 py-4 transition hover:bg-gray-50/80 cursor-pointer"
        >
          {/* Left recipient info */}
          <div className="flex items-center gap-3 min-w-[200px]">
            <span className="text-xs text-gray-400 font-medium">To:</span>
            <span className="text-xs font-semibold text-gray-800 truncate max-w-[180px]">
              {row.email}
            </span>
          </div>

          {/* Center: status pill + subject preview */}
          <div className="flex flex-1 items-center gap-3 min-w-[300px]">
            {mode === "scheduled" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50/80 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 whitespace-nowrap">
                <Clock className="h-3 w-3 text-amber-600" />
                {formatScheduledBadge(row.scheduledAt)}
              </span>
            ) : (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${
                  row.status === "sent"
                    ? "border-emerald-200 bg-emerald-50/80 text-emerald-800"
                    : row.status === "failed"
                    ? "border-red-200 bg-red-50/80 text-red-800"
                    : "border-sky-200 bg-sky-50/80 text-sky-800"
                }`}
              >
                {row.status === "sent" ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                ) : row.status === "failed" ? (
                  <AlertCircle className="h-3 w-3 text-red-600" />
                ) : (
                  <RefreshCw className="h-3 w-3 text-sky-600" />
                )}
                {row.status.toUpperCase()}
              </span>
            )}

            <div className="text-xs text-gray-600 truncate flex-1">
              <span className="font-semibold text-gray-800">{row.subject}</span>
              <span className="text-gray-400 mx-1.5">-</span>
              <span className="text-gray-500">
                {mode === "sent" ? `Sent at ${formatTime(row.sentAt)}` : `Scheduled send`}
              </span>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {row.previewUrl ? (
              <a
                className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 shadow-2xs hover:bg-gray-50 hover:text-emerald-700"
                href={row.previewUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                Ethereal preview
              </a>
            ) : null}
            <span className="text-gray-300 group-hover:text-gray-400 text-sm">☆</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatScheduledBadge(val: string) {
  try {
    const d = new Date(val);
    const day = d.toLocaleDateString(undefined, { weekday: "short" });
    const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${day} ${time}`;
  } catch {
    return val;
  }
}

function formatTime(value: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return value;
  }
}
