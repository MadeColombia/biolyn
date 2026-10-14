import { vi } from "vitest";

export type Call = { method: string; args: unknown[] };

// A stand-in for a Supabase query like
// `supabase.from("links").select("id").eq("profile_id", id)`.
// Every method returns the same builder, and awaiting it gives `result`.
// `calls` records each method so tests can check the filters used.
export function fakeQuery<T>(result: T) {
  const calls: Call[] = [];
  const builder: Record<string | symbol, unknown> = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (value: T) => unknown) => resolve(result);
        }
        if (prop === "calls") return calls;
        return (...args: unknown[]) => {
          calls.push({ method: String(prop), args });
          return builder;
        };
      },
    },
  );
  return builder as { calls: Call[] } & Record<string, unknown>;
}

// A fake client whose `from(table)` returns the next queued result for
// that table, and whose `rpc` and `auth` are plain mocks.
export function fakeClient(tables: Record<string, unknown[]> = {}) {
  const queries: Record<string, ReturnType<typeof fakeQuery>[]> = {};
  const queues = Object.fromEntries(
    Object.entries(tables).map(([k, v]) => [k, [...v]]),
  );
  const from = vi.fn((table: string) => {
    const queue = queues[table] ?? [];
    const result = queue.length > 1 ? queue.shift() : queue[0];
    const q = fakeQuery(result ?? { data: null, error: null });
    (queries[table] ??= []).push(q);
    return q;
  });
  const remove = vi.fn(async () => ({ data: null, error: null }));
  const upload = vi.fn<(...args: unknown[]) => Promise<{ data: unknown; error: unknown }>>(
    async () => ({ data: null, error: null }),
  );
  return {
    from,
    queries,
    rpc: vi.fn<
      (...args: unknown[]) => Promise<{ data: unknown; error: unknown }>
    >(async () => ({ data: null, error: null })),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null } })),
      signOut: vi.fn(async () => ({ error: null })),
      exchangeCodeForSession: vi.fn(async () => ({ error: null })),
    },
    storage: {
      from: vi.fn((bucket: string) => ({
        remove,
        upload,
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${bucket}/${path}` },
        }),
      })),
      remove,
      upload,
    },
  };
}

export type FakeClient = ReturnType<typeof fakeClient>;
