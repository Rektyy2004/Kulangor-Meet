export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  console.error("Meeting request failed", error instanceof Error ? error.message : "Unknown error");
  return Response.json({ error: "This request could not be completed. Please try again." }, { status: 500 });
}

export async function requestBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new HttpError(415, "Use application/json for this request.");
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 16_384) throw new HttpError(413, "Request is too large.");
  let body: unknown;
  const content = await request.text();
  if (content.length > 16_384) throw new HttpError(413, "Request is too large.");
  try { body = JSON.parse(content); } catch { throw new HttpError(400, "A valid JSON body is required."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "A JSON object is required.");
  return body as Record<string, unknown>;
}

export function textField(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw new HttpError(400, `${label} must be ${min}–${max} characters.`);
  return value.trim();
}

export function futureDeparture(value: unknown, now = Date.now()): string {
  const departure = typeof value === "string" ? Date.parse(value) : NaN;
  if (!Number.isFinite(departure) || departure < now + 5 * 60_000) throw new HttpError(400, "Choose a departure time at least 5 minutes in the future.");
  if (departure > now + 365 * 24 * 60 * 60_000) throw new HttpError(400, "Choose a departure within the next year.");
  return new Date(departure).toISOString();
}
