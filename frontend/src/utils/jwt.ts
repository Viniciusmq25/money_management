export type TokenPayload = {
  sub: string;
  is_admin: boolean;
  impersonating_id?: number;
  exp: number;
};

export function decodeToken(token: string | null): TokenPayload | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as TokenPayload;
  } catch {
    return null;
  }
}

export function getTokenPayload(): TokenPayload | null {
  return decodeToken(localStorage.getItem("token"));
}

export function isAdmin(): boolean {
  return getTokenPayload()?.is_admin === true;
}

export function isImpersonating(): boolean {
  return typeof getTokenPayload()?.impersonating_id === "number";
}
