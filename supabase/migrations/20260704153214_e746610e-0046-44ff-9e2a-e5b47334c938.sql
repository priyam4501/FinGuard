ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'INR';

ALTER TABLE public.groups
  ADD CONSTRAINT groups_currency_iso4217 CHECK (currency ~ '^[A-Z]{3}$');