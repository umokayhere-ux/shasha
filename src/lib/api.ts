import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type output } from "zod";
import { AuthError } from "./auth";

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: string; details?: unknown };

export function ok<T>(data: T, status = 200) {
  return NextResponse.json<ApiOk<T>>({ ok: true, data }, { status });
}

export function fail(error: string, status = 400, details?: unknown) {
  return NextResponse.json<ApiErr>({ ok: false, error, details }, { status });
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/**
 * Wraps a route handler so internal failures never leak stack traces or
 * provider errors to the client, while still being logged server-side.
 */
export function handler<A extends unknown[]>(
  fn: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) return fail(err.message, err.status);
      if (err instanceof AuthError) {
        return fail(err.message, err.message === "Forbidden" ? 403 : 401);
      }
      if (err instanceof ZodError) {
        return fail("Validation failed", 422, err.flatten().fieldErrors);
      }
      console.error("[api] unhandled error", err);
      return fail("Something went wrong. Please try again.", 500);
    }
  };
}

/** Returns the schema's OUTPUT type, so zod defaults and transforms apply. */
export async function parseBody<S extends ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<output<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError("Request body must be valid JSON", 400);
  }
  return schema.parse(json);
}

export function parsePagination(url: URL) {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const rawSize = Number(url.searchParams.get("pageSize") ?? 25) || 25;
  const pageSize = Math.min(100, Math.max(1, rawSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
