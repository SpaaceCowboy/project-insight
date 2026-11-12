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

    @Test fun aPageIsOnlySwipeableOnceItsItemsAreAllLoaded() {
        // Nothing more coming: every item is reachable, including a short last page.
        assertEquals(2, loadedPages(29, 28, false))
        assertEquals(1, loadedPages(0, 28, false))
        // More coming: only full pages count, so the swipe stops at the edge of what has loaded instead of showing a blank or half page.
        assertEquals(1, loadedPages(24, 24, true))
        assertEquals(2, loadedPages(48, 24, true))
        assertEquals(1, loadedPages(30, 24, true))
        // A first page shorter than a full one still shows (never zero pages).
        assertEquals(1, loadedPages(10, 24, true))
    }

    @Test fun clampDragKeepsTheLiftedTileInsideTheRoom() {
        val inside = clampDrag(androidx.compose.ui.geometry.Offset(10f, 10f), androidx.compose.ui.geometry.Offset(50f, 50f), 40f, 4f, 0f, 0f, 300f, 300f)
        assertEquals(androidx.compose.ui.geometry.Offset(10f, 10f), inside)
        // Dragged far past every edge, the tile stops 4 px inside the room: its top-left 4 px from the left/top, its far side 4 px from the right/bottom.
        val far = clampDrag(androidx.compose.ui.geometry.Offset(-900f, 900f), androidx.compose.ui.geometry.Offset(50f, 50f), 40f, 4f, 0f, 0f, 300f, 300f)
        assertEquals(androidx.compose.ui.geometry.Offset(4f - 50f, 256f - 50f), far)
        // A room that does not start at the origin (the creator's outline) shifts the limits with it.
        val shifted = clampDrag(androidx.compose.ui.geometry.Offset(-900f, -900f), androidx.compose.ui.geometry.Offset(150f, 150f), 40f, 4f, 100f, 100f, 400f, 400f)
        assertEquals(androidx.compose.ui.geometry.Offset(104f - 150f, 104f - 150f), shifted)
    }

    @Test fun moreItemsAreFetchedAheadOfTheReader() {
        // 20 loaded, 24 per page: the first page is already within reach of the end.
        assertTrue(needsMore(20, 0, 24, true))
        assertFalse(needsMore(20, 0, 24, false))
        assertFalse(needsMore(150, 0, 24, true))
        assertTrue(needsMore(100, 0, 24, true))
        assertTrue(needsMore(150, 2, 24, true))
    }

    @Test fun guideTextLinesAreCountedWithoutCuttingWords() {
        assertEquals(1, monoLines("Swipe to move", 20))
        assertEquals(2, monoLines("Hold the board anywhere but on a tile", 24))
        // A word longer than a line breaks across lines rather than disappearing.
        assertEquals(3, monoLines("abcdefghijklmnopqrstuvwxyz", 10))
    }

    @Test fun tallCreatorTargetsShrinkToFit() {
        val fits = 80.dp
        assertEquals(16.dp, creatorTargetCell(2, fits))
        assertTrue(creatorTargetCell(5, fits) * 5 + 3.dp * 4 <= fits)
    }

    @Test fun solvedBloomIsOverBeforeTheResultBar() {
        assertTrue(BLOOM_MS + GLOW_FADE_MS <= WIN_DELAY_MS)
        assertEquals(0f, solveSwell(0f, 0), 0f)
        // Even the farthest tile of a 5x5 board has finished its swell when the bloom ends.
        assertEquals(1f, solveSwell(1f, 8), 0f)
        assertTrue(solveSwell(.5f, 0) > solveSwell(.5f, 8))
    }

    @Test fun creatorTipsHaveAStepForEachPartOfEveryStage() {
        assertEquals(4, creatorGuideSteps(Phase.BUILD).size)
        // Building has no stage before it, so it has no swipe step; the later stages do.
        assertTrue(creatorGuideSteps(Phase.BUILD).none { "Swipe" in it })
        assertTrue(creatorGuideSteps(Phase.SHAPE).any { "Swipe" in it } && creatorGuideSteps(Phase.CHECK).any { "Swipe" in it })
        assertEquals(listOf("Build your start", "Find your target", "Preview and create"), Phase.entries.map { creatorHeading(it) })
    }

    @Test fun fourCardsSpanThePageEdgeToEdge() {
        // A list bleeds past the page by the shadow room on both sides: its four cards and three gaps cover exactly the page width.
        val page = 328.dp
        assertEquals(page.value, (cardSide(page + ShadowRoom * 2) * 4 + CARD_GAP * 3).value, .001f)
    }

    @Test fun targetMorphKeepsMatchingTilesAndLetsExtraOnesFade() {
        // Every colour has a partner: all four target tiles move, none disappears.
        val moves = rewindMoves(listOf("RB", "GP"), listOf("BR", "PG"))
        assertEquals(4, moves.size); assertEquals(4, moves.values.toSet().size)
        // Fewer tiles in the new target: one red stays, the other has nowhere to go and fades out.
        val smaller = rewindMoves(listOf("RR"), listOf("R"))
        assertEquals(1, smaller.size); assertTrue(Pos(0, 0) in smaller.values)
        // More tiles in the new target: the one old tile moves, the new one fades in (it is not a destination).
        val larger = rewindMoves(listOf("R"), listOf("RR"))
        assertEquals(1, larger.size); assertEquals(1, larger.values.toSet().size)
    }

    @Test fun savedOnlineStatsSurviveTheHomeRoundTrip() {
        val stats = OnlineStats(onlineSolved = 5, designedCount = 6, bestStreak = 7, level = 8, communityCount = 9)
        assertEquals(stats, onlineStatsFromJson(stats.toJson().toString()))
        assertNull(onlineStatsFromJson(null))
        assertNull(onlineStatsFromJson("not json"))
    }

    @Test fun creatorButtonBorderKeepsTheSameSpaceAboveAndBelow() {
        val box = GuideBox(androidx.compose.ui.geometry.Rect(0f, 10f, 100f, 50f), 14.dp, grow = 4.dp, wall = 2.dp, topGrow = 6.dp)
        assertEquals(box.grow.value + box.wall.value, box.topGrow.value, .001f)
        assertEquals(40f, box.rect.height, .001f)
    }

    @Test fun restartTripleIsAsQuietAsTheCornerDrag() {
        assertEquals(Haptics.FINE_TICK_AMPLITUDE, Haptics.TRIPLE_AMPLITUDE)
    }

    @Test fun restartTripleIsThreeShortPulsesOverHalfASecond() {
        assertEquals(5L, Haptics.TRIPLE_TICK_MS)
        assertEquals(200L, Haptics.TRIPLE_STEP_MS)
        assertTrue(2 * Haptics.TRIPLE_STEP_MS + Haptics.TRIPLE_TICK_MS <= 500)
    }
}
