package com.insightpuzzle.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ShowcaseTest {
    @Test fun captionsFollowTheClipsInOrder() {
        assertEquals("Join the community of puzzle designers around the world", showcaseCaption(0))
        assertEquals("Share and follow", showcaseCaption(showcaseCues[1].first))
        assertEquals("Like and bookmark", showcaseCaption(showcaseCues[2].first))
        assertEquals("Endless puzzles", showcaseCaption(showcaseCues[3].first + 1))
        assertEquals("Join the community of puzzle designers around the world", showcaseCaption(showcaseCues[1].first - 1))
    }
    @Test fun cuesStartAtZeroAndRise() {
        assertEquals(0L, showcaseCues.first().first)
        assertTrue(showcaseCues.zipWithNext().all { (a, b) -> a.first < b.first })
    }
    /** Six 2 s clips, two to a caption, then the 4 s Worlds pages: each caption changes exactly on a clip boundary. */
    @Test fun cuesFallOnClipBoundaries() {
        assertEquals(listOf(0L, 4_000L, 8_000L, 12_000L), showcaseCues.map { it.first })
    }
    @Test fun aPositionBeforeTheStartShowsTheFirstCaption() {
        assertEquals("Join the community of puzzle designers around the world", showcaseCaption(-50))
    }
    @Test fun theButtonSaysSignInComesFirst() {
        assertEquals("Log in and purchase", previewButtonLabel(signedIn = false))
        assertEquals("Purchase", previewButtonLabel(signedIn = true))
        assertTrue("Log in and purchase" in Translations.keys)
    }
}
