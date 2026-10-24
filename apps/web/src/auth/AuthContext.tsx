import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { MeResponse, SlackStatus, User } from "../types";

type AuthState = {
  loading: boolean;
  user: User | null;
  slack: SlackStatus;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [slack, setSlack] = useState<SlackStatus>({ connected: false });

  const refresh = async () => {
    try {
      const me: MeResponse = await api.me();
      setUser(me.user);
      setSlack(me.slack);
    } catch {
      setUser(null);
      setSlack({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const logout = async () => {
    await api.logout();
    setUser(null);
    setSlack({ connected: false });
  };

  const value = useMemo(
    () => ({ loading, user, slack, refresh, logout }),
    [loading, user, slack],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
