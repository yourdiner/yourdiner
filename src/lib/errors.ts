export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

type ZodLikeError = {
  issues: Array<{ message: string; path?: Array<string | number> }>;
};

type PrismaLikeError = {
  name: string;
  code?: string;
  message: string;
  meta?: { target?: unknown; field_name?: unknown; cause?: unknown };
};

function isZodLike(error: unknown): error is ZodLikeError {
  return (
    !!error &&
    typeof error === "object" &&
    "issues" in error &&
    Array.isArray((error as ZodLikeError).issues)
  );
}

function isPrismaLike(error: unknown): error is PrismaLikeError {
  return (
    !!error &&
    typeof error === "object" &&
    "name" in error &&
    typeof (error as PrismaLikeError).name === "string" &&
    (error as PrismaLikeError).name.startsWith("Prisma")
  );
}

function fieldFromTarget(target: unknown): string | null {
  if (Array.isArray(target)) return target.join(", ");
  if (typeof target === "string") return target;
  return null;
}

function messageFromZod(error: ZodLikeError): string {
  const parts = error.issues
    .slice(0, 3)
    .map((issue) => {
      const field = issue.path?.filter((p) => p !== "").join(".");
      return field ? `${field}: ${issue.message}` : issue.message;
    })
    .filter(Boolean);
  return parts.join("; ") || "Validation failed";
}

function messageFromPrisma(error: PrismaLikeError): string {
  switch (error.code) {
    case "P2002": {
      const field = fieldFromTarget(error.meta?.target);
      return field
        ? `A record with this ${field} already exists`
        : "A record with these details already exists";
    }
    case "P2025":
      return "The requested record was not found";
    case "P2003":
      return "This action references a related record that does not exist";
    case "P2011":
      return "A required field is missing";
    case "P2000":
      return "A provided value is too long for its field";
    case "P2014":
      return "This change would violate a required relation between records";
    case "P2034":
      return "The operation conflicted with another change. Please retry.";
    default:
      break;
  }

  if (error.name === "PrismaClientValidationError") {
    return "Invalid data was sent to the database. Please check the fields and try again.";
  }
  if (error.name === "PrismaClientInitializationError") {
    return "Could not connect to the database. Please try again shortly.";
  }

  if (process.env.NODE_ENV === "production") {
    return "A database error occurred";
  }

  const firstLine = error.message?.split("\n").map((l) => l.trim()).filter(Boolean).pop();
  return firstLine || "A database error occurred";
}

const GENERIC_CLIENT_ERROR =
  "An unexpected error occurred. Please try again.";

export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;

  if (isZodLike(error)) return messageFromZod(error);

  if (isPrismaLike(error)) return messageFromPrisma(error);

  if (process.env.NODE_ENV === "production") {
    if (error instanceof Error && error.message?.trim()) {
      console.error("[error]", error.name, error.message);
    } else {
      console.error("[error]", error);
    }
    return GENERIC_CLIENT_ERROR;
  }

  if (error instanceof Error) {
    const message = error.message?.trim();
    if (message) return message;
    return error.name || GENERIC_CLIENT_ERROR;
  }

  if (typeof error === "string" && error.trim()) return error.trim();

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string" &&
    (error as { message: string }).message.trim()
  ) {
    return (error as { message: string }).message.trim();
  }

  return GENERIC_CLIENT_ERROR;
}
