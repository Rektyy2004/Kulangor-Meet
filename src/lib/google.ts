import type { Coordinate, Participant, Place, Suggestion } from "./types";
import { HttpError } from "./errors";
import { assembleMatrixBatch, matrixBatches, type Matrix, type ProviderCell } from "./fairness";
import {rankRestaurants} from "./restaurant-ranking";

type GooglePlace = { id?: string; displayName?: { text?: string }; formattedAddress?: string; location?: { latitude?: number; longitude?: number }; primaryType?: string; types?:string[]; rating?:number; userRatingCount?:number; businessStatus?:string; googleMapsUri?:string };
function broadArea(types:string[]=[]):boolean { return !types.some(t=>t.startsWith("sublocality") || t==="neighborhood") && types.some(t=>t==="locality" || t==="country" || t.startsWith("administrative_area_level_")); }
const PLACES = "https://places.googleapis.com/v1";

export function googleConfigured(): boolean { return Boolean(process.env.GOOGLE_MAPS_API_KEY); }

async function googleRequest<T>(url: string, options: { body?: unknown; mask?: string; timeout?: number } = {}): Promise<T> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) throw new HttpError(503, "Live mapping needs GOOGLE_MAPS_API_KEY. Add your Google credentials in .env.local and restart the app, or explore the demonstration.");
  let response: Response;
  try {
    response = await fetch(url, { method: options.body ? "POST" : "GET", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, ...(options.mask ? { "X-Goog-FieldMask": options.mask } : {}) }, body: options.body ? JSON.stringify(options.body) : undefined, cache: "no-store", signal: AbortSignal.timeout(options.timeout ?? 15_000) });
  } catch { throw new HttpError(504, "Google Maps did not respond in time. Please retry shortly."); }
  if (!response.ok) {
    console.error("Google Maps request rejected", response.status);
    throw new HttpError(502, response.status === 429 ? "Google Maps quota was reached. Please wait or check your billing quota." : "Google Maps could not complete this request. Check API access, key restrictions, and billing.");
  }
  try { return await response.json() as T; } catch { throw new HttpError(502, "Google Maps returned an invalid response."); }
}

function parsePlace(place: GooglePlace): Place {
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;
  if (!place.id || !Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpError(502, "The selected place has no usable coordinates.");
  if(lat! < -90 || lat! > 90 || lng! < -180 || lng! > 180) throw new HttpError(502,"The selected place has invalid coordinates.");
  return { id: place.id, name: place.displayName?.text || "Selected location", address: place.formattedAddress || "", lat: lat!, lng: lng!, source: "google", broadArea:broadArea(place.types ?? (place.primaryType?[place.primaryType]:[])), category: place.primaryType?.replaceAll("_", " "),rating:place.rating,userRatingCount:place.userRatingCount,businessStatus:place.businessStatus,googleMapsUri:place.googleMapsUri };
}

export async function autocomplete(input: string, sessionToken: string): Promise<Suggestion[]> {
  type Prediction = { placePrediction?: { placeId?: string; types?:string[]; text?: { text?: string }; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } } } };
  const data = await googleRequest<{ suggestions?: Prediction[] }>(`${PLACES}/places:autocomplete`, { body: { input, languageCode: "en", sessionToken } });
  return (data.suggestions ?? []).flatMap(({ placePrediction: place }) => place?.placeId ? [{ id: place.placeId, name: place.structuredFormat?.mainText?.text || place.text?.text || "Selected location", address: place.structuredFormat?.secondaryText?.text || "", broadArea:broadArea(place.types) }] : []);
}

export async function placeDetails(placeId: string, sessionToken?: string): Promise<Place> {
  const query = sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : "";
  const data = await googleRequest<GooglePlace>(`${PLACES}/places/${encodeURIComponent(placeId)}${query}`, { mask: "id,displayName,formattedAddress,location,primaryType,types" });
  const place = parsePlace(data);
  if (place.id !== placeId) throw new HttpError(502, "Google Maps returned a different location. Please select your address again.");
  return place;
}

export async function nearbyVenues(center: Coordinate): Promise<Place[]> {
  const data = await googleRequest<{ places?: GooglePlace[] }>(`${PLACES}/places:searchNearby`, { mask: "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.rating,places.userRatingCount,places.businessStatus,places.googleMapsUri", body: { includedTypes: ["restaurant"], maxResultCount: 20, rankPreference:"POPULARITY", languageCode: "en", locationRestriction: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: 5000 } } } });
  return rankRestaurants((data.places ?? []).map(parsePlace));
}

function waypoint(place:Place){return place.source==="computed"?{location:{latLng:{latitude:place.lat,longitude:place.lng}}}:{placeId:place.id};}

export async function routeMatrix(origins: Participant[], destinations: Place[], departureTime: string): Promise<Matrix> {
  const matrix: Matrix = origins.map(() => destinations.map(() => null));
  await Promise.all(matrixBatches(origins.length, destinations.length).map(async ({ offset, count }) => {
    const cells = await googleRequest<ProviderCell[]>("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", { timeout: 45_000, mask: "originIndex,destinationIndex,status,condition,duration,distanceMeters", body: { origins: origins.map((p) => ({ waypoint: waypoint(p.place) })), destinations: destinations.slice(offset, offset + count).map((p) => ({ waypoint: waypoint(p) })), travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE_OPTIMAL", departureTime } });
    if (!Array.isArray(cells)) throw new HttpError(502, "Google Maps returned an invalid travel-time matrix.");
    assembleMatrixBatch(matrix, cells, offset, count);
  }));
  return matrix;
}

export function decodePolyline(encoded: string): Coordinate[] {
  const result: Coordinate[] = [];
  let index = 0, lat = 0, lng = 0;
  function component(): number {
    let value = 0, shift = 0, byte = 0;
    do {
      if (index >= encoded.length || shift > 30) throw new Error("Invalid route polyline.");
      byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 63) throw new Error("Invalid route polyline.");
      value |= (byte & 31) << shift;
      shift += 5;
    } while (byte >= 32);
    return value & 1 ? ~(value >> 1) : value >> 1;
  }
  while (index < encoded.length) { lat += component(); lng += component(); result.push({ lat: lat / 100_000, lng: lng / 100_000 }); }
  return result;
}

export async function routePolyline(origin: Place, destination: Place, departureTime: string): Promise<Coordinate[]> {
  const data = await googleRequest<{ routes?: { polyline?: { encodedPolyline?: string } }[] }>("https://routes.googleapis.com/directions/v2:computeRoutes", { timeout: 30_000, mask: "routes.polyline.encodedPolyline", body: { origin: waypoint(origin), destination: waypoint(destination), travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE_OPTIMAL", departureTime } });
  const encoded = data.routes?.[0]?.polyline?.encodedPolyline;
  if (!encoded) throw new HttpError(502, "No route geometry was available for one member.");
  return decodePolyline(encoded);
}
