import api from "./client";

export type AdminUser = {
  id: number;
  username: string;
  is_admin: boolean;
  created_at: string | null;
};

export const adminApi = {
  listUsers: () => api.get<AdminUser[]>("/admin/users").then((r) => r.data),
  createUser: (username: string, password: string) =>
    api.post<AdminUser>("/admin/users", { username, password }).then((r) => r.data),
  resetPassword: (userId: number, newPassword: string) =>
    api.post(`/admin/users/${userId}/reset-password`, { new_password: newPassword }).then((r) => r.data),
  deleteUser: (userId: number) => api.delete(`/admin/users/${userId}`).then((r) => r.data),
  impersonate: (userId: number) =>
    api.post<{ access_token: string }>(`/admin/impersonate/${userId}`).then((r) => r.data),
  stopImpersonating: () =>
    api.post<{ access_token: string }>(`/admin/stop-impersonating`).then((r) => r.data),
};
