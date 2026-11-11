import { createStoredSession, persistentStorage } from "@/lib/store";
import { errorResponse, HttpError, requestBody, textField } from "@/lib/errors";
import { configuration } from "@/lib/meetings";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    rateLimit(`create:${clientKey(request)}`, 10);
    const body = await requestBody(request);
    const name = textField(body.name, "Group name", 2, 80);
    const capacity = body.capacity ?? 20;
    if (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity < 1 || capacity > 20) throw new HttpError(400, "Choose a group size between 1 and 20.");
    if (process.env.VERCEL === "1" && !persistentStorage()) {
      throw new HttpError(503, "The shared meetup database isn’t connected yet. Ask the organizer to finish setup.");
    }
    const { stored, organizerToken } = await createStoredSession(name, capacity);
    const { organizerTokenHash: _, ...session } = stored;
    return Response.json({ session, organizerToken, configuration: configuration() }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
