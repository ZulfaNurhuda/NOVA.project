// db/schema.ts
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// ── Secrets ────────────────────────────────────────────────────
export const secrets = pgTable(
  'secrets',
  {
    id:         uuid('id').primaryKey().defaultRandom(),
    secret:     text('secret').notNull(),
    title:      text('title'),
    views:      integer('views').default(1),
    password:   text('password'),
    salt:       text('salt').notNull(),
    isBurnable: boolean('is_burnable').default(false),
    createdAt:  timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt:  timestamp('expires_at', { withTimezone: true }).notNull(),
    ipRange:    text('ip_range').default(''),
    userId:     text('user_id'),
  },
  (t) => [
    index('secrets_expires_at_idx').on(t.expiresAt),
    index('secrets_user_id_idx').on(t.userId),
  ]
);

// ── Files ──────────────────────────────────────────────────────
export const files = pgTable('files', {
  id:        uuid('id').primaryKey().defaultRandom(),
  filename:  text('filename').notNull(),
  path:      text('path').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── Users ──────────────────────────────────────────────────────
export const users = pgTable('user', {
  id:               text('id').primaryKey(),
  name:             text('name').notNull(),
  username:         text('username').notNull().unique(),
  email:            text('email').notNull().unique(),
  emailVerified:    boolean('emailVerified').notNull(),
  image:            text('image'),
  createdAt:        timestamp('createdAt', { withTimezone: true }).notNull(),
  updatedAt:        timestamp('updatedAt', { withTimezone: true }).notNull(),
  displayUsername:  text('displayUsername'),
  role:             text('role').default('user'),
  banned:           boolean('banned').default(false),
  banReason:        text('banReason'),
  banExpires:       timestamp('banExpires', { withTimezone: true }),
  inviteCodeUsed:   text('inviteCodeUsed'),
  twoFactorEnabled: boolean('twoFactorEnabled').default(false),
});

// ── Sessions ───────────────────────────────────────────────────
export const sessions = pgTable('session', {
  id:        text('id').primaryKey(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  token:     text('token').notNull().unique(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId:    text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
});

// ── Accounts ───────────────────────────────────────────────────
export const accounts = pgTable('account', {
  id:                    text('id').primaryKey(),
  accountId:             text('accountId').notNull(),
  providerId:            text('providerId').notNull(),
  userId:                text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken:           text('accessToken'),
  refreshToken:          text('refreshToken'),
  idToken:               text('idToken'),
  accessTokenExpiresAt:  timestamp('accessTokenExpiresAt',  { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { withTimezone: true }),
  scope:                 text('scope'),
  password:              text('password'),
  createdAt:             timestamp('createdAt', { withTimezone: true }).notNull(),
  updatedAt:             timestamp('updatedAt', { withTimezone: true }).notNull(),
});

// ── Verifications ──────────────────────────────────────────────
export const verifications = pgTable('verification', {
  id:         text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value:      text('value').notNull(),
  expiresAt:  timestamp('expiresAt', { withTimezone: true }).notNull(),
  createdAt:  timestamp('createdAt', { withTimezone: true }),
  updatedAt:  timestamp('updatedAt', { withTimezone: true }),
});

// ── Two Factor ─────────────────────────────────────────────────
export const twoFactor = pgTable('twoFactor', {
  id:          uuid('id').primaryKey().defaultRandom(),
  secret:      text('secret').notNull(),
  backupCodes: text('backupCodes').notNull(),
  userId:      text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
});

// ── Instance Settings ──────────────────────────────────────────
export const instanceSettings = pgTable('instance_settings', {
  id:                         uuid('id').primaryKey().defaultRandom(),
  instanceName:               text('instanceName').default(''),
  instanceDescription:        text('instanceDescription').default(''),
  instanceLogo:               text('instanceLogo').default(''),
  allowRegistration:          boolean('allowRegistration').default(true),
  requireEmailVerification:   boolean('requireEmailVerification').default(false),
  defaultSecretExpiration:    integer('defaultSecretExpiration').default(72),
  maxSecretSize:              integer('maxSecretSize').default(1024),
  allowPasswordProtection:    boolean('allowPasswordProtection').default(true),
  allowIpRestriction:         boolean('allowIpRestriction').default(true),
  enableRateLimiting:         boolean('enableRateLimiting').default(true),
  rateLimitRequests:          integer('rateLimitRequests').default(100),
  rateLimitWindow:            integer('rateLimitWindow').default(60),
  requireInviteCode:          boolean('requireInviteCode').default(false),
  allowedEmailDomains:        text('allowedEmailDomains').default(''),
  requireRegisteredUser:      boolean('requireRegisteredUser').default(false),
  disableEmailPasswordSignup: boolean('disableEmailPasswordSignup').default(false),
  webhookEnabled:             boolean('webhookEnabled').default(false),
  webhookUrl:                 text('webhookUrl').default(''),
  webhookSecret:              text('webhookSecret').default(''),
  webhookOnView:              boolean('webhookOnView').default(true),
  webhookOnBurn:              boolean('webhookOnBurn').default(true),
  importantMessage:           text('importantMessage').default(''),
  metricsEnabled:             boolean('metricsEnabled').default(false),
  metricsSecret:              text('metricsSecret').default(''),
  allowFileUploads:           boolean('allowFileUploads').default(true),
  createdAt:                  timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt:                  timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ── Invite Codes ───────────────────────────────────────────────
export const inviteCodes = pgTable('invite_codes', {
  id:        uuid('id').primaryKey().defaultRandom(),
  code:      text('code').notNull().unique(),
  uses:      integer('uses').default(0).notNull(),
  maxUses:   integer('maxUses').default(1),
  expiresAt: timestamp('expiresAt', { withTimezone: true }),
  createdBy: text('createdBy').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  isActive:  boolean('isActive').default(true).notNull(),
});

// ── Visitor Analytics ──────────────────────────────────────────
export const visitorAnalytics = pgTable(
  'visitor_analytics',
  {
    id:        uuid('id').primaryKey().defaultRandom(),
    path:      text('path').notNull(),
    uniqueId:  text('uniqueId').notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('visitor_analytics_timestamp_idx').on(t.timestamp),
    index('visitor_analytics_unique_id_idx').on(t.uniqueId),
  ]
);

// ── API Keys ───────────────────────────────────────────────────
export const apiKeys = pgTable('api_keys', {
  id:         uuid('id').primaryKey().defaultRandom(),
  name:       text('name').notNull(),
  keyHash:    text('key_hash').notNull().unique(),
  keyPrefix:  text('key_prefix').notNull(),
  userId:     text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt:  timestamp('expires_at',   { withTimezone: true }),
  createdAt:  timestamp('created_at',   { withTimezone: true }).defaultNow().notNull(),
});

// ── Secret Requests ────────────────────────────────────────────
export const secretRequests = pgTable(
  'secret_requests',
  {
    id:            uuid('id').primaryKey().defaultRandom(),
    title:         text('title').notNull(),
    description:   text('description'),
    maxViews:      integer('max_views').default(1).notNull(),
    expiresIn:     integer('expires_in').notNull(),
    password:      text('password'),
    allowedIp:     text('allowed_ip'),
    preventBurn:   boolean('prevent_burn').default(false).notNull(),
    token:         text('token').notNull().unique(),
    webhookUrl:    text('webhook_url'),
    webhookSecret: text('webhook_secret'),
    status:        text('status').default('pending').notNull(),
    userId:        text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    secretId:      uuid('secret_id').unique().references(() => secrets.id, { onDelete: 'set null' }),
    createdAt:     timestamp('created_at',   { withTimezone: true }).defaultNow().notNull(),
    expiresAt:     timestamp('expires_at',   { withTimezone: true }).notNull(),
    fulfilledAt:   timestamp('fulfilled_at', { withTimezone: true }),
  },
  (t) => [
    index('secret_requests_user_id_idx').on(t.userId),
    index('secret_requests_token_idx').on(t.token),
    index('secret_requests_status_idx').on(t.status),
  ]
);
