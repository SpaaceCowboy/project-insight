package com.insightpuzzle.app

import org.junit.Assert.*
import org.junit.Test

class CreatorCropTest {
    @Test fun startDropsEmptyOuterRowsAndColumns() {
        val s = CreatorState()
        s.resize(5, 5)
        // Tiles only in the middle 2x2 of a 5x5 grid; R and B can swap, so the start is valid.
        s.place('R', Pos(1, 1)); s.place('B', Pos(1, 2)); s.place('B', Pos(2, 1)); s.place('R', Pos(2, 2))
        s.pressStart()
        assertEquals(Phase.SHAPE, s.phase)
        assertEquals(listOf("RB", "BR"), s.start)
        assertEquals(2, s.rows); assertEquals(2, s.cols)
    }

    @Test fun innerHolesStay() {
        val s = CreatorState()
        s.resize(4, 4)
        // R and B side by side can swap; the empty middle row is inside the used area, so it stays.
        s.place('R', Pos(0, 1)); s.place('B', Pos(0, 2)); s.place('B', Pos(2, 1))
        s.pressStart()
        assertEquals(listOf("RB", "..", "B."), s.start)
    }
}
