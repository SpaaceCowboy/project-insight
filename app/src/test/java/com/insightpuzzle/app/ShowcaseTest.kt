package com.insightpuzzle.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ShowcaseTest {
    @Test fun captionsFollowTheClipsInOrder() {
        assertEquals("Join community of puzzle designers", showcaseCaption(0))
        assertEquals("Share and follow", showcaseCaption(showcaseCues[1].first))
        assertEquals("Like and bookmark", showcaseCaption(showcaseCues[2].first))
        assertEquals("Endless puzzles", showcaseCaption(showcaseCues[3].first + 1))
        assertEquals("Join community of puzzle designers", showcaseCaption(showcaseCues[1].first - 1))
    }
    @Test fun cuesStartAtZeroAndRise() {
        assertEquals(0L, showcaseCues.first().first)
        assertTrue(showcaseCues.zipWithNext().all { (a, b) -> a.first < b.first })
    }
    /** Six 3 s clips, two to a caption, then the 4 s Worlds pages: each caption changes exactly on a clip boundary. */
    @Test fun cuesFallOnClipBoundaries() {
        assertEquals(listOf(0L, 6_000L, 12_000L, 18_000L), showcaseCues.map { it.first })
    }
    @Test fun theClipIsCountedFromThePosition() {
        assertEquals(0, showcaseClip(-1)); assertEquals(0, showcaseClip(2_999)); assertEquals(1, showcaseClip(3_000))
        assertEquals(5, showcaseClip(17_999)); assertEquals(6, showcaseClip(18_000)); assertEquals(6, showcaseClip(21_999))
    }
    @Test fun thePriceIsShownInWholeAndMinorUnits() {
        assertEquals("2.99", priceText(OFFER_CENTS)); assertEquals("4.99", priceText(LIST_CENTS)); assertEquals("0.05", priceText(5)); assertEquals("10.00", priceText(1_000))
        assertTrue(OFFER_CENTS < LIST_CENTS)
    }
    @Test fun thePreviewHasItsOwnMusicAndTheGameAndCreatorHaveNone() {
        assertEquals(Track.WORLDS, musicTrack(Route.WorldsPreview))
        assertEquals(Track.MENU, musicTrack(Route.Home)); assertEquals(Track.MENU, musicTrack(Route.Purchase))
        for (route in listOf(Route.Game, Route.Win, Route.Create)) assertEquals(null, musicTrack(route))
    }
    @Test fun aPositionBeforeTheStartShowsTheFirstCaption() {
        assertEquals("Join community of puzzle designers", showcaseCaption(-50))
    }
    @Test fun theButtonSaysSignInComesFirst() {
        assertEquals("Log in and purchase", previewButtonLabel(signedIn = false))
        assertEquals("Purchase", previewButtonLabel(signedIn = true))
        assertTrue("Log in and purchase" in Translations.keys)
        assertTrue("One-time purchase" in Translations.keys)
    }
}
