import { getStoredSession } from "@/lib/store";
import { hydrateSession, loadRouteLines } from "@/lib/meetings";
import { placeDetails } from "@/lib/google";
import { errorResponse, requestBody, futureDeparture, textField } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request, context: {params:Promise<{id:string}>}) {
  try {
    const {id} = await context.params;
    const stored = await getStoredSession(id);
    rateLimit(`routes:${id}`, 5);
    const body = await requestBody(request);
    const departureTime = futureDeparture(body.departureTime);
    const destination = await placeDetails(textField(body.placeId,"Selected place",1,255));
    const session = await hydrateSession(stored);
    return Response.json({journeys:await loadRouteLines(session,destination,departureTime)}, {headers:{"Cache-Control":"no-store"}});
  } catch(error) { return errorResponse(error); }
}
