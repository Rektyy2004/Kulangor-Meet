import { getStoredSession } from "@/lib/store";
import { sessionRevision } from "@/lib/session-revision";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: {params: Promise<{id:string}>}) {
  try {
    const {id} = await context.params;
    return Response.json({revision:sessionRevision(await getStoredSession(id))}, {headers:{"Cache-Control":"no-store"}});
  } catch(error) { return errorResponse(error); }
}
