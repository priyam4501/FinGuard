import { useEffect, useState, useCallback } from "react";
import { fetchMe, signIn as apiSignIn, signUp as apiSignUp, type AuthUser } from "@/lib/api/auth";
import { getToken, setToken, onSignedOut, ApiError } from "@/lib/api/client";

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
}

/**
 * Client-only hook exposing the current JWT-authenticated user.
 * The token lives in localStorage; the user record is (re)hydrated by
 * calling /api/auth/me whenever the hook mounts or a sign-in/out happens.
 */
export function useAuth(): AuthState & {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
} {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  const hydrate = useCallback(async () => {
    if (!getToken()) {
      setState({ user: null, loading: false });
      return;
    }
    try {
      const me = await fetchMe();
      setState({ user: me, loading: false });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setToken(null);
      }
      setState({ user: null, loading: false });
    }
  }, []);

  useEffect(() => {
    void hydrate();
    return onSignedOut(() => setState({ user: null, loading: false }));
  }, [hydrate]);

  return {
    ...state,
    async signIn(email, password) {
      const res = await apiSignIn({ email, password });
      setToken(res.token);
      setState({ user: res.user, loading: false });
    },
    async signUp(fullName, email, password) {
      const res = await apiSignUp({ fullName, email, password });
      setToken(res.token);
      setState({ user: res.user, loading: false });
    },
    signOut() {
      setToken(null);
      setState({ user: null, loading: false });
    },
  };
}
