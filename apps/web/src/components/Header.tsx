import { LogOut, Slack } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import { Button } from "./ui/Button";

export function Header() {
  const { user, slack, logout, refresh } = useAuth();
  if (!user) return null;

  return (
    <header className="flex items-center justify-between border-b border-line bg-white px-6 py-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-white text-sm font-semibold">
          O
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">Outbox</p>
          <p className="text-xs text-neutral-500">Email job scheduler</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {slack.connected ? (
          <Button
            variant="secondary"
            onClick={async () => {
              await api.disconnectSlack();
              await refresh();
            }}
          >
            <Slack className="h-4 w-4" />
            Disconnect Slack
          </Button>
        ) : (
          <a href="/auth/slack/connect">
            <Button variant="secondary" type="button">
              <Slack className="h-4 w-4" />
              Connect Slack
            </Button>
          </a>
        )}
        <a href="/admin/queues" target="_blank" rel="noreferrer" className="text-sm text-neutral-500 hover:text-ink">
          Queue
        </a>
        <div className="flex items-center gap-3">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-white text-sm">
              {user.name.slice(0, 1)}
            </div>
          )}
          <div className="hidden sm:block">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs text-neutral-500">{user.email}</p>
          </div>
        </div>
        <Button variant="ghost" onClick={() => void logout()}>
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
  );
}
