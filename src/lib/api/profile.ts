import { apiFetch } from "./client";
import type { AuthUser } from "./auth";

export function getProfile() {
  return apiFetch<AuthUser>("/profile");
}

export function updateProfile(input: { fullName: string; avatarUrl: string | null }) {
  return apiFetch<AuthUser>("/profile", { method: "PATCH", body: input });
}
