package com.insightpuzzle.app

import org.junit.Assert.*
import org.junit.Test

class RateLimitCooldownTest {
    @Test fun retryAfterSupportsBothHttpFormsAndJsonFallback() {
        assertEquals(120_000L, retryAfterMillis("120"))
        assertEquals(120_000L, retryAfterMillis("Wed, 21 Oct 2015 07:30:00 GMT", nowMillis = 1445412480000L))
        assertEquals(30_000L, retryAfterMillis("bad", 30))
        assertEquals(0L, retryAfterMillis(null))
        assertEquals(0L, retryAfterMillis("-2"))
        assertEquals(86_400_000L, retryAfterMillis("999999999999"))
    }
    @Test fun feedbackCooldownDoesNotBlockGameplayOrAnotherAccount() {
        val c = RateLimitCooldown(now = { 1000 })
        c.remember(429, "feedback", "POST", "/v1/feedback", "player-a", 60_000)
        assertNull(c.remaining("GET", "/v1/progress", "player-a"))
        assertNull(c.remaining("POST", "/v1/completions", "player-a"))
        assertNull(c.remaining("POST", "/v1/feedback", "player-b"))
        assertEquals(60_000L, c.remaining("POST", "/v1/feedback", "player-a")!!.remainingMillis)
    }
    @Test fun discoveryAndSyncBudgetsSpanRoutesAndQueryChanges() {
        val c = RateLimitCooldown(now = { 1000 })
        c.remember(429, "discovery", "GET", "/v1/grids?page=0", "a", 2000)
        assertNotNull(c.remaining("GET", "/v1/creators?page=1", "a"))
        assertNotNull(c.remaining("GET", "/v1/grids?page=2", "a"))
        assertNull(c.remaining("GET", "/v1/progress", "a"))
        c.remember(429, "sync", "POST", "/v1/completions", "a", 3000)
        assertNotNull(c.remaining("POST", "/v1/progress/import", "a"))
        assertNotNull(c.remaining("POST", "/v1/play-sessions/123/failures", "a"))
        assertNull(c.remaining("POST", "/v1/grids", "a"))
    }
    @Test fun sharedIpAuthBudgetBlocksAllInteractiveAuthButNotGameplay() {
        val c = RateLimitCooldown(now = { 1000 })
        c.remember(429, "authIp", "POST", "/v1/auth/login", null, 2000)
        assertNotNull(c.remaining("POST", "/v1/auth/register", null))
        assertNotNull(c.remaining("POST", "/v1/auth/google", null))
        assertNull(c.remaining("GET", "/v1/capabilities", null))
        assertNull(c.remaining("GET", "/v1/progress", "a"))
    }
    @Test fun addressCooldownsNormalizeTheAddressAndAllowAnotherAccountToSignIn() {
        val c = RateLimitCooldown(now = { 1000 })
        c.remember(429, "authPair", "POST", "/v1/auth/login", null, 2000, " Person@Example.test ")
        assertNotNull(c.remaining("POST", "/v1/auth/login", null, "person@example.test"))
        assertNull(c.remaining("POST", "/v1/auth/login", null, "another@example.test"))
        assertTrue(c.snapshot().keys.all { it.matches(Regex("[0-9a-f]{64}")) })
    }
    @Test fun persistenceExpiryAndDuplicateResponsesKeepTheLatestDeadline() {
        var now = 1000L
        val c = RateLimitCooldown(now = { now })
        c.remember(429, "sync", "POST", "/v1/completions", "a", 5000)
        c.remember(429, "sync", "POST", "/v1/completions", "a", 1000)
        assertEquals(5000L, c.remaining("POST", "/v1/completions", "a")!!.remainingMillis)
        val restored = RateLimitCooldown(c.snapshot(), now = { now })
        now = 3000
        assertEquals(3000L, restored.remaining("POST", "/v1/completions", "a")!!.remainingMillis)
        now = 6000
        assertNull(restored.remaining("POST", "/v1/completions", "a"))
        assertTrue(restored.snapshot().isEmpty())
    }
    @Test fun edgeAndStoreOutagesBlockRequestsForTheProvidedDelay() {
        val c = RateLimitCooldown(now = { 1000 })
        c.remember(503, "store", "POST", "/v1/completions", "a", 3000)
        assertEquals(503, c.remaining("GET", "/v1/creators", "a")!!.status)
        assertNotNull(c.remaining("POST", "/v1/auth/login", null))
        val edge = RateLimitCooldown(now = { 1000 })
        edge.remember(429, "edge", "POST", "/v1/auth/login", null, 1000)
        assertNotNull(edge.remaining("GET", "/v1/capabilities", null))
    }
    @Test fun unknownPoliciesFallBackToTheEndpointAndSnapshotsContainOnlyHashesAndTimes() {
        val c = RateLimitCooldown(now = { 1000 })
        c.remember(429, "untrusted-policy", "POST", "/v1/feedback", "private-user-id", 1000)
        assertNotNull(c.remaining("POST", "/v1/feedback", "private-user-id"))
        assertNull(c.remaining("GET", "/v1/progress", "private-user-id"))
        assertTrue(c.snapshot().keys.all { it.matches(Regex("[0-9a-f]{64}")) })
    }
}
