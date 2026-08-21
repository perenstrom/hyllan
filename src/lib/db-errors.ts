// Shared by pantry-items.ts and locations.ts — each catches a
// unique-constraint violation from its own insert/update to report a
// friendly "name already taken" error instead of a raw DB exception.
const UNIQUE_VIOLATION_CODE = "23505";

function hasCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

// Drizzle wraps the driver's error (which carries Postgres's error code) in
// a DrizzleQueryError, exposing the original as `.cause` — check both so
// this works whether the caller passed the wrapper or the raw error.
export function isUniqueViolation(error: unknown): boolean {
  return (
    hasCode(error, UNIQUE_VIOLATION_CODE) ||
    (typeof error === "object" &&
      error !== null &&
      "cause" in error &&
      hasCode(error.cause, UNIQUE_VIOLATION_CODE))
  );
}
