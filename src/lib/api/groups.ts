import { apiFetch } from "./client";

export interface GroupSummary {
  id: string;
  name: string;
  currency: string;
  createdBy: string;
  createdAt: string;
  memberCount: number;
  netBalance: number;
}

export interface GroupResponse {
  id: string;
  name: string;
  currency: string;
  createdBy: string;
  createdAt: string;
}

export interface GroupMember {
  userId: string;
  role: "OWNER" | "MEMBER";
  fullName: string;
  email: string;
}

export interface Balance {
  userId: string;
  fullName: string;
  email: string;
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
}

export function listMyGroups() {
  return apiFetch<GroupSummary[]>("/groups");
}

export function getGroup(groupId: string) {
  return apiFetch<GroupResponse>(`/groups/${groupId}`);
}

export function createGroup(input: { name: string; currency?: string }) {
  return apiFetch<GroupResponse>("/groups", { method: "POST", body: input });
}

export function renameGroup(groupId: string, name: string) {
  return apiFetch<GroupResponse>(`/groups/${groupId}`, { method: "PATCH", body: { name } });
}

export function deleteGroup(groupId: string) {
  return apiFetch<void>(`/groups/${groupId}`, { method: "DELETE" });
}

export function listGroupMembers(groupId: string) {
  return apiFetch<GroupMember[]>(`/groups/${groupId}/members`);
}

export function getGroupBalances(groupId: string) {
  return apiFetch<Balance[]>(`/groups/${groupId}/balances`);
}

export function addExistingMember(groupId: string, email: string) {
  return apiFetch<void>(`/groups/${groupId}/members`, { method: "POST", body: { email } });
}
