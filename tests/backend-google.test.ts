import { afterEach, describe, expect, it, vi } from "vitest";
import { autocomplete, decodePolyline, placeDetails, routeMatrix } from "@/lib/google";
import type { Participant, Place } from "@/lib/types";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Google provider boundary", () => {
  it("flags whole towns while allowing a specific neighborhood",async()=>{
    vi.stubEnv("GOOGLE_MAPS_API_KEY","test-key");
    vi.stubGlobal("fetch",async()=>Response.json({suggestions:[
      {placePrediction:{placeId:"town",types:["locality","political"],structuredFormat:{mainText:{text:"Subang Jaya"},secondaryText:{text:"Selangor, Malaysia"}}}},
      {placePrediction:{placeId:"neighborhood",types:["sublocality_level_1","political"],structuredFormat:{mainText:{text:"Bandar Baru Sri Petaling"}}}},
    ]}));
    const suggestions=await autocomplete("Subang","search-token");
    expect(suggestions[0].broadArea).toBe(true);
    expect(suggestions[1].broadArea).toBe(false);
    expect(suggestions[0].address).toBe("Selangor, Malaysia");
  });
  it("accepts verified locations outside the former KL/Selangor restriction", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
    vi.stubGlobal("fetch", async () => Response.json({ id: "outside", location: { latitude: 2.7, longitude: 101.9 }, formattedAddress: "Negeri Sembilan, Malaysia", addressComponents: [{ longText: "Negeri Sembilan", types: ["administrative_area_level_1"] }] }));
    expect((await placeDetails("outside")).address).toBe("Negeri Sembilan, Malaysia");
  });

  it("accepts verified places in Selangor", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
    vi.stubGlobal("fetch", async () => Response.json({ id: "selangor", location: { latitude: 3.1, longitude: 101.6 }, addressComponents: [{ longText: "Selangor", types: ["administrative_area_level_1"] }] }));
    expect((await placeDetails("selangor")).id).toBe("selangor");
  });
  it("sends optimal-traffic batches of at most 100 and places unordered matrix cells by their indices", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
    const destinations: Place[] = Array.from({ length: 15 }, (_, i) => ({ id: `venue-${i}`, name: `Venue ${i}`, address: "KL", lat: 3.1, lng: 101.6, source: "google" }));
    const origins: Participant[] = Array.from({ length: 20 }, (_, i) => ({ id: `person-${i}`, name: `Person ${i}`, color: "#123456", joinedAt: "2026-01-01", place: { ...destinations[0], id: `origin-${i}` } }));
    const departureTime = "2026-12-01T12:00:00.000Z";
    const requests: Record<string, unknown>[] = [];
    const fetcher = vi.fn(async (_url: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      requests.push(body);
      const cells = body.origins.flatMap((_: unknown, origin: number) => body.destinations.map((destination: { waypoint: { placeId: string } }, index: number) => {
        const globalDestination = Number(destination.waypoint.placeId.split("-")[1]);
        const duration = origin * 100 + globalDestination;
        return { ...(origin ? { originIndex: origin } : {}), ...(index ? { destinationIndex: index } : {}), condition: "ROUTE_EXISTS", duration: `${duration}s`, ...(duration ? { distanceMeters: duration * 10 } : {}) };
      })).reverse();
      return Response.json(cells);
    });
    vi.stubGlobal("fetch", fetcher);
    const matrix = await routeMatrix(origins, destinations, departureTime);
    expect(fetcher).toHaveBeenCalledTimes(3);
    for (const request of requests) {
      expect((request.origins as unknown[]).length * (request.destinations as unknown[]).length).toBeLessThanOrEqual(100);
      expect(request.departureTime).toBe(departureTime);
      expect(request.routingPreference).toBe("TRAFFIC_AWARE_OPTIMAL");
    }
    expect(matrix[19][14]).toEqual({ durationSeconds: 1914, distanceMeters: 19140 });
    expect(matrix[0][0]).toEqual({ durationSeconds: 0, distanceMeters: 0 });
  });

  it("decodes route polylines without swapping latitude and longitude", () => {
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([{ lat: 38.5, lng: -120.2 }, { lat: 40.7, lng: -120.95 }, { lat: 43.252, lng: -126.453 }]);
    expect(() => decodePolyline("_")).toThrow();
  });

  it("does not expose provider response bodies or secret keys on failure", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-private-key");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { message: "test-private-key internal rejection" } }, { status: 403 })));
    await expect(placeDetails("ChIJ-test")).rejects.toThrow("Check API access");
    try { await placeDetails("ChIJ-test"); } catch (error) { expect((error as Error).message).not.toContain("test-private-key"); }
  });
});
