import type { Chain } from 'wagmi/chains';

type SwitchChainAsync = ((input: { chainId: number }) => Promise<unknown>) | undefined;
type ConnectorLike = {
  getProvider(args?: { chainId?: number }): Promise<unknown>;
} | null | undefined;

type Eip1193Provider = {
  request(args: {
    method: string;
    params?: unknown[] | object;
  }): Promise<unknown>;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }

  return '';
}

function getErrorCode(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error) {
    const code = (error as { code?: unknown }).code;

    if (typeof code === 'number') {
      return code;
    }
  }

  return null;
}

function isChainNotConfiguredError(error: unknown) {
  return getErrorMessage(error).toLowerCase().includes('chain not configured');
}

function isUnknownChainError(error: unknown) {
  const code = getErrorCode(error);
  const message = getErrorMessage(error).toLowerCase();

  return (
    code === 4902 ||
    message.includes('unknown chain') ||
    message.includes('unrecognized chain') ||
    message.includes('not added')
  );
}

function isUserRejectionError(error: unknown) {
  const code = getErrorCode(error);
  const message = getErrorMessage(error).toLowerCase();

  return (
    code === 4001 ||
    message.includes('user rejected') ||
    message.includes('user denied') ||
    message.includes('rejected the request')
  );
}

async function getConnectorProvider(connector: ConnectorLike, chainId: number) {
  if (!connector || typeof connector.getProvider !== 'function') {
    return null;
  }

  try {
    return (await connector.getProvider({ chainId })) as Eip1193Provider;
  } catch {
    try {
      return (await connector.getProvider()) as Eip1193Provider;
    } catch {
      return null;
    }
  }
}

function getInjectedProvider() {
  if (typeof window === 'undefined') {
    return null;
  }

  return (window as Window & { ethereum?: Eip1193Provider }).ethereum ?? null;
}

export async function switchToChainWithFallback(
  switchChainAsync: SwitchChainAsync,
  chain: Chain,
  connector?: ConnectorLike
) {
  // First try using Wagmi's switchChainAsync
  if (switchChainAsync) {
    try {
      await switchChainAsync({ chainId: chain.id });
      return;
    } catch (error) {
      // If user rejected, throw immediately with clear message
      if (isUserRejectionError(error)) {
        throw new Error('Network switch was rejected. Please approve the switch in your wallet.');
      }
      // Only continue to fallback if chain not configured
      if (!isChainNotConfiguredError(error)) {
        throw error;
      }
    }
  }

  // Fallback: try direct provider calls
  const provider =
    (await getConnectorProvider(connector, chain.id)) ?? getInjectedProvider();

  if (!provider) {
    throw new Error('Could not access the connected wallet provider to switch to Mezo.');
  }

  const chainIdHex = `0x${chain.id.toString(16)}`;

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
    return;
  } catch (error) {
    // If user rejected, throw immediately
    if (isUserRejectionError(error)) {
      throw new Error('Network switch was rejected. Please approve the switch in your wallet.');
    }
    // Only try to add chain if it's unknown
    if (!isUnknownChainError(error)) {
      throw error;
    }
  }

  // Chain not found, try to add it first
  const explorerUrl = chain.blockExplorers?.default?.url;

  try {
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: chainIdHex,
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: chain.rpcUrls.default.http,
          ...(explorerUrl ? { blockExplorerUrls: [explorerUrl] } : {}),
        },
      ],
    });
  } catch (error) {
    if (isUserRejectionError(error)) {
      throw new Error('Adding the Mezo network was rejected. Please approve to continue.');
    }
    throw error;
  }

  // After adding, switch to it
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (error) {
    if (isUserRejectionError(error)) {
      throw new Error('Network switch was rejected after adding. Please try again.');
    }
    throw error;
  }
}
