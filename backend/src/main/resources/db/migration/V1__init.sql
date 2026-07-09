-- FinGuard initial schema (Postgres-native, no RLS, no SECURITY DEFINER)
-- All authorization + editability rules live in the Spring service layer.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- Enums ----------
CREATE TYPE member_role       AS ENUM ('OWNER', 'MEMBER');
CREATE TYPE invite_status     AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
CREATE TYPE split_strategy    AS ENUM ('EQUAL', 'CUSTOM_PERCENTAGE');
CREATE TYPE settlement_status AS ENUM ('PENDING', 'CONFIRMED');
CREATE TYPE app_role          AS ENUM ('USER', 'ADMIN');

-- ---------- Users ----------
CREATE TABLE users (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email          TEXT        NOT NULL UNIQUE,
    password_hash  TEXT        NOT NULL,
    full_name      TEXT        NOT NULL,
    avatar_url     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_email_lower ON users (lower(email));

CREATE TABLE user_roles (
    id      UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role    app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- ---------- Groups ----------
CREATE TABLE groups (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL,
    currency   TEXT        NOT NULL DEFAULT 'INR',
    created_by UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE group_members (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id  UUID        NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role      member_role NOT NULL DEFAULT 'MEMBER',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (group_id, user_id)
);
CREATE INDEX idx_group_members_user ON group_members (user_id);

-- ---------- Invites ----------
CREATE TABLE group_invites (
    id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id      UUID          NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    invited_email TEXT          NOT NULL,
    invited_by    UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status        invite_status NOT NULL DEFAULT 'PENDING',
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_group_invites_email_status ON group_invites (lower(invited_email), status);

-- ---------- Expenses ----------
CREATE TABLE expenses (
    id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id       UUID           NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    payer_id       UUID           NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount         NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    description    TEXT           NOT NULL,
    split_strategy split_strategy NOT NULL DEFAULT 'EQUAL',
    created_by     UUID           NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_group_created ON expenses (group_id, created_at DESC);

CREATE TABLE expense_splits (
    id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id  UUID           NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id     UUID           NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount_owed NUMERIC(10, 2) NOT NULL CHECK (amount_owed >= 0),
    UNIQUE (expense_id, user_id)
);
CREATE INDEX idx_expense_splits_user ON expense_splits (user_id);

-- Deferred constraint: sum(amount_owed) MUST equal expense.amount at commit time.
CREATE OR REPLACE FUNCTION check_expense_splits_sum() RETURNS TRIGGER AS $$
DECLARE
    v_expense_id UUID;
    v_amount     NUMERIC(10,2);
    v_sum        NUMERIC(10,2);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_expense_id := OLD.expense_id;
    ELSE
        v_expense_id := NEW.expense_id;
    END IF;

    SELECT amount INTO v_amount FROM expenses WHERE id = v_expense_id;
    IF v_amount IS NULL THEN
        RETURN NULL;  -- parent expense already gone
    END IF;

    SELECT COALESCE(SUM(amount_owed), 0) INTO v_sum
      FROM expense_splits WHERE expense_id = v_expense_id;

    IF v_sum <> v_amount THEN
        RAISE EXCEPTION 'Expense splits sum (%.2f) must equal expense amount (%.2f)', v_sum, v_amount;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_expense_splits_sum
    AFTER INSERT OR UPDATE OR DELETE ON expense_splits
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION check_expense_splits_sum();

-- ---------- Settlements ----------
CREATE TABLE settlements (
    id           UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id     UUID              NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    from_user_id UUID              NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    to_user_id   UUID              NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount       NUMERIC(10, 2)    NOT NULL CHECK (amount > 0),
    status       settlement_status NOT NULL DEFAULT 'PENDING',
    generated_at TIMESTAMPTZ       NOT NULL DEFAULT now(),
    confirmed_at TIMESTAMPTZ,
    CHECK (from_user_id <> to_user_id)
);
CREATE INDEX idx_settlements_group_status ON settlements (group_id, status);
