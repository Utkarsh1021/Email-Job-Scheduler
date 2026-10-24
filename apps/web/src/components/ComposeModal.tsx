import { useEffect, useState } from "react";
import { Upload, X, Clock, HelpCircle } from "lucide-react";
import { api } from "../api/client";
import { parseEmailFile } from "../utils/parseEmails";
import type { Sender } from "../types";

export function ComposeModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");
  const [fileName, setFileName] = useState("");
  const [startTime, setStartTime] = useState(defaultStartLocal());
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(200);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [senderId, setSenderId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void api.senders().then((res) => {
      setSenders(res.senders);
      setHourlyLimit(res.envHourlyLimit);
      setSenderId(res.senders.find((s) => s.isDefault)?.id ?? res.senders[0]?.id ?? "");
    });
  }, [open]);

  if (!open) return null;


  const handleAddRecipient = (val: string) => {
    const trimmed = val.trim().toLowerCase();
    if (trimmed && trimmed.includes("@") && !recipients.includes(trimmed)) {
      setRecipients((prev) => [...prev, trimmed]);
      setRecipientInput("");
    }
  };

  const removeRecipient = (index: number) => {
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="flex h-[90vh] max-h-[800px] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Main Compose area */}
        <div className="flex flex-1 flex-col border-r border-gray-100">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h2 className="text-base font-semibold text-gray-800">Compose New Email</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form
            id="compose-form"
            className="flex flex-1 flex-col overflow-y-auto px-6 py-4 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              if (recipients.length === 0) {
                setError("Please add at least one recipient or upload a leads file");
                return;
              }
              setSubmitting(true);
              try {
                await api.createCampaign({
                  subject,
                  body,
                  recipients,
                  startTime: new Date(startTime).toISOString(),
                  delayMs: delaySeconds * 1000,
                  hourlyLimit,
                  senderId: senderId || undefined,
                });
                onCreated();
                onClose();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to schedule");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {/* Sender From dropdown */}
            <div className="flex items-center text-xs">
              <span className="w-16 font-medium text-gray-400">From</span>
              <select
                className="flex-1 rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-1.5 text-xs text-gray-800 outline-none focus:border-emerald-500"
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
              >
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} &lt;{s.fromEmail}&gt;
                  </option>
                ))}
              </select>
            </div>

            {/* To: Recipients chips + input */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-100 pb-3 text-xs">
              <span className="w-16 font-medium text-gray-400">To</span>
              <div className="flex flex-wrap items-center gap-1.5 flex-1">
                {recipients.map((r, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50/70 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800"
                  >
                    {r}
                    <button
                      type="button"
                      onClick={() => removeRecipient(i)}
                      className="text-emerald-600 hover:text-emerald-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder={recipients.length === 0 ? "Enter recipients or upload CSV below" : "Add recipient…"}
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      handleAddRecipient(recipientInput);
                    }
                  }}
                  onBlur={() => handleAddRecipient(recipientInput)}
                  className="flex-1 min-w-[140px] border-none bg-transparent text-xs outline-none placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Subject */}
            <div className="flex items-center border-b border-gray-100 pb-3 text-xs">
              <span className="w-16 font-medium text-gray-400">Subject</span>
              <input
                type="text"
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                className="flex-1 border-none bg-transparent text-xs font-semibold text-gray-800 outline-none placeholder:text-gray-400"
              />
            </div>

            {/* Email Body */}
            <div className="flex-1 flex flex-col pt-1">
              <textarea
                placeholder="Type your message here…"
                rows={10}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                className="w-full flex-1 resize-none border-none text-xs text-gray-700 outline-none placeholder:text-gray-400"
              />
            </div>

            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </form>

          {/* Bottom Bar: Action buttons */}
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <button
                type="submit"
                form="compose-form"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#009A49] px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#00833e] disabled:opacity-50"
              >
                <span>{submitting ? "Scheduling…" : "Send / Schedule"}</span>
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Right Sidebar: Campaign Settings (Delay, Limit, Schedule Date, File upload) */}
        <div className="w-80 bg-[#FAFAFA] p-6 flex flex-col justify-between border-l border-gray-100">
          <div className="space-y-5">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Campaign Settings
              </h3>
              <p className="mt-0.5 text-[11px] text-gray-400">
                Throttling and sending configurations
              </p>
            </div>

            {/* Upload CSV */}
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 text-center">
              <Upload className="mx-auto h-5 w-5 text-gray-400 mb-1.5" />
              <label className="cursor-pointer text-xs font-semibold text-emerald-700 hover:underline">
                Upload CSV / Text Leads
                <input
                  type="file"
                  accept=".csv,.txt,text/plain,text/csv"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setFileName(file.name);
                    const parsed = await parseEmailFile(file);
                    setRecipients((prev) => [...new Set([...prev, ...parsed])]);
                  }}
                />
              </label>
              <p className="mt-1 text-[10px] text-gray-400">
                {fileName
                  ? `${fileName} (${recipients.length} total detected)`
                  : "Drag & drop or click to upload leads"}
              </p>
            </div>

            {/* Start time */}
            <div>
              <label className="flex items-center gap-1 text-xs font-medium text-gray-700 mb-1.5">
                <Clock className="h-3.5 w-3.5 text-gray-400" />
                Start Sending At
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 outline-none focus:border-emerald-500"
              />
            </div>

            {/* Delay between emails */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-700">Delay between emails</label>
                <span className="text-[11px] font-semibold text-gray-500">{delaySeconds}s</span>
              </div>
              <input
                type="range"
                min={2}
                max={60}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                className="w-full accent-emerald-600"
              />
              <p className="mt-1 text-[10px] text-gray-400">
                Min 2s to satisfy provider throttling constraints.
              </p>
            </div>

            {/* Hourly Limit */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-700">Hourly limit</label>
                <span className="text-[11px] font-semibold text-gray-500">{hourlyLimit}/hr</span>
              </div>
              <input
                type="number"
                min={1}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 outline-none focus:border-emerald-500"
              />
              <p className="mt-1 text-[10px] text-gray-400">
                Spills to next hour without dropping jobs if exceeded.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3 text-[11px] text-gray-500">
            <div className="flex items-center gap-1.5 font-medium text-gray-700 mb-1">
              <HelpCircle className="h-3.5 w-3.5 text-emerald-600" />
              Rate limit alerts
            </div>
            When this sender reaches {hourlyLimit} emails in an hour, an automated alert fires
            directly to your connected Slack channel.
          </div>
        </div>
      </div>
    </div>
  );
}

function defaultStartLocal() {
  const d = new Date(Date.now() + 2 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
