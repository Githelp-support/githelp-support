import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
}

/**
 * In-tab mutex lock that replaces Supabase's default navigator.locks.
 * navigator.locks can deadlock across tabs (see supabase/supabase-js#1594),
 * but removing locking entirely (noOpLock) causes concurrent token refreshes
 * within the same tab to race and corrupt the session. This serializes auth
 * operations within one tab without cross-tab coordination.
 */
const inTabLock = async <R>(
    name: string,
    acquireTimeout: number,
    fn: () => Promise<R>
): Promise<R> => {
    const locks = inTabLock as unknown as {
        _queues?: Map<string, Promise<unknown>>;
    };
    if (!locks._queues) locks._queues = new Map();

    const prev = locks._queues.get(name) ?? Promise.resolve();

    let resolve: () => void;
    const next = new Promise<void>((r) => {
        resolve = r;
    });
    locks._queues.set(name, next);

    const timeout =
        acquireTimeout > 0
            ? new Promise<never>((_, reject) =>
                  setTimeout(
                      () => reject(new Error(`Lock "${name}" acquire timeout`)),
                      acquireTimeout
                  )
              )
            : null;

    const waitForTurn = prev.then(() => fn());

    try {
        return timeout
            ? await (Promise.race([waitForTurn, timeout]) as Promise<R>)
            : await waitForTurn;
    } finally {
        resolve!();
    }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { lock: inTabLock },
});
