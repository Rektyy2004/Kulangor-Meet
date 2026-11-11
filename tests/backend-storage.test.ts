import { afterEach, describe, expect, it, vi } from "vitest";
import { createStoredSession } from "@/lib/store";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Supabase session persistence", () => {
  it("sends a Supabase secret key as an API key instead of a bearer JWT", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test_value");
    const fetcher = vi.fn(async (_url: string, _options: RequestInit) => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetcher);
    await createStoredSession("Weekend catch-up", 20);
    const headers = new Headers(fetcher.mock.calls[0][1].headers);
    expect(headers.get("apikey")).toBe("sb_secret_test_value");
    expect(headers.has("authorization")).toBe(false);
  });
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
