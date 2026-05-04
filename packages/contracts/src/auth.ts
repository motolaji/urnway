export type AuthPayload = {
  walletAddress: string;
  message: string;
  signature: string;
};

export type AuthBridgeEnvelope = {
  type: "urnway-auth-result";
  payload: AuthPayload;
};

type AuthCallbackParamMap = {
  walletAddress?: string | string[];
  message?: string | string[];
  signature?: string | string[];
};

function readRequiredString(value: unknown, fieldName: keyof AuthPayload | string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is missing from the auth payload.`);
  }

  return value;
}

function getCallbackParam(
  value: string | string[] | undefined,
  fieldName: keyof AuthPayload
) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return readRequiredString(candidate, fieldName);
}

export function assertAuthPayload(payload: unknown): asserts payload is AuthPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Auth payload must be an object.");
  }

  const candidate = payload as Partial<AuthPayload>;

  readRequiredString(candidate.walletAddress, "walletAddress");
  readRequiredString(candidate.message, "message");
  readRequiredString(candidate.signature, "signature");
}

export function buildAuthBridgeEnvelope(payload: AuthPayload): AuthBridgeEnvelope {
  assertAuthPayload(payload);

  return {
    type: "urnway-auth-result",
    payload,
  };
}

export function parseAuthBridgeMessage(rawMessage: string) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawMessage);
  } catch {
    throw new Error("Auth bridge message is not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Auth bridge message must be an object.");
  }

  const envelope = parsed as Partial<AuthBridgeEnvelope>;

  if (envelope.type !== "urnway-auth-result") {
    throw new Error("Received an unknown auth bridge message.");
  }

  assertAuthPayload(envelope.payload);

  return envelope.payload;
}

export function parseAuthCallbackParams(params: AuthCallbackParamMap): AuthPayload {
  return {
    walletAddress: getCallbackParam(params.walletAddress, "walletAddress"),
    message: getCallbackParam(params.message, "message"),
    signature: getCallbackParam(params.signature, "signature"),
  };
}

export function parseAuthCallbackUrl(url: string): AuthPayload {
  const parsedUrl = new URL(url);

  return {
    walletAddress: readRequiredString(
      parsedUrl.searchParams.get("walletAddress"),
      "walletAddress"
    ),
    message: readRequiredString(parsedUrl.searchParams.get("message"), "message"),
    signature: readRequiredString(
      parsedUrl.searchParams.get("signature"),
      "signature"
    ),
  };
}

export function buildAuthDeepLink(
  mobileRedirectUri: string | undefined,
  payload: AuthPayload
) {
  if (!mobileRedirectUri) {
    return null;
  }

  const url = new URL(mobileRedirectUri);

  url.searchParams.set("walletAddress", payload.walletAddress);
  url.searchParams.set("message", payload.message);
  url.searchParams.set("signature", payload.signature);
  url.searchParams.set("source", "urnway-auth-web");

  return url.toString();
}

export function postAuthBridgeEnvelopeToReactNativeWebView(
  envelope: AuthBridgeEnvelope
) {
  if (typeof window === "undefined") {
    return false;
  }

  const bridge = (window as typeof window & {
    ReactNativeWebView?: {
      postMessage(message: string): void;
    };
  }).ReactNativeWebView;

  if (!bridge?.postMessage) {
    return false;
  }

  bridge.postMessage(JSON.stringify(envelope));
  return true;
}
