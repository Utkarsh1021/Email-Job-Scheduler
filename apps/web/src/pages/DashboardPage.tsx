import { useEffect, useState } from "react";
import {
  Clock,
  Send,
  Plus,
  Search,
  Slack,
  LogOut,
  ExternalLink,
  ChevronLeft,
} from "lucide-react";
import { EmailTable } from "../components/EmailTable";
import { ComposeModal } from "../components/ComposeModal";
import { Toast } from "../components/ui/Toast";
import { api } from "../api/client";
import type { EmailRow } from "../types";
import { useAuth } from "../auth/AuthContext";

export function DashboardPage() {
  const { user, slack, logout, refresh } = useAuth();
  const [tab, setTab] = useState<"scheduled" | "sent">("scheduled");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [compose, setCompose] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailRow | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "error" | "success" } | null>(null);

  // Tab count indicators
  const [scheduledCount, setScheduledCount] = useState<number>(0);
  const [sentCount, setSentCount] = useState<number>(0);

  const loadCounts = async () => {
    try {
      const [sched, snt] = await Promise.all([
        api.emails({ tab: "scheduled", page: 1, pageSize: 1 }),
        api.emails({ tab: "sent", page: 1, pageSize: 1 }),
      ]);
      setScheduledCount(sched.total);
      setSentCount(snt.total);
    } catch {
      // ignore
    }
  };

  const load = async (activeTab = tab, activePage = page, query = q) => {
    setLoading(true);
    try {
      const data = await api.emails({
        tab: activeTab,
        q: query.trim() || undefined,
        page: activePage,
        pageSize,
      });
      setRows(data.emails);
      setTotal(data.total);
      if (activeTab === "scheduled") setScheduledCount(data.total);
      if (activeTab === "sent") setSentCount(data.total);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Failed to load emails",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(tab, page, q);
    void loadCounts();
    const id = setInterval(() => {
      void load(tab, page, q);
      void loadCounts();
    }, 8000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slackParam = params.get("slack");
    if (slackParam === "connected") {
      setToast({
        message: "Slack connected! Hourly limit alerts will post live to your workspace.",
        tone: "success",
      });
    } else if (slackParam === "error" || slackParam === "denied") {
      setToast({ message: "Slack connection did not complete.", tone: "error" });
    }
  }, []);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-gray-900">
      {/* LEFT SIDEBAR (Matching Figma 'ONG' design) */}
      <aside className="flex w-64 flex-col justify-between border-r border-gray-100 bg-[#FAFAFA] p-5">
        <div>
          {/* Logo / Brand */}
          <div className="mb-6 flex items-center justify-between">
            <span className="text-xl font-black tracking-tight text-gray-900">ONG</span>
            <a
              href="/admin/queues"
              target="_blank"
              rel="noreferrer"
              title="BullMQ Realtime Queue Dashboard"
              className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 shadow-2xs hover:border-gray-300 hover:text-gray-900"
            >
              <span>Queue UI</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* User Profile Card */}
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-2xs">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="h-9 w-9 rounded-full object-cover ring-1 ring-gray-100"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                {user?.name ? user.name.slice(0, 1).toUpperCase() : "U"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-bold text-gray-800 leading-tight">
                {user?.name ?? "User"}
              </p>
              <p className="truncate text-[10px] text-gray-400">{user?.email}</p>
            </div>
          </div>

          {/* Primary Action Button: Compose */}
          <button
            onClick={() => {
              setSelectedEmail(null);
              setCompose(true);
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500 bg-emerald-50/50 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100/70"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Compose</span>
          </button>

          {/* CORE Nav Tabs */}
          <div className="mt-7">
            <p className="px-2 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
              Core
            </p>
            <nav className="mt-2 space-y-1">
              <button
                onClick={() => {
                  setTab("scheduled");
                  setPage(1);
                  setSelectedEmail(null);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  tab === "scheduled"
                    ? "bg-[#E6F4EA] text-emerald-900"
                    : "text-gray-600 hover:bg-gray-100/80"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Clock className="h-4 w-4" />
                  <span>Scheduled</span>
                </div>
                <span className="text-[11px] text-gray-400">{scheduledCount}</span>
              </button>

              <button
                onClick={() => {
                  setTab("sent");
                  setPage(1);
                  setSelectedEmail(null);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  tab === "sent"
                    ? "bg-[#E6F4EA] text-emerald-900"
                    : "text-gray-600 hover:bg-gray-100/80"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Send className="h-4 w-4" />
                  <span>Sent</span>
                </div>
                <span className="text-[11px] text-gray-400">{sentCount}</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Footer Area: Slack status & Logout */}
        <div className="space-y-2 border-t border-gray-100 pt-4">
          {slack.connected ? (
            <button
              onClick={async () => {
                await api.disconnectSlack();
                await refresh();
                setToast({ message: "Slack disconnected", tone: "success" });
              }}
              className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <div className="flex items-center gap-2 truncate">
                <Slack className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="truncate">{slack.teamName || "Slack Connected"}</span>
              </div>
              <span className="text-[10px] text-red-500 hover:underline">Disconnect</span>
            </button>
          ) : (
            <a
              href="/auth/slack/connect"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-2 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50"
            >
              <Slack className="h-4 w-4 text-[#4A154B]" />
              <span>Connect Slack</span>
            </a>
          )}

          <button
            onClick={() => void logout()}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* RIGHT MAIN WORKSPACE */}
      <main className="flex flex-1 flex-col overflow-hidden bg-white">
        {/* Email Detail View (Figma Screen 4) or Email List (Figma Screen 2 & 3) */}
        {selectedEmail ? (
          <div className="flex flex-1 flex-col overflow-y-auto p-8">
            <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h1 className="text-base font-bold text-gray-800">{selectedEmail.subject}</h1>
              </div>
              {selectedEmail.previewUrl ? (
                <a
                  href={selectedEmail.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-500 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  <span>View in Ethereal</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>

            <div className="space-y-4 max-w-3xl">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                  {selectedEmail.email.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900">
                    To: {selectedEmail.email}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    From: {selectedEmail.sender.name} &lt;{selectedEmail.sender.fromEmail}&gt;
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 bg-[#FBFBFA] p-6 text-xs leading-relaxed text-gray-700 whitespace-pre-wrap font-sans">
                {selectedEmail.subject}
              </div>

              <div className="text-[11px] text-gray-400">
                Scheduled: {new Date(selectedEmail.scheduledAt).toLocaleString()}
                {selectedEmail.sentAt ? ` · Sent: ${new Date(selectedEmail.sentAt).toLocaleString()}` : ""}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Top Search bar */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-3.5">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setPage(1);
                  void load(tab, 1, q);
                }}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50/70 px-3.5 py-1.5 text-xs w-80 focus-within:border-emerald-500 focus-within:bg-white"
              >
                <Search className="h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search recipient or subject…"
                  value={q}
                  onChange={(e) => {
                    const val = e.target.value;
                    setQ(val);
                    if (!val) {
                      setPage(1);
                      void load(tab, 1, "");
                    }
                  }}
                  className="flex-1 bg-transparent text-xs text-gray-800 outline-none placeholder:text-gray-400"
                />
              </form>

              {/* Status / refresh indicator */}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{total} emails found</span>
                <button
                  onClick={() => void load(tab, page, q)}
                  className="text-gray-400 hover:text-gray-700"
                  title="Refresh list"
                >
                  ↻
                </button>
              </div>
            </div>

            {/* Email Rows List */}
            <div className="flex-1 overflow-y-auto">
              <EmailTable
                rows={rows}
                loading={loading}
                mode={tab}
                empty={tab === "scheduled" ? "No scheduled emails" : "No sent emails"}
                onSelectRow={(row) => setSelectedEmail(row)}
              />
            </div>

            {/* Pagination footer */}
            <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3 text-xs text-gray-500 bg-[#FAFAFA]">
              <span>
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium disabled:opacity-40 hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium disabled:opacity-40 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Compose Modal */}
      <ComposeModal
        open={compose}
        onClose={() => setCompose(false)}
        onCreated={() => {
          void load(tab, page, q);
          void loadCounts();
          setToast({ message: "Campaign scheduled successfully!", tone: "success" });
        }}
      />

      {toast ? (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
