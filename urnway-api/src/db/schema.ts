import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  walletAddress: text('wallet_address').notNull().unique(),
  publicUserId: text('public_user_id').unique(),
  username: text('username'),
  mezoId: text('mezo_id'),
  email: text('email'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  isRevoked: boolean('is_revoked').default(false).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const authNonces = pgTable('auth_nonces', {
  id: uuid('id').defaultRandom().primaryKey(),
  walletAddress: text('wallet_address').notNull(),
  nonce: text('nonce').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const paymentLinks = pgTable('payment_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(),
  title: text('title'),
  note: text('note'),
  amount: text('amount').notNull(),
  currency: text('currency').default('MUSD').notNull(),
  status: text('status').default('active').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const paymentLinkAttempts = pgTable('payment_link_attempts', {
  id: uuid('id').defaultRandom().primaryKey(),
  paymentLinkId: uuid('payment_link_id')
    .notNull()
    .references(() => paymentLinks.id, { onDelete: 'cascade' }),
  txHash: text('tx_hash').notNull().unique(),
  senderWalletAddress: text('sender_wallet_address').notNull(),
  recipientWalletAddress: text('recipient_wallet_address').notNull(),
  tokenAddress: text('token_address').notNull(),
  amountBaseUnits: text('amount_base_units').notNull(),
  status: text('status').default('submitted').notNull(),
  submittedAt: timestamp('submitted_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const nearbyPaymentIntents = pgTable('nearby_payment_intents', {
  id: uuid('id').defaultRandom().primaryKey(),
  intentId: text('intent_id').notNull().unique(),
  senderUserId: uuid('sender_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  receiverUserId: uuid('receiver_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  senderUsername: text('sender_username').notNull(),
  receiverPublicUserId: text('receiver_public_user_id').notNull(),
  amountMinor: integer('amount_minor').notNull(),
  currency: text('currency').notNull(),
  status: text('status').default('created').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const balanceAccounts = pgTable('balance_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  currency: text('currency').default('MUSD').notNull(),
  availableAmountMinor: integer('available_amount_minor').default(0).notNull(),
  reservedAmountMinor: integer('reserved_amount_minor').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const balanceLedgerEntries = pgTable('balance_ledger_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id')
    .notNull()
    .references(() => balanceAccounts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  entryType: text('entry_type').notNull(),
  direction: text('direction').notNull(),
  amountMinor: integer('amount_minor').notNull(),
  currency: text('currency').default('MUSD').notNull(),
  referenceType: text('reference_type'),
  referenceId: text('reference_id'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const balanceTopupIntents = pgTable('balance_topup_intents', {
  id: uuid('id').defaultRandom().primaryKey(),
  topupId: text('topup_id').notNull().unique(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  amountMinor: integer('amount_minor').notNull(),
  currency: text('currency').default('MUSD').notNull(),
  status: text('status').default('prepared').notNull(),
  treasuryWalletAddress: text('treasury_wallet_address').notNull(),
  tokenAddress: text('token_address').notNull(),
  senderWalletAddress: text('sender_wallet_address'),
  txHash: text('tx_hash').unique(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const sendCheckouts = pgTable('send_checkouts', {
  id: uuid('id').defaultRandom().primaryKey(),
  checkoutId: text('checkout_id').notNull().unique(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  receiverUserId: uuid('receiver_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  receiverPublicUserId: text('receiver_public_user_id'),
  receiverUsername: text('receiver_username'),
  amountMinor: integer('amount_minor').notNull(),
  currency: text('currency').default('MUSD').notNull(),
  source: text('source').notNull(),
  urnwayBalanceAmountMinor: integer('urnway_balance_amount_minor')
    .default(0)
    .notNull(),
  externalWalletAmountMinor: integer('external_wallet_amount_minor')
    .default(0)
    .notNull(),
  note: text('note'),
  status: text('status').default('prepared').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const tripVaults = pgTable('trip_vaults', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  targetAmount: text('target_amount').notNull(),
  allocatedAmount: text('allocated_amount').default('0').notNull(),
  currency: text('currency').default('MUSD').notNull(),
  note: text('note'),
  status: text('status').default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const trips = pgTable('trips', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  destination: text('destination').notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  budgetAmount: text('budget_amount').notNull(),
  currency: text('currency').default('MUSD').notNull(),
  note: text('note'),
  status: text('status').default('planning').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const bookings = pgTable('bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tripId: uuid('trip_id').references(() => trips.id, { onDelete: 'set null' }),
  provider: text('provider').default('demo').notNull(),
  providerOfferId: text('provider_offer_id'),
  providerOrderId: text('provider_order_id'),
  holdExpiresAt: timestamp('hold_expires_at', { withTimezone: true }),
  mode: text('mode').default('flight').notNull(),
  status: text('status').default('confirmed').notNull(),
  originLabel: text('origin_label').notNull(),
  originCode: text('origin_code').notNull(),
  destinationLabel: text('destination_label').notNull(),
  destinationCode: text('destination_code').notNull(),
  departDate: text('depart_date').notNull(),
  returnDate: text('return_date'),
  carrierCode: text('carrier_code').notNull(),
  carrierName: text('carrier_name').notNull(),
  flightNumber: text('flight_number').notNull(),
  duration: text('duration').notNull(),
  cabinClass: text('cabin_class').notNull(),
  travelerCount: integer('traveler_count').default(1).notNull(),
  passengerName: text('passenger_name').notNull(),
  totalAmount: text('total_amount').notNull(),
  currency: text('currency').default('MUSD').notNull(),
  paymentSource: text('payment_source'),
  fundedAmount: text('funded_amount'),
  fundedCurrency: text('funded_currency'),
  bookingReference: text('booking_reference').notNull().unique(),
  note: text('note'),
  cancellationPolicy: text('cancellation_policy').default('Flexible refund policy').notNull(),
  refundStatus: text('refund_status').default('not_requested').notNull(),
  refundAmount: text('refund_amount').default('0').notNull(),
  cancelRequestedAt: timestamp('cancel_requested_at', { withTimezone: true }),
  refundedAt: timestamp('refunded_at', { withTimezone: true }),
  ticketIssuedAt: timestamp('ticket_issued_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const bookingCheckouts = pgTable('booking_checkouts', {
  id: uuid('id').defaultRandom().primaryKey(),
  checkoutId: text('checkout_id').notNull().unique(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tripId: uuid('trip_id').references(() => trips.id, { onDelete: 'set null' }),
  bookingId: uuid('booking_id'),
  mode: text('mode').notNull(),
  source: text('source').notNull(),
  totalAmountMinor: integer('total_amount_minor').notNull(),
  currency: text('currency').default('MUSD').notNull(),
  quoteAmount: text('quote_amount').notNull(),
  quoteCurrency: text('quote_currency').notNull(),
  urnwayBalanceAmountMinor: integer('urnway_balance_amount_minor')
    .default(0)
    .notNull(),
  externalWalletAmountMinor: integer('external_wallet_amount_minor')
    .default(0)
    .notNull(),
  payloadJson: text('payload_json').notNull(),
  status: text('status').default('prepared').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const boardingPasses = pgTable('boarding_passes', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookingId: uuid('booking_id')
    .notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').default('issued').notNull(),
  passengerName: text('passenger_name').notNull(),
  carrierCode: text('carrier_code').notNull(),
  carrierName: text('carrier_name').notNull(),
  flightNumber: text('flight_number').notNull(),
  originCode: text('origin_code').notNull(),
  destinationCode: text('destination_code').notNull(),
  departDate: text('depart_date').notNull(),
  bookingReference: text('booking_reference').notNull(),
  ticketNumber: text('ticket_number').notNull().unique(),
  gate: text('gate').notNull(),
  seat: text('seat').notNull(),
  boardingGroup: text('boarding_group').notNull(),
  qrPayload: text('qr_payload').notNull(),
  issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const tripItineraryItems = pgTable('trip_itinerary_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  tripId: uuid('trip_id')
    .notNull()
    .references(() => trips.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  date: text('date').notNull(),
  location: text('location'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
