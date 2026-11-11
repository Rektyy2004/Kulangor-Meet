import { calculateDemo } from "@/lib/demo";
import { getStoredSession } from "@/lib/store";
import { errorResponse, futureDeparture, requestBody, textField, HttpError } from "@/lib/errors";
import { calculateLive, hydrateSession } from "@/lib/meetings";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await requestBody(request);
    const departureTime = futureDeparture(body.departureTime);
    const choices = body.selectedPlaces ?? [];
    if (!Array.isArray(choices) || choices.length > 5) throw new HttpError(400, "Choose up to 5 restaurants to compare.");
    const selected = choices.map(choice => {
      if (!choice || typeof choice !== "object") throw new HttpError(400, "Choose a mapped restaurant.");
      const placeId = textField(choice.placeId, "Selected place", 1, 255);
      if (placeId.startsWith("demo-")) throw new HttpError(400, "Choose a real restaurant for this meetup.");
      return { placeId, ...(choice.sessionToken ? {sessionToken:textField(choice.sessionToken,"Search session",1,64)} : {}) };
    });
    if (id === "demo") {
      rateLimit(`demo-calculate:${clientKey(request)}`, 30);
      return Response.json(calculateDemo(departureTime), { headers: { "Cache-Control": "no-store" } });
    }
    const stored = await getStoredSession(id);
    rateLimit(`calculate:${id}`, 3);
    const session = await hydrateSession(stored);
    return Response.json(await calculateLive(session, departureTime, selected), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
