"use client";

import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getSession,
  signOut as endSession,
  type SessionUser,
} from "@/lib/auth/api";
import { setPreviewUser } from "@/lib/onboarding/preview-scope";

type AuthState = {
  status: "loading" | "authenticated" | "unauthenticated" | "error";
  user: SessionUser | null;
};
interface AuthContextValue extends AuthState {
  refresh: () => Promise<SessionUser | null>;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    user: null,
  });
  const sequence = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const user = await getSession();
      if (current === sequence.current) {
        setPreviewUser(user?.id ?? null);
        setState({ status: user ? "authenticated" : "unauthenticated", user });
      }
      return user;
    } catch (error) {
      if (current === sequence.current) {
        setPreviewUser(null);
        setState({ status: "error", user: null });
      }
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    ++sequence.current;
    await endSession();
    ++sequence.current;
    setPreviewUser(null);
    setState({ status: "unauthenticated", user: null });
    channel.current?.postMessage("session-changed");
  }, []);

  useEffect(() => {
    const requests = sequence;
    const revalidate = () => {
      void refresh().catch(() => undefined);
    };
    revalidate();
    window.addEventListener("focus", revalidate);
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("rtn-auth");
      channel.current.onmessage = revalidate;
    }
    return () => {
      ++requests.current;
      window.removeEventListener("focus", revalidate);
      channel.current?.close();
      channel.current = null;
    };
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ ...state, refresh, signOut }}>
      <Fragment key={state.user?.id ?? "guest"}>{children}</Fragment>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthProvider is required");
  return context;
}
