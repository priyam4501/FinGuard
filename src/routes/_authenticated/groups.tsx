import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency, SUPPORTED_CURRENCIES, DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/currency";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PendingInvites } from "@/components/pending-invites";
import { createGroup, listMyGroups, type GroupSummary } from "@/lib/api/groups";

export const Route = createFileRoute("/_authenticated/groups")({
  head: () => ({
    meta: [
      { title: "My groups — FinGuard" },
      { name: "description", content: "All the groups you belong to and their net balances." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GroupsPage,
});

function GroupsPage() {
  const queryClient = useQueryClient();

  const groupsQuery = useQuery({
    queryKey: ["my-groups"],
    queryFn: () => listMyGroups(),
  });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [submitting, setSubmitting] = useState(false);
  const nameSchema = z.string().trim().min(1, "Name is required").max(100);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      await createGroup({ name: parsed.data, currency });
      toast.success("Group created");
      setOpen(false);
      setName("");
      setCurrency(DEFAULT_CURRENCY);
      await queryClient.invalidateQueries({ queryKey: ["my-groups"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My groups</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Groups you belong to and your net balance in each.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1 h-4 w-4" /> New group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a group</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="group-name">Group name</Label>
                <Input
                  id="group-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Barcelona trip"
                  maxLength={100}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="group-currency">Currency</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
                  <SelectTrigger id="group-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  All expenses and balances in this group will be shown in this currency.
                </p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Creating…" : "Create group"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-8">
        <PendingInvites />
        {groupsQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : groupsQuery.error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            Failed to load groups: {(groupsQuery.error as Error).message}
          </div>
        ) : !groupsQuery.data || groupsQuery.data.length === 0 ? (
          <EmptyGroups onCreate={() => setOpen(true)} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groupsQuery.data.map((g) => (
              <GroupCard key={g.id} group={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GroupCard({ group }: { group: GroupSummary }) {
  const net = Number(group.netBalance);
  const positive = net > 0.005;
  const negative = net < -0.005;
  const balanceColor = positive
    ? "text-credit"
    : negative
      ? "text-debit"
      : "text-muted-foreground";
  const label = positive ? "You are owed" : negative ? "You owe" : "Settled";
  const pillClass = positive ? "pill-credit" : negative ? "pill-debit" : "";

  return (
    <Link
      to="/groups/$groupId"
      params={{ groupId: group.id }}
      className="group block rounded-3xl bg-card p-6 shadow-card transition-shadow hover:shadow-elevated"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold text-card-foreground">{group.name}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3 w-3" /> {group.memberCount}{" "}
            {group.memberCount === 1 ? "member" : "members"}
          </p>
        </div>
        {pillClass && <span className={pillClass}>{label}</span>}
      </div>
      <div className="mt-8">
        <p className={`text-3xl font-extrabold tabular-nums tracking-tight ${balanceColor}`}>
          {formatCurrency(Math.abs(net), group.currency)}
        </p>
        {!pillClass && (
          <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
        )}
      </div>
    </Link>
  );
}

function EmptyGroups({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-3xl bg-card p-12 text-center shadow-card">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
        <Users className="h-6 w-6 text-secondary-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-bold">No groups yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Create your first group to start tracking shared expenses.
      </p>
      <Button className="mt-6" onClick={onCreate}>
        <Plus className="mr-1 h-4 w-4" /> Create group
      </Button>
    </div>
  );
}
