# Urnway Plan Index

This file and the linked workstream plans are the operational source of truth
for build status and next steps.

## Project summary

Urnway is an AI-native travel app built on Mezo. The current workspace has two
active repos:

- `urnway-api`: Express + TypeScript backend scaffold with partial auth,
  wallet, payments, and webhook modules
- `urnway-mobile`: Expo app scaffold with a tab shell and mostly starter UI

The third required workstream, `urnway-auth-web`, now exists as a focused
Next.js Passport handoff app and still needs installation, staging, and mobile
integration work.

Strategic clarification:
Urnway does not rebuild Mezo's borrow protocol for MVP. Users borrow through
Mezo's existing interface, return to Urnway, and then use the refreshed MUSD
balance across payments, savings, and travel flows.

## Current status

- [x] `urnway-api` repo exists
- [x] `urnway-mobile` repo exists
- [x] `urnway-auth-web` repo exists
- [ ] Canonical `/v1` API contract is implemented
- [x] Simple API docs landing page is shipped
- [x] MVP borrow strategy is clarified: use Mezo UI rather than custom protocol internals
- [ ] End-to-end auth handoff works across mobile, auth web, and API
- [ ] End-to-end demo path works

## Workstream plans

- [Urnway API plan](plans/urnway-api.md)
- [Urnway Mobile plan](plans/urnway-mobile.md)
- [Urnway Auth Web plan](plans/urnway-auth-web.md)

## Overall sequence

1. `urnway-api`
2. `urnway-auth-web`
3. `urnway-mobile`

Reasoning:

- The API defines the contract the other apps depend on.
- The auth web app defines the Passport signing handoff mobile depends on.
- Mobile should integrate after the API and auth handoff are stable enough to
  avoid rewrites.

## Cross-cutting milestones

- [ ] API contract stabilized
- [x] Auth handoff contract agreed
- [x] API docs landing page shipped
- [ ] Staging environments configured
- [ ] End-to-end demo path working

## Repo status snapshot

| Workstream | Current State | Priority | Primary Blockers |
| --- | --- | --- | --- |
| `urnway-api` | Repo exists, builds, has live auth/session flow, serves docs at `/` and `/docs`, exposes Mezo-backed BTC/MUSD reads, supports direct send plus payment links and QR-backed direct requests through preflight, submit, stale/reset, and Goldsky confirmation, stores travel savings goals plus trips with itinerary items, AI draft generation, expense tracking, booking-first travel routes, and a protected places autocomplete route for flight, stay, and trip destination suggestions | P0 | Wallet activity indexing, nearby hardening, native vault integration, real provider payment settlement, and most route families are still missing |
| `urnway-auth-web` | Repo exists with Next.js scaffold, Passport auth flow, nonce fetch, signature handoff, and a transaction-submit bridge for prepared MUSD transfers | P0 | No staging deploy yet, auth/tx flows still need real-device smoke testing, and env setup is still manual |
| `urnway-mobile` | Repo exists with onboarding/auth flow, SecureStore session handling, a real balance-backed Home dashboard, a Pay tab that now supports direct send, links, QR requests, and nearby BLE broadcasts plus scanner routes, a Save launchpad for Mezo-backed travel goals, and a Trips surface that is now booking-first with flight search, optional trip-linked booking, Duffel hold-booking support, hotel provider-aware booking fields, boarding-pass flows, and shared location/date pickers for search and manual trip planning | P1 | Nearby hardening is still thin, live hotel-provider validation still depends on liteAPI credentials and payment setup, and broader product screens still depend on more API routes |

## How to use these files

- [ ] Update checkboxes as work is completed
- [ ] Keep cross-cutting status in this file only
- [ ] Keep repo-specific work in the linked workstream files
- [ ] Treat `README.md` files as lightweight repo docs, not delivery trackers
