export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type RouteStatus = 'available' | 'scaffold' | 'planned';
export type AuthMode = 'public' | 'bearer' | 'mixed';

export type ApiRoute = {
  method: HttpMethod;
  path: string;
  summary: string;
  status: RouteStatus;
  auth: AuthMode;
};

export type ApiRouteGroup = {
  name: string;
  description: string;
  routes: ApiRoute[];
};

export const apiBasePaths = {
  canonical: '/v1',
  legacy: '/api',
} as const;

export const apiConventions = [
  '`{ data, error, meta }` response envelope',
  'Bearer JWT for protected routes',
  'Cursor pagination for list endpoints',
  'MUSD amounts represented as decimal strings',
] as const;

export const authFlowSteps = [
  'Mobile opens the hosted Passport experience in a WebView.',
  'The auth web app requests a nonce from the API.',
  'The user connects Mezo Passport and signs the nonce payload.',
  'The auth web app returns `{ walletAddress, message, signature }` to mobile.',
  'Mobile calls the API verify endpoint to exchange the signed payload for tokens.',
] as const;

export const routeGroups: ApiRouteGroup[] = [
  {
    name: 'Public and platform',
    description: 'Public entrypoints for discovery, status, and API reference.',
    routes: [
      {
        method: 'GET',
        path: '/',
        summary: 'Simple landing page for the Urnway API.',
        status: 'available',
        auth: 'public',
      },
      {
        method: 'GET',
        path: '/docs',
        summary: 'Grouped API reference generated from checked-in route metadata.',
        status: 'available',
        auth: 'public',
      },
      {
        method: 'GET',
        path: '/v1/health',
        summary: 'Health check for uptime and timestamp.',
        status: 'available',
        auth: 'public',
      },
    ],
  },
  {
    name: 'Auth',
    description: 'Passport signature flow and session lifecycle endpoints.',
    routes: [
      {
        method: 'POST',
        path: '/v1/auth/nonce',
        summary: 'Creates the nonce payload used for wallet signature verification.',
        status: 'available',
        auth: 'public',
      },
      {
        method: 'POST',
        path: '/v1/auth/verify',
        summary: 'Verifies a signed nonce and issues session tokens.',
        status: 'available',
        auth: 'public',
      },
      {
        method: 'POST',
        path: '/v1/auth/refresh',
        summary: 'Rotates access tokens using a refresh token.',
        status: 'available',
        auth: 'public',
      },
      {
        method: 'POST',
        path: '/v1/auth/logout',
        summary: 'Revokes an active session refresh token.',
        status: 'available',
        auth: 'public',
      },
    ],
  },
  {
    name: 'Users',
    description: 'Current-user profile, push token registration, search, and contacts.',
    routes: [
      {
        method: 'GET',
        path: '/v1/users/me',
        summary:
          'Returns the signed-in user profile, including the nearby-discovery public user id.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'PATCH',
        path: '/v1/users/me',
        summary: 'Updates profile details such as display name and notification preferences.',
        status: 'scaffold',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/users/me/push-token',
        summary: 'Reads the currently registered Expo push token.',
        status: 'scaffold',
        auth: 'bearer',
      },
      {
        method: 'PUT',
        path: '/v1/users/me/push-token',
        summary: 'Registers or updates the current Expo push token.',
        status: 'scaffold',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/users/search?q=',
        summary: 'Searches users for send and contact flows.',
        status: 'scaffold',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/users/me/contacts',
        summary: 'Returns the current user\'s matched Urnway contacts.',
        status: 'scaffold',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/users/:username',
        summary: 'Returns a public user profile by username.',
        status: 'available',
        auth: 'public',
      },
    ],
  },
  {
    name: 'Places',
    description:
      'Autocomplete helpers for flights, trip destinations, hotels, and address-style search inputs.',
    routes: [
      {
        method: 'GET',
        path: '/v1/places/autocomplete',
        summary:
          'Returns scoped location suggestions for airports, stay destinations, and trip planning inputs.',
        status: 'available',
        auth: 'bearer',
      },
    ],
  },
  {
    name: 'Wallet',
    description:
      'Native BTC balance, MUSD balance, wallet activity, optional borrow handoff support, and card controls.',
    routes: [
      {
        method: 'GET',
        path: '/v1/wallet/balance',
        summary:
          'Returns native BTC and MUSD wallet summary data for the signed-in user.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/wallet/position',
        summary:
          'Returns temporary app-facing borrow context without exposing full protocol risk analytics.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/wallet/transactions',
        summary: 'Returns wallet activity used by the mobile dashboard.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/wallet/borrow',
        summary:
          'Optional helper for launching or preflighting the external Mezo borrow handoff.',
        status: 'planned',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/wallet/repay',
        summary:
          'Deferred for MVP; Mezo handles protocol-side repay interactions in its own UI.',
        status: 'planned',
        auth: 'bearer',
      },
    ],
  },
  {
    name: 'Urnway balance',
    description:
      'Internal MUSD balance accounts, top-ups from the external wallet, and checkout funding state.',
    routes: [
      {
        method: 'GET',
        path: '/v1/balance',
        summary:
          'Returns the user’s Urnway-held MUSD balance plus the current external wallet snapshot used for top-ups.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/balance/activity',
        summary:
          'Returns the signed-in user balance ledger activity, including top-ups, withdrawals, internal sends, and booking debits.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/balance/topups/prepare',
        summary:
          'Prepares a wallet-funded MUSD top-up into the Urnway treasury wallet and returns wallet handoff preflight data.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/balance/topups/:topupId/submit',
        summary:
          'Submits a wallet tx hash for a prepared top-up and credits Urnway balance after onchain verification.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/balance/topups/:topupId',
        summary:
          'Returns the latest state for a prepared or submitted Urnway balance top-up intent.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/balance/withdrawals/prepare',
        summary:
          'Prepares a treasury-signed MUSD withdrawal from Urnway balance into the linked wallet.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/balance/withdrawals/:withdrawalId/submit',
        summary:
          'Submits a prepared withdrawal for immediate treasury execution and returns transaction metadata for verification.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/balance/withdrawals/:withdrawalId',
        summary:
          'Returns the latest state for a prepared or submitted Urnway balance withdrawal.',
        status: 'available',
        auth: 'bearer',
      },
    ],
  },
  {
    name: 'Onramp and offramp',
    description: 'Fiat conversion, quote, status, and FX endpoints.',
    routes: [
      {
        method: 'POST',
        path: '/v1/onramp/quote',
        summary: 'Returns fiat to MUSD quote data.',
        status: 'planned',
        auth: 'public',
      },
      {
        method: 'POST',
        path: '/v1/onramp/initiate',
        summary: 'Starts an onramp purchase flow.',
        status: 'planned',
        auth: 'mixed',
      },
      {
        method: 'POST',
        path: '/v1/offramp/initiate',
        summary: 'Starts an offramp withdrawal flow with KYC checks.',
        status: 'planned',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/fx/rates',
        summary: 'Returns cached FX rates for supported currencies.',
        status: 'planned',
        auth: 'public',
      },
    ],
  },
  {
    name: 'Payments',
    description: 'Send, request, QR, links, escrow, and nearby payment flows.',
    routes: [
      {
        method: 'GET',
        path: '/v1/payments',
        summary: 'Returns the signed-in user payment summary and enabled flow list.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/payments/links',
        summary: 'Lists the signed-in user payment links.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/payments/links',
        summary: 'Creates a payment link for sharing outside the app.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/payments/links/:slug',
        summary: 'Returns a public payment-link payload by slug.',
        status: 'available',
        auth: 'public',
      },
      {
        method: 'DELETE',
        path: '/v1/payments/links/:slug',
        summary: 'Deletes a payment link owned by the signed-in user.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/payments/links/:slug/pay',
        summary:
          'Runs wallet preflight for a payment link and prepares an unsigned MUSD transfer request.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/payments/links/:slug/submit',
        summary:
          'Records a wallet-submitted tx hash and moves the payment link into submitted state.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/payments/links/:slug/reset',
        summary:
          'Lets the owner reopen a stale payment link after a timed-out submission.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/payments/send',
        summary:
          'Runs direct-send preflight for a username recipient and prepares an unsigned MUSD transfer request.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/payments/send/prepare',
        summary:
          'Prepares a balance-aware direct send checkout using Urnway balance, external wallet, or split funding.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/payments/send/:checkoutId',
        summary:
          'Returns the current status of a prepared direct send checkout for sender/receiver verification.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/payments/send/:checkoutId/complete',
        summary:
          'Completes a prepared send checkout by debiting Urnway balance and crediting the recipient internally.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/payments/nearby/intents',
        summary:
          'Creates a nearby payment intent for a BLE-discovered receiver public user id.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/payments/nearby/intents/:intentId',
        summary:
          'Returns the current status of a nearby payment intent for sender/receiver verification.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/payments/nearby/intents/:intentId/complete',
        summary:
          'Marks a nearby payment intent as completed before the sender emits DONE over BLE.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/payments/qr/generate',
        summary:
          'Creates a QR-backed direct payment request that reuses payment-link settlement.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/payments/qr/:qr_id',
        summary: 'Loads the public payment request and QR payload for a scanned QR id.',
        status: 'available',
        auth: 'public',
      },
      {
        method: 'POST',
        path: '/v1/payments/qr/:qr_id/pay',
        summary: 'Runs the same direct-transfer preflight flow for a scanned QR request.',
        status: 'available',
        auth: 'bearer',
      },
    ],
  },
  {
    name: 'Savings',
    description: 'Travel savings goals in Urnway plus Mezo Save/Earn launchpad handoff.',
    routes: [
      {
        method: 'GET',
        path: '/v1/vaults',
        summary: 'Lists a user\'s travel goals for Mezo-backed saving.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/vaults',
        summary: 'Creates a new travel savings goal inside Urnway.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/vaults/:id',
        summary: 'Loads a single user-owned travel savings goal.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'PATCH',
        path: '/v1/vaults/roundup/settings',
        summary: 'Updates automatic roundup behavior.',
        status: 'planned',
        auth: 'bearer',
      },
    ],
  },
  {
    name: 'Trips and groups',
    description: 'Trip lifecycle, shared pools, balances, and expense settlement.',
    routes: [
      {
        method: 'GET',
        path: '/v1/trips',
        summary: 'Lists trips across planning, active, and past states.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/trips',
        summary: 'Creates a trip record with travel dates and budget.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/trips/:id',
        summary:
          'Loads a single user-owned trip record with itinerary items, expenses, and spend summary.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'PATCH',
        path: '/v1/trips/:id',
        summary: 'Updates the core plan fields for a user-owned trip.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/trips/:id/itinerary',
        summary: 'Creates a day-level itinerary item for a trip.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'PATCH',
        path: '/v1/trips/:id/itinerary/:itemId',
        summary: 'Updates an existing itinerary item for a trip.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/trips/:id/itinerary/generate',
        summary: 'Generates a structured AI itinerary draft for review before saving items.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/trips/:id/expenses',
        summary: 'Creates a trip expense and updates spend-vs-budget tracking.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'PATCH',
        path: '/v1/trips/:id/expenses/:expenseId',
        summary: 'Updates a trip expense entry for spend tracking.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/groups',
        summary: 'Creates a shared trip group and contribution pool.',
        status: 'planned',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/groups/:id/settle',
        summary: 'Executes a settlement transfer for group balances.',
        status: 'planned',
        auth: 'bearer',
      },
    ],
  },
  {
    name: 'Bookings and boarding passes',
    description: 'Flight and hotel booking flows plus stored boarding passes.',
    routes: [
      {
        method: 'GET',
        path: '/v1/bookings',
        summary: 'Lists the current user’s direct bookings with ticket state.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/bookings/flights/search',
        summary: 'Searches flight inventory for unplanned booking flows, using Duffel when configured and demo fallback otherwise.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/bookings/flights/book',
        summary: 'Creates a flight booking from a selected offer, including Duffel hold orders for supported provider-backed flights.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/bookings/checkout/prepare',
        summary:
          'Prepares a booking checkout with Urnway balance, external wallet, or split funding before provider booking is created.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/bookings/checkout/:checkoutId/complete',
        summary:
          'Completes a prepared booking checkout, reserves funds, creates the booking, and commits or releases balance accordingly.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/bookings/:id',
        summary: 'Loads a single booking with ticket issuance, cancellation, and refund state.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/bookings/:id/cancel',
        summary: 'Cancels a booking and starts or resolves the refund lifecycle.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/bookings/:id/ticket',
        summary: 'Issues a boarding pass for a confirmed booking.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/bookings/hotels/search',
        summary: 'Searches hotel inventory for unplanned stay booking flows, preferring liteAPI when enabled and falling back to demo inventory otherwise.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/bookings/hotels/book',
        summary: 'Creates a hotel booking from a selected stay offer, including liteAPI-backed booking support when provider access is enabled.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/boarding-passes',
        summary: 'Lists stored boarding passes for the signed-in user.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/boarding-passes/next',
        summary: 'Returns the next boarding pass for home-screen use.',
        status: 'available',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/boarding-passes/:id',
        summary: 'Loads a single issued boarding pass.',
        status: 'available',
        auth: 'bearer',
      },
    ],
  },
  {
    name: 'AI, notifications, and operations',
    description: 'AI planning, notifications, KYC, and inbound provider events.',
    routes: [
      {
        method: 'POST',
        path: '/v1/ai/plan',
        summary: 'Reserved generic AI planning endpoint; trip itinerary drafting currently lives under trips.',
        status: 'planned',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/notifications',
        summary: 'Lists app notifications by type and read state.',
        status: 'planned',
        auth: 'bearer',
      },
      {
        method: 'GET',
        path: '/v1/kyc/status',
        summary: 'Returns current KYC status for the signed-in user.',
        status: 'planned',
        auth: 'bearer',
      },
      {
        method: 'POST',
        path: '/v1/webhooks/mezo',
        summary: 'Current scaffold webhook endpoint pending provider-specific routes.',
        status: 'scaffold',
        auth: 'public',
      },
      {
        method: 'POST',
        path: '/v1/webhooks/goldsky',
        summary: 'Processes verified Goldsky chain events.',
        status: 'available',
        auth: 'public',
      },
    ],
  },
];

export function getRouteStatusCounts() {
  return routeGroups
    .flatMap((group) => group.routes)
    .reduce<Record<RouteStatus, number>>(
      (counts, route) => {
        counts[route.status] += 1;
        return counts;
      },
      { available: 0, scaffold: 0, planned: 0 }
    );
}
