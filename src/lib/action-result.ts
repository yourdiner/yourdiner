import { getErrorMessage } from "@/lib/errors";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function actionOk<T = void>(data?: T): ActionResult<T> {
  return { ok: true, data: data as T };
}

export function actionFail(error: unknown): ActionResult<never> {
  return { ok: false, error: getErrorMessage(error) };
}
