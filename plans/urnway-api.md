# Urnway API Plan

[Back to main plan](../PLAN.md)

## Current state summary

- [x] `urnway-api` exists in the workspace
- [x] Express + TypeScript scaffold exists
- [x] App middleware exists for CORS, helmet, logging, not found, and error handling
- [x] Drizzle config and env parsing exist
- [x] Base modules exist for health, auth, wallet, payments, and webhooks
- [x] API currently builds successfully
- [x] Current code now exposes auth, wallet, direct-send, payment-link, QR, vault, trip, booking, boarding-pass, and webhook routes
- [x] Current code now exposes a protected places autocomplete route for flight, stay, and trip destination suggestions
- [x] Current schema now includes auth/session tables plus payment links, payment link attempts, travel goals, trips, bookings, and boarding passes
- [x] Canonical `/v1` API contract exists
- [x] MVP borrow strategy is clarified: use Mezo UI instead of rebuilding protocol internals
- [x] Wallet read routes now return app-facing native BTC and MUSD balances from Mezo
- [x] Payment links now support submit, stale/reset, and Goldsky-backed confirmation tracking
- [x] QR requests now reuse the direct payment-link engine and generate scannable deep-link payloads
- [ ] Most service logic is implemented
- [x] Public API docs landing page exists

## Target API shape

The API should become the canonical contract for mobile and auth web. It should
own the response envelope, auth/session rules, business logic, webhook
processing, and product-state persistence while deferring financial truth to
Mezo.

For MVP, borrowing is an external Mezo handoff, not a custom protocol
reimplementation. The API should focus on native BTC balance, MUSD balance,
wallet activity, transaction preflight, and fast balance refresh after the user
returns from Mezo.

### Foundation

- [x] Mount the canonical API under `/v1`
- [x] Keep `/api` only as a temporary compatibility alias if needed during migration
- [ ] Normalize all responses to `{ data, error, meta }`
- [ ] Standardize auth via Bearer JWT
- [ ] Standardize cursor pagination conventions
- [ ] Standardize MUSD amounts as decimal strings
- [x] Add route metadata as a checked-in source for docs and coverage checks
- [ ] Make error handling consistent across all modules
- [ ] Document environment variables and required secrets clearly

## Database and persistence

The backend should persist product state, not chain balances. Start from the
existing auth tables and expand to the planned product model.

- [x] Base auth tables exist in schema and database: `users`, `refresh_tokens`, `auth_nonces`
- [x] Add `payment_links`
- [x] Add `payment_link_attempts`
- [ ] Add `escrow_sends`
- [x] Add `trips`
- [x] Add `trip_vaults`
- [x] Add `bookings`
- [x] Add `boarding_passes`
- [ ] Add `group_trips`
- [ ] Add `group_members`
- [x] Add `expenses`
- [ ] Add `notifications`
- [ ] Add `ai_sessions`
- [ ] Add any missing support tables for Telegram connections, KYC records, and provider state
- [ ] Write migrations for all new tables
- [ ] Add seed data or fixture strategy for local development
- [ ] Define retention rules for sessions, notifications, and webhook event records

## Route families

### Auth and users

Purpose: handle Passport/WebView authentication, session management, current
user profile, push token registration, and contact discovery.

- [x] Implement `POST /auth/nonce`
- [x] Implement `POST /auth/verify`
- [x] Implement `POST /auth/refresh` with real rotation and revocation
- [x] Implement `POST /auth/logout`
- [x] Move current-user profile ownership to `GET /users/me`
- [ ] Add `PATCH /users/me`
- [ ] Add `GET /users/me/push-token`
- [ ] Add `PUT /users/me/push-token`
- [x] Add `GET /users/:username`
- [ ] Add `GET /users/search`
- [ ] Add `GET /users/me/contacts`

### Wallet

Purpose: expose native BTC balance, MUSD balance, wallet activity, Mezo borrow
handoff support, and card controls without rebuilding protocol risk analytics.

- [x] Route support exists for balance, position, and transactions
- [x] Replace wallet demo services with real native BTC + MUSD chain reads
- [ ] Add indexed wallet activity via Goldsky or event ingestion
- [x] Add a simple Mezo borrow handoff strategy or configuration surface
- [ ] Add transaction preflight checks for network, gas, and balance
- [ ] Defer custom trove dashboards, liquidation math, and protocol risk UI
- [ ] Implement `GET /wallet/card`
- [ ] Implement `PATCH /wallet/card`

### Onramp and offramp

Purpose: support fiat <-> MUSD conversion, quotes, status tracking, and FX
display.

- [ ] Implement `POST /onramp/quote`
- [ ] Implement `POST /onramp/initiate`
- [ ] Implement `POST /onramp/webhook`
- [ ] Implement `POST /offramp/quote`
- [ ] Implement `POST /offramp/initiate`
- [ ] Implement `GET /offramp/:id/status`
- [ ] Implement `GET /fx/rates`

### Payments

Purpose: power send/request, QR, links, escrow, and nearby discovery flows.

- [x] Implement `POST /payments/send`
- [ ] Implement `POST /payments/request`
- [x] Implement `POST /payments/qr/generate`
- [x] Implement `GET /payments/qr/:qr_id`
- [x] Implement `POST /payments/qr/:qr_id/pay`
- [x] Implement `POST /payments/links`
- [x] Implement `GET /payments/links/:slug`
- [x] Implement `POST /payments/links/:slug/pay`
- [x] Implement `POST /payments/links/:slug/submit`
- [x] Implement `POST /payments/links/:slug/reset`
- [x] Implement `GET /payments/links`
- [x] Implement `DELETE /payments/links/:slug`
- [ ] Implement `GET /payments/escrow`
- [ ] Implement `POST /payments/escrow/:id/cancel`
- [ ] Implement `POST /payments/nearby/discover`

### Savings

Purpose: manage travel savings goals in Urnway and hand users off to Mezo Save/Earn for the actual vault product in MVP.

- [x] Implement `GET /vaults`
- [x] Implement `POST /vaults`
- [x] Implement `GET /vaults/:id`
- [ ] Implement `POST /vaults/:id/deposit`
- [ ] Implement `POST /vaults/:id/withdraw`
- [ ] Implement `DELETE /vaults/:id`
- [ ] Implement `GET /vaults/roundup/settings`
- [ ] Implement `PATCH /vaults/roundup/settings`

### Travel

Purpose: manage trips, shared pools, bookings, expenses, and boarding passes.

- [x] Implement `GET /places/autocomplete` for airport, stay, and trip suggestion search
- [x] Implement trip routes for list, create, detail, and update
- [x] Implement trip itinerary create and update routes
- [x] Implement trip expense create and update routes with spend breakdown in trip detail
- [ ] Implement trip cancel routes
- [ ] Implement group routes for create, detail, invite, join, member removal, contributions, expense list, expense create, expense edit, balances, and settlement
- [x] Implement booking routes for flight search, flight book, detail, and ticket issuance
- [x] Add Duffel-backed flight search and hold-order booking with demo fallback
- [x] Implement hotel search and hotel book routes
- [x] Scaffold hotel search and booking integration for real provider inventory, now preferring liteAPI with demo fallback
- [x] Auto-attach linked bookings into trip itinerary items
- [x] Implement booking cancel plus refund-state tracking
- [ ] Implement provider-backed refund settlement and per-booking multi-pass flows
- [x] Implement boarding-pass routes for list, next, and detail
- [ ] Implement boarding-pass pdf and wallet pass delivery

## Integrations

### Core chain and finance integrations

- [x] viem client scaffold exists
- [x] Wire Mezo reads for native BTC and MUSD balances
- [x] Use Mezo's own borrow UI instead of rebuilding trove-level protocol integrations for MVP
- [ ] Add signed transaction preflight generation where needed
- [ ] Add MoonPay onramp and offramp integration
- [ ] Add FX rate provider integration

### Product integrations

- [ ] Add Goldsky integration for transaction history and chain event ingestion
- [x] Add Duffel integration for flights
- [ ] Validate live liteAPI hotel inventory and booking with a working API key and production-safe payment flow
- [ ] Add Expo push token support
- [ ] Add Telegram bot/webhook support
- [ ] Add storage integration for passes and documents
- [x] Add OpenAI-backed AI itinerary drafting integration
- [ ] Add KYC provider integration

## Jobs and webhooks

### Background jobs

- [ ] Add balance refresh strategy after external borrow flow only if callback-based refresh is insufficient
- [ ] Add escrow expiry job
- [ ] Add vault yield sync job
- [ ] Add booking update job
- [ ] Add refund follow-up job
- [ ] Add notification fan-out job where async delivery is required

### Webhooks

Purpose: ingest external events safely and idempotently.

- [ ] Replace `POST /webhooks/mezo` placeholder with concrete inbound routes
- [x] Implement `POST /webhooks/goldsky`
- [ ] Implement `POST /webhooks/onramp`
- [ ] Implement `POST /webhooks/duffel`
- [ ] Implement `POST /webhooks/telegram`
- [ ] Implement `POST /kyc/webhook`
- [ ] Verify HMAC signatures before processing
- [ ] Add idempotency handling for repeated provider events
- [ ] Add retry-safe processing rules for webhook failures

## API docs landing page

This is a first-class deliverable, not a nice-to-have.

- [x] Add `GET /` as a simple public API landing page
- [x] Add `GET /docs` as a grouped endpoint reference page
- [x] Include a short API overview and purpose on the landing page
- [x] Include environment and base URL guidance
- [x] Include auth flow explanation for mobile + auth web + API
- [x] Include response envelope section
- [x] Include Bearer auth rules
- [x] Include cursor pagination rules
- [x] Include MUSD decimal-string amount convention
- [x] Include health/status link
- [x] Include grouped route families with short descriptions
- [x] Render docs from checked-in route metadata instead of hard-coded duplicate text

## Testing and done criteria

### Verification

- [ ] Add route tests for all implemented route families
- [ ] Add docs coverage checks so documented routes match registered routes
- [ ] Add auth lifecycle integration tests
- [ ] Add wallet balance and external borrow-return integration tests
- [ ] Add onramp and offramp integration tests
- [ ] Add payment flow integration tests
- [ ] Add vault integration tests
- [ ] Add trip, group, booking, and boarding-pass integration tests
- [ ] Add webhook validation and idempotency tests

### Done when

- [ ] `/v1` is the canonical API surface
- [ ] Auth, users, wallet, payments, savings, travel, AI, notifications, webhooks, and KYC route families are implemented
- [ ] Placeholder service responses are removed from production paths
- [ ] The simple API landing page and `/docs` reference page are live
- [ ] Mobile and auth web can complete a real sign-in flow against this API
- [ ] Core financial and travel demo flows can run end to end against staging
