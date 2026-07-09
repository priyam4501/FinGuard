# FinGuard — Project Explanation (Interview Prep)

Written as if I'm answering an interviewer. Grounded in what actually exists in this repository — nothing invented, nothing exaggerated.

---

## 1. Project Introduction

FinGuard is a group expense-splitting web application with a debt-minimization settlement engine. You form a group with a few people, log expenses as they happen — someone paid, some subset of the group owes — and at any point the app can compute the minimum number of transfers required to settle everyone up. It's a full-stack project: a React SPA on the frontend (TanStack Start), a Spring Boot 3 REST API on the backend, PostgreSQL for storage, and JWT-based stateless authentication. The core piece I care about most is the settlement engine — it correctly recognizes cases like circular debts, where a naive per-expense settlement would produce many transactions but the right answer is zero.

## 2. Why did you build this project?

I wanted a project that combined a real algorithm with production-shaped engineering — auth, authorization, database invariants, transactional writes, a typed client-server contract — instead of a CRUD app with a spinning gradient on the landing page. Splitting expenses in shared groups is a problem I've hit personally and everyone understands it, so the domain doesn't need explaining. And the settlement problem is *actually* interesting: the general minimum-transaction case is NP-hard, so it forces you to reason about heuristics, edge cases, and what "correct" even means.

## 3. What problem does it solve?

The problem is that in a shared-expense group, the raw pairwise debt graph becomes fragmented fast. Alice paid for dinner, Bob paid for the cab, Carol paid for groceries — after a week nobody knows who owes whom on net. The traditional solution is a spreadsheet, or a per-expense "you owe me back" transaction, both of which produce phantom balances (A owes B, B owes C, C owes A, all cancellable by inspection but nobody bothers). FinGuard reduces the ledger to the fewest possible transfers and, critically, returns *zero* transactions when the ledger already cancels out.

## 4. Who are the users?

End users: small groups of people sharing expenses — roommates, trip organizers, families, small teams running a shared tab. The kind of user who would otherwise use Splitwise.

Also, as a portfolio project, engineers reading the code — the architecture and the settlement engine are meant to be legible reference material.

## 5. Real-world use cases

- Four roommates splitting rent, utilities, and groceries throughout the month, then settling once.
- A trip organizer paying for hotels, dinners, and cabs in one currency and reconciling with everyone at the end.
- A small team running a shared coffee/lunch tab.
- Any group where multiple people front costs on behalf of the group and want to settle net.

## 6. Application Flow

```
User signs up  →  logs in (JWT issued)
     ↓
Creates a group (auto becomes OWNER)
     ↓
Invites members by email
     ↓
Invitees accept — added to group_members
     ↓
Members log expenses (payer + splits)
     ↓
Balances tab derives each member's net position
     ↓
Any member clicks "Calculate" — engine returns a minimal plan
     ↓
Payer or receiver of each transfer confirms it
     ↓
Confirmed settlements are netted into balances; involved expenses lock
```

## 7. Complete Architecture Explanation

- **Frontend**: React 19 SPA on TanStack Start. File-based routes, TanStack Query for server state, a single `fetch` wrapper that attaches the JWT and handles 401 → sign out.
- **Backend**: Spring Boot 3.3 REST API on JVM 21. Package-by-feature (`auth`, `group`, `expense`, `settlement`, `invite`, `profile`), thin controllers, service layer that owns the transaction boundary, Spring Data JPA on top of Hibernate.
- **Database**: PostgreSQL. Native enums, `numeric(10,2)` money, `uuid` PKs, and a deferred constraint trigger that guarantees expense splits always sum to the parent expense at commit.
- **Authentication**: stateless JWT (HS256, jjwt 0.12). BCrypt(12) password hashing. Roles in a separate `user_roles` table.
- **Settlement Engine**: a Java implementation using two `BigDecimal` max-heaps — largest creditor paired with largest debtor, transfer `min(c, |d|)`, push non-zero remainder back, repeat. Idempotent: if a pending plan exists, it's returned unchanged instead of a new one being generated.

## 8. Database Design Decisions

- **`users`** — one row per person. Password stored as a BCrypt hash, never plaintext. `email` unique, indexed on `lower(email)` because signin is case-insensitive.
- **`user_roles`** — separate table, not a column on `users`. Prevents privilege-escalation-by-column-update and matches the industry-standard pattern.
- **`groups`** — logical container for members, expenses, and settlements. Carries a currency because a group transacts in one currency.
- **`group_members`** — many-to-many with a role (`OWNER` / `MEMBER`). Unique `(group_id, user_id)` prevents double-adds.
- **`group_invites`** — pending invites by email so you can invite someone before they sign up. Status enum tracks accept/decline.
- **`expenses`** — one row per logged expense with `payer_id` and total `amount`. `numeric(10,2)` so money is exact.
- **`expense_splits`** — one row per (expense, user) with `amount_owed`. Unique on `(expense_id, user_id)`.
- **Deferred trigger `trg_expense_splits_sum`** — fires at commit and enforces `SUM(amount_owed) == expense.amount`. This is *the* database-level guarantee that the ledger is never corrupt: a bug in any service method that would leave splits unbalanced fails the whole transaction.
- **`settlements`** — proposed / confirmed transfers between two users in a group. `PENDING` doesn't affect balances; `CONFIRMED` does.
- **Cascades**: `ON DELETE CASCADE` for owned children, `ON DELETE RESTRICT` for shared references (a user who has paid an expense can't be hard-deleted, preserving the audit trail).

## 9. Settlement Algorithm Deep Dive

**Why it exists.** Per-expense settlement produces N transactions for N expenses and misses cancellations. On a real group ledger you want the smallest set of transfers that zeroes everyone.

**Why greedy.** The general minimum-transaction settlement problem is NP-hard (a reduction from partition/subset-sum). A greedy pairing of the largest creditor with the largest debtor is the standard heuristic — the same one Splitwise uses. At every step at least one party is fully zeroed, which gives an upper bound of `n − 1` transactions for `n` non-zero balances. It runs in `O(n log n)` per settlement round, which for realistic group sizes is negligible.

**Complexity.** `O(n log n)` where `n` is the number of members with a non-zero net balance. Heap operations dominate.

**Trade-offs.**
- Not provably globally optimal in every configuration.
- Produces a *distribution* of transfers by size; the biggest transfer is always the first one emitted.
- Deterministic given a fixed tie-breaking order.

**Limitations.**
- Doesn't try to prefer "socially convenient" pairings (e.g. always pay the person you owe most).
- Doesn't consider partial payments.

**Edge cases handled.**
- **Circular debt** (A→B→C→A, everyone net-zero) → returns an empty plan, not a shuffled cycle.
- **Idempotency** — if a PENDING plan already exists for the group, `settle` returns it unchanged instead of proposing a competing plan.
- **Confirmed vs pending** — the balance query includes only confirmed settlements, so a rerun of Calculate against an unacted plan produces the same plan.
- **Rounding** — every transfer is scaled to 2 decimals with `HALF_UP` before being pushed back to the heap; anything below a 0.005 epsilon is treated as zero.

## 10. Challenges Faced During Development

### 10.1 Floating-point precision

- **Problem.** An early version used `double` for split arithmetic. Summing three-way splits of $60 gave `19.999999999999996` and the "settled" state was actually off by fractions of a cent.
- **Why it happened.** IEEE-754 binary floats can't represent common decimal values exactly.
- **Effect.** Balances never truly hit zero; the algorithm's "is this zero" check kept firing false positives and negatives.
- **Fix.** All money is `BigDecimal` with scale = 2 and `RoundingMode.HALF_UP`, funnelled through `common/Money.java`. Postgres stores `numeric(10,2)`.
- **Lesson.** Money is not a `double`. Decide the scale + rounding mode once, centralize it, and enforce it at every boundary.

### 10.2 Circular debt

- **Problem.** Naive greedy engines happily emit a plan that shuffles money around a cycle when the true answer is "nobody owes anyone".
- **Why.** They treat each debt independently instead of netting first.
- **Fix.** The engine consumes `BalanceService.getBalances`, which returns *net* balances. Members within a 0.005 epsilon are dropped before the heap is even built. A fully cancelling ledger produces an empty plan.
- **Lesson.** Compute at the right level of abstraction. Net first, then plan.

### 10.3 Settlement idempotency

- **Problem.** Two members clicking "Calculate" at the same moment would create competing pending plans.
- **Why.** No guard against existing plans.
- **Fix.** `settle` first queries for existing PENDING settlements for the group and returns them unchanged if any exist. The balance query excludes PENDING settlements so a rerun against an unacted plan proposes the same plan.
- **Lesson.** For "propose a plan" endpoints, define idempotency semantics explicitly; don't leave it to hope.

### 10.4 Editing historical expenses

- **Problem.** A user could confirm a settlement based on today's ledger, then edit or delete a historical expense so the settlement no longer reflects reality.
- **Fix.** `ExpenseService.requireEditable` returns 403 if the expense's `created_at` is not later than the group's most recent `confirmed_at`. Update and delete both call it. The list endpoint returns an `editable` flag so the UI can render a lock icon.
- **Lesson.** Immutability of historical facts is a domain constraint, not a UX suggestion. Enforce it server-side.

### 10.5 Splits that don't sum

- **Problem.** A `CUSTOM_PERCENTAGE` split could be off by a cent due to rounding, or by any amount due to a client bug, and would silently corrupt balances.
- **Fix.** Two layers. In the service, `validateSplitsSum` checks equality after `Money.scale`. In the database, a **deferred constraint trigger** re-checks at commit — so even a bug in any future writer can't corrupt the ledger.
- **Lesson.** Defence in depth. Application checks catch bugs early; database checks catch bugs you didn't know you had.

### 10.6 Rewriting splits atomically

- **Problem.** Updating an expense means deleting old splits and inserting new ones. If the trigger fired per-row, mid-update the sum would be wrong.
- **Fix.** The trigger is `DEFERRABLE INITIALLY DEFERRED` and fires at commit. `ExpenseService.update` runs inside `@Transactional`, deletes existing splits, flushes, inserts new ones. Either the whole rewrite commits or nothing changes.
- **Lesson.** Deferred constraints exist for exactly this pattern.

### 10.7 Authorization on shared resources

- **Problem.** Hiding a button in the UI is not authorization. Any authenticated user could hit a mutation endpoint for a group they don't belong to.
- **Fix.** Every mutating service method calls `AuthUtil.requireId()` — the caller ID from the JWT, never a value from the body — and then a check (`requireMembership`, `requireOwner`, `requireCanModify`). Failures throw `AppException.forbidden` → HTTP 403 with the standard envelope.
- **Lesson.** Trust the token, not the payload. Authorize where the write happens.

### 10.8 JWT authentication

- **Problem.** Choosing between session cookies and JWTs, then wiring the filter chain so the `SecurityContext` was populated *before* controller dispatch.
- **Fix.** Stateless JWT. `JwtAuthFilter` extends `OncePerRequestFilter`, added before Spring's `UsernamePasswordAuthenticationFilter`, materializes a `CurrentUser` principal.
- **Lesson.** Stateless auth is simpler to scale but has real trade-offs (revocation, expiry) — be honest about them.

### 10.9 Transaction consistency across services

- **Problem.** `settle` reads balances, computes a plan, writes settlements. If any step failed midway you could end up with partial state.
- **Fix.** Single `@Transactional` service method. The balance read and the settlement writes are one atomic unit.
- **Lesson.** Define the transaction boundary at the service method, not the repository.

### 10.10 Frontend/backend contract

- **Problem.** Shape drift between the API responses and what the UI expected caused runtime null-derefs.
- **Fix.** Records for DTOs on the backend + Zod schemas at every mutation boundary on the frontend, all funnelled through one API client. Errors follow one envelope shape.
- **Lesson.** Type the contract on both sides, and have one place per side that owns the wire format.

## 11. Limitations

Being honest:

- **No refresh tokens.** The client re-authenticates when the token expires. Adding refresh + rotation is straightforward but out of scope.
- **No JWT revocation.** A compromised token is valid until it expires. Acceptable for the project's scope; production would want a revocation list or short-lived access + long-lived refresh.
- **Single-currency per group.** No FX conversion between groups.
- **No offline mode.** The app requires connectivity.
- **No recurring expenses.**
- **No receipt OCR or receipt uploads.**
- **No caching layer.** Every request hits Postgres. Fine at this scale.
- **No analytics or spend trends.**
- **No push / email notifications.**
- **No rate-limiting on signin.** Assumed to be an upstream concern in production.
- **Greedy settlement, not provably optimal.** Fine for realistic group sizes; called out honestly.

Why not implemented: each is a significant piece of scope that would dilute the focus on the settlement-correctness and integrity story.

## 12. Future Enhancements

- Refresh tokens + rotation, revocation list.
- Multi-currency groups with FX rates and per-expense currency.
- Recurring expenses / templates.
- Receipt uploads with thumbnails.
- Partial settlement confirmation.
- Settlement reversal as a first-class operation (rather than an offsetting settlement).
- CSV / PDF export.
- Push and email notifications.
- Group analytics dashboard.
- OAuth social login.
- Materialized balance projections for large groups.
- Rate-limiting and account lockout at the app layer.

## 13. Performance Considerations

- **Indexes** on every hot query path: `lower(email)`, `(group_id, created_at DESC)`, `(group_id, status)`, `(user_id)`.
- **Balance** computed in one native SQL with CTEs — no N+1.
- **BigDecimal** arithmetic is slower than `double` but not remotely a bottleneck at group-scale.
- **Read-only transactions** on list endpoints for JDBC optimizations.
- **Batch inserts** for settlement plans via `saveAll`.
- **TanStack Query** on the frontend dedupes and caches server state.
- **Pagination** is intentionally not implemented — groups are small — but the query shape would support it (order by `created_at DESC` + `LIMIT/OFFSET`).

## 14. Security Considerations

- **JWT (HS256)** with a rotating server-side secret; validated on every request by `JwtAuthFilter`.
- **BCrypt** password hashing at strength 12; hashes never logged.
- **Server-side authorization** on every mutation using the JWT-derived user ID, never a client-supplied ID.
- **Bean Validation** on every request DTO (`@NotBlank`, `@Email`, `@Positive`, ...).
- **SQL injection** — Spring Data JPA and parameterized native queries. No string concatenation into SQL.
- **XSS** — React escapes by default; no `dangerouslySetInnerHTML` on user content.
- **CSRF** — disabled because the API is stateless bearer-token auth (no cookies), which is the recommended posture for pure REST APIs.
- **Roles in a separate table** to prevent privilege escalation.
- **Expense lock after confirmation** prevents retroactive-ledger tampering.
- **Uniform error envelope** so leakage of internal exception messages is contained.

## 15. If I had more time...

- Add refresh tokens and a revocation list.
- Materialize balances so large groups don't recompute every read.
- Full integration test suite (Testcontainers + Postgres) covering the settlement engine's edge cases: circular debt, idempotency, epsilon rounding, single-member, large-group.
- Rate-limit `/api/auth/signin` and add account lockout.
- Structured audit logging for every mutation.
- CI pipeline running `mvn verify` + frontend `bun test`.
- Multi-currency and FX conversion.
- Extract the settlement engine into its own module so it can be unit-tested and reused.

## 16. Interview Questions (40+)

### Architecture

**Q1. Why did you split the app into a separate frontend and backend instead of a single monolith?**
A. Independent deployability, clear contract, ability to swap either side. The frontend is a static SPA that can be served from a CDN; the backend is a stateless JVM service that scales horizontally.

**Q2. Why Spring Boot rather than Express / FastAPI?**
A. Mature, opinionated, enterprise-standard, with first-class integrations for the ingredients this project needs — security, JPA, validation, migrations, OpenAPI. Also a strong hiring signal for Java roles.

**Q3. Why PostgreSQL over MySQL or MongoDB?**
A. Native `numeric` for exact money, native enums, deferred constraint triggers, transactional DDL, strong referential integrity. The data model is deeply relational; a document store would be the wrong fit.

**Q4. Why is your backend stateless?**
A. Any instance can serve any request, which means trivial horizontal scaling and no sticky sessions. JWT carries the identity, so no session table.

**Q5. What's the trade-off of stateless JWTs?**
A. Revocation is coarse — a compromised token is valid until it expires. In production I'd pair short-lived access tokens with refresh tokens + a revocation list.

**Q6. Why package-by-feature instead of package-by-layer?**
A. Feature packages keep everything about one domain concept co-located; a new engineer can read one folder to understand a feature. Layered packages spread one feature across many folders.

### Authentication & Security

**Q7. Why BCrypt and why strength 12?**
A. BCrypt is a slow, salted, adaptive hash — designed for passwords. Strength 12 is the current pragmatic default (~250ms/hash on modern hardware), tunable upward as hardware improves.

**Q8. Why HS256 and not RS256?**
A. HS256 is simpler for a single-service backend — one shared secret. RS256 makes sense when multiple services need to verify tokens without sharing the signing secret, which isn't the case here.

**Q9. Where do you store the JWT on the client?**
A. `localStorage`. It's readable by JS which is a real XSS risk, mitigated by React's default escaping and no `dangerouslySetInnerHTML` on user content. HttpOnly cookies would be safer against XSS but introduce CSRF concerns; both are valid choices with different trade-offs.

**Q10. Why is CSRF disabled?**
A. The API is stateless bearer-token auth. CSRF protection defends against browser-attached cookies being used unintentionally; there are no cookies here.

**Q11. Where does authorization happen?**
A. In every service method that mutates data, using the user ID from the JWT (never from the request body).

**Q12. Why are roles in a separate table?**
A. Prevents privilege escalation via a column update, and cleanly supports multiple roles per user.

**Q13. What stops a user from editing an expense in a group they don't belong to?**
A. `ExpenseService.update` calls `requireCanModify(userId, expense)` — creator or group owner — and it uses the JWT-derived `userId`.

**Q14. What's the expense lock rule?**
A. An expense is only editable while `expense.created_at > MAX(settlements.confirmed_at)` for that group. Prevents retroactive edits after a settlement is confirmed on that ledger state.

**Q15. What happens if someone spams `/signin`?**
A. Currently nothing at the application layer — that's an honest limitation. Production would put rate-limiting at the edge and add account lockout.

### Database

**Q16. Why `numeric(10,2)` for money?**
A. Exact decimal representation. IEEE-754 binary floats can't represent `0.1 + 0.2` exactly and compound errors over many transactions.

**Q17. What's the split-sum trigger and why is it deferred?**
A. `trg_expense_splits_sum` re-validates that `SUM(amount_owed) == expense.amount`. It's deferred so an `update` that deletes old splits and inserts new ones inside one transaction can commit — the check runs once at commit, not per row.

**Q18. Why `ON DELETE RESTRICT` on some FKs and `CASCADE` on others?**
A. Cascade for owned children (a group's members / expenses / settlements go with the group). Restrict for shared references — a user who has paid an expense cannot be hard-deleted because that would destroy audit history.

**Q19. Why indexes on `lower(email)`?**
A. Signin is case-insensitive. Without the functional index, `WHERE lower(email) = ?` would seq-scan.

**Q20. How are enums stored?**
A. As native Postgres `ENUM` types with a small custom Hibernate `PgEnumType` binder so JPA maps them cleanly to Java enums.

**Q21. Why UUID PKs?**
A. Externally opaque (no ID enumeration), safe to generate client-side or server-side, easy for future distributed generation. Cost: larger index, ~16 bytes vs 8 for bigint. Acceptable at this scale.

### Settlement Engine

**Q22. Explain the algorithm.**
A. Fetch net balances (paid − owed ± confirmed settlements). Drop members within a 0.005 epsilon. Put creditors in a max-heap keyed by amount, debtors in another. Pop the largest of each, transfer `min(c, |d|)` rounded to cents, push non-zero remainder back. Repeat until either heap is empty.

**Q23. Why greedy?**
A. The general minimum-transaction settlement is NP-hard. Greedy is a well-understood heuristic — bounded by `n − 1` transactions and used by production apps like Splitwise.

**Q24. Complexity?**
A. `O(n log n)` per round, where `n` is members with non-zero net balance.

**Q25. Why does circular debt return zero transactions?**
A. Because the engine consumes *net* balances, and in a perfect cycle every net balance is zero. Every member is dropped in the epsilon filter and the heaps are empty.

**Q26. What if two users click "Calculate" at once?**
A. `settle` first queries for existing PENDING settlements and returns them if any exist. So the second click sees the first click's plan instead of a competing one.

**Q27. Why exclude PENDING from the balance query?**
A. Because pending is a proposal, not a fact. Including it would make a rerun of Calculate double-count the same proposal.

**Q28. How do you avoid infinite loops from rounding?**
A. Every value is scaled to 2 decimals with `HALF_UP` before being pushed back, and anything below a `0.005` epsilon is treated as zero. A remainder that would loop forever gets floored to zero.

**Q29. Is the plan globally optimal?**
A. No. It's a heuristic. It's bounded and near-optimal in practice.

**Q30. How would you make it optimal?**
A. Brute-force / DP over subsets that sum to zero — exponential in `n`. Not worth it for realistic group sizes.

### Transactions & Consistency

**Q31. Where's the transaction boundary?**
A. On the service method with `@Transactional`. Controllers and repositories don't manage transactions.

**Q32. What happens when an expense update has an unbalanced split?**
A. Delete + insert runs inside `@Transactional`. The deferred trigger fires at commit and rejects the sum mismatch, so the whole update rolls back and the original expense is untouched.

**Q33. Why `@Transactional(readOnly = true)` on reads?**
A. Enables JDBC read-only mode which lets the driver / DB skip some overhead, and defensively prevents accidental writes.

### Frontend

**Q34. Why TanStack Start?**
A. File-based routing with typed links, first-class SSR/CSR flexibility, and TanStack Query integration. Kept the frontend surface small.

**Q35. Why TanStack Query?**
A. Owns server state — cache, dedupe, invalidate — so components don't reinvent it. Mutations invalidate the relevant keys instead of hand-mutating the cache.

**Q36. Why Zod?**
A. Validate at every mutation boundary before the request even leaves the browser. Catches errors early with typed messages, and the schemas double as TypeScript types.

**Q37. Where does the JWT live and how is it attached?**
A. `localStorage` under `finguard_token`. Attached by the single `fetch` wrapper in `src/lib/api/client.ts` on every request. On 401 the wrapper dispatches a global sign-out event.

### Design & Trade-offs

**Q38. Why not use Supabase / Firebase?**
A. This project used to be on Supabase and was intentionally rebuilt on Spring Boot + Postgres for the interview story: to demonstrate stateless JWT auth, service-layer authorization, transactional writes, and a real service layer instead of RLS-only.

**Q39. Why don't you materialize balances?**
A. Not necessary at this scale. Balances compute in one native SQL. Materializing would trade write latency for read latency and add invalidation complexity.

**Q40. Why no refresh tokens?**
A. Deliberate scoping — the interesting story is the settlement engine and integrity model, not the auth token lifecycle. Called out as a limitation.

**Q41. How would you scale this to a million users?**
A. Backend is stateless so N replicas behind a load balancer. Postgres is the bottleneck — add read replicas for balance/history reads, then partition by `group_id`. Add a cache (Redis) for hot group reads. Extract the settlement engine into a stateless service that consumes balances.

**Q42. What would you test first?**
A. The settlement engine — circular debt returns empty, idempotency, epsilon handling, single-member group, and a big randomized property test that the final balances all zero out.

**Q43. What's the biggest risk in the current design?**
A. JWT revocation. A compromised token is valid until expiry.

**Q44. What did you learn?**
A. That the interesting part of a "simple" domain is the invariants — splits sum to expense, confirmed settlements are immutable, pending plans are idempotent — and that enforcing them in the database, not just the service, is what makes the system trustworthy.

## 17. One-Minute Project Explanation

FinGuard is a group expense-splitting app with a debt-minimization settlement engine. You form a group, log expenses as they happen — payer plus split — and when you want to settle up, the app computes the minimum number of transfers required to zero out everyone's balance. It's a full-stack build: React 19 with TanStack Start on the frontend, Spring Boot 3 with stateless JWT auth on the backend, and PostgreSQL for storage. The interesting piece is the algorithm — greedy pairing of the largest creditor with the largest debtor, using BigDecimal max-heaps — which correctly returns zero transactions for a fully cancelling ledger. Money is `numeric(10,2)` and a deferred database trigger guarantees splits always sum to the expense at commit, so a bug in any service method can't corrupt the ledger.

## 18. Three-Minute Project Explanation

FinGuard is a shared-expense app aimed at the "who owes whom on net" problem that hits roommates, trip groups, and small teams. You create a group, invite people by email, log expenses with a payer and a split — either equal or custom percentage — and when it's time to settle, the app computes a minimal plan.

The stack is React 19 on TanStack Start on the frontend, Spring Boot 3.3 on JVM 21 on the backend, and PostgreSQL. Authentication is stateless JWT with BCrypt(12) password hashing and roles in a separate table. The backend is package-by-feature — auth, group, expense, settlement, invite, profile — with thin controllers, service methods that own the transaction boundary, and Spring Data JPA on top of Hibernate.

The settlement engine is the reason the project exists. It runs on net balances — paid − owed ± confirmed settlements — pushes creditors and debtors into two BigDecimal max-heaps, pairs the largest of each, transfers `min(creditor, |debtor|)` rounded to cents, and pushes any non-zero remainder back. It runs in `O(n log n)` and produces at most `n − 1` transfers. Critically, it returns *zero* transactions for a fully cancelling ledger — the circular-debt case where naive engines shuffle money around a ring for no reason. It's also idempotent: while a pending plan exists, calling settle again returns that plan instead of proposing a competing one.

There are two places the invariants really matter. First, expense splits must sum to the expense amount — enforced both in the service and by a deferred Postgres constraint trigger, so a bug in any writer can't corrupt the ledger. Second, once a settlement is confirmed, the expenses it was based on are locked from further edits — enforced by comparing `expense.created_at` against the group's latest `confirmed_at`, preventing retroactive-ledger attacks.

Honest limitations: no refresh tokens, no revocation, single-currency per group, no rate-limiting at the app layer, and the settlement engine is a heuristic rather than provably optimal.

## 19. Ten-Minute Deep Dive

I'll walk it top to bottom.

**The problem.** Shared-expense groups produce fragmented pairwise debts. Alice pays for dinner, Bob for the cab, Carol for groceries — nobody knows net position. Manual settlement produces phantom transactions (A owes B, B owes C, C owes A, all cancellable). FinGuard reduces this to a minimal set of transfers and, importantly, correctly detects when a ledger cancels out to zero.

**The architecture.** Two processes. A React SPA on TanStack Start and a Spring Boot REST API on JVM 21, talking JSON over HTTPS with JWT bearer auth. No shared state. PostgreSQL for storage, Flyway for migrations.

**The frontend.** File-based routes under `src/routes/`. The `_authenticated` layout route redirects to `/auth` if there's no token in `localStorage`. TanStack Query owns server state; mutations invalidate keys instead of hand-mutating cache. A single `fetch` wrapper attaches the JWT, normalizes errors, and dispatches a global sign-out event on 401. Zod schemas at every mutation boundary catch shape mismatches before they leave the browser.

**The backend.** Package-by-feature: `auth`, `group`, `expense`, `settlement`, `invite`, `profile`, plus `user`, `balance`, and shared plumbing in `common`, `config`, `security`. Thin controllers. Service methods own the transaction boundary — `@Transactional(readOnly = true)` on reads, `@Transactional` on writes. Constructor injection everywhere. Records for DTOs. Entities never serialized to the wire. MapStruct where mapping is non-trivial.

**Authentication.** Stateless JWT (HS256, jjwt 0.12). `JwtAuthFilter` extends `OncePerRequestFilter`, runs before Spring's auth filter, parses the `Authorization: Bearer` header, verifies the signature, and populates a `CurrentUser` principal with the user ID and roles. Passwords hashed with BCrypt(12) and never logged.

**Authorization.** Every mutating service method calls `AuthUtil.requireId()` — the JWT-derived user ID — and then a domain check: `requireMembership`, `requireOwner`, `requireCanModify`, `requireEditable`. Never trust the request body for identity.

**Database.** PostgreSQL with UUIDs, native enums, `numeric(10,2)` money, `timestamptz` timestamps. Cascades on owned children, restricts on shared references. Indexes on hot paths — `lower(email)`, `(group_id, created_at DESC)`, `(group_id, status)`. The interesting bit is a **deferred constraint trigger** on `expense_splits` that verifies `SUM(amount_owed) == expense.amount` at commit — so a rewrite that briefly unbalances splits is fine within a transaction but rejected at commit.

**Balance calculation.** One native SQL with CTEs — `members`, `paid`, `owed`, `sent`, `received` — that returns `paid − owed + confirmed_sent − confirmed_received` per member. Pending settlements are deliberately excluded so a rerun of Calculate against an unacted plan doesn't double-count.

**Settlement engine.** Fetch net balances. Filter members within a 0.005 epsilon. Build two `BigDecimal` max-heaps — creditors and debtors keyed by absolute amount. Loop: pop the largest of each, compute `min(c, |d|)` scaled to 2 decimals, emit a PENDING settlement, push non-zero remainders back. Runs in `O(n log n)`, bounded by `n − 1` transactions. Idempotent: existing PENDING plan short-circuits.

**Expense lifecycle.** Create validates that the payer and every split target are group members, and that splits sum to the amount. Update deletes existing splits, flushes, inserts new ones inside one transaction; the deferred trigger fires at commit. Delete requires the expense is still editable — `created_at > MAX(confirmed_at)` for the group.

**Confirmation.** `SettlementService.confirm` requires the caller be the from-user or to-user of that specific settlement. Idempotent — a repeat call returns the same record. There is no reversal endpoint; a reversal must be a new offsetting settlement, preserving the audit trail.

**Error contract.** `GlobalExceptionHandler` maps every exception — validation, forbidden, not found, everything else — to `{timestamp, status, error, message, path}`. One shape, so the frontend has one error handler.

**Documentation.** OpenAPI via springdoc, served at `/swagger-ui.html`.

**What I'd do with more time.** Refresh tokens + revocation. Full Testcontainers integration test suite for the settlement engine's edge cases. Rate-limiting on signin. Materialize balances for large groups. Extract the settlement engine into its own module for reuse and testing.

## 20. Resume Project Description

**One-line.**
FinGuard — full-stack group expense-splitting app (React 19 + Spring Boot 3 + PostgreSQL) featuring a greedy debt-minimization settlement engine bounded by `n − 1` transactions and stateless JWT auth.

**Medium.**
Full-stack expense-splitting application with an automated debt-minimization settlement engine. React 19 on TanStack Start on the frontend; Spring Boot 3.3 with Spring Security 6, Spring Data JPA, and PostgreSQL on the backend. Stateless JWT authentication with BCrypt(12) password hashing and service-layer authorization on every mutation. Settlement engine implemented with BigDecimal max-heaps, bounded by `n − 1` transactions, correctly returning zero transactions for circular-debt ledgers. Money stored as `numeric(10,2)` with a deferred Postgres constraint trigger guaranteeing expense splits always sum to the parent expense at commit.

**Long.**
Designed and implemented FinGuard, a full-stack group expense-splitting web application with a focus on ledger integrity and algorithmic correctness. Built the frontend as a React 19 SPA on TanStack Start with TanStack Query, Tailwind CSS, and shadcn/ui, and Zod validation at every mutation boundary. Built the backend as a Spring Boot 3.3 REST API on JVM 21 using Spring Security 6 (stateless JWT with jjwt 0.12), Spring Data JPA on top of Hibernate, and PostgreSQL managed by Flyway. Adopted a package-by-feature layout (`auth`, `group`, `expense`, `settlement`, `invite`, `profile`), records for DTOs, MapStruct for mapping, and a thin-controller / transactional-service architecture with constructor injection everywhere. Implemented a debt-minimization settlement engine using two `BigDecimal` max-heaps, running in `O(n log n)`, bounded by `n − 1` transactions, idempotent under concurrent invocation, and correctly returning zero transactions for circular-debt ledgers. Enforced ledger integrity with a deferred Postgres constraint trigger guaranteeing that expense splits always sum to the parent expense at commit, and with an expense-lock rule that prevents retroactive edits after a settlement is confirmed. Exposed the entire REST surface via springdoc-openapi and standardized error responses through a global exception handler.
