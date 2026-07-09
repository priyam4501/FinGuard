# FinGuard Backend

Spring Boot 3.3 + Java 21 + PostgreSQL REST API that powers the FinGuard
expense-splitting frontend. Fully replaces the previous Supabase backend.

## Prerequisites

- JDK 21
- PostgreSQL 14+ (locally or in Docker)
- Maven 3.9+ (or use the bundled `./mvnw`)

## Quick start

1. **Create the database**

   ```bash
   createdb finguard
   createuser finguard --pwprompt   # password: finguard (or your own)
   ```

   Or via psql:

   ```sql
   CREATE DATABASE finguard;
   CREATE USER finguard WITH PASSWORD 'finguard';
   GRANT ALL PRIVILEGES ON DATABASE finguard TO finguard;
   ```

2. **Configure environment**

   Copy `.env.example` and export the values (or set them in your shell / IDE):

   ```bash
   export DB_URL=jdbc:postgresql://localhost:5432/finguard
   export DB_USER=finguard
   export DB_PASSWORD=finguard
   export JWT_SECRET="$(openssl rand -base64 64)"
   export JWT_EXPIRY_MINUTES=1440
   export APP_CORS_ORIGINS=http://localhost:8080,http://localhost:5173
   export SERVER_PORT=8081
   ```

3. **Run**

   ```bash
   ./mvnw spring-boot:run
   ```

   Flyway applies `V1__init.sql` on first boot. The API is now serving at
   `http://localhost:8081`.

4. **Swagger UI** — `http://localhost:8081/swagger-ui.html`

## Endpoint reference

All non-auth endpoints require `Authorization: Bearer <token>`.

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/auth/signup` | Create account, returns JWT |
| POST | `/api/auth/signin` | Log in, returns JWT |
| GET  | `/api/auth/me` | Current user |
| GET  | `/api/profile` | Current profile |
| PATCH| `/api/profile` | Update name / avatar |
| GET  | `/api/groups` | Groups I belong to (with net balance + member count) |
| POST | `/api/groups` | Create group |
| GET  | `/api/groups/{id}` | Group detail |
| PATCH| `/api/groups/{id}` | Rename (owner only) |
| DELETE | `/api/groups/{id}` | Delete (owner only) |
| GET  | `/api/groups/{id}/members` | List members |
| POST | `/api/groups/{id}/members` | Add existing user by email (owner only) |
| POST | `/api/groups/{id}/invites` | Invite non-user by email (owner only) |
| GET  | `/api/groups/{id}/invites` | Pending invites for group (owner only) |
| GET  | `/api/invites` | My pending invites |
| POST | `/api/invites/{id}/accept` | Accept invite |
| POST | `/api/invites/{id}/decline` | Decline invite |
| GET  | `/api/groups/{id}/expenses` | List expenses (with splits + editable flag) |
| POST | `/api/groups/{id}/expenses` | Create expense |
| PATCH| `/api/expenses/{id}` | Update (creator or owner, and unlocked) |
| DELETE | `/api/expenses/{id}` | Delete (same rules) |
| GET  | `/api/groups/{id}/balances` | Net balance per member |
| POST | `/api/groups/{id}/settle` | Run debt-minimization engine |
| GET  | `/api/groups/{id}/settlements` | Full settlement history |
| POST | `/api/settlements/{id}/confirm` | Confirm a pending settlement |

## Curl examples

```bash
# Sign up
curl -s -X POST http://localhost:8081/api/auth/signup \
  -H 'content-type: application/json' \
  -d '{"fullName":"Alice","email":"alice@example.com","password":"password123"}'
# → { "token": "...", "expiresInSeconds": 86400, "user": {...} }

TOKEN=... # from above

# Create a group
curl -s -X POST http://localhost:8081/api/groups \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"name":"Barcelona trip","currency":"EUR"}'
```

## Architecture notes

- **Package-by-feature.** Each feature has its own `entity/ repository/ dto/
  service/ controller/` (plus `mapper/` where applicable). Shared plumbing
  (base entity, error handling, JWT, security, money helpers) lives in
  `common/`, `config/`, and `security/`.
- **DTOs everywhere.** No JPA entity is ever serialized to the wire; every
  endpoint has a Request / Response record.
- **Stateless JWT auth.** BCrypt(strength=12) for password hashing, HS256 JWTs
  issued by `JwtService`, validated per-request by `JwtAuthFilter`. Two roles
  seeded in the schema: `USER` (default on signup) and `ADMIN`.
- **JPA auditing.** `BaseEntity` provides `created_at` / `updated_at` via
  `@CreatedDate` / `@LastModifiedDate` (`@EnableJpaAuditing` on the app class).
- **Deferred sum-check trigger.** `expense_splits` are rewritten in a single
  transaction; the DB trigger validates `SUM(amount_owed) == expense.amount`
  at commit, so an invalid custom-percentage update is rolled back atomically.
- **Debt minimization.** `SettlementService.settle` mirrors the original TS
  engine: two `PriorityQueue` max-heaps, pair largest-creditor with
  largest-debtor, round to cents, push non-zero remainders back. Circular
  ledgers collapse to zero transactions.
- **Global error handler.** `GlobalExceptionHandler` returns the response
  format documented in the plan: `{timestamp, status, error, message, path}`.

## Data migration

There is no automated migration from the old Supabase database. The new
Postgres instance starts empty. Users must sign up again.
