import { apiFetch } from "./client";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  roles: string[];
}

export interface AuthResponse {
  token: string;
  expiresInSeconds: number;
  user: AuthUser;
}

export function signUp(input: { fullName: string; email: string; password: string }) {
  return apiFetch<AuthResponse>("/auth/signup", { method: "POST", body: input });
}

export function signIn(input: { email: string; password: string }) {
  return apiFetch<AuthResponse>("/auth/signin", { method: "POST", body: input });
}

export function fetchMe() {
  return apiFetch<AuthUser>("/auth/me");
}
