import { describe, expect, test } from "bun:test"

import { shouldRefetchOnFocus, FOCUS_REFETCH_STALE_MS, FOCUS_REFETCH_MIN_ATTEMPT_GAP_MS } from "./focus-refetch"

describe("shouldRefetchOnFocus", () => {
  const now = 1_000_000_000_000

  test("old data with an idle session refetches", () => {
    expect(shouldRefetchOnFocus({ now, lastDataUpdatedAt: now - FOCUS_REFETCH_STALE_MS - 1 })).toBe(true)
  })

  test("fresh data does not refetch", () => {
    expect(shouldRefetchOnFocus({ now, lastDataUpdatedAt: now - FOCUS_REFETCH_STALE_MS + 5_000 })).toBe(false)
    expect(shouldRefetchOnFocus({ now, lastDataUpdatedAt: now })).toBe(false)
  })

  test("boundary: exactly the window is NOT older than the window", () => {
    expect(shouldRefetchOnFocus({ now, lastDataUpdatedAt: now - FOCUS_REFETCH_STALE_MS })).toBe(false)
  })

  test("a locally running or retrying session is left to the live path", () => {
    expect(shouldRefetchOnFocus({ now, lastDataUpdatedAt: now - 10 * 60_000, sessionStatusType: "busy" })).toBe(false)
    expect(shouldRefetchOnFocus({ now, lastDataUpdatedAt: now - 10 * 60_000, sessionStatusType: "retry" })).toBe(false)
    expect(shouldRefetchOnFocus({ now, lastDataUpdatedAt: now - 10 * 60_000, sessionStatusType: "idle" })).toBe(true)
    expect(shouldRefetchOnFocus({ now, lastDataUpdatedAt: now - 10 * 60_000, sessionStatusType: undefined })).toBe(true)
  })

  test("never-loaded sessions are the initial-load path's responsibility", () => {
    expect(shouldRefetchOnFocus({ now, lastDataUpdatedAt: undefined })).toBe(false)
  })

  test("rapid focus ping-pong cannot re-try before the attempt gap floor", () => {
    expect(shouldRefetchOnFocus({
      now,
      lastDataUpdatedAt: now - 60_000,
      lastAttemptAt: now - FOCUS_REFETCH_MIN_ATTEMPT_GAP_MS + 100,
    })).toBe(false)
    expect(shouldRefetchOnFocus({
      now,
      lastDataUpdatedAt: now - 60_000,
      lastAttemptAt: now - FOCUS_REFETCH_MIN_ATTEMPT_GAP_MS,
    })).toBe(true)
  })

  test("a previous attempt that closed the data gap is caught by the staleness rule itself", () => {
    // Last attempt long ago but data refreshed since (the successful case).
    expect(shouldRefetchOnFocus({ now, lastDataUpdatedAt: now - 1_000, lastAttemptAt: now - 120_000 })).toBe(false)
  })
})
