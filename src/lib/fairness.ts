import type { CandidateResult, Coordinate, Participant, Place } from "./types";

export type MatrixCell = { durationSeconds: number; distanceMeters: number } | null;
export type Matrix = MatrixCell[][];
export type ProviderCell = { originIndex?: number; destinationIndex?: number; status?: { code?: number }; condition?: string; duration?: string; distanceMeters?: number };

export function geographicCentroid(points: Coordinate[]): Coordinate {
  if (!points.length) throw new Error("At least one coordinate is required.");
  const reference=points[0].lng;
  const longitude=points.reduce((sum,p)=>sum+reference+((p.lng-reference+540)%360-180),0)/points.length;
  return {lat:points.reduce((sum,p)=>sum+p.lat,0)/points.length,lng:((longitude+540)%360)-180};
}

export function matrixBatches(originCount: number, destinationCount: number): { offset: number; count: number }[] {
  if (!Number.isInteger(originCount) || originCount < 1 || originCount > 20 || !Number.isInteger(destinationCount) || destinationCount < 1) throw new Error("Invalid matrix dimensions.");
  const batchSize = Math.floor(100 / originCount);
  return Array.from({ length: Math.ceil(destinationCount / batchSize) }, (_, index) => ({ offset: index * batchSize, count: Math.min(batchSize, destinationCount - index * batchSize) }));
}

export function assembleMatrixBatch(matrix: Matrix, cells: ProviderCell[], offset: number, count: number): void {
  for (const cell of cells) {
    // Protobuf JSON may omit scalar zero indices.
    const origin = cell.originIndex ?? 0;
    const destination = cell.destinationIndex ?? 0;
    if (!Number.isInteger(origin) || origin < 0 || origin >= matrix.length || !Number.isInteger(destination) || destination < 0 || destination >= count || offset + destination >= matrix[origin].length) throw new Error("Routing provider returned invalid matrix indices.");
    if (cell.condition !== "ROUTE_EXISTS" || (cell.status?.code ?? 0) !== 0) continue;
    const duration = /^\d+(?:\.\d+)?s$/.test(cell.duration ?? "") ? Number(cell.duration!.slice(0, -1)) : NaN;
    const distance = cell.distanceMeters ?? (duration === 0 ? 0 : NaN);
    if (!Number.isFinite(duration) || duration < 0 || !Number.isFinite(distance) || distance < 0) continue;
    matrix[origin][offset + destination] = { durationSeconds: duration, distanceMeters: distance };
  }
}

export function rankCandidates(participants: Participant[], places: Place[], matrix: Matrix): CandidateResult[] {
  if (!participants.length) return [];
  return places.flatMap((place, index) => {
    const cells = participants.map((_, origin) => matrix[origin]?.[index]);
    if (cells.some((cell) => !cell || !Number.isFinite(cell.durationSeconds) || cell.durationSeconds < 0 || !Number.isFinite(cell.distanceMeters) || cell.distanceMeters < 0)) return [];
    const valid = cells as Exclude<MatrixCell, null>[];
    const durations = valid.map((cell) => cell.durationSeconds);
    const meanSeconds = durations.reduce((a, b) => a + b, 0) / durations.length;
    const standardDeviationSeconds = Math.sqrt(durations.reduce((sum, time) => sum + (time - meanSeconds) ** 2, 0) / durations.length);
    const maxSeconds = Math.max(...durations);
    const minSeconds = Math.min(...durations);
    return [{ place, journeys: valid.map((cell, origin) => ({ participantId: participants[origin].id, ...cell })), standardDeviationSeconds, meanSeconds, maxSeconds, minSeconds, rangeSeconds: maxSeconds - minSeconds }];
  }).sort((a, b) => a.standardDeviationSeconds - b.standardDeviationSeconds || a.meanSeconds - b.meanSeconds || a.maxSeconds - b.maxSeconds || a.place.id.localeCompare(b.place.id));
}
