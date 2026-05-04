import { confirmPaymentLinkAttemptFromTransfer } from '../payments/payments.service.js';

type GoldskyTransferCandidate = {
  txHash: string;
  from: string;
  to: string;
  value: string;
  tokenAddress: string;
};

function readNestedValue(
  source: unknown,
  paths: Array<string[]>
): string | null {
  for (const path of paths) {
    let current: unknown = source;

    for (const segment of path) {
      if (!current || typeof current !== 'object' || !(segment in current)) {
        current = null;
        break;
      }

      current = (current as Record<string, unknown>)[segment];
    }

    if (typeof current === 'string' && current.trim().length > 0) {
      return current.trim();
    }

    if (typeof current === 'number' || typeof current === 'bigint') {
      return String(current);
    }
  }

  return null;
}

function extractGoldskyCandidates(body: unknown) {
  if (Array.isArray(body)) {
    return body;
  }

  if (!body || typeof body !== 'object') {
    return [body];
  }

  const candidate = body as Record<string, unknown>;

  if (Array.isArray(candidate.events)) {
    return candidate.events;
  }

  if (Array.isArray(candidate.data)) {
    return candidate.data;
  }

  if (candidate.event) {
    return [candidate.event];
  }

  if (candidate.data) {
    return [candidate.data];
  }

  return [body];
}

function parseGoldskyTransferCandidate(candidate: unknown): GoldskyTransferCandidate | null {
  const txHash = readNestedValue(candidate, [
    ['txHash'],
    ['transactionHash'],
    ['tx_hash'],
    ['event', 'txHash'],
    ['event', 'transactionHash'],
  ]);
  const from = readNestedValue(candidate, [
    ['from'],
    ['fromAddress'],
    ['from_address'],
    ['args', 'from'],
    ['event', 'args', 'from'],
  ]);
  const to = readNestedValue(candidate, [
    ['to'],
    ['toAddress'],
    ['to_address'],
    ['args', 'to'],
    ['event', 'args', 'to'],
  ]);
  const value = readNestedValue(candidate, [
    ['value'],
    ['amount'],
    ['amountBaseUnits'],
    ['args', 'value'],
    ['event', 'args', 'value'],
  ]);
  const tokenAddress = readNestedValue(candidate, [
    ['tokenAddress'],
    ['contractAddress'],
    ['contract_address'],
    ['address'],
    ['event', 'address'],
  ]);

  if (!txHash || !from || !to || !value || !tokenAddress) {
    return null;
  }

  return {
    txHash,
    from,
    to,
    value,
    tokenAddress,
  };
}

export async function handleGoldskyTransferWebhook(body: unknown) {
  const candidates = extractGoldskyCandidates(body)
    .map(parseGoldskyTransferCandidate)
    .filter((candidate): candidate is GoldskyTransferCandidate => candidate !== null);

  let confirmed = 0;
  let duplicateConfirmed = 0;
  let ignored = 0;

  for (const candidate of candidates) {
    const result = await confirmPaymentLinkAttemptFromTransfer(candidate);

    if (result.outcome === 'confirmed') {
      confirmed += 1;
      continue;
    }

    if (result.outcome === 'duplicate_confirmed') {
      duplicateConfirmed += 1;
      continue;
    }

    ignored += 1;
  }

  return {
    provider: 'goldsky',
    receivedEvents: candidates.length,
    confirmed,
    duplicateConfirmed,
    ignored,
  };
}
