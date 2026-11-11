import {afterEach,expect,it,vi} from "vitest";
afterEach(()=>{vi.unstubAllEnvs();vi.resetModules();});
it("refuses to build if the private server key is reused as a public browser key",async()=>{
  vi.stubEnv("GOOGLE_MAPS_API_KEY","private-test-value");
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY","private-test-value");
  vi.resetModules();
  await expect(import("../next.config")).rejects.toThrow("Create a separate website-restricted browser key");
});
