CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Lookup vocabularies (seeded from src/domain/taxonomy.ts).
CREATE TABLE skills            (code TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE assistance_types  (code TEXT PRIMARY KEY, label TEXT NOT NULL);
CREATE TABLE beneficiary_types (code TEXT PRIMARY KEY, label TEXT NOT NULL);

CREATE TYPE verification_status AS ENUM ('VERIFIED', 'PENDING', 'UNVERIFIED');

CREATE TABLE organisations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 160),
  category            TEXT NOT NULL,
  -- Organisation-provided text: untrusted, always rendered as plain text.
  description         TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  address_text        TEXT NOT NULL,
  locality            TEXT NOT NULL,
  city                TEXT NOT NULL,
  pincode             TEXT,
  location            GEOGRAPHY(Point, 4326) NOT NULL,
  contact_phone       TEXT,
  contact_email       TEXT,
  website             TEXT CHECK (website IS NULL OR website ~* '^https://'),
  safeguarding_notes  TEXT NOT NULL DEFAULT '',
  verification_status verification_status NOT NULL DEFAULT 'UNVERIFIED',
  verified_at         TIMESTAMPTZ,
  verification_note   TEXT,
  -- Fictional demo rows. Never shown without a visible DEMO label.
  is_demo             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX organisations_location_gix ON organisations USING GIST (location);
CREATE INDEX organisations_verification_idx ON organisations (verification_status);

CREATE TABLE volunteer_opportunities (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  title                  TEXT NOT NULL CHECK (length(title) BETWEEN 2 AND 160),
  activity               TEXT NOT NULL CHECK (length(activity) <= 600),
  skills                 TEXT[] NOT NULL DEFAULT '{}',
  beneficiaries          TEXT[] NOT NULL DEFAULT '{}',
  assistance_types       TEXT[] NOT NULL DEFAULT '{}',
  languages              TEXT[] NOT NULL DEFAULT '{}',
  -- Availability: which days / parts of day the organisation can host volunteers.
  days                   TEXT[] NOT NULL DEFAULT '{}',
  times_of_day           TEXT[] NOT NULL DEFAULT '{}',
  min_minutes            INT NOT NULL CHECK (min_minutes > 0),
  max_minutes            INT NOT NULL CHECK (max_minutes >= min_minutes),
  min_age                INT,
  eligibility            TEXT[] NOT NULL DEFAULT '{}',
  physical_requirement   TEXT,
  supervised             BOOLEAN NOT NULL DEFAULT TRUE,
  background_check       BOOLEAN NOT NULL DEFAULT FALSE,
  money_required         BOOLEAN NOT NULL DEFAULT FALSE,
  active                 BOOLEAN NOT NULL DEFAULT TRUE,
  -- 'admin' = entered by an admin; 'gemma_reviewed' = Gemma-extracted, admin-approved.
  need_source            TEXT NOT NULL DEFAULT 'admin' CHECK (need_source IN ('admin', 'gemma_reviewed')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX opportunities_org_idx ON volunteer_opportunities (organisation_id) WHERE active;

-- Anonymous volunteer: only a hash of a random device token. No name, email or location.
CREATE TABLE volunteer_profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE volunteer_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES volunteer_profiles(id) ON DELETE CASCADE,
  opportunity_id  UUID NOT NULL REFERENCES volunteer_opportunities(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'committed' CHECK (status IN ('committed', 'completed', 'cancelled')),
  planned_minutes INT NOT NULL CHECK (planned_minutes BETWEEN 1 AND 1440),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX volunteer_actions_profile_idx ON volunteer_actions (profile_id, created_at DESC);
