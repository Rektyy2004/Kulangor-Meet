import type { Calculation, Coordinate, MeetingSession, Place } from "./types";
import { geographicCentroid, rankCandidates } from "./fairness";

export const COLORS = ["#e87549", "#6086ce", "#9b79bf", "#e5b74b", "#47a495", "#d978a1", "#719952", "#c48e64", "#7485c3", "#49a9ba", "#ce6f68", "#a49a50", "#59857a", "#ab7a9c", "#87a1bc", "#b67d48", "#c09cba", "#6298a2", "#929765", "#767eb1"];
const origins = [
  ["Ahmad", "Bandar Sunway", 3.073, 101.609], ["Sarah", "Damansara Uptown", 3.137, 101.622],
  ["Wei Ming", "Subang Jaya", 3.045, 101.585], ["Priya", "Bangsar", 3.129, 101.672],
  ["Daniel", "Mont Kiara", 3.171, 101.65], ["Aisha", "Shah Alam", 3.074, 101.519],
  ["Jason", "Cheras", 3.086, 101.742], ["Mei Ling", "Setapak", 3.202, 101.716],
  ["Farhan", "Kota Damansara", 3.158, 101.591], ["Nadia", "Puchong", 3.023, 101.618],
  ["Arjun", "Brickfields", 3.129, 101.688], ["Siti", "Ampang", 3.15, 101.765],
  ["Kevin", "Kepong", 3.218, 101.636], ["Hannah", "TTDI", 3.146, 101.628],
  ["Hakim", "Sri Petaling", 3.067, 101.69], ["Rachel", "Kelana Jaya", 3.098, 101.6],
  ["Dinesh", "Sentul", 3.184, 101.688], ["Nurul", "Bukit Jalil", 3.055, 101.67],
  ["Chloe", "Old Klang Road", 3.093, 101.674], ["Imran", "Wangsa Maju", 3.204, 101.735],
] as const;

export const DEMO_PLACES: Place[] = origins.map(([name, area, lat, lng], i) => ({ id: `demo-origin-${i}`, name: area, address: `${area}, Kuala Lumpur & Selangor`, lat, lng, source: "demo" }));
export const DEMO_VENUES: Place[] = [
  ["The Gardens Mall", 3.118, 101.677, "Shopping mall"], ["Mid Valley Megamall", 3.118, 101.676, "Shopping mall"],
  ["Bangsar Village", 3.13, 101.671, "Shopping mall"], ["KL Gateway Mall", 3.115, 101.664, "Shopping mall"],
  ["The Sphere", 3.111, 101.666, "Cafés & dining"], ["KL Eco City Mall", 3.117, 101.673, "Shopping mall"],
  ["Jaya One", 3.118, 101.635, "Shopping mall"], ["Taman Jaya", 3.104, 101.646, "Park"],
  ["Amcorp Mall", 3.105, 101.646, "Shopping mall"], ["Bangsar Shopping Centre", 3.143, 101.668, "Shopping mall"],
  ["Perdana Botanical Garden", 3.143, 101.685, "Park"], ["Nu Sentral", 3.133, 101.687, "Shopping mall"],
  ["Central Market", 3.146, 101.695, "Shopping mall"], ["APW Bangsar", 3.127, 101.673, "Cafés & dining"],
  ["Taman Tasik Perdana", 3.142, 101.684, "Park"],
].map(([name, lat, lng, category], i) => ({ id: `demo-venue-${i}`, name: String(name), address: "Kuala Lumpur, Malaysia", lat: Number(lat), lng: Number(lng), category: String(category), source: "demo" }));

export function demoSession(): MeetingSession {
  return { id: "demo", name: "The weekend catch-up", capacity: 20, mode: "demo", createdAt: "2026-11-09T00:00:00.000Z", participants: origins.map(([name], i) => ({ id: `demo-member-${i}`, name, place: DEMO_PLACES[i], color: COLORS[i], joinedAt: "2026-11-09T00:00:00.000Z" })) };
}

function syntheticPath(origin: Coordinate, destination: Coordinate, seed: number): Coordinate[] {
  const points: Coordinate[] = [origin];
  for (let step = 1; step < 8; step++) {
    const t = step / 8;
    const wobble = Math.sin(t * Math.PI) * 0.008;
    points.push({ lat: origin.lat + (destination.lat - origin.lat) * t + Math.sin(seed + step) * wobble, lng: origin.lng + (destination.lng - origin.lng) * t + Math.cos(seed + step) * wobble });
  }
  return [...points, destination];
}

export function calculateDemo(departureTime: string): Calculation {
  const session = demoSession();
  const matrix = session.participants.map((_, origin) => DEMO_VENUES.map((_, destination) => {
    // Explicitly synthetic fixed fixtures, never described as traffic estimates.
    const minutes = 22 + destination * 0.8 + Math.sin(origin * 2.4 + destination) * (4 + destination * 0.7) + (origin % 3) * 1.2;
    return { durationSeconds: Math.round(minutes * 60), distanceMeters: Math.round(minutes * 490) };
  }));
  const candidates = rankCandidates(session.participants, DEMO_VENUES, matrix);
  for (const candidate of candidates) candidate.journeys = candidate.journeys.map((journey, index) => ({ ...journey, polyline: syntheticPath(session.participants[index].place, candidate.place, index) }));
  return { sessionId: "demo", departureTime, calculatedAt: new Date().toISOString(), mode: "demo", centroid: geographicCentroid(session.participants.map((p) => p.place)), candidates, winner: candidates[0], warnings: ["Demonstration only: members, travel times, distances, and route lines are synthetic. No live traffic requests were made.", "Minimum standard deviation balances travel times; it does not necessarily minimize the longest journey or the time range."] };
}
