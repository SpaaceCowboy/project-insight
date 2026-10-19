package com.insightpuzzle.app

import androidx.compose.ui.geometry.Offset
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GridTest {
    // 3 x 3 cells of 50px with 5px gaps: the grid spans 160px, from (100, 100) to (260, 260).
    private val grid = Grid(3, 3, 50f, 5f, Offset(100f, 100f))

    @Test
    fun pointsOverTheGridAreNotOutside() {
        assertFalse(grid.isOutside(Offset(180f, 180f), 5f))
        assertFalse(grid.isOutside(Offset(152f, 120f), 5f))
    }

    @Test
    fun theSlackAroundTheEdgeStillCountsAsInside() {
        assertFalse(grid.isOutside(Offset(265f, 180f), 5f))
        assertFalse(grid.isOutside(Offset(95f, 180f), 5f))
        assertFalse(grid.isOutside(Offset(180f, 95f), 5f))
        assertFalse(grid.isOutside(Offset(180f, 265f), 5f))
    }

    @Test
    fun pastTheSlackOnAnySideIsOutside() {
        assertTrue(grid.isOutside(Offset(266f, 180f), 5f))
        assertTrue(grid.isOutside(Offset(94f, 180f), 5f))
        assertTrue(grid.isOutside(Offset(180f, 94f), 5f))
        assertTrue(grid.isOutside(Offset(180f, 266f), 5f))
    }
}
