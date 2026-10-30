package com.insightpuzzle.app

import org.junit.Assert.*
import org.junit.Test
import java.io.File

class FeedbackAssetsTest {
    private val raw = File("src/main/res/raw")
    private val raw29 = File("src/main/res/raw-v29")

    @Test fun everyCueShipsAsMp3AndOpus() {
        for (cue in Cue.entries) {
            val name = cue.file
            assertTrue("$name.mp3", File(raw, "$name.mp3").length() > 0)
            assertTrue("$name.ogg", File(raw29, "$name.ogg").length() > 0)
        }
    }

    @Test fun landingTilesAreSeventyPercentAndSolvedPuzzlesNinetyOfTheOtherCues() {
        // Volume relative to the original zen cues (1.0) at the same Effects setting, allowing for how loud each file is stored.
        fun relative(cue: Cue) = cue.gain * cue.stored / ZEN_STORED
        assertEquals(.7f, relative(Cue.DROP), .001f)
        assertEquals(.9f, relative(Cue.SUCCESS), .001f)
        for (cue in Cue.entries) { assertTrue(cue.name, cue.gain <= 1f); if (cue != Cue.DROP && cue != Cue.SUCCESS) assertEquals(cue.name, 1f, cue.gain, 0f) }
    }

    @Test fun solvedPuzzleCueIsNotTheOldZenSuccess() {
        assertFalse(File(raw, "zen_success.mp3").exists())
        assertFalse(File(raw29, "zen_success.ogg").exists())
    }

    @Test fun oldEffectsAreGone() {
        val left = raw.list()!!.filter { it.startsWith("note_") || it in setOf("sfx_select.wav", "sfx_move.wav", "sfx_deny.wav", "sfx_win.wav") }
        assertEquals(emptyList<String>(), left)
    }
}
