export type ApiErrorKind =
  | "unauthorized"
  | "forbidden"
  | "notFound"
  | "validation"
  | "server"
  | "network";

export class ClientApiError extends Error {
  constructor(
    message: string,
    public readonly kind: ApiErrorKind,
    public readonly status?: number
  ) {
    super(message);
    this.name = "ClientApiError";
  }
}

function messageFor(kind: ApiErrorKind, fallback: string): string {
  switch (kind) {
    case "unauthorized":
      return "Your session has expired. Please sign in again.";
    case "forbidden":
      return "You do not have permission to perform this action.";
    case "notFound":
      return "The requested resource could not be found.";
    case "network":
      return "We could not reach the server. Check your connection and try again.";
    case "server":
      return "Something went wrong on the server. Please try again.";
    case "validation":
      return fallback;
  }
}

export async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(input, init);
  } catch {
    throw new ClientApiError(messageFor("network", ""), "network");
  }

  if (!response.ok) {
    const kind: ApiErrorKind =
      response.status === 401
        ? "unauthorized"
        : response.status === 403
          ? "forbidden"
          : response.status === 404
            ? "notFound"
            : response.status >= 400 && response.status < 500
              ? "validation"
              : "server";
    let fallback = "Request failed.";
    try {
      const payload = (await response.json()) as { error?: unknown };
      if (typeof payload.error === "string") fallback = payload.error;
    } catch {
      // Use the safe status-based message when the response is not JSON.
    }
    throw new ClientApiError(messageFor(kind, fallback), kind, response.status);
  }

  return (await response.json()) as T;
}