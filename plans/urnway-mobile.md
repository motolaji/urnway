# Urnway Mobile Plan

[Back to main plan](../PLAN.md)

## Current state summary

- [x] `urnway-mobile` exists in the workspace
- [x] Expo Router scaffold exists
- [x] A tab shell exists for Home, Pay, Trips, Save, and Profile
- [x] The repo has local starter screens for the tab routes
- [x] Lint runs successfully
- [x] Home screen reflects the current auth and dashboard slice
- [x] Home screen now shows an API-backed wallet snapshot
- [x] Pay screen now supports send-by-username plus payment links through submit, pending, stale/reset, and confirmed states
- [ ] Full Profile surface still needs expansion, and Trips still needs hotels, refunds, and broader transport layers
- [x] WebView auth integration exists
- [x] Secure token storage and refresh handling exist
- [ ] End-to-end API integration exists

## Navigation and app shell

The mobile app should be the primary user-facing product surface. It should own
navigation, user state, orchestration, device capabilities, and clean error and
loading states.

### Replace Expo starter content

- [x] Replace starter Home content with a real Urnway dashboard shell
- [x] Replace starter Pay screen content
- [x] Replace starter Save screen content
- [x] Replace starter Trips screen content
- [x] Replace starter Profile screen content
- [ ] Remove any remaining Expo tutorial copy and demo UI elements

### App shell, theme, navigation, loading, and error states

- [x] Tab navigation scaffold exists
- [ ] Finalize route structure for auth, tabs, modals, and detail screens
- [ ] Add shared layout primitives for cards, lists, states, and section headers
- [ ] Add loading skeletons for dashboard, wallet, trips, and boarding-pass views
- [ ] Add empty states for no trips, no vaults, no payments, and no notifications
- [ ] Add reusable inline error and retry states
- [ ] Align typography, spacing, and color tokens to a consistent Urnway visual system

## Auth integration

### WebView auth flow with `urnway-auth-web`

- [x] Open the hosted auth experience inside a WebView
- [x] Trigger API nonce creation through the auth web app
- [x] Receive `{ walletAddress, message, signature }` back from auth web
- [x] Exchange the signed payload with the API verify endpoint
- [ ] Handle cancel, reject, timeout, and retry states cleanly
- [x] Define the deep-link or postMessage contract for handoff completion

### Token storage and refresh handling

- [x] Store access and refresh tokens securely on device
- [x] Hydrate session state on app launch
- [x] Refresh access tokens automatically
- [x] Handle logout cleanly
- [x] Handle expired or revoked sessions by returning to auth

## Wallet and finance screens

### Home dashboard

- [x] Show MUSD balance
- [x] Show native BTC balance
- [ ] Show vault progress summary
- [x] Show quick actions for pay, save, borrow, and profile
- [ ] Show next travel item or boarding pass if available

### Wallet, borrow handoff, and transaction preflight

Borrowing should hand off to Mezo's own interface for MVP. Urnway should guide
the user into that flow, detect the updated MUSD balance on return, and focus on
what the user does with MUSD next.

- [ ] Build wallet balance and transaction history screens
- [x] Build `Borrow MUSD` CTA that opens Mezo's borrow interface
- [x] Detect updated MUSD balance after returning from Mezo
- [ ] Add transaction preflight checks for network, gas, and balance
- [ ] Add guided review, pending, success, and failure states around external wallet interactions
- [x] Defer custom collateral dashboards and risk management UI

### Vault screens

- [x] Build vault list screen
- [x] Build create vault flow
- [ ] Build vault detail screen
- [ ] Build deposit flow
- [ ] Build withdraw flow
- [ ] Build round-up settings UI

## Payment rails

### Pay flows

- [x] Build send-by-username flow
- [ ] Build request payment flow
- [x] Build QR generator flow
- [x] Build QR scanner flow
- [x] Build payment link create and share flow
- [x] Build payment link pay flow
- [x] Submit returned tx hashes to the API after wallet handoff
- [x] Poll settlement status until link is `confirmed` or `stale`
- [x] Show pending, confirmed, and stale states for direct payment links
- [x] Show owner-only reset action for stale payment links
- [ ] Build escrow status and cancel UI
- [x] Build nearby payments entry point
- [ ] Build contacts send flow

### Device capabilities and edge cases

- [x] Add camera permission handling for QR scanning
- [x] Add Bluetooth permission and availability handling
- [x] Add fallback states when QR is unavailable
- [x] Add fallback states when nearby is unavailable
- [ ] Handle expired QR and already-claimed link states
- [ ] Handle insufficient balance with borrow upsell path

## Travel and group flows

### Trip screens

- [x] Build trip list screen
- [x] Build create trip flow
- [x] Build trip detail screen
- [x] Build itinerary view and edit flow
- [x] Add AI itinerary draft review and accept flow
- [x] Build spend-vs-budget views

### Group pool and expense screens

- [ ] Build group detail screen
- [ ] Build invite and join flow
- [ ] Build contribute-to-pool flow
- [x] Build expense list and create flow
- [ ] Build balances and settlement flow

### Booking and boarding-pass screens

- [x] Build flight search UI
- [x] Build hotel search UI
- [x] Build booking confirmation flow
- [x] Build booking detail flow
- [x] Build booking cancellation flow
- [x] Build refund status UI
- [ ] Build boarding-pass list screen
- [x] Build boarding-pass detail screen
- [ ] Add offline-ready boarding-pass access strategy

## Notifications and profile

### Push notifications and profile settings

- [ ] Register Expo push tokens with the API
- [ ] Add notification inbox UI
- [ ] Add notification preference controls
- [ ] Add profile view and edit flow
- [x] Add logout action
- [ ] Add connected identity display priority: username, Mezo ID, short wallet

## Testing and done criteria

### End-to-end mobile QA checklist

- [ ] Auth works from cold start to signed-in session
- [x] Wallet data loads against the real API
- [ ] Borrow handoff, MUSD balance refresh, and vault flows work against staging
- [ ] QR, links, and send flows work against staging
- [ ] Trips, groups, bookings, and boarding-pass flows work against staging
- [ ] Notifications arrive and deep-link correctly
- [ ] Error states are readable and actionable

### Done when

- [ ] All visible starter content is removed
- [ ] Core finance screens are production-shaped
- [ ] Core payment rails are production-shaped
- [ ] Trip, booking, and boarding-pass flows are usable
- [ ] Auth, session refresh, and logout work end to end
- [ ] Mobile can drive the demo without manual backend workarounds
