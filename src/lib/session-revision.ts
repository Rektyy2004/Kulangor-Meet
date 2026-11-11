import { createHash } from "node:crypto";
import type { StoredSession } from "./store";

// Hash only public participant fields; do not include credentials in responses.
export function sessionRevision(session: StoredSession): string {
  return createHash("sha256").update(JSON.stringify(session.participants.map(p => [p.id,p.name,p.placeId,p.color]))).digest("hex");
}
