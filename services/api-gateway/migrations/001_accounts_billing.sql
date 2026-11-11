-- EyeShots accounts, sessions, billing and usage.
-- PRIVACY: this database must never contain document contents or file names.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 text NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  last_login_at         timestamptz,
  -- Billing (denormalised from the active Stripe subscription for fast quota checks)
  stripe_customer_id    text UNIQUE,
  plan                  text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team')),
  plan_status           text,          -- Stripe subscription status (active, trialing, past_due, canceled…)
  current_period_end    timestamptz,
  cancel_at_period_end  boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));

-- One-time sign-in codes (hashed; never stored in clear text).
CREATE TABLE login_codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  code_hash    text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  attempts     integer NOT NULL DEFAULT 0,
  consumed_at  timestamptz
);
CREATE INDEX login_codes_email_idx ON login_codes (lower(email), created_at DESC);

-- Sessions: only a SHA-256 of the token is stored, so a DB leak can't be replayed.
CREATE TABLE sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    text NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  user_agent    text
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE subscriptions (
  id                    text PRIMARY KEY,               -- Stripe subscription id
  user_id               uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status                text NOT NULL,
  price_id              text,
  plan                  text NOT NULL,
  current_period_end    timestamptz,
  cancel_at_period_end  boolean NOT NULL DEFAULT false,
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_user_idx ON subscriptions (user_id);

-- Daily cloud-task counters. subject = 'user:<uuid>' or 'ip:<hmac>' (IP never stored raw).
CREATE TABLE usage_daily (
  subject      text NOT NULL,
  day          date NOT NULL,
  cloud_tasks  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (subject, day)
);

-- Stripe webhook idempotency.
CREATE TABLE stripe_events (
  id            text PRIMARY KEY,
  type          text NOT NULL,
  processed_at  timestamptz NOT NULL DEFAULT now()
);
