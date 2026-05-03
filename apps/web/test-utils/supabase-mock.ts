/**
 * Shared Supabase mock helpers for vitest server-action tests.
 *
 * Why these exist:
 * - Server actions like placeBid / validateRound chain 5–10 supabase calls
 *   per invocation (.from().select().eq()...). Each call returns a "chain"
 *   that resolves to { data, error, count }.
 * - Mocking that surface inline in every test file led to 4 divergent copies
 *   across the codebase. This module is the single source of truth.
 *
 * Usage:
 *
 *     import { makeChain, installSequence } from "@/test-utils/supabase-mock";
 *
 *     const { mockFrom, mockGetUser } = vi.hoisted(() => ({
 *       mockFrom: vi.fn(),
 *       mockGetUser: vi.fn(),
 *     }));
 *
 *     vi.mock("@/lib/supabase/server", () => ({
 *       createClient: vi.fn(async () => ({
 *         from: mockFrom,
 *         auth: { getUser: mockGetUser },
 *       })),
 *     }));
 *
 *     // Inside a test:
 *     const { recordedInserts, recordedUpdates } = installSequence(mockFrom, [
 *       { table: "teams", data: { id: "...", user_id: "..." } },
 *       { table: "auction_bids", data: [], count: 0 },
 *       { table: "auction_bids", data: { id: "..." } }, // insert returns row
 *     ]);
 *
 *     // ... call action ...
 *     expect(recordedInserts.auction_bids).toHaveLength(1);
 */
import { type Mock } from "vitest";

export type ChainResult = {
  data?: unknown;
  error?: unknown;
  count?: number;
};

/**
 * Build a thenable that mimics the Supabase JS query chain.
 * All chainable methods (.eq, .select, etc.) return the same chain.
 * Awaiting the chain or calling .single() / .maybeSingle() resolves
 * to { data, error, count }.
 */
export function makeChain(data: unknown = null, error: unknown = null): Record<string, unknown> {
  const result: ChainResult = {
    data,
    error,
    count: Array.isArray(data) ? data.length : 0,
  };
  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
    catch: (reject: (v: unknown) => unknown) =>
      Promise.resolve(result).catch(reject),
    finally: (cb: () => void) => Promise.resolve(result).finally(cb),
  };
  for (const m of [
    "select",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "like",
    "ilike",
    "is",
    "not",
    "or",
    "match",
    "single",
    "maybeSingle",
    "update",
    "insert",
    "upsert",
    "delete",
    "order",
    "limit",
    "range",
    "contains",
  ]) {
    chain[m] = () => chain;
  }
  return chain;
}

export type StepSpec = {
  /** Expected table name. The sequence asserts this matches the actual call. */
  table: string;
  /** Result data. Arrays become `count = data.length` automatically. */
  data?: unknown;
  /** Optional error result. */
  error?: unknown;
};

/**
 * Install a deterministic sequence of supabase.from(...) responses.
 *
 * The sequence is consumed in order — each `mockFrom(table)` call pops the
 * next step. If `table` doesn't match the expected step, the mock throws
 * so the test fails with a clear "got X expected Y" message.
 *
 * Insert and update payloads are captured in `recordedInserts` /
 * `recordedUpdates`, keyed by table name, for assertions like
 * `expect(recordedUpdates.teams[0]).toMatchObject({ treasury: 1000 })`.
 */
export function installSequence(
  mockFrom: Mock,
  steps: Array<StepSpec>,
): {
  recordedInserts: Record<string, unknown[]>;
  recordedUpdates: Record<string, unknown[]>;
  recordedUpserts: Record<string, unknown[]>;
} {
  const recordedInserts: Record<string, unknown[]> = {};
  const recordedUpdates: Record<string, unknown[]> = {};
  const recordedUpserts: Record<string, unknown[]> = {};
  let callIdx = 0;

  mockFrom.mockImplementation((table: string) => {
    const step = steps[callIdx++];
    if (step && step.table !== table) {
      throw new Error(
        `Supabase mock sequence mismatch at call ${callIdx - 1}: expected from("${step.table}"), got from("${table}")`,
      );
    }
    if (!step) {
      throw new Error(
        `Supabase mock sequence exhausted at call ${callIdx - 1}: no more steps but action called from("${table}")`,
      );
    }

    const chain = makeChain(step.data ?? null, step.error ?? null);

    // Wrap insert/update/upsert to capture payloads.
    const baseInsert = chain.insert as () => Record<string, unknown>;
    chain.insert = (payload: unknown) => {
      (recordedInserts[table] ??= []).push(payload);
      return baseInsert();
    };
    const baseUpdate = chain.update as () => Record<string, unknown>;
    chain.update = (payload: unknown) => {
      (recordedUpdates[table] ??= []).push(payload);
      return baseUpdate();
    };
    const baseUpsert = chain.upsert as () => Record<string, unknown>;
    chain.upsert = (payload: unknown) => {
      (recordedUpserts[table] ??= []).push(payload);
      return baseUpsert();
    };

    return chain;
  });

  return { recordedInserts, recordedUpdates, recordedUpserts };
}

/**
 * Convenience: stub mockGetUser to return a logged-in user.
 *
 *     mockGetUser.mockResolvedValue(loggedInUser("user-123"));
 */
export function loggedInUser(id: string) {
  return { data: { user: { id } }, error: null };
}

/**
 * Convenience: stub mockGetUser to return no user.
 */
export const noAuthUser = { data: { user: null }, error: null };
