import { autocomplete } from "@/lib/google";
import { DEMO_PLACES, DEMO_VENUES } from "@/lib/demo";
import { errorResponse, HttpError } from "@/lib/errors";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    rateLimit(`autocomplete:${clientKey(request)}`, 60);
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim();
    if (query.length < 2) return Response.json({ suggestions: [] });
    if (query.length > 150) throw new HttpError(400, "Search text is too long.");
    const mode = url.searchParams.get("mode") ?? "live";
    if (mode !== "live" && mode !== "demo") throw new HttpError(400, "Unknown search mode.");
    if (mode === "demo") {
      const suggestions = [...DEMO_PLACES, ...DEMO_VENUES].filter((place) => `${place.name} ${place.address}`.toLowerCase().includes(query.toLowerCase())).slice(0, 5).map(({ id, name, address }) => ({ id, name, address }));
      return Response.json({ suggestions }, { headers: { "Cache-Control": "no-store" } });
    }
    const sessionToken = url.searchParams.get("sessionToken") ?? "";
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(sessionToken)) throw new HttpError(400, "A valid autocomplete session token is required.");
    return Response.json({ suggestions: await autocomplete(query, sessionToken) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
