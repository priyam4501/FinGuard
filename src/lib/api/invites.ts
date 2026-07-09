import { apiFetch } from "./client";

export interface Invite {
  id: string;
  groupId: string;
  groupName: string | null;
  invitedEmail: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  createdAt: string;
}

export function myPendingInvites() {
  return apiFetch<Invite[]>("/invites");
}

export function groupPendingInvites(groupId: string) {
  return apiFetch<Invite[]>(`/groups/${groupId}/invites`);
}

export function createInvite(groupId: string, email: string) {
  return apiFetch<Invite>(`/groups/${groupId}/invites`, { method: "POST", body: { email } });
}

export function acceptInvite(inviteId: string) {
  return apiFetch<{ groupId: string }>(`/invites/${inviteId}/accept`, { method: "POST" });
}

export function declineInvite(inviteId: string) {
  return apiFetch<void>(`/invites/${inviteId}/decline`, { method: "POST" });
}
