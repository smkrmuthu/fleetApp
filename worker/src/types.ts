export interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
  JWT_SECRET: string;
}

export type Role = 'driver' | 'office' | 'manager';

// What every authenticated request carries, set once by the auth middleware
// from the verified JWT and never trusted from the request body.
export interface AuthContext {
  orgId: string;
  userId: string;
  role: Role;
  driverId: string | null;
}

export type Vars = {
  auth: AuthContext;
};
