# Urnway Auth Web Plan

[Back to main plan](../PLAN.md)

## Current state summary

- [x] The auth web app is part of the intended architecture
- [x] `pd-chat.md` defines it as the Passport-hosting bridge between mobile and API
- [x] `urnway-auth-web` repo exists in the workspace
- [x] Next.js app scaffold exists
- [x] Passport connect flow exists
- [x] WebView handoff contract to mobile exists
- [x] Browser-based transaction handoff page exists for prepared MUSD transfers
- [ ] Staging deployment exists

## App responsibilities

This app should be a small, focused bridge. It should host Mezo Passport in a
web context, request the nonce from the API, ask the user to sign, submit
prepared wallet transactions when mobile hands them off, and return results
back to mobile. It should not own session issuance or broad product logic.

- [x] Keep the app scope limited to auth and wallet handoff
- [x] Avoid duplicating API business logic in the web app
- [x] Avoid issuing tokens from the web app
- [x] Keep all token issuance inside `urnway-api`

## Auth handoff contract

The auth web app must align exactly with the mobile and API expectations.

- [x] Scaffold a new Next.js app for `urnway-auth-web`
- [x] Add Mezo Passport connect flow
- [x] Call `POST /auth/nonce` on the API
- [x] Display the message to be signed when needed
- [x] Request wallet signature
- [x] Return `{ walletAddress, message, signature }` back to mobile
- [x] Define the WebView bridge contract
- [x] Define any deep-link fallback contract if WebView bridge fails
- [x] Validate payload shape before sending it back to mobile
- [x] Keep wallet address naming consistent across web, mobile, and API

## Screens and states

### Primary user states

- [x] Build connect-wallet screen
- [x] Build signing screen
- [x] Build success handoff screen
- [x] Build transaction-submit screen for prepared MUSD transfers
- [x] Build retry state
- [ ] Build unsupported-browser or wallet-unavailable state

### Error states

- [ ] Handle rejected signature
- [ ] Handle expired nonce
- [ ] Handle wallet unavailable
- [ ] Handle network failure to API
- [ ] Handle invalid callback payloads
- [ ] Handle stale session or repeated attempts cleanly

## Security and deployment

### Security hardening

- [ ] Add origin allowlist rules
- [x] Validate inbound and outbound message formats
- [x] Prevent token issuance in the web app
- [x] Avoid storing refresh tokens in the web app
- [ ] Prevent replay of stale signed payloads where possible
- [ ] Document trust boundaries between mobile, auth web, and API

### Deployment and smoke test

- [ ] Create staging deployment
- [ ] Configure environment variables for API base URL and Passport settings
- [ ] Verify mobile WebView can load the staging auth app
- [ ] Run smoke test for nonce -> sign -> handoff -> API verify

## Testing and done criteria

### Verification

- [ ] Add basic unit or integration tests for payload validation
- [ ] Add a smoke test for the full handoff contract
- [ ] Verify rejected-signature behavior
- [ ] Verify expired-nonce behavior
- [ ] Verify network-error behavior

### Done when

- [ ] The repo exists and is deployable
- [ ] Passport connect and signing work in staging
- [ ] Mobile receives the correct signed payload reliably
- [ ] API can verify the returned payload without manual intervention
- [ ] The auth web app stays narrow in scope and does not become a second API
