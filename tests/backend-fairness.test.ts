import { describe, expect, it } from "vitest";
import { rankCandidates, geographicCentroid, matrixBatches, assembleMatrixBatch } from "@/lib/fairness";
import type { Participant, Place } from "@/lib/types";

const places: Place[] = ["a", "b", "c"].map((id) => ({ id, name: id, address: id, lat: 3, lng: 101, source: "demo" }));
const people: Participant[] = ["one", "two"].map((id) => ({ id, name: id, color: "#fff", joinedAt: "2026-01-01", place: places[0] }));

describe("meeting fairness", () => {
  it("uses population standard deviation and breaks equal deviation by average time", () => {
    const ranked = rankCandidates(people, places, [
      [{ durationSeconds: 1200, distanceMeters: 1000 }, { durationSeconds: 600, distanceMeters: 1000 }, { durationSeconds: 900, distanceMeters: 1000 }],
      [{ durationSeconds: 1800, distanceMeters: 1000 }, { durationSeconds: 1200, distanceMeters: 1000 }, { durationSeconds: 2100, distanceMeters: 1000 }],
    ]);
    expect(ranked.map((r) => r.place.id)).toEqual(["b", "a", "c"]);
    expect(ranked[0].standardDeviationSeconds).toBe(300);
    expect(ranked[0].rangeSeconds).toBe(600);
  });
  it("excludes a candidate unreachable by even one participant", () => {
    expect(rankCandidates(people, places.slice(0, 1), [[{ durationSeconds: 60, distanceMeters: 10 }], [null]])).toEqual([]);
  });
  it("rejects missing origin rows instead of treating them as zero travel time", () => {
    expect(rankCandidates(people, places.slice(0, 1), [[{ durationSeconds: 60, distanceMeters: 10 }]])).toEqual([]);
  });
  it("averages the submitted coordinates and rejects empty groups", () => {
    expect(geographicCentroid([{ lat: 2, lng: 100 }, { lat: 4, lng: 102 }])).toEqual({ lat: 3, lng: 101 });
    expect(() => geographicCentroid([])).toThrow();
  });
  it("batches a 20 by 15 matrix into three requests of 100 elements", () => {
    expect(matrixBatches(20, 15)).toEqual([{ offset: 0, count: 5 }, { offset: 5, count: 5 }, { offset: 10, count: 5 }]);
  });
  it("assembles out-of-order cells using both returned indices and the destination offset", () => {
    const matrix = Array.from({ length: 2 }, () => Array(3).fill(null));
    assembleMatrixBatch(matrix, [
      { originIndex: 1, destinationIndex: 0, condition: "ROUTE_EXISTS", duration: "90.5s", distanceMeters: 200 },
      { originIndex: 0, destinationIndex: 0, condition: "ROUTE_NOT_FOUND", status: { code: 5 } },
    ], 2, 1);
    expect(matrix[1][2]).toEqual({ durationSeconds: 90.5, distanceMeters: 200 });
    expect(matrix[0][2]).toBeNull();
  });
  it("does not accept provider error cells, invalid durations, or out-of-bounds indices", () => {
    const matrix = [[null]];
    assembleMatrixBatch(matrix, [{ originIndex: 0, destinationIndex: 0, condition: "ROUTE_EXISTS", status: { code: 7 }, duration: "50s", distanceMeters: 20 }], 0, 1);
    expect(matrix[0][0]).toBeNull();
    expect(() => assembleMatrixBatch(matrix, [{ originIndex: 2, destinationIndex: 0, condition: "ROUTE_EXISTS", duration: "50s", distanceMeters: 20 }], 0, 1)).toThrow();
  });
  it("accepts protobuf omitted zero distance only for an explicit zero-duration valid route", () => {
    const matrix = [[null, null]];
    assembleMatrixBatch(matrix, [
      { condition: "ROUTE_EXISTS", duration: "0s" },
      { destinationIndex: 1, condition: "ROUTE_EXISTS", duration: "50s" },
    ], 0, 2);
    expect(matrix[0][0]).toEqual({ durationSeconds: 0, distanceMeters: 0 });
    expect(matrix[0][1]).toBeNull();
  });
});
