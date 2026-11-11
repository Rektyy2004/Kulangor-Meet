import { demoSession } from "@/lib/demo";
import { addStoredParticipant, getStoredSession } from "@/lib/store";
import { errorResponse, HttpError, requestBody, textField } from "@/lib/errors";
import { configuration } from "@/lib/meetings";
import { placeDetails } from "@/lib/google";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import {randomBytes,randomUUID} from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const session = id === "demo" ? demoSession() : await getStoredSession(id);
    return Response.json({ id: session.id, name: session.name, capacity: session.capacity, participantCount: session.participants.length, mode: session.mode, configuration: configuration() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    rateLimit(`join:${clientKey(request)}`, 20);
    const { id } = await context.params;
    if (id === "demo") throw new HttpError(409, "The demonstration group is full. Create a new session to invite your friends.");
    const body = await requestBody(request);
    const name = textField(body.name, "Your name", 2, 50);
    const placeId = textField(body.placeId, "Selected location", 1, 255);
    if (placeId.startsWith("demo-")) throw new HttpError(400, "Choose a verified Google Maps location for this live session.");
    const sessionToken = body.sessionToken === undefined ? undefined : textField(body.sessionToken, "Search session", 1, 64);
    if (sessionToken && !/^[a-zA-Z0-9_-]+$/.test(sessionToken)) throw new HttpError(400, "Invalid search session token.");
    const stored = await getStoredSession(id);
    if (stored.participants.length >= stored.capacity) throw new HttpError(409, "This group is full.");
    await placeDetails(placeId, sessionToken);
    const participantId=randomUUID(),editToken=randomBytes(32).toString("base64url");
    await addStoredParticipant(id, { name, placeId, id:participantId, editToken });
    return Response.json({ success: true, participantId, editToken }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
