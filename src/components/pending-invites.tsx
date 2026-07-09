import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptInvite, declineInvite, myPendingInvites } from "@/lib/api/invites";

export function PendingInvites() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["my-pending-invites"],
    queryFn: () => myPendingInvites(),
  });

  const acceptMut = useMutation({
    mutationFn: (inviteId: string) => acceptInvite(inviteId),
    onSuccess: () => {
      toast.success("Invite accepted — you're in!");
      void qc.invalidateQueries({ queryKey: ["my-pending-invites"] });
      void qc.invalidateQueries({ queryKey: ["my-groups"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const declineMut = useMutation({
    mutationFn: (inviteId: string) => declineInvite(inviteId),
    onSuccess: () => {
      toast.success("Invite declined");
      void qc.invalidateQueries({ queryKey: ["my-pending-invites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading || !query.data || query.data.length === 0) return null;

  return (
    <div className="mb-6 rounded-3xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold tracking-tight">
          Pending invites ({query.data.length})
        </h2>
      </div>
      <ul className="mt-3 divide-y divide-border">
        {query.data.map((inv) => (
          <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {inv.groupName ?? "A group"}
              </p>
              <p className="text-xs text-muted-foreground">
                Invited {new Date(inv.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={declineMut.isPending}
                onClick={() => declineMut.mutate(inv.id)}
              >
                <X className="mr-1 h-3.5 w-3.5" /> Decline
              </Button>
              <Button
                size="sm"
                disabled={acceptMut.isPending}
                onClick={() => acceptMut.mutate(inv.id)}
              >
                <Check className="mr-1 h-3.5 w-3.5" /> Accept
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
