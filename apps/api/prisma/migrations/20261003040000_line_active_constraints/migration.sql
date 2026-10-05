-- No existing channel is rewritten. Duplicate/invalid legacy identities stop deployment.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
DECLARE line_id UUID;
BEGIN
  IF (SELECT count(*) FROM platforms WHERE lower(btrim(code)) = 'line') > 1 THEN
    RAISE EXCEPTION 'Canonical LINE platform requires reviewed remediation';
  END IF;
  SELECT id INTO line_id FROM platforms WHERE lower(btrim(code)) = 'line';
  IF line_id IS NULL THEN
    line_id := gen_random_uuid();
    INSERT INTO platforms(id, code, name, status, created_at, updated_at)
      VALUES (line_id, 'line', 'LINE', 'active', now(), now());
  END IF;
  IF EXISTS (SELECT 1 FROM channels WHERE platform_id = line_id
      AND status NOT IN ('disconnected', 'disabled')
      AND (external_channel_id IS NULL OR external_channel_id !~ '^[0-9]{1,255}$')) THEN
    RAISE EXCEPTION 'Active LINE identities require reviewed remediation';
  END IF;
  EXECUTE format('CREATE UNIQUE INDEX channels_one_active_line_per_merchant ON channels(merchant_id) WHERE platform_id = %L::uuid AND status NOT IN (''disconnected'', ''disabled'')', line_id);
  -- Claims require verified credentials; CONFIGURED alone does not reserve another owner's OA.
  -- Legacy connected rows retain their reservation until explicitly remediated.
  EXECUTE format('CREATE UNIQUE INDEX channels_one_claim_per_line_oa ON channels(btrim(external_channel_id)) WHERE platform_id = %L::uuid AND (status = ''connected'' OR line_claimed_at IS NOT NULL)', line_id);
  EXECUTE format('CREATE UNIQUE INDEX channels_one_claim_per_line_bot ON channels(line_bot_user_id) WHERE platform_id = %L::uuid AND line_claimed_at IS NOT NULL', line_id);
  EXECUTE format('ALTER TABLE channels ADD CONSTRAINT channels_line_identity_check CHECK (platform_id <> %L::uuid OR status IN (''disconnected'', ''disabled'') OR (external_channel_id IS NOT NULL AND external_channel_id ~ ''^[0-9]{1,255}$''))', line_id);
  -- NOT VALID preserves the seeded unverified CONNECTED row without endorsing it.
  -- New/updated rows must comply. Validation is a separate approved remediation gate.
  EXECUTE format('ALTER TABLE channels ADD CONSTRAINT channels_line_connection_proof_check CHECK (platform_id <> %L::uuid OR (
    credential_revision >= 0
    AND is_connected = (status = ''connected'')
    AND (status NOT IN (''credentials_verified'', ''webhook_pending'', ''connected'') OR (
      access_token_encrypted IS NOT NULL AND channel_secret_encrypted IS NOT NULL
      AND credentials_verified_at IS NOT NULL AND line_claimed_at IS NOT NULL
      AND line_bot_user_id IS NOT NULL AND line_bot_user_id ~ ''^U[0-9a-f]{32}$''
    ))
    AND (status <> ''connected'' OR (webhook_verified_at IS NOT NULL AND line_bot_user_id IS NOT NULL))
  )) NOT VALID', line_id);
END $$;

CREATE UNIQUE INDEX platforms_canonical_line_key ON platforms(lower(btrim(code)))
  WHERE lower(btrim(code)) = 'line';

CREATE FUNCTION chatto_preserve_line_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM platforms WHERE id IN (OLD.platform_id, NEW.platform_id)
      AND lower(btrim(code)) = 'line')
    AND (OLD.merchant_id IS DISTINCT FROM NEW.merchant_id
      OR OLD.platform_id IS DISTINCT FROM NEW.platform_id
      OR OLD.external_channel_id IS DISTINCT FROM NEW.external_channel_id) THEN
    RAISE EXCEPTION 'LINE channel identity cannot be transferred' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER channels_preserve_line_identity BEFORE UPDATE ON channels
  FOR EACH ROW EXECUTE FUNCTION chatto_preserve_line_identity();

CREATE FUNCTION chatto_preserve_line_platform() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF lower(btrim(OLD.code)) = 'line' AND NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'Canonical LINE platform identity is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER platforms_preserve_line_identity BEFORE UPDATE ON platforms
  FOR EACH ROW EXECUTE FUNCTION chatto_preserve_line_platform();
COMMIT;
