import { demoSession } from "@/lib/demo";
import { getStoredSession } from "@/lib/store";
import { errorResponse } from "@/lib/errors";
import { configuration, hydrateSession } from "@/lib/meetings";
import { rateLimit } from "@/lib/rate-limit";
import { sessionRevision } from "@/lib/session-revision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (id === "demo") return Response.json({ session: demoSession(), configuration: configuration() }, { headers: { "Cache-Control": "no-store" } });
    const stored = await getStoredSession(id);
    // The unguessable meetup link is the group's shared access capability.
    rateLimit(`read:${id}`, 120);
    return Response.json({ session: await hydrateSession(stored), configuration: configuration(), revision: sessionRevision(stored) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
