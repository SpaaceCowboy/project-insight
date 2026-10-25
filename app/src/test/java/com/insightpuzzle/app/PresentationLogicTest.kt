package com.insightpuzzle.app

import androidx.compose.ui.unit.dp
import org.junit.Assert.*
import org.junit.Test

class PresentationLogicTest {
    @Test fun rewindKeepsMatchingTilesAndAssignsEveryOtherTileOnce() {
        val start = listOf("RBG", "PWY", "B.R")
        val moved = Rules.swap(Rules.swap(start, Pos(0, 0), Pos(1, 0)), Pos(2, 0), Pos(2, 2))
        val plan = rewindMoves(moved, start)
        assertEquals(8, plan.size)
        assertEquals(plan.size, plan.values.toSet().size)
        plan.forEach { (from, to) -> assertEquals(moved[from.r][from.c], start[to.r][to.c]) }
        assertEquals(Pos(0, 1), plan[Pos(0, 1)])
        assertFalse(plan.containsKey(Pos(2, 1)))
    }

    @Test fun collectionMiniaturesFitAtNormalAndEnlargedTextSizes() {
        for ((scale, sides) in listOf(1f to listOf(65.dp, 80.dp, 120.dp), 2f to listOf(80.dp, 120.dp))) for (side in sides) {
            val area = miniArea(side, scale)
            val cell = miniCell(5, 5, area)
            assertTrue(cell * 5 + MINI_GAP * 4 <= area)
            assertTrue(cell <= 14.dp)
        }
    }
}
