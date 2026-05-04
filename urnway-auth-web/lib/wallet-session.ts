'use client';

const SESSION_FLAG = 'urnway_auth_bridge_session_prepared';
const STORAGE_KEY_PREFIXES = ['wc@', 'walletconnect', 'WALLETCONNECT_', 'WCM_'];

function clearMatchingStorage(storage: Storage | undefined) {
  if (!storage) {
    return;
  }

  const keys: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);

    if (!key) {
      continue;
    }

    if (STORAGE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      keys.push(key);
    }
  }

  for (const key of keys) {
    storage.removeItem(key);
  }
}

export function prepareWalletBridgeSession() {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.sessionStorage.getItem(SESSION_FLAG) === '1') {
    return;
  }

  clearMatchingStorage(window.localStorage);
  clearMatchingStorage(window.sessionStorage);
  window.sessionStorage.setItem(SESSION_FLAG, '1');
}

export function resetWalletBridgeSession() {
  if (typeof window === 'undefined') {
    return;
  }

  clearMatchingStorage(window.localStorage);
  clearMatchingStorage(window.sessionStorage);
  window.sessionStorage.removeItem(SESSION_FLAG);
}
