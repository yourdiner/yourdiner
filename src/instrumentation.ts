import { assertProductionEnvSafe } from "@/lib/production-env";

export async function register() {
  assertProductionEnvSafe();
}
