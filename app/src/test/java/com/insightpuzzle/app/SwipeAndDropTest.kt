package com.insightpuzzle.app

import androidx.compose.ui.geometry.Offset
import org.junit.Assert.*
import org.junit.Test

class SwipeAndDropTest {
    // 3x3 cells of 100px with 10px gaps; cell (r, c) is centred at (50 + 110c, 50 + 110r).
    private val grid = Grid(3, 3, 100f, 10f, Offset.Zero)
    private val blue = Pos(1, 1)
    private val left = Pos(1, 0)

    @Test fun dropOverTheNeighbourSwaps() {
        assertEquals(left, dropTarget(grid, blue, Offset(-110f, 0f), listOf(left)))
        assertEquals(left, dropTarget(grid, blue, Offset(-80f, 20f), listOf(left)))
    }

    @Test fun dropBelowTheNeighbourDoesNot() {
        // The cell below the left neighbour: heading left is not enough any more.
        assertNull(dropTarget(grid, blue, Offset(-110f, 110f), listOf(left)))
        // A short flick towards it doesn't count either.
        assertNull(dropTarget(grid, blue, Offset(-30f, 0f), listOf(left)))
    }

    @Test fun nearestLegalCellWins() {
        val up = Pos(0, 1)
        assertEquals(up, dropTarget(grid, blue, Offset(-20f, -100f), listOf(left, up)))
    }

    @Test fun randomTrailWalksBackAndForward() {
        val trail = RandomTrail<String>()
        assertNull(trail.at(-1)); assertNull(trail.at(1))
        trail.add("a"); trail.add("b"); trail.add("c")
        assertEquals("b", trail.at(-1)); assertNull(trail.at(1))
        trail.index -= 2
        assertEquals("a", trail.items[trail.index]); assertNull(trail.at(-1)); assertEquals("b", trail.at(1))
        trail.reset()
        assertTrue(trail.items.isEmpty()); assertNull(trail.at(1))
    }
}
