import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { HttpError } from "./errors";
import { COLORS } from "./demo";

export type StoredParticipant = { id: string; name: string; placeId: string; color: string; joinedAt: string; editTokenHash?:string };
export type StoredSession = { id: string; name: string; capacity: number; createdAt: string; mode: "live"; organizerTokenHash: string; participants: StoredParticipant[] };

export function persistentStorage(): boolean { return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY); }

function validateId(id: string): void {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new HttpError(400, "Invalid session ID.");
}
function filename(id: string): string { validateId(id); return path.join(process.env.KULANGOR_DATA_DIR || path.join(process.cwd(), ".data", "sessions"), `${id}.json`); }
function digest(token: string): string { return createHash("sha256").update(token).digest("hex"); }
export function authorizeParticipant(participant:StoredParticipant,token:string|null):void {
  if(!token || token.length>256 || !participant.editTokenHash) throw new HttpError(403,"Use the browser where you added this starting point, or ask the organizer to edit it.");
  const given=Buffer.from(digest(token),"hex"),expected=Buffer.from(participant.editTokenHash,"hex");
  if(given.length!==expected.length || !timingSafeEqual(given,expected)) throw new HttpError(403,"You cannot edit this starting point.");
}

export function authorizeOrganizer(session: StoredSession, token: string | null): void {
  if (!token || token.length > 256) throw new HttpError(403, "Open this session on the organizer's device. The invitation link is for joining only.");
  const candidate = Buffer.from(digest(token), "hex");
  const expected = Buffer.from(session.organizerTokenHash, "hex");
  if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) throw new HttpError(403, "The organizer key is invalid. Use the device where you created this session.");
}

async function supabase<T>(resource: string, options: RequestInit = {}): Promise<T> {
  const url = process.env.SUPABASE_URL!.replace(/\/$/, "");
  if (!url.startsWith("https://") && !url.startsWith("http://localhost") && !url.startsWith("http://127.0.0.1")) throw new HttpError(503, "SUPABASE_URL must use HTTPS (except local development).");
  let response: Response;
  try { response = await fetch(`${url}/rest/v1/${resource}`, { ...options, cache: "no-store", signal: AbortSignal.timeout(15_000), headers: { "Content-Type": "application/json", apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, ...options.headers } }); }
  catch { throw new HttpError(503, "Session storage is unavailable. Please retry shortly."); }
  if (!response.ok) {
    const body = await response.text();
    if (body.includes("SESSION_FULL")) throw new HttpError(409, "This group is full.");
    if (body.includes("SESSION_NOT_FOUND")) throw new HttpError(404, "This session could not be found.");
    if (body.includes("PARTICIPANT_NOT_FOUND")) throw new HttpError(404,"Starting point not found.");
    console.error("Supabase request failed", response.status);
    throw new HttpError(503, "Session storage could not complete the request. Check the Supabase schema and credentials.");
  }
  // PostgREST inserts return 201 with no body when return=minimal is requested.
  if (response.status === 204 || new Headers(options.headers).get("Prefer")?.includes("return=minimal")) return undefined as T;
  return await response.json() as T;
}

async function saveLocal(session: StoredSession): Promise<void> {
  const target = filename(session.id);
  await mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(session), { encoding: "utf8", mode: 0o600 });
  await rename(temp, target);
}

export async function createStoredSession(name: string, capacity: number): Promise<{ stored: StoredSession; organizerToken: string }> {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) throw new HttpError(400, "Choose a group size between 1 and 20.");
  const organizerToken = randomBytes(32).toString("base64url");
  const stored: StoredSession = { id: randomBytes(12).toString("hex"), name, capacity, createdAt: new Date().toISOString(), mode: "live", organizerTokenHash: digest(organizerToken), participants: [] };
  if (persistentStorage()) await supabase("meeting_sessions", { method: "POST", body: JSON.stringify({ id: stored.id, payload: stored }), headers: { Prefer: "return=minimal" } });
  else await saveLocal(stored);
  return { stored, organizerToken };
}

export async function getStoredSession(id: string): Promise<StoredSession> {
  validateId(id);
  if (persistentStorage()) {
    const rows = await supabase<{ payload: StoredSession }[]>(`meeting_sessions?id=eq.${encodeURIComponent(id)}&select=payload`);
    if (!rows[0]) throw new HttpError(404, "This session could not be found.");
    return rows[0].payload;
  }
  try { return JSON.parse(await readFile(filename(id), "utf8")) as StoredSession; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new HttpError(404, "This session could not be found."); throw error; }
}

const globalState = globalThis as typeof globalThis & { kulangorSessionLocks?: Map<string, Promise<unknown>> };
const locks = globalState.kulangorSessionLocks ??= new Map<string, Promise<unknown>>();

async function withLock<T>(id: string, operation: () => Promise<T>): Promise<T> {
  const previous = locks.get(id) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  locks.set(id, next);
  try { return await next; } finally { if (locks.get(id) === next) locks.delete(id); }
}

export async function addStoredParticipant(id: string, input: { name: string; placeId: string; id?:string; editToken?:string }): Promise<StoredSession> {
  validateId(id);
  const participant: StoredParticipant = { id: input.id ?? randomUUID(), name: input.name, placeId: input.placeId, color: COLORS[0], joinedAt: new Date().toISOString(),...(input.editToken?{editTokenHash:digest(input.editToken)}:{}) };
  if (persistentStorage()) return await supabase<StoredSession>("rpc/add_meeting_participant", { method: "POST", body: JSON.stringify({ p_session_id: id, p_participant: participant }) });
  return withLock(id, async () => {
    const session = await getStoredSession(id);
    if (session.participants.length >= session.capacity) throw new HttpError(409, "This group is full.");
    participant.color = COLORS[session.participants.length % COLORS.length];
    session.participants.push(participant);
    await saveLocal(session);
    return session;
  });
}

export async function updateStoredParticipant(id:string, participantId:string, input:{name:string;placeId:string}):Promise<void> {
  validateId(id);
  if(persistentStorage()) {
    await supabase("rpc/update_meeting_participant",{method:"POST",body:JSON.stringify({p_session_id:id,p_participant_id:participantId,p_name:input.name,p_place_id:input.placeId})});
    return;
  }
  await withLock(id,async()=>{
    const session=await getStoredSession(id);
    const person=session.participants.find(p=>p.id===participantId);
    if(!person)throw new HttpError(404,"Starting point not found.");
    person.name=input.name;person.placeId=input.placeId;
    await saveLocal(session);
  });
}
