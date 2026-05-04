export type TransactionCallbackStatus = "submitted" | "error" | "cancelled";

export type TransactionCallbackPayload = {
  status: TransactionCallbackStatus;
  txHash?: string;
  slug?: string | null;
  source?: string | null;
  message?: string | null;
};

export type TransactionCallbackResult =
  | {
      status: "submitted";
      txHash: string;
      slug: string | null;
      source: string | null;
      message: string | null;
    }
  | {
      status: "error" | "cancelled";
      txHash: null;
      slug: string | null;
      source: string | null;
      message: string | null;
    };

type TransactionCallbackParamMap = {
  status?: string | string[];
  txHash?: string | string[];
  slug?: string | string[];
  source?: string | string[];
  message?: string | string[];
};

function readRequired(value: string | null, fieldName: string) {
  if (!value || value.trim().length === 0) {
    throw new Error(`${fieldName} is missing from the transaction callback.`);
  }

  return value;
}

export function buildTransactionDeepLink(
  mobileRedirectUri: string | undefined,
  payload: TransactionCallbackPayload
) {
  if (!mobileRedirectUri) {
    return null;
  }

  const url = new URL(mobileRedirectUri);

  url.searchParams.set("status", payload.status);
  url.searchParams.set("source", payload.source ?? "urnway-auth-web");

  if (payload.txHash) {
    url.searchParams.set("txHash", payload.txHash);
  }

  if (payload.slug) {
    url.searchParams.set("slug", payload.slug);
  }

  if (payload.message) {
    url.searchParams.set("message", payload.message);
  }

  return url.toString();
}

export function parseTransactionCallbackUrl(url: string): TransactionCallbackResult {
  const parsedUrl = new URL(url);
  const status = readRequired(parsedUrl.searchParams.get("status"), "status");
  const slug = parsedUrl.searchParams.get("slug");
  const source = parsedUrl.searchParams.get("source");
  const message = parsedUrl.searchParams.get("message");

  if (status === "submitted") {
    return {
      status,
      txHash: readRequired(parsedUrl.searchParams.get("txHash"), "txHash"),
      slug,
      source,
      message,
    };
  }

  if (status === "error" || status === "cancelled") {
    return {
      status,
      txHash: null,
      slug,
      source,
      message,
    };
  }

  throw new Error("Unknown transaction callback status.");
}

export function parseTransactionCallbackParams(
  params: TransactionCallbackParamMap
): TransactionCallbackResult {
  const url = new URL("urnwaymobile://tx/callback");

  const status = Array.isArray(params.status) ? params.status[0] : params.status;
  const txHash = Array.isArray(params.txHash) ? params.txHash[0] : params.txHash;
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const source = Array.isArray(params.source) ? params.source[0] : params.source;
  const message = Array.isArray(params.message) ? params.message[0] : params.message;

  if (status) {
    url.searchParams.set("status", status);
  }

  if (txHash) {
    url.searchParams.set("txHash", txHash);
  }

  if (slug) {
    url.searchParams.set("slug", slug);
  }

  if (source) {
    url.searchParams.set("source", source);
  }

  if (message) {
    url.searchParams.set("message", message);
  }

  return parseTransactionCallbackUrl(url.toString());
}
