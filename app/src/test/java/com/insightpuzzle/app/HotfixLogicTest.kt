package com.insightpuzzle.app

import androidx.compose.ui.unit.dp
import org.junit.Assert.*
import org.junit.Test

class HotfixLogicTest {
    @Test fun journeySwipeStopsAtLockedLevelsAndEnds() {
        val unlocked = { i: Int -> i < 3 }
        assertEquals(1, journeyStep(0, 1, 10, unlocked))
        assertEquals(1, journeyStep(2, -1, 10, unlocked))
        // The latest unlocked level: the next one is locked.
        assertNull(journeyStep(2, 1, 10, unlocked))
        assertNull(journeyStep(0, -1, 10, unlocked))
        assertNull(journeyStep(9, 1, 10) { true })
    }

    @Test fun sliderHoldsItsStopUntilPastTheDetent() {
        assertEquals(4, detentStop(4, 4.5f, 10))
        assertEquals(5, detentStop(4, 4.6f, 10))
        assertEquals(4, detentStop(4, 3.5f, 10))
        assertEquals(3, detentStop(4, 3.4f, 10))
        // A fast drag walks several stops at once, and never past the ends.
        assertEquals(8, detentStop(2, 8.1f, 10))
        assertEquals(10, detentStop(9, 10f, 10))
        assertEquals(0, detentStop(1, 0f, 10))
    }

    @Test fun pagesHoldTheRightNumberOfItems() {
        assertEquals(1, pageCount(0, 28))
        assertEquals(1, pageCount(28, 28))
        assertEquals(2, pageCount(29, 28))
        assertEquals(listOf(24, 25), pageItems((0..25).toList(), 1, 24))
        assertEquals(emptyList<Int>(), pageItems((0..25).toList(), 2, 24))
        // Journey 8 rows, profile 3, Worlds 6 of four cards; players 8.
        assertEquals(32, JOURNEY_ROWS * CARD_COLUMNS)
        assertEquals(12, PROFILE_ROWS * CARD_COLUMNS)
        assertEquals(24, WORLD_ROWS * CARD_COLUMNS)
        // Bookmarked has room for one more row than Worlds.
        assertEquals(WORLD_ROWS + 1, BOOKMARK_ROWS)
        // ...and asks the server for exactly a page of items (the server accepts 24 or 28), so the first fetch fills the first page.
        assertEquals(28, BOOKMARK_ROWS * CARD_COLUMNS)
    }

    @Test fun codeMenuOpensBesideItsPuzzleButton() {
        // Four cards 70 wide with 8 across and 10 down; the menu is three cards wide and one tall.
        val size = androidx.compose.ui.geometry.Size(70f * 3 + 16f, 70f)
        fun card(column: Int, row: Int) = androidx.compose.ui.geometry.Rect(column * 78f, row * 80f, column * 78f + 70f, row * 80f + 70f)
        fun place(column: Int, row: Int, above: Boolean = false) = detailPlacement(card(column, row), column, above, size, 8f, 10f)
        // First column: to its right, over columns 1 to 3 of the same row.
        assertEquals(androidx.compose.ui.geometry.Offset(78f, 80f), place(0, 1))
        // Last column: to its left, over columns 0 to 2.
        assertEquals(androidx.compose.ui.geometry.Offset(0f, 80f), place(3, 1))
        // Middle columns: below, centred on the card, so columns 0 to 2 for the second and 1 to 3 for the third.
        assertEquals(androidx.compose.ui.geometry.Offset(0f, 160f), place(1, 1))
        assertEquals(androidx.compose.ui.geometry.Offset(78f, 160f), place(2, 1))
        // In the bottom row they go above instead.
        assertEquals(androidx.compose.ui.geometry.Offset(0f, 0f), place(1, 1, above = true))
    }

    @Test fun startAndTargetGridsUseTheGameSizeAndFitTheShell() {
        // Roomy shell: the game's cap wins, so a small grid is as big as in play.
        assertEquals(88f, creatorGameCell(900f, 900f, 2, 2, 10f, 64f, 88f), 0.001f)
        // Tight shell: five columns share the width left after the padding and gaps.
        assertEquals((400f - 64f - 40f) / 5, creatorGameCell(400f, 900f, 5, 5, 10f, 64f, 88f), 0.001f)
    }

    @Test fun usernamesAreClippedToTwentyCharacters() {
        assertEquals("a".repeat(20), Nicknames.clip("a".repeat(30)))
        // An emoji is one character, as the server counts it.
        assertEquals("🧩".repeat(20), Nicknames.clip("🧩".repeat(25)))
        assertEquals("Quiet Cove", Nicknames.clip("Quiet Cove"))
    }

    @Test fun moreItemsAreFetchedAheadOfTheReader() {
        // 20 loaded, 24 per page: the first page is already within reach of the end.
        assertTrue(needsMore(20, 0, 24, true))
        assertFalse(needsMore(20, 0, 24, false))
        assertFalse(needsMore(100, 0, 24, true))
        assertTrue(needsMore(100, 2, 24, true))
    }

    @Test fun tallCreatorTargetsShrinkToFit() {
        val fits = 80.dp
        assertEquals(16.dp, creatorTargetCell(2, fits))
        assertTrue(creatorTargetCell(5, fits) * 5 + 3.dp * 4 <= fits)
    }
}
