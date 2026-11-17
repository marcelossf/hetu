CREATE TABLE public.user_passkeys (
  credential_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  transports TEXT[] NOT NULL DEFAULT '{}',
  device_type TEXT NOT NULL CHECK (device_type IN ('singleDevice', 'multiDevice')),
  backed_up BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX user_passkeys_user_id_idx ON public.user_passkeys (user_id);

ALTER TABLE public.user_passkeys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_passkeys FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.user_passkeys TO service_role;

CREATE TABLE public.user_passkey_challenges (
  challenge TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('registration', 'authentication')),
  page_nonce UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX user_passkey_challenges_user_id_idx
  ON public.user_passkey_challenges (user_id);

ALTER TABLE public.user_passkey_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_passkey_challenges FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.user_passkey_challenges TO service_role;
