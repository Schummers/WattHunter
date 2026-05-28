// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const revalidateTagMock = vi.fn();
vi.mock("next/cache", () => ({
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
}));

import { POST } from "../route";

function makeRequest(authHeader?: string): Request {
  return new Request("http://localhost/api/admin/revalidate-demo", {
    method: "POST",
    headers: authHeader ? { Authorization: authHeader } : {},
  });
}

describe("POST /api/admin/revalidate-demo", () => {
  beforeEach(() => {
    revalidateTagMock.mockReset();
    process.env.REVALIDATE_SECRET = "shh-secret";
  });

  it("returns 500 when REVALIDATE_SECRET is not configured", async () => {
    delete process.env.REVALIDATE_SECRET;
    const res = await POST(makeRequest("Bearer shh-secret"));
    expect(res.status).toBe(500);
  });

  it("returns 401 when the token is missing or wrong", async () => {
    const r1 = await POST(makeRequest());
    expect(r1.status).toBe(401);
    const r2 = await POST(makeRequest("Bearer nope"));
    expect(r2.status).toBe(401);
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("calls revalidateTag('demo-league') on a valid request", async () => {
    const res = await POST(makeRequest("Bearer shh-secret"));
    expect(res.status).toBe(200);
    expect(revalidateTagMock).toHaveBeenCalledWith("demo-league", "default");
  });
});
