import * as WebBrowser from "expo-web-browser";

import {
  buildAuthWebTransactionUrl,
  getMobileTransactionRedirectUri,
} from "@/lib/mobile-config";
import {
  fetchBalanceTopup,
  prepareBalanceTopup,
  submitBalanceTopup,
  type BalanceTopup,
  ApiError,
} from "@/lib/session";
import { parseTransactionCallbackUrl } from "@/lib/tx-contract";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runUrnwayTopupFlow(input: {
  amountMinor: number;
  currency?: string;
  accessToken: string;
  onStatus?: (message: string) => void;
}) {
  const prepared = await prepareBalanceTopup(
    {
      amountMinor: input.amountMinor,
      currency: input.currency ?? "MUSD",
    },
    input.accessToken
  );

  const blockingIssue = prepared.funding.preflight.issues.find(
    (issue) => issue.severity === "error"
  );

  if (blockingIssue) {
    throw new Error(blockingIssue.message);
  }

  const transactionUrl = buildAuthWebTransactionUrl({
    to: prepared.funding.preflight.transactionRequest.to,
    data: prepared.funding.preflight.transactionRequest.data,
    value: prepared.funding.preflight.transactionRequest.value,
    chainId: prepared.funding.preflight.transactionRequest.chainId,
    gasLimit: prepared.funding.preflight.transactionRequest.gasLimit,
    gasPrice: prepared.funding.preflight.transactionRequest.gasPrice,
    amount: prepared.topup.amount,
    recipientName: "Urnway balance",
    expectedSender: prepared.funding.preflight.senderWalletAddress,
  });

  const result = await WebBrowser.openAuthSessionAsync(
    transactionUrl,
    getMobileTransactionRedirectUri()
  );

  if (result.type !== "success" || !("url" in result) || !result.url) {
    if (result.type === "cancel" || result.type === "dismiss") {
      throw new Error("The wallet flow was closed before the top-up was submitted.");
    }

    throw new Error("The wallet flow did not return a usable transaction callback.");
  }

  const callback = parseTransactionCallbackUrl(result.url);

  if (callback.status !== "submitted") {
    throw new Error(callback.message || "Top-up ended without a submitted transfer.");
  }

  input.onStatus?.("Top-up transaction submitted. Verifying onchain transfer...");

  let topup = await submitBalanceTopup(
    prepared.topup.topupId,
    {
      txHash: callback.txHash,
      senderWalletAddress: prepared.funding.preflight.senderWalletAddress,
    },
    input.accessToken
  );

  if (topup.status === "completed") {
    return topup;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    await sleep(2000);
    topup = await fetchBalanceTopup(prepared.topup.topupId, input.accessToken);

    if (topup.status === "completed") {
      return topup;
    }

    if (topup.status === "failed" || topup.status === "expired") {
      throw new ApiError(409, `Top-up ${topup.status}.`, {
        topup,
      });
    }
  }

  return topup;
}

export function isCompletedTopup(topup: BalanceTopup | null | undefined) {
  return Boolean(topup && topup.status === "completed");
}
