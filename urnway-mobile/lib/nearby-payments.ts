export const NEARBY_PAYMENT_SERVICE_UUID =
  "4c9b8e2e-9d7d-46e5-8d7e-67d8b1f10001";

export const NEARBY_PAYMENT_CHARACTERISTIC_UUID =
  "4c9b8e2e-9d7d-46e5-8d7e-67d8b1f10002";

const NEARBY_PREFIX = "URNWAY:";

export function buildNearbyAdvertisedName(slug: string) {
  return `${NEARBY_PREFIX}${slug}`;
}

export function parseNearbyAdvertisedSlug(
  advertisedName: string | null | undefined
) {
  if (!advertisedName) {
    return null;
  }

  const value = advertisedName.trim();

  if (!value.startsWith(NEARBY_PREFIX)) {
    return null;
  }

  const slug = value.slice(NEARBY_PREFIX.length);

  return /^pay-[a-z0-9]+$/i.test(slug) ? slug : null;
}

