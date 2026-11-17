-- One external purchase (a Google Play purchase token, a Stripe payment id) can unlock Worlds for one account only.
-- Manual grants carry no external_ref and are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS entitlements_external_ref_unique ON entitlements(source, external_ref) WHERE external_ref IS NOT NULL;
