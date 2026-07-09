import { createFileRoute, Link, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // Public landing page - no auth requirement.
  },
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-extrabold">
              F
            </div>
            <span className="text-lg font-bold tracking-tight">FinGuard</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              to="/auth"
              className="rounded-full px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent"
            >
              Sign in
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-24 text-center">
        <span className="inline-flex items-center rounded-full bg-card px-3 py-1 text-xs font-semibold text-muted-foreground shadow-card">
          Group expenses, mathematically minimized
        </span>
        <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-foreground sm:text-7xl">
          Split expenses.
          <br />
          <span className="text-credit">Settle smarter.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          FinGuard collapses tangled group debts into the mathematically minimum
          number of payments — including circular loops that cancel to zero.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Create your first group
          </Link>
          <Link
            to="/auth"
            className="rounded-full bg-card px-6 py-3 text-sm font-semibold text-foreground shadow-card hover:bg-accent"
          >
            I have an account
          </Link>
        </div>

        <div className="mt-20 grid gap-4 text-left sm:grid-cols-3">
          {[
            {
              title: "Atomic ledger",
              body: "Every expense and its splits write in a single transaction. Numbers never drift.",
            },
            {
              title: "Debt minimization",
              body: "A greedy engine reduces N members' debts to the fewest possible transfers.",
            },
            {
              title: "Group-scoped privacy",
              body: "Row-level security keeps every group's data isolated. You see only your groups.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-3xl bg-card p-6 shadow-card">
              <h3 className="text-base font-bold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

// Keep import to avoid unused warning in case of future guard usage
void redirect;
