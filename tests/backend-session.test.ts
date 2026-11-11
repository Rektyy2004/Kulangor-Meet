import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { addStoredParticipant, createStoredSession, getStoredSession, authorizeOrganizer } from "@/lib/store";
import { futureDeparture } from "@/lib/errors";

let directory: string;
beforeEach(async () => { directory = await mkdtemp(path.join(tmpdir(), "kulangor-test-")); process.env.KULANGOR_DATA_DIR = directory; });
afterEach(async () => { delete process.env.KULANGOR_DATA_DIR; await rm(directory, { recursive: true, force: true }); });

describe("private meeting sessions", () => {
  it("stores only an organizer token hash and rejects an unrelated token", async () => {
    const { stored, organizerToken } = await createStoredSession("Friends", 20);
    const loaded = await getStoredSession(stored.id);
    expect(loaded.organizerTokenHash).not.toBe(organizerToken);
    expect(() => authorizeOrganizer(loaded, organizerToken)).not.toThrow();
    expect(() => authorizeOrganizer(loaded, "wrong")).toThrow();
  });
  it("enforces capacity atomically across concurrent joins", async () => {
    const { stored } = await createStoredSession("Small group", 1);
    const results = await Promise.allSettled([
      addStoredParticipant(stored.id, { name: "Ahmad", placeId: "verified-a" }),
      addStoredParticipant(stored.id, { name: "Sarah", placeId: "verified-b" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await getStoredSession(stored.id)).participants).toHaveLength(1);
  });
  it("does not leak participants between different sessions or persist Google coordinates", async () => {
    const a = await createStoredSession("First", 20);
    const b = await createStoredSession("Second", 20);
    await addStoredParticipant(a.stored.id, { name: "Ahmad", placeId: "a-google-id" });
    expect((await getStoredSession(b.stored.id)).participants).toEqual([]);
    const participant = (await getStoredSession(a.stored.id)).participants[0];
    expect(participant).toHaveProperty("placeId", "a-google-id");
    expect(participant).not.toHaveProperty("lat");
    expect(participant).not.toHaveProperty("place");
  });
  it("rejects invalid IDs before any filesystem access", async () => {
    await expect(getStoredSession("../../private")).rejects.toThrow();
  });
  it("requires a future departure with time for all matrix requests", () => {
    const now = Date.parse("2026-11-09T12:00:00Z");
    expect(() => futureDeparture("2026-11-09T12:01:00Z", now)).toThrow();
    expect(() => futureDeparture("invalid", now)).toThrow();
    expect(futureDeparture("2026-11-09T13:00:00Z", now)).toBe("2026-11-09T13:00:00.000Z");
  });
});
