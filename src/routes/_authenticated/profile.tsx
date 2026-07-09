import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getProfile, updateProfile } from "@/lib/api/profile";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — FinGuard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getProfile(),
  });

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [errors, setErrors] = useState<{ fullName?: string; avatarUrl?: string }>({});

  useEffect(() => {
    if (profileQuery.data) {
      setFullName(profileQuery.data.fullName ?? "");
      setAvatarUrl(profileQuery.data.avatarUrl ?? "");
    }
  }, [profileQuery.data]);

  const mutation = useMutation({
    mutationFn: () =>
      updateProfile({
        fullName,
        avatarUrl: avatarUrl.trim() === "" ? null : avatarUrl.trim(),
      }),
    onSuccess: () => {
      toast.success("Profile updated");
      void qc.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    const trimmed = fullName.trim();
    if (trimmed.length < 1 || trimmed.length > 100) {
      nextErrors.fullName = "Name must be 1–100 characters";
    }
    if (avatarUrl.trim() !== "") {
      try {
        new URL(avatarUrl.trim());
      } catch {
        nextErrors.avatarUrl = "Enter a valid URL";
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    mutation.mutate();
  }

  if (profileQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-6 h-64 w-full rounded-2xl" />
      </div>
    );
  }
  if (profileQuery.error || !profileQuery.data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          Failed to load profile.
        </div>
      </div>
    );
  }

  const initial = (fullName || profileQuery.data.email).charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Update how you appear across FinGuard.
      </p>

      <form
        onSubmit={submit}
        className="mt-6 space-y-5 rounded-3xl border border-border bg-card p-6 shadow-card"
      >
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={avatarUrl.trim() || undefined} alt={fullName} />
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <div className="text-sm">
            <p className="font-medium">{profileQuery.data.email}</p>
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={100}
            required
          />
          {errors.fullName && (
            <p className="text-xs text-destructive">{errors.fullName}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="avatarUrl">Avatar URL</Label>
          <Input
            id="avatarUrl"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…"
          />
          {errors.avatarUrl && (
            <p className="text-xs text-destructive">{errors.avatarUrl}</p>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
