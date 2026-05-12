import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { NativeModules, Platform } from "react-native";

const DEFAULT_API_BASE_URL = "http://localhost:4000";
const DEFAULT_AUTH_WEB_URL = "https://urnway-auth-web.vercel.app";
const DEFAULT_MEZO_BORROW_URL = "https://mezo.org/feature/borrow";
const DEFAULT_MEZO_SAVE_EARN_URL = "https://mezo.org/earn/vaults";

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

function readNativeDevelopmentHost() {
  const platformServerHost = (
    NativeModules.PlatformConstants as { ServerHost?: string } | undefined
  )?.ServerHost;

  if (platformServerHost) {
    return platformServerHost.split(":")[0] ?? null;
  }

  const sourceCodeScriptUrl = (
    NativeModules.SourceCode as { scriptURL?: string } | undefined
  )?.scriptURL;

  if (!sourceCodeScriptUrl) {
    return null;
  }

  try {
    return new URL(sourceCodeScriptUrl).hostname;
  } catch {
    return null;
  }
}

function readHostFromMaybeUrl(value: string | undefined | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return value.split(":")[0] ?? null;
  }
}

function readExpoDevelopmentHost() {
  const manifest2HostUri = (
    Constants as typeof Constants & {
      manifest2?: {
        extra?: {
          expoClient?: {
            hostUri?: string;
          };
        };
      };
    }
  ).manifest2?.extra?.expoClient?.hostUri;

  const hostCandidates = [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.hostUri,
    manifest2HostUri,
    Constants.platform?.hostUri,
    (
      Constants as typeof Constants & {
        experienceUrl?: string;
        intentUri?: string;
      }
    ).experienceUrl,
    (
      Constants as typeof Constants & {
        experienceUrl?: string;
        intentUri?: string;
      }
    ).intentUri,
  ]
    .map((candidate) => readHostFromMaybeUrl(candidate))
    .filter(Boolean) as string[];

  const nonLocalHost = hostCandidates.find(
    (host) => !["localhost", "127.0.0.1"].includes(host)
  );

  if (nonLocalHost) {
    return nonLocalHost;
  }

  if (hostCandidates[0]) {
    return readNativeDevelopmentHost() ?? hostCandidates[0];
  }

  return readNativeDevelopmentHost();
}

function resolveDevelopmentHost(value: string) {
  try {
    const url = new URL(value);
    const developmentHost = readExpoDevelopmentHost();

    if (!developmentHost || ["localhost", "127.0.0.1"].includes(developmentHost)) {
      return value;
    }

    if (!__DEV__) {
      return value;
    }

    if (!isPrivateDevelopmentHost(url.hostname)) {
      return value;
    }

    url.hostname = developmentHost;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return value;
  }
}

function normalizeBaseUrl(value: string | undefined, fallback: string) {
  const candidate = value?.trim() || fallback;
  return resolveDevelopmentHost(candidate.replace(/\/+$/, ""));
}

export function getApiBaseUrl() {
  return normalizeBaseUrl(
    process.env.EXPO_PUBLIC_API_BASE_URL,
    DEFAULT_API_BASE_URL
  );
}

export function getAuthWebBaseUrl() {
  return normalizeBaseUrl(
    process.env.EXPO_PUBLIC_AUTH_WEB_URL,
    DEFAULT_AUTH_WEB_URL
  );
}

export function getMezoBorrowUrl() {
  return process.env.EXPO_PUBLIC_MEZO_BORROW_URL?.trim() || DEFAULT_MEZO_BORROW_URL;
}

export function getMezoSaveEarnUrl() {
  return (
    process.env.EXPO_PUBLIC_MEZO_SAVE_EARN_URL?.trim() ||
    DEFAULT_MEZO_SAVE_EARN_URL
  );
}

export function getMobileRedirectUri() {
  return Linking.createURL("/auth/callback");
}

export function getMobileTransactionRedirectUri() {
  return Linking.createURL("/tx/callback");
}

export function buildAuthWebUrl() {
  const baseUrl = getAuthWebBaseUrl();
  const redirectUri = getMobileRedirectUri();
  const separator = baseUrl.includes("?") ? "&" : "?";

  return `${baseUrl}${separator}redirect_uri=${encodeURIComponent(redirectUri)}`;
}

export function buildAuthWebTransactionUrl(input: {
  to: string;
  data: string;
  value: string;
  chainId: number;
  gasLimit?: string | null;
  gasPrice?: string | null;
  slug?: string | null;
  amount?: string;
  recipientName?: string;
  expectedSender?: string;
}) {
  const baseUrl = new URL("/tx", `${getAuthWebBaseUrl()}/`);
  baseUrl.searchParams.set(
    "redirect_uri",
    getMobileTransactionRedirectUri()
  );
  baseUrl.searchParams.set("to", input.to);
  baseUrl.searchParams.set("data", input.data);
  baseUrl.searchParams.set("value", input.value);
  baseUrl.searchParams.set("chain_id", String(input.chainId));

  if (input.gasLimit) {
    baseUrl.searchParams.set("gas_limit", input.gasLimit);
  }

  if (input.gasPrice) {
    baseUrl.searchParams.set("gas_price", input.gasPrice);
  }

  if (input.slug) {
    baseUrl.searchParams.set("slug", input.slug);
  }

  if (input.amount) {
    baseUrl.searchParams.set("amount", input.amount);
  }

  if (input.recipientName) {
    baseUrl.searchParams.set("recipient_name", input.recipientName);
  }

  if (input.expectedSender) {
    baseUrl.searchParams.set("expected_sender", input.expectedSender);
  }

  return baseUrl.toString();
}

export function getMobileNetworkHint() {
  const developmentHost = readExpoDevelopmentHost();

  if (!developmentHost || ["localhost", "127.0.0.1"].includes(developmentHost)) {
    return null;
  }

  return {
    authWebUrl: `http://${developmentHost}:3000`,
    apiBaseUrl: `http://${developmentHost}:4000`,
  };
}

export function buildAndroidEmulatorFallbackUrl(value: string) {
  if (Platform.OS !== "android" || !__DEV__) {
    return null;
  }

  try {
    const url = new URL(value);

    if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
      return null;
    }

    url.hostname = "10.0.2.2";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}
