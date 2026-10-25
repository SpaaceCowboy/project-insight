package com.insightpuzzle.app

import org.junit.Assert.*
import org.junit.Test
import java.io.File

class FeedbackAssetsTest {
    private val raw = File("src/main/res/raw")
    private val raw29 = File("src/main/res/raw-v29")

    @Test fun everyCueShipsAsMp3AndOpus() {
        for (cue in Cue.entries) {
            val name = "zen_" + cue.name.lowercase()
            assertTrue("$name.mp3", File(raw, "$name.mp3").length() > 0)
            assertTrue("$name.ogg", File(raw29, "$name.ogg").length() > 0)
        }
    }

    @Test fun oldEffectsAreGone() {
        val left = raw.list()!!.filter { it.startsWith("note_") || it in setOf("sfx_select.wav", "sfx_move.wav", "sfx_deny.wav", "sfx_win.wav") }
        assertEquals(emptyList<String>(), left)
    }
}
