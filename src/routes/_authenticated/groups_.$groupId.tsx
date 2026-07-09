import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Lock,
  Pencil,
  Plus,
  Settings,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency, round2 } from "@/lib/currency";
import { useAuth } from "@/hooks/use-auth";
import {
  getGroup,
  listGroupMembers,
  getGroupBalances,
  renameGroup,
  deleteGroup as apiDeleteGroup,
  addExistingMember,
  type GroupMember,
  type Balance,
} from "@/lib/api/groups";
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense as apiDeleteExpense,
  type ExpenseResponse,
  type SplitStrategy,
} from "@/lib/api/expenses";
import {
  settleGroup,
  confirmSettlement,
  settlementHistory,
  type Settlement,
} from "@/lib/api/settlements";
import { createInvite, groupPendingInvites } from "@/lib/api/invites";
import { ApiError } from "@/lib/api/client";

export const Route = createFileRoute("/_authenticated/groups_/$groupId")({
  head: () => ({
    meta: [
      { title: "Group — FinGuard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GroupDetailPage,
});

function GroupDetailPage() {
  const { groupId } = Route.useParams();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const groupQuery = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => getGroup(groupId),
  });

  const membersQuery = useQuery({
    queryKey: ["group-members", groupId],
    queryFn: () => listGroupMembers(groupId),
  });

  const balancesQuery = useQuery({
    queryKey: ["group-balances", groupId],
    queryFn: () => getGroupBalances(groupId),
  });

  const expensesQuery = useQuery({
    queryKey: ["group-expenses", groupId],
    queryFn: () => listExpenses(groupId),
  });

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["group-expenses", groupId] });
    void queryClient.invalidateQueries({ queryKey: ["group-balances", groupId] });
    void queryClient.invalidateQueries({ queryKey: ["my-groups"] });
  };

  const currentUserId = currentUser?.id;
  const isOwner =
    !!currentUserId &&
    membersQuery.data?.some((m) => m.userId === currentUserId && m.role === "OWNER");

  if (groupQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-6 h-96 w-full" />
      </div>
    );
  }
  if (groupQuery.error || !groupQuery.data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          Failed to load group.
        </div>
      </div>
    );
  }

  const currency = groupQuery.data.currency ?? "INR";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <Link
        to="/groups"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All groups
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{groupQuery.data.name}</h1>
            {isOwner && (
              <GroupSettingsMenu
                groupId={groupId}
                groupName={groupQuery.data.name}
                onRenamed={() => {
                  void queryClient.invalidateQueries({ queryKey: ["group", groupId] });
                  void queryClient.invalidateQueries({ queryKey: ["my-groups"] });
                }}
              />
            )}
          </div>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Currency · {currency}
          </p>
        </div>
        <div className="flex gap-2">
          {isOwner && (
            <AddMemberDialog groupId={groupId} onDone={() => {
              void queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
              void queryClient.invalidateQueries({ queryKey: ["group-balances", groupId] });
            }} />
          )}
          <ExpenseFormDialog
            mode="create"
            groupId={groupId}
            members={membersQuery.data ?? []}
            currentUserId={currentUserId}
            currency={currency}
            onDone={invalidateAll}
          />
        </div>
      </div>

      <Tabs defaultValue="expenses" className="mt-6">
        <TabsList>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="settle">Settle up</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="mt-6">
          <ExpensesList
            groupId={groupId}
            expenses={expensesQuery.data}
            members={membersQuery.data ?? []}
            loading={expensesQuery.isLoading}
            currency={currency}
            currentUserId={currentUserId}
            isOwner={!!isOwner}
            onChange={invalidateAll}
          />
        </TabsContent>

        <TabsContent value="balances" className="mt-6">
          <BalancesList
            balances={balancesQuery.data}
            loading={balancesQuery.isLoading}
            currentUserId={currentUserId}
            currency={currency}
          />
        </TabsContent>

        <TabsContent value="settle" className="mt-6">
          <SettleUpPanel
            groupId={groupId}
            members={membersQuery.data ?? []}
            currency={currency}
            currentUserId={currentUserId}
          />
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <MembersList
            groupId={groupId}
            members={membersQuery.data}
            loading={membersQuery.isLoading}
            isOwner={!!isOwner}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}


/* --------------- Expenses --------------- */

function ExpensesList({
  groupId,
  expenses,
  members,
  loading,
  currency,
  currentUserId,
  isOwner,
  onChange,
}: {
  groupId: string;
  expenses: ExpenseResponse[] | undefined;
  members: GroupMember[];
  loading: boolean;
  currency: string;
  currentUserId?: string;
  isOwner: boolean;
  onChange: () => void;
}) {
  if (loading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (!expenses || expenses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No expenses yet. Add your first one to get started.
      </div>
    );
  }
  const nameFor = (id: string) => members.find((m) => m.userId === id)?.fullName ?? "Unknown";
  return (
    <TooltipProvider delayDuration={200}>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {expenses.map((e) => {
          const canModify =
            !!currentUserId && (e.createdBy === currentUserId || isOwner);
          return (
            <div key={e.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-card-foreground">
                  {e.description}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {nameFor(e.payerId)} paid · {new Date(e.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <p className="text-base font-semibold tabular-nums">
                  {formatCurrency(Number(e.amount), currency)}
                </p>
                {canModify && (
                  <ExpenseRowActions
                    groupId={groupId}
                    expense={e}
                    members={members}
                    currency={currency}
                    editable={e.editable}
                    onChange={onChange}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

function ExpenseRowActions({
  groupId,
  expense,
  members,
  currency,
  editable,
  onChange,
}: {
  groupId: string;
  expense: ExpenseResponse;
  members: GroupMember[];
  currency: string;
  editable: boolean;
  onChange: () => void;
}) {
  if (!editable) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground">
            <Lock className="h-4 w-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="left">
          Locked — a settlement has been confirmed since this expense was created.
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <ExpenseFormDialog
        mode="edit"
        groupId={groupId}
        members={members}
        currency={currency}
        existing={expense}
        onDone={onChange}
      />
      <DeleteExpenseDialog expenseId={expense.id} description={expense.description} onDone={onChange} />
    </div>
  );
}

/* --------------- Balances --------------- */

function BalancesList({
  balances,
  loading,
  currentUserId,
  currency,
}: {
  balances: Balance[] | undefined;
  loading: boolean;
  currentUserId?: string;
  currency: string;
}) {
  if (loading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (!balances || balances.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No balances to show yet.
      </div>
    );
  }
  const allSettled = balances.every((b) => Math.abs(Number(b.netBalance)) < 0.005);
  return (
    <>
      {allSettled && (
        <div className="mb-4 rounded-xl border border-credit/30 bg-credit/5 p-4 text-sm text-credit-foreground">
          <span className="font-medium text-credit">🎉 All settled up!</span> Nobody owes
          anything in this group.
        </div>
      )}
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {balances.map((b) => {
          const net = Number(b.netBalance);
          const isPositive = net > 0.005;
          const isNegative = net < -0.005;
          const color = isPositive ? "text-credit" : isNegative ? "text-debit" : "text-muted-foreground";
          const label = isPositive ? "is owed" : isNegative ? "owes" : "is settled";
          return (
            <div key={b.userId} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {b.fullName} {b.userId === currentUserId && <span className="text-xs text-muted-foreground">(you)</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  Paid {formatCurrency(Number(b.totalPaid), currency)} · Share {formatCurrency(Number(b.totalOwed), currency)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-lg font-semibold tabular-nums ${color}`}>
                  {formatCurrency(Math.abs(net), currency)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* --------------- Members --------------- */

function MembersList({
  groupId,
  members,
  loading,
  isOwner,
}: {
  groupId: string;
  members: GroupMember[] | undefined;
  loading: boolean;
  isOwner: boolean;
}) {
  const invitesQuery = useQuery({
    queryKey: ["group-pending-invites", groupId],
    enabled: isOwner,
    queryFn: () => groupPendingInvites(groupId),
  });

  if (loading) return <Skeleton className="h-32 w-full rounded-xl" />;
  if (!members || members.length === 0) return null;
  return (
    <div className="space-y-4">
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {members.map((m) => (
          <div key={m.userId} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{m.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{m.email}</p>
            </div>
            {m.role === "OWNER" && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Owner
              </span>
            )}
          </div>
        ))}
      </div>
      {isOwner && invitesQuery.data && invitesQuery.data.length > 0 && (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-dashed border-border bg-card">
          <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pending invites
          </div>
          {invitesQuery.data.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{inv.invitedEmail}</p>
                <p className="text-xs text-muted-foreground">
                  Sent {new Date(inv.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                PENDING
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* --------------- Expense form (create + edit) --------------- */

const expenseFormSchema = z.object({
  amount: z.number().positive("Amount must be > 0").max(1000000),
  description: z.string().trim().min(1, "Description required").max(255),
  payerId: z.string().uuid("Select a payer"),
  strategy: z.enum(["EQUAL", "CUSTOM_PERCENTAGE"]),
});

function ExpenseFormDialog({
  mode,
  groupId,
  members,
  currentUserId,
  currency,
  existing,
  onDone,
}: {
  mode: "create" | "edit";
  groupId: string;
  members: GroupMember[];
  currentUserId?: string;
  currency: string;
  existing?: ExpenseResponse;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [payerId, setPayerId] = useState<string>("");
  const [strategy, setStrategy] = useState<SplitStrategy>("EQUAL");
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const sortedMembers = [...members].sort((a, b) => a.fullName.localeCompare(b.fullName));

  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      setAmount("");
      setDescription("");
      setPayerId(currentUserId ?? sortedMembers[0]?.userId ?? "");
      setStrategy("EQUAL");
      setPercentages({});
      return;
    }
    if (!existing) return;
    setAmount(String(existing.amount));
    setDescription(existing.description);
    setPayerId(existing.payerId);
    setStrategy(existing.splitStrategy);
    if (existing.splitStrategy === "CUSTOM_PERCENTAGE") {
      const totalCents = Math.round(Number(existing.amount) * 100);
      const pct: Record<string, string> = {};
      for (const r of existing.splits) {
        const cents = Math.round(Number(r.amountOwed) * 100);
        pct[r.userId] = totalCents > 0 ? ((cents / totalCents) * 100).toFixed(2) : "0";
      }
      setPercentages(pct);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, existing?.id]);

  function computeEqualSplit(total: number): { userId: string; amountOwed: number }[] {
    const n = sortedMembers.length;
    if (n === 0) return [];
    const totalCents = Math.round(total * 100);
    const baseCents = Math.floor(totalCents / n);
    const remainder = totalCents - baseCents * n;
    return sortedMembers.map((m, i) => ({
      userId: m.userId,
      amountOwed: (baseCents + (i < remainder ? 1 : 0)) / 100,
    }));
  }

  function computePercentageSplit(total: number): { userId: string; amountOwed: number }[] {
    const totalCents = Math.round(total * 100);
    const raw = sortedMembers.map((m) => {
      const pct = Number(percentages[m.userId] ?? 0);
      return { userId: m.userId, cents: Math.round((totalCents * pct) / 100) };
    });
    const sum = raw.reduce((s, r) => s + r.cents, 0);
    const drift = totalCents - sum;
    if (drift !== 0 && raw.length > 0) {
      let idx = 0;
      for (let i = 1; i < raw.length; i++) if (raw[i].cents > raw[idx].cents) idx = i;
      raw[idx].cents += drift;
    }
    return raw.map((r) => ({ userId: r.userId, amountOwed: r.cents / 100 }));
  }

  const percentTotal = Object.values(percentages).reduce((s, v) => s + (Number(v) || 0), 0);
  const percentValid = Math.abs(percentTotal - 100) < 0.01;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numAmount = round2(Number(amount));
    const parsed = expenseFormSchema.safeParse({
      amount: numAmount,
      description,
      payerId,
      strategy,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (strategy === "CUSTOM_PERCENTAGE" && !percentValid) {
      toast.error("Percentages must sum to exactly 100");
      return;
    }
    const splits =
      strategy === "EQUAL" ? computeEqualSplit(numAmount) : computePercentageSplit(numAmount);

    setSubmitting(true);
    try {
      const body = {
        payerId: parsed.data.payerId,
        amount: numAmount,
        description: parsed.data.description,
        strategy: parsed.data.strategy,
        splits,
      };
      if (mode === "create") {
        await createExpense(groupId, body);
        toast.success("Expense added");
      } else if (existing) {
        await updateExpense(existing.id, body);
        toast.success("Expense updated");
      }
      setOpen(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save expense");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button disabled={members.length === 0}>
            <Plus className="mr-1 h-4 w-4" /> Add expense
          </Button>
        ) : (
          <Button variant="ghost" size="icon" title="Edit expense" aria-label="Edit expense">
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add expense" : "Edit expense"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount ({currency})</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Paid by</Label>
              <Select value={payerId} onValueChange={setPayerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payer" />
                </SelectTrigger>
                <SelectContent>
                  {sortedMembers.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Dinner at Ramen Yato"
              maxLength={255}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Split strategy</Label>
            <RadioGroup
              value={strategy}
              onValueChange={(v) => setStrategy(v as SplitStrategy)}
              className="grid grid-cols-2 gap-2"
            >
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <RadioGroupItem value="EQUAL" /> Equal
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <RadioGroupItem value="CUSTOM_PERCENTAGE" /> Percentages
              </label>
            </RadioGroup>
          </div>

          {strategy === "CUSTOM_PERCENTAGE" && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              {sortedMembers.map((m) => (
                <div key={m.userId} className="flex items-center justify-between gap-3">
                  <span className="text-sm">{m.fullName}</span>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      className="w-24"
                      value={percentages[m.userId] ?? ""}
                      onChange={(e) =>
                        setPercentages((prev) => ({ ...prev, [m.userId]: e.target.value }))
                      }
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              ))}
              <div
                className={`flex items-center justify-between border-t border-border pt-2 text-sm font-medium ${
                  percentValid ? "text-credit" : "text-debit"
                }`}
              >
                <span>Total</span>
                <span>{percentTotal.toFixed(2)}%</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={
                submitting ||
                !amount ||
                !description ||
                !payerId ||
                (strategy === "CUSTOM_PERCENTAGE" && !percentValid)
              }
            >
              {submitting
                ? mode === "create" ? "Saving…" : "Updating…"
                : mode === "create" ? "Add expense" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* --------------- Delete expense --------------- */

function DeleteExpenseDialog({
  expenseId,
  description,
  onDone,
}: {
  expenseId: string;
  description: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await apiDeleteExpense(expenseId);
      toast.success("Expense deleted");
      setOpen(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete expense");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Delete expense" aria-label="Delete expense">
          <Trash2 className="h-4 w-4 text-debit" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this expense?</DialogTitle>
          <DialogDescription>
            "{description}" and its splits will be permanently removed. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={submitting}>
            {submitting ? "Deleting…" : "Delete expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------- Group settings menu --------------- */

function GroupSettingsMenu({
  groupId,
  groupName,
  onRenamed,
}: {
  groupId: string;
  groupName: string;
  onRenamed: () => void;
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Group settings">
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Rename group
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-debit focus:text-debit"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Delete group…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameGroupDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        groupId={groupId}
        currentName={groupName}
        onDone={onRenamed}
      />
      <DeleteGroupDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        groupId={groupId}
        groupName={groupName}
      />
    </>
  );
}

function RenameGroupDialog({
  open,
  onOpenChange,
  groupId,
  currentName,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string;
  currentName: string;
  onDone: () => void;
}) {
  const [name, setName] = useState(currentName);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setName(currentName);
  }, [open, currentName]);

  const schema = z.string().trim().min(1, "Name is required").max(100);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(name);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      await renameGroup(groupId, parsed.data);
      toast.success("Group renamed");
      onOpenChange(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename group");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename group</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rename-group">Group name</Label>
            <Input
              id="rename-group"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteGroupDialog({
  open,
  onOpenChange,
  groupId,
  groupName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groupId: string;
  groupName: string;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (open) setConfirmText("");
  }, [open]);

  const matches = confirmText.trim() === groupName.trim();

  async function handleConfirm() {
    if (!matches) return;
    setSubmitting(true);
    try {
      await apiDeleteGroup(groupId);
      toast.success("Group deleted");
      onOpenChange(false);
      await qc.invalidateQueries({ queryKey: ["my-groups"] });
      void navigate({ to: "/groups" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete group");
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-debit">Delete group</DialogTitle>
          <DialogDescription>
            This will permanently delete all expenses, splits, and settlement history for
            this group. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="delete-confirm">
            Type <span className="font-mono font-semibold">{groupName}</span> to confirm
          </Label>
          <Input
            id="delete-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!matches || submitting} onClick={handleConfirm}>
            {submitting ? "Deleting…" : "Delete group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------- Add member --------------- */

function AddMemberDialog({
  groupId,
  onDone,
}: {
  groupId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const parsed = z.string().trim().email("Enter a valid email").safeParse(email);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const normalized = parsed.data.toLowerCase();
    setSubmitting(true);
    try {
      try {
        await addExistingMember(groupId, normalized);
        toast.success("Member added");
      } catch (err) {
        // Fall back to invite flow if the user isn't registered yet.
        if (err instanceof ApiError && err.status === 404) {
          await createInvite(groupId, normalized);
          toast.success("Invite sent — they'll see it when they sign in");
        } else {
          throw err;
        }
      }
      setOpen(false);
      setEmail("");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="mr-1 h-4 w-4" /> Add member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="member-email">Email</Label>
            <Input
              id="member-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@example.com"
              required
            />
            <p className="text-xs text-muted-foreground">
              If they don't have a FinGuard account yet, we'll send them an invite.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* --------------- Settle Up --------------- */

function SettleUpPanel({
  groupId,
  members,
  currency,
  currentUserId,
}: {
  groupId: string;
  members: GroupMember[];
  currency: string;
  currentUserId?: string;
}) {
  const qc = useQueryClient();
  const nameFor = (id: string) => members.find((m) => m.userId === id)?.fullName ?? "Unknown";

  const historyQuery = useQuery({
    queryKey: ["settlements", groupId],
    queryFn: () => settlementHistory(groupId),
  });

  const settleMut = useMutation({
    mutationFn: () => settleGroup(groupId),
    onSuccess: (result: Settlement[]) => {
      if (result.length === 0) {
        toast.success("All settled up — no transactions needed");
      } else {
        toast.success(`Plan generated: ${result.length} transaction(s)`);
      }
      void qc.invalidateQueries({ queryKey: ["settlements", groupId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmMut = useMutation({
    mutationFn: (settlementId: string) => confirmSettlement(settlementId),
    onSuccess: () => {
      toast.success("Settlement confirmed");
      void qc.invalidateQueries({ queryKey: ["settlements", groupId] });
      void qc.invalidateQueries({ queryKey: ["group-balances", groupId] });
      void qc.invalidateQueries({ queryKey: ["group-expenses", groupId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = (historyQuery.data ?? []).filter((s) => s.status === "PENDING");
  const confirmed = (historyQuery.data ?? []).filter((s) => s.status === "CONFIRMED");

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Debt minimization</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Collapse everyone's balances into the fewest possible payments.
            </p>
          </div>
          <Button
            onClick={() => settleMut.mutate()}
            disabled={settleMut.isPending || pending.length > 0}
          >
            {settleMut.isPending ? "Calculating…" : "Calculate settlement"}
          </Button>
        </div>
        {pending.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            You already have a pending settlement plan below — confirm or clear it before
            recalculating.
          </p>
        )}
      </div>

      {settleMut.isPending && <Skeleton className="h-40 w-full rounded-2xl" />}

      {!settleMut.isPending && historyQuery.isLoading && (
        <Skeleton className="h-40 w-full rounded-2xl" />
      )}

      {!historyQuery.isLoading && pending.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          <p className="text-lg">🎉 All settled up!</p>
          <p className="mt-1">
            Nobody owes anything, or your last plan has been fully confirmed.
          </p>
        </div>
      )}

      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Pending
          </h3>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {pending.map((s) => {
              const canConfirm =
                currentUserId === s.fromUserId || currentUserId === s.toUserId;
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-medium">{nameFor(s.fromUserId)}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{nameFor(s.toUserId)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold tabular-nums text-debit">
                      {formatCurrency(Number(s.amount), currency)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canConfirm || confirmMut.isPending}
                      onClick={() => confirmMut.mutate(s.id)}
                      title={
                        canConfirm
                          ? "Mark this payment as done"
                          : "Only the payer or receiver can confirm"
                      }
                    >
                      <Check className="mr-1 h-3.5 w-3.5" />
                      Mark as confirmed
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {confirmed.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Settlement history
          </h3>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-muted/40">
            {confirmed.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"
              >
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {nameFor(s.fromUserId)}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                  <span className="font-medium text-foreground">
                    {nameFor(s.toUserId)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span className="tabular-nums">
                    {formatCurrency(Number(s.amount), currency)}
                  </span>
                  <span className="text-xs">
                    {s.confirmedAt ? new Date(s.confirmedAt).toLocaleDateString() : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
