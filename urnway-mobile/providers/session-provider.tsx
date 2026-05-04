import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AuthPayload } from "@/lib/auth-contract";
import {
  ApiError,
  clearStoredTokens,
  fetchCurrentUser,
  logoutSession,
  readStoredTokens,
  refreshSession,
  SessionProfile,
  SessionTokens,
  storeTokens,
  UpdateCurrentUserInput,
  updateCurrentUserProfile,
  verifySignedPayload,
} from "@/lib/session";

type SessionStatus =
  | "bootstrapping"
  | "signed_out"
  | "authenticating"
  | "signed_in";

type SessionContextValue = {
  status: SessionStatus;
  profile: SessionProfile | null;
  tokens: SessionTokens | null;
  lastError: string | null;
  completeAuth: (payload: AuthPayload) => Promise<void>;
  completeOnboarding: (input: UpdateCurrentUserInput) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

async function hydrateSession(tokens: SessionTokens) {
  try {
    const profile = await fetchCurrentUser(tokens.accessToken);
    return {
      profile,
      tokens,
    };
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }

    const nextTokens = await refreshSession(tokens.refreshToken);
    const profile = await fetchCurrentUser(nextTokens.accessToken);

    return {
      profile,
      tokens: nextTokens,
    };
  }
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<SessionStatus>("bootstrapping");
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [tokens, setTokens] = useState<SessionTokens | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const storedTokens = await readStoredTokens();

        if (!storedTokens) {
          if (active) {
            setStatus("signed_out");
          }
          return;
        }

        const nextSession = await hydrateSession(storedTokens);
        await storeTokens(nextSession.tokens);

        if (!active) {
          return;
        }

        setTokens(nextSession.tokens);
        setProfile(nextSession.profile);
        setStatus("signed_in");
      } catch (error) {
        await clearStoredTokens();

        if (!active) {
          return;
        }

        setTokens(null);
        setProfile(null);
        setLastError(
          error instanceof Error
            ? error.message
            : "We could not restore the saved session."
        );
        setStatus("signed_out");
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  async function completeAuth(payload: AuthPayload) {
    setStatus("authenticating");
    setLastError(null);

    try {
      const nextTokens = await verifySignedPayload(payload);
      const nextProfile = await fetchCurrentUser(nextTokens.accessToken);

      await storeTokens(nextTokens);

      setTokens(nextTokens);
      setProfile(nextProfile);
      setStatus("signed_in");
    } catch (error) {
      await clearStoredTokens();
      setTokens(null);
      setProfile(null);
      setStatus("signed_out");
      setLastError(
        error instanceof Error ? error.message : "Sign-in failed unexpectedly."
      );
      throw error;
    }
  }

  async function refreshProfile() {
    if (!tokens) {
      return;
    }

    setLastError(null);

    try {
      const nextSession = await hydrateSession(tokens);
      await storeTokens(nextSession.tokens);
      setTokens(nextSession.tokens);
      setProfile(nextSession.profile);
      setStatus("signed_in");
    } catch (error) {
      await clearStoredTokens();
      setTokens(null);
      setProfile(null);
      setStatus("signed_out");
      setLastError(
        error instanceof Error
          ? error.message
          : "We could not refresh the current session."
      );
      throw error;
    }
  }

  async function completeOnboarding(input: UpdateCurrentUserInput) {
    if (!tokens) {
      throw new Error("You need to sign in before completing onboarding.");
    }

    setLastError(null);
    setStatus("authenticating");

    try {
      const nextProfile = await updateCurrentUserProfile(input, tokens.accessToken);
      setProfile(nextProfile);
      setStatus("signed_in");
    } catch (error) {
      setStatus("signed_in");
      setLastError(
        error instanceof Error
          ? error.message
          : "We could not save your onboarding details."
      );
      throw error;
    }
  }

  async function logout() {
    const currentTokens = tokens;

    setStatus("bootstrapping");
    setLastError(null);

    try {
      await logoutSession(currentTokens);
    } finally {
      await clearStoredTokens();
      setTokens(null);
      setProfile(null);
      setStatus("signed_out");
    }
  }

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      profile,
      tokens,
      lastError,
      completeAuth,
      completeOnboarding,
      refreshProfile,
      logout,
      clearError: () => setLastError(null),
    }),
    [lastError, profile, status, tokens]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error("useSession must be used inside SessionProvider.");
  }

  return context;
}
