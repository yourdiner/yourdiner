import { hashPassword } from "better-auth/crypto";
import { DEFAULT_STAFF_PASSWORD } from "@/lib/staff-auth-constants";

export { DEFAULT_STAFF_PASSWORD };

export async function hashStaffPassword(password: string) {
  return hashPassword(password);
}

/** @deprecated Prefer hashStaffPassword */
export async function hashStaffPin(pin: string) {
  return hashStaffPassword(pin);
}

export async function hashDefaultStaffPassword() {
  return hashStaffPassword(DEFAULT_STAFF_PASSWORD);
}
