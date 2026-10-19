package com.insightpuzzle.app

import org.junit.Assert.*
import org.junit.Test

class PlayAttemptTest {
    @Test fun interruptedAttemptKeepsItsIdentityAndSession() {
        val original = PlayAttempt.open(null, "session-a", 0, 1000)
        val restored = PlayAttempt.open(original.json(), "unused-new-session", 3, 2000)
        assertEquals(original, restored)
        assertTrue(restored.canFail(3, solved = false, dev = false))
    }
    @Test fun revisitingAfterLeavingRequiresAnotherMove() {
        val original = PlayAttempt.open(null, "session-a", 0, 1000)
        val revisited = PlayAttempt.open(original.copy(closed = true).json(), "session-b", 4, 2000)
        assertNotEquals(original.id, revisited.id)
        assertFalse(revisited.canFail(4, false, false))
        assertTrue(revisited.canFail(5, false, false))
    }
    @Test fun expiredSessionGetsNewIdentityWhileKeepingSavedProgress() {
        val original = PlayAttempt.open(null, "old", 0, 1000)
        val restored = PlayAttempt.open(original.json(), "fresh", 3, 1000 + 7 * 86400000L)
        assertEquals("fresh", restored.session)
        assertNotEquals(original.id, restored.id)
        assertEquals(3, restored.baseline)
    }
    @Test fun solvedClosedUntouchedAndDevAttemptsCannotFail() {
        val attempt = PlayAttempt.open(null, "session", 0, 1000)
        assertFalse(attempt.canFail(0, false, false))
        assertFalse(attempt.canFail(2, true, false))
        assertFalse(attempt.canFail(2, false, true))
        assertFalse(attempt.copy(closed = true).canFail(2, false, false))
    }
    @Test fun undoRestoresOriginalAttemptInsteadOfTheRestartIdentity() {
        val before = PlayAttempt.open(null, "same-session", 0, 1000)
        val restarted = PlayAttempt.open(null, "same-session", 0, 2000)
        assertNotEquals(before.id, restarted.id)
        val undone = PlayAttempt.open(before.json(), "same-session", 5, 2500)
        assertEquals(before, undone)
    }
}
