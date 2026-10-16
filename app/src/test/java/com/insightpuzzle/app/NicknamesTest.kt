package com.insightpuzzle.app

import org.junit.Assert.*
import org.junit.Test

class NicknamesTest {
    @Test fun unicodeNamesAndSpacingMatchTheServerRules() {
        assertEquals("My Name", Nicknames.normalize("  Ｍｙ\u3000Name "))
        assertTrue(Nicknames.valid("پازل\u200cباز 🎮"))
        assertTrue(Nicknames.valid("🧩".repeat(32)))
        assertFalse(Nicknames.valid("🧩".repeat(33)))
        for (name in listOf("", "   ", "\u200c\u200d", "bad\u202ename", "a\u0000b")) assertFalse(name, Nicknames.valid(name))
    }
}
