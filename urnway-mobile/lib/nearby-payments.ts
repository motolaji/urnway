const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOCAL_NAME_PREFIX = "U:";
const LEGACY_LOCAL_NAME_PREFIX = "URNWAY:";
const LEGACY_SHORT_LOCAL_NAME_PREFIX = "UW:";
const MAX_NEARBY_LOCAL_NAME_USERNAME_LENGTH = 12;
const MAX_NEARBY_MANUFACTURER_USERNAME_LENGTH = 6;
const COMPACT_NEARBY_DISCOVERY_PREFIX = "N1R|";

export const NEARBY_PROTOCOL_VERSION = "N1";
export const NEARBY_DISCOVERY_TYPE = "R";
export const NEARBY_PAYMENT_SERVICE_UUID =
  "7f61b8c0-7e2a-4e4d-9a5e-000000000001";
export const NEARBY_DISCOVERY_CHARACTERISTIC_UUID =
  "7f61b8c0-7e2a-4e4d-9a5e-000000000002";
export const NEARBY_PAYMENT_MESSAGE_CHARACTERISTIC_UUID =
  "7f61b8c0-7e2a-4e4d-9a5e-000000000003";
export const NEARBY_STATUS_CHARACTERISTIC_UUID =
  "7f61b8c0-7e2a-4e4d-9a5e-000000000004";

export type NearbyUser = {
  username: string;
  publicUserId: string;
  rssi?: number;
  deviceId: string;
  status: "discovered" | "connecting" | "connected";
};

export type NearbyDiscoveryPayload = {
  protocol: typeof NEARBY_PROTOCOL_VERSION;
  payloadType: typeof NEARBY_DISCOVERY_TYPE;
  username: string;
  publicUserId: string;
};

export type NearbyPayMessage = {
  protocol: typeof NEARBY_PROTOCOL_VERSION;
  messageType: "PAY";
  senderUsername: string;
  paymentIntentId: string;
  amountMinor: number;
  currency: string;
};

export type NearbyAckMessage = {
  protocol: typeof NEARBY_PROTOCOL_VERSION;
  messageType: "ACK";
  paymentIntentId: string;
};

export type NearbyDoneMessage = {
  protocol: typeof NEARBY_PROTOCOL_VERSION;
  messageType: "DONE";
  paymentIntentId: string;
  outcome: "success";
};

export type NearbyRuntimeMessage =
  | NearbyPayMessage
  | NearbyAckMessage
  | NearbyDoneMessage;

export type IncomingNearbyPayment = {
  senderUsername: string;
  paymentIntentId: string;
  amountMinor: number;
  currency: string;
  receivedAt: number;
};

function assertParts(parts: string[], expectedLength: number, type: string) {
  if (parts.length !== expectedLength) {
    throw new Error(`${type} payload is malformed.`);
  }

  if (parts[0] !== NEARBY_PROTOCOL_VERSION) {
    throw new Error(`Unsupported nearby protocol version: ${parts[0] ?? "unknown"}.`);
  }
}

function normalizeNearbyDiscoveryPublicUserId(rawPublicUserId: string) {
  return rawPublicUserId.startsWith("pub_")
    ? rawPublicUserId
    : `pub_${rawPublicUserId}`;
}

function compactNearbyDiscoveryPublicUserId(publicUserId: string) {
  return publicUserId.trim().startsWith("pub_")
    ? publicUserId.trim().slice(4)
    : publicUserId.trim();
}

export function encodeNearbyDiscoveryPayload(payload: {
  username: string;
  publicUserId: string;
}) {
  return [
    NEARBY_PROTOCOL_VERSION,
    NEARBY_DISCOVERY_TYPE,
    payload.username.trim(),
    payload.publicUserId.trim(),
  ].join("|");
}

export function encodeCompactNearbyDiscoveryPayload(payload: {
  username: string;
  publicUserId: string;
}) {
  const compactUsername = payload.username
    .trim()
    .replace(/[:|]/g, "")
    .slice(0, MAX_NEARBY_MANUFACTURER_USERNAME_LENGTH);
  const compactPublicUserId = compactNearbyDiscoveryPublicUserId(payload.publicUserId);

  return `${COMPACT_NEARBY_DISCOVERY_PREFIX}${compactUsername}|${compactPublicUserId}`;
}

export function parseNearbyDiscoveryPayload(
  rawValue: string | null | undefined
): NearbyDiscoveryPayload | null {
  if (!rawValue) {
    return null;
  }

  const parts = rawValue.trim().split("|");

  try {
    assertParts(parts, 4, "Nearby discovery");
  } catch {
    return null;
  }

  if (parts[1] !== NEARBY_DISCOVERY_TYPE) {
    return null;
  }

  const username = parts[2]?.trim();
  const rawPublicUserId = parts[3]?.trim();

  if (!username || !rawPublicUserId) {
    return null;
  }

  return {
    protocol: NEARBY_PROTOCOL_VERSION,
    payloadType: NEARBY_DISCOVERY_TYPE,
    username,
    publicUserId: normalizeNearbyDiscoveryPublicUserId(rawPublicUserId),
  };
}

export function parseNearbyDiscoveryManufacturerData(
  rawValue: string | null | undefined
) {
  if (!rawValue) {
    return null;
  }

  const compactMarkerIndex = rawValue.indexOf(COMPACT_NEARBY_DISCOVERY_PREFIX);

  if (compactMarkerIndex >= 0) {
    const compactParts = rawValue.slice(compactMarkerIndex).split("|");

    if (compactParts.length === 3) {
      const username = compactParts[1]?.trim();
      const rawPublicUserId = compactParts[2]?.trim();

      if (username && rawPublicUserId) {
        return {
          protocol: NEARBY_PROTOCOL_VERSION,
          payloadType: NEARBY_DISCOVERY_TYPE,
          username,
          publicUserId: normalizeNearbyDiscoveryPublicUserId(rawPublicUserId),
        };
      }
    }
  }

  const marker = `${NEARBY_PROTOCOL_VERSION}|${NEARBY_DISCOVERY_TYPE}|`;
  const markerIndex = rawValue.indexOf(marker);

  if (markerIndex >= 0) {
    return parseNearbyDiscoveryPayload(rawValue.slice(markerIndex));
  }

  return parseNearbyDiscoveryPayload(rawValue);
}

export function buildNearbyFallbackLocalName(payload: {
  username: string;
  publicUserId: string;
}) {
  const compactUsername = payload.username
    .trim()
    .replace(/[:|]/g, "")
    .slice(0, MAX_NEARBY_LOCAL_NAME_USERNAME_LENGTH);
  const compactPublicUserId = payload.publicUserId.trim().startsWith("pub_")
    ? payload.publicUserId.trim().slice(4)
    : payload.publicUserId.trim();

  return `${LOCAL_NAME_PREFIX}${compactUsername}:${compactPublicUserId}`;
}

export function parseNearbyFallbackLocalName(
  localName: string | null | undefined
): NearbyDiscoveryPayload | null {
  if (!localName) {
    return null;
  }

  const value = localName.trim();

  const prefix = value.startsWith(LOCAL_NAME_PREFIX)
    ? LOCAL_NAME_PREFIX
    : value.startsWith(LEGACY_SHORT_LOCAL_NAME_PREFIX)
      ? LEGACY_SHORT_LOCAL_NAME_PREFIX
    : value.startsWith(LEGACY_LOCAL_NAME_PREFIX)
      ? LEGACY_LOCAL_NAME_PREFIX
      : null;

  if (!prefix) {
    return null;
  }

  const [username, rawPublicUserId] = value.slice(prefix.length).split(":");

  if (!username || !rawPublicUserId) {
    return null;
  }

  return {
    protocol: NEARBY_PROTOCOL_VERSION,
    payloadType: NEARBY_DISCOVERY_TYPE,
    username: username.trim(),
    publicUserId: normalizeNearbyDiscoveryPublicUserId(rawPublicUserId.trim()),
  };
}

export function encodeNearbyPayMessage(input: {
  senderUsername: string;
  paymentIntentId: string;
  amountMinor: number;
  currency: string;
}) {
  return [
    NEARBY_PROTOCOL_VERSION,
    "PAY",
    input.senderUsername.trim(),
    input.paymentIntentId.trim(),
    String(input.amountMinor),
    input.currency.trim().toUpperCase(),
  ].join("|");
}

export function encodeNearbyAckMessage(paymentIntentId: string) {
  return [NEARBY_PROTOCOL_VERSION, "ACK", paymentIntentId.trim()].join("|");
}

export function encodeNearbyDoneMessage(paymentIntentId: string) {
  return [NEARBY_PROTOCOL_VERSION, "DONE", paymentIntentId.trim(), "success"].join(
    "|"
  );
}

export function parseNearbyRuntimeMessage(
  rawValue: string | null | undefined
): NearbyRuntimeMessage | null {
  if (!rawValue) {
    return null;
  }

  const parts = rawValue.trim().split("|");
  const messageType = parts[1];

  if (messageType === "PAY") {
    try {
      assertParts(parts, 6, "Nearby PAY");
    } catch {
      return null;
    }

    const amountMinor = Number(parts[4]);
    const currency = parts[5]?.trim().toUpperCase();

    if (!Number.isInteger(amountMinor) || amountMinor <= 0 || !currency) {
      return null;
    }

    return {
      protocol: NEARBY_PROTOCOL_VERSION,
      messageType: "PAY",
      senderUsername: parts[2].trim(),
      paymentIntentId: parts[3].trim(),
      amountMinor,
      currency,
    };
  }

  if (messageType === "ACK") {
    try {
      assertParts(parts, 3, "Nearby ACK");
    } catch {
      return null;
    }

    return {
      protocol: NEARBY_PROTOCOL_VERSION,
      messageType: "ACK",
      paymentIntentId: parts[2].trim(),
    };
  }

  if (messageType === "DONE") {
    try {
      assertParts(parts, 4, "Nearby DONE");
    } catch {
      return null;
    }

    if (parts[3] !== "success") {
      return null;
    }

    return {
      protocol: NEARBY_PROTOCOL_VERSION,
      messageType: "DONE",
      paymentIntentId: parts[2].trim(),
      outcome: "success",
    };
  }

  return null;
}

export function utf8ToBytes(value: string) {
  return textEncoder.encode(value);
}

export function bytesToUtf8(bytes: Uint8Array) {
  return textDecoder.decode(bytes);
}

export function utf8ToHex(value: string) {
  return Array.from(utf8ToBytes(value))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToUtf8(value: string) {
  const cleanValue = value.trim().replace(/\s+/g, "");

  if (cleanValue.length % 2 !== 0) {
    throw new Error("Hex string must contain an even number of characters.");
  }

  const bytes = new Uint8Array(cleanValue.length / 2);

  for (let index = 0; index < cleanValue.length; index += 2) {
    bytes[index / 2] = Number.parseInt(cleanValue.slice(index, index + 2), 16);
  }

  return bytesToUtf8(bytes);
}

export function bytesToBase64(bytes: Uint8Array) {
  let result = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const byte1 = bytes[index] ?? 0;
    const byte2 = bytes[index + 1] ?? 0;
    const byte3 = bytes[index + 2] ?? 0;
    const combined = (byte1 << 16) | (byte2 << 8) | byte3;

    result += BASE64_ALPHABET[(combined >> 18) & 63];
    result += BASE64_ALPHABET[(combined >> 12) & 63];
    result +=
      index + 1 < bytes.length ? BASE64_ALPHABET[(combined >> 6) & 63] : "=";
    result += index + 2 < bytes.length ? BASE64_ALPHABET[combined & 63] : "=";
  }

  return result;
}

export function base64ToBytes(value: string) {
  const normalized = value.replace(/\s+/g, "");
  const chunks: number[] = [];

  for (let index = 0; index < normalized.length; index += 4) {
    const sextet1 = BASE64_ALPHABET.indexOf(normalized[index] ?? "A");
    const sextet2 = BASE64_ALPHABET.indexOf(normalized[index + 1] ?? "A");
    const sextet3 =
      normalized[index + 2] === "="
        ? -1
        : BASE64_ALPHABET.indexOf(normalized[index + 2] ?? "A");
    const sextet4 =
      normalized[index + 3] === "="
        ? -1
        : BASE64_ALPHABET.indexOf(normalized[index + 3] ?? "A");

    const combined =
      ((sextet1 & 63) << 18) |
      ((sextet2 & 63) << 12) |
      (((sextet3 < 0 ? 0 : sextet3) & 63) << 6) |
      ((sextet4 < 0 ? 0 : sextet4) & 63);

    chunks.push((combined >> 16) & 255);

    if (sextet3 >= 0) {
      chunks.push((combined >> 8) & 255);
    }

    if (sextet4 >= 0) {
      chunks.push(combined & 255);
    }
  }

  return Uint8Array.from(chunks);
}

export function utf8ToBase64(value: string) {
  return bytesToBase64(utf8ToBytes(value));
}

export function base64ToUtf8(value: string) {
  return bytesToUtf8(base64ToBytes(value));
}

export function formatMinorCurrencyAmount(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function parseMajorAmountToMinorUnits(value: string) {
  const normalized = value.trim();

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Enter a valid amount with up to 2 decimal places.");
  }

  const [wholePart, fractionPart = ""] = normalized.split(".");
  return Number.parseInt(wholePart, 10) * 100 + Number.parseInt(fractionPart.padEnd(2, "0"), 10);
}
