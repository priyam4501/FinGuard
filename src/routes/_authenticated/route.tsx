import { createFileRoute, Outlet, Link, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, LogOut, User as UserIcon, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!loading && !user) {
      void router.navigate({ to: "/auth", replace: true });
    }
  }, [loading, user, router]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    signOut();
    void router.navigate({ to: "/auth", replace: true });
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Skeleton className="h-12 w-40" />
      </div>
    );
  }

  const initial = (user.fullName || user.email || "?").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center gap-2 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground font-extrabold">
            F
          </div>
          <span className="text-base font-bold tracking-tight text-sidebar-foreground">
            FinGuard
          </span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          <Link
            to="/groups"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
          >
            <LayoutDashboard className="h-4 w-4" />
            My groups
          </Link>
          <Link
            to="/profile"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
          >
            <UserIcon className="h-4 w-4" />
            Profile
          </Link>
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-sm font-semibold">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {user.fullName || user.email}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background px-4 md:hidden">
        <Link to="/groups" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
            F
          </div>
          <span className="text-sm font-semibold">FinGuard</span>
        </Link>
        <button
          onClick={handleSignOut}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-background md:hidden">
        <Link
          to="/groups"
          className="flex flex-1 flex-col items-center gap-1 py-2 text-xs text-muted-foreground"
          activeProps={{ className: "text-foreground" }}
        >
          <Users className="h-5 w-5" />
          Groups
        </Link>
        <Link
          to="/profile"
          className="flex flex-1 flex-col items-center gap-1 py-2 text-xs text-muted-foreground"
          activeProps={{ className: "text-foreground" }}
        >
          <UserIcon className="h-5 w-5" />
          Profile
        </Link>
      </nav>

      <main className="md:pl-60 pb-16 md:pb-0">
        <Outlet />
      </main>
    </div>
  );
}
