import { afterEach, describe, expect, it, vi } from "vitest";
import { createStoredSession } from "@/lib/store";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Supabase session persistence", () => {
  it("returns organizer access when a successful minimal insert has HTTP 201 and an empty body", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
    vi.stubGlobal("fetch", async () => new Response(null, { status: 201 }));
    const result = await createStoredSession("Weekend catch-up", 20);
    expect(result.organizerToken).toMatch(/^[\w-]{40,}$/);
    expect(result.stored.name).toBe("Weekend catch-up");
    expect(result.stored.participants).toEqual([]);
  });
});
