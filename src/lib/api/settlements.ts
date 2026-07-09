import { apiFetch } from "./client";

export interface Settlement {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  status: "PENDING" | "CONFIRMED";
  generatedAt: string;
  confirmedAt: string | null;
}

export function settleGroup(groupId: string) {
  return apiFetch<Settlement[]>(`/groups/${groupId}/settle`, { method: "POST" });
}

export function settlementHistory(groupId: string) {
  return apiFetch<Settlement[]>(`/groups/${groupId}/settlements`);
}

export function confirmSettlement(settlementId: string) {
  return apiFetch<Settlement>(`/settlements/${settlementId}/confirm`, { method: "POST" });
}
