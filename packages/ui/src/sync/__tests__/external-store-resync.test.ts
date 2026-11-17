import { beforeEach, describe, expect, mock, test } from "bun:test"
import type { Session } from "@opencode-ai/sdk/v2/client"

// ── Module seams the external-store repair touches ────────────────────────
const calls: { sessionGet: string[]; refreshTail: Array<{ directory: string; sessionID: string }>; upserted: Session[] } = {
  sessionGet: [],
  refreshTail: [],
  upserted: [],
}

let fetchedSession: Session | null = null

mock.module("@/lib/opencode/client", () => ({
  opencodeClient: {
    setDirectory: () => undefined,
    getCurrentDirectory: () => "/served",
    getSessionStatusForDirectory: async () => ({}),
    getScopedSdkClient: () => ({
      session: {
        get: async ({ sessionID }: { sessionID: string }) => {
          calls.sessionGet.push(sessionID)
          return { data: fetchedSession }
        },
      },
    }),
  },
}))

mock.module("../session-message-loader", () => ({
  SessionMessageLoader: class {
    subscribeNextUpdates() { return () => undefined }
  },
  EMPTY_SESSION_MESSAGE_LOAD_STATE: { status: "idle", updatedAt: undefined },
  getImperativeSessionMessageLoader: () => ({
    refreshTail: async (target: { directory: string; sessionID: string }) => {
      calls.refreshTail.push(target)
    },
    getSnapshot: () => ({ status: "ready", updatedAt: 1 }),
  }),
  setImperativeSessionMessageLoader: () => undefined,
}))

mock.module("@/stores/useGlobalSessionsStore", () => ({
  resolveGlobalSessionDirectory: (session: { directory?: unknown }) =>
    typeof session?.directory === "string" && session.directory ? session.directory : null,
  mergeSessionDirectoryMetadata: (incoming: Session) => incoming,
  mergeLiveSessionWithGlobalSession: (live: Session) => live,
  getSessionStructuralSignature: (session: { id?: string }) => String(session?.id ?? ""),
  isGlobalSessionRecencyOnlyUpdate: () => false,
  ensureGlobalSessionsLoaded: async () => ({ ok: true, sessions: [] }),
  refreshGlobalSessions: async () => ({ ok: true, sessions: [] }),
  refreshGlobalSessionsForDirectories: async () => ({ ok: true, sessions: [] }),
  useGlobalSessionsStore: {
    getState: () => ({
      activeSessions: [] as Session[],
      archivedSessions: [] as Session[],
      upsertSession: (session: Session) => { calls.upserted.push(session) },
      upsertSessions: (sessions: Session[]) => { calls.upserted.push(...sessions) },
      removeSessions: () => undefined,
      setSessionStatus: () => undefined,
      setSessionStatusSnapshot: () => undefined,
      applyStatusSnapshot: () => undefined,
    }),
  },
}))

mock.module("@/lib/runtime-switch", () => ({
  getRuntimeKey: () => "runtime-test",
  getRuntimeApiBaseUrl: () => "http://127.0.0.1:4096",
  initializeRuntimeEndpoint: () => undefined,
  switchRuntimeEndpoint: () => undefined,
  subscribeRuntimeEndpointChanged: () => () => undefined,
  subscribeRuntimeEndpointWillChange: () => () => undefined,
}))

const { resyncSessionAfterExternalStoreUpdate } = await import("../sync-context")

function createStore(existing: Session[]) {
  let state: Record<string, unknown> = {
    session: [...existing],
    sessionTotal: existing.filter((s) => !s.parentID).length,
    session_status: {},
    message: {},
    part: {},
  }
  return {
    getState: () => state,
    setState: (patch: unknown) => {
      const next = typeof patch === "function"
        ? (patch as (s: unknown) => Record<string, unknown>)(state)
        : patch as Record<string, unknown>
      state = { ...state, ...next }
    },
  }
}

const aSession = (id: string, updated: number): Session =>
  ({ id, title: `title ${id}`, directory: "/served", time: { created: 1, updated } }) as Session

beforeEach(() => {
  calls.sessionGet.length = 0
  calls.refreshTail.length = 0
  calls.upserted.length = 0
  fetchedSession = null
})

describe("resyncSessionAfterExternalStoreUpdate", () => {
  test("authoritatively re-reads the session and re-publishes it through the session.updated router", async () => {
    const store = createStore([aSession("ses_known", 10)])
    const routingIndex = {
      sessionDirectoryById: new Map<string, string>(),
      sessionMessageIdsById: new Map<string, string>(),
      messageSessionById: new Map<string, string>(),
    }
    fetchedSession = aSession("ses_known", 20)

    await resyncSessionAfterExternalStoreUpdate("/served", store as never, routingIndex as never, "ses_known")

    expect(calls.sessionGet).toEqual(["ses_known"])
    expect(calls.refreshTail).toEqual([{ directory: "/served", sessionID: "ses_known" }])
    // The child store got the fresher row…
    const stored = (store.getState().session as Session[]).find((s) => s.id === "ses_known")
    expect(stored?.time.updated).toBe(20)
    // …and the global store consumer saw a session.updated for it.
    expect(calls.upserted.some((s) => s.id === "ses_known" && s.time.updated === 20)).toBe(true)
    expect(routingIndex.sessionDirectoryById.get("ses_known")).toBe("/served")
  })

  test("a failed header read still refreshes messages and publishes nothing", async () => {
    const store = createStore([aSession("ses_known", 10)])
    const routingIndex = {
      sessionDirectoryById: new Map<string, string>(),
      sessionMessageIdsById: new Map<string, string>(),
      messageSessionById: new Map<string, string>(),
    }
    fetchedSession = null // header fetch yields no data

    await resyncSessionAfterExternalStoreUpdate("/served", store as never, routingIndex as never, "ses_known")

    expect(calls.sessionGet).toEqual(["ses_known"])
    expect(calls.refreshTail).toHaveLength(1)
    expect(calls.upserted).toEqual([])
  })
})
