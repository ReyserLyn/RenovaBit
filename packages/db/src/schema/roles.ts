import { z } from "zod";

export const ROLES = ["admin", "customer"] as const;

export const roleSchema = z.enum(ROLES);

export type Role = (typeof ROLES)[number];
