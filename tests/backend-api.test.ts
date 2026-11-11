import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { POST as createSession } from "@/app/api/sessions/route";
import { GET as getSession } from "@/app/api/sessions/[id]/route";
import { GET as getJoin, POST as joinSession } from "@/app/api/sessions/[id]/join/route";
import { POST as calculate } from "@/app/api/sessions/[id]/calculate/route";
import { getStoredSession } from "@/lib/store";
import { POST as routes } from "@/app/api/sessions/[id]/routes/route";
import {GET as getParticipant,PATCH as editParticipant} from "@/app/api/sessions/[id]/participants/[participantId]/route";
import {GET as changes} from "@/app/api/sessions/[id]/changes/route";

const provider = vi.hoisted(() => ({ placeDetails: vi.fn(), nearbyVenues: vi.fn(), routeMatrix: vi.fn(), routePolyline: vi.fn() }));
vi.mock("@/lib/google", () => ({ ...provider, googleConfigured: () => true }));
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "kulangor-api-"));
  vi.stubEnv("KULANGOR_DATA_DIR", directory);
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubEnv("VERCEL", "");
  vi.clearAllMocks();
  provider.placeDetails.mockImplementation(async (id: string) => ({ id, name: "Verified place", address: "Kuala Lumpur", source: "google", lat: 3.1, lng: 101.65 }));
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });

function request(body: unknown, token?: string) { return new Request("http://localhost:3000/api", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { "X-Organizer-Token": token } : {}) }, body: JSON.stringify(body) }); }
function context(id: string) { return { params: Promise.resolve({ id }) }; }

describe("live meeting HTTP handlers", () => {
  it("requires shared storage before opening a Vercel meetup",async()=>{
    vi.stubEnv("VERCEL","1");
    const response=await createSession(request({name:"Hosted meetup",capacity:20}));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("meetup database");
  });
  it("detects remote edits without querying Google on each refresh check",async()=>{
    const result=await (await createSession(request({name:"Shared refresh",capacity:1}))).json();
    const id=result.session.id;
    const before=await (await changes(new Request("http://localhost/api"),context(id))).json();
    expect(provider.placeDetails).not.toHaveBeenCalled();
    const joined=await (await joinSession(request({name:"Sarah",placeId:"first"}),context(id))).json();
    const after=await (await changes(new Request("http://localhost/api"),context(id))).json();
    expect(after.revision).not.toBe(before.revision);
    const edit=new Request("http://localhost/api",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"Sarah",placeId:"new-start"})});
    await editParticipant(edit,{params:Promise.resolve({id,participantId:joined.participantId})});
    provider.placeDetails.mockClear();
    const updated=await (await changes(new Request("http://localhost/api"),context(id))).json();
    expect(updated.revision).not.toBe(after.revision);
    expect(Object.keys(updated)).toEqual(["revision"]);
    expect(provider.placeDetails).not.toHaveBeenCalled();
    const workspace=await (await getSession(new Request("http://localhost/api"),context(id))).json();
    expect(workspace.revision).toBe(updated.revision);
    expect(workspace.session).not.toHaveProperty("organizerTokenHash");
    expect(workspace.session.participants[0]).not.toHaveProperty("editTokenHash");
    expect(workspace.session.participants[0].place.id).toBe("new-start");
    expect((await joinSession(request({name:"Extra member",placeId:"extra"}),context(id))).status).toBe(409);
  });
  it("lets link holders edit any entry at capacity without exposing token hashes",async()=>{
    const result=await (await createSession(request({name:"Editable meetup",capacity:1}))).json();
    const joined=await (await joinSession(request({name:"Ahmad",placeId:"first"}),context(result.session.id))).json();
    const ownContext={params:Promise.resolve({id:result.session.id,participantId:joined.participantId})};
    expect((await getParticipant(new Request("http://localhost/api"),ownContext)).status).toBe(200);
    const editRequest=new Request("http://localhost/api",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"Ahmad",placeId:"changed"})});
    expect((await editParticipant(editRequest,ownContext)).status).toBe(200);
    const stored=await getStoredSession(result.session.id);
    expect(stored.participants).toHaveLength(1);
    expect(stored.participants[0].placeId).toBe("changed");
    const organizerView=await (await getSession(new Request("http://localhost/api",{headers:{"X-Organizer-Token":result.organizerToken}}),context(result.session.id))).json();
    expect(organizerView.session.participants[0]).not.toHaveProperty("editTokenHash");
  });
  it("returns each person's driving distance to the computed center, independently of a restaurant",async()=>{
    const result=await (await createSession(request({name:"Average center",capacity:20}))).json();
    for(const name of ["Ahmad","Sarah"])await joinSession(request({name,placeId:name}),context(result.session.id));
    provider.nearbyVenues.mockResolvedValue([]);
    provider.routeMatrix.mockResolvedValue([[{durationSeconds:600,distanceMeters:8000}],[null]]);
    provider.routePolyline.mockResolvedValue([{lat:3.1,lng:101.6}]);
    const response=await calculate(request({departureTime:new Date(Date.now()+3600000).toISOString()}),context(result.session.id));
    expect(response.status).toBe(200);
    const data=await response.json();
    expect(data.center.place.source).toBe("computed");
    expect(data.center.journeys[0].distanceMeters).toBe(8000);
    expect(data.center.unreachableParticipantIds).toHaveLength(1);
    expect(data.candidates).toEqual([]);
  });
  it("returns real geometry to a member using only the shared link", async () => {
    const result = await (await createSession(request({ name: "Route playback", capacity: 20 }))).json();
    const id=result.session.id;
    const departureTime=new Date(Date.now()+3600000).toISOString();
    await joinSession(request({name:"Ahmad",placeId:"origin"}),context(id));
    provider.routeMatrix.mockResolvedValue([[{durationSeconds:900,distanceMeters:10000}]]);
    provider.routePolyline.mockResolvedValue([{lat:3.1,lng:101.6},{lat:3.12,lng:101.62}]);
    const response=await routes(request({placeId:"chosen",departureTime}),context(id));
    expect(response.status).toBe(200);
    expect((await response.json()).journeys[0].polyline).toHaveLength(2);
  });
  it("rejects more than five personal venue selections before contacting Google", async () => {
    const response=await calculate(request({departureTime:new Date(Date.now()+3600000).toISOString(),selectedPlaces:Array.from({length:6},(_,i)=>({placeId:`venue-${i}`}))}),context("irrelevant"));
    expect(response.status).toBe(400);
    expect(provider.nearbyVenues).not.toHaveBeenCalled();
  });
  it("compares the organizer's selected restaurant alongside recommendations without duplicate venues", async () => {
    const result = await (await createSession(request({ name: "One meetup", capacity: 20 }))).json();
    for (const name of ["Ahmad", "Sarah"]) await joinSession(request({ name, placeId: `ChIJ-${name}` }), context(result.session.id));
    const recommended = { id: "venue-a", name: "Recommended restaurant", address: "KL", lat: 3.1, lng: 101.6, source: "google",rating:4.8,userRatingCount:900,recommendationRank:1 };
    provider.nearbyVenues.mockResolvedValue([recommended]);
    provider.routeMatrix.mockImplementation(async (_people, places) => [places.map(() => ({durationSeconds:900,distanceMeters:1000})), places.map(() => ({durationSeconds:1000,distanceMeters:1200}))]);
    provider.routePolyline.mockResolvedValue([{lat:3.1,lng:101.6}]);
    const departureTime = new Date(Date.now()+3600000).toISOString();
    const response = await calculate(request({ departureTime, selectedPlaces:[{placeId:"venue-b",sessionToken:"chosen-search"},{placeId:"venue-a"}] }, result.organizerToken), context(result.session.id));
    expect(response.status).toBe(200);
    const comparison = await response.json();
    expect(comparison.candidates.map((c: {place:{id:string}}) => c.place.id).sort()).toEqual(["venue-a","venue-b"]);
    expect(comparison.candidates.every((c: {selectedByUser:boolean}) => c.selectedByUser)).toBe(true);
    expect(provider.placeDetails).toHaveBeenCalledWith("venue-b", "chosen-search");
    expect(comparison.candidates.find((c:{place:{id:string}})=>c.place.id==="venue-a").place.rating).toBe(4.8);
    expect(comparison.candidates.find((c:{place:{id:string}})=>c.place.id==="venue-a").place.recommendationRank).toBe(1);
  });
  it("explicitly reports a personal selection that cannot be reached by everyone", async()=>{
    const result=await (await createSession(request({name:"Unreachable selection",capacity:20}))).json();
    for(const name of ["Ahmad","Sarah"])await joinSession(request({name,placeId:`ChIJ-${name}`}),context(result.session.id));
    provider.nearbyVenues.mockResolvedValue([{id:"recommended",name:"Reachable",address:"KL",lat:3.1,lng:101.6,source:"google"}]);
    provider.routeMatrix.mockResolvedValue([[{durationSeconds:900,distanceMeters:1000},{durationSeconds:900,distanceMeters:1000}],[{durationSeconds:1000,distanceMeters:1200},null]]);
    provider.routePolyline.mockResolvedValue([{lat:3.1,lng:101.6}]);
    const response=await calculate(request({departureTime:new Date(Date.now()+3600000).toISOString(),selectedPlaces:[{placeId:"unreachable"}]},result.organizerToken),context(result.session.id));
    const data=await response.json();
    expect(data.selectedPlaceIds).toEqual(["unreachable"]);
    expect(data.excludedSelectedPlaces[0].id).toBe("unreachable");
    expect(data.candidates).toHaveLength(1);
  });
  it("shares the workspace by link while keeping secrets out of responses", async () => {
    const response = await createSession(request({ name: "Real group", capacity: 2 }));
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.session.mode).toBe("live");
    expect(result.session.participants).toEqual([]);
    expect(result.session).not.toHaveProperty("organizerTokenHash");
    const id = result.session.id;
    expect((await getSession(new Request("http://localhost/api"), context(id))).status).toBe(200);
    const joined = await joinSession(request({ name: "Ahmad", placeId: "ChIJ-verified", sessionToken: "valid-token" }), context(id));
    expect(joined.status).toBe(200);
    const metadata = await (await getJoin(new Request("http://localhost/api"), context(id))).json();
    expect(metadata.participantCount).toBe(1);
    expect(metadata).not.toHaveProperty("participants");
    expect(metadata).not.toHaveProperty("organizerToken");
    const persisted = await getStoredSession(id);
    expect(persisted.participants[0].placeId).toBe("ChIJ-verified");
    expect(persisted.participants[0]).not.toHaveProperty("place");
  });

  it("rejects raw coordinate submissions and refuses demo IDs in real groups", async () => {
    const result = await (await createSession(request({ name: "Another group", capacity: 20 }))).json();
    const raw = await joinSession(request({ name: "Sarah", lat: 3.1, lng: 101.6, address: "raw text" }), context(result.session.id));
    expect(raw.status).toBe(400);
    const demo = await joinSession(request({ name: "Sarah", placeId: "demo-origin-1" }), context(result.session.id));
    expect(demo.status).toBe(400);
    expect(provider.placeDetails).not.toHaveBeenCalled();
  });

  it("calculates verified live origins and retains the winner if route artwork fails", async () => {
    const result = await (await createSession(request({ name: "Meeting group", capacity: 2 }))).json();
    const id = result.session.id;
    for (const name of ["Ahmad", "Sarah"]) expect((await joinSession(request({ name, placeId: `ChIJ-${name}` }), context(id))).status).toBe(200);
    provider.nearbyVenues.mockResolvedValue([
      { id: "venue-a", name: "Even times", address: "KL", lat: 3.1, lng: 101.6, source: "google" },
      { id: "venue-b", name: "Uneven times", address: "KL", lat: 3.11, lng: 101.61, source: "google" },
    ]);
    provider.routeMatrix.mockResolvedValue([
      [{ durationSeconds: 900, distanceMeters: 10000 }, { durationSeconds: 600, distanceMeters: 7000 }],
      [{ durationSeconds: 960, distanceMeters: 11000 }, { durationSeconds: 1800, distanceMeters: 19000 }],
    ]);
    provider.routePolyline.mockRejectedValue(new Error("Geometry unavailable"));
    const departureTime = new Date(Date.now() + 60 * 60_000).toISOString();
    const response = await calculate(request({ departureTime }, result.organizerToken), context(id));
    expect(response.status).toBe(200);
    const calculation = await response.json();
    expect(calculation.mode).toBe("live");
    expect(calculation.winner.place.id).toBe("venue-a");
    expect(calculation.winner.standardDeviationSeconds).toBe(30);
    expect(calculation.warnings.some((warning: string) => warning.includes("route lines"))).toBe(true);
    expect(provider.routeMatrix.mock.calls[0][2]).toBe(departureTime);
    expect((await getStoredSession(id))).not.toHaveProperty("calculation");
  });
});
