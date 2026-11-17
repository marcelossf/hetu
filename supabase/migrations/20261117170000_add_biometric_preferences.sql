CREATE TABLE public.user_security_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  biometric_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_security_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_security_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.user_security_settings TO service_role;
