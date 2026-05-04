type ClientConfig =
  | {
      ok: true;
      apiBaseUrl: string;
      mobileRedirectUri?: string;
    }
  | {
      ok: false;
      error: string;
    };

function isPrivateDevelopmentHost(hostname: string) {
  if (["localhost", "127.0.0.1"].includes(hostname)) {
    return true;
  }

  if (hostname.startsWith("10.")) {
    return true;
  }

  if (hostname.startsWith("192.168.")) {
    return true;
  }

  const match = hostname.match(/^172\.(\d+)\./);

  if (!match) {
    return false;
  }

  const secondOctet = Number.parseInt(match[1] ?? "", 10);
  return secondOctet >= 16 && secondOctet <= 31;
}

function normalizeBaseUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().replace(/\/+$/, '');

  try {
    return new URL(trimmed).toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function resolveDevelopmentApiBaseUrl(apiBaseUrl: string) {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
    return apiBaseUrl;
  }

  try {
    const currentHost = window.location.hostname;

    if (!currentHost || ["localhost", "127.0.0.1"].includes(currentHost)) {
      return apiBaseUrl;
    }

    const url = new URL(apiBaseUrl);

    if (!isPrivateDevelopmentHost(url.hostname)) {
      return apiBaseUrl;
    }

    url.hostname = currentHost;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return apiBaseUrl;
  }
}

export function readClientConfig(): ClientConfig {
  const apiBaseUrl = resolveDevelopmentApiBaseUrl(
    normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL) ?? ""
  );

  if (!apiBaseUrl) {
    return {
      ok: false,
      error:
        'NEXT_PUBLIC_API_BASE_URL is missing or invalid. Set it in .env.local before starting the auth web app.',
    };
  }

  const mobileRedirectUri = process.env.NEXT_PUBLIC_MOBILE_REDIRECT_URI?.trim();

  return {
    ok: true,
    apiBaseUrl,
    mobileRedirectUri: mobileRedirectUri || undefined,
  };
}

export function buildApiUrl(apiBaseUrl: string, path: string) {
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
