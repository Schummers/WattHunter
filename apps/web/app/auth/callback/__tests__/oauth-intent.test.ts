import { describe, it, expect, vi, beforeEach } from "vitest";

const cookieStore = new Map<string, string>();
const { mockCookies } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

const mockCookieStore = {
  set: vi.fn((name: string, value: string) => cookieStore.set(name, value)),
  get: vi.fn((name: string) =>
    cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined
  ),
  delete: vi.fn((name: string) => cookieStore.delete(name)),
};

mockCookies.mockImplementation(async () => mockCookieStore);

import {
  setSignupIntentCookie,
  readSignupIntentCookie,
  clearSignupIntentCookie,
} from "../oauth-intent";

describe("oauth-intent cookie helper", () => {
  beforeEach(() => {
    cookieStore.clear();
    vi.clearAllMocks();
    // Re-apply the mock after clearAllMocks resets it
    mockCookies.mockImplementation(async () => mockCookieStore);
  });

  it("roundtrips a create intent", async () => {
    await setSignupIntentCookie({ kind: "create", league_name: "Test", team_name: "MyTeam" });
    const read = await readSignupIntentCookie();
    expect(read).toEqual({ kind: "create", league_name: "Test", team_name: "MyTeam" });
  });

  it("roundtrips a join intent", async () => {
    await setSignupIntentCookie({ kind: "join", code: "ABCDEF", team_name: "MyTeam" });
    const read = await readSignupIntentCookie();
    expect(read).toEqual({ kind: "join", code: "ABCDEF", team_name: "MyTeam" });
  });

  it("returns null when cookie is missing", async () => {
    const read = await readSignupIntentCookie();
    expect(read).toBeNull();
  });

  it("returns null on malformed JSON", async () => {
    cookieStore.set("signup_intent", "not-json");
    const read = await readSignupIntentCookie();
    expect(read).toBeNull();
  });

  it("returns null on invalid kind", async () => {
    cookieStore.set("signup_intent", JSON.stringify({ kind: "something-else" }));
    const read = await readSignupIntentCookie();
    expect(read).toBeNull();
  });

  it("clears the cookie", async () => {
    await setSignupIntentCookie({ kind: "create", league_name: "Test", team_name: "MyTeam" });
    await clearSignupIntentCookie();
    const read = await readSignupIntentCookie();
    expect(read).toBeNull();
  });
});
